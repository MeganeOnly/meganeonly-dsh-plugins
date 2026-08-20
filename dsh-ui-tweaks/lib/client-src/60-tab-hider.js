    // ===== tab-hider =====
    // ====================================================================
    // v0.7.0 + v0.7.2：通用 tab hider 工厂（hide-trajectory-tab + hide-chat-tab 副作用）
    // --------------------------------------------------------------------
    // DSH 对话顶部有 [role="tablist"] 包含 "对话"(Chat) + "轨迹"(Trajectory)
    // 两个标签（renderSlot("conversation.view", ...) 注册的两个 view entry）。
    // 用户点击"轨迹"会进入 TrajectoryView——开发者视角的事件账本。
    //
    // v0.7.2 重构：原 createTrajectoryTabHider 拆成通用 createTabHider(opts)
    // 工厂——`{ targetLabels, hiddenValue, safeLabels }`——两个 tweak 都用。
    //   - hide-trajectory-tab：target="轨迹", safe="对话"
    //   - hide-chat-tab：      target="对话", safe="对话"
    // safe 都是"对话"（DSH 默认 view）——避免两个 tab 都被关掉后用户卡在轨迹。
    //
    // controller 职责：
    //   1. 巡检 [role="tablist"] 内按钮文本，找到 targetLabels 匹配的按钮，
    //      打 data-dsh-ui-tweaks-hidden-tab=<hiddenValue> 标记（CSS 命中隐藏）
    //   2. 如果 safeLabels 匹配的"安全 tab"当前不是 aria-selected="true"——
    //      程序点击它（即使被 CSS display:none，click 仍能触发 React setView），
    //      确保 view 在默认对话页，避免用户卡在轨迹视图
    //
    // MutationObserver 观察 document.body 子树——DSH React 重渲或切换会话
    // 会重建 tablist，必须重新巡检。
    // ====================================================================

    // 多语言匹配集合。DSH 用 zh / en 两种 UI 语言；其它 locale 暂不支持。
    var TRAJECTORY_TAB_LABELS = ["轨迹", "Trajectory"];
    var CHAT_TAB_LABELS = ["对话", "Chat"];
    var TRAJECTORY_TAB_HIDDEN_ATTR = "data-dsh-ui-tweaks-hidden-tab";

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
     * v0.7.0 起的通用 tab hider 工厂。负责两件事：
     *   1. 给目标 tab 按钮打 data-dsh-ui-tweaks-hidden-tab=<hiddenValue> 标记
     *      → CSS 命中隐藏
     *   2. 确保"安全 tab"始终是当前选中的——避免两个 tab 都被隐藏时用户
     *      卡在某个非默认 view 上出不来。安全 tab 在 DSH 里就是 Chat
     *      （default view）。
     *
     * 用法：
     *   - hide-trajectory-tab：
     *       targetLabels = ["轨迹", "Trajectory"]
     *       hiddenValue = "trajectory"
     *       safeLabels = ["对话", "Chat"]
     *     行为：标记轨迹 tab 隐藏；如果轨迹被选中（用户之前手动切到轨迹
     *     视图），点击对话 tab 切回——避免两个 tab 都关后用户卡在轨迹。
     *
     *   - hide-chat-tab：
     *       targetLabels = ["对话", "Chat"]
     *       hiddenValue = "chat"
     *       safeLabels = ["对话", "Chat"]   // 同 target（chat 是 default）
     *     行为：标记对话 tab 隐藏；如果对话不是当前选中的（即用户在轨迹
     *     视图），点击对话 tab 切回——同上原因。
     *
     * safeLabels 之所以设成"对话"而不是"轨迹"——chat 是 DSH 默认 view，
     * hide-trajectory + hide-chat 一起开时，安全的归宿就是 chat（即使两个
     * tab 按钮都不可见，程序 click 仍能切 view）。
     */
    function createTabHider(opts) {
      var observer = null;
      var isRunning = false;

      function tick() {
        if (typeof document === "undefined") return;

        // 1) 标记目标 tab 隐藏
        var target = findTabButtonByLabels(opts.targetLabels);
        if (target && target.getAttribute(TRAJECTORY_TAB_HIDDEN_ATTR) !== opts.hiddenValue) {
          target.setAttribute(TRAJECTORY_TAB_HIDDEN_ATTR, opts.hiddenValue);
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
            '[' + TRAJECTORY_TAB_HIDDEN_ATTR + '="' + opts.hiddenValue + '"]'
          );
          for (var i = 0; i < marked.length; i++) {
            marked[i].removeAttribute(TRAJECTORY_TAB_HIDDEN_ATTR);
          }
        }
      }

      return {
        start: start,
        stop: stop,
        get running() { return isRunning; }
      };
    }

