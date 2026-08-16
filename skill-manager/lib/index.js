/**
 * dsh-skill-manager — Host 半端
 *
 * 提供两个 HTTP 路由（webServer 服务，与 plugin-manager 同款模式）：
 *   GET  /api/skill-manager/list         列出 skill（用户级 + 最近会话的项目级 + 诊断信息）
 *   POST /api/skill-manager/set-enabled  写入停用名单并即时生效
 *
 * 停用实现：向 ctx.skills 注册一个高优先级 provider（rank 50，低于一切
 * 文件系统来源的 100/200/300/400/500），为停用名单里的每个 skill 返回一个
 * "影子"条目遮蔽原条目，invocation 双关（modelInvocable/userInvocable 均为
 * false）→ 模型目录不再出现、/name 手动调用也不再注入。不改动任何
 * SKILL.md 文件；停用名单存在 profile 根的 .skill-manager.json。
 *
 * 即时生效原理：变更停用名单后调用 provider 的 control.invalidate()，
 * skills 注册表 revision+1、collect 缓存失效，tool-skill 在下一个
 * agent/pre-step 重新快照并自动发布目录更新消息——无需重启 DSH。
 *
 * 诊断信息（list 响应附带）：
 *   - conflicts：同名 skill 出现在多个根目录时的遮蔽关系（谁生效、谁被遮蔽）；
 *   - unscanned：DSH_HOME 指向别处时，默认主目录 ~/.dsh/skills 下的 skill
 *     永远不被扫描（死副本）——列出目录与数量，提示移动或 junction。
 */
