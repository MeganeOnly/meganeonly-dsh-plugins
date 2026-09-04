// tests/test-v038-fixes.mjs
// v0.3.8 host 半段三个高置信 bug 修复 + 缓存语义回归测试：
//   A) step/start 或 assistant/message 缺 / 非法时间 → llmMs 不被污染，
//      且不让 valid epoch assistant time 当成 duration（openStep=null 短路）。
//   B) granularitySeries 日序列锚定 Beijing 日界（不再锚 UTC 午夜）。
//   C) rollupByMainSession 用 fileId（<projectDir>/<sessionDir>）作实体键，
//      跨项目同名 session 各自独立成 root（不再用 JSONL agg.id 撞车）。
//   D) 缓存语义：旧版本号 / 损坏条目 / force=1 都正确触发重算。
//   E) v0.3.8.1 增量：父链遍历按 project 作用域（byJsonId 分桶），跨项目同名
//      JSONL id 的子代理不再被错误归并到另一项目的 root。
//   F) v0.3.8.1 增量：cached.agg usable 契约——partial agg（缺 totals 等）视为
//      miss 触发重解码，避免 summary 崩溃；rollupByMainSession / topSessions 内部
//      对 agg.totals 兜底（defense in depth）。
//
// 用法：node tests/test-v038-fixes.mjs
// 期望：PASS 所有条目；任一 FAIL 立即 process.exit(1)。

import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  aggregateSession,
  beijingDayKey,
  granularitySeries,
} from '../lib/index.js'

const results = []
function assert(label, cond, detail) {
  results.push({ label, ok: !!cond, detail })
}

/* ------------------------------------------------------------------ *
 * bug A: step/start 缺 / 非法时间 → llmMs 不被 valid epoch 污染
 * ------------------------------------------------------------------ */

// A.1 缺 step/start + valid epoch assistant time → llmMs = 0
{
  const events = [
    { type: 'request/header', data: { header: { config: { provider: 'p', model: 'm' } } }, time: 100 },
    { type: 'assistant/message', data: { usage: { inputTokens: 5, outputTokens: 5 } }, time: 1700000001000 },
  ]
  const agg = aggregateSession(events)
  assert(
    'A.1: 缺 step/start → valid epoch 不入 llmMs',
    agg.llmMs === 0,
    `llmMs = ${agg.llmMs}`
  )
}

// A.2 step/start.time=NaN + valid epoch → llmMs = 0（v0.3.7 旧逻辑会推到 1.7e12）
{
  const events = [
    { type: 'step/start', data: { turn: 1, step: 1 }, time: NaN },
    { type: 'assistant/message', data: { usage: { inputTokens: 5, outputTokens: 5 }, turn: 1, step: 1 }, time: 1700000002000 },
  ]
  const agg = aggregateSession(events)
  assert(
    'A.2: step/start.time=NaN → valid epoch 不入 llmMs（不开 0 - epoch 漏洞）',
    agg.llmMs === 0,
    `llmMs = ${agg.llmMs}`
  )
  assert(
    'A.2: llmMs 远小于 1e12（不会被 epoch 推到 1.7e12）',
    Number.isFinite(agg.llmMs) && agg.llmMs < 1e12,
    `llmMs = ${agg.llmMs}`
  )
}

// A.3 step/start.time=undefined + valid epoch → llmMs = 0
{
  const events = [
    { type: 'step/start', data: { turn: 1, step: 1 } },
    { type: 'assistant/message', data: { usage: { inputTokens: 5, outputTokens: 5 }, turn: 1, step: 1 }, time: 1700000003000 },
  ]
  const agg = aggregateSession(events)
  assert(
    'A.3: step/start.time 缺（undefined） → valid epoch 不入 llmMs',
    agg.llmMs === 0,
    `llmMs = ${agg.llmMs}`
  )
}

// A.4 step/start.time=Infinity + valid epoch → llmMs = 0
{
  const events = [
    { type: 'step/start', data: { turn: 1, step: 1 }, time: Infinity },
    { type: 'assistant/message', data: { usage: { inputTokens: 5, outputTokens: 5 }, turn: 1, step: 1 }, time: 1700000004000 },
  ]
  const agg = aggregateSession(events)
  assert(
    'A.4: step/start.time=Infinity → valid epoch 不入 llmMs',
    agg.llmMs === 0,
    `llmMs = ${agg.llmMs}`
  )
}

// A.5 step/start.time=null + valid epoch → llmMs = 0
{
  const events = [
    { type: 'step/start', data: { turn: 1, step: 1 }, time: null },
    { type: 'assistant/message', data: { usage: { inputTokens: 5, outputTokens: 5 }, turn: 1, step: 1 }, time: 1700000004500 },
  ]
  const agg = aggregateSession(events)
  assert(
    'A.5: step/start.time=null → valid epoch 不入 llmMs',
    agg.llmMs === 0,
    `llmMs = ${agg.llmMs}`
  )
}

// A.6 step/start.time='1700000000000'（字符串数字）+ valid epoch → llmMs = 0
{
  const events = [
    { type: 'step/start', data: { turn: 1, step: 1 }, time: '1700000000000' },
    { type: 'assistant/message', data: { usage: { inputTokens: 5, outputTokens: 5 }, turn: 1, step: 1 }, time: 1700000005000 },
  ]
  const agg = aggregateSession(events)
  assert(
    'A.6: step/start.time=字符串数字（typeof=string） → 不写 openStep',
    agg.llmMs === 0,
    `llmMs = ${agg.llmMs}`
  )
}

