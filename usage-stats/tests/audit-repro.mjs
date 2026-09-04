// tests/audit-repro.mjs
// 临时审计复现脚本（不进入 npm scripts，audit 完成后删除）。
// 直接 import lib/index.js 的导出函数验证四个 bug：
//   1. cache 在 apply 中从未被 loadCache 加载
//   2. collectSessionFiles 跨项目 session id 冲突
//   3. tool/call 缺 callId 时仍写入 undefined 键
//   4. assistant/message 缺 time 时污染 1970-01-01 桶

import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  aggregateSession,
  beijingDayKey,
  decodeSessionEvents,
  scanZstdFrames,
} from '../lib/index.js'

const results = []
function assert(label, cond, detail) {
  results.push({ label, ok: !!cond, detail })
}

// --- bug 3: tool/call 缺 callId ---
{
  const events = [
    { type: 'tool/call', data: { name: 'foo', callId: undefined }, time: 100 },
    { type: 'tool/call', data: { name: 'bar', callId: undefined }, time: 200 },
    // 配对一个 undefined callId 的 result
    { type: 'tool/result', data: { message: { source: { callId: undefined } } }, time: 250 },
  ]
  const agg = aggregateSession(events)
  const bar = agg.tools.bar
  assert(
    'tool/call 缺 callId：bar.calls 仍计数',
    bar && bar.calls === 1,
    `got ${JSON.stringify(bar)}`
  )
  assert(
    'tool/call 缺 callId：bar.ms = 0（不与 undefined result 误配对）',
    bar && bar.ms === 0,
    `got ${JSON.stringify(bar)}`
  )
  assert(
    'tool/call 缺 callId：toolMs = 0（不累加）',
    agg.toolMs === 0,
    `got ${agg.toolMs}`
  )
}

// --- bug 4: assistant/message 缺 time 污染 1970 ---
{
  const events = [
    { type: 'request/header', data: { header: { config: { provider: 'p', model: 'm' } } }, time: 100 },
    { type: 'assistant/message', data: { usage: { inputTokens: 10, outputTokens: 5 } }, time: undefined },
    { type: 'assistant/message', data: { usage: { inputTokens: 20, outputTokens: 10 } }, time: 1700000000000 },
  ]
  const agg = aggregateSession(events)
  assert(
    'assistant/message 缺 time：不写入 1970-01-01 桶',
    !agg.days['1970-01-01'],
    `days keys = ${Object.keys(agg.days).join(',')}`
  )
  assert(
    'assistant/message 缺 time：真实事件仍写入正确桶',
    !!agg.days[beijingDayKey(1700000000000)],
    `days keys = ${Object.keys(agg.days).join(',')}`
  )
  assert(
    'assistant/message 缺 time：不计入 totals',
    agg.totals.inputTokens === 20 && agg.totals.outputTokens === 10,
    `totals = ${JSON.stringify(agg.totals)}`
  )
}

// --- beijingDayKey sanity ---
assert('beijingDayKey(0) -> 1970-01-01', beijingDayKey(0) === '1970-01-01', beijingDayKey(0))

// --- decodeSessionEvents 健壮性 ---
assert(
  'decodeSessionEvents(空 buffer) -> []',
  Array.isArray(decodeSessionEvents(Buffer.from([]))) && decodeSessionEvents(Buffer.from([])).length === 0,
  ''
)

// --- scanZstdFrames 健壮性 ---
assert('scanZstdFrames 存在', typeof scanZstdFrames === 'function', typeof scanZstdFrames)

// --- bug 1+2: 跨项目 session id 冲突 & 缓存加载修复（端到端） ---
// 构造两个项目各自一个同名 session-XXX 文件，跑 apply() → 调 summary handler
// 验证：两个都被发现、cache 第二次 reused、删除一个后 liveIds 修剪生效。
const tmp = mkdtempSync(join(tmpdir(), 'usage-stats-audit-'))
try {
  const profileRoot = join(tmp, 'profile')
  const home = join(tmp, 'home')
  const sessionsRoot = join(home, 'sessions')
  mkdirSync(profileRoot, { recursive: true })
  mkdirSync(sessionsRoot, { recursive: true })

  // write two projects' identical-name session dirs (plain jsonl, no zstd)
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

  // 通过 DSH_HOME 环境变量把 home 指向临时目录
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
    'bug 2 跨项目 session-sameid：两个都被发现（rawSessionCount=2）',
    p1.rawSessionCount === 2,
    `got rawSessionCount=${p1.rawSessionCount}, errors=${JSON.stringify(p1.errors)}`
  )
  assert(
    'bug 2 跨项目 session-sameid：totals.inputTokens=2（无串扰）',
    p1.totals.inputTokens === 2,
    `got inputTokens=${p1.totals.inputTokens}, errors=${JSON.stringify(p1.errors)}`
  )

  const p2 = await call('/api/usage-stats/summary')
  assert(
    'bug 1 缓存加载修复：第二次请求 reused >= 2',
    p2.reused >= 2,
    `got reused=${p2.reused}, decoded=${p2.decoded}`
  )
  assert(
    'bug 1 缓存加载修复：第二次请求 decoded = 0（无新增解码）',
    p2.decoded === 0,
    `got decoded=${p2.decoded}, reused=${p2.reused}`
  )

  // 删除 projB 下的同名 session，按新键格式 liveIds 修剪应能识别
  rmSync(join(sessionsRoot, 'projB', 'session-sameid'), { recursive: true, force: true })
  const p3 = await call('/api/usage-stats/summary?force=1')
  assert(
    'bug 2 缓存键含 project：删除 projB 后 rawSessionCount = 1',
    p3.rawSessionCount === 1,
    `got rawSessionCount=${p3.rawSessionCount}, errors=${JSON.stringify(p3.errors)}`
  )
} finally {
  delete process.env.DSH_HOME
  rmSync(tmp, { recursive: true, force: true })
}

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
console.log(`\n[audit-repro] ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
