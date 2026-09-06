/**
 * dsh-usage-stats — Host 半端（作者：MeganeOnly）
 *
 * 使用统计：跨会话汇总 token 用量。数据源是 DSH 官方 session 查询层
 *（ctx.sessionQuery，由 web profile 加载的 dsh-session-query-sqlite 提供）。
 * 会话日志格式 / zstd 解压 / replay validation 全部由 framework 负责，plugin
 * 只在事件流上做业务聚合（aggregateSession 纯函数）。
 *
 * 聚合策略：每个会话按 (header.id, header.createdAt) 做增量缓存（profile 目录
 * .usage-stats-cache.json，临时文件 + rename 原子写），没变的直接用上次结果；
 * 汇总请求串行化（沿用 peak-hour-lock 的 promise chain 模式），并发请求共享一次计算。
 *
 * 对外 API：GET /api/usage-stats/summary（可选 ?force=1 忽略增量缓存强制重算）。
 *
 * v0.4.0 改造（DSH 0.1.2-rc.1 后）：用 ctx.sessionQuery 替代手写的 zstd 解码器
 * 与文件枚举 collectSessionFiles（v0.3.9 共 ~120 行手写代码删除）。跨项目
 * session 撞车的 identity 校验（v0.3.8 fileId 工程）由 framework 的 SessionId
 * 全局唯一性 + header.createdAt 双字段兜底，原 isUsableAggregate() 治本逻辑
 * 简化掉。sessionRollup 子代理归并仍 plugin 业务（counts speak in main sessions
 * only），但内部父链遍历改用 ctx.sessionQuery.traceSession() 替手写
 * byJsonIdByProject 工程。
 */
import { readFile, writeFile, rename } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

export const name = 'usage-stats'

// v0.4.0：注入 sessionQuery（web profile 已挂载 dsh-session-query-sqlite）。
// framework 内部已 dependencies（sessions / persistence），cordis 自动处理。
export const inject = ['webServer', 'sessionQuery']

const API_SUMMARY = '/api/usage-stats/summary'
const CACHE_FILENAME = '.usage-stats-cache.json'
// v3：跳过不暴露；v4：子代理归并 + hours/minutes 桶 + root main session rollup + granularitySeries。
// v5：缓存键从 `sessionDir.name` 升级为 `<projectDir>/<sessionDir>`，修复跨项目 session id
//     冲突（同一台机器多个项目各自有一个 `session-XXX` 目录时会互相覆盖 cached.agg）。
//     bump version 强制一次缓存作废重算，避免老 v4 缓存里的孤儿键污染新键空间。
// v6：rollupByMainSession 的实体键从 JSONL `agg.id` 升级为 `agg.fileId`（项目+sessionDir）。
//     v5 缓存里的 agg 没有 fileId 字段，强行读取会用 `agg.id` 作 identity，跨项目时仍会撞车。
//     bump version 到 6 让旧 v5 缓存一次性作废重算。
// v6.1（未 bump version）：固化 cached.agg "usable" 契约——之前只防 typeof === 'object'，
// v6.2（未 bump version，v0.3.9）：新增 byDayAll（root.days 合并、升序、不零填充）
//     字段。不 bump version：aggregateSession 输出的 agg.days 必然完整；byDayAll 是
//     客户端可选用字段，老 client 走 byDay 不受影响。
//     partial agg（如手编辑 / schema drift / 半写入）会让 rollupByMainSession / topSessions
//     访问 agg.totals.* 抛 "Cannot read properties of undefined"。修复两条：
//       1) 新增 isUsableAggregate() 在 cache hit 处挡 partial 入口（视为 miss 重解码）
//       2) rollupByMainSession / topSessions 内部对 agg.totals 兜底（defense in depth）
//     不 bump version：aggregateSession 写出的 agg 必然完整；只防御未来异常来源。
// v7（v0.4.0）：用 ctx.sessionQuery 替手写 zstd/collectSessionFiles；cache key 从
//     `<projectDir>/<sessionDir>` 升级为 header.id（DSH 保证 SessionId 全局唯一），
//     失效字段从 `(size, mtimeMs)` 升级为 `(header.createdAt)`。旧 v6 cache 里 fileId
//     形式的 key 仍被 `identityMatches` 兜底识别为 miss，bump version 让旧 v6 缓存
//     一次性作废重算。
const CACHE_VERSION = 7
const BEIJING_OFFSET_MS = 8 * 3600 * 1000 // 统计按北京时间分日（UTC+8 无夏令时）
const DAY_WINDOW = 30 // 按日趋势返回最近 30 天（含零填充）
const TOP_SESSIONS = 12
const TOP_TOOLS = 10
const MAX_ERRORS_REPORTED = 5

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

