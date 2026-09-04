// tests/test-add-usage-harden.mjs
// v0.3.7 数字硬化回归测试：覆盖 addUsage 与所有 event.time 数字入口的
// NaN / Infinity / 字符串 / null / undefined 污染防御。
//
// 触发背景：v0.3.6 的 `usage.X || 0` + `typeof event.time === 'number'` 守卫
// 对 NaN / Infinity 仍有漏洞（typeof NaN === 'number' 返回 true），
// 历史上会让一个 schema drift 字段把 host 端聚合 token / ms 全部污染成 NaN，
// UI 显示 "NaN token" / "NaN ms"。本测试锁定 v0.3.7 的 toFiniteNumber()
// 收敛行为，未来重构若不小心退化会被本测试捕获。

import {
  aggregateSession,
  beijingDayKey,
} from '../lib/index.js'

const results = []
function assert(label, cond, detail) {
  results.push({ label, ok: !!cond, detail })
}

// 方便复用：构造一个可消费的最小事件流（已有 request/header + time 的 message）
function mkMessage(time, usage, turn, step) {
  return {
    type: 'assistant/message',
    data: { usage, message: {}, turn, step },
    time,
  }
}
function mkHeader() {
  return {
    type: 'request/header',
    data: { header: { config: { provider: 'p', model: 'm' } } },
    time: 100,
  }
}

// --- bug A: addUsage NaN 字段 ---
{
  const events = [
    mkHeader(),
    mkMessage(1700000001000, {
      inputTokens: NaN,
      outputTokens: 10,
      cacheReadTokens: NaN,
      cacheWriteTokens: NaN,
      reasoningTokens: NaN,
    }),
  ]
  const agg = aggregateSession(events)
  assert(
    'addUsage: NaN 输入字段 → 0（其他字段保留）',
    agg.totals.inputTokens === 0 &&
      agg.totals.outputTokens === 10 &&
      agg.totals.cacheReadTokens === 0 &&
      agg.totals.cacheWriteTokens === 0 &&
      agg.totals.reasoningTokens === 0 &&
      agg.totals.requests === 1,
    `totals = ${JSON.stringify(agg.totals)}`
  )
  assert(
    'addUsage: NaN 不让 totals 变 NaN',
    !Number.isNaN(agg.totals.inputTokens),
    `inputTokens = ${agg.totals.inputTokens}`
  )
}

// --- bug B: addUsage Infinity 字段 ---
{
  const events = [
    mkHeader(),
    mkMessage(1700000002000, {
      inputTokens: Infinity,
      outputTokens: -Infinity,
      cacheReadTokens: Infinity,
      cacheWriteTokens: -Infinity,
      reasoningTokens: Infinity,
    }),
  ]
  const agg = aggregateSession(events)
  assert(
    'addUsage: Infinity 输入字段 → 0（不让 bucket 变 Infinity）',
    agg.totals.inputTokens === 0 &&
      agg.totals.outputTokens === 0 &&
      agg.totals.cacheReadTokens === 0 &&
      agg.totals.cacheWriteTokens === 0 &&
      agg.totals.reasoningTokens === 0,
    `totals = ${JSON.stringify(agg.totals)}`
  )
  assert(
    'addUsage: Infinity 不让 totals 变 Infinity',
    Number.isFinite(agg.totals.inputTokens) && Number.isFinite(agg.totals.outputTokens),
    `inputTokens = ${agg.totals.inputTokens}, outputTokens = ${agg.totals.outputTokens}`
  )
}

// --- bug C: addUsage 字符串字段（"abc" / "5"） ---
{
  const events = [
    mkHeader(),
    mkMessage(1700000003000, {
      inputTokens: 'abc',
      outputTokens: '5',
      cacheReadTokens: '0',
      cacheWriteTokens: ' ',
      reasoningTokens: '',
    }),
  ]
  const agg = aggregateSession(events)
  assert(
    'addUsage: 字符串字段（非空非数字） → 0（不让 bucket 变 NaN / 误接受 "5"）',
    agg.totals.inputTokens === 0 &&
      agg.totals.outputTokens === 0 &&
      agg.totals.cacheReadTokens === 0 &&
      agg.totals.cacheWriteTokens === 0 &&
      agg.totals.reasoningTokens === 0,
    `totals = ${JSON.stringify(agg.totals)}`
  )
  assert(
    'addUsage: 字符串输入不让 totals 变 NaN',
    !Number.isNaN(agg.totals.inputTokens),
    `inputTokens = ${agg.totals.inputTokens}`
  )
}

