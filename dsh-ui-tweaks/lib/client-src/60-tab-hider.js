    // ===== tab-hider =====
    // 通用 tab hider 工厂——给 DSH 对话顶部 [role="tablist"] 里某个 tab 按钮打标记隐藏，
    // 并确保另一 tab 始终是当前选中（hider 强制对方 selected，避免单 tab 被隐藏时
    // 用户卡在那个 view 出不来）。
    //
    // 用法：
    //   hide-trajectory-tab：target="轨迹" + safe="对话"（轨迹被隐藏时强制对话）
    //   hide-chat-tab：      target="对话" + safe="轨迹"（对话被隐藏时强制轨迹）
    //
    // 两 tab 同时被 hide 时双方 safe 都被另一方标了 hidden-tab——
    // tick() 防御性跳过强制（双方互不 ping-pong），保留最后手动点的状态；
    // 视觉上 tablist 已折叠（见 hide-trajectory-tab / hide-chat-tab buildCSS）。

    // 多语言匹配集合（DSH zh / en；其它 locale 暂不支持）
    var TRAJECTORY_TAB_LABELS = ["轨迹", "Trajectory"];
    var CHAT_TAB_LABELS = ["对话", "Chat"];
    var HIDDEN_TAB_ATTR = "data-dsh-ui-tweaks-hidden-tab";
    var COLLAPSED_TABLIST_ATTR = "data-dsh-ui-tweaks-collapsed";

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
     * 同步 tablist 折叠标记——所有 tab 都被打上 HIDDEN_TAB_ATTR 时给 tablist 也打
     * COLLAPSED_TABLIST_ATTR=""; 否则清除该标记。CSS 据此 display:none 隐藏空 tablist
     * 并把父 <header> 的 min-height 缩到 auto（DSH header 默认 76px 是按
     * titleRow + tablist 算的，tablist 没了该缩成只剩 titleRow）。
     *
     * tick() 每跑一次都同步一次：DSH React 重渲可能重建 tablist 节点（mutation observer
     * 也会触发另一个 hider 的 tick），不带 incremental 状态、单次扫全部 tablists 即可。
     */
    function syncTablistCollapseMark() {
      if (typeof document === "undefined") return;
      var tablists = document.querySelectorAll('[role="tablist"]');
      for (var i = 0; i < tablists.length; i++) {
        var tablist = tablists[i];
        var tabs = tablist.querySelectorAll('[role="tab"]');
        var allMarked = tabs.length > 0;
        for (var j = 0; j < tabs.length; j++) {
          if (!tabs[j].hasAttribute(HIDDEN_TAB_ATTR)) {
            allMarked = false;
            break;
          }
        }
        if (allMarked) {
          tablist.setAttribute(COLLAPSED_TABLIST_ATTR, "");
        } else {
          tablist.removeAttribute(COLLAPSED_TABLIST_ATTR);
        }
      }
    }

    /**
     * 通用 tab hider。三件事：
     *   1) 给 target 按钮打 data-dsh-ui-tweaks-hidden-tab=<hiddenValue> 标记，CSS 命中隐藏
     *   2) 若 safe 自身没被另一 hider 隐藏，确保它始终 aria-selected="true"（即使按钮
     *      被 CSS display:none，程序 click 仍能触发 React 的 setView）。两 tab 都隐藏时
     *      跳过——双方 safe 都已被对方标 hidden-tab，强制会互相 ping-pong。
     *   3) 同步 tablist 折叠标记：所有 tab 都标 hidden 时给 tablist 打 data-dsh-ui-tweaks-
     *      collapsed，CSS 据此折叠空 tablist 行 + 缩父 header 的 min-height。
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

        // 2) safe 自身没被另一 hider 隐藏时，确保它始终是当前选中
        //    （两 tab 都隐藏场景跳过，避免 trajectoryHider 强制对话 / chatHider
        //    强制轨迹 互相 ping-pong）
        var safe = findTabButtonByLabels(opts.safeLabels);
        if (safe && !safe.hasAttribute(HIDDEN_TAB_ATTR) &&
            safe.getAttribute("aria-selected") !== "true") {
          if (typeof safe.click === "function") safe.click();
        }

        // 3) 同步 tablist 折叠标记
        syncTablistCollapseMark();
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
          // 同步 tablist 折叠标记（用户关掉当前 hider 后剩下另一个 hider 可能还在跑
          // 也会触发 tick，但 stop 触发时这是更直接的兜底——避免两边都停时残留折叠标记）
          syncTablistCollapseMark();
        }
      }

      return {
        start: start,
        stop: stop,
        get running() { return isRunning; }
      };
    }

