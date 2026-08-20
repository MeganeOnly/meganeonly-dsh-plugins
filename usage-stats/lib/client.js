/**
 * dsh-usage-stats — 浏览器半端（web client bundle，作者：MeganeOnly）
 *
 * 设置 → "使用统计"页。全部数据来自宿主半端 /api/usage-stats/summary
 * （跨会话聚合：token 用量 / 按日趋势 / 按模型 / 会话与工具排行）。
 * 纯展示 + 手动刷新，零外部依赖（react 经 require 取自 shell 模块表）。
 *
 * v0.2.0 新增「显示设置」：页面右上角弹出复选框面板，可独立隐藏/展示
 * 6 个数据块（顶部元信息、指标卡、近 30 天用量图、按模型分解表、
 * 会话用量 Top、工具调用 Top），偏好持久化到 localStorage。
 */window.__ModuleLoader__.load({
  id: "dsh-usage-stats",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");
    var inject = ["slots"];

    var API = "/api/usage-stats/summary";// ===== formatters =====
    function fmtTokens(n) {
      if (n == null || !isFinite(n)) return "–";
      if (n < 1000) return String(n);
      if (n < 1e6) return (n / 1e3).toFixed(n < 1e5 ? 1 : 0) + "K";
      if (n < 1e9) return (n / 1e6).toFixed(n < 1e8 ? 1 : 0) + "M";
      return (n / 1e9).toFixed(2) + "B";
    }

    function fmtDuration(ms) {
      if (ms == null || !isFinite(ms)) return "–";
      var s = Math.round(ms / 1000);
      if (s < 60) return s + " 秒";
      var m = Math.round(s / 60);
      if (m < 60) return m + " 分钟";
      return (ms / 3600000).toFixed(1) + " 小时";
    }

    function fmtDate(ms) {
      if (ms == null) return "–";
      var d = new Date(ms + 8 * 3600 * 1000);
      var p = function (x) { return String(x).padStart(2, "0"); };
      return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate());
    }

    function fmtTime(ms) {
      var d = new Date(ms + 8 * 3600 * 1000);
      var p = function (x) { return String(x).padStart(2, "0"); };
      return p(d.getUTCHours()) + ":" + p(d.getUTCMinutes());
    }

    function fmtSpeed(tokens, ms) {
      if (!ms || !tokens) return "–";
      return (tokens / (ms / 1000)).toFixed(1) + " tok/s";
    }

    /**
     * 未命中输入 : 命中输入 : 输出，归一到未命中=1。
     * 例：未命中 1M、命中 220M、输出 50M → "1 : 220 : 50"。
     */
    function fmtRatio(miss, hit, output) {
      if (!miss) return "–";
      function part(v) {
        var r = v / miss;
        if (r >= 100) return String(Math.round(r));
        if (r >= 10) return r.toFixed(1);
        return r.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
      }
      return "1 : " + part(hit) + " : " + part(output);
    }

    /** 近 N 日窗口内的逐日桶求和（byDay 已是零填充的最近 30 天）。 */
    function sumDays(days) {
      var out = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 0 };
      for (var i = 0; i < days.length; i++) {
        var b = days[i];
        out.inputTokens += b.inputTokens || 0;
        out.outputTokens += b.outputTokens || 0;
        out.cacheReadTokens += b.cacheReadTokens || 0;
        out.cacheWriteTokens += b.cacheWriteTokens || 0;
        out.reasoningTokens += b.reasoningTokens || 0;
        out.requests += b.requests || 0;
      }
      return out;
    }

    /** 模型在时间窗口内的用量（无按日数据时回退全程合计）。 */
    function modelInView(m, winSet) {
      if (winSet == null || !m.days) {
        return { inputTokens: m.inputTokens, outputTokens: m.outputTokens, cacheReadTokens: m.cacheReadTokens, reasoningTokens: m.reasoningTokens, requests: m.requests };
      }
      var out = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, reasoningTokens: 0, requests: 0 };
      for (var day in m.days) {
        if (!winSet[day]) continue;
        var b = m.days[day];
        out.inputTokens += b.inputTokens || 0;
        out.outputTokens += b.outputTokens || 0;
        out.cacheReadTokens += b.cacheReadTokens || 0;
        out.reasoningTokens += b.reasoningTokens || 0;
        out.requests += b.requests || 0;
      }
      return out;
    }// ===== styles =====
