    // ===== Hub 页面 =====
    function ManagerHubPage() {
      var active = React.useState("plugin");
      var avail = React.useState(null);
      var setActive = active[1];
      var setAvail = avail[1];

      // [perf] 挂载时只探测默认 tab（"plugin"）；其他 tab 切到时再按需探测，
      // 避免首屏 3 个全量 /list GET——默认 tab 自身 useEffect 已经在拉数据。
      // 兜底：用户切到某个 tab 时若该 tab 没探测过，再探一次确认是否可用。
      React.useEffect(function () {
        var defaultTab = TABS[0];
        fetch(defaultTab.api + "/list")
          .then(function (res) { setAvail(function (a) { var n = Object.assign({}, a || {}); n[defaultTab.id] = res.status !== 404; return n; }); })
          .catch(function () { setAvail(function (a) { var n = Object.assign({}, a || {}); n[defaultTab.id] = true; return n; }); });
        // 其余 tab 乐观显示为可用：用户切到时由子组件 useEffect 拉数据（失败则显示错误）
        var others = {};
        for (var i = 1; i < TABS.length; i++) others[TABS[i].id] = true;
        setAvail(function (a) { return Object.assign({}, a || {}, others); });
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

