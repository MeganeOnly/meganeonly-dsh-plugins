// tests/test-v050-summary.mjs
// v0.5.0 步骤 6：payload 装配 / 快照 memo / 根归并 / 保留量 / 诊断 的端到端测试。
//
// 覆盖：v0.4.x payload 字段完整性（老客户端不受影响）/ subagent 归并到 root /
//       快照 memo（未 invalidate 时不重算）/ ?force 与 ?rebuild 语义差异 /
//       ?diag 诊断块 / 保留量在真实折叠中生效 / 删除会话后总量下降 / 错误隔离。
//
// 用法：node tests/test-v050-summary.mjs
// 期望：PASS 所有条目；任一 FAIL 立即 process.exit(1)。

import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { createPayloadBuilder } from '../lib/payload.js'
import { createStore, makeRecord } from '../lib/store.js'
import { beijingDayKey, emptyBucket } from '../lib/fold.js'
import { MINUTE_KEEP_MS } from '../lib/constants.js'
import {
  appendEvents,
  callHandler,
  cleanup,
  loadHost,
  makeTmpDsh,
  modelEvent,
  readRecordFile,
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

const DAY = 86400000
const now = Date.now()
/** 主/子两个会话的 usage 时间（用于按北京时间键回查派生视图）。 */
const mainEventTime = now - 3500000

/* ------------------------------------------------------------------ *
 * 1) 快照 memo（单元）：未 invalidate 时重部分不重算
 * ------------------------------------------------------------------ */
{
  const dir = makeTmpDsh('memo')
  try {
    const store = createStore(dir.profile, { debounceMs: 1, onWarn: () => {} })
    await store.load()
    const builder = createPayloadBuilder({ store, getScanner: () => null })
    const agg = { id: 's1', totals: { ...emptyBucket(), inputTokens: 10, requests: 1 }, models: {}, days: {}, modelDays: {}, hours: {}, modelHours: {}, minutes: {}, modelMinutes: {}, tools: {}, steps: 0, turns: 0, llmMs: 0, toolMs: 0, lastTs: null, lastSeq: 0 }
    store.seed(makeRecord({ key: 's1', agg, meta: { id: 's1', parentSession: null } }))

    const first = builder.build()
    assert('1.1 首次装配反映记录内容', first.totals.inputTokens === 10 && first.sessionCount === 1, JSON.stringify(first.totals))

    // 直接改记录但**不** invalidate：memo 命中 → 仍是旧值（证明没有每次请求重算）
    agg.totals.inputTokens = 999
    const second = builder.build()
    assert('1.2 未 invalidate 时命中快照（重部分不重算）', second.totals.inputTokens === 10, `input=${second.totals.inputTokens}`)
    assert('1.3 代次未变', builder.currentGeneration() === 0, `gen=${builder.currentGeneration()}`)

    builder.invalidate()
    const third = builder.build()
    assert('1.4 invalidate 后重建并反映新值', third.totals.inputTokens === 999 && builder.currentGeneration() === 1, `input=${third.totals.inputTokens}, gen=${builder.currentGeneration()}`)

    // 轻部分每次请求都重算（进度/时钟），重部分复用
    const fourth = builder.build()
    assert('1.5 同一代次多次 build 的重部分深比较一致', JSON.stringify(fourth.byDay) === JSON.stringify(third.byDay) && fourth.sessionCount === third.sessionCount, 'heavy part drifted')
    store.close()
  } finally {
    cleanup(dir.root)
  }
}

/* ------------------------------------------------------------------ *
 * 2) 端到端：主会话 + subagent 归并 + payload 字段完整性
 * ------------------------------------------------------------------ */
const fx = makeTmpDsh('summary')
const restoreHome = useDshHome(fx.home)
{
  writeSessionLog(fx.sessions, {
    id: 'session-main',
    events: [
      modelEvent(0, now - 3600000, 'deepseek', 'v4-flash'),
      usageEvent(1, mainEventTime, { inputTokens: 100, outputTokens: 20, cacheReadTokens: 1000, cacheWriteTokens: 5, reasoningTokens: 7 }),
    ],
  })
  writeSessionLog(fx.sessions, {
    id: 'sub-1',
    headerExtra: { parentSession: 'session-main', delegationDepth: 1, origin: 'subagent' },
    events: [
      modelEvent(0, now - 3000000, 'deepseek', 'v4-pro'),
      usageEvent(1, now - 2900000, { inputTokens: 10, outputTokens: 2, cacheReadTokens: 100, cacheWriteTokens: 0 }),
    ],
  })
  // 一条非常老的会话：用于验证保留量裁剪（分钟/小时桶被裁掉、日桶保留）
  writeSessionLog(fx.sessions, {
    id: 'session-ancient',
    events: [
      modelEvent(0, now - 60 * DAY, 'deepseek', 'v4-flash'),
      usageEvent(1, now - 60 * DAY + 1000, { inputTokens: 7, outputTokens: 3 }),
    ],
  })

  const { handler } = await loadHost({ profileRoot: fx.profile })
  const p = await scanAndSettle(handler)

  assert('2.1 首轮折叠 3 个会话、无错误', p.decoded === 3 && p.errorCount === 0, `decoded=${p.decoded}, errors=${p.errorCount}`)
  assert('2.2 sessionCount = root 数（subagent 归并到 owner）', p.sessionCount === 2 && p.rawSessionCount === 3, `sessionCount=${p.sessionCount}, raw=${p.rawSessionCount}`)
  assert('2.3 总量 = 三者之和（subagent token 归属 owner）', p.totals.inputTokens === 117 && p.totals.outputTokens === 25 && p.totals.cacheReadTokens === 1100 && p.totals.requests === 3, JSON.stringify(p.totals))
  assert('2.4 会话榜只有 root，且 owner 行含 subagent token', p.topSessions.length === 2 && (() => { const main = p.topSessions.find((s) => s.id === 'session-main'); return main != null && main.tokens === 1237 && main.childCount === 1 })(), JSON.stringify(p.topSessions.map((s) => [s.id, s.tokens, s.childCount])))
  assert('2.5 按模型表含两个模型且各自表内会话数正确', p.byModel.length === 2 && p.byModel.every((m) => m.sessions >= 1), JSON.stringify(p.byModel.map((m) => [m.model, m.sessions])))
  assert('2.5b byDay 命中"最近活动日"的桶含真实用量（派生视图不是全零）', (() => {
    // 不假设"今天"：用北京时间键回查，避免测试跨北京午夜时窗口与数据错位
    const dayKey = beijingDayKey(mainEventTime)
    const bucket = p.byDay.find((b) => b.day === dayKey)
    return bucket != null && bucket.inputTokens === 110 && bucket.requests === 2
  })(), JSON.stringify(p.byDay.filter((b) => b.inputTokens > 0)))
  assert('2.5c byTrend.day / byDayAll 与 byDay 同日均值一致', (() => {
    const dayKey = beijingDayKey(mainEventTime)
    const trendBucket = p.byTrend.day.find((b) => b.bucket === dayKey)
    const allBucket = p.byDayAll.find((b) => b.day === dayKey)
    return trendBucket != null && trendBucket.inputTokens === 110 && allBucket != null && allBucket.inputTokens === 110
  })(), JSON.stringify([p.byTrend.day.filter((b) => b.inputTokens > 0), p.byDayAll]))

  // v0.4.x 字段完整性（老客户端零改动可用）
  const legacyFields = ['ok', 'generatedAt', 'sessionCount', 'rawSessionCount', 'decoded', 'reused', 'durationMs', 'errors', 'totals', 'steps', 'turns', 'llmMs', 'toolMs', 'byDay', 'byDayAll', 'byTrend', 'byModel', 'topSessions', 'tools']
  const missing = legacyFields.filter((f) => p[f] === undefined)
  assert('2.6 v0.4.x payload 字段全部保留', missing.length === 0, `missing=${missing.join(',')}`)
  assert('2.7 byTrend 四个粒度齐全且日序列 = 30 天零填充', ['minute', 'hour', 'day', 'week'].every((g) => Array.isArray(p.byTrend[g])) && p.byTrend.day.length === 30, Object.keys(p.byTrend).map((k) => k + ':' + p.byTrend[k].length).join(' '))
  assert('2.8 新增扫描/新鲜度字段齐备', ['scanning', 'scanProgress', 'legacy', 'dataAsOf', 'stale', 'discovery', 'storeVersion', 'retention'].every((f) => p[f] !== undefined), 'missing new fields')
  assert('2.9 discovery 标注为自走查（测试环境无 sessionPersistence）', p.discovery === 'walk', p.discovery)

  /* ---------------------------------------------------------------- *
   * 3) 保留量：60 天前的会话只留日桶，分钟/小时桶被裁掉
   * ---------------------------------------------------------------- */
  const ancient = readRecordFile(fx.profile, 'session-ancient')
  assert('3.1 分钟桶按 48h 裁剪（60 天前的桶被删）', Object.keys(ancient.agg.minutes).length === 0 && Object.keys(ancient.agg.modelMinutes).length === 0, JSON.stringify(Object.keys(ancient.agg.minutes)))
  assert('3.2 小时桶按 15d 裁剪', Object.keys(ancient.agg.hours).length === 0, JSON.stringify(Object.keys(ancient.agg.hours)))
  assert('3.3 日桶永久保留（历史不丢）', Object.keys(ancient.agg.days).length === 1 && Object.keys(ancient.agg.modelDays).length === 1, JSON.stringify(Object.keys(ancient.agg.days)))
  assert('3.4 payload.retention 如实上报窗口', p.retention.minuteHours === MINUTE_KEEP_MS / 3600000 && p.retention.hourDays === 15, JSON.stringify(p.retention))

  /* ---------------------------------------------------------------- *
   * 4) force 语义：只绕过节流、不做全量重建
   * ---------------------------------------------------------------- */
  const pForce = await callHandler(handler, '/api/usage-stats/summary?force=1')
  await new Promise((r) => setTimeout(r, 30))
  const pForceSettled = await callHandler(handler, '/api/usage-stats/summary')
  assert('4.1 无变更时 force 不重折任何会话（decoded=0，全部按修订复用）', pForceSettled.decoded === 0 && pForceSettled.reused === 3, `decoded=${pForceSettled.decoded}, reused=${pForceSettled.reused}`)

  /* ---------------------------------------------------------------- *
   * 5) 追加后 force 立即看到新值（不点"全量重算"也能更新）
   * ---------------------------------------------------------------- */
  appendEvents(join(fx.sessions, '--proj--', 'session-main', 'session.jsonl.zstd'), [
    usageEvent(2, now - 1800000, { inputTokens: 1000, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 }),
  ])
  const pAppend = await scanAndSettle(handler)
  assert('5.1 追加的 usage 进入 payload（且只重折该会话）', pAppend.totals.inputTokens === 1117 && pAppend.totals.requests === 4, JSON.stringify(pAppend.totals))
  assert('5.2 未变更会话仍复用（decoded=1）', pAppend.decoded === 1, `decoded=${pAppend.decoded}`)

  /* ---------------------------------------------------------------- *
   * 6) ?diag=1 诊断块
   * ---------------------------------------------------------------- */
  const pDiag = await callHandler(handler, '/api/usage-stats/summary?diag=1')
  assert('6.1 diag 块含 store / scanner / 能力探测字段', pDiag.diag != null && pDiag.diag.store != null && pDiag.diag.scanner != null && typeof pDiag.diag.zstd === 'boolean', JSON.stringify(Object.keys(pDiag.diag || {})))
  assert('6.2 diag 展示存储目录与记录数', pDiag.diag.store.records === 3 && String(pDiag.diag.store.dir).includes('.usage-stats'), JSON.stringify(pDiag.diag.store))

  /* ---------------------------------------------------------------- *
   * 7) 删除会话 → 总量下降（记录随日志消失而清理）
   * ---------------------------------------------------------------- */
  rmSync(join(fx.sessions, '--proj--', 'sub-1'), { recursive: true, force: true })
  const pDeleted = await scanAndSettle(handler)
  assert('7.1 会话删除后记录数与总量同步下降（root 数不变：subagent 本就不计入 root）', pDeleted.sessionCount === 2 && pDeleted.rawSessionCount === 2 && pDeleted.totals.inputTokens === 1107 && pDeleted.totals.requests === 3, `sessionCount=${pDeleted.sessionCount}, raw=${pDeleted.rawSessionCount}, ${JSON.stringify(pDeleted.totals)}`)
  assert('7.2 删除计数上报', pDeleted.scanProgress.removed === 1, JSON.stringify(pDeleted.scanProgress))

  /* ---------------------------------------------------------------- *
   * 8) 错误隔离：坏日志不影响其它会话
   * ---------------------------------------------------------------- */
  writeSessionLog(fx.sessions, { id: 'session-broken', buffer: Buffer.from('not zstd at all') })
  const pErr = await scanAndSettle(handler)
  assert('8.1 坏日志记为错误但不影响其它会话', pErr.errorCount === 1 && pErr.totals.inputTokens === 1107, `errorCount=${pErr.errorCount}, ${JSON.stringify(pErr.totals)}`)
  assert('8.2 errors 数组带可定位信息', Array.isArray(pErr.errors) && pErr.errors.length >= 1 && String(pErr.errors[0]).includes('session-broken'), JSON.stringify(pErr.errors))

  /* ---------------------------------------------------------------- *
   * 9) ?rebuild=1：整库改名重建
   * ---------------------------------------------------------------- */
  const sessionsDir = join(fx.profile, '.usage-stats', 'sessions')
  assert('9.1 重建前已有记录文件', readdirSync(sessionsDir).length >= 2, JSON.stringify(readdirSync(sessionsDir)))
  const pRebuild = await scanAndSettle(handler, { rebuild: true })
  const bakDirs = readdirSync(fx.profile).filter((n) => n.startsWith('.usage-stats.bak-'))
  assert('9.2 rebuild 后旧存储改名为 .bak-<ts>', bakDirs.length === 1, JSON.stringify(readdirSync(fx.profile)))
  assert('9.3 rebuild 后重新折叠出正确总量', pRebuild.totals.inputTokens === 1107 && pRebuild.sessionCount === 2 && pRebuild.rawSessionCount === 2, `${JSON.stringify(pRebuild.totals)} sessionCount=${pRebuild.sessionCount}`)
  assert('9.4 rebuild 重建的是"当前存在的会话"（坏日志仍记错误）', pRebuild.errorCount === 1, `errorCount=${pRebuild.errorCount}`)
}

restoreHome()
cleanup(fx.root)

/* ------------------------------------------------------------------ *
 * 10) legacy 首屏：旧缓存先显示，重算完成后覆盖
 * ------------------------------------------------------------------ */
{
  const dir = makeTmpDsh('legacy-summary')
  const restore = useDshHome(dir.home)
  try {
    writeSessionLog(dir.sessions, {
      id: 'session-old',
      events: [modelEvent(0, now - 60000, 'deepseek', 'v4-flash'), usageEvent(1, now - 59000, { inputTokens: 42, outputTokens: 8 })],
    })
    mkdirSync(dir.profile, { recursive: true })
    const legacyAgg = { id: 'session-old', createdAt: 1700000000000, cwd: '/tmp/old', parentSession: null, delegationDepth: 0, title: '旧标题', models: {}, days: {}, modelDays: {}, hours: {}, modelHours: {}, minutes: {}, modelMinutes: {}, tools: {}, totals: { ...emptyBucket(), inputTokens: 999, requests: 9 }, steps: 9, turns: 9, llmMs: 0, toolMs: 0, lastTs: null }
    const { writeFileSync } = await import('node:fs')
    writeFileSync(join(dir.profile, '.usage-stats-cache.json'), JSON.stringify({ version: 8, sessions: { 'session-old': { createdAt: 1700000000000, agg: legacyAgg } } }), 'utf8')

    const { handler } = await loadHost({ profileRoot: dir.profile })
    // 第一个响应：旧缓存占位 + scanning（不阻塞在重算上）
    const first = await callHandler(handler, '/api/usage-stats/summary')
    assert('10.1 首屏立即返回（旧缓存占位，legacy=true）', first.legacy === true && first.totals.inputTokens === 999, `legacy=${first.legacy}, input=${first.totals.inputTokens}`)
    assert('10.2 首屏同时表示"正在扫描"（不阻塞等重算）', first.scanning === true, `scanning=${first.scanning}`)

    const settled = await scanAndSettle(handler)
    assert('10.3 重算完成后换成真实值（旧数字被覆盖，不是叠加）', settled.totals.inputTokens === 42 && settled.totals.requests === 1 && settled.legacy === false, `${JSON.stringify(settled.totals)} legacy=${settled.legacy}`)
    const legacyFiles = readdirSync(dir.profile).filter((n) => n.includes('.legacy-'))
    assert('10.4 旧单体缓存退役改名（原件保留可回滚）', legacyFiles.length === 1, JSON.stringify(readdirSync(dir.profile)))
  } finally {
    restore()
    cleanup(dir.root)
  }
}

const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok).length
console.log(`[v050-summary] ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('FAILED cases:')
  for (const r of results.filter((x) => !x.ok)) console.error('  ' + r.label + (r.detail ? ' — ' + r.detail : ''))
  process.exit(1)
}
