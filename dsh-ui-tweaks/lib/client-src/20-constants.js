    // ===== constants =====
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

