// tests/test-all-range.mjs
// v0.3.9 增量回归：RANGES 'all' tab 语义从"近 30 天切片"切到"全程指标 + 图表仍 30 天"——
//   - 50-config.js: 'all'.label = "全部"，'all'.window = null
//   - 70-page.js: r.window=null 时 rangeTotals 走 safeTotals（全程）
//                  但 winSeries 对 'all' key 特殊保留 last-30-day 切片（图表不无限长）
//
// 用法：node tests/test-all-range.mjs
// 期望：所有断言 PASS；任一 FAIL 立即 process.exit(1)。

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const results = []
function assert(label, cond, detail) {
  results.push({ label, ok: !!cond, detail })
}

/* ------------------------------------------------------------------ *
 * 1. 静态验证：50-config.js RANGES 'all' 配置正确
 * ------------------------------------------------------------------ */

{
  const src = readFileSync(path.join(ROOT, 'lib/client-src/50-config.js'), 'utf8')
  const allBlock = src.match(/\{ key:\s*"all"[\s\S]{0,200}\}/)
  assert(
    "50-config.js: RANGES 'all' 仍存在",
    allBlock != null,
    'RANGES.all entry 未找到'
  )
  if (allBlock) {
    assert(
      "50-config.js: RANGES 'all'.label === '全部'",
      /label:\s*"全部"/.test(allBlock[0]),
      allBlock[0]
    )
    assert(
      "50-config.js: RANGES 'all'.window === null",
      /window:\s*null/.test(allBlock[0]),
      allBlock[0]
    )
    assert(
      "50-config.js: RANGES 'all'.granularity === 'day'（图表按日粒度）",
      /granularity:\s*"day"/.test(allBlock[0]),
      allBlock[0]
    )
  }

  // 其余 range 不应受影响
  const sevenBlock = src.match(/\{ key:\s*"7"[\s\S]{0,200}\}/)
  assert(
    "50-config.js: RANGES '7' 未受影响（window: 7 保留）",
    sevenBlock != null && /window:\s*7\b/.test(sevenBlock[0]),
    sevenBlock ? sevenBlock[0] : 'RANGES.7 entry 未找到'
  )
  const weekBlock = src.match(/\{ key:\s*"w12"[\s\S]{0,200}\}/)
  assert(
    "50-config.js: RANGES 'w12' 未受影响（window: 12 保留）",
    weekBlock != null && /window:\s*12\b/.test(weekBlock[0]),
    weekBlock ? weekBlock[0] : 'RANGES.w12 entry 未找到'
  )
}

/* ------------------------------------------------------------------ *
 * 2. 静态验证：70-page.js winSeries 切分逻辑 + rangeTotals 走 safeTotals
 * ------------------------------------------------------------------ */

{
  const src = readFileSync(path.join(ROOT, 'lib/client-src/70-page.js'), 'utf8')

  // 'all' tab 在 r.window=null 时仍要 slice(-30)（图表不无限长）
  assert(
    "70-page.js: 'all' tab winSeries 走 slice(-30)（图表仍最近 30 天）",
    /r\.key\s*===\s*"all"[\s\S]{0,200}slice\(-30\)/.test(src),
    '70-page.js all-tab chart 30-day 切片未找到'
  )

  // rangeTotals 仍按 r.window 选：null 时走 safeTotals
  assert(
    "70-page.js: rangeTotals 在 r.window=null 时取 safeTotals（全程指标）",
    /rangeTotals\s*=\s*r\.window\s*!=\s*null\s*\?\s*sumBuckets\([^)]*\)\s*:\s*safeTotals/.test(src),
    '70-page.js rangeTotals 全量逻辑未匹配'
  )
}

/* ------------------------------------------------------------------ *
 * 3. 行为验证：加载 bundle，模拟 React state，调 UsageStatsPage
 *    验证 'all' tab：
 *      - 图表 N=30（即便 byDay 有 60 天）
 *      - '模型请求' 卡片值 === fakeTotals.requests（=60，全程指标）
 * ------------------------------------------------------------------ */

const renderErrors = []
const renderCount = { n: 0 }
function createElement(type, props, ...children) {
  renderCount.n++
  return { __react: true, type, props: props || {}, children }
}

