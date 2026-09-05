// tests/test-v040-official.mjs
// v0.4.0 host 半段 framework 集成回归测试（DSH 0.1.2-rc.1 后）。
//
// v0.4.0 改造：用 ctx.sessionQuery.listSessions() / readSession() / traceSession()
// 替代手写 zstd 解码 + 文件枚举 + rollup 父链遍历。这些 API 来自 framework，
// 端到端需真 DSH 跑——本测试用 mock sessionQuery 在 host 半段单独覆盖业务层
// 逻辑：cache 命中 / 失效 / force 语义 / inflight 协议 / subagent rollup。
//
// 用法：node tests/test-v040-official.mjs
// 期望：PASS 所有条目；任一 FAIL 立即 process.exit(1)。

import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readFileSync,
  existsSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const results = []
function assert(label, cond, detail) {
  results.push({ label, ok: !!cond, detail })
  if (!cond) {
    console.error(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`)
  }
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

/**
 * 构造一个 mock ctx.sessionQuery：listSessions 返回 header 数组；readSession
 * 返回 events 数组（来自 fixture）；traceSession 走 parentSession 链查 root。
 *
 * opts.delayMs：模拟 listSessions / readSession 慢启动，让 force-in-prewarm
 * 测试能撞上 inflight = regular 的窗口。
 */
function makeMockSessionQuery(records, opts = {}) {
  const byId = new Map(records.map((r) => [r.header.id, r]))
  const delay = opts.delayMs || 0
  return {
    async listSessions() {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay))
      return records.map((r) => ({ header: structuredClone(r.header), live: false, persisted: true }))
    },
    async readSession(id) {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay))
      const r = byId.get(id)
      if (!r) throw new Error('not found: ' + id)
      return {
        session: structuredClone(r.header),
        inheritedEventCount: 0,
        events: r.events.map((e) => structuredClone(e)),
      }
    },
    async traceSession(id) {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay))
      // 走 parentSession 链直到 null
      const ancestors = []
      const seen = new Set()
      let cur = byId.get(id)
      while (cur && cur.header.parentSession) {
        if (seen.has(cur.header.parentSession)) break
        seen.add(cur.header.parentSession)
        const parent = byId.get(cur.header.parentSession)
        if (!parent) {
          // orphan subagent → complete=false, target stays as is
          const target = byId.get(id)
          return {
            target: { header: structuredClone(target.header), live: false, persisted: true },
            ancestors,
            descendants: [],
            complete: false,
            unresolvedParentId: cur.header.parentSession,
          }
        }
        ancestors.unshift({ header: structuredClone(parent.header), live: false, persisted: true })
        cur = parent
      }
      const target = byId.get(id)
      const root = ancestors[0] || { header: structuredClone(target.header) }
      return {
        target: { header: structuredClone(target.header), live: false, persisted: true },
        ancestors,
        descendants: [],
        complete: true,
        root: { header: structuredClone(root.header), live: false, persisted: true },
      }
    },
  }
}

function setupFixture(tmpName) {
  const tmp = mkdtempSync(join(tmpdir(), tmpName))
  const profileRoot = join(tmp, 'profile')
  mkdirSync(profileRoot, { recursive: true })
  return { tmp, profileRoot, cachePath: join(profileRoot, '.usage-stats-cache.json') }
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
  const handler = registered.find((r) => r.path === '/api/usage-stats/summary').handler
  await Promise.resolve() // 让 prewarm microtask 起跑
  return { handler, ctx }
}

function cleanup(fx) {
  rmSync(fx.tmp, { recursive: true, force: true })
}

/* ------------------------------------------------------------------ *
 * 1) Happy path：2 个 main session（含 subagent） → 1 个 root，subagent
 *    token 归 owner（counts speak in main sessions only）
 * ------------------------------------------------------------------ */
{
  const fx = setupFixture('usage-stats-v040-1-')
  try {
    const records = [
      {
        header: { id: 'sess-main', createdAt: 1700000000000, isSeeded: false, cwd: '/tmp/projA', agentPreset: 'p', version: 0 },
        events: [
          { type: 'session', id: 'sess-main', cwd: '/tmp/projA', createdAt: 1700000000000, agentPreset: 'p' },
          { type: 'request/header', data: { header: { config: { provider: 'p', model: 'm' } } } },
          { type: 'assistant/message', data: { usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 100, cacheWriteTokens: 0, reasoningTokens: 1 }, turn: 0, step: 0 }, time: 1700000001000 },
        ],
      },
      {
        header: { id: 'sess-sub', createdAt: 1700000002000, isSeeded: false, cwd: '/tmp/projA', agentPreset: 'p', parentSession: 'sess-main', delegationDepth: 1, origin: 'subagent', version: 0 },
        events: [
          { type: 'session', id: 'sess-sub', parentSession: 'sess-main', delegationDepth: 1, origin: 'subagent', cwd: '/tmp/projA', createdAt: 1700000002000, agentPreset: 'p' },
          { type: 'request/header', data: { header: { config: { provider: 'p', model: 'm' } } } },
          { type: 'assistant/message', data: { usage: { inputTokens: 3, outputTokens: 1, cacheReadTokens: 30, cacheWriteTokens: 0, reasoningTokens: 0 }, turn: 0, step: 0 }, time: 1700000003000 },
        ],
      },
    ]
    const { handler } = await setupApply(fx.profileRoot, makeMockSessionQuery(records))
    // 等 prewarm 落幕
    await new Promise((r) => setTimeout(r, 10))
    const p = await callHandler(handler, '/api/usage-stats/summary')

    assert(
      '1.1 happy path: ok=true',
      p.ok === true,
      `payload.ok=${p.ok}, errors=${JSON.stringify(p.errors)}`
    )
    assert(
      '1.2 happy path: sessionCount = 1 root（subagent rollup 到 main）',
      p.sessionCount === 1,
      `sessionCount=${p.sessionCount}, rawSessionCount=${p.rawSessionCount}`
    )
    assert(
      '1.3 happy path: rawSessionCount = 2（subagent + main）',
      p.rawSessionCount === 2,
      `rawSessionCount=${p.rawSessionCount}`
    )
    assert(
      '1.4 happy path: totals.inputTokens = 13（main 10 + subagent 3）',
      p.totals && p.totals.inputTokens === 13,
      `totals.inputTokens=${p.totals && p.totals.inputTokens}`
    )
    assert(
      '1.5 happy path: totals.outputTokens = 6（main 5 + subagent 1）',
      p.totals && p.totals.outputTokens === 6,
      `totals.outputTokens=${p.totals && p.totals.outputTokens}`
    )
    assert(
      '1.6 happy path: totals.cacheReadTokens = 130（main 100 + subagent 30）',
      p.totals && p.totals.cacheReadTokens === 130,
      `totals.cacheReadTokens=${p.totals && p.totals.cacheReadTokens}`
    )
    assert(
      '1.7 happy path: topSessions 唯一 root 是 sess-main',
      p.topSessions.length === 1 && p.topSessions[0].id === 'sess-main',
      `topSessions=${JSON.stringify(p.topSessions.map((s) => s.id))}`
    )
    assert(
      '1.8 happy path: errors 为空',
      Array.isArray(p.errors) && p.errors.length === 0,
      `errors=${JSON.stringify(p.errors)}`
    )
  } finally {
    cleanup(fx)
  }
}

/* ------------------------------------------------------------------ *
 * 2) Cache 命中：第二次非 force 请求走 cache，reused 满，decoded = 0
 * ------------------------------------------------------------------ */
{
  const fx = setupFixture('usage-stats-v040-2-')
  try {
    const records = [
      {
        header: { id: 'sess-1', createdAt: 1700000000000, isSeeded: false, cwd: '/tmp', version: 0 },
        events: [
          { type: 'session', id: 'sess-1', cwd: '/tmp', createdAt: 1700000000000 },
          { type: 'request/header', data: { header: { config: { provider: 'p', model: 'm' } } } },
          { type: 'assistant/message', data: { usage: { inputTokens: 1, outputTokens: 1 }, turn: 0, step: 0 }, time: 1700000001000 },
        ],
      },
    ]
    const { handler } = await setupApply(fx.profileRoot, makeMockSessionQuery(records))
    await new Promise((r) => setTimeout(r, 30))
    // 第一次：prewarm 已完成 cache 落盘；HTTP 请求应走 cache hit
    const p1 = await callHandler(handler, '/api/usage-stats/summary')
    assert(
      '2.1 第一次 HTTP 请求：reused = 1（prewarm 已填 cache）',
      p1.reused === 1 && p1.decoded === 0,
      `decoded=${p1.decoded}, reused=${p1.reused}`
    )
    assert(
      '2.2 第一次 HTTP 请求：cache 文件落盘（prewarm 写入）',
      existsSync(fx.cachePath),
      'cache file missing'
    )
    // 第二次：仍 cache hit
    const p2 = await callHandler(handler, '/api/usage-stats/summary?nocache=' + Date.now())
    assert(
      '2.3 第二次请求：reused = 1，decoded = 0（cache 命中）',
      p2.reused === 1 && p2.decoded === 0,
      `decoded=${p2.decoded}, reused=${p2.reused}`
    )
  } finally {
    cleanup(fx)
  }
}

/* ------------------------------------------------------------------ *
 * 3) Cache 失效：header.createdAt 改变（模拟 session 重写）→ 重 build
 * ------------------------------------------------------------------ */
{
  const fx = setupFixture('usage-stats-v040-3-')
  try {
    let createdAt = 1700000000000
    const records = [
      {
        header: { id: 'sess-1', createdAt, isSeeded: false, cwd: '/tmp', version: 0 },
        events: [
          { type: 'session', id: 'sess-1', cwd: '/tmp', createdAt },
          { type: 'request/header', data: { header: { config: { provider: 'p', model: 'm' } } } },
          { type: 'assistant/message', data: { usage: { inputTokens: 1, outputTokens: 1 }, turn: 0, step: 0 }, time: 1700000001000 },
        ],
      },
    ]
    const sessionQuery = makeMockSessionQuery(records)
    const { handler } = await setupApply(fx.profileRoot, sessionQuery)
    await new Promise((r) => setTimeout(r, 30))
    // 第一次：prewarm 已填 cache
    const p1 = await callHandler(handler, '/api/usage-stats/summary')
    assert(
      '3.1 第一次：reused = 1（prewarm 已填 cache）',
      p1.reused === 1,
      `decoded=${p1.decoded}, reused=${p1.reused}`
    )
    // 模拟 session 文件被改（v0.4.0 失效字段：header.createdAt）。
    // v0.4.0.3：plugin 缓存了 records 引用，普通 summary 调用复用 records cache
    // 看不到 createdAt 变化——必须用 force=1 触发 records 重读 + aggregateSession 重跑。
    createdAt = 1700000099999
    records[0].header.createdAt = createdAt
    records[0].events[0].createdAt = createdAt
    const p2 = await callHandler(handler, '/api/usage-stats/summary?force=1&t=' + Date.now())
    assert(
      '3.2 force=1 + header.createdAt 改变后：reused = 0，decoded = 1（cache miss）',
      p2.reused === 0 && p2.decoded === 1,
      `decoded=${p2.decoded}, reused=${p2.reused}`
    )
  } finally {
    cleanup(fx)
  }
}

/* ------------------------------------------------------------------ *
 * 4) Force 语义：cache 命中条件下 force=1 仍触发重 build
 * ------------------------------------------------------------------ */
{
  const fx = setupFixture('usage-stats-v040-4-')
  try {
    const records = [
      {
        header: { id: 'sess-1', createdAt: 1700000000000, isSeeded: false, cwd: '/tmp', version: 0 },
        events: [
          { type: 'session', id: 'sess-1', cwd: '/tmp', createdAt: 1700000000000 },
          { type: 'request/header', data: { header: { config: { provider: 'p', model: 'm' } } } },
          { type: 'assistant/message', data: { usage: { inputTokens: 1, outputTokens: 1 }, turn: 0, step: 0 }, time: 1700000001000 },
        ],
      },
    ]
    const { handler } = await setupApply(fx.profileRoot, makeMockSessionQuery(records))
    await new Promise((r) => setTimeout(r, 30))
    // 等 prewarm 填 cache
    await callHandler(handler, '/api/usage-stats/summary')
    // 然后 force
    const p2 = await callHandler(handler, '/api/usage-stats/summary?force=1&t=' + Date.now())
    assert(
      '4.1 force=1：reused = 0，decoded = 1（忽略 cache）',
      p2.reused === 0 && p2.decoded === 1,
      `decoded=${p2.decoded}, reused=${p2.reused}`
    )
  } finally {
    cleanup(fx)
  }
}

/* ------------------------------------------------------------------ *
 * 5) Force / inflight 协议保留（v0.3.8.2 修复不被退化）：
 *    prewarm 在 regular inflight 时发起 force 请求，应等 prewarm 结束
 *    后再启动一次 force build——chain 上至少 2 次 saveCache。
 *    用 mock 慢启动 listSessions / readSession（delayMs）让 prewarm 与
 *    force 之间有 ms 级别窗口可观察。
 * ------------------------------------------------------------------ */
{
  const fx = setupFixture('usage-stats-v040-5-')
  try {
    const records = []
    for (let i = 0; i < 30; i++) {
      records.push({
        header: { id: 'session-' + i, createdAt: 1700000000000 + i * 1000, isSeeded: false, cwd: '/tmp/projA', version: 0 },
        events: [
          { type: 'session', id: 'session-' + i, cwd: '/tmp/projA', createdAt: 1700000000000 + i * 1000, agentPreset: 'p' },
          { type: 'request/header', data: { header: { config: { provider: 'p', model: 'm' } } } },
          { type: 'assistant/message', data: { usage: { inputTokens: 1, outputTokens: 1 }, turn: 0, step: 0 }, time: 1700000001000 + i * 1000 },
        ],
      })
    }
    const sessionQuery = makeMockSessionQuery(records, { delayMs: 2 })
    const { handler } = await setupApply(fx.profileRoot, sessionQuery)
    // 不等 prewarm；立即发起 force 请求——撞上 regular inflight
    // （setupApply 只 await Promise.resolve() 让 microtask 起跑，
    //  prewarm 还在 30 个 readSession 的延迟中）
    const tmpPath = fx.cachePath + '.tmp'
    // 1ms 轮询 .tmp 翻转计数：每次 saveCache 期间 .tmp 存在一次
    // → prewarm + force 各 1 次 = 至少 2 flips
    const flipsPromise = (async () => {
      const start = Date.now()
      let flips = 0
      let wasPresent = false
      while (Date.now() - start < 4000) {
        const present = existsSync(tmpPath)
        if (present && !wasPresent) flips += 1
        wasPresent = present
        await new Promise((r) => setTimeout(r, 1))
      }
      return flips
    })()
    const forceCall = callHandler(handler, '/api/usage-stats/summary?force=1&t=' + Date.now())
    const [flips] = await Promise.all([flipsPromise, forceCall])
    assert(
      '5.1 force in prewarm：chain 上至少 2 次 saveCache（prewarm + force 各一次）',
      flips >= 2,
      `flips=${flips}（期望 ≥ 2）`
    )
  } finally {
    cleanup(fx)
  }
}

/* ------------------------------------------------------------------ *
 * 6) Error 隔离：单个 session 报错不影响其他
 * ------------------------------------------------------------------ */
{
  const fx = setupFixture('usage-stats-v040-6-')
  try {
    const records = [
      {
        header: { id: 'sess-good', createdAt: 1700000000000, isSeeded: false, cwd: '/tmp', version: 0 },
        events: [
          { type: 'session', id: 'sess-good', cwd: '/tmp', createdAt: 1700000000000 },
          { type: 'request/header', data: { header: { config: { provider: 'p', model: 'm' } } } },
          { type: 'assistant/message', data: { usage: { inputTokens: 7, outputTokens: 3 }, turn: 0, step: 0 }, time: 1700000001000 },
        ],
      },
    ]
    const sessionQuery = makeMockSessionQuery(records)
    // 模拟 listSessions 含 sess-bad 但 readSession 对其抛错
    const listSessions = sessionQuery.listSessions.bind(sessionQuery)
    sessionQuery.listSessions = async () => {
      const list = await listSessions()
      list.push({ header: { id: 'sess-bad', createdAt: 1700000002000, isSeeded: false, cwd: '/tmp', version: 0 }, live: false, persisted: true })
      return list
    }
    const originalRead = sessionQuery.readSession.bind(sessionQuery)
    sessionQuery.readSession = async (id) => {
      if (id === 'sess-bad') throw new Error('mock decode failure')
      return originalRead(id)
    }
    const { handler } = await setupApply(fx.profileRoot, sessionQuery)
    await new Promise((r) => setTimeout(r, 10))
    const p = await callHandler(handler, '/api/usage-stats/summary')
    assert(
      '6.1 single session error: ok=true 仍返回（其他 session 正常聚合）',
      p.ok === true,
      `ok=${p.ok}`
    )
    assert(
      '6.2 single session error: errors 数组包含 sess-bad',
      Array.isArray(p.errors) && p.errors.some((e) => e.includes('sess-bad')),
      `errors=${JSON.stringify(p.errors)}`
    )
    assert(
      '6.3 single session error: sess-good 仍贡献 token（inputTokens = 7）',
      p.totals && p.totals.inputTokens === 7,
      `inputTokens=${p.totals && p.totals.inputTokens}`
    )
  } finally {
    cleanup(fx)
  }
}

/* ------------------------------------------------------------------ *
 * 7) Beijing 锚点回归（v0.3.8 修复）：day 粒度不在 Beijing 00:00–08:00
 *    （= UTC 16:00–24:00）丢今天的桶。这里直接调 granularitySeries 验证
 *    （不走 ctx，纯 unit test）。
 * ------------------------------------------------------------------ */
{
  const { granularitySeries, beijingDayKey } = await import('../lib/index.js')
  const now = Date.UTC(2024, 0, 15, 20, 0, 0) // 04:00 Beijing 当日 (01-16)
  const today = '2024-01-16'
  const root = { days: { [today]: { inputTokens: 42, outputTokens: 7, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 1 } } }
  const roots = new Map([['r', root]])
  const series = granularitySeries(roots, 'day', now)
  const lastBucket = series[series.length - 1]
  assert(
    '7.1 Beijing 锚点：today 桶在 day 序列末位',
    lastBucket.bucket === today && lastBucket.inputTokens === 42,
    `last bucket = ${JSON.stringify(lastBucket)}, today=${today}, beijingDayKey(now)=${beijingDayKey(now)}`
  )
}

/* ------------------------------------------------------------------ *
 * 8) byDayAll 输出升序不零填充（v0.3.9 行为保留）
 * ------------------------------------------------------------------ */
{
  const { rootsDaysAll } = await import('../lib/index.js')
  const rootList = [{
    days: {
      '2024-01-03': { inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 1 },
      '2024-01-01': { inputTokens: 200, outputTokens: 60, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 1 },
      '2024-01-02': { inputTokens: 300, outputTokens: 70, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 1 },
    },
  }]
  const result = rootsDaysAll(rootList)
  assert(
    '8.1 byDayAll 输出按日期升序',
    result[0].bucket === '2024-01-01' && result[1].bucket === '2024-01-02' && result[2].bucket === '2024-01-03',
    `result.buckets = ${result.map((r) => r.bucket).join(',')}`
  )
  assert(
    '8.2 byDayAll 不零填充（length === 3）',
    result.length === 3,
    `length=${result.length}`
  )
}

/* ------------------------------------------------------------------ *
 * 汇总
 * ------------------------------------------------------------------ */
const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok).length
console.log(`[v040-official] ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('FAILED cases:')
  for (const r of results.filter((x) => !x.ok)) console.error('  ' + r.label + (r.detail ? ' — ' + r.detail : ''))
  process.exit(1)
}