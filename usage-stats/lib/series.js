/**
 * dsh-usage-stats — 视图序列（v0.5.0）
 *
 * 从 root 聚合体派生各视图：按日（近 30 天零填充）/ 历史全量日序列 / 多粒度趋势
 * （minute·24h / hour·7d / day·30d / week·全部 ISO 周一折叠）/ 按模型表 / 会话榜 / 工具榜。
 *
 * 全部是纯函数，输入是 rollup.buildRoots() 的输出（或任何同形的 agg 数组/Map）。
 * 除 v0.3.8 的"日锚点对齐北京时间"修正外，行为与 v0.4.x 完全一致 —— 这里只做搬家与
 * 提取公共工具，不改算法。
 */

import { DAY_WINDOW, TOP_SESSIONS, TOP_TOOLS, BEIJING_OFFSET_MS } from './constants.js'
import { beijingDayKey, emptyBucket, entriesOf, mergeBucket, totalTokensOf } from './fold.js'

/**
 * Map 版取桶：本模块内部聚合一律用 Map（键是模型名 / 时间键，可能很多），
 * 而 fold.js 的 bucketOf 面向"要落盘的普通对象"。两者不可混用 ——
 * 混用的症状是 Map.entries() 恒空、所有派生视图静默变 0。
 */
function mapBucketOf(map, key) {
  let bucket = map.get(key)
  if (bucket === undefined) {
    bucket = emptyBucket()
    map.set(key, bucket)
  }
  return bucket
}

/** Map 版工具桶。 */
function mapToolBucketOf(map, key) {
  let bucket = map.get(key)
  if (bucket === undefined) {
    bucket = { calls: 0, ms: 0 }
    map.set(key, bucket)
  }
  return bucket
}

/** 兼容 roots 既是 Map 又是数组两种调用形态。 */
function toList(roots) {
  if (roots == null) return []
  return Array.isArray(roots) ? roots : [...roots.values()]
}

/** 最近 DAY_WINDOW 天（北京时间）零填充的日序列；元素同时给 day 与 bucket 两个 key。 */
export function daySeries(roots) {
  const series = granularitySeries(roots, 'day')
  return series.map(function (s) {
    return {
      day: s.bucket,
      bucket: s.bucket,
      inputTokens: s.inputTokens,
      outputTokens: s.outputTokens,
      cacheReadTokens: s.cacheReadTokens,
      cacheWriteTokens: s.cacheWriteTokens,
      reasoningTokens: s.reasoningTokens,
      requests: s.requests,
    }
  })
}

/**
 * 把所有 root.days 合并成一份按日期升序、**不零填充**的日序列（v0.3.9 的 byDayAll）。
 * 给「全部」图表与热力图使用：现版 byDay 是近 30 天零填充，超过 30 天的历史会丢失，
 * 活动稀疏时还会出现一长串 0 断点。这里只输出真有用量的天，客户端自行做 53 周裁剪。
 */
