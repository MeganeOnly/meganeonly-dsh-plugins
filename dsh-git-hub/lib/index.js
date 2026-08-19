/**
 * dsh-git-hub — Host 半端（作者：MeganeOnly）
 *
 * 右侧 FAB + 抽屉模式的 Git/GitHub 管理面板。Host 端职责：
 *   1) 扫描配置的根目录列表，递归找 .git 仓库（跳过 node_modules / .git/
 *      worktrees / target / build / dist / .venv / __pycache__ / .next /
 *      .cache 等典型大目录）；
 *   2) 对每个仓库跑 git 命令集（branch / upstream / dirty / unpushed /
 *      今日 commit 数 / 最新 commit），单 repo 串行执行，每个命令 5 秒
 *      timeout，失败 fallback 不阻塞；
 *   3) 后台 spawn daily-push.cjs（不阻塞 HTTP 响应，立即返回 PID + startedAt）；
 *   4) 配置（扫描根路径列表 + toolPath 探测结果）持久化到 profile 根
 *      .git-hub-config.json（原子写）；
 *   5) v0.3.0 新增 merge / pull / abort-merge：读 .git/MERGE_HEAD 与
 *      rebase-merge/rebase-apply 检测冲突态；git merge [--no-ff] / git pull
 *      [--rebase]；冲突时回传冲突文件列表 + 让客户端渲染 abort 按钮。
 *
 * 对外 API（全部 /api/git-hub/* 前缀）：
 *   GET  /api/git-hub/config           — 读配置
 *   POST /api/git-hub/config           — 改配置 { scanRoots }
 *   GET  /api/git-hub/repos            — 扫 + 状态（5s 内返回缓存）
 *   POST /api/git-hub/repos/refresh    — 强制重扫
 *   POST /api/git-hub/push-all         — 后台 spawn daily-push.cjs --all --yes
 *   POST /api/git-hub/repos/push       — 单仓库 { path }
 *   GET  /api/git-hub/push-status      — 最近推送状态（PID + 退出码）
 *   POST /api/git-hub/commit           — 提交 dsh-plugins 源仓库 { message }
 *   GET  /api/git-hub/commit-status    — 读 dsh-plugins 源仓库工作区状态（branch + 改动数）
 *   --- v0.3.0 merge 工具 ---
 *   GET  /api/git-hub/repos/branches?path=... — 列本地分支 + 冲突态
 *   POST /api/git-hub/repos/merge             — git merge [--no-ff] <source>
 *   POST /api/git-hub/repos/pull              — git pull [--rebase]
 *   POST /api/git-hub/repos/merge-abort       — git merge --abort / rebase --abort
 *
 * 作者：MeganeOnly
 */
import { execFile, execFileSync } from 'node:child_process'
import { readFile, writeFile, rename, readdir, stat } from 'node:fs/promises'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, sep, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'git-hub'

export const inject = ['webServer']

/* ------------------------------------------------------------------ *
 * 常量
 * ------------------------------------------------------------------ */

const PROFILE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
// 配置文件位于 web profile 根（F:\.dsh\profiles\web\.git-hub-config.json）
const CONFIG_FILENAME = '.git-hub-config.json'

const DEFAULT_SCAN_ROOTS = ['F:\\AllWorkSpace', 'E:\\']
const DEFAULT_PUSH_TOOL = 'F:\\AllWorkSpace\\tools\\daily-push.cjs'
// 手动 commit 按钮操作的源仓库（dsh-plugins monorepo 工作区）；
// 通过环境变量 DSH_GIT_HUB_COMMIT_CWD 配置；未设置时占位（client 通常会传 cwd，fallback 几乎走不到）
const DEFAULT_COMMIT_CWD = process.env.DSH_GIT_HUB_COMMIT_CWD || '<set DSH_GIT_HUB_COMMIT_CWD env var>'

const SCAN_CACHE_TTL_MS = 5_000
const GIT_CMD_TIMEOUT_MS = 5_000

// 递归扫描时跳过的目录名（命中即 prune，避免在 node_modules / build 里耗光时间）
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'worktrees',
  'target',
  'build',
  'dist',
  '.venv',
  'venv',
  '__pycache__',
  '.next',
  '.cache',
  '.parcel-cache',
  '.turbo',
  'coverage',
  '.idea',
  '.vscode',
])

const MAX_DEPTH = 8 // 递归深度上限
const MAX_REPOS = 200 // 单次扫描最多收集的仓库数

/* ------------------------------------------------------------------ *
 * 工具函数
 * ------------------------------------------------------------------ */

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

/** 读取请求 JSON body（带 1MB 上限），失败返回 undefined。 */
function readJsonBody(req) {
  return new Promise((resolve) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 1_000_000) {
        req.destroy()
        resolve(undefined)
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve(text.length === 0 ? {} : JSON.parse(text))
      } catch {
        resolve(undefined)
      }
    })
    req.on('error', () => resolve(undefined))
  })
}

