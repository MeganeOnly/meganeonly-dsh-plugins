# Changelog

本文件记录 `dsh-ui-tweaks` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增

- **`first-message-jump`**（回到最早消息按钮）：对话区右下角（输入框上方）新增「回到最早消息」悬浮按钮——点击把当前会话最早一条 user 消息（`[data-chat-flow-kind="user"]` 第一行）滚到滚动区顶部，长会话里快速回看最初发的需求，不用一屏屏往上翻。纯 JS DOM 探测（`[data-conversation-scroll]` 滚动容器 + `[data-composer-seat]` 输入框），不依赖 DSH CSS module hash；只在最早消息不在当前视口内时显示，右侧抽屉打开时自动隐藏；视觉对齐 DSH 自带「回到底部」按钮。新增 `createFirstMessageJumpController`（`lib/client-src/68-first-message-jump.js`），诊断可从 `window.__dshUiTweaks.firstMessageJump()` 查看。

- **`hide-chat-tab`**（隐藏"对话"标签）：和 `hide-trajectory-tab` 配套——两个标签都隐藏后 tablist 视觉消失。复用通用 `createTabHider(opts)` 工厂（v0.7.2 重构）。如果当前不在对话视图（比如手动切到轨迹后才开启），程序自动 click 切回。

### 修复

- **first-message-jump 跟随底部任务条（input.dock 任务/进度条）出现/消失重定位**：任务条长在输入区组件里，出现时输入区变高（--dsh-composer-height 变大）。原实现在输入区高度变化后仍复用旧的原生按钮位置，按钮停在任务条后面被盖住 = 失效。现在 composer 高度变化（jumpUpdate 跟踪 + ResizeObserver 双保险）会清掉记忆并按新高度重算，按钮始终悬在任务条上方；锚定路径天然跟随。

- **first-message-jump 水平位置改量 DOM**：兜底不再靠 --dsh-chat-content-width / padding-right 公式推算，而是直接量**最早 user 消息行的父元素（内容列）右缘**——原生槽位的 padding-right 正是把按钮右缘对齐到内容列右缘，量 DOM 天然跟随内容宽 / 右缩等一切变化，彻底对齐原生按钮列。

- **first-message-jump 首次出现 / 视图切换后不再跳动**：兜底公式改读 --dsh-composer-height（DSH 内联在滚动容器上的输入框高，与原生槽位 bottom:calc(var(--dsh-composer-height) + 16px) 同源）——从未见过原生按钮时的估算位置与锚定位置完全重合，首次出现不再跳；视图/会话切换不再清记忆（原生按钮位置由布局决定，跨切换稳定），仅视口尺寸变化 / 右缩 padding 变化才清。

- **first-message-jump 不再因右侧抽屉无条件隐藏**：原逻辑只要 data-dsh-any-side-drawer-open 就隐藏——但开了「对话区右缩」时按钮已让位到抽屉左侧，隐藏反而失效。改为按实际遮挡判断：读 --active-drawer-width，仅当按钮右缘落入抽屉阴影（right < 抽屉宽）才隐藏；右缩让位足够时保持可见可点。

- **`first-message-jump` 按钮在原生按钮出现/消失时不再跳动**：原实现用两套定位（原生在场锚定 / 缺席时公式计算），两套位置有细微差异，导致每次切换都挪一下。改为**记住原生按钮最后一次的 rect**——原生缺席（停在底部）时复用记忆位置，与原生按钮将要出现的位置完全一致；会话/布局重建时清空记忆。配合真实几何（原生按钮顶 = 输入框顶 - 50），公式兜底也与锚定位置重合，冒烟测试覆盖 无原生/在场/消失/再现 四态全程坐标不变。

- **`first-message-jump` 按钮与「对话区右缩」（conversation-shift）联动**：右缩把 `padding-right` 加在滚动容器上，消息内容 / 原生「回到底部」按钮 / 输入框整体左移，按内容列计算的旧定位会偏右。改为**优先锚定原生「回到底部」按钮**（按 `aria-label` 匹配 zh/en，右缘对齐、悬其上方 8px，天然跟随右缩等一切布局偏移）；停在底部原生按钮不渲染时，兜底计算**扣除滚动容器自身的 `padding-right`** 再对齐内容列，与原生按钮可能出现的位置一致。

- **`first-message-jump` 显隐判断修正**：原 `jumpShouldShow` 只把「最早 user 行顶部明显低于视口顶部」判为显示，忽略了正常聊天停在底部时最早消息已滚出视口上方的情况——导致按钮默认根本不出现在屏幕上。修正为「最早 user 行不在视口顶部附近可见带内（滚出上方 / 前面垫了长上下文）即显示」，并补了覆盖底部 / 顶部 / 上下文 / 抽屉打开四种场景的冒烟测试。

- **`hide-trajectory-tab` 扩展：同时隐藏每个工具调用 row 内的 "Inspect" 按钮**（v0.7.5）：
  - 根因：DSH 在每个工具调用（`edit` / `pwsh` / `read` / `grep` / `glob` / `bash` / `write` 等）的 row 内渲染一个 `<button class="*_inspectButton">`（CSS Module hash class，当前 hash=`o3BgMG` / `CY-8Ka`）。点击后调 `inspectCall(callId)` → `actions.setView("trajectory")`——本质也是进轨迹视图的入口。`hide-trajectory-tab` 原本只隐藏顶部 tablist 的"轨迹"按钮，工具行 Inspect 按钮仍可见——用户反馈"应该一起关掉"。
  - 修法：CSS 加 `[class*="_inspectButton"]{display:none!important}`。substring match 不依赖 hash，DSH 升级换 hash 仍然命中。
  - 配合原有的 `[data-dsh-ui-tweaks-hidden-tab="trajectory"]`，"所有进入轨迹视图的入口"全部关闭，没有 80ms observer 节流的闪烁窗口（与 v0.7.3 修 `hide-sidebar-tooltip` HoverCard "闪一下" 的思路一致——CSS 在 mount 时立即生效）。

### 优化

- **`first-message-jump` 按钮位置对齐原生「回到底部」按钮**：原定位在对话区最右缘，宽屏下与 DSH 自带「回到底部」按钮（内容列右缘，748px 居中）不在同一列。改为读取 `--dsh-chat-content-width`（默认 748）计算内容列右缘，按钮与其同一列、悬在原生按钮上方 8px；输入框高度变化时经 ResizeObserver 重新定位。

- **Tweak row description 收进 HTML `title` 属性**（v0.7.5）：
  - 旧实现：每条 tweak 在 row 里始终渲染一段 1-3 行的描述文字（最长 60+ 字），6 条 tweak 在设置页铺满 200+ 像素高——但实际只有"刚开插件 / 想不起来某条做什么"时才需要看描述。
  - 新实现：description 默认不渲染，鼠标悬停在 row 上时弹出浏览器原生 tooltip（HTML `title` 属性）——所见即所得、无额外 CSS、无 JS state。`.DTPD_item` 加 `cursor:help` 提示可悬停。旧 `.DTPD_itemDesc` CSS 规则移除。

## [0.7.1] - 2026-08-19

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