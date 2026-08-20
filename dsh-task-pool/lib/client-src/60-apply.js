    // ===== apply =====
    // ===== apply =====
    function apply(ctx) {
      injectCSS();
      var controller = new BoardController(
        new LocalStorageTaskStore(),
        { sessions: ctx.sessions }
      );
      controller.start();
      try {
        mountFab(controller);
        mountRightDrawer(controller);
      } catch (e) {
        console.error("[dsh-task-pool] mount failed:", e);
      }
    }
