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
 * 使用 yaml 的 parseDocument 保留原文件注释（customTags 注册 `!!js`，见 JS_CUSTOM_TAGS）；
 * 临时文件 + rename 原子写。
 *
 * 路由守卫：注册前检测 ctx.webServer.exact / prefixes，路由已被其他插件占用时
 * 跳过本插件注册（打警告），避免 duplicate exact route 导致 DSH 启动崩溃。
 */
import { readFile, writeFile, rename } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { parseDocument } from 'yaml'

export const name = 'plugin-manager'

export const inject = ['loader', 'webServer']

const API_PREFIX = '/api/plugin-manager'
const PATCH_FILENAME = 'cordis.patch.yml'

/**
 * `!!js` 标签注册表——patch 文件允许 `!!js <JS 表达式>`，值即表达式的源码字符串。
 *
 * yaml 内置 schema 不含 `tag:yaml.org,2002:js`，所以必须显式注册：
 *   - 不注册：每个 `!!js` 节点都会记一条 TAG_RESOLVE_FAILED 警告（Unresolved tag），
 *     节点退回默认 string 标签解析，解析语义与节点类型和内核写入方不一致；
 *   - 注册后：警告归零，标量按 resolve 原样取值，与内核解析结果一致。
 * 实测 yaml 2.9.0 下未注册的标量标签只产生警告、不阻塞 doc.toString()，故这里是
 * 一致性与防御性修复（内核两处写入同一文件时都注册了该标签，两侧需对齐）。
 *
 * 取证来源：DSH 0.2.0-rc.2 内核写入同一份 `cordis.patch.yml` 的两处均传了同样的
 * customTags——`@deepseek-ai/dsh-plugin-manager/lib/types/patch.js:23-25`、
 * `@deepseek-ai/dsh-config-editor/lib/index.js:91-94`。
 */
const JS_CUSTOM_TAGS = [{ tag: 'tag:yaml.org,2002:js', resolve: (v) => v }]

/** 判定是否系统内部插件（@deepseek-ai 官方包，不在管理器里启停，避免破坏基础能力）。 */
function isSystem(entryName) {
  return typeof entryName === 'string' && entryName.startsWith('@deepseek-ai/')
}

/**
 * 判定是否预设组件行：agent 预设组合（如梁神模式）里的相对路径 .mjs 文件行
 * （name 形如 "./tool-bootstrap.mjs"）。它们随当前会话所选预设自动加载/卸载，
 * 不归属 profile 的 cordis.patch.yml，因此不能在这里启停。
 */
function isPresetMjs(entryName) {
  return typeof entryName === 'string' && entryName.startsWith('./') && entryName.endsWith('.mjs')
}

/**
 * [perf] 模块级 mtime 缓存——每次 `/list` 调用会触发 N 个插件的 author 读取，
 * 缓存按 (absPath -> { mtimeMs, author })，mtimeMs 未变时跳过 readFile + JSON.parse。
 * 作者只在 npm install / git pull 时变化（package.json 重写），运行期基本恒定。
 */
const authorCache = new Map() // absPath -> { mtimeMs: number, author: string|undefined }

/**
 * 读取包 package.json 的 author 字段（file: 硬链接/junction 与源码同步；失败返回 undefined）。
 *
 * npm/pnpm 引入后，loader 的 graph row id 与包的 npm name 已不再同名：
 *   - id  = "plugin-manager"          （cordis.patch.yml `- id: <x>`，DSH loader 按它建 junction 在 node_modules/<id>）
 *   - name = "dsh-plugin-manager"     （package.json 的 name，含 dsh- 前缀，pnpm 装出 node_modules/<name>）
 * 历史/并行安装下两份目录都可能存在，因此这里顺次尝试多个候选路径，任一可读就用。
 */
