/**
 * dsh-mcp-manager — 浏览器半端（web client bundle）
 *
 * 打包格式与官方社区插件一致：window.__ModuleLoader__.load({ id, factory })。
 * 依赖经 require() 取得（react 由 shell 模块表提供），其余全部走浏览器 fetch
 * 调用宿主 webServer 路由（与 plugin-manager / skill-manager 同款模式）。
 *
 * 界面：设置 → “MCP 管理”页（紧跟“Skill 管理”之后）。功能：
 *   - 搜索框：按服务器名 / 条目 id / 端点 / 工具名过滤（不区分大小写）；
 *   - 分组：启用中 / 已停用，组标题可点击收起/展开；
 *   - 每行展示 服务器名 + 连接状态徽章 + 工具数 + 端点 + id/传输方式
 *     （呈现方式参考 ZCode 的 /mcp 列表：名称 + 状态 + 工具清单）；
 *   - 点击行展开该服务器的工具清单（mcp__<server>__<tool> 名称 + 描述）；
 *   - 每行一个启/停按钮；写入 cordis.patch.yml 后提示“重启 DSH 后生效”，
 *     行内显示“待重启”徽章；
 *   - 凭据（Authorization / env）只显示键名与形态，值不出宿主进程。
 */
window.__ModuleLoader__.load({
  id: "dsh-mcp-manager",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");
    var inject = ["slots"];

    var API = "/api/mcp-manager";

    var STATUS_META = {
      connected: { label: "已连接", color: "#4ade80", bg: "rgba(74,222,128,0.16)" },
      "no-tools": { label: "已连接 · 无工具", color: "#a3e635", bg: "rgba(163,230,53,0.16)" },
      connecting: { label: "连接中…", color: "#fbbf24", bg: "rgba(251,191,36,0.16)" },
      failed: { label: "连接失败", color: "#f87171", bg: "rgba(248,113,113,0.16)" },
      stopped: { label: "未运行", color: "rgba(128,128,128,0.9)", bg: "rgba(128,128,128,0.15)" },
      disabled: { label: "已停用", color: "rgba(128,128,128,0.9)", bg: "rgba(128,128,128,0.15)" }
    };

    function matches(e, q) {
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
        fetch(API + "/list")
          .then(function (res) { return res.json(); })
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
        fetch(API + "/set-enabled", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: entry.id, enabled: !entry.enabled })
        })
          .then(function (res) { return res.json(); })
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

      var row = { display: "flex", alignItems: "center", gap: "12px", padding: "10px 4px", borderBottom: "1px solid rgba(128,128,128,0.2)" };
      var dim = { opacity: 0.6, fontSize: "12px", marginTop: "2px" };
      var btn = { padding: "4px 14px", borderRadius: "6px", border: "1px solid rgba(128,128,128,0.4)", background: "transparent", cursor: "pointer" };
      var msg = { padding: "8px 12px", borderRadius: "6px", marginBottom: "8px", fontSize: "13px" };
      var okStyle = Object.assign({ background: "rgba(40,167,69,0.15)", color: "#1e7e34" }, msg);
      var errStyle = Object.assign({ background: "rgba(220,53,69,0.12)", color: "#b02a37" }, msg);
      var searchStyle = { width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: "6px", border: "1px solid rgba(128,128,128,0.35)", background: "rgba(128,128,128,0.08)", color: "inherit", fontSize: "13px", outline: "none", marginBottom: "12px" };
      var secHeader = { display: "flex", alignItems: "center", gap: "6px", padding: "9px 6px", cursor: "pointer", userSelect: "none", borderRadius: "6px", borderBottom: "1px solid rgba(128,128,128,0.18)", fontWeight: 600, fontSize: "13px" };
      var chevron = { display: "inline-block", width: "14px", fontSize: "11px", color: "rgba(128,128,128,0.9)" };
      var countPill = { marginLeft: "2px", fontSize: "11px", fontWeight: 400, color: "rgba(128,128,128,0.9)", background: "rgba(128,128,128,0.15)", borderRadius: "9px", padding: "0 7px", lineHeight: "16px" };
      var descStyle = { marginTop: "2px", fontSize: "12px", opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
      var nameStyle = { fontWeight: 600 };
      var statusBadge = { marginLeft: "8px", fontSize: "11px", fontWeight: 600, padding: "1px 8px", borderRadius: "10px", verticalAlign: "1px", whiteSpace: "nowrap" };
      var restartBadge = { marginLeft: "6px", fontSize: "10px", fontWeight: 600, padding: "0 6px", borderRadius: "8px", background: "rgba(255,193,7,0.25)", color: "#8a6d00", verticalAlign: "1px" };
      var pauseStyle = { opacity: 0.55 };
      var toolRow = { display: "flex", alignItems: "baseline", gap: "10px", padding: "4px 6px", fontSize: "12px" };
      var toolName = { fontFamily: "var(--ds-font-family-code, monospace)", fontSize: "12px", opacity: 0.85, whiteSpace: "nowrap" };
      var toolDesc = { opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 };

      var all = data[0];
      var q = query[0];
      var rows = all.filter(function (e) { return matches(e, q); });
      var enabledRows = rows.filter(function (e) { return e.enabled; });
      var pausedRows = rows.filter(function (e) { return !e.enabled; });

      var renderTools = function (e) {
        if (!expanded[0][e.id]) return null;
        if (e.toolCount === 0) {
          return React.createElement("div", { style: Object.assign({}, dim, { padding: "6px 6px 10px" }) },
            e.status === "connected" || e.status === "no-tools" ? "该服务器未提供任何工具。" : "工具清单在连接成功后出现；当前状态：" + (STATUS_META[e.status] ? STATUS_META[e.status].label : e.status) + "。");
        }
        return React.createElement(
          "div",
          { style: { padding: "2px 6px 10px", borderBottom: "1px dashed rgba(128,128,128,0.25)" } },
          e.tools.map(function (tool) {
            return React.createElement(
              "div",
              { key: tool.name, style: toolRow },
              React.createElement("span", { style: toolName, title: tool.name }, tool.name),
              React.createElement("span", { style: Object.assign({}, toolDesc, { flex: 1 }), title: String(tool.description) }, String(tool.description))
            );
          })
        );
      };

      var renderRow = function (e, index) {
        var meta = STATUS_META[e.status] || { label: e.status, color: "rgba(128,128,128,0.9)", bg: "rgba(128,128,128,0.15)" };
        var badge = Object.assign({}, statusBadge, { background: meta.bg, color: meta.color });
        var metaBits = ["id: " + e.id, e.transport === "stdio" ? "stdio 进程" : "HTTP"];
        if (e.phase) metaBits.push(e.phase);
        var authBits = e.auth.length > 0 ? e.auth : [];
        var isOpen = Boolean(expanded[0][e.id]);
        var rowStyle = e.enabled ? row : Object.assign({}, row, pauseStyle);
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
                React.createElement("span", { style: nameStyle }, e.serverName),
                React.createElement("span", { style: badge }, "● " + meta.label),
                React.createElement("span", { style: countPill, title: "已注册到工具目录的工具数量" }, e.toolCount + " 工具"),
                pending[0][e.id] || e.pendingRestart ? React.createElement("span", { style: restartBadge, title: "启停已写入 cordis.patch.yml，重启 DSH 后生效" }, "待重启") : null,
                React.createElement("span", { style: chevron }, isOpen ? " ▾" : " ▸")
              ),
              e.endpoint !== ""
                ? React.createElement("div", { style: descStyle, title: String(e.endpoint) }, String(e.endpoint))
                : null,
              React.createElement(
                "div",
                { style: dim },
                metaBits.join(" · ") + (authBits.length > 0 ? " · " + authBits.join(" · ") : "")
              )
            ),
            React.createElement("button", { style: btn, onClick: function (ev) { ev.stopPropagation(); toggle(e); } }, e.enabled ? "停用" : "启用")
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
            { style: secHeader, onClick: function () { toggleSection(key); }, title: sectionOpen ? "点击收起" : "点击展开" },
            React.createElement("span", { style: chevron }, sectionOpen ? "▾" : "▸"),
            React.createElement("span", null, title),
            React.createElement("span", { style: countPill }, String(rowsIn.length))
          ),
          sectionOpen ? React.createElement("div", null, rowsIn.map(function (e, i) { return renderRow(e, i); })) : null
        );
      };

      return React.createElement(
        "div",
        null,
        React.createElement("h3", { style: { marginTop: 0 } }, "MCP 管理"),
        notice[0] !== null ? React.createElement("div", { style: okStyle }, notice[0]) : null,
        error[0] !== null ? React.createElement("div", { style: errStyle }, error[0]) : null,
        loading[0]
          ? React.createElement("div", { style: dim }, "加载中…")
          : React.createElement(
              "div",
              null,
              React.createElement("input", {
                type: "search",
                value: q,
                onChange: function (ev) { setQuery(ev.target.value); },
                placeholder: "搜索服务器名 / 条目 id / 端点 / 工具名",
                style: searchStyle
              }),
              renderSection("enabled", "启用中", enabledRows),
              renderSection("paused", "已停用", pausedRows),
              enabledRows.length + pausedRows.length === 0 ? React.createElement("div", { style: dim }, "无匹配的 MCP 服务器。MCP 服务器在 web profile 的 cordis.patch.yml 里以 mcp-* 条目添加。") : null,
              React.createElement(
                "div",
                { style: { marginTop: "12px", display: "flex", alignItems: "center", gap: "12px" } },
                React.createElement("button", { style: btn, onClick: function () { load(); } }, "刷新"),
                React.createElement(
                  "span",
                  { style: dim },
                  "启停写入 cordis.patch.yml，重启 DSH 后生效；连接状态与工具清单为实时快照。"
                )
              ),
              React.createElement(
                "div",
                { style: Object.assign({}, dim, { marginTop: "8px" }) },
                "由 dsh-mcp-manager 提供 · 作者：MeganeOnly"
              )
            )
      );
    }

    function apply(ctx) {
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            id: "mcp-manager",
            order: 32,
            label: function () { return "MCP 管理"; }
          },
          McpManagerPage
        );
      });
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});
