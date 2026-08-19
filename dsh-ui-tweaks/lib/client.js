/**
 * dsh-ui-tweaks — 浏览器端（web client bundle，作者：MeganeOnly）
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

    var VERSION = "0.7.4";
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
        //   ——就是 card div。`:has()` 在 Chromium 105+ 可用（DSH Electron）。
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
            //     渲染 <span role=\"tooltip\"> 作为锚点的兄弟节点 inline 渲染——
            //     不 portal 到 body；className 是 undefined（CSS module stub 是空对象）。
            //     全 app 里 role=\"tooltip\" 只在 Tooltip 组件里出现——全局干掉无副作用。
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
        id: "hide-trajectory-tab",
        name: "隐藏对话中的\"轨迹\"标签",
        description: "对话顶部多了一个\"轨迹\"标签——展示模型/工具调用的事件账本（开发者视角）。非开发者用不上，看着也容易困惑。开启后完全隐藏这个标签，如果当前正停在轨迹视图会自动切回对话页。",
        configKeys: { enabled: "hideTrajectoryTab", value: "hideTrajectoryTab" },
        defaults: { enabled: true, value: true },
        buildCSS: function (state) {
          if (!state.hideTrajectoryTab) return null;
          return "/* === hide-trajectory-tab v0.7.0 : JS-side MutationObserver 给 \"轨迹\"/\"Trajectory\" 按钮打 data-dsh-ui-tweaks-hidden-tab=\"trajectory\"，CSS 命中隐藏 === */\n" +
            "[data-dsh-ui-tweaks-hidden-tab=\"trajectory\"]{display:none!important}";
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
      }
    ];

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
     */
    var SECTION_CSS =
      ".DTPD_section{max-width:760px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:18px;display:flex}\n" +
      ".DTPD_section h2{margin:0;font-size:18px;font-weight:600}\n" +
      ".DTPD_intro{color:var(--dsw-alias-label-tertiary);margin:0 0 4px;font-size:13px}\n" +
      ".DTPD_list{flex-direction:column;gap:10px;margin:0;padding:0;list-style:none;display:flex}\n" +
      ".DTPD_item{box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;flex-direction:column;gap:8px;padding:14px 16px;display:flex}\n" +
      ".DTPD_itemHead{flex-direction:row;justify-content:space-between;align-items:center;gap:12px;display:flex}\n" +
      ".DTPD_itemName{margin:0;font-size:14px;font-weight:500;line-height:22px}\n" +
      ".DTPD_itemDesc{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}\n" +
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
          return;
        }
        attach();
        var span = document.getElementById(SIMPLE_STATUS_ID);
        if (span !== null) span.textContent = simpleActivityText(simplePickToolNameFromDom());
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
        isRunning = false;
      }
      return {
        start: start,
        stop: stop,
        get running() { return isRunning; }
      };
    }

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

    // ====================================================================
    // React 组件
    // ====================================================================

    /**
     * 单条 tweak 的 row：标题 + 描述 + 开关 + 可选数字输入。
     *
     * 设计选择（v0.5.1）：
     *  - 开关**永远不 disabled**——用户必须能拨动它（v0.4.0 / v0.5.0 默认 enabled=false，
     *    但 UI 仍要可点；之前 `disabled={!enabled}` 用在 number input 是 bug，因为用户
     *    看不见开关时就被锁住，反人类）
     *  - number input 也**永远不 disabled**——可以先调像素再开开关
     *  - number input 用受控 value={value} + onChange 每键更新 parent state，
     *    没有 draft/useEffect 链。简化、消除受控 input 边界 race condition。
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
        }),
        jsxRuntime.jsx("p", { className: "DTPD_itemDesc", children: t.description })
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
        children: children
      });
    }

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