export function rootsDaysAll(rootList) {
  const merged = new Map()
  for (const root of toList(rootList)) {
    for (const [k, b] of entriesOf(root.days)) {
      mergeBucket(mapBucketOf(merged, k), b)
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
 * 多粒度趋势序列：
 *   'minute' — 最近 24h（分钟级，1440 桶）
 *   'hour'   — 最近 7d（小时级，168 桶）
 *   'day'    — 最近 30d（日级）
 *   'week'   — 全部数据按周折叠（ISO 周，周一为周开始，与北京时间约定一致）
 *
 * `now` 形参导出给单测用。day 锚点对齐到 **Beijing 日界**：用
 * `anchorMs = now - ((now + BEIJING_OFFSET_MS) % stepMs)`，对 minute/hour 等价于原版
 * （8h 是 60s/3600s 的整数倍），只修正 day 锚点（原版在 UTC 16:00-24:00 会永远缺当天桶）。
 */
export function granularitySeries(roots, granularity, now = Date.now()) {
  const list = toList(roots)
  const merged = new Map()
  if (granularity === 'minute') {
    for (const root of list) {
      for (const [k, b] of entriesOf(root.minutes)) mergeBucket(mapBucketOf(merged, k), b)
    }
  } else if (granularity === 'hour') {
    for (const root of list) {
      for (const [k, b] of entriesOf(root.hours)) mergeBucket(mapBucketOf(merged, k), b)
    }
  } else if (granularity === 'day') {
    for (const root of list) {
      for (const [k, b] of entriesOf(root.days)) mergeBucket(mapBucketOf(merged, k), b)
    }
  } else if (granularity === 'week') {
    for (const root of list) {
      for (const [k, b] of entriesOf(root.days)) {
        const parts = k.split('-')
        const dt = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]))
        const dow = (dt.getUTCDay() + 6) % 7 // 周一=0, 周日=6
        const wkMs = dt.getTime() - dow * 86400000
        mergeBucket(mapBucketOf(merged, beijingDayKey(wkMs)), b)
      }
    }
  } else {
    return []
  }

  const out = []
  if (granularity === 'week') {
    // 周：按 key 升序输出，不零填充（历史数据可能不连续）
    for (const k of [...merged.keys()].sort()) out.push({ bucket: k, ...merged.get(k) })
    return out
  }

  const stepMs = granularity === 'minute' ? 60 * 1000 : (granularity === 'hour' ? 3600 * 1000 : 24 * 3600 * 1000)
  const windowMs = granularity === 'minute'
    ? 24 * 3600 * 1000
    : (granularity === 'hour' ? 7 * 24 * 3600 * 1000 : DAY_WINDOW * 24 * 3600 * 1000)
  const steps = Math.floor(windowMs / stepMs)
  const anchorMs = now - ((now + BEIJING_OFFSET_MS) % stepMs)
  const keyFn = (ms) => {
    if (granularity === 'minute') return `${beijingDayKey(ms)}T${pad2(new Date(ms + BEIJING_OFFSET_MS).getUTCHours())}:${pad2(new Date(ms + BEIJING_OFFSET_MS).getUTCMinutes())}`
    if (granularity === 'hour') return `${beijingDayKey(ms)}T${pad2(new Date(ms + BEIJING_OFFSET_MS).getUTCHours())}`
    return beijingDayKey(ms)
  }
  for (let i = steps - 1; i >= 0; i--) {
    const k = keyFn(anchorMs - i * stepMs)
    const b = merged.get(k) || emptyBucket()
    out.push({ bucket: k, ...b })
  }
  return out
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** 按模型分解表（含每个模型的按日明细，供热力图做模型筛选）。 */
export function modelTable(aggs) {
  const merged = new Map()
  const sessionCounts = new Map()
  const perModelDays = new Map()
  for (const agg of toList(aggs)) {
    for (const [model, bucket] of entriesOf(agg.models)) {
      mergeBucket(mapBucketOf(merged, model), bucket)
      sessionCounts.set(model, (sessionCounts.get(model) || 0) + 1)
    }
    for (const [key, bucket] of entriesOf(agg.modelDays)) {
      const sep = key.indexOf('|')
      const model = key.slice(0, sep)
      const day = key.slice(sep + 1)
      if (day.length === 0) continue
      let byDay = perModelDays.get(model)
      if (byDay === undefined) {
        byDay = new Map()
        perModelDays.set(model, byDay)
      }
      mergeBucket(mapBucketOf(byDay, day), bucket)
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

/** 会话用量榜（已归并到 root：subagent 的 token 记在 owner 名下）。 */
export function topSessions(aggs) {
  return toList(aggs)
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
        childCount: Array.isArray(agg.childIds) ? agg.childIds.length : 0,
      }
    })
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, TOP_SESSIONS)
}

/** 工具调用榜（次数 + 累计耗时）。 */
export function toolTable(aggs) {
  const merged = new Map()
  for (const agg of toList(aggs)) {
    for (const [name, bucket] of entriesOf(agg.tools)) {
      const entry = mapToolBucketOf(merged, name)
      entry.calls += bucket.calls || 0
      entry.ms += bucket.ms || 0
    }
  }
  return [...merged.entries()]
    .map(([name, entry]) => ({ name, calls: entry.calls, ms: entry.ms }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, TOP_TOOLS)
}