// A.7 baseline 时间是 string "1700000000000"，assistant 是有限数字 → 仍不配对
{
  const events = [
    { type: 'step/start', data: { turn: 1, step: 1 }, time: 1700000006000 },
    { type: 'assistant/message', data: { usage: { inputTokens: 1, outputTokens: 1 }, turn: 1, step: 1 }, time: 1700000007000 },
  ]
  const agg = aggregateSession(events)
  assert(
    'A.7: valid baseline + valid assistant time → llmMs 正确累加（1000ms）',
    agg.llmMs === 1000,
    `llmMs = ${agg.llmMs}`
  )
}

// A.8 多步骤混合：valid baseline + invalid baseline 都不污染总数
{
  const events = [
    { type: 'step/start', data: { turn: 1, step: 1 }, time: NaN },
    { type: 'assistant/message', data: { usage: { inputTokens: 1, outputTokens: 1 }, turn: 1, step: 1 }, time: 1700000010000 },
    { type: 'step/start', data: { turn: 2, step: 1 }, time: 1700000020000 },
    { type: 'assistant/message', data: { usage: { inputTokens: 1, outputTokens: 1 }, turn: 2, step: 1 }, time: 1700000020500 },
  ]
  const agg = aggregateSession(events)
  assert(
    'A.8: 多步骤混合（NaN baseline + valid baseline）→ llmMs 只累加 valid 步（500ms）',
    agg.llmMs === 500,
    `llmMs = ${agg.llmMs}`
  )
}

/* ------------------------------------------------------------------ *
 * bug B: granularitySeries 日序列锚定 Beijing 日界
 * ------------------------------------------------------------------ */

// B.1 关键场景：now 在 Beijing 00:00–08:00（= UTC 16:00–24:00 前一天），
// 旧 UTC anchor 让"今天"Beijing 桶落到"昨天"，新 Beijing anchor 正确。
{
  const now = Date.UTC(2024, 0, 15, 20, 0, 0) // 2024-01-15 20:00 UTC = 2024-01-16 04:00 Beijing
  const series = granularitySeries([], 'day', now)
  const lastBucket = series[series.length - 1].bucket
  assert(
    'B.1: now=UTC 20:00（Beijing 04:00 当日）→ day 序列末位 = Beijing 当日',
    lastBucket === '2024-01-16',
    `last bucket = ${lastBucket}, now = ${new Date(now).toISOString()}`
  )
  assert(
    'B.1: day 序列首位 = 29 天前 Beijing',
    series[0].bucket === '2023-12-18',
    `first bucket = ${series[0].bucket}`
  )
}

// B.2 边界：now 恰是 Beijing 00:00 = UTC 16:00（= 一天的开始）
{
  const now = Date.UTC(2024, 0, 15, 16, 0, 0) // 2024-01-15 16:00 UTC = 2024-01-16 00:00 Beijing
  const series = granularitySeries([], 'day', now)
  const lastBucket = series[series.length - 1].bucket
  assert(
    'B.2: now=UTC 16:00 整（Beijing 00:00 整）→ day 序列末位 = Beijing 当日',
    lastBucket === '2024-01-16',
    `last bucket = ${lastBucket}, now = ${new Date(now).toISOString()}`
  )
}

// B.3 边界：now 恰是 Beijing 23:59 = UTC 15:59（昨天的最后一秒）
{
  const now = Date.UTC(2024, 0, 15, 15, 59, 0) // 2024-01-15 15:59 UTC = 2024-01-15 23:59 Beijing
  const series = granularitySeries([], 'day', now)
  const lastBucket = series[series.length - 1].bucket
  assert(
    'B.3: now=UTC 15:59（Beijing 23:59 昨天）→ day 序列末位 = Beijing 昨天',
    lastBucket === '2024-01-15',
    `last bucket = ${lastBucket}, now = ${new Date(now).toISOString()}`
  )
}

// B.4 hour 粒度：BEIJING_OFFSET_MS 是 hour stepMs (3600000) 的整数倍 → 与旧版等价
// 验证 hour 锚点仍正确（不在 hour 边界 → 锚到当前 hour 末）
{
  const now = Date.UTC(2024, 0, 15, 20, 30, 0) // :30 分（hour 内）
  const lastBucket = granularitySeries([], 'hour', now).slice(-1)[0].bucket
  // anchorMs = now - ((now + 8h) % 3600000) → 锚到当前 hour 末
  // For now 20:30 UTC: now + 8h = 04:30 next day (Beijing 12:30)
  // past beijing-midnight: 12h 30m = 45000 sec = 12.5h
  // ((now + 8h) % 3600000) = 30 * 60 * 1000 = 1800000
  // anchorMs = now - 1800000 = 2024-01-15 20:00 UTC
  // keyFn → beijingDayKey(20:00 UTC Jan 15) = 2024-01-16
  // + 'T' + (20+8)%24 = '2024-01-16T04'
  assert(
    'B.4: hour 粒度：20:30 UTC 锚到 20:00 UTC（keyFn 用 Beijing 日 + UTC hour 偏移）',
    lastBucket === '2024-01-16T04',
    `last bucket = ${lastBucket}, now = ${new Date(now).toISOString()}`
  )
}

// B.5 minute 粒度：同 hour，BEIJING_OFFSET_MS 是 60_000 整数倍 → 等价
{
  const now = Date.UTC(2024, 0, 15, 20, 30, 45) // :45 秒
  const lastBucket = granularitySeries([], 'minute', now).slice(-1)[0].bucket
  // anchorMs = now - ((now + 8h) % 60000) = now - 45000
  // beijingDayKey(now - 45000) → 2024-01-16 (since 20:30:00 UTC = 04:30 Beijing)
  // dt.getUTCMinutes() = 30, getUTCHours() = 4 (after +8h)
  assert(
    'B.5: minute 粒度：anchor 对齐当前 minute 末（keyFn 用 Beijing 日 + UTC 偏移）',
    lastBucket === '2024-01-16T04:30',
    `last bucket = ${lastBucket}, now = ${new Date(now).toISOString()}`
  )
}

