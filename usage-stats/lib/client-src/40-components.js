    // ===== components =====
    /**
     * v0.5.0 扫描状态行。
     *
     * host 半段每次请求都立即返回"已发布快照"，后台扫描在单飞推进；因此客户端需要
     * 一个进度与新鲜度的可视入口：
     *   - scanning：后台重算中（done/total + 进度条），首次安装或全量重建时会持续一段时间
     *   - legacy：当前展示的是 v0.4.x 旧缓存的占位数据，等重算完成后自动被真实值覆盖
     *   - 常态：数据截至时间 + 上次扫描耗时 + 生命周期空洞诊断计数
     *   - errorCount > 0：切换成警示配色并提示条数（明细在 errors 盒里）
     */
    function ScanStatus(d) {
      var scanning = d.scanning === true;
      var legacy = d.legacy === true;
      var progress = d.scanProgress || null;
      var pct = 0;
      if (progress != null && progress.total > 0) {
        pct = Math.max(0, Math.min(100, Math.round((progress.done / progress.total) * 100)));
      }
      var pieces = [];
      if (scanning) {
        pieces.push("后台重算中");
        if (progress != null) {
          if (progress.total > 0) pieces.push(progress.done + "/" + progress.total + " 会话");
          else pieces.push("发现会话中");
          if (progress.changed != null) pieces.push("本次重折 " + progress.changed + " · 复用 " + progress.reused);
        }
        if (legacy) pieces.push("当前展示旧缓存占位数据，重算完成后自动替换");
      } else if (legacy) {
        pieces.push("当前展示旧缓存数据，等待重算完成");
      } else {
        pieces.push("数据已是最新");
        if (d.dataAsOf != null) pieces.push("截至 " + fmtTime(d.dataAsOf));
        if (d.lastScanAt != null) pieces.push("上次扫描 " + fmtTime(d.lastScanAt));
        if (d.reused != null && d.reused > 0) pieces.push("复用 " + d.reused + " 个会话");
      }
      // 实时支路（v0.5.0）：当前会话的用量不必等落盘，直接逐事件折叠
      if (d.live != null && d.live.active > 0) {
        pieces.push(d.live.ahead > 0
          ? "实时跟踪 " + d.live.active + " 个会话（含未落盘增量）"
          : "实时跟踪 " + d.live.active + " 个会话");
      }
      if (d.restartFolds > 0) pieces.push(d.restartFolds + " 个会话日志被改写，已重折叠");
      if (d.errorCount > 0) pieces.push(d.errorCount + " 个会话失败");

      var warn = d.errorCount > 0;
      return React.createElement(
        "div",
        { style: warn ? Object.assign({}, s.statusBar, s.statusWarn) : s.statusBar, "data-usage-stats-status": scanning ? "scanning" : (legacy ? "legacy" : "idle") },
        React.createElement("span", { style: s.statusDot }),
        React.createElement("span", null, pieces.join(" · ")),
        scanning && progress != null && progress.total > 0
          ? React.createElement(
            "span",
            { style: s.statusTrack },
            React.createElement("span", { style: Object.assign({}, s.statusFill, { width: pct + "%" }) })
          )
          : null
      );
    }

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
     * 用量柱状图（v0.3.0 多粒度；v0.4.1 5 段堆叠）。
     *
     * 输入 buckets 是 byTrend[granularity] 子集（零填充过的窗口序列）。
     *
     * v0.4.1 改造：每根柱从 v0.3.0 的 2 段堆叠（input 蓝 + output 橙）
     * 升级为 5 段堆叠，按"色温从冷到暖"自底向上：
     *   1. cacheWrite  #93c5fd  最便宜
     *   2. cacheRead   #60a5fa  折扣
     *   3. inputMiss   #3b82f6  全价输入
     *   4. output      #f59e0b  输出（不含推理）
     *   5. reasoning   #fbbf24  推理（output 的子集，黄色封顶）
     *
     * 数学约定：reasoning 是 output 的子集，所以 output 段高度 = max(0, output - reasoning)。
     * 这样 5 段总高 = cacheWrite + cacheRead + inputMiss + (output - reasoning) + reasoning
     *             = cacheWrite + cacheRead + inputMiss + output
     *             = totalTokensOf()（不重复算 reasoning）。
     *
     * minute 模式 N=1440 时容器设 overflow-x: auto 让用户横向滚动；其它模式 wrap。
     * 柱宽相对 v0.3.0 收紧：minute 3→2 / hour 8→6 / day|week 22→18。
     * peak 用 input+output+cacheRead+cacheWrite 全量（不含 reasoning 避免双计）。
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
      // [perf v0.4.x] 预合并 5 段柱样式：s.chartBarIn 共享 base（minHeight: 0），
      // 每段只是 background 不同。预合并省 1440 × 4 = 5760 次 Object.assign。
      var barReasoning = Object.assign({}, s.chartBarOut, { background: C.reasoningBar });
      var barOutput = Object.assign({}, s.chartBarIn, { background: C.outputBar });
      var barInput = Object.assign({}, s.chartBarIn, { background: C.inputBar });
      var barCacheRead = Object.assign({}, s.chartBarIn, { background: C.cacheReadBar });
      var barCacheWrite = Object.assign({}, s.chartBarIn, { background: C.cacheWriteBar });
      // v0.4.1：peak 用 totalTokensOf 等价口径——cacheWrite + cacheRead + inputMiss + output，
      // 排除 reasoning（reasoning ⊂ output，避免峰值与 output 段双计）。
      var max = 0;
      var peakIdx = -1;
      var totalInput = 0;
      var totalOutput = 0;
      var totalCacheRead = 0;
      var totalCacheWrite = 0;
      var totalReasoning = 0;
      for (var i = 0; i < N; i++) {
        var di = buckets[i];
        // reasoning 限制在 output 以内（防御性：极少有 provider 报 reasoning > output）
        var outMinusReason = Math.max(0, (di.outputTokens || 0) - Math.min(di.outputTokens || 0, di.reasoningTokens || 0));
        var tot = (di.cacheWriteTokens || 0) + (di.cacheReadTokens || 0) + (di.inputTokens || 0) + outMinusReason;
        if (tot > max) { max = tot; peakIdx = i; }
        totalInput += di.inputTokens || 0;
        totalOutput += di.outputTokens || 0;
        totalCacheRead += di.cacheReadTokens || 0;
        totalCacheWrite += di.cacheWriteTokens || 0;
        totalReasoning += di.reasoningTokens || 0;
      }
      if (max === 0) {
        return React.createElement(
          "div",
          { style: Object.assign({}, s.meta, { padding: "20px 0" }) },
          "当前范围 " + N + " 桶无用量。"
        );
      }
      // v0.4.1：柱宽收紧（minute 3→2 / hour 8→6 / day|week 22→18）。原宽度下日级 30 桶已
      // 占满 600+ 像素并触发横向滚动；5 段堆叠后视觉密度更高，柱宽略收反而更易扫读。
      var pxPerBar = granularity === "minute" ? 2 : (granularity === "hour" ? 6 : 18);
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
      var peakOutMinusReason = Math.max(0, (buckets[peakIdx].outputTokens || 0) - Math.min(buckets[peakIdx].outputTokens || 0, buckets[peakIdx].reasoningTokens || 0));
      var peakTotal = (buckets[peakIdx].cacheWriteTokens || 0) + (buckets[peakIdx].cacheReadTokens || 0) + (buckets[peakIdx].inputTokens || 0) + peakOutMinusReason;
      var peakLabel = "峰值 " + fmtTokens(peakTotal) +
        " · " + fmtBucket(bucketKey(buckets[peakIdx]), granularity);
      return React.createElement(
        "div",
        { style: s.chartSection },
        // v0.4.1：图例 5 色（与 5 段堆叠一一对应）
        React.createElement(
          "div",
          { style: s.chartLegend },
          React.createElement(
            "span",
            { style: { display: "inline-flex", alignItems: "center", gap: "6px" } },
            React.createElement("span", { style: { display: "inline-block", width: "10px", height: "3px", background: C.reasoningBar, borderRadius: "1px" } }),
            "推理"
          ),
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
            "未命中"
          ),
          React.createElement(
            "span",
            { style: { display: "inline-flex", alignItems: "center", gap: "6px" } },
            React.createElement("span", { style: { display: "inline-block", width: "10px", height: "3px", background: C.cacheReadBar, borderRadius: "1px" } }),
            "命中"
          ),
          React.createElement(
            "span",
            { style: { display: "inline-flex", alignItems: "center", gap: "6px" } },
            React.createElement("span", { style: { display: "inline-block", width: "10px", height: "3px", background: C.cacheWriteBar, borderRadius: "1px" } }),
            "缓存写"
          ),
          React.createElement("span", { style: s.chartLegendHint }, "悬停查看明细 · " + (granularity || "day") + " · " + N + " 桶")
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
              // v0.4.1：5 段堆叠。outputMinusReason = output - min(output, reasoning)
              // 保证 reasoning 不超过 output（防御性），5 段总高与 totalTokensOf 一致。
              var safeOut = b.outputTokens || 0;
              var safeReas = Math.min(b.reasoningTokens || 0, safeOut);
              var outputMinusReason = Math.max(0, safeOut - safeReas);
              // v0.4.1：tooltip 包含全部 5 段 token + 请求数（之前只显示 input/output + cacheRead/reasoning）
              var title = k +
                "\n未命中 " + fmtTokens(b.inputTokens || 0) +
                " · 命中 " + fmtTokens(b.cacheReadTokens || 0) +
                " · 缓存写 " + fmtTokens(b.cacheWriteTokens || 0) +
                "\n输出 " + fmtTokens(b.outputTokens || 0) +
                " · 推理 " + fmtTokens(b.reasoningTokens || 0) +
                "\n请求 " + (b.requests || 0) + " 次";
              return React.createElement(
                "div",
                // v0.4.1：override s.chartBar 的 minWidth 4px——minute 模式 pxPerBar=2 时
                // 4px 会把柱撑到 4px 宽，破坏"柱宽收缩"的密度提升。minWidth 跟 width 走。
                { key: k, title: title, style: Object.assign({}, s.chartBar, { width: pxPerBar + "px", minWidth: pxPerBar + "px" }) },
                // DOM 顺序 = 自顶向下（flex-direction: column），故 5 段渲染顺序：
                //   1. reasoning（顶部、黄色封顶、s.chartBarOut 给 top border-radius）
                //   2. output - reasoning（橙色）
                //   3. inputMiss（蓝色）
                //   4. cacheRead（浅蓝）
                //   5. cacheWrite（最浅蓝，底部）
                React.createElement("div", {
                  style: Object.assign({}, barReasoning, { height: hPx(safeReas) + "px" })
                }),
                React.createElement("div", {
                  style: Object.assign({}, barOutput, { height: hPx(outputMinusReason) + "px" })
                }),
                React.createElement("div", {
                  style: Object.assign({}, barInput, { height: hPx(b.inputTokens || 0) + "px" })
                }),
                React.createElement("div", {
                  style: Object.assign({}, barCacheRead, { height: hPx(b.cacheReadTokens || 0) + "px" })
                }),
                React.createElement("div", {
                  style: Object.assign({}, barCacheWrite, { height: hPx(b.cacheWriteTokens || 0) + "px" })
                })
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
              // v0.4.1：override minWidth 4px 同步（同柱体注释）
              style: Object.assign({}, isToday ? s.chartAxisToday : s.chartAxis, { width: pxPerBar + "px", minWidth: pxPerBar + "px" }),
              title: k
            }, showAxis(i) ? axisLabel(b) : "");
          })
        ),
        React.createElement(
          "div",
          { style: s.chartSummary },
          // v0.4.1：总量改成 totalTokensOf 等价口径（input + output + cacheRead + cacheWrite；
          // reasoning 不重复算）。同时把 cacheRead 单独提一行，让用户能直接看到"命中"的节省量。
          React.createElement("span", { style: s.chartSummaryTotal }, "总量 ", fmtTokens(totalInput + totalOutput + totalCacheRead + totalCacheWrite)),
          React.createElement("span", null, "输出 ", React.createElement("span", { style: { color: C.accent, fontWeight: 600 } }, fmtTokens(totalOutput))),
          React.createElement("span", { style: { color: C.cacheReadBar } }, "命中 ", fmtTokens(totalCacheRead)),
          React.createElement("span", { style: { color: C.text3 } }, "推理 ", fmtTokens(totalReasoning)),
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
      // [perf v0.4.x] 预合并 7 个 cell style + empty style，heatmapCell 是 base，
      // heatmapCellL1..L7 只覆盖 background。预合并省掉 53×7×2 ≈ 742 次 Object.assign。
      var cellStyles = [
        s.heatmapCell,
        Object.assign({}, s.heatmapCell, s.heatmapCellL1),
        Object.assign({}, s.heatmapCell, s.heatmapCellL2),
        Object.assign({}, s.heatmapCell, s.heatmapCellL3),
        Object.assign({}, s.heatmapCell, s.heatmapCellL4),
        Object.assign({}, s.heatmapCell, s.heatmapCellL5),
        Object.assign({}, s.heatmapCell, s.heatmapCellL6),
        Object.assign({}, s.heatmapCell, s.heatmapCellL7),
      ];
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
      // v0.3.3：用 bucketKey 兼容 day / bucket 双 shape（host v0.3.0 daySeries 输出 { day, ... }，
      // v0.3.3 防御性添加 bucket 字段 → 客户端硬编码 .day 也能跑）
      function dayKey(d) { return d != null ? (d.bucket != null ? d.bucket : d.day) : null; }
      var dayMap = {};
      var max = 0;
      for (var di = 0; di < days.length; di++) {
        var day = days[di];
        if (day == null) continue;
        var k = dayKey(day);
        if (k == null) continue;
        var input = day.inputTokens || 0;
        var output = day.outputTokens || 0;
        var requests = day.requests || 0;
        if (modelIndex != null && modelIndex[modelFilter] && modelIndex[modelFilter][k]) {
          var md = modelIndex[modelFilter][k];
          input = md.inputTokens || 0;
          output = md.outputTokens || 0;
        }
        var tot = input + output;
        if (tot > max) max = tot;
        dayMap[k] = { input: input, output: output, requests: requests, total: tot };
      }
      if (max === 0) {
        return React.createElement("div", { style: s.heatmapEmpty }, "暂无用量。");
      }

      // 时间范围：days 内最早 → 最晚
      var firstDay = null;
      var lastDay = null;
      for (var di2 = 0; di2 < days.length; di2++) {
        var d2 = dayKey(days[di2]);
        if (d2 == null) continue;
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
          var cellStyleMerged = cellStyles[lv];
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
      // v0.4.1：weekColWidth / weekGap 同步缩小（11/2 → 9/1，与 s.heatmapCell / s.heatmapWeekCol 一致）。
      // 这两个常量之前硬编码 11/2（与 styles 解耦），不跟着缩会让月份标签与列错位。
      var weekColWidth = 9;
      var weekGap = 1;
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
        // [perf] 7 个图例 cell 也预合并
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