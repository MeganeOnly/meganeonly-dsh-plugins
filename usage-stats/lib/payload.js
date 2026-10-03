/**
 * dsh-usage-stats — payload 装配与快照 memo（v0.5.0）
 *
 * 一次请求 = 取"已发布快照"（零计算）。快照只在**记录集合发生变化**时重算：
 * 扫描器折叠完某个会话后调 invalidate() 让代次 +1，下一次请求重建。
 * 这替换了 v0.4.x "每次请求都把 692 条聚合重新归并一遍"的做法。
 *
 * 响应形状保持 v0.4.x 兼容（totals / byDay / byDayAll / byTrend / byModel /
 * topSessions / tools / steps / turns / llmMs / toolMs / sessionCount /
 * rawSessionCount / decoded / reused / durationMs / generatedAt / errors），
 * 新增扫描与新鲜度字段（scanning / scanProgress / legacy / dataAsOf / stale /
 * discovery / storeVersion / retention）。
 *
 * 设计取舍：重部分（归并 + 四个粒度的零填充序列 + 三张表）按"代次"memo；
 * 轻部分（扫描进度、时钟、错误列表）每次请求重算 —— 这样轮询期间进度条是活的，
 * 而重算不会重复发生。
 */

import { DAY_WINDOW, MAX_ERRORS_REPORTED, MINUTE_KEEP_MS, HOUR_KEEP_MS, STORE_VERSION, TOP_SESSIONS, TOP_TOOLS } from './constants.js'
import { emptyBucket, mergeBucket } from './fold.js'
import { buildRoots } from './rollup.js'
import { daySeries, granularitySeries, modelTable, rootsDaysAll, toolTable, topSessions } from './series.js'

/**
 * 创建 payload 装配器。
 *
 * @param deps.store createStore() 实例
 * @param deps.scanner createScanner() 实例（提供进度状态；可选）
 * @param deps.getScanner 可选：延迟取扫描器（扫描器与装配器互相引用时用）
 * @param deps.now 可选时钟
 */
export function createPayloadBuilder(deps) {
  const store = deps.store
  const scanner = deps.scanner || null
  const now = typeof deps.now === 'function' ? deps.now : () => Date.now()

  /** 取当前扫描器：支持构造期互相引用（getScanner 优先）。 */
  function scannerNow() {
    if (typeof deps.getScanner === 'function') {
      try {
        const value = deps.getScanner()
        if (value != null) return value
      } catch {
        // 忽略：诊断字段缺失不应影响统计输出
      }
    }
    return scanner
  }

  let generation = 0
  let published = null // { generation, heavy }

  /** 记录集合变化 → 下次请求重建重部分。 */
  function invalidate() {
    generation += 1
  }

  /** 归并 + 派生视图（重部分）。 */
  function buildHeavy() {
    const records = [...store.records.values()]
    const roots = buildRoots(records)
    const totals = emptyBucket()
    let steps = 0
    let turns = 0
    let llmMs = 0
    let toolMs = 0
    let lastTs = null
    for (const root of roots) {
      mergeBucket(totals, root.totals)
      steps += root.steps || 0
      turns += root.turns || 0
      llmMs += root.llmMs || 0
      toolMs += root.toolMs || 0
      if (Number.isFinite(root.lastTs) && (lastTs == null || root.lastTs > lastTs)) lastTs = root.lastTs
    }
    return {
      totals,
      steps,
      turns,
      llmMs,
      toolMs,
      lastTs,
      sessionCount: roots.length,
      rawSessionCount: records.length,
      byDay: daySeries(roots),
      byDayAll: rootsDaysAll(roots),
      byTrend: {
        minute: granularitySeries(roots, 'minute', now()),
        hour: granularitySeries(roots, 'hour', now()),
        day: granularitySeries(roots, 'day', now()),
        week: granularitySeries(roots, 'week', now()),
      },
      byModel: modelTable(roots),
      topSessions: topSessions(roots),
      tools: toolTable(roots),
    }
  }

  /** 组装完整响应（重部分按代次复用）。 */
  function build(options = {}) {
    const diag = options.diag === true
    if (published === null || published.generation !== generation) {
      published = { generation, heavy: buildHeavy() }
    }
    const active = scannerNow()
    const state = active != null ? active.state : null
    const errors = active != null ? active.errors : []
    const legacyCount = countLegacy()
    const heavy = published.heavy
    const payload = {
      ok: options.error === undefined,
      generatedAt: now(),
      dataAsOf: heavy.lastTs,
      storeVersion: STORE_VERSION,
      retention: { minuteHours: MINUTE_KEEP_MS / 3600000, hourDays: HOUR_KEEP_MS / 86400000, dayWindow: DAY_WINDOW },
      limits: { topSessions: TOP_SESSIONS, topTools: TOP_TOOLS },
      sessionCount: heavy.sessionCount,
      rawSessionCount: heavy.rawSessionCount,
      steps: heavy.steps,
      turns: heavy.turns,
      llmMs: heavy.llmMs,
      toolMs: heavy.toolMs,
      totals: heavy.totals,
      byDay: heavy.byDay,
      byDayAll: heavy.byDayAll,
      byTrend: heavy.byTrend,
      byModel: heavy.byModel,
      topSessions: heavy.topSessions,
      tools: heavy.tools,
      // ---- 扫描/新鲜度（轻部分，每次请求实时读） ----
      scanning: state != null ? state.running === true : false,
      scanProgress: state == null ? null : {
        phase: state.phase,
        done: state.done,
        total: state.total,
        bytesDone: state.bytesDone,
        bytesTotal: state.bytesTotal,
        changed: state.changed,
        reused: state.reused,
        removed: state.removed,
      },
      legacy: legacyCount > 0,
      legacyCount,
      stale: state != null ? state.errorCount > 0 || state.running === true : false,
      discovery: state != null ? state.discovery : 'none',
      discoveryMs: state != null ? state.discoveryMs : null,
      // v0.4.x 兼容字段：decoded = 本次扫描真正折叠的会话数，reused = 按修订复用数
      decoded: state != null ? state.changed : 0,
      reused: state != null ? state.reused : 0,
      durationMs: state != null ? state.lastDurationMs : null,
      lastScanAt: state != null ? state.lastFinishedAt : null,
      errors: diag ? errors.slice(0, 200) : errors.slice(0, MAX_ERRORS_REPORTED),
      errorCount: state != null ? state.errorCount : 0,
      restartFolds: state != null ? state.restartFolds : 0,
    }
    if (options.error !== undefined) payload.error = options.error
    if (diag) {
      payload.diag = {
        store: {
          dir: store.paths.dir,
          records: store.records.size,
          byPath: store.byPath.size,
          dirty: store.dirtyCount,
          storageUsable: store.storageUsable,
          lastScanAt: store.manifest.lastScanAt,
          warnings: store.warnings.slice(0, 20),
        },
        scanner: state == null ? null : { ...state },
        folds: active != null && typeof active.foldStateCount === 'function' ? active.foldStateCount() : null,
        failedMemo: active != null && typeof active.failedCount === 'function' ? active.failedCount() : null,
        zstd: active != null && typeof active.zstdAvailable === 'function' ? active.zstdAvailable() : null,
      }
    }
    return payload
  }

  function countLegacy() {
    let count = 0
    for (const record of store.records.values()) if (record.legacy === true) count += 1
    return count
  }

  return {
    invalidate,
    build,
    /** 当前代次（诊断/测试用）。 */
    currentGeneration() { return generation },
    /** 是否已有已发布快照（决定首屏是否等一次归并）。 */
    hasPublished() { return published !== null },
  }
}
