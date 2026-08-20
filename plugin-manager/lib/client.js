/**
 * dsh-plugin-manager — 浏览器半端（web client bundle）
 *
 * 打包格式与官方社区插件一致：window.__ModuleLoader__.load({ id, factory })。
 * 依赖经 require() 取得（react 由 shell 模块表提供），其余全部走浏览器 fetch
 * 调用宿主 webServer 路由（与 dsh-pet 同款模式）。
 *
 * 界面：设置 → “插件管理”页。功能：
 *   - 搜索框：按插件 id / 名称 / 作者过滤（不区分大小写）；
 *   - 分组：启用中 / 暂停中（非系统插件）与系统插件 三组，组标题可点击收起/展开；
 *   - 作者为 MeganeOnly 的插件（本人所写）名字高亮加粗、整行描边并带“我的”标记；
 *   - 每行一个启/停按钮，写入后提示“重启 DSH 后生效”。
 */
window.__ModuleLoader__.load({
  id: "dsh-plugin-manager",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");
    var inject = ["slots"];

    var API = "/api/plugin-manager";
    var MINE_AUTHOR = "MeganeOnly";

    function matches(e, q) {
      if (!q) return true;
      var hay = String(e.id) + " " + String(e.name) + " " + String(e.author || "");
      return hay.toLowerCase().indexOf(q.toLowerCase()) !== -1;
    }

    function PluginManagerPage() {
      var loading = React.useState(true);
      var entries = React.useState([]);
      var error = React.useState(null);
      var notice = React.useState(null);
      var query = React.useState("");
      var open = React.useState({ enabled: true, paused: true, system: true });
      var setLoading = loading[1];
      var setEntries = entries[1];
      var setError = error[1];
      var setNotice = notice[1];
      var setQuery = query[1];
      var setOpen = open[1];

      var load = React.useCallback(function () {
        setLoading(true);
        setError(null);
        fetch(API + "/list")
          .then(function (res) { return res.json(); })
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
        fetch(API + "/set-enabled", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: entry.id, enabled: !entry.enabled })
        })
          .then(function (res) { return res.json(); })
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
      var mineTitle = { fontWeight: 700, color: "#4ade80" };
      var mineBadge = { marginLeft: "8px", fontSize: "11px", fontWeight: 700, padding: "1px 8px", borderRadius: "10px", background: "#4ade80", color: "#052e16", verticalAlign: "1px" };

      var all = entries[0];
      var q = query[0];
      var userRows = all.filter(function (e) { return !e.system && matches(e, q); });
      var enabledRows = userRows.filter(function (e) { return e.enabled; });
      var pausedRows = userRows.filter(function (e) { return !e.enabled; });
      var sysRows = all.filter(function (e) { return e.system && matches(e, q); });

      var renderRow = function (e, canToggle, index) {
        var mine = e.author === MINE_AUTHOR;
        var metaBits = [];
        if (e.author) metaBits.push("作者：" + e.author);
        if (e.phase) metaBits.push(e.phase);
        var displayName = (typeof e.name === "string" && e.name !== "") ? e.name : e.id;
        var rowStyle = mine ? Object.assign({}, row, { borderLeft: "3px solid rgba(74,222,128,0.8)", background: "rgba(74,222,128,0.08)", borderRadius: "6px", paddingLeft: "10px" }) : row;
        var nameStyle = mine ? { fontWeight: 700, color: "#4ade80", opacity: 1 } : null;
        return React.createElement(
          "div",
          { key: String(e.id) + "-" + index, style: rowStyle },
          React.createElement(
            "div",
            { style: { flex: 1, minWidth: 0 } },
            React.createElement(
              "div",
              { style: mine ? mineTitle : null, title: "id: " + String(e.id) },
              displayName,
              mine ? React.createElement("span", { style: mineBadge }, "我的") : null
            ),
            React.createElement(
              "div",
              { style: dim },
              metaBits.length > 0 ? metaBits.join(" · ") : ""
            )
          ),
          canToggle
            ? React.createElement("button", { style: btn, onClick: function () { toggle(e); } }, e.enabled ? "暂停" : "启用")
            : React.createElement("span", { style: dim }, "不可在此启停")
        );
      };

      var renderSection = function (key, title, rows, canToggle) {
        if (rows.length === 0) return null;
        var expanded = open[0][key];
        return React.createElement(
          "div",
          { key: key, style: { marginTop: "6px" } },
          React.createElement(
            "div",
            { style: secHeader, onClick: function () { toggleSection(key); }, title: expanded ? "点击收起" : "点击展开" },
            React.createElement("span", { style: chevron }, expanded ? "▾" : "▸"),
            React.createElement("span", null, title),
            React.createElement("span", { style: countPill }, String(rows.length))
          ),
          expanded
            ? React.createElement("div", null, rows.map(function (e, i) { return renderRow(e, canToggle, i); }))
            : null
        );
      };

      var hasAny = enabledRows.length + pausedRows.length + sysRows.length > 0;

      return React.createElement(
        "div",
        null,
        React.createElement("h3", { style: { marginTop: 0 } }, "插件管理"),
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
                placeholder: "搜索插件名称 / 作者",
                style: searchStyle
              }),
              renderSection("enabled", "启用中", enabledRows, true),
              renderSection("paused", "暂停中", pausedRows, true),
              renderSection("system", "系统插件（不可在此启停）", sysRows, false),
              !hasAny ? React.createElement("div", { style: dim }, "无匹配插件") : null,
              React.createElement("div", { style: { marginTop: "12px" } },
                React.createElement("button", { style: btn, onClick: function () { load(); } }, "刷新"))
            )
      );
    }

    function apply(ctx) {
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            id: "plugin-manager",
            order: 30,
            label: function () { return "插件管理"; }
          },
          PluginManagerPage
        );
      });
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});
