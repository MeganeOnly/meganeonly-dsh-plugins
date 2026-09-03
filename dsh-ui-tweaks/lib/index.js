/**
 * dsh-ui-tweaks — Host 半端（占位）。
 *
 * v0.3.0 起：tweak 状态由 client half 用浏览器 localStorage 自管
 * （lib/client.js），不走 DSH settings namespace（DSH API gateway 的
 * exposedNamespaces() 只放行内置 8 个 namespace，详见 DECISIONS.md C003）。
 *
 * 本文件必须保留——loader 需要 import 一个 host fiber；bundle patch 里
 * `name: dsh-ui-tweaks` 指向这里。删了会让 loader 找不到 module 而失败。
 * apply() 空操作即可：cordis 把 host fiber 当 zero-side-effect 占位。
 */

export const name = "dsh-ui-tweaks";
export const inject = [];

export function apply() {
  // no-op
}