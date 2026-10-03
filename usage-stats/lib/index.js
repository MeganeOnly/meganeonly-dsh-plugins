/**
 * dsh-usage-stats — Host 半端入口（v0.5.0，作者：MeganeOnly）
 *
 * 使用统计：跨会话汇总 token 用量。集成方式（v0.5.0 起）：
 *
 *   发现 discover.js ── readdir 选世代（框架 listGenerations 优先，自走查兜底）
 *   折叠 fold.js    ── 逐事件折叠，带 seq 水位（幂等、可续跑）
 *   读取 frames.js  ── 追加式多帧 zstd：只从上次字节偏移起读、只解新帧
 *   存储 store.js   ── 每会话一条记录（水位 + 锚 + 聚合），原子写 + 去抖
 *   调度 scan.js    ── 单飞、优先级、时间片让出、失败记忆、删除清理
 *   归并 rollup.js  ── 子代理沿 parentSession 归并到 root main session
 *   视图 series.js  ── 日/时/分/周序列、按模型表、会话榜、工具榜
 *   装配 payload.js ── 按"记录代次"memo，请求直接取已发布快照
 *
 * 对外 API：GET /api/usage-stats/summary
 *   ?force=1    绕过节流立即重新比对修订（不做全量重建）
 *   ?rebuild=1  旧存储整体改名后从零重建
 *   ?diag=1     附带诊断块（存储/扫描/折叠表/失败记忆/zstd 能力）
 *
 * 与 v0.4.x 的关键差异（详见 CHANGELOG 与 docs/architecture.md）：
 *   - 失效键从 `header.createdAt`（永不变化，导致活跃会话被永久冻结）改为
 *     文件修订令牌 `dev:ino:size:mtimeNs:ctimeNs` + 世代号 → 追加即可见
 *   - 读取从"整文件重解码"改为"只读新增字节、只解新增帧"（水位 + 前缀锚）
 *   - 存储从单个 4 MB JSON 改为每会话一条记录（写入 O(1)、无整份重写）
 *   - 分钟/小时桶按 48h / 15d 裁剪，桶表不再无界增长
 *   - 请求不再触发重算：扫描在后台单飞，响应始终返回"已发布快照"
 *   - 启动期不做框架异步调用（规避 v0.4.5 记录的"apply 内 rejection 被归因到插件 fiber
 *     → 路由整体消失"），首次扫描由首个 HTTP 请求触发
 *
 * 兼容导出：aggregateSession / beijingDayKey / withSessionHeaderEvent /
 * granularitySeries / rootsDaysAll / scanZstdFrames —— 老测试与外部调用方继续可用。
 */

import { fileURLToPath } from 'node:url'

import { API_SUMMARY } from './constants.js'
import { createStore, readLegacyRecords } from './store.js'
import { createScanner } from './scan.js'
import { createLiveFolder } from './live.js'
import { createPayloadBuilder } from './payload.js'
import { json, registerRoute } from './http.js'

// 兼容导出（v0.4.x 公开签名不变，实现已搬到各模块）
export { aggregateSession, beijingDayKey, withSessionHeaderEvent, toFiniteNumber } from './fold.js'
export { granularitySeries, rootsDaysAll } from './series.js'
export { buildRoots } from './rollup.js'
export { scanZstdFrames, zstdAvailable } from './frames.js'
export { createLiveFolder } from './live.js'

export const name = 'usage-stats'

// v0.5.0：只硬依赖 webServer。sessionPersistence / sessionQuery / storageDomain 等
// 一律 ctx.get() 可选获取 —— 框架服务缺失时功能降级而不是启动失败。
export const inject = ['webServer']

/** 解析 profile 根目录（loader 的 baseUrl 即 profile 目录）。 */
function profileRootOf(ctx) {
  const base = ctx.baseUrl
  if (typeof base === 'string' && base.startsWith('file://')) return fileURLToPath(base)
  if (typeof base === 'string' && base.length > 0) return base
  return process.cwd()
}

/** 可选服务获取：cordis 的 ctx.get 在服务缺席/未就绪时返回 undefined。 */
function optional(ctx, name) {
  try {
    return typeof ctx.get === 'function' ? ctx.get(name) : undefined
  } catch {
    return undefined
  }
}

