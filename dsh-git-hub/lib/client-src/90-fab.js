    // ===== FAB =====
    var FAB_ICON_CLOSED = '<svg viewBox="0 0 16 16" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 5.5v5M5.5 8h5"/></svg>';
    var FAB_ICON_OPEN = '<svg viewBox="0 0 16 16" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>';

    function mountFab(controller) {
      var fab = document.createElement("button");
      fab.type = "button";
      fab.dataset.dshGithubFab = "";
      fab.className = "DGH_fab";
      fab.setAttribute("aria-label", "Git/GitHub 管理");

      function render() {
        var snap = controller.getSnapshot();
        if (snap.drawerOpen) {
          fab.dataset.state = "open";
          fab.innerHTML = FAB_ICON_OPEN;
        } else {
          fab.dataset.state = "closed";
          fab.innerHTML = FAB_ICON_CLOSED;
        }
      }

      fab.addEventListener("click", function () { controller.toggleDrawer(); });
      var unsub = controller.subscribe(render);
      render();
      document.body.appendChild(fab);

      return function () {
        unsub();
        fab.remove();
      };
    }

