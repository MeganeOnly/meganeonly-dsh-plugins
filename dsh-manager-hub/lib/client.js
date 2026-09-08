/**
 * dsh-manager-hub — 浏览器半端（web client bundle）
 *
 * 打包格式与官方社区插件一致：window.__ModuleLoader__.load({ id, factory })。
 * 依赖经 require() 取得（react 由 shell 模块表提供），其余全部走浏览器 fetch
 * 调用三个独立管理插件的宿主 webServer 路由。
 *
 * 界面：设置 → “管理”页（唯一入口，聚合原 插件管理 / Skill 管理 / MCP 管理 三页）。
 *   - 顶部 tab：插件（默认）/ Skill / MCP，切换显示的三个管理视图；
 *   - 三个视图分别调用 /api/plugin-manager、/api/skill-manager、/api/mcp-manager；
 *   - 视图逻辑来自三个独立插件（plugin-manager / skill-manager / mcp-manager），
 *     本插件只做 UI 聚合，不重复任何宿主逻辑；
 *   - tab 按服务可用性条件显示：某管理插件被停用（其 API 返回 404）时，对应 tab
 *     自动隐藏；重新启用后刷新页面即恢复显示。其余 tab 不受影响。
 *
 * 与其他三个管理插件的关系：
 *   - 三个插件各自的设置页条目（插件管理 / Skill 管理 / MCP 管理）在本插件
 *     （settings.section id=manager-hub）存在时自动隐藏——由那三个插件的客户端
 *     监听 settings.section 注册变更实现；
 *   - 本插件被停用时，三个独立管理页自动恢复为兜底入口，管理能力不丢失。
 */
