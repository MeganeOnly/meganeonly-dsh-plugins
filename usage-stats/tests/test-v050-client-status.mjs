// tests/test-v050-client-status.mjs
// v0.5.0 步骤 8：客户端扫描状态 / 轮询 / 按钮语义的渲染测试。
//
// host 半段现在"永远立即返回已发布快照"，因此客户端必须能把三种状态讲清楚：
//   1. scanning  —— 后台重算中（进度条 + done/total）
//   2. legacy    —— 当前展示旧缓存占位，等待重算完成
//   3. idle      —— 数据已是最新（+ 数据截至时间；有失败时切警示配色）
// 另外：轮询（scanning/legacy 时 2s 后再拉）、按钮语义（刷新=force、全量重算=rebuild）、
// 元信息行不再引用已被 host 移除的 d.home。
//
// 用法：node tests/test-v050-client-status.mjs
// 期望：PASS 所有条目；任一 FAIL 立即 process.exit(1)。

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLIENT_PATH = path.resolve(__dirname, '..', 'lib', 'client.js')

const results = []
function assert(label, cond, detail) {
  results.push({ label, ok: !!cond, detail })
  if (!cond) console.error(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`)
}

const renderErrors = []

/** 捕获 bundle 内部排期的定时器（轮询断言用）。 */
let activeHarness = null
globalThis.setTimeout = (fn, ms) => {
  if (activeHarness != null) activeHarness.timers.push({ fn, ms })
  return activeHarness != null ? activeHarness.timers.length : 0
}
globalThis.clearTimeout = () => {}

function newHarness() {
  return { effects: [], refs: [], timers: [] }
}

function createElement(type, props, ...children) {
  return { __react: true, type, props: props || {}, children }
}

/** 装载 bundle 并返回 UsageStatsPage（每次装载都用全新的 React mock 与模块缓存）。 */
function loadPage(preset, harness) {
  activeHarness = harness
  let useStateIndex = 0
  const React = {
    useState(init) {
      const i = useStateIndex++
      return [i < preset.length ? preset[i] : init, () => {}]
    },
    useEffect(fn) { harness.effects.push(fn) },
    useCallback(fn) { return fn },
    useRef(init) { const ref = { current: init }; harness.refs.push(ref); return ref },
    createElement
  }
  const loaded = []
  globalThis.window = {
    __ModuleLoader__: {
      load(spec) {
        const mod = spec.factory((id) => {
          if (id === 'react') return React
          throw new Error('mock require fail: ' + id)
        })
        loaded.push(mod)
        return mod
      }
    }
  }
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
  // 每次装载都重新 eval，拿到独立的模块实例（bundle 只有一份，靠 state 索引区分渲染）
  const code = readFileSync(CLIENT_PATH, 'utf8')
  eval(code)
  if (loaded.length !== 1) throw new Error('bundle 未加载')
  let page = null
  loaded[0].apply({
    slots: {
      inject(slot, fn) { fn() },
      register(spec, comp) { page = comp; return comp },
    },
  })
  return page
}

/** 深度遍历 React 元素树。 */
function* walk(node) {
  if (Array.isArray(node)) {
    for (const child of node) yield* walk(child)
    return
  }
  if (node != null && typeof node === 'object') {
    yield node
    if (Array.isArray(node.children)) for (const child of node.children) yield* walk(child)
  }
}

function textOf(node) {
  let out = ''
  for (const el of walk(node)) {
    if (Array.isArray(el.children)) {
      for (const child of el.children) if (typeof child === 'string') out += child
    }
  }
  return out
}

function findByAttr(tree, attr) {
  for (const el of walk(tree)) {
    if (el.props != null && el.props[attr] !== undefined) return el
  }
  return null
}

function findButton(tree, label) {
  for (const el of walk(tree)) {
    if (el.type === 'button' && textOf(el) === label) return el
  }
  return null
}

/** 造一份最小可用 payload（含 v0.5.0 新字段）。 */
function payload(overrides) {
  return Object.assign({
    ok: true,
    generatedAt: 1791000000000,
    dataAsOf: 1790999000000,
    scanning: false,
    scanProgress: { phase: 'idle', done: 0, total: 0, bytesDone: 0, bytesTotal: 0, changed: 0, reused: 3, removed: 0 },
    legacy: false,
    legacyCount: 0,
    stale: false,
    discovery: 'listGenerations',
    discoveryMs: 120,
    decoded: 0,
    reused: 3,
    durationMs: 210,
    lastScanAt: 1790999990000,
    errors: [],
    errorCount: 0,
    restartFolds: 0,
    sessionCount: 2,
    rawSessionCount: 3,
    steps: 5,
    turns: 2,
    llmMs: 1000,
    toolMs: 200,
    totals: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 900, cacheWriteTokens: 0, reasoningTokens: 5, requests: 4 },
    byDay: [],
    byDayAll: [],
    byTrend: { minute: [], hour: [], day: [], week: [] },
    byModel: [],
    topSessions: [],
    tools: [],
  }, overrides || {})
}

const visibility = { meta: true, cards: true, chart: false, heatmap: false, byModel: false, topSessions: false, tools: false }

/* ------------------------------------------------------------------ *
 * 1) scanning：进度可见 + 轮询已排期
 * ------------------------------------------------------------------ */
{
  const harness = newHarness()
  const page = loadPage([false, payload({ scanning: true, scanProgress: { phase: 'fold', done: 120, total: 734, bytesDone: 1, bytesTotal: 439, changed: 120, reused: 0, removed: 0 } }), null, 'all', visibility, false, null], harness)
  const tree = page({})
  const bar = findByAttr(tree, 'data-usage-stats-status')
  assert('1.1 scanning 状态行存在且标记为 scanning', bar != null && bar.props['data-usage-stats-status'] === 'scanning', JSON.stringify(bar && bar.props['data-usage-stats-status']))
  const text = textOf(bar)
  assert('1.2 状态行显示关键词与进度', text.includes('后台重算中') && text.includes('120/734'), text)

  // 轮询 effect：扫描中应挂一个 setTimeout(2000) 且回调会再次 fetch
  const fetches = []
  globalThis.fetch = (url) => { fetches.push(url); return Promise.resolve({ json: () => Promise.resolve(payload()) }) }
  const cleanups = []
  for (const fn of harness.effects) {
    const cleanup = fn()
    if (typeof cleanup === 'function') cleanups.push(cleanup)
  }
  assert('1.3 轮询用 2000ms 定时器', harness.timers.length === 1 && harness.timers[0].ms === 2000, JSON.stringify(harness.timers.map((t) => t.ms)))
  harness.timers[0].fn()
  assert('1.4 定时器回调触发一次**非 force** 拉取（轮询不该反复强制扫描）', fetches.length === 2 && fetches[1].includes('/api/usage-stats/summary?t=') && !fetches[1].includes('force'), JSON.stringify(fetches))
  assert('1.5 挂载时的首次拉取也是常规模式', fetches[0].includes('?t=') && !fetches[0].includes('force=1'), String(fetches[0]))
  assert('1.6 轮询计数走 ref（有上限保护的载体）', harness.refs.length >= 1 && typeof harness.refs[0].current === 'number', JSON.stringify(harness.refs.map((r) => r.current)))
}

/* ------------------------------------------------------------------ *
 * 2) legacy：旧缓存占位提示 + 同样轮询
 * ------------------------------------------------------------------ */
{
  // 纯 legacy（扫描尚未开始的一瞬间）：状态行单独讲"旧缓存占位"
  const harness = newHarness()
  const page = loadPage([false, payload({ legacy: true, legacyCount: 692, scanning: false }), null, 'all', visibility, false, null], harness)
  const tree = page({})
  const bar = findByAttr(tree, 'data-usage-stats-status')
  assert('2.1 纯 legacy 状态行标记为 legacy', bar != null && bar.props['data-usage-stats-status'] === 'legacy', JSON.stringify(bar && bar.props['data-usage-stats-status']))
  assert('2.2 文案提示"旧缓存数据 + 等待重算"', textOf(bar).includes('旧缓存') && textOf(bar).includes('重算'), textOf(bar))

  // 真实情形（扫描进行中 + 仍展示旧缓存）：两件事都要说清
  const harness2 = newHarness()
  const page2 = loadPage([false, payload({ legacy: true, legacyCount: 692, scanning: true }), null, 'all', visibility, false, null], harness2)
  const bar2 = findByAttr(page2({}), 'data-usage-stats-status')
  assert('2.3 扫描中且展示旧缓存时，两种信息同时出现', bar2.props['data-usage-stats-status'] === 'scanning' && textOf(bar2).includes('后台重算中') && textOf(bar2).includes('旧缓存'), textOf(bar2))
}

/* ------------------------------------------------------------------ *
 * 3) idle：数据新鲜度 + 失败时警示配色
 * ------------------------------------------------------------------ */
{
  const harness = newHarness()
  const page = loadPage([false, payload({ restartFolds: 2 }), null, 'all', visibility, false, null], harness)
  const tree = page({})
  const bar = findByAttr(tree, 'data-usage-stats-status')
  assert('3.1 idle 状态行标记为 idle', bar != null && bar.props['data-usage-stats-status'] === 'idle', JSON.stringify(bar && bar.props['data-usage-stats-status']))
  const text = textOf(bar)
  assert('3.2 显示"数据已是最新"与截至时间', text.includes('数据已是最新') && text.includes('截至'), text)
  assert('3.3 改写折叠计入提示（restartFolds）', text.includes('2 个会话日志被改写'), text)
  assert('3.4 无失败时不套警示配色（沿用常规边框）', typeof bar.props.style.border === 'string' && bar.props.style.borderColor === undefined, JSON.stringify({ border: bar.props.style.border, borderColor: bar.props.style.borderColor }))

  const harness2 = newHarness()
  const page2 = loadPage([false, payload({ errorCount: 3, errors: ['a: boom', 'b: boom', 'c: boom'] }), null, 'all', visibility, false, null], harness2)
  const bar2 = findByAttr(page2({}), 'data-usage-stats-status')
  assert('3.5 有失败时显示条数并切警示配色', textOf(bar2).includes('3 个会话失败') && bar2.props.style.background !== undefined, textOf(bar2))
}

/* ------------------------------------------------------------------ *
 * 4) 按钮语义 + 元信息行
 * ------------------------------------------------------------------ */
{
  const harness = newHarness()
  const page = loadPage([false, payload(), null, 'all', visibility, false, null], harness)
  const tree = page({})
  const fetches = []
  globalThis.fetch = (url) => { fetches.push(url); return Promise.resolve({ json: () => Promise.resolve(payload()) }) }

  const refreshBtn = findButton(tree, '刷新')
  const rebuildBtn = findButton(tree, '全量重算')
  assert('4.1 两个操作按钮存在（刷新 / 全量重算）', refreshBtn != null && rebuildBtn != null, 'button missing')
  assert('4.2 不再出现旧的「强制重算」文案', findButton(tree, '强制重算') === null, 'legacy button still present')

  refreshBtn.props.onClick()
  rebuildBtn.props.onClick()
  assert('4.3 刷新走 ?force=1（只重折有变化的会话）', fetches[0] != null && fetches[0].includes('force=1'), String(fetches[0]))
  assert('4.4 全量重算走 ?rebuild=1（整库改名重建）', fetches[1] != null && fetches[1].includes('rebuild=1'), String(fetches[1]))

  const meta = textOf(tree)
  assert('4.5 元信息显示扫描来源与复用数（不再引用 host 已移除的 home）', meta.includes('框架世代枚举') && meta.includes('复用 3') && !meta.includes('undefined'), meta.slice(0, 240))
  assert('4.6 元信息含数据截至与生成时间', meta.includes('数据截至') && meta.includes('生成于'), meta.slice(0, 240))
}

/* ------------------------------------------------------------------ *
 * 5) 静态：新代码在 client-src 里合规（ES5 无箭头/const/let/模板串）
 * ------------------------------------------------------------------ */
{
  const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
  const compSrc = strip(readFileSync(path.resolve(__dirname, '..', 'lib/client-src/40-components.js'), 'utf8'))
  const pageSrc = strip(readFileSync(path.resolve(__dirname, '..', 'lib/client-src/70-page.js'), 'utf8'))
  const src = compSrc + pageSrc
  assert('5.1 新代码保持 ES5（无 const/let/箭头/模板字符串；注释已剔除）', !/\b(const|let)\s/.test(src) && !/=>/.test(src) && !/`/.test(src), 'ES2015+ syntax found')
  assert('5.2 host 已移除的字段不再被客户端引用', !/\bd\.home\b/.test(pageSrc), 'd.home still referenced')
  assert('5.3 section marker 与文件末尾换行符合规范', /^    \/\/ ===== components =====/.test(readFileSync(path.resolve(__dirname, '..', 'lib/client-src/40-components.js'), 'utf8')) && /^    \/\/ ===== page =====/.test(readFileSync(path.resolve(__dirname, '..', 'lib/client-src/70-page.js'), 'utf8')), 'marker missing')
}

assert('6.1 渲染过程无异常', renderErrors.length === 0, renderErrors.join(' | '))

const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok).length
console.log(`[v050-client-status] ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('FAILED cases:')
  for (const r of results.filter((x) => !x.ok)) console.error('  ' + r.label + (r.detail ? ' — ' + r.detail : ''))
  process.exit(1)
}
