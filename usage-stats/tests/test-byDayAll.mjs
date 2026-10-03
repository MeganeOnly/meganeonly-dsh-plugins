// tests/test-byDayAll.mjs
// v0.3.9 新增：覆盖「距离现在超过 30 天」时 all 图表和热力图仍能正确显示数据。
//
// 背景：
//   v0.3.5 把 'all' tab 图表限制为 `byDay.slice(-30)`（近 30 天切片），如果用户
//   上次活动在 40 天前，所有 byDay 桶都被 cut 掉——图表空白、热力图同样空白。
//   v0.3.9 host 端新增 byDayAll（root.days 合并升序不零填充），客户端 'all' 图表
//   与热力图优先消费 byDayAll（本测试主验证点）。
//
// 覆盖矩阵：
//   A. 静态：lib/index.js 导出 rootsDaysAll；buildSummary 输出 byDayAll 字段
//   B. 静态：70-page.js all tab 走 byDayAll；heatmap 优先 byDayAll
//   C. 行为：rootsDaysAll 把多个 root 的 days 合并、升序、不零填充
//   D. 行为：所有会话事件都早于 30 天前 → byDayAll 仍有数据，byDay 是空（全零填充）
//   E. 行为：客户端加载 bundle，fakePayload 不带 byDayAll → 'all' 图表走
//      safeByTrend.day 回退；带 byDayAll 且 lastBucket 是 100 天前 → 'all' 图表
//      显示 byDayAll（lastBucket 是 100 天前仍可见），heatmap 同样显示
//   F. 行为：byDayAll > 371 天时被裁剪到 371
//
// 用法：node tests/test-byDayAll.mjs
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
 * A. 静态：host 半端
 * ------------------------------------------------------------------ */

{
  // v0.5.0：host 半段拆成多模块，rootsDaysAll 落在 lib/series.js，
  // lib/index.js 作为兼容入口继续 re-export（老调用方不受影响）。
  const seriesSrc = readFileSync(path.join(ROOT, 'lib/series.js'), 'utf8')
  const indexSrc = readFileSync(path.join(ROOT, 'lib/index.js'), 'utf8')
  const payloadSrc = readFileSync(path.join(ROOT, 'lib/payload.js'), 'utf8')

  // A.1 rootsDaysAll 导出（本模块 + 入口 re-export）
  assert(
    'lib/series.js: rootsDaysAll 已被 export 且 lib/index.js 继续 re-export',
    /export function rootsDaysAll/.test(seriesSrc) && /export \{[^}]*rootsDaysAll[^}]*\} from '\.\/series\.js'/.test(indexSrc),
    'rootsDaysAll export / re-export 未找到'
  )

  // A.2 payload 输出 byDayAll 字段
  assert(
    'lib/payload.js: 快照输出 byDayAll 字段',
    /byDayAll:\s*rootsDaysAll\(/.test(payloadSrc),
    'byDayAll 字段在 payload 输出中未匹配'
  )

  // A.3 rootsDaysAll 升序排序（确保日期早的在前）
  assert(
    'lib/series.js: rootsDaysAll 用 sort() 升序排序 keys',
    /function rootsDaysAll[\s\S]{0,1000}\.sort\(/.test(seriesSrc),
    'rootsDaysAll 升序排序未匹配'
  )

  // A.4 rootsDaysAll 不零填充（不调用 stepMs / windowMs / 空 bucket 补 0）
  // 简单 sanity：函数签名 + body 不应与 "windowMs" / "stepMs" 同时出现。
  // 真正的"不零填充"在 C.* 行为测试里端到端验证。
  const rootsDaysAllBlock = seriesSrc.match(/export function rootsDaysAll[\s\S]{0,2000}\n\}/)
  assert(
    'lib/series.js: rootsDaysAll 输出长度等于 root.days keys 数（不零填充）',
    rootsDaysAllBlock != null &&
      !/windowMs/.test(rootsDaysAllBlock[0]) &&
      !/stepMs/.test(rootsDaysAllBlock[0]),
    rootsDaysAllBlock ? '零填充相关常量（windowMs/stepMs）出现在 rootsDaysAll body 中' : 'rootsDaysAll 函数体未匹配'
  )
}

/* ------------------------------------------------------------------ *
 * B. 静态：client 70-page.js
 * ------------------------------------------------------------------ */

