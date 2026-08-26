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

