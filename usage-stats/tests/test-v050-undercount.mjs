// tests/test-v050-undercount.mjs
// v0.5.0 步骤 0/6：活跃会话漏统计的回归测试（characterization → 目标断言）。
//
// 背景：v0.4.x 的 buildSummary 以 (SessionId, header.createdAt) 判定缓存命中，
// 而 createdAt 在会话创建后**永不变化** → 会话在被观测之后继续产生的 usage
// 永远进不了汇总。实测样例：某活跃会话 46 次请求 / 5,576,193 token，面板显示 0；
// 近 12 个活跃会话的缓存覆盖率仅 73.8%。
//
// 步骤 0 曾以 characterization 形式钉住该行为（TARGET_V050=false）。步骤 6 把
// host 半段切到"修订令牌 + 水位续读"后，同一断言翻转为目标断言并转绿 ——
// 这个翻转就是本次重构的用户可见验收点。
//
// 用法：node tests/test-v050-undercount.mjs
// 期望：PASS 所有条目；任一 FAIL 立即 process.exit(1)。

import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import {
  appendEvents,
  buildLog,
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

/** 目标断言开关：v0.5.0 起恒为 true（历史翻转见文件头注释）。 */
const TARGET_V050 = true

const fx = makeTmpDsh('undercount')
const restoreHome = useDshHome(fx.home)

try {
  const events = [
    modelEvent(0, 1791000001000, 'deepseek', 'v4-flash'),
  ]
  const logPath = writeSessionLog(fx.sessions, { id: 'session-live-0001', events })
  const { handler } = await loadHost({ profileRoot: fx.profile })

  /* ---------------------------------------------------------------- *
   * 1) 会话刚创建（日志里还没有 usage）→ 第一次扫描
   * ---------------------------------------------------------------- */
  const p1 = await scanAndSettle(handler)
  assert('1.1 首次扫描成功且无错误', p1.ok === true && p1.errorCount === 0, `ok=${p1.ok}, errorCount=${p1.errorCount}`)
  assert('1.2 扫描折叠了 1 个会话', p1.decoded === 1, `decoded=${p1.decoded}`)
  assert('1.3 还没有 usage → requests = 0', p1.totals.requests === 0, `requests=${p1.totals.requests}`)
  assert('1.4 首屏不再是"一次请求重算全部"，扫描状态可见', typeof p1.scanning === 'boolean' && p1.scanProgress != null, JSON.stringify(p1.scanProgress))

  /* ---------------------------------------------------------------- *
   * 2) 会话继续工作：日志追加一条带 usage 的帧
   *    （真实 DSH 场景：会话在被观测之后仍在持续产生用量）
   * ---------------------------------------------------------------- */
  appendEvents(logPath, [
    usageEvent(1, 1791000002000, { inputTokens: 5, outputTokens: 2, cacheReadTokens: 500, cacheWriteTokens: 0, reasoningTokens: 1 }),
  ])

  /* ---------------------------------------------------------------- *
   * 3) 再扫一次 —— 目标：追加的 usage 必须计入
   * ---------------------------------------------------------------- */
  const p2 = await scanAndSettle(handler)
  const servedTotal = p2.totals.inputTokens + p2.totals.outputTokens + p2.totals.cacheReadTokens + p2.totals.cacheWriteTokens

  if (TARGET_V050) {
    assert(
      'A.1 目标：追加 usage 后必须计入（1 请求 / 507 token）',
      p2.totals.requests === 1 && servedTotal === 507 && p2.totals.inputTokens === 5 && p2.totals.outputTokens === 2 && p2.totals.cacheReadTokens === 500,
      `requests=${p2.totals.requests}, total=${servedTotal}, ${JSON.stringify(p2.totals)}`
    )
    assert('A.2 只折叠变更的那个会话（未变更会话按修订复用）', p2.decoded === 1 && p2.reused >= 0, `decoded=${p2.decoded}, reused=${p2.reused}`)
  } else {
    assert('A.1 characterization：createdAt 命中 → 追加的 usage 不计入', p2.totals.requests === 0 && servedTotal === 0, `requests=${p2.totals.requests}, total=${servedTotal}`)
  }

  assert(
    'A.3 水位持久化：记录里的 cursor 指向文件末尾（可续读）',
    (() => {
      const record = readRecordFile(fx.profile, 'session-live-0001')
      return record.cursor.lastSeq === 1 && record.cursor.bytes > 0 && record.cursor.frames === 3 && record.rev !== null
    })(),
    JSON.stringify(readRecordFile(fx.profile, 'session-live-0001').cursor)
  )
  assert(
    'A.4 记录带前缀锚（下次续读前校验"只是被追加"）',
    (() => {
      const anchor = readRecordFile(fx.profile, 'session-live-0001').anchor
      return anchor != null && anchor.prefixBytes > 0 && typeof anchor.prefixSha256 === 'string'
    })(),
    JSON.stringify(readRecordFile(fx.profile, 'session-live-0001').anchor)
  )

  /* ---------------------------------------------------------------- *
   * 4) 无变更时不再重算（v0.4.x 每次请求都要归并全部聚合）
   * ---------------------------------------------------------------- */
  const p3 = await callHandler(handler, '/api/usage-stats/summary')
  assert('B.1 无变更请求直接命中快照（totals 与上一次一致）', p3.totals.requests === p2.totals.requests && p3.totals.cacheReadTokens === p2.totals.cacheReadTokens, JSON.stringify(p3.totals))
  assert('B.2 无变更请求不触发扫描（scanning=false）', p3.scanning === false, `scanning=${p3.scanning}`)

  /* ---------------------------------------------------------------- *
   * 5) 迁移源：旧单体缓存只在首屏临时显示，且不落新库
   * ---------------------------------------------------------------- */
  assert(
    'C.1 v0.4.x 单体缓存不再出现在 profile 根（新架构用 .usage-stats/ 目录）',
    !existsSync(join(fx.profile, '.usage-stats-cache.json')) && existsSync(join(fx.profile, '.usage-stats')),
    JSON.stringify(readdirSync(fx.profile))
  )
} finally {
  restoreHome()
  cleanup(fx.root)
}

const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok).length
console.log(`[v050-undercount] ${passed} passed, ${failed} failed${TARGET_V050 ? ' (TARGET_V050=true)' : ' (characterization: TARGET_V050=false)'}`)
if (failed > 0) {
  console.error('FAILED cases:')
  for (const r of results.filter((x) => !x.ok)) console.error('  ' + r.label + (r.detail ? ' — ' + r.detail : ''))
  process.exit(1)
}