export function apply(ctx) {
  const profileRoot = profileRootOf(ctx)
  const logger = {
    warn(message) {
      if (ctx.logger !== undefined && typeof ctx.logger.warn === 'function') ctx.logger.warn(message)
      else console.warn(`[usage-stats] ${message}`)
    },
  }

  const store = createStore(profileRoot, {
    timers: {
      set: typeof ctx.setTimeout === 'function' ? (fn, ms) => ctx.setTimeout(fn, ms) : setTimeout,
      clear: typeof ctx.clearTimeout === 'function' ? (id) => ctx.clearTimeout(id) : clearTimeout,
    },
    onWarn: logger.warn,
  })

  // 启动期只做纯 fs 工作：加载记录 + 预播种旧缓存（首屏先显示旧数据）。
  const ready = store.load()
    .then(async () => {
      if (store.records.size > 0) return
      if (!(await store.hasLegacy())) return
      const legacy = await readLegacyRecords(profileRoot)
      if (legacy == null) return
      for (const [key, record] of legacy) store.seed(record)
    })
    .catch((error) => {
      logger.warn(`存储加载失败：${String(error && error.message)}`)
    })

  let scanner = null
  const live = createLiveFolder({
    onChanged: () => builder.invalidate(),
    // 条目创建时用磁盘记录立刻播种（否则"插件中途启动 + 扫描已跑过"的组合下
    // 实时支路永远无法启用：磁盘水位已经领先，而条目又没有可回放的缓冲）
    getRecord: (id) => store.get(id),
  })
  const builder = createPayloadBuilder({ store, getScanner: () => scanner, getLive: () => live })
  scanner = createScanner({
    store,
    sessionPersistence: optional(ctx, 'sessionPersistence'),
    sessionQuery: optional(ctx, 'sessionQuery'),
    onRecordsChanged: () => builder.invalidate(),
    onRecordFolded: (record) => {
      // 扫描器的磁盘真相 → 给实时条目重新播种（保留尚未 flush 的实时事件）
      if (live.seedFrom(record)) builder.invalidate()
    },
    logger,
  })

  // 实时支路：直接订阅框架的提交事件流（投影注册表用的是同一个 seam），
  // 用与磁盘折叠同一套 fold.js 内核逐事件折叠 —— 于是"我现在这个会话用了多少"
  // 不必等 flush、也不必等下一次扫描。事件流不可用时静默跳过（功能降级为纯磁盘）。
  if (typeof ctx.on === 'function') {
    try {
      ctx.on('session/event', (session, event) => {
        if (live.handleEvent(session, event)) builder.invalidate()
      })
    } catch (error) {
      logger.warn(`实时事件订阅失败（降级为纯磁盘统计）：${String(error && error.message)}`)
    }
  }

  registerRoute(ctx, {
    kind: 'exact',
    path: API_SUMMARY,
    handler: (req, res) => {
      if (req.method !== 'GET') {
        json(res, 405, { ok: false, error: 'method-not-allowed' })
        return Promise.resolve()
      }
      let params
      try {
        params = new URL(req.url, 'http://localhost').searchParams
      } catch {
        params = new URLSearchParams()
      }
      const force = params.get('force') === '1'
      const rebuild = params.get('rebuild') === '1'
      const diag = params.get('diag') === '1'

      return ready
        .then(() => {
          // 触发（不一定等待）扫描：响应立即返回已发布快照，扫描在后台推进。
          // 首次安装 / rebuild 时首屏因此是"旧缓存或空 + scanning:true + 进度"，
          // 由客户端轮询补齐 —— 而不是让请求挂 30 秒甚至 10 分钟。
          try {
            scanner.ensure({ force: force || rebuild, rebuild })
          } catch (error) {
            logger.warn(`触发扫描失败：${String(error && error.message)}`)
          }
          json(res, 200, builder.build({ diag }))
        })
        .catch((error) => {
          json(res, 200, builder.build({ diag, error: String(error && error.message ? error.message : error) }))
        })
    },
  })
}
