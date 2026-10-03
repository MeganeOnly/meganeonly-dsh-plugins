// tests/helpers/session-tree.mjs
// v0.5.0 测试脚手架：在临时目录里造一棵**真实的** DSH 会话树（追加式多帧 zstd 日志），
// 装载 host 半端（lib/index.js 的 apply），并能通过 HTTP handler 驱动扫描与断言 payload。
//
// 为什么不用 mock sessionQuery：v0.5.0 起 host 半段自己走文件系统发现 + 帧级续读，
// mock 框架服务反而测不到真实路径。这里用真实文件 + 真实 zstd 帧，唯一被替换的是
// 到 DSH 的那层壳（baseUrl / webServer / ctx.get）。
//
// 约定：会话树根 = <tmp>/sessions，profile 根 = <tmp>/profile；
// 通过 DSH_HOME=<tmp> 让 discover.js 的候选根推断命中 <tmp>/sessions。

import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { zstdCompressSync } from 'node:zlib'

/** 建一个临时 DSH 主目录：{ root, home, sessions, profile }。 */
export function makeTmpDsh(label) {
  const root = mkdtempSync(join(tmpdir(), `usage-stats-${label}-`))
  const home = root
  const sessions = join(root, 'sessions')
  const profile = join(root, 'profile')
  mkdirSync(sessions, { recursive: true })
  mkdirSync(profile, { recursive: true })
  return { root, home, sessions, profile }
}

/** 临时把 DSH_HOME 指向 <tmp>（discover 据此推断 sessions 根），返回恢复函数。 */
export function useDshHome(home) {
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = home
  return () => {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  }
}

export function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true })
}

/* ------------------------------------------------------------------ *
 * 日志与事件构造
 * ------------------------------------------------------------------ */

export const eventLine = (obj) => JSON.stringify(obj) + '\n'

/** 一段文本压成一个独立可解的 zstd 帧（DSH 日志的追加单位）。 */
export function frameOf(lines) {
  return zstdCompressSync(Buffer.from(lines.join(''), 'utf8'))
}

/** DSH v4 session header。 */
export function headerOf(id, extra = {}) {
  return { type: 'session', version: 4, id, createdAt: 1700000000000, cwd: '/tmp/usage-stats-tree', isSeeded: false, delegationDepth: 0, agentPreset: 'standard', ...extra }
}

/** 一条带模型侧精确 usage 的 assistant/message 事件。 */
export function usageEvent(seq, time, usage) {
  return { type: 'assistant/message', seq, time, data: { turn: 1, step: 1, usage } }
}

/** 一条 request/header（决定后续 usage 归属的模型名）。 */
export function modelEvent(seq, time, provider, model) {
  return { type: 'request/header', seq, time, data: { header: { config: { provider, model } } } }
}

/** 把事件序列编成"首帧 header + 之后每 N 条一帧"的容器。 */
export function buildLog(id, events, options = {}) {
  const perFrame = Number.isFinite(options.perFrame) ? options.perFrame : 2
  const frames = [frameOf([eventLine(headerOf(id, options.headerExtra))])]
  for (let i = 0; i < events.length; i += perFrame) {
    frames.push(frameOf(events.slice(i, i + perFrame).map(eventLine)))
  }
  return Buffer.concat(frames)
}

/** 在树里写一个会话日志，返回绝对路径。 */
export function writeSessionLog(sessions, spec) {
  const project = spec.project || '--proj--'
  const dir = join(sessions, project, spec.id)
  mkdirSync(dir, { recursive: true })
  const fileName = spec.fileName || 'session.jsonl.zstd'
  const path = join(dir, fileName)
  writeFileSync(path, spec.buffer != null ? spec.buffer : buildLog(spec.id, spec.events || [], spec))
  return path
}

/** 往已有日志追加事件（每 eventsPerFrame 条一帧）。 */
export function appendEvents(path, events, perFrame = 2) {
  for (let i = 0; i < events.length; i += perFrame) {
    appendFileSync(path, frameOf(events.slice(i, i + perFrame).map(eventLine)))
  }
}

/** 追加原始字节（造撕裂尾帧用）。 */
export function appendRaw(path, buffer) {
  appendFileSync(path, buffer)
}

/* ------------------------------------------------------------------ *
 * Host 半端装载与 HTTP 驱动
 * ------------------------------------------------------------------ */

/** 装载 host 半端（mock ctx：baseUrl + webServer + 可选服务），返回 { handler, ctx, services }。 */
export async function loadHost(options = {}) {
  const { apply } = await import('../../lib/index.js')
  const registered = []
  const services = options.services || {}
  const ctx = {
    baseUrl: pathToFileURL(options.profileRoot).href + '/',
    webServer: {
      register(spec) { registered.push(spec); return () => {} },
      exact: new Map(),
    },
    logger: options.logger || { warn() {} },
    get(name) { return services[name] },
  }
  apply(ctx)
  const handler = registered.find((r) => r.path === '/api/usage-stats/summary').handler
  if (handler === undefined) throw new Error('summary 路由未注册')
  return { handler, ctx, services, registered }
}

/** 调一次 handler，解析 JSON 响应。 */
export function callHandler(handler, url) {
  return new Promise((resolve, reject) => {
    const res = {
      status: null,
      writeHead(status, headers) { this.status = status; this.headers = headers },
      end(body) {
        try {
          resolve(JSON.parse(body))
        } catch (error) {
          reject(error)
        }
      },
    }
    try {
      handler({ method: 'GET', url }, res)
    } catch (error) {
      reject(error)
    }
  })
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 触发一次扫描并等它跑完（复刻客户端行为：先 force 触发，再用非 force 轮询看进度）。
 *
 * 非 force 请求在 15s 节流窗口内不会重新起扫描，因此轮询读数稳定。
 * 判定"跑完"要求**连续两次**读到 scanning=false 且 lastScanAt 不变 —— 单次读到
 * false 可能落在"上一轮刚结束、排队中的下一轮尚未开始"的瞬间（force 排队语义）。
 */
export async function scanAndSettle(handler, options = {}) {
  const base = options.url || '/api/usage-stats/summary'
  const trigger = options.rebuild === true ? `${base}?rebuild=1` : `${base}?force=1`
  let payload = await callHandler(handler, trigger)
  let previousScanAt = null
  let stableReads = 0
  for (let i = 0; i < (options.maxPolls || 400); i += 1) {
    if (payload.scanning === false) {
      if (previousScanAt === payload.lastScanAt) {
        stableReads += 1
        if (stableReads >= 2) return payload
      } else {
        stableReads = 1
        previousScanAt = payload.lastScanAt
      }
    } else {
      stableReads = 0
      previousScanAt = null
    }
    await sleep(options.pollMs || 5)
    payload = await callHandler(handler, base)
  }
  return payload
}

/** 读一条已落盘的记录（断言持久化形态用）。 */
export function readRecordFile(profileRoot, key) {
  const safe = String(key).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120)
  return JSON.parse(readFileSync(join(profileRoot, '.usage-stats', 'sessions', `${safe}.json`), 'utf8'))
}

/** 列出已落盘的记录 key。 */
export function listRecordKeys(profileRoot) {
  return readdirSync(join(profileRoot, '.usage-stats', 'sessions')).filter((f) => f.endsWith('.json'))
}
