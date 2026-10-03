// tests/test-v050-discover.mjs
// v0.5.0 步骤 4：廉价会话发现（lib/discover.js）单测。
//
// 覆盖：世代文件名解析 / 修订令牌 / sessions 根推导 / 三级来源优先级
//      （listGenerations → 自走查 → sessionQuery 兜底 → none）/ 单目录多世代取最高 /
//      非日志文件忽略 / 不可读根不抛 / projects 计数。
//
// 用法：node tests/test-v050-discover.mjs
// 期望：PASS 所有条目；任一 FAIL 立即 process.exit(1)。

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  generationRank,
  fileRevisionOf,
  statRevision,
  sessionDirKeyOf,
  sessionsRootOf,
  candidateSessionRoots,
  walkSessions,
  discoverSessions,
} from '../lib/discover.js'

const results = []
function assert(label, cond, detail) {
  results.push({ label, ok: !!cond, detail })
  if (!cond) console.error(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`)
}

const roots = []
function freshRoot(label) {
  const dir = mkdtempSync(join(tmpdir(), `usage-stats-discover-${label}-`))
  roots.push(dir)
  return dir
}

/** 造一棵 DSH 风格的会话树：<root>/<project>/<sessionDir>/<logFile>。 */
function makeTree(root, spec) {
  for (const [project, sessions] of Object.entries(spec)) {
    for (const [sessionDir, files] of Object.entries(sessions)) {
      const dir = join(root, project, sessionDir)
      mkdirSync(dir, { recursive: true })
      for (const file of files) writeFileSync(join(dir, file), 'x', 'utf8')
    }
  }
}

/* ------------------------------------------------------------------ *
 * 1) 纯函数
 * ------------------------------------------------------------------ */
{
  assert('1.1 世代文件名解析（v0 / vN / 非日志）', generationRank('session.jsonl.zstd') === 0
    && generationRank('session.jsonl') === 0
    && generationRank('session.v3.jsonl.zstd') === 3
    && generationRank('session.v12.jsonl.zstd') === 12
    && generationRank('session.v4.jsonl') === 4
    && generationRank('notes.jsonl.zstd') === null
    && generationRank('session.v4.jsonl.zstd.tmp') === null
    && generationRank(null) === null, 'rank mismatch')

  const rev = fileRevisionOf({ dev: 1n, ino: 2n, size: 3n, mtimeNs: 4n, ctimeNs: 5n })
  assert('1.2 修订令牌与框架 fileRevision 同构', rev === '1:2:3:4:5', rev)
  assert('1.3 无 stat 输入返回 null', fileRevisionOf(null) === null, 'expected null')

  assert('1.4 sessionDirKey 取自路径倒数第二段', sessionDirKeyOf('/a/b/session-xyz/session.v4.jsonl.zstd') === 'session-xyz', sessionDirKeyOf('/a/b/session-xyz/session.v4.jsonl.zstd'))
  assert('1.5 sessionsRootOf 去掉 3 层', sessionsRootOf('/root/proj/sess/file.zstd') === '/root' || sessionsRootOf('/root/proj/sess/file.zstd') === '\\root', sessionsRootOf('/root/proj/sess/file.zstd'))
  assert('1.6 空路径 → null', sessionsRootOf('') === null, 'expected null')
  assert('1.7 候选根含显式配置且 DSH_HOME 优先于默认主目录', (() => {
    const prev = process.env.DSH_HOME
    process.env.DSH_HOME = join(tmpdir(), 'dsh-home-probe')
    const list = candidateSessionRoots('/explicit/sessions')
    if (prev === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = prev
    return list[0] === '/explicit/sessions' && list[1] === join(tmpdir(), 'dsh-home-probe', 'sessions') && list.length >= 3
  })())
}

/* ------------------------------------------------------------------ *
 * 2) 自走查：多世代取最高 / 忽略非日志 / 坏目录不抛
 * ------------------------------------------------------------------ */
{
  const root = freshRoot('walk')
  makeTree(root, {
    '--proj-a--': {
      'session-1': ['session.jsonl.zstd', 'session.v3.jsonl.zstd'],
      'session-2': ['session.jsonl.zstd'],
      'session-3': ['README.md'],
      文件不是目录: [],
    },
    '--proj-b--': {
      'abcd-1234': ['session.v4.jsonl.zstd', 'session.v4.jsonl.zstd.tmp'],
    },
    '--empty-proj--': {},
  })

  const walked = await walkSessions(root)
  assert('2.1 走查只收日志目录（README/非目录被忽略）', walked.entries.length === 3, `entries=${walked.entries.length}`)
  const s1 = walked.entries.find((e) => e.dirKey === 'session-1')
  assert('2.2 同目录多世代取版本号最高者', s1.version === 3 && s1.path.endsWith('session.v3.jsonl.zstd'), `v=${s1.version}, path=${s1.path}`)
  assert('2.3 只写临时名的日志不算（.tmp 不匹配）', walked.entries.find((e) => e.dirKey === 'abcd-1234').path.endsWith('session.v4.jsonl.zstd'), 'tmp file picked')
  assert('2.4 有会话的项目才计数', walked.projects === 2, `projects=${walked.projects}`)
  assert('2.5 无警告', walked.warnings.length === 0, JSON.stringify(walked.warnings))

  const missing = await walkSessions(join(root, 'not-exist'))
  assert('2.6 根不存在 → 空结果 + 一条警告（不抛）', missing.entries.length === 0 && missing.warnings.length === 1, JSON.stringify(missing.warnings))

  const rev = await statRevision(walked.entries[0].path)
  assert('2.7 statRevision 对真实文件返回令牌、对缺失文件返回 null', /^\d+:\d+:\d+:\d+:\d+$/.test(rev) && (await statRevision(join(root, 'nope'))) === null, String(rev))
}

/* ------------------------------------------------------------------ *
 * 3) 来源优先级
 * ------------------------------------------------------------------ */
{
  const root = freshRoot('priority')
  makeTree(root, { '--proj--': { s1: ['session.v4.jsonl.zstd'] } })

  // 3a) listGenerations 优先，且不被自走查覆盖
  const calls = []
  const deps = {
    sessionPersistence: {
      async listGenerations() {
        calls.push('listGenerations')
        return [{ sourcePath: join(root, '--proj--', 's1', 'session.v4.jsonl.zstd'), sourceVersion: 4, currentPath: join(root, '--proj--', 's1', 'session.v4.jsonl.zstd') }]
      },
    },
    sessionQuery: {
      async listSessions() {
        calls.push('listSessions')
        return [{ header: { id: 'from-query' } }]
      },
    },
  }
  const r1 = await discoverSessions(deps, { sessionsRoot: root })
  assert('3.1 listGenerations 可用时走框架路径且不调 listSessions', r1.source === 'listGenerations' && !calls.includes('listSessions'), `${r1.source} calls=${calls.join(',')}`)
  assert('3.2 条目带 path/version/dirKey', r1.entries.length === 1 && r1.entries[0].version === 4 && r1.entries[0].dirKey === 's1', JSON.stringify(r1.entries))
  assert('3.3 从 sourcePath 推出 sessions 根', r1.root === root, `root=${r1.root}`)
  assert('3.4 带发现耗时', Number.isFinite(r1.durationMs), String(r1.durationMs))

  // 3b) listGenerations 抛错 → 回落自走查
  const r2 = await discoverSessions({
    sessionPersistence: { async listGenerations() { throw new Error('boom') } },
    sessionQuery: deps.sessionQuery,
  }, { sessionsRoot: root })
  assert('3.5 listGenerations 抛错 → 自走查接管并记一条警告', r2.source === 'walk' && r2.warnings.some((w) => w.includes('listGenerations 不可用')), `${r2.source} ${JSON.stringify(r2.warnings)}`)

  // 3c) 自走查空 → sessionQuery 兜底（walkRoots 固定为这个空目录，避免走到真实环境根）
  const empty = freshRoot('empty')
  const r3 = await discoverSessions({ sessionQuery: deps.sessionQuery }, { walkRoots: [empty] })
  assert('3.6 自走查空 → sessionQuery 兜底并标注慢路径', r3.source === 'sessionQuery' && r3.entries[0].id === 'from-query' && r3.warnings.some((w) => w.includes('慢路径')), `${r3.source} ${JSON.stringify(r3.warnings)}`)

  // 3d) 全部不可用 → none（不抛）
  const r4 = await discoverSessions({}, { walkRoots: [empty] })
  assert('3.7 三级来源全部落空 → source=none 且不抛', r4.source === 'none' && r4.entries.length === 0, r4.source)

  // 3e) listGenerations 返回空数组 → 继续往下走
  const r5 = await discoverSessions({ sessionPersistence: { async listGenerations() { return [] } } }, { sessionsRoot: root })
  assert('3.8 listGenerations 返回空数组 → 继续自走查', r5.source === 'walk' && r5.entries.length === 1, r5.source)

  // 3f) listGenerations 条目形态脏（缺 sourcePath）→ 过滤掉不崩
  const dirtyGenerations = [
    null,
    { sourcePath: 42 },
    { sourcePath: join(root, '--proj--', 's1', 'session.v4.jsonl.zstd'), sourceVersion: 4 },
  ]
  const r6 = await discoverSessions(
    { sessionPersistence: { async listGenerations() { return dirtyGenerations } } },
    { sessionsRoot: root }
  )
  assert('3.9 脏条目被过滤，合规条目仍可用', r6.source === 'listGenerations' && r6.entries.length === 1, JSON.stringify(r6.entries))
}

for (const dir of roots) rmSync(dir, { recursive: true, force: true })

const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok).length
console.log(`[v050-discover] ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('FAILED cases:')
  for (const r of results.filter((x) => !x.ok)) console.error('  ' + r.label + (r.detail ? ' — ' + r.detail : ''))
  process.exit(1)
}
