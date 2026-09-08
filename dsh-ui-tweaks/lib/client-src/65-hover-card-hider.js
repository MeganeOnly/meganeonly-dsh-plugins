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

