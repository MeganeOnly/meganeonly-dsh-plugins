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
        // v0.9.3 美术度升级：状态行三轴叠加——
        //   A) 圆角胶囊 (pill)：border-radius 999 + 水平 padding 8/10 + 极淡背景
        //   B) 呼吸点 (::before)：6px 圆点 + @keyframes 仅透明度循环（无 scale）
        //   C) 语义色 ([data-dsh-activity]=...)：8 类活动对应 8 色；点继承 currentColor
        // 单一设计语言：JS 在 tick() 给 span 写 data-dsh-activity，CSS 命中着色；
        // 背景用 color-mix(currentColor 8%, transparent) 跟着 accent 色淡出。
        //
        // v0.9.3 hotfix：去垂直 padding（保持总高 18px 与 DSH 原生「Deep diving...」
        // 等 turnStatus 文案严格对齐）+ 去 scale 动画 + 去 color transition + 减弱
        // 呼吸幅度（opacity 0.6↔0.9 取代 0.35↔0.95）+ 减慢周期（2.4s 取代 1.6s）——
        // 解决 v0.9.3 首版的「闪烁 + 高度膨胀」问题。
        buildCSS: function (state) {
          if (!state.simpleModeEnabled) return null;
          return "/* === simple-mode : hide tool-call / context / think / process rows === */\n" +
            // v0.9.11：防御性 layout zero——`display:none` 在某些 layout context
            //   （CSS Grid / React VirtualList / parent 有 inline style min-height
            //   基于 child 内容等）下不一定让元素彻底不占布局空间——virtual list
            //   每个 item 有 fixed slot，`display:none` 不会回收 slot；CSS Grid
            //   `grid-template-rows: masonry` 类似；React 给 parent 设的
            //   `style={{minHeight: ...}}` 也不被 child 的 `display:none` 影响。
            //   用户反馈"两边的字之间的距离会特别大 但有时候会有时候不会"——
            //   间距时大时小正对应 layout 重算发生在 React 重渲时（旧消息按"已收敛
            //   layout"渲染间距正常，新消息边渲边 hide 时 layout 未收敛间距偏大）。
            //   修法：把 hidden block 的 height / min-height / max-height /
            //   margin / padding / border / outline / flex-basis / flex-grow /
            //   grid-area 全部显式归零——在 block / flex / grid / virtual list
            //   任意 layout context 下都不留残余高度。
            //   兼容性：纯 CSS 加固，不动类名 / ID / attribute / localStorage key。
            '[data-chat-flow-kind="tool-call"],' +
            '[data-chat-flow-kind="context"],' +
            '[data-variant="think"],' +
            '[data-chat-flow-kind="compaction"],' +
            '[data-chat-flow-kind="manual-compaction"],' +
            '[data-chat-flow-kind="model-retry"],' +
            '[data-chat-flow-kind="turn-error"],' +
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
            // —— v0.9.10 status row —— 接管 DSH 原生 turnStatus 视觉呈现。
            //   v0.9.8 整容器接管：杀 DSH animation / background / background-clip /
            //   -webkit-text-fill-color / color:transparent / font-size:0 抹 DSH 文字 /
            //   容器 26px → 18px / flex order 重排 clock。
            //   v0.9.10 用户反馈"底部的 正在思考 还是会一闪一闪的 而且位置依赖
            //   （最左侧不闪，右移一点开始闪）"——v0.9.8 的 reset 不够彻底。三层防线：
            //
            //   **第 1 层**：容器本身的 reset 升级——v0.9.8 只 reset 了 animation /
            //     background / background-clip。v0.9.10 加 transition / text-shadow /
            //     box-shadow / filter / -webkit-mask-image / mask-image / transform
            //     等"非 animation 但能产生 shimmer 视觉效果"的属性全部杀掉——
            //     DSH 完全可能用 `transition + mask-image linear-gradient` 替代
            //     animation 做 shimmer（animation:none 杀不掉 transition 驱动的效果）。
            //     加 background-image / background-size / background-position 等
            //     详细 background 子属性 reset（background:none 不一定覆盖 background-image:
            //     linear-gradient / -webkit-mask-image 等）。加 overflow:hidden
            //     裁掉任何超出容器宽度的子元素视觉溢出。
            //
            //   **第 2 层**：伪元素 ::before / ::after 显式杀掉——v0.9.8 容器 reset 不
            //     传递到伪元素的具体 background / animation。DSH 完全可能在 ::before
            //     上放 spinner / shimmer 装饰元素。display:none + content:none 双保险。
            //
            //   **第 3 层**：直接子元素除我们 span 和 clock 外全部 display:none——
            //     DSH 完全可能在容器里多塞 <div class="turnStatusLoader"> 之类的新
            //     child 做动画。子元素选择器（[class*="turnStatus"] > *）不依赖 hash，
            //     DSH 升级换 class 名 / 加新 child 都一律干掉。
            //   child 隐藏的副作用：DSH "Deep diving..." 文字节点是 text node 不是
            //     element，CSS selector 命中不到——但 v0.9.8 起父级 color:transparent +
            //     font-size:0 已让它无形 + 零宽，足够；第 3 层只防 DSH 新加 element child。
            //
            //   关于位置依赖（最左侧不闪 / 右移一点闪）：最可能是 mask-image +
            //     background-position + transition 驱动的 shimmer（gradient 范围在容器
            //     内某段，文字在容器内某位置，两者重叠时 shimmer 可见，不重叠时不闪），
            //     也可能是 DSH 新加的 child loader（位于容器左侧，文字右移到 loader
            //     区域就闪）。两层 reset + child 隐藏覆盖两种可能。
            //
            //   保留：v0.9.7 引入的 transition:color .4s ease（活动色平滑过渡）；
            //     visibility:visible !important（v0.7.1 起的祖先 display:none 兜底）。
            //
            //   兼容性：[class*="turnStatus"] / [class*="turnStatusClock"] / .dsh-ui-tweaks-status
            //     类名 / ID / attribute / localStorage key 全不动——纯 CSS 加固。
            // visibility:visible !important 仍保留（v0.7.1 起的祖先 display:none 兜底）
            "[class*=\"turnStatus\"]{" +
              // 容器 reset——v0.9.8 起的基础 + v0.9.10 增量
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
              // v0.9.10 新增——杀 transition / shadow / filter / mask 等 animation 之外的
              //   视觉动效源（DSH 完全可能用 transition + mask-position 做 shimmer）
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
              // 裁掉任何超出容器宽度的子元素视觉溢出（DSH loader / shimmer 即使没被 child
              //   选择器命中也可能溢出到容器外）
              "overflow:hidden !important" +
            "}\n" +
            // v0.9.10：伪元素显式杀掉——DSH 经常在 ::before / ::after 上放 spinner / shimmer
            //   装饰，容器 animation:none 不传递到伪元素的具体 background / 自身 animation
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
            // v0.9.10：直接子元素除我们 span 和 clock 外全部隐藏——DSH 完全可能在容器里
            //   多塞新 child（<div class="turnStatusLoader"> 等）做动画。substring selector
            //   不依赖 hash，DSH 升级换 class 名 / 加新 child 一律干掉。text node 不是
            //   element 命中不到，但 v0.9.8 起父级 color:transparent + font-size:0 已让它
            //   无形 + 零宽
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
            // —— 静态点 ::before —— v0.9.7 撤掉 v0.9.3–v0.9.6 的呼吸动画
            //   （用户反馈：2.4s 周期 opacity .6↔.9 持续闪烁太难受——
            //   "一闪一闪"的感觉比活动切换的"现在还在跑"信号更强，反客为主。
            //   用户表态宁可切换不那么准确、过渡缓慢，也不能接受脉动）。
            //   保留 6×6 圆点作为"当前有一个活动"的视觉锚，颜色继承
            //   currentColor 跟着文字的 8 类活动色一起平滑过渡（.4s ease），
            //   opacity 0.7 不抢戏。无 animation / 无 transition，完全静态。
            //   活动色变化在 .dsh-ui-tweaks-status 上 transition:color .4s ease
            //   接管——text + ::before dot 都跟着平滑过渡。
            ".dsh-ui-tweaks-status::before{" +
              "content:\"\";" +
              "width:6px;" +
              "height:6px;" +
              "border-radius:50%;" +
              "background:currentColor;" +
              "opacity:.7;" +
              "flex:none" +
            "}\n" +
            // —— DSH 自带 .turnStatusClock 时间元素 —— v0.9.8 用 flex order
            //   重排到我们 span 后面（order:2 vs ours 1），解决用户反馈
            //   "时间出现在 正在处理...的后面"——纯 CSS、无新 DOM。DSH 自己
            //   每 1s setInterval 自动更新文本，15s 后才出现（DSH 原生
            //   `showClock = elapsedMs >= 15e3`，不改）。font-size:0 从父级
            //   继承会被吃掉，必须显式 override 到 13px；颜色与活动色独立——
            //   始终 tertiary，不跟活动色走（时间应该是中性信息，不抢戏）。
            //   font-variant-numeric:tabular-nums 让数字宽度一致（"5s"→"10s"
            //   切换时数字部分不抖）。
            //   v0.9.10：clock 加防御性 reset——DSH clock 自己可能有 shadow /
            //   filter / mask 等 animation 之外的视觉效果
            "[class*=\"turnStatusClock\"]{" +
              "order:2;" +
              "margin-left:8px;" +
              "font-size:13px !important;" +
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
            // —— 8 类活动语义色 —— JS tick() 给 span setAttribute("data-dsh-activity", ...)
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
        // v0.9.6 新增：折叠块末尾收起按钮。DSH 用 DisclosureRow 渲染三类可展开块——
        //   ReasoningRow (data-variant="think") / GenericCommandCard (data-variant="others")
        //   / ContextInjectionRow (class 含 _root 且 data-open)。展开后阅读完毕想收起时
        //   必须滚回头部点行——长 Think 内容滚回很烦。
        // 解决：在每个展开后 body 末尾追加一个"收起 ▴"按钮（仅当 expanded 时 body 才会
        //   在 DOM 里），点击调用 row.click() 触发 DSH React onToggle 折叠。
        // 默认 ON——本 tweak 是 v0.9.6 新引入，无 backward compat 顾虑。
        // CSS 输出：按钮 wrapper 强制 display:block 独占一行，按钮 chip 形态（边框 + 圆角 +
        //   hover 背景）；DSH 主题变量 fallback 链防止主题切到没有这些变量的仍可见。
        id: "disclosure-end-collapse",
        name: "展开块末尾收起按钮",
        description: "Think / 工具调用 / 上下文注入等折叠块展开后，末尾追加一个\"收起\"按钮——阅读到底部能直接收起，不用滚回头部再点行。",
        // 仅开关型 tweak：enabled 和 value 复用同一 key（与 simple-mode 同模式），
        //   localStorage 只存一个布尔字段；TweakRow 通过 k2===k1 检测不渲染数字框。
        configKeys: { enabled: "disclosureEndCollapse", value: "disclosureEndCollapse" },
        defaults: { enabled: true, value: true },
        buildCSS: function (state) {
          if (!state.disclosureEndCollapse) return null;
          return "/* === disclosure-end-collapse v0.9.6 : DisclosureRow 展开后 body 末尾追加\"收起\"按钮 (Think / 工具调用输出 / 上下文注入) === */\n" +
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
      },
      {
        // v0.9.9 新增：侧栏背景与对话一致。
        //
        // 用户反馈：DSH 默认侧栏（展示会话列表的左侧栏，data-pane="sidebar"）
        //   有自己独立的背景色，与对话区（data-pane="conversation"）的
        //   `--dsw-alias-bg-base` 不同——视觉上有清晰的边界分割。开启后让
        //   两个区域在背景色上融合。
        //
        // 实现：纯 CSS 一条规则——把 [data-pane="sidebar"] 的 background 设为
        //   与对话区同款的 DSH 主题变量 `--dsw-alias-bg-base`。来源证据：
        //     - dsh-ssh 的 panel（"data-pane=conversation" 上的 mL8Uca_panel）
        //       用 `background:var(--dsw-alias-bg-base)` 来"无缝融入"对话区
        //     - dsh-client-ui-skin-center #712 注释明确 AppFrame frame +
        //       conversation root + details root 共同"paint the opaque app
        //       base background via hashed CSS-module classes"——侧栏不在
        //       这个列表里，所以有独立的视觉背景
        //   fallback 链：`--dsw-alias-bg-base` → `--dsw-alias-bg-layer-1` →
        //   `#ffffff`——主题切到没定义 bg-base 时退化到 layer-1（与简单
        //   模式状态行按钮背景同款），再退化到硬值白。
        //
        // 子元素（会话项 / 按钮 / hover 态）不动——它们有功能性背景（hover
        //   高亮 `--dsw-specific-sidebar-nav-item-hover` 等），保持可见。
        //   只让容器背景色与对话一致，子元素视觉行为零变化。
        //
        // 默认 OFF：本 tweak 是 v0.9.9 新引入，倾向保守——老用户升级后默认
        //   视觉不变，需要在设置页显式开启；与 v0.9.6 disclosure-end-collapse
        //   的"默认 ON"反着来（后者是修复 UX 痛点必开，前者是视觉偏好可选）。
        id: "sidebar-match-conversation-bg",
        name: "侧栏背景与对话一致",
        description: "DSH 默认左侧栏（展示会话列表的区域）有独立的背景色，与对话区视觉上有明显分割。开启后把侧栏列容器的背景设为对话区同款（用 DSH 主题变量 --dsw-alias-bg-base，主题没定义时退化到 --dsw-alias-bg-layer-1 再退化到白），让两个区域在背景色上融合。会话项 / 按钮 / hover 态等子元素的视觉行为不变（只改列容器背景）。",
        // 仅开关型 tweak：enabled 和 value 复用同一 key（与 simple-mode / hide-* 同模式），
        //   localStorage 只存一个布尔字段；TweakRow 通过 k2===k1 检测不渲染数字框。
        configKeys: { enabled: "sidebarMatchConversationBg", value: "sidebarMatchConversationBg" },
        defaults: { enabled: false, value: false },
        buildCSS: function (state) {
          if (!state.sidebarMatchConversationBg) return null;
          // 三层 fallback 链：--dsw-alias-bg-base（DSH 主背景，ssh / task-board 面板用同款）
          //   → --dsw-alias-bg-layer-1（DSH 卡片背景，disclosure 按钮背景同款）
          //   → #ffffff（硬值白）。任意一层在当前主题下可用即可。
          return "/* === sidebar-match-conversation-bg v0.9.9 : 侧栏 [data-pane=\"sidebar\"] 列容器背景与对话区一致（--dsw-alias-bg-base） === */\n" +
            "[data-pane=\"sidebar\"] {" +
              "background:var(--dsw-alias-bg-base,var(--dsw-alias-bg-layer-1,#ffffff)) !important" +
            "}";
        }
      }
    ];

