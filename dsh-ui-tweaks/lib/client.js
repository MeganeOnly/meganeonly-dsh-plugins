/**
 * dsh-ui-tweaks — 浏览器端（web client bundle，作者：MeganeOnly）
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
window.__ModuleLoader__.load({
  id: "dsh-ui-tweaks",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var react = require("react");
    var jsxRuntime = require("react/jsx-runtime");

    var inject = ["slots"];

    // ===== constants =====
        var VERSION = "0.9.2";
        var MAIN_CSS_TAG_ID = "dsh-ui-tweaks/main.css";
        var SECTION_CSS_TAG_ID = "dsh-ui-tweaks/Section.css";
        var STORAGE_KEY = "dsh-ui-tweaks/state";
        var DEBUG_HTML_ATTR = "data-dsh-ui-tweaks-shift-debug";
        var SHIM_PANE_ATTR = "data-pane";
        var SHIM_PANE_VALUE = "conversation";
        var SHELL_FRAME_ATTR = "data-pane-shell";
        var SHELL_FRAME_VALUE = "frame";
        var SHELL_SIDEBAR_ATTR_VALUE = "sidebar";
        var SHELL_DETAILS_ATTR_VALUE = "details";
        var STATE_EVENT = "dsh-ui-tweaks-state-change";
        var DEBUG_API_KEY = "__dshUiTweaks";
        var SHIM_RESOLVED_FLAG = "__dshUiTweaks_shimResolved";
        var SIMPLE_STATUS_ID = "dsh-ui-tweaks-status-row";
        var SIMPLE_STATUS_CLASS = "dsh-ui-tweaks-status";
        var SIMPLE_TURN_STATUS_SEL = '[class*="turnStatus"]';
        var SIMPLE_POLL_MS = 250;
        // v0.5.3：动态探测 chatflow 容器 + 输入框，打标记给 CSS 命中
        var SHIFT_TARGET_ATTR = "data-dsh-ui-tweaks-shift-target";
        var SHIFT_TARGET_CHATFLOW = "chatflow";
        var SHIFT_TARGET_INPUT = "input";
        var SHIFT_TARGET_COLUMN = "column";  // 兜底：探测失败时标记列容器
        // v0.8.0：「回到最早消息」按钮（first-message-jump tweak）→ v0.9.0 改为「上一条」导航
        var JUMP_BTN_ID = "dsh-ui-tweaks-jump-btn";
        var JUMP_SCROLL_SEL = "[data-conversation-scroll]";   // DSH 会话滚动容器（scrollBody）
        var JUMP_USER_ROW_SEL = '[data-chat-flow-kind="user"]'; // 用户消息行（ChatNodeSeat）
        var JUMP_COMPOSER_SEL = "[data-composer-seat]";        // 输入框 seat（sticky bottom）
        var JUMP_DRAWER_ATTR = "data-dsh-any-side-drawer-open"; // 右侧抽屉互斥统一 attr
        var JUMP_TOP_PADDING = 12;   // 跳转后目标 user 行顶部与视口顶部的留白
        // 按钮底缘距输入框顶部的总高度：58 = 16（DSH toBottom slot bottom）+ 34（DSH 自带
        // "回到底部"按钮高）+ 8 间隙——窄会话列下也不会与 DSH 自带按钮重叠
        var JUMP_COMPOSER_CLEARANCE = 58;  // 兜底：底缘距输入框顶 = 16 slot + 34 原生按钮高 + 8 间隙
        var JUMP_NATIVE_GAP = 8;          // 主路径：按钮底缘悬在原生「回到底部」按钮顶部的间距
        // v0.9.2：可见性放宽（rows.length >= 2）+ Shift+点击跳过 compaction 块直达"当前会话第一条"
        var JUMP_LABEL = "上一条我发的消息";  // aria-label（单一语义，与 v0.9.0 / v0.9.1 同）
        // v0.9.1：title 加 Shift 修饰提示——浏览器原生 tooltip 悬停时显示；
        // aria-label 不加，避免屏幕阅读器读出"shift+点击"这种修饰
        var JUMP_BUTTON_TITLE = "上一条我发的消息（Shift+点击 = 回到最早）";  // title 属性（v0.9.1 新增）
        // SVG 上箭头（与 v0.8.0 同一 path：▲ 朝上表示"上一条"）
        var JUMP_SVG_UP = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 10.5L8 6l4.5 4.5"/></svg>';

    // ===== tweaks =====
    /**
     * 集中维护的 UI 微调清单。每条 tweak：
     *   - id：稳定标识（注入 CSS 注释 + React key）
     *   - name：人类可读标题
     *   - description：人类可读说明（用户视角，不写开发者术语）
     *   - configKeys.enabled / configKeys.value：localStorage 持久化的字段名
     *   - defaults：未设值时的默认
     *   - buildCSS(state)：根据当前 state 生成 CSS 字符串；返回 null 表示不输出
     *     （但 side effect 仍由 apply() 协调——调试模式切 <html> 属性等）
     */
    var TWEAKS = [
      {
        id: "conversation-shift",
        name: "对话区右缩",
        description: "让对话列内的对话内容（消息气泡）整体左移 N 像素，腾出右侧空间——列容器本身宽度不变，滚动条与滚动指示器保持在原位。",
        configKeys: { enabled: "conversationShift", value: "conversationShiftPx" },
        defaults: { enabled: false, value: 380 },
        buildCSS: function (state) {
          if (!state.conversationShift) return null;
          var px = Number(state.conversationShiftPx);
          if (!isFinite(px) || px < 0) px = 380;
          if (px > 800) px = 800; // safety cap
          // v0.5.3 + v0.5.4：命中 JS 探测标记的元素，无 transition
          // （去掉 transition 是 v0.5.4 的关键修复：避免在 MutationObserver 频繁重打
          //   标记时被打断产生"来回弹"视觉循环）
          return "/* === conversation-shift : 命中 JS 探测标记的元素 " + px + "px（无 transition）=== */\n" +
            "html [" + SHIFT_TARGET_ATTR + "]{padding-right:" + px + "px !important;box-sizing:border-box !important;}";
        }
      },
      {
        id: "conversation-shift-debug",
        name: "对话右缩调试高亮",
        description: "开启后给命中的对话列加 4px 黄色 outline + 黑底白字浮动标签（标签显示当前右缩像素值）。调试用——对话右缩关闭时也能开。",
        configKeys: { enabled: "conversationShiftDebug", value: "conversationShiftDebug" },
        defaults: { enabled: false, value: false },
        // 调试高亮的 CSS 由 buildCSSMain() 统一生成（依赖 conversationShiftPx），
        // 这里返回 null。apply() 在切调试模式时调用 applyDebugMode() 处理。
        buildCSS: function (state) {
          return null;
        }
      },
      {
        id: "simple-mode",
        name: "简洁模式",
        description: "隐藏思考与工具调用过程，只在输入框上方显示一条极简状态行（正在思考…/正在阅读…/正在执行命令…）。",
        // 仅开关型 tweak：enabled 和 value 复用同一 key。TweakRow 通过
        // `hasValueInput = k2 !== k1` 检测 k1===k2 时不渲染数字输入框——这样
        // localStorage 里只存一个布尔字段，不浪费空间，也不暴露无意义的数字配置。
        // 其它"有数字输入框"的 tweak (如 conversation-shift) 用 enabled + value
        // 两个不同的 key。
        configKeys: { enabled: "simpleModeEnabled", value: "simpleModeEnabled" },
        defaults: { enabled: true, value: true },
        buildCSS: function (state) {
          if (!state.simpleModeEnabled) return null;
          return "/* === simple-mode : hide tool-call / context / think / process rows === */\n" +
            '[data-chat-flow-kind="tool-call"]{display:none!important}\n' +
            '[data-chat-flow-kind="context"]{display:none!important}\n' +
            '[data-variant="think"]{display:none!important}\n' +
            '[data-chat-flow-kind="compaction"]{display:none!important}\n' +
            '[data-chat-flow-kind="manual-compaction"]{display:none!important}\n' +
            '[data-chat-flow-kind="model-retry"]{display:none!important}\n' +
            '[data-chat-flow-kind="turn-error"]{display:none!important}\n' +
            '[data-chat-flow-kind="turn-max-tokens"]{display:none!important}\n' +
            "/* === simple-mode : status row === */\n" +
            // visibility:visible 防御:万一 DSH 渲染时把 [class*=\"turnStatus\"] 包在某个
            // 被 simple-mode CSS 隐藏的元素(如 [data-chat-flow-kind=\"tool-call\"])里,
            // 父元素 display:none 会让状态行跟着看不见。visibility 兜底保证可见。
            ".dsh-ui-tweaks-status{display:inline-flex !important;align-items:center;gap:6px;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:18px;margin-left:10px;vertical-align:middle;flex:none;visibility:visible !important}";
        }
      },
      {
        // v0.6.0 新增 → v0.6.1 修 Tooltip selector → v0.6.2 补 HoverCard selector。
        //
        // 历史：
        // v0.6.0 三 selector 全错（Radix portal 假设错的——DSH 不用 Radix）。
        // v0.6.1 改成 `[role="tooltip"]`——杀掉了 DSH Tooltip 组件（确实修好了
        //   "新会话"等按钮上的简短 Tooltip 浮层）。
        // v0.6.2 发现用户报的"全称 X小时前 空闲"提示**不是 Tooltip，是 HoverCard**！
        //   HoverCard 在 `dsh-client-ui-primitives/lib/types/HoverCard.js`：card 通过
        //   `createPortal(card, document.body)` 渲染到 body 直接子级 div，没有 className
        //   （HoverCard.module.css 是空 stub），role 只在 copyable 时才有。
        //   内部内容是 SessionHoverContent / WorkspaceHoverContent，CSS Module hash
        //   类名 `YDXeBa_hoverContent / _hoverTitle / _hoverTime / _hoverStatus / _hoverPath`。
        //   修法：JS MutationObserver 巡检 body 直接子 div，找到含上面任一 hash
        //   类的，打 `data-dsh-ui-tweaks-hidden-hover-card` 标记；CSS 命中隐藏。
        // v0.7.3 v0.6.2 修了 HoverCard 但用户反馈"闪一下然后消失"——因为
        //   JS observer 至少要一个 microtask + 80ms throttle 才标记 + 浏览器
        //   下一帧才应用 CSS。这段窗口期用户能看到一帧的"全称 X小时前 空闲"。
        //   修法：CSS 直接命中 HoverCard 内部内容的 hash 类（_hoverContent /
        //   _hoverTitle / _hoverTime / _hoverStatus / _hoverPath 任一）→
        //   display:none!important。CSS 在 mount 时立即生效，根本不画——
        //   视觉上看不到"闪一下"。JS observer 保留作 DSH 升级 hash 变了后
        //   的兜底。
        // v0.7.4 v0.7.3 还有"窄黑框"——因为 HoverCard card div（不是内容）有
        //   自己的 CSS 类 `_card_<hash>_<line>`（当前 hash=1b2ny），CSS 内容是
        //     `position:fixed; z-index:100; width:244px; padding:12px 16px;
        //      border-radius:12px; background:#2C2C2E; box-shadow:lv3`。
        //   隐藏了 _hoverContent 内容，但 card div 本身（背景色 #2C2C2E）还在。
        //   修法：用 CSS `:has()` 找"含 _hoverContent 后代的 body 直接子 div"
        //   ——就是 card div。`:has()` 在 Chromium 105+ 可用，DSH Electron 是现代 Chromium。
        //   同时用更具体的 card class 模式（`_card_<hovercard module hash>`）
        //   做双保险。CSS 在 mount 时立即生效——彻底消除"闪"+"窄框"。
        id: "hide-sidebar-tooltip",
        name: "隐藏侧栏悬浮提示",
        description: "鼠标悬停在左侧栏会话项 / 工作窗口时弹出的深色卡片——展示会话全名 + 相对时间 + 状态（开发者用的 HoverCard），以及按钮上的简短 Tooltip 浮层。开启后全部关掉，根本用不上。",
        configKeys: { enabled: "hideSidebarTooltip", value: "hideSidebarTooltip" },
        defaults: { enabled: true, value: true },
        buildCSS: function (state) {
          if (!state.hideSidebarTooltip) return null;
          return "/* === hide-sidebar-tooltip v0.7.4 : DSH Tooltip + HoverCard (含 card div 本体) — 四层 selector === */\n" +
            // L1: DSH Tooltip 组件（@deepseek-ai/dsh-client-ui-primitives 的 Tooltip.js）
            //     渲染 <span role="tooltip"> 作为锚点的兄弟节点 inline 渲染——
            //     不 portal 到 body；className 是 undefined（CSS module stub 是空对象）。
            //     全 app 里 role="tooltip" 只在 Tooltip 组件里出现——全局干掉无副作用。
            "[role=\"tooltip\"]{display:none!important}\n" +
            // L2: HoverCard **内容** CSS module hash 类（DSH workspace 包，当前 hash 是 YDXeBa_）。
            //     隐藏 SessionHoverContent / WorkspaceHoverContent 内部元素——
            //     标题、时间、状态、路径。
            //     这是**主防线**——CSS 在 mount 时立即生效，根本不画。
            "[class*=\"_hoverContent\"],[class*=\"_hoverTitle\"],[class*=\"_hoverTime\"],[class*=\"_hoverStatus\"],[class*=\"_hoverPath\"]{display:none!important}\n" +
            // L3: HoverCard **card div 本身**——v0.7.4 新增。card div 有自己的 CSS 类
            //     `_card_<hash>_<line>`，CSS 给它 `background:#2C2C2E; box-shadow:lv3`——
            //     即使隐藏了内容（v0.7.3），card 背景框仍在——就是用户看到的"窄黑框"。
            //     用 `:has(> [class*=_hoverContent])` 找"含 hoverContent 直接子元素
            //     的 body > div"——这是 card div（content 是它的直接子元素）。
            //     `:has()` 在 Chromium 105+ 可用，DSH Electron 是现代 Chromium。
            //     这条不依赖 hash——彻底解决"窄框"问题。
            "body > div:has(> [class*=\"_hoverContent\"]){display:none!important}\n" +
            // L4: 兜底——JS observer（v0.7.1 加的 createSidebarHoverCardHider）
            //     给 portal 出来的 body > div 打 data-dsh-ui-tweaks-hidden-hover-card
            //     标记。L2/L3 失效时（DSH 升级 hash 变了 或 :has() 不支持）L4 接管——
            //     可能闪 80ms+（observer throttle），但不会完全漏。
            "[data-dsh-ui-tweaks-hidden-hover-card]{display:none!important}";
        }
      },
      {
        // v0.7.0 新增。DSH 对话顶部在 v0.1.0-rc.X 起多了"轨迹"标签页
        // （id="trajectory"）——开发者视角的模型/工具调用事件账本（turn/step/
        // tool-call 时间线 + 详细记录）。非开发者根本不需要，看了也看不懂。
        //
        // 渲染结构（DSH 源码 `dsh-client-ui-conversation/lib/client.js:7034-7047`）：
        //   tabs = [role="tablist"] 容器
        //   tabs.map(viewTab => jsx("button", { role:"tab", "aria-selected":..., children: viewTab.label }))
        //   viewTab.label = t("view.trajectory") → "轨迹"(zh) / "Trajectory"(en)
        //
        // 纯 CSS 没法匹配"按钮文本是 轨迹"—CSS 没有 :text() 选择器。
        // 解法：JS 端用 MutationObserver 巡检 [role="tablist"] 找文本匹配的按钮，
        // 给它打 data-dsh-ui-tweaks-hidden-tab="trajectory" 标记 → CSS 命中隐藏。
        // 配套副作用：如果当前 view 正是轨迹（aria-selected="true"），点击"对话"/
        // "Chat" 标签自动切回对话页——避免用户卡在轨迹视图出不来。
        //
        // v0.7.5：tab 按钮外的"Inspect" 入口也封掉——DSH 在每个工具调用
        // （edit / pwsh / read / grep / glob / bash / write 等）的 row 右上
        // 渲染一个 `<button class="*_inspectButton">`（CSS Module hash class，
        // 当前 hash=`o3BgMG` / `CY-8Ka`），点击后调 `inspectCall(callId)` →
        // `actions.setView("trajectory")`——本质也是进轨迹视图的入口。
        // 用户开 hide-trajectory-tab 的目的是"所有轨迹入口都不见"，所以
        // 这条 tweak 同时干掉两类入口：
        //   1) 顶部 tablist 的"轨迹"/"Trajectory"按钮（v0.7.0 起，JS 标记 +
        //      CSS attribute selector 命中）
        //   2) 每个工具行内的"Inspect"按钮（v0.7.5 起，CSS substring 命中
        //      `[class*="_inspectButton"]`，不依赖 hash——DSH 升级换 hash 也
        //      不需要改这里）
        // 工具行 Inspect 按钮 hover 时 `opacity:1` 的过渡（transition:opacity
        // .1s）会在 hide-trajectory-tab 关掉时正常 fade in——这里 `display:none
        // !important` 直接消失，没有 fade 闪烁窗口。
        id: "hide-trajectory-tab",
        name: "隐藏对话中的\"轨迹\"标签",
        description: "对话顶部多了一个\"轨迹\"标签——展示模型/工具调用的事件账本（开发者视角）。同时把每个工具调用行（edit / pwsh / read / grep 等）右上角的\"Inspect\"按钮也关掉——点击它也会进入轨迹视图。非开发者用不上，看着也容易困惑。开启后完全隐藏这些入口；如果当前正停在轨迹视图会自动切回对话页。",
        configKeys: { enabled: "hideTrajectoryTab", value: "hideTrajectoryTab" },
        defaults: { enabled: true, value: true },
        buildCSS: function (state) {
          if (!state.hideTrajectoryTab) return null;
          return "/* === hide-trajectory-tab v0.7.5 : 顶部 tablist 的 \"轨迹\"/\"Trajectory\" 按钮 + 每个工具行的 \"Inspect\" 按钮 === */\n" +
            // 顶部 tablist 的"轨迹"/"Trajectory" 按钮——JS observer 标记 + CSS attribute selector 命中。
            // 纯 CSS 没法匹配"按钮文本是 轨迹"—CSS 没有 :text() 选择器；JS observer 巡检
            // [role="tablist"] 找文本匹配按钮打标记，CSS 命中隐藏。
            "[data-dsh-ui-tweaks-hidden-tab=\"trajectory\"]{display:none!important}\n" +
            // v0.7.5 新增：每个工具调用 row 内的"Inspect"按钮——
            // DSH 源码 `dsh-client-ui-tool/lib/client.js` 中 ToolRow / BashRow
            // 渲染 `<button class="*_inspectButton">`，点击后调
            // `inspectCall(callId)` → `actions.setView("trajectory")` ——也是
            // 进入轨迹视图的入口。substring match `_inspectButton` 不依赖 hash，
            // DSH 升级换 hash 仍然命中。
            "[class*=\"_inspectButton\"]{display:none!important}";
        }
      },
      {
        // v0.7.2 新增。和 hide-trajectory-tab 配套——两个 tab 按钮都关掉后，
        // tablist 整体视觉上消失（DSH `tabs.length > 1` 才渲染 tablist——
        // 但 DSH 仍注册 2 个 view entry，所以 tablist DOM 还在，只是两个按钮
        // 都被 display:none）。
        //
        // 单独开 hide-chat-tab 也有意义：默认 view 永远是"对话"，标签按钮
        // 显示"对话"毫无信息量（用户看到它也不会做任何事）——纯视觉噪音。
        // 开启后整个 tablist 视觉消失（前提是也开了 hide-trajectory-tab）。
        //
        // 实现和 trajectory hider 一样：JS 端用通用 createTabHider 工厂（v0.7.2
        // 重构了 createTrajectoryTabHider 为 createTabHider(opts)），target="对话"，
        // safe="对话"（DSH 默认 view）——如果当前不在对话（比如用户手动切到轨迹
        // 后再开启 hide-chat-tab），强制 click 对话切回。
        id: "hide-chat-tab",
        name: "隐藏对话中的\"对话\"标签",
        description: "对话顶部\"对话\"标签——开启后和 hide-trajectory-tab 一起把两个标签都关掉，整个 tablist 视觉消失。\"对话\"是默认 view，标签显示它毫无信息量，纯噪音。如果当前正停在轨迹视图会自动切回对话页。",
        configKeys: { enabled: "hideChatTab", value: "hideChatTab" },
        defaults: { enabled: true, value: true },
        buildCSS: function (state) {
          if (!state.hideChatTab) return null;
          return "/* === hide-chat-tab v0.7.2 : JS-side MutationObserver 给 \"对话\"/\"Chat\" 按钮打 data-dsh-ui-tweaks-hidden-tab=\"chat\"，CSS 命中隐藏 === */\n" +
            "[data-dsh-ui-tweaks-hidden-tab=\"chat\"]{display:none!important}";
        }
      },
      {
        // v0.8.0 新增「回到最早消息」（v0.8.0 单击直达）。
        // v0.9.0 改为「上一条」单向上导航（v0.9.0 用 lastVisible 作锚点，
        //   短消息场景下"上数第二条"卡死——见 jumpFindPrevUserRow 注释）。
        // v0.9.1：上数第二条 bug 修复（lastVisible → topVisible）+ Shift+点击
        //   一键回到最早 + 原生「回到底部」按钮同步改为单击下一条 / Shift+点击
        //   一键到底。
        // v0.9.2：可见性放宽（rows.length >= 2 即显示，短会话也可见）+ Shift+
        //   点击跳过 compaction 块直达"当前会话第一条"（不再落到 compact
        //   摘要里的旧 user 行）。
        // 按钮形态 / 位置 / 尺寸 / ID / CSS 选择器 / 内部 path 全不变；
        // aria-label 保持单一语义「上一条我发的消息」；title 加 Shift 修饰
        // 提示供悬停时查看。
        // 按钮的挂载 / 显隐 / 定位 / 点击滚动 / 原生按钮 capture-phase 钩子
        // 由 68-first-message-jump.js 的 createFirstMessageJumpController 负责；
        // 纯 finder/scanner 函数（jumpFindScrollport / jumpAllUserRows /
        // jumpFindPrevUserRow 等）在 68a-first-message-jump-utils.js——主
        // 文件 vs 工具文件拆分是 maintainability.md 30 KB 阈值的维护动作，
        // 行为无变化（client-src/ 按文件名升序整段拼接进 bundle，函数名
        // 共享工厂函数 scope）。
        // 本 buildCSS 只输出按钮的静态样式（right/bottom 定位由 JS 每次显隐时
        // 内联设置）。
        // tweak id / localStorage key（firstMessageJump）保留向后兼容，老用户
        // 开关状态不丢。
        id: "first-message-jump",
        name: "上一条我发的消息按钮（Shift+点击 = 回到最早）",
        description: "对话区右下角悬浮按钮——单击跳到当前视口内最顶部可见 user 消息的上一条，连续单击可一路向上直到最早一条（按钮始终可见作为提示——v0.9.2 起 rows.length>=2 即显示）。Shift+单击 = 跳过 compact 摘要里的旧 user 行，直接到当前会话的第一条 user 消息（v0.9.2 起跳过 compaction / context 容器）。对称地，DSH 自带「回到底部」按钮的单击行为也被改为：单击 = 下一条 user 行，Shift+单击 = 一键到底——两个按钮都用「单击 step / Shift+单击 极限」的对称模式。",
        configKeys: { enabled: "firstMessageJump", value: "firstMessageJump" },
        defaults: { enabled: true, value: true },
        buildCSS: function (state) {
          if (!state.firstMessageJump) return null;
          return "/* === first-message-jump v0.9.2 : 上一条我发的消息按钮（单击上一条 / Shift+单击跳过 compaction 块直达当前会话第一条；样式对齐 DSH 自带「回到底部」按钮）=== */\n" +
            "[data-dsh-ui-tweaks-jump]{" +
              "position:fixed;" +
              "right:20px;" +
              "bottom:180px;" +  // 兜底初值；每次显隐时 JS 重设 right/bottom
              "width:34px;height:34px;" +
              "border-radius:100px;" +
              "border:1px solid var(--dsw-alias-border-l2,#d0d5dd);" +
              "color:var(--dsw-alias-label-primary,#111827);" +
              "background:var(--dsw-alias-button-floating-fill,#ffffff);" +
              "box-shadow:var(--dsw-shadow-lv2,0 2px 8px rgba(0,0,0,.12));" +
              "cursor:pointer;" +
              "display:flex;align-items:center;justify-content:center;" +
              "z-index:90;" +
              "padding:0;margin:0;" +
              "opacity:0;" +
              "pointer-events:none;" +
              "transform:translateY(6px);" +
              "transition:opacity .18s ease,transform .18s ease,background .12s ease;" +
            "}\n" +
            "[data-dsh-ui-tweaks-jump]:hover{" +
              "background:var(--dsw-alias-button-floating-hover,#f1f3f5);" +
            "}\n" +
            "[data-dsh-ui-tweaks-jump][data-visible]{opacity:1;pointer-events:auto;transform:translateY(0);}";
        }
      }
    ];

    // ===== storage =====
    // ====================================================================
    // localStorage 持久化（按 dsh-persistent-plugin-authoring skill §三）
    // ====================================================================

    var storage = null;
    try {
      var probeKey = STORAGE_KEY + "__probe__";
      window.localStorage.setItem(probeKey, "1");
      window.localStorage.removeItem(probeKey);
      storage = window.localStorage;
    } catch (e) {
      console.warn("[dsh-ui-tweaks] localStorage unavailable, tweaks will not persist across reloads:", e);
    }

    function defaultState() {
      var state = {};
      for (var i = 0; i < TWEAKS.length; i++) {
        var t = TWEAKS[i];
        state[t.configKeys.enabled] = t.defaults.enabled;
        state[t.configKeys.value] = t.defaults.value;
      }
      return state;
    }

    function loadState() {
      var state = defaultState();
      if (!storage) return state;
      var raw;
      try { raw = storage.getItem(STORAGE_KEY); } catch (e) { return state; }
      if (!raw) return state;
      try {
        var saved = JSON.parse(raw);
        if (saved && typeof saved === "object") {
          for (var k in saved) {
            if (Object.prototype.hasOwnProperty.call(state, k)) state[k] = saved[k];
          }
        }
      } catch (e) { /* 损坏则用默认 */ }
      return state;
    }

    function saveState(state) {
      if (!storage) return;
      try {
        var out = {};
        for (var i = 0; i < TWEAKS.length; i++) {
          var t = TWEAKS[i];
          out[t.configKeys.enabled] = state[t.configKeys.enabled];
          out[t.configKeys.value] = state[t.configKeys.value];
        }
        storage.setItem(STORAGE_KEY, JSON.stringify(out));
      } catch (e) { /* 静默 */ }
    }

    // ===== styles =====
    // ====================================================================
    // CSS 注入
    // ====================================================================

    function buildCSS(state) {
      var blocks = [];
      for (var i = 0; i < TWEAKS.length; i++) {
        var css = TWEAKS[i].buildCSS(state);
        if (css) blocks.push(css);
      }
      // 调试高亮的 CSS 单独生成（依赖 shiftPx）
      var debugBlock = buildDebugHighlightCSS(state);
      if (debugBlock) blocks.push(debugBlock);
      return blocks.join("\n\n");
    }

    /** 调试高亮 CSS（4px 黄色 outline + 浮动 label）。只有 conversationShiftDebug 开启时输出。 */
    function buildDebugHighlightCSS(state) {
      if (!state.conversationShiftDebug) return null;
      var px = Number(state.conversationShiftPx);
      if (!isFinite(px) || px < 0) px = 380;
      if (px > 800) px = 800;
      var labelText = "DSH UI TWEAKS · 对话内容 · 当前右缩 " + px + "px (debug)";
      return [
        "/* === conversation-shift-debug : 高亮 JS 探测标记的元素 === */",
        "html[data-dsh-ui-tweaks-shift-debug] [" + SHIFT_TARGET_ATTR + "]{",
        "  outline:4px solid #facc15 !important;",
        "  outline-offset:-4px;",
        "  box-shadow:inset 0 0 0 1px rgba(0,0,0,.5) !important;",
        "  position:relative !important;",
        "}",
        "html[data-dsh-ui-tweaks-shift-debug] [" + SHIFT_TARGET_ATTR + "]::before{",
        "  content:\"" + labelText + "\";",
        "  position:absolute;",
        "  top:-22px;",
        "  left:0;",
        "  background:#000;",
        "  color:#fff;",
        "  font:600 11px/20px ui-monospace,Menlo,Consolas,monospace;",
        "  padding:1px 8px;",
        "  border-radius:4px;",
        "  white-space:nowrap;",
        "  z-index:99999;",
        "  pointer-events:none;",
        "}"
      ].join("\n");
    }

    function injectCSS(state) {
      var old = document.querySelector("style[data-plugin-css=\"" + MAIN_CSS_TAG_ID + "\"]");
      if (old) old.remove();
      var css = buildCSS(state);
      if (!css) return;
      var tag = document.createElement("style");
      tag.dataset.plugin = "dsh-ui-tweaks";
      tag.dataset.pluginCss = MAIN_CSS_TAG_ID;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    /**
     * Section 样式。注入一次。
     *
     * 设计选择（v0.5.1）：
     *  - switch 用显式颜色作为 fallback（不依赖 `--dsw-alias-bg-component-disabled`，
     *    在某些 DSH 主题下变量值接近背景色导致开关看不见）。fallback 链：
     *    `var(--dsw-alias-bg-component-disabled, #cbd5e1)`。
     *  - input 不再用 :disabled 样式（v0.5.1 起永远不 disabled）。
     *  - 移除 .DTPD_actionsRow / .DTPD_btn 样式（按钮已去掉）。
     *
     * v0.7.5：description 从 `<p>` 收进 `title` 属性后，row 默认不再渲染描述——
     * 给 `.DTPD_item` 加 `cursor:help` 提示可悬停看说明；同时删除
     * `.DTPD_itemDesc` 规则（不再被任何 JSX 引用）。
     */
    var SECTION_CSS =
      ".DTPD_section{max-width:760px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:18px;display:flex}\n" +
      ".DTPD_section h2{margin:0;font-size:18px;font-weight:600}\n" +
      ".DTPD_intro{color:var(--dsw-alias-label-tertiary);margin:0 0 4px;font-size:13px}\n" +
      ".DTPD_list{flex-direction:column;gap:10px;margin:0;padding:0;list-style:none;display:flex}\n" +
      // v0.7.5：cursor:help 提示"悬停可看 description"——description 移到 <li title=...>
      ".DTPD_item{cursor:help;box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;flex-direction:column;gap:8px;padding:14px 16px;display:flex}\n" +
      ".DTPD_itemHead{flex-direction:row;justify-content:space-between;align-items:center;gap:12px;display:flex}\n" +
      ".DTPD_itemName{margin:0;font-size:14px;font-weight:500;line-height:22px}\n" +
      // v0.7.5：.DTPD_itemDesc 规则移除——description 改用 HTML title，不渲染 <p>
      ".DTPD_switch{appearance:none;-webkit-appearance:none;cursor:pointer;width:36px;height:22px;background:var(--dsw-alias-bg-component-disabled,#cbd5e1);border:1px solid var(--dsw-alias-border-l2,#94a3b8);border-radius:999px;position:relative;transition:background .15s ease;flex:none;margin:0;padding:0}\n" +
      ".DTPD_switch:checked{background:var(--dsw-alias-state-business-primary,#2563eb)}\n" +
      ".DTPD_switch::after{content:\"\";position:absolute;top:1px;left:1px;width:18px;height:18px;background:var(--dsw-alias-bg-layer-1,#fff);border-radius:50%;transition:transform .15s ease;box-shadow:0 1px 2px rgba(0,0,0,.18)}\n" +
      ".DTPD_switch:checked::after{transform:translateX(14px)}\n" +
      ".DTPD_valueRow{align-items:center;gap:8px;display:flex}\n" +
      ".DTPD_valueLabel{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;min-width:64px}\n" +
      ".DTPD_input{box-sizing:border-box;width:120px;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-input-major,#fff);border:1px solid var(--dsw-alias-border-l2,#94a3b8);border-radius:6px;padding:4px 8px;font-family:inherit;font-size:13px;line-height:20px}\n" +
      ".DTPD_input:focus{border-color:var(--dsw-alias-state-business-primary,#2563eb);outline:none}";

    function injectSectionCSS() {
      if (document.querySelector("style[data-plugin-css=\"" + SECTION_CSS_TAG_ID + "\"]")) return;
      var tag = document.createElement("style");
      tag.dataset.plugin = "dsh-ui-tweaks";
      tag.dataset.pluginCss = SECTION_CSS_TAG_ID;
      tag.textContent = SECTION_CSS;
      document.head.appendChild(tag);
    }

    // ===== shim =====
    // ====================================================================
    // Self-shim：自己种 data-pane="conversation" 属性
    // 4 层 selector 策略，按可信度递减
    // ====================================================================

    /**
     * 找 AppFrame（grid 容器）的 3 个 grid 子元素：sidebar / center / details。
     * 通过 gridTemplateColumns 解析 + 子元素位置判断。
     * 返回 { frame, sidebar, center, details }；找不到则字段为 null。
     */
    function discoverFrameTriptych() {
      if (typeof document === "undefined") return null;
      // 策略 A：已知类名后缀（DSH 当前版本）
      var sidebarA = document.querySelector('[class*="sidebarCol"]');
      var centerA = document.querySelector('[class*="centerCol"]');
      var detailsA = document.querySelector('[class*="detailsCol"]');
      if (sidebarA && centerA && detailsA) {
        return { frame: sidebarA.parentElement, sidebar: sidebarA, center: centerA, details: detailsA };
      }
      // 策略 B：解析 grid-template-columns，找含 minmax(0, 1fr) 的 grid + 3 个子元素
      var grids = document.querySelectorAll('div');
      for (var i = 0; i < grids.length; i++) {
        var g = grids[i];
        var style = window.getComputedStyle ? window.getComputedStyle(g) : null;
        if (!style || style.display !== 'grid') continue;
        // 必须是 3 列 grid
        var cols = style.gridTemplateColumns;
        if (!cols) continue;
        var parts = cols.split(/\s+/);
        if (parts.length !== 3) continue;
        // 中间一列必须是 minmax(0, 1fr) 这种弹性单位
        if (!/minmax\(0,\s*1fr\)|1fr/.test(parts[1])) continue;
        var kids = Array.from(g.children);
        if (kids.length < 3) continue;
        // 按 grid-column 隐式分配：第一个是 sidebar，中间是 center，最后是 details
        return { frame: g, sidebar: kids[0], center: kids[1], details: kids[2] };
      }
      return null;
    }

    /** 找到 conversation 列元素（4 层 fallback）。返回 null 表示完全没找到。 */
    function findConversationPane() {
      // L1: 自己或外部已种的 data-pane="conversation"
      var l1 = document.querySelector('[' + SHIM_PANE_ATTR + '="' + SHIM_PANE_VALUE + '"]');
      if (l1) return { el: l1, layer: "L1" };
      // L2: CSS Module 类名后缀（DSH 当前版本：pI_x6G_centerCol）
      var l2 = document.querySelector('[class*="centerCol"]');
      if (l2) return { el: l2, layer: "L2" };
      // L3: grid 中间列（不依赖 class 名）
      var trip = discoverFrameTriptych();
      if (trip && trip.center) return { el: trip.center, layer: "L3" };
      // L4: 保底，未来 DSH 可能自加 data-pane-shell="conversation"——目前没找到元素
      return { el: null, layer: "L4-miss" };
    }

    /** 在元素上种属性（已种则跳过）。 */
    function stampIfMissing(el, name, value) {
      if (!el) return false;
      if (el.getAttribute && el.getAttribute(name) === value) return false;
      el.setAttribute(name, value);
      return true;
    }

    /** 应用 self-shim：找到 conversation 列并种 data-pane 属性。返回解析层（用于诊断）。 */
    function applyShellShim() {
      var found = findConversationPane();
      if (!found.el) {
        if (typeof console !== "undefined" && console.debug) {
          console.debug("[dsh-ui-tweaks] shell shim: 0 strategies matched — conversation column not found");
        }
        return null;
      }
      // 1) 给 conversation 列种 data-pane
      stampIfMissing(found.el, SHIM_PANE_ATTR, SHIM_PANE_VALUE);
      // 2) 顺便给整个 AppFrame 也种一下（L4 兜底，同时方便其它插件识别）
      var trip = discoverFrameTriptych();
      if (trip) {
        if (trip.frame) stampIfMissing(trip.frame, SHELL_FRAME_ATTR, SHELL_FRAME_VALUE);
        if (trip.sidebar) stampIfMissing(trip.sidebar, SHIM_PANE_ATTR, SHELL_SIDEBAR_ATTR_VALUE);
        if (trip.details) stampIfMissing(trip.details, SHIM_PANE_ATTR, SHELL_DETAILS_ATTR_VALUE);
      }
      if (typeof console !== "undefined" && console.debug) {
        console.debug("[dsh-ui-tweaks] shell shim resolved via " + found.layer);
      }
      return found;
    }

    /**
     * 启动 self-shim MutationObserver。DSH React 重渲会 unmount/remount
     * grid 子树，需要重新种属性。
     */
    function startShellShimObserver() {
      if (typeof MutationObserver === "undefined" || typeof document === "undefined") return;
      var observer = new MutationObserver(function () {
        // v0.5.5 patch：self-shim 重跑时顺便跑一次 chatflow 探测。
        // 原因：startChatflowMarksObserver 在 apply() 时如果 centerCol 还没
        //   渲染就会找不到 col 而静默失败，DSH React 后续渲染 centerCol
        //   时没人去探测 chatflow 容器。self-shim observer 启动早且观察
        //   body subtree，必然能捕获后续所有变化——是 chatflow 探测的兜底。
        // 配合 applyChatflowShiftMarks v0.5.5 幂等性：已是最优标记就跳过
        //   重打，不会破坏 v0.5.4 修过的"来回弹"循环。
        applyShellShim();
        applyChatflowShiftMarks();
      });
      try {
        observer.observe(document.body, { childList: true, subtree: true });
      } catch (e) {
        // 静默：极端情况下（如 document.body 还没准备好）不报错
      }
      return observer;
    }

    // ===== chatflow-marks =====
    // ====================================================================
    // v0.5.3 + v0.5.5：动态探测 chatflow 容器 + 输入框，打标记给 CSS 命中
    // --------------------------------------------------------------------
    // 背景：v0.5.2 用 `> *` 选择器假设 centerCol 直接子元素是 chatflow 容器
    //   ——实测 DSH centerCol 实际 DOM 结构可能更深（chatflow 可能在子级的子级，
    //   或用 portal 渲染），`> *` 命中 0 个元素 → 对话"根本不移动"。
    // v0.5.3 解法：JS 探测实际 DOM，找到真正的 chatflow 容器和输入框，
    //   给它们打 data 属性标记；CSS 只命中被标记的元素。探测失败时回退
    //   给 centerCol 列容器打标记（v0.5.1 行为兜底）。
    // ====================================================================

    /**
     * 在 centerCol 列容器内探测 chatflow 容器和输入框。
     * 探测策略：
     *   chatflow：含 [data-chat-flow-kind] 节点的 overflow:auto/scroll 容器
     *     （典型 DSH chatflow 滚动容器；overscroll-behavior 也可能命中但少见）
     *   inputArea：contenteditable=true / textarea / role=textbox 的最近祖先
     * 返回 { chatflow, input, found }；任一找到即为 found=true。
     */
    function findChatflowTargets(centerColEl) {
      if (!centerColEl || typeof document === "undefined") {
        return { chatflow: null, input: null, found: false };
      }

      // 策略 1: chatflow 容器（overflow 容器 + 含 [data-chat-flow-kind]）
      var chatflow = null;
      var all = centerColEl.querySelectorAll("*");
      for (var i = 0; i < all.length; i++) {
        var n = all[i];
        var cs = window.getComputedStyle ? window.getComputedStyle(n) : null;
        if (!cs) continue;
        var ovY = cs.overflowY;
        var ov = cs.overflow;
        if ((ovY === "auto" || ovY === "scroll" || ov === "auto" || ov === "scroll") &&
            n.querySelector("[data-chat-flow-kind]")) {
          chatflow = n;
          break;
        }
      }

      // 策略 2: inputArea
      var input = null;
      var inputNode = centerColEl.querySelector(
        '[contenteditable="true"], textarea, [role="textbox"]'
      );
      if (inputNode) {
        input = inputNode;
        while (input && input.parentElement && input.parentElement !== centerColEl) {
          input = input.parentElement;
        }
        if (!input || input.parentElement !== centerColEl) input = null;
      }

      return {
        chatflow: chatflow,
        input: input,
        found: !!(chatflow || input)
      };
    }

    /**
     * 探测 + 标记：清理旧标记，按探测结果给元素打 data-dsh-ui-tweaks-shift-target。
     *   - 探测成功 → chatflow 元素打 "chatflow" / inputArea 打 "input"
     *   - 探测失败 → centerCol 列容器打 "column"（v0.5.1 行为兜底）
     *
     * v0.5.5 幂等性：检查现有标记是否和探测结果一致，一致就跳过重打。
     *   避免在 self-shim observer（高频触发）回调里反复清理 + 重打标记
     *   ——v0.5.4 已修了"来回弹"循环，这里不能倒退回去。
     * 返回探测结果。MutationObserver 在 DSH React 重渲时再次调用。
     */
    function applyChatflowShiftMarks() {
      if (typeof document === "undefined") return null;
      // 找 centerCol 列容器（self-shim 已种 data-pane，或用类名兜底）
      var col = document.querySelector(
        "[" + SHIM_PANE_ATTR + '="' + SHIM_PANE_VALUE + '"]'
      ) || document.querySelector('[class*="centerCol"]');
      if (!col) return null;

      // 先探测（不动 DOM，只算结果）
      var found = findChatflowTargets(col);

      // v0.5.5 幂等性检查：现有标记和探测结果一致就不重打
      var existingMarks = col.querySelectorAll("[" + SHIFT_TARGET_ATTR + "]");
      var existingColMark = col.getAttribute(SHIFT_TARGET_ATTR);
      var needUpdate = false;

      if (found.found) {
        // 期望：chatflow / input 打标记，col 本身不打
        if (existingColMark) needUpdate = true;
        if (found.chatflow && (
            !found.chatflow.hasAttribute(SHIFT_TARGET_ATTR) ||
            found.chatflow.getAttribute(SHIFT_TARGET_ATTR) !== SHIFT_TARGET_CHATFLOW
          )) needUpdate = true;
        if (found.input && (
            !found.input.hasAttribute(SHIFT_TARGET_ATTR) ||
            found.input.getAttribute(SHIFT_TARGET_ATTR) !== SHIFT_TARGET_INPUT
          )) needUpdate = true;
        // 旧标记不在期望位置（被 DSH React unmount 的元素）也算需要更新
        for (var i = 0; i < existingMarks.length; i++) {
          var m = existingMarks[i];
          if (m === col) continue; // col 自身的标记由上面的 existingColMark 判断
          if (found.chatflow && m === found.chatflow) continue;
          if (found.input && m === found.input) continue;
          // m 是孤儿标记（指向的元素已经被 DSH 卸载）
          needUpdate = true;
          break;
        }
      } else {
        // 期望：col 自身打 "column" 标记
        if (!existingColMark || existingColMark !== SHIFT_TARGET_COLUMN) needUpdate = true;
        for (var j = 0; j < existingMarks.length; j++) {
          if (existingMarks[j] !== col) { needUpdate = true; break; }
        }
      }

      if (!needUpdate) {
        // 已是最优标记——不重打，避免破坏 v0.5.4 修过的"来回弹"
        return found;
      }

      // 需要更新：清理旧标记
      for (var k = 0; k < existingMarks.length; k++) {
        existingMarks[k].removeAttribute(SHIFT_TARGET_ATTR);
      }
      if (existingColMark) col.removeAttribute(SHIFT_TARGET_ATTR);

      // 打新标记
      if (found.found) {
        if (found.chatflow) {
          found.chatflow.setAttribute(SHIFT_TARGET_ATTR, SHIFT_TARGET_CHATFLOW);
        }
        if (found.input) {
          found.input.setAttribute(SHIFT_TARGET_ATTR, SHIFT_TARGET_INPUT);
        }
      } else {
        // 兜底：标记列容器
        col.setAttribute(SHIFT_TARGET_ATTR, SHIFT_TARGET_COLUMN);
      }

      if (typeof console !== "undefined" && console.debug) {
        console.debug("[dsh-ui-tweaks] chatflow shift marks:", {
          found: found.found,
          updated: true,
          chatflow: found.chatflow
            ? found.chatflow.tagName + "." +
              (typeof found.chatflow.className === "string"
                ? found.chatflow.className
                : "(svg/other)")
            : null,
          input: found.input
            ? found.input.tagName + "." +
              (typeof found.input.className === "string"
                ? found.input.className
                : "(svg/other)")
            : null,
          fallbackColumn: !found.found
        });
      }

      return found;
    }

    /**
     * v0.5.3 + v0.5.4：chatflow 标记的 MutationObserver。
     * **只观察 centerCol 的直接子元素变化**（不观察 subtree），且**只在已标记的
     * chatflow / input 元素被 unmount/remount 时才重新探测**。
     *
     * 之前的实现：观察 body + subtree=true → DSH React 在 chatflow 内部每次
     *   重渲（消息增删、状态更新、thinking 状态切换等）都会触发 → 清理旧标记
     *   → 重新打标记 → 配合 transition: padding-right .22s ease 产生"来回弹"
     *   视觉循环（用户反馈"一致向中间拉过去，然后又会弹回去"）。
     *
     * 现在的实现：观察范围收窄到 centerCol 直接子元素；只在"被替换的节点
     *   是已标记的 chatflow / input 元素"时才重新探测。DSH chatflow 内部
     *   的 React 重渲不会触发——标记元素没被换掉，不需要重新打。
     *
     * 注意：v0.5.5 把 self-shim observer 也加进 applyChatflowShiftMarks 触发了，
     *   所以这个 observer 只针对"centerCol 直接子元素被 unmount/remount"
     *   这种局部事件——避免和 self-shim observer 全局观察重复触发。
     */
    var chatflowMarksObserver = null;
    function startChatflowMarksObserver() {
      if (chatflowMarksObserver !== null) return chatflowMarksObserver; // 单例
      if (typeof MutationObserver === "undefined" || typeof document === "undefined") return null;
      // 找当前 centerCol 列容器（self-shim 已种 data-pane 或类名兜底）
      var col = document.querySelector(
        "[" + SHIM_PANE_ATTR + '="' + SHIM_PANE_VALUE + '"]'
      ) || document.querySelector('[class*="centerCol"]');
      if (!col) return null;

      chatflowMarksObserver = new MutationObserver(function (mutations) {
        // 只在 addedNodes / removedNodes 里出现带 SHIFT_TARGET_ATTR 标记的元素时才重跑
        // ——说明 chatflow 容器或 inputArea 被 unmount/remount
        var needsReshim = false;
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          if (m.type !== "childList") continue;
          // 检查 addedNodes
          for (var k = 0; k < m.addedNodes.length; k++) {
            var n = m.addedNodes[k];
            if (n.nodeType !== 1) continue;
            // 新加的节点本身是标记元素 OR 包含标记元素
            if (n.hasAttribute && n.hasAttribute(SHIFT_TARGET_ATTR)) {
              needsReshim = true;
              break;
            }
            if (n.querySelector && n.querySelector("[" + SHIFT_TARGET_ATTR + "]")) {
              needsReshim = true;
              break;
            }
          }
          if (needsReshim) break;
          // 检查 removedNodes
          for (var k2 = 0; k2 < m.removedNodes.length; k2++) {
            var rn = m.removedNodes[k2];
            if (rn.nodeType === 1 && rn.hasAttribute && rn.hasAttribute(SHIFT_TARGET_ATTR)) {
              needsReshim = true;
              break;
            }
          }
          if (needsReshim) break;
        }
        if (!needsReshim) return;
        // throttle：避免短时间内反复探测
        if (chatflowMarksObserver._pending) return;
        chatflowMarksObserver._pending = true;
        (typeof window !== "undefined" && window.setTimeout)
          ? window.setTimeout(function () {
              chatflowMarksObserver._pending = false;
              applyChatflowShiftMarks();
            }, 80)
          : applyChatflowShiftMarks();
      });
      try {
        // 只观察 centerCol 的直接子元素变化（不观察 subtree）——
        // DSH React 在 chatflow 内部重渲不会触发，只有 chatflow / inputArea
        // 本身被替换时才会触发
        chatflowMarksObserver.observe(col, { childList: true });
      } catch (e) {
        // 静默
      }
      return chatflowMarksObserver;
    }

    // ===== debug =====
    // ====================================================================
    // 调试高亮：toggle <html> 属性 + 给命中元素写 data-shift-px
    // ====================================================================

    function inspectMatch(selector) {
      if (typeof document === "undefined") return { selector: selector, found: false };
      var el = document.querySelector(selector);
      if (el === null) return { selector: selector, found: false };
      var cs = (typeof window !== "undefined" && window.getComputedStyle) ? window.getComputedStyle(el) : null;
      var rect = (typeof el.getBoundingClientRect === "function") ? el.getBoundingClientRect() : null;
      return {
        selector: selector,
        found: true,
        tagName: el.tagName,
        className: typeof el.className === "string" ? el.className : "",
        offsetWidth: el.offsetWidth,
        offsetHeight: el.offsetHeight,
        paddingRight: cs ? cs.paddingRight : "",
        boxSizing: cs ? cs.boxSizing : "",
        position: cs ? cs.position : "",
        display: cs ? cs.display : "",
        rect: rect ? { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) } : null
      };
    }

    /**
     * 切调试高亮 + 把当前 px 值写到命中元素上（让 ::before label 显出来）。
     * @param enabled 调试模式开关
     * @param shiftEnabled 对话右缩开关（label 文案区分两种状态）
     * @param shiftPx 当前右缩像素值
     */
    function applyDebugMode(enabled, shiftEnabled, shiftPx) {
      if (typeof document === "undefined") return;
      if (enabled) {
        document.documentElement.setAttribute(DEBUG_HTML_ATTR, "");
        // v0.5.3 起：写到 JS 探测标记的元素 [data-dsh-ui-tweaks-shift-target] 上
        var nodes = document.querySelectorAll('[' + SHIFT_TARGET_ATTR + ']');
        for (var i = 0; i < nodes.length; i++) {
          nodes[i].setAttribute("data-shift-px", String(shiftPx || 0));
        }
        try {
          console.info("[dsh-ui-tweaks] conversation-shift-debug matched elements (JS 探测标记的元素):", [
            inspectMatch('[' + SHIFT_TARGET_ATTR + ']')
          ]);
        } catch (e) { /* 静默 */ }
      } else {
        document.documentElement.removeAttribute(DEBUG_HTML_ATTR);
      }
    }

    // ===== simple-mode =====
    // ====================================================================
    // 简洁模式：状态行 DOM controller（从原 dsh-simple-mode/lib/client.js 移植）
    // ====================================================================

    function simpleActivityText(name) {
      if (!name) return "正在处理…";
      if (name === "think" || (typeof name === "string" && name.indexOf("reason") === 0)) return "正在思考…";
      if (name === "read" || name === "web_fetch") return "正在阅读…";
      if (name === "web_search") return "正在搜索…";
      if (name === "edit" || name === "write") return "正在修改文件…";
      if (name === "grep" || name === "glob") return "正在查找…";
      if (name === "bash" || name === "pwsh" || name === "run_code") return "正在执行命令…";
      // 子 agent / 任务调度——不细分工具名（task / subagent / agent），统一文案即可
      if (name === "task" || name === "subagent" || name === "agent") return "正在调度子任务…";
      // 待办 / 计划类（todo / plan / update_plan）——内部细节差异不影响用户视角
      if (name === "todo" || name === "plan" || name === "update_plan") return "正在整理计划…";
      // 代码智能查询——LSP 类工具用户能识别即可
      if (name === "lsp" || name === "intellisense") return "正在查询代码…";
      // goal / objective 类工具（DSH 目标/任务跟踪）
      if (name === "goal" || name === "objective") return "正在处理目标…";
      // git / commit / push ——代码版本控制
      if (name === "commit" || name === "git") return "正在提交代码…";
      if (name === "push") return "正在推送…";
      return "正在处理…";
    }

    function simplePickToolNameFromDom() {
      if (typeof document === "undefined") return null;
      var nodes = document.querySelectorAll('[data-chat-flow-kind="tool-call"]');
      if (nodes.length === 0) return null;
      var last = nodes[nodes.length - 1];
      var named = last.querySelector("[data-tool-name]");
      if (named) {
        var dn = named.getAttribute("data-tool-name");
        if (dn) return dn;
      }
      var named2 = last.querySelector("[data-name]");
      if (named2) {
        var dn2 = named2.getAttribute("data-name");
        if (dn2) return dn2;
      }
      var labels = last.querySelectorAll('[class*="toolName"], [class*="toolLabel"]');
      for (var i = 0; i < labels.length; i++) {
        var t = (labels[i].textContent || "").trim();
        if (t) return t;
      }
      return null;
    }

    function simpleIsRunningFromDom() {
      if (typeof document === "undefined") return false;
      return document.querySelector(SIMPLE_TURN_STATUS_SEL) !== null;
    }

    function createSimpleModeStatusController() {
      var current = null;
      var turnObserver = null;
      var intervalId = null;
      var lastTurnStatus = null;
      // 暴露给 apply() 读取的运行状态——避免外部另起 `_running` 标志导致状态
      // 不一致（apply() 的 onStateChange 用 simpleController.running 读判断，
      // 与 createTrajectoryTabHider 的 `get running()` 风格对齐）。
      var isRunning = false;
      // 缓存上次写入 span 的文本——tick 每 250ms 跑一次，但 99% 时间工具名没变，
      // 不写 DOM 就不会触发 React reconciler 监听 attribute / textContent 变化。
      var lastText = null;

      function ensureStatusSpan() {
        if (typeof document === "undefined") return null;
        var existing = document.getElementById(SIMPLE_STATUS_ID);
        if (existing !== null) return existing;
        var span = document.createElement("span");
        span.id = SIMPLE_STATUS_ID;
        span.className = SIMPLE_STATUS_CLASS;
        span.textContent = "正在处理…";
        return span;
      }

      function findTurnStatus() {
        if (typeof document === "undefined") return null;
        var nodes = document.querySelectorAll(SIMPLE_TURN_STATUS_SEL);
        // 倒序遍历——文档顺序里最新 turn 在最后。当前正在运行的 turn 的 status
        // 元素会一直被 DSH 重渲保持在 DOM 末尾；历史已结束 turn 的 status 元素
        // 同样含 turnStatus 类但排在前。取最后一个可以确保状态行只注入当前 turn,
        // 滚动到上方看历史对话时不会被错误地注入到旧 turn 上。
        for (var i = nodes.length - 1; i >= 0; i--) {
          var el = nodes[i];
          if (el.querySelector("#" + SIMPLE_STATUS_ID) !== null) continue;
          return el;
        }
        return null;
      }

      function attach() {
        if (typeof document === "undefined") return;
        // 已经在 attach 到当前 turnStatus——watchTurnStatus 的 MutationObserver
        // 会负责把 span 重新挂回去（DSH 偶尔会把它 detach），不需要每 250ms 重新
        // 跑 findTurnStatus + ensureStatusSpan + appendChild。tick 高频轮询下
        // 跳过这些 DOM 操作显著降低开销。
        if (current !== null) {
          var existing = document.getElementById(SIMPLE_STATUS_ID);
          if (existing !== null && existing.parentNode !== null) return;
        }
        var turnStatus = findTurnStatus();
        if (turnStatus === null) { current = null; return; }
        if (turnStatus !== lastTurnStatus) {
          lastTurnStatus = turnStatus;
          watchTurnStatus(turnStatus);
        }
        var span = ensureStatusSpan();
        if (span.parentNode !== turnStatus) turnStatus.appendChild(span);
        current = turnStatus;
      }

      function detach() {
        if (typeof document === "undefined") return;
        var span = document.getElementById(SIMPLE_STATUS_ID);
        if (span !== null && span.parentNode !== null) span.parentNode.removeChild(span);
      }

      function watchTurnStatus(el) {
        if (turnObserver !== null) { turnObserver.disconnect(); turnObserver = null; }
        if (typeof MutationObserver === "undefined") return;
        turnObserver = new MutationObserver(function () {
          if (typeof document === "undefined") return;
          var span = document.getElementById(SIMPLE_STATUS_ID);
          if (span === null) return;
          if (span.parentNode !== el) el.appendChild(span);
        });
        turnObserver.observe(el.parentNode || document.body, { childList: true, subtree: false });
      }

      function tick() {
        if (typeof document === "undefined") return;
        if (!simpleIsRunningFromDom()) {
          if (current !== null) { detach(); current = null; }
          lastText = null;
          return;
        }
        attach();
        var span = document.getElementById(SIMPLE_STATUS_ID);
        if (span === null) return;
        var text = simpleActivityText(simplePickToolNameFromDom());
        // 文字未变就跳过 setTextContent——tick 每 250ms 跑，绝大多数 tick
        // 工具名不变，写 DOM 触发 mutation listeners 是浪费。
        if (text === lastText) return;
        lastText = text;
        span.textContent = text;
      }

      function start() {
        if (typeof window === "undefined") return;
        if (intervalId !== null) return;
        isRunning = true;
        intervalId = window.setInterval(tick, SIMPLE_POLL_MS);
        tick();
      }
      function stop() {
        if (intervalId !== null) { window.clearInterval(intervalId); intervalId = null; }
        if (turnObserver !== null) { turnObserver.disconnect(); turnObserver = null; }
        detach();
        current = null;
        lastTurnStatus = null;
        lastText = null;
        isRunning = false;
      }
      return {
        start: start,
        stop: stop,
        get running() { return isRunning; }
      };
    }

    // ===== tab-hider =====
    // ====================================================================
    // v0.7.0 + v0.7.2：通用 tab hider 工厂（hide-trajectory-tab + hide-chat-tab 副作用）
    // --------------------------------------------------------------------
    // DSH 对话顶部有 [role="tablist"] 包含 "对话"(Chat) + "轨迹"(Trajectory)
    // 两个标签（renderSlot("conversation.view", ...) 注册的两个 view entry）。
    // 用户点击"轨迹"会进入 TrajectoryView——开发者视角的事件账本。
    //
    // v0.7.2 重构：原 createTrajectoryTabHider 拆成通用 createTabHider(opts)
    // 工厂——`{ targetLabels, hiddenValue, safeLabels }`——两个 tweak 都用。
    //   - hide-trajectory-tab：target="轨迹", safe="对话"
    //   - hide-chat-tab：      target="对话", safe="对话"
    // safe 都是"对话"（DSH 默认 view）——避免两个 tab 都被关掉后用户卡在轨迹。
    //
    // controller 职责：
    //   1. 巡检 [role="tablist"] 内按钮文本，找到 targetLabels 匹配的按钮，
    //      打 data-dsh-ui-tweaks-hidden-tab=<hiddenValue> 标记（CSS 命中隐藏）
    //   2. 如果 safeLabels 匹配的"安全 tab"当前不是 aria-selected="true"——
    //      程序点击它（即使被 CSS display:none，click 仍能触发 React setView），
    //      确保 view 在默认对话页，避免用户卡在轨迹视图
    //
    // MutationObserver 观察 document.body 子树——DSH React 重渲或切换会话
    // 会重建 tablist，必须重新巡检。
    // ====================================================================

    // 多语言匹配集合。DSH 用 zh / en 两种 UI 语言；其它 locale 暂不支持。
    var TRAJECTORY_TAB_LABELS = ["轨迹", "Trajectory"];
    var CHAT_TAB_LABELS = ["对话", "Chat"];
    var TRAJECTORY_TAB_HIDDEN_ATTR = "data-dsh-ui-tweaks-hidden-tab";

    function findTabButtonByLabels(labels) {
      if (typeof document === "undefined") return null;
      var tabs = document.querySelectorAll('[role="tablist"] [role="tab"]');
      for (var i = 0; i < tabs.length; i++) {
        var text = (tabs[i].textContent || "").trim();
        for (var j = 0; j < labels.length; j++) {
          if (text === labels[j]) return tabs[i];
        }
      }
      return null;
    }

    /**
     * v0.7.0 起的通用 tab hider 工厂。负责两件事：
     *   1. 给目标 tab 按钮打 data-dsh-ui-tweaks-hidden-tab=<hiddenValue> 标记
     *      → CSS 命中隐藏
     *   2. 确保"安全 tab"始终是当前选中的——避免两个 tab 都被隐藏时用户
     *      卡在某个非默认 view 上出不来。安全 tab 在 DSH 里就是 Chat
     *      （default view）。
     *
     * 用法：
     *   - hide-trajectory-tab：
     *       targetLabels = ["轨迹", "Trajectory"]
     *       hiddenValue = "trajectory"
     *       safeLabels = ["对话", "Chat"]
     *     行为：标记轨迹 tab 隐藏；如果轨迹被选中（用户之前手动切到轨迹
     *     视图），点击对话 tab 切回——避免两个 tab 都关后用户卡在轨迹。
     *
     *   - hide-chat-tab：
     *       targetLabels = ["对话", "Chat"]
     *       hiddenValue = "chat"
     *       safeLabels = ["对话", "Chat"]   // 同 target（chat 是 default）
     *     行为：标记对话 tab 隐藏；如果对话不是当前选中的（即用户在轨迹
     *     视图），点击对话 tab 切回——同上原因。
     *
     * safeLabels 之所以设成"对话"而不是"轨迹"——chat 是 DSH 默认 view，
     * hide-trajectory + hide-chat 一起开时，安全的归宿就是 chat（即使两个
     * tab 按钮都不可见，程序 click 仍能切 view）。
     */
    function createTabHider(opts) {
      var observer = null;
      var isRunning = false;

      function tick() {
        if (typeof document === "undefined") return;

        // 1) 标记目标 tab 隐藏
        var target = findTabButtonByLabels(opts.targetLabels);
        if (target && target.getAttribute(TRAJECTORY_TAB_HIDDEN_ATTR) !== opts.hiddenValue) {
          target.setAttribute(TRAJECTORY_TAB_HIDDEN_ATTR, opts.hiddenValue);
        }

        // 2) 确保安全 tab 始终是当前选中（即使其按钮被 CSS display:none，
        //    程序 click 仍能触发 React 的 setView，切 view）
        var safe = findTabButtonByLabels(opts.safeLabels);
        if (safe && safe.getAttribute("aria-selected") !== "true") {
          if (typeof safe.click === "function") safe.click();
        }
      }

      function start() {
        if (isRunning) return;
        isRunning = true;
        if (typeof MutationObserver === "undefined" || typeof document === "undefined") {
          tick();
          return;
        }
        observer = new MutationObserver(function () {
          // throttle：避免短时间内反复探测
          if (observer._pending) return;
          observer._pending = true;
          (typeof window !== "undefined" && window.setTimeout)
            ? window.setTimeout(function () {
                observer._pending = false;
                tick();
              }, 80)
            : tick();
        });
        try {
          observer.observe(document.body, { childList: true, subtree: true });
        } catch (e) { /* 静默：极端情况下（如 document.body 还没准备好）不报错 */ }
        // 立即跑一次（start 时立即生效，不要等下一次 mutation）
        tick();
      }

      function stop() {
        isRunning = false;
        if (observer !== null) { observer.disconnect(); observer = null; }
        // 移除已打的标记（CSS 注入也会被移除，状态自洽）
        if (typeof document !== "undefined") {
          var marked = document.querySelectorAll(
            '[' + TRAJECTORY_TAB_HIDDEN_ATTR + '="' + opts.hiddenValue + '"]'
          );
          for (var i = 0; i < marked.length; i++) {
            marked[i].removeAttribute(TRAJECTORY_TAB_HIDDEN_ATTR);
          }
        }
      }

      return {
        start: start,
        stop: stop,
        get running() { return isRunning; }
      };
    }

    // ===== hover-card-hider =====
    // ====================================================================
    // v0.6.2：侧栏 HoverCard 隐藏 controller（hide-sidebar-tooltip 副作用）
    // --------------------------------------------------------------------
    // DSH HoverCard 组件（`@deepseek-ai/dsh-client-ui-primitives/lib/types/HoverCard.js`）
    // 在侧栏会话项 / 工作窗口 hover 500ms 后，通过 `createPortal(card, document.body)`
    // 渲染一个 div 到 body 直接子级。card 本身没有 className（HoverCard.module.css
    // 是空 stub），role 只在 copyable=true 时才有 role="button"。
    //
    // 内部内容：
    //   - 会话：SessionHoverContent（`dsh-client-ui-workspace/lib/client.js:614`），
    //           CSS Module hash 类名 `YDXeBa_hoverContent / _hoverTitle / _hoverTime / _hoverStatus`
    //   - 工作窗口：WorkspaceHoverContent（同上 :417），类名同上 + `YDXeBa_hoverPath`
    //
    // controller 职责：
    //   1. 巡检 body 直接子元素 div，找到含 hover 相关 hash 类的 div
    //      （content / title / time / status / path 任何一个命中即视为 HoverCard）
    //   2. 给这个 div 打 `data-dsh-ui-tweaks-hidden-hover-card="true"` 标记
    //   3. CSS `[data-dsh-ui-tweaks-hidden-hover-card]{display:none!important}` 命中隐藏
    //
    // 为什么用 JS 标记 + attribute selector 而不是直接 CSS class selector：
    //   - 不用 JS：得写 `[class*="YDXeBa_hoverContent"]` 这种 selector，
    //     依赖 DSH CSS module hash——hash 随 DSH 升级会变（v0.6.0 → v0.6.1
    //     我们的 selector 因为依赖 TooltipContent 字串就出过事）。
    //   - 用 JS：attribute 名（`data-dsh-ui-tweaks-hidden-hover-card`）由我们
    //     控制，永远不变；唯一变的"探测目标"是 DSH 的 CSS module hash 类名
    //     ——集中在一个数组里，DSH 升级后改一处即可。
    //
    // 为什么探测 body 直接子元素（而不是用 `:has()` 选择器）：
    //   - `:has()` 也能命中，但每次 DSH 升级后 CSS 选择器都得改；JS-side 探测
    //     更稳健——只要 DSH 把卡片 portal 到 body（HoverCard 实现就是这样），
    //     逻辑就不变。
    //
    // MutationObserver 观察 document.body 子树——DSH React hover 行为会让
    // HoverCard 动态 mount/unmount portal div，必须重新巡检。
    // ====================================================================

    // HoverCard 内部内容用到的 CSS Module hash 类名（DSH workspace 包）。
    // 包含 _hoverContent（外层 wrapper）+ _hoverTitle / _hoverTime / _hoverStatus
    // / _hoverPath（内部子元素）。
    // 任一命中即视为 HoverCard——content 可能不存在（copyable + copied 状态下
    // content 被 .YDXeBa_copied 替代），但 _hoverContent wrapper 总会存在。
    // 用 `_hoverContent` 作为主指标，其它作为冗余。
    // DSH 升级后 hash 变了改这里一处即可（其它 selector 都是 attribute selector 不受影响）。
    var HOVER_CARD_CLASS_HINTS = [
      "_hoverContent",
      "_hoverTitle",
      "_hoverTime",
      "_hoverStatus",
      "_hoverPath"
    ];
    var HOVER_CARD_HIDDEN_ATTR = "data-dsh-ui-tweaks-hidden-hover-card";
    var HOVER_CARD_HIDDEN_VALUE = "true";

    function isHoverCardRoot(el) {
      // el 是 body 的直接子 div。看它或它的后代是否含 hover 相关 hash 类名。
      if (!el || el.nodeType !== 1) return false;
      if (el.tagName !== "DIV") return false;
      for (var i = 0; i < HOVER_CARD_CLASS_HINTS.length; i++) {
        var hint = HOVER_CARD_CLASS_HINTS[i];
        // 自身或后代匹配即视为 HoverCard
        if (typeof el.querySelector === "function" &&
            el.querySelector('[class*="' + hint + '"]')) {
          return true;
        }
        // 自身 className 也匹配（极少数情况下 HoverCard card 自身就带 hash 类）
        var cls = (typeof el.className === "string") ? el.className : "";
        if (cls.indexOf(hint) >= 0) return true;
      }
      return false;
    }

    function createSidebarHoverCardHider() {
      var observer = null;
      var isRunning = false;

      function tick() {
        if (typeof document === "undefined" || !document.body) return;
        var children = document.body.children;
        for (var i = 0; i < children.length; i++) {
          var child = children[i];
          if (!isHoverCardRoot(child)) continue;
          // 已标记过则跳过（节流）
          if (child.getAttribute(HOVER_CARD_HIDDEN_ATTR) === HOVER_CARD_HIDDEN_VALUE) continue;
          child.setAttribute(HOVER_CARD_HIDDEN_ATTR, HOVER_CARD_HIDDEN_VALUE);
        }
      }

      function start() {
        if (isRunning) return;
        isRunning = true;
        if (typeof MutationObserver === "undefined" || typeof document === "undefined" || !document.body) {
          tick();
          return;
        }
        observer = new MutationObserver(function () {
          // throttle：避免短时间内反复探测（HoverCard hover/unhover 频繁触发）
          if (observer._pending) return;
          observer._pending = true;
          (typeof window !== "undefined" && window.setTimeout)
            ? window.setTimeout(function () {
                observer._pending = false;
                tick();
              }, 80)
            : tick();
        });
        try {
          observer.observe(document.body, { childList: true, subtree: true });
        } catch (e) { /* 静默：极端情况下（如 document.body 还没准备好）不报错 */ }
        // 立即跑一次（start 时立即生效，不要等下一次 mutation）
        tick();
      }

      function stop() {
        isRunning = false;
        if (observer !== null) { observer.disconnect(); observer = null; }
        // 移除已打的标记（CSS 注入也会被移除，状态自洽）
        if (typeof document !== "undefined" && document.body) {
          var marked = document.body.querySelectorAll('[' + HOVER_CARD_HIDDEN_ATTR + ']');
          for (var i = 0; i < marked.length; i++) {
            marked[i].removeAttribute(HOVER_CARD_HIDDEN_ATTR);
          }
        }
      }

      return {
        start: start,
        stop: stop,
        get running() { return isRunning; }
      };
    }

