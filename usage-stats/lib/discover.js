/**
 * dsh-usage-stats — 会话发现（v0.5.0）
 *
 * 目标：用**零解压**的代价拿到"当前世代日志文件的路径清单"，作为修订比较的输入。
 *
 * 为什么不用 `ctx.sessionQuery.listSessions()`：它走
 * `persistence.list()` → `listArtifacts()`，对**每个**会话做一次首帧 zstd 解压
 * （`readFirstZstdLine`，本机 1 次约 70ms），并且只要语料里存在历史世代会再跑一遍
 * `historicalCorpusRevision()`（第二次全走查 + 每文件 stat + sha256）。
 * 本机 734 个会话实测约 30 秒 —— DSH 自己的侧边栏与搜索同样付这笔钱，
 * 本插件不能跟着付。
 *
 * 三级来源（按优先级）：
 *   1. `sessionPersistence.listGenerations()` —— 框架方法，纯 readdir 选世代，
 *      不解压不读 header（d.ts 标 private，运行时存在；用 typeof 探测，缺失自动降级）
 *   2. 自走查 —— readdir 项目目录 + 会话目录，按文件名版本号取最高世代
 *      （规则与框架 resolveGenerationInDirectory 一致）。实测 734 会话约 142ms
 *   3. `sessionQuery.listSessions()` —— 最后兜底，慢但保住功能，并在诊断里标注
 *
 * 本模块**不读 header**：身份（id）由折叠阶段从首帧拿到；未变更会话按路径命中记录，
 * 一次解压都不需要。
 */

import { readdir, stat } from 'node:fs/promises'
import { basename, dirname, join, sep } from 'node:path'
import { homedir } from 'node:os'

/** `session.jsonl[.zstd]` / `session.vN.jsonl[.zstd]` → 版本号；非日志文件名返回 null。 */
export function generationRank(fileName) {
  if (typeof fileName !== 'string') return null
  const matched = /^session(?:\.v(\d+))?\.jsonl(\.zstd)?$/.exec(fileName)
  if (matched === null) return null
  return matched[1] === undefined ? 0 : Number(matched[1])
}

/**
 * 框架风格的修订令牌：`dev:ino:size:mtimeNs:ctimeNs`
 * （与 dsh-session-persistence-jsonl 的 fileRevision 同构，零 I/O 可比对）。
 * 用 bigint 以避免大文件 size/mtime 精度丢失；数值转字符串是为了可比较、可落盘。
 */
export function fileRevisionOf(stats) {
  if (stats == null) return null
  return [stats.dev, stats.ino, stats.size, stats.mtimeNs, stats.ctimeNs].map((v) => String(v)).join(':')
}

/** 读取一个日志文件的修订令牌；文件不存在返回 null。 */
export async function statRevision(path) {
  try {
    return fileRevisionOf(await stat(path, { bigint: true }))
  } catch {
    return null
  }
}

/** 从日志文件路径推导会话目录名（`<root>/<project>/<sessionDir>/<file>`）。 */
export function sessionDirKeyOf(path) {
  return basename(dirname(path))
}

/**
 * 从一条 sourcePath 推导 sessions 根（`<root>/<project>/<sessionDir>/<file>` 去掉 3 层）。
 * 用于：首次成功走框架路径后记住根目录，后续框架方法消失时自走查仍能命中同一棵树。
 */
export function sessionsRootOf(sourcePath) {
  if (typeof sourcePath !== 'string' || sourcePath.length === 0) return null
  let dir = dirname(sourcePath) // sessionDir
  dir = dirname(dir) // project
  dir = dirname(dir) // root
  return dir
}

/**
 * 依次尝试的 sessions 根候选：显式配置 → DSH_HOME → 默认主目录。
 * 与 DSH 的 `dshHomePath('sessions')` 语义一致（只覆盖默认布局，不改 profile 覆盖值）。
 */
export function candidateSessionRoots(explicit) {
  const out = []
  if (typeof explicit === 'string' && explicit.length > 0) out.push(explicit)
  const home = process.env.DSH_HOME
  if (typeof home === 'string' && home.length > 0) out.push(join(home, 'sessions'))
  try {
    out.push(join(homedir(), '.dsh', 'sessions'))
  } catch {
    // homedir() 在极端环境下可能抛；忽略
  }
  return out
}

/**
 * 自走查：readdir 项目目录 → 会话目录 → 取最高世代日志。
 * @returns {{ entries: Array<{path: string, version: number, dirKey: string}>, projects: number, warnings: string[] }}
 */
