/**
 * dsh-usage-stats — 折叠内核（v0.5.0）
 *
 * 把一个会话的事件流折叠成聚合状态。与 v0.4.x 的 `aggregateSession` 相比，
 * 这里把"一次性全量折叠"拆成可**续跑**的形式：
 *
 *   createFoldState(id) ──► foldEvents(fold, 新事件) ──► fold.agg（同一对象，原地更新）
 *
 * 续跑靠 `fold.lastSeq` 水位：seq ≤ 水位的事件被丢弃（幂等，重读同一段字节无副作用）；
 * 出现 seq 空洞（框架压缩/替换事件）时立即返回 `gap`，由调用方对该会话做一次
 * 作用域内全量重折叠 —— 只重算这一个会话，不波及其它。
 *
 * 保留量裁剪 `pruneBuckets` 只在写记录前调用（见 scan.js）：分钟桶 48h、
 * 小时桶 15d、日/模型×日/工具永久，避免 v0.4.x 那种"分钟桶永久累积"的无界增长。
 * `aggregateSession` 兼容包装**不裁剪**，保持 v0.4.x 输出形状，现有测试零改动。
 *
 * 数值硬化沿用 v0.3.6-v0.3.8 的全部守卫：所有数字入口经 toFiniteNumber，
 * 时间戳必须 Number.isFinite，脏事件不得污染任何桶（详见各分支注释）。
 */

import { BEIJING_OFFSET_MS, MINUTE_KEEP_MS, HOUR_KEEP_MS } from './constants.js'

/* ------------------------------------------------------------------ *
 * 桶与数字工具（rollup.js / series.js 共用）
 * ------------------------------------------------------------------ */

/** 毫秒时间戳 → 北京日期键 yyyy-mm-dd。 */
export function beijingDayKey(ms) {
  return new Date(ms + BEIJING_OFFSET_MS).toISOString().slice(0, 10)
}

/** 空桶（五个 token 字段 + 请求数）。 */
export function emptyBucket() {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 0 }
}

/**
 * 把任意输入安全收敛为有限数字：number + Number.isFinite → 原值；
 * 其他（NaN / Infinity / -Infinity / 字符串 / null / undefined / 对象 / 数组）一律返回 0。
 *
 * 收敛所有数字入口，与上游 DSH session schema drift 隔离：
 * `NaN || 0` 恰好兜住，但 `Infinity || 0` / `"5" || 0` / `"abc" || 0` 都会污染桶。
 */
export function toFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** 桶字段累加（含 requests）。 */
export function addUsage(bucket, usage) {
  bucket.inputTokens += toFiniteNumber(usage.inputTokens)
  bucket.outputTokens += toFiniteNumber(usage.outputTokens)
  bucket.cacheReadTokens += toFiniteNumber(usage.cacheReadTokens)
  bucket.cacheWriteTokens += toFiniteNumber(usage.cacheWriteTokens)
  bucket.reasoningTokens += toFiniteNumber(usage.reasoningTokens)
  bucket.requests += 1
}

/** 桶合并（rollup / 系列聚合用）。 */
export function mergeBucket(target, source) {
  target.inputTokens += source.inputTokens || 0
  target.outputTokens += source.outputTokens || 0
  target.cacheReadTokens += source.cacheReadTokens || 0
  target.cacheWriteTokens += source.cacheWriteTokens || 0
  target.reasoningTokens += source.reasoningTokens || 0
  target.requests += source.requests || 0
}

/** 桶总量：input + output + cacheRead + cacheWrite（reasoning ⊂ output，不重复计）。 */
export function totalTokensOf(bucket) {
  return (
    (bucket.inputTokens || 0) +
    (bucket.outputTokens || 0) +
    (bucket.cacheReadTokens || 0) +
    (bucket.cacheWriteTokens || 0)
  )
}

/**
 * 会污染原型链的键名：模型名 / day key 理论上不会命中，但记录来自磁盘 JSON，
 * 一律走 defineProperty 写入，避免 `map[key] = x` 在 `__proto__` 上改写原型。
 */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/** 取（必要时新建）普通对象里的桶。 */
