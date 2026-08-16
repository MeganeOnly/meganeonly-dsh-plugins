/**
 * dsh-mcp-manager — Host 半端
 *
 * 提供两个 HTTP 路由（webServer 服务，与 plugin-manager / skill-manager 同款模式）：
 *   GET  /api/mcp-manager/list         列出全部 MCP 服务器（连接状态 + 工具清单）
 *   POST /api/mcp-manager/set-enabled  写入 cordis.patch.yml 的 id 定向启停覆盖
 *
 * MCP 在 DSH 里的形态（实测确认）：每个 MCP 服务器是 loader 名册里的一个条目，
 *   - id:   mcp-<x>（用户自定）
 *   - name: '@deepseek-ai/dsh-mcp-client'（官方 MCP 桥接插件）
 *   - config: { serverName, transport: 'stdio'|'streamable-http', ... }
 * 桥接插件把远端工具注册到 ctx.tools，公开名固定为 mcp__<serverName>__<rawName>。
 *
 * 展示数据来源：
 *   - 条目/启停状态：ctx.loader.entries()（entry.options / entry.disabled / entry.fiber）；
 *   - 连接状态：entry.fiber.state（数字枚举 0-5，见 FIBER_LABELS）；
 *   - 工具清单：ctx.tools.schemas() 里按 mcp__<serverName>__ 前缀过滤——
 *     有工具 = 连接成功且已完成同步；无工具多半是连接中或失败。
 *   - 端点/凭据：来自条目 config；Authorization 等 header 值与 env 值一律
 *     打码后再发给浏览器（token 不出宿主进程）。
 *
 * 启停实现：与 plugin-manager 相同的 cordis.patch.yml id 定向覆盖
 * （yaml 的 parseDocument 保留注释，临时文件 + rename 原子写）。patch 语义
 * 实测确认：同一文件里后出现的 `- id: X` + `disabled: true` 可以覆盖先由
 * `- insert:` 插入的同 id 条目；启用时同时处理两种写法（顶层覆盖条目、
 * insert 内层自带的 disabled）。写入后需重启 DSH 才生效（loader 组合在
 * 启动时读取）。
 */
import { readFile, writeFile, rename } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { parseDocument } from 'yaml'

export const name = 'mcp-manager'

export const inject = ['loader', 'webServer', 'tools']

const API_PREFIX = '/api/mcp-manager'
const PATCH_FILENAME = 'cordis.patch.yml'
const MCP_CLIENT_PACKAGE = '@deepseek-ai/dsh-mcp-client'

/** cordis fiber.state 数字枚举 → 中文标签（0-5 依次对应下列状态）。 */
const FIBER_LABELS = ['等待依赖', '加载中', '运行中', '加载失败', '已卸载', '卸载中']

/** 描述超过此长度截断，避免几十个工具的描述撑爆 /list 响应。 */
const MAX_TOOL_DESCRIPTION = 200

// ---------------------------------------------------------------------------
// 展示数据组装
// ---------------------------------------------------------------------------

function fiberLabel(entry) {
  if (entry.fiber === undefined || entry.fiber === null) return undefined
  const state = entry.fiber.state
  const label = FIBER_LABELS[state]
  return label === undefined ? String(state) : label
}

/**
 * 连接状态推导：
 *   disabled      已停用（条目被 disabled 覆盖）
 *   failed        fiber 加载失败（配置错误 / serverName 重复等）
 *   stopped       条目启用但 fiber 不存在（尚未启动或已卸载）
 *   connected     已注册出至少一个 mcp__<serverName>__ 工具 = 连接且同步成功
 *   no-tools      fiber 运行中但零工具（连上了但服务器没工具，或同步失败）
 *   connecting    其余（等待依赖 / 加载中 / 卸载中）
 */
function statusOf(entry, toolCount) {
  if (entry.disabled) return 'disabled'
  if (entry.fiber === undefined || entry.fiber === null) return 'stopped'
  if (entry.fiber.state === 3) return 'failed'
  if (toolCount > 0) return 'connected'
  if (entry.fiber.state === 2) return 'no-tools'
  return 'connecting'
}

