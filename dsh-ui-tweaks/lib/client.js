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
        // 版本号与各 tweak 引入历程见 `CHANGELOG.md`；本文件不重复 changelog 内容。
        var VERSION = "0.10.13";
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
        var SIMPLE_STATUS_ID = "dsh-ui-tweaks-status-row";
        var SIMPLE_STATUS_CLASS = "dsh-ui-tweaks-status";
        // 状态行 span 的活动类目标记（think / read / write / bash / task / plan / goal / git / generic），CSS 按此着色
        var SIMPLE_STATUS_ACTIVITY_ATTR = "data-dsh-activity";
        var SIMPLE_TURN_STATUS_SEL = '[class*="turnStatus"]';
        var SIMPLE_POLL_MS = 250;
        // 折叠块末尾收起按钮——给所有 DisclosureRow 展开后的 body 末尾追加"收起"按钮；
        // 覆盖 ReasoningRow / GenericCommandCard / ContextInjectionRow 三类。
        // button 在 body 元素里（wrapper div + button），点击时找 body 父元素里 row 那行
        // 调 .click()——DSH React onToggle 触发折叠，body 与按钮一起被卸载；stopPropagation
        // 避免冒泡到 row（row 是 body 兄弟不是祖先，但 click 也会途经 DisclosureRow wrapper——保险起见 stop）。
        var DISCLOSURE_END_COLLAPSE_WRAP_ATTR = "data-dsh-ui-tweaks-disclosure-collapse-wrap";
        var DISCLOSURE_END_COLLAPSE_ATTR = "data-dsh-ui-tweaks-disclosure-collapse";
        var DISCLOSURE_BODY_SELECTORS = [
          '[data-variant="think"] [class*="thinkBody"]',
          '[data-variant="others"] [class*="_body"]',
          '[class*="_root"][data-open] [class*="_body"]'
        ].join(", ");
        // 统计行位置 tweak（stats-line-position）锚点——DSH renderer SlotOutlet 给每个
        // 出口包 `<div data-slot="<slot key>" style="display:contents">`，不含构建 hash；
        // 只在兜底时才用 `[class*="..."]` 子串匹配。0.2.x 起该出口与 ContextMeter 同为
        // composer dock 行的子节点（出口在前、ContextMeter 在后），隐藏/取源都只在出口
        // 这一层做，见 `25-tweaks.js` 的兄弟选择器规则与 `69-stats-line-position.js`。
        var STATS_DOCK_SEL = '[data-slot="conversation.composer.dock"]';
        var STATS_HEADER_ACTIONS_SEL = '[data-slot="conversation.session.header.actions"]';
        var STATS_TITLE_CLUSTER_HINT_SEL = '[class*="_titleCluster"]';
        var STATS_ROOT_HINT_SEL = '[class*="_root"]';
        var STATS_MIRROR_ATTR = "data-dsh-ui-tweaks-stats-mirror";
        var STATS_POS_BOTTOM = "bottom";
        var STATS_POS_TOP = "top";
        var STATS_POS_HIDDEN = "hidden";
        var STATS_POLL_MS = 400;
        // conversation-shift 锚点——动态探测 chatflow / 输入框，打标记给 CSS 命中
        var SHIFT_TARGET_ATTR = "data-dsh-ui-tweaks-shift-target";
        var SHIFT_TARGET_CHATFLOW = "chatflow";
        var SHIFT_TARGET_INPUT = "input";
        var SHIFT_TARGET_COLUMN = "column";
        // DSH 稳定锚点：ConversationRoot.scrollBody 上的 data-conversation-scroll（DSH 源码显式 setAttribute），
        // 同时被 conversation-shift 和 first-message-jump 复用——DSH 改名时本常量 + JUMP_SCROLL_SEL 同步更新。
        var SHIFT_SCROLL_SEL = "[data-conversation-scroll]";
        // first-message-jump 按钮（"上一条我发的消息"导航）
        var JUMP_BTN_ID = "dsh-ui-tweaks-jump-btn";
        var JUMP_SCROLL_SEL = "[data-conversation-scroll]";
        var JUMP_USER_ROW_SEL = '[data-chat-flow-kind="user"]';
        var JUMP_COMPOSER_SEL = "[data-composer-seat]";
        var JUMP_DRAWER_ATTR = "data-dsh-any-side-drawer-open";
        var JUMP_TOP_PADDING = 12;
        var JUMP_NATIVE_GAP = 8;
        var JUMP_LABEL = "上一条我发的消息";
        var JUMP_BUTTON_TITLE = "上一条我发的消息（Shift+点击 = 回到最早）";
        // SVG 上箭头（▲ 朝上表示"上一条"）
        var JUMP_SVG_UP = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 10.5L8 6l4.5 4.5"/></svg>';

    // ===== tweaks =====
    /**
     * 集中维护的 UI 微调清单。每条 tweak：
     *   - id：稳定标识（注入 CSS 注释 + React key）
     *   - name：人类可读标题
     *   - description：人类可读说明（用户视角）
     *   - configKeys.enabled / configKeys.value：localStorage 字段名
     *   - defaults：未设值时的默认
     *   - choices（可选）：[{value,label}] 列表——有 choices 时 TweakRow 渲染
     *     <select> 而不是开关（v0.10.0 起；本插件目前仅 stats-line-position 使用）
     *   - buildCSS(state)：根据当前 state 生成 CSS 字符串；返回 null 表示不输出
     */
    var TWEAKS = [
      {
        id: "conversation-shift",
        name: "对话区右缩",
        description: "让对话列内的对话内容（消息气泡）整体左移 N 像素，腾出右侧空间——列容器本身宽度不变，滚动条与滚动指示器保持在原位。v0.10.2 起像素值在窄屏自动收紧到对话列宽度的 40%（`min(Npx, 40%)`），避免半屏浏览器时 380px 缩进吃掉过多对话宽度。",
        configKeys: { enabled: "conversationShift", value: "conversationShiftPx" },
        defaults: { enabled: false, value: 380 },
        buildCSS: function (state) {
          if (!state.conversationShift) return null;
          var px = Number(state.conversationShiftPx);
          if (!isFinite(px) || px < 0) px = 380;
          if (px > 800) px = 800; // safety cap（与 85-apply.js / 75-react-tweak-row.js onNumberChange 对齐）
          // min(Npx, 40%) 让窄屏自动收紧：40% 是命中元素的直接父 = scrollBody 包裹层宽度
          return "/* === conversation-shift : 命中 JS 探测标记的元素，min(" + px + "px, 40%) 窄屏自动收紧；无 transition === */\n" +
            "html [" + SHIFT_TARGET_ATTR + "]{padding-right:min(" + px + "px,40%) !important;box-sizing:border-box !important;}";
        }
      },
      {
        id: "conversation-shift-debug",
        name: "对话右缩调试高亮",
        description: "开启后给命中的对话列加 4px 黄色 outline + 黑底白字浮动标签（标签显示当前右缩像素值）。调试用——对话右缩关闭时也能开。",
        configKeys: { enabled: "conversationShiftDebug", value: "conversationShiftDebug" },
        defaults: { enabled: false, value: false },
        // 调试高亮 CSS 由 buildDebugHighlightCSS() 统一生成（依赖 conversationShiftPx）。
        // 这里返回 null 但保留字段——TWEAKS 数组是 UI+CSS+持久化的单一数据源，
        // 抽掉会让 buildCSS 内需要 if (id === "...") 分支。
        buildCSS: function (state) {
          return null;
        }
      },
      {
        id: "simple-mode",
        name: "简洁模式",
        description: "隐藏思考与工具调用过程，只在输入框上方显示一条极简状态行（正在思考…/正在阅读…/正在执行命令…）。错误信息（API 失败 / 4xx 5xx / 超时等，DSH 渲染为 [data-chat-flow-kind='turn-error']）**保留可见**——这些是排查问题必须的信号，隐藏后用户看不到失败原因。",
        // 仅开关型 tweak：enabled 和 value 复用同一 key；TweakRow 通过 k2===k1 检测不渲染数字框。
        configKeys: { enabled: "simpleModeEnabled", value: "simpleModeEnabled" },
        defaults: { enabled: true, value: true },
        buildCSS: function (state) {
          if (!state.simpleModeEnabled) return null;
          return "/* === simple-mode : hide tool-call / context / think / process rows（turn-error 保留显示——v0.10.12 起） === */\n" +
            // 防御性 layout zero：`display:none` 在 CSS Grid / VirtualList / parent inline min-height
            // 等 layout context 下不一定让元素彻底不占布局空间（用户反馈"间距时大时小"），
            // 把 height / min-height / max-height / margin / padding / border / flex / grid-area
            // 显式归零确保任何 context 下都不留残余高度。
            // turn-error（DSH 渲染 API 失败行的节点）v0.10.12 起从隐藏列表移除——
            // 用户反馈「本轮运行失败400: {...}」这类信息被吞掉就看不到排查线索。
            '[data-chat-flow-kind="tool-call"],' +
            '[data-chat-flow-kind="context"],' +
            '[data-variant="think"],' +
            '[data-chat-flow-kind="compaction"],' +
            '[data-chat-flow-kind="manual-compaction"],' +
            '[data-chat-flow-kind="model-retry"],' +
            // turn-error 故意保留显示——见 description。
            // '[data-chat-flow-kind="turn-error"],' +
            '[data-chat-flow-kind="turn-max-tokens"]{' +
              "display:none !important;" +
              "height:0 !important;" +
              "min-height:0 !important;" +
              "max-height:0 !important;" +
              "margin:0 !important;" +
              "padding:0 !important;" +
              "border:0 !important;" +
              "outline:0 !important;" +
              "flex:0 0 0 !important;" +
              "flex-basis:0 !important;" +
              "flex-grow:0 !important;" +
              "grid-area:auto !important" +
            "}\n" +
            // —— v0.9.10 status row —— 接管 DSH 原生 turnStatus 视觉呈现：
            //   DSH 原生可能用 transition + mask-image linear-gradient（而非 animation）做
            //   shimmer——animation:none 杀不掉 transition 驱动的效果；伪元素 spinner / 子元素
            //   loader 也不受父级 animation reset 影响。三层防线（容器属性 reset + 伪元素
            //   display:none + 直接子元素 hidden）覆盖所有可能 shimmer 源。
            //   padding-left / margin-left 显式归零修"几次 think / 工具调用穿插后像首行缩进"——
            //   DSH 在 assistant-step 累加后给 turnStatus 父链加缩进；inline 兜底在 55-simple-mode.js 的 purgeTurnStatus。
            "[class*=\"turnStatus\"]{" +
              "animation:none !important;" +
              "background:none !important;" +
              "background-image:none !important;" +
              "background-clip:border-box !important;" +
              "background-attachment:initial !important;" +
              "background-blend-mode:initial !important;" +
              "background-origin:initial !important;" +
              "background-position:initial !important;" +
              "background-repeat:initial !important;" +
              "background-size:initial !important;" +
              "-webkit-background-clip:border-box !important;" +
              "-webkit-text-fill-color:initial !important;" +
              "color:transparent !important;" +
              "font-size:0 !important;" +
              "line-height:0 !important;" +
              "height:18px !important;" +
              "align-items:center !important;" +
              "transition:none !important;" +
              "text-shadow:none !important;" +
              "box-shadow:none !important;" +
              "filter:none !important;" +
              "-webkit-mask-image:none !important;" +
              "mask-image:none !important;" +
              "-webkit-mask-size:initial !important;" +
              "mask-size:initial !important;" +
              "-webkit-mask-position:initial !important;" +
              "mask-position:initial !important;" +
              "-webkit-mask-repeat:initial !important;" +
              "mask-repeat:initial !important;" +
              "transform:none !important;" +
              "opacity:1 !important;" +
              "text-indent:0 !important;" +
              "letter-spacing:normal !important;" +
              "word-spacing:normal !important;" +
              "text-decoration:none !important;" +
              "padding-left:0 !important;" +
              "margin-left:0 !important;" +
              "overflow:hidden !important" +
            "}\n" +
            // 伪元素显式杀掉——DSH 经常在 ::before / ::after 上放 spinner / shimmer 装饰，
            // 容器 animation:none 不传递到伪元素的具体 background / 自身 animation。
            "[class*=\"turnStatus\"]::before," +
            "[class*=\"turnStatus\"]::after{" +
              "animation:none !important;" +
              "background:none !important;" +
              "background-image:none !important;" +
              "-webkit-background-clip:border-box !important;" +
              "-webkit-text-fill-color:initial !important;" +
              "color:transparent !important;" +
              "content:none !important;" +
              "display:none !important;" +
              "height:0 !important;" +
              "width:0 !important;" +
              "margin:0 !important;" +
              "padding:0 !important;" +
              "transition:none !important;" +
              "transform:none !important;" +
              "filter:none !important;" +
              "-webkit-mask-image:none !important;" +
              "mask-image:none !important;" +
              "text-shadow:none !important;" +
              "box-shadow:none !important" +
            "}\n" +
            // 直接子元素除我们 span 和 clock 外全部隐藏——DSH 完全可能多塞 <div class="turnStatusLoader">
            // 等做动画；substring selector 不依赖 hash。text node 不命中但父级 color:transparent + font-size:0 已无形
            "[class*=\"turnStatus\"] > *:not(.dsh-ui-tweaks-status):not([class*=\"turnStatusClock\"]){display:none !important}\n" +
            ".dsh-ui-tweaks-status{" +
              "display:inline-flex !important;" +
              "align-items:center;" +
              "gap:6px;" +
              "padding:0;" +
              "margin-left:0;" +
              "font-size:13px !important;" +
              "line-height:18px;" +
              "height:18px;" +
              "color:var(--dsw-alias-label-tertiary) !important;" +
              "-webkit-text-fill-color:var(--dsw-alias-label-tertiary) !important;" +
              "vertical-align:middle;" +
              "flex:none;" +
              "white-space:nowrap;" +
              "order:1;" +
              "transition:color .4s ease, -webkit-text-fill-color .4s ease;" +
              "visibility:visible !important" +
            "}\n" +
            // 静态点 ::before（6×6 圆点 + currentColor 跟活动色平滑过渡）；v0.9.7 起撤掉 v0.9.3 引入的呼吸动画（用户反馈脉动闪烁反客为主）
            ".dsh-ui-tweaks-status::before{" +
              "content:\"\";" +
              "width:6px;" +
              "height:6px;" +
              "border-radius:50%;" +
              "background:currentColor;" +
              "opacity:.7;" +
              "flex:none" +
            "}\n" +
            // DSH 自带 .turnStatusClock——flex order:2 重排到我们 span 后面解决"时间出现在 正在处理...的后面"
            // （纯 CSS、无新 DOM；DSH 1s setInterval 自动维护）。tabular-nums 让数字宽度稳定。
            "[class*=\"turnStatusClock\"]" +
              "{order:2;margin-left:8px;font-size:13px !important;" +
              "color:var(--dsw-alias-label-tertiary);" +
              "-webkit-text-fill-color:var(--dsw-alias-label-tertiary);" +
              "font-variant-numeric:tabular-nums;" +
              "font-weight:400;" +
              "animation:none !important;" +
              "background:none !important;" +
              "background-image:none !important;" +
              "-webkit-background-clip:border-box !important;" +
              "transition:none !important;" +
              "text-shadow:none !important;" +
              "box-shadow:none !important;" +
              "filter:none !important;" +
              "-webkit-mask-image:none !important;" +
              "mask-image:none !important;" +
              "visibility:visible !important" +
            "}\n" +
            // 8 类活动语义色——JS tick() 给 span setAttribute("data-dsh-activity", ...)
            // 顺序：think (思辨) / read (输入) / write (变更) / bash (执行) /
            //       task (调度) / plan (计划) / goal (跟踪) / git (版本) / generic (兜底)
            // 硬值 fallback——主题切到没有这些变量的主题时仍能着色
            ".dsh-ui-tweaks-status[data-dsh-activity=\"think\"]   {color:#2563eb !important;-webkit-text-fill-color:#2563eb !important}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"read\"]    {color:#475569 !important;-webkit-text-fill-color:#475569 !important}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"write\"]   {color:#d97706 !important;-webkit-text-fill-color:#d97706 !important}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"bash\"]    {color:#7c3aed !important;-webkit-text-fill-color:#7c3aed !important}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"task\"]    {color:#0891b2 !important;-webkit-text-fill-color:#0891b2 !important}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"plan\"]    {color:#059669 !important;-webkit-text-fill-color:#059669 !important}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"goal\"]    {color:#db2777 !important;-webkit-text-fill-color:#db2777 !important}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"git\"]     {color:#64748b !important;-webkit-text-fill-color:#64748b !important}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"generic\"] {color:var(--dsw-alias-label-tertiary) !important;-webkit-text-fill-color:var(--dsw-alias-label-tertiary) !important}";
        }
      },
      {
        id: "hide-sidebar-tooltip",
        name: "隐藏侧栏悬浮提示",
        description: "鼠标悬停在左侧栏会话项 / 工作窗口时弹出的深色卡片——展示会话全名 + 相对时间 + 状态（开发者用的 HoverCard），以及按钮上的简短 Tooltip 浮层。开启后全部关掉，根本用不上。",
        configKeys: { enabled: "hideSidebarTooltip", value: "hideSidebarTooltip" },
        defaults: { enabled: true, value: true },
        // 四层 selector：
        //   L1 role="tooltip" → DSH Tooltip 组件（@deepseek-ai/dsh-client-ui-primitives 的 Tooltip.js
        //       渲染 <span role="tooltip"> 作为锚点兄弟 inline 渲染，className 是 undefined）；
        //       全局 role="tooltip" 只在 Tooltip 组件里出现——干掉无副作用。
        //   L2 [class*="_hoverContent/_hoverTitle/_hoverTime/_hoverStatus/_hoverPath"] → HoverCard 内部内容
        //       （DSH workspace CSS Module hash 类），主防线，mount 时立即生效不闪。
        //   L3 body > div:has(> [class*="_hoverContent"]) → HoverCard card div 本身
        //       （背景色 #2C2C2E 的"窄黑框"——v0.7.4 修）；:has() Chromium 105+ 可用，DSH Electron 是现代 Chromium。
        //   L4 [data-dsh-ui-tweaks-hidden-hover-card] → JS observer 标记的兜底（DSH 升级 hash 变了或 :has() 不支持时接管，可能闪 80ms+）
        buildCSS: function (state) {
          if (!state.hideSidebarTooltip) return null;
          return "/* === hide-sidebar-tooltip : DSH Tooltip + HoverCard (含 card div 本体) 四层 selector === */\n" +
            "[role=\"tooltip\"]{display:none!important}\n" +
            "[class*=\"_hoverContent\"],[class*=\"_hoverTitle\"],[class*=\"_hoverTime\"],[class*=\"_hoverStatus\"],[class*=\"_hoverPath\"]{display:none!important}\n" +
            "body > div:has(> [class*=\"_hoverContent\"]){display:none!important}\n" +
            "[data-dsh-ui-tweaks-hidden-hover-card]{display:none!important}";
        }
      },
      {
        id: "hide-trajectory-tab",
        name: "隐藏对话中的\"轨迹\"标签",
        description: "对话顶部多了一个\"轨迹\"标签——展示模型/工具调用的事件账本（开发者视角）。同时把每个工具调用行（edit / pwsh / read / grep 等）右上角的\"Inspect\"按钮也关掉——点击它也会进入轨迹视图。非开发者用不上，看着也容易困惑。开启后完全隐藏这些入口；如果当前正停在轨迹视图会自动切回对话页。",
        configKeys: { enabled: "hideTrajectoryTab", value: "hideTrajectoryTab" },
        defaults: { enabled: true, value: true },
        // 两类入口：
        //   1) 顶部 tablist 的"轨迹"/"Trajectory"按钮——CSS 没有 :text() 选择器，所以由 JS 端用
        //      MutationObserver 巡检 [role="tablist"] 找文本匹配按钮打 data-dsh-ui-tweaks-hidden-tab="trajectory" 标记，
        //      CSS attribute selector 命中隐藏；如当前停在轨迹（aria-selected="true"）切回对话页。
        //   2) 每个工具调用 row 内的"Inspect"按钮——DSH 渲染 `<button class="*_inspectButton">`，substring
        //      匹配不依赖 hash，DSH 升级换 hash 仍命中。
        // 3) 两 tab 全隐藏时整行折叠：JS tick() 检测到 tablist 下所有 tab 都标了
        //    hidden-tab 时给 tablist 打 data-dsh-ui-tweaks-collapsed；CSS 据此
        //    display:none 隐藏空 tablist 行 + 父 header 的 min-height 改 auto
        //    （DSH header 默认 76px 是按 titleRow + tablist 算的，tablist 没了
        //    该缩成只剩 titleRow）。两边 buildCSS 各加一条，任一微调开启都让规则
        //    进入 CSS；同规则重复无副作用。
        buildCSS: function (state) {
          if (!state.hideTrajectoryTab) return null;
          return "/* === hide-trajectory-tab : 顶部 tablist 的 \"轨迹\"/\"Trajectory\" 按钮 + 每个工具行的 \"Inspect\" 按钮 + 两 tab 全隐藏时整行折叠 === */\n" +
            "[data-dsh-ui-tweaks-hidden-tab=\"trajectory\"]{display:none!important}\n" +
            "[class*=\"_inspectButton\"]{display:none!important}\n" +
            "[data-dsh-ui-tweaks-collapsed]{display:none!important}\n" +
            "header:has(> [data-dsh-ui-tweaks-collapsed]){min-height:auto!important}";
        }
      },
      {
        id: "hide-chat-tab",
        name: "隐藏对话中的\"对话\"标签",
        description: "对话顶部\"对话\"标签——开启后和 hide-trajectory-tab 一起把两个标签都关掉，整个 tablist 视觉消失。\"对话\"是默认 view，标签显示它毫无信息量，纯噪音。如果当前正停在轨迹视图会自动切回对话页。",
        configKeys: { enabled: "hideChatTab", value: "hideChatTab" },
        defaults: { enabled: true, value: true },
        // 和 hide-trajectory-tab 同模式——JS observer 通用 createTabHider 工厂标记 + CSS 命中；
        // 同样挂 tablist 整行折叠规则（任一微调开启都让规则进入 CSS）。
        buildCSS: function (state) {
          if (!state.hideChatTab) return null;
          return "/* === hide-chat-tab : JS-side MutationObserver 给 \"对话\"/\"Chat\" 按钮打 data-dsh-ui-tweaks-hidden-tab=\"chat\"，CSS 命中隐藏；两 tab 全隐藏时整行折叠 === */\n" +
            "[data-dsh-ui-tweaks-hidden-tab=\"chat\"]{display:none!important}\n" +
            "[data-dsh-ui-tweaks-collapsed]{display:none!important}\n" +
            "header:has(> [data-dsh-ui-tweaks-collapsed]){min-height:auto!important}";
        }
      },
      {
        id: "disclosure-end-collapse",
        name: "展开块末尾收起按钮",
        description: "Think / 工具调用 / 上下文注入等折叠块展开后，末尾追加一个\"收起\"按钮——阅读到底部能直接收起，不用滚回头部再点行。",
        // 仅开关型 tweak（同 simple-mode / hide-* 模式）
        configKeys: { enabled: "disclosureEndCollapse", value: "disclosureEndCollapse" },
        defaults: { enabled: true, value: true },
        buildCSS: function (state) {
          if (!state.disclosureEndCollapse) return null;
          return "/* === disclosure-end-collapse : DisclosureRow 展开后 body 末尾追加\"收起\"按钮（Think / 工具调用输出 / 上下文注入）=== */\n" +
            // wrapper div 强制 display:block 让按钮独占一行——不被 pre-wrap 文本内联吃掉
            "[data-dsh-ui-tweaks-disclosure-collapse-wrap]{display:block;margin:6px 0 2px 0}\n" +
            // 按钮 chip 形态：边框 + 圆角 + hover 背景；DSH 主题变量 fallback 链
            "[data-dsh-ui-tweaks-disclosure-collapse]{" +
              "display:inline-flex;" +
              "align-items:center;" +
              "gap:4px;" +
              "padding:3px 10px;" +
              "border:1px solid var(--dsw-alias-border-l1,#e5e7eb);" +
              "border-radius:6px;" +
              "background:var(--dsw-alias-bg-layer-1,#ffffff);" +
              "color:var(--dsw-alias-label-tertiary,#6b7280);" +
              "font-size:12px;" +
              "line-height:16px;" +
              "cursor:pointer;" +
              "user-select:none;" +
              "font-family:inherit;" +
              "transition:background .12s ease,color .12s ease,border-color .12s ease" +
            "}\n" +
            "[data-dsh-ui-tweaks-disclosure-collapse]:hover{" +
              "background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04));" +
              "color:var(--dsw-alias-label-secondary,#374151);" +
              "border-color:var(--dsw-alias-border-l2,#d0d5dd)" +
            "}\n" +
            "[data-dsh-ui-tweaks-disclosure-collapse]:focus-visible{" +
              "outline:2px solid var(--dsw-alias-state-business-primary,#2563eb);" +
              "outline-offset:2px" +
            "}";
        }
      },
      {
        id: "first-message-jump",
        name: "上一条我发的消息按钮（Shift+点击 = 回到最早）",
        description: "对话区右下角悬浮按钮——单击跳到当前视口内最顶部可见 user 消息的上一条，连续单击可一路向上直到最早一条（按钮始终可见作为提示）。Shift+单击 = 跳过 compact 摘要里的旧 user 行，直接到当前会话的第一条 user 消息。对称地，DSH 自带「回到底部」按钮的单击行为也被改为：单击 = 下一条 user 行，Shift+单击 = 一键到底。",
        configKeys: { enabled: "firstMessageJump", value: "firstMessageJump" },
        defaults: { enabled: true, value: true },
        // 控制器由 68-first-message-jump.js 的 createFirstMessageJumpController 负责（挂载 / 显隐 /
        // 定位 / 点击 / 原生按钮 capture-phase 钩子）；纯 finder/scanner 函数在 68a-first-message-jump-utils.js
        // （30 KB 阈值维护动作，行为无变化）。本 buildCSS 只输出按钮静态样式——
        // right/bottom 每次显隐时 JS 重设（初值是兜底）。
        buildCSS: function (state) {
          if (!state.firstMessageJump) return null;
          return "/* === first-message-jump : 上一条我发的消息按钮（样式对齐 DSH 自带「回到底部」按钮）=== */\n" +
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
      },
      {
        id: "sidebar-match-conversation-bg",
        name: "侧栏背景与对话一致",
        description: "DSH 默认左侧栏（展示会话列表的区域）有独立的背景色，与对话区视觉上有明显分割。开启后把侧栏列容器及其内 SidebarRoot（高度 100% 完全覆盖列容器）的背景都设为对话区同款，让两个区域在背景色上融合。会话项 / 按钮 / hover 态等子元素的视觉行为不变。",
        // 仅开关型 tweak（同 simple-mode / hide-* / disclosure-end-collapse 模式）
        configKeys: { enabled: "sidebarMatchConversationBg", value: "sidebarMatchConversationBg" },
        defaults: { enabled: false, value: false },
        buildCSS: function (state) {
          if (!state.sidebarMatchConversationBg) return null;
          // 三层兜底：
          //   ① [data-pane="sidebar"] 列容器显式 background（!important）——column 层
          //   ② [data-pane="sidebar"] [class*="_root"] 内部 _root 后代（DSH CSS module
          //      `<hash>_<name>_root` 子串匹配，hash-independence；SidebarRoot 当前
          //      `class*=` contains 在收起态也能命中 v0.9.14 改的修饰类名）
          //   ③ `--dsw-specific-sidebar-fill: transparent` 变量级覆盖——侧栏作用域内任何
          //      `var(--dsw-specific-sidebar-fill)` 引用都解析为透明，即使 DSH 后续在侧栏
          //      加新元素用此变量也不再显示原 sidebar-fill 色
          // fallback 链：--dsw-alias-bg-base（DSH 主背景）→ --dsw-alias-bg-layer-1 → #ffffff
          return "/* === sidebar-match-conversation-bg : 侧栏列容器 + 其内所有 _root 后代 + --dsw-specific-sidebar-fill 变量覆盖，三层兜底 === */\n" +
            "[data-pane=\"sidebar\"] {" +
              "background:var(--dsw-alias-bg-base,var(--dsw-alias-bg-layer-1,#ffffff)) !important;" +
              "--dsw-specific-sidebar-fill:transparent;" +
            "}\n" +
            "[data-pane=\"sidebar\"] [class*=\"_root\"] {" +
              "background:var(--dsw-alias-bg-base,var(--dsw-alias-bg-layer-1,#ffffff)) !important" +
            "}";
        }
      },
      {
        id: "stats-line-position",
        name: "统计行位置",
        description: "对话底部那行运行统计（轮次 / 步数、LLM 与工具耗时、首 token 与吞吐、缓存命中、输入输出 token）的位置。「底部」是 DSH 默认；「顶部标题右侧」把它挪到对话名与模式标签右边（内容与底部完全一致，标题行放不下时省略号截断，鼠标悬停看全文；v0.10.11 起两个 pill 之间恢复 12px gap，视觉与底部原生行对齐；顶部镜像里的按钮可点击，详情对话框从镜像按钮下方弹出——与底部同源同数据，但位置跟随顶部镜像而非底部隐藏的原生按钮，滚动时对话框跟随镜像 button 一起移动）；「不显示」则完全隐藏。非「底部」时原生行用 visibility 隐藏而非移除，保留它原本占的 24px——这样输入框位置与「底部」时完全一致，代价是输入框下方留一条等高空白。注意：隐藏作用于整个底部 dock 行——0.2.x 起 DSH 把上下文占用计量器（ContextMeter）也放进这一行、与统计行出口同级，所以选「顶部标题右侧」或「不显示」时会连它一起隐藏（想保留计量器请选「底部」）；老版本 DSH 上这一行只有统计行，规则不产生任何差别。若将来有别的插件也往这一行放东西，同样会被一并隐藏。",
        choices: [
          { value: STATS_POS_BOTTOM, label: "底部（DSH 默认）" },
          { value: STATS_POS_TOP, label: "顶部标题右侧" },
          { value: STATS_POS_HIDDEN, label: "不显示" }
        ],
        configKeys: { enabled: "statsLinePosition", value: "statsLinePosition" },
        defaults: { enabled: STATS_POS_BOTTOM, value: STATS_POS_BOTTOM },
        buildCSS: function (state) {
          var pos = statsNormalizePosition(state.statsLinePosition);
          if (pos === STATS_POS_BOTTOM) return null;
          // v0.10.1：用 visibility 而非 display 保留 24px 占位（display:none 会让 composer
          // 卡片变矮 → 输入框下移；visibility 保留盒子，React 照常更新文本，仅不渲染）
          // 两条选择器：出口自身 + 后代——visibility 本身是继承属性，但后代那条是显式兜底
          // 防 DSH 后续给统计行自己写 visibility 覆盖。!important 必需：出口的 display:contents
          // 是 inline style，普通样式表规则压不过它（同规则组保持一致强度）。
          // v0.10.13：0.2.x 起 DSH 把 ContextMeter（上下文占用计量器）放进同一个 dock 行，
          // 与 slot 出口同为该 flex 行的子节点（出口是它的**前一个兄弟**）——只隐藏出口不再
          // 等于隐藏整行。第三条规则以出口为锚，用通用兄弟选择器 `~` 把出口之后的同级节点
          // 一并隐藏：ContextMeter 的根节点是 `<span>`，所以用 `~ *` 而不是 `~ div`，不写死
          // 元素类型。仍是 visibility（保留占位、不改输入区高度）。老版本 DSH 的 dock 行里
          // 出口没有后继兄弟，该规则零命中、零副作用。
          var css = "/* === stats-line-position : " + pos + " —— 隐藏底部 composer.dock 出口（占位者 = DSH StatsPills = TimePill + UsagePill）+ 0.2.x 同行同级的 ContextMeter；visibility 保留占位 === */\n" +
            STATS_DOCK_SEL + "," + STATS_DOCK_SEL + " *{visibility:hidden !important;}\n" +
            "/* 0.2.x：ContextMeter 是 slot 出口的后继兄弟节点（同一 dock 行的 flex 子项），单独隐藏一次 */\n" +
            STATS_DOCK_SEL + " ~ *{visibility:hidden !important;}";
          if (pos !== STATS_POS_TOP) return css;
          // 顶部镜像外观：跟着标题簇的 flex 流排在"模式"标签右边（titleCluster 自带 gap:10px，
          // 无需额外 margin）。可收缩 + 省略号避免长统计挤没面包屑；tabular-nums 让数字跳动时
          // 宽度稳定。`<span class="..._sep">` 是从原生行克隆来的——DSH 自己的 _sep 规则继续生效。
          return css + "\n" +
            "[" + STATS_MIRROR_ATTR + "]{" +
              // v0.10.11：镜像自己也声明 display:inline-flex + gap:12px——原 DSH
              // `bOPqQW_root` 的 gap 在底部隐藏的 source 节点上，cloneNode 只搬子节点
              // 不会把它带过来；没有这条规则时两个 pill 的 anchor span 作为默认 inline 元素
              // 紧贴在一起。align-items:center 让两个 pill 垂直居中对齐。
              "display:inline-flex;" +
              "align-items:center;" +
              "gap:12px;" +
              "flex:0 1 auto;" +
              "min-width:0;" +
              "overflow:hidden;" +
              "white-space:nowrap;" +
              "text-overflow:ellipsis;" +
              "color:var(--dsw-alias-label-tertiary);" +
              "font-size:12px;" +
              "line-height:20px;" +
              "font-variant-numeric:tabular-nums;" +
              "cursor:default;" +
            "}\n" +
            // v0.10.10：DSH StatsPills 把 pill 渲染成 `<button>`，默认浏览器会给 button 加
            // background / border / padding / font——必须 reset 到镜像自己的"紧凑 inline-flex
            // + 纯文本"风格。`[data-dsh-ui-tweaks-stats-mirror] button` 特异性 (0,1,1) 高于
            // DSH `.css_pill` (0,1,0)，不需要 !important。focus-visible 给键盘用户一个 outline
            // 提示（鼠标点击不显示，避免在标题行噪声）。
            "[" + STATS_MIRROR_ATTR + "] button{" +
              "display:inline-flex;" +
              "align-items:center;" +
              "gap:4px;" +
              "background:transparent;" +
              "border:0;" +
              "padding:0;" +
              "margin:0;" +
              "font:inherit;" +
              "color:inherit;" +
              "cursor:pointer;" +
            "}\n" +
            "[" + STATS_MIRROR_ATTR + "] button:focus-visible{" +
              "outline:1px solid currentColor;" +
              "outline-offset:2px;" +
              "border-radius:2px;" +
            "}\n" +
            // 新会话开局 StatsPills 返回 null → 镜像为空——连同 titleCluster 的 gap 一起去掉，不留可疑空隙
            "[" + STATS_MIRROR_ATTR + "]:empty{display:none;}";
        }
      }
    ];

    // ===== storage =====
    // localStorage 持久化（按 dsh-persistent-plugin-authoring skill §三）

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
    // CSS 注入

    function buildCSS(state) {
      var blocks = [];
      for (var i = 0; i < TWEAKS.length; i++) {
        var css = TWEAKS[i].buildCSS(state);
        if (css) blocks.push(css);
      }
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
     * v0.5.1 设计：switch 用显式 fallback 色（不依赖 `--dsw-alias-bg-component-disabled`，
     * 该变量在某些 DSH 主题下接近背景色导致开关看不见）；input 永远不 disabled。
     * v0.7.5：description 从 `<p>` 收进 `title` 属性，row 默认不渲染描述，给
     * `.DTPD_item` 加 `cursor:help` 提示可悬停看说明；移除 `.DTPD_itemDesc` 规则。
     * v0.10.0：加 `.DTPD_select`——"多选一"tweak（首例 stats-line-position）
     * 头部右侧渲染下拉框而非开关，外观对齐 `.DTPD_input`。
     * v0.10.3：去掉 `.DTPD_switch` 的 `border:1px solid`（v0.6.0 起加的）——
     * 1px 边框让 pill 看起来"有点方圆"。但本次仅去 border、未恢复尺寸。
     * v0.10.4：`.DTPD_switch` 尺寸从 v0.6.0 放大的 `36×22` / thumb `18×18` 回退到
     * v0.5.1 之前的 `34×20` / thumb `16×16`——用户实测"去掉边框后还是方方的"，
     * 真正的"圆圆的"需要在更紧凑尺寸下两端圆形轮廓才能显现。
     *   thumb `top:1px → 2px`、`left:1px → 2px`：22px 高 + 18px thumb 只剩 2px
     *   上下边距，pill 的"圆"被压缩；20px 高 + 16px thumb + 2px 边距 = 4px 边距，
     *   pill 两端圆形轮廓更明显。
     *   translateX 保持 `14px`：34px 宽里 `14+16+2=32`、knob 右边距 2px；36px 宽
     *   里 `14+18+1=33`、knob 右边距 3px，数值上都成立。
     */
    var SECTION_CSS =
      ".DTPD_section{max-width:760px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:18px;display:flex}\n" +
      ".DTPD_section h2{margin:0;font-size:18px;font-weight:600}\n" +
      ".DTPD_intro{color:var(--dsw-alias-label-tertiary);margin:0 0 4px;font-size:13px}\n" +
      ".DTPD_list{flex-direction:column;gap:10px;margin:0;padding:0;list-style:none;display:flex}\n" +
      ".DTPD_item{cursor:help;box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;flex-direction:column;gap:8px;padding:14px 16px;display:flex}\n" +
      ".DTPD_itemHead{flex-direction:row;justify-content:space-between;align-items:center;gap:12px;display:flex}\n" +
      ".DTPD_itemName{margin:0;font-size:14px;font-weight:500;line-height:22px}\n" +
      ".DTPD_switch{appearance:none;-webkit-appearance:none;cursor:pointer;width:34px;height:20px;background:var(--dsw-alias-bg-component-disabled,#cbd5e1);border-radius:999px;position:relative;transition:background .15s ease;flex:none;margin:0;padding:0}\n" +
      ".DTPD_switch:checked{background:var(--dsw-alias-state-business-primary,#2563eb)}\n" +
      ".DTPD_switch::after{content:\"\";position:absolute;top:2px;left:2px;width:16px;height:16px;background:var(--dsw-alias-bg-layer-1,#fff);border-radius:50%;transition:transform .15s ease;box-shadow:0 1px 2px rgba(0,0,0,.18)}\n" +
      ".DTPD_switch:checked::after{transform:translateX(14px)}\n" +
      ".DTPD_valueRow{align-items:center;gap:8px;display:flex}\n" +
      ".DTPD_valueLabel{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;min-width:64px}\n" +
      ".DTPD_input{box-sizing:border-box;width:120px;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-input-major,#fff);border:1px solid var(--dsw-alias-border-l2,#94a3b8);border-radius:6px;padding:4px 8px;font-family:inherit;font-size:13px;line-height:20px}\n" +
      ".DTPD_input:focus{border-color:var(--dsw-alias-state-business-primary,#2563eb);outline:none}\n" +
      ".DTPD_select{box-sizing:border-box;flex:none;min-width:150px;cursor:pointer;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-input-major,#fff);border:1px solid var(--dsw-alias-border-l2,#94a3b8);border-radius:6px;padding:4px 8px;font-family:inherit;font-size:13px;line-height:20px}\n" +
      ".DTPD_select:focus{border-color:var(--dsw-alias-state-business-primary,#2563eb);outline:none}";

    function injectSectionCSS() {
      if (document.querySelector("style[data-plugin-css=\"" + SECTION_CSS_TAG_ID + "\"]")) return;
      var tag = document.createElement("style");
      tag.dataset.plugin = "dsh-ui-tweaks";
      tag.dataset.pluginCss = SECTION_CSS_TAG_ID;
      tag.textContent = SECTION_CSS;
      document.head.appendChild(tag);
    }

    // ===== shim =====
    // Self-shim：自己种 data-pane="conversation" 属性（4 层 fallback selector，按可信度递减）

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
        // 顺带跑一次 chatflow 探测——self-shim observer 启动早且观察 body subtree，
        // 必然能捕获 centerCol 后续渲染；startChatflowMarksObserver 在 apply() 时
        // 如果 centerCol 还没渲染会静默失败，这里作兜底。applyChatflowShiftMarks
        // 幂等性（已是最优标记就跳过重打）保证不会破坏 v0.5.4 修过的"来回弹"循环。
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
    // 动态探测 chatflow 容器 / 输入框，打 data 属性标记给 conversation-shift CSS 命中。
    // 背景：v0.5.2 用 `> *` 选择器假设 centerCol 直接子元素是 chatflow 容器——实际 DSH
    // 结构可能更深，命中 0 个元素；v0.5.3 起改 JS 探测 + 标记，v0.5.4 收窄 observer 范围
    // 避免「来回弹」视觉循环，v0.5.5 加幂等性 + 接入 self-shim observer 兜底。
    //
    // v0.10.2 探测策略升级：首选 DSH 稳定锚点 [data-conversation-scroll]（DSH 自己打的
    // 属性，不含构建 hash）——命中即停，**不再额外标 input**（避免 v0.5.3 双 padding bug：
    // chatflow + input 同时打标记 → CSS 叠加 380+380=760，窄屏溢出/被裁）。v0.5.3 的
    // overflow + [data-chat-flow-kind] 探测保留作 DSH 改 data-conversation-scroll 时的兜底。
    /**
     * 在 centerCol 列容器内探测 chatflow 容器和输入框。
     * 探测策略（v0.10.2 起）：
     *   策略 1（首选）：DSH scrollBody 锚点 `[data-conversation-scroll]`——
     *     `ConversationRoot.scrollBody` 上 DSH 自己打的稳定属性，跨版本
     *     不变；命中即返回，**不再额外探测 input**（避免 v0.5.3 的双 padding
     *     bug——见头注释）。
     *   策略 2（兜底）：v0.5.3 原始的 overflow + [data-chat-flow-kind] 探测
     *     ——DSH 升级去掉 `data-conversation-scroll` 时仍能工作（有消息时）。
     *   策略 3（兜底）：input 探测（contenteditable=true / textarea / role=
     *     textbox 的最近祖先）。只有 chatflow 完全没找到时才使用（DSH 极端
     *     布局变动把 composer 拆出 scrollBody 的场景）。
     * 返回 { chatflow, input, found }；任一找到即为 found=true。
     */
    function findChatflowTargets(centerColEl) {
      if (!centerColEl || typeof document === "undefined") {
        return { chatflow: null, input: null, found: false };
      }

      var chatflow = null;

      // 策略 1（v0.10.2 起首选）：DSH 稳定锚点 [data-conversation-scroll]
      //   ConversationRoot 的 scrollBody——空会话（有 composer 无消息）也命中
      //   ——v0.5.3 的 overflow+chat-flow-kind 在空会话会失效。
      //   命中后直接返回，不走 input 探测（避免双 padding，见头注释）。
      var scrollEl = centerColEl.querySelector(SHIFT_SCROLL_SEL);
      if (scrollEl) {
        return {
          chatflow: scrollEl,
          input: null,
          found: true
        };
      }

      // 策略 2（v0.5.3 兜底）：overflow 容器 + 含 [data-chat-flow-kind]
      //   仅在策略 1 失败时跑——DSH 升级把 data-conversation-scroll 改名的
      //   兜底路径（有消息时仍能工作）。命中后同样不再标 input。
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
      if (chatflow) {
        return {
          chatflow: chatflow,
          input: null,
          found: true
        };
      }

      // 策略 3（v0.5.3 兜底）：input 探测——DSH 未来把 composer 拆出 scrollBody
      //   时的最后防线。contenteditable=true / textarea / role=textbox 的最近
      //   祖先（向上走到 centerCol 的直接子）。
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
        chatflow: null,
        input: input,
        found: !!input
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

      // 需要更新：清理旧标记 + 打新标记
      for (var k = 0; k < existingMarks.length; k++) {
        existingMarks[k].removeAttribute(SHIFT_TARGET_ATTR);
      }
      if (existingColMark) col.removeAttribute(SHIFT_TARGET_ATTR);

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
    // 调试高亮：toggle <html data-dsh-ui-tweaks-shift-debug> 属性 + 给命中元素写 data-shift-px

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

    // inspect 单个 DOM 元素（不走 selector——调用方已有 nodes 数组）。
    // 与 inspectMatch 不同：本函数不依赖 document.querySelector，能直接对
    // querySelectorAll 返回的 nodeList 元素逐一产生诊断条目——避免
    // applyDebugMode 重复 querySelectorAll + 只 inspect 第 1 个匹配。
    function inspectElement(el) {
      if (el === null || el === undefined) return { found: false };
      var cs = (typeof window !== "undefined" && window.getComputedStyle) ? window.getComputedStyle(el) : null;
      var rect = (typeof el.getBoundingClientRect === "function") ? el.getBoundingClientRect() : null;
      return {
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
     * 调试模式独立于 conversation-shift 开关——README 已说明"对话右缩关闭时也能开"。
     * @param enabled 调试模式开关
     * @param shiftPx 当前右缩像素值
     */
    function applyDebugMode(enabled, shiftPx) {
      if (typeof document === "undefined") return;
      if (enabled) {
        document.documentElement.setAttribute(DEBUG_HTML_ATTR, "");
        // v0.5.3 起：写到 JS 探测标记的元素 [data-dsh-ui-tweaks-shift-target] 上
        var nodes = document.querySelectorAll('[' + SHIFT_TARGET_ATTR + ']');
        var diagnostics = [];
        for (var i = 0; i < nodes.length; i++) {
          nodes[i].setAttribute("data-shift-px", String(shiftPx || 0));
          diagnostics.push(inspectElement(nodes[i]));
        }
        try {
          console.info("[dsh-ui-tweaks] conversation-shift-debug matched elements (JS 探测标记的元素):", diagnostics);
        } catch (e) { /* 静默 */ }
      } else {
        document.documentElement.removeAttribute(DEBUG_HTML_ATTR);
        // 防御性：清理上次留下的 data-shift-px 属性，避免在 DOM 上残留
        var stale = document.querySelectorAll('[' + SHIFT_TARGET_ATTR + '][data-shift-px]');
        for (var j = 0; j < stale.length; j++) {
          stale[j].removeAttribute("data-shift-px");
        }
      }
    }

    // ===== simple-mode =====
    // 简洁模式：状态行 DOM controller（从原 dsh-simple-mode/lib/client.js 移植）。
    //
    // 关键修复（v0.9.5）：`simplePickToolNameFromDom` 之前查 `[data-tool-name]`（命名错误），
    // DSH 实际渲染 `[data-tool]`——v0.9.3 起的 8 类语义色全部从 v0.9.3 发布起就未生效过。
    // 同时新增 simpleIsThinkingFromDom 识别 reasoning block（不在 tool-call 容器里，
    // 在 assistant-step 的 [data-variant="think"] 上），simplePickActivityName 统一
    // 入口 think 优先 → tool-call → fallback。
    //
    // 关键修复（v0.9.12）：v0.9.10 三层 CSS reset 不够（用户反馈状态行还会一闪一闪，
    // think / 工具调用穿插几次后"首行缩进"）。走 JS 路径接管：
    //   1) `purgeTurnStatus()` appendChild 前先清空容器，保留 clock 再追加——杀干净
    //      DSH 原生 loader / shimmer child（v0.9.10 CSS 第 3 层没覆盖的子元素）
    //   2) `watchTurnStatus()` 升级：观察 document.body subtree，任何新 turnStatus
    //      节点出现就立即 purge——杀零 tick 250ms 间隔的闪援窗口
    //   3) `purgeTurnStatus()` 把 inline padding-left / margin-left 归零，修"首行缩进"

    function simpleActivityText(name) {
      if (!name) return "正在处理…";
      // think / reason——reasoning block（data-variant="think"）不在 tool-call
      // 容器里，由 simpleIsThinkingFromDom 提前返回 "think"
      if (name === "think" || (typeof name === "string" && name.indexOf("reason") === 0)) return "正在思考…";
      // 文件系统读取类（含 read_image）
      if (name === "read" || name === "read_image" || name === "web_fetch") return "正在阅读…";
      if (name === "web_search") return "正在搜索…";
      if (name === "grep" || name === "glob") return "正在查找…";
      // 文件编辑类
      if (name === "edit" || name === "write") return "正在修改文件…";
      // shell / 代码执行
      if (name === "bash" || name === "bash_persistent" || name === "pwsh" || name === "pwsh_persistent" || name === "run_code") return "正在执行命令…";
      // 任务调度——subagent / workflow / ralph / agent 控制 / 消息
      if (name === "subagent" || name === "workflow" || name === "ralph" || name === "task" || name === "agent") return "正在调度子任务…";
      if (name === "send_message" || name === "interrupt_agent" || name === "list_agents") return "正在协调子任务…";
      if (name === "ask_user_question") return "等待你回答…";
      // 任务清单 / 计划——DSH 实际是 todo_write（v0.9.3 之前错把 todo 写这里）
      if (name === "todo_write" || name === "todo" || name === "plan" || name === "update_plan") return "正在整理计划…";
      // 目标跟踪
      if (name === "get_goal" || name === "create_goal" || name === "update_goal" || name === "goal" || name === "objective") return "正在处理目标…";
      // jobs / skill 类轻量
      if (name === "job_output" || name === "job_list" || name === "job_kill" || name === "skill") return "正在调度…";
      // 历史扩展名——保留兼容（新工具未必启用，但 fallback 不至于坏）
      if (name === "lsp" || name === "intellisense") return "正在查询代码…";
      if (name === "commit" || name === "git") return "正在提交代码…";
      if (name === "push") return "正在推送…";
      return "正在处理…";
    }

    // v0.9.3：simpleActivityCategory(name) 返回活动类目（think / read / write /
    // bash / task / plan / goal / git / generic）。simpleActivityText 给出文案，
    // 这个给出颜色——两个轴解耦，新增工具只需在这里加一行 + CSS 加一条着色规则。
    //
    // v0.9.5 扩展：覆盖 DSH 实际工具名。`run_code` 从 bash 移到 code 单独类目
    // ——但 CSS 当前只支持 8 类（think/read/write/bash/task/plan/goal/git），
    // 为了不引入第 9 色，run_code 仍归 bash（执行类）。`todo_write` 取代
    // v0.9.3 写错的 `todo`（DSH 实际是 `todo_write`，`todo` 永远查不到）。
    // `subagent` / `workflow` / `ralph` / `job_*` / `ask_user_question` /
    // `send_message` / `interrupt_agent` / `list_agents` / `skill` 归 task。
    // cordis_* 走 prefix 匹配（DSH 注册名 `cordis_define` / `cordis_run` 等）。
    function simpleActivityCategory(name) {
      if (!name) return "generic";
      if (name === "think" || (typeof name === "string" && name.indexOf("reason") === 0)) return "think";
      if (name === "read" || name === "read_image" || name === "web_fetch" || name === "web_search" || name === "grep" || name === "glob") return "read";
      if (name === "edit" || name === "write") return "write";
      if (name === "bash" || name === "bash_persistent" || name === "pwsh" || name === "pwsh_persistent" || name === "run_code") return "bash";
      if (name === "subagent" || name === "workflow" || name === "ralph" || name === "task" || name === "agent" || name === "send_message" || name === "interrupt_agent" || name === "list_agents" || name === "ask_user_question" || name === "job_output" || name === "job_list" || name === "job_kill" || name === "skill" || (typeof name === "string" && name.indexOf("cordis_") === 0)) return "task";
      if (name === "todo_write" || name === "todo" || name === "plan" || name === "update_plan") return "plan";
      if (name === "get_goal" || name === "create_goal" || name === "update_goal" || name === "goal" || name === "objective") return "goal";
      if (name === "commit" || name === "git" || name === "push") return "git";
      return "generic";
    }

    // v0.9.5：simplePickToolNameFromDom 改查 `[data-tool]`（DSH 实际渲染的
    // 属性名，见 dsh-client-ui-tool/lib/client.js ToolRow：`"data-tool": toolName`）。
    // 旧路径 `[data-tool-name]` 是命名错误——v0.9.3 美术度升级时
    // 写错了 selector，从 v0.9.3 发布起 8 类语义色**全部未生效**。
    // 保留 `[data-name]` / `[class*="toolName"]` / `[class*="toolLabel"]`
    // 作 fallback——以防 DSH 未来切换到不同的属性约定（substring match 不依赖 hash，
    // 与 v0.7.3 hide-sidebar-tooltip CSS 的 substring 策略一致）。
    function simplePickToolNameFromDom() {
      if (typeof document === "undefined") return null;
      var nodes = document.querySelectorAll('[data-chat-flow-kind="tool-call"]');
      if (nodes.length === 0) return null;
      var last = nodes[nodes.length - 1];
      // 主路径：DSH ToolRow 渲染的 data-tool 属性（v0.9.5 起）
      var named = last.querySelector("[data-tool]");
      if (named) {
        var dn = named.getAttribute("data-tool");
        if (dn) return dn;
      }
      // 兜底 1：data-name——历史 DSH 早期可能用过
      var named2 = last.querySelector("[data-name]");
      if (named2) {
        var dn2 = named2.getAttribute("data-name");
        if (dn2) return dn2;
      }
      // 兜底 2：CSS module hash class 子串匹配（DSH 升级换 hash 仍命中）
      var labels = last.querySelectorAll('[class*="toolName"], [class*="toolLabel"]');
      for (var i = 0; i < labels.length; i++) {
        var t = (labels[i].textContent || "").trim();
        if (t) return t;
      }
      return null;
    }

    // v0.9.5：reasoning / think block 渲染在 assistant-step 节点的
    // `[data-variant="think"]` 上（见 dsh-client-ui-conversation/lib/client.js
    // ReasoningRow：`"data-variant": "think"` + `"data-state": "running"`），
    // 不在 tool-call 容器里——simplePickToolNameFromDom 找不到。
    // 单独探测 `[data-state="running"]` 的 think block，存在即认为正在思考。
    // 注意 simple-mode 已把 `[data-variant="think"]` 整行 display:none，但
    // querySelectorAll 不看渲染状态——DOM 里有就能命中。
    function simpleIsThinkingFromDom() {
      if (typeof document === "undefined") return false;
      // 只在当前有 assistant-step 节点（最近的一批）里查——性能优化，避免每次
      // 250ms tick 扫整个 DOM。`[data-chat-flow-kind="assistant-step"]` 与
      // `simplePickToolNameFromDom` 的 `[data-chat-flow-kind="tool-call"]` 对称。
      var steps = document.querySelectorAll('[data-chat-flow-kind="assistant-step"]');
      if (steps.length === 0) return false;
      // 取最后一个（最新）assistant-step 内的 think block
      var last = steps[steps.length - 1];
      // 找 data-state="running" 的 think 块——reasoning 正在流式输出
      var running = last.querySelector('[data-variant="think"][data-state="running"]');
      return running !== null;
    }

    // v0.9.5：simplePickActivityName 统一入口。think（reasoning 流式）优先于
    // tool-call——因为模型先 think 再调工具，think 状态先出现时还没 tool-call
    // 节点；tool-call 出现后由 simplePickToolNameFromDom 接替。返回 "think" /
    // "toolName" / null（generic fallback）三种。
    // 性能：两个 querySelector 各自 250ms 一次，单次 0.5ms 量级，可忽略。
    function simplePickActivityName() {
      if (simpleIsThinkingFromDom()) return "think";
      return simplePickToolNameFromDom();
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
      // v0.9.3：缓存上次写入 span 的 (category, text) 合并 key——tick 每 250ms 跑一次，
      // 但 99% 时间工具名没变（同时 category 也不变），不写 DOM 就不会触发 React
      // reconciler 监听 attribute / textContent 变化。category 用 "\u0000" 与 text
      // 隔开防止碰撞（工具名 / 文案里都不会出现 NUL）。
      var lastKey = null;

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

      // [perf v0.x] tick() 高频（250ms）跑，findTurnStatus + getLatestTurnStatus
      // 都走 querySelectorAll(SIMPLE_TURN_STATUS_SEL)——两个调用共享一次结果。
      function queryTurnStatusList() {
        if (typeof document === "undefined") return null;
        return document.querySelectorAll(SIMPLE_TURN_STATUS_SEL);
      }

      function findTurnStatus(nodes) {
        if (nodes === undefined) nodes = queryTurnStatusList();
        if (nodes === null) return null;
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

      // v0.9.12：清空容器并保留 clock——v0.9.10 CHANGELOG [Unreleased] line 63
      //   预设的回退路径。DSH loader / shimmer child（包括 React mount 第一帧
      //   CSS 还没应用时的瞬闪）一律在 JS 阶段干掉，比 v0.9.10 三层 CSS reset
      //   更彻底。同时把 inline padding/margin 归零，修 assistant-step 累加后
      //   状态行看起来像"首行缩进"。
      function purgeTurnStatus(turnStatus) {
        if (turnStatus === null || turnStatus === undefined) return;
        if (typeof document === "undefined") return;
        // 保存 clock（无论 DSH 是否已渲染——querySelector 返回 null 时跳过）
        var clock = turnStatus.querySelector('[class*="turnStatusClock"]');
        // 抹掉所有子节点——包括 DSH loader / shimmer / 我们的 span（旧）/ 其它
        while (turnStatus.firstChild) turnStatus.removeChild(turnStatus.firstChild);
        // 还原 clock 到容器里（如果之前有的话）
        if (clock !== null) turnStatus.appendChild(clock);
        // 防御性归零 inline padding/margin——修"穿插几次后像首行缩进"
        turnStatus.style.paddingLeft = '0';
        turnStatus.style.marginLeft = '0';
      }

      // 取 DOM 里文档顺序的最后一个 turnStatus（最新的 turn）。
      // 与 findTurnStatus 的区别：本函数不跳过任何 turnStatus——拿到
      // 当前正在运行的 turn（即使它已包含我们的 span）。
      // DSH 在历史已结束 turn 里会保留 [class*="turnStatus"] 节点，
      // 此时最新 turnStatus 与 current 可能不同，需走 reattach 路径。
      function getLatestTurnStatus(nodes) {
        if (nodes === undefined) nodes = queryTurnStatusList();
        if (nodes === null) return null;
        return nodes.length > 0 ? nodes[nodes.length - 1] : null;
      }

      function attach() {
        if (typeof document === "undefined") return;
        // [perf] tick 高频（250ms）；先把 turnStatus 节点列表查一次，
        // 后续 findTurnStatus / getLatestTurnStatus 共享。
        var nodes = queryTurnStatusList();
        // 已经在 attach 到当前 turnStatus——watchTurnStatus 的 MutationObserver
        // 会负责把 span 重新挂回去（DSH 偶尔会把它 detach），不需要每 250ms 重新
        // 跑 findTurnStatus + ensureStatusSpan + appendChild。
        //
        // 守卫条件收紧：除了「span 已挂在某个父节点」之外，还要求 current 是
        // DOM 里文档顺序的最后一个 turnStatus。DSH 在历史 turn 里会保留
        // [class*="turnStatus"] 节点不删（completed turn 仍可见），此时若用户
        // 开启新一轮，DSH 在尾部新增 turnStatus，原来的 current 不再是"最新"，
        // 必须走 reattach 路径把 span 搬过去——否则旧 turn 上的 status 行
        // 会跟到历史里。
        if (current !== null) {
          var existing = document.getElementById(SIMPLE_STATUS_ID);
          if (existing !== null && existing.parentNode === current && current === getLatestTurnStatus(nodes)) return;
        }
        var turnStatus = findTurnStatus(nodes);
        if (turnStatus === null) { current = null; return; }
        if (turnStatus !== lastTurnStatus) {
          lastTurnStatus = turnStatus;
          watchTurnStatus();
        }
        // v0.9.12：先 purge 后 append——v0.9.10 CSS 没杀干净的 DSH child 在
        // 这步一律干掉。appendChild 触发 turnStatus 的 layout 重排但不触发
        // MutationObserver（subtree 自身 childList 没变），开销可忽略。
        purgeTurnStatus(turnStatus);
        var span = ensureStatusSpan();
        if (span.parentNode !== turnStatus) turnStatus.appendChild(span);
        current = turnStatus;
      }

      function detach() {
        if (typeof document === "undefined") return;
        var span = document.getElementById(SIMPLE_STATUS_ID);
        if (span !== null && span.parentNode !== null) span.parentNode.removeChild(span);
      }

      // v0.9.12：watchTurnStatus 升级——观察 document.body subtree 而非
      // `el.parentNode`（v0.9.11 旧实现局限：DSH 在 React 重渲时会换掉整个
      // assistant-step 节点，旧 observer 失去目标后变僵尸）。新策略：
      //   1) 任何 mutation 触发时检查当前 span 是否仍挂在我们想挂的 turnStatus
      //      上；不是就 reattach（保留 purge 以防 DSH 偷偷在 mount 后塞 loader）
      //   2) 任何 added node（直接添加或深层嵌套）含 turnStatus，立即 purge——
      //      杀零 tick 250ms 间隔的闪援窗口：DSH 重渲立刻被拦截
      function watchTurnStatus() {
        if (turnObserver !== null) { turnObserver.disconnect(); turnObserver = null; }
        if (typeof MutationObserver === "undefined") return;
        turnObserver = new MutationObserver(function (records) {
          if (typeof document === "undefined") return;
          var span = document.getElementById(SIMPLE_STATUS_ID);
          // 1) Reattach：如果我们 span 已 orphaned 但 turnStatus 还在
          if (span !== null && current !== null && span.parentNode !== current) {
            if (current.parentNode !== null) current.appendChild(span);
          }
          // 2) Purge 任何新增的 turnStatus 节点（直接添加或深层）——
          //    包括整个 `[class*="turnStatus"]` 被 DSH 替换 / 重渲时的新实例
          for (var i = 0; i < records.length; i++) {
            var rec = records[i];
            for (var j = 0; j < rec.addedNodes.length; j++) {
              var added = rec.addedNodes[j];
              if (added === null || added === undefined) continue;
              if (added.nodeType !== 1) continue;
              if (typeof added.matches === "function" && added.matches(SIMPLE_TURN_STATUS_SEL)) {
                purgeTurnStatus(added);
                // 如果我们目前还没 attach，新出现的 turnStatus 就是目标
                if (current === null) current = added;
              }
              var sub = null;
              try { sub = added.querySelectorAll(SIMPLE_TURN_STATUS_SEL); } catch (_) { sub = []; }
              for (var k = 0; k < sub.length; k++) {
                purgeTurnStatus(sub[k]);
                if (current === null) current = sub[k];
              }
            }
          }
          // 3) 如果我们 span 完全丢失 / current 失效，下次 tick() 会重新 attach
        });
        turnObserver.observe(document.body, { childList: true, subtree: true });
      }

      function tick() {
        if (typeof document === "undefined") return;
        if (!simpleIsRunningFromDom()) {
          if (current !== null) { detach(); current = null; }
          lastKey = null;
          return;
        }
        attach();
        var span = document.getElementById(SIMPLE_STATUS_ID);
        if (span === null) return;
        // v0.9.5：simplePickActivityName 统一入口——think 优先于 tool-call。
        // 之前直接调 simplePickToolNameFromDom 时，think 状态返回 null →
        // "正在处理…"（generic 灰）；reasoning block 不在 tool-call 容器里
        // 这件事从 v0.9.3 美术度升级起就一直没解决。
        var name = simplePickActivityName();
        var text = simpleActivityText(name);
        // v0.9.3：category 给 CSS 着色用（[data-dsh-activity]），与 text 同步写。
        // 合并 key = category + "\u0000" + text——任一变化才走 DOM 写，避免 250ms
        // 轮询 × React reconciler 监听 attribute / textContent 变化的浪费。
        var category = simpleActivityCategory(name);
        var key = category + "\u0000" + text;
        if (key === lastKey) return;
        lastKey = key;
        span.textContent = text;
        span.setAttribute(SIMPLE_STATUS_ACTIVITY_ATTR, category);
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
        lastKey = null;
        isRunning = false;
      }
      return {
        start: start,
        stop: stop,
        get running() { return isRunning; }
      };
    }

    // ===== tab-hider =====
    // 通用 tab hider 工厂——给 DSH 对话顶部 [role="tablist"] 里某个 tab 按钮打标记隐藏，
    // 并确保另一 tab 始终是当前选中（hider 强制对方 selected，避免单 tab 被隐藏时
    // 用户卡在那个 view 出不来）。
    //
    // 用法：
    //   hide-trajectory-tab：target="轨迹" + safe="对话"（轨迹被隐藏时强制对话）
    //   hide-chat-tab：      target="对话" + safe="轨迹"（对话被隐藏时强制轨迹）
    //
    // 两 tab 同时被 hide 时双方 safe 都被另一方标了 hidden-tab——
    // tick() 防御性跳过强制（双方互不 ping-pong），保留最后手动点的状态；
    // 视觉上 tablist 已折叠（见 hide-trajectory-tab / hide-chat-tab buildCSS）。

    // 多语言匹配集合（DSH zh / en；其它 locale 暂不支持）
    var TRAJECTORY_TAB_LABELS = ["轨迹", "Trajectory"];
    var CHAT_TAB_LABELS = ["对话", "Chat"];
    var HIDDEN_TAB_ATTR = "data-dsh-ui-tweaks-hidden-tab";
    var COLLAPSED_TABLIST_ATTR = "data-dsh-ui-tweaks-collapsed";

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
     * 同步 tablist 折叠标记——所有 tab 都被打上 HIDDEN_TAB_ATTR 时给 tablist 也打
     * COLLAPSED_TABLIST_ATTR=""; 否则清除该标记。CSS 据此 display:none 隐藏空 tablist
     * 并把父 <header> 的 min-height 缩到 auto（DSH header 默认 76px 是按
     * titleRow + tablist 算的，tablist 没了该缩成只剩 titleRow）。
     *
     * tick() 每跑一次都同步一次：DSH React 重渲可能重建 tablist 节点（mutation observer
     * 也会触发另一个 hider 的 tick），不带 incremental 状态、单次扫全部 tablists 即可。
     */
    function syncTablistCollapseMark() {
      if (typeof document === "undefined") return;
      var tablists = document.querySelectorAll('[role="tablist"]');
      for (var i = 0; i < tablists.length; i++) {
        var tablist = tablists[i];
        var tabs = tablist.querySelectorAll('[role="tab"]');
        var allMarked = tabs.length > 0;
        for (var j = 0; j < tabs.length; j++) {
          if (!tabs[j].hasAttribute(HIDDEN_TAB_ATTR)) {
            allMarked = false;
            break;
          }
        }
        if (allMarked) {
          tablist.setAttribute(COLLAPSED_TABLIST_ATTR, "");
        } else {
          tablist.removeAttribute(COLLAPSED_TABLIST_ATTR);
        }
      }
    }

    /**
     * 通用 tab hider。三件事：
     *   1) 给 target 按钮打 data-dsh-ui-tweaks-hidden-tab=<hiddenValue> 标记，CSS 命中隐藏
     *   2) 若 safe 自身没被另一 hider 隐藏，确保它始终 aria-selected="true"（即使按钮
     *      被 CSS display:none，程序 click 仍能触发 React 的 setView）。两 tab 都隐藏时
     *      跳过——双方 safe 都已被对方标 hidden-tab，强制会互相 ping-pong。
     *   3) 同步 tablist 折叠标记：所有 tab 都标 hidden 时给 tablist 打 data-dsh-ui-tweaks-
     *      collapsed，CSS 据此折叠空 tablist 行 + 缩父 header 的 min-height。
     */
    function createTabHider(opts) {
      var observer = null;
      var isRunning = false;

      function tick() {
        if (typeof document === "undefined") return;

        // 1) 标记目标 tab 隐藏
        var target = findTabButtonByLabels(opts.targetLabels);
        if (target && target.getAttribute(HIDDEN_TAB_ATTR) !== opts.hiddenValue) {
          target.setAttribute(HIDDEN_TAB_ATTR, opts.hiddenValue);
        }

        // 2) safe 自身没被另一 hider 隐藏时，确保它始终是当前选中
        //    （两 tab 都隐藏场景跳过，避免 trajectoryHider 强制对话 / chatHider
        //    强制轨迹 互相 ping-pong）
        var safe = findTabButtonByLabels(opts.safeLabels);
        if (safe && !safe.hasAttribute(HIDDEN_TAB_ATTR) &&
            safe.getAttribute("aria-selected") !== "true") {
          if (typeof safe.click === "function") safe.click();
        }

        // 3) 同步 tablist 折叠标记
        syncTablistCollapseMark();
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
            '[' + HIDDEN_TAB_ATTR + '="' + opts.hiddenValue + '"]'
          );
          for (var i = 0; i < marked.length; i++) {
            marked[i].removeAttribute(HIDDEN_TAB_ATTR);
          }
          // 同步 tablist 折叠标记（用户关掉当前 hider 后剩下另一个 hider 可能还在跑
          // 也会触发 tick，但 stop 触发时这是更直接的兜底——避免两边都停时残留折叠标记）
          syncTablistCollapseMark();
        }
      }

      return {
        start: start,
        stop: stop,
        get running() { return isRunning; }
      };
    }

    // ===== hover-card-hider =====
    // 侧栏 HoverCard 隐藏 controller（hide-sidebar-tooltip 副作用）。
    // DSH HoverCard 组件在侧栏会话项 / 工作窗口 hover 500ms 后通过
    // createPortal(card, document.body) 渲染 div 到 body 直接子级——
    // 巡检 body children 找到含 hover 相关 hash 类的 div，打 attribute 标记，
    // CSS `[data-dsh-ui-tweaks-hidden-hover-card]{display:none!important}` 命中隐藏。
    //
    // 为什么 JS 探测 + attribute selector 而非直接 CSS class selector：
    // CSS class hash 随 DSH 升级会变（v0.6.0 → v0.6.1 我们的 TooltipContent
    // selector 因依赖字串出过事）；attribute 名由我们控制永远不变，DSH 升级
    // 只改一个 hash 数组即可。

    // HoverCard 内部内容用到的 CSS Module hash 类名（DSH workspace 包）——DSH 升级
    // 后 hash 变了改这里一处即可。任一命中即视为 HoverCard。
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

    // ===== disclosure-end-collapse =====
    // 折叠块末尾收起按钮——给所有 DisclosureRow 展开后的 body 末尾追加"收起"按钮，
    // 解决"展开后想收起需要一直往前翻到头部"的痛点。
    //
    // 覆盖三类 DisclosureRow（选择器在 20-constants.js 的 DISCLOSURE_BODY_SELECTORS）：
    //   1. ReasoningRow (data-variant="think"): Think 推理块
    //   2. GenericCommandCard (data-variant="others"): 工具调用多行输出
    //   3. ContextInjectionRow (class 含 _root 且 data-open): 上下文注入
    //
    // 实现：MutationObserver 巡检 body 元素（仅 expanded 时 body 才在 DOM 里），给每个
    // body 末尾注入 wrapper div + "收起 ▴" 按钮。点击时找 body 父元素里 className 含
    // _row 的兄弟，调 .click() 触发 DSH React onToggle → setExpanded(false) →
    // row 折叠，body 与按钮一起被卸载（按钮无需手动 remove）。
    //
    // 设计决策（v0.9.6）：按钮放在 body 内（append）而非 body 外（兄弟）——按钮随 body
    // 一起出现/消失，无需复杂生命周期管理；inline 位置由 body padding-left/margin-left
    // 决定（Think 22px / Command 16px / Context 22px），无需每个变体单独处理 indent。
    // wrapper 强制 display:block 让按钮独占一行（不被 pre-wrap 文本内联吃掉）。
    // stopPropagation 是保险（row 实际是 body 兄弟不在祖先链上，但 click 也会途经
    // DisclosureRow wrapper）。

    /**
     * 给定已展开的 body 元素，找它在 DisclosureRow 里的"点击行"——也就是
     *   触发 setExpanded 反转的 row 元素。
     *
     * 布局：DisclosureRow 把 row（点击行）和 children（body）作为直接兄弟
     *   放进同一个 wrapper 节点。body.parentElement 就是 wrapper。
     *
     * 找 row 策略：
     *   1. 优先：在 wrapper.children 里找 className 含 `_row` 子串的——
     *      DSH CSS module hash 约定（`QWLzlG_row` / `_Xvjua_row` 等），
     *      ContextInjectionRow 不传 rowClassName 时用默认行类，子串匹配仍命中
     *   2. 兜底：wrapper.firstElementChild 不是 body 时就是 row——
     *      DisclosureRow 标准布局 row 在前 body 在后
     */
    function findRowForBody(bodyEl) {
      var wrapper = bodyEl.parentElement;
      if (!wrapper) return null;
      var children = wrapper.children;
      for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (c === bodyEl) continue;
        if (c.className && typeof c.className === "string" &&
            c.className.indexOf("_row") >= 0) {
          return c;
        }
      }
      if (wrapper.firstElementChild && wrapper.firstElementChild !== bodyEl) {
        return wrapper.firstElementChild;
      }
      return null;
    }

    /**
     * 给 body 末尾注入"收起"按钮。幂等——已注入则跳过。
     *   注入结构：<body>...text...<wrap><button>收起 ▴</button></wrap></body>
     *   wrap 强制 display:block 让按钮独占一行（不被 pre-wrap 文本内联吃掉）
     */
    function injectCollapseButton(bodyEl) {
      if (typeof document === "undefined") return;
      if (bodyEl.querySelector("[" + DISCLOSURE_END_COLLAPSE_WRAP_ATTR + "]")) return;

      var wrap = document.createElement("div");
      wrap.setAttribute(DISCLOSURE_END_COLLAPSE_WRAP_ATTR, "");

      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute(DISCLOSURE_END_COLLAPSE_ATTR, "");
      btn.textContent = "收起 ▴";
      btn.title = "收起";
      btn.setAttribute("aria-label", "收起");

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        // row.click() 触发 DSH React 的 onToggle → setExpanded(false) →
        //   body 与本按钮一起被卸载。无需手动 remove。
        var row = findRowForBody(bodyEl);
        if (row && typeof row.click === "function") {
          row.click();
        }
      });

      wrap.appendChild(btn);
      bodyEl.appendChild(wrap);
    }

    /** 巡检所有展开的 DisclosureRow body，注入按钮。 */
    function scanBodies() {
      if (typeof document === "undefined") return;
      var bodies = document.querySelectorAll(DISCLOSURE_BODY_SELECTORS);
      for (var i = 0; i < bodies.length; i++) {
        injectCollapseButton(bodies[i]);
      }
    }

    /** stop 时清理所有已注入的按钮（防御性——正常情况下 button 随 body 卸载）。 */
    function removeAllInjectedButtons() {
      if (typeof document === "undefined") return;
      var wraps = document.querySelectorAll("[" + DISCLOSURE_END_COLLAPSE_WRAP_ATTR + "]");
      for (var i = 0; i < wraps.length; i++) {
        var w = wraps[i];
        if (w.parentNode) w.parentNode.removeChild(w);
      }
    }

    /**
     * v0.9.6：DisclosureRow 末尾收起按钮 controller。start 时挂 MutationObserver
     *   观察 body subtree（DSH React 在 expand/collapse 时挂载/卸载 body）；
     *   80ms throttle 同 v0.7.0 tab-hider / v0.6.2 hover-card-hider 节奏，
     *   避免 DSH 高频重渲时反复探测。
     *   立即跑一次 scanBodies()，确保首次启动时已展开的 block 立刻有按钮
     *   （无需等下一次 mutation）。
     */
    function createDisclosureEndCollapseController() {
      var observer = null;
      var isRunning = false;

      function start() {
        if (isRunning) return;
        if (typeof document === "undefined" || !document.body) return;
        isRunning = true;
        if (typeof MutationObserver === "undefined") {
          scanBodies();
          return;
        }
        observer = new MutationObserver(function () {
          if (observer._pending) return;
          observer._pending = true;
          (typeof window !== "undefined" && window.setTimeout)
            ? window.setTimeout(function () {
                observer._pending = false;
                scanBodies();
              }, 80)
            : scanBodies();
        });
        try {
          observer.observe(document.body, { childList: true, subtree: true });
        } catch (e) { /* 静默 */ }
        scanBodies();
      }

      function stop() {
        isRunning = false;
        if (observer !== null) { observer.disconnect(); observer = null; }
        removeAllInjectedButtons();
      }

      return {
        start: start,
        stop: stop,
        get running() { return isRunning; }
      };
    }

    // ===== first-message-jump =====
    // 「上一条我发的消息」按钮 + 对称拦截 DSH 原生「回到底部」按钮：
    //   我的按钮 单击 = 上一条 user 行（锚点 topVisible）；
    //   我的按钮 Shift+单击 = 一键到当前会话第一条（跳过 compaction）；
    //   原生按钮 单击 = 下一条 user 行（capture-phase document click listener 拦截后调 jumpToNext）；
    //   原生按钮 Shift+单击 = 一键到底（放行 DSH 原生 handler）。
    //
    // 锚点策略（v0.9.1 起）：用 topVisible（视口内最顶部可见 user 行）作锚点；
    // v0.9.0 的 lastVisible 在短消息 + 滚到 rows[1] 时会"上数第二条卡死"
    // （rows[2..N] 仍可见 → lastVisible 始终是 rows[N] → target = rows[N-1] 死循环）。
    //
    // DOM 锚点（DSH 稳定 attribute，不随 CSS module hash 变化）：
    //   滚动容器 [data-conversation-scroll]（ConversationRoot.scrollBody）
    //   user 行 [data-chat-flow-kind="user"]
    //   输入框 seat [data-composer-seat]
    //   原生「回到底部」按钮 aria-label "回到底部" / "Back to bottom"
    //
    // 纯 finder/scanner 函数（不依赖闭包状态）抽到 68a-first-message-jump-utils.js——
    // 30 KB 阈值维护动作；client-src/ 按文件名升序整段拼接进 bundle，函数共享工厂 scope 无需 require。

    function createFirstMessageJumpController() {

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
        // 从未见过原生按钮：估算其顶边——原生槽位 CSS 是
        //   position:sticky; bottom:calc(var(--dsh-composer-height) + 16px)，按钮 34px
        // → 按钮顶边 = 滚动容器底 - composerHeight - (16 + 34)。
        // 16 = 原生槽位底部到 seat 顶的额外间距；34 = DSH 自带「回到底部」按钮高。
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
        button.setAttribute("title", JUMP_BUTTON_TITLE);
        button.innerHTML = JUMP_SVG_UP;
        button.addEventListener("click", jumpOnButtonClick);
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
    }

    // ===== first-message-jump utils =====
    // 纯 finder / scanner 函数（不依赖 closure 状态，全部以 port 作参数）。
    // 从 68-first-message-jump.js 拆出（30 KB 阈值维护动作）。
    // 所有函数共享一个工厂函数体（client-src/*.js 按文件名升序整段拼接进
    // lib/client.js），jump* 函数名在主文件里可直接调用；共享常量由
    // 20-constants.js 单点定义。
    //
    // 函数清单（v0.9.0 → v0.9.2 累积）：
    //   - jumpFindScrollport         滚动容器查询
    //   - jumpAllUserRows            当前会话所有 user 行（DOM 顺序，转静态数组避免 NodeList live 错位）
    //   - jumpFindFirstUserRow / jumpFindLastUserRow  firstRow / lastRow
    //   - jumpIsRowInCompaction      判断 row 是否嵌在 compaction / context 容器里
    //   - jumpFindFirstRealUserRow   跳过 compact 块的"当前会话第一条 user 行"——Shift+点击的终点
    //   - jumpFindLastVisibleUserRow 视口内最底部可见 user 行（v0.9.0 锚点，保留作诊断对照）
    //   - jumpFindTopVisibleUserRow  v0.9.1 起当前锚点：视口内最顶部可见 user 行
    //   - jumpFindPrevUserRow / jumpFindNextUserRow  我的按钮 / 原生按钮单击 target
    //   - jumpIsDrawerOpen / jumpDrawerWidth  右侧抽屉 attr + 宽度探测

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
     *     - 若 topVisible 存在：target = topVisible 的 DOM 顺序上一条**且实际可见**
     *     - 若 topVisible 不存在（视口在所有 user 之上）：target = lastRow（首次入口）
     *   - 前面都是 hidden row：target = null（已在第一个可见 row，无路可上）
     *
     * v0.9.1 改用 topVisible 的关键修复：v0.9.0 用 lastVisible 时，
     * rows[1] 已在视口顶部但 rows[2..N] 仍可见 → lastVisible 始终是
     * rows[N] → target 始终是 rows[N-1] → 死循环（按钮永不隐藏、
     * 永远到不了 rows[0]）。改用 topVisible 后：
     *   topVisible = rows[1] → target = rows[0]
     *   点击 → 滚到 rows[0] → topVisible = rows[0] → target = null → 按钮隐藏 ✓
     *
     * v0.9.4：上一条跳过 hidden row（`getBoundingClientRect().height <= 0`）。
     * 修复：simple-mode（默认 ON）会把 compaction / context 块 `display:none`
     * 隐藏，但它们的 user 行（rows[0..K-1]）仍然在 DOM 里——`jumpAllUserRows`
     * 会返回它们，`jumpFindTopVisibleUserRow` 也正确跳过了；但原来的
     * `jumpFindPrevUserRow` 直接返回 `rows[i-1]`，当 `topVisible` 是"第一个
     * 可见 user 行"（rows[K]）时，`rows[K-1]` 是 hidden 的旧 compaction user
     * 行——target 滚到了一个用户看不见的位置 → 按钮看起来"卡死"在该行，
     * 即使再点也无变化。修正：从 topVisible 向前找第一个 height>0 的 row，
     * 没有就返回 null（与"上一条 step 到边界后按钮看似还在但 Shift+点击仍
     * 能直达第一行"的语义一致）。
     */
    function jumpFindPrevUserRow(port) {
      var rows = jumpAllUserRows(port);
      if (rows.length === 0) return null;
      var lastRow = rows[rows.length - 1];
      var topVisible = jumpFindTopVisibleUserRow(port);
      if (!topVisible) {
        // 视口内无 user 行：跳到最后一条作为入口（用户在对话上方空白区）
        return lastRow;
      }
      // 找 topVisible 在 rows 中的索引，向前找第一个实际可见（height>0）的 row
      for (var i = 0; i < rows.length; i++) {
        if (rows[i] === topVisible) {
          for (var j = i - 1; j >= 0; j--) {
            var prevRect = rows[j].getBoundingClientRect();
            if (prevRect && prevRect.height > 0) return rows[j];
          }
          // 前面都是 hidden row（simple-mode 隐藏的 compaction 行等）——
          // 已到"第一个可见 user 行"，无路可上
          return null;
        }
      }
      // 兜底：理论上不可达（topVisible 是 querySelectorAll 结果之一）
      return null;
    }

    /**
     * v0.9.1：找"下一条"——原生「回到底部」按钮单击拦截时的 target 行。
     * 锚点同样用 topVisible（与 prev 对称）：
     *   - 视口内最顶部可见 user 行 = topVisible
     *     - 若 topVisible 存在：target = topVisible 的 DOM 顺序下一条**且实际可见**
     *     - 若 topVisible 不存在（视口在所有 user 之上/之下）：
     *       target = firstRow（"从对话起点开始往下一条"——自然入口）
     *   - 后面都是 hidden row：target = null（已在最后一个可见 row，无路可下）
     *
     * 与 prev 对称：prev 用 lastRow 作为"无可见"时的入口（页面刚打开
     * 时跳到最新一条作为起点）；next 用 firstRow（"从对话起点开始往
     * 下走"——起点即入口）。语义对称。
     *
     * v0.9.4：与 prev 对称——下一条也跳过 hidden row（height<=0），
     * 避免 simple-mode 隐藏的 compaction 行（罕见但可能的"中间夹一个
     * 隐藏块"结构）被当成 target 滚过去用户却看不到。
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
      // 找 topVisible 在 rows 中的索引，向后找第一个实际可见（height>0）的 row
      for (var i = 0; i < rows.length; i++) {
        if (rows[i] === topVisible) {
          for (var j = i + 1; j < rows.length; j++) {
            var nextRect = rows[j].getBoundingClientRect();
            if (nextRect && nextRect.height > 0) return rows[j];
          }
          // 后面都是 hidden row（simple-mode 隐藏的 compaction 行等）——
          // 已到"最后一个可见 user 行"，无路可下
          return null;
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
    }

    // ===== stats-line-position =====
    // v0.10.0 统计行位置 tweak——对话底部那行运行统计（轮次 / 步数 / LLM 耗时 / 工具耗时 /
    // 首 token / 吞吐 / 缓存命中 / 输入输出 token）的位置三选一：
    //   bottom（默认）：DSH 原样，本控制器不启动
    //   top：底部整条隐藏，顶部标题行右侧渲染镜像元素（周期性从原生行克隆）
    //   hidden：底部整条隐藏，不渲染镜像
    //
    // v0.10.1 关键：隐藏用 `visibility:hidden` 而非 `display:none`——统计行是 composer
    // 卡片的 footer，composer seat 是 sticky bottom；display:none 卡片变矮 → 输入行整体
    // 下移。visibility 保留盒子（照常参与布局、照常被 React 更新文本），高度分毫不差保留。
    //
    // 关键约束：镜像不搬 DSH 原生节点。原生节点留在原位（不可见——React 照常更新文本），
    // 镜像是本插件 createElement 的额外子节点，React 不认识——避免 React 卸载原生节点时
    // 对记录的原父节点调 removeChild → NotFoundError 崩树。StatsLine 在 groups 为空时
    // return null，新会话开局必然触发这条路径。
    //
    // 锚点全部走 DSH renderer 的 slot 出口属性 `[data-slot="<slot key>"]`（不含 hash，
    // 跨版本稳定；与 v0.7.3 HoverCard `[class*="_hoverContent"]` 同源的 hash-independence
    // 策略）。`display:contents` 是 inline style，所有针对出口层的规则一律带 !important。
    //
    // 隐藏粒度（0.2.x 修正）：老版本 DSH 的 dock 行里只有 slot 出口一个子节点，隐藏出口 ==
    // 隐藏统计行。0.2.x 起 DSH 把 ContextMeter（上下文占用计量器）作为**后继兄弟**放进同一
    // dock 行（`[slotOutlet, ContextMeter]` 两个 flex 子项），只隐藏出口会把它留下——CSS 侧
    // 因此追加一条以出口为锚的通用兄弟选择器 `[data-slot="<slot key>"] ~ *`，把出口之后的同级节点
    // 一并隐藏；老版本上该兄弟节点不存在，规则零命中。代价：若将来第三方插件也往
    // composer.dock 注册条目，top/hidden 时会连带隐藏（已在 tweak description 与 README 注明）。
    // 边界：出口只在 composer 变体渲染（`variant === "composer"` 且 input / sessionId 齐备），
    // 没有出口就没有锚点，兄弟规则在该变体下不生效——那里本来也没有统计行可隐藏。
    //
    // 镜像源范围（v0.10.13 显式收窄）：`statsFindSource()` 只在 slot 出口**子树内**找
    // StatsPills 根节点，候选还要过 `outlet.contains()` 校验——0.2.x 的 ContextMeter 与出口
    // 同级、不在子树内，不可能被选成镜像源；校验同时挡住将来的结构漂移。
    //
    // v0.10.11 顶部镜像两点修复：
    //   (1) 两个 pill 之间补 12px gap——镜像 CSS 加 `display:inline-flex; gap:12px`，恢复
    //       原生 `.bOPqQW_root` 的视觉间距（cloneNode 只搬 source 子节点，root 的
    //       `gap:12px` 留在了底部隐藏节点上，需镜像自己再声明一次）。
    //   (2) 详情对话框跟顶部镜像按钮走——DSH `useAnchoredPosition` 把 dialog 锚定到底部
    //       隐藏 button 的 `.anchor` span，从顶部点开却弹在底部。重写 React 组件超出
    //       触及范围，后置拦截：点击镜像 button 时记下它的 rect 闭包 → body
    //       MutationObserver 检测 `[role="dialog"]` 出现 → `setProperty('left/top',
    //       ..., 'important')` 强制改到镜像 button 下方（PANEL_GAP=8、viewport
    //       margin=12 与 DSH useAnchoredPosition 对齐）。dialog 属性 observer（应对 React
    //       重渲染覆盖）+ window scroll 监听（dialog 跟随滚动到镜像 button），用
    //       `dialog.isConnected` 自动 disconnect。inline `!important` 优先级胜过 React
    //       普通 `style.left = X`，scroll 跟随靠 `getRect()` 闭包重取最新位置。

    /** 把任意持久化值归一到三个合法位置之一（脏数据 / 老版本布尔值都退回 bottom）。 */
    function statsNormalizePosition(value) {
      if (value === STATS_POS_TOP) return STATS_POS_TOP;
      if (value === STATS_POS_HIDDEN) return STATS_POS_HIDDEN;
      return STATS_POS_BOTTOM;
    }

    /**
     * 找 DSH 原生统计行的根元素（StatsPills 的 `<div class="..._root">`）。
     *
     * 策略：先用稳定锚点 `[data-slot="conversation.composer.dock"]` 定位 slot 出口
     *   （出口是 dock 行的子节点、自身是 `display:contents` 包装），再**只在该出口
     *   子树内**取最内层的 `[class*="_root"]`——DSH 用 Tooltip 包裹 StatsPills，
     *   若 Tooltip 将来也带 `_root` 类名，最内层那个才是统计行自身。0.2.x 起同一
     *   dock 行里出口之后还有同级 ContextMeter（根节点同样落在 `_root` 子串上），
     *   查询范围一旦放宽到整行就会克隆错节点，所以候选一律过 `outlet.contains()`
     *   校验，不在出口子树内的直接丢弃、继续往前找。全都没命中时退回出口的第一个
     *   元素子节点。
     */
    function statsFindSource() {
      if (typeof document === "undefined") return null;
      var outlet = document.querySelector(STATS_DOCK_SEL);
      if (!outlet) return null;
      var list = outlet.querySelectorAll(STATS_ROOT_HINT_SEL);
      for (var i = list.length - 1; i >= 0; i--) {
        // 只接受出口子树内的候选：DSH 换结构 / 查询范围漂移时宁可退回兜底也不克隆错节点
        if (outlet.contains(list[i]) && list[i].querySelector(STATS_ROOT_HINT_SEL) === null) {
          return list[i];
        }
      }
      // 出口的 `display:contents` 不生成盒子，StatsPills 根节点就是它的元素子节点
      var first = outlet.firstElementChild;
      if (first !== null && outlet.contains(first)) return first;
      return null;
    }

    /**
     * 找顶部标题簇容器——也就是"对话名 + 模式"横向排布的那个 flex 容器
     *   （DSH ConversationRoot 的 titleCluster：children = [面包屑 nav,
     *   headerActions]）。镜像 append 到它末尾即落在模式标签右边。
     *
     * 主路径：`[data-slot="conversation.session.header.actions"]` 出口
     *   → 父（headerActions 包装 div）→ 父（titleCluster）。全程无 hash。
     * 兜底：`[class*="_titleCluster"]` 子串匹配（与 v0.7.3 HoverCard /
     *   v0.9.14 sidebar 同策略的 hash-independence 写法）。
     */
    function statsFindTitleCluster() {
      if (typeof document === "undefined") return null;
      var actions = document.querySelector(STATS_HEADER_ACTIONS_SEL);
      if (actions && actions.parentElement && actions.parentElement.parentElement) {
        return actions.parentElement.parentElement;
      }
      return document.querySelector(STATS_TITLE_CLUSTER_HINT_SEL);
    }

    /** 清掉页面上所有本插件的统计行镜像（切位置 / 停用 / header 被重建时）。 */
    function statsRemoveMirror() {
      if (typeof document === "undefined") return;
      var nodes = document.querySelectorAll("[" + STATS_MIRROR_ATTR + "]");
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
      }
    }

    /**
     * 确保标题簇末尾有一个镜像元素。幂等——已有则直接返回。
     *   当前标题簇里没有时，先把别处残留的孤儿镜像清掉（DSH 换会话重建
     *   header 的场景），再新建，保证全页面只存在一个镜像。
     */
    function statsEnsureMirror() {
      if (typeof document === "undefined") return null;
      var cluster = statsFindTitleCluster();
      if (!cluster) return null;
      var existing = cluster.querySelector("[" + STATS_MIRROR_ATTR + "]");
      if (existing) return existing;
      statsRemoveMirror();
      var mirror = document.createElement("div");
      mirror.setAttribute(STATS_MIRROR_ATTR, "");
      cluster.appendChild(mirror);
      return mirror;
    }

    /**
     * 把原生统计行的内容克隆进镜像。
     *   - 用 `cloneNode(true)` 后逐个搬运子节点，而不是直接塞克隆根——
     *     克隆根带着 DSH 的 `_root` 类（`text-align:center` / `width:100%` /
     *     `max-width:var(--dsh-chat-content-width)` / 底部专用 padding），
     *     放进标题行会撑破布局；只搬子节点则保留分隔符 `<span class="..._sep">`
     *     的类名，DSH 自己的 `.._sep{color:...;margin:0 10px}` 继续生效，
     *     视觉与底部原生行一致。
     *   - 文本没变就整段跳过，避免每 400ms 无谓重建 DOM（也顺带避免
     *     镜像自身的 mutation 触发别的观察者）。用 `title` 同时兼作
     *     "上次内容"缓存与鼠标悬停时的完整内容 tooltip（标题行窄，
     *     镜像会 ellipsis 截断）。
     *   - v0.10.10：DSH StatsPills 把两个 pill（TimePill + UsagePill）渲染成
     *     `<button aria-haspopup="dialog">`，点击调 React useState 切换 openPill，
     *     把详情对话框 portal 到 body（`useAnchoredPosition` 锚定到原 button 的
     *     `.anchor` span）。`cloneNode(true)` 不复制 React listener——克隆 button
     *     是哑的：图标 + 文本能显示，但点不出详情对话框，"相关信息"出不来。
     *     修法：遍历克隆出来的所有 button，按索引挂 click 转发器——点击镜像 button
     *     → 在 dock 里**实时查**对应索引的原生 button 调 `.click()`，触发 React
     *     onClick → openPill 切换 → dialog render。索引在闭包里，实时查询避免
     *     DSH 重渲染后闭包引用的 button 节点已卸。cloneNode 不复制 listener 也不
     *     复制 React fiber，所以镜像 button 不在 React 树里——`stopPropagation` 是
     *     防自己挂的 listener 之间互相冒泡，不是防 React；`preventDefault` 防镜像
     *     button 在某些 form / document 默认行为下意外触发。
     *   - v0.10.11：详情 dialog 之前锚定到底部隐藏 button（DSH useAnchoredPosition +
     *     React state 都在底部 StatsPills 组件上），从顶部镜像点开却弹在底部。重写
     *     React 组件超出触及范围，后置拦截：click 转发器在转发前记下镜像 button 的
     *     rect 闭包（statsPendingMirrorAnchor），body MutationObserver 检测
     *     `[role="dialog"]` 添加后用 `!important` 把 left/top 改到镜像 button 下方
     *     （PANEL_GAP=8、viewport margin=12 与 DSH useAnchoredPosition 对齐）。dialog
     *     属性 observer + window scroll 监听持续重定位，dialog 跟随滚动到镜像 button。
     *     详见下面 `// ===== v0.10.11 顶部镜像对话框位置拦截 =====` 段。
     */
    function statsSyncMirror(mirror, source) {
      var text = source === null ? "" : (source.textContent || "");
      var liveButtons = source === null ? [] : source.querySelectorAll("button");
      // 文本没变 + button 数量没变 → 跳过重建（克隆 button 上的转发 listener 也保留）
      if (mirror.title === text && mirror.childElementCount === liveButtons.length) return;
      mirror.title = text;
      while (mirror.firstChild) mirror.removeChild(mirror.firstChild);
      if (text === "" || source === null) return;
      var clone = source.cloneNode(true);
      var clonedButtons = clone.querySelectorAll("button");
      // 给每个克隆 button 挂 click 转发器：index 闭包，click 时实时查 dock
      for (var j = 0; j < clonedButtons.length; j++) (function (idx) {
        clonedButtons[idx].addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          // v0.10.11：记下镜像 button 的 rect 闭包——dialog 通过 portal 渲染在 body 后
          // 由 body MutationObserver 触发 statsApplyDialogPosition，把它从底部隐藏
          // button 位置改到本镜像 button 下方。闭包持 btn 引用，watcher 每次重取
          // getBoundingClientRect()，dialog 跟随滚动到镜像 button 当前位置。
          var btn = e.currentTarget;
          statsPendingMirrorAnchor = {
            getRect: function () { return btn.getBoundingClientRect(); }
          };
          statsEnsureDialogObserver();
          var outlet = document.querySelector(STATS_DOCK_SEL);
          if (!outlet) return;
          // 索引映射只在出口子树内取 button——0.2.x 的 ContextMeter 也渲染 button，
          // 但它是出口的兄弟节点、不在子树内，不会挤进索引。
          var live = outlet.querySelectorAll("button");
          if (idx < live.length) live[idx].click();
        });
      })(j);
      while (clone.firstChild) mirror.appendChild(clone.firstChild);
    }

    // ===== v0.10.11 顶部镜像对话框位置拦截 =====

    // 点击镜像 button 时设上，body observer 检测到 dialog 后清空。null = 没有等待中的镜像点击。
    var statsPendingMirrorAnchor = null;
    // body 级 MutationObserver（单例，懒初始化）。检测 [role="dialog"] 添加 → 触发定位。
    var statsDialogObserver = null;
    // 当前活跃 dialog 的属性 observer（应对 React 重渲染覆盖 left/top）。
    // dialog 用 WeakMap 关联 scroll listener 闭包；dialog 被移除时由 isConnected 检查自动清理。
    var statsDialogWatchers = null;
    // 与 DSH useAnchoredPosition 对齐的常量——PANEL_GAP = 触发器到 panel 的距离，
    // PANEL_MARGIN = 视口边缘最小留白。同步这些常量才能让"对话框紧贴镜像 button 下方"与
    // 底部原生行为视觉一致。
    var STATS_PANEL_GAP = 8;
    var STATS_PANEL_MARGIN = 12;

    /**
     * 把 dialog 定位到 anchorRect 下方（顶部镜像专用）。
     *   - left = anchorRect.left（与镜像 button 左对齐）
     *   - top = anchorRect.bottom + PANEL_GAP
     *   - 视口 clamp：左右留 PANEL_MARGIN；超 viewport 时把 dialog 往反方向推
     * 用 setProperty('left/top', ..., 'important')：inline !important 优先级胜过 React 的
     * 普通 style.left = X（useAnchoredPosition 重渲染会持续覆盖，靠 !important 兜住）。
     */
    function statsApplyDialogPosition(dialog, anchorRect) {
      if (dialog === null || anchorRect === null || anchorRect === undefined) return;
      if (typeof dialog.getBoundingClientRect !== "function") return;
      var dlgRect = dialog.getBoundingClientRect();
      var dlgW = dlgRect.width > 0 ? dlgRect.width : 300;
      var dlgH = dlgRect.height > 0 ? dlgRect.height : 200;
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var left = anchorRect.left;
      var top = anchorRect.bottom + STATS_PANEL_GAP;
      // 水平 clamp
      if (left + dlgW > vw - STATS_PANEL_MARGIN) {
        left = vw - STATS_PANEL_MARGIN - dlgW;
      }
      if (left < STATS_PANEL_MARGIN) left = STATS_PANEL_MARGIN;
      // 垂直 clamp（dialog 比可用高度还高时把 top 推到 PANEL_MARGIN）
      if (top + dlgH > vh - STATS_PANEL_MARGIN) {
        top = vh - STATS_PANEL_MARGIN - dlgH;
      }
      if (top < STATS_PANEL_MARGIN) top = STATS_PANEL_MARGIN;
      dialog.style.setProperty('left', left + 'px', 'important');
      dialog.style.setProperty('top', top + 'px', 'important');
    }

    /**
     * 给 dialog 挂属性 observer + window scroll 监听，保持位置跟 anchor。
     *   - 属性 observer（style attribute 变化）：DSH useAnchoredPosition 在 resize / scroll
     *     时通过 React state 重设 panel 的 left/top，我们每次 React 改 style 后立即重写
     *     我们的 !important 版本。
     *   - window scroll 监听：getRect() 重取镜像 button 最新 viewport rect，dialog
     *     跟着滚动（position:fixed 是 viewport-relative，button 在页面里移动后 dialog 要
     *     跟着偏移才能保持"按钮下方"）。
     *   - dialog 离开 DOM（用户点外部 / Esc 关闭）时 dialog.isConnected 变 false，自动
     *     disconnect + removeEventListener，避免泄漏。
     */
    function statsWatchDialogPosition(dialog, getRect) {
      if (typeof MutationObserver === "undefined") return;
      if (statsDialogWatchers === null) statsDialogWatchers = new WeakMap();
      // 同一个 dialog 重复挂时先清旧的（极少见，但防御性写）
      var prev = statsDialogWatchers.get(dialog);
      if (prev !== undefined) {
        if (prev.attrObs !== null) prev.attrObs.disconnect();
        if (typeof window !== "undefined" && window.removeEventListener) {
          window.removeEventListener("scroll", prev.onScroll, true);
        }
      }
      var attrObs = new MutationObserver(function () {
        if (!dialog.isConnected) {
          attrObs.disconnect();
          return;
        }
        var rect = getRect();
        if (rect !== null && rect !== undefined) statsApplyDialogPosition(dialog, rect);
      });
      attrObs.observe(dialog, { attributes: true, attributeFilter: ["style"] });
      var onScroll = function () {
        if (!dialog.isConnected) {
          attrObs.disconnect();
          if (typeof window !== "undefined" && window.removeEventListener) {
            window.removeEventListener("scroll", onScroll, true);
          }
          return;
        }
        var rect = getRect();
        if (rect !== null && rect !== undefined) statsApplyDialogPosition(dialog, rect);
      };
      if (typeof window !== "undefined" && window.addEventListener) {
        window.addEventListener("scroll", onScroll, true);  // capture：监听嵌套滚动容器
      }
      statsDialogWatchers.set(dialog, { attrObs: attrObs, onScroll: onScroll });
    }

    /**
     * body MutationObserver 回调：检测 [role="dialog"] 添加。
     * 仅当 statsPendingMirrorAnchor 设上（即刚刚从顶部镜像点击转发）才接管；
     * DSH 其它对话框（侧栏 hover 等）也用 role="dialog"，没 pending 时一概不管。
     */
    function statsOnBodyMutation(records) {
      if (statsPendingMirrorAnchor === null) return;
      var pending = statsPendingMirrorAnchor;
      for (var i = 0; i < records.length; i++) {
        var rec = records[i];
        if (rec.addedNodes === undefined) continue;
        for (var j = 0; j < rec.addedNodes.length; j++) {
          var node = rec.addedNodes[j];
          if (node === null || node.nodeType !== 1) continue;
          var dialog = null;
          if (node.getAttribute && node.getAttribute("role") === "dialog") {
            dialog = node;
          } else if (node.querySelector) {
            dialog = node.querySelector('[role="dialog"]');
          }
          if (dialog !== null) {
            var rect = pending.getRect();
            if (rect !== null && rect !== undefined) statsApplyDialogPosition(dialog, rect);
            statsWatchDialogPosition(dialog, pending.getRect);
            // 单次消费——避免之后 dialog 被关闭再重开时还误接管
            statsPendingMirrorAnchor = null;
            return;
          }
        }
      }
    }

    /**
     * 懒初始化 body MutationObserver。点击镜像 button 时调一次；
     * 重复调幂等。observer 跨 controller start/stop 保留（全局单例），省去重复注册。
     */
    function statsEnsureDialogObserver() {
      if (typeof document === "undefined") return;
      if (typeof MutationObserver === "undefined") return;
      if (statsDialogObserver !== null) return;
      statsDialogObserver = new MutationObserver(statsOnBodyMutation);
      statsDialogObserver.observe(document.body, { childList: true, subtree: false });
    }

    /**
     * 清空 pending 状态。controller stop() 时调——切到 bottom/hidden 后镜像已移除，
     * 不应再让 observer 接管后续 dialog。
     */
    function statsClearPendingAnchor() {
      statsPendingMirrorAnchor = null;
    }

    /**
     * v0.10.0：统计行位置 controller。
     *
     * 只有 top 位置需要运行（维护镜像）；bottom / hidden 都只靠 buildCSS
     *   的纯 CSS 生效，controller 停机。
     *
     * 轮询而非 MutationObserver：统计行内容按"步"更新（不是按 token 流），
     *   400ms 轮询足够跟手；而统计行文本变化是 characterData mutation，
     *   要用 observer 就得在 document 上开 characterData+subtree——对话
     *   流式输出时每个 token 都会触发，开销远大于一次 textContent 比较。
     *   节奏与 v0.9.x simple-mode 状态行的 setInterval 轮询一致。
     *   轮询同时兼任"自愈"：DSH 换会话重建 header 后下一 tick 自动补镜像。
     *
     * v0.10.11：start 调 statsEnsureDialogObserver() 懒初始化 body MutationObserver
     *   （单例，跨 start/stop 保留，避免重复注册）；stop 调 statsClearPendingAnchor()
     *   清掉残留的 pending——切到 bottom/hidden 后镜像已移除，不应再让 observer 接管后续
     *   dialog。observer 本身不 disconnect，因为它是全局单例、复用价值高；泄漏面也小，
     *   只在 dialog 添加/移除时触发，开销可忽略。
     */
    function createStatsLinePositionController() {
      var intervalId = null;
      var isRunning = false;

      function tick() {
        var mirror = statsEnsureMirror();
        if (mirror === null) return;
        statsSyncMirror(mirror, statsFindSource());
      }

      function start() {
        if (isRunning) return;
        if (typeof window === "undefined" || !window.setInterval) return;
        isRunning = true;
        intervalId = window.setInterval(tick, STATS_POLL_MS);
        tick();
      }

      function stop() {
        if (intervalId !== null && typeof window !== "undefined" && window.clearInterval) {
          window.clearInterval(intervalId);
        }
        intervalId = null;
        isRunning = false;
        statsRemoveMirror();
      }

      /** 按当前位置值启停。返回归一化后的位置，方便调用方记录 / 诊断。 */
      function sync(position) {
        var pos = statsNormalizePosition(position);
        if (pos === STATS_POS_TOP) {
          statsEnsureDialogObserver();
          start();
        } else {
          statsClearPendingAnchor();
          stop();
        }
        return pos;
      }

      return {
        start: start,
        stop: stop,
        sync: sync,
        get running() { return isRunning; }
      };
    }

    // ===== debug-api =====
    // 诊断 API（暴露 window.__dshUiTweaks）

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
          if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
            try {
              window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: next }));
            } catch (e) { /* 静默：与 80-react-section.js useEffect 对齐 */ }
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
    // React 组件

    /**
     * 单条 tweak 的 row：标题 + 控件（开关 或 多选一下拉框）+ 可选数字输入。
     * description 隐藏在 `title` 属性里——鼠标悬停时由浏览器原生 tooltip 显示。
     *
     * v0.5.1 设计：开关 / number input 都**永远不 disabled**——用户必须能拨动 / 调像素
     *   再开开关（旧 v0.4.0 `disabled={!enabled}` 把数字框锁死反人类）。number input
     *   用受控 value={value} + onChange 每键更新 parent state——消除 draft / useEffect
     *   链路的 race condition。
     * v0.7.5：description 从始终渲染的 `<p>` 收进 HTML `title` 属性——6 条 tweak 在
     *   设置页铺满 200+ 像素过高，实际只有"刚开插件 / 想不起来某条做什么"时才看，
     *   悬停浏览器原生 tooltip 更精炼；CSS 加 `cursor:help` 提示。
     * v0.10.0：支持"多选一"tweak。tweak 带 `choices`（`[{value,label}]`）时头部右侧
     *   渲染 `<select>` 而不是开关——`configKeys.enabled` 存选项字符串（首例
     *   stats-line-position 的 bottom/top/hidden）。数字输入行的判定不变
     *   （仍看 `k2 !== k1`），开关型 tweak 不受影响。
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
      var choices = t.choices || null;
      var control = null;
      var options = [];
      var i;

      function onToggle(e) {
        var next = {};
        for (var k in state) next[k] = state[k];
        next[k1] = !!e.target.checked;
        setState(next);
      }

      function onChoiceChange(e) {
        var raw = e.target.value;
        var next = {};
        for (var k in state) next[k] = state[k];
        next[k1] = raw;
        setState(next);
      }

      function onNumberChange(e) {
        var raw = e.target.value;
        if (raw === "" || raw === "-") return; // 允许临时清空，不写 state
        var n = Number(raw);
        if (!isFinite(n) || n < 0) return;
        if (n > 800) n = 800; // 与 input max="800" + 25-tweaks.js / 35-styles.js cap 对齐
        if (n === value) return;
        var next = {};
        for (var k in state) next[k] = state[k];
        next[k2] = n;
        setState(next);
      }

      if (choices !== null) {
        for (i = 0; i < choices.length; i++) {
          options.push(jsxRuntime.jsx("option", {
            value: choices[i].value,
            children: choices[i].label
          }, choices[i].value));
        }
        // 受控 <select>：value 取当前 state；state 里是脏值 / 缺省时退回第一个
        // 选项，避免 React 受控组件拿到不存在的 value 而落到空白项
        var current = enabled;
        var matched = false;
        for (i = 0; i < choices.length; i++) {
          if (choices[i].value === current) { matched = true; break; }
        }
        if (!matched) current = choices.length > 0 ? choices[0].value : "";
        control = jsxRuntime.jsx("select", {
          className: "DTPD_select",
          "aria-label": t.name,
          value: current,
          onChange: onChoiceChange,
          children: options
        });
      } else {
        control = jsxRuntime.jsx("input", {
          type: "checkbox",
          className: "DTPD_switch",
          role: "switch",
          "aria-label": t.name,
          checked: !!enabled,
          onChange: onToggle
        });
      }

      var children = [
        jsxRuntime.jsxs("div", {
          className: "DTPD_itemHead",
          children: [
            jsxRuntime.jsx("h3", { className: "DTPD_itemName", children: t.name }),
            control
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
        title: t.description,
        children: children
      });
    }

    // ===== react-section =====
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
    // apply（loader 调一次，DSH 启动时执行）

    function apply(ctx) {
      // 1) self-shim（先于 CSS 注入，让 [data-pane="conversation"] 选择器在第一次 injectCSS 时就命中）
      applyShellShim();
      applyChatflowShiftMarks();
      startShellShimObserver();
      startChatflowMarksObserver();

      // 2) 初始 CSS（即便用户没打开设置页也立即跑；后续 UI 变化由 UiTweaksSection useEffect 触发）
      var initialState = loadState();
      injectCSS(initialState);
      injectSectionCSS();

      // 3) 诊断 API（必须早于 settings UI 注册——UI 里的"诊断"按钮会用到）
      if (typeof window !== "undefined") {
        window[DEBUG_API_KEY] = createDebugAPI();
      }

      // 4) settings.panel 挂载点（order:5）
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
      if (px > 800) px = 800; // safety cap（与 25-tweaks.js / 35-styles.js 对齐）
      applyDebugMode(!!initialState.conversationShiftDebug, px);

      // 6) 各 controller
      var simpleController = createSimpleModeStatusController();
      if (initialState.simpleModeEnabled) simpleController.start();

      // tab hider（通用 createTabHider 工厂；每个 hider 强制另一 tab selected——
      // 轨迹被隐藏时强制对话，对话被隐藏时强制轨迹，对称设计；两 tab 都隐藏时
      // tick() 防御性跳过强制避免互相 ping-pong）
      var trajectoryHider = createTabHider({
        targetLabels: TRAJECTORY_TAB_LABELS,
        hiddenValue: "trajectory",
        safeLabels: CHAT_TAB_LABELS
      });
      if (initialState.hideTrajectoryTab) trajectoryHider.start();
      var chatHider = createTabHider({
        targetLabels: CHAT_TAB_LABELS,
        hiddenValue: "chat",
        safeLabels: TRAJECTORY_TAB_LABELS
      });
      if (initialState.hideChatTab) chatHider.start();

      var hoverCardHider = createSidebarHoverCardHider();
      if (initialState.hideSidebarTooltip) hoverCardHider.start();

      var firstMessageJump = createFirstMessageJumpController();
      if (initialState.firstMessageJump) firstMessageJump.start();
      if (typeof window !== "undefined" && window[DEBUG_API_KEY]) {
        window[DEBUG_API_KEY].firstMessageJump = function () {
          return firstMessageJump.getState();
        };
      }

      var disclosureEndCollapse = createDisclosureEndCollapseController();
      if (initialState.disclosureEndCollapse) disclosureEndCollapse.start();
      if (typeof window !== "undefined" && window[DEBUG_API_KEY]) {
        window[DEBUG_API_KEY].disclosureEndCollapse = function () {
          return { running: disclosureEndCollapse.running };
        };
      }

      // 统计行位置——三态（bottom / top / hidden）由 sync() 内部判定启停；
      // 隐藏与否已由 injectCSS 处理（visibility:hidden 保留 24px 占位）
      var statsLinePosition = createStatsLinePositionController();
      statsLinePosition.sync(initialState.statsLinePosition);
      if (typeof window !== "undefined" && window[DEBUG_API_KEY]) {
        window[DEBUG_API_KEY].statsLinePosition = function () {
          return {
            position: statsNormalizePosition(loadState().statsLinePosition),
            running: statsLinePosition.running,
            sourceFound: statsFindSource() !== null,
            titleClusterFound: statsFindTitleCluster() !== null,
            mirrorMounted: typeof document !== "undefined" &&
              document.querySelector("[" + STATS_MIRROR_ATTR + "]") !== null
          };
        };
      }

      // 7) UI 状态变化 → 启停各 controller
      function onStateChange(e) {
        var detail = (e && e.detail) || null;
        if (!detail || typeof detail !== "object") return;
        var newPx = Number(detail.conversationShiftPx);
        if (!isFinite(newPx) || newPx < 0) newPx = 380;
        if (newPx > 800) newPx = 800; // safety cap（与 25-tweaks.js / 35-styles.js 对齐）
        applyDebugMode(!!detail.conversationShiftDebug, newPx);
        if (detail.simpleModeEnabled) {
          if (!simpleController.running) simpleController.start();
        } else if (simpleController.running) {
          simpleController.stop();
        }
        if (detail.hideTrajectoryTab) {
          if (!trajectoryHider.running) trajectoryHider.start();
        } else if (trajectoryHider.running) {
          trajectoryHider.stop();
        }
        if (detail.hideChatTab) {
          if (!chatHider.running) chatHider.start();
        } else if (chatHider.running) {
          chatHider.stop();
        }
        if (detail.hideSidebarTooltip) {
          if (!hoverCardHider.running) hoverCardHider.start();
        } else if (hoverCardHider.running) {
          hoverCardHider.stop();
        }
        if (detail.firstMessageJump) {
          if (!firstMessageJump.running) firstMessageJump.start();
        } else if (firstMessageJump.running) {
          firstMessageJump.stop();
        }
        if (detail.disclosureEndCollapse) {
          if (!disclosureEndCollapse.running) disclosureEndCollapse.start();
        } else if (disclosureEndCollapse.running) {
          disclosureEndCollapse.stop();
        }
        statsLinePosition.sync(detail.statsLinePosition);
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