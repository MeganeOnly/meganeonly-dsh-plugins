    // ===== Hub 页面 =====
    function ManagerHubPage() {
      var active = React.useState("plugin");
      var avail = React.useState(null);
      var setActive = active[1];
      var setAvail = avail[1];

      // 挂载时探测各管理插件 API：404（=对应插件停用）→ 隐藏该 tab。
      // 其余状态（200/405/网络错误）乐观显示，让对应视图自己呈现结果。
      React.useEffect(function () {
        var results = {};
        var pending = TABS.length;
        var done = function () {
          pending -= 1;
          if (pending === 0) setAvail(results);
        };
        for (var i = 0; i < TABS.length; i++) {
          (function (t) {
            fetch(t.api + "/list")
              .then(function (res) { results[t.id] = res.status !== 404; })
              .catch(function () { results[t.id] = true; })
              .then(done);
          })(TABS[i]);
        }
      }, []);

      var views = {
        plugin: PluginManagerPage,
        skill: SkillManagerPage,
        mcp: McpManagerPage
      };

      if (avail[0] === null) {
        return React.createElement("div", { style: S.dim }, "管理入口加载中…");
      }

      var visibleTabs = TABS.filter(function (t) { return avail[0][t.id] === true; });
      var current = null;
      // 用户选中的 tab 可用时优先呈现（active 初始为 "plugin"，默认落在插件页）；
      // 选中项不可用时回落到插件页，最后兜底第一个可见 tab。
      if (views[active[0]] !== undefined && avail[0][active[0]] === true) {
        current = active[0];
      } else if (avail[0]["plugin"] === true) {
        current = "plugin";
      } else if (visibleTabs.length > 0) {
        current = visibleTabs[0].id;
      }

      if (current === null) {
        return React.createElement(
          "div",
          null,
          React.createElement("div", { style: S.tabHint }, "插件 / Skill / MCP 管理服务均未启用，没有可聚合的管理入口。")
        );
      }

      var Current = views[current];
      return React.createElement(
        "div",
        null,
        React.createElement(
          "div",
          { style: S.tabBar },
          visibleTabs.map(function (t) {
            var isActive = t.id === current;
            return React.createElement(
              "button",
              {
                key: t.id,
                type: "button",
                style: isActive ? S.tabActive : S.tabBtn,
                onClick: function () { setActive(t.id); },
                title: "切换到" + t.label + "管理"
              },
              t.label
            );
          })
        ),
        React.createElement(
          "div",
          { style: { marginTop: "12px" } },
          React.createElement(Current, { key: current })
        ),
        React.createElement(
          "div",
          { style: S.tabHint },
          "聚合自 dsh-plugin-manager / dsh-skill-manager / dsh-mcp-manager · 作者：MeganeOnly"
        )
      );
    }