export async function walkSessions(root) {
  const entries = []
  const warnings = []
  let projects = 0
  let projectNames = []
  try {
    projectNames = await readdir(root)
  } catch (error) {
    warnings.push(`sessions 根不可读（${String(error && error.message)}）：${root}`)
    return { entries, projects, warnings }
  }
  for (const project of projectNames) {
    const projectDir = join(root, project)
    let sessionDirs = []
    try {
      sessionDirs = await readdir(projectDir, { withFileTypes: true })
    } catch {
      continue
    }
    let counted = false
    for (const dirent of sessionDirs) {
      if (!dirent.isDirectory()) continue
      const sessionDir = join(projectDir, dirent.name)
      let files = []
      try {
        files = await readdir(sessionDir)
      } catch {
        continue
      }
      let best = null
      let bestRank = -1
      for (const file of files) {
        const rank = generationRank(file)
        if (rank !== null && rank > bestRank) {
          bestRank = rank
          best = file
        }
      }
      if (best === null) continue
      counted = true
      entries.push({ path: join(sessionDir, best), version: bestRank, dirKey: dirent.name })
    }
    if (counted) projects += 1
  }
  return { entries, projects, warnings }
}

/**
 * 发现入口。
 *
 * @param deps.sessionPersistence 可选：框架持久化服务（只用 listGenerations）
 * @param deps.sessionQuery 可选：最后兜底用的查询服务
 * @param options.sessionsRoot 显式 sessions 根（覆盖环境推断）
 * @param options.signal 取消信号
 * @returns {Promise<{source: string, entries: Array<object>, root: string|null, warnings: string[], projects: number, durationMs: number}>}
 *   source: 'listGenerations' | 'walk' | 'sessionQuery'
 *   entries: `{path, version, dirKey}`；兜底路径下为 `{id, header, path: null, version: null}`
 */
export async function discoverSessions(deps = {}, options = {}) {
  const startedAt = Date.now()
  const warnings = []
  const signal = options.signal
  const explicitRoot = options.sessionsRoot || deps.sessionsRoot || null
  const persistence = deps.sessionPersistence

  // 1) 框架零解压路径
  if (persistence != null && typeof persistence.listGenerations === 'function') {
    try {
      const generations = await persistence.listGenerations(signal)
      if (Array.isArray(generations) && generations.length > 0) {
        const entries = []
        for (const item of generations) {
          if (item == null || typeof item.sourcePath !== 'string') continue
          entries.push({ path: item.sourcePath, version: Number.isFinite(item.sourceVersion) ? item.sourceVersion : generationRank(basename(item.sourcePath)), dirKey: sessionDirKeyOf(item.sourcePath) })
        }
        if (entries.length > 0) {
          return {
            source: 'listGenerations',
            entries,
            root: explicitRoot || sessionsRootOf(entries[0].path),
            warnings,
            projects: countProjects(entries),
            durationMs: Date.now() - startedAt,
          }
        }
      }
    } catch (error) {
      warnings.push(`listGenerations 不可用（${String(error && error.message)}），回落自走查`)
    }
  }

  // 2) 自走查
  // walkRoots 显式给出时只用这些根（测试与"固定根"部署用），否则按显式配置 → 环境推断
  const roots = Array.isArray(options.walkRoots) && options.walkRoots.length > 0
    ? options.walkRoots
    : candidateSessionRoots(explicitRoot)
  for (const root of roots) {
    const walked = await walkSessions(root)
    warnings.push(...walked.warnings)
    if (walked.entries.length > 0) {
      return { source: 'walk', entries: walked.entries, root, warnings, projects: walked.projects, durationMs: Date.now() - startedAt }
    }
  }

  // 3) 框架兜底（慢路径：每个会话一次首帧解压）
  const query = deps.sessionQuery
  if (query != null && typeof query.listSessions === 'function') {
    try {
      const records = await query.listSessions(signal)
      const entries = []
      for (const record of Array.isArray(records) ? records : []) {
        if (record == null || record.header == null || typeof record.header.id !== 'string') continue
        entries.push({ id: record.header.id, header: record.header, path: null, version: null, dirKey: record.header.id })
      }
      if (entries.length > 0) {
        warnings.push('自走查未命中任何会话日志，已回落到 sessionQuery.listSessions()（慢路径）')
        return { source: 'sessionQuery', entries, root: explicitRoot, warnings, projects: 0, durationMs: Date.now() - startedAt }
      }
    } catch (error) {
      warnings.push(`sessionQuery.listSessions 失败（${String(error && error.message)}）`)
    }
  }

  return { source: 'none', entries: [], root: explicitRoot, warnings, projects: 0, durationMs: Date.now() - startedAt }
}

/** 统计项目目录数（诊断用）。 */
function countProjects(entries) {
  const set = new Set()
  for (const entry of entries) {
    const root = sessionsRootOf(entry.path)
    if (root === null) continue
    const parts = dirname(entry.path).split(sep)
    set.add(parts.slice(0, -1).join(sep))
  }
  return set.size
}
