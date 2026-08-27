# Changelog

本文件记录 `dsh-ui-tweaks` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 修复

- **`simple-mode` 状态行工具名识别修复**（v0.9.5）：v0.9.3 美术度升级（8 类活动语义色：think 蓝 / read 中性 / write 琥珀 / bash 紫 / task 青 / plan 绿 / goal 粉 / git 石板）**从发布起就未生效**——所有活动都 fallback 到 "正在处理…" / generic 灰。两处根因同时修：
  - **`simplePickToolNameFromDom` 错属性**：之前查 `[data-tool-name]`，但 DSH `dsh-client-ui-tool/lib/client.js` ToolRow 实际渲染的是 `[data-tool] = toolName`（`"data-tool": toolName`）。v0.9.3 升级时命名错误，从 v0.9.3 commit `03a71c1` 起 simplePickToolNameFromDom 返回 null 100%，simpleActivityText(null) 永远 "正在处理…"。修法：主路径改为 `[data-tool]`；保留 `[data-name]` / `[class*="toolName"]` / `[class*="toolLabel"]` 作 fallback（与 v0.7.3 hide-sidebar-tooltip 的 substring 策略一致——DSH 升级切属性约定仍能命中）。
  - **think / reasoning block 不在 tool-call 容器里**：模型思考时，DSH 渲染 `<div data-chat-flow-kind="assistant-step">` 内含 `<div data-variant="think" data-state="running">`（`dsh-client-ui-conversation/lib/client.js` ReasoningRow）——即使修了 data-tool 也识别不到。新增 `simpleIsThinkingFromDom()` 单独探测 `[data-state="running"]` 的 think 块；新增 `simplePickActivityName()` 统一入口——think 优先 → tool-call → fallback（generic）。tick() 改用 `simplePickActivityName()`。
  - **`simpleActivityCategory` / `simpleActivityText` 扩展**：覆盖 DSH 全部内置工具——`bash_persistent` / `pwsh_persistent` / `read_image` 归读 / 写 / shell；`todo_write` 取代 v0.9.3 错写的 `todo`（DSH 实际是 `todo_write`）；`get_goal` / `create_goal` / `update_goal` 归 goal；`subagent` / `workflow` / `ralph` / `ask_user_question` / `job_output` / `job_list` / `job_kill` / `send_message` / `interrupt_agent` / `list_agents` / `skill` 归 task；`cordis_*` 走 prefix 匹配（DSH 注册名 `cordis_define` / `cordis_run` / `cordis_stop` / `cordis_undefine` / `cordis_package_inspect` / `cordis_runtime_inspect`）。`run_code` 仍归 bash（执行类）——为不引入第 9 色。
  - **不变**：`.dsh-ui-tweaks-status` 类名 / `dsh-ui-tweaks-status-row` ID / `[data-dsh-activity]` attr / CSS 8 类活动色 / lastKey 节流 / `visibility:visible !important` 兜底 / `prefers-reduced-motion` 关呼吸——纯逻辑修复，UI 形态不变
  - **验证**：浏览器控制台 `window.__dshUiTweaks.simpleController`（v0.9.5 起的调试 API，如未暴露调 `getState()` 看 `lastActivity` 字段确认 tick() 切换）—— bash / read / write / edit / think 时分别显示对应色与文案

### 修复

