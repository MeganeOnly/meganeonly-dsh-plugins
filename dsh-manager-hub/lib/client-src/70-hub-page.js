    // ===== Hub 页面 =====
    // 三个子 tab 由 plugin-manager /list 的 enabled 字段统一判定：
    // - plugin tab 自身依赖 plugin-manager（404 视为 hub 失去支点）
    // - skill / mcp tab 对应条目 plugin-manager 报告 enabled=false 时隐藏
    //   （用户可在 plugin-manager 页暂停它们，恢复需重启 DSH——manager-hub
    //    只显示当前可用入口，行为与子插件反向隐藏 manager-hub 的设置页条目一致）
    function ManagerHubPage() {
      var active = React.useState("plugin");
      var avail = React.useState(null);
      var setActive = active[1];
      var setAvail = avail[1];

      React.useEffect(function () {
        fetch(API_PLUGIN + "/list")
          .then(function (res) {
            // plugin-manager 自身不在（404 / 网络失败）：所有 tab 不可用
            if (res.status === 404) {
              setAvail({ plugin: false, skill: false, mcp: false });
              throw new Error("plugin-manager not available");
            }
            return res.json();
          })
          .then(function (data) {
            if (!data || !data.ok || !Array.isArray(data.entries)) throw new Error("invalid list payload");
            // 把 plugin-manager 列表里三个 id 的 enabled 映射到 avail
            var next = { plugin: true }; // plugin-manager 存在即 plugin tab 可用
            for (var i = 0; i < data.entries.length; i++) {
              var e = data.entries[i];
              if (!e || typeof e.id !== "string") continue;
              if (e.id === "skill-manager") next.skill = e.enabled === true;
              if (e.id === "mcp-manager") next.mcp = e.enabled === true;
            }
            setAvail(next);
          })
          .catch(function () {
            // 已设置过的不覆盖（避免被 catch 路径二次重置）
            setAvail(function (a) { return a !== null ? a : { plugin: false, skill: false, mcp: false }; });
          });
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

