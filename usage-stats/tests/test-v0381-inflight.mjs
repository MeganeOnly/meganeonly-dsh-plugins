// tests/test-v0381-inflight.mjs
// v0.3.8.2 增量：apply 内 `summary(force)` 单 inflight slot bug 修复回归测试。
//
// bug G：原版 `if (inflight !== null) return inflight` 不分 force 标志，
// 启动预热（`summary(false)`）进行中的 `force=1` 请求会被吞——HTTP handler
// 返回 prewarm 的 regular build 结果（cache hit），而不是用户显式要求的
// 强制重算。客户端通过 `?force=1` 显式发起"忽略缓存"语义被静默丢掉。
//
// 修复后 inflight = `{ force, promise }`。规则：
//   - 普通请求（!force）可复用任意 inflight（含 force）
//   - force 请求遇 force inflight → 共享
//   - force 请求遇 regular inflight → 等其结束后再启动一次 force build
//     （多个 force 请求共享同一个 force build）
//
// 关键回归点：force 在 prewarm (regular inflight) 进行中不被吞——cache 文件
// 应被 force 再次写入（chain 串行，prewarm + force = 2 次 saveCache）。
//
// 用法：node tests/test-v0381-inflight.mjs
// 期望：PASS 所有条目；任一 FAIL 立即 process.exit(1)。

import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const results = []
function assert(label, cond, detail) {
  results.push({ label, ok: !!cond, detail })
}

function callHandler(handler, url) {
  return new Promise((resolve) => {
    const res = {
      writeHead(s, h) {
        this.status = s
        this.headers = h
      },
      end(body) {
        resolve(JSON.parse(body))
      },
    }
    handler({ method: 'GET', url }, res)
  })
}

async function pollUntil(predicate, timeoutMs = 5000, intervalMs = 10) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error('poll timed out after ' + timeoutMs + 'ms')
}

/**
 * 统计 cache 文件的 `.tmp` 文件被观察到存在的次数——用于检测 force 触发的
 * 第二次 saveCache。saveCache 内部先 `writeFile(path + '.tmp')` 再 `rename`
 * 到 final path。每个 saveCache 调用期间 `.tmp` 都存在；不调用时不存在。
 *
 * 修复后 chain 上 prewarm + force 各一次 saveCache，`.tmp` 文件至少出现
 * 两次（中间被 rename 抹掉一次再出现）。不修复时只有 prewarm 一次，`.tmp`
 * 严格只出现一次。
 *
 * 用 1ms 轮询 `.tmp` 状态（writeFile → rename 是异步 IO，rename 之前 `.tmp`
 * 存在时间通常 > 1ms）。
 */
async function countTmpFlips(tmpPath, durationMs) {
  const start = Date.now()
  let flips = 0
  let wasPresent = false
  while (Date.now() - start < durationMs) {
    const present = existsSync(tmpPath)
    if (present && !wasPresent) flips += 1
    wasPresent = present
    await new Promise((r) => setTimeout(r, 1))
  }
  return flips
}

function setupFixture(tmpName, files) {
  const tmp = mkdtempSync(join(tmpdir(), tmpName))
  const profileRoot = join(tmp, 'profile')
  const home = join(tmp, 'home')
  const sessionsRoot = join(home, 'sessions')
  mkdirSync(profileRoot, { recursive: true })
  mkdirSync(sessionsRoot, { recursive: true })
  for (const f of files) {
    const projDir = join(sessionsRoot, f.project)
    mkdirSync(join(projDir, f.session), { recursive: true })
    writeFileSync(join(projDir, f.session, 'session.jsonl'), f.content, 'utf8')
  }
  return {
    tmp,
    profileRoot,
    home,
    sessionsRoot,
    cachePath: join(profileRoot, '.usage-stats-cache.json'),
  }
}

