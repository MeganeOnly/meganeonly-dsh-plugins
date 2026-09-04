/**
 * dsh-usage-stats — Host 半端（作者：MeganeOnly）
 *
 * 使用统计：跨会话汇总 token 用量。数据源是 ~/.dsh/sessions 下的会话日志
 * （session.jsonl.zstd，多 frame 拼接的 zstd 容器，Node 22 内置 zlib 可解）。
 * 模型侧精确 usage 来自 assistant/message 事件的 usage 字段
 * （inputTokens / outputTokens / cacheReadTokens / cacheWriteTokens / reasoningTokens）。
 *
 * 聚合策略：每个会话文件按 (size, mtimeMs) 做增量缓存（profile 目录
 * .usage-stats-cache.json，临时文件 + rename 原子写），没变的直接用上次结果；
 * 汇总请求串行化（沿用 peak-hour-lock 的 promise chain 模式），并发请求共享一次计算。
 *
 * 对外 API：GET /api/usage-stats/summary（可选 ?force=1 忽略增量缓存强制重算）。
 */
import { readFile, writeFile, rename, readdir, stat } from 'node:fs/promises'
import { zstdDecompressSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'

export const name = 'usage-stats'

export const inject = ['webServer']

const API_SUMMARY = '/api/usage-stats/summary'
const CACHE_FILENAME = '.usage-stats-cache.json'
// v3：跳过不暴露；v4：子代理归并 + hours/minutes 桶 + root main session rollup + granularitySeries。
// v5：缓存键从 `sessionDir.name` 升级为 `<projectDir>/<sessionDir>`，修复跨项目 session id
//     冲突（同一台机器多个项目各自有一个 `session-XXX` 目录时会互相覆盖 cached.agg）。
//     bump version 强制一次缓存作废重算，避免老 v4 缓存里的孤儿键污染新键空间。
const CACHE_VERSION = 5
const ZSTD_MAGIC = 0xfd2fb528
const BEIJING_OFFSET_MS = 8 * 3600 * 1000 // 统计按北京时间分日（UTC+8 无夏令时）
const DAY_WINDOW = 30 // 按日趋势返回最近 30 天（含零填充）
const TOP_SESSIONS = 12
const TOP_TOOLS = 10
const MAX_ERRORS_REPORTED = 5

/* ------------------------------------------------------------------ *
 * zstd 容器解码：结构性扫描 frame 边界（与 DSH 官方扫描器同规则），
 * 逐 frame 用 Node 内置 zstdDecompressSync 解压，再按行拆 JSON 事件。
 * ------------------------------------------------------------------ */

/** 扫描完整 frame 的 [start, end) 区间；末尾撕裂的 frame 直接丢弃。 */
export function scanZstdFrames(buffer) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) return frames
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) {
      throw new Error(`invalid frame magic at byte ${offset}`)
    }
    offset += 4
    if (offset === buffer.length) return frames
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    if ((descriptor & 24) !== 0) throw new Error(`reserved frame-header bit at byte ${offset - 1}`)
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 32) !== 0
    const dictionaryFlag = descriptor & 3
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    if (buffer.length - offset < remainingHeaderBytes) return frames
    offset += remainingHeaderBytes
    for (;;) {
      if (buffer.length - offset < 3) return frames
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 3
      const blockSize = blockHeader >>> 3
      if (blockType === 3) throw new Error(`reserved block type at byte ${offset - 3}`)
      const payloadBytes = blockType === 1 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) return frames
      offset += payloadBytes
      if (lastBlock) {
        if ((descriptor & 4) !== 0) {
          if (buffer.length - offset < 4) return frames
          offset += 4
        }
        frames.push([start, offset])
        break
      }
    }
  }
  return frames
}

/** 解码整个会话日志 → 事件对象数组（坏行跳过）。导出以便单测。 */
export function decodeSessionEvents(buffer) {
  const events = []
  for (const [start, end] of scanZstdFrames(buffer)) {
    const text = zstdDecompressSync(buffer.subarray(start, end)).toString('utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.length === 0) continue
      try {
        events.push(JSON.parse(trimmed))
      } catch {
        // 坏行（理论上不应出现）跳过，不让单行拖垮整个会话
      }
    }
  }
  return events
}

/* ------------------------------------------------------------------ *
 * 纯聚合：事件数组 → 单会话统计（导出以便单测）
 * ------------------------------------------------------------------ */

