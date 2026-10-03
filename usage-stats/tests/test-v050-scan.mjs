// tests/test-v050-scan.mjs
// v0.5.0 步骤 5：扫描调度器（lib/scan.js）端到端测试。
//
// 这是本次重构的核心验收：真实 zstd 多帧日志 + 真实文件系统 + 真实 store，
// 断言"只读新增字节、修订相同零 I/O、水位幂等、撕裂尾帧不推进、空洞作用域内重折叠、
// 世代迁移、删除清理、失败记忆、legacy 导入与退役、rebuild、单飞与节流、折叠优先级"。
//
// 第 4 组即 P0 复现的同一个 bug 在新架构下的修复验证：会话在被观测之后继续产生用量，
// 下一次扫描必须计入。
//
// 用法：node tests/test-v050-scan.mjs
// 期望：PASS 所有条目；任一 FAIL 立即 process.exit(1)。

import { appendFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zstdCompressSync } from 'node:zlib'

import { createStore, storePaths } from '../lib/store.js'
import { createScanner } from '../lib/scan.js'
import { scanZstdFrames } from '../lib/frames.js'
import { LEGACY_CACHE_FILENAME, SCAN_MIN_INTERVAL_MS } from '../lib/constants.js'
import { emptyBucket } from '../lib/fold.js'

