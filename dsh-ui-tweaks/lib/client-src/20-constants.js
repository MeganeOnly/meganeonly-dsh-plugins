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

