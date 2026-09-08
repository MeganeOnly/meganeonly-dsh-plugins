/**
 * dsh-ui-tweaks — DSH web client bundle（author: MeganeOnly）
 *
 * 浏览器端外观微调合集。对话右缩 / 简洁模式 / 侧栏背景对齐 / 标签页隐藏 /
 * 折叠块收起按钮 / 回到最早消息按钮 / 统计行位置，全部以 tweak + localStorage
 * 状态 + 自管 CSS 注入方式实现，零 DSH 内部依赖（不引 `@linxin666/*` 桥接包）。
 *
 * 版本历程见 `CHANGELOG.md`（每个 tweak 的版本引入、修复动机、文件影响在
 * CHANGELOG 段内；本 banner 不再重复 changelog 内容）。
 *
 * 架构（自 v0.5.0 沿用）
 * - self-shim 4 层 selector（L1 `data-pane="conversation"` / L2 `class*=centerCol`
 *   / L3 grid 解析 / L4 兜底），加 MutationObserver 在 DSH React 重渲时重新种属性
 * - 数据通路：localStorage 自管，KEY = STORAGE_KEY
 * - 诊断 API：`window.__dshUiTweaks = { VERSION, getState, getInjectedCSS,
 *   getMatchedElements, debug, setState, reshim, firstMessageJump,
 *   disclosureEndCollapse, statsLinePosition }`
 * - TWEAKS 数组（25-tweaks.js）是 UI + CSS + 持久化的单一数据源
 *
 * DOM 锚点约定（hash-independence 策略）
 * - DSH slot 出口属性：`[data-slot="<slot key>"]`（renderer 给每个 slot 出口
 *   包一层 div，不含构建 hash，跨版本稳定）——首选
 * - DSH 稳定 attribute：`[data-conversation-scroll]` / `[data-chat-flow-kind]`
 *   / `[data-variant="think"]` / `[data-composer-seat]` / `[data-tool]`
 * - CSS module class 含子串：`[class*="_root"]` / `[class*="_hoverContent"]`
 *   等 `<hash>_<name>_<suffix>` 约定的子串匹配（hash 升级换前缀仍命中）
 * - 不依赖：完整 CSS module 类名、`@linxin666/*` 桥接包、DSH 内部模块路径
 *
 * 文件拆分见 `docs/maintainability.md` § 一（21 个 section，按职责拆分；
 * 通用规范见仓库根 `docs/maintainability.md`）。
 */