// 构造 60 天 day series（确保 byDay 长度 > 30，让 30 天切片可见）
const fakeByDay = []
for (let i = 0; i < 60; i++) {
  const ms = Date.UTC(2026, 7, 18 + i) // 2026-08-18 起 60 天
  const ds = new Date(ms).toISOString().slice(0, 10)
  fakeByDay.push({
    bucket: ds,
    inputTokens: 100 + i,
    outputTokens: 50 + i,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    requests: 1,
  })
}
const fakeTotals = {
  inputTokens: fakeByDay.reduce((s, b) => s + b.inputTokens, 0),
  outputTokens: fakeByDay.reduce((s, b) => s + b.outputTokens, 0),
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
  requests: fakeByDay.length, // = 60
}
const fakePayload = {
  ok: true,
  home: '/mock',
  sessionCount: 1,
  rawSessionCount: 1,
  turns: 1,
  decoded: 1,
  reused: 0,
  durationMs: 1,
  generatedAt: Date.now(),
  errors: [],
  totals: fakeTotals,
  steps: 0,
  llmMs: 0,
  byDay: fakeByDay,
  byTrend: { day: fakeByDay, hour: [], minute: [], week: [] },
  byModel: [],
  topSessions: [],
  tools: []
}

// mock React.useState 按调用顺序喂入预设状态，避开"loading/d=null 早返"路径
// UsageStatsPage 顶层 useState 顺序：loading / data / error / range / visibility / panelOpen / heatmapModel
let useStateIndex = 0
const useStateInitial = [
  false,           // loading
  fakePayload,     // data
  null,            // error
  'all',           // range  ← 测试 'all' tab
  { meta: true, cards: true, chart: true, heatmap: false, byModel: true, topSessions: true, tools: true },
  false,           // panelOpen
  null,            // heatmapModel
]
const React = {
  useState(init) {
    const i = useStateIndex++
    const v = i < useStateInitial.length ? useStateInitial[i] : init
    return [v, () => {}]
  },
  useEffect() {},
  useCallback(fn) { return fn },
  createElement
}

globalThis.fetch = () => Promise.resolve({ json: () => Promise.resolve(fakePayload) })
globalThis.localStorage = {
  _s: {},
  setItem(k, v) { this._s[k] = String(v) },
  getItem(k) { return this._s[k] },
  removeItem(k) { delete this._s[k] }
}
globalThis.document = {
  createElement: () => ({}),
  head: { appendChild: () => {} },
  querySelector: () => null,
  addEventListener: () => {},
  removeEventListener: () => {}
}

const loadedModules = []
globalThis.window = {
  __ModuleLoader__: {
    load(spec) {
      const fakeRequire = (id) => {
        if (id === 'react') return React
        throw new Error('mock require fail: ' + id)
      }
      try {
        const mod = spec.factory(fakeRequire)
        loadedModules.push({ spec, mod })
        return mod
      } catch (e) {
        renderErrors.push('load failed: ' + e.message)
        return null
      }
    }
  }
}
globalThis.console = console

const code = readFileSync(path.join(ROOT, 'lib/client.js'), 'utf8')
eval(code)

assert(
  "client.js 加载成功（解析所有 source files）",
  loadedModules.length === 1 && renderErrors.length === 0,
  renderErrors.length > 0 ? renderErrors.join(' | ') : `loaded ${loadedModules.length}`
)

