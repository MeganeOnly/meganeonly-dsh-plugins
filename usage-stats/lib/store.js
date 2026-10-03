/**
 * dsh-usage-stats — 会话级记录存储（v0.5.0）
 *
 * 存储布局（相对 web profile 根）：
 *
 *   .usage-stats/
 *     manifest.json                    { storeVersion, createdAt, lastScanAt }
 *     sessions/<safeKey>.json          一条记录 = 一个会话的"水位 + 锚 + 聚合"
 *     sessions/<safeKey>.json.bak-<ts> 校验失败记录的 backup-and-skip 落点
 *
 * 为什么不是单文件：v0.4.x 把 692 条 agg 塞进一个 4.14 MB 的 JSON，每次有会话变化
 * 就整份重写（写放大），且没有任何水位信息 —— 换缓存版本只能全量重算。改成
 * 每会话一条记录后：写入是 O(1) 条记录、原子替换；读取按需；水位随记录持久化，
 * 重启后从上次字节偏移续读。布局与 framework 自己的 `session_projcache`
 * （`<storages>/session_projcache/sessions/<id>.json`）同构 —— 这是本项目内已验证的形态。
 *
 * 可靠性策略（对齐 framework 领域存储的语义）：
 *   - 写入：临时文件 + rename 原子替换；2s 去抖合并同会话连续写入；失败只告警，
 *     记录保持陈旧，下次扫描自愈（fail-soft）
 *   - 读取：逐条 schema 校验；不合规记录改名 .bak-<ts> 并告警，视为不存在
 *   - 版本：manifest.storeVersion !== STORE_VERSION 时整目录改名 .usage-stats.bak-<ts>
 *     后从空开始（每次 bump 必须在 CHANGELOG 说明理由，且要有 fixture 测试证明不会启动失败）
 *   - legacy：v0.4.x 的 <profileRoot>/.usage-stats-cache.json 只**读**不写，
 *     转成临时记录供首屏显示；重算成功后才由 retireLegacy() 改名
 */

import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { STORE_DIR_NAME, STORE_VERSION, LEGACY_CACHE_FILENAME, WRITE_DEBOUNCE_MS } from './constants.js'

/** 记录文件名安全化：跨平台非法字符替换为下划线，并限长。 */
export function safeRecordFileName(key) {
  const base = String(key ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120)
  return `${base.length > 0 ? base : 'unnamed'}.json`
}

/** 时间戳后缀（用于 .bak-<ts> / .legacy-<ts>）。 */
export function stampSuffix(nowMs = Date.now()) {
  return new Date(nowMs).toISOString().replace(/[:.]/g, '-')
}

/** 存储路径集合（纯函数，便于测试与诊断输出）。 */
export function storePaths(profileRoot) {
  const dir = join(profileRoot, STORE_DIR_NAME)
  return {
    profileRoot,
    dir,
    manifestPath: join(dir, 'manifest.json'),
    sessionsDir: join(dir, 'sessions'),
    legacyPath: join(profileRoot, LEGACY_CACHE_FILENAME),
  }
}

/**
 * 记录 schema 校验。只挡"会让下游崩或静默算错"的形态，
 * 不校验聚合体内部每个桶（那属于 fold.js 的不变量，由重建路径保证）。
 *
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateRecord(record) {
  if (record == null || typeof record !== 'object' || Array.isArray(record)) return { ok: false, reason: 'not-an-object' }
  if (record.v !== STORE_VERSION) return { ok: false, reason: `store-version-mismatch:${String(record.v)}` }
  if (typeof record.key !== 'string' || record.key.length === 0) return { ok: false, reason: 'missing-key' }
  if (record.agg == null || typeof record.agg !== 'object' || Array.isArray(record.agg)) return { ok: false, reason: 'missing-agg' }
  if (record.agg.totals == null || typeof record.agg.totals !== 'object') return { ok: false, reason: 'missing-agg-totals' }
  if (record.cursor != null && (typeof record.cursor !== 'object' || Array.isArray(record.cursor))) return { ok: false, reason: 'bad-cursor' }
  if (record.meta != null && (typeof record.meta !== 'object' || Array.isArray(record.meta))) return { ok: false, reason: 'bad-meta' }
  return { ok: true }
}

/** 组装一条规范记录（缺字段补默认值，避免下游到处判空）。 */
export function makeRecord(fields) {
  const cursor = fields.cursor || {}
  return {
    v: STORE_VERSION,
    key: fields.key,
    path: fields.path ?? null,
    gen: Number.isFinite(fields.gen) ? fields.gen : null,
    rev: fields.rev ?? null,
    cursor: {
      bytes: Number.isFinite(cursor.bytes) && cursor.bytes > 0 ? cursor.bytes : 0,
      frames: Number.isFinite(cursor.frames) && cursor.frames > 0 ? cursor.frames : 0,
      lastSeq: Number.isFinite(cursor.lastSeq) ? cursor.lastSeq : -1,
    },
    anchor: fields.anchor ?? null,
    meta: fields.meta ?? null,
    legacy: fields.legacy === true,
    updatedAt: fields.updatedAt ?? Date.now(),
    agg: fields.agg,
  }
}

