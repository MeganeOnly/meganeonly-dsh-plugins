// tests/test-v050-undercount.mjs
// v0.5.0 步骤 0：复现「活跃会话被永久冻结」的 characterization 测试。
//
// 现状（v0.4.x）：buildSummary 以 (SessionId, header.createdAt) 判定缓存命中，
// 而 createdAt 在会话创建后**永不变化** → 会话后续追加的 usage 永远进不了汇总。
// 实测样例（2026-10-03）：某活跃会话 46 次请求 / 5,576,193 token，面板显示 0；
// 近 12 个活跃会话的缓存覆盖率仅 73.8%。
//
// 本文件在 v0.5.0 落地前是**绿**的：它把当前（错误）行为钉住，避免"看起来修好了"
// 却只是换了 bug。步骤 5（scan.js 修订失效）落地时把下面的 TARGET_V050 置为 true，
// A 组断言随即翻转为「追加 usage 后必须计入」——翻转本身就是这次重构的验收点。
//
// 用法：node tests/test-v050-undercount.mjs
// 期望：PASS 所有条目；任一 FAIL 立即 process.exit(1)。

import { mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { aggregateSession, withSessionHeaderEvent } from '../lib/index.js'

/**
 * v0.5.0 步骤 5 落地后置 true：把 A 组从"钉住现状"翻转为"要求修复"。
 * 翻转时同时改 A.1 的期望值与标签。
 */
const TARGET_V050 = false

const results = []
function assert(label, cond, detail) {
  results.push({ label, ok: !!cond, detail })
  if (!cond) console.error(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`)
}

function callHandler(handler, url) {
  return new Promise((resolve) => {
    const res = {
      writeHead(s, h) { this.status = s; this.headers = h },
      end(body) { resolve(JSON.parse(body)) },
    }
    handler({ method: 'GET', url }, res)
  })
}

/** 一条 assistant/message 事件（模型侧精确 usage 的唯一来源）。 */
function usageEvent(seq, time, usage) {
  return { type: 'assistant/message', seq, data: { usage, turn: 1, step: 1 }, time }
}

/** session.v4 header（DSH 0.2.0-rc.2 实测字段集）。 */
function v4Header(id) {
  return { type: 'session', version: 4, id, createdAt: 1700000000000, cwd: '/tmp/usage-stats-fixture', isSeeded: false, delegationDepth: 0, agentPreset: 'standard' }
}

/**
 * mock ctx.sessionQuery：readSession 返回**可变** events 数组的当前内容，
 * 模拟"会话还活着、日志持续追加"。
 */
function makeGrowingSessionQuery(header, events) {
  return {
    async listSessions() {
      return [{ header: structuredClone(header), live: true, persisted: false }]
    },
    async readSession() {
      return { session: structuredClone(header), inheritedEventCount: 0, events: events.map((e) => structuredClone(e)) }
    },
  }
}

async function setupApply(profileRoot, sessionQuery) {
  const { apply } = await import('../lib/index.js')
  const registered = []
  const ctx = {
    baseUrl: pathToFileURL(profileRoot) + '/',
    webServer: { register(spec) { registered.push(spec) } },
    sessionQuery,
  }
  apply(ctx)
  await new Promise((r) => setTimeout(r, 10))
  return { handler: registered.find((r) => r.path === '/api/usage-stats/summary').handler }
}

const fx = mkdtempSync(join(tmpdir(), 'usage-stats-v050-p0-'))
const profileRoot = join(fx, 'profile')
mkdirSync(profileRoot, { recursive: true })

try {
  const header = v4Header('session-live-0001')
  const events = []
  const { handler } = await setupApply(profileRoot, makeGrowingSessionQuery(header, events))

  /* ---------------------------------------------------------------- *
   * 1) 会话刚创建（日志里还没有 usage）→ 第一次 summary
   * ---------------------------------------------------------------- */
  const p1 = await callHandler(handler, '/api/usage-stats/summary')
  assert('1.1 首次 summary 成功且无错误', p1.ok === true && p1.errors.length === 0, `ok=${p1.ok}, errors=${JSON.stringify(p1.errors)}`)
  assert('1.2 首次 summary 解码了 1 个会话', p1.decoded === 1, `decoded=${p1.decoded}`)
  assert('1.3 空日志 → requests = 0', p1.totals.requests === 0, `requests=${p1.totals.requests}`)

  /* ---------------------------------------------------------------- *
   * 2) 会话继续工作：日志追加 request/header + 一条带 usage 的 assistant/message
   *    （真实 DSH 场景：会话在被观测之后仍在持续产生用量）
   * ---------------------------------------------------------------- */
  events.push(
    { type: 'request/header', seq: 0, time: 1700000001000, data: { header: { config: { provider: 'deepseek', model: 'v4-flash' } } } },
    usageEvent(1, 1700000002000, { inputTokens: 5, outputTokens: 2, cacheReadTokens: 500, cacheWriteTokens: 0, reasoningTokens: 1 })
  )

  /* ---------------------------------------------------------------- *
   * 3) 第二次 summary（无 force）——现状：createdAt 未变 → 仍是冻结的旧 agg
   * ---------------------------------------------------------------- */
  const p2 = await callHandler(handler, '/api/usage-stats/summary')

  /* 对照组：对"当前事件流"做一次独立全量折叠（两个世界里都必须等于真值） */
  const fresh = aggregateSession(withSessionHeaderEvent(events, header), header.id)
  const freshTotal = fresh.totals.inputTokens + fresh.totals.outputTokens + fresh.totals.cacheReadTokens + fresh.totals.cacheWriteTokens
  const servedTotal = p2.totals.inputTokens + p2.totals.outputTokens + p2.totals.cacheReadTokens + p2.totals.cacheWriteTokens

  assert(
    'A.0 对照组：独立全量折叠得到 1 请求 / 507 token（事件流本身没问题）',
    fresh.totals.requests === 1 && freshTotal === 507,
    `requests=${fresh.totals.requests}, total=${freshTotal}`
  )

  if (TARGET_V050) {
    assert(
      'A.1 v0.5.0 目标：追加 usage 后 summary 必须计入（请求数与实测一致）',
      p2.totals.requests === fresh.totals.requests && servedTotal === freshTotal,
      `served requests=${p2.totals.requests} / total=${servedTotal} vs fresh requests=${fresh.totals.requests} / total=${freshTotal}`
    )
  } else {
    assert(
      'A.1 v0.4.x 现状（characterization）：createdAt 命中 → 追加的 usage 不计入',
      p2.totals.requests === 0 && servedTotal === 0,
      `served requests=${p2.totals.requests} / total=${servedTotal}`
    )
    console.log(
      `  [P0] 漏统计量化：缓存上报 ${p2.totals.requests} 请求 / ${servedTotal} token，实测 ${fresh.totals.requests} 请求 / ${freshTotal} token（差异 100%）`
    )
  }

  assert(
    'A.2 机制确认：第二次 summary 完全复用缓存（decoded=0 / reused=1），说明问题出在失效键而非事件流',
    p2.decoded === 0 && p2.reused === 1,
    `decoded=${p2.decoded}, reused=${p2.reused}`
  )
  assert(
    'A.3 失效键就是 header.createdAt（aggregateSession 读到的同一字段）',
    fresh.createdAt === header.createdAt,
    `agg.createdAt=${fresh.createdAt}, header.createdAt=${header.createdAt}`
  )

  /* ---------------------------------------------------------------- *
   * 4) 逃生通道：force=1 能拿到真值（证明数据可达，只是默认路径看不到）
   * ---------------------------------------------------------------- */
  const p3 = await callHandler(handler, '/api/usage-stats/summary?force=1')
  assert(
    'B.1 force=1 强制重算后能看到真值（现状的逃生通道）',
    p3.totals.requests === 1 && p3.totals.inputTokens === 5 && p3.totals.outputTokens === 2 && p3.totals.cacheReadTokens === 500,
    `requests=${p3.totals.requests}, input=${p3.totals.inputTokens}, output=${p3.totals.outputTokens}, cacheRead=${p3.totals.cacheReadTokens}`
  )
  assert('B.2 force=1 时 decoded = 1（真的重新解码了）', p3.decoded === 1, `decoded=${p3.decoded}`)

  /* ---------------------------------------------------------------- *
   * 5) 迁移源：v0.4.x 的单体缓存在 profile 根（v0.5.0 的 legacy 只读来源）
   *    saveCache 走 promise chain（串行化写），等一拍再看文件。
   * ---------------------------------------------------------------- */
  await new Promise((r) => setTimeout(r, 80))
  assert(
    'C.1 单体缓存文件名固定为 <profileRoot>/.usage-stats-cache.json（v0.5.0 legacy 迁移源）',
    existsSync(join(profileRoot, '.usage-stats-cache.json')),
    'cache file missing'
  )
} finally {
  rmSync(fx, { recursive: true, force: true })
}

const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok).length
console.log(`[v050-undercount] ${passed} passed, ${failed} failed${TARGET_V050 ? ' (TARGET_V050=true)' : ' (characterization: TARGET_V050=false)'}`)
if (failed > 0) {
  console.error('FAILED cases:')
  for (const r of results.filter((x) => !x.ok)) console.error('  ' + r.label + (r.detail ? ' — ' + r.detail : ''))
  process.exit(1)
}