if (loadedModules.length === 1) {
  // 走 apply → slot.inject → slot.register(UsageStatsPage)
  let capturedPage = null
  const ctx = {
    slots: {
      inject(slot, fn) {
        try { fn() } catch (e) { renderErrors.push('inject failed: ' + e.message + '\n' + (e.stack || '')) }
      },
      register(spec, comp) {
        capturedPage = comp
        return comp
      }
    }
  }
  try {
    loadedModules[0].mod.apply(ctx)
  } catch (e) {
    renderErrors.push('apply threw: ' + e.message)
  }

  let pageTree = null
  try {
    pageTree = capturedPage({})
  } catch (e) {
    renderErrors.push('page render threw: ' + e.message + '\n' + (e.stack || ''))
  }

  // walk React tree（含 sectionNodes.map 返回的数组节点）
  function* iterChildren(node) {
    if (Array.isArray(node)) {
      for (const c of node) yield* iterChildren(c)
      return
    }
    if (node != null && typeof node === 'object') {
      yield node
      if (Array.isArray(node.children)) {
        for (const c of node.children) yield* iterChildren(c)
      }
    }
  }

  function findChartBucketCount(node) {
    for (const n of iterChildren(node)) {
      if (n.type === 'span' && Array.isArray(n.children) && n.children.length >= 1) {
        const text = n.children[0]
        if (typeof text === 'string') {
          // 中文环境下 \b 不匹配（中文字符对 JS regex 是 \W），去掉 \b
          const m = text.match(/·\s*(\d+)\s*桶/)
          if (m) return parseInt(m[1], 10)
        }
      }
    }
    return null
  }

  function findModelRequestCardValue(node) {
    for (const n of iterChildren(node)) {
      if (n.type === 'div' && Array.isArray(n.children) && n.children.length >= 2) {
        const labelNode = n.children[0]
        const valueNode = n.children[1]
        if (
          labelNode && labelNode.type === 'div' &&
          Array.isArray(labelNode.children) && labelNode.children[0] === '模型请求'
        ) {
          if (valueNode && valueNode.type === 'div' && Array.isArray(valueNode.children)) {
            return valueNode.children[0]
          }
        }
      }
    }
    return null
  }

  function findTabButtons(node) {
    const out = []
    for (const n of iterChildren(node)) {
      if (n.type === 'button' && Array.isArray(n.children) && n.children.length === 1) {
        const t = n.children[0]
        if (typeof t === 'string') out.push(t)
      }
    }
    return out
  }

  const chartN = pageTree ? findChartBucketCount(pageTree) : null
  const modelRequestVal = pageTree ? findModelRequestCardValue(pageTree) : null
  const tabs = pageTree ? findTabButtons(pageTree) : []

  assert(
    "UsageStatsPage 'all' tab: 图表 N=30（即便 byDay 有 60 天）",
    chartN === 30,
    chartN === null ? '未找到 chartLegendHint "· N 桶"' : `N=${chartN}`
  )

  assert(
    "UsageStatsPage 'all' tab: '模型请求' 卡显示 fakeTotals.requests（=60，全程）",
    modelRequestVal === String(fakeTotals.requests),
    modelRequestVal == null
      ? '未找到 Card "模型请求"'
      : `got=${JSON.stringify(modelRequestVal)}, expected=${JSON.stringify(String(fakeTotals.requests))}`
  )

  assert(
    "UsageStatsPage 'all' tab: range tab 显示 '全部' label",
    tabs.indexOf('全部') !== -1,
    `tabs=${JSON.stringify(tabs)}`
  )

  // 反向 sanity：range='all' 时 '模型请求' 卡不应带 '· 全部' 后缀（r.window=null 走短路）
  assert(
    "UsageStatsPage 'all' tab: '模型请求' 卡 label 不带 · 全部 后缀（window=null 短路）",
    !tabs.includes('· 全部'),
    '意外发现带 · 后缀的 label'
  )
}

/* ------------------------------------------------------------------ *
 * 4. node --check lib/client.js 语法检查
 * ------------------------------------------------------------------ */

{
  const { execSync } = await import('node:child_process')
  let checkOk = false
  let stderrText = ''
  try {
    execSync(`node --check "${path.join(ROOT, 'lib/client.js').replace(/\\/g, '/')}"`, { stdio: 'pipe' })
    checkOk = true
  } catch (e) {
    stderrText = (e.stderr ? e.stderr.toString() : e.message)
  }
  assert(
    "node --check lib/client.js 语法检查通过",
    checkOk,
    stderrText || 'syntax error'
  )
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
console.log(`\n[all-range] ${pass} passed, ${fail} failed`)
if (renderErrors.length > 0) {
  console.log('\nRender / load errors:')
  for (const e of renderErrors) console.log('  - ' + e)
}
if (fail > 0 || renderErrors.length > 0) process.exit(1)