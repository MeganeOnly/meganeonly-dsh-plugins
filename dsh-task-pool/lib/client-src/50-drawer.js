    // ===== drawer =====
    // ===== Right drawer mount =====
    function mountRightDrawer(controller) {
      var container, viewHandle;

      function ensure() {
        if (container) return;
        container = document.createElement("aside");
        container.dataset.dshTaskpoolDrawer = "";
        document.body.appendChild(container);
        viewHandle = renderDrawerView(container, controller);
      }

      // 枚举所有已知的 panel drawer attr；isOtherDrawerOpen 检查"还有没有别的 panel 抽屉打开"。
      // 新增面板时在这里加一行（保持原 panel attr 列表是协议的真实源）。
      var KNOWN_DRAWER_ATTRS = [
        "data-dsh-taskpool-drawer-open",
        "data-dsh-github-drawer-open",
        "data-dsh-ssh-active",
        "data-dsh-taskboard-active",
      ];
      function isOtherDrawerOpen(selfAttr) {
        for (var i = 0; i < KNOWN_DRAWER_ATTRS.length; i++) {
          if (KNOWN_DRAWER_ATTRS[i] === selfAttr) continue;
          if (document.documentElement.hasAttribute(KNOWN_DRAWER_ATTRS[i])) return true;
        }
        return false;
      }

      function applyOpen() {
        if (controller.getSnapshot().drawerOpen) {
          document.documentElement.removeAttribute("data-dsh-ssh-active");
          document.documentElement.removeAttribute("data-dsh-taskboard-active");
          document.documentElement.setAttribute(DRAWER_ATTR, "");
          // 设 CSS 变量 --active-drawer-width = 自己抽屉宽度（用于 FAB 让位公式）
          document.documentElement.style.setProperty("--active-drawer-width", DRAWER_WIDTH + "px");
          // 检查是否还有别的 panel 抽屉打开 → 没有才设统一 attr
          // （互斥协议下理论上此时不该有别的抽屉，但防御性检查避免重复设）
          if (!isOtherDrawerOpen(DRAWER_ATTR)) {
            document.documentElement.setAttribute(ANY_DRAWER_ATTR, "");
          }
          document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: PANEL_NAME }));
        } else {
          document.documentElement.removeAttribute(DRAWER_ATTR);
          // 关键修复 v0.5.6：检查是否还有别的 panel 抽屉打开（互斥协议 race condition）。
          // 场景：抽屉 A 打开 → 用户点 B → B applyOpen(open) 先设自己 attr + 移除 A attr，
          // dispatch event 触发 A applyOpen(close)。此时 B 抽屉仍开着，A 关闭分支必须
          // 不能移除统一 attr + CSS 变量——否则 FAB 让位状态会瞬间错乱。
          // 只有 isOtherDrawerOpen 为 false 时（即真的没有任何抽屉打开）才清理。
          if (!isOtherDrawerOpen(DRAWER_ATTR)) {
            document.documentElement.removeAttribute(ANY_DRAWER_ATTR);
            document.documentElement.style.removeProperty("--active-drawer-width");
          }
        }
      }
      function onOtherActivate(e) {
        if (!controller.getSnapshot().drawerOpen) return;
        if (e && e.detail && e.detail !== PANEL_NAME) controller.closeDrawer();
      }

      function onClickOutside(e) {
        if (!controller.getSnapshot().drawerOpen) return;
        var t = e.target;
        if (!t) return;
        if (container && container.contains(t)) return;
        if (t.closest && t.closest('[data-dsh-taskpool-fab]')) return;
        var SIDEBAR_ROW_SELECTOR = '[class*="sessionRow"], [class*="projectRow"], [class*="searchResultRow"], [class*="searchResultWorkspace"], [class*="newSession"]';
        if (t.closest && t.closest(SIDEBAR_ROW_SELECTOR)) {
          controller.closeDrawer();
        }
      }

      var waitObserver = new MutationObserver(ensure);
      waitObserver.observe(document.body, { childList: true, subtree: true });
      document.addEventListener("click", onClickOutside, true);
      document.addEventListener(ACTIVATE_EVENT, onOtherActivate);
      var unsub = controller.subscribe(applyOpen);
      applyOpen();
      ensure();

      return function () {
        document.removeEventListener("click", onClickOutside, true);
        document.removeEventListener(ACTIVATE_EVENT, onOtherActivate);
        waitObserver.disconnect();
        unsub();
        document.documentElement.removeAttribute(DRAWER_ATTR);
        if (viewHandle && viewHandle.dispose) viewHandle.dispose();
        if (container) { container.remove(); container = undefined; }
      };
    }

