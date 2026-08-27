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
     * 近 N 日用量图：每天一根柱，输出（绿）堆在输入（灰）之上。
     * 叠加 4 条参考线（25/50/75/100%）+ today 竖线 + peak 徽章 + 摘要脚注。
     * 缓存读 / 推理 / 请求数走原生 title tooltip（hover 单柱）。
     */
    function DayChart(days) {
      var N = days.length;
      var max = 0;
      var peakIdx = -1;
      var totalInput = 0;
      var totalOutput = 0;
      for (var i = 0; i < N; i++) {
        var di = days[i];
        var tot = di.inputTokens + di.outputTokens;
        if (tot > max) { max = tot; peakIdx = i; }
        totalInput += di.inputTokens || 0;
        totalOutput += di.outputTokens || 0;
      }
      if (max === 0) {
        return React.createElement(
          "div",
          { style: Object.assign({}, s.meta, { padding: "20px 0" }) },
          "近 " + N + " 天无用量。"
        );
      }
      var todayIdx = N - 1;
      var todayCenter = ((todayIdx + 0.5) / N) * 100;
      var peakCenter = ((peakIdx + 0.5) / N) * 100;
      var peakLabel = "峰值 " + fmtTokens(days[peakIdx].inputTokens + days[peakIdx].outputTokens) +
        " · " + days[peakIdx].day.slice(5);
      function hPx(v) { return Math.round((v / max) * 96); }
      return React.createElement(
        "div",
        { style: s.chartSection },
        // 内嵌图例 + 提示
        React.createElement(
          "div",
          { style: s.chartLegend },
          React.createElement(
            "span",
            { style: { display: "inline-flex", alignItems: "center", gap: "6px" } },
            React.createElement("span", { style: { display: "inline-block", width: "10px", height: "3px", background: C.outputBar, borderRadius: "1px" } }),
            "输出"
          ),
          React.createElement(
            "span",
            { style: { display: "inline-flex", alignItems: "center", gap: "6px" } },
            React.createElement("span", { style: { display: "inline-block", width: "10px", height: "3px", background: C.inputBar, borderRadius: "1px" } }),
            "输入"
          ),
          React.createElement("span", { style: s.chartLegendHint }, "悬停查看缓存读 / 推理 / 请求数")
        ),
        // 图表本体（绝对定位叠层：网格 / today / peak / 柱子）
        React.createElement(
          "div",
          { style: s.chartWrap },
          // 网格：3 条虚线 + 1 条实线基线
          React.createElement("div", { style: Object.assign({}, s.chartGridLine, { top: "25%" }) }),
          React.createElement("div", { style: Object.assign({}, s.chartGridLine, { top: "50%" }) }),
          React.createElement("div", { style: Object.assign({}, s.chartGridLine, { top: "75%" }) }),
          React.createElement("div", { style: Object.assign({}, s.chartGridBase, { top: "100%" }) }),
          // today 竖线
          React.createElement("div", { style: Object.assign({}, s.chartTodayLine, { left: todayCenter + "%" }) }),
          // peak 竖线 + 徽章（始终在顶部 -2px，不与柱顶耦合）
          React.createElement("div", { style: Object.assign({}, s.chartPeakLine, { left: peakCenter + "%" }) }),
          React.createElement("div", {
            style: Object.assign({}, s.chartPeakBadge, { left: peakCenter + "%", top: "-2px" }),
            title: "峰值日"
          }, peakLabel),
          // 柱子（输出在上、输入在下）
          React.createElement(
            "div",
            { style: s.chartBarsRow },
            days.map(function (d, i) {
              var title = d.day +
                " · 输入 " + fmtTokens(d.inputTokens) +
                " · 输出 " + fmtTokens(d.outputTokens) +
                "\n缓存读 " + fmtTokens(d.cacheReadTokens) +
                " · 推理 " + fmtTokens(d.reasoningTokens) +
                " · 请求 " + d.requests + " 次";
              return React.createElement(
                "div",
                { key: d.day, title: title, style: s.chartBar },
                React.createElement("div", { style: Object.assign({}, s.chartBarOut, { height: hPx(d.outputTokens) + "px", background: C.outputBar }) }),
                React.createElement("div", { style: Object.assign({}, s.chartBarIn, { height: hPx(d.inputTokens) + "px", background: C.inputBar }) })
              );
            })
          )
        ),
        // X 轴日期（today 加粗；每 5 天 + 末位显示）
        React.createElement(
          "div",
          { style: s.chartAxisRow },
          days.map(function (d, i) {
            var show = parseInt(d.day.slice(8), 10) % 5 === 0 || i === todayIdx;
            var isToday = i === todayIdx;
            return React.createElement("div", {
              key: d.day,
              style: isToday ? s.chartAxisToday : s.chartAxis,
              title: d.day
            }, show ? d.day.slice(5) : "");
          })
        ),
        // 摘要：总量 + 输出（强调色） + 峰值日（陶土色）
        React.createElement(
          "div",
          { style: s.chartSummary },
          React.createElement("span", { style: s.chartSummaryTotal }, "总量 ", fmtTokens(totalInput + totalOutput)),
          React.createElement("span", null, "输出 ", React.createElement("span", { style: { color: C.accent, fontWeight: 600 } }, fmtTokens(totalOutput))),
          React.createElement("span", { style: s.chartSummaryPeak }, peakLabel)
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