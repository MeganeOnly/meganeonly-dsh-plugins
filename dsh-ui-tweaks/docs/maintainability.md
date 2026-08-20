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
| `25-tweaks.js`        | `TWEAKS` 数组：5 条 tweak（`conversation-shift` / `conversation-shift-debug` / `simple-mode` / `hide-sidebar-tooltip` / `hide-trajectory-tab` / `hide-chat-tab`）的 `buildCSS` |
| `30-storage.js`       | `localStorage` 持久化：`storage` 探测 + `defaultState` / `loadState` / `saveState` |
| `35-styles.js`        | `buildCSS` / `buildDebugHighlightCSS` / `injectCSS` + `SECTION_CSS` 静态样式 + `injectSectionCSS` |
| `40-shim.js`          | self-shim 4 层 selector：`discoverFrameTriptych` / `findConversationPane` / `stampIfMissing` / `applyShellShim` / `startShellShimObserver` |
| `45-chatflow-marks.js` | v0.5.3 + v0.5.5 动态探测：`findChatflowTargets` / `applyChatflowShiftMarks`（幂等）+ `startChatflowMarksObserver` |
| `50-debug.js`         | 调试高亮：`inspectMatch` / `applyDebugMode`（toggle `<html data-dsh-ui-tweaks-shift-debug>`） |
| `55-simple-mode.js`   | 简洁模式状态行：`simpleActivityText` / `simplePickToolNameFromDom` / `simpleIsRunningFromDom` / `createSimpleModeStatusController` |
| `60-tab-hider.js`     | v0.7.0 + v0.7.2 通用 tab hider 工厂：`TRAJECTORY_TAB_LABELS` / `CHAT_TAB_LABELS` / `findTabButtonByLabels` / `createTabHider(opts)` |
| `65-hover-card-hider.js` | v0.6.2 侧栏 HoverCard 隐藏：`HOVER_CARD_CLASS_HINTS` / `isHoverCardRoot` / `createSidebarHoverCardHider`（DSH 升级 hash 变了改 HINTS 即可） |
| `70-debug-api.js`     | `createDebugAPI` —— 暴露 `window.__dshUiTweaks.{VERSION, getState, getInjectedCSS, getMatchedElements, debug, setState, reshim}` |
| `75-react-tweak-row.js` | `TweakRow` React 组件：单条 tweak 的 row（标题 + 描述 + 开关 + 可选数字输入） |
| `80-react-section.js` | `UiTweaksSection` 顶级 React 组件：自包含 `useState(loadState)` + `useEffect` 持久化 + dispatch 状态事件 |
| `85-apply.js`         | `apply(ctx)` 函数：launch 入口（self-shim → CSS 注入 → 诊断 API → settings slot → 调试模式 → 简洁模式 / tab hider / HoverCard hider → 状态事件监听） |
| `Z9-loader-close.js`  | `exports.apply` / `exports.inject` / `exports.name` + `return module.exports` + `});` 收尾 |

## 二、本插件特殊项

- **bundle 大小**：v0.7.4 拆解完成 + preflight marker 后是 83103 字节。原 82590 字节（仅 1 处版本 banner），拆分 + 13 个 section header marker 引入 513 字节（§ 五 "DIFFERS 是预期"）。所有同类约束在通用 `maintainability.md` § 五
- **共享常量**：`SHIM_PANE_*` / `SHIFT_TARGET_*` / `SIMPLE_*` / `HOVER_CARD_*` 等"私有常量"放 `20-constants.js`（第一个数字 section），其它 section 全部通过 `factory body` 顶层引用——见通用规范 § 三三 "模块边界"
- **React 依赖**：通过 `10-loader-open.js` 的 `require("react")` 和 `require("react/jsx-runtime")` 引入；`85-apply.js` 通过 `ctx.slots.inject("settings.section", ...)` 把 `UiTweaksSection` 注册到 DSH 设置页
- **状态事件总线**：`STATE_EVENT = "dsh-ui-tweaks-state-change"` —— `UiTweaksSection` useEffect 触发 dispatch，`apply()` 注册 listener 统一协调 simple-mode / trajectory hider / chat hider / hover card hider 的启停
- **DSH 升级 hash 兼容**：HoverCard section 维护 `HOVER_CARD_CLASS_HINTS` 数组（DSH workspace CSS module hash 类名），作为唯一需要跟进 DSH 升级的探测目标

## 三、相关

- 通用规范：[`../../docs/maintainability.md`](../../docs/maintainability.md)
- 构建脚本：`lib/build-client.cjs`
- 字节校验：`lib/verify-client.cjs`
- DSH 插件作者 skill：`dsh-persistent-plugin-authoring`（DSH skill 目录下）
