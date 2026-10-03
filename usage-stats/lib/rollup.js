/**
 * dsh-usage-stats — 根会话归并（v0.5.0）
 *
 * 业务语义与 v0.4.x 的 rollupByMainSession 一致：
 *   - root = 沿 `parentSession` 链走到顶的 main session（顶层 = 没有 parentSession）
 *   - 子代理的 token **归属 owner**（"lands on its owner"），不做祖先链摊销
 *   - counts（会话数 / 轮次 / 步数）只算 main session：sessionCount = root 数，
 *     rawSessionCount = 记录数
 *   - orphan（父不在记录集里）回退自身；链上出现环时在重复节点处截断
 *
 * 与 v0.4.x 的差别只在数据来源：v0.4.x 从框架的一次性 headers 数组建 byId，
 * 这里从持久化记录集（每条带 meta）建，因此**重启后无需再列会话**即可复原父链。
 *
 * 实现是纯函数：records → root 数组。上层（payload.js）按"记录代"memo，
 * 只在有记录变化时重算，避免 v0.4.x 那种"每次请求重并 692 条聚合"的开销。
 */

import { bucketOf, entriesOf, mergeBucket, toolBucketOf } from './fold.js'

/** 新建一个 root 聚合体（形状与 fold.js 的 agg 对齐，便于复用同一个序列化器）。 */
function emptyRoot(id) {
  return {
    id,
    title: null,
    cwd: null,
    createdAt: null,
    preset: null,
    parentSession: null,
    delegationDepth: 0,
    origin: null,
    lastTs: null,
    models: {},
    days: {},
    modelDays: {},
    hours: {},
    modelHours: {},
    minutes: {},
    modelMinutes: {},
    tools: {},
    totals: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 0 },
    steps: 0,
    turns: 0,
    llmMs: 0,
    toolMs: 0,
    childIds: [],
  }
}

/** 模型×时间复合键：拆成 "模型|时间" 两段（与 fold.js 的写入格式一致）。 */
function splitCompositeKey(key) {
  const sep = key.indexOf('|')
  return sep < 0 ? [key, ''] : [key.slice(0, sep), key.slice(sep + 1)]
}

/**
 * 把记录集归并成 root 列表。
 *
 * @param records 可迭代的记录集（store.records.values()）或记录数组
 * @returns {Array<object>} root 聚合体数组（顺序 = 记录遍历顺序中的首次出现顺序）
 */
export function buildRoots(records) {
  const list = Array.isArray(records) ? records : [...records]
  const byId = new Map()
  for (const record of list) {
    const id = metaIdOf(record)
    if (id != null) byId.set(id, record)
  }

  // 1) 先把每个会话解析到 root（父链遍历 + 防环）
  const rootIdMap = new Map()
  for (const record of list) {
    const id = metaIdOf(record)
    if (id == null) continue
    rootIdMap.set(id, resolveRootId(id, byId))
  }

  const roots = new Map()
  const ensureRoot = (rootId) => {
    let root = roots.get(rootId)
    if (root === undefined) {
      root = emptyRoot(rootId)
      roots.set(rootId, root)
    }
    return root
  }

  // 2) root 自己的元数据以"它就是顶层会话"为准
  for (const record of list) {
    const id = metaIdOf(record)
    if (id == null || rootIdMap.get(id) !== id) continue
    const root = ensureRoot(id)
    const meta = record.meta || {}
    root.title = meta.title || root.title
    root.cwd = meta.cwd || root.cwd
    root.createdAt = meta.createdAt || root.createdAt
    root.preset = meta.preset || root.preset
    root.delegationDepth = meta.delegationDepth || 0
    root.origin = meta.origin || null
    if (Number.isFinite(record.agg.lastTs) && (root.lastTs == null || record.agg.lastTs > root.lastTs)) root.lastTs = record.agg.lastTs
  }

  // 3) 所有记录（含子代理）的桶归并到各自 root
  for (const record of list) {
    const id = metaIdOf(record)
    if (id == null) continue
    const rootId = rootIdMap.get(id)
    if (rootId == null) continue
    const agg = record.agg || {}
    const root = ensureRoot(rootId)
    mergeMapInto(root.models, agg.models)
    mergeMapInto(root.days, agg.days)
    mergeCompositeInto(root.modelDays, agg.modelDays)
    mergeMapInto(root.hours, agg.hours)
    mergeCompositeInto(root.modelHours, agg.modelHours)
    mergeMapInto(root.minutes, agg.minutes)
    mergeCompositeInto(root.modelMinutes, agg.modelMinutes)
    for (const [name, bucket] of entriesOf(agg.tools)) {
      const target = toolBucketOf(root.tools, name)
      target.calls += bucket.calls || 0
      target.ms += bucket.ms || 0
    }
    mergeBucket(root.totals, agg.totals || {})
    root.steps += agg.steps || 0
    root.turns += agg.turns || 0
    root.llmMs += agg.llmMs || 0
    root.toolMs += agg.toolMs || 0
    if (id !== rootId) root.childIds.push(id)
    if (Number.isFinite(agg.lastTs) && (root.lastTs == null || agg.lastTs > root.lastTs)) root.lastTs = agg.lastTs
  }

  return [...roots.values()]
}

function metaIdOf(record) {
  if (record == null) return null
  if (record.meta != null && typeof record.meta.id === 'string' && record.meta.id.length > 0) return record.meta.id
  if (typeof record.key === 'string' && record.key.length > 0) return record.key
  return null
}

/** 沿 parentSession 链走到顶；orphan 回退自身；检测到环就在重复节点处截断。 */
function resolveRootId(id, byId) {
  const seen = new Set()
  let current = id
  for (;;) {
    const record = byId.get(current)
    const parent = record != null && record.meta != null && typeof record.meta.parentSession === 'string' ? record.meta.parentSession : null
    if (parent == null || parent === current) return current
    if (seen.has(parent)) return current
    seen.add(current)
    if (!byId.has(parent)) return current // orphan：父不在记录集里 → 自己当 root
    current = parent
  }
}

function mergeMapInto(target, source) {
  for (const [key, bucket] of entriesOf(source)) mergeBucket(bucketOf(target, key), bucket)
}

function mergeCompositeInto(target, source) {
  for (const [key, bucket] of entriesOf(source)) {
    const [model, timeKey] = splitCompositeKey(key)
    if (timeKey.length === 0) continue
    mergeBucket(bucketOf(target, `${model}|${timeKey}`), bucket)
  }
}