/** 毫秒时间戳 → 北京日期键 yyyy-mm-dd。 */
export function beijingDayKey(ms) {
  return new Date(ms + BEIJING_OFFSET_MS).toISOString().slice(0, 10)
}

function emptyBucket() {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 0 }
}

function addUsage(bucket, usage) {
  bucket.inputTokens += usage.inputTokens || 0
  bucket.outputTokens += usage.outputTokens || 0
  bucket.cacheReadTokens += usage.cacheReadTokens || 0
  bucket.cacheWriteTokens += usage.cacheWriteTokens || 0
  bucket.reasoningTokens += usage.reasoningTokens || 0
  bucket.requests += 1
}

function bucketOf(map, key) {
  let bucket = map.get(key)
  if (bucket === undefined) {
    bucket = emptyBucket()
    map.set(key, bucket)
  }
  return bucket
}

function toolBucketOf(map, key) {
  let bucket = map.get(key)
  if (bucket === undefined) {
    bucket = { calls: 0, ms: 0 }
    map.set(key, bucket)
  }
  return bucket
}

/**
 * 折叠一个会话的全部事件。
 * 模型归属：usage 记在"最近一次 request/header"的 provider/model 名下；
 * 工具耗时按 callId 配对 tool/call → tool/result；llmMs 按 step/start → assistant/message。
 */
