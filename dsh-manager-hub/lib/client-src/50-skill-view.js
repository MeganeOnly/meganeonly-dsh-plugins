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

