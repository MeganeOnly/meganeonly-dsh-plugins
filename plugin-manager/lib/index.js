/**
 * dsh-plugin-manager — Host 半端
 *
 * 提供三个 HTTP 路由（webServer 服务，与社区插件同款模式）：
 *   GET  /api/plugin-manager/list         列出 loader 全部非组条目（含作者署名）
 *   POST /api/plugin-manager/set-enabled  写入 web profile 的 cordis.patch.yml 启停覆盖
 *
 * 作者署名：从 profile node_modules 下各包 package.json 的 author 字段读取
 * （file: 依赖与源码同 inode 硬链接，改源码即同步）。
 *
 * 启停实现：在 profile 的 cordis.patch.yml 中维护 id 定向覆盖
 *   - 停用：追加/写入 `- id: <x>` + `disabled: true`
 *   - 启用：删除对应条目中的 disabled（纯覆盖条目整体移除）
 * 使用 yaml 的 parseDocument 保留原文件注释；临时文件 + rename 原子写。
 */
import { readFile, writeFile, rename } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { parseDocument } from 'yaml'

export const name = 'plugin-manager'

export const inject = ['loader', 'webServer']

const API_PREFIX = '/api/plugin-manager'
const PATCH_FILENAME = 'cordis.patch.yml'

/** 判定是否系统内部插件（@deepseek-ai 官方包，不在管理器里启停，避免破坏基础能力）。 */
function isSystem(entryName) {
  return typeof entryName === 'string' && entryName.startsWith('@deepseek-ai/')
}

/** 读取包 package.json 的 author 字段（file: 硬链接与源码同步；失败返回 undefined）。 */
async function readAuthor(ctx, entryName) {
  if (typeof entryName !== 'string' || entryName === '' || entryName.startsWith('@')) return undefined
  try {
    const pkgPath = join(profileRoot(ctx), 'node_modules', entryName, 'package.json')
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
    if (typeof pkg.author === 'string') return pkg.author
    if (pkg.author && typeof pkg.author.name === 'string') return pkg.author.name
    return undefined
  } catch {
    return undefined
  }
}

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

/** 读 loader 的当前非组条目，返回展示/启停用的精简行（含作者）。可启停的（非系统）排前面，系统插件沉底。 */
async function listEntries(ctx) {
  const loader = ctx.loader
  const entries = []
  for (const entry of loader.entries()) {
    if (entry.options.group) continue
    const name = entry.options.name
    entries.push({
      id: entry.options.id,
      name,
      author: await readAuthor(ctx, name),
      enabled: !entry.disabled,
      phase: entry.fiber === void 0 ? null : String(entry.fiber.state),
      system: isSystem(name),
    })
  }
  entries.sort((a, b) => {
    if (a.system !== b.system) return a.system ? 1 : -1 // 非系统在上，系统在下
    return String(a.id).localeCompare(String(b.id))
  })
  return entries
}

/** 在 patch 文档的顶层序列中查找 id 匹配的映射条目。 */
function findEntryItem(seq, id) {
  if (!seq || !Array.isArray(seq.items)) return undefined
  return seq.items.find((it) => it !== null && typeof it === 'object' && typeof it.get === 'function' && it.get('id') === id)
}

/** 写入启停覆盖；返回新状态。 */
async function setEnabled(ctx, targetId, enabled) {
  if (typeof targetId !== 'string' || targetId.trim() === '') throw new Error('invalid-id')

  // 系统插件拒改
  const row = (await listEntries(ctx)).find((e) => e.id === targetId)
  if (row !== undefined && row.system) throw new Error(`system-plugin: ${targetId} 属于系统内部插件，请在插件管理器之外处理`)
  if (row !== undefined && row.enabled === enabled) return { ok: true, id: targetId, enabled, unchanged: true }

  const path = patchPathOf(ctx)
  const text = await readFile(path, 'utf8')
  const doc = parseDocument(text)
  if (doc.contents === null || !Array.isArray(doc.contents.items)) {
    doc.contents = doc.createNode([])
  }
  const seq = doc.contents
  const item = findEntryItem(seq, targetId)

  if (enabled) {
    if (item !== undefined && item.get('disabled') === true) {
      if (item.items.length === 2 && item.has('id') && item.has('disabled')) {
        seq.items.splice(seq.items.indexOf(item), 1) // 纯覆盖条目 → 移除
      } else {
        item.delete('disabled')
      }
    }
  } else if (item === undefined) {
    seq.items.push(doc.createNode({ id: targetId, disabled: true }))
  } else if (item.get('disabled') !== true) {
    item.set('disabled', true)
  }

  const out = doc.toString()
  const tmp = `${path}.tmp`
  await writeFile(tmp, out, 'utf8')
  await rename(tmp, path)
  return { ok: true, id: targetId, enabled, unchanged: false }
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
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 64 * 1024) {
        reject(new Error('body-too-large'))
        queueMicrotask(() => req.destroy())
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('invalid-json'))
      }
    })
    req.on('error', reject)
  })
}

export function apply(ctx) {
  const routes = [
    {
      kind: 'exact',
      path: `${API_PREFIX}/list`,
      handler: (req, res) => {
        if (!requireMethod(req, res, 'GET')) return Promise.resolve()
        return listEntries(ctx).then(
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
  }, 'plugin-manager: routes')
}
