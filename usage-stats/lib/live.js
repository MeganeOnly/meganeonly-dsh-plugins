/**
 * dsh-usage-stats — 实时会话折叠（v0.5.0）
 *
 * 扫描器每次跑的间隔是秒级、且依赖 DSH 把事件 flush 到磁盘；而"我现在这个会话用了多少"
 * 是用户最常看的一格。本模块直接订阅框架的提交事件流
 * （`ctx.on('session/event', (session, event) => …)`，投影注册表用的是同一个 seam），
 * 用与磁盘折叠**同一套** fold.js 内核逐事件折叠，因此数字口径完全一致。
 *
 * 与磁盘记录的关系（避免"实时值反而更少"这类反向 bug）：
 *   - **以磁盘为基**：`seedFrom(record)` 用磁盘真相重播实时条目（深拷贝 agg，含 lastSeq）。
 *     之后到达的实时事件若 seq ≤ 水位会被 fold 判为 duplicate，不会重复计数。
 *   - **只在"更全"时覆盖**：payload 仅在一个实时条目的 `lastSeq` 大于该会话磁盘水位时才用它
 *     （见 payload.js）；未播种（`seeded = false`）的条目一律不用 —— 那意味着插件是在会话
 *     中途启动的，此刻的实时 agg 缺前半段，用它就等于少报。
 *   - 磁盘随时可能反超（扫描把未 flush 的部分也折进去了），此时条目被丢弃或重新播种。
 *
 * 内存有界：条目上限 `LIVE_MAX_ENTRIES`（LRU 淘汰，被淘汰的数据会在下一次扫描里由磁盘补齐）。
 */

import { LIVE_MAX_ENTRIES, LIVE_ACTIVE_WINDOW_MS, LIVE_BUFFER_MAX } from './constants.js'
import { applyEvent, createFoldState, sessionHeaderEvent } from './fold.js'

/** 从 Session 对象/字符串取逻辑会话 id。 */
function sessionIdOf(session) {
  if (typeof session === 'string') return session.length > 0 ? session : null
  if (session == null || typeof session !== 'object') return null
  if (typeof session.id === 'string' && session.id.length > 0) return session.id
  const header = session.header
  if (header != null && typeof header.id === 'string' && header.id.length > 0) return header.id
  return null
}

/**
 * 创建实时折叠器。
 *
 * @param options.maxEntries 条目上限（默认 LIVE_MAX_ENTRIES）
 * @param options.maxBuffered 未播种时最多缓存多少事件（默认 LIVE_BUFFER_MAX；超限丢弃条目，
 *   数据会在下一次扫描里由磁盘补齐）
 * @param options.getRecord 可选：`(id) => record | undefined`，条目创建时用它立刻播种，
 *   避免"插件在会话中途启动 + 扫描已经跑过"这种组合下实时支路永远无法启用
 * @param options.now 可选时钟
 * @param options.onChanged 可选回调（某会话的实时状态变化；调用方据此让 payload 失效）
 */
