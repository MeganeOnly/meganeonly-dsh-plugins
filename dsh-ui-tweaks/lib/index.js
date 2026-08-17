/**
 * dsh-ui-tweaks — Host 半端（Cordis 插件，作者：MeganeOnly）
 *
 * v0.3.0 起：退化为零副作用 placeholder。
 *
 * tweak 状态由 client half 用浏览器 localStorage 自管（lib/client.js），
 * 不再走 DSH settings namespace。根因：DSH API gateway
 * (`@deepseek-ai/dsh-host-apiproxy`) 的 `exposedNamespaces()` 硬编码
 * 白名单只覆盖 DSH 内置的 8 个 namespace，所有第三方 host-plane 插件的
 * settings.describe 响应都被 silent filter，client 端 settingsScope
 * 永远 status="unavailable"。详见 DECISIONS.md C003。
 *
 * 保留此文件 + cordis.patch.yml 的 `- id: ui-tweaks, name: dsh-ui-tweaks`
 * 是为了维持 loader 注册行有效（loader 需要 import 一个 host half 模块；
 * bundle patch 里 `name` 字段指向这里）。彻底删除会让 loader 找不到
 * module 而失败。apply 内部空操作即可——cordis 把 host fiber 当
 * zero-side-effect 占位即可。
 *
 * 不再 import `@deepseek-ai/dsh-settings` / `schemastery`，package.json
 * 已移除对应 peerDependencies 与 dependencies。
 */

export const name = "dsh-ui-tweaks";
export const inject = [];

export function apply() {
  // no-op: tweak 状态在浏览器侧用 localStorage 自管
}