- **`first-message-jump` step-by-step 上一条 / 下一条 跳过 hidden row**（v0.9.4）：v0.9.3 之前 `jumpFindPrevUserRow` / `jumpFindNextUserRow` 拿到 `topVisible` 的 DOM 索引后直接返回 `rows[i-1]` / `rows[i+1]`，**没有再检查目标行是否实际可见**。当 simple-mode（默认 ON）把会话顶部的 compaction 块 `display:none` 隐藏时，里面的旧 user 行（rows[0..K-1]）仍然在 DOM 里、`jumpAllUserRows` 仍会返回——而 `jumpFindTopVisibleUserRow` 已经正确跳过了 height<=0 的行，所以锚点（topVisible）通常是 rows[K]。但再点一次"上一条"，`jumpFindPrevUserRow` 直接返回 rows[K-1]（hidden 的旧 compaction user 行），`jumpToPrev` 滚到了一个 `height=0` 的位置 → 用户看不到任何视觉变化，按钮看起来"卡死"在该行，再点也无反应（直到下次 compact 边界变化或 simple-mode 切换）。同样的问题在 `jumpFindNextUserRow`（罕见但若 hidden 行不在顶部而是夹在中间会触发）。修法：拿到 topVisible 索引后，prev / next 各自向前 / 向后找第一个 `getBoundingClientRect().height > 0` 的 row；找不到就返回 null（与"上一条 step 到边界后按钮看似还在但 Shift+点击仍能直达第一行"的语义一致——v0.9.2 可见性放宽后的视觉提示不变）。区别于 v0.9.2 的 Shift+点击用 `jumpIsRowInCompaction` 沿父链检查 `data-chat-flow-kind` attribute：v0.9.4 用 DOM 渲染高度（`getBoundingClientRect().height > 0`）做"可见性"判断，更通用——simple-mode 隐藏、自定义 CSS 隐藏等任何 `display:none` 的 user 行都会跳过；simple-mode OFF 时所有行可见，行为不变（compaction 行仍可逐条 step 进去）。

### 优化（v0.9.3）

- **`simple-mode` 状态行美术度升级**（v0.9.3）：三轴叠加，单一设计语言——
  - **A) Pill 化**（圆角胶囊）：`padding:3px 10px 3px 8px` + `border-radius:999px` + `background:color-mix(in srgb, currentColor 8%, transparent)`——取代 v0.9.2 的裸灰文字，"飘字" 变 "状态徽章"，背景跟当前活动色淡出不抢戏
  - **B) 呼吸点**：`::before` 6px 圆点 + `@keyframes dsh-status-pulse` 1.6s 透明度+缩放循环，"现在还活着" 的活性信号。`@media (prefers-reduced-motion: reduce)` 自动关掉动画（动效敏感用户友好，圆点静态保留仍是 chip 形态）
  - **C) 语义色**：JS 在 `tick()` 给状态 span `setAttribute(SIMPLE_STATUS_ACTIVITY_ATTR, category)`，CSS 8 条 `[data-dsh-activity="..."]` 规则按类目着色——点继承 `currentColor`，单一着色真相源：
    - `think`（思辨）=#2563eb 蓝 / `read`（输入）=#475569 中性 / `write`（变更）=#d97706 琥珀
    - `bash`（执行）=#7c3aed 紫 / `task`（调度）=#0891b2 青 / `plan`（计划）=#059669 绿
    - `goal`（跟踪）=#db2777 粉 / `git`（版本）=#64748b 石板 / `generic`（兜底）=DSH 三级灰
  - **性能**：`tick()` 用 `lastKey = category + "\u0000" + text` 合并去重——text 或 category 任一变化才写 DOM（保持 v0.7.1 起的 `lastText` 节流效果，250 ms 轮询 × React reconciler 触发频率不变）
  - **兼容**：`.dsh-ui-tweaks-status` 类名 + `dsh-ui-tweaks-status-row` ID 不动（调试 API / 验证脚本仍命中）；localStorage `simpleModeEnabled` key 不动（老用户开关状态保留）；`visibility:visible !important` 兜底保留（防止被 simple-mode 隐藏的祖先节点带连累）；DSH 主题颜色变量缺失时硬值 fallback
  - **改动文件**：`25-tweaks.js` 的 simple-mode buildCSS（+1.5 KB CSS）+ `55-simple-mode.js` 加 `simpleActivityCategory(name)` + tick() 改 lastKey 合并去重（+400 B JS）+ `20-constants.js` 加 `SIMPLE_STATUS_ACTIVITY_ATTR` 常量 1 行（+50 B）
  - **首版问题**（见下方 hotfix 段）：v0.9.3 首版用户反馈「一闪一闪 + 高度会变 + 跟原生 Deep diving... 高度不统一」——`padding:3px 10px 3px 8px` 让总高 24px 高于 DSH 原生 turnStatus 的 18px；`scale(.85↔1)` + `opacity(.35↔.95)` + 1.6s 周期 + `transition: background-color/color .25s` 四层动画叠加视觉闪烁。版本号未 bump，作为同版本 hotfix 修复。

