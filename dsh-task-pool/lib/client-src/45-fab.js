    // ===== fab =====
    // ===== FAB 图标（精确居中） =====
    var FAB_ICON_CLOSED = '<svg viewBox="0 0 16 16" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.25" y="3.25" width="9.5" height="9.5" rx="1.5"/><path d="M8 5.75v4.5M5.75 8h4.5"/></svg>';
    var FAB_ICON_OPEN = '<svg viewBox="0 0 16 16" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>';

    function mountFab(controller) {
      var fab = document.createElement("button");
      fab.type = "button";
      fab.dataset.dshTaskpoolFab = "";
      fab.className = "DTPD_fab";
      fab.setAttribute("aria-label", "任务池");

      function renderState() {
        var snap = controller.getSnapshot();
        if (snap.drawerOpen) {
          fab.dataset.state = "open";
          fab.innerHTML = FAB_ICON_OPEN;
        } else {
          fab.dataset.state = "closed";
          fab.innerHTML = FAB_ICON_CLOSED;
        }
        if (snap.pinned) fab.dataset.pinned = "true";
        else delete fab.dataset.pinned;
      }

      fab.addEventListener("click", function () { controller.toggleDrawer(); });

      var unsub = controller.subscribe(renderState);
      renderState();
      document.body.appendChild(fab);

      return function () {
        unsub();
        fab.remove();
      };
    }