// --- bug D: addUsage null / undefined / 对象 / 数组 ---
{
  const events = [
    mkHeader(),
    mkMessage(1700000004000, {
      inputTokens: null,
      outputTokens: undefined,
      cacheReadTokens: {},
      cacheWriteTokens: [],
      reasoningTokens: true,
    }),
  ]
  const agg = aggregateSession(events)
  assert(
    'addUsage: null/undefined/object/array/boolean → 0',
    agg.totals.inputTokens === 0 &&
      agg.totals.outputTokens === 0 &&
      agg.totals.cacheReadTokens === 0 &&
      agg.totals.cacheWriteTokens === 0 &&
      agg.totals.reasoningTokens === 0,
    `totals = ${JSON.stringify(agg.totals)}`
  )
}

// --- bug E: assistant/message event.time = NaN / Infinity 不污染时间桶 ---
{
  const events = [
    mkHeader(),
    mkMessage(NaN, { inputTokens: 100, outputTokens: 50 }),
    mkMessage(Infinity, { inputTokens: 200, outputTokens: 100 }),
    mkMessage(-Infinity, { inputTokens: 300, outputTokens: 150 }),
    // 正常事件作为锚点
    mkMessage(1700000005000, { inputTokens: 5, outputTokens: 5 }),
  ]
  const agg = aggregateSession(events)
  assert(
    'assistant/message: time=NaN/Infinity/-Infinity 不写入 days 桶',
    Object.keys(agg.days).filter((k) => k === 'Invalid Da' || k === 'Invalid Date').length === 0,
    `days keys = ${JSON.stringify(Object.keys(agg.days))}`
  )
  assert(
    'assistant/message: time=NaN/Infinity/-Infinity 不写入 hours 桶',
    Object.keys(agg.hours).filter((k) => k.startsWith('Invalid')).length === 0,
    `hours keys = ${JSON.stringify(Object.keys(agg.hours))}`
  )
  assert(
    'assistant/message: time=NaN/Infinity/-Infinity 不写入 minutes 桶',
    Object.keys(agg.minutes).filter((k) => k.startsWith('Invalid')).length === 0,
    `minutes keys = ${JSON.stringify(Object.keys(agg.minutes))}`
  )
  assert(
    'assistant/message: time=NaN/Infinity/-Infinity 不进 totals',
    agg.totals.inputTokens === 5 && agg.totals.outputTokens === 5,
    `totals = ${JSON.stringify(agg.totals)}`
  )
  assert(
    'assistant/message: 真实事件仍写入正确日桶',
    !!agg.days[beijingDayKey(1700000005000)],
    `days keys = ${JSON.stringify(Object.keys(agg.days))}`
  )
  assert(
    'assistant/message: totals.requests 只计真实事件',
    agg.totals.requests === 1,
    `requests = ${agg.totals.requests}`
  )
}

// --- bug F: assistant/message time=NaN 不污染 llmMs ---
{
  const events = [
    { type: 'step/start', data: { turn: 1, step: 1 }, time: 1000 },
    mkMessage(NaN, { inputTokens: 5, outputTokens: 5 }, 1, 1), // 配对上一步（time=NaN）
    // 真实事件作为对照组
    { type: 'step/start', data: { turn: 2, step: 1 }, time: 2000 },
    mkMessage(2500, { inputTokens: 5, outputTokens: 5 }, 2, 1),
  ]
  const agg = aggregateSession(events)
  assert(
    'llmMs: time=NaN 配对不产生 NaN 增量（Math.max(0, NaN) 路径）',
    !Number.isNaN(agg.llmMs),
    `llmMs = ${agg.llmMs}`
  )
  assert(
    'llmMs: 第二步 2000 → 2500 = 500ms 累加；第一步 1000 → NaN（=0）= 0ms',
    agg.llmMs === 500,
    `llmMs = ${agg.llmMs}`
  )
}

// --- bug G: tool/call event.time = NaN 不污染 toolMs / 工具 ms ---
{
  const events = [
    {
      type: 'tool/call',
      data: { name: 'foo', callId: 'c1' },
      time: NaN,
    },
    {
      type: 'tool/result',
      data: { message: { source: { callId: 'c1' } } },
      time: 2500,
    },
    // 对照组：正常配对
    {
      type: 'tool/call',
      data: { name: 'bar', callId: 'c2' },
      time: 3000,
    },
    {
      type: 'tool/result',
      data: { message: { source: { callId: 'c2' } } },
      time: 3500,
    },
  ]
  const agg = aggregateSession(events)
  assert(
    'tool/call time=NaN：callName 仍记住 foo（避免误配对到 c2）',
    agg.tools.foo && agg.tools.foo.calls === 1,
    `foo = ${JSON.stringify(agg.tools.foo)}`
  )
  assert(
    'tool/call time=NaN：foo.ms 不被污染成 NaN（pendingCalls 不收 NaN）',
    !Number.isNaN(agg.tools.foo.ms),
    `foo.ms = ${agg.tools.foo.ms}`
  )
  assert(
    'tool/call time=NaN：toolMs 不被污染成 NaN',
    !Number.isNaN(agg.toolMs),
    `toolMs = ${agg.toolMs}`
  )
  assert(
    'tool/call time=NaN：bar.ms = 500ms（对照组）',
    agg.tools.bar && agg.tools.bar.ms === 500,
    `bar = ${JSON.stringify(agg.tools.bar)}`
  )
  assert(
    'tool/call time=NaN：toolMs = 500ms（仅 bar 贡献）',
    agg.toolMs === 500,
    `toolMs = ${agg.toolMs}`
  )
}

