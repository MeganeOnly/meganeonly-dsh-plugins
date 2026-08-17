/**
 * dsh-task-pool — Host 半端（Cordis 插件，作者：MeganeOnly）
 *
 * 零副作用占位：所有 UI 与持久化都在浏览器端完成（见 lib/client.js）。
 * 显式不注册 system prompt 段、不注册 HTTP 路由、不注入服务 —— 用户
 * 把"任务池"定位为"本地收集想法的池子"，任何隐式 token 成本都是负担。
 *
 * 若后续需要跨设备同步 / 与 agent 联动，把扩展写在这里：
 *   - ctx.systemPrompt.section({ name, order, text })：让 agent 知道池子
 *   - ctx.webServer.register({ kind, path, handler })：暴露 API
 *   - ctx.inject([...])：依赖注入
 *
 * 目前 apply 为空函数即可。
 */

export const name = "dsh-task-pool";
export const inject = [];

export function apply() {
  // intentionally empty
}