window.__ModuleLoader__.load({
  id: "dsh-manager-hub",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");
    var inject = ["slots"];

    // ===== 常量 =====
    var API_PLUGIN = "/api/plugin-manager";
    var API_SKILL = "/api/skill-manager";
    var API_MCP = "/api/mcp-manager";
    var MINE_AUTHOR = "MeganeOnly";

    var TABS = [
      { id: "plugin", label: "插件", api: API_PLUGIN },
      { id: "skill", label: "Skill", api: API_SKILL },
      { id: "mcp", label: "MCP", api: API_MCP }
    ];

    // ===== 样式 =====
    var S = {
      row: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 4px", borderBottom: "1px solid rgba(128,128,128,0.2)" },
      dim: { opacity: 0.6, fontSize: "12px", marginTop: "2px" },
      btn: { padding: "4px 14px", borderRadius: "6px", border: "1px solid rgba(128,128,128,0.4)", background: "transparent", cursor: "pointer" },
      msg: { padding: "8px 12px", borderRadius: "6px", marginBottom: "8px", fontSize: "13px" },
      searchStyle: { width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: "6px", border: "1px solid rgba(128,128,128,0.35)", background: "rgba(128,128,128,0.08)", color: "inherit", fontSize: "13px", outline: "none", marginBottom: "12px" },
      secHeader: { display: "flex", alignItems: "center", gap: "6px", padding: "9px 6px", cursor: "pointer", userSelect: "none", borderRadius: "6px", borderBottom: "1px solid rgba(128,128,128,0.18)", fontWeight: 600, fontSize: "13px" },
      chevron: { display: "inline-block", width: "14px", fontSize: "11px", color: "rgba(128,128,128,0.9)" },
      countPill: { marginLeft: "2px", fontSize: "11px", fontWeight: 400, color: "rgba(128,128,128,0.9)", background: "rgba(128,128,128,0.15)", borderRadius: "9px", padding: "0 7px", lineHeight: "16px" },
      mineTitle: { fontWeight: 700, color: "#4ade80" },
      mineBadge: { marginLeft: "8px", fontSize: "11px", fontWeight: 700, padding: "1px 8px", borderRadius: "10px", background: "#4ade80", color: "#052e16", verticalAlign: "1px" },
      presetBadge: { marginLeft: "8px", fontSize: "11px", fontWeight: 700, padding: "1px 8px", borderRadius: "10px", background: "rgba(125,211,252,0.25)", color: "#0c4a6e", verticalAlign: "1px" },
      shadowBadge: { marginLeft: "6px", fontSize: "10px", fontWeight: 600, padding: "0 6px", borderRadius: "8px", background: "rgba(255,193,7,0.25)", color: "#8a6d00", verticalAlign: "1px" },
      descStyle: { marginTop: "2px", fontSize: "12px", opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
      pauseStyle: { opacity: 0.55 },
      nameStyle: { fontWeight: 600 },
      statusBadge: { marginLeft: "8px", fontSize: "11px", fontWeight: 600, padding: "1px 8px", borderRadius: "10px", verticalAlign: "1px", whiteSpace: "nowrap" },
      restartBadge: { marginLeft: "6px", fontSize: "10px", fontWeight: 600, padding: "0 6px", borderRadius: "8px", background: "rgba(255,193,7,0.25)", color: "#8a6d00", verticalAlign: "1px" },
      toolRow: { display: "flex", alignItems: "baseline", gap: "10px", padding: "4px 6px", fontSize: "12px" },
      toolName: { fontFamily: "var(--ds-font-family-code, monospace)", fontSize: "12px", opacity: 0.85, whiteSpace: "nowrap" },
      toolDesc: { opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 },
      tabBar: { display: "flex", gap: "6px", borderBottom: "1px solid rgba(128,128,128,0.25)", paddingBottom: "10px" },
      tabBtn: { padding: "6px 18px", borderRadius: "8px", border: "1px solid rgba(128,128,128,0.35)", background: "transparent", color: "inherit", cursor: "pointer", fontSize: "13px", fontWeight: 500 },
      tabActive: { padding: "6px 18px", borderRadius: "8px", border: "1px solid #4ade80", background: "rgba(74,222,128,0.15)", color: "#4ade80", cursor: "pointer", fontSize: "13px", fontWeight: 600 },
      tabHint: { marginTop: "8px", fontSize: "12px", opacity: 0.55 }
    };
    S.okStyle = Object.assign({ background: "rgba(40,167,69,0.15)", color: "#1e7e34" }, S.msg);
    S.errStyle = Object.assign({ background: "rgba(220,53,69,0.12)", color: "#b02a37" }, S.msg);
    S.warnStyle = Object.assign({ background: "rgba(255,193,7,0.12)", color: "#8a6d00" }, S.msg);

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

    // ===== Skill 视图 =====
    var SOURCE_LABELS = {
      "project-dsh": "项目 · .dsh/skills",
      "project-agents": "项目 · .agents/skills",
      "user-dsh": "用户 · .dsh/skills",
      "user-agents": "用户 · .agents/skills",
      "user-dsh-default": "默认主目录（未被扫描）",
      "missing": "文件缺失"
    };

    function skillMatches(e, q) {
      if (!q) return true;
      var hay = String(e.name) + " " + String(e.description) + " " + String(e.author || "");
      return hay.toLowerCase().indexOf(q.toLowerCase()) !== -1;
    }

    function SkillManagerPage() {
      var loading = React.useState(true);
      var error = React.useState(null);
      var notice = React.useState(null);
      var query = React.useState("");
      var open = React.useState({ enabled: true, paused: true, project: true, diag: true });
      var data = React.useState(null);
      var setLoading = loading[1];
      var setError = error[1];
      var setNotice = notice[1];
      var setQuery = query[1];
      var setOpen = open[1];
      var setData = data[1];

      var load = React.useCallback(function () {
        setLoading(true);
        setError(null);
        fetch(API_SKILL + "/list")
          .then(function (res) {
            if (!res.ok) throw new Error("Skill 管理服务不可用（HTTP " + res.status + "）");
            return res.json();
          })
          .then(function (payload) {
            if (!payload.ok) throw new Error(payload.error || "list failed");
            setData(payload);
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
        fetch(API_SKILL + "/set-enabled", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: entry.name, enabled: !entry.enabled })
        })
          .then(function (res) {
            if (!res.ok) throw new Error("Skill 管理服务不可用（HTTP " + res.status + "）");
            return res.json();
          })
          .then(function (result) {
            if (!result.ok) throw new Error(result.error || "failed");
            var patch = function (e) {
              return e.name === entry.name ? Object.assign({}, e, { enabled: result.enabled }) : e;
            };
            setData(function (prev) {
              return Object.assign({}, prev, {
                entries: prev.entries.map(patch),
                project: prev.project === null ? null : Object.assign({}, prev.project, { entries: prev.project.entries.map(patch) })
              });
            });
            setNotice("skill " + entry.name + " 已" + (result.enabled ? "启用" : "停用") + "。即时生效：进行中的会话从下一轮起自动更新 skill 目录，无需重启 DSH。");
          })
          .catch(function (e) {
            setError(String((e && e.message) || e));
          });
      }, []);

      var toggleSection = React.useCallback(function (key) {
        setOpen(Object.assign({}, open[0], { [key]: !open[0][key] }));
      }, [open]);

      var payload = data[0];
      var q = query[0];
      var userRows = (payload === null ? [] : payload.entries).filter(function (e) { return skillMatches(e, q); });
      var enabledRows = userRows.filter(function (e) { return e.enabled; });
      var pausedRows = userRows.filter(function (e) { return !e.enabled; });
      var projectRows = payload !== null && payload.project !== null
        ? payload.project.entries.filter(function (e) { return skillMatches(e, q); })
        : [];
      var conflictRows = payload === null ? [] : payload.conflicts.filter(function (c) { return skillMatches({ name: c.name, description: "", author: "" }, q); });
      var unscannedRoots = payload === null ? [] : payload.unscanned;

      var renderRow = function (e, index) {
        var mine = String(e.author || "").trim() === MINE_AUTHOR;
        var metaBits = [];
        if (e.source) metaBits.push(SOURCE_LABELS[e.source] || e.source);
        if (e.author) metaBits.push("作者：" + e.author);
        if (e.userOnly) metaBits.push("文件声明：仅用户可调用");
        var rowStyle = e.enabled ? S.row : Object.assign({}, S.row, S.pauseStyle);
        if (mine) rowStyle = Object.assign({}, rowStyle, { borderLeft: "3px solid rgba(74,222,128,0.8)", background: "rgba(74,222,128,0.08)", borderRadius: "6px", paddingLeft: "10px" });
        return React.createElement(
          "div",
          { key: String(e.name) + "-" + index, style: rowStyle },
          React.createElement(
            "div",
            { style: { flex: 1, minWidth: 0 } },
            React.createElement(
              "div",
              { style: mine ? S.mineTitle : null },
              e.name,
              mine ? React.createElement("span", { style: S.mineBadge }, "我的") : null,
              e.shadowCount > 0 ? React.createElement("span", { style: S.shadowBadge, title: "同名 skill 还存在于其他目录，其中低优先级副本被遮蔽（见“同名冲突”）" }, "遮蔽 " + e.shadowCount) : null
            ),
            React.createElement(
              "div",
              { style: S.descStyle, title: String(e.description) },
              String(e.description)
            ),
            React.createElement(
              "div",
              { style: S.dim },
              metaBits.length > 0 ? metaBits.join(" · ") : ""
            )
          ),
          React.createElement("button", { style: S.btn, onClick: function () { toggle(e); } }, e.enabled ? "停用" : "启用")
        );
      };

      var renderSection = function (key, title, rows, options) {
        var canToggle = options !== undefined && options.canToggle === true;
        if (rows.length === 0) return null;
        var expanded = open[0][key];
        var body = canToggle
          ? rows.map(function (e, i) { return renderRow(e, i); })
          : rows;
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
          expanded ? React.createElement("div", null, body) : null
        );
      };

      var diagRows = [];
      for (var ui = 0; ui < unscannedRoots.length; ui++) {
        var root = unscannedRoots[ui];
        diagRows.push(React.createElement(
          "div",
          { key: "unscanned-" + root.path, style: Object.assign({}, S.row, { alignItems: "flex-start" }) },
          React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", null, "未被 DSH 扫描的目录：", React.createElement("span", { style: S.dim }, root.path)),
            React.createElement("div", { style: S.dim }, "内含 " + root.count + " 个 skill（DSH_HOME 指向了别处）。若需生效，请把内容移入当前用户目录，或用 junction 指过去。"))
        ));
      }
      for (var ci = 0; ci < conflictRows.length; ci++) {
        var c = conflictRows[ci];
        var loserBits = c.losers.map(function (l) {
          return (SOURCE_LABELS[l.source] || l.source) + (l.scanned ? "" : "（未扫描）");
        });
        diagRows.push(React.createElement(
          "div",
          { key: "conflict-" + c.name, style: Object.assign({}, S.row, { alignItems: "flex-start" }) },
          React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", null, c.name),
            React.createElement("div", { style: S.dim },
              "生效：", c.winner ? (SOURCE_LABELS[c.winner.source] || c.winner.source) : "（无）",
              " · 被遮蔽：", loserBits.join("、")))
        ));
      }

      var hasAny = enabledRows.length + pausedRows.length > 0;

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
                placeholder: "搜索 skill 名称 / 描述 / 作者",
                style: S.searchStyle
              }),
              unscannedRoots.length > 0
                ? React.createElement("div", { style: S.warnStyle }, "发现 ", unscannedRoots.length, " 个未被 DSH 扫描的 skill 目录（死副本），详情见下方“诊断”。")
                : null,
              renderSection("enabled", "启用中", enabledRows, { canToggle: true }),
              renderSection("paused", "已停用", pausedRows, { canToggle: true }),
              payload !== null && payload.project !== null
                ? renderSection("project", "项目级（最近会话：" + payload.project.cwd + "）", projectRows, { canToggle: true })
                : null,
              diagRows.length > 0
                ? renderSection("diag", "诊断：同名冲突与死副本", diagRows)
                : null,
              !hasAny && projectRows.length === 0 ? React.createElement("div", { style: S.dim }, "无匹配 skill") : null,
              React.createElement(
                "div",
                { style: { marginTop: "12px", display: "flex", alignItems: "center", gap: "12px" } },
                React.createElement("button", { style: S.btn, onClick: function () { load(); } }, "刷新"),
                React.createElement(
                  "span",
                  { style: S.dim },
                  "开关即时生效：停用后模型目录与 /name 调用均不可用，重新启用即恢复。"
                )
              )
            )
      );
    }

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
      // [perf] 读 load 时预计算的 _searchHayLower，避免每次 keystroke 重构 + lowercase
      return (e._searchHayLower || "").indexOf(q.toLowerCase()) !== -1;
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
            // [perf] 预计算 search haystack（避免每次 keystroke 重构 tools 拼接）
            for (var i = 0; i < payload.entries.length; i++) {
              var e = payload.entries[i];
              var hay = String(e.serverName) + " " + String(e.id) + " " + String(e.endpoint) + " " + String(e.transport);
              if (e.tools) {
                for (var j = 0; j < e.tools.length; j++) hay += " " + String(e.tools[j].name);
              }
              e._searchHayLower = hay.toLowerCase();
            }
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
    return module.exports;
  },
});