/** 原子写 JSON：临时文件（带 pid 防并发撞名）+ rename 覆盖。 */
async function writeJsonAtomic(path, value) {
  const tmp = `${path}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(value), 'utf8')
  await rename(tmp, path)
}

/**
 * 读取 v0.4.x 单体缓存为**临时记录**（只读，不落新库）。
 *
 * 旧 agg 没有水位信息，因此 cursor.bytes=0 / lastSeq=-1 / legacy=true：
 * 扫描器会把它当成"必定过期"的记录重新折叠并覆盖。这样首屏能立刻显示旧数据，
 * 后台重算完成后自动换成正确值 —— 正是"先显示旧数据、后台全量重算"的落地方式。
 *
 * @returns {Promise<Map<string, object>|null>} 无文件 / 解析失败返回 null
 */
export async function readLegacyRecords(profileRoot) {
  const { legacyPath } = storePaths(profileRoot)
  let parsed
  try {
    parsed = JSON.parse(await readFile(legacyPath, 'utf8'))
  } catch {
    return null
  }
  if (parsed == null || typeof parsed !== 'object' || parsed.sessions == null || typeof parsed.sessions !== 'object') return null
  const out = new Map()
  for (const key of Object.keys(parsed.sessions)) {
    const entry = parsed.sessions[key]
    const agg = entry && typeof entry === 'object' ? entry.agg : null
    if (agg == null || typeof agg !== 'object' || agg.totals == null) continue
    const meta = {
      id: typeof agg.id === 'string' ? agg.id : key,
      createdAt: Number.isFinite(agg.createdAt) ? agg.createdAt : null,
      cwd: typeof agg.cwd === 'string' ? agg.cwd : null,
      preset: typeof agg.preset === 'string' ? agg.preset : null,
      parentSession: typeof agg.parentSession === 'string' ? agg.parentSession : null,
      delegationDepth: Number.isFinite(agg.delegationDepth) ? agg.delegationDepth : 0,
      origin: typeof agg.origin === 'string' ? agg.origin : null,
      title: typeof agg.title === 'string' ? agg.title : null,
    }
    out.set(key, makeRecord({
      key,
      path: null,
      gen: null,
      rev: null, // 永远视为过期 → 扫描器必定重折叠该会话
      cursor: { bytes: 0, frames: 0, lastSeq: -1 },
      anchor: null,
      meta,
      legacy: true,
      agg: { ...agg, lastSeq: -1 },
    }))
  }
  return out.size > 0 ? out : null
}

/**
 * 创建存储实例。
 *
 * @param profileRoot web profile 根目录（plugin 的 ctx.baseUrl 解析而来）
 * @param options.timers `{ set, clear }`（默认全局 setTimeout/clearTimeout；
 *   插件可传入 fiber 绑定的定时器，让去抖计时器随插件卸载一起清理）
 * @param options.debounceMs 写去抖窗口
 * @param options.onWarn 告警回调（默认 console.warn）
 */
export function createStore(profileRoot, options = {}) {
  const paths = storePaths(profileRoot)
  const timers = options.timers || { set: setTimeout, clear: clearTimeout }
  const debounceMs = Number.isFinite(options.debounceMs) ? options.debounceMs : WRITE_DEBOUNCE_MS
  const onWarn = typeof options.onWarn === 'function' ? options.onWarn : (message) => console.warn(`[usage-stats] ${message}`)

  /** @type {Map<string, object>} key -> record */
  const records = new Map()
  /** @type {Map<string, string>} path -> key（发现层按路径查修订） */
  const byPath = new Map()
  /** @type {Set<string>} 待落盘的 key */
  const dirty = new Set()
  const warnings = []
  let manifest = { storeVersion: STORE_VERSION, createdAt: Date.now(), lastScanAt: null }
  let writeTimer = null
  /** 写链：所有落盘串行执行，避免同一文件并发 rename 相互踩踏。 */
  let writeChain = Promise.resolve()

  function warn(message) {
    warnings.push(message)
    if (warnings.length > 50) warnings.shift()
    onWarn(message)
  }

  function reindex(record) {
    if (record.path != null) byPath.set(record.path, record.key)
  }

  function deindex(record) {
    if (record.path != null && byPath.get(record.path) === record.key) byPath.delete(record.path)
  }

  /** 存储目录是否可用；不可用时整库降级为"仅内存"（统计照常，只是不持久化）。 */
  let storageUsable = true

  /** 加载 manifest + 全部记录；版本不匹配时整目录改名后从空开始。 */
  async function load() {
    try {
      await mkdir(paths.sessionsDir, { recursive: true })
    } catch (error) {
      storageUsable = false
      warn(`存储目录不可用（${String(error && error.message)}），本次运行降级为仅内存统计`)
      return
    }
    let manifestRaw = null
    try {
      manifestRaw = JSON.parse(await readFile(paths.manifestPath, 'utf8'))
    } catch {
      manifestRaw = null
    }
    if (manifestRaw != null && manifestRaw.storeVersion !== STORE_VERSION) {
      const moved = await rotateAside(`version-${String(manifestRaw.storeVersion)}`)
      warn(`存储版本 ${String(manifestRaw.storeVersion)} ≠ ${STORE_VERSION}，旧目录已改名为 ${moved}，从空重建`)
      return
    }
    if (manifestRaw != null && typeof manifestRaw === 'object') {
      manifest = { ...manifest, ...manifestRaw, storeVersion: STORE_VERSION }
    } else {
      await writeJsonAtomic(paths.manifestPath, manifest).catch(() => {})
    }

    let files = []
    try {
      files = await readdir(paths.sessionsDir)
    } catch {
      return
    }
    for (const name of files) {
      if (!name.endsWith('.json')) continue
      const full = join(paths.sessionsDir, name)
      let record
      try {
        record = JSON.parse(await readFile(full, 'utf8'))
      } catch (error) {
        await backupAside(full, 'parse-error')
        warn(`记录 ${name} 解析失败（${String(error && error.message)}），已改名 .bak 并跳过`)
        continue
      }
      const verdict = validateRecord(record)
      if (!verdict.ok) {
        await backupAside(full, verdict.reason)
        warn(`记录 ${name} 不合规（${verdict.reason}），已改名 .bak 并跳过`)
        continue
      }
      if (record.agg.lastSeq === undefined) record.agg.lastSeq = Number.isFinite(record.cursor?.lastSeq) ? record.cursor.lastSeq : -1
      records.set(record.key, record)
      reindex(record)
    }
  }

  /** 整目录改名（版本不匹配时）。 */
  async function rotateAside(reason) {
    const target = `${paths.dir}.bak-${stampSuffix()}`
    try {
      await rename(paths.dir, target)
    } catch (error) {
      warn(`旧存储目录改名失败：${String(error && error.message)}`)
      return null
    }
    records.clear()
    byPath.clear()
    dirty.clear()
    await mkdir(paths.sessionsDir, { recursive: true })
    manifest = { storeVersion: STORE_VERSION, createdAt: Date.now(), lastScanAt: null }
    await writeJsonAtomic(paths.manifestPath, manifest).catch(() => {})
    return target
  }

  async function backupAside(fullPath, reason) {
    try {
      await rename(fullPath, `${fullPath}.bak-${stampSuffix()}`)
    } catch (error) {
      warn(`损坏记录改名失败（${reason}）：${String(error && error.message)}`)
    }
  }

  function schedule() {
    if (writeTimer !== null) return
    writeTimer = timers.set(() => {
      writeTimer = null
      flush().catch(() => {})
    }, debounceMs)
  }

  /** 写入/更新一条记录（默认去抖落盘；immediate=true 立即写）。 */
  function set(record, opts = {}) {
    const verdict = validateRecord(record)
    if (!verdict.ok) {
      warn(`拒绝写入不合规记录 ${String(record && record.key)}（${verdict.reason}）`)
      return false
    }
    const previous = records.get(record.key)
    if (previous !== undefined) deindex(previous)
    records.set(record.key, record)
    reindex(record)
    dirty.add(record.key)
    if (opts.immediate === true) {
      flush().catch(() => {})
    } else {
      schedule()
    }
    return true
  }

  /**
   * 只放进内存、**不落盘**（v0.4.x 旧缓存的占位记录用）。
   * 占位记录只是首屏的临时展示，扫描器会用真实折叠结果覆盖同 key 的记录；
   * 若写盘就等于把"已知偏少"的旧数字固化进新库。
   */
  function seed(record) {
    const verdict = validateRecord(record)
    if (!verdict.ok) {
      warn(`跳过不合规的占位记录 ${String(record && record.key)}（${verdict.reason}）`)
      return false
    }
    const previous = records.get(record.key)
    if (previous !== undefined) deindex(previous)
    records.set(record.key, record)
    reindex(record)
    return true
  }

  /** 删除一条记录。 */
  function remove(key, opts = {}) {
    const previous = records.get(key)
    if (previous === undefined) return false
    deindex(previous)
    records.delete(key)
    dirty.add(key)
    if (opts.immediate === true) flush().catch(() => {})
    else schedule()
    return true
  }

  /** 立即落盘全部脏记录（串行写链，失败只告警，不抛）。 */
  function flush() {
    const keys = [...dirty]
    dirty.clear()
    if (keys.length === 0) return writeChain
    const run = async () => {
      for (const key of keys) {
        const record = records.get(key)
        const target = join(paths.sessionsDir, safeRecordFileName(key))
        try {
          if (record === undefined) {
            await rm(target, { force: true })
            continue
          }
          record.updatedAt = Date.now()
          await writeJsonAtomic(target, record)
        } catch (error) {
          warn(`记录 ${key} 落盘失败：${String(error && error.message)}`)
        }
      }
    }
    writeChain = writeChain.then(run, run)
    return writeChain
  }

  /** 更新 manifest 的 lastScanAt（扫描结束时调用）。 */
  async function markScan(atMs = Date.now()) {
    manifest = { ...manifest, storeVersion: STORE_VERSION, lastScanAt: atMs }
    await writeJsonAtomic(paths.manifestPath, manifest).catch(() => {})
  }

  /** 旧单体缓存是否仍在原位（用于首屏 legacy 判定与重算后的退役改名）。 */
  async function hasLegacy() {
    try {
      await readFile(paths.legacyPath, 'utf8')
      return true
    } catch {
      return false
    }
  }

  /** 重算成功后把旧单体缓存改名退役（保留 .legacy-<ts> 可回滚）。 */
  async function retireLegacy() {
    const target = `${paths.legacyPath}.legacy-${stampSuffix()}`
    try {
      await rename(paths.legacyPath, target)
      return target
    } catch {
      return null
    }
  }

  function close() {
    if (writeTimer !== null) {
      timers.clear(writeTimer)
      writeTimer = null
    }
  }

  return {
    paths,
    warnings,
    get manifest() { return manifest },
    get records() { return records },
    get byPath() { return byPath },
    get dirtyCount() { return dirty.size },
    get storageUsable() { return storageUsable },
    /** 取一条记录（不存在返回 undefined）。 */
    get(key) { return records.get(key) },
    /** 按日志路径取记录（发现层做修订比较用）。 */
    getByPath(path) { const key = byPath.get(path); return key === undefined ? undefined : records.get(key) },
    load,
    set,
    seed,
    remove,
    flush,
    markScan,
    hasLegacy,
    retireLegacy,
    rotateAside,
    close,
  }
}