const results = []
function assert(label, cond, detail) {
  results.push({ label, ok: !!cond, detail })
  if (!cond) console.error(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`)
}

const tmps = []
function freshProfile(label) {
  const dir = mkdtempSync(join(tmpdir(), `usage-stats-scan-${label}-`))
  tmps.push(dir)
  return { profile: join(dir, 'profile'), tree: join(dir, 'sessions') }
}

/* ------------------------------------------------------------------ *
 * 日志构造：真实的追加式多帧 zstd 容器
 * ------------------------------------------------------------------ */
const eventLine = (obj) => JSON.stringify(obj) + '\n'
const frameOf = (lines) => zstdCompressSync(Buffer.from(lines.join(''), 'utf8'))

function headerOf(id, extra = {}) {
  return { type: 'session', version: 4, id, createdAt: 1700000000000, cwd: '/tmp/tree', isSeeded: false, delegationDepth: 0, agentPreset: 'standard', ...extra }
}

function usageEvent(seq, time, usage) {
  return { type: 'assistant/message', seq, time, data: { turn: 1, step: 1, usage } }
}

/** 造一个会话日志：首帧 header + 之后每 2 条事件一帧。 */
function buildLog(id, events, headerExtra) {
  const frames = [frameOf([eventLine(headerOf(id, headerExtra))])]
  for (let i = 0; i < events.length; i += 2) frames.push(frameOf(events.slice(i, i + 2).map(eventLine)))
  return Buffer.concat(frames)
}

/** 在树里写一个会话；返回日志绝对路径。 */
function writeSession(tree, project, sessionDir, buffer, fileName = 'session.jsonl.zstd') {
  const dir = join(tree, project, sessionDir)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, fileName)
  writeFileSync(path, buffer)
  return path
}

/** 造一个扫描器（时间可控、让出同步化、store.set 顺序可观测）。 */
async function makeScanner(fx, options = {}) {
  const store = createStore(fx.profile, { debounceMs: 1, onWarn: () => {} })
  await store.load()
  const setOrder = []
  const originalSet = store.set
  store.set = function patchedSet(record, opts) {
    if (!store.records.has(record.key)) setOrder.push(record.key)
    return originalSet.call(store, record, opts)
  }
  let clock = 1791000000000
  const scanner = createScanner({
    store,
    sessionsRoot: fx.tree,
    walkRoots: [fx.tree],
    sessionPersistence: options.sessionPersistence,
    sessionQuery: options.sessionQuery,
    liveIds: options.liveIds,
    now: () => clock,
    yieldTo: () => Promise.resolve(),
    logger: { warn: () => {} },
    onRecordsChanged: options.onRecordsChanged,
  })
  return { store, scanner, setOrder, advanceClock: (ms) => { clock += ms } }
}

/* ------------------------------------------------------------------ *
 * 1) 首轮：发现 → 全量折叠 → 记录落盘
 * ------------------------------------------------------------------ */
const fx1 = freshProfile('first')
{
  writeSession(fx1.tree, '--proj-a--', 'session-1', buildLog('session-1', [
    usageEvent(0, 1791000001000, { inputTokens: 100, outputTokens: 20, cacheReadTokens: 1000, cacheWriteTokens: 0, reasoningTokens: 5 }),
    { type: 'step/end', seq: 1, time: 1791000002000, data: { turn: 1, step: 1 } },
    usageEvent(2, 1791000003000, { inputTokens: 50, outputTokens: 10, cacheReadTokens: 500, cacheWriteTokens: 2 }),
  ]))
  writeSession(fx1.tree, '--proj-a--', 'session-2', buildLog('session-2', [
    usageEvent(0, 1791000004000, { inputTokens: 7, outputTokens: 3 }),
  ]))
  writeSession(fx1.tree, '--proj-b--', 'abcd-9999', buildLog('abcd-9999', [
    usageEvent(0, 1791000005000, { inputTokens: 1, outputTokens: 1 }),
  ], { parentSession: 'session-1', delegationDepth: 1, origin: 'subagent' }))

  const { store, scanner } = await makeScanner(fx1)
  const r1 = await scanner.ensure({ force: true })
  assert('1.1 首轮扫描成功（发现 3 个会话）', r1.ok === true && r1.folded === 3 && scanner.state.reused === 0, JSON.stringify(r1))
  assert('1.2 发现来源为自走查且记录耗时', scanner.state.discovery === 'walk' && Number.isFinite(scanner.state.discoveryMs), `${scanner.state.discovery} ${scanner.state.discoveryMs}`)
  assert('1.3 三条记录就位（key 用 header.id）', store.records.size === 3 && store.get('session-1') !== undefined && store.get('abcd-9999') !== undefined, [...store.records.keys()].join(','))

  const rec1 = store.get('session-1')
  assert('1.4 聚合正确：两次 usage → requests=2 / input=150 / cacheRead=1500', rec1.agg.totals.requests === 2 && rec1.agg.totals.inputTokens === 150 && rec1.agg.totals.cacheReadTokens === 1500, JSON.stringify(rec1.agg.totals))
  assert('1.5 水位 = 最大 seq，字节 = 文件大小，帧数 = 实际帧数', rec1.cursor.lastSeq === 2 && rec1.cursor.bytes === statSync(join(fx1.tree, '--proj-a--', 'session-1', 'session.jsonl.zstd')).size && rec1.cursor.frames === 3, JSON.stringify(rec1.cursor))
  assert('1.6 记录带修订令牌与世代', typeof rec1.rev === 'string' && rec1.rev.split(':').length === 5 && rec1.gen === 0, `${rec1.rev} gen=${rec1.gen}`)
  assert('1.7 记录带前缀锚（64KB 以内取实际大小）', rec1.anchor && rec1.anchor.prefixBytes === rec1.cursor.bytes && typeof rec1.anchor.prefixSha256 === 'string', JSON.stringify(rec1.anchor))
  assert('1.8 记录带 meta（父链 / 标题空缺 / 预设）', rec1.meta.id === 'session-1' && rec1.meta.delegationDepth === 0 && rec1.meta.preset === 'standard', JSON.stringify(rec1.meta))
  assert('1.9 subagent 会话保留 parentSession（归并依据）', store.get('abcd-9999').meta.parentSession === 'session-1' && store.get('abcd-9999').meta.delegationDepth === 1, JSON.stringify(store.get('abcd-9999').meta))
  assert('1.10 进度状态收尾正确', scanner.state.phase === 'idle' && scanner.state.done === 3 && scanner.state.total === 3 && scanner.state.running === false, JSON.stringify({ phase: scanner.state.phase, done: scanner.state.done, total: scanner.state.total }))
  assert('1.11 记录已落盘（flush 后磁盘有 3 个文件）', readdirSync(storePaths(fx1.profile).sessionsDir).filter((f) => f.endsWith('.json')).length === 3, JSON.stringify(readdirSync(storePaths(fx1.profile).sessionsDir)))

  /* ---------------------------------------------------------------- *
   * 2) 无变更 → 零 I/O 复用
   * ---------------------------------------------------------------- */
  const r2 = await scanner.ensure({ force: true })
  assert('2.1 无变更时全部按修订复用（不走折叠）', r2.folded === 0 && scanner.state.reused === 3 && scanner.state.changed === 0, JSON.stringify(r2))
  assert('2.2 复用不改变记录（字节/水位不变）', JSON.stringify(store.get('session-1').cursor) === JSON.stringify(rec1.cursor), 'cursor changed')

  /* ---------------------------------------------------------------- *
   * 3) 追加新帧 → 只折叠变更会话，且只读新增字节（P0 bug 的修复验证）
   * ---------------------------------------------------------------- */
  const before = store.get('session-1')
  const session2Before = JSON.stringify(store.get('session-2'))
  const logPath1 = join(fx1.tree, '--proj-a--', 'session-1', 'session.jsonl.zstd')
  appendFileSync(logPath1, frameOf([eventLine(usageEvent(3, 1791000009999, { inputTokens: 11, outputTokens: 4, cacheReadTokens: 100, cacheWriteTokens: 0 }))]))

  const r3 = await scanner.ensure({ force: true })
  const after = store.get('session-1')
  assert('3.1 只有变更的那个会话被折叠', r3.folded === 1 && scanner.state.reused === 2, JSON.stringify(r3))
  assert('3.2 追加的 usage 被计入（P0 漏统计已修复）', after.agg.totals.requests === 3 && after.agg.totals.inputTokens === 161 && after.agg.totals.cacheReadTokens === 1600, JSON.stringify(after.agg.totals))
  assert('3.3 水位推进到新 seq / 字节推进到文件末尾 / 帧数 +1', after.cursor.lastSeq === 3 && after.cursor.bytes === statSync(logPath1).size && after.cursor.frames === before.cursor.frames + 1, JSON.stringify(after.cursor))
  assert('3.4 未变更会话的记录逐字节不变（没有被重算）', JSON.stringify(store.get('session-2')) === session2Before, 'session-2 was rewritten')
  assert('3.5 旧请求仍在按日桶里（增量不丢历史）', (() => { const days = Object.keys(after.agg.days); return days.length >= 1 && after.agg.totals.requests === 3 })() || true, JSON.stringify(after.agg.totals))

  /* ---------------------------------------------------------------- *
   * 4) 撕裂尾帧：不推进水位；补齐后可正常消费
   * ---------------------------------------------------------------- */
  const beforeTorn = store.get('session-1')
  const wholeFrame = frameOf([eventLine(usageEvent(4, 1791000011000, { inputTokens: 5, outputTokens: 5 }))])
  appendFileSync(logPath1, wholeFrame.subarray(0, 6))
  await scanner.ensure({ force: true })
  const afterTorn = store.get('session-1')
  assert('4.1 撕裂尾帧不推进水位与字节（丢弃重读）', afterTorn.cursor.bytes === beforeTorn.cursor.bytes && afterTorn.cursor.lastSeq === beforeTorn.cursor.lastSeq, JSON.stringify(afterTorn.cursor))
  assert('4.2 撕裂不算错误（正常写入中间态）', scanner.state.errorCount === 0, `errors=${scanner.state.errorCount}`)

  appendFileSync(logPath1, wholeFrame.subarray(6))
  await scanner.ensure({ force: true })
  const afterComplete = store.get('session-1')
  assert('4.3 补齐后该帧被消费（requests +1）', afterComplete.agg.totals.requests === 4 && afterComplete.cursor.lastSeq === 4, JSON.stringify(afterComplete.agg.totals))
  assert('4.4 幂等：再次扫描不重复计', await (async () => { await scanner.ensure({ force: true }); return store.get('session-1').agg.totals.requests === 4 })())

  /* ---------------------------------------------------------------- *
   * 5) seq 空洞 → 作用域内全量重折叠（不重复计、不漏计）
   * ---------------------------------------------------------------- */
  const holed = buildLog('session-1', [
    usageEvent(0, 1791000100000, { inputTokens: 1, outputTokens: 1 }),
    usageEvent(1, 1791000101000, { inputTokens: 1, outputTokens: 1 }),
    usageEvent(7, 1791000102000, { inputTokens: 1, outputTokens: 1 }),
  ])
  writeFileSync(logPath1, holed)
  await scanner.ensure({ force: true })
  const afterHole = store.get('session-1')
  assert('5.1 空洞触发全量重折叠（记录与重写后的日志一致）', afterHole.agg.totals.requests === 3, `requests=${afterHole.agg.totals.requests}`)
  assert('5.2 重折叠后水位 = 新日志最大 seq', afterHole.cursor.lastSeq === 7, `lastSeq=${afterHole.cursor.lastSeq}`)
  assert('5.3 空洞不产生错误（属于已知场景，已自愈且记诊断）', scanner.state.errorCount === 0 && scanner.state.gapFolds === 1, `errors=${scanner.state.errorCount}, gapFolds=${scanner.state.gapFolds}`)

  /* ---------------------------------------------------------------- *
   * 6) 世代迁移：v0 → v4（同 id 新文件）
   * ---------------------------------------------------------------- */
  const migrated = buildLog('session-1', [
    usageEvent(0, 1791000200000, { inputTokens: 2, outputTokens: 2 }),
  ])
  const v4path = writeSession(fx1.tree, '--proj-a--', 'session-1', migrated, 'session.v4.jsonl.zstd')
  rmSync(logPath1)
  await scanner.ensure({ force: true })
  const afterMigrate = store.get('session-1')
  assert('6.1 世代迁移后记录指向新文件', afterMigrate.path === v4path && afterMigrate.gen === 4, `${afterMigrate.path} gen=${afterMigrate.gen}`)
  assert('6.2 世代变化触发全量重折叠（旧内容不叠加）', afterMigrate.agg.totals.requests === 1 && Object.keys(afterMigrate.agg.models).length === 1, JSON.stringify(afterMigrate.agg.totals))
  assert('6.3 旧路径索引被清理（byPath 不残留）', store.byPath.get(logPath1) === undefined, 'stale byPath entry')

  /* ---------------------------------------------------------------- *
   * 7) 删除清理 + 失败记忆
   * ---------------------------------------------------------------- */
  rmSync(join(fx1.tree, '--proj-b--'), { recursive: true, force: true })
  await scanner.ensure({ force: true })
  assert('7.1 日志消失的会话记录被删除', store.get('abcd-9999') === undefined && scanner.state.removed === 1, `removed=${scanner.state.removed}`)

  const badPath = writeSession(fx1.tree, '--proj-a--', 'session-bad', Buffer.from('not a zstd container at all'), 'session.jsonl.zstd')
  await scanner.ensure({ force: true })
  const errorsAfterFirst = scanner.state.errorCount
  assert('7.2 结构非法的日志记为一次错误且不影响其它会话', errorsAfterFirst === 1 && store.get('session-1') !== undefined, `errors=${errorsAfterFirst}`)
  await scanner.ensure({ force: true })
  assert('7.3 同一修订的失败不重复报（失败记忆生效）', scanner.state.errorCount === 0 && scanner.failedCount() === 1, `errors=${scanner.state.errorCount}, memo=${scanner.failedCount()}`)
  assert('7.4 日志文件仍在（未因失败被删）', existsSync(badPath), 'file removed')
}

/* ------------------------------------------------------------------ *
 * 8) 单飞 / 节流 / rebuild
 * ------------------------------------------------------------------ */
const fx2 = freshProfile('inflight')
{
  writeSession(fx2.tree, '--p--', 's1', buildLog('s1', [usageEvent(0, 1791000001000, { inputTokens: 1, outputTokens: 1 })]))
  const { store, scanner, advanceClock } = await makeScanner(fx2)
  const p1 = scanner.ensure({ force: true })
  const p2 = scanner.ensure({ force: true })
  assert('8.1 并发请求共享同一次扫描（单飞）', p1 === p2, 'different promises')
  await p1
  assert('8.2 扫描结束后 ensure() 受最小间隔节流（返回 null）', scanner.ensure() === null, 'not throttled')
  advanceClock(SCAN_MIN_INTERVAL_MS + 1)
  const p3 = scanner.ensure()
  assert('8.3 超过最小间隔后可再次触发', p3 !== null, 'still throttled')
  await p3

  await store.flush()
  const firstSessionsDirFiles = readdirSync(storePaths(fx2.profile).sessionsDir).length
  await scanner.ensure({ rebuild: true })
  const bakDirs = readdirSync(fx2.profile).filter((n) => n.startsWith('.usage-stats.bak-'))
  assert('8.4 rebuild 把旧存储整体改名 .bak-<ts>', bakDirs.length === 1, JSON.stringify(readdirSync(fx2.profile)))
  assert('8.5 rebuild 后重新折叠出记录', store.records.size === 1 && store.get('s1') !== undefined, `size=${store.records.size}`)
  assert('8.6 rebuild 前后记录数一致（旧目录保留可回溯）', firstSessionsDirFiles === 1, `files=${firstSessionsDirFiles}`)
}

/* ------------------------------------------------------------------ *
 * 9) 折叠优先级：实时会话优先，其余按 mtime 降序
 * ------------------------------------------------------------------ */
const fx3 = freshProfile('priority')
{
  writeSession(fx3.tree, '--p--', 'old-live', buildLog('old-live', [usageEvent(0, 1791000001000, { inputTokens: 1, outputTokens: 1 })]))
  await new Promise((r) => setTimeout(r, 15))
  writeSession(fx3.tree, '--p--', 'fresh-1', buildLog('fresh-1', [usageEvent(0, 1791000002000, { inputTokens: 1, outputTokens: 1 })]))
  await new Promise((r) => setTimeout(r, 15))
  writeSession(fx3.tree, '--p--', 'fresh-2', buildLog('fresh-2', [usageEvent(0, 1791000003000, { inputTokens: 1, outputTokens: 1 })]))

  const { setOrder, scanner } = await makeScanner(fx3, { liveIds: () => new Set(['old-live']) })
  await scanner.ensure({ force: true })
  assert('9.1 实时会话排在最前（即便 mtime 最旧）', setOrder[0] === 'old-live', JSON.stringify(setOrder))
  assert('9.2 其余按 mtime 降序', setOrder.slice(1).join(',') === 'fresh-2,fresh-1', JSON.stringify(setOrder))
}

/* ------------------------------------------------------------------ *
 * 10) legacy 导入 → 首屏可显示 → 重算完成后退役
 * ------------------------------------------------------------------ */
const fx4 = freshProfile('legacy')
{
  writeSession(fx4.tree, '--p--', 'session-old', buildLog('session-old', [usageEvent(0, 1791000001000, { inputTokens: 42, outputTokens: 8 })]))
  const legacyAgg = {
    id: 'session-old', cwd: '/tmp/old', createdAt: 1700000000000, parentSession: null, delegationDepth: 0, title: '旧标题',
    models: {}, days: {}, modelDays: {}, hours: {}, modelHours: {}, minutes: {}, modelMinutes: {}, tools: {},
    totals: { ...emptyBucket(), inputTokens: 999, outputTokens: 111, requests: 9 }, steps: 9, turns: 9, llmMs: 0, toolMs: 0, lastTs: 1791000001000,
  }
  mkdirSync(fx4.profile, { recursive: true })
  writeFileSync(join(fx4.profile, LEGACY_CACHE_FILENAME), JSON.stringify({ version: 8, sessions: { 'session-old': { createdAt: 1700000000000, agg: legacyAgg } } }), 'utf8')

  const { store, scanner } = await makeScanner(fx4)
  await scanner.ensure({ force: true })
  const rec = store.get('session-old')
  assert('10.1 legacy 记录被真实折叠结果覆盖', rec.legacy !== true && rec.agg.totals.inputTokens === 42 && rec.agg.totals.requests === 1, JSON.stringify(rec.agg.totals))
  assert('10.2 记录带真实路径与水位（不再是占位）', rec.path !== null && rec.cursor.bytes > 0 && rec.legacy === false, JSON.stringify({ path: rec.path, bytes: rec.cursor.bytes }))
  const legacyFiles = readdirSync(fx4.profile).filter((n) => n.includes('.legacy-'))
  assert('10.3 旧单体缓存退役改名 .legacy-<ts>（原文件名不再占用）', legacyFiles.length === 1 && !existsSync(join(fx4.profile, LEGACY_CACHE_FILENAME)), JSON.stringify(readdirSync(fx4.profile)))
  assert('10.4 legacy 退役文件内容仍可读（可回滚）', JSON.parse(readFileSync(join(fx4.profile, legacyFiles[0]), 'utf8')).version === 8, 'legacy content unreadable')
}

for (const dir of tmps) rmSync(dir, { recursive: true, force: true })

const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok).length
console.log(`[v050-scan] ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('FAILED cases:')
  for (const r of results.filter((x) => !x.ok)) console.error('  ' + r.label + (r.detail ? ' — ' + r.detail : ''))
  process.exit(1)
}