// ===== first-message-jump =====
    // ====================================================================
    // v0.9.1：上数第二条卡住 bug 修复 + Shift+点击一键极限（双按钮对称）：
    //   - 用 topVisible（视口内最顶部可见 user 行）替代 lastVisible 作
    //     为锚点；v0.9.0 的 lastVisible 锚点在短消息 + 滚到 rows[1] 时
    //     会因为下方 rows[2..N] 仍可见 → lastVisible 始终是 rows[N]
    //     → target 始终是 rows[N-1] → 死循环（按钮永不隐藏、永远到
    //     不了 rows[0]）。topVisible = rows[1] 时 target = rows[0]，
    //     点击后 topVisible = rows[0] → target = null → 按钮正确隐藏。
    //   - 单击我的按钮 = 上一条 user 行（topVisible.previous）
    //   - **Shift+单击**我的按钮 = 一键到 rows[0]（恢复 v0.8.0 的
    //     "一键回到最早"语义，但用 Shift 修饰，与 step-by-step 共存）
    //   - 单击原生「回到底部」按钮 = 下一条 user 行（topVisible.next）——
    //     行为从 v0.9.0 / v0.8.0 的"一键到底"改为"下一条"
    //   - **Shift+单击**原生「回到底部」按钮 = 一键到 rows[N]（原本的
    //     "一键到底"语义现在需要 Shift 修饰；DSH 原生 click handler
    //     不被 preventDefault，让它正常跑就行）
    //
    // v0.9.0：「上一条我发的消息」按钮 controller（单向上导航）——
    // 对话区右下角（输入框上方）挂一个悬浮按钮，**点击 = 跳到当前视口内
    // 最底部可见的 user 消息的上一条**。连续点击可一路向上导航，最终到
    // 达最早一条 user 消息（即 v0.8.0 的"回到最早"终点）。
    // 实现用 lastVisible（视口内最底部可见 user 行）作为锚点——在短
    // 消息场景下有"上数第二条卡住"bug，v0.9.1 改用 topVisible 修复。
    //
    // v0.8.0：原"回到最早消息"按钮——点击一次直达最早一条 user 行。
    //
    // 按钮外观：单 SVG ▲（朝上）+ aria-label "上一条我发的消息" +
    // title "上一条我发的消息（Shift+点击 = 回到最早）"。DOM / 位置 /
    // 尺寸 / 样式 / ID / CSS 选择器 [data-dsh-ui-tweaks-jump] 全部
    // 不变；localStorage key `firstMessageJump` 不动，老用户开关状态
    // 保留。
    //
    // DOM 契约（DSH 当前版本，均为稳定 attribute，不随 CSS module hash 变化）：
    //   - 滚动容器：[data-conversation-scroll]（ConversationRoot.scrollBody）
    //   - 用户消息行：[data-chat-flow-kind="user"]（ChatNodeSeat 的 kind 标记）
    //   - 输入框 seat：[data-composer-seat]（sticky bottom，随输入高度变化）
    //   - 原生「回到底部」按钮：aria-label "回到底部" / "Back to bottom"
    // 按钮样式由 25-tweaks.js 的 buildCSS 输出；本 controller 只负责挂载 /
    // 显隐 / 定位 / 点击滚动，与 tweak 开关同生命周期。原生「回到底部」
    // 按钮的钩子（capture-phase document click listener）也在本文件——
    // 负责拦截 click 事件并按 Shift 状态分发到"下一条"或"放行原生"。
    //
    // 文件拆分（v0.9.x → v0.9.2）：纯 finder / scanner 函数（不依赖
    // 闭包状态，全部以 port 作参数）抽到 68a-first-message-jump-utils.js
    // ——主文件从 645 行 / 31.2 KB 降到 ~430 行 / ~21 KB，回到
    // maintainability.md 30 KB 阈值下。函数名共享工厂函数 scope（client-src/
    // 按文件名升序整段拼接），不需要 require/import。共享常量 (JUMP_*_SEL
    // / JUMP_DRAWER_ATTR) 仍由 20-constants.js 单点定义。
    // ====================================================================

    function createFirstMessageJumpController() {
      // 纯 finder/scanner 函数（jumpFindScrollport / jumpAllUserRows /
      // jumpFindFirstUserRow / jumpFindLastUserRow / jumpIsRowInCompaction /
      // jumpFindFirstRealUserRow / jumpFindLastVisibleUserRow /
      // jumpFindTopVisibleUserRow / jumpFindPrevUserRow /
      // jumpFindNextUserRow / jumpIsDrawerOpen / jumpDrawerWidth）由
      // 68a-first-message-jump-utils.js 提供——本文件仅保留依赖闭包状态
      // 的控制器逻辑（定位 / 显隐 / 点击 / 生命周期 / 诊断）。

      var button = null;
      var scrollport = null;
      var boundScrollTarget = null;
      var visible = false;
      var isRunning = false;
      var observer = null;
      var rootObserver = null;
      var resizeObserver = null;
      var resizeObserved = null;  // 当前被 ResizeObserver 观察的输入框 seat 元素
      var jumpLastNative = null;  // 上次见过的原生「回到底部」按钮 rect（原生缺席时复用，避免跳动）
      var jumpLastPadR = null;    // 上次记录的滚动容器 padding-right（右缩变化时清记忆）
      var jumpLastComposerH = null; // 上次记录的 --dsh-composer-height（底部任务条出现/消失时清记忆）
      var nativeListenerInstalled = false;  // v0.9.1：原生按钮 capture-phase document click listener 是否已挂（防重复）

      /**
       * 抽屉是否真的盖住按钮。按钮右缘距视口右侧为 right；抽屉覆盖视口右侧 [0, 抽屉宽]。
       * 仅当 right < 抽屉宽（按钮落在抽屉阴影内）才视为遮挡。conversation-shift 已把
       * 内容让位到抽屉左侧时 right >= 抽屉宽 → 不遮挡，按钮保持可见可点。
       */
      function jumpCoveredByDrawer() {
        var dw = jumpDrawerWidth();
        if (dw === null) return true; // 有抽屉但读不到宽度 → 保守隐藏
        var right = parseFloat(button.style.right);
        if (!isFinite(right)) return true;
        return right < dw - 2;
      }

      /** 滚动容器当前的 padding-right（conversation-shift 的右缩 px；读不到按 0）。 */
      function jumpScrollportPadR() {
        if (!scrollport) return null;
        var cs = (typeof window !== "undefined" && window.getComputedStyle)
          ? window.getComputedStyle(scrollport) : null;
        if (!cs) return null;
        var pr = cs.paddingRight;
        var n = pr ? parseFloat(pr) : NaN;
        return isFinite(n) ? n : 0;
      }

      /** 当前 --dsh-composer-height（输入区高，含底部任务条等 dock；读不到按 152）。 */
      function jumpComposerHeight() {
        if (!scrollport) return 152;
        var cs = (typeof window !== "undefined" && window.getComputedStyle)
          ? window.getComputedStyle(scrollport) : null;
        if (!cs) return 152;
        var raw = cs.getPropertyValue("--dsh-composer-height");
        var n = raw ? parseFloat(raw) : NaN;
        return isFinite(n) && n > 0 ? n : 152;
      }

      /** 原生「回到底部」按钮：按 aria-label 匹配（zh/en），找不到返回 null。 */
      function jumpFindNativeBottomButton() {
        if (typeof document === "undefined") return null;
        var el = document.querySelector('[aria-label="回到底部"]');
        if (el) return el;
        return document.querySelector('[aria-label="Back to bottom"]');
      }

      /** 按"原生按钮的右缘 + 顶边"定位本按钮：右缘对齐、底缘悬在其上 JUMP_NATIVE_GAP。 */
      function jumpApplyTo(nativeRight, nativeTop) {
        var right = Math.max(8, window.innerWidth - nativeRight);
        var bottom = window.innerHeight - nativeTop + JUMP_NATIVE_GAP;
        button.style.right = Math.round(right) + "px";
        button.style.bottom = Math.round(bottom) + "px";
      }

      /**
       * 计算"原生按钮应出现的位置"（右缘 x）。从未见过原生按钮时的兜底：
       *   - 首选：直接量内容列的右缘——最早 user 行的父元素就是 .Md3f7G_column
       *     （max-width 内容宽、margin 0 auto 居中），原生槽位的 padding-right
       *     正是把它右缘对齐到内容列右缘。量 DOM 天然跟随 conversation-shift /
       *     内容宽变化，无需读 cw/padR。
       *   - 兜底：读不到行时退回公式（内容列居中 + 扣滚动容器 padding-right）。
       */
      function jumpComputeNativeRight() {
        var row = jumpFindFirstUserRow(scrollport);
        if (row && row.parentElement) {
          var colRect = row.parentElement.getBoundingClientRect();
          if (colRect && colRect.width > 0 && isFinite(colRect.right)) return colRect.right;
        }
        var portRect = scrollport.getBoundingClientRect();
        if (!portRect || portRect.width <= 0 || portRect.height <= 0) return null;
        var contentWidth = 748;
        var padR = 0;
        var cs = (typeof window !== "undefined" && window.getComputedStyle)
          ? window.getComputedStyle(scrollport) : null;
        if (cs) {
          var raw = cs.getPropertyValue("--dsh-chat-content-width");
          var parsed = parseFloat(raw);
          if (isFinite(parsed) && parsed > 0) contentWidth = parsed;
          var pr = cs.paddingRight;
          var p = pr ? parseFloat(pr) : NaN;
          if (isFinite(p) && p > 0) padR = p;
        }
        var effective = Math.min(contentWidth, portRect.width - padR);
        if (effective < 0) effective = 0;
        return portRect.left + (portRect.width - padR + effective) / 2;
      }

      /**
       * 定位策略（核心：任何时刻都只用一个位置源，杜绝"动一下"）：
       *   1) 原生按钮在场 → 直接锚定，并**记住**它的 rect；
       *   2) 原生按钮不在场（停在底部，`!atBottom` 才渲染）→ 复用上次记住的 rect——
       *      与"原生按钮将要出现的位置"完全一致，来回切换不再跳动；
       *   3) 从未见过原生按钮 → 用兜底公式估算"原生按钮应出现的位置"。
       * 原生按钮位置天然跟随「对话区右缩」（conversation-shift）等一切布局偏移，
       * 锚定/记忆路径无需自己算偏移。
       */
      function jumpPositionButton() {
        if (!button || !scrollport) return;
        var native = jumpFindNativeBottomButton();
        if (native) {
          var nr = native.getBoundingClientRect();
          if (nr && nr.width > 0 && nr.height > 0) {
            jumpLastNative = { right: nr.right, top: nr.top };
            jumpApplyTo(nr.right, nr.top);
            return;
          }
        }
        if (jumpLastNative) {
          jumpApplyTo(jumpLastNative.right, jumpLastNative.top);
          return;
        }
        var contentRight = jumpComputeNativeRight();
        if (contentRight === null) return;
        // 从未见过原生按钮：估算其顶边。原生槽位 CSS 是
        //   position:sticky; bottom:calc(var(--dsh-composer-height) + 16px)，按钮 34px
        // → 按钮顶边 = 滚动容器底 - composerHeight - (16 + 34)。
        // --dsh-composer-height 由 DSH 内联设置在滚动容器上（seat.offsetHeight），
        // 与原生槽位用的是同一个值——保证兜底与锚定位置完全重合。
        var portRect = scrollport.getBoundingClientRect();
        var nativeTop = portRect.bottom - jumpComposerHeight() - (16 + 34);
        jumpApplyTo(contentRight, nativeTop);
      }

      /** 幂等切换显隐（只写真正变化的状态）。 */
      function jumpSetVisible(next) {
        if (visible === next) return;
        visible = next;
        if (!button) return;
        if (next) button.setAttribute("data-visible", "");
        else button.removeAttribute("data-visible");
      }

      function jumpUpdate() {
        if (!isRunning) return;
        var nextPort = jumpFindScrollport();
        if (nextPort !== scrollport) {
          jumpBindScroll(nextPort);
          scrollport = nextPort;
          // 注意：不在这里清 jumpLastNative——原生按钮位置由布局决定（内容列 + 输入框高），
          // 会话/视图切换后布局不变，清掉反而会在回切对话时先按兜底公式定位造成跳动。
          // 视口尺寸变化 / 右缩 padding 变化（真正改变布局）才清。
        }
        // 右缩开关/宽度变化（conversation-shift）→ 旧的原生按钮位置失效，等下次锚定重新记忆
        var padRNow = jumpScrollportPadR();
        if (padRNow !== jumpLastPadR) {
          jumpLastPadR = padRNow;
          jumpLastNative = null;
        }
        // 输入区高度变化（底部任务条等 input.dock 出现/消失、多行输入）→ 同样失效
        var composerHNow = jumpComposerHeight();
        if (composerHNow !== jumpLastComposerH) {
          jumpLastComposerH = composerHNow;
          jumpLastNative = null;
        }
        if (!button && typeof document !== "undefined" && document.body) jumpCreateButton();
        // v0.9.1：钩原生「回到底部」按钮（幂等）。document 上挂一次 capture-phase
        // click listener；命中原生按钮时按 Shift 状态分发到"下一条"或"放行原生"。
        jumpHookNativeButton();
        // v0.9.2：可见性放宽——只要 rows.length >= 2 就显示（短会话也可见）。
        // v0.9.1 用 `target !== null` 判断：topVisible === firstRow 时按钮
        // 隐藏——但这导致短会话（2 条 user 行）底部 TodoList 卡片出现时按钮
        // 直接不出现（用户反馈"老问题"）；topVisible === firstRow 时其实
        // jumpToPrev 是 no-op（已在最顶），但按钮仍可见作为"导航面板存在"的
        // 视觉提示；Shift+点击仍能到最顶。锚点 topVisible（v0.9.1）替代
        // lastVisible（v0.9.0）——修复"上数第二条卡住"bug 这点不变。
        var allRows = jumpAllUserRows(scrollport);
        var target = jumpFindPrevUserRow(scrollport);
        var show = (allRows.length >= 2);
        if (show) jumpPositionButton();
        // 抽屉遮挡检查：conversation-shift 已让位时不遮挡 → 保持可见
        if (show && jumpIsDrawerOpen() && jumpCoveredByDrawer()) show = false;
        jumpSetVisible(show);
        // 输入框高度变化（多行输入/收起）时重新定位——观察 composer seat 元素
        if (scrollport && resizeObserver) {
          var composerEl = scrollport.querySelector(JUMP_COMPOSER_SEL);
          if (composerEl && composerEl !== resizeObserved) {
            if (resizeObserved) {
              try { resizeObserver.unobserve(resizeObserved); } catch (e) { /* 静默 */ }
            }
            resizeObserver.observe(composerEl);
            resizeObserved = composerEl;
          }
        }
      }

      function jumpBindScroll(port) {
        if (boundScrollTarget === port) return;
        if (boundScrollTarget) boundScrollTarget.removeEventListener("scroll", jumpOnScroll, true);
        boundScrollTarget = port || null;
        if (boundScrollTarget) boundScrollTarget.addEventListener("scroll", jumpOnScroll, true);
      }

      function jumpOnScroll() {
        jumpScheduleUpdate();
      }

      /** 视口尺寸变化：布局真变了，旧的原生按钮位置失效，清掉等下次锚定重新记忆。 */
      function jumpOnResize() {
        jumpLastNative = null;
        jumpScheduleUpdate();
      }

      function jumpScheduleUpdate() {
        if (!isRunning) return;
        if (observer && observer._pending) return;
        if (observer) observer._pending = true;
        window.setTimeout(function () {
          if (observer) observer._pending = false;
          jumpUpdate();
        }, 120);
      }

      /**
       * 点击：跳到"上一条"user 行（jumpFindPrevUserRow 计算）。连续点击
       * 可一路向上，最终到达 firstRow——此时按钮自动隐藏（target === null）。
       * v0.9.1：锚点从 lastVisible 改为 topVisible，修复"上数第二条卡住"
       * bug（详见 jumpFindPrevUserRow 注释）。
       */
      function jumpToPrev() {
        var port = jumpFindScrollport();
        if (!port) return;
        var row = jumpFindPrevUserRow(port);
        if (!row) return; // 已无路可上（极少见，jumpUpdate 也会隐藏按钮）
        var portRect = port.getBoundingClientRect();
        var rowRect = row.getBoundingClientRect();
        var target = 0;
        if (portRect && rowRect) {
          var off = rowRect.top - portRect.top + port.scrollTop - JUMP_TOP_PADDING;
          if (off > 0) target = off;
        }
        port.scrollTop = target;
        jumpScheduleUpdate();
      }

      /**
       * v0.9.1：Shift+单击我的按钮 → 一键到 rows[0]（最早一条 user 行）。
       * 与 v0.8.0 的「jumpToFirst」逻辑一致——把 firstRow 滚到视口顶部
       * + JUMP_TOP_PADDING。无 firstRow（空对话）则回顶（scrollTop=0）。
       * v0.9.2：firstRow 取的是「跳过 compaction 块后的第一条」——
       * jumpFindFirstRealUserRow()。这样 Shift+点击直达"当前会话的
       * 第一条"，而不是 compact 摘要里的旧 user 行（v0.9.1 落到了
       * compaction 块下方的某条 user 行——bug）。
       */
      function jumpToFirst() {
        var port = jumpFindScrollport();
        if (!port) return;
        var row = jumpFindFirstRealUserRow(port);
        if (!row) return;
        var portRect = port.getBoundingClientRect();
        var rowRect = row.getBoundingClientRect();
        var target = 0;
        if (portRect && rowRect) {
          var off = rowRect.top - portRect.top + port.scrollTop - JUMP_TOP_PADDING;
          if (off > 0) target = off;
        }
        port.scrollTop = target;
        jumpScheduleUpdate();
      }

      /**
       * v0.9.2：找"当前会话的第一条 user 行"——跳过 compaction / context
       * 容器里的 user 行。详见 jumpIsRowInCompaction。
       * 兜底：所有 user 行都在 compaction 里（极端情况）→ 返回 DOM 顺序的
       * 第一条（保留 v0.9.1 行为，宁可给一个错的目标也不要 no-op）。
       */
      function jumpFindFirstRealUserRow(port) {
        var rows = jumpAllUserRows(port);
        for (var i = 0; i < rows.length; i++) {
          if (!jumpIsRowInCompaction(rows[i])) {
            return rows[i];
          }
        }
        return rows.length > 0 ? rows[0] : null;
      }

      /**
       * v0.9.1：单击原生「回到底部」按钮（无 Shift）→ "下一条"user 行
       * （jumpFindNextUserRow 计算）。几何与 jumpToPrev 完全对称——
       * 把 target 滚到视口顶部 + JUMP_TOP_PADDING。锚点都用 topVisible：
       *   - 用户在中间（视口内含多条 user 行）→ 滚到 topVisible.next
       *   - 用户在顶部（只 rows[0] 可见）→ 滚到 rows[1]
       *   - 用户在底部（只 rows[N] 可见）→ topVisible === lastRow → target = null → no-op
       *   - 视口内无 user 行（页面刚打开 / 在对话外空白区）→ 滚到 rows[0] 作起点
       */
      function jumpToNext() {
        var port = jumpFindScrollport();
        if (!port) return;
        var row = jumpFindNextUserRow(port);
        if (!row) return;
        var portRect = port.getBoundingClientRect();
        var rowRect = row.getBoundingClientRect();
        var target = 0;
        if (portRect && rowRect) {
          var off = rowRect.top - portRect.top + port.scrollTop - JUMP_TOP_PADDING;
          if (off > 0) target = off;
        }
        port.scrollTop = target;
        jumpScheduleUpdate();
      }

      /**
       * v0.9.1：我的按钮的 click 处理器。
       *   - e.shiftKey === true  → jumpToFirst()（一键到 rows[0]）
       *   - e.shiftKey === false → jumpToPrev()（step-by-step 上一条）
       * 浏览器在 click 事件上对 shift 键的判定由 MouseEvent.shiftKey 给
       * 出——不需要自己跟踪 keydown/keyup。Edge case：合成事件（脚本
       * dispatchEvent）可能 shiftKey=false 但本意是"Shift+单击"——这
       * 是正常 DSH 用户流程不会触发的场景，忽略即可。
       */
      function jumpOnButtonClick(e) {
        if (e && e.shiftKey) {
          jumpToFirst();
        } else {
          jumpToPrev();
        }
      }

      /**
       * v0.9.1：原生「回到底部」按钮的 capture-phase click 钩子。
       * 监听器挂在 document 上（capture phase），先于任何 bubble phase
       * 监听器（包括 DSH 在原生 button 上的 onClick 与可能存在的祖先
       * delegation）触发——这样我们有"否决"权：
       *   - e.shiftKey === true → 不 preventDefault，让 DSH 原生 handler
       *     跑（它的语义本来就是"一键到底"）→ 行为退化为 v0.8.0
       *   - e.shiftKey === false → preventDefault + stopImmediatePropagation
       *     阻止原生 handler 跑，改由 jumpToNext() 做"下一条"导航
       *
       * 命中判定靠手动 walk 父链找 aria-label——target 可能是原生 button
       * 内部的子元素（SVG 等），不依赖 closest()（保持 ES5-only 风格）。
       * document listener 只挂一次（nativeListenerInstalled flag），原生
       * button 被 DSH 重渲时不需要重新挂——listener 一直在 document 上，
       * 新 button 也会被覆盖。
       */
      function jumpOnNativeClick(e) {
        if (!e || !e.target) return;
        var target = e.target;
        var foundNative = false;
        // Walk up 父链找 aria-label 匹配的 button（含其子元素被点的情况）
        while (target && target.nodeType === 1) {
          var label = (typeof target.getAttribute === "function")
            ? target.getAttribute("aria-label")
            : null;
          if (label === "回到底部" || label === "Back to bottom") {
            foundNative = true;
            break;
          }
          target = target.parentElement;
        }
        if (!foundNative) return;
        if (e.shiftKey) {
          // Shift+点击原生按钮 = 一键到底（DSH 原生 handler 跑就行）
          return;
        }
        // 单击原生按钮 = 拦截，由我们做"下一条"
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        jumpToNext();
      }

      /**
       * v0.9.1：在 document 上挂一次 capture-phase click listener。
       * 幂等：nativeListenerInstalled flag 防止重复挂。
       * 调用时机：jumpUpdate() 内每次都尝试挂——若已挂则立刻返回；这样
       * 既能早期挂上（start 后首次 jumpUpdate），又能容错（理论上
       * stop() 卸载后 start() 再挂）。
       */
      function jumpHookNativeButton() {
        if (typeof document === "undefined") return;
        if (nativeListenerInstalled) return;
        try {
          document.addEventListener("click", jumpOnNativeClick, true);
          nativeListenerInstalled = true;
        } catch (e) { /* 静默：极端环境 document 不可写 */ }
      }

      function jumpCreateButton() {
        if (button || typeof document === "undefined" || !document.body) return;
        button = document.createElement("button");
        button.type = "button";
        button.id = JUMP_BTN_ID;
        button.setAttribute("data-dsh-ui-tweaks-jump", "");
        button.setAttribute("aria-label", JUMP_LABEL);
        button.setAttribute("title", JUMP_BUTTON_TITLE);  // v0.9.1：title 加 Shift 修饰提示
        button.innerHTML = JUMP_SVG_UP;
        button.addEventListener("click", jumpOnButtonClick);  // v0.9.1：分发到 jumpOnButtonClick
        document.body.appendChild(button);
      }

      function start() {
        if (isRunning) return;
        isRunning = true;
        if (typeof window !== "undefined") {
          window.addEventListener("resize", jumpOnResize);
          if (typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(function () {
              // 输入区高度变化（底部任务条等 dock 出现/消失）→ 旧原生按钮位置失效
              jumpLastNative = null;
              jumpScheduleUpdate();
            });
          }
        }
        if (typeof MutationObserver === "undefined" || typeof document === "undefined") {
          jumpUpdate();
          return;
        }
        // 宽监听：body 子树变化（会话切换 / 消息追加 / 布局重建）触发重算
        observer = new MutationObserver(function () { jumpScheduleUpdate(); });
        try {
          observer.observe(document.body, { childList: true, subtree: true });
        } catch (e) { /* 静默：body 未就绪等极端情况 */ }
        // 抽屉 attr 在 documentElement 上，body 监听看不到，单独窄监听
        rootObserver = new MutationObserver(function () { jumpScheduleUpdate(); });
        try {
          rootObserver.observe(document.documentElement, { attributes: true, attributeFilter: [JUMP_DRAWER_ATTR] });
        } catch (e) { /* 静默 */ }
        jumpUpdate();
      }

      function stop() {
        if (!isRunning) return;
        isRunning = false;
        if (observer) { observer.disconnect(); observer = null; }
        if (rootObserver) { rootObserver.disconnect(); rootObserver = null; }
        if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
        resizeObserved = null;
        if (boundScrollTarget) {
          boundScrollTarget.removeEventListener("scroll", jumpOnScroll, true);
          boundScrollTarget = null;
        }
        if (typeof window !== "undefined") window.removeEventListener("resize", jumpOnResize);
        // v0.9.1：拆掉原生按钮的 capture-phase click listener（幂等：未挂也安全）
        if (typeof document !== "undefined" && nativeListenerInstalled) {
          try { document.removeEventListener("click", jumpOnNativeClick, true); } catch (e) { /* 静默 */ }
          nativeListenerInstalled = false;
        }
        if (button && button.parentNode) button.parentNode.removeChild(button);
        button = null;
        scrollport = null;
        visible = false;
        jumpLastNative = null;
        jumpLastPadR = null;
        jumpLastComposerH = null;
      }

      /** 诊断快照（window.__dshUiTweaks.firstMessageJump() 用）。 */
      function getState() {
        var port = jumpFindScrollport();
        var rows = jumpAllUserRows(port);
        var firstRow = rows.length > 0 ? rows[0] : null;
        var lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
        var topVisible = jumpFindTopVisibleUserRow(port);  // v0.9.1：导航锚点
        var lastVisible = jumpFindLastVisibleUserRow(port);  // 诊断：v0.9.0 旧锚点（保留对照）
        var prevTarget = jumpFindPrevUserRow(port);
        var nextTarget = jumpFindNextUserRow(port);  // v0.9.1：原生按钮单击目标
        function rowInfo(r) {
          if (!r || !port) return null;
          var rt = r.getBoundingClientRect();
          return {
            kind: r.getAttribute("data-chat-flow-kind"),
            topOffset: rt.top - port.getBoundingClientRect().top
          };
        }
        return {
          running: isRunning,
          scrollport: port ? { tag: port.tagName, cls: (typeof port.className === "string") ? port.className : "" } : null,
          totalUserRows: rows.length,
          firstUserRow: rowInfo(firstRow),
          lastUserRow: rowInfo(lastRow),
          topVisibleUserRow: rowInfo(topVisible),    // v0.9.1：当前锚点
          lastVisibleUserRow: rowInfo(lastVisible),  // 诊断：v0.9.0 旧锚点（保留对照）
          targetRow: rowInfo(prevTarget),            // 我的按钮单击 → target
          nextUserRow: rowInfo(nextTarget),          // v0.9.1：原生按钮单击 → target
          scrollTop: port ? port.scrollTop : 0,
          visible: visible,
          drawerOpen: jumpIsDrawerOpen(),
          nativeHooked: nativeListenerInstalled      // v0.9.1：原生按钮 capture-phase listener 是否已挂
        };
      }

      return {
        start: start,
        stop: stop,
        getState: getState,
        get running() { return isRunning; }
      };
    }// ===== first-message-jump utils =====
    // ====================================================================
    // 纯 finder / scanner 函数（不依赖 closure 状态，全部以 `port` 作参
    // 数）。从 68-first-message-jump.js 拆出（v0.9.0 → v0.9.2 三轮迭
    // 代累积后主文件 645 行 / 31.2 KB，超过 maintainability.md 的 30 KB
    // 阈值）。拆分后主文件回到 ~430 行 / ~21 KB 阈值下，utils 本文件
    // ~220 行 / ~9 KB。
    //
    // 与主文件的关系：所有函数共享一个工厂函数体（client-src/*.js 按
    // 文件名升序整段拼接进 lib/client.js），所以 jump* 函数名在主文
    // 件里仍可直接调用。共享常量 (JUMP_SCROLL_SEL / JUMP_USER_ROW_SEL /
    // JUMP_DRAWER_ATTR) 由 20-constants.js 单点定义。
    //
    // 函数清单：
    //   - jumpFindScrollport         滚动容器查询
    //   - jumpAllUserRows            当前会话所有 user 行（DOM 顺序，
    //                                 转静态数组避免 NodeList live 错位）
    //   - jumpFindFirstUserRow       firstRow（DOM 顺序最早；v0.9.2 仍
    //                                 保留作为内部锚点）
    //   - jumpFindLastUserRow        lastRow
    //   - jumpIsRowInCompaction      v0.9.2：判断 row 是否嵌在
    //                                 compaction / context 容器里
    //   - jumpFindFirstRealUserRow   v0.9.2：跳过 compact 块的"当前会话
    //                                 第一条 user 行"——Shift+点击的终点
    //   - jumpFindLastVisibleUserRow 视口内最底部可见 user 行（v0.9.0
    //                                 锚点，保留作诊断对照）
    //   - jumpFindTopVisibleUserRow  v0.9.1 起当前锚点：视口内最顶部可见
    //                                 user 行——v0.9.0 的 lastVisible 在
    //                                 短消息 + 滚到 rows[1] 时会卡死
    //                                 （下方 rows[2..N] 仍可见 → 死循环）
    //   - jumpFindPrevUserRow        我的按钮单击 target（v0.9.1 锚点
    //                                 改为 topVisible 修复"上数第二条卡住"
    //                                 bug）
    //   - jumpFindNextUserRow        v0.9.1：原生「回到底部」按钮单击
    //                                 target——几何与 prev 完全对称
    //   - jumpIsDrawerOpen           右侧抽屉是否打开（attr 探测）
    //   - jumpDrawerWidth            抽屉覆盖到视口右侧的宽度（px）——读
    //                                 --active-drawer-width
    // ====================================================================

    /** 当前会话滚动容器：取第一个可见（非零尺寸）的 [data-conversation-scroll]。 */
    function jumpFindScrollport() {
      if (typeof document === "undefined") return null;
      var nodes = document.querySelectorAll(JUMP_SCROLL_SEL);
      var fallback = null;
      for (var i = 0; i < nodes.length; i++) {
        if (fallback === null) fallback = nodes[i];
        var r = nodes[i].getBoundingClientRect();
        if (r && r.width > 0 && r.height > 0) return nodes[i];
      }
      return fallback;
    }

    /**
     * 当前会话所有 user 行（DOM 顺序即时间顺序）。每次调用实时查询，
     * 不缓存（DOM 重建时引用失效；用户消息流式生成 / 删除 / React 重渲都
     * 会让旧引用作废）。
     */
    function jumpAllUserRows(port) {
      if (!port) return [];
      var nodes = port.querySelectorAll(JUMP_USER_ROW_SEL);
      // NodeList 是 live 的，转成静态数组避免迭代中 DOM 变化引起索引错位
      var arr = [];
      for (var i = 0; i < nodes.length; i++) arr.push(nodes[i]);
      return arr;
    }

    /** 最早一条 user 行（firstRow），无则 null。 */
    function jumpFindFirstUserRow(port) {
      var rows = jumpAllUserRows(port);
      return rows.length > 0 ? rows[0] : null;
    }

    /**
     * v0.9.2：判断一个 user 行是否"嵌在" compaction / context 容器里。
     * 沿父链向上走，遇到的第一个有 `data-chat-flow-kind` 属性的祖先
     * 若属于 compaction / manual-compaction / context 之一，即视为嵌
     * 在被压缩或注入的上下文里——不当作"当前会话真实的第一条"。
     *
     * 用途：jumpFindFirstUserRow 用它跳过 compact 块里的 user 行———
     * 用户期望的"第一条我发的消息"是 compaction 块之后的当前会话起点，
     * 而不是 compact 摘要里旧会话的 user 行（v0.9.1 这里返回 compaction
     * 里那条——bug）。
     */
    function jumpIsRowInCompaction(row) {
      if (!row) return false;
      var parent = row.parentElement;
      while (parent && parent !== document.body && parent.nodeType === 1) {
        var kind = (typeof parent.getAttribute === "function")
          ? parent.getAttribute("data-chat-flow-kind")
          : null;
        if (kind === "compaction" || kind === "manual-compaction" || kind === "context") {
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    }

    /** 最近一条 user 行（lastRow），无则 null。 */
    function jumpFindLastUserRow(port) {
      var rows = jumpAllUserRows(port);
      return rows.length > 0 ? rows[rows.length - 1] : null;
    }

    /**
     * 找"视口内最底部可见的 user 行"——与当前视口相交、且在 DOM 顺序
     * 中位置最靠后的那一条。可见判定 = rect 与 viewport rect 相交：
     *   row.bottom > portTop && row.top < portBottom
     * 这是"至少有一像素在视口内"的真正相交判定，比 v0.8.0 的"行顶
     * 在 viewport 顶部 200px 带内"更精确——可以正确处理"row 顶部在
     * viewport 中下部但 row 本体仍可见"的情况。
     * 视口内无 user 行 → 返回 null。
     * v0.9.1：仍保留此函数——供 `getState()` 诊断使用 + 上数第二条
     * 死循环场景的旧逻辑参考。
     */
    function jumpFindLastVisibleUserRow(port) {
      if (!port) return null;
      var rows = jumpAllUserRows(port);
      if (rows.length === 0) return null;
      var portRect = port.getBoundingClientRect();
      if (!portRect || portRect.height <= 0) return null;
      var lastVisible = null;
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i].getBoundingClientRect();
        if (!r || r.height <= 0) continue;
        // 行顶在视口下方之上（未完全滚出底部） + 行底在视口顶部之下（未完全滚出顶部）
        if (r.top < portRect.bottom && r.bottom > portRect.top) {
          lastVisible = rows[i];
        } else if (r.top >= portRect.bottom) {
          // 已超过视口底部，且 DOM 顺序后续行只会更靠后 → 后续都不可能可见，break
          break;
        }
      }
      return lastVisible;
    }

    /**
     * v0.9.1：找"视口内最顶部可见的 user 行"——与当前视口相交、且在
     * DOM 顺序中位置最靠前的那一条。可见判定同 lastVisible。
     * 视口内无 user 行 → 返回 null。
     *
     * 与 `jumpFindLastVisibleUserRow` 的区别：topVisible 是 DOM 顺序
     * 第一个可见的（最靠顶），lastVisible 是最后一个可见的（最靠底）。
     * v0.9.1 把 step-by-step 导航的锚点从 lastVisible 改为 topVisible
     * ——lastVisible 在短消息 + 滚到 rows[1] 时会卡死（因为下方 rows
     * [2..N] 仍可见 → lastVisible 始终是 rows[N]），topVisible 没有
     * 这个问题（topVisible 始终是当前视口顶部那条 user 行）。
     */
    function jumpFindTopVisibleUserRow(port) {
      if (!port) return null;
      var rows = jumpAllUserRows(port);
      if (rows.length === 0) return null;
      var portRect = port.getBoundingClientRect();
      if (!portRect || portRect.height <= 0) return null;
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i].getBoundingClientRect();
        if (!r || r.height <= 0) continue;
        // 行顶在视口下方之上（未完全滚出底部） + 行底在视口顶部之下（未完全滚出顶部）
        if (r.top < portRect.bottom && r.bottom > portRect.top) {
          return rows[i];
        } else if (r.top >= portRect.bottom) {
          // 已超过视口底部 → 后续都不可能可见，break
          break;
        }
      }
      return null;
    }

    /**
     * 找"上一条"——按钮点击的 target 行（v0.9.1 用 topVisible）：
     *   - 视口内最顶部可见 user 行 = topVisible
     *     - 若 topVisible 存在：target = topVisible 的 DOM 顺序上一条
     *     - 若 topVisible 不存在（视口在所有 user 之上）：target = lastRow（首次入口）
     *   - 若 topVisible === firstRow：target = null（已在最早，无路可上）
     *
     * v0.9.1 改用 topVisible 的关键修复：v0.9.0 用 lastVisible 时，
     * rows[1] 已在视口顶部但 rows[2..N] 仍可见 → lastVisible 始终是
     * rows[N] → target 始终是 rows[N-1] → 死循环（按钮永不隐藏、
     * 永远到不了 rows[0]）。改用 topVisible 后：
     *   topVisible = rows[1] → target = rows[0]
     *   点击 → 滚到 rows[0] → topVisible = rows[0] → target = null → 按钮隐藏 ✓
     */
    function jumpFindPrevUserRow(port) {
      var rows = jumpAllUserRows(port);
      if (rows.length === 0) return null;
      var firstRow = rows[0];
      var lastRow = rows[rows.length - 1];
      var topVisible = jumpFindTopVisibleUserRow(port);
      if (!topVisible) {
        // 视口内无 user 行：跳到最后一条作为入口（用户在对话上方空白区）
        return lastRow;
      }
      if (topVisible === firstRow) {
        // 已是最早一条，没有"上一条"
        return null;
      }
      // 找 topVisible 在 rows 中的索引，返回前一条
      for (var i = 0; i < rows.length; i++) {
        if (rows[i] === topVisible) {
          return i > 0 ? rows[i - 1] : null;
        }
      }
      // 兜底：理论上不可达（topVisible 是 querySelectorAll 结果之一）
      return null;
    }

    /**
     * v0.9.1：找"下一条"——原生「回到底部」按钮单击拦截时的 target 行。
     * 锚点同样用 topVisible（与 prev 对称）：
     *   - 视口内最顶部可见 user 行 = topVisible
     *     - 若 topVisible 存在：target = topVisible 的 DOM 顺序下一条
     *     - 若 topVisible 不存在（视口在所有 user 之上/之下）：
     *       target = firstRow（"从对话起点开始往下一条"——自然入口）
     *   - 若 topVisible === lastRow：target = null（已在最晚，无路可下）
     *
     * 与 prev 对称：prev 用 lastRow 作为"无可见"时的入口（页面刚打开
     * 时跳到最新一条作为起点）；next 用 firstRow（"从对话起点开始往
     * 下走"——起点即入口）。语义对称。
     */
    function jumpFindNextUserRow(port) {
      var rows = jumpAllUserRows(port);
      if (rows.length === 0) return null;
      var firstRow = rows[0];
      var lastRow = rows[rows.length - 1];
      var topVisible = jumpFindTopVisibleUserRow(port);
      if (!topVisible) {
        // 视口内无 user 行：从对话起点开始（firstRow 本身）作为入口
        return firstRow;
      }
      if (topVisible === lastRow) {
        // 已是最晚一条，没有"下一条"
        return null;
      }
      // 找 topVisible 在 rows 中的索引，返回下一条
      for (var i = 0; i < rows.length; i++) {
        if (rows[i] === topVisible) {
          return i < rows.length - 1 ? rows[i + 1] : null;
        }
      }
      // 兜底：理论上不可达
      return null;
    }

    function jumpIsDrawerOpen() {
      return typeof document !== "undefined" &&
        document.documentElement.hasAttribute(JUMP_DRAWER_ATTR);
    }

    /**
     * 当前打开的右侧抽屉宽度（px）。读 html 上的 --active-drawer-width
     * （task-pool / git-hub 等面板打开时按 FAB 让位协议设置）。无抽屉返回 null。
     */
    function jumpDrawerWidth() {
      if (!jumpIsDrawerOpen()) return null;
      if (typeof document === "undefined" || !window.getComputedStyle) return null;
      var cs = window.getComputedStyle(document.documentElement);
      var raw = cs ? cs.getPropertyValue("--active-drawer-width") : "";
      var n = raw ? parseFloat(raw) : NaN;
      return isFinite(n) ? n : null;
    }    // ===== debug-api =====
    // ====================================================================
    // 诊断 API（暴露 window.__dshUiTweaks）
    // ====================================================================

    function createDebugAPI() {
      return {
        VERSION: VERSION,
        getState: function () { return loadState(); },
        getInjectedCSS: function () {
          var t = document.querySelector("style[data-plugin-css=\"" + MAIN_CSS_TAG_ID + "\"]");
          return t ? t.textContent : null;
        },
        getMatchedElements: function () {
          // v0.5.3 起：返回 JS 探测打标记的元素 + 列容器对照
          var sels = [
            { key: "column (centerCol / data-pane)", selector: '[' + SHIM_PANE_ATTR + '="' + SHIM_PANE_VALUE + '"], [class*="centerCol"]' },
            { key: "shift targets (JS 探测 + 标记的 chatflow / input / 兜底 column)", selector: '[' + SHIFT_TARGET_ATTR + ']' }
          ];
          var out = {};
          for (var i = 0; i < sels.length; i++) {
            var nodes = document.querySelectorAll(sels[i].selector);
            var arr = [];
            for (var j = 0; j < nodes.length; j++) {
              var n = nodes[j];
              var cs = window.getComputedStyle(n);
              var shiftType = n.getAttribute(SHIFT_TARGET_ATTR) || null;
              arr.push({
                tag: n.tagName,
                cls: n.className,
                shiftType: shiftType,
                padR: cs.paddingRight,
                offsetW: n.offsetWidth,
                offsetH: n.offsetHeight,
                rect: { x: Math.round(n.getBoundingClientRect().x), y: Math.round(n.getBoundingClientRect().y), w: Math.round(n.getBoundingClientRect().width), h: Math.round(n.getBoundingClientRect().height) }
              });
            }
            out[sels[i].key] = arr;
          }
          return out;
        },
        debug: function () {
          console.group("[dsh-ui-tweaks v" + VERSION + "] debug");
          console.log("state:", this.getState());
          console.log("injected CSS:", this.getInjectedCSS());
          console.log("matched elements:", this.getMatchedElements());
          console.groupEnd();
        },
        /** 调试用：直接 patch state，触发 saveState + injectCSS + 状态事件 */
        setState: function (patch) {
          var cur = this.getState();
          var next = {};
          for (var k in cur) next[k] = cur[k];
          for (var k2 in patch) next[k2] = patch[k2];
          saveState(next);
          injectCSS(next);
          if (typeof window !== "undefined" && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: next }));
          }
          return next;
        },
        /** 立即重跑 self-shim（调试用） */
        reshim: function () {
          return applyShellShim();
        }
      };
    }

    // ===== react-tweak-row =====
    // ====================================================================
    // React 组件
    // ====================================================================

    /**
     * 单条 tweak 的 row：标题 + 开关 + 可选数字输入。description 隐藏在
     * `title` 属性里——鼠标悬停时由浏览器原生 tooltip 显示。
     *
     * 设计选择（v0.5.1）：
     *  - 开关**永远不 disabled**——用户必须能拨动它（v0.4.0 / v0.5.0 默认 enabled=false，
     *    但 UI 仍要可点；之前 `disabled={!enabled}` 用在 number input 是 bug，因为用户
     *    看不见开关时就被锁住，反人类）
     *  - number input 也**永远不 disabled**——可以先调像素再开开关
     *  - number input 用受控 value={value} + onChange 每键更新 parent state，
     *    没有 draft/useEffect 链。简化、消除受控输入框 边界 race condition。
     *
     * v0.7.5：description 从始终渲染的 `<p>` 收进 HTML `title` 属性。
     *   旧实现：每条 tweak 始终渲染一段 1-3 行的描述文字（最长 60+ 字），6 条 tweak
     *   在设置页铺满 200+ 像素高——但实际只有"刚开插件 / 想不起来某条做什么"时
     *   才需要看描述。新实现：description 默认不渲染，鼠标悬停在 row 上（或键盘
     *   focus）时弹出浏览器原生 tooltip（HTML `title` 属性）——所见即所得、无
     *   额外 CSS、无 JS state。CSS 同步加 `cursor:help` 提示可悬停。
     */
    function TweakRow(props) {
      var t = props.tweak;
      var state = props.state;
      var setState = props.setState;
      var k1 = t.configKeys.enabled;
      var k2 = t.configKeys.value;
      var enabled = state[k1];
      var value = state[k2];
      var hasValueInput = k2 !== k1;

      function onToggle(e) {
        var next = {};
        for (var k in state) next[k] = state[k];
        next[k1] = !!e.target.checked;
        setState(next);
      }

      function onNumberChange(e) {
        var raw = e.target.value;
        if (raw === "" || raw === "-") return; // 允许临时清空，不写 state
        var n = Number(raw);
        if (!isFinite(n) || n < 0) return;
        if (n === value) return;
        var next = {};
        for (var k in state) next[k] = state[k];
        next[k2] = n;
        setState(next);
      }

      var children = [
        jsxRuntime.jsxs("div", {
          className: "DTPD_itemHead",
          children: [
            jsxRuntime.jsx("h3", { className: "DTPD_itemName", children: t.name }),
            jsxRuntime.jsx("input", {
              type: "checkbox",
              className: "DTPD_switch",
              role: "switch",
              "aria-label": t.name,
              checked: !!enabled,
              onChange: onToggle
            })
          ]
        })
      ];

      if (hasValueInput) {
        children.push(
          jsxRuntime.jsxs("div", {
            className: "DTPD_valueRow",
            children: [
              jsxRuntime.jsx("label", { className: "DTPD_valueLabel", children: "像素值" }),
              jsxRuntime.jsx("input", {
                className: "DTPD_input",
                type: "number",
                min: 0,
                max: 800,
                step: 10,
                value: value,
                onChange: onNumberChange
              }),
              jsxRuntime.jsx("span", {
                style: { color: "var(--dsw-alias-label-tertiary)", fontSize: "12px" },
                children: "px (0–800)"
              })
            ]
          })
        );
      }

      return jsxRuntime.jsx("li", {
        className: "DTPD_item",
        "data-tweak-id": t.id,
        // v0.7.5：description 改 HTML title（浏览器原生 tooltip）—悬停时显示，无需额外 CSS/JS
        title: t.description,
        children: children
      });
    }    // ===== react-section =====
    /** 顶级 section 组件。自包含——内部 useState 用 loadState() 做 lazy init。 */
    function UiTweaksSection() {
      var stateState = react.useState(loadState);
      var state = stateState[0];
      var setState = stateState[1];

      react.useEffect(function () {
        saveState(state);
        injectCSS(state);
        if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
          try {
            window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: state }));
          } catch (e) { /* 静默 */ }
        }
      }, [state]);

      var rows = [];
      for (var i = 0; i < TWEAKS.length; i++) {
        rows.push(jsxRuntime.jsx(TweakRow, {
          tweak: TWEAKS[i],
          state: state,
          setState: setState
        }, TWEAKS[i].id));
      }

      return jsxRuntime.jsxs("div", {
        className: "DTPD_section",
        children: [
          jsxRuntime.jsx("h2", { children: "界面微调" }),
          jsxRuntime.jsx("p", {
            className: "DTPD_intro",
            children: "DSH 外观微调合集。状态存于本机 localStorage（dsh-ui-tweaks/state）。浏览器 console 跑 window.__dshUiTweaks.debug() 可看完整诊断。"
          }),
          jsxRuntime.jsx("ul", { className: "DTPD_list", children: rows })
        ]
      });
    }

    // ===== apply =====
    // ====================================================================
    // apply（loader 调一次，DSH 启动时执行）
    // ====================================================================

    function apply(ctx) {
      // 1) self-shim（先于 CSS 注入，让 [data-pane="conversation"] 选择器在第一次 injectCSS 时就命中）
      var shimResult = applyShellShim();
      // v0.5.3：探测 chatflow 容器 + 输入框并打标记（在 CSS 注入之前——
      //   CSS 选择器是 [data-dsh-ui-tweaks-shift-target]，必须先有标记才能命中）
      var chatflowMarks = applyChatflowShiftMarks();
      startShellShimObserver();
      // v0.5.4：MutationObserver 在 DSH React 重渲时同时重新打 chatflow 标记
      //   （之前的 startShellShimObserver 只负责 self-shim——现在扩展，但实际交给
      //    专门的 startChatflowMarksObserver；v0.5.5 在 startShellShimObserver 回调里
      //    也补了一次 applyChatflowShiftMarks 作为兜底——双保险）
      startChatflowMarksObserver();

      // 2) 初始 CSS（即便用户没打开设置页也立即跑；后续 UI 变化由 UiTweaksSection useEffect 触发）
      var initialState = loadState();
      injectCSS(initialState);
      injectSectionCSS();

      // 3) 诊断 API（必须早于 settings UI 注册——UI 里的"诊断"按钮会用到）
      if (typeof window !== "undefined") {
        window[DEBUG_API_KEY] = createDebugAPI();
      }

      // 4) 注册 settings.section slot
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "ui-tweaks",
          order: 5,
          label: function () { return "界面微调"; }
        }, function () {
          return jsxRuntime.jsx(UiTweaksSection, {});
        });
      });

      // 5) 调试模式：按 initialState 即时生效
      var px = Number(initialState.conversationShiftPx);
      if (!isFinite(px) || px < 0) px = 380;
      applyDebugMode(!!initialState.conversationShiftDebug, !!initialState.conversationShift, px);

      // 6) 简洁模式状态行 controller
      var simpleController = createSimpleModeStatusController();
      if (initialState.simpleModeEnabled) simpleController.start();

      // 6b) v0.7.0 + v0.7.2：tab 隐藏 controllers（用通用 createTabHider 工厂）
      //     hide-trajectory-tab 标记 "轨迹" 按钮 + 兜底点击"对话"切回
      //     hide-chat-tab       标记 "对话" 按钮 + 兜底确保在"对话"视图
      //     两个 safe tab 都是 "对话"（DSH 默认 view）——避免两个 tab 都隐藏
      //     后用户卡在轨迹视图出不来。
      var trajectoryHider = createTabHider({
        targetLabels: TRAJECTORY_TAB_LABELS,
        hiddenValue: "trajectory",
        safeLabels: CHAT_TAB_LABELS
      });
      if (initialState.hideTrajectoryTab) trajectoryHider.start();
      var chatHider = createTabHider({
        targetLabels: CHAT_TAB_LABELS,
        hiddenValue: "chat",
        safeLabels: CHAT_TAB_LABELS
      });
      if (initialState.hideChatTab) chatHider.start();

      // 6c) v0.6.2：侧栏 HoverCard 隐藏 controller
      var hoverCardHider = createSidebarHoverCardHider();
      if (initialState.hideSidebarTooltip) hoverCardHider.start();

      // 6d) v0.8.0：「回到最早消息」按钮 controller（first-message-jump tweak）
      var firstMessageJump = createFirstMessageJumpController();
      if (initialState.firstMessageJump) firstMessageJump.start();

      // 6e) v0.8.0：把按钮诊断挂到 window.__dshUiTweaks.firstMessageJump()
      if (typeof window !== "undefined" && window[DEBUG_API_KEY]) {
        window[DEBUG_API_KEY].firstMessageJump = function () {
          return firstMessageJump.getState();
        };
      }

      // 7) 监听 UI 状态变化
      function onStateChange(e) {
        var detail = (e && e.detail) || null;
        if (!detail || typeof detail !== "object") return;
        var newPx = Number(detail.conversationShiftPx);
        if (!isFinite(newPx) || newPx < 0) newPx = 380;
        applyDebugMode(!!detail.conversationShiftDebug, !!detail.conversationShift, newPx);
        if (detail.simpleModeEnabled) {
          if (!simpleController.running) {
            simpleController.start();
          }
        } else {
          if (simpleController.running) {
            simpleController.stop();
          }
        }
        if (detail.hideTrajectoryTab) {
          if (!trajectoryHider.running) trajectoryHider.start();
        } else {
          if (trajectoryHider.running) trajectoryHider.stop();
        }
        if (detail.hideChatTab) {
          if (!chatHider.running) chatHider.start();
        } else {
          if (chatHider.running) chatHider.stop();
        }
        // v0.6.2：HoverCard hider 跟随 hideSidebarTooltip 开关
        if (detail.hideSidebarTooltip) {
          if (!hoverCardHider.running) hoverCardHider.start();
        } else {
          if (hoverCardHider.running) hoverCardHider.stop();
        }
        // v0.8.0：first-message-jump 按钮跟随开关
        if (detail.firstMessageJump) {
          if (!firstMessageJump.running) firstMessageJump.start();
        } else {
          if (firstMessageJump.running) firstMessageJump.stop();
        }
      }
      if (typeof window !== "undefined" && window.addEventListener) {
        window.addEventListener(STATE_EVENT, onStateChange);
      }
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.name = "dsh-ui-tweaks";
    return module.exports;
  }
});