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
            '[data-chat-flow-kind="tool-call"]{display:none!important}\n' +
            '[data-chat-flow-kind="context"]{display:none!important}\n' +
            '[data-variant="think"]{display:none!important}\n' +
            '[data-chat-flow-kind="compaction"]{display:none!important}\n' +
            '[data-chat-flow-kind="manual-compaction"]{display:none!important}\n' +
            '[data-chat-flow-kind="model-retry"]{display:none!important}\n' +
            '[data-chat-flow-kind="turn-error"]{display:none!important}\n' +
            '[data-chat-flow-kind="turn-max-tokens"]{display:none!important}\n' +
            // —— v0.9.7 status row —— 撤掉 v0.9.3–0.9.6 的圆角胶囊灰底 + 呼吸脉动动画
            //   两层「去装饰」：
            //   - 去背景：用户反馈简洁模式不需要 badge 铺底，"正在查找…"
            //     那种 `read` 类着色 #475569 中性灰，8% tint 出图就是明显
            //     的灰色色块，看着多余。去掉 background / border-radius:999px
            //     / 水平 padding，圆角胶囊外壳彻底消失。
            //   - 去脉动：用户反馈 2.4s 周期 opacity .6↔.9 持续闪烁（"一闪
            //     一闪"）比活动切换的"现在还在跑"信号更强，反客为主——
            //     用户表态宁可切换不那么准确、过渡缓慢，也不能接受脉动。
            //     撤掉 @keyframes dsh-status-pulse + ::before 上的 animation
            //     + 配套 @media (prefers-reduced-motion:reduce)。圆点保留为
            //     静态视觉锚（见下面 ::before 段），活动切换的色变走 status
            //     上的 transition:color .4s ease 平滑过渡（".4s 慢切换但不闪烁"
            //     ——满足"宁可切换慢"的要求）。
            //   现在形态 = 6×6 静态圆点 + 当前活动色文字 + margin-left:10px，
            //   与前面 DSH 原生 turnStatus 文案（如「Deep diving...」）天然分隔，
            //   像一条带状态前缀的普通文字，不像 badge。
            // visibility:visible !important 仍保留（v0.7.1 起的祖先 display:none 兜底）
            ".dsh-ui-tweaks-status{" +
              "display:inline-flex !important;" +
              "align-items:center;" +
              "gap:6px;" +
              "padding:0;" +
              "margin-left:10px;" +
              "color:var(--dsw-alias-label-tertiary);" +
              "font-size:13px;" +
              "line-height:18px;" +
              "vertical-align:middle;" +
              "flex:none;" +
              "white-space:nowrap;" +
              "transition:color .4s ease;" +
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
            // —— 8 类活动语义色 —— JS tick() 给 span setAttribute("data-dsh-activity", ...)
            // 顺序：think (思辨) / read (输入) / write (变更) / bash (执行) /
            //       task (调度) / plan (计划) / goal (跟踪) / git (版本) / generic (兜底)
            // 硬值 fallback——主题切到没有这些变量的主题时仍能着色
            ".dsh-ui-tweaks-status[data-dsh-activity=\"think\"]   {color:#2563eb}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"read\"]    {color:#475569}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"write\"]   {color:#d97706}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"bash\"]    {color:#7c3aed}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"task\"]    {color:#0891b2}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"plan\"]    {color:#059669}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"goal\"]    {color:#db2777}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"git\"]     {color:#64748b}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"generic\"] {color:var(--dsw-alias-label-tertiary)}";
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
      }
    ];