async function setupApply(fx) {
  process.env.DSH_HOME = fx.home
  const { apply } = await import('../lib/index.js')
  const registered = []
  const ctx = {
    baseUrl: pathToFileURL(fx.profileRoot) + '/',
    webServer: { register(spec) {
      registered.push(spec)
    } },
  }
  apply(ctx)
  const handler = registered.find((r) => r.path === '/api/usage-stats/summary').handler
  // 让 prewarm microtask 跑起来（cacheReady → buildSummary 排队），但 buildSummary
  // 还在进行中，所以 inflight 已 set；force=1 在下一步同步发起时会撞上 regular inflight。
  await Promise.resolve()
  return { handler }
}

function cleanup(fx) {
  delete process.env.DSH_HOME
  rmSync(fx.tmp, { recursive: true, force: true })
}

/* ------------------------------------------------------------------ *
 * bug G.1: force 请求在 prewarm (regular inflight) 进行中不被吞，
 *          应等待 prewarm 结束后再启动一次 force build
 * ------------------------------------------------------------------ */

// G.1 chain 上至少 2 次 saveCache（prewarm + force 各一次）
// 不修复时 force 复用 prewarm 的 inflight，链上只有 prewarm 的 saveCache。
// 用 .tmp 文件作为客观信号：saveCache 内部 `writeFile(.tmp)` → `rename(.tmp → final)`
// 两次 IO 之间 .tmp 必须出现一次；两次 saveCache 调用之间 .tmp 必须消失一次。
//
// 延迟 fixture：用多个 session 文件让 prewarm / force 各多花时间统计与读取，
// 让两个 saveCache 之间有可观察的间隔（避免 sub-ms 内 .tmp 翻转窗口被错过）。
{
  // 30 个 session 文件让 prewarm 与 force 各 ~30 个 stat + readFile，给两个
  // saveCache 之间留出 ms 级别的窗口。
  const files = []
  for (let i = 0; i < 30; i++) {
    files.push({
      project: 'projA',
      session: 'session-' + String(i).padStart(2, '0'),
      content:
        JSON.stringify({
          type: 'session',
          id: 'session-' + i,
          cwd: 'projA',
          createdAt: 1700000000000 + i * 1000,
          agentPreset: 'p',
        }) +
        '\n' +
        JSON.stringify({
          type: 'assistant/message',
          data: { usage: { inputTokens: 1, outputTokens: 1 } },
          time: 1700000001000 + i * 1000,
        }) +
        '\n',
    })
  }
  const fx = setupFixture('usage-stats-v0381-inflight-', files)
  try {
    const { handler } = await setupApply(fx)

    // 同步发起 force=1，希望它撞上正在跑的 prewarm（regular inflight）。
    const forcePromise = callHandler(handler, '/api/usage-stats/summary?force=1')

    // 持续观察 `.tmp` 文件被创建的次数（1ms 轮询）。force 修复后 chain 上
    // prewarm + force 各一次 saveCache，`.tmp` 至少被观察到 2 次出现；
    // 不修复时只有 prewarm 的 saveCache，`.tmp` 严格只出现 1 次。
    const tmpPath = fx.cachePath + '.tmp'
    const tmpFlips = await countTmpFlips(tmpPath, 1500)

    // 等 force promise 收尾（force 的 buildSummary + saveCache2 已 flush）
    const forceResult = await forcePromise

    // 副断言 = force result 是 ok 状态
    assert(
      'G.1: force result ok=true',
      forceResult.ok === true,
      `forceResult.ok=${forceResult.ok}`,
    )
    // 副断言 = force 真触发新 buildSummary（30 个 session 全被 force 重新解码）
    assert(
      'G.1: force result decoded=30（force 真触发新 buildSummary，bypass cache）',
      forceResult.decoded === 30 && forceResult.reused === 0,
      `decoded=${forceResult.decoded}, reused=${forceResult.reused}`,
    )

    // 主断言 = force 触发了独立的 force build（chain 上至少 2 个 saveCache）。
    assert(
      'G.1: force 在 prewarm 进行中不被吞（chain 上至少 2 次 saveCache）',
      tmpFlips >= 2,
      `tmpFlips=${tmpFlips}（observed .tmp file appearances），expected ≥2 (prewarm + force 各写一次)`,
    )
  } finally {
    cleanup(fx)
  }
}

