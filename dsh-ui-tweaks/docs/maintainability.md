# dsh-ui-tweaks 拆分清单

本插件的 client bundle 在 `lib/client.js` 已拆分为 `lib/client-src/` 多文件结构。通用规范（marker 约定、ES5 编码风格、构建脚本格式、字节验证、阈值）写在 [`../../docs/maintainability.md`](../../docs/maintainability.md)——**那是本仓库所有 DSH 插件共用的规范**。

本文件只列**本插件**的具体 section 拆分。

## 一、本插件的 section 索引

dsh-ui-tweaks 的 `lib/client-src/` 现行结构（v0.7.4 拆解）：

| 前缀                  | 角色                                                                       |
| --------------------- | -------------------------------------------------------------------------- |
| `00-banner.js`        | 顶部 JSDoc 注释块（version 历程 + 架构说明）                                |
| `10-loader-open.js`   | `__ModuleLoader__.load({...})` 开头 + `var inject = ["slots"]`             |
| `20-constants.js`     | 常量（`VERSION` / `MAIN_CSS_TAG_ID` / `STORAGE_KEY` / `SHIM_PANE_*` / `SHIFT_TARGET_*` / `SIMPLE_*` / `STATE_EVENT` / `DEBUG_API_KEY`） |
| `25-tweaks.js`        | `TWEAKS` 数组：9 条 tweak（`conversation-shift` / `conversation-shift-debug` / `simple-mode` / `hide-sidebar-tooltip` / `hide-trajectory-tab` / `hide-chat-tab` / `first-message-jump` / `disclosure-end-collapse` / **`sidebar-match-conversation-bg`**）的 `buildCSS` |
| `30-storage.js`       | `localStorage` 持久化：`storage` 探测 + `defaultState` / `loadState` / `saveState` |
| `35-styles.js`        | `buildCSS` / `buildDebugHighlightCSS` / `injectCSS` + `SECTION_CSS` 静态样式 + `injectSectionCSS` |
| `40-shim.js`          | self-shim 4 层 selector：`discoverFrameTriptych` / `findConversationPane` / `stampIfMissing` / `applyShellShim` / `startShellShimObserver` |
| `45-chatflow-marks.js` | v0.5.3 + v0.5.5 动态探测：`findChatflowTargets` / `applyChatflowShiftMarks`（幂等）+ `startChatflowMarksObserver` |
| `50-debug.js`         | 调试高亮：`inspectMatch` / `applyDebugMode`（toggle `<html data-dsh-ui-tweaks-shift-debug>`） |
| `55-simple-mode.js`   | 简洁模式状态行：`simpleActivityText` / `simpleActivityCategory` / `simplePickToolNameFromDom`（查 `[data-tool]`，v0.9.5 起）/ `simpleIsThinkingFromDom`（查 `[data-variant="think"][data-state="running"]`，v0.9.5 新增）/ `simplePickActivityName`（v0.9.5 新增统一入口：think 优先 → tool-call → fallback）/ `simpleIsRunningFromDom` / `createSimpleModeStatusController` |
| `60-tab-hider.js`     | v0.7.0 + v0.7.2 通用 tab hider 工厂：`TRAJECTORY_TAB_LABELS` / `CHAT_TAB_LABELS` / `findTabButtonByLabels` / `createTabHider(opts)` |
| `65-hover-card-hider.js` | v0.6.2 侧栏 HoverCard 隐藏：`HOVER_CARD_CLASS_HINTS` / `isHoverCardRoot` / `createSidebarHoverCardHider`（DSH 升级 hash 变了改 HINTS 即可） |
| `67-disclosure-end-collapse.js` | v0.9.6 折叠块末尾收起按钮：`findRowForBody` / `injectCollapseButton` / `scanBodies` / `removeAllInjectedButtons` / `createDisclosureEndCollapseController`（MutationObserver 80ms throttle 巡检 body subtree，按需注入 wrapper + "收起 ▴" 按钮，点击调 row.click() 触发 DSH React onToggle 折叠）。覆盖三类 DisclosureRow：ReasoningRow (`[data-variant="think"] [class*="thinkBody"]`) / GenericCommandCard (`[data-variant="others"] [class*="_body"]`) / ContextInjectionRow (`[class*="_root"][data-open] [class*="_body"]`)——三 selector 由 `20-constants.js` 的 `DISCLOSURE_BODY_SELECTORS` 单点拼接。按钮 wrapper 强制 `display:block` 让按钮独占一行（不被 pre-wrap 文本内联吃掉）；inline 位置由各 body 自身的 padding-left/margin-left 决定（Think 22px / Command 16px / Context 22px），无需按变体分别处理 indent。按钮 click handler `e.preventDefault() + e.stopPropagation()` 后调 `findRowForBody(bodyEl).click()`——React 17+ 委托到 root container，row.click() 会冒泡触发 onToggle → setExpanded(false) → body 与按钮一起被卸载；stopPropagation 是保险（row 实际是 body 兄弟不在祖先链上，但 click 也会途经 DisclosureRow wrapper）。stop 时调 `removeAllInjectedButtons` 防御性清理（正常路径下 button 随 body unmount 自带走）。 |
| `68-first-message-jump.js` | v0.8.0「回到最早消息」按钮 + v0.9.0 单向上导航 + v0.9.1 step-by-step 修复 + Shift+点击一键回到最早 + 原生「回到底部」按钮对称改造 + **v0.9.2 compaction 跳过 + 可见性放宽** + **v0.9.4 prev/next 跳过 hidden row**：`createFirstMessageJumpController` 工厂 + 控制器主文件——本文件只放依赖闭包状态的逻辑（定位 / 显隐 / 点击 / 生命周期 / 诊断）；12 个纯 finder/scanner 函数抽到 `68a-first-message-jump-utils.js`（30 KB 阈值维护动作，行为无变化）。按钮行为：单击跳到当前视口内**最顶部**可见 user 消息的上一条（DOM 顺序），连续单击可一路向上到第一个**可见** row；**v0.9.2 起可见性放宽为 `rows.length >= 2`**（短会话底部 TodoList / 进度卡片出现时也能看到按钮作为提示）；**v0.9.4 起 prev / next 跳过 hidden row**（`getBoundingClientRect().height <= 0` 的行——例如 simple-mode `display:none` 隐藏的 compaction 行），避免 step-by-step 滚到 DOM 里有但用户看不见的位置（按钮"卡死"现象）；Shift+单击 = 一键到 **v0.9.2 跳过 compaction / context 容器的第一条 user 行**（`jumpIsRowInCompaction` 沿父链检查，跳过 compact 摘要里的旧 user 行——v0.9.4 的 hidden-row 跳过与 v0.9.2 的 compaction-跳过是两个独立维度：前者用 DOM 渲染高度判断，后者用父链 data attribute 判断）；视口内无 user 行时跳到最后一条作为入口；按钮 DOM / 位置 / 样式 / ID 全部不变（探测 `[data-conversation-scroll]` / `[data-chat-flow-kind="user"]` / `[data-composer-seat]`）；同时挂 capture-phase document click listener 钩原生「回到底部」按钮（`aria-label="回到底部"` / `"Back to bottom"`），命中后按 `shiftKey` 分发——`shiftKey=true` 不 preventDefault 让 DSH 原生 handler 跑（一键到底），`shiftKey=false` preventDefault + stopImmediatePropagation 后调 `jumpToNext()`（下一条 user 行）。v0.9.1 锚点从 `lastVisible` 改为 `topVisible`（v0.9.0 在短消息 + 滚到 rows[1] 时会卡死，因为下方 rows[2..N] 仍可见 → lastVisible 始终是 rows[N]） |
| `68a-first-message-jump-utils.js` | v0.9.2 拆分 + v0.9.4 hidden-row 跳过逻辑：12 个纯 finder/scanner 函数（不依赖闭包状态，全部以 `port` 作参数）——`jumpFindScrollport` / `jumpAllUserRows` / `jumpFindFirstUserRow` / `jumpFindLastUserRow` / `jumpIsRowInCompaction`（v0.9.2 父链 attribute 检查，用于 Shift+点击）/ `jumpFindFirstRealUserRow`（v0.9.2 Shift+点击 target）/ `jumpFindLastVisibleUserRow`（v0.9.0 锚点，保留诊断）/ `jumpFindTopVisibleUserRow`（v0.9.1 当前锚点，已正确跳过 height<=0 的 hidden row）/ `jumpFindPrevUserRow` / `jumpFindNextUserRow`（v0.9.4 起向前/向后找第一个 height>0 的 row，找不到返回 null）。所有函数共享工厂函数 scope（client-src/ 按文件名升序整段拼接进 bundle），无需 require/import。共享常量（`JUMP_SCROLL_SEL` / `JUMP_USER_ROW_SEL` / `JUMP_DRAWER_ATTR`）仍由 `20-constants.js` 单点定义。 |
| `70-debug-api.js`     | `createDebugAPI` —— 暴露 `window.__dshUiTweaks.{VERSION, getState, getInjectedCSS, getMatchedElements, debug, setState, reshim}` |
| `75-react-tweak-row.js` | `TweakRow` React 组件：单条 tweak 的 row（标题 + 描述 + 开关 + 可选数字输入） |
| `80-react-section.js` | `UiTweaksSection` 顶级 React 组件：自包含 `useState(loadState)` + `useEffect` 持久化 + dispatch 状态事件 |
| `85-apply.js`         | `apply(ctx)` 函数：launch 入口（self-shim → CSS 注入 → 诊断 API → settings slot → 调试模式 → 简洁模式 / tab hider / HoverCard hider → 状态事件监听） |
| `Z9-loader-close.js`  | `exports.apply` / `exports.inject` / `exports.name` + `return module.exports` + `});` 收尾 |