export function aggregateSession(events) {
  const meta = { id: null, cwd: null, createdAt: null, preset: null, parentSession: null, delegationDepth: null, origin: null }
  let title = null
  let currentModel = 'unknown'
  const models = new Map()
  const days = new Map()
  const modelDays = new Map() // 'model|day' → bucket（按模型×按日联合分桶，供时间范围过滤）
  const hours = new Map() // 'YYYY-MM-DDTHH' → bucket（v0.3.0 多粒度趋势：小时级，最近 7d 滚动）
  const modelHours = new Map() // 'model|hourKey' → bucket（v0.3.0：按模型×小时联合分桶）
  const minutes = new Map() // 'YYYY-MM-DDTHH:mm' → bucket（v0.3.0：分钟级，最近 24h 滚动）
  const modelMinutes = new Map() // 'model|minuteKey' → bucket（v0.3.0：按模型×分钟联合分桶）
  const tools = new Map() // name -> { calls, ms }
  const pendingCalls = new Map() // callId -> { name, time }
  const callNames = new Map() // callId -> name（tool/result 里没有名字，靠这里补）
  let openStep = null // { turn, step, time }
  let llmMs = 0
  let toolMs = 0
  let steps = 0
  let turns = 0
  let lastTs = null

  for (const event of events) {
    if (typeof event.time === 'number' && event.time > (lastTs ?? 0)) lastTs = event.time
    switch (event.type) {
      case 'session':
        meta.id = event.id ?? meta.id
        meta.cwd = event.cwd ?? meta.cwd
        meta.createdAt = event.createdAt ?? meta.createdAt
        meta.preset = event.agentPreset ?? meta.preset
        // v0.3.0 子代理归并依据（DSH session header schema：parentSession
        // / delegationDepth / origin 三个字段见 dsh-session-persistence-jsonl
        // README § SessionHeader）。缺失 delegationDepth 时按 parentSession
        // 推断（顶层 = 0），兼容 v0.2.x 之前生成的旧会话日志。
        meta.parentSession = event.parentSession ?? meta.parentSession
        meta.delegationDepth = typeof event.delegationDepth === 'number'
          ? event.delegationDepth
          : (meta.parentSession == null ? 0 : Math.max(1, meta.delegationDepth || 0))
        meta.origin = event.origin ?? meta.origin
        break
      case 'session/title':
        if (typeof event.data?.title === 'string' && event.data.title.length > 0) title = event.data.title
        break
      case 'request/header': {
        const config = event.data?.header?.config
        const provider = typeof config?.provider === 'string' ? config.provider : 'unknown-provider'
        const model = typeof config?.model === 'string' ? config.model : 'unknown-model'
        currentModel = `${provider}/${model}`
        break
      }
      case 'step/start':
        openStep = { turn: event.data?.turn, step: event.data?.step, time: event.time }
        break
      case 'assistant/message': {
        const usage = event.data?.usage
        // 必须同时有 usage 与 number time 才能归属到任何桶：
        //  - 缺 time 时 `beijingDayKey(event.time ?? 0)` 会落到 `1970-01-01`
        //    污染按日 / 按小时 / 按分钟三个粒度的真实数据（历史上累积几个无
        //    time 的事件就能把"今天用了 0 token"显示成"1970-01-01 用了 N token"）。
        // 修复方式：缺 time 的事件直接不写入任何桶，但 llmMs 计算仍允许
        // （用 `?? 0` 不会让 llmMs 变成负数）。
        if (usage != null && typeof event.time === 'number') {
          addUsage(bucketOf(models, currentModel), usage)
          const day = beijingDayKey(event.time)
          addUsage(bucketOf(days, day), usage)
          addUsage(bucketOf(modelDays, `${currentModel}|${day}`), usage)
          // v0.3.0 多粒度趋势：同时写入小时 / 分钟桶（北京时间对齐）
          const dt = new Date(event.time + BEIJING_OFFSET_MS)
          const pad = function (n) { return String(n).padStart(2, "0") }
          const hourKey = day + "T" + pad(dt.getUTCHours())
          const minuteKey = hourKey + ":" + pad(dt.getUTCMinutes())
          addUsage(bucketOf(hours, hourKey), usage)
          addUsage(bucketOf(modelHours, currentModel + "|" + hourKey), usage)
          addUsage(bucketOf(minutes, minuteKey), usage)
          addUsage(bucketOf(modelMinutes, currentModel + "|" + minuteKey), usage)
        }
        if (openStep != null && openStep.turn === event.data?.turn && openStep.step === event.data?.step) {
          llmMs += Math.max(0, (event.time ?? 0) - openStep.time)
          openStep = null
        }
        break
      }
      case 'tool/call': {
        const name = typeof event.data?.name === 'string' ? event.data.name : 'unknown'
        toolBucketOf(tools, name).calls += 1
        const callId = event.data?.callId
        // 缺 callId 时仍计入工具调用次数（保证 top tools 准确），但不写
        // pendingCalls/callNames——否则 undefined 键会让后续任何
        // `tool/result` 都错误地"匹配"到第一个 undefined callId 上，
        // 把别人的耗时算到错误工具的 ms 上。
        if (callId != null) {
          callNames.set(callId, name)
          if (event.time != null) pendingCalls.set(callId, event.time)
        }
        break
      }
      case 'tool/result': {
        const callId = event.data?.message?.source?.callId
        const dispatched = pendingCalls.get(callId)
        if (dispatched !== undefined) {
          pendingCalls.delete(callId)
          const elapsed = Math.max(0, (event.time ?? 0) - dispatched)
          toolMs += elapsed
          toolBucketOf(tools, callNames.get(callId) ?? 'unknown').ms += elapsed
          callNames.delete(callId)
        }
        break
      }
      case 'step/end':
        steps += 1
        openStep = null
        break
      case 'turn/end':
        turns += 1
        break
      default:
        break
    }
  }

  const totals = emptyBucket()
  for (const bucket of models.values()) {
    totals.inputTokens += bucket.inputTokens
    totals.outputTokens += bucket.outputTokens
    totals.cacheReadTokens += bucket.cacheReadTokens
    totals.cacheWriteTokens += bucket.cacheWriteTokens
    totals.reasoningTokens += bucket.reasoningTokens
    totals.requests += bucket.requests
  }
  return {
    id: meta.id,
    cwd: meta.cwd,
    createdAt: meta.createdAt,
    preset: meta.preset,
    parentSession: meta.parentSession,
    delegationDepth: meta.delegationDepth,
    origin: meta.origin,
    title,
    lastTs,
    models: Object.fromEntries(models),
    days: Object.fromEntries(days),
    modelDays: Object.fromEntries(modelDays),
    hours: Object.fromEntries(hours),
    modelHours: Object.fromEntries(modelHours),
    minutes: Object.fromEntries(minutes),
    modelMinutes: Object.fromEntries(modelMinutes),
    tools: Object.fromEntries(tools),
    totals,
    steps,
    turns,
    llmMs,
    toolMs,
  }
}

/**
 * 工具耗时归属：tool/result 事件不含工具名，聚合主循环用 callId→name
 * 映射（callNames）在配对成功时补名字，见 aggregateSession。
 */

