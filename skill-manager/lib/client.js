/**
 * dsh-skill-manager — 浏览器半端（web client bundle）
 *
 * 打包格式与官方社区插件一致：window.__ModuleLoader__.load({ id, factory })。
 * 依赖经 require() 取得（react 由 shell 模块表提供），其余全部走浏览器 fetch
 * 调用宿主 webServer 路由（与 plugin-manager 同款模式）。
 *
 * 界面：设置 → “Skill 管理”页（紧跟“插件管理”之后）。功能：
 *   - 搜索框：按 skill 名称 / 描述 / 作者过滤（不区分大小写）；
 *   - 分组：启用中 / 已停用（用户级）、项目级（最近会话的项目根）、
 *     同名冲突（谁生效、谁被遮蔽）、未被扫描的目录（死副本提醒）；
 *   - 每行展示 名称 + 描述 + 来源/作者（呈现方式参考 ZCode 的 skill 列表）；
 *   - 每行一个启/停按钮；开关即时生效（无需重启 DSH）；
 *   - 作者为 MeganeOnly 的 skill（本人所写）名字高亮加粗并带“我的”标记。
 */
window.__ModuleLoader__.load({
  id: "dsh-skill-manager",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");
    var inject = ["slots"];

    var API = "/api/skill-manager";
    var MINE_AUTHOR = "MeganeOnly";

    var SOURCE_LABELS = {
      "project-dsh": "项目 · .dsh/skills",
      "project-agents": "项目 · .agents/skills",
      "user-dsh": "用户 · .dsh/skills",
      "user-agents": "用户 · .agents/skills",
      "user-dsh-default": "默认主目录（未被扫描）",
      "missing": "文件缺失"
    };

    function matches(e, q) {
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
        fetch(API + "/list")
          .then(function (res) { return res.json(); })
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
        fetch(API + "/set-enabled", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: entry.name, enabled: !entry.enabled })
        })
          .then(function (res) { return res.json(); })
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

      var row = { display: "flex", alignItems: "center", gap: "12px", padding: "10px 4px", borderBottom: "1px solid rgba(128,128,128,0.2)" };
      var dim = { opacity: 0.6, fontSize: "12px", marginTop: "2px" };
      var btn = { padding: "4px 14px", borderRadius: "6px", border: "1px solid rgba(128,128,128,0.4)", background: "transparent", cursor: "pointer" };
      var msg = { padding: "8px 12px", borderRadius: "6px", marginBottom: "8px", fontSize: "13px" };
      var okStyle = Object.assign({ background: "rgba(40,167,69,0.15)", color: "#1e7e34" }, msg);
      var errStyle = Object.assign({ background: "rgba(220,53,69,0.12)", color: "#b02a37" }, msg);
      var warnStyle = Object.assign({ background: "rgba(255,193,7,0.12)", color: "#8a6d00" }, msg);
      var searchStyle = { width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: "6px", border: "1px solid rgba(128,128,128,0.35)", background: "rgba(128,128,128,0.08)", color: "inherit", fontSize: "13px", outline: "none", marginBottom: "12px" };
      var secHeader = { display: "flex", alignItems: "center", gap: "6px", padding: "9px 6px", cursor: "pointer", userSelect: "none", borderRadius: "6px", borderBottom: "1px solid rgba(128,128,128,0.18)", fontWeight: 600, fontSize: "13px" };
      var chevron = { display: "inline-block", width: "14px", fontSize: "11px", color: "rgba(128,128,128,0.9)" };
      var countPill = { marginLeft: "2px", fontSize: "11px", fontWeight: 400, color: "rgba(128,128,128,0.9)", background: "rgba(128,128,128,0.15)", borderRadius: "9px", padding: "0 7px", lineHeight: "16px" };
      var mineTitle = { fontWeight: 700, color: "#4ade80" };
      var mineBadge = { marginLeft: "8px", fontSize: "11px", fontWeight: 700, padding: "1px 8px", borderRadius: "10px", background: "#4ade80", color: "#052e16", verticalAlign: "1px" };
      var shadowBadge = { marginLeft: "6px", fontSize: "10px", fontWeight: 600, padding: "0 6px", borderRadius: "8px", background: "rgba(255,193,7,0.25)", color: "#8a6d00", verticalAlign: "1px" };
      var descStyle = { marginTop: "2px", fontSize: "12px", opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
      var pauseStyle = { opacity: 0.55 };

      var payload = data[0];
      var q = query[0];
      var userRows = (payload === null ? [] : payload.entries).filter(function (e) { return matches(e, q); });
      var enabledRows = userRows.filter(function (e) { return e.enabled; });
      var pausedRows = userRows.filter(function (e) { return !e.enabled; });
      var projectRows = payload !== null && payload.project !== null
        ? payload.project.entries.filter(function (e) { return matches(e, q); })
        : [];
      var conflictRows = payload === null ? [] : payload.conflicts.filter(function (c) { return matches({ name: c.name, description: "", author: "" }, q); });
      var unscannedRoots = payload === null ? [] : payload.unscanned;

      var renderRow = function (e, index) {
        var mine = String(e.author || "").trim() === MINE_AUTHOR;
        var metaBits = [];
        if (e.source) metaBits.push(SOURCE_LABELS[e.source] || e.source);
        if (e.author) metaBits.push("作者：" + e.author);
        if (e.userOnly) metaBits.push("文件声明：仅用户可调用");
        var rowStyle = e.enabled ? row : Object.assign({}, row, pauseStyle);
        if (mine) rowStyle = Object.assign({}, rowStyle, { borderLeft: "3px solid rgba(74,222,128,0.8)", background: "rgba(74,222,128,0.08)", borderRadius: "6px", paddingLeft: "10px" });
        return React.createElement(
          "div",
          { key: String(e.name) + "-" + index, style: rowStyle },
          React.createElement(
            "div",
            { style: { flex: 1, minWidth: 0 } },
            React.createElement(
              "div",
              { style: mine ? mineTitle : null },
              e.name,
              mine ? React.createElement("span", { style: mineBadge }, "我的") : null,
              e.shadowCount > 0 ? React.createElement("span", { style: shadowBadge, title: "同名 skill 还存在于其他目录，其中低优先级副本被遮蔽（见“同名冲突”）" }, "遮蔽 " + e.shadowCount) : null
            ),
            React.createElement(
              "div",
              { style: descStyle, title: String(e.description) },
              String(e.description)
            ),
            React.createElement(
              "div",
              { style: dim },
              metaBits.length > 0 ? metaBits.join(" · ") : ""
            )
          ),
          React.createElement("button", { style: btn, onClick: function () { toggle(e); } }, e.enabled ? "停用" : "启用")
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
            { style: secHeader, onClick: function () { toggleSection(key); }, title: expanded ? "点击收起" : "点击展开" },
            React.createElement("span", { style: chevron }, expanded ? "▾" : "▸"),
            React.createElement("span", null, title),
            React.createElement("span", { style: countPill }, String(rows.length))
          ),
          expanded ? React.createElement("div", null, body) : null
        );
      };

      var diagRows = [];
      for (var ui = 0; ui < unscannedRoots.length; ui++) {
        var root = unscannedRoots[ui];
        diagRows.push(React.createElement(
          "div",
          { key: "unscanned-" + root.path, style: Object.assign({}, row, { alignItems: "flex-start" }) },
          React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", null, "未被 DSH 扫描的目录：", React.createElement("span", { style: dim }, root.path)),
            React.createElement("div", { style: dim }, "内含 " + root.count + " 个 skill（DSH_HOME 指向了别处）。若需生效，请把内容移入当前用户目录，或用 junction 指过去。"))
        ));
      }
      for (var ci = 0; ci < conflictRows.length; ci++) {
        var c = conflictRows[ci];
        var loserBits = c.losers.map(function (l) {
          return (SOURCE_LABELS[l.source] || l.source) + (l.scanned ? "" : "（未扫描）");
        });
        diagRows.push(React.createElement(
          "div",
          { key: "conflict-" + c.name, style: Object.assign({}, row, { alignItems: "flex-start" }) },
          React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", null, c.name),
            React.createElement("div", { style: dim },
              "生效：", c.winner ? (SOURCE_LABELS[c.winner.source] || c.winner.source) : "（无）",
              " · 被遮蔽：", loserBits.join("、")))
        ));
      }

      var hasAny = enabledRows.length + pausedRows.length > 0;

      return React.createElement(
        "div",
        null,
        React.createElement("h3", { style: { marginTop: 0 } }, "Skill 管理"),
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
                placeholder: "搜索 skill 名称 / 描述 / 作者",
                style: searchStyle
              }),
              unscannedRoots.length > 0
                ? React.createElement("div", { style: warnStyle }, "发现 ", unscannedRoots.length, " 个未被 DSH 扫描的 skill 目录（死副本），详情见下方“诊断”。")
                : null,
              renderSection("enabled", "启用中", enabledRows, { canToggle: true }),
              renderSection("paused", "已停用", pausedRows, { canToggle: true }),
              payload !== null && payload.project !== null
                ? renderSection("project", "项目级（最近会话：" + payload.project.cwd + "）", projectRows, { canToggle: true })
                : null,
              diagRows.length > 0
                ? renderSection("diag", "诊断：同名冲突与死副本", diagRows)
                : null,
              !hasAny && projectRows.length === 0 ? React.createElement("div", { style: dim }, "无匹配 skill") : null,
              React.createElement(
                "div",
                { style: { marginTop: "12px", display: "flex", alignItems: "center", gap: "12px" } },
                React.createElement("button", { style: btn, onClick: function () { load(); } }, "刷新"),
                React.createElement(
                  "span",
                  { style: dim },
                  "开关即时生效：停用后模型目录与 /name 调用均不可用，重新启用即恢复。"
                )
              )
            )
      );
    }

    function apply(ctx) {
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            id: "skill-manager",
            order: 31,
            label: function () { return "Skill 管理"; }
          },
          SkillManagerPage
        );
      });
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});
