/**
 * dsh-usage-stats — 帧级读取内核（v0.5.0）
 *
 * DSH 会话日志是**追加式多帧 zstd 容器**：每次 flush 追加一个独立可解的 frame，
 * 首帧首行是 `{"type":"session",…}` header，其后每条事件一行 JSON 且带单调递增 `seq`。
 * 因此"只读新增部分"在物理上成立：从上次消费的**字节偏移**起读，结构扫描出完整帧，
 * 只解压这些新帧即可 —— 无需重读重解整个文件。
 *
 * 本模块只做字节层：结构扫描 / 单帧解码 / 行拆分 / 追加式切片读。
 * 事件语义与聚合在 fold.js；调度与水位推进在 scan.js。
 *
 * 与框架的关系：框架 `SessionHandle.read(offset)` 的 offset 是**逻辑 seq**，
 * 实现上仍是整文件 readFile + 全帧解码后 slice（见 dsh-session-persistence-jsonl
 * lib/index.js:102-110），拿不到字节级增量；本模块是插件自建的增量通道，
 * 仅在框架路径不可用时才回退过去（见 scan.js 的能力探测）。
 *
 * 结构扫描规则对齐框架 `zstd.ts` 的 scanZstdFrames：**结构完整才接受**，
 * 帧内 EOF 记为 tornStart（撕裂尾帧，下次再读），保留位 / 坏魔数记为 invalidAt。
 */

import { open } from 'node:fs/promises'
// 命名空间导入而非具名导入：`zstdDecompressSync` 在 Node < 22.15 不存在，
// 具名导入会在模块链接期直接抛 SyntaxError 把插件打掉；命名空间导入永远安全。
import * as zlib from 'node:zlib'

/** zstd frame magic（小端读作 uint32）。 */
export const ZSTD_MAGIC = 0xfd2fb528

/** zstd 规范的单块最大尺寸（128 KB）：超过即视为头部损坏。 */
const ZSTD_BLOCK_MAX = 128 * 1024

/** 默认读块大小（1 MiB）：追加式切片读的最小步长。 */
export const READ_CHUNK_BYTES = 1024 * 1024

/** 单次切片读最多重试轮数（读到 EOF 后又发现文件增长时的续读次数）。 */
export const READ_MAX_ROUNDS = 3

/**
 * 运行环境是否提供同步 zstd 解码（Node ≥ 22.15 的 `zlib.zstdDecompressSync`）。
 * 为假时调用方必须退化为框架读取路径（功能正确、性能退化）。
 */
export function zstdAvailable() {
  return typeof zlib.zstdDecompressSync === 'function'
}

/**
 * 结构扫描一段字节里的**完整** zstd frame。
 *
 * @param buffer 从某个帧边界开始的字节（追加式切片读的产物）。
 * @param maxFrames 最多返回多少帧（Infinity = 不限）；截断时 `limitReached` 为 true。
 * @returns {{ frames: Array<[number, number]>, tornStart?: number, invalidAt?: number, invalidReason?: string, limitReached?: boolean }}
 *   frames 为 `[start, end)` 半开区间；tornStart 是"帧内 EOF"的起点（撕裂尾帧，丢弃重读）；
 *   invalidAt 是结构非法处（保留位 / 坏魔数 / 超大块），调用方应记录诊断并停止推进水位。
 */
export function scanZstdFrames(buffer, maxFrames = Infinity) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    // 不足 4 字节无法判定魔数：可能是撕裂，也可能只是读到了边界
    if (buffer.length - offset < 4) return { frames, tornStart: offset }
    const start = offset
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) {
      return { frames, invalidAt: offset, invalidReason: 'bad-magic' }
    }
    offset += 4
    if (offset >= buffer.length) return { frames, tornStart: start }
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    if ((descriptor & 24) !== 0) {
      return { frames, invalidAt: start, invalidReason: 'reserved-frame-header-bit' }
    }
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 32) !== 0
    const dictionaryFlag = descriptor & 3
    if (dictionaryFlag !== 0) {
      // 带字典的帧无法独立解压：与其静默少算，不如显式标记非法
      return { frames, invalidAt: start, invalidReason: 'dictionary-frame-unsupported' }
    }
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + contentSizeBytes
    if (buffer.length - offset < remainingHeaderBytes) return { frames, tornStart: start }
    offset += remainingHeaderBytes
    let finished = false
    for (;;) {
      if (buffer.length - offset < 3) return { frames, tornStart: start }
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 3
      const blockSize = blockHeader >>> 3
      if (blockType === 3) return { frames, invalidAt: start, invalidReason: 'reserved-block-type' }
      if (blockSize > ZSTD_BLOCK_MAX) return { frames, invalidAt: start, invalidReason: 'block-size-over-limit' }
      const payloadBytes = blockType === 1 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) return { frames, tornStart: start }
      offset += payloadBytes
      if (lastBlock) {
        if ((descriptor & 4) !== 0) {
          // 内容校验和：4 字节，缺失即撕裂
          if (buffer.length - offset < 4) return { frames, tornStart: start }
          offset += 4
        }
        finished = true
        break
      }
    }
    if (!finished) return { frames, tornStart: start }
    frames.push([start, offset])
    if (frames.length >= maxFrames) return { frames, limitReached: true }
  }
  return { frames }
}

