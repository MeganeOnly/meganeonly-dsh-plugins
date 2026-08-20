    // ===== hover-card-hider =====
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

