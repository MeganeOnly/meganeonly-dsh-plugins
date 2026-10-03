// tests/test-v050-store.mjs
// v0.5.0 步骤 3：会话级记录存储（lib/store.js）单测。
//
// 覆盖：记录往返 / 原子写 / 去抖与显式 flush / 损坏记录 backup-and-skip /
//       manifest 版本不匹配整目录改名重建 / 记录不含规字段拒绝写入 /
//       legacy 单体缓存只读导入（不落新库）/ 重算后 legacy 退役改名 / 删除清理。
//
// 用法：node tests/test-v050-store.mjs
// 期望：PASS 所有条目；任一 FAIL 立即 process.exit(1)。

import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  createStore,
  storePaths,
  safeRecordFileName,
  validateRecord,
  makeRecord,
  readLegacyRecords,
  stampSuffix,
} from '../lib/store.js'
import { STORE_VERSION, LEGACY_CACHE_FILENAME } from '../lib/constants.js'
import { emptyBucket } from '../lib/fold.js'

const results = []
function assert(label, cond, detail) {
  results.push({ label, ok: !!cond, detail })
  if (!cond) console.error(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`)
}

const tmpRoots = []
function freshProfile(label) {
  const dir = mkdtempSync(join(tmpdir(), `usage-stats-store-${label}-`))
  tmpRoots.push(dir)
  return dir
}

/** 造一条最小可用记录。 */
function record(key, overrides = {}) {
  return makeRecord({
    key,
    path: `/sessions/proj/${key}/session.v4.jsonl.zstd`,
    gen: 4,
    rev: 'dev:1:100:200:300',
    cursor: { bytes: 100, frames: 3, lastSeq: 2 },
    anchor: { prefixBytes: 64, prefixSha256: 'p', firstFrameSha256: 'f' },
    meta: { id: key, createdAt: 1700000000000, cwd: '/tmp/proj', parentSession: null, delegationDepth: 0, title: 't' },
    agg: { id: key, totals: emptyBucket(), models: {}, days: {}, modelDays: {}, hours: {}, modelHours: {}, minutes: {}, modelMinutes: {}, tools: {}, steps: 0, turns: 0, llmMs: 0, toolMs: 0, lastTs: null, lastSeq: 2 },
    ...overrides,
  })
}

/* ------------------------------------------------------------------ *
 * 1) 纯函数：安全文件名 / schema 校验 / 路径
 * ------------------------------------------------------------------ */
{
  assert('1.1 文件名安全化替换跨平台非法字符', safeRecordFileName('a/b\\c:d*e?f"g<h>i|j') === 'a_b_c_d_e_f_g_h_i_j.json', safeRecordFileName('a/b\\c:d*e?f"g<h>i|j'))
  assert('1.2 空 key 有兜底名', safeRecordFileName('') === 'unnamed.json' && safeRecordFileName(null) === 'unnamed.json', 'fallback missing')
  assert('1.3 超长 key 截断到 120 字符', safeRecordFileName('x'.repeat(500)).length === 125, `len=${safeRecordFileName('x'.repeat(500)).length}`)
  assert('1.4 路径集合固定在 profile 根下', storePaths('/p').dir === join('/p', '.usage-stats') && storePaths('/p').legacyPath === join('/p', LEGACY_CACHE_FILENAME), 'paths wrong')

  assert('1.5 合规记录通过校验', validateRecord(record('k')).ok === true, JSON.stringify(validateRecord(record('k'))))
  const bad = [
    [null, 'not-an-object'],
    [{ ...record('k'), v: 99 }, 'store-version-mismatch:99'],
    [{ ...record('k'), key: '' }, 'missing-key'],
    [{ ...record('k'), agg: null }, 'missing-agg'],
    [{ ...record('k'), agg: { id: 'x' } }, 'missing-agg-totals'],
    [{ ...record('k'), cursor: [] }, 'bad-cursor'],
  ]
  const reasons = bad.map(([r]) => validateRecord(r))
  assert('1.6 六类不合规记录全部被拒且原因明确', reasons.every((v, i) => v.ok === false && v.reason === bad[i][1]), JSON.stringify(reasons))
  assert('1.7 makeRecord 补默认值（cursor/lastSeq/updatedAt）', (() => { const r = makeRecord({ key: 'k', agg: { totals: emptyBucket() } }); return r.cursor.bytes === 0 && r.cursor.lastSeq === -1 && r.gen === null && r.legacy === false && Number.isFinite(r.updatedAt) })())
}

/* ------------------------------------------------------------------ *
 * 2) 往返：写入 → 落盘 → 新实例 load 回来
 * ------------------------------------------------------------------ */
{
  const profile = freshProfile('roundtrip')
  const store = createStore(profile, { debounceMs: 5, onWarn: () => {} })
  await store.load()
  assert('2.1 空目录 load 不抛且记录为空', store.records.size === 0, `size=${store.records.size}`)

  store.set(record('session-a'))
  store.set(record('session-b'))
  assert('2.2 set 后立即可读、byPath 索引同步', store.get('session-a') !== undefined && store.getByPath('/sessions/proj/session-a/session.v4.jsonl.zstd') === store.get('session-a') && store.records.size === 2 && store.byPath.size === 2, `records=${store.records.size}, byPath=${store.byPath.size}`)
  assert('2.3 去抖窗口内尚未落盘', store.dirtyCount === 2, `dirty=${store.dirtyCount}`)

  await store.flush()
  assert('2.4 flush 后脏计数清零', store.dirtyCount === 0, `dirty=${store.dirtyCount}`)
  const files = readdirSync(storePaths(profile).sessionsDir)
  assert('2.5 两个会话各一个记录文件（不再是单文件）', files.length === 2 && files.every((f) => f.endsWith('.json')), JSON.stringify(files))
  assert('2.6 不残留临时文件', files.every((f) => !f.includes('.tmp')), JSON.stringify(files))

  const store2 = createStore(profile, { onWarn: () => {} })
  await store2.load()
  assert('2.7 新实例 load 后记录逐字段一致', store2.records.size === 2 && JSON.stringify(store2.records.get('session-a').agg) === JSON.stringify(record('session-a').agg), 'roundtrip mismatch')
  assert('2.8 byPath 索引重建正确', store2.byPath.get('/sessions/proj/session-a/session.v4.jsonl.zstd') === 'session-a', 'byPath missing')

  store2.remove('session-a')
  await store2.flush()
  const after = readdirSync(storePaths(profile).sessionsDir)
  assert('2.9 删除记录后文件消失、内存同步', after.length === 1 && store2.records.size === 1, JSON.stringify(after))
  store.close()
  store2.close()
}

/* ------------------------------------------------------------------ *
 * 3) 去抖：多次 set 只落一次；显式 immediate 立即落
 * ------------------------------------------------------------------ */
{
  const profile = freshProfile('debounce')
  const store = createStore(profile, { debounceMs: 30, onWarn: () => {} })
  await store.load()
  const r = record('session-x')
  store.set(r)
  r.agg.totals.inputTokens = 1
  store.set(r)
  r.agg.totals.inputTokens = 2
  store.set(r)
  assert('3.1 未到窗口时文件尚未出现', readdirSync(storePaths(profile).sessionsDir).length === 0, 'file appeared too early')
  await new Promise((resolve) => setTimeout(resolve, 80))
  const files = readdirSync(storePaths(profile).sessionsDir)
  assert('3.2 窗口到点后自动落盘一次', files.length === 1, JSON.stringify(files))
  const onDisk = JSON.parse(readFileSync(join(storePaths(profile).sessionsDir, files[0]), 'utf8'))
  assert('3.3 落盘内容是最后一次的值（无中间态）', onDisk.agg.totals.inputTokens === 2, `input=${onDisk.agg.totals.inputTokens}`)

  const r2 = record('session-y')
  store.set(r2, { immediate: true })
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert('3.4 immediate=true 不等窗口', readdirSync(storePaths(profile).sessionsDir).length === 2, 'immediate write missing')
  store.close()
}

/* ------------------------------------------------------------------ *
 * 4) 损坏记录 backup-and-skip；manifest 版本不匹配整目录改名
 * ------------------------------------------------------------------ */
{
  const profile = freshProfile('corrupt')
  const store = createStore(profile, { onWarn: () => {} })
  await store.load()
  store.set(record('good-1'), { immediate: true })
  store.set(record('good-2'), { immediate: true })
  await store.flush()

  const sessionsDir = storePaths(profile).sessionsDir
  writeFileSync(join(sessionsDir, 'broken.json'), '{ not json', 'utf8')
  writeFileSync(join(sessionsDir, 'wrongshape.json'), JSON.stringify({ v: STORE_VERSION, key: 'wrongshape' }), 'utf8')

  const store2 = createStore(profile, { onWarn: () => {} })
  await store2.load()
  assert('4.1 损坏与不合规记录被跳过，合规记录照常加载', store2.records.size === 2, `size=${store2.records.size}`)
  assert('4.2 两条问题记录各留一个 .bak 文件', store2.warnings.length === 2 && readdirSync(sessionsDir).filter((f) => f.includes('.bak-')).length === 2, JSON.stringify(store2.warnings))
  assert('4.3 告警信息指明原因', store2.warnings.some((w) => w.includes('解析失败')) && store2.warnings.some((w) => w.includes('missing-agg')), JSON.stringify(store2.warnings))

  // manifest 版本不匹配 → 整目录改名 + 从空重建
  const manifestPath = storePaths(profile).manifestPath
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  writeFileSync(manifestPath, JSON.stringify({ ...manifest, storeVersion: STORE_VERSION + 7 }), 'utf8')
  const store3 = createStore(profile, { onWarn: () => {} })
  await store3.load()
  const parents = readdirSync(profile)
  assert('4.4 版本不匹配 → 记录清空重建', store3.records.size === 0, `size=${store3.records.size}`)
  assert('4.5 旧目录改名 .bak-<ts> 保留（未删除）', parents.some((p) => p.startsWith('.usage-stats.bak-')), JSON.stringify(parents))
  assert('4.6 新目录 + manifest 已就位', existsSync(manifestPath) && readdirSync(sessionsDir).length === 0, 'new dir not initialized')
  store.close()
  store2.close()
  store3.close()
}

/* ------------------------------------------------------------------ *
 * 5) legacy 单体缓存：只读导入为临时记录，重算后退役改名
 * ------------------------------------------------------------------ */
{
  const profile = freshProfile('legacy')
  const legacy = {
    version: 8,
    sessions: {
      'session-old-1': {
        createdAt: 1700000000000,
        agg: {
          id: 'session-old-1',
          cwd: '/tmp/old',
          createdAt: 1700000000000,
          parentSession: null,
          delegationDepth: 0,
          title: '旧会话',
          models: { 'deepseek/v4-flash': { ...emptyBucket(), inputTokens: 10, outputTokens: 5, requests: 1 } },
          days: { '2026-01-01': { ...emptyBucket(), inputTokens: 10, outputTokens: 5, requests: 1 } },
          modelDays: {}, hours: {}, modelHours: {}, minutes: {}, modelMinutes: {}, tools: {},
          totals: { ...emptyBucket(), inputTokens: 10, outputTokens: 5, requests: 1 },
          steps: 1, turns: 1, llmMs: 5, toolMs: 0, lastTs: 1700000001000,
        },
      },
    },
  }
  writeFileSync(join(profile, LEGACY_CACHE_FILENAME), JSON.stringify(legacy), 'utf8')

  const imported = await readLegacyRecords(profile)
  assert('5.1 legacy 文件被解析成临时记录', imported !== null && imported.size === 1, `size=${imported ? imported.size : 'null'}`)
  const rec = imported.get('session-old-1')
  assert('5.2 临时记录标记 legacy 且水位置零（必定重折叠）', rec.legacy === true && rec.cursor.bytes === 0 && rec.agg.lastSeq === -1 && rec.rev === null, `legacy=${rec.legacy}, bytes=${rec.cursor.bytes}, lastSeq=${rec.agg.lastSeq}`)
  assert('5.3 元数据从旧 agg 派生（title/cwd/createdAt）', rec.meta.title === '旧会话' && rec.meta.cwd === '/tmp/old' && rec.meta.createdAt === 1700000000000, JSON.stringify(rec.meta))
  assert('5.4 legacy 导入不落新库（load 后记录仍为 0）', await (async () => { const s = createStore(profile, { onWarn: () => {} }); await s.load(); const n = s.records.size; s.close(); return n === 0 })())

  const store = createStore(profile, { onWarn: () => {} })
  await store.load()
  assert('5.5 hasLegacy 检测到位', await store.hasLegacy())
  const retired = await store.retireLegacy()
  assert('5.6 退役改名成 .legacy-<ts>（原件仍在，可回滚）', retired !== null && existsSync(retired) && !existsSync(join(profile, LEGACY_CACHE_FILENAME)), `retired=${retired}`)
  assert('5.7 退役后 hasLegacy=false、readLegacyRecords=null', (await store.hasLegacy()) === false && (await readLegacyRecords(profile)) === null, 'legacy still readable')
  store.close()

  assert('5.8 无 legacy 文件时 readLegacyRecords 返回 null（不抛）', (await readLegacyRecords(freshProfile('nolegacy'))) === null, 'expected null')
  assert('5.9 stampSuffix 生成可作文件名的时戳', /^[0-9T-]+Z$/.test(stampSuffix(1700000000000)), stampSuffix(1700000000000))
}

/* ------------------------------------------------------------------ *
 * 6) 写入失败 fail-soft：目录被占位成文件时 set 不抛
 * ------------------------------------------------------------------ */
{
  const profile = freshProfile('failsoft')
  const paths = storePaths(profile)
  mkdirSync(profile, { recursive: true })
  writeFileSync(paths.dir, 'not a dir', 'utf8') // 让 mkdir 失败
  const warnings = []
  const store = createStore(profile, { debounceMs: 5, onWarn: (m) => warnings.push(m) })
  let threw = false
  try {
    await store.load()
    store.set(record('k'), { immediate: true })
    await store.flush()
  } catch (error) {
    threw = true
    console.error('    unexpected throw:', error && error.message)
  }
  assert('6.1 存储目录不可用时 load/set/flush 不抛（fail-soft）', threw === false, 'threw')
  assert('6.2 内存记录仍可用（功能降级而非崩溃）', store.records.size === 1, `size=${store.records.size}`)
  store.close()
}

for (const dir of tmpRoots) rmSync(dir, { recursive: true, force: true })

const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok).length
console.log(`[v050-store] ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('FAILED cases:')
  for (const r of results.filter((x) => !x.ok)) console.error('  ' + r.label + (r.detail ? ' — ' + r.detail : ''))
  process.exit(1)
}