export function bucketOf(map, key) {
  let bucket = Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined
  if (bucket === undefined) {
    bucket = emptyBucket()
    if (UNSAFE_KEYS.has(key)) {
      Object.defineProperty(map, key, { value: bucket, enumerable: true, writable: true, configurable: true })
    } else {
      map[key] = bucket
    }
  }
  return bucket
}

/** 取（必要时新建）工具桶 { calls, ms }。 */
export function toolBucketOf(map, key) {
  let bucket = Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined
  if (bucket === undefined) {
    bucket = { calls: 0, ms: 0 }
    if (UNSAFE_KEYS.has(key)) {
      Object.defineProperty(map, key, { value: bucket, enumerable: true, writable: true, configurable: true })
    } else {
      map[key] = bucket
    }
  }
  return bucket
}

/**
 * 兼容 root 字段的两种表示：rollup 输出的 Map，或旧 fixture / 缓存里的 Object。
 * 用 for-of 迭代时直接 `[k, b]` 即可，O(1) 跳过类型判断。
 */
export function entriesOf(m) {
  if (m instanceof Map) return m
  return Object.entries(m || {})
}

/* ------------------------------------------------------------------ *
 * 折叠状态
 * ------------------------------------------------------------------ */

/** 空聚合体（形状与 v0.4.x aggregateSession 的输出一致，外加 watermark 字段）。 */
export function emptyAgg(id = null) {
  return {
    id,
    cwd: null,
    createdAt: null,
    preset: null,
    parentSession: null,
    delegationDepth: null,
    origin: null,
    title: null,
    lastTs: null,
    models: {},
    days: {},
    modelDays: {},
    hours: {},
    modelHours: {},
    minutes: {},
    modelMinutes: {},
    tools: {},
    totals: emptyBucket(),
    steps: 0,
    turns: 0,
    llmMs: 0,
    toolMs: 0,
    /** 已折叠的最大事件 seq（-1 = 尚未见过任何带 seq 的事件）。 */
    lastSeq: -1,
  }
}

/**
 * 新建折叠状态。`pendingCalls` / `callNames` 只活在一次折叠的生命周期里
 * （tool/call 与 tool/result 可能跨帧），永不落盘，因此用 Map 更合适。
 */
export function createFoldState(id = null) {
  return {
    agg: emptyAgg(id),
    currentModel: 'unknown',
    openStep: null,
    pendingCalls: new Map(),
    callNames: new Map(),
  }
}

/* ------------------------------------------------------------------ *
 * 事件应用
 * ------------------------------------------------------------------ */

/**
 * 应用一条事件到折叠状态（原地更新 fold.agg）。
 *
 * @returns {'applied'|'duplicate'|'gap'|'skipped'}
 *   duplicate = seq ≤ 水位（重读同一段字节）；gap = seq 空洞（需全量重折叠该会话）；
 *   skipped = 形态非法（null / 非对象 / 数组）。
 */
