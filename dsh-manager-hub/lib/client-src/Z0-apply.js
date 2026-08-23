    // ===== apply =====
    function apply(ctx) {
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            id: "manager-hub",
            order: 30,
            label: function () { return "管理"; }
          },
          ManagerHubPage
        );
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.name = "dsh-manager-hub";