// B.6 day 粒度：anchor 跨 Beijing 日界时序列不丢今天的桶
// 验证：把数据 put 到"今天"Beijing 桶，能在序列末位看到
{
  const now = Date.UTC(2024, 0, 15, 20, 0, 0) // 04:00 Beijing 当日
  const today = '2024-01-16'
  // 构造一个 root 含 today 桶
  const root = { days: { [today]: { inputTokens: 42, outputTokens: 7, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 1 } } }
  const roots = new Map([['r', root]])
  const series = granularitySeries(roots, 'day', now)
  const lastBucket = series[series.length - 1]
  assert(
    'B.6: today 桶（Beijing 当日）出现在 day 序列末位',
    lastBucket.bucket === today && lastBucket.inputTokens === 42,
    `last bucket = ${JSON.stringify(lastBucket)}`
  )
}

/* ------------------------------------------------------------------ *
 * bug C: rollupByMainSession 用 fileId 而非 agg.id
 * ------------------------------------------------------------------ */

// C.1 aggregateSession 暴露 fileId 字段
{
  const events = [{ type: 'assistant/message', data: { usage: { inputTokens: 1, outputTokens: 1 } }, time: 1700000001000 }]
  const agg = aggregateSession(events, 'projA/session-sameid')
  assert(
    'C.1: aggregateSession 接受 fileId 形参并写入返回值',
    agg.fileId === 'projA/session-sameid',
    `fileId = ${agg.fileId}`
  )
}

// C.2 端到端：两个项目各一个同名 session-XXX → 各自成 root（sessionCount=2）
// 走 apply pipeline，验证 summary.sessionCount === summary.rawSessionCount === 2
{
  const tmp = mkdtempSync(join(tmpdir(), 'usage-stats-v038-'))
  try {
    const profileRoot = join(tmp, 'profile')
    const home = join(tmp, 'home')
    const sessionsRoot = join(home, 'sessions')
    mkdirSync(profileRoot, { recursive: true })
    mkdirSync(sessionsRoot, { recursive: true })

    for (const project of ['projA', 'projB']) {
      const projDir = join(sessionsRoot, project)
      mkdirSync(join(projDir, 'session-sameid'), { recursive: true })
      writeFileSync(
        join(projDir, 'session-sameid', 'session.jsonl'),
        JSON.stringify({ type: 'session', id: 'sameid', cwd: project, createdAt: 1700000000000, agentPreset: 'p' }) + '\n' +
        JSON.stringify({ type: 'assistant/message', data: { usage: { inputTokens: 1, outputTokens: 1 } }, time: 1700000001000 }) + '\n',
        'utf8'
      )
    }

    process.env.DSH_HOME = home
    const { apply } = await import('../lib/index.js')
    const registered = []
    const ctx = {
      baseUrl: pathToFileURL(profileRoot) + '/',
      webServer: { register(spec) { registered.push(spec) } },
    }
    apply(ctx)
    const summaryHandler = registered.find((r) => r.path === '/api/usage-stats/summary').handler
    function call(url) {
      return new Promise((resolve) => {
        const res = {
          writeHead(s, h) { this.status = s; this.headers = h },
          end(body) { resolve(JSON.parse(body)) },
        }
        summaryHandler({ method: 'GET', url }, res)
      })
    }

    const p1 = await call('/api/usage-stats/summary')
    assert(
      'C.2: 跨项目同名 session：sessionCount = rawSessionCount = 2（独立成 root）',
      p1.sessionCount === 2 && p1.rawSessionCount === 2,
      `sessionCount=${p1.sessionCount}, rawSessionCount=${p1.rawSessionCount}, errors=${JSON.stringify(p1.errors)}`
    )
    assert(
      'C.2: 跨项目同名 session：totals.inputTokens = 2（两边各 1，无串扰）',
      p1.totals.inputTokens === 2 && p1.totals.outputTokens === 2,
      `totals = ${JSON.stringify(p1.totals)}`
    )
    // topSessions 应有 2 个 root（不是合并成 1）
    assert(
      'C.2: topSessions 有 2 个 root（每个 project 各一）',
      p1.topSessions.length === 2,
      `topSessions.length = ${p1.topSessions.length}, ids = ${JSON.stringify(p1.topSessions.map(s => s.id))}`
    )
    // topSessions 的 id 应该是 fileId（含 project 前缀），不是 JSONL id
    const allFileIds = p1.topSessions.every(s => s.id.includes('/'))
    assert(
      'C.2: topSessions[].id 是 fileId（含 project 前缀），不是 JSONL agg.id',
      allFileIds,
      `topSessions ids = ${JSON.stringify(p1.topSessions.map(s => s.id))}`
    )
  } finally {
    delete process.env.DSH_HOME
    rmSync(tmp, { recursive: true, force: true })
  }
}

/* ------------------------------------------------------------------ *
 * bug D: 缓存语义 — 旧版本号 / 损坏 / force=1
 * ------------------------------------------------------------------ */

