    // ===== apply =====
    function apply(ctx) {
      injectCSS();
      var controller = new Controller(new LocalStorageStore(), { sessions: ctx.sessions });
      // 拉 config（不一定马上完成，但首屏按钮状态依赖 toolAvailable）
      controller.loadConfig();
      try {
        mountFab(controller);
        mountDrawer(controller);
      } catch (e) {
        console.error("[dsh-git-hub] mount failed:", e);
      }
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.name = "dsh-git-hub";