/** 同步执行 git 命令，timeout 5s，失败返回 null。 */
function gitSync(args, cwd) {
  try {
    const stdout = execFileSync('git', args, {
      cwd,
      timeout: GIT_CMD_TIMEOUT_MS,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    return stdout
  } catch (e) {
    return null
  }
}

/** 取当前北京时间（UTC+8 无夏令时）的 yyyy-mm-dd 字符串（用于 --since=midnight）。 */
function beijingToday() {
  const ms = Date.now() + 8 * 3600 * 1000
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 路径归一化（Windows 反斜杠）。空字符串 / null 视为无效。 */
function normalizePath(p) {
  if (typeof p !== 'string') return null
  const trimmed = p.trim().replace(/\/+$/, '')
  if (!trimmed) return null
  // 把所有 / 替换成 \
  return trimmed.replace(/\//g, sep).replace(/\\$/, '')
}

/** 路径是否存在的目录。同步 fs.existsSync 即可（启动期一次性）。 */
function isDirectory(p) {
  try {
    if (!existsSync(p)) return false
    const s = statSync(p)
    return s.isDirectory()
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ *
 * 配置持久化
 * ------------------------------------------------------------------ */

const configPath = join(PROFILE_ROOT, CONFIG_FILENAME)

async function loadConfig() {
  try {
    const raw = await readFile(configPath, 'utf8')
    const parsed = JSON.parse(raw)
    const roots = Array.isArray(parsed.scanRoots)
      ? parsed.scanRoots.map(normalizePath).filter(Boolean)
      : []
    return { scanRoots: roots.length > 0 ? roots : DEFAULT_SCAN_ROOTS }
  } catch {
    return { scanRoots: DEFAULT_SCAN_ROOTS }
  }
}

async function saveConfig(scanRoots) {
  const cleaned = Array.isArray(scanRoots)
    ? scanRoots.map(normalizePath).filter(Boolean)
    : []
  const next = { scanRoots: cleaned.length > 0 ? cleaned : DEFAULT_SCAN_ROOTS }
  const tmp = configPath + '.tmp'
  await writeFile(tmp, JSON.stringify(next, null, 2), 'utf8')
  await rename(tmp, configPath)
  return next
}

/* ------------------------------------------------------------------ *
 * RepoScanner：递归找 .git 目录（跳过白名单）
 * ------------------------------------------------------------------ */

/**
 * 递归扫一个根目录，收集所有包含 .git 子目录的目录路径。
 * 同步实现：DSH 进程内只在 API 请求时跑，单次扫描应控制在秒级。
 */
function scanRoot(rootPath) {
  const results = []
  const visited = new Set()
  function walk(dir, depth) {
    if (depth > MAX_DEPTH) return
    if (results.length >= MAX_REPOS) return
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue
      const name = ent.name
      if (SKIP_DIRS.has(name)) continue
      if (name.startsWith('.git')) continue
      const full = join(dir, name)
      if (visited.has(full)) continue
      visited.add(full)
      const gitPath = join(full, '.git')
      try {
        const s = statSync(gitPath)
        if (s.isDirectory() || s.isFile()) {
          // .git 是目录（normal repo）或文件（worktree 引用）都算 git repo
          results.push(full)
          if (results.length >= MAX_REPOS) return
          continue
        }
      } catch {
        // .git 不存在，继续递归
      }
      walk(full, depth + 1)
      if (results.length >= MAX_REPOS) return
    }
  }
  walk(rootPath, 0)
  return results
}

/* ------------------------------------------------------------------ *
 * RepoStatusReader：对单仓库跑 git 命令集，串行
 * ------------------------------------------------------------------ */

function readRepoStatus(repoPath) {
  const name = basename(repoPath)
  const result = {
    path: repoPath,
    name,
    branch: null,
    upstream: null,
    status: 'unknown',
    unpushedCount: -1,
    todayCommitCount: 0,
    lastCommit: null,
    error: null,
  }

  // branch
  const branch = gitSync(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath)
  if (branch !== null) result.branch = branch.trim() || null

  // upstream（失败 = 无 upstream，常见于全新本地仓库）
  const upstream = gitSync(['rev-parse', '--abbrev-ref', '@{u}'], repoPath)
  if (upstream !== null) result.upstream = upstream.trim() || null

  // status --porcelain 输出非空行数
  const statusOut = gitSync(['status', '--porcelain'], repoPath)
  if (statusOut === null) {
    result.error = 'git status failed'
    return result
  }
  const dirtyLines = statusOut.split('\n').filter((l) => l.trim().length > 0).length
  result.status = dirtyLines > 0 ? 'dirty' : 'clean'

  // unpushed count（仅在有 upstream 时计算）
  if (result.upstream) {
    const unpushed = gitSync(['log', `${result.upstream}..HEAD`, '--oneline'], repoPath)
    if (unpushed !== null) {
      result.unpushedCount = unpushed.split('\n').filter((l) => l.trim().length > 0).length
    } else {
      result.unpushedCount = -1
    }
  } else {
    result.unpushedCount = -1 // 无 upstream，前端用 badge 提示
  }

  // 今日 commit 数（北京时间 today 0 点以来）
  const today = beijingToday()
  const todayLog = gitSync(['log', `--since=${today} 00:00`, '--oneline'], repoPath)
  if (todayLog !== null) {
    result.todayCommitCount = todayLog.split('\n').filter((l) => l.trim().length > 0).length
  }

  // 最新 commit
  const lastCommitRaw = gitSync(['log', '-1', '--format=%H|%s|%aI'], repoPath)
  if (lastCommitRaw !== null) {
    const trimmed = lastCommitRaw.trim()
    if (trimmed) {
      const [sha, message, date] = trimmed.split('|')
      result.lastCommit = { sha: (sha || '').slice(0, 7), message: message || '', date: date || '' }
    }
  }

  return result
}

/* ------------------------------------------------------------------ *
 * 扫描 + 状态聚合（5s 缓存）
 * ------------------------------------------------------------------ */

let scanCache = { at: 0, repos: [] }

async function getAllRepos(force) {
  const now = Date.now()
  if (!force && scanCache.repos.length > 0 && now - scanCache.at < SCAN_CACHE_TTL_MS) {
    return { repos: scanCache.repos, cachedAt: scanCache.at }
  }
  const cfg = await loadConfig()
  const repoPaths = []
  for (const root of cfg.scanRoots) {
    if (!isDirectory(root)) continue
    try {
      const found = scanRoot(root)
      for (const p of found) repoPaths.push(p)
    } catch (e) {
      console.warn('[dsh-git-hub] scanRoot failed for', root, e?.message || e)
    }
  }
  // 串行读每个 repo 状态（避免磁盘 IO 风暴 + git 锁冲突）
  const repos = []
  for (const p of repoPaths) {
    try {
      repos.push(readRepoStatus(p))
    } catch (e) {
      console.warn('[dsh-git-hub] readRepoStatus failed for', p, e?.message || e)
    }
  }
  scanCache = { at: now, repos }
  return { repos, cachedAt: now }
}

/* ------------------------------------------------------------------ *
 * PushRunner：后台 spawn daily-push.cjs
 * ------------------------------------------------------------------ */

const lastPush = { startedAt: 0, pid: null, exitCode: null, repo: null, scope: null }

function spawnPush(args, scopeLabel, repoPath) {
  return new Promise((resolve) => {
    const toolPath = DEFAULT_PUSH_TOOL
    if (!existsSync(toolPath)) {
      resolve({ ok: false, error: 'daily-push.cjs not found at ' + toolPath })
      return
    }
    let child
    try {
      child = execFile(
        'node',
        [toolPath, ...args],
        { detached: true, stdio: 'ignore', windowsHide: true }
      )
    } catch (e) {
      resolve({ ok: false, error: 'spawn failed: ' + (e?.message || String(e)) })
      return
    }
    const pid = child.pid || null
    const startedAt = Date.now()
    lastPush.startedAt = startedAt
    lastPush.pid = pid
    lastPush.exitCode = null
    lastPush.repo = repoPath || null
    lastPush.scope = scopeLabel
    child.on('exit', (code) => {
      lastPush.exitCode = code
    })
    child.on('error', (err) => {
      console.error('[dsh-git-hub] push child error:', err)
      lastPush.exitCode = -1
    })
    // detached: 不阻塞主进程
    try { child.unref() } catch (_) { /* ignore */ }
    resolve({ ok: true, startedAt, pid })
  })
}

/* ------------------------------------------------------------------ *
 * apply：注册 HTTP 路由
 * ------------------------------------------------------------------ */

export function apply(ctx) {
  // 启动期一次性探测 daily-push.cjs 工具
  const toolAvailable = existsSync(DEFAULT_PUSH_TOOL)
  if (!toolAvailable) {
    console.warn('[dsh-git-hub] daily-push.cjs not found at', DEFAULT_PUSH_TOOL, '; push buttons will be disabled')
  }

  ctx.webServer.register({
    kind: 'exact',
    path: '/api/git-hub/config',
    handler: async (req, res) => {
      try {
        if (req.method === 'GET') {
          const cfg = await loadConfig()
          json(res, 200, { ok: true, ...cfg, toolPath: DEFAULT_PUSH_TOOL, toolAvailable })
          return
        }
        if (req.method === 'POST') {
          const body = await readJsonBody(req)
          if (!body || !Array.isArray(body.scanRoots)) {
            json(res, 400, { ok: false, error: 'invalid-body' })
            return
          }
          const next = await saveConfig(body.scanRoots)
          // 配置改了清缓存，下次 GET /repos 重扫
          scanCache = { at: 0, repos: [] }
          json(res, 200, { ok: true, ...next })
          return
        }
        json(res, 405, { ok: false, error: 'method-not-allowed' })
      } catch (e) {
        console.error('[dsh-git-hub] /config error:', e)
        json(res, 500, { ok: false, error: 'internal' })
      }
    },
  })

  ctx.webServer.register({
    kind: 'exact',
    path: '/api/git-hub/repos',
    handler: async (req, res) => {
      try {
        if (req.method !== 'GET') {
          json(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const result = await getAllRepos(false)
        json(res, 200, { ok: true, ...result })
      } catch (e) {
        console.error('[dsh-git-hub] /repos error:', e)
        json(res, 500, { ok: false, error: 'internal' })
      }
    },
  })

  ctx.webServer.register({
    kind: 'exact',
    path: '/api/git-hub/repos/refresh',
    handler: async (req, res) => {
      try {
        if (req.method !== 'POST') {
          json(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const result = await getAllRepos(true)
        json(res, 200, { ok: true, ...result })
      } catch (e) {
        console.error('[dsh-git-hub] /repos/refresh error:', e)
        json(res, 500, { ok: false, error: 'internal' })
      }
    },
  })

  ctx.webServer.register({
    kind: 'exact',
    path: '/api/git-hub/push-all',
    handler: async (req, res) => {
      try {
        if (req.method !== 'POST') {
          json(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        if (!toolAvailable) {
          json(res, 503, { ok: false, error: 'daily-push.cjs unavailable' })
          return
        }
        const result = await spawnPush(['--all', '--yes'], 'all', null)
        if (!result.ok) {
          json(res, 500, { ok: false, error: result.error })
          return
        }
        json(res, 200, { ok: true, startedAt: result.startedAt, pid: result.pid })
      } catch (e) {
        console.error('[dsh-git-hub] /push-all error:', e)
        json(res, 500, { ok: false, error: 'internal' })
      }
    },
  })

  ctx.webServer.register({
    kind: 'exact',
    path: '/api/git-hub/repos/push',
    handler: async (req, res) => {
      try {
        if (req.method !== 'POST') {
          json(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        if (!toolAvailable) {
          json(res, 503, { ok: false, error: 'daily-push.cjs unavailable' })
          return
        }
        const body = await readJsonBody(req)
        if (!body || typeof body.path !== 'string') {
          json(res, 400, { ok: false, error: 'invalid-body' })
          return
        }
        const path = normalizePath(body.path)
        if (!path) {
          json(res, 400, { ok: false, error: 'invalid-path' })
          return
        }
        const result = await spawnPush(['--repo', path, '--yes'], 'repo', path)
        if (!result.ok) {
          json(res, 500, { ok: false, error: result.error })
          return
        }
        json(res, 200, { ok: true, startedAt: result.startedAt, pid: result.pid, path })
      } catch (e) {
        console.error('[dsh-git-hub] /repos/push error:', e)
        json(res, 500, { ok: false, error: 'internal' })
      }
    },
  })

  ctx.webServer.register({
    kind: 'exact',
    path: '/api/git-hub/push-status',
    handler: async (req, res) => {
      try {
        if (req.method !== 'GET') {
          json(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        json(res, 200, {
          ok: true,
          toolAvailable,
          lastPush: {
            startedAt: lastPush.startedAt || null,
            pid: lastPush.pid,
            exitCode: lastPush.exitCode,
            scope: lastPush.scope,
            repo: lastPush.repo,
            running: lastPush.pid != null && lastPush.exitCode == null,
          },
        })
      } catch (e) {
        console.error('[dsh-git-hub] /push-status error:', e)
        json(res, 500, { ok: false, error: 'internal' })
      }
    },
  })

  /* ----- 手动 commit 工具（v0.2.2 add） ----- */

  /** 跑 commit 流程：git add -A + git commit -m <msg>，返回新 SHA / 改动数。 */
  function runCommit(cwd, message) {
    // 1. git add -A（失败抛错）
    execFileSync('git', ['add', '-A'], {
      cwd, encoding: 'utf8', timeout: GIT_CMD_TIMEOUT_MS, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    // 2. 统计 staged 改动行数（git status --porcelain 在 add 后）
    const statusOut = execFileSync('git', ['status', '--porcelain'], {
      cwd, encoding: 'utf8', timeout: GIT_CMD_TIMEOUT_MS, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const files = statusOut.split('\n').filter((l) => l.trim().length > 0)
    if (files.length === 0) {
      return { ok: false, error: 'no-changes' }
    }
    // 3. git commit -m <message>（commit 用 20s timeout，pre-commit hook 可能慢）
    try {
      execFileSync('git', ['commit', '-m', message], {
        cwd, encoding: 'utf8', timeout: GIT_CMD_TIMEOUT_MS * 4, windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (e) {
      // 区分"什么都没 staged"和"实际 commit 失败"——前者 add 后已过滤，
      // 到这里说明 pre-commit hook 失败 / message 校验失败 / 锁冲突等
      const stderr = e.stderr ? e.stderr.toString() : ''
      const stdout = e.stdout ? e.stdout.toString() : ''
      return { ok: false, error: 'commit-failed', stderr, stdout }
    }
    // 4. 取新 SHA
    const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd, encoding: 'utf8', timeout: GIT_CMD_TIMEOUT_MS, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    return { ok: true, sha, filesChanged: files.length, message }
  }

  /** 读单仓库 commit 状态：branch + 改动文件列表（不 add）。返回 null = 仓库不可读 / 跳过。 */
  function readRepoCommitState(repoPath) {
    const branch = gitSync(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath)
    if (branch === null) return null // 不可读（如 worktree detached / 权限）
    const statusOut = gitSync(['status', '--porcelain'], repoPath)
    if (statusOut === null) return null
    // 解析 porcelain 输出：第一列是状态码，第二列起是路径
    // 格式: " M path" / "M  path" / "A  path" / "?? path" / "R  old -> new" 等
    const files = []
    for (const line of statusOut.split('\n')) {
      if (line.length < 3) continue
      const status = line.slice(0, 2).trim()
      const rest = line.slice(3)
      // rename 是 "old -> new"，只显示新名
      const arrowIdx = rest.indexOf(' -> ')
      const path = arrowIdx >= 0 ? rest.slice(arrowIdx + 4) : rest
      files.push({ status: status || '?', path })
    }
    const lastCommitRaw = gitSync(['log', '-1', '--format=%H|%s|%aI'], repoPath)
    let lastCommit = null
    if (lastCommitRaw) {
      const t = lastCommitRaw.trim()
      if (t) {
        const [s, m, d] = t.split('|')
        lastCommit = { sha: (s || '').slice(0, 7), message: m || '', date: d || '' }
      }
    }
    return {
      path: repoPath,
      name: basename(repoPath),
      branch: branch.trim() || null,
      files,
      filesChanged: files.length,
      lastCommit,
    }
  }

  /** 扫所有 scanRoots 下的 git 仓库，返回有改动的那些（不 add）。 */
  async function listChangedRepos() {
    const cfg = await loadConfig()
    const repoPaths = []
    for (const root of cfg.scanRoots) {
      if (!isDirectory(root)) continue
      try {
        const found = scanRoot(root)
        for (const p of found) repoPaths.push(p)
      } catch (_) { /* ignore single root failure */ }
    }
    const results = []
    for (const p of repoPaths) {
      try {
        const state = readRepoCommitState(p)
        if (state && state.filesChanged > 0) results.push(state)
      } catch (_) { /* skip unreadable repo */ }
    }
    return results
  }

  /* ----- v0.3.0 merge / pull 工具 ----- */

  /**
   * 列单仓库本地分支 + 冲突态。返回 null = 仓库不可读。
   * - branches: [{ name, isCurrent, upstream }]
   * - current: 当前分支名（与 branches 中 isCurrent=true 一致）
   * - upstream: 当前分支的上游（来自 @{u}，可能 null）
   * - mergeInProgress: .git/MERGE_HEAD 存在 → 合并冲突未解决
   * - rebaseInProgress: .git/rebase-merge 或 rebase-apply 存在 → 变基冲突未解决
   * - detached HEAD: current 为 null + HEAD 直接给 SHA（这里用 refname:short 拿不到时
   *   回落到 rev-parse --abbrev-ref HEAD 的 "HEAD" 字面量作为哨兵）
   */
  function readBranches(repoPath) {
    // for-each-ref 比 branch --list 更稳：可控格式 + 不依赖颜色输出
    const raw = gitSync(
      ['for-each-ref', '--format=%(refname:short)|%(HEAD)|%(upstream:short)', 'refs/heads'],
      repoPath
    )
    if (raw === null) return null
    const branches = []
    for (const line of raw.split('\n')) {
      const t = line.trim()
      if (!t) continue
      const [name, head, upstream] = t.split('|')
      if (!name) continue
      branches.push({
        name,
        isCurrent: head === '*',
        upstream: upstream || null,
      })
    }
    const current = branches.find((b) => b.isCurrent)?.name || null
    // 当前分支的上游（独立拿，因为可能 detached / no upstream）
    const upstreamOfCurrent = gitSync(['rev-parse', '--abbrev-ref', '@{u}'], repoPath)
    const upstreamTrimmed = upstreamOfCurrent ? upstreamOfCurrent.trim() : null
    const hasUpstream = !!upstreamTrimmed && upstreamTrimmed !== '@{u}' && !upstreamTrimmed.includes('@{u}')
    // 冲突态检测（看 .git/ 下文件/目录是否存在）
    const dotGit = join(repoPath, '.git')
    const mergeHead = join(dotGit, 'MERGE_HEAD')
    const rebaseMerge = join(dotGit, 'rebase-merge')
    const rebaseApply = join(dotGit, 'rebase-apply')
    let mergeInProgress = false
    let rebaseInProgress = false
    try {
      if (existsSync(dotGit)) {
        // .git 可能是文件（worktree 引用），statSync 检查
        mergeInProgress = existsSync(mergeHead)
        rebaseInProgress = existsSync(rebaseMerge) || existsSync(rebaseApply)
      }
    } catch (_) { /* ignore */ }
    // 排序：current 第一，其余按字母
    branches.sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1
      if (!a.isCurrent && b.isCurrent) return 1
      return a.name.localeCompare(b.name)
    })
    return {
      path: repoPath,
      name: basename(repoPath),
      branches,
      current,
      upstream: hasUpstream ? upstreamTrimmed : null,
      mergeInProgress,
      rebaseInProgress,
    }
  }

  /**
   * 跑 git merge [--no-ff] <source>，捕获冲突结果。
   * 返回值：
   *   { ok: true,  status: 'merged'|'fast-forward'|'already-up-to-date', headBefore, headAfter, source, noFF }
   *   { ok: false, error: 'merge-in-progress'|'dirty-worktree'|'conflict'|'merge-failed'|'invalid-source', conflicts?, stderr?, stdout? }
   * 关键点：
   *   - merge 前若有未提交改动 → 大概率失败且难回退 → 直接拒绝（要求用户先 commit / stash）
   *   - merge 冲突：保留 MERGE_HEAD 不动，让客户端给 abort 按钮；返回 conflicts 文件列表
   *   - fast-forward 检测：看 HEAD 父数（merge commit 有 2 父，FF 没有父变化）
   */
  function runMerge(cwd, source, noFF) {
    // 1. 已在 merge 状态 → 拒绝（必须先 abort 或解决）
    const dotGit = join(cwd, '.git')
    if (!existsSync(join(dotGit, 'MERGE_HEAD'))) {
      // not in merge
    } else {
      return { ok: false, error: 'merge-in-progress', hint: '已有未完成的合并，请先解决冲突或 abort' }
    }
    // 2. 工作区必须干净（dirty 工作区 + merge 容易失败且难以回滚）
    const statusOut = gitSync(['status', '--porcelain'], cwd)
    if (statusOut !== null && statusOut.split('\n').filter((l) => l.trim().length > 0).length > 0) {
      return { ok: false, error: 'dirty-worktree', hint: '工作区有未提交改动，请先 commit 或 stash' }
    }
    // 3. 校验 source 是否存在（本地分支或远程分支）
    const sourceExists = gitSync(['rev-parse', '--verify', '--quiet', source], cwd)
    if (sourceExists === null) {
      return { ok: false, error: 'invalid-source', hint: '找不到分支 ' + source }
    }
    // 4. HEAD 前快照
    const headBefore = gitSync(['rev-parse', '--short', 'HEAD'], cwd)
    const headBeforeTrim = headBefore ? headBefore.trim() : null
    // 5. 执行 merge（merge 命令 30s timeout，pre-commit 钩子 + 大量文件合并可能慢）
    const args = ['merge']
    if (noFF) args.push('--no-ff')
    args.push(source)
    try {
      execFileSync('git', args, {
        cwd, encoding: 'utf8', timeout: 30_000, windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (e) {
      const stderr = e.stderr ? e.stderr.toString() : ''
      const stdout = e.stdout ? e.stdout.toString() : ''
      // 检查 MERGE_HEAD 是否存在 → 冲突中
      if (existsSync(join(dotGit, 'MERGE_HEAD'))) {
        // git 把 CONFLICT 行写到 stdout（尤其 Windows），需合并读
        const conflicts = parseConflictFiles(stderr + '\n' + stdout)
        return { ok: false, error: 'conflict', conflicts, stderr, stdout, source }
      }
      return { ok: false, error: 'merge-failed', stderr, stdout, source }
    }
    // 6. 判断结果：HEAD 是否变化 + 父数
    const headAfter = gitSync(['rev-parse', '--short', 'HEAD'], cwd)
    const headAfterTrim = headAfter ? headAfter.trim() : null
    if (headBeforeTrim === headAfterTrim) {
      return { ok: true, status: 'already-up-to-date', headBefore: headBeforeTrim, headAfter: headAfterTrim, source, noFF: !!noFF }
    }
    // 父数：git rev-list --parents -n 1 HEAD → SHA + 父 SHAs（FF 没有合并父）
    const parentsRaw = gitSync(['rev-list', '--parents', '-n', '1', 'HEAD'], cwd)
    const parentsTrim = parentsRaw ? parentsRaw.trim() : ''
    const parentCount = parentsTrim ? parentsTrim.split(' ').length - 1 : 0
    const status = parentCount >= 2 ? 'merged' : 'fast-forward'
    return { ok: true, status, headBefore: headBeforeTrim, headAfter: headAfterTrim, source, noFF: !!noFF }
  }

  /**
   * 跑 git pull [origin] [--rebase]。pull = fetch + merge（默认）/ rebase（--rebase）。
   * 冲突时返回 conflicts + 让客户端展示 abort 按钮。
   */
  function runPull(cwd, rebase) {
    const dotGit = join(cwd, '.git')
    if (existsSync(join(dotGit, 'MERGE_HEAD'))) {
      return { ok: false, error: 'merge-in-progress', hint: '已有未完成的合并，请先解决冲突或 abort' }
    }
    if (existsSync(join(dotGit, 'rebase-merge')) || existsSync(join(dotGit, 'rebase-apply'))) {
      return { ok: false, error: 'rebase-in-progress', hint: '已有未完成的变基，请先解决冲突或 abort' }
    }
    // 工作区检查
    const statusOut = gitSync(['status', '--porcelain'], cwd)
    if (statusOut !== null && statusOut.split('\n').filter((l) => l.trim().length > 0).length > 0) {
      return { ok: false, error: 'dirty-worktree', hint: '工作区有未提交改动，请先 commit 或 stash' }
    }
    // upstream 检查
    const upstream = gitSync(['rev-parse', '--abbrev-ref', '@{u}'], cwd)
    const upstreamTrim = upstream ? upstream.trim() : null
    if (!upstreamTrim || upstreamTrim.includes('@{u}')) {
      return { ok: false, error: 'no-upstream', hint: '当前分支没有配置 upstream' }
    }
    const headBefore = gitSync(['rev-parse', '--short', 'HEAD'], cwd)
    const headBeforeTrim = headBefore ? headBefore.trim() : null
    // git pull (rebase 用 --rebase)
    const args = rebase ? ['pull', '--rebase'] : ['pull']
    try {
      execFileSync('git', args, {
        cwd, encoding: 'utf8', timeout: 60_000, windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (e) {
      const stderr = e.stderr ? e.stderr.toString() : ''
      const stdout = e.stdout ? e.stdout.toString() : ''
      const inMerge = existsSync(join(dotGit, 'MERGE_HEAD'))
      const inRebase = existsSync(join(dotGit, 'rebase-merge')) || existsSync(join(dotGit, 'rebase-apply'))
      if (inMerge || inRebase) {
        const conflicts = parseConflictFiles(stderr + '\n' + stdout)
        return {
          ok: false,
          error: 'conflict',
          conflicts,
          stderr,
          stdout,
          rebase: !!rebase,
          // 让前端知道是 merge 还是 rebase 冲突
          conflictType: inRebase ? 'rebase' : 'merge',
        }
      }
      return { ok: false, error: 'pull-failed', stderr, stdout, rebase: !!rebase }
    }
    const headAfter = gitSync(['rev-parse', '--short', 'HEAD'], cwd)
    const headAfterTrim = headAfter ? headAfter.trim() : null
    if (headBeforeTrim === headAfterTrim) {
      return { ok: true, status: 'already-up-to-date', headBefore: headBeforeTrim, headAfter: headAfterTrim, rebase: !!rebase }
    }
    return { ok: true, status: rebase ? 'rebased' : 'merged', headBefore: headBeforeTrim, headAfter: headAfterTrim, rebase: !!rebase }
  }

  /**
   * 解析 git merge / rebase 输出的冲突文件列表。
   * 输出格式（常见，Windows / Linux 都同）：
   *   - "CONFLICT (content): Merge conflict in lib/index.js"
   *   - "CONFLICT (add/add): Merge conflict in foo.txt"
   *   - "CONFLICT (modify/delete): bar.txt deleted in HEAD"
   *   - "CONFLICT (rename/rename): Rename foo->bar in HEAD"
   * 启发式处理：
   *   1. "Merge conflict in <path>" → 路径 = <path>
   *   2. "<old>-><new>" rename → 路径 = <new>
   *   3. 其他 → 路径 = 捕获组本身（让用户看见原行）
   * 注意：git 把这些行输出到 stdout（在 Windows 上尤其明显），
   *       调用方必须把 stderr + stdout 合并后再传入。
   */
  function parseConflictFiles(stderrOrCombined) {
    const files = []
    const seen = new Set()
    for (const line of (stderrOrCombined || '').split('\n')) {
      const m = line.match(/^CONFLICT\s+\([^)]+\):\s+(.+)$/)
      if (!m) continue
      let captured = m[1].trim()
      let path = captured
      // 模式 1: "Merge conflict in <path>"
      if (/^Merge conflict in /.test(captured)) {
        path = captured.replace(/^Merge conflict in /, '')
      }
      // 模式 2: rename（含/不含空格两种：'<old> -> <new>' 或 '<old>-><new>'）
      //   git 不同版本输出格式不一致，保守处理：取最后 "->" 后的段
      if (/->/.test(path)) {
        const segs = path.split(/ *-> */)
        path = segs[segs.length - 1].trim()
        // 去掉可能的引号对（rename 输出有时带 "old" -> "new"）
        // 用配对 quote 处理（find matching 位置），避免只去首字符的边界 case
        if (path.startsWith('"') || path.startsWith("'")) {
          const q = path[0]
          const close = path.indexOf(q, 1)
          if (close > 0) path = path.slice(1, close) + path.slice(close + 1)
          else path = path.slice(1)
        }
      }
      // 去尾随句号 / 逗号
      path = path.replace(/[.,;]+$/, '')
      if (path && !seen.has(path)) {
        seen.add(path)
        files.push(path)
      }
    }
    return files
  }

  /**
   * Abort merge 或 rebase（看哪个在进行中）。返回 abort 模式。
   *   { ok: true, aborted: 'merge'|'rebase' }
   *   { ok: false, error: 'nothing-to-abort'|'abort-failed', stderr?, stdout? }
   */
  function runMergeAbort(cwd) {
    const dotGit = join(cwd, '.git')
    const mergeHead = join(dotGit, 'MERGE_HEAD')
    const rebaseMerge = join(dotGit, 'rebase-merge')
    const rebaseApply = join(dotGit, 'rebase-apply')
    let mode = null
    let cmd = null
    if (existsSync(mergeHead)) {
      mode = 'merge'
      cmd = ['merge', '--abort']
    } else if (existsSync(rebaseMerge) || existsSync(rebaseApply)) {
      mode = 'rebase'
      cmd = ['rebase', '--abort']
    }
    if (!mode) {
      return { ok: false, error: 'nothing-to-abort', hint: '当前没有进行中的合并或变基' }
    }
    try {
      execFileSync('git', cmd, {
        cwd, encoding: 'utf8', timeout: 15_000, windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      return { ok: true, aborted: mode }
    } catch (e) {
      const stderr = e.stderr ? e.stderr.toString() : ''
      const stdout = e.stdout ? e.stdout.toString() : ''
      return { ok: false, error: 'abort-failed', stderr, stdout, mode }
    }
  }

  /**
   * 扫所有 scanRoots 下的 git 仓库，返回「有合并/拉取价值」的子集：
   *   - ≥2 本地分支（可以 merge）
   *   - 有 upstream（可以 pull）
   *   - mergeInProgress / rebaseInProgress（需要 abort）
   * 其它仓库不展示，避免噪声。
   */
  async function listMergeableRepos() {
    const cfg = await loadConfig()
    const repoPaths = []
    for (const root of cfg.scanRoots) {
      if (!isDirectory(root)) continue
      try {
        const found = scanRoot(root)
        for (const p of found) repoPaths.push(p)
      } catch (_) { /* ignore single root failure */ }
    }
    const results = []
    for (const p of repoPaths) {
      try {
        const info = readBranches(p)
        if (!info) continue
        // 过滤条件：多分支 / 有上游 / 冲突中
        const actionable =
          info.mergeInProgress ||
          info.rebaseInProgress ||
          info.branches.length >= 2 ||
          !!info.upstream
        if (actionable) results.push(info)
      } catch (_) { /* skip unreadable repo */ }
    }
    return results
  }

  ctx.webServer.register({
    kind: 'exact',
    path: '/api/git-hub/commit',
    handler: async (req, res) => {
      try {
        if (req.method !== 'POST') {
          json(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const body = await readJsonBody(req)
        if (!body || typeof body.message !== 'string') {
          json(res, 400, { ok: false, error: 'invalid-body' })
          return
        }
        const message = body.message.trim()
        if (!message) {
          json(res, 400, { ok: false, error: 'empty-message' })
          return
        }
        // 单行 message（git -m 不支持多行；想写多行未来用 -F 文件）
        if (message.includes('\n')) {
          json(res, 400, { ok: false, error: 'multiline-not-supported' })
          return
        }
        const cwd = (body.cwd && typeof body.cwd === 'string') ? body.cwd : DEFAULT_COMMIT_CWD
        if (!existsSync(cwd)) {
          json(res, 400, { ok: false, error: 'cwd-not-found', cwd })
          return
        }
        const result = runCommit(cwd, message)
        if (!result.ok) {
          const status = result.error === 'no-changes' ? 400 : 500
          json(res, status, { ok: false, error: result.error, stderr: result.stderr, stdout: result.stdout })
          return
        }
        json(res, 200, { ok: true, sha: result.sha, filesChanged: result.filesChanged, message: result.message, cwd })
      } catch (e) {
        console.error('[dsh-git-hub] /commit error:', e)
        json(res, 500, { ok: false, error: 'internal', message: e?.message || String(e) })
      }
    },
  })

  ctx.webServer.register({
    kind: 'exact',
    path: '/api/git-hub/commit-status',
    handler: async (req, res) => {
      try {
        if (req.method !== 'GET') {
          json(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        // 扫所有 scanRoots 下的 git 仓库，返回有改动的列表
        const repos = await listChangedRepos()
        json(res, 200, { ok: true, repos })
      } catch (e) {
        console.error('[dsh-git-hub] /commit-status error:', e)
        json(res, 500, { ok: false, error: 'internal' })
      }
    },
  })

  /* ----- v0.3.0 merge 工具路由 ----- */

  // 校验路径：必须存在、是 git 仓库（.git 目录或文件）
  function resolveRepoOr400(path) {
    if (!path) return { ok: false, code: 400, error: 'invalid-path', hint: '缺 path' }
    if (!existsSync(path)) return { ok: false, code: 400, error: 'invalid-path', hint: '路径不存在' }
    const dotGit = join(path, '.git')
    if (!existsSync(dotGit)) return { ok: false, code: 400, error: 'not-a-git-repo', hint: '不是 git 仓库' }
    return { ok: true, path }
  }

  ctx.webServer.register({
    kind: 'exact',
    path: '/api/git-hub/repos/branches',
    handler: async (req, res) => {
      try {
        if (req.method !== 'GET') {
          json(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const url = new URL(req.url, 'http://localhost')
        const rawPath = url.searchParams.get('path')
        const normPath = normalizePath(rawPath)
        if (!normPath) {
          json(res, 400, { ok: false, error: 'invalid-path' })
          return
        }
        const check = resolveRepoOr400(normPath)
        if (!check.ok) {
          json(res, check.code, { ok: false, error: check.error, hint: check.hint })
          return
        }
        const info = readBranches(check.path)
        if (!info) {
          json(res, 500, { ok: false, error: 'read-failed' })
          return
        }
        json(res, 200, { ok: true, ...info })
      } catch (e) {
        console.error('[dsh-git-hub] /repos/branches error:', e)
        json(res, 500, { ok: false, error: 'internal', message: e?.message || String(e) })
      }
    },
  })

  ctx.webServer.register({
    kind: 'exact',
    path: '/api/git-hub/repos/merge',
    handler: async (req, res) => {
      try {
        if (req.method !== 'POST') {
          json(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const body = await readJsonBody(req)
        if (!body || typeof body.path !== 'string' || typeof body.source !== 'string') {
          json(res, 400, { ok: false, error: 'invalid-body', hint: '需要 { path, source }' })
          return
        }
        const path = normalizePath(body.path)
        const check = resolveRepoOr400(path)
        if (!check.ok) {
          json(res, check.code, { ok: false, error: check.error, hint: check.hint })
          return
        }
        const source = body.source.trim()
        if (!source) {
          json(res, 400, { ok: false, error: 'invalid-source' })
          return
        }
        const noFF = !!body.noFF
        const result = runMerge(check.path, source, noFF)
        // 冲突 → 409，前端展示冲突文件列表 + abort 按钮
        const status = !result.ok && result.error === 'conflict' ? 409 : (!result.ok ? 500 : 200)
        json(res, status, result)
      } catch (e) {
        console.error('[dsh-git-hub] /repos/merge error:', e)
        json(res, 500, { ok: false, error: 'internal', message: e?.message || String(e) })
      }
    },
  })

  ctx.webServer.register({
    kind: 'exact',
    path: '/api/git-hub/repos/pull',
    handler: async (req, res) => {
      try {
        if (req.method !== 'POST') {
          json(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const body = await readJsonBody(req)
        if (!body || typeof body.path !== 'string') {
          json(res, 400, { ok: false, error: 'invalid-body', hint: '需要 { path }' })
          return
        }
        const path = normalizePath(body.path)
        const check = resolveRepoOr400(path)
        if (!check.ok) {
          json(res, check.code, { ok: false, error: check.error, hint: check.hint })
          return
        }
        const rebase = !!body.rebase
        const result = runPull(check.path, rebase)
        const status = !result.ok && result.error === 'conflict' ? 409 : (!result.ok ? 500 : 200)
        json(res, status, result)
      } catch (e) {
        console.error('[dsh-git-hub] /repos/pull error:', e)
        json(res, 500, { ok: false, error: 'internal', message: e?.message || String(e) })
      }
    },
  })

  ctx.webServer.register({
    kind: 'exact',
    path: '/api/git-hub/repos/merge-abort',
    handler: async (req, res) => {
      try {
        if (req.method !== 'POST') {
          json(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const body = await readJsonBody(req)
        if (!body || typeof body.path !== 'string') {
          json(res, 400, { ok: false, error: 'invalid-body', hint: '需要 { path }' })
          return
        }
        const path = normalizePath(body.path)
        const check = resolveRepoOr400(path)
        if (!check.ok) {
          json(res, check.code, { ok: false, error: check.error, hint: check.hint })
          return
        }
        const result = runMergeAbort(check.path)
        const status = !result.ok && result.error === 'nothing-to-abort' ? 400 : (!result.ok ? 500 : 200)
        json(res, status, result)
      } catch (e) {
        console.error('[dsh-git-hub] /repos/merge-abort error:', e)
        json(res, 500, { ok: false, error: 'internal', message: e?.message || String(e) })
      }
    },
  })

  /* /api/git-hub/repos/merge-status：扫所有可合并仓库（给抽屉批量渲染用） */
  ctx.webServer.register({
    kind: 'exact',
    path: '/api/git-hub/repos/merge-status',
    handler: async (req, res) => {
      try {
        if (req.method !== 'GET') {
          json(res, 405, { ok: false, error: 'method-not-allowed' })
          return
        }
        const repos = await listMergeableRepos()
        json(res, 200, { ok: true, repos })
      } catch (e) {
        console.error('[dsh-git-hub] /repos/merge-status error:', e)
        json(res, 500, { ok: false, error: 'internal' })
      }
    },
  })
}