// D.1 旧版本（5）的 cache 文件被识别为过期，全量重解码
{
  const tmp = mkdtempSync(join(tmpdir(), 'usage-stats-v038-cache-'))
  try {
    const profileRoot = join(tmp, 'profile')
    const home = join(tmp, 'home')
    const sessionsRoot = join(home, 'sessions')
    mkdirSync(profileRoot, { recursive: true })
    mkdirSync(sessionsRoot, { recursive: true })

    const projDir = join(sessionsRoot, 'projA')
    mkdirSync(join(projDir, 'session-x'), { recursive: true })
    writeFileSync(
      join(projDir, 'session-x', 'session.jsonl'),
      JSON.stringify({ type: 'session', id: 'x', cwd: 'projA', createdAt: 1700000000000, agentPreset: 'p' }) + '\n' +
      JSON.stringify({ type: 'assistant/message', data: { usage: { inputTokens: 1, outputTokens: 1 } }, time: 1700000001000 }) + '\n',
      'utf8'
    )

    // 写一份"老 v5"缓存到 profile 根
    const cachePath = join(profileRoot, '.usage-stats-cache.json')
    writeFileSync(
      cachePath,
      JSON.stringify({
        version: 5, // 故意低于当前 CACHE_VERSION
        sessions: {
          'projA/session-x': {
            size: 999999, // 故意 size 不匹配
            mtimeMs: 0,
            agg: { id: 'x', totals: { inputTokens: 999, outputTokens: 999, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 1 } },
          },
        },
      }),
      'utf8'
    )

    process.env.DSH_HOME = home
    const { apply } = await import('../lib/index.js')
    const registered = []
    const ctx = {
      baseUrl: pathToFileURL(profileRoot) + '/',
      webServer: { register(spec) { registered.push(spec) } },
    }
    apply(ctx)
    const summaryHandler = registered.find((r) => r.path === '/api/usage-stats/summary').handler
    function call(url) {
      return new Promise((resolve) => {
        const res = {
          writeHead(s, h) { this.status = s; this.headers = h },
          end(body) { resolve(JSON.parse(body)) },
        }
        summaryHandler({ method: 'GET', url }, res)
      })
    }

    const p1 = await call('/api/usage-stats/summary')
    assert(
      'D.1: 老版本 v5 cache 文件：version 不匹配被识别为过期，全量重解码（decoded=1）',
      p1.decoded === 1 && p1.reused === 0,
      `decoded=${p1.decoded}, reused=${p1.reused}`
    )
    assert(
      'D.1: 老版本 cache 的"假"inputTokens=999 不再出现（重解码后是真实 1）',
      p1.totals.inputTokens === 1,
      `totals = ${JSON.stringify(p1.totals)}`
    )

    // 第二次调用：cache 已被新版本重写，应该 reused=1
    const p2 = await call('/api/usage-stats/summary')
    assert(
      'D.1: 重写后第二次调用 reused=1（增量缓存恢复）',
      p2.reused === 1 && p2.decoded === 0,
      `decoded=${p2.decoded}, reused=${p2.reused}`
    )
  } finally {
    delete process.env.DSH_HOME
    rmSync(tmp, { recursive: true, force: true })
  }
}

// D.2 损坏的 cache 文件（不是 JSON）→ 视为无缓存，全量重解码
{
  const tmp = mkdtempSync(join(tmpdir(), 'usage-stats-v038-cache-'))
  try {
    const profileRoot = join(tmp, 'profile')
    const home = join(tmp, 'home')
    const sessionsRoot = join(home, 'sessions')
    mkdirSync(profileRoot, { recursive: true })
    mkdirSync(sessionsRoot, { recursive: true })

    const projDir = join(sessionsRoot, 'projA')
    mkdirSync(join(projDir, 'session-x'), { recursive: true })
    writeFileSync(
      join(projDir, 'session-x', 'session.jsonl'),
      JSON.stringify({ type: 'session', id: 'x', cwd: 'projA', createdAt: 1700000000000, agentPreset: 'p' }) + '\n' +
      JSON.stringify({ type: 'assistant/message', data: { usage: { inputTokens: 1, outputTokens: 1 } }, time: 1700000001000 }) + '\n',
      'utf8'
    )

    // 写一份完全损坏的 cache
    writeFileSync(join(profileRoot, '.usage-stats-cache.json'), '{{{ not valid json', 'utf8')

    process.env.DSH_HOME = home
    const { apply } = await import('../lib/index.js')
    const registered = []
    const ctx = {
      baseUrl: pathToFileURL(profileRoot) + '/',
      webServer: { register(spec) { registered.push(spec) } },
    }
    apply(ctx)
    const summaryHandler = registered.find((r) => r.path === '/api/usage-stats/summary').handler
    function call(url) {
      return new Promise((resolve) => {
        const res = {
          writeHead(s, h) { this.status = s; this.headers = h },
          end(body) { resolve(JSON.parse(body)) },
        }
        summaryHandler({ method: 'GET', url }, res)
      })
    }

    const p1 = await call('/api/usage-stats/summary')
    assert(
      'D.2: 损坏 cache 文件 → decoded=1（视为 miss，不抛错）',
      p1.ok === true && p1.decoded === 1 && p1.reused === 0,
      `ok=${p1.ok}, decoded=${p1.decoded}, reused=${p1.reused}, errors=${JSON.stringify(p1.errors)}`
    )
  } finally {
    delete process.env.DSH_HOME
    rmSync(tmp, { recursive: true, force: true })
  }
}

