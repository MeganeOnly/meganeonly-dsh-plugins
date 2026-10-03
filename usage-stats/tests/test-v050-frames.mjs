// tests/test-v050-frames.mjs
// v0.5.0 步骤 1：帧级读取内核（lib/frames.js）单测。
//
// 覆盖：多帧结构扫描 / 撕裂尾帧 / 坏魔数 / 保留位 / 字典帧 / 块尺寸越界 /
//       maxFrames 截断 / 单帧解码与校验和 / 行拆分坏行容错 / 追加式切片读。
//
// 用法：node tests/test-v050-frames.mjs
// 期望：PASS 所有条目；任一 FAIL 立即 process.exit(1)。

import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zstdCompressSync } from 'node:zlib'

import {
  ZSTD_MAGIC,
  scanZstdFrames,
  decodeFrameRange,
  parseEventLines,
  readAppended,
  zstdAvailable,
} from '../lib/frames.js'

const results = []
function assert(label, cond, detail) {
  results.push({ label, ok: !!cond, detail })
  if (!cond) console.error(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`)
}

/** 把若干段文本各压成一帧，拼成 DSH 风格的追加式容器。 */
function buildContainer(texts) {
  return Buffer.concat(texts.map((t) => zstdCompressSync(Buffer.from(t, 'utf8'))))
}

const line = (obj) => JSON.stringify(obj) + '\n'

/* ------------------------------------------------------------------ *
 * 1) 能力探测 + 结构扫描基本形
 * ------------------------------------------------------------------ */
{
  assert('1.1 运行环境提供同步 zstd 解码（Node ≥ 22.15）', zstdAvailable() === true, 'zstdDecompressSync unavailable')

  const f1 = line({ type: 'session', version: 4, id: 's1', createdAt: 1700000000000 })
  const f2 = line({ type: 'assistant/message', seq: 0, time: 1700000001000, data: { usage: { inputTokens: 1 } } })
  const f3 = line({ type: 'step/end', seq: 1, time: 1700000002000 })
  const buf = buildContainer([f1, f2, f3])

  assert('1.2 容器起始即 zstd 魔数', buf.readUInt32LE(0) === ZSTD_MAGIC, `magic=${buf.readUInt32LE(0).toString(16)}`)

  const scan = scanZstdFrames(buf)
  assert('1.3 三帧全部识别为结构完整', scan.frames.length === 3, `frames=${scan.frames.length}`)
  assert('1.4 无撕裂、无非法', scan.tornStart === undefined && scan.invalidAt === undefined, `torn=${scan.tornStart}, invalid=${scan.invalidAt}`)
  assert('1.5 帧区间首尾相接且覆盖整个容器', scan.frames[0][0] === 0 && scan.frames[2][1] === buf.length, `first=${scan.frames[0][0]}, lastEnd=${scan.frames[2][1]}, len=${buf.length}`)

  const texts = scan.frames.map((r) => decodeFrameRange(buf, r))
  assert('1.6 逐帧解码文本与原文一致', texts[0] === f1 && texts[1] === f2 && texts[2] === f3, 'decoded text mismatch')

  const evs = texts.flatMap((t) => parseEventLines(t))
  assert('1.7 行拆分为 3 条事件且 type 正确', evs.length === 3 && evs[0].type === 'session' && evs[2].type === 'step/end', `n=${evs.length}`)
  assert('1.8 header 行无 seq、事件行有 seq', evs[0].seq === undefined && evs[1].seq === 0 && evs[2].seq === 1, `seq=${evs.map((e) => e.seq).join(',')}`)
}

/* ------------------------------------------------------------------ *
 * 2) 撕裂尾帧：帧内 EOF 只记 tornStart，已完整的前缀仍可用
 * ------------------------------------------------------------------ */
{
  const f1 = line({ type: 'session', id: 's2' })
  const f2 = line({ type: 'step/end', seq: 0 })
  const whole = buildContainer([f1, f2])
  const third = zstdCompressSync(Buffer.from(line({ type: 'step/end', seq: 1 }), 'utf8'))
  const torn = Buffer.concat([whole, third.subarray(0, 7)]) // 第三帧只落了 7 字节（写一半）

  const scan = scanZstdFrames(torn)
  assert('2.1 撕裂尾帧下仍识别出 2 个完整帧', scan.frames.length === 2, `frames=${scan.frames.length}`)
  assert('2.2 tornStart 指向撕裂帧起点（= 已读前缀长度）', scan.tornStart === whole.length, `tornStart=${scan.tornStart}, expected=${whole.length}`)
  assert('2.3 撕裂不产生 invalid', scan.invalidAt === undefined, `invalid=${scan.invalidAt}`)
  assert('2.4 撕裂帧不进入 frames（不会被误解码）', scan.frames.every(([, e]) => e <= scan.tornStart), 'torn frame leaked into frames')
  assert('2.5 撕裂前缀仍可完整解码（水位可安全推进到 tornStart）', decodeFrameRange(torn, scan.frames[1]).includes('step/end'), 'prefix decode failed')
}

/* ------------------------------------------------------------------ *
 * 3) 结构非法：坏魔数 / 保留位 / 字典帧 / 块尺寸越界
 * ------------------------------------------------------------------ */
{
  const good = buildContainer([line({ type: 'session', id: 's3' })])
  const badMagic = Buffer.from(good)
  badMagic.writeUInt32LE(0x11223344, 0)
  const s1 = scanZstdFrames(badMagic)
  assert('3.1 坏魔数 → invalidAt=0 且 reason=bad-magic', s1.invalidAt === 0 && s1.invalidReason === 'bad-magic', `invalidAt=${s1.invalidAt}, reason=${s1.invalidReason}`)

  const reservedBit = Buffer.from(good)
  reservedBit.writeUInt8(reservedBit.readUInt8(4) | 8, 4) // descriptor 第 4 位（保留位）
  const s2 = scanZstdFrames(reservedBit)
  assert('3.2 保留位 → invalidAt=0 且 reason=reserved-frame-header-bit', s2.invalidAt === 0 && s2.invalidReason === 'reserved-frame-header-bit', `reason=${s2.invalidReason}`)

  const dictFrame = Buffer.from(good)
  dictFrame.writeUInt8((dictFrame.readUInt8(4) & 0xfc) | 1, 4) // dictionaryFlag = 1
  const s3 = scanZstdFrames(dictFrame)
  assert('3.3 字典帧 → 显式非法（不静默少算）', s3.invalidAt === 0 && s3.invalidReason === 'dictionary-frame-unsupported', `reason=${s3.invalidReason}`)

  // 在合法帧后追加一个"块尺寸越界"的伪造帧头（魔数正确、descriptor 合法，块头 size 超限）
  const fake = Buffer.alloc(16)
  fake.writeUInt32LE(ZSTD_MAGIC, 0)
  fake.writeUInt8(0x20, 4) // singleSegment
  fake.writeUInt8(0x00, 5) // content size（1 字节）
  const hugeBlock = 200 * 1024 << 3 // blockSize 200 KB > 128 KB 上限
  fake.writeUIntLE(hugeBlock & 0xffffff, 6, 3)
  const s4 = scanZstdFrames(Buffer.concat([good, fake]))
  assert('3.4 块尺寸越界 → invalidAt 指向伪造帧起点', s4.frames.length === 1 && s4.invalidAt === good.length && s4.invalidReason === 'block-size-over-limit', `frames=${s4.frames.length}, invalidAt=${s4.invalidAt}, reason=${s4.invalidReason}`)
}

/* ------------------------------------------------------------------ *
 * 4) 边界：空 / 过短 / maxFrames 截断 / 参数脏值
 * ------------------------------------------------------------------ */
{
  assert('4.1 空 buffer → 0 帧、无撕裂无非法', (() => { const s = scanZstdFrames(Buffer.alloc(0)); return s.frames.length === 0 && s.tornStart === undefined && s.invalidAt === undefined })())
  assert('4.2 只有 2 字节 → tornStart=0（当作撕裂而不是非法）', (() => { const s = scanZstdFrames(Buffer.from([0x28, 0xb5])); return s.frames.length === 0 && s.tornStart === 0 })())

  const buf = buildContainer([line({ type: 'session', id: 'a' }), line({ type: 'step/end', seq: 0 }), line({ type: 'step/end', seq: 1 })])
  const limited = scanZstdFrames(buf, 2)
  assert('4.3 maxFrames=2 → 只返回 2 帧并标 limitReached', limited.frames.length === 2 && limited.limitReached === true, `frames=${limited.frames.length}, limitReached=${limited.limitReached}`)
  assert('4.4 截断时不误报撕裂（是我们主动停的）', limited.tornStart === undefined, `tornStart=${limited.tornStart}`)

  assert('4.5 非 buffer 输入不抛（返回空结果）', (() => { const s = scanZstdFrames(Buffer.from([0xff, 0xff, 0xff, 0xff])); return s.invalidAt === 0 })())
}

/* ------------------------------------------------------------------ *
 * 5) 单帧解码：校验和 / 越界 / 不可用
 * ------------------------------------------------------------------ */
{
  const text = line({ type: 'assistant/message', seq: 0, data: { usage: { inputTokens: 42 } } })
  const frame = zstdCompressSync(Buffer.from(text, 'utf8'))
  const hasChecksum = (frame.readUInt8(4) & 4) !== 0

  assert('5.1 完好帧解码一致', decodeFrameRange(frame, [0, frame.length]) === text, 'decode mismatch')

  const corrupt = Buffer.from(frame)
  corrupt[corrupt.length - 5] ^= 0xff // 翻转载荷末字节
  const errors = []
  const decoded = decodeFrameRange(corrupt, [0, corrupt.length], (e) => errors.push(e))
  assert(
    hasChecksum
      ? '5.2 带校验和的损坏帧 → 解码失败并回报原因'
      : '5.2 无校验和的损坏帧 → 结果与原文不同（不静默接受）',
    hasChecksum ? decoded === null && errors.length === 1 : decoded !== text,
    `checksum=${hasChecksum}, decoded=${decoded === null ? 'null' : 'text'}, errors=${JSON.stringify(errors)}`
  )

  const bad = []
  assert('5.3 区间越界 → null + range-out-of-bounds', decodeFrameRange(frame, [0, frame.length + 10], (e) => bad.push(e)) === null && bad[0] === 'range-out-of-bounds', `errors=${JSON.stringify(bad)}`)
  assert('5.4 区间非法（非数组 / 长度不对）→ null 且不抛', decodeFrameRange(frame, null) === null && decodeFrameRange(frame, [1]) === null, 'threw or accepted')
}

/* ------------------------------------------------------------------ *
 * 6) 行拆分容错
 * ------------------------------------------------------------------ */
{
  const text = '{"type":"a"}\n\n  \nnot-json\n{"type":"b"}\n'
  const evs = parseEventLines(text)
  assert('6.1 坏行跳过、空行跳过、好行保留', evs.length === 2 && evs[0].type === 'a' && evs[1].type === 'b', `n=${evs.length}`)
  assert('6.2 非字符串输入 → 空数组且不抛', parseEventLines(null).length === 0 && parseEventLines(undefined).length === 0, 'threw')
  assert('6.3 非对象 JSON（数字/数组）也算合法行（由上层守卫）', parseEventLines('1\n[2]\n').length === 2, 'parsed fewer lines')
}

/* ------------------------------------------------------------------ *
 * 7) 追加式切片读：只读新增字节，天然对齐帧边界
 * ------------------------------------------------------------------ */
{
  const dir = mkdtempSync(join(tmpdir(), 'usage-stats-frames-'))
  const path = join(dir, 'session.v4.jsonl.zstd')
  try {
    const f1 = line({ type: 'session', version: 4, id: 'grow-1' })
    const f2 = line({ type: 'assistant/message', seq: 0, time: 1700000001000, data: { usage: { inputTokens: 7, outputTokens: 3 } } })
    const first = buildContainer([f1, f2])
    writeFileSync(path, first)

    const a = await readAppended(path, 0)
    assert('7.1 首次整读：buffer 与文件一致且 eof=true', a.buffer.length === first.length && a.eof === true, `len=${a.buffer.length}, expected=${first.length}, eof=${a.eof}`)
    assert('7.2 start/readEnd/sizeBytes 自洽', a.start === 0 && a.readEnd === first.length && a.sizeBytes === first.length, `start=${a.start}, readEnd=${a.readEnd}, size=${a.sizeBytes}`)

    const f3 = line({ type: 'assistant/message', seq: 1, time: 1700000002000, data: { usage: { inputTokens: 1, outputTokens: 1 } } })
    const f4 = line({ type: 'step/end', seq: 2, time: 1700000003000 })
    const appended = buildContainer([f3, f4])
    appendFileSync(path, appended)

    const b = await readAppended(path, a.readEnd)
    assert('7.3 增量读只返回新增字节', b.buffer.length === appended.length && b.buffer.equals(appended), `len=${b.buffer.length}, expected=${appended.length}`)
    assert('7.4 增量窗口从帧边界起、扫描得到 2 个完整帧', (() => { const s = scanZstdFrames(b.buffer); return s.frames.length === 2 && s.frames[0][0] === 0 })())
    const texts = scanZstdFrames(b.buffer).frames.map((r) => decodeFrameRange(b.buffer, r)).join('')
    assert('7.5 增量解出的正是新增事件', texts === f3 + f4, 'appended text mismatch')

    const c = await readAppended(path, b.readEnd)
    assert('7.6 已读到末尾时再读 → 空 buffer 且 eof=true', c.buffer.length === 0 && c.eof === true && c.rounds === 1, `len=${c.buffer.length}, rounds=${c.rounds}`)

    const d = await readAppended(path, 0, { chunkBytes: 16 })
    assert('7.7 小 chunk 分多次读仍拼成完整内容', d.buffer.equals(Buffer.concat([first, appended])), `len=${d.buffer.length}`)
    assert('7.8 不足 1 轮的上限下提前返回（rounds 上限生效）', (await readAppended(path, 0, { maxRounds: 1 })).rounds === 1, 'rounds not honored')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok).length
console.log(`[v050-frames] ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('FAILED cases:')
  for (const r of results.filter((x) => !x.ok)) console.error('  ' + r.label + (r.detail ? ' — ' + r.detail : ''))
  process.exit(1)
}
