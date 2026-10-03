/**
 * dsh-usage-stats — HTTP 边界（v0.5.0）
 *
 * 从 lib/index.js 搬出来的两段防御逻辑，语义零变化：
 *   1) json()：客户端可能在响应前断开（刷新页面 / 代理超时），往已销毁 socket 写会触发
 *      无监听的 error 事件，cordis 会把它算到本插件 fiber 头上 —— 插件被整体卸载、
 *      路由消失、只能重启恢复。写前检查 + 挂空 error 监听 + try/catch，断开视为"响应作废"。
 *   2) registerRoute()：DSH 的 webServer 对重复 (kind, path) 直接 throw，一次冲突会把
 *      本次启动打崩；路径已被占用时告警并跳过，而不是让注册抛出去。
 */

/** 写 JSON 响应；对断连/已结束的 socket 静默放弃（不是故障）。 */
export function json(res, status, body) {
  if (res.writableEnded || res.socket?.destroyed) return
  if (typeof res.on === 'function') res.on('error', () => {})
  try {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(body))
  } catch {
    // socket 在 writeHead / end 之间销毁：同上，静默放弃这次响应
  }
}

/**
 * 注册 HTTP 路由；路径已被其他插件占用时跳过并告警。
 * 守卫不可用时（表结构缺失）退回直接注册：宁可重复报错，也不要静默不注册。
 */
export function registerRoute(ctx, route) {
  const table = route.kind === 'exact' ? ctx.webServer.exact : ctx.webServer.prefixes
  if (table !== undefined && table !== null && typeof table.has === 'function' && table.has(route.path)) {
    const message = `usage-stats: 路由 ${route.path} 已被其他插件注册，跳过注册以避免启动失败`
    if (ctx.logger !== undefined && typeof ctx.logger.warn === 'function') ctx.logger.warn(message)
    else console.warn(`[usage-stats] ${message}`)
    return () => {}
  }
  return ctx.webServer.register(route)
}
