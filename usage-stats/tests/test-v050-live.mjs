// tests/test-v050-live.mjs
// v0.5.0 步骤 7：实时会话折叠（lib/live.js + 入口订阅）测试。
//
// 目标：不依赖磁盘 flush，当前会话的用量在 payload 里即可见；且**绝不反向少报**
// （未播种 / 落后于磁盘的实时条目不参与统计）。
//
// 覆盖：事件流折叠等于磁盘折叠 / 未播种时不采用 / 播种后采用 / 磁盘反超时让位 /
//       duplicate 不重复计 / LRU 上限 / payload.live 字段与客户端轮询条件。
//
// 用法：node tests/test-v050-live.mjs
// 期望：PASS 所有条目；任一 FAIL 立即 process.exit(1)。

import { join } from 'node:path'

import { createLiveFolder } from '../lib/live.js'
import { createStore, makeRecord } from '../lib/store.js'
import { createPayloadBuilder } from '../lib/payload.js'
import { aggregateSession, emptyBucket, withSessionHeaderEvent } from '../lib/fold.js'
import {
  appendEvents,
  callHandler,
  cleanup,
  loadHost,
  makeTmpDsh,
  modelEvent,
  scanAndSettle,
  usageEvent,
  useDshHome,
  writeSessionLog,
} from './helpers/session-tree.mjs'