/* ------------------------------------------------------------------ *
 * 文件发现与缓存
 * ------------------------------------------------------------------ */

/** 解析 profile 根目录（loader 的 baseUrl 即 profile 目录）。 */
function profileRoot(ctx) {
  const base = ctx.baseUrl
  if (typeof base === 'string' && base.startsWith('file://')) return fileURLToPath(base)
  if (typeof base === 'string' && base.length > 0) return base
  return process.cwd()
}

async function pathExists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/**
 * 解析 DSH 主目录（含 sessions/ 的那个）。优先 DSH_HOME（官方
 * dsh-home-paths 的解析顺序），兜底 profile 根上溯两级（profiles/web → .dsh）。
 */
async function resolveDshHome(ctx) {
  const candidates = []
  try {
    const mod = await import('@deepseek-ai/dsh-home-paths')
    candidates.push(mod.resolveDshHome(undefined, process.env))
  } catch {
    // 包不可解析（非 profile 环境运行）→ 走环境变量与回推兜底
  }
  if (typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME.trim().length > 0) {
    candidates.push(process.env.DSH_HOME)
  }
  candidates.push(resolve(profileRoot(ctx), '..', '..'))
  for (const candidate of candidates) {
    if (await pathExists(join(candidate, 'sessions'))) return candidate
  }
  return null
}

/** 枚举 sessions 根下全部会话日志文件 → [{ id, path, isZstd }]。
 *  `id` 形如 `<projectDir>/<sessionDir>`：必须包含 projectDir 前缀以避免跨项目
 *  session 目录名撞车（同一台机器多个项目分别可能有 `session-XXX`，单用
 *  sessionDir.name 会让 cache.sessions[file.id] 互相覆盖，导致另一个项目的
 *  cached.agg 被错误命中，size/mtimeMs 假匹配时还会跳过重新解码）。
 */
async function collectSessionFiles(sessionsRoot) {
  const files = []
  let projectDirs = []
  try {
    projectDirs = await readdir(sessionsRoot, { withFileTypes: true })
  } catch {
    return files
  }
  for (const projectDir of projectDirs) {
    if (!projectDir.isDirectory()) continue
    let sessionDirs = []
    try {
      sessionDirs = await readdir(join(sessionsRoot, projectDir.name), { withFileTypes: true })
    } catch {
      continue
    }
    for (const sessionDir of sessionDirs) {
      if (!sessionDir.isDirectory() || !sessionDir.name.startsWith('session-')) continue
      for (const [filename, isZstd] of [['session.jsonl.zstd', true], ['session.jsonl', false]]) {
        const path = join(sessionsRoot, projectDir.name, sessionDir.name, filename)
        if (await pathExists(path)) {
          files.push({ id: projectDir.name + '/' + sessionDir.name, path, isZstd })
          break
        }
      }
    }
  }
  return files
}

async function loadCache(path) {
  try {
    const data = JSON.parse(await readFile(path, 'utf8'))
    if (data && data.version === CACHE_VERSION && data.sessions && typeof data.sessions === 'object') {
      return { sessions: data.sessions }
    }
  } catch {
    // 无缓存或损坏 → 空
  }
  return { sessions: {} }
}

async function saveCache(path, cache) {
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify({ version: CACHE_VERSION, sessions: cache.sessions }), 'utf8')
  await rename(tmp, path)
}

/* ------------------------------------------------------------------ *
 * 汇总
 * ------------------------------------------------------------------ */

function mergeBucket(target, source) {
  target.inputTokens += source.inputTokens || 0
  target.outputTokens += source.outputTokens || 0
  target.cacheReadTokens += source.cacheReadTokens || 0
  target.cacheWriteTokens += source.cacheWriteTokens || 0
  target.reasoningTokens += source.reasoningTokens || 0
  target.requests += source.requests || 0
}

function totalTokensOf(bucket) {
  return (
    (bucket.inputTokens || 0) +
    (bucket.outputTokens || 0) +
    (bucket.cacheReadTokens || 0) +
    (bucket.cacheWriteTokens || 0)
  )
}

/** 最近 DAY_WINDOW 天（北京时间）零填充的日序列。v0.3.0 改走 granularitySeries('day')。
 *  v0.3.3：输出元素同时给 `day` 和 `bucket` 两个 key，兼容老客户端读 `.day` 与 v0.3.3 客户端读 `.bucket`。
 */
