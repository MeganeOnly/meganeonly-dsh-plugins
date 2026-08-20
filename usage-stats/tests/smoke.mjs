// tests/smoke.mjs
// 冒烟测试：模拟 browser 加载 bundle，调用 UsageStatsPage / UsageStatsPageBody 渲染 mock 数据。
// 目的：保证拆分后的 source files 拼接产物在 apply 路径与渲染路径上都抛错为 0。

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLIENT_PATH = path.resolve(__dirname, '..', 'lib', 'client.js')

// 计数 React.createElement 调用次数，作为"渲染路径走过"的指标
let renderCount = 0
let renderErrors = []

function createElement(type, props, ...children) {
  renderCount++
  return { __react: true, type, props: props || {}, children }
}
const React = {
  useState(init) { return [init, () => {}] },
  useEffect() {},
  useCallback(fn) { return fn },
  createElement
}

// mock fetch：返回一份最小可用的 summary payload
const fakePayload = {
  ok: true,
  home: '/mock/dsh/home',
  sessionCount: 3,
  turns: 7,
  decoded: 1,
  reused: 2,
  durationMs: 50,
  generatedAt: Date.now(),
  errors: [],
  totals: { inputTokens: 1000, outputTokens: 500, cacheReadTokens: 200, cacheWriteTokens: 0, reasoningTokens: 50, requests: 5 },
  steps: 6,
  llmMs: 1000,
  toolMs: 200,
  byDay: [
    { day: '2026-08-18', inputTokens: 100, outputTokens: 50, cacheReadTokens: 20, cacheWriteTokens: 0, reasoningTokens: 5, requests: 1 }
  ],
  byModel: [{ model: 'mock/model-a', sessions: 1, inputTokens: 1000, outputTokens: 500, cacheReadTokens: 200, reasoningTokens: 50, requests: 5, days: {} }],
  topSessions: [{ id: 'sess-1', title: 'mock session', cwd: '/mock/cwd', createdAt: Date.now() - 86400000, requests: 5, outputTokens: 500, tokens: 1700 }],
  tools: [{ name: 'mock-tool', calls: 3, ms: 1500 }]
}
globalThis.fetch = () => Promise.resolve({ json: () => Promise.resolve(fakePayload) })

// mock document / localStorage / console
const localStorage = { _s: {}, setItem(k, v) { this._s[k] = String(v) }, getItem(k) { return this._s[k] }, removeItem(k) { delete this._s[k] } }
const document = {
  createElement: () => ({}),
  head: { appendChild: () => {} },
  querySelector: () => null,
  addEventListener: () => {},
  removeEventListener: () => {}
}

// 收集所有 window.__ModuleLoader__.load 调用结果到一个数组，方便后续手动触发 render
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
globalThis.document = document
globalThis.localStorage = localStorage
globalThis.console = console

// 加载 bundle
const code = readFileSync(CLIENT_PATH, 'utf8')
eval(code)

if (loadedModules.length !== 1) {
  console.error('[smoke] expected 1 module loaded, got', loadedModules.length)
  process.exit(1)
}

const { mod } = loadedModules[0]
if (!mod || !mod.apply || !mod.inject) {
  console.error('[smoke] module missing apply/inject')
  process.exit(1)
}
if (mod.inject.indexOf('slots') === -1) {
  console.error('[smoke] inject should include "slots"')
  process.exit(1)
}

// 调 apply 看 settings.section slot 注入是否抛错
const ctx = {
  slots: {
    inject(slot, fn) {
      // 模拟立即执行
      try { fn() } catch (e) { renderErrors.push('inject fn failed: ' + e.message) }
    },
    register(spec, comp) {
      // 立即调一次组件函数模拟渲染
      try {
        comp({})
        renderCount++
      } catch (e) {
        renderErrors.push('render failed: ' + e.message + '\n' + (e.stack || ''))
      }
      return comp
    }
  }
}
try {
  mod.apply(ctx)
} catch (e) {
  console.error('[smoke] apply threw:', e.message, e.stack)
  process.exit(1)
}

if (renderErrors.length > 0) {
  console.error('[smoke] render errors:')
  renderErrors.forEach((e) => console.error('  -', e))
  process.exit(1)
}

console.log('[smoke] bundle loaded, apply + render paths OK; renderCount =', renderCount)
console.log('[smoke] PASS')