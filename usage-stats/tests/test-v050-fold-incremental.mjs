// tests/test-v050-fold-incremental.mjs
// v0.5.0 步骤 2：折叠内核（lib/fold.js）—— 增量 ≡ 全量的 property 测试。
//
// 这是本次重构的正确性地基：只要"分片增量折叠"与"一次性全量折叠"对同一事件流
// 恒等，扫描器就可以放心地只读新增字节、只折叠新帧。
//
// 覆盖：增量≡全量深比较 / 幂等（重读同字节无副作用）/ seq 空洞 → gap /
//       跨分片的 tool-call↔tool-result 与 step↔message 配对 / 脏事件不污染 /
//       保留量裁剪边界 / header 补偿 / 兼容包装 aggregateSession。
//
// 用法：node tests/test-v050-fold-incremental.mjs
// 期望：PASS 所有条目；任一 FAIL 立即 process.exit(1)。

import {
  aggregateSession,
  beijingDayKey,
  withSessionHeaderEvent,
  createFoldState,
  foldEvents,
  pruneBuckets,
  toFiniteNumber,
} from '../lib/fold.js'
import { MINUTE_KEEP_MS, HOUR_KEEP_MS, BEIJING_OFFSET_MS } from '../lib/constants.js'

const results = []
function assert(label, cond, detail) {
  results.push({ label, ok: !!cond, detail })
  if (!cond) console.error(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`)
}

const stable = (o) => JSON.stringify(o)

/** 与桶同形的零值对象（用于不变量断言）。 */
function emptyLike(bucket) {
  const out = {}
  for (const k of Object.keys(bucket)) out[k] = 0
  return out
}

/* ------------------------------------------------------------------ *
 * 事件流构造器：模拟真实 DSH 日志（header 无 seq，事件 seq 从 0 递增）
 * ------------------------------------------------------------------ */
function buildStream(baseMs = 1791000000000) {
  const events = []
  let seq = 0
  const push = (event) => events.push({ seq: seq++, time: baseMs + seq * 1000, ...event })
  push({ type: 'request/header', data: { header: { config: { provider: 'deepseek', model: 'v4-flash' } } } })
  push({ type: 'step/start', data: { turn: 1, step: 1 } })
  push({ type: 'assistant/message', data: { turn: 1, step: 1, usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 2000, cacheWriteTokens: 0, reasoningTokens: 5 } } })
  push({ type: 'tool/call', data: { turn: 1, step: 1, callId: 'call_a', name: 'bash' } })
  push({ type: 'step/end', data: { turn: 1, step: 1 } })
  push({ type: 'tool/result', data: { message: { source: { callId: 'call_a' } } } })
  push({ type: 'step/start', data: { turn: 1, step: 2 } })
  push({ type: 'request/header', data: { header: { config: { provider: 'deepseek', model: 'v4-pro' } } } })
  push({ type: 'assistant/message', data: { turn: 1, step: 2, usage: { inputTokens: 50, outputTokens: 10, cacheReadTokens: 500, cacheWriteTokens: 4, reasoningTokens: 0 } } })
  push({ type: 'step/end', data: { turn: 1, step: 2 } })
  push({ type: 'session/title', data: { title: '增量折叠' } })
  push({ type: 'turn/end', data: { turn: 1 } })
  return events
}

const headerEvent = { type: 'session', version: 4, id: 'sess-inc', createdAt: 1790999000000, cwd: '/tmp/proj', isSeeded: false, delegationDepth: 0, agentPreset: 'standard' }
const fullStream = [headerEvent, ...buildStream()]

/* ------------------------------------------------------------------ *
 * 1) property：任意切分下 增量折叠 ≡ 全量折叠
 * ------------------------------------------------------------------ */
{
  const baseline = aggregateSession(fullStream, 'sess-inc')
  let mismatches = 0
  const chunkSizes = [1, 2, 3, 5, 7, 12, 13, 100]
  for (const size of chunkSizes) {
    const fold = createFoldState('sess-inc')
    for (let i = 0; i < fullStream.length; i += size) {
      const part = fullStream.slice(i, i + size)
      const r = foldEvents(fold, part)
      if (r.gap) { mismatches += 1; break }
    }
    if (stable(fold.agg) !== stable(baseline)) {
      mismatches += 1
      if (mismatches === 1) {
        console.error('    首个不一致切分:', size)
        console.error('    全量:', stable(baseline).slice(0, 400))
        console.error('    增量:', stable(fold.agg).slice(0, 400))
      }
    }
  }
  assert(`1.1 8 种切分（1/2/3/5/7/12/13/100 事件一片）下增量与全量深比较恒等`, mismatches === 0, `mismatches=${mismatches}`)
  assert('1.2 全量折叠的 lastSeq = 最大事件 seq', baseline.lastSeq === buildStream().length - 1, `lastSeq=${baseline.lastSeq}`)
  assert('1.3 全量折叠跨帧/跨片后工具耗时仍配对上', baseline.tools.bash && baseline.tools.bash.calls === 1 && baseline.tools.bash.ms > 0, `tools=${stable(baseline.tools)}`)
  assert('1.4 不变量：totals ≡ Σ models（增量维护不能只累加 models）', (() => {
    const sum = emptyLike(baseline.totals)
    for (const k of Object.keys(baseline.models)) {
      const b = baseline.models[k]
      sum.inputTokens += b.inputTokens; sum.outputTokens += b.outputTokens
      sum.cacheReadTokens += b.cacheReadTokens; sum.cacheWriteTokens += b.cacheWriteTokens
      sum.reasoningTokens += b.reasoningTokens; sum.requests += b.requests
    }
    return stable(sum) === stable(baseline.totals)
  })(), `totals=${stable(baseline.totals)}, models=${stable(baseline.models)}`)
}

/* ------------------------------------------------------------------ *
 * 2) 幂等：同一段字节重复折叠无副作用（at-least-once 语义的基础）
 * ------------------------------------------------------------------ */
{
  const fold = createFoldState('sess-inc')
  const first = foldEvents(fold, fullStream)
  const after1 = stable(fold.agg)
  const second = foldEvents(fold, fullStream)
  assert('2.1 首次折叠全部 applied、无 duplicate', first.applied === fullStream.length && first.duplicate === 0, `applied=${first.applied}, duplicate=${first.duplicate}`)
  assert('2.2 重复折叠同一批 → 全部 duplicate、状态逐字节不变', second.duplicate === fullStream.length - 1 && second.applied === 1 && stable(fold.agg) === after1, `dup=${second.duplicate}, applied=${second.applied}`)
  assert('2.3 重复折叠不重复计 token', fold.agg.totals.requests === 2 && fold.agg.totals.inputTokens === 150, `requests=${fold.agg.totals.requests}, input=${fold.agg.totals.inputTokens}`)
  assert('2.4 重复折叠不重复计 steps/turns', fold.agg.steps === 2 && fold.agg.turns === 1, `steps=${fold.agg.steps}, turns=${fold.agg.turns}`)
}

/* ------------------------------------------------------------------ *
 * 3) 非稠密 seq 是常态：水位只做去重，不做连续性断言
 *    （实测真实日志：v0 世代写入 assistant/chunk 与带 seq0 的流式分片，
 *      可见 seq 序列本来就有跳号 —— 若把它当"空洞"会误伤 69% 的会话）
 * ------------------------------------------------------------------ */
{
  const fold = createFoldState('sess-gap')
  const r1 = foldEvents(fold, fullStream.slice(0, 3))
  const before = stable(fold.agg)
  const holed = [
    { seq: 9, time: 1791000500000, type: 'assistant/message', data: { usage: { inputTokens: 999 } } },
    { seq: 10, time: 1791000501000, type: 'step/end', data: { turn: 1, step: 1 } },
  ]
  const r2 = foldEvents(fold, holed)
  assert('3.1 前缀折叠正常', r1.applied === 3, `applied=${r1.applied}`)
  assert('3.2 seq 跳号不被当作异常（事件照常应用，无 gap 概念）', r2.applied === 2 && !('gap' in r2), JSON.stringify(r2))
  assert('3.3 跳号事件的 usage 被计入（不丢数据）', fold.agg.totals.requests === 1 && fold.agg.totals.inputTokens === 999, JSON.stringify(fold.agg.totals))
  assert('3.4 水位推进到最新 seq', fold.agg.lastSeq === 10, `lastSeq=${fold.agg.lastSeq}`)
  assert('3.5 重读同一批（含跳号）仍全部 duplicate（幂等）', (() => {
    const before2 = stable(fold.agg)
    const r3 = foldEvents(fold, holed)
    return r3.duplicate === 2 && stable(fold.agg) === before2
  })())
  assert('3.6 跳号后接续正常（后续事件只要 seq 更大就应用）', (() => {
    const r4 = foldEvents(fold, [{ seq: 11, time: 1791000502000, type: 'assistant/message', data: { usage: { inputTokens: 1 } } }])
    return r4.applied === 1 && fold.agg.totals.requests === 2
  })())
  assert('3.7 带 seq0/time0 的流式分片不污染水位与时间', (() => {
    const f = createFoldState('chunks')
    foldEvents(f, [headerEvent, { type: 'tool-call-chunks', seq0: 53, time0: 1791000000000, data: { turn: 1, step: 3 } }])
    return f.agg.lastSeq === -1 && f.agg.lastTs === null
  })(), 'streaming chunks leaked into watermark/lastTs')
  assert('3.8 含跳号的事件流：分两次折叠与一次全量折叠结果一致', (() => {
    const prefix = fullStream.slice(0, 3)
    const inc = createFoldState('x')
    foldEvents(inc, prefix)
    foldEvents(inc, holed)
    const fresh = createFoldState('x')
    foldEvents(fresh, [...prefix, ...holed])
    return stable(inc.agg) === stable(fresh.agg)
  })())
  void before
}

/* ------------------------------------------------------------------ *
 * 4) 脏事件：不得污染任何桶，也不得推进水位之外的语义
 * ------------------------------------------------------------------ */
{
  const fold = createFoldState('sess-dirty')
  foldEvents(fold, [headerEvent])
  const dirty = [
    null,
    42,
    'text',
    [1, 2],
    { type: 'assistant/message', seq: 0, time: NaN, data: { usage: { inputTokens: 1e9 } } },
    { type: 'assistant/message', seq: 1, time: Infinity, data: { usage: { inputTokens: 1e9 } } },
    { type: 'assistant/message', seq: 2, data: { usage: { inputTokens: 1e9 } } },
  ]
  const r = foldEvents(fold, dirty)
  assert('4.1 脏事件被计入 skipped（不抛异常）', r.skipped === 4, `skipped=${r.skipped}`)
  assert('4.2 NaN/Infinity/缺 time 的 usage 不写入任何桶', fold.agg.totals.requests === 0 && fold.agg.totals.inputTokens === 0, `requests=${fold.agg.totals.requests}, input=${fold.agg.totals.inputTokens}`)
  assert('4.3 未污染按日/小时/分钟表（无 "Invalid Date" 键）', Object.keys(fold.agg.days).length === 0 && Object.keys(fold.agg.hours).length === 0 && Object.keys(fold.agg.minutes).length === 0, `days=${stable(Object.keys(fold.agg.days))}`)
  assert('4.4 脏 usage 字段（字符串/Infinity）经 toFiniteNumber 收敛为 0', (() => {
    const f2 = createFoldState('x')
    foldEvents(f2, [{ seq: 0, time: 1791000000000, type: 'assistant/message', data: { usage: { inputTokens: '5', outputTokens: Infinity, cacheReadTokens: NaN, cacheWriteTokens: 3 } } }])
    return f2.agg.totals.inputTokens === 0 && f2.agg.totals.outputTokens === 0 && f2.agg.totals.cacheReadTokens === 0 && f2.agg.totals.cacheWriteTokens === 3
  })())
  assert('4.5 toFiniteNumber 边界', toFiniteNumber(0) === 0 && toFiniteNumber(-5) === -5 && toFiniteNumber(NaN) === 0 && toFiniteNumber(Infinity) === 0 && toFiniteNumber('7') === 0 && toFiniteNumber(null) === 0, 'toFiniteNumber mismatch')
}

/* ------------------------------------------------------------------ *
 * 5) 保留量裁剪：分钟 48h / 小时 15d / 日永久
 * ------------------------------------------------------------------ */
{
  const now = 1791000000000
  const key = (ms, gran) => {
    const dt = new Date(ms + BEIJING_OFFSET_MS)
    const day = beijingDayKey(ms)
    const hour = `${day}T${String(dt.getUTCHours()).padStart(2, '0')}`
    return gran === 'minute' ? `${hour}:${String(dt.getUTCMinutes()).padStart(2, '0')}` : hour
  }
  const agg = {
    minutes: { fresh: 1, near: 1, old: 1 },
    modelMinutes: { 'm|fresh': 1, 'm|old': 1 },
    hours: { fresh: 1, old: 1 },
    modelHours: { 'm|fresh': 1, 'm|old': 1 },
    days: { '2020-01-01': 1 },
    modelDays: { 'm|2020-01-01': 1 },
    tools: { bash: 1 },
  }
  agg.minutes = { [key(now, 'minute')]: 1, [key(now - MINUTE_KEEP_MS + 60000, 'minute')]: 1, [key(now - MINUTE_KEEP_MS - 60000, 'minute')]: 1 }
  agg.modelMinutes = { [`m|${key(now - MINUTE_KEEP_MS - 60000, 'minute')}`]: 1, [`m|${key(now, 'minute')}`]: 1 }
  agg.hours = { [key(now, 'hour')]: 1, [key(now - HOUR_KEEP_MS + 3600000, 'hour')]: 1, [key(now - HOUR_KEEP_MS - 3600000, 'hour')]: 1 }
  agg.modelHours = { [`m|${key(now - HOUR_KEEP_MS - 3600000, 'hour')}`]: 1, [`m|${key(now, 'hour')}`]: 1 }

  const stats = pruneBuckets(agg, now)
  assert('5.1 分钟桶删 1 条（窗口外），窗口内与边界保留', Object.keys(agg.minutes).length === 2 && stats.minutes === 1, `left=${Object.keys(agg.minutes).length}, removed=${stats.minutes}`)
  assert('5.2 模型×分钟桶按 | 后缀比较后删 1 条', Object.keys(agg.modelMinutes).length === 1 && stats.modelMinutes === 1, `left=${Object.keys(agg.modelMinutes).length}`)
  assert('5.3 小时桶删 1 条（15d 窗口）', Object.keys(agg.hours).length === 2 && stats.hours === 1, `left=${Object.keys(agg.hours).length}`)
  assert('5.4 模型×小时桶删 1 条', Object.keys(agg.modelHours).length === 1 && stats.modelHours === 1, `left=${Object.keys(agg.modelHours).length}`)
  assert('5.5 日/模型×日/工具永久保留（不受裁剪影响）', Object.keys(agg.days).length === 1 && Object.keys(agg.modelDays).length === 1 && Object.keys(agg.tools).length === 1, 'coarse buckets were pruned')
  assert('5.6 空/脏输入不抛', (() => { const s0 = pruneBuckets(null, now); const s1 = pruneBuckets({ minutes: null, hours: undefined }, now); return s0.minutes === 0 && s1.hours === 0 })())

  const pruned = pruneBuckets(aggregateSession(fullStream, 'x'), now)
  assert('5.7 真实折叠产物裁剪后总量不变（只删细粒度桶）', (() => {
    const agg2 = aggregateSession(fullStream, 'x')
    const before = stable(agg2.totals)
    pruneBuckets(agg2, now)
    return stable(agg2.totals) === before && pruned.minutes >= 0
  })())
}

/* ------------------------------------------------------------------ *
 * 6) header 补偿与兼容包装
 * ------------------------------------------------------------------ */
{
  const eventsNoHeader = buildStream()
  const merged = withSessionHeaderEvent(eventsNoHeader, headerEvent)
  const agg = aggregateSession(merged, 'fallback')
  assert('6.1 无 header 事件时补齐 → id/parentSession/delegationDepth 就位', agg.id === 'sess-inc' && agg.cwd === '/tmp/proj' && agg.delegationDepth === 0, `id=${agg.id}, depth=${agg.delegationDepth}`)
  assert('6.2 补齐后的折叠结果与带 header 的一致', stable(agg) === stable(aggregateSession(fullStream, 'sess-inc')), 'header compensation changed the fold')
  assert('6.3 已有 session 事件 → 原样返回同一引用', withSessionHeaderEvent(fullStream, headerEvent) === fullStream, 'not same reference')
  assert('6.4 aggregateSession 兼容签名（events, id）仍生效', aggregateSession(eventsNoHeader, 'only-id').id === 'only-id', 'id fallback broken')

  const fold = createFoldState(null)
  foldEvents(fold, [{ type: 'session', id: 'from-header', createdAt: 1, delegationDepth: 0 }])
  assert('6.5 无 seq 的 header 事件在水位推进后仍可应用（幂等元数据）', fold.agg.id === 'from-header' && fold.agg.lastSeq === -1, `id=${fold.agg.id}, lastSeq=${fold.agg.lastSeq}`)

  const sub = aggregateSession(withSessionHeaderEvent([], { id: 'sub-1', parentSession: 'main-1', isSeeded: false }), null)
  assert('6.6 有 parentSession 缺 delegationDepth → 推断为 1（顶层判定不被误伤）', sub.delegationDepth === 1, `depth=${sub.delegationDepth}`)
}

/* ------------------------------------------------------------------ *
 * 7) 跨实现等价：新 fold.aggregateSession ≡ 旧 lib/index.js aggregateSession
 *    （唯一允许的差异是新增的 lastSeq 水位字段）
 * ------------------------------------------------------------------ */
{
  const { aggregateSession: legacyAggregate } = await import('../lib/index.js')
  const comparable = (agg) => {
    const out = {}
    for (const k of Object.keys(agg)) if (k !== 'lastSeq') out[k] = agg[k]
    return out
  }
  const fixtures = [
    ['带 seq 的完整流', fullStream, 'sess-inc'],
    ['不带 seq 的老 fixture（测试里最常见的形态）', buildStream().map(({ seq, ...rest }) => rest), 'legacy'],
    ['无 header 事件', buildStream(), 'no-header'],
    ['v3 header 缺 delegationDepth + 有 parentSession', withSessionHeaderEvent(buildStream(), { type: 'session', version: 3, id: 'sub', parentSession: 'main', isSeeded: false }), null],
    ['脏事件混合', [headerEvent, null, 7, 'x', [1], { type: 'assistant/message', data: { usage: { inputTokens: 5 } }, time: 1791000000000 }], 'dirty'],
    ['缺 callId 的工具调用', [{ type: 'session', id: 't', createdAt: 1 }, { type: 'tool/call', data: { name: 'bash', turn: 1, step: 1 } }, { type: 'tool/result', data: { message: { source: {} } }, time: 1791000000000 }], 't'],
    ['空事件数组', [], 'empty'],
  ]
  let diff = 0
  for (const [label, events, id] of fixtures) {
    const a = stable(comparable(legacyAggregate(events, id)))
    const b = stable(comparable(aggregateSession(events, id)))
    if (a !== b) {
      diff += 1
      console.error(`    不等价 fixture: ${label}`)
      console.error('      legacy:', a.slice(0, 300))
      console.error('      v050  :', b.slice(0, 300))
    }
  }
  assert('7.1 7 组 fixture 上新旧 aggregateSession 逐字段等价（忽略 lastSeq）', diff === 0, `diff=${diff}`)
}

const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok).length
console.log(`[v050-fold-incremental] ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('FAILED cases:')
  for (const r of results.filter((x) => !x.ok)) console.error('  ' + r.label + (r.detail ? ' — ' + r.detail : ''))
  process.exit(1)
}