/** 凭据打码：只保留 header / env 的键名，值一律以键名 + •• 长度提示代替。 */
function maskedAuthOf(config) {
  const bits = []
  const headers = config?.headers
  if (typeof headers === 'object' && headers !== null) {
    for (const key of Object.keys(headers)) {
      const value = String(headers[key] ?? '')
      const shape = value.startsWith('Bearer ') ? 'Bearer' : `${value.length} 字符`
      bits.push(`${key}: ${shape} ••••（已隐藏）`)
    }
  }
  const env = config?.env
  if (typeof env === 'object' && env !== null) {
    for (const key of Object.keys(env)) bits.push(`env ${key}: ••••（已隐藏）`)
  }
  return bits
}

/** 端点摘要：streamable-http 显示 url，stdio 显示 command + args。 */
function endpointOf(config) {
  if (config?.transport === 'stdio') {
    const parts = [config.command, ...(Array.isArray(config.args) ? config.args : [])]
    return parts.filter((it) => typeof it === 'string' && it !== '').join(' ')
  }
  if (typeof config?.url === 'string') return config.url
  return ''
}

/** 读 tools 注册表快照（服务异常时返回空数组，列表页仍可用）。 */
function toolSchemas(ctx) {
  try {
    const schemas = ctx.tools.schemas()
    return Array.isArray(schemas) ? schemas : []
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// cordis.patch.yml 读取与启停覆盖
// ---------------------------------------------------------------------------

/** 解析 profile 根目录（loader 的 baseUrl 即 profile 目录）。 */
function profileRoot(ctx) {
  const base = ctx.baseUrl
  if (typeof base === 'string' && base.startsWith('file://')) return fileURLToPath(base)
  if (typeof base === 'string' && base.length > 0) return base
  return process.cwd()
}

function patchPathOf(ctx) {
  return join(profileRoot(ctx), PATCH_FILENAME)
}

const isMap = (it) => it !== null && typeof it === 'object' && typeof it.get === 'function'

/** 顶层序列中查找 id 定向覆盖条目（形如 `- id: X` + 覆盖字段的 map；insert 包装项无 id 键不会命中）。 */
function findOverrideItem(seq, id) {
  if (!seq || !Array.isArray(seq.items)) return undefined
  return seq.items.find((it) => isMap(it) && it.get('id') === id)
}

/** 查找 `- insert:` 包装项里内层同 id 的条目（MCP 服务器本体就住在里面）。 */
function findInsertInnerItem(seq, id) {
  if (!seq || !Array.isArray(seq.items)) return undefined
  for (const it of seq.items) {
    if (!isMap(it)) continue
    const inserted = it.get('insert')
    if (inserted === null || inserted === undefined || !Array.isArray(inserted.items)) continue
    const inner = inserted.items.find((innerIt) => isMap(innerIt) && innerIt.get('id') === id)
    if (inner !== undefined) return inner
  }
  return undefined
}

/**
 * patch 文件里的停用覆盖状态（读取方）。启停真源是 patch 而非 loader 实时状态：
 * 停用覆盖要重启 DSH 才作用到 loader，“重启前撤回”必须看文件。
 */
async function patchDisabledIds(ctx) {
  let doc
  try {
    doc = parseDocument(await readFile(patchPathOf(ctx), 'utf8'))
  } catch {
    return new Set()
  }
  const seq = doc.contents
  if (!seq || !Array.isArray(seq.items)) return new Set()
  const ids = new Set()
  // 逐条收集：顶层覆盖条目与 insert 内层条目里 disabled: true 的 id
  for (const it of seq.items) {
    if (isMap(it) && it.get('id') !== undefined && it.get('disabled') === true) ids.add(it.get('id'))
    if (!isMap(it)) continue
    const inserted = it.get('insert')
    if (inserted === null || inserted === undefined || !Array.isArray(inserted.items)) continue
    for (const innerIt of inserted.items) {
      if (isMap(innerIt) && innerIt.get('id') !== undefined && innerIt.get('disabled') === true) ids.add(innerIt.get('id'))
    }
  }
  return ids
}

async function listServers(ctx) {
  const schemas = toolSchemas(ctx)
  const patchDisabled = await patchDisabledIds(ctx)
  const rows = []
  for (const entry of ctx.loader.entries()) {
    if (entry.options.group) continue
    if (entry.options.name !== MCP_CLIENT_PACKAGE) continue
    const config = entry.options.config ?? {}
    const serverName = typeof config.serverName === 'string' && config.serverName !== ''
      ? config.serverName
      : entry.options.id
    const prefix = `mcp__${serverName}__`
    const tools = schemas
      .filter((schema) => typeof schema?.name === 'string' && schema.name.startsWith(prefix))
      .map((schema) => ({
        name: schema.name,
        description: typeof schema.description === 'string' && schema.description.length > MAX_TOOL_DESCRIPTION
          ? `${schema.description.slice(0, MAX_TOOL_DESCRIPTION)}…`
          : String(schema.description ?? ''),
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    // enabled 以 patch 覆盖优先（重启前也反映用户刚点的开关）；无覆盖时看 loader 实时状态
    const disabledInPatch = patchDisabled.has(entry.options.id)
    const enabled = !disabledInPatch && !entry.disabled
    rows.push({
      id: entry.options.id,
      serverName,
      transport: config.transport === 'stdio' ? 'stdio' : 'streamable-http',
      endpoint: endpointOf(config),
      auth: maskedAuthOf(config),
      enabled,
      // 覆盖已写入但 loader 尚未重启（或反之）→ 提示待重启
      pendingRestart: disabledInPatch !== entry.disabled,
      phase: fiberLabel(entry),
      status: statusOf(entry, tools.length),
      toolCount: tools.length,
      tools,
    })
  }
  rows.sort((a, b) => String(a.serverName).localeCompare(String(b.serverName)) || String(a.id).localeCompare(String(b.id)))
  return rows
}

/** 写入启停覆盖；返回新状态。写入的覆盖需重启 DSH 生效。 */
async function setEnabled(ctx, targetId, enabled) {
  if (typeof targetId !== 'string' || targetId.trim() === '') throw new Error('invalid-id')

  const entry = [...ctx.loader.entries()].find((it) => it.options.id === targetId)
  if (entry === undefined) throw new Error(`unknown-mcp: ${targetId} 不在插件名册中`)
  if (entry.options.name !== MCP_CLIENT_PACKAGE) throw new Error(`not-mcp: ${targetId} 不是 MCP 服务器条目`)

  const path = patchPathOf(ctx)
  const text = await readFile(path, 'utf8')
  const doc = parseDocument(text)
  if (doc.contents === null || !Array.isArray(doc.contents.items)) {
    doc.contents = doc.createNode([])
  }
  const seq = doc.contents
  const override = findOverrideItem(seq, targetId)
  const inner = findInsertInnerItem(seq, targetId)
  const overrideDisabled = override !== undefined && override.get('disabled') === true
  const innerDisabled = inner !== undefined && inner.get('disabled') === true
  const disabledInPatch = overrideDisabled || innerDisabled
  let changed = false

  if (enabled) {
    if (!disabledInPatch) return { ok: true, id: targetId, enabled, unchanged: true }
    // 启用：优先移除顶层纯覆盖条目；否则删覆盖里的 disabled 键；再清 insert 内层自带的 disabled
    if (overrideDisabled) {
      if (override.items.length === 2 && override.has('id') && override.has('disabled')) {
        seq.items.splice(seq.items.indexOf(override), 1) // 纯覆盖条目 → 整体移除
      } else {
        override.delete('disabled')
      }
      changed = true
    }
    if (innerDisabled) {
      inner.delete('disabled')
      changed = true
    }
    if (!changed) {
      throw new Error(`unmanaged-disable: ${targetId} 处于停用，但 cordis.patch.yml 中找不到本管理器可清除的 disabled 覆盖（可能是分组停用或 !!js 表达式），请手动检查`)
    }
  } else {
    // 停用：append 顶层 id 定向覆盖（patch 按序应用，可覆盖早前 insert 的同 id 条目）
    if (disabledInPatch) return { ok: true, id: targetId, enabled, unchanged: true }
    if (override === undefined) {
      seq.items.push(doc.createNode({ id: targetId, disabled: true }))
    } else {
      override.set('disabled', true)
    }
    changed = true
  }

  const out = doc.toString()
  const tmp = `${path}.tmp`
  await writeFile(tmp, out, 'utf8')
  await rename(tmp, path)
  return { ok: true, id: targetId, enabled, unchanged: false, restartRequired: true }
}

// ---------------------------------------------------------------------------
// HTTP 路由
// ---------------------------------------------------------------------------

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

export function apply(ctx) {
  const routes = [
    {
      kind: 'exact',
      path: `${API_PREFIX}/list`,
      handler: (req, res) => {
        if (!requireMethod(req, res, 'GET')) return Promise.resolve()
        return listServers(ctx).then(
          (entries) => json(res, 200, { ok: true, entries }),
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
          (body) => setEnabled(ctx, body.id, body.enabled === true).then(
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
  }, 'mcp-manager: routes')
}
