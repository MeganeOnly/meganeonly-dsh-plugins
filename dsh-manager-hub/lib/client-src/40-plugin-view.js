    // ===== 插件视图 =====
    function pluginMatches(e, q) {
      if (!q) return true;
      var hay = String(e.id) + " " + String(e.name) + " " + String(e.author || "");
      return hay.toLowerCase().indexOf(q.toLowerCase()) !== -1;
    }

    /** 判定是否预设组件行（name 为 ./.mjs 相对路径，来自 agent 预设组合）。 */
    function isPresetMjs(e) {
      if (e && e.presetMjs === true) return true;
      return typeof e.name === "string" && e.name.indexOf("./") === 0 && e.name.slice(-4) === ".mjs";
    }

    function PluginManagerPage() {
      var loading = React.useState(true);
      var entries = React.useState([]);
      var error = React.useState(null);
      var notice = React.useState(null);
      var query = React.useState("");
      var open = React.useState({ enabled: true, paused: true, system: true, preset: true });
      var setLoading = loading[1];
      var setEntries = entries[1];
      var setError = error[1];
      var setNotice = notice[1];
      var setQuery = query[1];
      var setOpen = open[1];

      var load = React.useCallback(function () {
        setLoading(true);
        setError(null);
        fetch(API_PLUGIN + "/list")
          .then(function (res) {
            if (!res.ok) throw new Error("插件管理服务不可用（HTTP " + res.status + "）");
            return res.json();
          })
          .then(function (data) {
            if (!data.ok) throw new Error(data.error || "list failed");
            setEntries(data.entries);
            setLoading(false);
          })
          .catch(function (e) {
            setError(String((e && e.message) || e));
            setLoading(false);
          });
      }, []);

      React.useEffect(function () { load(); }, [load]);

      var toggle = React.useCallback(function (entry) {
        setNotice(null);
        setError(null);
        fetch(API_PLUGIN + "/set-enabled", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: entry.id, enabled: !entry.enabled })
        })
          .then(function (res) {
            if (!res.ok) throw new Error("插件管理服务不可用（HTTP " + res.status + "）");
            return res.json();
          })
          .then(function (data) {
            if (!data.ok) throw new Error(data.error || "failed");
            setEntries(entries[0].map(function (e) {
              return e.id === entry.id ? { id: e.id, name: e.name, author: e.author, enabled: data.enabled, phase: e.phase, system: e.system } : e;
            }));
            setNotice("插件 " + entry.id + " 已" + (data.enabled ? "启用" : "暂停") + "。配置已写入 cordis.patch.yml，重启 DSH 后生效。");
          })
          .catch(function (e) {
            setError(String((e && e.message) || e));
          });
      }, [entries]);

      var toggleSection = React.useCallback(function (key) {
        setOpen(Object.assign({}, open[0], { [key]: !open[0][key] }));
      }, [open]);

      var all = entries[0];
      var q = query[0];
      var userRows = all.filter(function (e) { return !e.system && pluginMatches(e, q); });
      var presetRows = userRows.filter(function (e) { return isPresetMjs(e); });
      var regRows = userRows.filter(function (e) { return !isPresetMjs(e); });
      var enabledRows = regRows.filter(function (e) { return e.enabled; });
      var pausedRows = regRows.filter(function (e) { return !e.enabled; });
      var sysRows = all.filter(function (e) { return e.system && pluginMatches(e, q); });

      var renderRow = function (e, canToggle, index) {
        var mine = e.author === MINE_AUTHOR;
        var preset = isPresetMjs(e);
        var metaBits = [];
        if (e.author) metaBits.push("作者：" + e.author);
        if (e.phase) metaBits.push(e.phase);
        var displayName = (typeof e.name === "string" && e.name !== "") ? e.name : e.id;
        var rowStyle = mine ? Object.assign({}, S.row, { borderLeft: "3px solid rgba(74,222,128,0.8)", background: "rgba(74,222,128,0.08)", borderRadius: "6px", paddingLeft: "10px" }) : S.row;
        return React.createElement(
          "div",
          { key: String(e.id) + "-" + index, style: rowStyle },
          React.createElement(
            "div",
            { style: { flex: 1, minWidth: 0 } },
            React.createElement(
              "div",
              { style: mine ? S.mineTitle : null, title: "id: " + String(e.id) },
              displayName,
              preset ? React.createElement("span", { style: S.presetBadge }, "预设") : null,
              mine ? React.createElement("span", { style: S.mineBadge }, "我的") : null
            ),
            React.createElement(
              "div",
              { style: S.dim },
              metaBits.length > 0 ? metaBits.join(" · ") : ""
            )
          ),
          canToggle
            ? React.createElement("button", { style: S.btn, onClick: function () { toggle(e); } }, e.enabled ? "暂停" : "启用")
            : React.createElement("span", { style: S.dim }, preset ? "随会话预设加载，不可在此启停" : "不可在此启停")
        );
      };

      var renderSection = function (key, title, rows, canToggle, note) {
        if (rows.length === 0) return null;
        var expanded = open[0][key];
        return React.createElement(
          "div",
          { key: key, style: { marginTop: "6px" } },
          React.createElement(
            "div",
            { style: S.secHeader, onClick: function () { toggleSection(key); }, title: expanded ? "点击收起" : "点击展开" },
            React.createElement("span", { style: S.chevron }, expanded ? "▾" : "▸"),
            React.createElement("span", null, title),
            React.createElement("span", { style: S.countPill }, String(rows.length))
          ),
          expanded
            ? React.createElement(
                "div",
                null,
                note ? React.createElement("div", { key: key + "-note", style: S.dim }, note) : null,
                rows.map(function (e, i) { return renderRow(e, canToggle, i); })
              )
            : null
        );
      };

      var hasAny = enabledRows.length + pausedRows.length + presetRows.length + sysRows.length > 0;

      return React.createElement(
        "div",
        null,
        notice[0] !== null ? React.createElement("div", { style: S.okStyle }, notice[0]) : null,
        error[0] !== null ? React.createElement("div", { style: S.errStyle }, error[0]) : null,
        loading[0]
          ? React.createElement("div", { style: S.dim }, "加载中…")
          : React.createElement(
              "div",
              null,
              React.createElement("input", {
                type: "search",
                value: q,
                onChange: function (ev) { setQuery(ev.target.value); },
                placeholder: "搜索插件名称 / 作者",
                style: S.searchStyle
              }),
              renderSection("enabled", "启用中", enabledRows, true),
              renderSection("paused", "暂停中", pausedRows, true),
              renderSection("preset", "预设组件（.mjs）", presetRows, false, "这些是当前会话所选预设（如梁神模式）的组合组件，随预设自动加载/卸载，不能在这里启停。"),
              renderSection("system", "系统插件（不可在此启停）", sysRows, false),
              !hasAny ? React.createElement("div", { style: S.dim }, "无匹配插件") : null,
              React.createElement("div", { style: { marginTop: "12px" } },
                React.createElement("button", { style: S.btn, onClick: function () { load(); } }, "刷新"))
            )
      );
    }