// D.3 cached.agg 不是对象（null / string）→ 视为坏条目，触发重解码
{
  const tmp = mkdtempSync(join(tmpdir(), 'usage-stats-v038-cache-'))
  try {
    const profileRoot = join(tmp, 'profile')
    const home = join(tmp, 'home')
    const sessionsRoot = join(home, 'sessions')
    mkdirSync(profileRoot, { recursive: true })
    mkdirSync(sessionsRoot, { recursive: true })

    const projDir = join(sessionsRoot, 'projA')
    mkdirSync(join(projDir, 'session-x'), { recursive: true })
    writeFileSync(
      join(projDir, 'session-x', 'session.jsonl'),
      JSON.stringify({ type: 'session', id: 'x', cwd: 'projA', createdAt: 1700000000000, agentPreset: 'p' }) + '\n' +
      JSON.stringify({ type: 'assistant/message', data: { usage: { inputTokens: 1, outputTokens: 1 } }, time: 1700000001000 }) + '\n',
      'utf8'
    )

    // 写一份 cached.agg 是字符串的"假命中"cache（版本号对、size/mtime 对）
    const sessionPath = join(projDir, 'session-x', 'session.jsonl')
    const { statSync } = await import('node:fs')
    const st = statSync(sessionPath)
    // 假装用 valid JSON 写一个 bad cache
    writeFileSync(
      join(profileRoot, '.usage-stats-cache.json'),
      JSON.stringify({
        version: 6,
        sessions: {
          'projA/session-x': {
            size: st.size,
            mtimeMs: st.mtimeMs,
            agg: 'NOT_AN_OBJECT', // 故意损坏
          },
        },
      }),
      'utf8'
    )

    process.env.DSH_HOME = home
    const { apply } = await import('../lib/index.js')
    const registered = []
    const ctx = {
      baseUrl: pathToFileURL(profileRoot) + '/',
      webServer: { register(spec) { registered.push(spec) } },
    }
    apply(ctx)
    const summaryHandler = registered.find((r) => r.path === '/api/usage-stats/summary').handler
    function call(url) {
      return new Promise((resolve) => {
        const res = {
          writeHead(s, h) { this.status = s; this.headers = h },
          end(body) { resolve(JSON.parse(body)) },
        }
        summaryHandler({ method: 'GET', url }, res)
      })
    }

    const p1 = await call('/api/usage-stats/summary')
    assert(
      'D.3: cached.agg 不是对象（字符串）→ 视为 miss，decoded=1',
      p1.ok === true && p1.decoded === 1 && p1.reused === 0,
      `ok=${p1.ok}, decoded=${p1.decoded}, reused=${p1.reused}, errors=${JSON.stringify(p1.errors)}`
    )
  } finally {
    delete process.env.DSH_HOME
    rmSync(tmp, { recursive: true, force: true })
  }
}

// D.4 force=1 强制全量重解码（即使 size/mtimeMs 完全匹配）
{
  const tmp = mkdtempSync(join(tmpdir(), 'usage-stats-v038-cache-'))
  try {
    const profileRoot = join(tmp, 'profile')
    const home = join(tmp, 'home')
    const sessionsRoot = join(home, 'sessions')
    mkdirSync(profileRoot, { recursive: true })
    mkdirSync(sessionsRoot, { recursive: true })

    const projDir = join(sessionsRoot, 'projA')
    mkdirSync(join(projDir, 'session-x'), { recursive: true })
    writeFileSync(
      join(projDir, 'session-x', 'session.jsonl'),
      JSON.stringify({ type: 'session', id: 'x', cwd: 'projA', createdAt: 1700000000000, agentPreset: 'p' }) + '\n' +
      JSON.stringify({ type: 'assistant/message', data: { usage: { inputTokens: 1, outputTokens: 1 } }, time: 1700000001000 }) + '\n',
      'utf8'
    )

    process.env.DSH_HOME = home
    const { apply } = await import('../lib/index.js')
    const registered = []
    const ctx = {
      baseUrl: pathToFileURL(profileRoot) + '/',
      webServer: { register(spec) { registered.push(spec) } },
    }
    apply(ctx)
    const summaryHandler = registered.find((r) => r.path === '/api/usage-stats/summary').handler
    function call(url) {
      return new Promise((resolve) => {
        const res = {
          writeHead(s, h) { this.status = s; this.headers = h },
          end(body) { resolve(JSON.parse(body)) },
        }
        summaryHandler({ method: 'GET', url }, res)
      })
    }

    // 第一次：cache 写入
    const p1 = await call('/api/usage-stats/summary')
    assert(
      'D.4: 首次（无 cache）→ decoded=1',
      p1.decoded === 1 && p1.reused === 0,
      `decoded=${p1.decoded}, reused=${p1.reused}`
    )

    // 第二次（无 force）：应 cached hit
    const p2 = await call('/api/usage-stats/summary')
    assert(
      'D.4: 第二次（无 force）→ reused=1（缓存命中）',
      p2.decoded === 0 && p2.reused === 1,
      `decoded=${p2.decoded}, reused=${p2.reused}`
    )

    // 第三次（force=1）：必须 decoded=1，无视 cache
    const p3 = await call('/api/usage-stats/summary?force=1')
    assert(
      'D.4: force=1 → decoded=1，reused=0（强制重解码）',
      p3.decoded === 1 && p3.reused === 0,
      `decoded=${p3.decoded}, reused=${p3.reused}`
    )
  } finally {
    delete process.env.DSH_HOME
    rmSync(tmp, { recursive: true, force: true })
  }
}

/* ------------------------------------------------------------------ *
 * bug E: rollupByMainSession 父链按 project 作用域（v0.3.8.1）
 * ------------------------------------------------------------------ */