/**
 * 把任意输入安全收敛为有限数字：number + Number.isFinite → 原值；
 * 其他（NaN / Infinity / -Infinity / 字符串 / null / undefined / 对象 / 数组）一律返回 0。
 *
 * v0.3.7 新增：v0.3.6 的 `usage.X || 0` 只挡 undefined / null / 0 / ""，
 * 对 `Infinity` / `NaN` / `"abc"` / `"5"` 等仍会污染 bucket——具体：
 * - `NaN || 0` = `0`（NaN 视为 falsy，恰好兜住）
 * - `Infinity || 0` = `Infinity`（truthy，直传 → bucket 变 Infinity）
 * - `"5" || 0` = `"5"`（truthy → `bucket += "5"` → bucket 变 5，副作用：误接受脏数据）
 * - `"abc" || 0` = `"abc"`（truthy → bucket 变 NaN）
 *
 * 同样地，v0.3.6 的 `typeof event.time === 'number'` 守卫对 `NaN` / `Infinity`
 * 都判 true（typeof 都返回 'number'），让 NaN 事件穿透守卫去污染按日 / 按小时 /
 * 按分钟桶（`beijingDayKey(NaN)` → `"Invalid Da"` / `new Date(Infinity).toISOString()` →
 * `"Invalid Date"`），让 toolMs / llmMs 计算产生 NaN 让 UI 显示成 "NaN ms"。
 *
 * 收敛所有数字入口到 toFiniteNumber()，与上游 DSH session schema drift 隔离。
 */
function toFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function addUsage(bucket, usage) {
  bucket.inputTokens += toFiniteNumber(usage.inputTokens)
  bucket.outputTokens += toFiniteNumber(usage.outputTokens)
  bucket.cacheReadTokens += toFiniteNumber(usage.cacheReadTokens)
  bucket.cacheWriteTokens += toFiniteNumber(usage.cacheWriteTokens)
  bucket.reasoningTokens += toFiniteNumber(usage.reasoningTokens)
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

/**
 * v0.4.0.1：兼容 root bucket 字段的两种表示——
 *   - rollupByMainSession 输出的 root：Map（来自 ensureRoot 的 new Map()）
 *   - 旧测试 fixture / v0.3.x 风格的 rootList：Object（{ key: bucket }）
 * 用 for-of 迭代时直接 `[k, b]` 即可，O(1) 跳过类型判断。
 */
function entriesOf(m) {
  if (m instanceof Map) return m
  return Object.entries(m || {})
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
 *
 * v0.4.0：`id` 形参语义改为 SessionId（全局唯一），不再是 v0.3.8 的 fileId
 *（`<projectDir>/<sessionDir>`）—— DSH 的 SessionId 已经是 UUID randomBytes 生成，
 * 跨项目也唯一，不再需要 project 前缀。
 */
export function aggregateSession(events, id = null) {
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
    // 单行脏事件守卫：JSONL 里 `null` / 数字 / 字符串 / boolean / 数组都
    // 是合法 JSON 文本，能过 framework 的 decodeSessionEvents 的 try/catch
    // 进到聚合循环；不挡就会在 event.time / event.type 上抛 TypeError 把整会话
    // 拖垮。这里只接受普通对象（typeof === 'object' 且非 null 且非 Array.isArray），
    // 其他形态一律静默跳过——与 framework 的"坏行丢弃"语义一致。
    if (event == null || typeof event !== 'object' || Array.isArray(event)) continue
    if (Number.isFinite(event.time) && event.time > (lastTs ?? 0)) lastTs = event.time
    switch (event.type) {
      case 'session':
        meta.id = event.id ?? meta.id
        meta.cwd = event.cwd ?? meta.cwd
        meta.createdAt = event.createdAt ?? meta.createdAt
        meta.preset = event.agentPreset ?? meta.preset
        // v0.3.0 子代理归并依据（DSH session header schema：parentSession
        // / delegationDepth / origin 三个字段见 SessionHeader type）。
        // 缺失 delegationDepth 时按 parentSession 推断（顶层 = 0），
        // 兼容 v0.2.x 之前生成的旧会话日志。
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
        // v0.3.8：无 baseline 的 step/start 直接丢弃，不写 openStep——
        // 否则 openStep.time 收敛为 0，下一步真实 assistant/message 的
        // (event.time - 0) 就是 epoch ms，单事件就能把 llmMs 推到 1.7e12。
        // 守卫收紧到 Number.isFinite：undefined / null / NaN / Infinity
        // / 字符串 / 对象 一律视为无 baseline。
        if (Number.isFinite(event.time)) {
          openStep = { turn: event.data?.turn, step: event.data?.step, time: event.time }
        } else {
          openStep = null
        }
        break
      case 'assistant/message': {
        const usage = event.data?.usage
        // 必须同时有 usage 与有限数字 time 才能归属到任何桶：
        //  - 缺 time 时 `beijingDayKey(event.time ?? 0)` 会落到 `1970-01-01`
        //    污染按日 / 按小时 / 按分钟三个粒度的真实数据（历史上累积几个无
        //    time 的事件就能把"今天用了 0 token"显示成"1970-01-01 用了 N token"）。
        //  - NaN / Infinity 时间（typeof 仍是 number）会让 `beijingDayKey(NaN)` →
        //    `"Invalid Da"` / `new Date(Infinity).toISOString()` → `"Invalid Date"`
        //    污染同三个粒度。v0.3.7 守卫用 Number.isFinite。
        // 修复方式：time 非有限数字的事件不写入任何桶，但 llmMs 计算仍允许
        // （用 toFiniteNumber 兜底不会让 llmMs 变成 NaN）。
        if (usage != null && Number.isFinite(event.time)) {
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
          // v0.3.8：openStep 只在 step/start 持有限 baseline 时落地；
          // 这里的 toFiniteNumber(event.time) 仅挡 NaN/Infinity 等仍能让
          // 减法返回 NaN 的 event.time 形态（理论上 v0.3.7 后已极少见）。
          llmMs += Math.max(0, toFiniteNumber(event.time) - openStep.time)
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
          // v0.3.7：`event.time != null` 挡不住 NaN / Infinity（NaN != null = true;
          // Infinity != null = true），会让 tool/result 配对时 `(event.time ?? 0) - dispatched`
          // 产生 NaN 把 toolMs / 工具耗时污染成 NaN。这里要求 time 是有限数字才落 pendingCalls。
          if (Number.isFinite(event.time)) pendingCalls.set(callId, event.time)
        }
        break
      }
      case 'tool/result': {
        const callId = event.data?.message?.source?.callId
        const dispatched = pendingCalls.get(callId)
        if (dispatched !== undefined) {
          pendingCalls.delete(callId)
          // v0.3.7：toFiniteNumber 防御 event.time = NaN 时 elapsed 变 NaN，
          // 进而 toolMs / 工具耗时被 NaN 污染。
          const elapsed = Math.max(0, toFiniteNumber(event.time) - dispatched)
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
    id: meta.id ?? id,
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

/* ------------------------------------------------------------------ *
 * 缓存（profile 目录下 .usage-stats-cache.json）
 * ------------------------------------------------------------------ */

/**
 * 解析 profile 根目录（loader 的 baseUrl 即 profile 目录）。
 * v0.4.0：仍保留这个工具函数，因为 cache 文件路径仍写在 profile 根下，
 * 不在 framework 内部抽象里。
 */
function profileRoot(ctx) {
  const base = ctx.baseUrl
  if (typeof base === 'string' && base.startsWith('file://')) return fileURLToPath(base)
  if (typeof base === 'string' && base.length > 0) return base
  return process.cwd()
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
 *  v0.3.3：输出元素同时给 `day` 和 `bucket` 两个 key，兼容老客户端读端。
 */
function daySeries(roots) {
  // 兼容 v0.2.x 调用方（保持输出 shape 不变：{ day, bucket, ...bucket }）
  const series = granularitySeries(roots, 'day')
  return series.map(function (s) {
    return { day: s.bucket, bucket: s.bucket, inputTokens: s.inputTokens, outputTokens: s.outputTokens, cacheReadTokens: s.cacheReadTokens, cacheWriteTokens: s.cacheWriteTokens, reasoningTokens: s.reasoningTokens, requests: s.requests }
  })
}

/**
 * v0.3.9：把所有 root.days 合并到一份按日期升序、**不零填充**的日序列。
 * 给客户端「全部」图表与热力图使用：现版 byDay 是近 30 天零填充（受 DAY_WINDOW
 * 限制），几天没活动就会出现一长串 "今天用了 0 token" 的视觉断点；超过 30 天的
 * 历史更是完全丢失。byDayAll 把所有 root.days merge 后按 yyyy-mm-dd 升序输出，
 * 仅含历史上**真有用量**的天——客户端做 53 周裁剪后无论是「两年都没用了」还是
 * 「近 30 天没活动」都能正确显示。
 *
 * 不零填充是因为：图表与热力图已经在自身组件内做「空天 = 灰格」的处理；
 * 服务器端零填充会让 payload 多出 N 个空 bucket，浪费带宽且丧失"历史跨度"信号。
 *
 * 输出 shape 与 daySeries 一致：{ day, bucket, inputTokens, ... }，
 * bucket/day 双 field（对齐 v0.3.3 兼容性）。
 */
export function rootsDaysAll(rootList) {
  const merged = new Map()
  for (const root of rootList) {
    // v0.4.0.1：root.days 可能是 Map（rollup 输出）或 Object（fixture），
    // entriesOf() 兼容两者。修 v0.3.0 起的 `Object.entries(Map) = []` bug。
    for (const [k, b] of entriesOf(root.days)) {
      mergeBucket(bucketOf(merged, k), b)
    }
  }
  const keys = [...merged.keys()].sort()
  return keys.map(function (k) {
    const b = merged.get(k)
    return {
      day: k,
      bucket: k,
      inputTokens: b.inputTokens,
      outputTokens: b.outputTokens,
      cacheReadTokens: b.cacheReadTokens,
      cacheWriteTokens: b.cacheWriteTokens,
      reasoningTokens: b.reasoningTokens,
      requests: b.requests,
    }
  })
}

/**
 * 把所有 aggs rollup 到 root main session（v0.3.0 子代理归并）。
 * root 定义：parentSession 为 null 的最顶层 main session（DSH session header schema
 * 见 SessionHeader type：parentSession / delegationDepth）。subagent token 全部
 * 归属 owner（caiyfa 描述："lands on its owner"），不摊销到祖先链上的每个 main
 * session——caiyfa 强调 counts speak in main sessions only。
 *
 * v0.4.0.2 改造：plugin 自己用 buildSummary 顶部拿到的 `records`（每次 summary 只
 * 调一次 listSessions）做 parentSession chain walk，**不再调 framework 的
 * `sessionQuery.traceSession()`**。原因：framework traceSession 内部每次都
 * `await _corpus.listSessions()`（dsh-session-query/lib/index.js:1059），对 N 个
 * session rollup 调 N 次 traceSession = N×N 次 listSessions = O(N²) header
 * 解析，N=437 时实测 30s+ timeout / OOM。plugin 用 records 自己走链是 O(N+D)
 * （D 是 parentSession 链总深度），毫秒级。
 *
 * 防环：plugin 自己用 Set 跟踪已访问节点；orphan subagent（父不在 records）走
 * 自身 identity，与 v0.3.8 语义兼容。
 */
async function rollupByMainSession(aggs, records) {
  function identity(agg) {
    return agg.id // SessionId（v0.4.0）—— DSH 保证全局唯一
  }
  // 用 records 建 byId（O(N) 一次性）
  const byId = new Map()
  for (const r of records) byId.set(r.header.id, r)
  const rootIdMap = new Map()
  for (const agg of aggs) {
    const idn = identity(agg)
    if (idn == null) continue
    // 走 parentSession 链查 root（用 records map，O(depth) per call）
    const seen = new Set()
    let cur = byId.get(idn)
    while (cur != null && cur.header.parentSession != null) {
      if (seen.has(cur.header.id)) break
      seen.add(cur.header.id)
      cur = byId.get(cur.header.parentSession)
    }
    const rootId = cur != null ? cur.header.id : idn // orphan 回退自身
    rootIdMap.set(idn, rootId)
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
    if (agg.parentSession == null) {
      const idn = identity(agg)
      if (idn == null) continue
      const root = ensureRoot(idn)
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
    const idn = identity(agg)
    if (idn == null) continue
    const rootId = rootIdMap.get(idn)
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
    // v0.3.8.1 防御性兜底：agg.totals 缺失（如手编辑 / 半写入 / schema drift
    // 老缓存）用 emptyBucket() 顶替，避免 mergeBucket 访问 undefined.* 崩溃。
    mergeBucket(root.totals, agg.totals || emptyBucket())
    root.steps += agg.steps || 0
    root.turns += agg.turns || 0
    root.llmMs += agg.llmMs || 0
    root.toolMs += agg.toolMs || 0
    if (idn !== rootId) {
      root.childIds.push(idn)
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
 *
 * v0.3.8：`now` 形参导出给单测用（默认 `Date.now()`）。day 锚点对齐到
 * **Beijing 日界**——之前用 `now - (now % 86400000)` 对齐 UTC 午夜，
 * 在 Beijing 16:00–24:00 UTC 时（= 当日 Beijing 00:00–08:00），
 * anchor 对应的 Beijing day 还是"昨天"，今天的 bucket 永远不出现。
 * 统一公式 `anchorMs = now - ((now + BEIJING_OFFSET_MS) % stepMs)` 对
 * minute/hour 等价于原版（BEIJING_OFFSET_MS 是 60_000 / 3_600_000 的整数倍），
 * 仅修正 day 锚点。
 */
export function granularitySeries(roots, granularity, now = Date.now()) {
  const list = [...roots.values()]
  const merged = new Map()
  if (granularity === 'minute') {
    for (const root of list) {
      // v0.4.0.1：root.* 字段是 Map（rollup 输出）或 Object（fixture）；
      // entriesOf() 兼容两者。修 v0.3.0 起的 `Object.entries(Map) = []` bug。
      for (const [k, b] of entriesOf(root.minutes)) {
        mergeBucket(bucketOf(merged, k), b)
      }
    }
  } else if (granularity === 'hour') {
    for (const root of list) {
      for (const [k, b] of entriesOf(root.hours)) {
        mergeBucket(bucketOf(merged, k), b)
      }
    }
  } else if (granularity === 'day') {
    for (const root of list) {
      for (const [k, b] of entriesOf(root.days)) {
        mergeBucket(bucketOf(merged, k), b)
      }
    }
  } else if (granularity === 'week') {
    // 周：把 days 折叠到 ISO 周一对应的日期 key
    for (const root of list) {
      for (const [k, b] of entriesOf(root.days)) {
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
  const stepMs = granularity === 'minute' ? 60 * 1000 : (granularity === 'hour' ? 3600 * 1000 : 24 * 3600 * 1000)
  const windowMs = granularity === 'minute' ? 24 * 3600 * 1000 : (granularity === 'hour' ? 7 * 24 * 3600 * 1000 : DAY_WINDOW * 24 * 3600 * 1000)
  const steps = Math.floor(windowMs / stepMs)
  // v0.3.8：Beijing 日界对齐。BEIJING_OFFSET_MS 是 8h，对 minute(60s) / hour(3600s)
  // 都是整数倍 → `((now + BEIJING_OFFSET_MS) % stepMs)` 与 `(now % stepMs)`
  // 相等；只对 day 真正改变 anchor。详见文档注释。
  const anchorMs = now - ((now + BEIJING_OFFSET_MS) % stepMs)
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
    // v0.4.0.1：aggs 是 rootList（rollup 输出，Map），或旧 fixture（Object），
    // entriesOf() 兼容两者。修 v0.3.0 起的 `Object.entries(Map) = []` bug。
    for (const [model, bucket] of entriesOf(agg.models)) {
      mergeBucket(bucketOf(merged, model), bucket)
      sessionCounts.set(model, (sessionCounts.get(model) || 0) + 1)
    }
    for (const [key, bucket] of entriesOf(agg.modelDays)) {
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
    // v0.3.8.1：agg.totals 缺失时（schema drift / 半写入 / 手编辑缓存），
    // filter 用 (agg.totals || emptyBucket()) 兜底，避免 totalTokensOf 抛
    // "Cannot read properties of undefined"。
    .filter((agg) => totalTokensOf(agg.totals || emptyBucket()) > 0)
    .map((agg) => {
      const totals = agg.totals || emptyBucket()
      return {
        id: agg.id,
        title: agg.title || '(无标题)',
        cwd: agg.cwd,
        createdAt: agg.createdAt,
        lastTs: agg.lastTs,
        steps: agg.steps,
        requests: totals.requests,
        outputTokens: totals.outputTokens,
        tokens: totalTokensOf(totals),
      }
    })
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, TOP_SESSIONS)
}

function toolTable(aggs) {
  const merged = new Map()
  for (const agg of aggs) {
    // v0.4.0.1：aggs 是 rootList（Map）或旧 fixture（Object），entriesOf() 兼容
    for (const [name, bucket] of entriesOf(agg.tools)) {
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
  let cache = { sessions: {} } // SessionId -> { createdAt: number, agg: agg }
  // v0.3.8.2：inflight 改为 `{ force, promise }`，按 force 标志分别共享——
  // 旧版 `if (inflight !== null) return inflight` 不分 force，force=1 在 prewarm
  // (summary(false)) 进行中会被吞，复用 prewarm 的 regular build 结果（cache hit），
  // 而不是用户显式要求的强制重算。规则：
  //   - 普通请求（!force）可复用任意 inflight（含 force）
  //   - force 请求遇 force inflight → 共享
  //   - force 请求遇 regular inflight → 等其结束后再启动一次 force build
  let inflight = null // { force: boolean, promise: Promise } | null
  let chain = Promise.resolve() // 串行化缓存写
  // v0.4.0：homeDir 由 ctx.sessionQuery 内部解决（listSessions 自带 listPersisted），
  // 不再需要 plugin 自己 resolveDshHome。

  // 启动时加载磁盘上的增量缓存。修复 v0.3.5 前的 bug：
  // `cache` 初始化为空对象后再没被 loadCache() 调用，导致每次 DSH 重启都会
  // 全量重解码所有 session 日志，缓存文件虽然写出去但永远读不回来。
  // `cacheReady` 门控所有 summary：第一次 HTTP 请求会等缓存加载完
  // （典型 < 100ms），避免并发请求与启动期 cache 写入的竞态。
  const cacheReady = loadCache(cachePath)
    .then((c) => { cache = c })
    .catch(() => {})

  // v0.4.0.3：plugin 自己 cache framework `listSessions()` 结果。
  // 原因：framework listSessions 走 dsh-session-persistence-jsonl/lib/index.js:1125
  // `listArtifacts()`，对每个 session 调 `readFirstZstdLine`（zstd 解压第一个
  // frame）取 header 第一行——437 sessions × ~70ms / zstd frame = 30+ 秒 / 次。
  // plugin 每次 summary 都调 listSessions = 用户每次刷新都等 30s。修法：
  //   - 第一次（force / cache miss / 启动）调一次 listSessions 写入 module cache
  //   - 之后 summary 复用 module cache records（in-memory，< 1ms）
  //   - 强制重算（force=true）跳过 cache 重新 list——用户显式触发可接受 30s
  //   - records 是 SessionRecord 引用（已结构化克隆），不可变，跨调用复用安全
  //
  // v0.4.1 改造：加 TTL 失效。v0.4.0.3 后 bug 报告——DSH 启动之后新生成的
  // session 永远进不了 recordsCache（module cache 只在 force / 首次 refresh），
  // 进而 cache.sessions 不会增长，cacheDirty=false，saveCache 永远不触发。
  // 用户实测："这两天经常使用，但统计里显示是 0"——plugin 进程不重启 recordsCache
  // 永不过期，9/6 00:54 之后所有 session（包括 subagent rollup 的 owner main）
  // 都不在 recordsCache 里，summary 完全不知道有这些 session。
  //
  // 修法：RECORDS_CACHE_TTL_MS=30s 内复用 listSessions 结果（同 v0.4.0.3 优化），
  // 超过 TTL 后下一次 summary 自动重新 listSessions（30s 一次"用户感知延迟"
  // 比"30s 一次 + 完全失明"好得多）。force=true 立即重新 list。
  const RECORDS_CACHE_TTL_MS = 30 * 1000
  let recordsCache = null // SessionRecord[] | null
  let recordsCacheFetchedAt = 0 // Date.now() at last listSessions
  let recordsCacheForce = false // 上次是不是 force 写的（用于 telemetry）

  async function getRecords(force) {
    const now = Date.now()
    if (force || recordsCache === null || (now - recordsCacheFetchedAt) >= RECORDS_CACHE_TTL_MS) {
      recordsCache = await ctx.sessionQuery.listSessions()
      recordsCacheFetchedAt = now
      recordsCacheForce = force
    }
    return recordsCache
  }

  async function buildSummary(force) {
    const startedAt = Date.now()
    const records = await getRecords(force)
    const aggs = []
    const errors = []
    let decoded = 0
    let reused = 0
    let cacheDirty = false
    const liveIds = new Set()
    // [perf v0.4.x] cache miss 的 session 并发 readSession + aggregate——
    // 原串行 N 次 readSession 串行 await 对 N 较大的项目（437 sessions）实测 30s+
    // timeout。这里走 Promise.all，cached 与 needs-read 分两轮，单次 round-trip ≈ 1×readSession。
    const missRecords = []
    for (const record of records) {
      const id = record.header.id
      liveIds.add(id)
      const cached = cache.sessions[id]
      if (!force && cached && cached.createdAt === record.header.createdAt && cached.agg && typeof cached.agg === 'object') {
        aggs.push(cached.agg)
        reused += 1
        continue
      }
      missRecords.push(record)
    }
    if (missRecords.length > 0) {
      const settled = await Promise.allSettled(missRecords.map((record) => ctx.sessionQuery.readSession(record.header.id)))
      for (let mi = 0; mi < missRecords.length; mi++) {
        const record = missRecords[mi]
        const id = record.header.id
        const result = settled[mi]
        if (result.status !== 'fulfilled') {
          const reason = result.reason
          errors.push(`${id}: ${String(reason && reason.message ? reason.message : reason)}`)
          continue
        }
        const log = result.value
        // v0.4.0：events 已由 framework 的 replay-validate 校过（partial / 坏行
        // 不会到达这里）；aggregateSession 内部的守卫保留作为 defense in depth。
        const agg = aggregateSession(log.events, log.session.id)
        cache.sessions[id] = { createdAt: record.header.createdAt, agg }
        cacheDirty = true
        aggs.push(agg)
        decoded += 1
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
    // v0.4.0：async rollupByMainSession 内部走 ctx.sessionQuery.traceSession()
    const rootAggs = await rollupByMainSession(aggs, records)
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
      // v0.4.0：删除 home 字段（plugin 不再自己解析 DSH home，路径由 framework 管理）
      // sessionCount 改为 root 数（rollup 后）；保留 rawSessionCount 给高级排查
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
      // v0.3.9：历史全量日序列（root.days 合并、升序、不零填充），给
      // 「全部」图表与热力图使用——现版 byDay 是近 30 天零填充，超过 30 天的
      // 历史完全丢失。老 client（v0.3.8.x 之前）只看 byDay 不会受影响。
      byDayAll: rootsDaysAll(rootList),
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
    // 普通请求（!force）：复用任意 inflight（spec 要求"普通请求可复用 force inflight"）
    if (!force && inflight !== null) return inflight.promise
    // force 请求遇 force inflight：共享
    if (force && inflight !== null && inflight.force) return inflight.promise
    // force 请求遇 regular inflight：等其结束后再启动一次 force build
    if (force && inflight !== null && !inflight.force) {
      const prev = inflight.promise
      // 无论 prev 成功 / 失败都启动 force（用户显式要求，不应被 prewarm 失败吞掉）
      const chained = prev.then(() => buildSummary(true), () => buildSummary(true))
      const wrapped = chained.catch((error) => ({ ok: false, error: String(error && error.message ? error.message : error) }))
      const entry = { force: true, promise: wrapped }
      inflight = entry
      wrapped.finally(() => {
        if (inflight === entry) inflight = null
      })
      return wrapped
    }
    // 无 inflight：开新 build
    const promise = cacheReady
      .then(() => buildSummary(force))
      .catch((error) => ({ ok: false, error: String(error && error.message ? error.message : error) }))
    const entry = { force, promise }
    inflight = entry
    promise.finally(() => {
      if (inflight === entry) inflight = null
    })
    return promise
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