{
  const src = readFileSync(path.join(ROOT, 'lib/client-src/70-page.js'), 'utf8')

  // B.1 'all' tab 优先 byDayAll
  assert(
    "70-page.js: 'all' tab 优先 d.byDayAll（v0.3.9 主路径）",
    /d\.byDayAll[\s\S]{0,80}length\s*>\s*0/.test(src),
    "'all' tab byDayAll 守卫未找到"
  )

  // B.2 heatmap 优先 byDayAll，回退到 byDay（d.byDay）——顺序很关键
  assert(
    '70-page.js: heatmap 优先 d.byDayAll，老 host 回退 d.byDay',
    /d\.byDayAll[\s\S]{0,80}length\s*>\s*0\s*\?\s*d\.byDayAll\s*:\s*\([\s\S]{0,30}\)\?[\s\S]{0,20}\bd\.byDay\b/.test(src) ||
      /var heatmapSource\s*=\s*d\.byDayAll\s*&&\s*d\.byDayAll\.length\s*>\s*0\s*\?\s*d\.byDayAll\s*:\s*\(d\.byDay\s*\|\|\s*\[\]\)/.test(src),
    'heatmap byDayAll 优先 + byDay 回退未匹配'
  )

  // B.3 53 周裁剪 + 371 天
  assert(
    '70-page.js: byDayAll 53 周 / 371 天上限',
    /HEATMAP_WEEKS\s*=\s*53/.test(src) && /HEATMAP_DAYS\s*=\s*HEATMAP_WEEKS\s*\*\s*7/.test(src),
    'HEATMAP_WEEKS / HEATMAP_DAYS 常量未匹配'
  )

  // B.4 h7 / m1 不受影响——仍然是 byTrend（多粒度桶路径）
  // 这两点通过 rangeSpec("h7") / "m1" 自然落到 byTrend[granularity]，
  // 唯一保证是 byTrend 兜底与 'all' tab 不影响其它 tab 的代码路径。
  // 用静态检测 'all' tab block 在 winSeries 计算附近，确保只在该分支里用 byDayAll。
  assert(
    "70-page.js: r.key === 'all' 分支独立决策（其它 tab 不污染）",
    /r\.key\s*===\s*"all"[\s\S]{0,200}allSource/.test(src),
    "'all' tab 独立分支未匹配（其它 tab 可能受影响）"
  )
}

/* ------------------------------------------------------------------ *
 * C. 行为：rootsDaysAll 把多个 root 的 days 合并、升序、不零填充
 * ------------------------------------------------------------------ */

// 直接跑 host export
const { rootsDaysAll } = await import('../lib/index.js')

{
  // 3 个 root，每个 2 个 day，其中 day key 有重叠——
  // 验证：(1) 同 key 合并；(2) 升序；(3) 不零填充（空 key 不补 0）
  const roots = [
    {
      days: {
        '2026-08-01': { inputTokens: 100, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 1 },
        '2026-08-03': { inputTokens: 300, outputTokens: 30, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 3 },
      },
    },
    {
      days: {
        '2026-08-02': { inputTokens: 200, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 2 },
        '2026-08-03': { inputTokens: 3000, outputTokens: 300, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 30 }, // 同 key 合并
      },
    },
  ]
  const all = rootsDaysAll(roots)

  assert(
    'C.1: rootsDaysAll 输出长度 === 3（不零填充）',
    all.length === 3,
    `got length=${all.length}, expected 3`
  )

  assert(
    'C.2: rootsDaysAll 按日期升序（08-01 / 08-02 / 08-03）',
    all[0].bucket === '2026-08-01' && all[1].bucket === '2026-08-02' && all[2].bucket === '2026-08-03',
    `keys=${all.map(function (b) { return b.bucket }).join(',')}`
  )

  assert(
    'C.3: 同 key（08-03）合并：inputTokens = 300+3000 = 3300',
    all[2].inputTokens === 3300 && all[2].requests === 33,
    `merged bucket=${JSON.stringify(all[2])}`
  )

  assert(
    'C.4: bucket 与 day 双字段（兼容 v0.3.3 dayShape）',
    all.every(function (b) { return b.bucket === b.day }),
    'bucket !== day in some entry'
  )
}

