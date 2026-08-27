    // ===== constants =====
        // v0.9.9：新增 sidebar-match-conversation-bg tweak——DSH 默认侧栏（data-pane="sidebar"）
        //   有独立背景色，与对话区（data-pane="conversation"）的 --dsw-alias-bg-base
        //   不同。开启后把侧栏列容器的背景设为对话区同款，让两个区域在背景色上融合。
        //   CSS 用 `var(--dsw-alias-bg-base,var(--dsw-alias-bg-layer-1,#ffffff))` 三层
        //   fallback 链（来源证据：dsh-ssh 的 mL8Uca_panel 用 --dsw-alias-bg-base 与
        //   对话区"无缝融入"；dsh-client-ui-skin-center #712 注释明确 AppFrame frame +
        //   conversation root + details root 是 shell surfaces 共用 bg-base，侧栏不在列）。
        //   子元素（会话项 / 按钮 / hover 态）不动——只改列容器背景。默认 OFF。
        //   见 25-tweaks.js 的 sidebar-match-conversation-bg buildCSS。
        // v0.9.8：simple-mode 状态行接管 DSH 原生 turnStatus 视觉呈现——
        //   用户反馈三个问题（"正在处理 还在闪" / "时间想出现在 后面" /
        //   "还是比原生高一点点"）根因不是 v0.9.7 撤掉的自家 pulse，而是
        //   DSH `dsh-client-ui-conversation/lib/client.js:5591` 原生
        //   TurnStatus 组件的 shimmer effect（gradient + background-clip:text
        //   + 1.8s linear infinite dsh-turn-status-shimmer）。我们的 span
        //   appendChild 到这个容器里，被 shimmer 染到。整容器接管：
        //   1) 杀 shimmer：[class*="turnStatus"]{animation:none; background:none;
        //      background-clip:border-box; -webkit-text-fill-color:initial}
        //   2) 抹 "Deep diving..." 文字节点：父级 color:transparent + font-size:0
        //      + 子级 override（DSH .turnStatusClock 也必须 override）
        //   3) 容器 26px → 18px：之前 18px text 在 26px 容器居中垂直空白太多
        //   4) DSH .turnStatusClock flex order:2 重排到我们 span（order:1）后——
        //      "时间出现在 后面" 纯 CSS 解决，DSH 1s setInterval 自动维护
        //   5) 8 类活动色 + -webkit-text-fill-color 同色 override（防父级传递）
        //   其它 ID/class/attribute/localStorage key / debug API 全保留。
        // v0.9.7：simple-mode 状态行两轮「去装饰」——撤自家 pulse 和 pill 灰底
        //   （v0.9.8 接管整容器后 v0.9.7 那些 CSS 规则被父级 reset 影响）。
        // v0.9.5：simple-mode 状态行工具名识别修复——simplePickToolNameFromDom
        // 之前查 [data-tool-name]（错属性），DSH 实际渲染 [data-tool]（见
        // dsh-client-ui-tool ToolRow.js）；同时新增 simpleIsThinkingFromDom
        // 识别 reasoning block（不在 tool-call 容器里，assistant-step
        // data-variant="think"）。两处合并让 v0.9.3 美术度升级的 8 类语义色
        // 真正生效（think 蓝 / read 中性 / write 琥珀 / bash 紫 / task 青 /
        // plan 绿 / goal 粉 / git 石板——之前一直停在 generic 灰）。
        var VERSION = "0.9.9";
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
        // v0.9.3：tick() 给状态 span 写 data-dsh-activity 标记当前活动类目（think / read /
        // write / bash / task / plan / goal / git / generic），CSS 按类目着色。
        // span 由 ensureStatusSpan() 创建并由本插件独占——与 DSH 内部属性不冲突。
        var SIMPLE_STATUS_ACTIVITY_ATTR = "data-dsh-activity";
        var SIMPLE_TURN_STATUS_SEL = '[class*="turnStatus"]';
        var SIMPLE_POLL_MS = 250;
        // v0.9.6：折叠块末尾收起按钮——给所有 DisclosureRow 展开后的 body 末尾
        //   追加"收起"按钮，解决"展开后想收起需要一直往前翻到头部"的痛点。
        //   目标三类 DisclosureRow：ReasoningRow（Think, data-variant="think"）、
        //   GenericCommandCard（工具调用输出, data-variant="others"）、
        //   ContextInjectionRow（上下文注入, class 含 _root 且 data-open）。
        //   button 在 body 元素里（wrapper div + button），点击时找 body 父元素
        //   里 rowClassName 那行调 .click()——DSH React onToggle 触发折叠，body 与
        //   按钮一起被卸载；stopPropagation 避免冒泡到 row（虽然 row 是 body 兄弟
        //   不是祖先，但 click 也会途经 DisclosureRow wrapper——保险起见 stop）。
        var DISCLOSURE_END_COLLAPSE_WRAP_ATTR = "data-dsh-ui-tweaks-disclosure-collapse-wrap";
        var DISCLOSURE_END_COLLAPSE_ATTR = "data-dsh-ui-tweaks-disclosure-collapse";
        // 三大 DisclosureRow 的 body 选择器（暴露给 controller 复用）
        var DISCLOSURE_BODY_SELECTORS = [
          '[data-variant="think"] [class*="thinkBody"]',
          '[data-variant="others"] [class*="_body"]',
          '[class*="_root"][data-open] [class*="_body"]'
        ].join(", ");
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