function daySeries(roots) {
  // 兼容 v0.2.x 调用方（保持输出 shape 不变：{ day, bucket, ...bucket }）
  const series = granularitySeries(roots, 'day')
  return series.map(function (s) {
    return { day: s.bucket, bucket: s.bucket, inputTokens: s.inputTokens, outputTokens: s.outputTokens, cacheReadTokens: s.cacheReadTokens, cacheWriteTokens: s.cacheWriteTokens, reasoningTokens: s.reasoningTokens, requests: s.requests }
  })
}

/**
 * 把所有 aggs rollup 到 root main session（v0.3.0 子代理归并）。
 * root 定义：parentSession 为 null 的最顶层 main session（DSH session header schema
 * 见 dsh-session-persistence-jsonl README § SessionHeader：parentSession / delegationDepth）。
 * subagent token 全部归属 owner（caiyfa 描述："lands on its owner"），
 * 不摊销到祖先链上的每个 main session——caiyfa 强调 counts speak in main sessions only。
 *
 * 防环：rootIdOf 走 parentSession 链时用 Set 跟踪已访问节点；遇到 orphan subagent
 * （父不在本地）回退到自身 id（罕见，DSH 父会话跨 profile / 跨设备时）。
 */
function rollupByMainSession(aggs) {
  const byId = new Map()
  for (const agg of aggs) {
    if (agg.id != null) byId.set(agg.id, agg)
  }
  function rootIdOf(agg) {
    const seen = new Set()
    let cur = agg
    while (cur != null && cur.parentSession != null) {
      if (seen.has(cur.id)) break
      seen.add(cur.id)
      cur = byId.get(cur.parentSession)
    }
    return cur != null ? cur.id : (agg.id != null ? agg.id : null)
  }
  const rootIdMap = new Map()
  for (const agg of aggs) {
    if (agg.id != null) rootIdMap.set(agg.id, rootIdOf(agg))
  }
  const roots = new Map()
  function ensureRoot(rootId) {
    let r = roots.get(rootId)
    if (r == null) {
      r = {
        id: rootId,
        title: null,
        cwd: null,
        createdAt: null,
        preset: null,
        parentSession: null,
        delegationDepth: 0,
        origin: null,
        lastTs: null,
        models: new Map(),
        days: new Map(),
        modelDays: new Map(),
        hours: new Map(),
        modelHours: new Map(),
        minutes: new Map(),
        modelMinutes: new Map(),
        tools: new Map(),
        totals: emptyBucket(),
        steps: 0,
        turns: 0,
        llmMs: 0,
        toolMs: 0,
        childIds: [],
      }
      roots.set(rootId, r)
    }
    return r
  }
  // 先把 root 主会话本身的元数据拷过来（main session 是 parentSession === null 的）
  for (const agg of aggs) {
    if (agg.parentSession == null && agg.id != null) {
      const root = ensureRoot(agg.id)
      root.title = agg.title || root.title
      root.cwd = agg.cwd || root.cwd
      root.createdAt = agg.createdAt || root.createdAt
      root.preset = agg.preset || root.preset
      root.delegationDepth = agg.delegationDepth || 0
      root.origin = agg.origin || null
      if (typeof agg.lastTs === 'number' && (root.lastTs == null || agg.lastTs > root.lastTs)) {
        root.lastTs = agg.lastTs
      }
    }
  }
  // rollup 所有 bucket 到 root（含 main session 自身，counts speak in main sessions only）
  for (const agg of aggs) {
    const rootId = rootIdMap.get(agg.id)
    if (rootId == null) continue
    const root = ensureRoot(rootId)
    for (const [k, b] of Object.entries(agg.models || {})) {
      mergeBucket(bucketOf(root.models, k), b)
    }
    for (const [k, b] of Object.entries(agg.days || {})) {
      mergeBucket(bucketOf(root.days, k), b)
    }
    for (const [k, b] of Object.entries(agg.modelDays || {})) {
      const sep = k.indexOf('|')
      const m = k.slice(0, sep)
      const kk = k.slice(sep + 1)
      mergeBucket(bucketOf(root.modelDays, m + '|' + kk), b)
    }
    for (const [k, b] of Object.entries(agg.hours || {})) {
      mergeBucket(bucketOf(root.hours, k), b)
    }
    for (const [k, b] of Object.entries(agg.modelHours || {})) {
      const sep = k.indexOf('|')
      const m = k.slice(0, sep)
      const kk = k.slice(sep + 1)
      mergeBucket(bucketOf(root.modelHours, m + '|' + kk), b)
    }
    for (const [k, b] of Object.entries(agg.minutes || {})) {
      mergeBucket(bucketOf(root.minutes, k), b)
    }
    for (const [k, b] of Object.entries(agg.modelMinutes || {})) {
      const sep = k.indexOf('|')
      const m = k.slice(0, sep)
      const kk = k.slice(sep + 1)
      mergeBucket(bucketOf(root.modelMinutes, m + '|' + kk), b)
    }
    for (const [k, b] of Object.entries(agg.tools || {})) {
      const tb = toolBucketOf(root.tools, k)
      tb.calls += b.calls || 0
      tb.ms += b.ms || 0
    }
    mergeBucket(root.totals, agg.totals)
    root.steps += agg.steps || 0
    root.turns += agg.turns || 0
    root.llmMs += agg.llmMs || 0
    root.toolMs += agg.toolMs || 0
    if (agg.id !== rootId && agg.id != null) {
      root.childIds.push(agg.id)
    }
    if (typeof agg.lastTs === 'number' && (root.lastTs == null || agg.lastTs > root.lastTs)) {
      root.lastTs = agg.lastTs
    }
  }
  return roots
}