// E.1 跨项目同名 JSONL id 的子代理不会被误归并到另一项目的 root
// 之前 v0.3.8 只把实体 identity 升级到 fileId，但父链遍历仍走全局 byJsonId
// （按 JSONL agg.id 索引），会让 projA 的 subagent（parentSession='sameid'）
// 把 'sameid' 解析到 projB 的同名 main session（DSH 仅保证单项目内 JSONL id
// 唯一）。修复后按 project 分桶 byJsonId，projA/sub 解析到 projA 的 main。
{
  const tmp = mkdtempSync(join(tmpdir(), 'usage-stats-v0381-'))
  try {
    const profileRoot = join(tmp, 'profile')
    const home = join(tmp, 'home')
    const sessionsRoot = join(home, 'sessions')
    mkdirSync(profileRoot, { recursive: true })
    mkdirSync(sessionsRoot, { recursive: true })

    // projA: main (id='sameid', parentSession=null) + subagent (id='sub-a', parentSession='sameid')
    const projA = join(sessionsRoot, 'projA')
    mkdirSync(join(projA, 'session-main'), { recursive: true })
    writeFileSync(
      join(projA, 'session-main', 'session.jsonl'),
      JSON.stringify({ type: 'session', id: 'sameid', cwd: 'projA', createdAt: 1700000000000, agentPreset: 'p' }) + '\n' +
      JSON.stringify({ type: 'assistant/message', data: { usage: { inputTokens: 10, outputTokens: 5 } }, time: 1700000001000 }) + '\n',
      'utf8'
    )
    mkdirSync(join(projA, 'session-sub'), { recursive: true })
    writeFileSync(
      join(projA, 'session-sub', 'session.jsonl'),
      JSON.stringify({ type: 'session', id: 'sub-a', parentSession: 'sameid', cwd: 'projA', createdAt: 1700000002000, agentPreset: 'p' }) + '\n' +
      JSON.stringify({ type: 'assistant/message', data: { usage: { inputTokens: 100, outputTokens: 50 } }, time: 1700000003000 }) + '\n',
      'utf8'
    )

    // projB: main (id='sameid' — 与 projA/main 同名 JSONL id by DSH 设计) + 独立
    const projB = join(sessionsRoot, 'projB')
    mkdirSync(join(projB, 'session-main'), { recursive: true })
    writeFileSync(
      join(projB, 'session-main', 'session.jsonl'),
      JSON.stringify({ type: 'session', id: 'sameid', cwd: 'projB', createdAt: 1700000004000, agentPreset: 'p' }) + '\n' +
      JSON.stringify({ type: 'assistant/message', data: { usage: { inputTokens: 7, outputTokens: 3 } }, time: 1700000005000 }) + '\n',
      'utf8'
    )

    process.env.DSH_HOME = home
    const { apply } = await import('../lib/index.js')
    const registered = []
    const ctx = {
      baseUrl: pathToFileURL(profileRoot) + '/',
      webServer: { register(spec) { registered.push(spec) } },
    }
    apply(ctx)
    const summaryHandler = registered.find((r) => r.path === '/api/usage-stats/summary').handler
    function call(url) {
      return new Promise((resolve) => {
        const res = {
          writeHead(s, h) { this.status = s; this.headers = h },
          end(body) { resolve(JSON.parse(body)) },
        }
        summaryHandler({ method: 'GET', url }, res)
      })
    }

    const p1 = await call('/api/usage-stats/summary')
    const topA = p1.topSessions.find(t => t.cwd === 'projA')
    const topB = p1.topSessions.find(t => t.cwd === 'projB')
    assert(
      'E.1: 跨项目同名 JSONL id 子代理不被错归（projA 拥有自己的 main + sub）',
      topA && topA.requests === 2 && topA.outputTokens === 55 && topA.tokens === 165,
      `topA = ${JSON.stringify(topA)}`
    )
    assert(
      'E.1: 跨项目同名 JSONL id 子代理不被错归（projB 只拥有自己的 main）',
      topB && topB.requests === 1 && topB.outputTokens === 3 && topB.tokens === 10,
      `topB = ${JSON.stringify(topB)}`
    )
    assert(
      'E.1: rawSessionCount = 3（3 个真 session 文件），sessionCount = 2（2 个 root）',
      p1.rawSessionCount === 3 && p1.sessionCount === 2,
      `rawSessionCount=${p1.rawSessionCount}, sessionCount=${p1.sessionCount}`
    )
  } finally {
    delete process.env.DSH_HOME
    rmSync(tmp, { recursive: true, force: true })
  }
}

/* ------------------------------------------------------------------ *
 * bug F: cached.agg "usable" 契约 + 内部防御（v0.3.8.1）
 * ------------------------------------------------------------------ */

// F.1 cached.agg 缺 totals（partial / 手编辑）→ 视为 miss 触发重解码（不崩溃）
{
  const tmp = mkdtempSync(join(tmpdir(), 'usage-stats-v0381-'))
  try {
    const profileRoot = join(tmp, 'profile')
    const home = join(tmp, 'home')
    const sessionsRoot = join(home, 'sessions')
    mkdirSync(profileRoot, { recursive: true })
    mkdirSync(sessionsRoot, { recursive: true })

    const projDir = join(sessionsRoot, 'projA')
    mkdirSync(join(projDir, 'session-x'), { recursive: true })
    const sessionPath = join(projDir, 'session-x', 'session.jsonl')
    writeFileSync(
      sessionPath,
      JSON.stringify({ type: 'session', id: 'x', cwd: 'projA', createdAt: 1700000000000, agentPreset: 'p' }) + '\n' +
      JSON.stringify({ type: 'assistant/message', data: { usage: { inputTokens: 1, outputTokens: 1 } }, time: 1700000001000 }) + '\n',
      'utf8'
    )

    // 写 partial cache（cached.agg 有 id/fileId 但 totals 缺失）
    const st = statSync(sessionPath)
    writeFileSync(
      join(profileRoot, '.usage-stats-cache.json'),
      JSON.stringify({
        version: 6,
        sessions: {
          'projA/session-x': {
            size: st.size,
            mtimeMs: st.mtimeMs,
            agg: {
              id: 'x',
              fileId: 'projA/session-x',
              cwd: 'projA',
              createdAt: 1700000000000,
              parentSession: null,
              delegationDepth: 0,
              lastTs: 1700000001000,
              models: {}, days: {}, hours: {}, minutes: {},
              tools: {},
              // totals: OMITTED — 模拟手编辑 / 半写入 / schema drift
              steps: 0, turns: 0, llmMs: 0, toolMs: 0,
            },
          },
        },
      }),
      'utf8'
    )

    process.env.DSH_HOME = home
    const { apply } = await import('../lib/index.js')
    const registered = []
    const ctx = {
      baseUrl: pathToFileURL(profileRoot) + '/',
      webServer: { register(spec) { registered.push(spec) } },
    }
    apply(ctx)
    const summaryHandler = registered.find((r) => r.path === '/api/usage-stats/summary').handler
    function call(url) {
      return new Promise((resolve) => {
        const res = {
          writeHead(s, h) { this.status = s; this.headers = h },
          end(body) { resolve(JSON.parse(body)) },
        }
        summaryHandler({ method: 'GET', url }, res)
      })
    }

    const p1 = await call('/api/usage-stats/summary')
    assert(
      'F.1: cached.agg 缺 totals → 视为 miss 重解码（不崩溃）',
      p1.ok === true && p1.decoded === 1 && p1.reused === 0,
      `ok=${p1.ok}, decoded=${p1.decoded}, reused=${p1.reused}, errors=${JSON.stringify(p1.errors)}`
    )
    assert(
      'F.1: 重解码后 totals 真实数据出现（inputTokens=1, outputTokens=1）',
      p1.totals.inputTokens === 1 && p1.totals.outputTokens === 1,
      `totals = ${JSON.stringify(p1.totals)}`
    )
  } finally {
    delete process.env.DSH_HOME
    rmSync(tmp, { recursive: true, force: true })
  }
}