export function applyEvent(fold, event) {
  if (event == null || typeof event !== 'object' || Array.isArray(event)) return 'skipped'
  const agg = fold.agg
  const hasSeq = Number.isFinite(event.seq)

  // 水位只对"带 seq 的事件"生效：DSH 日志里 header 行没有 seq（首帧首行），
  // 老 fixture 也可能整批不带 seq —— 这类事件照常应用，只是不参与去重/空洞判定。
  if (hasSeq) {
    if (event.seq <= agg.lastSeq) return 'duplicate'
    if (event.seq > agg.lastSeq + 1) return 'gap'
  }

  if (Number.isFinite(event.time) && event.time > (agg.lastTs ?? 0)) agg.lastTs = event.time

  switch (event.type) {
    case 'session':
      applySessionHeader(agg, event)
      break
    case 'session/title':
      if (typeof event.data?.title === 'string' && event.data.title.length > 0) agg.title = event.data.title
      break
    case 'request/header': {
      const config = event.data?.header?.config
      const provider = typeof config?.provider === 'string' ? config.provider : 'unknown-provider'
      const model = typeof config?.model === 'string' ? config.model : 'unknown-model'
      fold.currentModel = `${provider}/${model}`
      break
    }
    case 'step/start':
      // 无 baseline 的 step/start 直接丢弃，不写 openStep —— 否则下一步真实
      // assistant/message 的 (event.time - 0) 就是 epoch ms，单事件能把 llmMs 推到 1e12。
      fold.openStep = Number.isFinite(event.time)
        ? { turn: event.data?.turn, step: event.data?.step, time: event.time }
        : null
      break
    case 'assistant/message': {
      const usage = event.data?.usage
      // 必须同时有 usage 与有限数字 time 才能归属到任何桶：
      //  - 缺 time → beijingDayKey(0) 会落到 1970-01-01 污染三个粒度；
      //  - NaN / Infinity（typeof 仍是 number）→ "Invalid Date" 污染同理。
      if (usage != null && Number.isFinite(event.time)) {
        // totals 与 models 同步增量累加：v0.4.x 的全量折叠在收尾时遍历 models 求和，
        // 增量折叠没有"收尾"，因此必须在这里同时写 totals，保证 totals ≡ Σ models。
        addUsage(agg.totals, usage)
        addUsage(bucketOf(agg.models, fold.currentModel), usage)
        const day = beijingDayKey(event.time)
        addUsage(bucketOf(agg.days, day), usage)
        addUsage(bucketOf(agg.modelDays, `${fold.currentModel}|${day}`), usage)
        const dt = new Date(event.time + BEIJING_OFFSET_MS)
        const hourKey = `${day}T${pad2(dt.getUTCHours())}`
        const minuteKey = `${hourKey}:${pad2(dt.getUTCMinutes())}`
        addUsage(bucketOf(agg.hours, hourKey), usage)
        addUsage(bucketOf(agg.modelHours, `${fold.currentModel}|${hourKey}`), usage)
        addUsage(bucketOf(agg.minutes, minuteKey), usage)
        addUsage(bucketOf(agg.modelMinutes, `${fold.currentModel}|${minuteKey}`), usage)
      }
      if (fold.openStep != null && fold.openStep.turn === event.data?.turn && fold.openStep.step === event.data?.step) {
        agg.llmMs += Math.max(0, toFiniteNumber(event.time) - fold.openStep.time)
        fold.openStep = null
      }
      break
    }
    case 'tool/call': {
      const name = typeof event.data?.name === 'string' ? event.data.name : 'unknown'
      toolBucketOf(agg.tools, name).calls += 1
      const callId = event.data?.callId
      // 缺 callId 时仍计入调用次数，但不写 pendingCalls/callNames —— 否则 undefined
      // 键会让后续任何 tool/result 都"匹配"到第一个 undefined callId 上。
      if (callId != null) {
        fold.callNames.set(callId, name)
        if (Number.isFinite(event.time)) fold.pendingCalls.set(callId, event.time)
      }
      break
    }
    case 'tool/result': {
      const callId = event.data?.message?.source?.callId
      const dispatched = fold.pendingCalls.get(callId)
      if (dispatched !== undefined) {
        fold.pendingCalls.delete(callId)
        const elapsed = Math.max(0, toFiniteNumber(event.time) - dispatched)
        agg.toolMs += elapsed
        toolBucketOf(agg.tools, fold.callNames.get(callId) ?? 'unknown').ms += elapsed
        fold.callNames.delete(callId)
      }
      break
    }
    case 'step/end':
      agg.steps += 1
      fold.openStep = null
      break
    case 'turn/end':
      agg.turns += 1
      break
    default:
      break
  }

  if (hasSeq && event.seq > agg.lastSeq) agg.lastSeq = event.seq
  return 'applied'
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** session header → agg 元数据（字段逐个守卫，脏值不写入）。 */
function applySessionHeader(agg, event) {
  agg.id = event.id ?? agg.id
  agg.cwd = event.cwd ?? agg.cwd
  agg.createdAt = event.createdAt ?? agg.createdAt
  agg.preset = event.agentPreset ?? agg.preset
  // 子代理归并依据（DSH SessionHeader schema：parentSession / delegationDepth / origin）。
  // 缺失 delegationDepth 时按 parentSession 推断（顶层 = 0），兼容更老的会话日志。
  agg.parentSession = event.parentSession ?? agg.parentSession
  agg.delegationDepth = typeof event.delegationDepth === 'number'
    ? event.delegationDepth
    : (agg.parentSession == null ? 0 : Math.max(1, agg.delegationDepth || 0))
  agg.origin = event.origin ?? agg.origin
}

/**
 * 按序折叠一批事件。
 *
 * @param options.continueOnGap true = 遇到 seq 空洞也照常应用（全量折叠语义：
 *   日志本身就不连续时，拒绝折叠只会让该会话永远停在旧值；改为"折叠所见 + 记警告"）。
 *   false（默认）= 立即返回 gap，由调用方决定是否作用域内全量重折叠。
 * @returns {{ applied: number, duplicate: number, skipped: number, gap: boolean, gapAt: number|null, sawGap: boolean }}
 *   gap=true 时本批**未应用**任何事件（水位不变）；sawGap=true 表示 continueOnGap 下跳过了空洞。
 */
export function foldEvents(fold, events, options = {}) {
  const continueOnGap = options.continueOnGap === true
  let applied = 0
  let duplicate = 0
  let skipped = 0
  let sawGap = false
  if (!Array.isArray(events)) return { applied, duplicate, skipped, gap: false, gapAt: null, sawGap }
  for (const event of events) {
    const outcome = applyEvent(fold, event)
    if (outcome === 'gap') {
      if (!continueOnGap) return { applied, duplicate, skipped, gap: true, gapAt: toFiniteNumber(event.seq), sawGap }
      // 断点续折：把水位退到 seq-1 再应用该事件（它携带的 usage 不能丢）
      sawGap = true
      fold.agg.lastSeq = toFiniteNumber(event.seq) - 1
      const retry = applyEvent(fold, event)
      if (retry === 'applied') applied += 1
      else if (retry === 'duplicate') duplicate += 1
      else skipped += 1
      continue
    }
    if (outcome === 'applied') applied += 1
    else if (outcome === 'duplicate') duplicate += 1
    else skipped += 1
  }
  return { applied, duplicate, skipped, gap: false, gapAt: null, sawGap }
}

/* ------------------------------------------------------------------ *
 * 保留量裁剪
 * ------------------------------------------------------------------ */

/**
 * 裁剪细粒度桶（原地）：
 *   - minutes / modelMinutes：只保留最近 MINUTE_KEEP_MS（48h）
 *   - hours / modelHours：只保留最近 HOUR_KEEP_MS（15d）
 *   - days / modelDays / 模型 / 工具：永久保留
 *
 * 实现用**键的字典序**而不是逐键解析时间：桶键是零填充的北京时间字符串，
 * 字典序即时间序；模型×时间键按 '|' 切开后比较时间后缀。
 *
 * @param agg 聚合体（原地修改）
 * @param nowMs 当前时间（默认 Date.now()，测试注入用）
 * @returns {{ minutes: number, hours: number, modelMinutes: number, modelHours: number }} 各表删除条数
 */
export function pruneBuckets(agg, nowMs = Date.now()) {
  const stats = { minutes: 0, hours: 0, modelMinutes: 0, modelHours: 0 }
  if (agg == null || typeof agg !== 'object') return stats
  const minuteFloor = bucketKeyOf(nowMs - MINUTE_KEEP_MS, 'minute')
  const hourFloor = bucketKeyOf(nowMs - HOUR_KEEP_MS, 'hour')
  stats.minutes = pruneByKey(agg.minutes, minuteFloor, false)
  stats.hours = pruneByKey(agg.hours, hourFloor, false)
  stats.modelMinutes = pruneByKey(agg.modelMinutes, minuteFloor, true)
  stats.modelHours = pruneByKey(agg.modelHours, hourFloor, true)
  return stats
}

/** ms → 桶键（minute: yyyy-mm-ddTHH:mm；hour: yyyy-mm-ddTHH），与 applyEvent 的键格式一致。 */
function bucketKeyOf(ms, granularity) {
  const dt = new Date(ms + BEIJING_OFFSET_MS)
  const day = beijingDayKey(ms)
  const hour = `${day}T${pad2(dt.getUTCHours())}`
  return granularity === 'minute' ? `${hour}:${pad2(dt.getUTCMinutes())}` : hour
}

/** 删除键（或 'prefix|键' 的键）小于 floor 的条目；composite=true 表示键带 'model|' 前缀。 */
function pruneByKey(map, floor, composite) {
  if (map == null || typeof map !== 'object') return 0
  let removed = 0
  for (const key of Object.keys(map)) {
    const timeKey = composite ? key.slice(key.indexOf('|') + 1) : key
    if (timePartBefore(timeKey, floor)) {
      delete map[key]
      removed += 1
    }
  }
  return removed
}

/** 时间键是否早于 floor（字典序；长度不一致时补齐比较，避免 'T9' vs 'T09' 类错判）。 */
function timePartBefore(timeKey, floor) {
  if (typeof timeKey !== 'string' || timeKey.length === 0) return true
  if (timeKey.length === floor.length) return timeKey < floor
  return timeKey.length < floor.length ? timeKey < floor.slice(0, timeKey.length) : timeKey.slice(0, floor.length) < floor
}

/* ------------------------------------------------------------------ *
 * header 事件补偿（v0.4.5 起 framework 不再把物理 header 放进 events）
 * ------------------------------------------------------------------ */

/**
 * 把 framework 的 SessionHeader 快照还原成一条 `session` 事件。
 * 只搬运会读的字段，且逐个类型守卫：上游 schema drift 时不写脏值。
 */
export function sessionHeaderEvent(header) {
  const event = { type: 'session' }
  if (header == null || typeof header !== 'object' || Array.isArray(header)) return event
  if (typeof header.id === 'string') event.id = header.id
  if (typeof header.cwd === 'string') event.cwd = header.cwd
  if (typeof header.createdAt === 'number' && Number.isFinite(header.createdAt)) event.createdAt = header.createdAt
  if (typeof header.agentPreset === 'string') event.agentPreset = header.agentPreset
  if (typeof header.parentSession === 'string') event.parentSession = header.parentSession
  // delegationDepth 缺失时**故意不写**：让"有 parentSession 但没深度 → 至少 1"的推断分支接手。
  if (typeof header.delegationDepth === 'number' && Number.isFinite(header.delegationDepth)) {
    event.delegationDepth = header.delegationDepth
  }
  if (typeof header.origin === 'string') event.origin = header.origin
  return event
}

/**
 * 保证 events 里有一条 `session` header 事件；没有就把 framework 的 header 快照
 * 合成一条补在最前（v0.4.5 修复：framework 的 header 单独消费，不在 events 里）。
 */
export function withSessionHeaderEvent(events, header) {
  if (!Array.isArray(events)) return []
  for (const event of events) {
    if (event != null && typeof event === 'object' && !Array.isArray(event) && event.type === 'session') return events
  }
  const merged = new Array(events.length + 1)
  merged[0] = sessionHeaderEvent(header)
  for (let i = 0; i < events.length; i += 1) merged[i + 1] = events[i]
  return merged
}

/* ------------------------------------------------------------------ *
 * 兼容包装
 * ------------------------------------------------------------------ */

/**
 * 全量折叠（v0.4.x 公开签名，语义与输出形状不变）。
 * 不裁剪细粒度桶 —— 保留量只在写记录前应用（见 pruneBuckets），
 * 以保证现有测试与"同一份事件流折叠结果可复现"的确定性。
 */
export function aggregateSession(events, id = null) {
  const fold = createFoldState(id)
  foldEvents(fold, events)
  const agg = fold.agg
  if (agg.id == null) agg.id = id
  return agg
}