/**
 * 多粒度趋势序列（v0.3.0）：
 *   'minute' — 最近 24h（分钟级，1440 桶）
 *   'hour'   — 最近 7d（小时级，168 桶）
 *   'day'    — 最近 30d（日级）
 *   'week'   — 全部数据按周折叠（ISO week，周一为周开始对齐北京时间约定）
 *
 * 输出 bucket shape：{ bucket: 'YYYY-MM-DD' | 'YYYY-MM-DDTHH' | 'YYYY-MM-DDTHH:mm' | 'YYYY-MM-DD' (周), ...bucket }
 */
function granularitySeries(roots, granularity) {
  const list = [...roots.values()]
  const merged = new Map()
  if (granularity === 'minute') {
    for (const root of list) {
      for (const [k, b] of Object.entries(root.minutes || {})) {
        mergeBucket(bucketOf(merged, k), b)
      }
    }
  } else if (granularity === 'hour') {
    for (const root of list) {
      for (const [k, b] of Object.entries(root.hours || {})) {
        mergeBucket(bucketOf(merged, k), b)
      }
    }
  } else if (granularity === 'day') {
    for (const root of list) {
      for (const [k, b] of Object.entries(root.days || {})) {
        mergeBucket(bucketOf(merged, k), b)
      }
    }
  } else if (granularity === 'week') {
    // 周：把 days 折叠到 ISO 周一对应的日期 key
    for (const root of list) {
      for (const [k, b] of Object.entries(root.days || {})) {
        const parts = k.split('-')
        const dt = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]))
        const dow = (dt.getUTCDay() + 6) % 7 // 周一=0, 周日=6
        const wkMs = dt.getTime() - dow * 86400000
        const wk = beijingDayKey(wkMs)
        mergeBucket(bucketOf(merged, wk), b)
      }
    }
  } else {
    return []
  }

  const out = []
  if (granularity === 'week') {
    // 周：按 key 升序输出，不零填充（历史数据可能不连续）
    const keys = [...merged.keys()].sort()
    for (const k of keys) out.push({ bucket: k, ...merged.get(k) })
    return out
  }
  // 分钟 / 小时 / 日：零填充对齐到当前 bucket 末
  const now = Date.now()
  const stepMs = granularity === 'minute' ? 60 * 1000 : (granularity === 'hour' ? 3600 * 1000 : 24 * 3600 * 1000)
  const windowMs = granularity === 'minute' ? 24 * 3600 * 1000 : (granularity === 'hour' ? 7 * 24 * 3600 * 1000 : DAY_WINDOW * 24 * 3600 * 1000)
  const steps = Math.floor(windowMs / stepMs)
  const anchorMs = now - (now % stepMs)
  function keyFn(ms) {
    if (granularity === 'minute') {
      const dt = new Date(ms + BEIJING_OFFSET_MS)
      const pad = function (n) { return String(n).padStart(2, '0') }
      const day = beijingDayKey(ms)
      return day + 'T' + pad(dt.getUTCHours()) + ':' + pad(dt.getUTCMinutes())
    }
    if (granularity === 'hour') {
      const dt = new Date(ms + BEIJING_OFFSET_MS)
      const pad = function (n) { return String(n).padStart(2, '0') }
      const day = beijingDayKey(ms)
      return day + 'T' + pad(dt.getUTCHours())
    }
    return beijingDayKey(ms)
  }
  for (let i = steps - 1; i >= 0; i--) {
    const k = keyFn(anchorMs - i * stepMs)
    const b = merged.get(k) || emptyBucket()
    out.push({ bucket: k, ...b })
  }
  return out
}

