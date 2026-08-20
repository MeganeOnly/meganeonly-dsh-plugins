# Changelog

本文件记录 `dsh-ui-tweaks` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增

- **`hide-chat-tab`**（隐藏"对话"标签）：和 `hide-trajectory-tab` 配套——两个标签都隐藏后 tablist 视觉消失。复用通用 `createTabHider(opts)` 工厂（v0.7.2 重构）。如果当前不在对话视图（比如手动切到轨迹后才开启），程序自动 click 切回。

### 修复

- **`hide-sidebar-tooltip` HoverCard 修复链**（v0.7.2 → v0.7.3 → v0.7.4）：
  - **v0.7.2 起**：补充 HoverCard 二次修复（v0.7.1 已加 JS observer 标记）
  - **v0.7.3 CSS 主防线**：直接命中 CSS Module hash 类（`_hoverContent` / `_hoverTitle` / `_hoverTime` / `_hoverStatus` / `_hoverPath`），mount 时立即隐藏消除"闪一下"
  - **v0.7.4 `:has()` 干掉 card div 本体**：CSS `:has()` 找含 `_hoverContent` 后代的 body 直接子 div（HoverCard card div 本身，背景 `#2C2C2E` + box-shadow 才是"窄黑框"来源），不依赖任何 hash
  - 四层 selector 协同（v0.7.4 终态）：L1 `[role="tooltip"]`（DSH Tooltip）→ L2 hash 类（HoverCard 内容）→ L3 `body > div:has(> [class*="_hoverContent"])`（card div 本体）→ L4 `data-dsh-ui-tweaks-hidden-hover-card`（JS observer 兜底）

- **`simple-mode` 状态行 controller 三个 bug**：
  - `findTurnStatus` 改为**反向**迭代：滚动到历史 turn 时不再误注入状态行；新 turn 总是 document 顺序的末尾
  - 改用 `get running()` getter 暴露运行态，apply() 直接读 getter 而非外部 flag，与 `createTrajectoryTabHider` / `createSidebarHoverCardHider` 模式一致
  - `.dsh-ui-tweaks-status` CSS 加 `visibility: visible !important`（display 也加 !important）兜底，防止被 simple-mode 隐藏的祖先节点带连累

### 性能

- **`simple-mode` 状态行 controller tick 节流**（每 250ms 一次）：
  - 缓存 `lastText`：仅在解析的 activity 文本真正变化时才写 DOM（避免思考阶段 4×/sec 的无效 MutationObserver / React reconciler 触发）
  - `attach()` 早返回：当前 span 已附着到当前 turnStatus 时跳过 `findTurnStatus` / `ensureStatusSpan` / `appendChild` 整套工作

### 优化

- **`simple-mode` activity 文本映射扩展**：除内置 DSH 工具名（think / read / web_fetch / web_search / edit / write / grep / glob / bash / pwsh / run_code）外，新增覆盖 task / subagent / agent / todo / plan / update_plan / lsp / intellisense / goal / objective / commit / git / push 等更日常的 tool kinds，"正在处理…" 兜底频率降低。

### 重构

- **client bundle 拆分**（按 `docs/maintainability.md` 通用规范）：原 1650 行 / 80.7 KB 单文件 `lib/client.js` 超过触发阈值（≥ 700 行 / 30 KB），拆为 17 个 source section（`lib/client-src/00-banner.js` 到 `Z9-loader-close.js`）。新增 `lib/build-client.cjs`（拼回 client.js）与 `lib/verify-client.cjs`（与 HEAD 字节级校验）脚本；`package.json` 加 `build:client` / `verify:client` / `prepare` 脚本。段首 marker 改用英文 short-name（与文件名 `name` 部分一致），原中文 marker 注释保留作为内部说明。

- **`simple-mode` TWEAKS row 注释**：`configKeys.value === configKeys.enabled` 真实原因写入注释——`TweakRow` 用 `hasValueInput = k2 !== k1` 检测，k1===k2 时不渲染数字输入框，localStorage 只存一个布尔字段，省空间且不暴露无意义的数字配置。**后续读者不要"修"成两个不同的 key。**

## [0.7.1] - 2026-08-19

作为独立 npm 包发布的初始版本，包含以下已有功能。

### 新增

- 设置页独立的"界面微调"顶级栏目，按 `TWEAKS` 数组自动渲染每条微调的开关与参数控件。
- `conversation-shift`（对话区右缩）：通过 DOM 探测定位对话流容器与输入区并标记，CSS 仅命中被标记元素并施加可配置的右侧内边距（默认 380 px，可调 0–800）；探测失败时回退到对话列容器。自带 shim，不依赖任何外部桥接包。
- `conversation-shift-debug`（对话右缩调试高亮）：为命中元素加高亮描边与浮动标签，并在控制台输出命中元素的诊断信息。
- `simple-mode`（简洁模式）：隐藏思考、工具调用、上下文注入等过程节点，并在输入框上方显示一行极简运行状态。
- `hide-sidebar-tooltip`（隐藏侧栏悬浮提示）：同时覆盖 Tooltip 与 HoverCard 两种实现——前者按 `[role="tooltip"]` 命中，后者由 `MutationObserver` 巡检 body 直接子元素后打标记，再由 CSS 隐藏。
- `hide-trajectory-tab`（隐藏"轨迹"标签）：巡检标签栏并按标签文本打标记隐藏；若当前正停留在轨迹视图，自动切回对话视图。
- 诊断能力：每条微调附带"诊断"按钮输出该条的生成 CSS 与命中元素，栏目顶部提供"复制状态到剪贴板"，运行时暴露 `window.__dshUiTweaks` 调试接口。
- 状态由浏览器 `localStorage`（键 `dsh-ui-tweaks/state`）自管，新增字段按缺省值隐式补齐；存储不可用时降级为默认值。
- 宿主半段为零副作用占位实现，不注册设置命名空间、不读写磁盘。