/**
 * 解压一个结构完整的帧区间为 UTF-8 文本。
 * @returns {string|null} 解码失败（含校验和不符）返回 null，并把原因写入 `onError`。
 */
export function decodeFrameRange(buffer, range, onError) {
  if (buffer == null || !Array.isArray(range) || range.length !== 2) return null
  if (typeof zlib.zstdDecompressSync !== 'function') {
    if (typeof onError === 'function') onError('zstd-unavailable')
    return null
  }
  const [start, end] = range
  if (!(start >= 0) || !(end > start) || end > buffer.length) {
    if (typeof onError === 'function') onError('range-out-of-bounds')
    return null
  }
  try {
    return zlib.zstdDecompressSync(buffer.subarray(start, end)).toString('utf8')
  } catch (error) {
    if (typeof onError === 'function') onError(String((error && error.message) || error))
    return null
  }
}

/**
 * 把一帧的文本按行拆成事件对象数组（坏行跳过，不让单行拖垮整个会话）。
 * 与 v0.3.x 手写解码器的"坏行丢弃"语义一致。
 */
export function parseEventLines(text) {
  const events = []
  if (typeof text !== 'string' || text.length === 0) return events
  for (const line of text.split('\n')) {
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

/**
 * 从 `fromBytes` 起读一个会话日志的**新增字节**（追加式切片读）。
 *
 * 语义：
 *   - 只在 `fromBytes` 处开始读，返回的 buffer 从该偏移开始（调用方保证该偏移是帧边界）；
 *   - 读到 EOF 后重新 stat：若文件又增长（会话正在写），续读，最多 `READ_MAX_ROUNDS` 轮；
 *   - 任何一轮读失败都返回已读到的部分，由调用方决定水位推进。
 *
 * @returns {{ start: number, buffer: Buffer, readEnd: number, sizeBytes: number, rounds: number, eof: boolean }}
 *   readEnd = start + buffer.length（本次读到的绝对末位）；sizeBytes 为最终观察到的文件大小；
 *   eof=false 表示因轮数上限提前返回（可能还有未读字节，下次扫描续读）。
 */
export async function readAppended(path, fromBytes, options = {}) {
  const chunkBytes = Number.isFinite(options.chunkBytes) && options.chunkBytes > 0 ? options.chunkBytes : READ_CHUNK_BYTES
  const maxRounds = Number.isFinite(options.maxRounds) && options.maxRounds > 0 ? options.maxRounds : READ_MAX_ROUNDS
  const start = Number.isFinite(fromBytes) && fromBytes > 0 ? fromBytes : 0
  const handle = await open(path, 'r')
  const parts = []
  let readTo = start
  let rounds = 0
  let eof = false
  let size = 0
  try {
    size = (await handle.stat()).size
    while (rounds < maxRounds) {
      rounds += 1
      while (readTo < size) {
        const want = Math.min(chunkBytes, size - readTo)
        const buf = Buffer.allocUnsafe(want)
        const { bytesRead } = await handle.read(buf, 0, want, readTo)
        if (bytesRead <= 0) break
        parts.push(bytesRead === want ? buf : buf.subarray(0, bytesRead))
        readTo += bytesRead
      }
      const after = (await handle.stat()).size
      if (after <= readTo) {
        eof = true
        size = after
        break
      }
      size = after
    }
  } finally {
    await handle.close()
  }
  const buffer = parts.length === 1 ? parts[0] : Buffer.concat(parts)
  return { start, buffer, readEnd: start + buffer.length, sizeBytes: size, rounds, eof }
}
