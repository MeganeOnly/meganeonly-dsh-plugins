/**
 * dsh-ui-tweaks — 浏览器端（web client bundle，作者：MeganeOnly）
 *
 * v0.9.5：`simple-mode` 状态行工具名识别修复——`simplePickToolNameFromDom`
 *   之前查 `[data-tool-name]`（错属性），DSH `dsh-client-ui-tool/lib/client.js`
 *   ToolRow 实际渲染的是 `[data-tool] = toolName`；同时新增
 *   `simpleIsThinkingFromDom` 识别 reasoning block（不在 tool-call 容器里，
 *   在 `assistant-step` 的 `data-variant="think" data-state="running"` 上）。
 *   两处修复让 v0.9.3 美术度升级的 8 类活动语义色真正生效——v0.9.3 commit
 *   `03a71c1` 起就未生效，所有活动一直 fallback 到 "正在处理…" / generic 灰。
 *   tick() 改用 `simplePickActivityName()` 统一入口：think 优先 → tool-call
 *   → fallback。`simpleActivityCategory` / `simpleActivityText` 扩展覆盖 DSH
 *   真实工具名（`bash_persistent` / `pwsh_persistent` / `read_image` /
 *   `todo_write` / `*_goal` / `subagent` / `workflow` / `ralph` / `skill` /
 *   `ask_user_question` / `job_*` / `send_message` / `interrupt_agent` /
 *   `list_agents` / `cordis_*`）。
 *
 * v0.9.4：`first-message-jump` step-by-step 跳过 hidden row 修复：
 *   - 根因：v0.9.3 之前 `jumpFindPrevUserRow` / `jumpFindNextUserRow` 拿到
 *     `topVisible` 的 DOM 索引后直接返回 `rows[i-1]` / `rows[i+1]`，没再
 *     检查目标行是否实际可见。当 simple-mode（默认 ON）把会话顶部的
 *     compaction 块 `display:none` 隐藏时，里面的旧 user 行
 *     （rows[0..K-1]）仍在 DOM 里、`jumpAllUserRows` 仍会返回——
 *     `jumpFindTopVisibleUserRow` 已正确跳过 height<=0 的行，但 step-by-step
 *     直接 DOM 索引取 `rows[K-1]`（hidden 的旧 compaction user 行）作为
 *     target → `jumpToPrev` 滚到 height=0 的位置 → 用户看不到任何视觉变化，
 *     按钮"卡死"在该行
 *   - 修法：拿到 topVisible 索引后，prev / next 各自向前 / 向后找第一个
 *     `getBoundingClientRect().height > 0` 的 row；找不到返回 null
 *     （按钮仍在但 click 变 no-op，与 v0.9.2 可见性放宽的视觉提示语义一致）
 *   - 区别于 v0.9.2 Shift+点击用 `jumpIsRowInCompaction` 沿父链查
 *     `data-chat-flow-kind` attribute：v0.9.4 用 DOM 渲染高度做"可见性"
 *     判断，更通用——simple-mode 隐藏、自定义 CSS 隐藏等任何 `display:none`
 *     的 user 行都会跳过；simple-mode OFF 时所有行可见，行为不变
 *     （compaction 行仍可逐条 step 进去）
 *
 * v0.9.3：`simple-mode` 状态行美术度升级——三轴叠加：
 *   - **A) Pill 化**：`padding:0 10px 0 8px`（仅水平 padding，保持总高严格 18px 与 DSH
 *     原生 turnStatus 文案如「Deep diving...」同高） + `border-radius:999px` +
 *     `background:color-mix(in srgb, currentColor 8%, transparent)`——取代 v0.9.2
 *     的裸灰文字，"飘字" 变 "状态徽章"，背景跟当前活动色淡出不抢戏
 *   - **B) 呼吸点**：`::before` 6px 圆点 + `@keyframes dsh-status-pulse` 2.4s
 *     **仅透明度**循环（opacity .6↔.9，无 scale——避免几何抖动）——"现在还活着"
 *     的活性信号（`prefers-reduced-motion` 关掉）。v0.9.3 首版的 scale(.85↔1)
 *     + 1.6s 周期 + opacity .35↔.95 三层叠加导致视觉闪烁，已 hotfix
 *   - **C) 语义色**：JS 在 tick() 给 span `setAttribute("data-dsh-activity", ...)`，
 *     CSS 8 条 `[data-dsh-activity="..."]` 规则按类目着色——点继承 currentColor，
 *     单一着色真相源：
 *       think(思辨)=#2563eb 蓝 / read(输入)=#475569 中性 / write(变更)=#d97706 琥珀
 *       bash(执行)=#7c3aed 紫 / task(调度)=#0891b2 青 / plan(计划)=#059669 绿
 *       goal(跟踪)=#db2777 粉 / git(版本)=#64748b 石板 / generic(兜底)=DSH 三级灰
 *   - **hotfix（不 bump 版本）**：去垂直 padding（总高 18px 与 DSH 原生 turnStatus 同高，
 *     不再"高度膨胀"）+ 去 scale + 去 `transition: background-color/color`（消除颜色
 *     切换时的 250ms 过渡闪烁）+ 减弱呼吸幅度（.6↔.9 取代 .35↔.95）+ 减慢周期（2.4s
 *     取代 1.6s）——v0.9.3 首版发布后用户反馈"一闪一闪 + 高度会变 + 跟原生 Deep diving...
 *     不统一" 的根因修复
 *   - **性能**：tick() 用 `lastKey = category + "\u0000" + text` 合并去重——text 或
 *     category 任一变化才写 DOM（保持 v0.7.1 起的 `lastText` 节流效果，250ms 轮询
 *     × React reconciler 触发频率不变）
 *   - **兼容**：`.dsh-ui-tweaks-status` 类名 + `dsh-ui-tweaks-status-row` ID 不动
 *     （调试 API / 验证脚本仍命中）；localStorage `simpleModeEnabled` key 不动
 *     （老用户开关状态保留）；`visibility:visible !important` 兜底保留
 *   - **改动文件**：`25-tweaks.js` 的 simple-mode buildCSS（+~1.5 KB CSS，含 hotfix
 *     校准）+ `55-simple-mode.js` 加 `simpleActivityCategory(name)` + tick() 改 lastKey
 *     （+~400 B JS）+ `20-constants.js` 加 `SIMPLE_STATUS_ACTIVITY_ATTR` 1 行（+~50 B）
 *
 * v0.9.2：`first-message-jump` compaction 跳过 + 可见性放宽：
 *   - Shift+点击现在跳过 compact 摘要里的旧 user 行，直接到当前会话的第
 *     一条 user 消息（v0.9.1 落到 compaction 块下方的某条 user 行——
 *     bug）。新增 `jumpIsRowInCompaction(row)` 沿父链检查
 *     `data-chat-flow-kind="compaction"` / `"manual-compaction"` /
 *     `"context"` 容器，跳过其中的 user 行。
 *   - 可见性从 `target !== null` 放宽为 `rows.length >= 2`：短会话（2 条
 *     user 行）底部 TodoList / 进度卡片出现时也能看到按钮作为提示
 *     （v0.9.1 顶到底部 user 行 `topVisible === firstRow` → target=null
 *     → 按钮直接隐藏——用户反馈"老问题"）。
 *
 * v0.9.1：`first-message-jump` step-by-step 修复 + Shift+点击一键回到最早
 *   （双按钮对称）：
 *   - 锚点从 lastVisible（v0.9.0）改为 topVisible（v0.9.1），修复"上数第二条
 *     卡住"bug——v0.9.0 的 lastVisible 在短消息 + 滚到 rows[1] 时，因为下方
 *     rows[2..N] 仍可见 → lastVisible 始终是 rows[N] → target 始终是
 *     rows[N-1] → 死循环（按钮永不隐藏、永远到不了 rows[0]）。
 *   - 我的按钮：单击 = 上一条；**Shift+单击 = 一键回到最早**（恢复 v0.8.0
 *     的"一键回到最早"语义，但用 Shift 修饰与 step-by-step 共存）
 *   - 原生「回到底部」按钮：单击 = 下一条；**Shift+单击 = 一键到底**——
 *     v0.9.0 / v0.8.0 原生单击"一键到底"的语义现在需要 Shift 修饰；
 *     实现靠 capture-phase document click listener + shiftKey 分发
 *
 * v0.9.0：`first-message-jump` 改为单向上导航——按钮 = "上一条我发的消息"：
 *   点击 = 跳到当前视口内最底部可见 user 消息的上一条；连续点击可一路
 *   向上导航直到最早一条（按钮自动隐藏）。视口内无 user 行（用户在对话
 *   上方空白区）→ 点击跳到最后一条作为入口。按钮 DOM / 位置 / 尺寸 / 样式
 *   / ID / CSS 选择器全部不变；SVG 固定 ▲ 朝上，aria-label / title 固定为
 *   "上一条我发的消息"。localStorage key `firstMessageJump` 不动，老用户
 *   开关状态保留；tweak id `first-message-jump` 保留向后兼容，name 改
 *   `上一条我发的消息按钮`。
 *
 * v0.8.0：新增 first-message-jump「回到最早消息」tweak——对话区右下角
 *   （输入框上方）挂一个悬浮按钮，点击把当前会话最早一条 user 消息
 *   （[data-chat-flow-kind="user"] 第一行）滚到滚动区顶部，长会话里快速
 *   回看最初发的需求。纯 JS DOM 探测（[data-conversation-scroll] 滚动容器
 *   + [data-composer-seat]` 输入框），不依赖 DSH CSS module hash；按钮
 *   挂载 / 显隐 / 定位 / 点击滚动由新增的 68-first-message-jump.js
 *   createFirstMessageJumpController 负责（纯 finder/scanner 函数在
 *   68a-first-message-jump-utils.js——30 KB 阈值维护动作，行为无变化）。
 *   只在最早消息不在当前视口内时显示，右侧抽屉打开时自动隐藏；视觉对齐
 *   DSH 自带「回到底部」按钮。
 *
 * v0.7.5：
 *   1) hide-trajectory-tab 扩展：同时干掉每个工具调用 row 内的 "Inspect"
 *      按钮——DSH 源码 `dsh-client-ui-tool/lib/client.js` 渲染
 *      `<button class="*_inspectButton">`（当前 hash=`o3BgMG` / `CY-8Ka`），
 *      点击后调 `inspectCall(callId)` → `actions.setView("trajectory")`——
 *      本质也是进轨迹视图的入口。CSS 用 `[class*="_inspectButton"]` 命中
 *      （substring match，不依赖 hash——DSH 升级换 hash 仍然命中）。配合
 *      原有 `[data-dsh-ui-tweaks-hidden-tab="trajectory"]` 把"所有进入
 *      轨迹视图的入口"全部关闭，没有 80ms observer 节流闪烁窗口。
 *   2) Tweak row description 收进 HTML `title` 属性。旧实现每条 tweak
 *      始终渲染一段 1-3 行的描述文字（最长 60+ 字），6 条 tweak 在设置页
 *      铺满 200+ 像素高。新实现：description 默认不渲染，鼠标悬停在 row
 *      上时弹出浏览器原生 tooltip——CSS 仅加 `cursor:help` 一个属性。
 *      旧 `.DTPD_itemDesc` 规则移除。
 *
 * v0.7.4：hide-sidebar-tooltip 四次修复——v0.7.3 修了"闪一下"但留下"窄黑框"。
 *   根因：DSH Tooltip 组件是 `<span role="tooltip">` 没背景，纯文字；但 HoverCard
 *   组件的 **card div**（`createPortal(card, document.body)` 的产物）有独立 CSS 类
 *   `_card_<hash>_<line>`（当前 hash = `1b2ny`），CSS 内容是
 *     `position:fixed; z-index:100; width:244px; padding:12px 16px;
 *      border-radius:12px; background:#2C2C2E; box-shadow:lv3`。
 *   所以 v0.7.3 用 `[class*="_hoverContent"]` 隐藏**内容**后，card div 本身
 *   仍可见——背景色 #2C2C2E + box-shadow 就是用户看到的"窄黑框"。
 *
 *   修法：CSS 用 `:has()` 找"含 _hoverContent 后代的 body 直接子 div"——那就是
 *   card div 本身。`:has()` 在 Chromium 105+ 可用（DSH 是 Electron = Chromium），
 *   不依赖 hash。同时把 card class 也加进 CSS 选择器列表（用更具体的
 *   `_card_<hovercard 模块特征>` 模式）做双保险。
 *
 * v0.7.3：hide-sidebar-tooltip 的 HoverCard 部分三次修复——v0.7.1 的 JS
 *   observer 还是能看到"闪一下然后消失"。原因：HoverCard portal div mount
 *   到浏览器 paint 之间有至少一帧延迟；JS observer 即使去掉 80ms throttle
 *   用 microtask 调度，最早也要下一个 microtask 才标记 + 浏览器下一帧
 *   才应用 CSS——用户能看到一帧的"全称 X小时前 空闲"。
 *
 *   修法：CSS 直接命中 HoverCard 内部内容的 workspace CSS module hash 类
 *   （`_hoverContent / _hoverTitle / _hoverTime / _hoverStatus / _hoverPath`）
 *   → display:none!important。CSS 在 mount 时立即生效，根本不画——
 *   视觉上看不到"闪一下"。JS observer（v0.7.1 加的 data-dsh-ui-tweaks-hidden-hover-card
 *   标记）保留作 DSH 升级 hash 变了后的兜底（DSH 升级后 CSS selector 失效，
 *   JS observer 接管——可能闪 80ms，但不至于完全漏网）。
 *
 * v0.7.1：hide-sidebar-tooltip 二次修复——v0.6.1 把 selector 改成
 *   `[role="tooltip"]`，DSH 自己的 Tooltip 组件（`<span role="tooltip">`）确实
 *   被干掉了。但用户反馈"提示还是在"，"全称 X小时前 空闲 这样子"——
 *   实测那个**不是 Tooltip，是 HoverCard**！
 *
 * v0.7.0：新增 hide-trajectory-tab——对话顶部"轨迹"标签页（DSH 开发者视角的
 *   模型/工具事件账本）隐藏。非开发者根本用不上，看了也看不懂。
 *   实现：JS 端 MutationObserver 巡检 `[role="tablist"]` 找文本为 "轨迹"/
 *   "Trajectory" 的按钮，给它打 `data-dsh-ui-tweaks-hidden-tab="trajectory"`
 *   标记；CSS `[data-dsh-ui-tweaks-hidden-tab="trajectory"]{display:none!important}`
 *   隐藏。如果当前 view 正是轨迹（aria-selected="true"），点击"对话"/"Chat"
 *   标签自动切回对话页——避免用户卡在轨迹视图出不来。
 *
 * v0.6.1：hide-sidebar-tooltip 修复——v0.6.0 的三个 selector 都错。
 *   实测 DSH Tooltip 组件（`@deepseek-ai/dsh-client-ui-primitives/lib/types/Tooltip.js`）
 *   渲染时是 `<span role="tooltip" className={undefined} style={{left,top}}>`，
 *   作为锚点元素的兄弟节点 inline 渲染（**不 portal 到 body**），className 是
 *   `undefined`（CSS module stub 是 `var Tooltip_module_css_default = {};`）。
 *   所以 v0.6.0 的：
 *     `body > [role="tooltip"]` ← 不是 body 直接子级
 *     `body > div:has(> [role="tooltip"])` ← 同上
 *     `[class*="TooltipContent"]` ← className 是 undefined，无子串匹配
 *   三条 selector 一条都没命中。
 *   修法：直接 `[role="tooltip"]{display:none!important}`——DSH Tooltip 组件是
 *   唯一用 `role="tooltip"` 的地方，全局干掉无副作用（与 v0.6.0 文档描述
 *   "全局关闭"一致）。
 *
 * v0.6.0：在 v0.5.5 基础上新增 hide-sidebar-tooltip（用户反馈"悬停在左侧栏
 *   工作窗口时弹出展示会话全名的小方框"——Radix 风格的深色浮层根本用不上）。
 *   纯 CSS：隐藏 `body > [role="tooltip"]` + 浮动 portal wrapper +
 *   CSS Module `TooltipContent` 后缀——3 层覆盖 Radix UI Tooltip 在 sidebar
 *   hover 时挂出的任何浮层。如 DSH 升级用新 Tooltip 实现，往 buildCSS 的
 *   selector 列表追加一行即可，UI/开关/持久化完全不动。
 *
 * v0.5.5：v0.5.4 修复『来回弹』后导致『根本不移动』的回归——原因是
 *   startChatflowMarksObserver 在 apply() 跑得太早时找不到 centerCol
 *   （DSH React 还没渲染它），静默失败，DSH 后续渲染时没人去探测
 *   chatflow。修复：把 applyChatflowShiftMarks 集成到 self-shim observer
 *   回调里（self-shim observer 启动早、观察 body subtree，必然能捕获所有
 *   变化）作为兜底；applyChatflowShiftMarks 加幂等性（已是最优标记就
 *   跳过重打），保留 v0.5.4 修过的『不再来回弹』行为。
 *
 * v0.5.4：两处修复
 *   1. 开关动画加速 + 改用 Material 标准加速曲线。背景 / 滑块位移
 *      transition 从 `transition: ... .15s ease` 改为 `transition: ... .08s
 *      cubic-bezier(.4,0,.2,1)`（80ms + Material 标准曲线）。
 *   2. conversation-shift 修"来回弹"视觉循环：
 *      - 去掉 CSS transition（避免 MutationObserver 频繁重打标记时被打断产生
 *        "对话一直向中间拉过去，然后又弹回去"的视觉循环）
 *      - MutationObserver 收窄到只观察 centerCol 直接子元素（之前观察
 *        body+subtree=true，DSH React 在 chatflow 内部每次重渲都触发重打标记），
 *        且只在已标记的元素被 unmount/remount 时才重新探测
 *
 * v0.5.3：JS 动态探测 DOM（找真正的 chatflow 容器 + inputArea），打
 *   data 属性标记，CSS 只命中被标记的元素；探测失败回退标记列容器。
 *   修复 v0.5.2 `> *` 选择器没命中任何元素的问题。
 *
 * v0.5.2：conversation-shift 选择器策略重做——给列内容加 padding-right
 *   而不是给列容器加。让 chatflow 对话内容左移，列容器本身的滚动条 /
 *   滚动指示器保持在原位；padding 区域显示 chatflow 容器的背景色，
 *   与对话内容背景连续。
 *
 * v0.5.1：精简 UI + 修复 v0.5.0 引入的可用性 bug。
 *
 * v0.5.0 修复了什么：
 *  - self-shim + 4 层 fallback selector + MutationObserver，**不再依赖**任何
 *    `@linxin666/*` 桥接包。0 耦合。
 *  - 高对比度调试 outline（4px 黄 + 黑底白字浮动 label）
 *
 * v0.5.1 修复的可用性 bug（v0.4.0 / v0.5.0 用户反馈）：
 *  - 数值输入框之前用 `disabled={!enabled}`，默认 enabled=false 导致数字框锁死，
 *    反人类。**v0.5.1 起数字框永远可编辑**——可以先调像素再开开关
 *  - 开关的 `background` 之前用 `var(--dsw-alias-bg-component-disabled)`，
 *    在某些 DSH 主题下变量值接近背景色，开关**看不见**。
 *    v0.5.1 加 CSS fallback 颜色（`#cbd5e1` 关 / `#2563eb` 开），并显式加 border
 *  - 受控 input 用 draft + useEffect 链路——v0.5.1 改用 `value={value` 直接
 *    受控 + `onChange` 每键更新父 state，消除 race condition
 *  - 移除冗余 UI（每行"诊断"按钮 + 顶部"复制状态"按钮 + 对话区右边界红线 marker
 *    + 描述里的视觉锚点说明）——用户反馈"多此一举"
 *
 * 架构（v0.5.0 起沿用）：
 *  - self-shim 4 层 selector（L1 data-pane / L2 class*=centerCol / L3 grid 解析 /
 *    L4 兜底），加 MutationObserver 在 DSH React 重渲时重新种属性
 *  - 数据通路：localStorage 自管（STORAGE_KEY = "dsh-ui-tweaks/state"）
 *  - 诊断 API：`window.__dshUiTweaks = { VERSION, getState, getInjectedCSS,
 *    getMatchedElements, debug, setState, reshim }`
 *  - TWEAKS 数组仍是 UI + CSS + 持久化的单一数据源
 */
