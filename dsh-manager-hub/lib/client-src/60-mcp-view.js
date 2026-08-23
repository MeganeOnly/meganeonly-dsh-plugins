    // ===== MCP 视图 =====
    var STATUS_META = {
      connected: { label: "已连接", color: "#4ade80", bg: "rgba(74,222,128,0.16)" },
      "no-tools": { label: "已连接 · 无工具", color: "#a3e635", bg: "rgba(163,230,53,0.16)" },
      connecting: { label: "连接中…", color: "#fbbf24", bg: "rgba(251,191,36,0.16)" },
      failed: { label: "连接失败", color: "#f87171", bg: "rgba(248,113,113,0.16)" },
      stopped: { label: "未运行", color: "rgba(128,128,128,0.9)", bg: "rgba(128,128,128,0.15)" },
      disabled: { label: "已停用", color: "rgba(128,128,128,0.9)", bg: "rgba(128,128,128,0.15)" }
    };

    function mcpMatches(e, q) {
      if (!q) return true;
      var hay = String(e.serverName) + " " + String(e.id) + " " + String(e.endpoint) + " " + String(e.transport);
      for (var i = 0; i < e.tools.length; i++) hay += " " + String(e.tools[i].name);
      return hay.toLowerCase().indexOf(q.toLowerCase()) !== -1;
    }

    function McpManagerPage() {
      var loading = React.useState(true);
      var error = React.useState(null);
      var notice = React.useState(null);
      var query = React.useState("");
      var open = React.useState({ enabled: true, paused: true });
      var expanded = React.useState({});
      var pending = React.useState({});
      var data = React.useState([]);
      var setLoading = loading[1];
      var setError = error[1];
      var setNotice = notice[1];
      var setQuery = query[1];
      var setOpen = open[1];
      var setExpanded = expanded[1];
      var setPending = pending[1];
      var setData = data[1];

      var load = React.useCallback(function () {
        setLoading(true);
        setError(null);
        fetch(API_MCP + "/list")
          .then(function (res) {
            if (!res.ok) throw new Error("MCP 管理服务不可用（HTTP " + res.status + "）");
            return res.json();
          })
          .then(function (payload) {
            if (!payload.ok) throw new Error(payload.error || "list failed");
            setData(payload.entries);
            setPending({});
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
        fetch(API_MCP + "/set-enabled", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: entry.id, enabled: !entry.enabled })
        })
          .then(function (res) {
            if (!res.ok) throw new Error("MCP 管理服务不可用（HTTP " + res.status + "）");
            return res.json();
          })
          .then(function (result) {
            if (!result.ok) throw new Error(result.error || "failed");
            setData(data[0].map(function (e) {
              return e.id === entry.id ? Object.assign({}, e, { enabled: result.enabled }) : e;
            }));
            if (result.unchanged) {
              setNotice("MCP 服务器 " + entry.serverName + " 已处于" + (result.enabled ? "启用" : "停用") + "状态，未改动。");
            } else {
              setPending(Object.assign({}, pending[0], { [entry.id]: true }));
              setNotice("MCP 服务器 " + entry.serverName + " 已" + (result.enabled ? "启用" : "停用") + "。配置已写入 cordis.patch.yml，重启 DSH 后生效（连接与工具注册在启动时建立）。");
            }
          })
          .catch(function (e) {
            setError(String((e && e.message) || e));
          });
      }, [data, pending]);

      var toggleSection = React.useCallback(function (key) {
        setOpen(Object.assign({}, open[0], { [key]: !open[0][key] }));
      }, [open]);

      var toggleExpanded = React.useCallback(function (id) {
        setExpanded(Object.assign({}, expanded[0], { [id]: !expanded[0][id] }));
      }, [expanded]);

      var all = data[0];
      var q = query[0];
      var rows = all.filter(function (e) { return mcpMatches(e, q); });
      var enabledRows = rows.filter(function (e) { return e.enabled; });
      var pausedRows = rows.filter(function (e) { return !e.enabled; });

      var renderTools = function (e) {
        if (!expanded[0][e.id]) return null;
        if (e.toolCount === 0) {
          return React.createElement("div", { style: Object.assign({}, S.dim, { padding: "6px 6px 10px" }) },
            e.status === "connected" || e.status === "no-tools" ? "该服务器未提供任何工具。" : "工具清单在连接成功后出现；当前状态：" + (STATUS_META[e.status] ? STATUS_META[e.status].label : e.status) + "。");
        }
        return React.createElement(
          "div",
          { style: { padding: "2px 6px 10px", borderBottom: "1px dashed rgba(128,128,128,0.25)" } },
          e.tools.map(function (tool) {
            return React.createElement(
              "div",
              { key: tool.name, style: S.toolRow },
              React.createElement("span", { style: S.toolName, title: tool.name }, tool.name),
              React.createElement("span", { style: Object.assign({}, S.toolDesc, { flex: 1 }), title: String(tool.description) }, String(tool.description))
            );
          })
        );
      };

      var renderRow = function (e, index) {
        var meta = STATUS_META[e.status] || { label: e.status, color: "rgba(128,128,128,0.9)", bg: "rgba(128,128,128,0.15)" };
        var badge = Object.assign({}, S.statusBadge, { background: meta.bg, color: meta.color });
        var metaBits = ["id: " + e.id, e.transport === "stdio" ? "stdio 进程" : "HTTP"];
        if (e.phase) metaBits.push(e.phase);
        var authBits = e.auth.length > 0 ? e.auth : [];
        var isOpen = Boolean(expanded[0][e.id]);
        var rowStyle = e.enabled ? S.row : Object.assign({}, S.row, S.pauseStyle);
        var headStyle = { flex: 1, minWidth: 0, cursor: "pointer" };
        return React.createElement(
          "div",
          { key: String(e.id) + "-" + index },
          React.createElement(
            "div",
            { style: rowStyle },
            React.createElement(
              "div",
              { style: headStyle, onClick: function () { toggleExpanded(e.id); }, title: isOpen ? "点击收起工具清单" : "点击展开工具清单" },
              React.createElement(
                "div",
                null,
                React.createElement("span", { style: S.nameStyle }, e.serverName),
                React.createElement("span", { style: badge }, "● " + meta.label),
                React.createElement("span", { style: S.countPill, title: "已注册到工具目录的工具数量" }, e.toolCount + " 工具"),
                pending[0][e.id] || e.pendingRestart ? React.createElement("span", { style: S.restartBadge, title: "启停已写入 cordis.patch.yml，重启 DSH 后生效" }, "待重启") : null,
                React.createElement("span", { style: S.chevron }, isOpen ? " ▾" : " ▸")
              ),
              e.endpoint !== ""
                ? React.createElement("div", { style: S.descStyle, title: String(e.endpoint) }, String(e.endpoint))
                : null,
              React.createElement(
                "div",
                { style: S.dim },
                metaBits.join(" · ") + (authBits.length > 0 ? " · " + authBits.join(" · ") : "")
              )
            ),
            React.createElement("button", { style: S.btn, onClick: function (ev) { ev.stopPropagation(); toggle(e); } }, e.enabled ? "停用" : "启用")
          ),
          renderTools(e)
        );
      };

      var renderSection = function (key, title, rowsIn) {
        if (rowsIn.length === 0) return null;
        var sectionOpen = open[0][key];
        return React.createElement(
          "div",
          { key: key, style: { marginTop: "6px" } },
          React.createElement(
            "div",
            { style: S.secHeader, onClick: function () { toggleSection(key); }, title: sectionOpen ? "点击收起" : "点击展开" },
            React.createElement("span", { style: S.chevron }, sectionOpen ? "▾" : "▸"),
            React.createElement("span", null, title),
            React.createElement("span", { style: S.countPill }, String(rowsIn.length))
          ),
          sectionOpen ? React.createElement("div", null, rowsIn.map(function (e, i) { return renderRow(e, i); })) : null
        );
      };

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
                placeholder: "搜索服务器名 / 条目 id / 端点 / 工具名",
                style: S.searchStyle
              }),
              renderSection("enabled", "启用中", enabledRows),
              renderSection("paused", "已停用", pausedRows),
              enabledRows.length + pausedRows.length === 0 ? React.createElement("div", { style: S.dim }, "无匹配的 MCP 服务器。MCP 服务器在 web profile 的 cordis.patch.yml 里以 mcp-* 条目添加。") : null,
              React.createElement(
                "div",
                { style: { marginTop: "12px", display: "flex", alignItems: "center", gap: "12px" } },
                React.createElement("button", { style: S.btn, onClick: function () { load(); } }, "刷新"),
                React.createElement(
                  "span",
                  { style: S.dim },
                  "启停写入 cordis.patch.yml，重启 DSH 后生效；连接状态与工具清单为实时快照。"
                )
              ),
              React.createElement(
                "div",
                { style: Object.assign({}, S.dim, { marginTop: "8px" }) },
                "由 dsh-mcp-manager 提供 · 作者：MeganeOnly"
              )
            )
      );
    }