// --- bug H: tool/result event.time = NaN 不污染 toolMs ---
{
  const events = [
    { type: 'tool/call', data: { name: 'foo', callId: 'c1' }, time: 3000 },
    { type: 'tool/result', data: { message: { source: { callId: 'c1' } } }, time: NaN },
  ]
  const agg = aggregateSession(events)
  assert(
    'tool/result time=NaN：elapsed 不变 NaN',
    !Number.isNaN(agg.tools.foo.ms),
    `foo.ms = ${agg.tools.foo.ms}`
  )
  assert(
    'tool/result time=NaN：elapsed = 0（toFiniteNumber 兜底）',
    agg.tools.foo.ms === 0,
    `foo.ms = ${agg.tools.foo.ms}`
  )
  assert(
    'tool/result time=NaN：toolMs = 0',
    agg.toolMs === 0,
    `toolMs = ${agg.toolMs}`
  )
}

// --- bug I: tool/call event.time = Infinity 不进 pendingCalls ---
{
  const events = [
    { type: 'tool/call', data: { name: 'foo', callId: 'c1' }, time: Infinity },
    { type: 'tool/result', data: { message: { source: { callId: 'c1' } } }, time: 3500 },
  ]
  const agg = aggregateSession(events)
  assert(
    'tool/call time=Infinity：pendingCalls 不收，foo.calls 仍 = 1',
    agg.tools.foo && agg.tools.foo.calls === 1,
    `foo = ${JSON.stringify(agg.tools.foo)}`
  )
  assert(
    'tool/call time=Infinity：foo.ms = 0（不与 elapsed 计算产生 Infinity）',
    !Number.isNaN(agg.tools.foo.ms) && agg.tools.foo.ms === 0,
    `foo.ms = ${agg.tools.foo.ms}`
  )
}

// --- bug J: step/start event.time = NaN 不污染 llmMs ---
{
  const events = [
    { type: 'step/start', data: { turn: 1, step: 1 }, time: NaN },
    mkMessage(1700000006000, { inputTokens: 1, outputTokens: 1 }, 1, 1),
  ]
  const agg = aggregateSession(events)
  assert(
    'step/start time=NaN：openStep.time 收敛为 0，llmMs = event.time - 0 = finite',
    !Number.isNaN(agg.llmMs) && agg.llmMs >= 0,
    `llmMs = ${agg.llmMs}`
  )
}

// --- bug K: lastTs 不被 NaN / Infinity 拉高 ---
{
  const events = [
    mkHeader(),
    { type: 'assistant/message', data: { usage: { inputTokens: 1, outputTokens: 1 } }, time: 1700000007000 },
    { type: 'assistant/message', data: { usage: { inputTokens: 1, outputTokens: 1 } }, time: NaN },
    { type: 'assistant/message', data: { usage: { inputTokens: 1, outputTokens: 1 } }, time: Infinity },
  ]
  const agg = aggregateSession(events)
  assert(
    'lastTs：不被 NaN / Infinity 污染成 NaN / Infinity',
    Number.isFinite(agg.lastTs),
    `lastTs = ${agg.lastTs}`
  )
  assert(
    'lastTs：取最大有限时间戳',
    agg.lastTs === 1700000007000,
    `lastTs = ${agg.lastTs}`
  )
}

// --- sanity: 数字合法性保留（不误杀正常数据） ---
{
  const events = [
    mkHeader(),
    mkMessage(1700000008000, { inputTokens: 100, outputTokens: 50, cacheReadTokens: 30, cacheWriteTokens: 10, reasoningTokens: 5 }),
    mkMessage(1700000009000, { inputTokens: -1, outputTokens: 0, cacheReadTokens: 1.5, cacheWriteTokens: -2.5, reasoningTokens: 0.001 }),
  ]
  const agg = aggregateSession(events)
  assert(
    'sanity: 正常数字（含负数 / 浮点 / 零）正确累加',
    agg.totals.inputTokens === 99 &&
      agg.totals.outputTokens === 50 &&
      agg.totals.cacheReadTokens === 31.5 &&
      agg.totals.cacheWriteTokens === 7.5 &&
      agg.totals.reasoningTokens === 5.001,
    `totals = ${JSON.stringify(agg.totals)}`
  )
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
console.log(`\n[harden] ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)