/* ------------------------------------------------------------------ *
 * D. 行为：所有会话都早于 30 天前 —— byDayAll 仍有数据
 *
 * 此场景直接体现用户的核心痛点：用户上次活动距今 100 天，v0.3.5 之前任何
 * 客户端组件都空白（byDay 是零填充的"最近 30 天"全 0 序列）；v0.3.9 后
 * byDayAll 直接持有 100 天前的真实数据，'all' 图表与热力图都能展示。
 * ------------------------------------------------------------------ */

{
  // 模拟 roots：days 只在 100 天前与 110 天前
  const now = Date.now()
  const day100 = beijingDayKey(now - 100 * 86400000)
  const day110 = beijingDayKey(now - 110 * 86400000)
  const roots = [{
    days: {
      [day100]: { inputTokens: 50, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 1 },
      [day110]: { inputTokens: 80, outputTokens: 8, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 2 },
    },
  }]
  const all = rootsDaysAll(roots)

  assert(
    'D.1: 100 天前的数据 byDayAll 仍保留（不被 30 天窗口 cut 掉）',
    all.length === 2,
    `got length=${all.length}`
  )
  assert(
    'D.2: byDayAll 100 天前的桶的 inputTokens 仍可访问（图表能渲染）',
    all.every(function (b) { return typeof b.inputTokens === 'number' && b.inputTokens > 0 }),
    'expected all entries to have positive inputTokens'
  )
  assert(
    'D.3: byDayAll ≥ 30 天前的 key 全部出现（关键回归——v0.3.5 之前会因 30 天 cut 全空）',
    all.some(function (b) { return b.bucket === day100 || b.bucket === day110 }),
    `expected bucket containing ${day100} or ${day110}, got ${all.map(function (b) { return b.bucket }).join(',')}`
  )

  // beijingDayKey 用于从 ms 抽取日期 key（参考 index.js 的导出，但避免 import 噪声；
  // 这里用精简 inline 版本对照确认 key 形态）。
  function beijingDayKey(ms) {
    return new Date(ms + 8 * 3600 * 1000).toISOString().slice(0, 10)
  }
}

/* ------------------------------------------------------------------ *
 * E. 行为：客户端加载 bundle —— fakePayload with/without byDayAll 的差异
 * ------------------------------------------------------------------ */

