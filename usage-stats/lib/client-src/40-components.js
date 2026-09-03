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
     * 用量柱状图（v0.3.0 多粒度）：按 granularity（day / hour / minute / week）渲染。
     * 输入 buckets 是 byTrend[granularity] 子集（零填充过的窗口序列）。
     * 每桶一根柱，输出（橙）堆在输入（蓝）之上。minute 模式 N=1440 时容器
     * 设 overflow-x: auto 让用户横向滚动；其它模式 wrap。
     * X 轴标签按 granularity 用 fmtBucket 格式化（MM-DD / MM-DD HH / MM-DD HH:mm / 周一日期）。
     * 峰值 / today 竖线 / 网格 / 4 条参考线 / 摘要脚注 行为同 v0.2.1。
     */
    function DayChart(buckets, granularity) {
      var N = buckets.length;
      if (N === 0) {
        return React.createElement(
          "div",
          { style: Object.assign({}, s.meta, { padding: "20px 0" }) },
          "当前范围无用量。"
        );
      }
      var max = 0;
      var peakIdx = -1;
      var totalInput = 0;
      var totalOutput = 0;
      for (var i = 0; i < N; i++) {
        var di = buckets[i];
        var tot = di.inputTokens + di.outputTokens;
        if (tot > max) { max = tot; peakIdx = i; }
        totalInput += di.inputTokens || 0;
        totalOutput += di.outputTokens || 0;
      }
      if (max === 0) {
        return React.createElement(
          "div",
          { style: Object.assign({}, s.meta, { padding: "20px 0" }) },
          "当前范围 " + N + " 桶无用量。"
        );
      }
      // 自适应柱宽（minute 极窄 / hour 中等 / day/week 较宽）+ 总容器宽度由 N 算
      var pxPerBar = granularity === "minute" ? 3 : (granularity === "hour" ? 8 : 22);
      var totalWidth = N * pxPerBar + (N - 1) * 2;
      var todayIdx = N - 1;
      var todayCenter = ((todayIdx + 0.5) / N) * 100;
      var peakCenter = ((peakIdx + 0.5) / N) * 100;
      function bucketKey(b) { return b.bucket != null ? b.bucket : b.day; }
      function hPx(v) { return Math.round((v / max) * 96); }
      function axisLabel(b) { return fmtBucket(bucketKey(b), granularity); }
      // X 轴稀疏显示：按 N 算步长，避免标签重叠（minute 每 120 标一次 / hour 每 12 / day 每 5）
      var axisStep = N <= 12 ? 1 : (N <= 60 ? 5 : (N <= 168 ? 12 : (N <= 360 ? 30 : 120)));
      function showAxis(i) {
        return (i % axisStep === 0) || i === todayIdx;
      }
      var peakLabel = "峰值 " + fmtTokens(buckets[peakIdx].inputTokens + buckets[peakIdx].outputTokens) +
        " · " + fmtBucket(bucketKey(buckets[peakIdx]), granularity);
      return React.createElement(
        "div",
        { style: s.chartSection },
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
          React.createElement("span", { style: s.chartLegendHint }, "悬停查看缓存读 / 推理 / 请求数 · " + (granularity || "day") + " · " + N + " 桶")
        ),
        React.createElement(
          "div",
          { style: s.chartWrap },
          React.createElement("div", { style: Object.assign({}, s.chartGridLine, { top: "25%" }) }),
          React.createElement("div", { style: Object.assign({}, s.chartGridLine, { top: "50%" }) }),
          React.createElement("div", { style: Object.assign({}, s.chartGridLine, { top: "75%" }) }),
          React.createElement("div", { style: Object.assign({}, s.chartGridBase, { top: "100%" }) }),
          React.createElement("div", { style: Object.assign({}, s.chartTodayLine, { left: todayCenter + "%" }) }),
          React.createElement("div", { style: Object.assign({}, s.chartPeakLine, { left: peakCenter + "%" }) }),
          React.createElement("div", {
            style: Object.assign({}, s.chartPeakBadge, { left: peakCenter + "%", top: "-2px" }),
            title: "峰值桶"
          }, peakLabel),
          React.createElement(
            "div",
            { style: Object.assign({}, s.chartBarsRow, { width: totalWidth + "px" }) },
            buckets.map(function (b, i) {
              var k = bucketKey(b);
              var title = k +
                " · 输入 " + fmtTokens(b.inputTokens) +
                " · 输出 " + fmtTokens(b.outputTokens) +
                "\n缓存读 " + fmtTokens(b.cacheReadTokens) +
                " · 推理 " + fmtTokens(b.reasoningTokens) +
                " · 请求 " + b.requests + " 次";
              return React.createElement(
                "div",
                { key: k, title: title, style: Object.assign({}, s.chartBar, { width: pxPerBar + "px" }) },
                React.createElement("div", { style: Object.assign({}, s.chartBarOut, { height: hPx(b.outputTokens) + "px", background: C.outputBar }) }),
                React.createElement("div", { style: Object.assign({}, s.chartBarIn, { height: hPx(b.inputTokens) + "px", background: C.inputBar }) })
              );
            })
          )
        ),
        React.createElement(
          "div",
          { style: Object.assign({}, s.chartAxisRow, { width: totalWidth + "px" }) },
          buckets.map(function (b, i) {
            var k = bucketKey(b);
            var isToday = i === todayIdx;
            return React.createElement("div", {
              key: k,
              style: Object.assign({}, isToday ? s.chartAxisToday : s.chartAxis, { width: pxPerBar + "px" }),
              title: k
            }, showAxis(i) ? axisLabel(b) : "");
          })
        ),
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

      // 7 级阈值（基于 max 归一）——v0.3.2 用户反馈"级别多一点"，从 5 级扩 7 级
      function levelFor(tot) {
        if (tot <= 0) return 0;
        var r = tot / max;
        if (r >= 0.9) return 7;
        if (r >= 0.7) return 6;
        if (r >= 0.5) return 5;
        if (r >= 0.3) return 4;
        if (r >= 0.15) return 3;
        if (r >= 0.05) return 2;
        return 1;
      }
      function cellBgStyle(lv) {
        if (lv === 1) return s.heatmapCellL1;
        if (lv === 2) return s.heatmapCellL2;
        if (lv === 3) return s.heatmapCellL3;
        if (lv === 4) return s.heatmapCellL4;
        if (lv === 5) return s.heatmapCellL5;
        if (lv === 6) return s.heatmapCellL6;
        if (lv === 7) return s.heatmapCellL7;
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
        React.createElement("div", { style: Object.assign({}, s.heatmapScaleCell, s.heatmapCellL6) }),
        React.createElement("div", { style: Object.assign({}, s.heatmapScaleCell, s.heatmapCellL7) }),
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