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

    /**
     * GitHub 风格贡献热力图（v0.2.2）：53 周 × 7 日方格日历。
     *
     * 输入：
     *   days — byDay 数组（任意顺序，内部排序；可空）
     *   modelFilter — 模型筛选字符串，null = 全部模型聚合
     *   byModel — 完整按模型数组，用于构造 modelDays 索引
     *
     * 渲染：53 周 × 7 日方格（周一在上），5 级颜色严控色板膨胀——
     *   L1-L3 蓝主对浅→深（复用 inputBarSoft 渐进浓度）
     *   L4 橙（outputBar 同色）= 爆日（≥60% max）
     *   L5 rose（peakLine 同色）= 异常日（≥90% max）
     *
     * 月份标签：每跨周首日落新月份时显示「N 月」，absolute 定位到 grid 上方。
     * 悬停 title：日期 + 输入 / 输出 / 请求数 + 当前筛选模型。
     */
    function HeatmapCalendar(days, modelFilter, byModel) {
      if (days == null || days.length === 0) {
        return React.createElement("div", { style: s.heatmapEmpty }, "暂无日级用量。");
      }
      // 预构造 modelDays 索引（按 model name → { day → bucket }）
      var modelIndex = null;
      if (modelFilter != null && byModel != null) {
        modelIndex = {};
        for (var mi = 0; mi < byModel.length; mi++) {
          var m = byModel[mi];
          if (m && m.model) modelIndex[m.model] = m.days || {};
        }
      }
      // dayMap: YYYY-MM-DD → { input, output, requests, total }
      var dayMap = {};
      var max = 0;
      for (var di = 0; di < days.length; di++) {
        var day = days[di];
        var input = day.inputTokens || 0;
        var output = day.outputTokens || 0;
        var requests = day.requests || 0;
        if (modelIndex != null && modelIndex[modelFilter] && modelIndex[modelFilter][day.day]) {
          var md = modelIndex[modelFilter][day.day];
          input = md.inputTokens || 0;
          output = md.outputTokens || 0;
        }
        var tot = input + output;
        if (tot > max) max = tot;
        dayMap[day.day] = { input: input, output: output, requests: requests, total: tot };
      }
      if (max === 0) {
        return React.createElement("div", { style: s.heatmapEmpty }, "暂无用量。");
      }

      // 时间范围：days 内最早 → 最晚
      var firstDay = null;
      var lastDay = null;
      for (var di2 = 0; di2 < days.length; di2++) {
        var d2 = days[di2].day;
        if (firstDay == null || d2 < firstDay) firstDay = d2;
        if (lastDay == null || d2 > lastDay) lastDay = d2;
      }
      var fp = firstDay.split("-");
      var firstDate = new Date(Date.UTC(+fp[0], +fp[1] - 1, +fp[2]));
      var lp = lastDay.split("-");
      var lastDate = new Date(Date.UTC(+lp[0], +lp[1] - 1, +lp[2]));
      // 周一在上 → UTC dow (0=Sun..6=Sat) 转为 0=Mon..6=Sun
      var firstDow = (firstDate.getUTCDay() + 6) % 7;

      // 总周数（含 firstDow 偏移的左侧空列）
      var totalDaysSpan = Math.floor((lastDate.getTime() - firstDate.getTime()) / 86400000) + 1;
      var totalWeeks = Math.ceil((totalDaysSpan + firstDow) / 7);
      // 限 53 周：超出则左截，firstDate 后移到 skipWeeks 周之后
      if (totalWeeks > 53) {
        var skipWeeks = totalWeeks - 53;
        firstDate = new Date(firstDate.getTime() + skipWeeks * 7 * 86400000);
        firstDow = (firstDate.getUTCDay() + 6) % 7;
        totalWeeks = 53;
      }

      // 5 级阈值（基于 max 归一）
      function levelFor(tot) {
        if (tot <= 0) return 0;
        var r = tot / max;
        if (r >= 0.9) return 5;
        if (r >= 0.6) return 4;
        if (r >= 0.3) return 3;
        if (r >= 0.1) return 2;
        return 1;
      }
      function cellBgStyle(lv) {
        if (lv === 1) return s.heatmapCellL1;
        if (lv === 2) return s.heatmapCellL2;
        if (lv === 3) return s.heatmapCellL3;
        if (lv === 4) return s.heatmapCellL4;
        if (lv === 5) return s.heatmapCellL5;
        return null;
      }

      // 月份切换标签收集（每跨周首日落新月份时显示「N 月」）
      var monthLabels = [];
      var prevMonth = -1;
      var weekCols = [];
      for (var wi = 0; wi < totalWeeks; wi++) {
        var weekStart = new Date(firstDate.getTime() + (wi * 7 - firstDow) * 86400000);
        var m = weekStart.getUTCMonth();
        if (m !== prevMonth && weekStart.getTime() <= lastDate.getTime()) {
          monthLabels.push({ weekIdx: wi, label: (m + 1) + "月" });
          prevMonth = m;
        }
        var dayCells = [];
        for (var dwi = 0; dwi < 7; dwi++) {
          var dayOffset = wi * 7 + dwi - firstDow;
          var cellDate = new Date(firstDate.getTime() + dayOffset * 86400000);
          if (dayOffset < 0 || cellDate.getTime() > lastDate.getTime()) {
            // 左侧留白（firstDow 之前）或右侧留白
            dayCells.push(React.createElement("div", { key: dwi, style: s.heatmapCell }));
            continue;
          }
          var ck = cellDate.getUTCFullYear() + "-" +
            ("0" + (cellDate.getUTCMonth() + 1)).slice(-2) + "-" +
            ("0" + cellDate.getUTCDate()).slice(-2);
          var info = dayMap[ck];
          var lv = info ? levelFor(info.total) : 0;
          var bg = cellBgStyle(lv);
          var cellStyleMerged = bg ? Object.assign({}, s.heatmapCell, bg) : s.heatmapCell;
          var titleText;
          if (info) {
            titleText = ck + "\n输入 " + fmtTokens(info.input) + "\n输出 " + fmtTokens(info.output) +
              "\n请求 " + info.requests + " 次" +
              (modelFilter ? "\n模型 " + modelFilter : "");
          } else {
            titleText = ck + "（无用量）";
          }
          dayCells.push(React.createElement("div", { key: dwi, title: titleText, style: cellStyleMerged }));
        }
        weekCols.push(React.createElement("div", { key: wi, style: s.heatmapWeekCol }, dayCells));
      }

      // 月份行（absolute 定位到 grid 上方，与周列同左对齐）
      var weekColWidth = 11; // cell width
      var weekGap = 2;
      var weekStride = weekColWidth + weekGap;
      var monthRowNodes = monthLabels.map(function (ml) {
        return React.createElement(
          "div",
          {
            key: ml.weekIdx,
            style: Object.assign({}, s.heatmapMonthCell, { left: (ml.weekIdx * weekStride) + "px" })
          },
          ml.label
        );
      });

      // 星期标签（周一/三/五可见，其余 hidden 占位对齐）
      var dowLabels = ["一", "", "三", "", "五", "", ""];
      var dowLabelNodes = dowLabels.map(function (lbl, i) {
        return React.createElement(
          "div",
          { key: i, style: Object.assign({}, s.heatmapDowLabel, { visibility: lbl === "" ? "hidden" : "visible" }) },
          lbl
        );
      });

      // 图例
      var legend = React.createElement(
        "div",
        { style: s.heatmapLegend },
        React.createElement("span", null, "少"),
        React.createElement("div", { style: Object.assign({}, s.heatmapScaleCell) }),
        React.createElement("div", { style: Object.assign({}, s.heatmapScaleCell, s.heatmapCellL1) }),
        React.createElement("div", { style: Object.assign({}, s.heatmapScaleCell, s.heatmapCellL2) }),
        React.createElement("div", { style: Object.assign({}, s.heatmapScaleCell, s.heatmapCellL3) }),
        React.createElement("div", { style: Object.assign({}, s.heatmapScaleCell, s.heatmapCellL4) }),
        React.createElement("div", { style: Object.assign({}, s.heatmapScaleCell, s.heatmapCellL5) }),
        React.createElement("span", null, "多"),
        React.createElement("span", { style: s.heatmapLegendHint }, "过去 53 周 · 悬停查看当日明细")
      );

      return React.createElement(
        "div",
        { style: s.heatmapSection },
        legend,
        React.createElement(
          "div",
          { style: Object.assign({}, s.heatmapWrap, { position: "relative" }) },
          React.createElement(
            "div",
            { style: Object.assign({}, s.heatmapMonthRow, { position: "relative", height: "12px" }) },
            monthRowNodes
          ),
          React.createElement(
            "div",
            { style: s.heatmapBodyRow },
            React.createElement("div", { style: s.heatmapDowCol }, dowLabelNodes),
            React.createElement("div", { style: s.heatmapGrid }, weekCols)
          )
        )
      );
    }