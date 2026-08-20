    // ===== shim =====
    // ====================================================================
    // Self-shim：自己种 data-pane="conversation" 属性
    // 4 层 selector 策略，按可信度递减
    // ====================================================================

    /**
     * 找 AppFrame（grid 容器）的 3 个 grid 子元素：sidebar / center / details。
     * 通过 gridTemplateColumns 解析 + 子元素位置判断。
     * 返回 { frame, sidebar, center, details }；找不到则字段为 null。
     */
    function discoverFrameTriptych() {
      if (typeof document === "undefined") return null;
      // 策略 A：已知类名后缀（DSH 当前版本）
      var sidebarA = document.querySelector('[class*="sidebarCol"]');
      var centerA = document.querySelector('[class*="centerCol"]');
      var detailsA = document.querySelector('[class*="detailsCol"]');
      if (sidebarA && centerA && detailsA) {
        return { frame: sidebarA.parentElement, sidebar: sidebarA, center: centerA, details: detailsA };
      }
      // 策略 B：解析 grid-template-columns，找含 minmax(0, 1fr) 的 grid + 3 个子元素
      var grids = document.querySelectorAll('div');
      for (var i = 0; i < grids.length; i++) {
        var g = grids[i];
        var style = window.getComputedStyle ? window.getComputedStyle(g) : null;
        if (!style || style.display !== 'grid') continue;
        // 必须是 3 列 grid
        var cols = style.gridTemplateColumns;
        if (!cols) continue;
        var parts = cols.split(/\s+/);
        if (parts.length !== 3) continue;
        // 中间一列必须是 minmax(0, 1fr) 这种弹性单位
        if (!/minmax\(0,\s*1fr\)|1fr/.test(parts[1])) continue;
        var kids = Array.from(g.children);
        if (kids.length < 3) continue;
        // 按 grid-column 隐式分配：第一个是 sidebar，中间是 center，最后是 details
        return { frame: g, sidebar: kids[0], center: kids[1], details: kids[2] };
      }
      return null;
    }

    /** 找到 conversation 列元素（4 层 fallback）。返回 null 表示完全没找到。 */
    function findConversationPane() {
      // L1: 自己或外部已种的 data-pane="conversation"
      var l1 = document.querySelector('[' + SHIM_PANE_ATTR + '="' + SHIM_PANE_VALUE + '"]');
      if (l1) return { el: l1, layer: "L1" };
      // L2: CSS Module 类名后缀（DSH 当前版本：pI_x6G_centerCol）
      var l2 = document.querySelector('[class*="centerCol"]');
      if (l2) return { el: l2, layer: "L2" };
      // L3: grid 中间列（不依赖 class 名）
      var trip = discoverFrameTriptych();
      if (trip && trip.center) return { el: trip.center, layer: "L3" };
      // L4: 保底，未来 DSH 可能自加 data-pane-shell="conversation"——目前没找到元素
      return { el: null, layer: "L4-miss" };
    }

    /** 在元素上种属性（已种则跳过）。 */
    function stampIfMissing(el, name, value) {
      if (!el) return false;
      if (el.getAttribute && el.getAttribute(name) === value) return false;
      el.setAttribute(name, value);
      return true;
    }

    /** 应用 self-shim：找到 conversation 列并种 data-pane 属性。返回解析层（用于诊断）。 */
    function applyShellShim() {
      var found = findConversationPane();
      if (!found.el) {
        if (typeof console !== "undefined" && console.debug) {
          console.debug("[dsh-ui-tweaks] shell shim: 0 strategies matched — conversation column not found");
        }
        return null;
      }
      // 1) 给 conversation 列种 data-pane
      stampIfMissing(found.el, SHIM_PANE_ATTR, SHIM_PANE_VALUE);
      // 2) 顺便给整个 AppFrame 也种一下（L4 兜底，同时方便其它插件识别）
      var trip = discoverFrameTriptych();
      if (trip) {
        if (trip.frame) stampIfMissing(trip.frame, SHELL_FRAME_ATTR, SHELL_FRAME_VALUE);
        if (trip.sidebar) stampIfMissing(trip.sidebar, SHIM_PANE_ATTR, SHELL_SIDEBAR_ATTR_VALUE);
        if (trip.details) stampIfMissing(trip.details, SHIM_PANE_ATTR, SHELL_DETAILS_ATTR_VALUE);
      }
      if (typeof console !== "undefined" && console.debug) {
        console.debug("[dsh-ui-tweaks] shell shim resolved via " + found.layer);
      }
      return found;
    }

    /**
     * 启动 self-shim MutationObserver。DSH React 重渲会 unmount/remount
     * grid 子树，需要重新种属性。
     */
    function startShellShimObserver() {
      if (typeof MutationObserver === "undefined" || typeof document === "undefined") return;
      var observer = new MutationObserver(function () {
        // v0.5.5 patch：self-shim 重跑时顺便跑一次 chatflow 探测。
        // 原因：startChatflowMarksObserver 在 apply() 时如果 centerCol 还没
        //   渲染就会找不到 col 而静默失败，DSH React 后续渲染 centerCol
        //   时没人去探测 chatflow 容器。self-shim observer 启动早且观察
        //   body subtree，必然能捕获后续所有变化——是 chatflow 探测的兜底。
        // 配合 applyChatflowShiftMarks v0.5.5 幂等性：已是最优标记就跳过
        //   重打，不会破坏 v0.5.4 修过的"来回弹"循环。
        applyShellShim();
        applyChatflowShiftMarks();
      });
      try {
        observer.observe(document.body, { childList: true, subtree: true });
      } catch (e) {
        // 静默：极端情况下（如 document.body 还没准备好）不报错
      }
      return observer;
    }