### 修复（v0.9.3 hotfix）

- **`simple-mode` 状态行闪烁 + 高度膨胀修复**（v0.9.3 hotfix，版本号不变）：v0.9.3 首版用户反馈「一闪一闪 + 高度会变 + 跟原生 Deep diving... 高度不统一」。三处根因同时修复（CSS 集中在 `25-tweaks.js` 的 simple-mode buildCSS）：
  - **高度对齐 DSH 原生 turnStatus**：`padding:3px 10px 3px 8px` → `padding:0 10px 0 8px`（仅水平 padding）——总高严格等于 `line-height:18px`，与 DSH 原生「Deep diving...」等 turnStatus 文案严格同高，不再"高度膨胀"
  - **去掉几何抖动**：删除 `@keyframes` 里的 `transform:scale(.85↔1)`——scale 让圆点几何尺寸变化（从 5.1px 涨到 6px），与字体稳定尺寸冲突，看上去像"在抖"
  - **去掉颜色过渡闪烁**：删除 `transition:background-color .25s ease,color .25s ease`——color 切换（如 think→bash）时不再有 250ms 颜色过渡闪烁
  - **减弱呼吸幅度**：opacity 范围 `.35↔.95` → `.6↔.9`（变化幅度缩小到 30%，不再算"闪烁"）
  - **减慢呼吸周期**：1.6s → 2.4s（柔和的"心跳节奏"，不抢戏）
  - **保留**：`::before` 圆点 + `@keyframes dsh-status-pulse` + 8 类活动语义色 + pill 形态 + `prefers-reduced-motion` 兜底
  - **版本号不变**：本次为同版本内 hotfix——v0.9.3 还没发布（commit `03a71c1` 未推送），所有 v0.9.3 内容（视觉升级 + 闪烁/高度修复）整体一起作为 v0.9.3 发布

### 修复

- **`first-message-jump` Shift+点击跳过 compaction 块直达当前会话第一条**（v0.9.2）：v0.9.1 的 `jumpFindFirstUserRow` 返回 DOM 顺序的第一条 user 行——若对话顶部有 compact 摘要块（`data-chat-flow-kind="compaction"` / `"manual-compaction"`），里面的旧 user 行会被算成"第一条"，Shift+点击实际落到的是 compact 块下方的某条 user 行（不是当前会话起点）。新增 `jumpIsRowInCompaction(row)` 沿父链检查 `data-chat-flow-kind="compaction"` / `"manual-compaction"` / `"context"` 容器，跳过其中的 user 行。新增 `jumpFindFirstRealUserRow(port)` 作为 Shift+点击的目标；`jumpFindFirstUserRow` 保留作为内部锚点（v0.9.1 行为）。

- **`first-message-jump` 短会话（2 条 user 行）底部 TodoList / 进度卡片出现时按钮不显示**（v0.9.2）：v0.9.1 用 `target !== null` 判断可见性——`topVisible === firstRow` 时（短会话底部 + firstRow 还在视口顶部 + 用户以为自己在底部）`target=null` → 按钮直接不显示（用户反馈"老问题"）。放宽为 `rows.length >= 2`：只要有 2 条以上 user 行按钮就显示（即使已在顶部 user 行），Shift+点击仍能到最顶。

### 新增（v0.9.1）

- **`first-message-jump` step-by-step 上数第二条卡住 bug 修复**（v0.9.1）：v0.9.0 用 `lastVisible`（视口内最底部可见 user 行）作为锚点——当 rows[1] 已在视口顶部但 rows[2..N] 仍可见时，`lastVisible` 始终是 rows[N] → `target` 始终是 rows[N-1] → 点击不前进 → 死循环（按钮永不隐藏、永远到不了 rows[0]）。改用 `topVisible`（视口内最顶部可见 user 行）作为锚点后：`topVisible = rows[1]` 时 `target = rows[0]`，点击滚到 rows[0] 后 `topVisible = rows[0]` → `target = null` → 按钮正确隐藏。

