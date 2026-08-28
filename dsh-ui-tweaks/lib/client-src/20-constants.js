    // ===== constants =====
        // v0.10.1：stats-line-position 隐藏底部原生行时改用 `visibility:hidden`
        //   而不是 `display:none`——用户反馈 v0.10.0 "发消息的框往下走了一点点"。
        //   根因：统计行是 composer 卡片的 footer（高 24px = line-height 20 +
        //   padding-top 4），而 composer seat 是 `position:sticky;bottom:0` 贴底的
        //   （DSH `.wSkVaW_composerSeat`），卡片变矮 24px 就等于输入行整体下移
        //   24px。visibility 保留盒子（照常参与布局、React 照常更新其文本），
        //   高度分毫不差地保留 → 输入框位置与"底部"位置完全一致；比补一个
        //   硬编码 24px padding 更稳（不依赖 DSH 的字号 / 行高 / padding 数值）。
        //   代价：非"底部"位置时输入框下方保留一条 24px 空白——这正是把输入框
        //   钉在原位所必须的空间。详见 `25-tweaks.js` 的 stats-line-position
        //   buildCSS v0.10.1 段 + `00-banner.js` v0.10.1 banner 段。
        // v0.10.0：新增 stats-line-position tweak——对话底部那行统计
        //   （"N 轮 · M 步 | LLM ... | 首 token ... | 缓存命中 ...% | 输入/输出 tok"）
        //   现在可三选一：底部（DSH 默认）/ 顶部标题右侧 / 不显示。
        //   这是本插件第一条**非布尔**的 tweak——configKeys.enabled 存的是
        //   "bottom" / "top" / "hidden" 字符串；TweakRow 通过新增的
        //   `choices` 字段判断渲染下拉框而非开关（有 choices 就不渲染开关）。
        //   实现要点见 `69-stats-line-position.js` 头部注释：
        //     - 隐藏走纯 CSS（`[data-slot="conversation.composer.dock"]`
        //       出口 visibility:hidden !important，v0.10.1 起；v0.10.0 曾用
        //       display:none 但会让贴底的输入框下移 24px）——DSH renderer
        //       给每个 slot 出口包的 `data-slot` 属性不含 hash，比 CSS module
        //       类名稳定
        //     - 顶部走"镜像"（本插件 createElement 的元素 append 到标题簇
        //       末尾，周期性克隆原生行内容）——不搬 React 拥有的 DOM 节点，
        //       避免 React 卸载原节点时 removeChild 找不到父节点而崩树
        // v0.9.15：sidebar-match-conversation-bg 用户实测"展开页面左上角的
        //   部分，过一会就会变成灰色，我鼠标光标移动到上面的时候，又变成
        //   了白色，移走一段时间，又变成灰色"——v0.9.9/v0.9.13/v0.9.14 三层
        //   都只覆盖 column + 已知 _root 后代，没考虑 DSH 侧栏作用域内 CSS
        //   变量 `--dsw-specific-sidebar-fill` 的扩散——DSH 内部 sidebarCol /
        //   SidebarRoot 都引用此变量赋值 background，column + inner root
        //   直接 background 覆盖可能因 DSH 后续调整（如 cascade 重排、
        //   HMR 重注入、theme 异步应用、panel hover 切换状态等）失效，
        //   露出 sidebar-fill 的灰；hover 触发某些透明层覆盖又显出白色
        //   frame 背景；hover 出后透明层消失重新露出 inner root 的灰。
        //   修法：三层兜底——① 列显式 background + !important 强化
        //   + ② 内部 _root 后代 background + ③ `--dsw-specific-sidebar-fill`
        //   变量级覆盖为 transparent，让侧栏作用域内任何 `var(--dsw-specific-sidebar-fill)`
        //   引用解析为透明，从根上消除"侧栏内任何元素用 sidebar-fill 色
        //   覆盖 frame 背景"的可能。
        //   兼容性：tweak id / localStorage key / 调试 API / 类名 / ID /
        //   attribute / 设置页 UI 全部不动；只多了一条 `--dsw-specific-sidebar-fill`
        //   变量覆盖 + 列选择器显式 background。DSH 升级换 hash 也仍命中
        //   （className 仍含 `_root` 子串；变量覆盖作用于整个作用域，新元素
        //   也被覆盖）。
        //   详见 `25-tweaks.js` 的 sidebar-match-conversation-bg buildCSS
        //   v0.9.15 段 + `00-banner.js` v0.9.15 banner 段 + CHANGELOG v0.9.15。
        // v0.9.14：sidebar-match-conversation-bg v0.9.13 在收起态失效——
        //   DSH SidebarRoot 收起态额外加 `hHd-Xa_collapsed` + `hHd-Xa_railIn`
        //   + `hHd-Xa_quietBars` 类，整个 className 字符串从 `"hHd-Xa_root"`
        //   变成 `"hHd-Xa_root hHd-Xa_collapsed hHd-Xa_railIn hHd-Xa_quietBars"`，
        //   末尾不再是 `_root`——`[class$="_root"]` ends-with 匹配失效，小侧栏
        //   仍显示 `--dsw-specific-sidebar-fill` 的灰。改 `[class*="_root"]`
        //   contains 后与 className 拼接顺序无关，展开 / 收起两态都命中。
        //   其他 tweak / 类名 / ID / attribute / localStorage key / 调试 API
        //   全不动。详见 `25-tweaks.js` 的 sidebar-match-conversation-bg
        //   buildCSS v0.9.14 段 + `00-banner.js` v0.9.14 banner 段 + CHANGELOG v0.9.14。
        // v0.9.13：sidebar-match-conversation-bg v0.9.9 选择器只命中 sidebarCol，
        //   但 DSH AppFrame 内的 `<div class="hHd-Xa_root">`（SidebarRoot 组件根，
        //   height:100%）也设了 `background:var(--dsw-specific-sidebar-fill)`，
        //   完全覆盖 column——column 改背景视觉上仍被 inner 的特定色盖住，
        //   用户实测"开启后无变化"。修法：选择器同时命中 column + 其内
        //   SidebarRoot（`[class*="_root"]` contains，DSH CSS module
        //   `<hash>_<name>_root` 约定，hash-independence；后代选择器
        //   兼容 DSH 后续在两者间加包装层）。其他 tweak / 类名 /
        //   ID / attribute / localStorage key / 调试 API 全不动。详见
        //   `25-tweaks.js` 的 sidebar-match-conversation-bg buildCSS v0.9.13 段
        //   + `00-banner.js` v0.9.13 banner 段 + CHANGELOG v0.9.13。
        // v0.9.12：simple-mode 状态行 v0.9.10 CSS 三层 reset 兜不住 DSH 后续添加的
        //   loader / shimmer 子元素；走 v0.9.10 CHANGELOG [Unreleased] line 63 预设的
        //   JS 回退路径——`createSimpleModeStatusController#purgeTurnStatus()` 在
        //   appendChild 前清空容器并保留 clock；`watchTurnStatus()` 升级观察
        //   document.body subtree（含 DSH 重渲时新增的任何 turnStatus 立即 purge），
        //   杀零 tick 250ms 间隔的闪援窗口。同时修"几次穿插后像首行缩进"——CSS 加
        //   `padding-left:0 !important` + `margin-left:0 !important`，JS 同步把 inline
        //   `style.paddingLeft / marginLeft` 归零。详情见 `lib/client-src/55-simple-mode.js`
        //   v0.9.12 banner 段 + `25-tweaks.js` simple-mode buildCSS v0.9.12 增量段。
        // v0.9.11：simple-mode 防御性 layout zero——用户反馈"两边的字之间的距离会特别大
        //   但有时候会有时候不会"。根因：`display:none` 在某些 layout context（CSS Grid
        //   / React VirtualList fixed slot / React inline style min-height based on
        //   child 内容等）下不一定让元素彻底不占布局空间。间距时大时小正对应 layout
        //   重算发生在 React 重渲时。修法：把 hidden block 的 height / min-height /
        //   max-height / margin / padding / border / outline / flex-basis /
        //   flex-grow / grid-area 全部显式归零——在 block / flex / grid / virtual list
        //   任意 layout context 下都不留残余高度。兼容性：纯 CSS 加固。
        // v0.9.10：simple-mode 状态行 v0.9.8 reset 不彻底——用户反馈"底部的 正在思考
        //   还是会一闪一闪的 而且位置依赖（最左侧不闪，右移一点开始闪）"。
        //   v0.9.8 只 reset 了 animation / background / background-clip，DSH 可能用
        //   transition + mask-image linear-gradient 替代 animation 做 shimmer（animation:none
        //   杀不掉 transition 驱动的效果）；也可能在容器里多塞新 child 做动画 / 在 ::before
        //   上放 spinner。v0.9.10 三层防线：1) 容器升级 reset（+ transition / text-shadow /
        //   box-shadow / filter / mask-image / transform / overflow 等）2) 伪元素
        //   ::before / ::after 显式 display:none 3) 直接子元素除我们 span 和 clock 外
        //   全部 display:none。clock 也加防御性 reset。兼容性：纯 CSS 加固，所有类名 /
        //   ID / attribute / localStorage key 不动。
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
        // v0.10.2：conversation-shift 双 padding bug + 窄屏不可用 bug 修复
        //   1) chatflow 探测升级首选 DSH 稳定锚点 [data-conversation-scroll]
        //      ——空会话（hero composer 无消息）也能命中。命中即返回，
        //      **不再额外标 input**——scrollBody 在 DSH 结构里已包了 composerSeat，
        //      单 padding 同步影响消息 + 输入框；v0.5.3 同时标 chatflow+input
        //      导致双 padding 在窄屏叠加成不可用宽度（680-760=-80 溢出）
        //   2) CSS 改成 `padding-right: min(Npx, 40%)`——保留用户在全屏的偏好像素，
        //      半屏时 40% 上限自动收紧到「聊天列 60% 内容 + 40% 右缩」的比例
        //   详见 `45-chatflow-marks.js` v0.10.2 banner 段 + `25-tweaks.js` 的
        //   conversation-shift buildCSS v0.10.2 注释段。
        var VERSION = "0.10.2";
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
        // v0.10.0：统计行位置（stats-line-position tweak）。
        //   锚点全部走 DSH renderer 的 slot 出口属性 `data-slot="<slot key>"`
        //   （dsh-client-ui-renderer SlotOutlet 给每个出口包一层
        //   `<div data-slot=... style="display:contents">`）——不含 CSS module
        //   hash，跨 DSH 版本稳定；只有兜底选择器才用 `[class*="..."]` 子串匹配。
        var STATS_DOCK_SEL = '[data-slot="conversation.composer.dock"]';          // 底部统计行出口（唯一占位者 = StatsLine）
        var STATS_HEADER_ACTIONS_SEL = '[data-slot="conversation.session.header.actions"]'; // 顶部"模式"标签出口（其祖父 = 标题簇）
        var STATS_TITLE_CLUSTER_HINT_SEL = '[class*="_titleCluster"]';            // 兜底：标题簇（对话名 + 模式那一簇）
        var STATS_ROOT_HINT_SEL = '[class*="_root"]';                             // 出口内定位 StatsLine 根元素
        var STATS_MIRROR_ATTR = "data-dsh-ui-tweaks-stats-mirror";                // 顶部镜像元素标记（本插件独占）
        var STATS_POS_BOTTOM = "bottom";
        var STATS_POS_TOP = "top";
        var STATS_POS_HIDDEN = "hidden";
        var STATS_POLL_MS = 400;   // 镜像同步轮询间隔（统计行按"步"更新，不必更密）
        // v0.5.3：动态探测 chatflow 容器 + 输入框，打标记给 CSS 命中
        var SHIFT_TARGET_ATTR = "data-dsh-ui-tweaks-shift-target";
        var SHIFT_TARGET_CHATFLOW = "chatflow";
        var SHIFT_TARGET_INPUT = "input";
        var SHIFT_TARGET_COLUMN = "column";  // 兜底：探测失败时标记列容器
        // v0.10.2：DSH 稳定锚点首选——ConversationRoot.scrollBody 上的
        //   `data-conversation-scroll=""`（DSH 源码 `dsh-client-ui-conversation/
        //   lib/client.js:7277` 显式 `setAttribute` 的属性，不含构建 hash）。
        //   与 v0.8.0 JUMP_SCROLL_SEL 是同一个属性，但本 tweak 用于「整列右缩」
        //   而 first-message-jump 用于「滚到上一条 user 行」——职责不同、保持
        //   各自常量便于读者按文件回溯。两者同时为 DSH 升级兼容锚点：DSH 改名
        //   时本常量 + JUMP_SCROLL_SEL 同步更新即可。
        var SHIFT_SCROLL_SEL = "[data-conversation-scroll]";
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