export function createLiveFolder(options = {}) {
  const maxEntries = Number.isFinite(options.maxEntries) && options.maxEntries > 0 ? options.maxEntries : LIVE_MAX_ENTRIES
  const maxBuffered = Number.isFinite(options.maxBuffered) && options.maxBuffered > 0 ? options.maxBuffered : LIVE_BUFFER_MAX
  const now = typeof options.now === 'function' ? options.now : () => Date.now()
  const onChanged = typeof options.onChanged === 'function' ? options.onChanged : null
  const getRecord = typeof options.getRecord === 'function' ? options.getRecord : null

  /** @type {Map<string, {fold: object, seeded: boolean, buffered: Array<object>, updatedAt: number}>} */
  const entries = new Map()

  function touch(entry, key) {
    entry.updatedAt = now()
    entries.delete(key)
    entries.set(key, entry)
  }

  function evictIfNeeded() {
    while (entries.size > maxEntries) {
      const oldestKey = entries.keys().next().value
      entries.delete(oldestKey)
    }
  }

  /** 用磁盘记录重播条目（深拷贝 agg + 回放未播种期间缓存的事件）。 */
  function rebase(entry, record) {
    try {
      entry.fold.agg = JSON.parse(JSON.stringify(record.agg))
    } catch {
      return false
    }
    if (!Number.isFinite(entry.fold.agg.lastSeq)) entry.fold.agg.lastSeq = -1
    for (const event of entry.buffered) applyEvent(entry.fold, event)
    entry.buffered.length = 0
    entry.seeded = true
    return true
  }

  /** 取（必要时新建）某会话的实时条目；有磁盘记录时立即播种。 */
  function ensureEntry(id, session) {
    let entry = entries.get(id)
    if (entry !== undefined) {
      touch(entry, id)
      return entry
    }
    const fold = createFoldState(id)
    const header = session != null && typeof session === 'object' ? session.header : null
    if (header != null) applyEvent(fold, sessionHeaderEvent(header))
    entry = { fold, seeded: false, buffered: [], updatedAt: now() }
    if (getRecord !== null) {
      const record = getRecord(id)
      if (record != null && record.agg != null) rebase(entry, record)
    }
    entries.set(id, entry)
    evictIfNeeded()
    return entry
  }

  /**
   * 处理一条提交事件。
   *
   * 未播种的条目**只缓存事件不折叠** —— 此时它的 agg 缺前半段，折叠出来的数字没有意义；
   * 等 `seedFrom`（扫描器折叠完该会话）把磁盘真相接上，再回放缓存事件。
   *
   * @returns {boolean} 是否真的改变了可用于统计的状态（调用方据此决定要不要让快照失效）
   */
  function handleEvent(session, event) {
    const id = sessionIdOf(session)
    if (id == null) return false
    const entry = ensureEntry(id, session)
    if (entry.seeded !== true) {
      if (entry.buffered.length >= maxBuffered) {
        // 缓存打满：丢弃条目，数据交给下一次扫描由磁盘补齐（宁可少一次实时，也不要无界内存）
        entries.delete(id)
        return false
      }
      entry.buffered.push(event)
      return false
    }
    const outcome = applyEvent(entry.fold, event)
    if (outcome !== 'applied') return false
    if (onChanged !== null) onChanged(id)
    return true
  }

  /**
   * 用磁盘记录给实时条目重新播种（扫描器折叠完该会话后调用）。
   *
   * 只在磁盘水位**不低于**实时水位时重播：否则说明实时条目已经领先于磁盘
   * （未 flush 的事件），重播会把这部分丢掉。
   */
  function seedFrom(record) {
    if (record == null || typeof record.key !== 'string' || record.agg == null) return false
    const entry = entries.get(record.key)
    if (entry === undefined) return false
    const diskSeq = Number.isFinite(record.cursor?.lastSeq) ? record.cursor.lastSeq : -1
    const liveSeq = Number.isFinite(entry.fold.agg.lastSeq) ? entry.fold.agg.lastSeq : -1
    if (entry.seeded === true && diskSeq < liveSeq) return false
    const changed = rebase(entry, record)
    if (changed) touch(entry, record.key)
    return changed
  }

  /** 取某会话的实时状态（未播种时 seeded=false，调用方不得使用其 agg）。 */
  function get(id) {
    const entry = entries.get(id)
    if (entry === undefined) return undefined
    return {
      agg: entry.fold.agg,
      lastSeq: entry.fold.agg.lastSeq,
      seeded: entry.seeded,
      buffered: entry.buffered.length,
      updatedAt: entry.updatedAt,
    }
  }

  /** 实时状态是否领先于给定磁盘水位（payload 决定是否采用实时值）。 */
  function isAheadOf(id, diskSeq) {
    const entry = entries.get(id)
    if (entry === undefined || entry.seeded !== true) return false
    const liveSeq = Number.isFinite(entry.fold.agg.lastSeq) ? entry.fold.agg.lastSeq : -1
    const threshold = Number.isFinite(diskSeq) ? diskSeq : -1
    return liveSeq > threshold
  }

  /** 最近一段时间内有事件的会话数（客户端据此决定要不要继续轮询）。 */
  function activeCount(windowMs = LIVE_ACTIVE_WINDOW_MS) {
    const floor = now() - windowMs
    let count = 0
    for (const entry of entries.values()) if (entry.updatedAt >= floor) count += 1
    return count
  }

  /** 领先于磁盘的会话数（payload 的 live.ahead）。 */
  function aheadCount(seqOf) {
    let count = 0
    for (const [id, entry] of entries) {
      if (entry.seeded !== true) continue
      const liveSeq = Number.isFinite(entry.fold.agg.lastSeq) ? entry.fold.agg.lastSeq : -1
      const diskSeq = typeof seqOf === 'function' ? seqOf(id) : -1
      if (liveSeq > (Number.isFinite(diskSeq) ? diskSeq : -1)) count += 1
    }
    return count
  }

  return {
    handleEvent,
    seedFrom,
    get,
    isAheadOf,
    activeCount,
    aheadCount,
    size() { return entries.size },
    clear() { entries.clear() },
  }
}