/* ------------------------------------------------------------------ *
 * bug G.2: 多个并发 force=1 请求共享同一次 force build
 * ------------------------------------------------------------------ */

// G.2 两个并发 force=1 应返回同一 force build（generatedAt 相同、decoded=1）
{
  const fx = setupFixture('usage-stats-v0381-inflight-', [
    {
      project: 'projA',
      session: 'session-x',
      content:
        JSON.stringify({
          type: 'session',
          id: 'x',
          cwd: 'projA',
          createdAt: 1700000000000,
          agentPreset: 'p',
        }) +
        '\n' +
        JSON.stringify({
          type: 'assistant/message',
          data: { usage: { inputTokens: 5, outputTokens: 5 } },
          time: 1700000001000,
        }) +
        '\n',
    },
  ])
  try {
    const { handler } = await setupApply(fx)
    // 先一次普通请求，让 prewarm 收尾，避免和 inflight 路径耦合
    await callHandler(handler, '/api/usage-stats/summary')

    // 现在 inflight=null。两个并发 force=1
    const p1 = callHandler(handler, '/api/usage-stats/summary?force=1')
    const p2 = callHandler(handler, '/api/usage-stats/summary?force=1')
    const [r1, r2] = await Promise.all([p1, p2])

    assert(
      'G.2: 两个并发 force=1 共享同一 force build（generatedAt 相同）',
      r1.generatedAt === r2.generatedAt,
      `r1.generatedAt=${r1.generatedAt}, r2.generatedAt=${r2.generatedAt}`,
    )
    assert(
      'G.2: 两个并发 force=1 都是 force 结果（decoded=1）',
      r1.decoded === 1 && r2.decoded === 1,
      `r1.decoded=${r1.decoded}, r2.decoded=${r2.decoded}`,
    )
  } finally {
    cleanup(fx)
  }
}

/* ------------------------------------------------------------------ *
 * bug G.3: 普通请求在 force inflight 进行中复用 force 结果
 * ------------------------------------------------------------------ */

// G.3 force inflight 进行中发起的普通请求应复用 force inflight（拿到 force 结果）
{
  const fx = setupFixture('usage-stats-v0381-inflight-', [
    {
      project: 'projA',
      session: 'session-x',
      content:
        JSON.stringify({
          type: 'session',
          id: 'x',
          cwd: 'projA',
          createdAt: 1700000000000,
          agentPreset: 'p',
        }) +
        '\n' +
        JSON.stringify({
          type: 'assistant/message',
          data: { usage: { inputTokens: 7, outputTokens: 7 } },
          time: 1700000001000,
        }) +
        '\n',
    },
  ])
  try {
    const { handler } = await setupApply(fx)
    // 先一次普通请求，让 prewarm 收尾
    await callHandler(handler, '/api/usage-stats/summary')

    // 现在 cache 已 populated。force=1（force bypass cache）+ 普通 同时发
    const forcePromise = callHandler(handler, '/api/usage-stats/summary?force=1')
    const regularPromise = callHandler(handler, '/api/usage-stats/summary')
    const [forceR, regularR] = await Promise.all([forcePromise, regularPromise])

    assert(
      'G.3: 普通请求在 force inflight 进行中复用 force 结果（generatedAt 相同）',
      forceR.generatedAt === regularR.generatedAt,
      `forceR.generatedAt=${forceR.generatedAt}, regularR.generatedAt=${regularR.generatedAt}`,
    )
    assert(
      'G.3: 普通请求拿到的是 force 结果（decoded=1，不是 reused=1）',
      regularR.decoded === 1 && regularR.reused === 0,
      `regularR.decoded=${regularR.decoded}, regularR.reused=${regularR.reused}`,
    )
  } finally {
    cleanup(fx)
  }
}