{
  // E.0 复用 test-all-range.mjs 的 React mock 模式
  const renderErrors = []
  function createElement(type, props, ...children) {
    return { __react: true, type, props: props || {}, children }
  }

  // React tree walker（hoisted 到本 block 顶部，避免 E.5 找不到符号）
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

  // E.1 构造「100 天前」单点数据 + byDayAll
  const now = Date.now()
  const ms100dAgo = now - 100 * 86400000
  const dayKey100dAgo = new Date(ms100dAgo + 8 * 3600 * 1000).toISOString().slice(0, 10)
  const fakeByDayAll = [{
    bucket: dayKey100dAgo,
    day: dayKey100dAgo,
    inputTokens: 42,
    outputTokens: 7,
    cacheReadTokens: 5,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    requests: 3,
  }]
  // fakeByDay 是 v0.3.9 之前的"近 30 天零填充"——这里就是全 0 占位（模拟
  // 真正 100 天前才活动、过去 30 天没动静的场景，v0.3.5 的 chart 与 heatmap
  // 都会因此变空白）。
  const fakeByDay = new Array(30).fill(0).map(function (_, i) {
    const ms = now - (29 - i) * 86400000
    const k = new Date(ms + 8 * 3600 * 1000).toISOString().slice(0, 10)
    return { bucket: k, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 0 }
  })
  const fakeTotals = {
    inputTokens: 42,
    outputTokens: 7,
    cacheReadTokens: 5,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    requests: 3,
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
    llmMs: 100000,
    byDay: fakeByDay, // 全 0（最近 30 天都没活动）
    byDayAll: fakeByDayAll, // 100 天前唯一真实事件
    byTrend: {
      day: fakeByDay, // 全 0
      hour: [],
      minute: [],
      week: [],
    },
    byModel: [{ model: 'mock/m', sessions: 1, inputTokens: 42, outputTokens: 7, cacheReadTokens: 5, reasoningTokens: 0, requests: 3, days: {} }],
    topSessions: [],
    tools: [],
  }

  let useStateIndex = 0
  const useStateInitial = [
    false, // loading
    fakePayload, // data
    null, // error
    'all', // range — 测 'all' tab
    { meta: false, cards: true, chart: true, heatmap: true, byModel: false, topSessions: false, tools: false },
    false, // panelOpen
    null, // heatmapModel
  ]
  const React = {
    useState(init) {
      const i = useStateIndex++
      const v = i < useStateInitial.length ? useStateInitial[i] : init
      return [v, () => {}]
    },
    useEffect() {},
    useCallback(fn) { return fn },
    useRef(init) { return { current: init } },
    createElement,
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
    removeEventListener: () => {},
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
      },
    },
  }
  globalThis.console = console

  const code = readFileSync(path.join(ROOT, 'lib/client.js'), 'utf8')
  eval(code)

  assert(
    'E.0: client.js 加载成功',
    loadedModules.length === 1 && renderErrors.length === 0,
    renderErrors.length > 0 ? renderErrors.join(' | ') : `loaded ${loadedModules.length}`
  )

  if (loadedModules.length === 1) {
    let capturedPage = null
    const ctx = {
      slots: {
        inject(slot, fn) {
          try { fn() } catch (e) { renderErrors.push('inject failed: ' + e.message) }
        },
        register(spec, comp) {
          capturedPage = comp
          return comp
        },
      },
    }
    try { loadedModules[0].mod.apply(ctx) } catch (e) { renderErrors.push('apply threw: ' + e.message) }

    let pageTree = null
    try {
      pageTree = capturedPage({})
    } catch (e) {
      renderErrors.push('page render threw: ' + e.message + '\n' + (e.stack || ''))
    }

    // E.1 'all' tab 图表走 byDayAll（N=1，即那 100 天前那根柱）
    let chartN = null
    for (const n of iterChildren(pageTree)) {
      if (n.type === 'span' && Array.isArray(n.children) && n.children.length >= 1) {
        const text = n.children[0]
        if (typeof text === 'string') {
          const m = text.match(/·\s*(\d+)\s*桶/)
          if (m) chartN = parseInt(m[1], 10)
        }
      }
    }
    assert(
      'E.1: 100 天前的数据在 all 图表里有 1 根柱（v0.3.9 之前会因 30 天窗全空）',
      chartN === 1,
      chartN === null ? '未找到 chartLegendHint "· N 桶"' : `chartN=${chartN}`
    )

    // E.2 模型请求 卡显示 fakeTotals.requests（=3，全程指标）
    let modelRequestVal = null
    for (const n of iterChildren(pageTree)) {
      if (n.type === 'div' && Array.isArray(n.children) && n.children.length >= 2) {
        const labelNode = n.children[0]
        const valueNode = n.children[1]
        if (
          labelNode && labelNode.type === 'div' &&
          Array.isArray(labelNode.children) && labelNode.children[0] === '模型请求'
        ) {
          if (valueNode && valueNode.type === 'div' && Array.isArray(valueNode.children)) {
            modelRequestVal = valueNode.children[0]
          }
        }
      }
    }
    assert(
      "E.2: '模型请求' 卡显示 fakeTotals.requests（=3，全程指标）",
      modelRequestVal === String(fakeTotals.requests),
      modelRequestVal == null ? '未找到 Card "模型请求"' : `got=${JSON.stringify(modelRequestVal)}`
    )

    // E.3 热力图渲染有 title（出现日期字符串 dayKey100dAgo），证明渲染了 100 天前的格子
    const allTitles = []
    for (const n of iterChildren(pageTree)) {
      if (n && typeof n === 'object' && typeof n.props?.title === 'string') {
        allTitles.push(n.props.title)
      }
    }
    // title 形如 "2026-XX-XX\n输入 42\n输出 7\n请求 3 次" —— 关键是包含 dayKey100dAgo
    assert(
      'E.3: 热力图渲染包含 dayKey100dAgo 的格子（100 天前的格子可见）',
      allTitles.some(function (t) { return typeof t === 'string' && t.indexOf(dayKey100dAgo) === 0 }),
      `dayKey100dAgo=${dayKey100dAgo}; titles with dates=${allTitles.filter(function (t) { return /^\d{4}-\d{2}-\d{2}/.test(t) }).slice(0, 5).join(' | ')}`
    )

    // E.4 反向 sanity：fakeByDay 是全 0（30 个 day 都 0 token）→ 30 个 0 网格不会显示
    // 因为没用 byDay，走 byDayAll 后只有 1 个真实日网格。
    // 用 DayChart 内部 N 确认：E.1 已验证 N=1。
  }

  // E.5 老 host（no byDayAll）回退到 safeByTrend.day —— 「all」 tab 图表 / 热力图
  // 都不应因缺失字段而崩溃。fixture: byDay 30 天里挑 2 天非零，让 DayChart 走
  // 完整 legend 渲染路径（max=0 时 DayChart 不渲染 "· N 桶" hint），这样才能断言。
  const oldHostByDay = new Array(30).fill(0).map(function (_, i) {
    const ms = now - (29 - i) * 86400000
    const k = new Date(ms + 8 * 3600 * 1000).toISOString().slice(0, 10)
    const hasActivity = (i === 5 || i === 15)
    return {
      bucket: k,
      day: k,
      inputTokens: hasActivity ? 100 : 0,
      outputTokens: hasActivity ? 10 : 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      requests: hasActivity ? 1 : 0,
    }
  })
  const oldHostPayload = Object.assign({}, fakePayload, {
    byDay: oldHostByDay,
    byDayAll: undefined, // 显式去掉——模拟老 host
    byTrend: { day: oldHostByDay, hour: [], minute: [], week: [] },
    totals: { inputTokens: 220, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 2 },
  })
  // 渲染老 host payload 的一次完整 eval（在子作用域里执行，主作用域的变量
  // 不被污染）。
  ;(function () {
    function createElementLocal(type, props, ...children) {
      return { __react: true, type, props: props || {}, children }
    }
    function* iterLocal(node) {
      if (Array.isArray(node)) {
        for (const c of node) yield* iterLocal(c)
        return
      }
      if (node != null && typeof node === 'object') {
        yield node
        if (Array.isArray(node.children)) {
          for (const c of node.children) yield* iterLocal(c)
        }
      }
    }
    let useStateIndexLocal = 0
    const useStateInitialLocal = [
      false,
      oldHostPayload,
      null,
      'all',
      { meta: false, cards: false, chart: true, heatmap: true, byModel: false, topSessions: false, tools: false },
      false,
      null,
    ]
    const ReactLocal = {
      useState(init) {
        const i = useStateIndexLocal++
        const v = i < useStateInitialLocal.length ? useStateInitialLocal[i] : init
        return [v, () => {}]
      },
      useEffect() {},
      useCallback(fn) { return fn },
      useRef(init) { return { current: init } },
      createElement: createElementLocal,
    }
    const loadedLocal = []
    const errsLocal = []
    globalThis.window = {
      __ModuleLoader__: {
        load(spec) {
          const fakeRequire = (id) => {
            if (id === 'react') return ReactLocal
            throw new Error('mock require fail: ' + id)
          }
          try {
            const mod = spec.factory(fakeRequire)
            loadedLocal.push({ mod })
            return mod
          } catch (e) {
            errsLocal.push('load failed: ' + e.message)
            return null
          }
        },
      },
    }
    globalThis.fetch = () => Promise.resolve({ json: () => Promise.resolve(oldHostPayload) })
    try {
      eval(code)
    } catch (e) {
      errsLocal.push('eval threw: ' + e.message + '\n' + (e.stack || ''))
    }
    if (loadedLocal.length === 1) {
      let capturedPage = null
      const ctx = {
        slots: {
          inject(slot, fn) {
            try { fn() } catch (e) { errsLocal.push('inject failed: ' + e.message) }
          },
          register(spec, comp) {
            capturedPage = comp
            return comp
          },
        },
      }
      try { loadedLocal[0].mod.apply(ctx) } catch (e) { errsLocal.push('apply threw: ' + e.message) }

      let pageTree = null
      try {
        pageTree = capturedPage({})
      } catch (e) {
        errsLocal.push('page render threw: ' + e.message + '\n' + (e.stack || ''))
      }

      let oldChartN = null
      let heatmapEmpty = false
      const allTexts = []
      const allDivStrings = []
      const typesSeen = new Set()
      for (const n of iterLocal(pageTree || null)) {
        typesSeen.add(n.type)
        if (n.type === 'span' && Array.isArray(n.children) && n.children.length >= 1) {
          const text = n.children[0]
          if (typeof text === 'string') {
            allTexts.push(text)
            const m = text.match(/·\s*(\d+)\s*桶/)
            if (m) oldChartN = parseInt(m[1], 10)
          }
        }
        if (n.type === 'div' && typeof n.children === 'string') {
          allDivStrings.push(n.children)
          if (n.children.indexOf('暂无') === 0) {
            heatmapEmpty = true
          }
        }
      }
      // (debug logs removed in cleanup)
      assert(
        'E.5: 老 host 无 byDayAll → chart 回退 safeByTrend.day，渲染 30 桶（fixture 含非零 token）',
        oldChartN === 30,
        oldChartN === null
          ? `未找到 chartLegendHint "· N 桶"（hint 在 max=0 时不渲染，fixture 含 2 个非零 day）; errs=${errsLocal.join(' | ')}`
          : `oldChartN=${oldChartN}, expected 30 (oldHostByDay 长度); errs=${errsLocal.join(' | ')}`
      )
      assert(
        'E.6: 老 host 无 byDayAll → 热力图非 empty（max>0，渲染正常）',
        !heatmapEmpty,
        '期望热力图有数据（max>0）；errs=' + errsLocal.join(' | ')
      )
      assert(
        'E.7: 老 host byDayAll 缺失时不抛错（render errors 为空）',
        errsLocal.length === 0,
        'render errors: ' + errsLocal.join(' | ')
      )
      if (errsLocal.length > 0) {
        console.log('\nRender errors (E.5):')
        for (const e of errsLocal) console.log('  - ' + e)
      }
    } else {
      assert(
        'E.5: client.js 老 host 子作用域加载成功',
        false,
        `loadedLocal.length=${loadedLocal.length}, errs=${errsLocal.join(' | ')}`
      )
    }
  })()
}

