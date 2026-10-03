/**
 * dsh-usage-stats — 扫描调度器（v0.5.0）
 *
 * 一次扫描 = 发现 → 逐会话修订比较 → 只对"新增字节"做帧级增量折叠 → 落盘 → 通知上层。
 * 这是 v0.4.x 那套"createdAt 判命中 + 整文件重解码 + 单体缓存整份重写"的替代品。
 *
 * 关键性质：
 *   - **零 I/O 复用**：修订令牌（dev:ino:size:mtimeNs:ctimeNs）相同且世代相同 → 一次解压都不做
 *   - **只读新增字节**：从记录里的 cursor.bytes 续读，只解压新帧；撕裂尾帧丢弃、水位不推进
 *   - **幂等**：水位 lastSeq 让重读同一段字节变成 duplicate，不重复计
 *   - **作用域内重折叠**：seq 空洞 / 世代迁移 / 前缀哈希不符 → 只重折叠这一个会话
 *   - **可交互**：按帧切片，每片后让出事件循环（DSH 的 web server 与插件同进程）
 *   - **单飞 + force 排队**：并发请求共享一次扫描；force 在扫描结束后补跑一次
 *   - **失败记忆**：同一 (路径, 修订) 的确定性失败只报一次，不每次扫描重试
 *   - **删除清理**：日志消失的会话记录被删除并通知上层（图表随之扣减）
 */

import { createHash } from 'node:crypto'
import { open } from 'node:fs/promises'

import { FOLD_SLICE_EVENTS, SCAN_MIN_INTERVAL_MS, MAX_ERRORS_REPORTED, FAILED_MEMO_MAX } from './constants.js'
import { decodeFrameRange, parseEventLines, readAppended, scanZstdFrames, zstdAvailable } from './frames.js'
import { createFoldState, foldEvents, pruneBuckets, withSessionHeaderEvent } from './fold.js'
import { discoverSessions, statInfo } from './discover.js'
import { makeRecord, readLegacyRecords } from './store.js'

/** 前缀锚的默认长度（前缀哈希用于确认"同一世代文件只是被追加"）。 */
const ANCHOR_PREFIX_BYTES = 64 * 1024

/** 让出事件循环：把 CPU 密集的 JSON.parse/折叠切片摊开，保证 DSH 主进程可交互。 */
function defaultYieldToLoop() {
  return new Promise((resolve) => setImmediate(resolve))
}

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

/** 读文件前缀并算哈希（锚校验用）。 */
async function hashPrefix(path, length) {
  if (!(length > 0)) return null
  try {
    const handle = await open(path, 'r')
    try {
      const size = (await handle.stat()).size
      const want = Math.min(length, size)
      if (want <= 0) return null
      const buf = Buffer.allocUnsafe(want)
      const { bytesRead } = await handle.read(buf, 0, want, 0)
      return sha256Hex(bytesRead === want ? buf : buf.subarray(0, bytesRead))
    } finally {
      await handle.close()
    }
  } catch {
    return null
  }
}

/** 从聚合体派生记录元数据（父链归并、标题、榜单展示都读这里）。 */
function metaFromAgg(agg) {
  return {
    id: typeof agg.id === 'string' ? agg.id : null,
    createdAt: Number.isFinite(agg.createdAt) ? agg.createdAt : null,
    cwd: typeof agg.cwd === 'string' ? agg.cwd : null,
    preset: typeof agg.preset === 'string' ? agg.preset : null,
    parentSession: typeof agg.parentSession === 'string' ? agg.parentSession : null,
    delegationDepth: Number.isFinite(agg.delegationDepth) ? agg.delegationDepth : 0,
    origin: typeof agg.origin === 'string' ? agg.origin : null,
    title: typeof agg.title === 'string' ? agg.title : null,
  }
}

/**
 * 创建扫描器。
 *
 * @param deps.store 必填：createStore() 实例
 * @param deps.sessionPersistence 可选：框架持久化服务（只用 listGenerations 做廉价发现）
 * @param deps.sessionQuery 可选：慢兜底（listSessions / readSession）
 * @param deps.sessionsRoot 可选：显式 sessions 根
 * @param deps.liveIds 可选：() => Set<string> 本进程实时会话 id（用于折叠优先级）
 * @param deps.onRecordsChanged 可选：记录集合发生变化后的回调（payload 失效）
 * @param deps.now 可选：() => number（测试注入时钟）
 * @param deps.yieldTo 可选：() => Promise（测试注入同步版本）
 * @param deps.logger 可选：{ warn }
 */