/* ------------------------------------------------------------------ *
 * bug G.4: 现有 D.4 行为（force=1 强制重解码）保持不变
 * ------------------------------------------------------------------ */

// G.4 force=1 单调用仍能强制重解码（即使缓存匹配）；regression 用
{
  const fx = setupFixture('usage-stats-v0381-inflight-', [
    {
      project: 'projA',
      session: 'session-x',
      content:
        JSON.stringify({
          type: 'session',
          id: 'x',
          cwd: 'projA',
          createdAt: 1700000000000,
          agentPreset: 'p',
        }) +
        '\n' +
        JSON.stringify({
          type: 'assistant/message',
          data: { usage: { inputTokens: 3, outputTokens: 3 } },
          time: 1700000001000,
        }) +
        '\n',
    },
  ])
  try {
    const { handler } = await setupApply(fx)

    // 第一次：cache 写入（prewarm 已经做了一次，再 await handler 触发第二次——保险起见不依赖 prewarm）
    const p1 = await callHandler(handler, '/api/usage-stats/summary')
    assert(
      'G.4: 首次无 force → decoded=1（cache miss）',
      p1.decoded === 1 && p1.reused === 0,
      `decoded=${p1.decoded}, reused=${p1.reused}`,
    )

    // 第二次：无 force → cache hit
    const p2 = await callHandler(handler, '/api/usage-stats/summary')
    assert(
      'G.4: 第二次无 force → reused=1（cache hit）',
      p2.decoded === 0 && p2.reused === 1,
      `decoded=${p2.decoded}, reused=${p2.reused}`,
    )

    // 第三次：force=1 → 强制重解码
    const p3 = await callHandler(handler, '/api/usage-stats/summary?force=1')
    assert(
      'G.4: force=1 → decoded=1（强制重解码）',
      p3.decoded === 1 && p3.reused === 0,
      `decoded=${p3.decoded}, reused=${p3.reused}`,
    )
  } finally {
    cleanup(fx)
  }
}

/* ------------------------------------------------------------------ *
 * bug G.5: 串行 force 调用每次都新建 build（inflight 正确清理）
 * ------------------------------------------------------------------ */

// G.5 三次串行 force=1：每次都独立 buildSummary，generatedAt 严格递增（regression）
{
  const fx = setupFixture('usage-stats-v0381-inflight-', [
    {
      project: 'projA',
      session: 'session-x',
      content:
        JSON.stringify({
          type: 'session',
          id: 'x',
          cwd: 'projA',
          createdAt: 1700000000000,
          agentPreset: 'p',
        }) +
        '\n' +
        JSON.stringify({
          type: 'assistant/message',
          data: { usage: { inputTokens: 11, outputTokens: 11 } },
          time: 1700000001000,
        }) +
        '\n',
    },
  ])
  try {
    const { handler } = await setupApply(fx)

    // 第一次 force 之前先一次普通（让 prewarm 收尾，避免和 inflight 耦合）
    await callHandler(handler, '/api/usage-stats/summary')

    const r1 = await callHandler(handler, '/api/usage-stats/summary?force=1')
    const r2 = await callHandler(handler, '/api/usage-stats/summary?force=1')
    const r3 = await callHandler(handler, '/api/usage-stats/summary?force=1')

    assert(
      'G.5: 三次串行 force=1，每次都 decoded=1（inflight 已清空）',
      r1.decoded === 1 && r2.decoded === 1 && r3.decoded === 1,
      `r1.decoded=${r1.decoded}, r2.decoded=${r2.decoded}, r3.decoded=${r3.decoded}`,
    )
    assert(
      'G.5: 三次 force 的 generatedAt 严格递增（每次都是新 build）',
      r1.generatedAt < r2.generatedAt && r2.generatedAt < r3.generatedAt,
      `r1=${r1.generatedAt}, r2=${r2.generatedAt}, r3=${r3.generatedAt}`,
    )
  } finally {
    cleanup(fx)
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
console.log(`\n[v0381-inflight] ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)