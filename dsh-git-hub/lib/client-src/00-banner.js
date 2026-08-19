/**
 * dsh-git-hub — 浏览器半端（web client bundle，作者：MeganeOnly）
 *
 * v0.1.0：右侧 FAB + 抽屉 + 本地 git 仓库列表 + 一键推送 + 推到当前对话。
 *
 * 设计要点（与 dsh-task-pool 一致的部分，不重复说明）：
 *   - 零 React 依赖，纯 DOM + 模板字符串
 *   - FAB 自挂 document.body，top:108px / right:24px（task-pool 在 56px,本插件下移 8px 避让），44×44 圆形 DSH 风格浅色按钮
 *   - 抽屉 420px 宽，position:fixed + transform 滑入
 *   - 互斥协议：dsh-panel-activate CustomEvent + <html data-dsh-github-drawer-open>
 *   - 多面板互斥时主动 remove 其它面板 attr
 *   - 持久化降级：localStorage 不可用时退化为内存 + console.warn
 *   - CSS 注入：<style data-plugin-css="dsh-git-hub/drawer.css"> 去重
 *   - 自愈 DOM 挂载：MutationObserver 监听 body
 *
 * 数据形态：localStorage key dsh.gitHub.v1
 *   schema v1 = { pinnedPaths: string[] }                          （v0.1.0）
 *   schema v2 = { pinnedPaths: string[], hiddenPaths: string[] }   （v0.1.6 新增 hiddenPaths；
 *                                                                   缺字段默认 []，隐式迁移 v1 → v2，
 *                                                                   schema 演进不升 key）
 *   schema v3 = schema v2 + { commitSectionVisible?: boolean }     （v0.4.0 新增 commit 工具区可见性；
 *                                                                   缺字段默认 false；隐式迁移 v2 → v3）
 */
