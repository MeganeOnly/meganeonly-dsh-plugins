# dsh-ui-tweaks 拆分清单

本插件的 client bundle 在 `lib/client.js` 已拆分为 `lib/client-src/` 多文件结构。通用规范（marker 约定、ES5 编码风格、构建脚本格式、字节验证、阈值）写在 [`../../docs/maintainability.md`](../../docs/maintainability.md)——**那是本仓库所有 DSH 插件共用的规范**。

本文件只列**本插件**的具体 section 拆分。

## 一、本插件的 section 索引

dsh-ui-tweaks 的 `lib/client-src/` 现行结构（v0.7.4 拆解，v0.10.6 起精简注释后 21 个文件；具体 section 职责见各文件头注释）：

| 前缀                  | 角色                                                                       |
| --------------------- | -------------------------------------------------------------------------- |
| `00-banner.js`        | 顶部 JSDoc 注释块（架构 + DOM 锚点约定 + 文件拆分 pointer）；v0.10.6 起移除版本历程（迁移到 `CHANGELOG.md`） |
| `10-loader-open.js`   | `__ModuleLoader__.load({...})` 开头 + `var inject = ["slots"]`             |
| `20-constants.js`     | 常量（`VERSION` / `MAIN_CSS_TAG_ID` / `STORAGE_KEY` / `SHIM_PANE_*` / `SHIFT_TARGET_*` / `SIMPLE_*` / `DISCLOSURE_END_COLLAPSE_*` / `STATS_*` / `JUMP_*` / `STATE_EVENT` / `DEBUG_API_KEY`） |
| `25-tweaks.js`        | `TWEAKS` 数组：10 条 tweak 的 `buildCSS`（v0.10.0 起条目可带 `choices` 表示"多选一"而非开关——目前仅 `stats-line-position` 使用） |
| `30-storage.js`       | `localStorage` 持久化：`storage` 探测 + `defaultState` / `loadState` / `saveState` |
| `35-styles.js`        | `buildCSS` / `buildDebugHighlightCSS` / `injectCSS` + `SECTION_CSS` 静态样式 + `injectSectionCSS` |
| `40-shim.js`          | self-shim 4 层 selector：`discoverFrameTriptych` / `findConversationPane` / `stampIfMissing` / `applyShellShim` / `startShellShimObserver` |
| `45-chatflow-marks.js` | 动态探测：`findChatflowTargets` / `applyChatflowShiftMarks`（幂等）+ `startChatflowMarksObserver`（首选 `[data-conversation-scroll]` 锚点 + 旧 overflow+chat-flow-kind 兜底） |
| `50-debug.js`         | 调试高亮：`inspectMatch` / `inspectElement` / `applyDebugMode`（toggle `<html data-dsh-ui-tweaks-shift-debug>` + 写/清 `data-shift-px`） |
| `55-simple-mode.js`   | 简洁模式状态行：`simpleActivityText` / `simpleActivityCategory` / `simplePickToolNameFromDom` / `simpleIsThinkingFromDom` / `simplePickActivityName` / `simpleIsRunningFromDom` / `createSimpleModeStatusController`（含 `purgeTurnStatus` JS 接管） |
| `60-tab-hider.js`     | 通用 tab hider 工厂：`TRAJECTORY_TAB_LABELS` / `CHAT_TAB_LABELS` / `findTabButtonByLabels` / `createTabHider(opts)` |
| `65-hover-card-hider.js` | 侧栏 HoverCard 隐藏：`HOVER_CARD_CLASS_HINTS`（DSH 升级 hash 变了改 HINTS 即可）/ `isHoverCardRoot` / `createSidebarHoverCardHider` |
| `67-disclosure-end-collapse.js` | 折叠块末尾收起按钮：`findRowForBody` / `injectCollapseButton` / `scanBodies` / `removeAllInjectedButtons` / `createDisclosureEndCollapseController`（三 selector 由 `DISCLOSURE_BODY_SELECTORS` 单点拼接） |
| `68-first-message-jump.js` | `createFirstMessageJumpController` 工厂 + 控制器主文件（定位 / 显隐 / 点击 / 生命周期 / 诊断） |
| `68a-first-message-jump-utils.js` | 12 个纯 finder/scanner 函数（不依赖闭包状态，以 `port` 作参数） |
| `69-stats-line-position.js` | 统计行位置 controller：`statsNormalizePosition` / `statsFindSource` / `statsFindTitleCluster` / `statsRemoveMirror` / `statsEnsureMirror` / `statsSyncMirror` / `createStatsLinePositionController` |
| `70-debug-api.js`     | `createDebugAPI` —— 暴露 `window.__dshUiTweaks.{VERSION, getState, getInjectedCSS, getMatchedElements, debug, setState, reshim}` |
| `75-react-tweak-row.js` | `TweakRow` React 组件：单条 tweak 的 row（标题 + 控件 + 可选数字输入；v0.10.0 起支持 `choices` 下拉） |
| `80-react-section.js` | `UiTweaksSection` 顶级 React 组件：`useState(loadState)` + `useEffect` 持久化 + dispatch 状态事件 |
| `85-apply.js`         | `apply(ctx)` 函数：launch 入口（self-shim → CSS 注入 → 诊断 API → settings slot → 调试模式 → 各 controller → 状态事件监听） |
| `Z9-loader-close.js`  | `exports.apply` / `exports.inject` / `exports.name` + `return module.exports` + `});` 收尾 |

