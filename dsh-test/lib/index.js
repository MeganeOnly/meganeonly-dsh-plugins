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

export function apply(ctx) {
  ctx.webServer.register({
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