async function readAuthor(ctx, id, name) {
  if (typeof id !== 'string' || id === '') return undefined
  const candidates = []
  const seen = new Set()
  const tryAdd = (p) => { if (!seen.has(p)) { seen.add(p); candidates.push(p) } }
  tryAdd(join(profileRoot(ctx), 'node_modules', id, 'package.json'))
  if (typeof name === 'string' && name !== '' && name !== id) {
    tryAdd(join(profileRoot(ctx), 'node_modules', name, 'package.json'))
  }
  if (!id.startsWith('dsh-')) tryAdd(join(profileRoot(ctx), 'node_modules', 'dsh-' + id, 'package.json'))
  if (typeof name === 'string' && name !== '' && !name.startsWith('dsh-')) {
    tryAdd(join(profileRoot(ctx), 'node_modules', 'dsh-' + name, 'package.json'))
  }
  for (const pkgPath of candidates) {
    let stat
    try {
      stat = await import('node:fs/promises').then(m => m.stat(pkgPath))
    } catch {
      continue
    }
    const mtimeMs = stat.mtimeMs
    const cached = authorCache.get(pkgPath)
    if (cached && cached.mtimeMs === mtimeMs) {
      // 命中：连 stat 也跳过，但 stat 已在上面跑了；下一次走 stat 也接受（依然 O(1) 系统调用）
      return cached.author
    }
    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
      const author = typeof pkg.author === 'string'
        ? pkg.author
        : (pkg.author && typeof pkg.author.name === 'string' ? pkg.author.name : undefined)
      authorCache.set(pkgPath, { mtimeMs, author })
      return author
    } catch {
      // 解析失败：缓存 negative result，避免每次 list 重复尝试
      authorCache.set(pkgPath, { mtimeMs, author: undefined })
      return undefined
    }
  }
  return undefined
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
      author: await readAuthor(ctx, entry.options.id, name),
      enabled: !entry.disabled,
      phase: entry.fiber === void 0 ? null : String(entry.fiber.state),
      system: isSystem(name),
      presetMjs: isPresetMjs(name),
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

  // [perf] 直接 iterate loader entries 取校验字段，避免 listEntries() 重读所有 author。
  const loader = ctx.loader
  let target = null
  for (const entry of loader.entries()) {
    if (entry.options.id === targetId) { target = entry; break }
  }
  if (target === null) {
    // 不在 loader 名册中：保持旧语义（unchanged）——上层处理 404 由 list 路径负责
    return { ok: true, id: targetId, enabled, unchanged: true }
  }
  const tName = target.options.name
  // 系统插件拒改
  if (isSystem(tName)) throw new Error(`system-plugin: ${targetId} 属于系统内部插件，请在插件管理器之外处理`)
  // 预设组件拒改：行来自 agent 预设组合（name 为 ./.mjs 相对路径），id 定向覆盖写进
  // cordis.patch.yml 也够不到它们，直接拒绝以免误导（提示重启其实不生效）。
  if (isPresetMjs(tName)) throw new Error(`preset-mjs: ${targetId} 是预设组件（.mjs），随当前会话预设自动加载，不能在这里启停`)
  if (target.disabled === !enabled) return { ok: true, id: targetId, enabled, unchanged: true }

  const path = patchPathOf(ctx)
  const text = await readFile(path, 'utf8')
  // customTags：注册 `!!js`，与内核写入方解析同一种 patch 文件（见 JS_CUSTOM_TAGS）
  const doc = parseDocument(text, { customTags: JS_CUSTOM_TAGS })
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
    const disposers = []
    for (const route of routes) {
      const table = route.kind === 'exact' ? ctx.webServer.exact : ctx.webServer.prefixes
      // 路由被其他插件（如 @linxin666/dsh-client-ui-plugin-manager）先占用时：
      // 跳过本插件注册，避免 duplicate exact route 导致 DSH 启动崩溃
      if (table.has(route.path)) {
        ctx.logger.warn(`plugin-manager: 路由 ${route.path} 已被其他插件注册，跳过本插件注册，避免 duplicate route 启动崩溃`)
        continue
      }
      disposers.push(ctx.webServer.register(route))
    }
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'plugin-manager: routes')
}