export function createScanner(deps) {
  const store = deps.store
  const now = typeof deps.now === 'function' ? deps.now : () => Date.now()
  const yieldTo = typeof deps.yieldTo === 'function' ? deps.yieldTo : defaultYieldToLoop
  const logger = deps.logger || { warn: (m) => console.warn(`[usage-stats] ${m}`) }
  const onRecordsChanged = typeof deps.onRecordsChanged === 'function' ? deps.onRecordsChanged : () => {}
  const onRecordFolded = typeof deps.onRecordFolded === 'function' ? deps.onRecordFolded : null
  const liveIds = typeof deps.liveIds === 'function' ? deps.liveIds : () => new Set()

  /** key -> 折叠状态（瞬态 openStep/pendingCalls 跨扫描存活，保证跨帧配对不丢） */
  const foldStates = new Map()
  /** `${path}|${rev}` -> 失败原因（进程内，LRU 上限 FAILED_MEMO_MAX） */
  const failedMemo = new Map()

  const state = {
    running: false,
    phase: 'idle',
    done: 0,
    total: 0,
    bytesDone: 0,
    bytesTotal: 0,
    changed: 0,
    reused: 0,
    removed: 0,
    restartFolds: 0,
    errorCount: 0,
    discovery: 'none',
    lastStartedAt: null,
    lastFinishedAt: null,
    lastDurationMs: null,
    discoveryMs: null,
    legacy: false,
  }
  const errors = []

  let currentRun = null
  /** 排队中的下一次运行（保留 rebuild 意图，见 ensure）。 */
  let queuedRun = null

  function noteError(message) {
    state.errorCount += 1
    if (errors.length < 200) errors.push(message)
    if (errors.length <= MAX_ERRORS_REPORTED) logger.warn(message)
  }

  function rememberFailure(id, reason) {
    if (failedMemo.has(id)) failedMemo.delete(id)
    failedMemo.set(id, reason)
    while (failedMemo.size > FAILED_MEMO_MAX) {
      const oldest = failedMemo.keys().next().value
      failedMemo.delete(oldest)
    }
  }

  /** 取（或新建）某个会话的折叠状态；已有聚合体按引用复用，避免 2 倍内存。 */
  function foldStateFor(record) {
    if (record == null) return null
    const key = record.key
    const cached = foldStates.get(key)
    if (cached !== undefined && cached.agg === record.agg) return cached
    if (record.agg == null) return null
    const fold = createFoldState(record.agg.id ?? null)
    fold.agg = record.agg
    if (!Number.isFinite(fold.agg.lastSeq)) fold.agg.lastSeq = Number.isFinite(record.cursor?.lastSeq) ? record.cursor.lastSeq : -1
    foldStates.set(key, fold)
    return fold
  }

  /** 判断能否从记录的水位续读（世代一致、文件没变小、前缀锚一致）。 */
  async function canResume(record, entry, info) {
    if (record == null || entry.path == null || info == null) return false
    if (record.gen !== entry.version) return false
    const cursorBytes = record.cursor?.bytes ?? 0
    if (!(cursorBytes > 0) || cursorBytes > info.size) return false
    const anchor = record.anchor
    if (anchor == null || !(anchor.prefixBytes > 0) || typeof anchor.prefixSha256 !== 'string') return false
    const actual = await hashPrefix(entry.path, anchor.prefixBytes)
    return actual !== null && actual === anchor.prefixSha256
  }

  /**
   * 折叠一个会话。
   * @returns {Promise<{status: 'folded'|'reused'|'failed', bytes?: number, reason?: string}>}
   */
  async function foldEntry(entry, options) {
    const info = entry.path != null ? await statInfo(entry.path) : null
    if (entry.path != null && info == null) {
      // 发现与折叠之间文件被删（会话删除是常态）：不算错误，下一轮扫描清理记录
      return { status: 'gone', reason: `日志已消失：${entry.path}` }
    }
    const record = entry.path != null ? store.getByPath(entry.path) : store.get(entry.id)
    const memoId = entry.path != null ? `${entry.path}|${info.rev}` : `id:${entry.id}`
    if (failedMemo.has(memoId)) return { status: 'failed', reason: failedMemo.get(memoId), memo: true }

    // 修订 + 世代都一致 → 零 I/O 复用。
    // force 只绕过节流、不做全量重建：复用判定照常，否则"刷新"就等于每次重折全部会话。
    if (
      record != null
      && info != null
      && record.rev === info.rev
      && record.gen === entry.version
      && record.legacy !== true
    ) {
      if (record.path !== entry.path) store.set({ ...record, path: entry.path })
      return { status: 'reused', bytes: 0, key: record.key }
    }

    // 兜底来源（sessionQuery）：没有路径，只能整会话读
    if (entry.path == null) return foldViaFramework(entry)

    const resumed = await canResume(record, entry, info)
    let start = resumed ? record.cursor.bytes : 0
    let baseFrames = resumed && Number.isFinite(record.cursor?.frames) ? record.cursor.frames : 0
    let fold = resumed ? foldStateFor(record) : null
    if (fold == null) {
      // 记录缺失 / 世代变化 / 尺寸回缩 / 前缀锚不符 / 无锚 → 作用域内全量重折叠
      start = 0
      baseFrames = 0
      fold = createFoldState(null)
      if (record != null) state.restartFolds += 1
    }

    const result = await foldFromDisk(entry, info, fold, start, baseFrames)
    if (result.status !== 'ok') return result
    const key = await persist(entry, fold, result)
    return { status: 'folded', bytes: result.bytes, key }
  }

  /** 从磁盘按水位续读并折叠；返回 ok / failed。 */
  async function foldFromDisk(entry, info, fold, start, baseFrames) {
    let bytes = start
    let frameCount = baseFrames
    try {
      const read = await readAppended(entry.path, start)
      if (read.buffer.length > 0) {
        const scanned = scanZstdFrames(read.buffer)
        if (scanned.invalidAt !== undefined) {
          if (start > 0) return { status: 'failed', reason: `新增字节结构非法（${scanned.invalidReason}）` }
          return { status: 'failed', reason: `日志结构非法（${scanned.invalidReason}）` }
        }
        const limit = scanned.tornStart === undefined ? read.buffer.length : scanned.tornStart
        let sinceYield = 0
        for (const range of scanned.frames) {
          if (range[1] > limit) break
          const text = decodeFrameRange(read.buffer, range)
          if (text === null) return { status: 'failed', reason: '帧解码失败' }
          const events = parseEventLines(text)
          foldEvents(fold, events)
          frameCount += 1
          sinceYield += events.length
          if (sinceYield >= FOLD_SLICE_EVENTS) {
            sinceYield = 0
            await yieldTo()
          }
        }
        bytes = start + limit
      }
    } catch (error) {
      return { status: 'failed', reason: `读取失败：${String(error && error.message)}` }
    }
    return { status: 'ok', bytes, frameCount, info }
  }

  /** 慢兜底：通过框架读整个会话（无路径时的唯一选择）。 */
  async function foldViaFramework(entry) {
    const query = deps.sessionQuery
    if (query == null || typeof query.readSession !== 'function') {
      return { status: 'failed', reason: '既无日志路径也无 sessionQuery.readSession 可用' }
    }
    const memoId = `id:${entry.id}`
    if (failedMemo.has(memoId)) return { status: 'failed', reason: failedMemo.get(memoId) }
    try {
      const log = await query.readSession(entry.id)
      const header = log?.session ?? entry.header
      const fold = createFoldState(null)
      const outcome = foldEvents(fold, withSessionHeaderEvent(log?.events ?? [], header))
      if (outcome.gap) return { status: 'failed', reason: '框架读取的事件流存在 seq 空洞' }
      const agg = fold.agg
      pruneBuckets(agg, now())
      const key = typeof agg.id === 'string' && agg.id.length > 0 ? agg.id : entry.id
      store.set(makeRecord({
        key,
        path: null,
        gen: null,
        rev: null, // 无修订可比较：下次扫描仍会重读（这条路径本就是兜底）
        cursor: { bytes: 0, frames: 0, lastSeq: agg.lastSeq },
        anchor: null,
        meta: metaFromAgg(agg),
        agg,
      }))
      foldStates.set(key, fold)
      return { status: 'folded', bytes: 0, key }
    } catch (error) {
      const reason = `framework 读取失败：${String(error && error.message)}`
      rememberFailure(memoId, reason)
      return { status: 'failed', reason }
    }
  }

  /** 把 foldFromDisk 的成功结果固化成记录。 */
  async function persist(entry, fold, folded) {
    const agg = fold.agg
    pruneBuckets(agg, now())
    const key = typeof agg.id === 'string' && agg.id.length > 0 ? agg.id : entry.dirKey
    const bytes = folded.bytes
    const prefixBytes = Math.min(ANCHOR_PREFIX_BYTES, bytes)
    let anchor = null
    if (prefixBytes > 0) {
      const prefixSha256 = await hashPrefix(entry.path, prefixBytes)
      if (prefixSha256 !== null) anchor = { prefixBytes, prefixSha256 }
    }
    store.set(makeRecord({
      key,
      path: entry.path,
      gen: entry.version,
      rev: folded.info.rev,
      cursor: { bytes, frames: folded.frameCount, lastSeq: agg.lastSeq },
      anchor,
      meta: metaFromAgg(agg),
      agg,
    }))
    // 折叠状态按最终 key 归档（dirKey 与 header.id 不一致时纠正）
    foldStates.set(key, fold)
    if (key !== entry.dirKey) foldStates.delete(entry.dirKey)
    // 通知实时支路：用磁盘真相重新播种该会话（保留尚未 flush 的实时事件）
    if (onRecordFolded !== null) {
      try {
        onRecordFolded(store.get(key))
      } catch (error) {
        logger.warn(`实时播种回调失败：${String(error && error.message)}`)
      }
    }
    return key
  }

  /** 记录集里是否还有 v0.4.x 旧缓存的占位记录。 */
  function hasLegacyRecords() {
    for (const record of store.records.values()) {
      if (record.legacy === true) return true
    }
    return false
  }

  /** 导入 v0.4.x 单体缓存为临时记录（首屏先显示旧数据）。 */
  async function seedLegacy() {
    if (store.records.size > 0) return false
    if (!(await store.hasLegacy())) return false
    const legacy = await readLegacyRecords(store.paths.profileRoot)
    if (legacy == null) return false
    for (const [key, record] of legacy) store.set(record)
    state.legacy = true
    return true
  }

  /** 主扫描流程。 */
  async function runOnce(options) {
    const startedAt = now()
    state.running = true
    state.phase = 'discovery'
    state.done = 0
    state.total = 0
    state.bytesDone = 0
    state.bytesTotal = 0
    state.changed = 0
    state.reused = 0
    state.removed = 0
    state.restartFolds = 0
    state.errorCount = 0
    errors.length = 0
    state.lastStartedAt = startedAt

    if (options.rebuild === true) {
      const moved = await store.rotateAside('rebuild')
      foldStates.clear()
      failedMemo.clear()
      state.legacy = false
      if (moved !== null) logger.warn(`按请求全量重建：旧存储已改名为 ${moved}`)
    } else {
      // legacy 判定以"记录集里还有占位记录"为准：index.js 会在首个请求前预播种，
      // 那时 records.size 已经 > 0，不能再靠 seedLegacy 的返回值判断。
      state.legacy = hasLegacyRecords()
      if (!state.legacy && store.records.size === 0) {
        state.legacy = await seedLegacy()
      }
    }

    const discovery = await discoverSessions(
      { sessionPersistence: deps.sessionPersistence, sessionQuery: deps.sessionQuery, sessionsRoot: deps.sessionsRoot },
      { sessionsRoot: deps.sessionsRoot, walkRoots: deps.walkRoots, signal: options.signal }
    )
    state.discovery = discovery.source
    state.discoveryMs = discovery.durationMs
    for (const warning of discovery.warnings) logger.warn(warning)
    if (discovery.source === 'none') {
      state.phase = 'idle'
      state.running = false
      state.lastFinishedAt = now()
      state.lastDurationMs = state.lastFinishedAt - startedAt
      return { ok: false, reason: 'no-sessions-discovered' }
    }

    // 分类：修订一致 → 复用；否则进待折叠队列
    const todo = []
    const seenPaths = new Set()
    const touchedKeys = new Set()
    const live = liveIds()
    for (const entry of discovery.entries) {
      if (entry.path != null) seenPaths.add(entry.path)
      const info = entry.path != null ? await statInfo(entry.path) : null
      const record = entry.path != null ? store.getByPath(entry.path) : store.get(entry.id)
      if (entry.path != null && info == null) continue
      const reusable =
        record != null
        && info != null
        && record.rev === info.rev
        && record.gen === entry.version
        && record.legacy !== true
      if (reusable) {
        state.reused += 1
        touchedKeys.add(record.key)
        continue
      }
      todo.push({ entry, info, record })
    }
    // 优先级：本进程实时会话 → mtime 降序（先让"今天/本周"正确）
    todo.sort((a, b) => {
      const aLive = a.entry.id != null ? live.has(a.entry.id) : live.has(a.entry.dirKey)
      const bLive = b.entry.id != null ? live.has(b.entry.id) : live.has(b.entry.dirKey)
      if (aLive !== bLive) return aLive ? -1 : 1
      const am = a.info != null ? a.info.mtimeMs : 0
      const bm = b.info != null ? b.info.mtimeMs : 0
      return bm - am
    })

    state.phase = 'fold'
    state.total = todo.length
    state.bytesTotal = todo.reduce((sum, item) => sum + (item.info != null ? item.info.size : 0), 0)
    state.changed = todo.length

    for (const item of todo) {
      if (options.signal != null && options.signal.aborted) break
      let result
      try {
        result = await foldEntry(item.entry, options)
      } catch (error) {
        result = { status: 'failed', reason: `意外异常：${String(error && error.message)}` }
      }
      if (result.status === 'failed') {
        // memo 命中说明同 (路径, 修订) 已报过，不再重复计数/刷屏
        if (result.memo !== true) {
          noteError(`${item.entry.path ?? item.entry.id}: ${result.reason}`)
          const memoId = item.entry.path != null && item.info != null ? `${item.entry.path}|${item.info.rev}` : `id:${item.entry.id}`
          rememberFailure(memoId, result.reason)
        }
      } else if (result.status === 'folded') {
        touchedKeys.add(result.key ?? item.entry.dirKey)
      } else if (result.status === 'reused') {
        state.reused += 1
      }
      state.done += 1
      state.bytesDone += item.info != null ? item.info.size : 0
      await yieldTo()
    }

    // 删除清理：日志已消失的记录（legacy 占位记录只在本轮未触及且无路径时清理）
    if (discovery.source !== 'sessionQuery') {
      const todoKeys = new Set()
      for (const item of todo) todoKeys.add(item.entry.dirKey)
      for (const record of [...store.records.values()]) {
        if (record.path != null) {
          if (!seenPaths.has(record.path)) {
            store.remove(record.key)
            foldStates.delete(record.key)
            state.removed += 1
          }
          continue
        }
        if (record.legacy === true && !touchedKeys.has(record.key) && !todoKeys.has(record.key)) {
          store.remove(record.key)
          state.removed += 1
        }
      }
    }

    await store.flush()
    await store.markScan(now())

    // 全量重算完成、占位记录已全部被真实折叠结果替换、且无失败 → 旧单体缓存退役
    if (state.legacy && state.errorCount === 0 && todo.length > 0 && !hasLegacyRecords()) {
      const retired = await store.retireLegacy()
      if (retired !== null) {
        state.legacy = false
        logger.warn(`全量重算完成，旧单体缓存已改名为 ${retired}`)
      }
    }

    // 顺序很关键：**先**让上层快照失效，**再**把 running 置回 false。
    // 反过来的话，轮询到 scanning=false 的那一刻可能拿到尚未失效的旧快照
    // （客户端会停在旧数字上直到下一次刷新）。
    onRecordsChanged()
    state.phase = 'idle'
    state.running = false
    state.lastFinishedAt = now()
    state.lastDurationMs = state.lastFinishedAt - startedAt

    return { ok: true, folded: todo.length, reused: state.reused, removed: state.removed, errors: state.errorCount }
  }

  /** 单飞 + force/rebuild 排队（排队时保留完整意图，rebuild 不被降级成 force）。 */
  function ensure(options = {}) {
    const force = options.force === true || options.rebuild === true
    if (currentRun !== null) {
      if (force) {
        queuedRun = {
          force: true,
          rebuild: options.rebuild === true || (queuedRun != null && queuedRun.rebuild === true),
        }
      }
      return currentRun
    }
    if (!force && state.lastFinishedAt !== null && now() - state.lastFinishedAt < SCAN_MIN_INTERVAL_MS) return null
    const promise = runOnce(options).catch((error) => {
      noteError(`扫描失败：${String(error && error.message)}`)
      state.running = false
      state.phase = 'idle'
      state.lastFinishedAt = now()
      return { ok: false, reason: String(error && error.message) }
    }).then((result) => {
      currentRun = null
      if (queuedRun !== null) {
        const next = queuedRun
        queuedRun = null
        return ensure(next)
      }
      return result
    })
    currentRun = promise
    return promise
  }

  return {
    state,
    errors,
    ensure,
    /** 是否已有可用记录（决定首屏能否直接出图）。 */
    hasData() { return store.records.size > 0 },
    /** 折叠状态表大小（诊断）。 */
    foldStateCount() { return foldStates.size },
    /** 失败记忆表大小（诊断）。 */
    failedCount() { return failedMemo.size },
    /** 测试/诊断：同步等待当前扫描。 */
    idle() { return currentRun === null },
    zstdAvailable,
  }
}