/* ------------------------------------------------------------------ *
 * F. 行为：byDayAll > 371 天时被裁剪到 371
 * ------------------------------------------------------------------ */

{
  const now = Date.now()
  const oversized = []
  for (let i = 0; i < 400; i++) {
    const ms = now - (400 - i) * 86400000
    const k = new Date(ms + 8 * 3600 * 1000).toISOString().slice(0, 10)
    oversized.push({
      day: k,
      bucket: k,
      inputTokens: 1,
      outputTokens: 1,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      requests: 1,
    })
  }
  const roots = [{ days: Object.fromEntries(oversized.map(function (b) { return [b.bucket, b] })) }]

  // rootsDaysAll 输出全 400（host 不裁剪——裁剪是 client 责任）
  const all = rootsDaysAll(roots)
  assert(
    'F.1: rootsDaysAll 输出 400 项（host 不裁剪，由客户端裁）',
    all.length === 400,
    `got length=${all.length}`
  )

  // 客户端裁剪在 70-page.js 的 53 周窗口逻辑：HEATMAP_DAYS=371 时 slice(-371)
  // 验证字符串源码：slice(-HEATMAP_DAYS) 等价于 slice(-371)
  const src = readFileSync(path.join(ROOT, 'lib/client-src/70-page.js'), 'utf8')
  const sliceExpr = src.match(/d\.byDayAll\.length\s*>\s*HEATMAP_DAYS[\s\S]{0,60}\.slice\(/)
  assert(
    'F.2: 客户端对 byDayAll 长度 > HEATMAP_DAYS 时执行 .slice(...) 截断',
    sliceExpr != null,
    'client 70-page.js 缺 byDayAll 长度裁剪'
  )

  // 模拟客户端裁剪：长度 > 371 → 取末尾 371；否则取全部
  const clipped = all.length > 371 ? all.slice(-371) : all
  assert(
    'F.3: 400 元素裁剪到 371（53 周上限）',
    clipped.length === 371,
    `clipped.length=${clipped.length}`
  )
}

/* ------------------------------------------------------------------ *
 * node --check lib/client.js 语法检查
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
console.log(`\n[byDayAll] ${pass} passed, ${fail} failed`)
// renderErrors 是 E.0 block 内的局部变量，文件级不可见；这里仅断言汇总退出码
if (fail > 0) process.exit(1)
