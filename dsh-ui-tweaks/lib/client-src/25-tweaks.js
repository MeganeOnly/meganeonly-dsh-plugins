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
        description: "对话底部那行运行统计（轮次 / 步数、LLM 与工具耗时、首 token 与吞吐、缓存命中、输入输出 token）的位置。「底部」是 DSH 默认；「顶部标题右侧」把它挪到对话名与模式标签右边（内容与底部完全一致，标题行放不下时省略号截断，鼠标悬停看全文；v0.10.11 起两个 pill 之间恢复 12px gap，视觉与底部原生行对齐；顶部镜像里的按钮可点击，详情对话框从镜像按钮下方弹出——与底部同源同数据，但位置跟随顶部镜像而非底部隐藏的原生按钮，滚动时对话框跟随镜像 button 一起移动）；「不显示」则完全隐藏。非「底部」时原生行用 visibility 隐藏而非移除，保留它原本占的 24px——这样输入框位置与「底部」时完全一致，代价是输入框下方留一条等高空白。注意：隐藏作用于整个底部 dock 区域——目前 DSH 里该区域的唯一内容就是这行统计，但若将来有别的插件也往这里放东西，会被一并隐藏。",
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
          var css = "/* === stats-line-position : " + pos + " —— 隐藏底部 composer.dock 出口（唯一占位者 = DSH StatsPills = TimePill + UsagePill）；visibility 保留占位 === */\n" +
            STATS_DOCK_SEL + "," + STATS_DOCK_SEL + " *{visibility:hidden !important;}";
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