import { readFile, writeFile, rename, readdir, access, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { parse } from 'yaml'

export const name = 'skill-manager'

export const inject = ['loader', 'webServer', 'skills', 'sessions', 'agents']

const API_PREFIX = '/api/skill-manager'
const STATE_FILENAME = '.skill-manager.json'
const SHADOW_RANK = 50 // 低于全部文件系统来源（project 100/200、custom 300、user 400/500、bundled 600）
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 停用名单（进程内缓存，磁盘真源 .skill-manager.json）。 */
let disabledSet = new Set()
let invalidateCatalog = undefined

// ---------------------------------------------------------------------------
// skill 目录扫描（复刻 dsh-skill-filesystem 的根与优先级；custom/bundled 不在此列）
// ---------------------------------------------------------------------------

function dshHome() {
  return process.env.DSH_HOME ? resolve(process.env.DSH_HOME) : join(homedir(), '.dsh')
}

function agentsHome() {
  return process.env.DSH_AGENTS_HOME ? resolve(process.env.DSH_AGENTS_HOME) : join(homedir(), '.agents')
}

function samePath(a, b) {
  return resolve(a).toLowerCase() === resolve(b).toLowerCase()
}

function globalRoots() {
  return [
    { path: join(dshHome(), 'skills'), source: 'user-dsh', rank: 400, scanned: true },
    { path: join(agentsHome(), 'skills'), source: 'user-agents', rank: 500, scanned: true },
  ]
}

/** DSH_HOME 指向别处时，默认主目录的 skills 是 DSH 永远不扫的死目录。 */
function staleRoots() {
  const fallback = join(homedir(), '.dsh', 'skills')
  if (samePath(join(dshHome(), 'skills'), fallback)) return []
  return [{ path: fallback, source: 'user-dsh-default', rank: 400, scanned: false }]
}

async function pathExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** 从 cwd 向上找 .git 定位项目根（与 dsh-skill-filesystem 的 findProjectRoot 一致）。 */
async function projectRootsOf(cwd) {
  if (typeof cwd !== 'string' || cwd === '') return []
  let current = resolve(cwd)
  let projectRoot = current
  while (true) {
    if (await pathExists(join(current, '.git'))) {
      projectRoot = current
      break
    }
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  return [
    { path: join(projectRoot, '.dsh', 'skills'), source: 'project-dsh', rank: 100, scanned: true },
    { path: join(projectRoot, '.agents', 'skills'), source: 'project-agents', rank: 200, scanned: true },
  ]
}

async function readTextOrNull(path) {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return undefined
  }
}

/** 解析 SKILL.md 的 YAML frontmatter（结构同 dsh-skill-filesystem；失败返回 undefined）。 */
function parseFrontmatter(raw) {
  const firstLineEnd = raw.indexOf('\n')
  if (firstLineEnd < 0) return undefined
  if (raw.slice(0, firstLineEnd).replace(/\r$/, '') !== '---') return undefined
  let lineStart = firstLineEnd + 1
  while (lineStart <= raw.length) {
    const nextNewline = raw.indexOf('\n', lineStart)
    const lineEnd = nextNewline < 0 ? raw.length : nextNewline
    if (raw.slice(lineStart, lineEnd).replace(/\r$/, '') === '---') {
      try {
        const data = parse(raw.slice(firstLineEnd + 1, lineStart))
        if (typeof data === 'object' && data !== null && !Array.isArray(data)) return data
        return undefined
      } catch {
        return undefined
      }
    }
    if (nextNewline < 0) return undefined
    lineStart = nextNewline + 1
  }
  return undefined
}

function truthyFrontmatter(value) {
  return value === true || value === 1 || value === '1' ||
    (typeof value === 'string' && ['true', 'yes', 'on'].includes(value.toLowerCase()))
}

/** 读署名：约定字段为 metadata.author（与官方 skill 一致）；兼容顶层 author（string 或 {name}），并容忍首尾空白。 */
function authorOf(data) {
  const read = (author) => {
    if (typeof author === 'string') return author.trim() !== '' ? author.trim() : undefined
    if (typeof author === 'object' && author !== null && typeof author.name === 'string') {
      return author.name.trim() !== '' ? author.name.trim() : undefined
    }
    return undefined
  }
  if (typeof data.metadata === 'object' && data.metadata !== null) {
    const author = read(data.metadata.author)
    if (author !== undefined) return author
  }
  return read(data.author)
}

/** 扫描单个根目录（名字以 frontmatter.name 为准，与 DSH 一致；junction/symlink 会跟随）。 */
async function scanRoot(root) {
  const skills = []
  let entries
  try {
    entries = await readdir(root.path, { withFileTypes: true })
  } catch {
    return skills // 根目录不存在
  }
  for (const entry of entries) {
    const entryPath = join(root.path, entry.name)
    let kind = entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other'
    if (kind === 'other') {
      // junction/符号链接在 withFileTypes 下不被识别为目录：stat 跟随后再分类（同官方 provider）
      try {
        const info = await stat(entryPath)
        kind = info.isDirectory() ? 'directory' : info.isFile() ? 'file' : 'other'
      } catch {
        kind = 'other'
      }
    }
    const path = kind === 'directory' ? join(entryPath, 'SKILL.md')
      : kind === 'file' && entry.name.endsWith('.md') ? entryPath : undefined
    if (path === undefined) continue
    const raw = await readTextOrNull(path)
    if (raw === undefined) continue
    const data = parseFrontmatter(raw)
    if (data === undefined) continue
    const name = typeof data.name === 'string' ? data.name : ''
    const description = typeof data.description === 'string' ? data.description : ''
    if (name === '' || !SKILL_NAME_RE.test(name) || description === '') continue // DSH 同样忽略
    skills.push({
      name,
      description,
      author: authorOf(data),
      userOnly: truthyFrontmatter(data['disable-model-invocation']),
      source: root.source,
      rank: root.rank,
      scanned: root.scanned,
      path,
    })
  }
  return skills
}

/** 扫描全部已知根（项目根 + 用户根 + 默认主目录死根）。cwd 存在时才纳入项目根。 */
async function scanAll(cwd) {
  const roots = [...(await projectRootsOf(cwd)), ...globalRoots(), ...staleRoots()]
  const skills = []
  for (const root of roots) skills.push(...(await scanRoot(root)))
  return skills
}

/** 同名多来源的遮蔽关系：被扫目录里 rank 最小者生效，其余被遮蔽；死目录条目永不生效。 */
function computeConflicts(all) {
  const byName = new Map()
  for (const skill of all) {
    const list = byName.get(skill.name) ?? []
    list.push(skill)
    byName.set(skill.name, list)
  }
  const conflicts = []
  for (const [name, list] of byName) {
    if (list.length < 2) continue
    const scanned = list.filter((s) => s.scanned)
    const sorted = [...scanned].sort((a, b) => a.rank - b.rank || String(a.path).localeCompare(String(b.path)))
    conflicts.push({
      name,
      winner: sorted.length > 0 ? { source: sorted[0].source } : undefined,
      losers: [
        ...sorted.slice(1).map((s) => ({ source: s.source, scanned: true })),
        ...list.filter((s) => !s.scanned).map((s) => ({ source: s.source, scanned: false })),
      ],
    })
  }
  conflicts.sort((a, b) => String(a.name).localeCompare(String(b.name)))
  return conflicts
}

// ---------------------------------------------------------------------------
// 停用状态持久化（profile 根 .skill-manager.json；临时文件 + rename 原子写）
// ---------------------------------------------------------------------------

function profileRoot(ctx) {
  const base = ctx.baseUrl
  if (typeof base === 'string' && base.startsWith('file://')) return fileURLToPath(base)
  if (typeof base === 'string' && base.length > 0) return base
  return process.cwd()
}

function statePathOf(ctx) {
  return join(profileRoot(ctx), STATE_FILENAME)
}

async function loadState(ctx) {
  try {
    const doc = JSON.parse(await readFile(statePathOf(ctx), 'utf8'))
    if (Array.isArray(doc?.disabled)) {
      disabledSet = new Set(doc.disabled.filter((it) => typeof it === 'string' && SKILL_NAME_RE.test(it)))
    }
  } catch {
    disabledSet = new Set() // 文件不存在或损坏 → 空名单
  }
}

async function persistState(ctx) {
  const path = statePathOf(ctx)
  const tmp = `${path}.tmp`
  await writeFile(tmp, `${JSON.stringify({ disabled: [...disabledSet] }, null, 2)}\n`, 'utf8')
  await rename(tmp, path)
}

// ---------------------------------------------------------------------------
// 遮蔽 provider：为停用名单里的 skill 提供高优先级（rank 50）影子条目
// ---------------------------------------------------------------------------

function shadowDefinition(candidate) {
  return {
    name: candidate.name,
    description: candidate.description,
    ...(candidate.whenToUse !== undefined ? { whenToUse: candidate.whenToUse } : {}),
    invocation: { modelInvocable: false, userInvocable: false },
    source: 'skill-manager',
    provider: 'skill-manager',
    content: '（此 skill 已在“Skill 管理”中停用；重新启用后即可恢复使用。）',
  }
}

async function listShadows(options) {
  const shadows = []
  if (disabledSet.size === 0) return shadows
  // 描述尽量取实时值（文件改了描述也跟着变）；找不到文件时保守遮蔽并标注
  const scanned = await scanAll(options?.cwd)
  for (const name of disabledSet) {
    const real = scanned.find((skill) => skill.name === name && skill.scanned)
    shadows.push({
      name,
      description: real === undefined ? `${name}（已停用；原文件不在已知 skill 目录）` : `已停用 · ${real.description}`,
      invocation: { modelInvocable: false, userInvocable: false },
      source: 'skill-manager',
      rank: SHADOW_RANK,
      provider: 'skill-manager',
    })
  }
  return shadows
}

// ---------------------------------------------------------------------------
// HTTP 路由
// ---------------------------------------------------------------------------

/** 最近一个可解析会话的 cwd（项目级视角用；sessions/agents 契约与 peak-hour-lock 同源）。 */
function latestSessionCwd(ctx) {
  try {
    const snapshot = ctx.sessions.list.getSnapshot()
    const ids = Array.isArray(snapshot?.ids) ? snapshot.ids : []
    let cwd
    for (const id of ids) {
      try {
        const value = ctx.agents.get(id)?.session?.header?.cwd
        if (typeof value === 'string' && value !== '') cwd = value
      } catch {
        // 会话可能已关闭，跳过
      }
    }
    return cwd
  } catch {
    return undefined
  }
}

const USER_SOURCES = new Set(['user-dsh', 'user-agents'])
const PROJECT_SOURCES = new Set(['project-dsh', 'project-agents'])

/** 合并同名条目为展示行（生效者提供描述，记 shadowCount）。 */
function toRows(entries) {
  const byName = new Map()
  for (const entry of entries) {
    const list = byName.get(entry.name) ?? []
    list.push(entry)
    byName.set(entry.name, list)
  }
  const rows = []
  for (const [name, list] of byName) {
    const sorted = [...list].sort((a, b) => a.rank - b.rank || String(a.path).localeCompare(String(b.path)))
    const winner = sorted[0]
    rows.push({
      name,
      description: winner.description,
      author: winner.author,
      userOnly: winner.userOnly,
      source: winner.source,
      enabled: !disabledSet.has(name),
      shadowCount: list.length - 1,
    })
  }
  rows.sort((a, b) => String(a.name).localeCompare(String(b.name)))
  return rows
}

/** /list 响应：用户级行（含幽灵）+ 项目级分组 + 同名冲突 + 死目录清单。 */
async function listPayload(ctx) {
  const cwd = latestSessionCwd(ctx)
  const all = await scanAll(cwd)

  // shadowCount 按全部根目录的同名总数计（含项目级与死目录副本），不只算本分区
  const totalsByName = new Map()
  for (const skill of all) totalsByName.set(skill.name, (totalsByName.get(skill.name) ?? 0) + 1)
  const applyShadowCount = (rows) => {
    for (const row of rows) row.shadowCount = (totalsByName.get(row.name) ?? 1) - 1
    return rows
  }

  const userRows = applyShadowCount(toRows(all.filter((s) => USER_SOURCES.has(s.source))))
  const projectRows = applyShadowCount(toRows(all.filter((s) => PROJECT_SOURCES.has(s.source))))
  for (const name of disabledSet) {
    if (all.some((s) => s.name === name)) continue
    userRows.push({
      name,
      description: '（原文件不在已知 skill 目录，可重新启用以移出名单）',
      author: undefined,
      userOnly: false,
      source: 'missing',
      enabled: false,
      shadowCount: 0,
    })
  }
  userRows.sort((a, b) => String(a.name).localeCompare(String(b.name)))

  const unscanned = []
  for (const root of staleRoots()) {
    const count = all.filter((s) => !s.scanned && s.source === root.source).length
    unscanned.push({ path: root.path, count })
  }

  return {
    ok: true,
    entries: userRows,
    project: projectRows.length > 0 ? { cwd, entries: projectRows } : null,
    conflicts: computeConflicts(all),
    unscanned,
  }
}

async function setEnabled(ctx, targetName, enabled) {
  if (typeof targetName !== 'string' || !SKILL_NAME_RE.test(targetName)) throw new Error('invalid-skill-name')

  if (enabled) {
    if (!disabledSet.has(targetName)) return { ok: true, name: targetName, enabled, unchanged: true }
    disabledSet.delete(targetName)
  } else {
    if (disabledSet.has(targetName)) return { ok: true, name: targetName, enabled, unchanged: true }
    const all = await scanAll(latestSessionCwd(ctx))
    if (!all.some((skill) => skill.name === targetName && skill.scanned)) {
      throw new Error(`unknown-skill: ${targetName} 不在已知 skill 目录中`)
    }
    disabledSet.add(targetName)
  }

  await persistState(ctx)
  if (invalidateCatalog !== undefined) invalidateCatalog()
  return { ok: true, name: targetName, enabled, unchanged: false }
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function requireMethod(req, res, method) {
  if (req.method === method) return true
  json(res, 405, { ok: false, error: 'method-not-allowed' })
  return false
}

function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 64 * 1024) {
        rejectBody(new Error('body-too-large'))
        queueMicrotask(() => req.destroy())
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) {
        resolveBody({})
        return
      }
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        rejectBody(new Error('invalid-json'))
      }
    })
    req.on('error', rejectBody)
  })
}

export async function apply(ctx) {
  await loadState(ctx)

  ctx.effect(() => ctx.skills.registerProvider((control) => {
    invalidateCatalog = control.invalidate
    return {
      name: 'skill-manager',
      list: (options) => listShadows(options),
      get: (candidate) => Promise.resolve(shadowDefinition(candidate)),
    }
  }), 'skill-manager: shadow provider')

  const routes = [
    {
      kind: 'exact',
      path: `${API_PREFIX}/list`,
      handler: (req, res) => {
        if (!requireMethod(req, res, 'GET')) return Promise.resolve()
        return listPayload(ctx).then(
          (payload) => json(res, 200, payload),
          (error) => json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) }),
        )
      },
    },
    {
      kind: 'exact',
      path: `${API_PREFIX}/set-enabled`,
      handler: (req, res) => {
        if (!requireMethod(req, res, 'POST')) return Promise.resolve()
        return readJsonBody(req).then(
          (body) => setEnabled(ctx, body.name, body.enabled === true).then(
            (value) => json(res, 200, value),
            (error) => json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) }),
          ),
          (error) => json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) }),
        )
      },
    },
  ]
  ctx.effect(() => {
    const disposers = routes.map((route) => ctx.webServer.register(route))
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'skill-manager: routes')
}
