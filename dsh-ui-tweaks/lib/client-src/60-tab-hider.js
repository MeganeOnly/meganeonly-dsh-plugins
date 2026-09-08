    // ===== tab-hider =====
    // 通用 tab hider 工厂——给 DSH 对话顶部 [role="tablist"] 里某个 tab 按钮打标记隐藏，
    // 并确保"安全 tab"始终是当前选中（避免两个 tab 都隐藏时用户卡在轨迹视图出不来）。
    //
    // 用法：
    //   hide-trajectory-tab：target="轨迹" 标签 + safe="对话" 兜底
    //   hide-chat-tab：      target="对话" 标签 + safe="对话"（chat 是 DSH 默认 view）

    // 多语言匹配集合（DSH zh / en；其它 locale 暂不支持）
    var TRAJECTORY_TAB_LABELS = ["轨迹", "Trajectory"];
    var CHAT_TAB_LABELS = ["对话", "Chat"];
    var HIDDEN_TAB_ATTR = "data-dsh-ui-tweaks-hidden-tab";

    function findTabButtonByLabels(labels) {
      if (typeof document === "undefined") return null;
      var tabs = document.querySelectorAll('[role="tablist"] [role="tab"]');
      for (var i = 0; i < tabs.length; i++) {
        var text = (tabs[i].textContent || "").trim();
        for (var j = 0; j < labels.length; j++) {
          if (text === labels[j]) return tabs[i];
        }
      }
      return null;
    }

    /**
     * 通用 tab hider。两件事：
     *   1) 给 target 按钮打 data-dsh-ui-tweaks-hidden-tab=<hiddenValue> 标记，CSS 命中隐藏
     *   2) 确保 safe 按钮始终 aria-selected="true"（即使按钮被 display:none，
     *      程序 click 仍能触发 React 的 setView），避免两 tab 都关后卡在非默认 view
     */
    function createTabHider(opts) {
      var observer = null;
      var isRunning = false;

      function tick() {
        if (typeof document === "undefined") return;

        // 1) 标记目标 tab 隐藏
        var target = findTabButtonByLabels(opts.targetLabels);
        if (target && target.getAttribute(HIDDEN_TAB_ATTR) !== opts.hiddenValue) {
          target.setAttribute(HIDDEN_TAB_ATTR, opts.hiddenValue);
        }

        // 2) 确保安全 tab 始终是当前选中（即使其按钮被 CSS display:none，
        //    程序 click 仍能触发 React 的 setView，切 view）
        var safe = findTabButtonByLabels(opts.safeLabels);
        if (safe && safe.getAttribute("aria-selected") !== "true") {
          if (typeof safe.click === "function") safe.click();
        }
      }

      function start() {
        if (isRunning) return;
        isRunning = true;
        if (typeof MutationObserver === "undefined" || typeof document === "undefined") {
          tick();
          return;
        }
        observer = new MutationObserver(function () {
          // throttle：避免短时间内反复探测
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
        if (typeof document !== "undefined") {
          var marked = document.querySelectorAll(
            '[' + HIDDEN_TAB_ATTR + '="' + opts.hiddenValue + '"]'
          );
          for (var i = 0; i < marked.length; i++) {
            marked[i].removeAttribute(HIDDEN_TAB_ATTR);
          }
        }
      }

      return {
        start: start,
        stop: stop,
        get running() { return isRunning; }
      };
    }

