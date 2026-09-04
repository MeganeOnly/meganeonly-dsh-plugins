    // ===== page =====
    function UsageStatsPage() {
      var loading = React.useState(true);
      var data = React.useState(null);
      var error = React.useState(null);
      var rangeState = React.useState("all");
      var visibilityState = React.useState(loadVisible());
      var panelOpenState = React.useState(false);
      var heatmapModelState = React.useState(loadHeatmapModel());
      var setLoading = loading[1];
      var setData = data[1];
      var setError = error[1];
      var setRange = rangeState[1];
      var setVisibility = visibilityState[1];
      var setPanelOpen = panelOpenState[1];
      var setHeatmapModel = heatmapModelState[1];

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

      // 热力图模型筛选偏好持久化（独立 key，与 visibility 解耦）
      React.useEffect(function () {
        saveHeatmapModel(heatmapModelState[0]);
      }, [heatmapModelState[0]]);

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
        return UsageStatsPageBody(d, function (force) { load(force); }, rangeState[0], setRange, visibilityState[0], setVisibility, panelOpenState[0], setPanelOpen, heatmapModelState[0], setHeatmapModel);
      } catch (e) {
        // v0.3.4 治本：catch 时打印 d 的关键字段状态，DevTools Console 自动 dump
        // 让下次出错时能从 console 直接看到 host 半段输出缺哪个字段
        if (typeof console !== "undefined" && console.error) {
          console.error("[usage-stats] render exception; d shape:", {
            byDay: d.byDay ? d.byDay.length + " items, first.keys=" + (d.byDay[0] ? Object.keys(d.byDay[0]).join(",") : "null") : "undefined",
            byTrend: d.byTrend ? Object.keys(d.byTrend).map(function (k) { return k + ":" + (d.byTrend[k] ? d.byTrend[k].length : 0) }).join(" | ") : "undefined",
            byModel: d.byModel ? d.byModel.length + " items, first.keys=" + (d.byModel[0] ? Object.keys(d.byModel[0]).join(",") : "null") : "undefined",
            totals: d.totals ? "present(" + d.totals.requests + " reqs)" : "undefined",
            sessionCount: d.sessionCount,
            rawSessionCount: d.rawSessionCount,
            topSessions: d.topSessions ? d.topSessions.length + " items" : "undefined",
            tools: d.tools ? d.tools.length + " items" : "undefined",
            errors: d.errors
          }, e);
        }
        return React.createElement(
          "div",
          { style: { padding: "12px", color: C.err } },
          React.createElement("h3", null, "渲染异常（诊断模式）"),
          React.createElement("div", null, String((e && e.message) || e)),
          React.createElement("pre", { style: { whiteSpace: "pre-wrap", fontSize: "11px", fontFamily: "monospace" } }, String((e && e.stack) || ""))
        );
      }
    }

    function UsageStatsPageBody(d, reload, range, setRange, visibility, setVisibility, panelOpen, setPanelOpen, heatmapModel, setHeatmapModel) {
      // v0.3.0 时间窗口：粒度切换走 byTrend[r.granularity]，旧 'all' / '30' / '7' / '1' 由 rangeSpec() 兼容
      // v0.3.4 治本：所有 d.X 访问加兜底，老 host 半段（v0.2.x）无 byTrend / totals 也不会抛错
      var safeByTrend = d.byTrend || {};
      var safeTotals = d.totals || sumBuckets([]);
      var safeByModel = d.byModel || [];
      var safeTopSessions = d.topSessions || [];
      var safeTools = d.tools || [];
      // v0.3.9：'all' tab 的图表改用 byDayAll（host 历史全量日序列），
      // 不再用 byTrend.day（最近 30 天零填充）。byDayAll 是 root.days 合并升序
      // 不零填充，老 host（v0.3.8.x 及更早）无 byDayAll 时 fallback 到 byTrend.day
      // 保留旧行为（最近 30 天）。
      // 53 周裁剪：超过 53 周（371 天）时只取最近 53 周，避免无限长 day 系列
      // 把图压成色带（GitHub 贡献日历就是 53 周上限）。
      var HEATMAP_WEEKS = 53;
      var HEATMAP_DAYS = HEATMAP_WEEKS * 7; // 371
      var allSource;
      if (d.byDayAll && d.byDayAll.length > 0) {
        allSource = d.byDayAll.length > HEATMAP_DAYS ? d.byDayAll.slice(-HEATMAP_DAYS) : d.byDayAll;
      } else {
        allSource = safeByTrend.day || [];
      }
      var r = rangeSpec(range);
      var seriesSource = safeByTrend[r.granularity] || [];
      // v0.3.9 'all' tab：window=null 时 rangeTotals 走 safeTotals（全程指标），
      // 图表改走 byDayAll（最近 53 周，避免无限长 day 系列把图压成色带）。
      // 老 host（无 byDayAll 时）退回 byTrend.day 末尾 30 天切片，保留 v0.3.5 的
      // 视觉"最近 30 天"语义。
      var winSeries;
      if (r.window != null) {
        winSeries = seriesSource.slice(-r.window);
      } else if (r.key === "all") {
        winSeries = allSource;
      } else {
        winSeries = seriesSource;
      }
      var winSet = null;
      if (r.window != null) {
        winSet = {};
        for (var wi = 0; wi < winSeries.length; wi++) winSet[winSeries[wi].bucket] = true;
      }
      var rangeTotals = r.window != null ? sumBuckets(winSeries) : safeTotals;
      var rangeLabel = r.label;

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
        Card("会话（main）", String(d.sessionCount), d.rawSessionCount != null && d.rawSessionCount !== d.sessionCount ? ("含 " + (d.rawSessionCount - d.sessionCount) + " 个 subagent 已 rollup") : d.turns + " 轮对话（全程）"),
        Card("模型请求" + (r.window == null ? "" : " · " + rangeLabel), String(t.requests), "纯模型时间 " + fmtDuration(d.llmMs)),
        Card("未命中输入", fmtTokens(t.inputTokens), "缓存写 " + fmtTokens(t.cacheWriteTokens)),
        Card("输出", fmtTokens(t.outputTokens), "其中推理 " + fmtTokens(t.reasoningTokens)),
        Card("命中输入", fmtTokens(t.cacheReadTokens), "缓存读取"),
        Card("生成速度", fmtSpeed(safeTotals.outputTokens, d.llmMs || 0), "全程输出 ÷ 模型时间")
      );

      // 错误盒
      var errorBox = d.errors && d.errors.length > 0
        ? React.createElement("div", { style: Object.assign({}, s.errBox, { marginTop: "12px" }) }, "部分会话解码失败（已跳过）：", d.errors.join("；"))
        : null;

      // 按模型表
      var modelRows = safeByModel.map(function (m) {
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
      var sessionRows = safeTopSessions.map(function (sess) {
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
      var toolRows = safeTools.map(function (tool) {
        return React.createElement(
          "tr",
          { key: tool.name },
          React.createElement("td", { style: s.tdName }, tool.name),
          React.createElement("td", { style: Object.assign({}, s.td, s.num) }, String(tool.calls)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num) }, fmtDuration(tool.ms)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num, { color: C.text3 }) }, tool.calls > 0 ? (tool.ms / tool.calls / 1000).toFixed(1) + " s/次" : "–")
        );
      });

      // 图表标题（v0.3.0 多粒度）
      var chartTitle = r.label + "用量";
      var chartHint = r.granularity === "week"
        ? "按周折叠（周一为周开始，北京时间）"
        : (r.granularity === "hour" ? "按小时（最近 7d × 24h）" : (r.granularity === "minute" ? "按分钟（最近 24h × 60min）" : null));

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
            DayChart(winSeries, r.granularity)
          )
        });
      }
      if (visibility.heatmap) {
        // 模型筛选 select（始终显示，无 byModel 数据时不渲染）
        var heatmapModelBar = safeByModel.length > 0
          ? React.createElement(
              "div",
              { style: s.heatmapModelBar },
              React.createElement("span", null, "模型筛选"),
              React.createElement(
                "select",
                {
                  style: s.heatmapModelSelect,
                  value: heatmapModel || "",
                  onChange: function (e) {
                    var v = e.target.value;
                    setHeatmapModel(v === "" ? null : v);
                  },
                  title: heatmapModel ? "当前只显示该模型的每日贡献" : "显示所有模型的每日贡献"
                },
                React.createElement("option", { value: "" }, "全部"),
                safeByModel.map(function (m) {
                  return React.createElement("option", { key: m.model, value: m.model }, m.model);
                })
              )
            )
          : null;
        // v0.3.9：热力图优先消费 byDayAll（历史全量）；老 host（v0.3.8.x
        // 之前无 byDayAll）回落 byDay（即 byTrend.day，近 30 天零填充），
        // 仍能正常显示——只是超过 30 天的历史跨度会丢失。
        var heatmapSource = d.byDayAll && d.byDayAll.length > 0 ? d.byDayAll : (d.byDay || []);
        sectionNodes.push({
          key: "heatmap",
          node: React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "baseline" } },
              React.createElement("h3", { style: s.sectionTitle }, "贡献热力图"),
              React.createElement("span", { style: s.sectionHint }, "· 过去 53 周 · 5 级颜色对应 token 量（基于窗口 max 归一）")
            ),
            heatmapModelBar,
            HeatmapCalendar(heatmapSource, heatmapModel, d.byModel || [])
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
              "会话用量 Top " + safeTopSessions.length,
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
              "工具调用 Top " + safeTools.length,
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
    }