function modelTable(aggs) {
  const merged = new Map()
  const sessionCounts = new Map()
  const perModelDays = new Map() // model -> Map(day -> bucket)
  for (const agg of aggs) {
    for (const [model, bucket] of Object.entries(agg.models || {})) {
      mergeBucket(bucketOf(merged, model), bucket)
      sessionCounts.set(model, (sessionCounts.get(model) || 0) + 1)
    }
    for (const [key, bucket] of Object.entries(agg.modelDays || {})) {
      const sep = key.indexOf('|')
      const model = key.slice(0, sep)
      const day = key.slice(sep + 1)
      let byDay = perModelDays.get(model)
      if (byDay === undefined) {
        byDay = new Map()
        perModelDays.set(model, byDay)
      }
      mergeBucket(bucketOf(byDay, day), bucket)
    }
  }
  return [...merged.entries()]
    .map(([model, bucket]) => ({
      model,
      sessions: sessionCounts.get(model) || 0,
      ...bucket,
      days: Object.fromEntries(perModelDays.get(model) ?? []),
    }))
    .sort((a, b) => totalTokensOf(b) - totalTokensOf(a))
}

function topSessions(aggs) {
  return aggs
    .filter((agg) => totalTokensOf(agg.totals) > 0)
    .map((agg) => ({
      id: agg.id,
      title: agg.title || '(无标题)',
      cwd: agg.cwd,
      createdAt: agg.createdAt,
      lastTs: agg.lastTs,
      steps: agg.steps,
      requests: agg.totals.requests,
      outputTokens: agg.totals.outputTokens,
      tokens: totalTokensOf(agg.totals),
    }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, TOP_SESSIONS)
}

function toolTable(aggs) {
  const merged = new Map()
  for (const agg of aggs) {
    for (const [name, bucket] of Object.entries(agg.tools || {})) {
      const entry = toolBucketOf(merged, name)
      entry.calls += bucket.calls || 0
      entry.ms += bucket.ms || 0
    }
  }
  return [...merged.entries()]
    .map(([name, entry]) => ({ name, calls: entry.calls, ms: entry.ms }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, TOP_TOOLS)
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

export function apply(ctx) {
  const cachePath = join(profileRoot(ctx), CACHE_FILENAME)
  let cache = { sessions: {} } // id -> { size, mtimeMs, agg }
  let inflight = null // 并发请求共享同一次计算
  let chain = Promise.resolve() // 串行化缓存写
  let homeDir = null

  // 启动时加载磁盘上的增量缓存。修复 v0.3.5 前的 bug：
  // `cache` 初始化为空对象后再没被 loadCache() 调用，导致每次 DSH 重启都会
  // 全量重解码所有 session 日志，缓存文件虽然写出去但永远读不回来。
  // `cacheReady` 门控所有 summary：第一次 HTTP 请求会等缓存加载完
  //（典型 < 100ms），避免并发请求与启动期 cache 写入的竞态（如果直接 await
  // cacheReady 再 buildSummary，第一次请求的 size/mtimeMs 假命中会在空 cache
  // 上发生）。
  const cacheReady = loadCache(cachePath)
    .then((c) => { cache = c })
    .catch(() => {})

  async function buildSummary(force) {
    const startedAt = Date.now()
    if (homeDir === null) homeDir = await resolveDshHome(ctx)
    if (homeDir === null) {
      return { ok: false, error: 'sessions-root-not-found' }
    }
    const files = await collectSessionFiles(join(homeDir, 'sessions'))
    const aggs = []
    const errors = []
    let decoded = 0
    let reused = 0
    let cacheDirty = false
    const liveIds = new Set()
    for (const file of files) {
      liveIds.add(file.id)
      try {
        const info = await stat(file.path)
        const cached = cache.sessions[file.id]
        // 防御：cached.agg 必须存在且是对象，否则视为 miss 重新解码。
        // 旧版本（v0.3.5 前）缓存几乎不会被读回，所以这条本来不触发；
        // 修了 cache load bug 之后，磁盘上的 v4 老缓存（不同 key 格式 +
        // 可能的半写入文件）才会被首次加载，必须把异常条目挡在入口。
        if (!force && cached && cached.agg && typeof cached.agg === 'object'
            && cached.size === info.size && cached.mtimeMs === info.mtimeMs) {
          aggs.push(cached.agg)
          reused += 1
          continue
        }
        const raw = await readFile(file.path)
        const events = file.isZstd ? decodeSessionEvents(raw) : parsePlainJsonl(raw)
        const agg = aggregateSession(events)
        if (agg.id == null) agg.id = file.id
        cache.sessions[file.id] = { size: info.size, mtimeMs: info.mtimeMs, agg }
        cacheDirty = true
        aggs.push(agg)
        decoded += 1
      } catch (error) {
        errors.push(`${file.id}: ${String(error && error.message ? error.message : error)}`)
      }
    }
    // 修剪已删除会话的缓存条目，防缓存文件无限膨胀
    for (const id of Object.keys(cache.sessions)) {
      if (!liveIds.has(id)) {
        delete cache.sessions[id]
        cacheDirty = true
      }
    }
    if (cacheDirty) {
      chain = chain
        .then(() => saveCache(cachePath, cache))
        .catch(() => {})
    }
    const totals = emptyBucket()
    let steps = 0
    let turns = 0
    let llmMs = 0
    let toolMs = 0
    // v0.3.0 子代理归并：所有聚合走 root main session（counts speak in main sessions only）
    const rootAggs = rollupByMainSession(aggs)
    const rootList = [...rootAggs.values()]
    for (const root of rootList) {
      mergeBucket(totals, root.totals)
      steps += root.steps || 0
      turns += root.turns || 0
      llmMs += root.llmMs || 0
      toolMs += root.toolMs || 0
    }
    return {
      ok: true,
      generatedAt: Date.now(),
      home: homeDir,
      // v0.3.0：sessionCount 改为 root 数（rollup 后）；保留 rawSessionCount 给高级排查
      sessionCount: rootList.length,
      rawSessionCount: aggs.length,
      decoded,
      reused,
      durationMs: Date.now() - startedAt,
      errors: errors.slice(0, MAX_ERRORS_REPORTED),
      totals,
      steps,
      turns,
      llmMs,
      toolMs,
      byDay: daySeries(rootList),
      // v0.3.0 多粒度趋势：四种粒度全部输出（客户端按用户选择显示一种）
      byTrend: {
        minute: granularitySeries(rootList, 'minute'),
        hour: granularitySeries(rootList, 'hour'),
        day: granularitySeries(rootList, 'day'),
        week: granularitySeries(rootList, 'week'),
      },
      byModel: modelTable(rootList),
      topSessions: topSessions(rootList),
      tools: toolTable(rootList),
    }
  }

  function summary(force) {
    if (inflight !== null) return inflight
    inflight = cacheReady
      .then(() => buildSummary(force))
      .catch((error) => ({ ok: false, error: String(error && error.message ? error.message : error) }))
      .finally(() => {
        inflight = null
      })
    return inflight
  }

  // 启动即预热一次（装好缓存，首次打开设置页就快）
  chain = chain.then(() => summary(false)).catch(() => {})

  ctx.webServer.register({
    kind: 'exact',
    path: API_SUMMARY,
    handler: (req, res) => {
      if (req.method !== 'GET') {
        json(res, 405, { ok: false, error: 'method-not-allowed' })
        return Promise.resolve()
      }
      const force = new URL(req.url, 'http://localhost').searchParams.get('force') === '1'
      return summary(force).then((payload) => {
        json(res, payload.ok ? 200 : 500, payload)
      })
    },
  })
}

function parsePlainJsonl(raw) {
  const events = []
  for (const line of raw.toString('utf8').split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue
    try {
      events.push(JSON.parse(trimmed))
    } catch {
      // 坏行跳过
    }
  }
  return events
}
