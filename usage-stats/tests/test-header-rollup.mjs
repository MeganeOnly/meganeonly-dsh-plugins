// tests/test-header-rollup.mjs
// session header 补偿 + 子代理归并（rollup）测试。
//
// 1-2 为纯单元（aggregateSession / withSessionHeaderEvent，不依赖文件系统）；
// 3-6 为端到端：v0.5.0 起 host 半段自己走文件系统发现 + 帧级续读，
// 因此这里把 fixture 记录写成**真实的多帧 zstd 日志**（tests/helpers/session-tree.mjs），
// 再通过 /api/usage-stats/summary 驱动并断言，不再 mock sessionQuery。
//
// 用法：node tests/test-header-rollup.mjs
// 期望：PASS 所有条目；任一 FAIL 立即 process.exit(1)。

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { aggregateSession, withSessionHeaderEvent } from '../lib/index.js'
import {
  buildLog,
  cleanup as cleanupTmp,
  loadHost,
  makeTmpDsh,
  scanAndSettle,
  useDshHome,
} from './helpers/session-tree.mjs'

const results = []
function assert(label, cond, detail) {
  results.push({ label, ok: !!cond, detail })
  if (!cond) console.error(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`)
}

/** 一条 assistant/message 事件（模型侧精确 usage 的唯一来源）。 */
function usageEvent(time, usage) {
  return { type: 'assistant/message', data: { usage, turn: 0, step: 0 }, time }
}

/** session.v4 header（DSH 0.2.0-rc.2 实测字段集）。 */
function v4Header(id, extra = {}) {
  return { type: 'session', version: 4, id, createdAt: 1700000000000, cwd: '/tmp/projA', isSeeded: false, delegationDepth: 0, agentPreset: 'standard', ...extra }
}

/* ------------------------------------------------------------------ *
 * 端到端脚手架：把 fixture 记录materialize 成真实会话树
 * ------------------------------------------------------------------ */
function setupFixture(label) {
  const fx = makeTmpDsh(label)
  fx.restore = useDshHome(fx.home)
  return fx
}

/** records: [{ header, events }] → 写成真实日志（文件名按 header.version 选世代）。 */
function materialize(fx, records) {
  for (const record of records) {
    const version = Number.isFinite(record.header.version) ? record.header.version : 0
    const fileName = version >= 1 ? `session.v${version}.jsonl.zstd` : 'session.jsonl.zstd'
    const dir = join(fx.sessions, '--projA--', record.header.id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, fileName), buildLog(record.header.id, record.events, { perFrame: 2, headerExtra: headerExtraOf(record.header) }))
  }
}

/** 只把 header 里非默认字段透传进日志首行（保持与 fixture 语义一致）。 */
function headerExtraOf(header) {
  const extra = {}
  for (const key of ['parentSession', 'delegationDepth', 'origin', 'isSeeded', 'agentPreset', 'cwd', 'createdAt']) {
    if (header[key] !== undefined) extra[key] = header[key]
  }
  return extra
}

async function setupApply(fx, records) {
  materialize(fx, records)
  const { handler } = await loadHost({ profileRoot: fx.profile })
  return { handler }
}

function cleanup(fx) {
  fx.restore()
  cleanupTmp(fx.root)
}

/* ------------------------------------------------------------------ *
 * 1) withSessionHeaderEvent 单元：events 无 header 事件 → 补一条在最前
 * ------------------------------------------------------------------ */
{
  const events = [usageEvent(1700000001000, { inputTokens: 10, outputTokens: 5 })]
  const merged = withSessionHeaderEvent(events, v4Header('sess-a', { parentSession: 'sess-root', delegationDepth: 1, origin: 'subagent' }))
  assert('1.1 无 session 事件 → 补一条（长度 +1）', merged.length === events.length + 1, `len=${merged.length}`)
  assert('1.2 补进去的事件 type === "session"', merged[0] && merged[0].type === 'session', `type=${merged[0] && merged[0].type}`)
  assert('1.3 补进去的 parentSession 透传', merged[0].parentSession === 'sess-root', `parentSession=${merged[0].parentSession}`)
  assert('1.4 补进去的 delegationDepth 透传', merged[0].delegationDepth === 1, `delegationDepth=${merged[0].delegationDepth}`)
  assert('1.5 补进去的 origin 透传', merged[0].origin === 'subagent', `origin=${merged[0].origin}`)
  assert('1.6 补进去的事件不带 time（不污染 lastTs）', merged[0].time === undefined, `time=${merged[0].time}`)
  assert('1.7 原 events 元素顺序不变（下标 +1）', merged[1] === events[0], 'merged[1] !== events[0]')
  assert('1.8 广播前不修改入参 events', events.length === 1, `events.length=${events.length}`)

  const legacy = [{ type: 'session', id: 'x' }, usageEvent(1700000001000, { inputTokens: 1, outputTokens: 1 })]
  assert('1.9 events 已有 session 事件 → 原样返回（同一引用，不重复补）', withSessionHeaderEvent(legacy, v4Header('x')) === legacy, 'not same reference')
  assert('1.10 events 非数组 → 返回空数组（不抛）', Array.isArray(withSessionHeaderEvent(null, v4Header('x'))) && withSessionHeaderEvent(null, v4Header('x')).length === 0, 'not empty array')
}

/* ------------------------------------------------------------------ *
 * 2) sessionHeaderEvent 字段守卫（header 脏数据不写入脏值）
 * ------------------------------------------------------------------ */
{
  const aggMissingDepth = aggregateSession(
    withSessionHeaderEvent([usageEvent(1700000001000, { inputTokens: 3, outputTokens: 1 })], { type: 'session', version: 4, id: 's', parentSession: 'p', isSeeded: false }),
    'fallback-id'
  )
  assert('2.1 header 有 parentSession 但缺 delegationDepth → 推断为 1', aggMissingDepth.delegationDepth === 1, `delegationDepth=${aggMissingDepth.delegationDepth}`)
  assert('2.2 header 有 parentSession → agg.parentSession = "p"', aggMissingDepth.parentSession === 'p', `parentSession=${aggMissingDepth.parentSession}`)

  const aggDirty = aggregateSession(
    withSessionHeaderEvent([usageEvent(1700000001000, { inputTokens: 3, outputTokens: 1 })], { id: 7, cwd: null, createdAt: NaN, agentPreset: 9, parentSession: 42, delegationDepth: NaN, origin: {} }),
    null
  )
  assert('2.3 header 全脏 → 不抛异常', aggDirty != null, 'threw')
  assert('2.4 header 全脏 → parentSession 保持 null（不写 42）', aggDirty.parentSession === null, `parentSession=${aggDirty.parentSession}`)
  assert('2.5 header 全脏 → delegationDepth 0（不写 NaN）', aggDirty.delegationDepth === 0, `delegationDepth=${aggDirty.delegationDepth}`)
  assert('2.6 header 全脏 → origin 保持 null（不写 {}）', aggDirty.origin === null, `origin=${aggDirty.origin}`)
  assert('2.7 header 全脏 → createdAt 保持 null（不写 NaN）', aggDirty.createdAt === null, `createdAt=${aggDirty.createdAt}`)
  assert('2.8 header 缺失 → agg.id 落到形参兜底', aggDirty.id === null, `id=${aggDirty.id}`)

  const plain = aggregateSession([usageEvent(1700000001000, { inputTokens: 1, outputTokens: 1 })], 'only-id')
  assert('2.9 老调用签名 aggregateSession(events, id) 不变 → id 兜底生效', plain.id === 'only-id', `id=${plain.id}`)
  assert('2.10 老调用签名 → parentSession 仍为 null（不凭空造）', plain.parentSession === null, `parentSession=${plain.parentSession}`)
}

/* ------------------------------------------------------------------ *
 * 3) 端到端：v4 header + 1 main + 1 subagent
 *    → subagent token 归 owner，sessionCount = 1 root
 * ------------------------------------------------------------------ */
{
  const fx = setupFixture('hdr-3')
  try {
    const records = [
      {
        header: v4Header('session-main', {}),
        events: [
          { type: 'request/header', data: { header: { config: { provider: 'deepseek', model: 'v4-flash' } } } },
          usageEvent(1700000001000, { inputTokens: 10, outputTokens: 5, cacheReadTokens: 100, cacheWriteTokens: 2, reasoningTokens: 1 }),
        ],
      },
      {
        header: v4Header('309e2653-9566-476f-b656-7abda14d0363', { parentSession: 'session-main', delegationDepth: 1, origin: 'subagent' }),
        events: [
          { type: 'request/header', data: { header: { config: { provider: 'deepseek', model: 'v4-flash' } } } },
          usageEvent(1700000003000, { inputTokens: 3, outputTokens: 1, cacheReadTokens: 30, cacheWriteTokens: 0, reasoningTokens: 0 }),
        ],
      },
    ]
    const { handler } = await setupApply(fx, records)
    const p = await scanAndSettle(handler)

    assert('3.1 ok=true 且 errors 为空', p.ok === true && p.errors.length === 0, `ok=${p.ok}, errors=${JSON.stringify(p.errors)}`)
    assert('3.2 rawSessionCount = 2（main + subagent）', p.rawSessionCount === 2, `rawSessionCount=${p.rawSessionCount}`)
    assert('3.3 sessionCount = 1 root（subagent 已 rollup，不再虚高）', p.sessionCount === 1, `sessionCount=${p.sessionCount}, rawSessionCount=${p.rawSessionCount}`)
    assert('3.4 sessionCount !== rawSessionCount（客户端"含 N 个 subagent"副标题的前提）', p.sessionCount !== p.rawSessionCount, `sessionCount=${p.sessionCount}, rawSessionCount=${p.rawSessionCount}`)
    assert('3.5 totals.inputTokens = 13（main 10 + subagent 3）', p.totals.inputTokens === 13, `inputTokens=${p.totals.inputTokens}`)
    assert('3.6 totals.outputTokens = 6', p.totals.outputTokens === 6, `outputTokens=${p.totals.outputTokens}`)
    assert('3.7 totals.cacheReadTokens = 130（main 100 + subagent 30）', p.totals.cacheReadTokens === 130, `cacheReadTokens=${p.totals.cacheReadTokens}`)
    assert('3.8 totals.requests = 2', p.totals.requests === 2, `requests=${p.totals.requests}`)
    assert('3.9 topSessions 只有 main 一个（subagent 不单独成 root）', p.topSessions.length === 1 && p.topSessions[0].id === 'session-main', `topSessions=${JSON.stringify(p.topSessions.map((s) => s.id))}`)
    // totalTokensOf = input + output + cacheRead + cacheWrite（不含 reasoning，reasoning ⊂ output）
    assert('3.10 topSessions[0].tokens = 150（家口径 input+output+cacheRead+cacheWrite）', p.topSessions[0].tokens === 10 + 5 + 100 + 2 + 3 + 1 + 30 + 0, `tokens=${p.topSessions[0].tokens}`)
    assert('3.11 byModel 只有一个模型行（p/m 口径）', p.byModel.length === 1 && p.byModel[0].model === 'deepseek/v4-flash', `byModel=${JSON.stringify(p.byModel.map((m) => m.model))}`)
    assert('3.12 byModel[0].sessions = 1（root 数，不是 raw session 数）', p.byModel[0].sessions === 1, `sessions=${p.byModel[0].sessions}`)
    assert('3.13 byDayAll 含当天 bucket 且 inputTokens = 13', (() => {
      const d = new Date(1700000001000 + 8 * 3600 * 1000).toISOString().slice(0, 10)
      const row = p.byDayAll.find((x) => x.day === d)
      return row != null && row.inputTokens === 13
    })(), `byDayAll=${JSON.stringify(p.byDayAll)}`)
  } finally {
    cleanup(fx)
  }
}

/* ------------------------------------------------------------------ *
 * 4) 端到端：三层 parentSession 链（main ← sub1 ← sub2）全部归并到 main
 * ------------------------------------------------------------------ */
{
  const fx = setupFixture('hdr-4')
  try {
    const records = [
      { header: v4Header('session-root', {}), events: [usageEvent(1700000001000, { inputTokens: 1, outputTokens: 1 })] },
      { header: v4Header('sub-1', { parentSession: 'session-root', delegationDepth: 1, origin: 'subagent' }), events: [usageEvent(1700000002000, { inputTokens: 2, outputTokens: 2 })] },
      { header: v4Header('sub-2', { parentSession: 'sub-1', delegationDepth: 2, origin: 'subagent' }), events: [usageEvent(1700000003000, { inputTokens: 4, outputTokens: 4 })] },
    ]
    const { handler } = await setupApply(fx, records)
    const p = await scanAndSettle(handler)

    assert('4.1 rawSessionCount = 3', p.rawSessionCount === 3, `rawSessionCount=${p.rawSessionCount}`)
    assert('4.2 sessionCount = 1（三层链折叠到 root）', p.sessionCount === 1, `sessionCount=${p.sessionCount}`)
    assert('4.3 totals.inputTokens = 7（1 + 2 + 4）', p.totals.inputTokens === 7, `inputTokens=${p.totals.inputTokens}`)
    assert('4.4 topSessions = [session-root]，tokens = 14', p.topSessions.length === 1 && p.topSessions[0].id === 'session-root' && p.topSessions[0].tokens === 14, `topSessions=${JSON.stringify(p.topSessions)}`)
    assert('4.5 childCount 反映链上后代数', p.topSessions[0].childCount === 2, `childCount=${p.topSessions[0].childCount}`)
  } finally {
    cleanup(fx)
  }
}

/* ------------------------------------------------------------------ *
 * 5) 端到端：orphan subagent（父不在记录集）仍走自身 identity，token 只算一次
 * ------------------------------------------------------------------ */
{
  const fx = setupFixture('hdr-5')
  try {
    const records = [
      { header: v4Header('session-ok', {}), events: [usageEvent(1700000001000, { inputTokens: 1, outputTokens: 1 })] },
      { header: v4Header('sub-orphan', { parentSession: 'session-gone', delegationDepth: 1, origin: 'subagent' }), events: [usageEvent(1700000002000, { inputTokens: 5, outputTokens: 5 })] },
    ]
    const { handler } = await setupApply(fx, records)
    const p = await scanAndSettle(handler)

    assert('5.1 sessionCount = 2（orphan 自成 root，不回退到假父）', p.sessionCount === 2, `sessionCount=${p.sessionCount}`)
    assert('5.2 totals.inputTokens = 6（orphan 的 5 只算一次）', p.totals.inputTokens === 6, `inputTokens=${p.totals.inputTokens}`)
    assert('5.3 topSessions 含 session-ok 与 sub-orphan', p.topSessions.length === 2, `topSessions=${JSON.stringify(p.topSessions.map((s) => s.id))}`)
  } finally {
    cleanup(fx)
  }
}

/* ------------------------------------------------------------------ *
 * 6) 端到端：v3 形状（version 3 header）与老式"events 里带 session 事件"的
 *    fixture 都必须给出同一个结果——修复对两者都成立，且不重复计数
 * ------------------------------------------------------------------ */
{
  const fx = setupFixture('hdr-6')
  try {
    const headerEvent = { type: 'session', id: 'legacy-sub', parentSession: 'legacy-main', delegationDepth: 1, origin: 'subagent', cwd: '/tmp/projA', createdAt: 1700000002000, agentPreset: 'p' }
    const records = [
      {
        header: { type: 'session', version: 3, id: 'legacy-main', createdAt: 1700000000000, cwd: '/tmp/projA', isSeeded: false, delegationDepth: 0, agentPreset: 'p' },
        events: [
          { type: 'session', id: 'legacy-main', cwd: '/tmp/projA', createdAt: 1700000000000, agentPreset: 'p' },
          usageEvent(1700000001000, { inputTokens: 1, outputTokens: 1 }),
        ],
      },
      {
        header: { type: 'session', version: 3, id: 'legacy-sub', createdAt: 1700000002000, cwd: '/tmp/projA', isSeeded: false, parentSession: 'legacy-main', delegationDepth: 1, origin: 'subagent', agentPreset: 'p' },
        events: [headerEvent, usageEvent(1700000003000, { inputTokens: 9, outputTokens: 9 })],
      },
    ]
    const { handler } = await setupApply(fx, records)
    const p = await scanAndSettle(handler)

    assert('6.1 老 fixture（events 自带 session 事件）sessionCount = 1', p.sessionCount === 1, `sessionCount=${p.sessionCount}`)
    assert('6.2 老 fixture totals.inputTokens = 10（9 未被重复计数）', p.totals.inputTokens === 10, `inputTokens=${p.totals.inputTokens}`)
    assert('6.3 老 fixture rawSessionCount = 2', p.rawSessionCount === 2, `rawSessionCount=${p.rawSessionCount}`)
    assert('6.4 v3 世代文件名被正确识别（discovery 选最高世代）', p.rawSessionCount === 2 && p.scanProgress != null, JSON.stringify(p.scanProgress))
  } finally {
    cleanup(fx)
  }
}

/* ------------------------------------------------------------------ *
 * 汇总
 * ------------------------------------------------------------------ */
const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok).length
console.log(`[header-rollup] ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('FAILED cases:')
  for (const r of results.filter((x) => !x.ok)) console.error('  ' + r.label + (r.detail ? ' — ' + r.detail : ''))
  process.exit(1)
}