### 新增

- **`first-message-jump` Shift+单击 = 一键回到最早**（v0.9.1）：单击仍是 step-by-step 上一条；按住 Shift 再单击 = 一键到最早一条 user 行（恢复 v0.8.0 的「一键回到最早」语义，但用 Shift 修饰与 step-by-step 共存）。title 属性增加 `（Shift+点击 = 回到最早）` 提示。

- **`first-message-jump` 原生「回到底部」按钮同步改为「单击下一条 / Shift+单击 一键到底」**（v0.9.1）：两个按钮都用「单击 step / Shift+单击 极限」的对称模式。
  - 原生按钮单击：从 v0.9.0 / v0.8.0 的"一键到底"改为"下一条 user 行"（`topVisible → next`）
  - 原生按钮 Shift+单击：一键到底（DSH 原生 click handler 正常跑就行）
  - 实现：capture-phase document click listener（`jumpOnNativeClick`），命中 `aria-label="回到底部"` / `"Back to bottom"` 时按 `shiftKey` 分发——`shiftKey=true` 不 preventDefault（让 DSH 原生 handler 跑），`shiftKey=false` preventDefault + stopImmediatePropagation 后调 `jumpToNext()`

- **`first-message-jump` 诊断增强**（v0.9.1）：`getState()` 返回字段增加 `topVisibleUserRow` / `nextUserRow` / `nativeHooked`；旧锚点 `lastVisibleUserRow` 保留作对照（便于调试 v0.9.0 死循环场景）

### 新增（v0.9.0）

- **`first-message-jump` 单向上导航**（v0.9.0）：按钮 = "上一条我发的消息"——点击跳到当前视口内最底部可见 user 消息的上一条（DOM 顺序），连续点击可一路向上导航直到最早一条 user 消息（此时按钮自动隐藏）。
  - 视口内**无** user 行（用户在对话上方空白区 / 刚开页面）→ 点击跳到最后一条作为入口
  - 视口内最底部可见 user 行 = firstRow → target = null → 按钮自动隐藏（已无路可上）
  - 仅一条 user 行 → 跳过去后按钮隐藏（firstRow === lastVisible）
  - 按钮 DOM / 位置 / 尺寸 / 样式 / ID / `[data-dsh-ui-tweaks-jump]` CSS 选择器全部不变，**保持按钮的整洁**
  - SVG 固定 ▲ 朝上，aria-label / title 固定为 `上一条我发的消息`（不再 mode 翻面）
  - localStorage key `firstMessageJump` 不动，老用户开关状态保留；tweak id `first-message-jump` 保留向后兼容；tweak name 改为 `上一条我发的消息按钮`
  - 常量精简：删 `JUMP_MODE_FIRST` / `JUMP_MODE_LAST` / `JUMP_LABEL_FIRST` / `JUMP_LABEL_LAST` / `JUMP_SVG_LAST` / `JUMP_NEAR_TOP_PX`；`JUMP_SVG_FIRST` 改名为 `JUMP_SVG_UP`；`JUMP_LABEL_FIRST` 合并为 `JUMP_LABEL`
  - 新增 `jumpAllUserRows`（静态数组封装，避免 NodeList live 引发的迭代错位）/ `jumpFindLastVisibleUserRow`（与 viewport rect 真相交判定）/ `jumpFindPrevUserRow`（统一计算 target）；`jumpShouldShow` / `jumpComputeState` 删除，判定完全交给 `target = jumpFindPrevUserRow()` 是否为 null
  - `jumpToFirst` 改名为 `jumpToPrev`；`jumpApplyMode` 删除（不再需要 mode 翻面）；`getState()` 诊断快照返回 `{ totalUserRows, firstUserRow, lastUserRow, lastVisibleUserRow, targetRow, scrollTop, visible, drawerOpen, ... }`

### 新增（v0.8.0）

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