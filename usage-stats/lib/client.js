/**
 * dsh-usage-stats — 浏览器半端（web client bundle，作者：MeganeOnly）
 *
 * 设置 → “使用统计”页。全部数据来自宿主半端 /api/usage-stats/summary
 * （跨会话聚合：token 用量 / 按日趋势 / 按模型 / 会话与工具排行）。
 * 纯展示 + 手动刷新，零外部依赖（react 经 require 取自 shell 模块表）。
 */
window.__ModuleLoader__.load({
  id: "dsh-usage-stats",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");
    var inject = ["slots"];

    var API = "/api/usage-stats/summary";

    /* ---------- 格式化 ---------- */

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

    /** 输出:命中输入:未命中输入 连比，归一到输出=1，如 "1 : 220 : 1.3"。 */
    function fmtRatio(output, hit, miss) {
      if (!output) return "–";
      function part(v) {
        var r = v / output;
        if (r >= 100) return String(Math.round(r));
        if (r >= 10) return r.toFixed(1);
        return r.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
      }
      return "1 : " + part(hit) + " : " + part(miss);
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
    }

    /* ---------- 样式 ---------- */

    var dim = { opacity: 0.6, fontSize: "12px" };
    var btn = { padding: "4px 14px", borderRadius: "6px", border: "1px solid rgba(128,128,128,0.4)", background: "transparent", cursor: "pointer" };
    var cardStyle = { flex: "1 1 140px", minWidth: "140px", padding: "12px 14px", borderRadius: "8px", border: "1px solid rgba(128,128,128,0.22)", background: "rgba(128,128,128,0.06)" };
    var cardNum = { fontSize: "20px", fontWeight: 700, marginTop: "4px", fontVariantNumeric: "tabular-nums" };
    var cardLabel = { fontSize: "12px", opacity: 0.65 };
    var th = { textAlign: "left", padding: "6px 10px", fontSize: "12px", opacity: 0.65, fontWeight: 600, borderBottom: "1px solid rgba(128,128,128,0.3)", whiteSpace: "nowrap" };
    var td = { padding: "7px 10px", fontSize: "13px", borderBottom: "1px solid rgba(128,128,128,0.14)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
    var num = { textAlign: "right" };
    var sectionTitle = { margin: "22px 0 8px", fontSize: "14px", fontWeight: 700 };

    /* ---------- 子组件 ---------- */

    function Card(label, value, sub) {
      return React.createElement(
        "div",
        { style: cardStyle },
        React.createElement("div", { style: cardLabel }, label),
        React.createElement("div", { style: cardNum }, value),
        sub != null ? React.createElement("div", { style: dim }, sub) : null
      );
    }

    /**
     * 近 30 天柱状图：每天一根柱，两段堆叠——下段输入（灰）、上段输出（绿）。
     * 缓存读取体量比输入输出大一两个数量级，进柱子会把曲线压死，放 tooltip。
     * 以普通函数直接调用（非组件类型），让调用方的 try/catch 能接住渲染异常。
     */
    function DayChart(days) {
      var max = 0;
      for (var i = 0; i < days.length; i++) {
        var total = days[i].inputTokens + days[i].outputTokens;
        if (total > max) max = total;
      }
      if (max === 0) return React.createElement("div", { style: dim }, "最近 30 天无用量。");
      var barArea = { display: "flex", alignItems: "flex-end", gap: "2px", height: "120px", marginTop: "10px" };
      return React.createElement(
        "div",
        null,
        React.createElement(
          "div",
          { style: barArea },
          days.map(function (d) {
            var h = function (v) { return Math.round((v / max) * 112); };
            var title = d.day +
              "\n输入 " + fmtTokens(d.inputTokens) +
              " · 输出 " + fmtTokens(d.outputTokens) +
              "\n缓存读 " + fmtTokens(d.cacheReadTokens) +
              " · 推理 " + fmtTokens(d.reasoningTokens) +
              "\n请求 " + d.requests + " 次";
            return React.createElement(
              "div",
              {
                key: d.day,
                title: title,
                style: { flex: "1 1 0", minWidth: "6px", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", cursor: "default" }
              },
              React.createElement("div", { style: { height: h(d.outputTokens), background: "#4ade80", borderRadius: "2px 2px 0 0", minHeight: d.outputTokens > 0 ? 2 : 0 } }),
              React.createElement("div", { style: { height: h(d.inputTokens), background: "rgba(128,128,128,0.45)", minHeight: d.inputTokens > 0 ? 2 : 0 } })
            );
          })
        ),
        React.createElement(
          "div",
          { style: Object.assign({}, dim, { display: "flex", gap: "2px", marginTop: "4px" }) },
          days.map(function (d) {
            var show = parseInt(d.day.slice(8), 10) % 5 === 0 || d.day === days[days.length - 1].day;
            return React.createElement("div", { key: d.day, style: { flex: "1 1 0", minWidth: "6px", textAlign: "center", overflow: "visible", fontSize: "10px" } }, show ? d.day.slice(5) : "");
          })
        ),
        React.createElement(
          "div",
          { style: Object.assign({}, dim, { marginTop: "6px" }) },
          "图例：", React.createElement("span", { style: { color: "#4ade80", fontWeight: 700 } }, "■ 输出"), "　",
          React.createElement("span", { style: { opacity: 0.85 } }, "■ 输入"), "（悬停查看缓存读 / 推理 / 请求数）"
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
            return React.createElement("th", { key: i, style: Object.assign({}, th, h.num ? num : null) }, h.label);
          }))
        ),
        React.createElement(
          "tbody",
          null,
          rows
        )
      );
    }

    /* ---------- 页面 ---------- */

    var RANGES = [
      { key: "all", label: "全部" },
      { key: "30", label: "近30日" },
      { key: "7", label: "近7日" },
      { key: "1", label: "今日" }
    ];

    function UsageStatsPage() {
      var loading = React.useState(true);
      var data = React.useState(null);
      var error = React.useState(null);
      var rangeState = React.useState("all");
      var setLoading = loading[1];
      var setData = data[1];
      var setError = error[1];
      var setRange = rangeState[1];

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

      var d = data[0];
      if (loading[0] && d == null) {
        return React.createElement("div", null, React.createElement("h3", { style: { marginTop: 0 } }, "使用统计"), React.createElement("div", { style: dim }, "加载中…（首次统计需解码全部会话，可能需要几秒）"));
      }
      if (error[0] != null) {
        return React.createElement("div", null, React.createElement("h3", { style: { marginTop: 0 } }, "使用统计"), React.createElement("div", { style: { color: "#b02a37", padding: "8px 12px", background: "rgba(220,53,69,0.12)", borderRadius: "6px", fontSize: "13px" } }, "加载失败：", error[0]));
      }
      if (d == null) return React.createElement("div", null, React.createElement("h3", { style: { marginTop: 0 } }, "使用统计"));
      try {
        return UsageStatsPageBody(d, function (force) { load(force); }, rangeState[0], setRange);
      } catch (e) {
        return React.createElement(
          "div",
          { style: { padding: "12px", color: "#b02a37" } },
          React.createElement("h3", null, "渲染异常（诊断模式）"),
          React.createElement("div", null, String((e && e.message) || e)),
          React.createElement("pre", { style: { whiteSpace: "pre-wrap", fontSize: "11px" } }, String((e && e.stack) || ""))
        );
      }
    }

    function UsageStatsPageBody(d, reload, range, setRange) {
      // 时间窗口：all → 全程；否则取 byDay 末尾 N 天（byDay 为零填充的最近 30 天）
      var winN = range === "all" ? null : parseInt(range, 10);
      var fromIdx = winN == null ? 0 : Math.max(0, d.byDay.length - winN);
      var winDays = d.byDay.slice(fromIdx);
      var winSet = null;
      if (winN != null) {
        winSet = {};
        for (var wi = 0; wi < winDays.length; wi++) winSet[winDays[wi].day] = true;
      }
      var rangeTotals = winN == null ? d.totals : sumDays(winDays);
      var rangeLabel = winN == null ? "" : "（范围：" + (winN === 1 ? "今日" : "近 " + winN + " 日") + "）";

      var rangeButtons = React.createElement(
        "div",
        { style: { display: "flex", gap: "6px", marginTop: "8px" } },
        RANGES.map(function (r) {
          var active = r.key === range;
          return React.createElement(
            "button",
            {
              key: r.key,
              style: Object.assign({}, btn, active
                ? { background: "rgba(74,222,128,0.18)", borderColor: "rgba(74,222,128,0.7)", fontWeight: 700 }
                : null),
              onClick: function () { setRange(r.key); }
            },
            r.label
          );
        })
      );

      var header = React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" } },
        React.createElement("h3", { style: { margin: 0, flex: 1 } }, "使用统计"),
        React.createElement("button", { style: btn, onClick: function () { reload(true); } }, "强制重算"),
        React.createElement("button", { style: btn, onClick: function () { reload(false); } }, "刷新")
      );

      var t = rangeTotals;
      var meta = React.createElement(
        "div",
        { style: dim },
        (winN == null ? d.sessionCount + " 个会话 · " : "") + t.requests + " 次请求" + rangeLabel +
        " · 生成于 " + fmtTime(d.generatedAt) +
        "（" + fmtDuration(d.durationMs) + "，解码 " + d.decoded + " / 复用 " + d.reused + "）· 数据源 " + d.home
      );

      var cards = React.createElement(
        "div",
        { style: { display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" } },
        Card("会话", String(d.sessionCount), "共 " + d.turns + " 轮对话（全程）"),
        Card("模型请求" + (winN == null ? "" : "·窗口"), String(t.requests), "纯模型时间 " + fmtDuration(d.llmMs) + "（全程）"),
        Card("未命中输入", fmtTokens(t.inputTokens), "缓存写 " + fmtTokens(t.cacheWriteTokens)),
        Card("输出", fmtTokens(t.outputTokens), "其中推理 " + fmtTokens(t.reasoningTokens)),
        Card("命中输入", fmtTokens(t.cacheReadTokens), "缓存读取"),
        Card("生成速度", fmtSpeed(d.totals.outputTokens, d.llmMs), "全程输出 tokens ÷ 模型时间")
      );

      var modelRows = d.byModel.map(function (m) {
        var v = modelInView(m, winSet);
        return React.createElement(
          "tr",
          { key: m.model },
          React.createElement("td", { style: td }, m.model),
          React.createElement("td", { style: Object.assign({}, td, num, { fontWeight: 600 }), title: "输出 : 命中输入 : 未命中输入（归一到输出=1）" }, fmtRatio(v.outputTokens, v.cacheReadTokens, v.inputTokens)),
          React.createElement("td", { style: Object.assign({}, td, num) }, String(v.requests)),
          React.createElement("td", { style: Object.assign({}, td, num) }, fmtTokens(v.inputTokens)),
          React.createElement("td", { style: Object.assign({}, td, num) }, fmtTokens(v.outputTokens)),
          React.createElement("td", { style: Object.assign({}, td, num) }, fmtTokens(v.reasoningTokens)),
          React.createElement("td", { style: Object.assign({}, td, num) }, fmtTokens(v.cacheReadTokens)),
          React.createElement("td", { style: Object.assign({}, td, num, dim) }, String(m.sessions))
        );
      });

      var sessionRows = d.topSessions.map(function (s) {
        return React.createElement(
          "tr",
          { key: s.id },
          React.createElement("td", { style: Object.assign({}, td, { maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis" }), title: s.title + "　" + (s.cwd || "") }, s.title),
          React.createElement("td", { style: Object.assign({}, td, dim, { maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis" }), title: s.cwd || "" }, s.cwd ? String(s.cwd).split(/[\\/]/).filter(Boolean).pop() : "–"),
          React.createElement("td", { style: Object.assign({}, td, num) }, fmtDate(s.createdAt)),
          React.createElement("td", { style: Object.assign({}, td, num) }, String(s.requests)),
          React.createElement("td", { style: Object.assign({}, td, num) }, fmtTokens(s.outputTokens)),
          React.createElement("td", { style: Object.assign({}, td, num, { fontWeight: 600 }) }, fmtTokens(s.tokens))
        );
      });

      var toolRows = d.tools.map(function (tool) {
        return React.createElement(
          "tr",
          { key: tool.name },
          React.createElement("td", { style: td }, tool.name),
          React.createElement("td", { style: Object.assign({}, td, num) }, String(tool.calls)),
          React.createElement("td", { style: Object.assign({}, td, num) }, fmtDuration(tool.ms)),
          React.createElement("td", { style: Object.assign({}, td, num, dim) }, tool.calls > 0 ? (tool.ms / tool.calls / 1000).toFixed(1) + " s/次" : "–")
        );
      });

      var errorBox = d.errors && d.errors.length > 0
        ? React.createElement("div", { style: Object.assign({}, dim, { marginTop: "10px" }) }, "部分会话解码失败（已跳过）：", d.errors.join("；"))
        : null;

      return React.createElement(
        "div",
        null,
        header,
        rangeButtons,
        meta,
        errorBox,
        cards,
        React.createElement("h4", { style: sectionTitle }, (winN == null ? "近 30 天用量" : winN === 1 ? "今日用量" : "近 " + winN + " 天用量") + (winN == null ? "（图表固定 30 天，切换范围看模型表）" : "")),
        DayChart(winN == null ? d.byDay : winDays),
        React.createElement("h4", { style: sectionTitle }, "按模型" + rangeLabel),
        Table(
          [
            { label: "模型" },
            { label: "比值", num: true },
            { label: "请求", num: true },
            { label: "未命中输入", num: true },
            { label: "输出", num: true },
            { label: "推理", num: true },
            { label: "命中输入", num: true },
            { label: "会话数", num: true }
          ],
          modelRows
        ),
        React.createElement("h4", { style: sectionTitle }, "会话用量 Top " + d.topSessions.length + "（全部历史）"),
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
        ),
        React.createElement("h4", { style: sectionTitle }, "工具调用 Top " + d.tools.length + "（全部历史）"),
        Table(
          [
            { label: "工具" },
            { label: "次数", num: true },
            { label: "总耗时", num: true },
            { label: "平均", num: true }
          ],
          toolRows
        )
      );
    }

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
    exports.apply = apply;
    return module.exports;
  }
});
