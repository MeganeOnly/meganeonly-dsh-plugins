/**
 * dsh-test — Host 半端
 *
 * 最小的持久插件骨架：仅注册一个 GET /api/test/hello 端点，
 * 返回当前时间戳与加载信息，用于验证 DSH 插件管道（host 半端
 * 注册 + 客户端 bundle 加载 + cordis 名册注入）完整联通。
 *
 * 设计目标：
 * - 零依赖（仅 Node 内置）
 * - 注册一次、不留全局状态
 * - 仅做 GET，便于手测与 curl 验证
 */

export const name = 'dsh-test'

export const inject = ['webServer']

const API_HELLO = '/api/test/hello'

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

/**
 * 注册 HTTP 路由；路径已被其他插件占用时跳过并告警。
 *
 * DSH 的 webServer 对重复 (kind, path) 直接 throw —— 一旦发生会把本次启动打崩，
 * 因此所有路由统一走这里，而不是直接调 ctx.webServer.register。
 * 守卫不可用时（表结构缺失）退回直接注册：宁可重复报错，也不要静默不注册。
 */
function registerRoute(ctx, route) {
  const table = route.kind === 'exact' ? ctx.webServer.exact : ctx.webServer.prefixes
  if (table !== undefined && table !== null && typeof table.has === 'function' && table.has(route.path)) {
    const message = `dsh-test: 路由 ${route.path} 已被其他插件注册，跳过注册以避免启动失败`
    if (ctx.logger !== undefined && typeof ctx.logger.warn === 'function') ctx.logger.warn(message)
    else console.warn(`[dsh-test] ${message}`)
    return () => {}
  }
  return ctx.webServer.register(route)
}

export function apply(ctx) {
  registerRoute(ctx, {
    kind: 'exact',
    path: API_HELLO,
    handler: (req, res) => {
      if (req.method !== 'GET') {
        json(res, 405, { ok: false, error: 'method-not-allowed' })
        return Promise.resolve()
      }
      return Promise.resolve(
        json(res, 200, {
          ok: true,
          plugin: 'dsh-test',
          version: '0.1.0',
          author: 'MeganeOnly',
          loadedAt: Date.now(),
        })
      )
    },
  })
}