const results = []
function assert(label, cond, detail) {
  results.push({ label, ok: !!cond, detail })
  if (!cond) console.error(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`)
}

const BASE = 1791000000000

/* ------------------------------------------------------------------ *
 * 1) 纯单元：事件流折叠、播种语义、LRU
 * ------------------------------------------------------------------ */
{
  const live = createLiveFolder({ maxEntries: 3 })
  const session = { id: 'live-1', header: { type: 'session', version: 4, id: 'live-1', createdAt: BASE, cwd: '/tmp/live', delegationDepth: 0, agentPreset: 'p' } }

  assert('1.1 未知会话的首个事件建立条目（未播种 → 不改变可用统计）', live.handleEvent(session, usageEvent(0, BASE + 1000, { inputTokens: 1, outputTokens: 1 })) === false && live.size() === 1, `size=${live.size()}`)
  assert('1.2 未播种条目不被认为是"领先"（不得用于统计）', live.isAheadOf('live-1', -1) === false, `seeded=${live.get('live-1').seeded}`)
  assert('1.3 未播种期间**只缓存事件不折叠**（agg 缺前半段，折叠出来没有意义）', live.get('live-1').agg.totals.requests === 0 && live.get('live-1').buffered === 1, JSON.stringify(live.get('live-1')))

  // 播种：磁盘已折到 seq 0
  live.seedFrom(makeRecord({
    key: 'live-1',
    cursor: { bytes: 100, frames: 2, lastSeq: 0 },
    agg: { ...aggregateSession([usageEvent(0, BASE + 1000, { inputTokens: 1, outputTokens: 1 })], 'live-1') },
  }))
  const seeded = live.get('live-1')
  assert('1.4 播种后标记 seeded、以磁盘为基并回放缓存事件（此处 seq 0 与磁盘重叠）', seeded.seeded === true && seeded.agg.lastSeq === 0 && seeded.buffered === 0 && seeded.agg.totals.inputTokens === 1, JSON.stringify({ seeded: seeded.seeded, lastSeq: seeded.agg.lastSeq, buffered: seeded.buffered, input: seeded.agg.totals.inputTokens }))
  assert('1.5 播种后"未领先"（水位相同）', live.isAheadOf('live-1', 0) === false)

  assert('1.6 新的实时事件让条目领先于磁盘', live.handleEvent(session, usageEvent(1, BASE + 2000, { inputTokens: 5, outputTokens: 2 })) === true)
  assert('1.7 领先判定成立且数值正确', live.isAheadOf('live-1', 0) === true && live.get('live-1').agg.totals.inputTokens === 6, JSON.stringify(live.get('live-1').agg.totals))

  const before = JSON.stringify(live.get('live-1').agg)
  assert('1.8 重复事件（seq ≤ 水位）不改变状态', live.handleEvent(session, usageEvent(1, BASE + 2000, { inputTokens: 5, outputTokens: 2 })) === false && JSON.stringify(live.get('live-1').agg) === before)
  assert('1.9 非法事件（null / 非对象）不抛', live.handleEvent(session, null) === false && live.handleEvent(session, 42) === false)
  assert('1.10 取不到会话 id 时静默忽略', live.handleEvent({}, usageEvent(2, BASE + 3000, { inputTokens: 9 })) === false)

  // 磁盘反超：diskSeq 更高时不重播（否则会把未 flush 的实时事件丢掉）
  const beforeRebase = JSON.stringify(live.get('live-1').agg)
  live.seedFrom(makeRecord({ key: 'live-1', cursor: { bytes: 200, frames: 3, lastSeq: 1 }, agg: { ...aggregateSession([usageEvent(1, BASE + 2000, { inputTokens: 5 })], 'live-1') } }))
  assert('1.11 磁盘水位等于实时水位 → 允许重播（以磁盘为准）', live.get('live-1').seeded === true)
  live.handleEvent(session, usageEvent(2, BASE + 4000, { inputTokens: 3 }))
  const liveSeq = live.get('live-1').agg.lastSeq
  live.seedFrom(makeRecord({ key: 'live-1', cursor: { bytes: 300, frames: 4, lastSeq: liveSeq - 1 }, agg: { ...aggregateSession([usageEvent(0, BASE, { inputTokens: 100 })], 'live-1') } }))
  assert('1.12 磁盘落后于实时 → 不重播（保留未 flush 的实时增量）', live.get('live-1').agg.totals.inputTokens >= 3 && JSON.stringify(live.get('live-1').agg) !== beforeRebase)

  // LRU 上限
  for (let i = 0; i < 10; i += 1) {
    live.handleEvent({ id: `bulk-${i}`, header: { id: `bulk-${i}` } }, usageEvent(0, BASE + i, { inputTokens: 1 }))
  }
  assert('1.13 条目数受 maxEntries 约束（LRU 淘汰）', live.size() <= 3, `size=${live.size()}`)
  assert('1.14 activeCount 统计最近活跃条目', live.activeCount() >= 1, `active=${live.activeCount()}`)
}

/* ------------------------------------------------------------------ *
 * 2) payload 集成（单元）：只在实时更全时采用
 * ------------------------------------------------------------------ */
{
  const dir = makeTmpDsh('live-payload')
  try {
    const store = createStore(dir.profile, { debounceMs: 1, onWarn: () => {} })
    await store.load()
    const diskAgg = { ...emptyBucket(), inputTokens: 10, requests: 1 }
    const record = makeRecord({
      key: 'sess-live',
      path: '/x/session.jsonl.zstd',
      rev: 'r1',
      cursor: { bytes: 10, frames: 1, lastSeq: 0 },
      meta: { id: 'sess-live', parentSession: null, createdAt: BASE },
      agg: { id: 'sess-live', totals: diskAgg, models: {}, days: {}, modelDays: {}, hours: {}, modelHours: {}, minutes: {}, modelMinutes: {}, tools: {}, steps: 0, turns: 0, llmMs: 0, toolMs: 0, lastTs: null, lastSeq: 0 },
    })
    store.seed(record)
    const live = createLiveFolder({})
    const builder = createPayloadBuilder({ store, getScanner: () => null, getLive: () => live })

    assert('2.1 无实时条目时用磁盘值', builder.build().totals.inputTokens === 10)
    assert('2.2 payload.live 字段存在且 ahead=0', builder.build().live != null && builder.build().live.ahead === 0, JSON.stringify(builder.build().live))

    // 未播种的实时条目：事件只被缓存，不得参与统计（否则少报）
    live.handleEvent({ id: 'sess-live', header: { id: 'sess-live' } }, usageEvent(1, BASE + 1000, { inputTokens: 3 }))
    builder.invalidate()
    assert('2.3 未播种的实时条目不参与统计', builder.build().totals.inputTokens === 10 && builder.build().live.ahead === 0, JSON.stringify(builder.build().totals))

    // 播种 → 回放缓存事件 → 领先
    live.seedFrom(record)
    builder.invalidate()
    const payload = builder.build()
    assert('2.4 播种并回放缓存事件后采用实时值（10 + 3）', payload.totals.inputTokens === 13 && payload.totals.requests === 2, JSON.stringify(payload.totals))
    assert('2.5 payload.live.ahead 报告领先会话数（客户端据此继续轮询）', payload.live.ahead === 1, JSON.stringify(payload.live))

    // 继续来事件 → 实时值持续增长
    live.handleEvent({ id: 'sess-live', header: { id: 'sess-live' } }, usageEvent(2, BASE + 2000, { inputTokens: 7 }))
    builder.invalidate()
    assert('2.6 后续实时事件继续叠加', builder.build().totals.inputTokens === 20, JSON.stringify(builder.build().totals))
    store.close()
  } finally {
    cleanup(dir.root)
  }
}

/* ------------------------------------------------------------------ *
 * 3) 端到端：真实事件订阅 → payload 立即反映（不等磁盘）
 * ------------------------------------------------------------------ */
{
  const fx = makeTmpDsh('live-e2e')
  const restore = useDshHome(fx.home)
  try {
    const logPath = writeSessionLog(fx.sessions, {
      id: 'session-live',
      events: [modelEvent(0, BASE + 1000, 'deepseek', 'v4-flash'), usageEvent(1, BASE + 2000, { inputTokens: 100, outputTokens: 20 })],
    })
    const listeners = []
    const { handler } = await loadHost({ profileRoot: fx.profile, onEvent: (name, fn) => listeners.push({ name, fn }) })
    assert('3.1 入口订阅了 session/event', listeners.length === 1 && listeners[0].name === 'session/event', JSON.stringify(listeners.map((l) => l.name)))

    const p1 = await scanAndSettle(handler)
    assert('3.2 首轮扫描把磁盘内容计入', p1.totals.inputTokens === 100 && p1.totals.requests === 1, JSON.stringify(p1.totals))

    // 会话继续工作：事件先走实时支路（磁盘还没写这一帧）
    const session = { id: 'session-live', header: { type: 'session', version: 4, id: 'session-live', createdAt: BASE, cwd: '/tmp', delegationDepth: 0, agentPreset: 'p' } }
    listeners[0].fn(session, modelEvent(2, BASE + 3000, 'deepseek', 'v4-flash'))
    listeners[0].fn(session, usageEvent(3, BASE + 4000, { inputTokens: 50, outputTokens: 10, cacheReadTokens: 500 }))

    const p2 = await callHandler(handler, '/api/usage-stats/summary')
    assert('3.3 实时事件立即进入 payload（无需等 flush / 下一次扫描）', p2.totals.inputTokens === 150 && p2.totals.requests === 2 && p2.totals.cacheReadTokens === 500, JSON.stringify(p2.totals))
    assert('3.4 payload.live 报告正在跟踪的会话', p2.live != null && p2.live.tracked >= 1 && p2.live.ahead === 1, JSON.stringify(p2.live))

    // 把同样的事件落盘 → 磁盘追上后实时条目让位（数值不变，不重复计）
    appendEvents(logPath, [modelEvent(2, BASE + 3000, 'deepseek', 'v4-flash'), usageEvent(3, BASE + 4000, { inputTokens: 50, outputTokens: 10, cacheReadTokens: 500 })])
    const p3 = await scanAndSettle(handler)
    assert('3.5 磁盘追上后数值一致（实时与磁盘不重复计）', p3.totals.inputTokens === 150 && p3.totals.requests === 2, JSON.stringify(p3.totals))
    assert('3.6 让位后不再有领先会话', p3.live.ahead === 0, JSON.stringify(p3.live))

    // 再追加一条实时事件 → 重新领先
    listeners[0].fn(session, usageEvent(4, BASE + 5000, { inputTokens: 1 }))
    const p4 = await callHandler(handler, '/api/usage-stats/summary')
    assert('3.7 新一轮实时事件再次领先并计入', p4.totals.inputTokens === 151 && p4.live.ahead === 1, `${JSON.stringify(p4.totals)} live=${JSON.stringify(p4.live)}`)
  } finally {
    restore()
    cleanup(fx.root)
  }
}

const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok).length
console.log(`[v050-live] ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('FAILED cases:')
  for (const r of results.filter((x) => !x.ok)) console.error('  ' + r.label + (r.detail ? ' — ' + r.detail : ''))
  process.exit(1)
}