// F.2 cached.agg totals 但 token 字段是 NaN → 视为 miss（不只是 typeof === 'object'）
{
  const tmp = mkdtempSync(join(tmpdir(), 'usage-stats-v0381-'))
  try {
    const profileRoot = join(tmp, 'profile')
    const home = join(tmp, 'home')
    const sessionsRoot = join(home, 'sessions')
    mkdirSync(profileRoot, { recursive: true })
    mkdirSync(sessionsRoot, { recursive: true })

    const projDir = join(sessionsRoot, 'projA')
    mkdirSync(join(projDir, 'session-x'), { recursive: true })
    const sessionPath = join(projDir, 'session-x', 'session.jsonl')
    writeFileSync(
      sessionPath,
      JSON.stringify({ type: 'session', id: 'x', cwd: 'projA', createdAt: 1700000000000, agentPreset: 'p' }) + '\n' +
      JSON.stringify({ type: 'assistant/message', data: { usage: { inputTokens: 1, outputTokens: 1 } }, time: 1700000001000 }) + '\n',
      'utf8'
    )

    const st = statSync(sessionPath)
    writeFileSync(
      join(profileRoot, '.usage-stats-cache.json'),
      JSON.stringify({
        version: 6,
        sessions: {
          'projA/session-x': {
            size: st.size,
            mtimeMs: st.mtimeMs,
            agg: {
              id: 'x',
              fileId: 'projA/session-x',
              cwd: 'projA',
              totals: {
                inputTokens: 'NaN_string', // 非有限数字，破坏 bucket
                outputTokens: 0,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
                reasoningTokens: 0,
                requests: 1,
              },
              models: {}, days: {}, hours: {}, minutes: {},
              tools: {},
              steps: 0, turns: 0, llmMs: 0, toolMs: 0,
              lastTs: 1700000001000,
            },
          },
        },
      }),
      'utf8'
    )

    process.env.DSH_HOME = home
    const { apply } = await import('../lib/index.js')
    const registered = []
    const ctx = {
      baseUrl: pathToFileURL(profileRoot) + '/',
      webServer: { register(spec) { registered.push(spec) } },
    }
    apply(ctx)
    const summaryHandler = registered.find((r) => r.path === '/api/usage-stats/summary').handler
    function call(url) {
      return new Promise((resolve) => {
        const res = {
          writeHead(s, h) { this.status = s; this.headers = h },
          end(body) { resolve(JSON.parse(body)) },
        }
        summaryHandler({ method: 'GET', url }, res)
      })
    }

    const p1 = await call('/api/usage-stats/summary')
    assert(
      'F.2: cached.agg totals.inputTokens 非有限 → 视为 miss 重解码',
      p1.ok === true && p1.decoded === 1 && p1.reused === 0,
      `ok=${p1.ok}, decoded=${p1.decoded}, reused=${p1.reused}`
    )
  } finally {
    delete process.env.DSH_HOME
    rmSync(tmp, { recursive: true, force: true })
  }
}