## 二、注释约定（v0.10.6 起的精简规范）

v0.10.6 之前，每个 source 文件的 header 都有 30–190 行版本历程 + 多段 inline 版本注释解释"为什么这条 CSS 这么写"。这些注释与 `CHANGELOG.md` 高度重复，加起来让 `lib/client.js` bundle 多出 ~110 KB 注释载荷。

**v0.10.6 起的规则**：

1. **版本历程只在 `CHANGELOG.md`**——任何"v0.X.Y 修了这个"的叙述都进 changelog；source 文件 header 只保留与当前实现直接相关的"是什么 / 为什么"，不带版本号。
2. **保留的注释类型**：
   - JSDoc 段（`/** ... */`）说明函数做什么、参数 / 返回含义
   - 行内 `//` 说明非显然的设计决策（"为什么"不是"做了什么"）——例如 visibility vs display、为什么不搬 React 节点、锚点优先选哪种 selector
   - CSS 注释说明 selector 意图（`/* === tweak-id : 简述 === */`）
3. **移除的注释类型**：
   - 段落级版本历程（v0.X.Y 起 + 修复 + 根因 + 修法 + 兼容性 + 改动文件列表）
   - "本 tweak 的 N 条要点"长 enumerate
   - 重复"compatibility: 不变类名 / ID / attribute / localStorage key"段落
4. **CHANGELOG.md 是版本历程的唯一来源**——git log + CHANGELOG 段能完整还原任何版本的修复动机 + 文件影响，source 文件不再重复。
5. **通用规范 `docs/maintainability.md` § 三三"注释规范"**继续适用——JSDoc 用单行 `/** ... */`，子模块用 `// ----- xxx -----` 隔开，inline `// why not what`。

## 三、本插件特殊项

- **bundle 大小**：v0.10.6 注释精简后 `lib/client.js` ≈ 162 KB（原 v0.10.5 277 KB，-41%）；各 source 文件均回落至 maintainability.md § 八"不要拆分过细"的下限附近。banner 从 50 KB → 2 KB，25-tweaks 从 56 KB → 28 KB，20-constants 从 23 KB → 4 KB 等。
- **行尾换行**：与通用规范 § 五一致——非末尾 section 文件末尾 `}\n\n`，末尾 section `}\n`，`Z9-loader-close.js` 末行无 `\n`。v0.10.5 已补齐 67 / 68 / 68a / 75 的末尾换行。
- **DSH slot 出口锚点（首选策略）**：DSH renderer 给每个 slot 出口包 `<div data-slot="<slot key>" style="display:contents">`，不含构建 hash。锚点优先用它。`!important` 必需：`display:contents` 是 inline style。
- **贴底元素不能用 `display:none` 隐藏（v0.10.1 教训）**：composer seat 是 `position:sticky;bottom:0`，隐藏 footer 必须用 `visibility:hidden` 而非 `display:none`——后者把盒子从布局里移除、底边钉住导致**输入行整体下移**。`visibility` 保留盒子高度且 React 照常更新文本。已核对 DSH 侧唯一的 visibility 规则是 `[data-phase=settling] .composerSeat{visibility:hidden}`，无后代 `visibility:visible` 重置。
- **共享常量**：放 `20-constants.js`（第一个数字 section），其它 section 全部通过 factory body 顶层引用——见通用规范 § 三三"模块边界"。
- **React 依赖**：通过 `10-loader-open.js` 的 `require("react")` 和 `require("react/jsx-runtime")` 引入；`85-apply.js` 通过 `ctx.slots.inject("settings.section", ...)` 把 `UiTweaksSection` 注册到 DSH 设置页。
- **状态事件总线**：`STATE_EVENT = "dsh-ui-tweaks-state-change"` —— `UiTweaksSection` useEffect 触发 dispatch，`apply()` 注册 listener 统一协调各 controller 的启停。
- **DSH 升级 hash 兼容**：HoverCard section 维护 `HOVER_CARD_CLASS_HINTS` 数组（DSH workspace CSS module hash 类名），作为唯一需要跟进 DSH 升级的探测目标。

## 四、相关

- 通用规范：[`../../docs/maintainability.md`](../../docs/maintainability.md)
- 构建脚本：`lib/build-client.cjs`
- 字节校验：`lib/verify-client.cjs`
- 版本历程（注释精简后唯一来源）：`CHANGELOG.md`
- DSH 插件作者 skill：`dsh-persistent-plugin-authoring`（DSH skill 目录下）