// 样式 token（克制：单色 + 一个强调绿）
    var C = {
      hairline: "rgba(128,128,128,0.18)",
      hairlineSoft: "rgba(128,128,128,0.10)",
      faint: "rgba(128,128,128,0.06)",
      text1: "inherit",
      text2: "rgba(128,128,128,0.65)",
      text3: "rgba(128,128,128,0.45)",
      accent: "#16a34a",
      accentSoft: "rgba(22,163,74,0.12)",
      accentSolid: "#16a34a",
      err: "#b02a37",
      errSoft: "rgba(176,42,55,0.10)",
      inputBar: "rgba(128,128,128,0.42)",
      outputBar: "#16a34a"
    };

    var s = {
      // 排版
      pageTitle: { margin: 0, fontSize: "18px", fontWeight: 600, letterSpacing: "-0.01em" },
      meta: { fontSize: "11px", color: C.text3, letterSpacing: "0.02em", lineHeight: 1.6 },
      eyebrow: { fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2 },
      // 控件
      btn: { padding: "5px 12px", fontSize: "12px", borderRadius: "5px", border: "1px solid " + C.hairline, background: "transparent", color: "inherit", cursor: "pointer", transition: "border-color 120ms, background 120ms" },
      btnPrimary: { padding: "5px 12px", fontSize: "12px", borderRadius: "5px", border: "1px solid " + C.accent, background: C.accentSoft, color: C.accent, fontWeight: 600, cursor: "pointer" },
      tab: { padding: "4px 11px", fontSize: "12px", borderRadius: "5px", border: "1px solid transparent", background: "transparent", color: C.text2, cursor: "pointer", fontVariantNumeric: "tabular-nums" },
      tabActive: { padding: "4px 11px", fontSize: "12px", borderRadius: "5px", border: "1px solid " + C.hairline, background: C.faint, color: "inherit", fontWeight: 600, cursor: "default", fontVariantNumeric: "tabular-nums" },
      // 卡片
      card: { flex: "1 1 150px", minWidth: "150px", padding: "14px 16px", borderRadius: "6px", border: "1px solid " + C.hairline, background: "transparent", display: "flex", flexDirection: "column", gap: "6px" },
      cardLabel: { fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2 },
      cardValue: { fontSize: "22px", fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" },
      cardSub: { fontSize: "11px", color: C.text3, fontVariantNumeric: "tabular-nums" },
      // 表格
      th: { textAlign: "left", padding: "8px 10px", fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2, borderBottom: "1px solid " + C.hairline, whiteSpace: "nowrap" },
      td: { padding: "9px 10px", fontSize: "13px", borderBottom: "1px solid " + C.hairlineSoft, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
      tdName: { padding: "9px 10px", fontSize: "13px", borderBottom: "1px solid " + C.hairlineSoft, whiteSpace: "nowrap", fontWeight: 500 },
      num: { textAlign: "right" },
      // 分隔
      hr: { margin: "20px 0 14px", border: "none", borderTop: "1px solid " + C.hairline },
      sectionTitle: { margin: "0 0 10px", fontSize: "13px", fontWeight: 600, letterSpacing: "-0.005em" },
      sectionHint: { marginLeft: "8px", fontSize: "11px", color: C.text3, fontWeight: 400 },
      // 错误
      errBox: { padding: "8px 12px", borderRadius: "5px", background: C.errSoft, border: "1px solid rgba(176,42,55,0.25)", color: C.err, fontSize: "12px", marginBottom: "12px" },
      // 图表
      chartBar: { flex: "1 1 0", minWidth: "6px", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", cursor: "default" },
      chartAxis: { flex: "1 1 0", minWidth: "6px", textAlign: "center", fontSize: "10px", color: C.text3, fontVariantNumeric: "tabular-nums" },
      // 显示设置面板
      panelWrap: { position: "relative" },
      panel: {
        position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100,
        width: "260px", padding: "12px 14px", borderRadius: "6px",
        border: "1px solid " + C.hairline,
        background: "var(--ds-bg-elevated, #ffffff)",
        boxShadow: "0 6px 24px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)"
      },
      panelTitle: { fontSize: "12px", fontWeight: 600, marginBottom: "8px", color: C.text2, letterSpacing: "0.02em" },
      panelSep: { height: "1px", background: C.hairlineSoft, margin: "10px 0 8px" },
      panelRow: { display: "flex", alignItems: "center", gap: "8px", padding: "4px 0", fontSize: "12px", cursor: "pointer", userSelect: "none" },
      panelCheck: { width: "13px", height: "13px", margin: 0, cursor: "pointer", accentColor: C.accent },
      panelToggleRow: { display: "flex", gap: "6px", marginBottom: "6px" },
      panelToggleBtn: { padding: "3px 9px", fontSize: "11px", borderRadius: "4px", border: "1px solid " + C.hairline, background: "transparent", color: C.text2, cursor: "pointer" }
    };// ===== components =====
    function Card(label, value, sub) {
      return React.createElement(
        "div",
        { style: s.card },
        React.createElement("div", { style: s.cardLabel }, label),
        React.createElement("div", { style: s.cardValue }, value),
        sub != null ? React.createElement("div", { style: s.cardSub }, sub) : null
      );
    }

    /**
     * 近 30 天柱状图：每天一根柱，两段堆叠——下段输入（灰）、上段输出（绿）。
     * 缓存读取体量比输入输出大一两个数量级，进柱子会把曲线压死，放 tooltip。
     */
    function DayChart(days) {
      var max = 0;
      for (var i = 0; i < days.length; i++) {
        var total = days[i].inputTokens + days[i].outputTokens;
        if (total > max) max = total;
      }
      if (max === 0) {
        return React.createElement("div", { style: s.meta }, "最近 30 天无用量。");
      }
      var CHART_H = 84;
      return React.createElement(
        "div",
        null,
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "flex-end", gap: "2px", height: CHART_H + "px" } },
          days.map(function (d) {
            var h = function (v) { return Math.round((v / max) * (CHART_H - 4)); };
            var title = d.day +
              " · 输入 " + fmtTokens(d.inputTokens) +
              " · 输出 " + fmtTokens(d.outputTokens) +
              "\n缓存读 " + fmtTokens(d.cacheReadTokens) +
              " · 推理 " + fmtTokens(d.reasoningTokens) +
              " · 请求 " + d.requests + " 次";
            return React.createElement(
              "div",
              { key: d.day, title: title, style: s.chartBar },
              React.createElement("div", { style: { height: h(d.outputTokens) + "px", background: C.outputBar, borderRadius: "1px 1px 0 0", minHeight: d.outputTokens > 0 ? 2 : 0 } }),
              React.createElement("div", { style: { height: h(d.inputTokens) + "px", background: C.inputBar, minHeight: d.inputTokens > 0 ? 2 : 0 } })
            );
          })
        ),
        React.createElement(
          "div",
          { style: { display: "flex", gap: "2px", marginTop: "6px" } },
          days.map(function (d) {
            var show = parseInt(d.day.slice(8), 10) % 5 === 0 || d.day === days[days.length - 1].day;
            return React.createElement("div", { key: d.day, style: s.chartAxis }, show ? d.day.slice(5) : "");
          })
        ),
        React.createElement(
          "div",
          { style: Object.assign({}, s.meta, { marginTop: "10px", display: "flex", alignItems: "center", gap: "12px" }) },
          React.createElement("span", null, React.createElement("span", { style: { display: "inline-block", width: "8px", height: "8px", background: C.outputBar, marginRight: "5px", borderRadius: "1px", verticalAlign: "1px" } }, ""), "输出"),
          React.createElement("span", null, React.createElement("span", { style: { display: "inline-block", width: "8px", height: "8px", background: C.inputBar, marginRight: "5px", borderRadius: "1px", verticalAlign: "1px" } }, ""), "输入"),
          React.createElement("span", { style: { marginLeft: "auto", color: C.text3 } }, "悬停查看缓存读 / 推理 / 请求数")
        )
      );
    }

    function Table(headers, rows) {
      return React.createElement(
        "table",
        { style: { borderCollapse: "collapse", width: "100%" } },
        React.createElement(
          "thead",
          null,
          React.createElement("tr", null, headers.map(function (h, i) {
            return React.createElement("th", { key: i, style: Object.assign({}, s.th, h.num ? s.num : null) }, h.label);
          }))
        ),
        React.createElement("tbody", null, rows)
      );
    }// ===== config =====
    var RANGES = [
      { key: "all", label: "全部" },
      { key: "30", label: "近 30 日" },
      { key: "7", label: "近 7 日" },
      { key: "1", label: "今日" }
    ];

    /* ---------- 显示设置：可隐藏/展示各数据块，偏好持久化 ---------- */

    // 6 个数据块的可见性开关（key → 中文标签）。新增 section 时在此追加并配合 UsageStatsPageBody 渲染。
    var VISIBLE_KEYS = ["meta", "cards", "chart", "byModel", "topSessions", "tools"];
    var VISIBLE_LABELS = {
      meta: "顶部元信息（数据源 / 解码 / 生成耗时）",
      cards: "指标卡（6 张：会话 / 请求 / 未命中 / 输出 / 命中 / 速度）",
      chart: "近 30 天用量柱状图",
      byModel: "按模型分解表",
      topSessions: "会话用量 Top",
      tools: "工具调用 Top"
    };
    var STORAGE_VISIBLE_KEY = "dsh-usage-stats/visible-v1";

    function defaultVisible() {
      var out = {};
      for (var i = 0; i < VISIBLE_KEYS.length; i++) out[VISIBLE_KEYS[i]] = true;
      return out;
    }

    // localStorage 降级探测：QuotaExceededError / SecurityError → 偏好不持久化但功能仍可用
    var STORAGE_OK = (function () {
      try {
        if (typeof localStorage === "undefined") return false;
        localStorage.setItem("__dsh_usage_stats_probe__", "1");
        localStorage.removeItem("__dsh_usage_stats_probe__");
        return true;
      } catch (e) {
        console.warn("[usage-stats] localStorage 不可用，显示设置无法跨刷新保留:", e && e.message);
        return false;
      }
    })();

    function loadVisible() {
      if (!STORAGE_OK) return defaultVisible();
      try {
        var raw = localStorage.getItem(STORAGE_VISIBLE_KEY);
        if (raw == null) return defaultVisible();
        var parsed = JSON.parse(raw);
        if (parsed == null || typeof parsed !== "object") return defaultVisible();
        var out = defaultVisible();
        for (var i = 0; i < VISIBLE_KEYS.length; i++) {
          var k = VISIBLE_KEYS[i];
          if (typeof parsed[k] === "boolean") out[k] = parsed[k];
        }
        return out;
      } catch (e) {
        return defaultVisible();
      }
    }

    function saveVisible(v) {
      if (!STORAGE_OK) return;
      try {
        localStorage.setItem(STORAGE_VISIBLE_KEY, JSON.stringify(v));
      } catch (e) {
        console.warn("[usage-stats] 保存显示偏好失败:", e && e.message);
      }
    }

    function setAllVisible(val) {
      var out = {};
      for (var i = 0; i < VISIBLE_KEYS.length; i++) out[VISIBLE_KEYS[i]] = !!val;
      return out;
    }

    function toggleOne(visibility, key, val) {
      var out = {};
      for (var i = 0; i < VISIBLE_KEYS.length; i++) {
        var k = VISIBLE_KEYS[i];
        out[k] = (k === key) ? !!val : visibility[k];
      }
      return out;
    }// ===== visibility panel =====
    /**
     * 显示设置面板：列出 6 个数据块的复选项 + 全选/全不选快捷按钮。
     * 通过 [data-usage-stats-panel] 属性给外层 click-outside 监听器识别。
     */
    function VisibilityPanel(visibility, setVisibility) {
      var checkedCount = 0;
      for (var i = 0; i < VISIBLE_KEYS.length; i++) if (visibility[VISIBLE_KEYS[i]]) checkedCount++;
      var allOn = checkedCount === VISIBLE_KEYS.length;
      var allOff = checkedCount === 0;
      return React.createElement(
        "div",
        { "data-usage-stats-panel": "1", style: s.panel, onClick: function (e) { e.stopPropagation(); } },
        React.createElement("div", { style: s.panelTitle }, "显示设置"),
        React.createElement(
          "div",
          { style: s.panelToggleRow },
          React.createElement(
            "button",
            { style: s.panelToggleBtn, disabled: allOn, onClick: function () { setVisibility(setAllVisible(true)); } },
            "全选"
          ),
          React.createElement(
            "button",
            { style: s.panelToggleBtn, disabled: allOff, onClick: function () { setVisibility(setAllVisible(false)); } },
            "全不选"
          ),
          React.createElement(
            "span",
            { style: { marginLeft: "auto", fontSize: "11px", color: C.text3 } },
            checkedCount + " / " + VISIBLE_KEYS.length
          )
        ),
        React.createElement("div", { style: s.panelSep }),
        React.createElement(
          "div",
          null,
          VISIBLE_KEYS.map(function (k) {
            return React.createElement(
              "label",
              { key: k, style: s.panelRow },
              React.createElement("input", {
                type: "checkbox",
                style: s.panelCheck,
                checked: visibility[k],
                onChange: function (e) { setVisibility(toggleOne(visibility, k, e.target.checked)); }
              }),
              React.createElement("span", null, VISIBLE_LABELS[k])
            );
          })
        )
      );
    }// ===== page =====
    function UsageStatsPage() {
      var loading = React.useState(true);
      var data = React.useState(null);
      var error = React.useState(null);
      var rangeState = React.useState("all");
      var visibilityState = React.useState(loadVisible());
      var panelOpenState = React.useState(false);
      var setLoading = loading[1];
      var setData = data[1];
      var setError = error[1];
      var setRange = rangeState[1];
      var setVisibility = visibilityState[1];
      var setPanelOpen = panelOpenState[1];

      var load = React.useCallback(function (force) {
        setLoading(true);
        setError(null);
        fetch(API + (force ? "?force=1&t=" + Date.now() : "?t=" + Date.now()))
          .then(function (res) { return res.json(); })
          .then(function (payload) {
            if (!payload.ok) throw new Error(payload.error || "summary failed");
            setData(payload);
            setLoading(false);
          })
          .catch(function (e) {
            setError(String((e && e.message) || e));
            setLoading(false);
          });
      }, []);

      React.useEffect(function () { load(false); }, [load]);

      // 显示偏好变更后写回 localStorage（首次 mount 的初始值也会触发一次，无害）
      React.useEffect(function () {
        saveVisible(visibilityState[0]);
      }, [visibilityState[0]]);

      // 弹出层打开时挂全局 mousedown，点 panel 外部或按钮外部则关闭。
      // 用 data-usage-stats-panel / data-usage-stats-panel-btn 标记避坑（DSH DOM 结构不稳）
      React.useEffect(function () {
        if (!panelOpenState[0]) return undefined;
        function onDocDown(e) {
          var t = e.target;
          if (!t || typeof t.closest !== "function") return;
          if (t.closest("[data-usage-stats-panel]")) return;
          if (t.closest("[data-usage-stats-panel-btn]")) return;
          setPanelOpen(false);
        }
        document.addEventListener("mousedown", onDocDown);
        return function () { document.removeEventListener("mousedown", onDocDown); };
      }, [panelOpenState[0]]);

      var d = data[0];
      if (loading[0] && d == null) {
        return React.createElement(
          "div",
          null,
          React.createElement("h2", { style: s.pageTitle }, "使用统计"),
          React.createElement("div", { style: Object.assign({}, s.meta, { marginTop: "12px" }) }, "加载中…（首次统计需解码全部会话，可能需要几秒）")
        );
      }
      if (error[0] != null) {
        return React.createElement(
          "div",
          null,
          React.createElement("h2", { style: s.pageTitle }, "使用统计"),
          React.createElement("div", { style: Object.assign({}, s.errBox, { marginTop: "12px" }) }, "加载失败：", error[0])
        );
      }
      if (d == null) return React.createElement("h2", { style: s.pageTitle }, "使用统计");
      try {
        return UsageStatsPageBody(d, function (force) { load(force); }, rangeState[0], setRange, visibilityState[0], setVisibility, panelOpenState[0], setPanelOpen);
      } catch (e) {
        return React.createElement(
          "div",
          { style: { padding: "12px", color: C.err } },
          React.createElement("h3", null, "渲染异常（诊断模式）"),
          React.createElement("div", null, String((e && e.message) || e)),
          React.createElement("pre", { style: { whiteSpace: "pre-wrap", fontSize: "11px", fontFamily: "monospace" } }, String((e && e.stack) || ""))
        );
      }
    }

    function UsageStatsPageBody(d, reload, range, setRange, visibility, setVisibility, panelOpen, setPanelOpen) {
      // 时间窗口
      var winN = range === "all" ? null : parseInt(range, 10);
      var fromIdx = winN == null ? 0 : Math.max(0, d.byDay.length - winN);
      var winDays = d.byDay.slice(fromIdx);
      var winSet = null;
      if (winN != null) {
        winSet = {};
        for (var wi = 0; wi < winDays.length; wi++) winSet[winDays[wi].day] = true;
      }
      var rangeTotals = winN == null ? d.totals : sumDays(winDays);
      var rangeLabel = winN == null ? "全程" : (winN === 1 ? "今日" : "近 " + winN + " 日");

      // 顶部：标题 + 范围 tab + 操作（含"显示"按钮 + 弹出层）
      var header = React.createElement(
        "div",
        { style: { display: "flex", alignItems: "baseline", gap: "16px", flexWrap: "wrap" } },
        React.createElement("h2", { style: s.pageTitle }, "使用统计"),
        React.createElement(
          "div",
          { style: { display: "flex", gap: "4px" } },
          RANGES.map(function (r) {
            var active = r.key === range;
            return React.createElement(
              "button",
              { key: r.key, style: active ? s.tabActive : s.tab, onClick: function () { if (!active) setRange(r.key); } },
              r.label
            );
          })
        ),
        React.createElement(
          "div",
          { style: { marginLeft: "auto", display: "flex", gap: "6px", alignItems: "center" } },
          // 显示设置按钮 + 弹出层（包一层 wrap 让 panel 相对按钮定位）
          React.createElement(
            "div",
            { style: s.panelWrap, "data-usage-stats-panel-btn": "1" },
            React.createElement(
              "button",
              {
                style: panelOpen ? s.btnPrimary : s.btn,
                onClick: function () { setPanelOpen(!panelOpen); },
                title: "选择要展示的数据块"
              },
              panelOpen ? "显示 ✓" : "显示"
            ),
            panelOpen ? VisibilityPanel(visibility, setVisibility) : null
          ),
          React.createElement("button", { style: s.btn, onClick: function () { reload(false); } }, "刷新"),
          React.createElement("button", { style: s.btn, onClick: function () { reload(true); }, title: "忽略缓存，强制重新解码全部会话" }, "强制重算")
        )
      );

      // 元信息：上下文 + 数据源
      var metaNode = React.createElement(
        "div",
        { style: Object.assign({}, s.meta, { marginTop: "8px" }) },
        "数据源 ", React.createElement("span", { style: { fontFamily: "var(--ds-font-family-code, monospace)" } }, d.home),
        " · 解码 ", d.decoded, " / 复用 ", d.reused,
        " · 生成于 ", fmtTime(d.generatedAt), "（", fmtDuration(d.durationMs), "）"
      );

      // 指标卡（6 张）：会话 / 请求 / 未命中 / 输出 / 命中 / 速度
      var t = rangeTotals;
      var cardsNode = React.createElement(
        "div",
        { style: { display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "16px" } },
        Card("会话", String(d.sessionCount), d.turns + " 轮对话（全程）"),
        Card("模型请求" + (winN == null ? "" : " · " + rangeLabel), String(t.requests), "纯模型时间 " + fmtDuration(d.llmMs)),
        Card("未命中输入", fmtTokens(t.inputTokens), "缓存写 " + fmtTokens(t.cacheWriteTokens)),
        Card("输出", fmtTokens(t.outputTokens), "其中推理 " + fmtTokens(t.reasoningTokens)),
        Card("命中输入", fmtTokens(t.cacheReadTokens), "缓存读取"),
        Card("生成速度", fmtSpeed(d.totals.outputTokens, d.llmMs), "全程输出 ÷ 模型时间")
      );

      // 错误盒
      var errorBox = d.errors && d.errors.length > 0
        ? React.createElement("div", { style: Object.assign({}, s.errBox, { marginTop: "12px" }) }, "部分会话解码失败（已跳过）：", d.errors.join("；"))
        : null;

      // 按模型表
      var modelRows = d.byModel.map(function (m) {
        var v = modelInView(m, winSet);
        return React.createElement(
          "tr",
          { key: m.model },
          React.createElement("td", { style: s.tdName, title: m.model }, m.model),
          React.createElement("td", { style: Object.assign({}, s.td, s.num, { fontWeight: 600, color: C.accent }), title: "未命中输入 : 命中输入 : 输出（归一到未命中=1）" }, fmtRatio(v.inputTokens, v.cacheReadTokens, v.outputTokens)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num) }, String(v.requests)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num) }, fmtTokens(v.inputTokens)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num) }, fmtTokens(v.outputTokens)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num, { color: C.text3 }) }, fmtTokens(v.reasoningTokens)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num) }, fmtTokens(v.cacheReadTokens)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num, { color: C.text3 }) }, String(m.sessions))
        );
      });

      // 会话表
      // 注：回调形参避免用 `s`，以免遮蔽外层样式对象 `var s`
      var sessionRows = d.topSessions.map(function (sess) {
        return React.createElement(
          "tr",
          { key: sess.id },
          React.createElement("td", { style: Object.assign({}, s.tdName, { maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis" }), title: sess.title + "　" + (sess.cwd || "") }, sess.title),
          React.createElement("td", { style: Object.assign({}, s.td, { maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", color: C.text2 }), title: sess.cwd || "" }, sess.cwd ? String(sess.cwd).split(/[\\/]/).filter(Boolean).pop() : "–"),
          React.createElement("td", { style: Object.assign({}, s.td, s.num, { color: C.text2 }) }, fmtDate(sess.createdAt)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num) }, String(sess.requests)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num) }, fmtTokens(sess.outputTokens)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num, { fontWeight: 600 }) }, fmtTokens(sess.tokens))
        );
      });

      // 工具表
      var toolRows = d.tools.map(function (tool) {
        return React.createElement(
          "tr",
          { key: tool.name },
          React.createElement("td", { style: s.tdName }, tool.name),
          React.createElement("td", { style: Object.assign({}, s.td, s.num) }, String(tool.calls)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num) }, fmtDuration(tool.ms)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num, { color: C.text3 }) }, tool.calls > 0 ? (tool.ms / tool.calls / 1000).toFixed(1) + " s/次" : "–")
        );
      });

      // 图表标题
      var chartTitle = winN == null ? "近 30 天用量" : (winN === 1 ? "今日用量" : "近 " + winN + " 日用量");
      var chartHint = winN == null ? "图表固定 30 天，切换范围看模型表" : null;

      // 各 section 按 visibility 过滤后顺序拼接，第一个不加 hr（紧跟 header/errorBox）
      var sectionNodes = [];
      if (visibility.meta) sectionNodes.push({ key: "meta", node: metaNode });
      if (visibility.cards) sectionNodes.push({ key: "cards", node: cardsNode });
      if (visibility.chart) {
        sectionNodes.push({
          key: "chart",
          node: React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "baseline" } },
              React.createElement("h3", { style: s.sectionTitle }, chartTitle),
              chartHint ? React.createElement("span", { style: s.sectionHint }, "· ", chartHint) : null
            ),
            DayChart(winN == null ? d.byDay : winDays)
          )
        });
      }
      if (visibility.byModel) {
        sectionNodes.push({
          key: "byModel",
          node: React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "baseline" } },
              React.createElement("h3", { style: s.sectionTitle }, "按模型"),
              React.createElement("span", { style: s.sectionHint }, "· ", rangeLabel, " · 比值列：未命中 : 命中 : 输出（归一到未命中=1）")
            ),
            Table(
              [
                { label: "模型" },
                { label: "比值", num: true },
                { label: "请求", num: true },
                { label: "未命中", num: true },
                { label: "输出", num: true },
                { label: "推理", num: true },
                { label: "命中", num: true },
                { label: "会话", num: true }
              ],
              modelRows
            )
          )
        });
      }
      if (visibility.topSessions) {
        sectionNodes.push({
          key: "topSessions",
          node: React.createElement(
            "div",
            null,
            React.createElement(
              "h3",
              { style: s.sectionTitle },
              "会话用量 Top " + d.topSessions.length,
              React.createElement("span", { style: s.sectionHint }, "· 全程")
            ),
            Table(
              [
                { label: "标题" },
                { label: "目录" },
                { label: "日期", num: true },
                { label: "请求", num: true },
                { label: "输出", num: true },
                { label: "总量", num: true }
              ],
              sessionRows
            )
          )
        });
      }
      if (visibility.tools) {
        sectionNodes.push({
          key: "tools",
          node: React.createElement(
            "div",
            null,
            React.createElement(
              "h3",
              { style: s.sectionTitle },
              "工具调用 Top " + d.tools.length,
              React.createElement("span", { style: s.sectionHint }, "· 全程")
            ),
            Table(
              [
                { label: "工具" },
                { label: "次数", num: true },
                { label: "总耗时", num: true },
                { label: "平均", num: true }
              ],
              toolRows
            )
          )
        });
      }

      return React.createElement(
        "div",
        { style: { maxWidth: "1080px" } },
        header,
        errorBox,
        sectionNodes.length === 0
          ? React.createElement("div", { style: Object.assign({}, s.meta, { marginTop: "20px" }) }, "已隐藏全部数据块，点右上角「显示」重新选择。")
          : sectionNodes.map(function (sec, i) {
              return React.createElement(
                "div",
                { key: sec.key },
                i > 0 ? React.createElement("hr", { style: s.hr }) : null,
                sec.node
              );
            })
      );
    }// ===== apply =====
    function apply(ctx) {
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            id: "usage-stats",
            order: 40,
            label: function () { return "使用统计"; }
          },
          UsageStatsPage
        );
      });
    }

    exports.inject = inject;
    exports.apply = apply;return module.exports;
  },
});