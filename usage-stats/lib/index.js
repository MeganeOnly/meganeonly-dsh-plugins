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
const CACHE_VERSION = 2 // v2：聚合新增 modelDays（模型×日联合分桶），旧缓存整体作废重算
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
  const meta = { id: null, cwd: null, createdAt: null, preset: null }
  let title = null
  let currentModel = 'unknown'
  const models = new Map()
  const days = new Map()
  const modelDays = new Map() // 'model|day' → bucket（按模型×按日联合分桶，供时间范围过滤）
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
        if (usage != null) {
          addUsage(bucketOf(models, currentModel), usage)
          const day = beijingDayKey(event.time ?? 0)
          addUsage(bucketOf(days, day), usage)
          addUsage(bucketOf(modelDays, `${currentModel}|${day}`), usage)
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
        callNames.set(event.data.callId, name)
        if (event.time != null) pendingCalls.set(event.data.callId, event.time)
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
    title,
    lastTs,
    models: Object.fromEntries(models),
    days: Object.fromEntries(days),
    modelDays: Object.fromEntries(modelDays),
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

/** 枚举 sessions 根下全部会话日志文件 → [{ id, path, isZstd }]。 */
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
          files.push({ id: sessionDir.name, path, isZstd })
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

/** 最近 DAY_WINDOW 天（北京时间）零填充的日序列。 */
function daySeries(aggs) {
  const merged = new Map()
  for (const agg of aggs) {
    for (const [day, bucket] of Object.entries(agg.days || {})) {
      mergeBucket(bucketOf(merged, day), bucket)
    }
  }
  const out = []
  const now = Date.now()
  for (let i = DAY_WINDOW - 1; i >= 0; i--) {
    const key = beijingDayKey(now - i * 24 * 3600 * 1000)
    const bucket = merged.get(key) || emptyBucket()
    out.push({ day: key, ...bucket })
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
        if (!force && cached && cached.size === info.size && cached.mtimeMs === info.mtimeMs) {
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
    for (const agg of aggs) {
      mergeBucket(totals, agg.totals)
      steps += agg.steps || 0
      turns += agg.turns || 0
      llmMs += agg.llmMs || 0
      toolMs += agg.toolMs || 0
    }
    return {
      ok: true,
      generatedAt: Date.now(),
      home: homeDir,
      sessionCount: aggs.length,
      decoded,
      reused,
      durationMs: Date.now() - startedAt,
      errors: errors.slice(0, MAX_ERRORS_REPORTED),
      totals,
      steps,
      turns,
      llmMs,
      toolMs,
      byDay: daySeries(aggs),
      byModel: modelTable(aggs),
      topSessions: topSessions(aggs),
      tools: toolTable(aggs),
    }
  }

  function summary(force) {
    if (inflight !== null) return inflight
    inflight = buildSummary(force)
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