// F.3 cached.agg 完全缺失 identity（无 id 无 fileId）→ 视为 miss
{
  const tmp = mkdtempSync(join(tmpdir(), 'usage-stats-v0381-'))
  try {
    const profileRoot = join(tmp, 'profile')
    const home = join(tmp, 'home')
    const sessionsRoot = join(home, 'sessions')
    mkdirSync(profileRoot, { recursive: true })
    mkdirSync(sessionsRoot, { recursive: true })

    const projDir = join(sessionsRoot, 'projA')
    mkdirSync(join(projDir, 'session-x'), { recursive: true })
    const sessionPath = join(projDir, 'session-x', 'session.jsonl')
    writeFileSync(
      sessionPath,
      JSON.stringify({ type: 'session', id: 'x', cwd: 'projA', createdAt: 1700000000000, agentPreset: 'p' }) + '\n' +
      JSON.stringify({ type: 'assistant/message', data: { usage: { inputTokens: 1, outputTokens: 1 } }, time: 1700000001000 }) + '\n',
      'utf8'
    )

    const st = statSync(sessionPath)
    writeFileSync(
      join(profileRoot, '.usage-stats-cache.json'),
      JSON.stringify({
        version: 6,
        sessions: {
          'projA/session-x': {
            size: st.size,
            mtimeMs: st.mtimeMs,
            agg: {
              // id & fileId 都缺 —— 没 identity，rollup 会跳过但仍占位置
              cwd: 'projA',
              totals: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 0 },
              models: {}, days: {}, hours: {}, minutes: {},
              tools: {},
              steps: 0, turns: 0, llmMs: 0, toolMs: 0,
              lastTs: 1700000001000,
            },
          },
        },
      }),
      'utf8'
    )

    process.env.DSH_HOME = home
    const { apply } = await import('../lib/index.js')
    const registered = []
    const ctx = {
      baseUrl: pathToFileURL(profileRoot) + '/',
      webServer: { register(spec) { registered.push(spec) } },
    }
    apply(ctx)
    const summaryHandler = registered.find((r) => r.path === '/api/usage-stats/summary').handler
    function call(url) {
      return new Promise((resolve) => {
        const res = {
          writeHead(s, h) { this.status = s; this.headers = h },
          end(body) { resolve(JSON.parse(body)) },
        }
        summaryHandler({ method: 'GET', url }, res)
      })
    }

    const p1 = await call('/api/usage-stats/summary')
    assert(
      'F.3: cached.agg 无 identity（id+fileId 都缺）→ 视为 miss 重解码',
      p1.ok === true && p1.decoded === 1 && p1.reused === 0,
      `ok=${p1.ok}, decoded=${p1.decoded}, reused=${p1.reused}`
    )
  } finally {
    delete process.env.DSH_HOME
    rmSync(tmp, { recursive: true, force: true })
  }
}

// F.4 直接验证 rollupByMainSession 对 partial agg 的 defense in depth
// —— 即便绕过 cache guard 直接喂 partial agg 进去，也不应崩溃。
{
  const { aggregateSession, apply } = await import('../lib/index.js')
  // 真实 agg
  const realAgg = aggregateSession([
    { type: 'session', id: 'real', cwd: 'r', createdAt: 1700000000000 },
    { type: 'assistant/message', data: { usage: { inputTokens: 5, outputTokens: 5 } }, time: 1700000001000 },
  ], 'projA/session-real')
  // 伪造 partial agg（id 撞 'real'，但缺 totals/models/days）
  const partialAgg = {
    id: 'real',
    fileId: 'projB/session-x',
    parentSession: null,
    delegationDepth: 0,
    lastTs: null,
    steps: 0,
    turns: 0,
    llmMs: 0,
    toolMs: 0,
    // 缺 totals（partial）
    models: {},
    days: {},
    modelDays: {},
    hours: {},
    modelHours: {},
    minutes: {},
    modelMinutes: {},
    tools: {},
  }
  // rollupByMainSession 未导出，但 buildSummary 内部会调用——这里通过 apply 端到端验证
  // 直接走 apply 端到端：构造只有 partial agg 的 sessions dir + 手写 cache
  const tmp = mkdtempSync(join(tmpdir(), 'usage-stats-v0381-'))
  try {
    const profileRoot = join(tmp, 'profile')
    const home = join(tmp, 'home')
    const sessionsRoot = join(home, 'sessions')
    mkdirSync(profileRoot, { recursive: true })
    mkdirSync(sessionsRoot, { recursive: true })

    const projDir = join(sessionsRoot, 'projA')
    mkdirSync(join(projDir, 'session-real'), { recursive: true })
    const sessionPath = join(projDir, 'session-real', 'session.jsonl')
    writeFileSync(
      sessionPath,
      JSON.stringify({ type: 'session', id: 'real', cwd: 'r', createdAt: 1700000000000 }) + '\n' +
      JSON.stringify({ type: 'assistant/message', data: { usage: { inputTokens: 5, outputTokens: 5 } }, time: 1700000001000 }) + '\n',
      'utf8'
    )

    const st = statSync(sessionPath)
    writeFileSync(
      join(profileRoot, '.usage-stats-cache.json'),
      JSON.stringify({
        version: 6,
        sessions: {
          'projA/session-real': {
            size: st.size,
            mtimeMs: st.mtimeMs,
            agg: partialAgg,
          },
        },
      }),
      'utf8'
    )

    process.env.DSH_HOME = home
    const registered = []
    const ctx = {
      baseUrl: pathToFileURL(profileRoot) + '/',
      webServer: { register(spec) { registered.push(spec) } },
    }
    apply(ctx)
    const summaryHandler = registered.find((r) => r.path === '/api/usage-stats/summary').handler
    function call(url) {
      return new Promise((resolve) => {
        const res = {
          writeHead(s, h) { this.status = s; this.headers = h },
          end(body) { resolve(JSON.parse(body)) },
        }
        summaryHandler({ method: 'GET', url }, res)
      })
    }

    const p1 = await call('/api/usage-stats/summary')
    // partial agg 缺 totals → isUsableAggregate fail → 视为 miss 重解码
    // 真实数据进来后 totals = 5/5
    assert(
      'F.4: cache hit 处的 isUsableAggregate 挡住 partial agg，重解码出真实数据',
      p1.ok === true && p1.decoded === 1 && p1.totals.inputTokens === 5,
      `ok=${p1.ok}, decoded=${p1.decoded}, inputTokens=${p1.totals.inputTokens}`
    )
  } finally {
    delete process.env.DSH_HOME
    rmSync(tmp, { recursive: true, force: true })
  }
}

/* ------------------------------------------------------------------ *
 * 输出
 * ------------------------------------------------------------------ */

let pass = 0
let fail = 0
for (const r of results) {
  if (r.ok) {
    pass++
    console.log('  PASS  ' + r.label)
  } else {
    fail++
    console.log('  FAIL  ' + r.label + ' :: ' + r.detail)
  }
}
console.log(`\n[v038] ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)