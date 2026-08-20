// ===== components =====
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
    }