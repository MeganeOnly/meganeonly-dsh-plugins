/**
 * dsh-update-checker — Host 半端（作者：MeganeOnly）
 *
 * 检查 DeepSeek Harness 本体（@deepseek-ai/dsh）在 npm 上是否有新版本，
 * 并提供一键升级（npm install -g @deepseek-ai/dsh@latest）。
 *
 * 只负责 DSH 本体，不碰 profile 插件、不碰其他依赖。
 *
 * API：
 *   GET  /api/dsh-update/status   → { ok, current, latest, hasUpdate, checking,
 *                                     updating, lastCheckAt, updateResult }
 *   POST /api/dsh-update/check    → 立即重新查 npm，返回与 status 相同的结构
 *   POST /api/dsh-update/update   → 执行 npm install -g @deepseek-ai/dsh@latest
 *
 * 升级完成后不自动重启：磁盘上的包已更新，但正在运行的进程仍是旧代码，
 * 界面会提示"请重启 DSH 生效"。
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const name = 'update-checker'

export const inject = ['webServer']

const PKG = '@deepseek-ai/dsh'
const REGISTRY_URL = 'https://registry.npmjs.org/@deepseek-ai/dsh/latest'
const API_STATUS = '/api/dsh-update/status'
const API_CHECK = '/api/dsh-update/check'
const API_UPDATE = '/api/dsh-update/update'
const CHECK_TIMEOUT_MS = 20000
const UPDATE_TIMEOUT_MS = 180000
const MAX_OUTPUT_BYTES = 512 * 1024

/**
 * 解析 semver：返回 [major, minor, patch, prerelease] 四元组。
 * - prerelease 是 prerelease 字符串（如 'rc.6' / 'alpha.1'），空串表示无 prerelease。
 * - build metadata（+xxx）忽略（不影响排序）。
 * - 非法字符串返回 null。
 */
function parseSemver(v) {
  const s = String(v == null ? '' : v).trim()
  const m = s.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] || '']
}

/**
 * a > b 返回 1；a < b 返回 -1；相等返回 0。
 * 完整 semver 排序：
 *  1) 先比 major/minor/patch
 *  2) 主段相等：release > prerelease（无 prerelease 视为最大）
 *  3) 都有 prerelease：按 '.' 切分，逐段比较
 *     - 都是数字段：按数字大小（不是字典序）
 *     - 都是字符串段：按字典序
 *     - 数字段 < 字符串段（semver 规范）
 *     - 长度不等：段少的更小
 */
function compareSemver(a, b) {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (pa === null || pb === null) return a === b ? 0 : -1
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1
  }
  if (pa[3] === '' && pb[3] === '') return 0
  if (pa[3] === '') return 1
  if (pb[3] === '') return -1
  const A = pa[3].split('.')
  const B = pb[3].split('.')
  const len = Math.max(A.length, B.length)
  for (let i = 0; i < len; i += 1) {
    if (A[i] === undefined) return -1
    if (B[i] === undefined) return 1
    const aN = /^\d+$/.test(A[i])
    const bN = /^\d+$/.test(B[i])
    if (aN && bN) {
      const an = Number(A[i])
      const bn = Number(B[i])
      if (an !== bn) return an > bn ? 1 : -1
    } else if (aN) {
      return -1
    } else if (bN) {
      return 1
    } else if (A[i] !== B[i]) {
      return A[i] > B[i] ? 1 : -1
    }
  }
  return 0
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

/** 读取请求 JSON body（带大小上限），失败返回 undefined。 */
function readJsonBody(req) {
  return new Promise((resolve) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_OUTPUT_BYTES) {
        req.destroy()
        resolve(undefined)
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        resolve(undefined)
      }
    })
    req.on('error', () => resolve(undefined))
  })
}