## 二、本插件特殊项

- **bundle 大小**：v0.7.4 拆解完成 + preflight marker 后是 83103 字节。原 82590 字节（仅 1 处版本 banner），拆分 + 13 个 section header marker 引入 513 字节（§ 五 "DIFFERS 是预期"）。v0.9.6 加 `67-disclosure-end-collapse.js` 后约 +7.3 KB JS + 25-tweaks.js 的 buildCSS 多 ~1.0 KB CSS。所有同类约束在通用 `maintainability.md` § 五
- **共享常量**：`SHIM_PANE_*` / `SHIFT_TARGET_*` / `SIMPLE_*` / `HOVER_CARD_*` / `DISCLOSURE_END_COLLAPSE_*` / `DISCLOSURE_BODY_SELECTORS` 等"私有常量"放 `20-constants.js`（第一个数字 section），其它 section 全部通过 `factory body` 顶层引用——见通用规范 § 三三 "模块边界"
- **React 依赖**：通过 `10-loader-open.js` 的 `require("react")` 和 `require("react/jsx-runtime")` 引入；`85-apply.js` 通过 `ctx.slots.inject("settings.section", ...)` 把 `UiTweaksSection` 注册到 DSH 设置页
- **状态事件总线**：`STATE_EVENT = "dsh-ui-tweaks-state-change"` —— `UiTweaksSection` useEffect 触发 dispatch，`apply()` 注册 listener 统一协调 simple-mode / trajectory hider / chat hider / hover card hider 的启停
- **DSH 升级 hash 兼容**：HoverCard section 维护 `HOVER_CARD_CLASS_HINTS` 数组（DSH workspace CSS module hash 类名），作为唯一需要跟进 DSH 升级的探测目标

## 三、相关

- 通用规范：[`../../docs/maintainability.md`](../../docs/maintainability.md)
- 构建脚本：`lib/build-client.cjs`
- 字节校验：`lib/verify-client.cjs`
- DSH 插件作者 skill：`dsh-persistent-plugin-authoring`（DSH skill 目录下）