export function apply(ctx) {
  /** 检查/更新状态机：单飞（同一时刻只允许一个检查或一个更新进行）。 */
  const state = {
    current: null, // 本机已安装版本
    latest: null, // npm 最新版本
    hasUpdate: false,
    checking: false,
    updating: false,
    lastCheckAt: null,
    lastCheckError: null,
    updateResult: null, // { ok, message, output }
  }
  let busy = Promise.resolve()

  /** 读本机版本：dsh --version（走 hermes 全局 dsh 命令）。 */
  async function readLocalVersion() {
    try {
      const { stdout } = await execFileAsync('dsh', ['--version'], {
        timeout: CHECK_TIMEOUT_MS,
        windowsHide: true,
        shell: process.platform === 'win32', // Windows 上 dsh 是 .cmd shim，需经 cmd.exe 解析
      })
      const v = String(stdout || '').trim().split(/\r?\n/)[0].trim()
      return v || null
    } catch {
      return null
    }
  }

  /** 查 npm registry 最新版本。 */
  async function readLatestVersion() {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)
    try {
      const res = await fetch(REGISTRY_URL, { signal: controller.signal })
      if (!res.ok) throw new Error(`registry responded ${res.status}`)
      const data = await res.json()
      if (!data || typeof data.version !== 'string') throw new Error('registry payload missing version')
      return data.version
    } finally {
      clearTimeout(timer)
    }
  }

  async function doCheck() {
    const [current, latest] = await Promise.all([readLocalVersion(), readLatestVersion()])
    state.current = current
    state.latest = latest
    state.hasUpdate = current !== null && latest !== null && compareSemver(latest, current) > 0
    state.lastCheckAt = Date.now()
    state.lastCheckError = null
  }

  async function doUpdate() {
    const { stdout, stderr } = await execFileAsync(
      'npm',
      ['install', '-g', `${PKG}@latest`],
      {
        timeout: UPDATE_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: MAX_OUTPUT_BYTES,
        shell: process.platform === 'win32', // Windows 上 npm 是 .cmd shim，需经 cmd.exe 解析
        env: { ...process.env, npm_config_update_notifier: 'false' },
      }
    )
    // 升级成功后磁盘上的版本已变化，但运行中的进程仍是旧代码
    const fresh = await readLocalVersion()
    state.current = fresh ?? state.current
    state.hasUpdate = false
    return {
      ok: true,
      installed: fresh ?? state.current,
      output: String(stdout || '').trim() + (stderr ? '\n' + String(stderr).trim() : ''),
    }
  }

  function snapshot() {
    return {
      ok: true,
      current: state.current,
      latest: state.latest,
      hasUpdate: state.hasUpdate,
      checking: state.checking,
      updating: state.updating,
      lastCheckAt: state.lastCheckAt,
      lastCheckError: state.lastCheckError,
      updateResult: state.updateResult,
    }
  }

  ctx.webServer.register({
    kind: 'exact',
    path: API_STATUS,
    handler: (req, res) => {
      if (req.method !== 'GET') {
        json(res, 405, { ok: false, error: 'method-not-allowed' })
        return Promise.resolve()
      }
      json(res, 200, snapshot())
      return Promise.resolve()
    },
  })

  ctx.webServer.register({
    kind: 'exact',
    path: API_CHECK,
    handler: (req, res) => {
      if (req.method !== 'POST') {
        json(res, 405, { ok: false, error: 'method-not-allowed' })
        return Promise.resolve()
      }
      if (state.checking || state.updating) {
        json(res, 409, { ok: false, error: 'busy' })
        return Promise.resolve()
      }
      state.checking = true
      const task = busy.then(async () => {
        try {
          await doCheck()
        } catch (error) {
          state.lastCheckError = error instanceof Error ? error.message : String(error)
        } finally {
          state.checking = false
        }
      })
      busy = task.catch(() => {})
      return task.then(
        () => json(res, 200, snapshot()),
        () => json(res, 200, snapshot())
      )
    },
  })

  ctx.webServer.register({
    kind: 'exact',
    path: API_UPDATE,
    handler: (req, res) => {
      if (req.method !== 'POST') {
        json(res, 405, { ok: false, error: 'method-not-allowed' })
        return Promise.resolve()
      }
      if (state.checking || state.updating) {
        json(res, 409, { ok: false, error: 'busy' })
        return Promise.resolve()
      }
      state.updating = true
      state.updateResult = null
      const task = busy.then(async () => {
        try {
          const result = await doUpdate()
          state.updateResult = { ok: true, message: `已升级到 ${result.installed}`, output: result.output }
        } catch (error) {
          state.updateResult = {
            ok: false,
            message: error instanceof Error ? error.message : String(error),
            output: '',
          }
        } finally {
          state.updating = false
        }
      })
      busy = task.catch(() => {})
      return task.then(
        () => json(res, 200, snapshot()),
        () => json(res, 200, snapshot())
      )
    },
  })

  // 启动时静默查一次版本（失败不打扰，界面可手动重查）
  state.checking = true
  const boot = busy.then(async () => {
    try {
      await doCheck()
    } catch {
      // 启动检查失败可忽略：界面上"检查更新"按钮可手动重试
    } finally {
      state.checking = false
    }
  })
  busy = boot.catch(() => {})
}
