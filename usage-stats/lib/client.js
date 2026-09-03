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
 *
 * v0.2.x 美术度升级：用量图新增 4 条参考线（25/50/75/100%）+ today
 * 竖线 + peak 浮动徽章 + 摘要脚注；图例移入图表顶部并加上 today
 * 日期加粗；图表专用色 token（peakLine 暖陶土、todayLine 中灰、
 * gridDashed/gridBase 浅虚线）。
 *
 * v0.2.1 调色板升级：原"灰+饱和绿"二元对比替换为「蓝-橙」主对
 * （#3b82f6 输入 / #f59e0b 输出），rose-600 单独强调峰值日。
 * 色盲安全（blue/orange 主对）+ 与非图表绿色 accent 拉开层次。
 * 见 `lib/client-src/30-styles.js` 头部注释的设计原则与参考来源。
 *
 * v0.2.2 新增「贡献热力图」：GitHub 风格 53 周 × 7 日方格日历。
 * v0.3.1 调色板改为绿色单色相（用户反馈"大的颜色不改变，只要绿色"）：5 级
 * 仅改明度，不切色相，对齐 GitHub 贡献日历视觉语言。
 * v0.3.2 级别扩 5 → 7（用户反馈"级别多一点"）：阈值细分
 * （1-5% / 5-15% / 15-30% / 30-50% / 50-70% / 70-90% / ≥90%），
 * 中间多插 3 档让日常用量（1-30%）明暗变化更细腻。色阶
 *（`#c6e6ce` / `#9be9a8` / `#7ac281` / `#40c463` / `#30a14e` /
 * `#216e39` / `#0e4429`）。
 * v0.3.3 修复 HeatmapCalendar 渲染异常：`Cannot read properties of undefined (reading 'day')`——
 * v0.3.0 重构 daySeries 后 HeatmapCalendar 内部硬编码 `day.day` 在 host 半段中间状态时抛错；
 * v0.3.3 客户端改用 `dayKey(d) = d.bucket != null ? d.bucket : d.day` 兼容 day/bucket 双 shape
 *（对齐 DayChart `bucketKey` 策略）+ 加 `days[di] == null` 守卫 + `HeatmapCalendar(d.byDay || [], ...)` 防御
 * + host `daySeries` 输出元素同时给 `day` + `bucket` 冗余字段。
 * 模型筛选独立持久化（localStorage `dsh-usage-stats/heatmap-model-v1`，
 * null = 全部模型聚合；非 null = 仅该模型贡献的 input/output）。
 * 显示设置 7 块 schema 扩 `heatmap` 字段，隐式迁移（缺字段默认 true）。
 * 详见 `lib/client-src/40-components.js` 的 HeatmapCalendar 与
 * `lib/client-src/50-config.js` 的 loadHeatmapModel / saveHeatmapModel。
 *
 * v0.3.0 两特性合并发布：
 *   (a) 子代理消耗归并 — host 解析 DSH SessionHeader 的 parentSession /
 *       delegationDepth / origin 字段（schema 见 dsh-session-persistence-jsonl
 *       README § SessionHeader），把每个 subagent 的 token 沿 parentSession
 *       chain rollup 到 root main session（counts speak in main sessions only，
 *       token lands on its owner）。sessionCount 现在是 root 数；新增
 *       rawSessionCount 保留原始 session 数供高级排查。
 *   (b) 多粒度趋势 — host 端 aggregateSession 同时写 hours / /minutes 桶，
 *       summary 输出 byTrend = { minute / /hour / /day / / /week } 四种粒度零填充序列。
 *       客户端 RANGES 加 7 个 range（兼容 v0.2.x 'all' / '30' / '7' / '1'）：
 *         'all' / '7' / '1' — 按日窗口（day）
 *         'h7' / 'h1' — 按小时（hour / minute）
 *         'm1' — 按分钟（minute）
 *         'w12' — 按周（week，ISO 周一折叠）
 *       DayChart 接受 granularity 参数自适应柱宽（minute 极窄 + overflow-x
 *       auto 滚动）+ X 轴标签按粒度格式（MM-DD / MM-DD HH / MM-DD HH:mm / 周一日期）。
 *       CACHE_VERSION v2 → v4 跳号（中间 v3 不暴露避免用户白经历一次缓存作废重算）。
 */window.__ModuleLoader__.load({
  id: "dsh-usage-stats",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");
    var inject = ["slots"];

    var API = "/api/usage-stats/summary";    // ===== formatters =====
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
      return sumBuckets(days);
    }

    /** v0.3.0 多粒度桶求和：byTrend 各粒度共用 { bucket, ...bucket } shape。 */
    function sumBuckets(buckets) {
      var out = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 0 };
      if (buckets == null) return out;
      for (var i = 0; i < buckets.length; i++) {
        var b = buckets[i];
        out.inputTokens += b.inputTokens || 0;
        out.outputTokens += b.outputTokens || 0;
        out.cacheReadTokens += b.cacheReadTokens || 0;
        out.cacheWriteTokens += b.cacheWriteTokens || 0;
        out.reasoningTokens += b.reasoningTokens || 0;
        out.requests += b.requests || 0;
      }
      return out;
    }

    /** v0.3.0 按桶 key 格式化（byTrend[granularity] 用）。 */
    function fmtBucket(key, granularity) {
      if (key == null) return "";
      if (granularity === "minute") {
        // YYYY-MM-DDTHH:mm → MM-DD HH:mm
        var sp = key.split("T");
        if (sp.length !== 2) return key;
        return sp[0].slice(5) + " " + sp[1];
      }
      if (granularity === "hour") {
        // YYYY-MM-DDTHH → MM-DD HH
        var sp2 = key.split("T");
        if (sp2.length !== 2) return key;
        return sp2[0].slice(5) + " " + sp2[1] + "h";
      }
      if (granularity === "week") {
        // 周一日期，按 MM-DD 显示（与日级一致）
        return key.slice(5);
      }
      // day
        return key.slice(5);
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
    }    // ===== styles =====
// 样式 token
//
// 配色原则（v0.2.1 调色板升级，参考 data-viz-color / data-viz-techniques）：
//   1. 二元对比用「蓝-橙」主对（input 蓝 / output 橙）：
//      - 色盲安全（blue/orange 是色觉缺陷下仍可分辨的经典组合）
//      - 冷暖对比鲜明，比原"灰+饱和绿"在浅灰背景下不刺眼
//   2. 峰值用 rose-600 单独强调：与蓝/橙拉开色相距离，"峰值日"真的跳出来
//   3. 通用 accent（绿）保留给非图表元素：btnPrimary / panel 复选框 /
//      输出总计 / 模型比值列。图表不再吃绿色，避免"什么都是绿色"的扁平感
//   4. 灰色 hierarchy 仅用于 hairline / text / 网格 / today 竖线——
//      参考线不应抢数据色
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
      // 图表双系列色（蓝-橙主对，色盲安全）
      inputBar: "#3b82f6",
      inputBarSoft: "rgba(59,130,246,0.12)",
      outputBar: "#f59e0b",
      outputBarSoft: "rgba(245,158,11,0.12)",
      // 峰值强调色（rose，独立于蓝/橙，peak day 视觉跳出）
      peakLine: "#e11d48",
      peakText: "#be123c",
      peakSoft: "rgba(225,29,72,0.10)",
      peakBorder: "rgba(225,29,72,0.30)",
      // 参考线（保留灰色 hierarchy，不与数据色竞争）
      todayLine: "rgba(128,128,128,0.40)",
      gridDashed: "rgba(128,128,128,0.10)",
      gridBase: "rgba(128,128,128,0.20)",
      // 热力图（v0.3.1：5 级绿色单色相，仅明度梯度，不切色相——对齐 GitHub 贡献日历视觉
      // 语言；用户反馈"大的颜色不改变，只要绿色"后改）。
      //   L0 transparent         无用量
      //   L1 #9be9a8             极淡（1-10% max）
      //   L2 #40c463             中淡（10-30% max）
      //   L3 #30a14e             中深（30-60% max，主绿）
      //   L4 #216e39             深（60-90% max，爆日）
      //   L5 #0e4429             最深（≥90% max，异常日）
      // 严控色板：仅复用 v0.2.1 accent (#16a34a) 衍生，accentSolid / btnPrimary 等保持绿色
      // 一致（"什么都是绿色"在图表外反而成加分项——和图表视觉锚点统一）。
      heatmapL0: "transparent",
      heatmapL1: "#c6e6ce",
      heatmapL2: "#9be9a8",
      heatmapL3: "#7ac281",
      heatmapL4: "#40c463",
      heatmapL5: "#30a14e",
      heatmapL6: "#216e39",
      heatmapL7: "#0e4429",
      heatmapCellBorder: "rgba(128,128,128,0.06)",
      heatmapLabel: "rgba(128,128,128,0.45)"
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
      chartSection: { marginTop: "4px" },
      chartLegend: { display: "flex", alignItems: "center", gap: "14px", fontSize: "11px", color: C.text2, marginBottom: "12px" },
      chartLegendHint: { marginLeft: "auto", fontSize: "11px", color: C.text3 },
      chartWrap: { position: "relative", height: "100px", overflowX: "auto", overflowY: "hidden" },
      chartGridLine: { position: "absolute", left: 0, right: 0, borderTopStyle: "dashed", borderTopWidth: "1px", borderTopColor: C.gridDashed, pointerEvents: "none" },
      chartGridBase: { position: "absolute", left: 0, right: 0, borderTopStyle: "solid", borderTopWidth: "1px", borderTopColor: C.gridBase, pointerEvents: "none" },
      chartTodayLine: { position: "absolute", top: 0, bottom: 0, width: "1px", background: C.todayLine, opacity: 0.7, pointerEvents: "none" },
      chartPeakLine: { position: "absolute", top: 0, bottom: 0, width: "1px", background: C.peakLine, opacity: 0.55, pointerEvents: "none" },
      chartPeakBadge: { position: "absolute", transform: "translate(-50%, -100%)", padding: "2px 7px", borderRadius: "3px", background: C.peakSoft, border: "1px solid " + C.peakBorder, color: C.peakText, fontSize: "10px", fontWeight: 600, letterSpacing: "0.02em", whiteSpace: "nowrap", pointerEvents: "none", fontVariantNumeric: "tabular-nums" },
      chartBarsRow: { position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", gap: "2px" },
      chartBar: { flex: "1 1 0", minWidth: "4px", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", cursor: "default" },
      chartBarOut: { borderRadius: "1px 1px 0 0", minHeight: 0 },
      chartBarIn: { minHeight: 0 },
      chartAxisRow: { display: "flex", gap: "2px", marginTop: "8px" },
      chartAxis: { flex: "1 1 0", minWidth: "4px", textAlign: "center", fontSize: "10px", color: C.text3, fontVariantNumeric: "tabular-nums" },
      chartAxisToday: { flex: "1 1 0", minWidth: "4px", textAlign: "center", fontSize: "10px", color: C.text2, fontVariantNumeric: "tabular-nums", fontWeight: 600 },
      chartSummary: { display: "flex", gap: "14px", marginTop: "12px", fontSize: "11px", color: C.text3, letterSpacing: "0.02em", flexWrap: "wrap" },
      chartSummaryPeak: { color: C.peakText, fontWeight: 500 },
      chartSummaryTotal: { color: C.text2 },
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
      panelToggleBtn: { padding: "3px 9px", fontSize: "11px", borderRadius: "4px", border: "1px solid " + C.hairline, background: "transparent", color: C.text2, cursor: "pointer" },
      // 热力图（v0.2.2）：53 周 × 7 日方格，5 级颜色复用 v0.2.1 蓝橙主对 + rose peak token
      heatmapSection: { marginTop: "4px" },
      heatmapLegend: { display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: C.text2, marginBottom: "12px", flexWrap: "wrap" },
      heatmapLegendHint: { marginLeft: "auto", fontSize: "11px", color: C.text3 },
      heatmapWrap: { display: "inline-block", padding: "10px 12px 8px", border: "1px solid " + C.hairline, borderRadius: "6px", background: "var(--ds-bg-elevated, #ffffff)" },
      heatmapMonthRow: { display: "flex", fontSize: "10px", color: C.heatmapLabel, marginBottom: "4px", letterSpacing: "0.02em", height: "12px" },
      heatmapMonthCell: { position: "absolute", fontSize: "10px", color: C.heatmapLabel },
      heatmapBodyRow: { display: "flex" },
      heatmapDowCol: { display: "flex", flexDirection: "column", gap: "2px", paddingRight: "4px" },
      heatmapDowLabel: { height: "11px", fontSize: "10px", color: C.heatmapLabel, textAlign: "right", lineHeight: "11px" },
      heatmapGrid: { display: "flex", gap: "2px" },
      heatmapWeekCol: { display: "flex", flexDirection: "column", gap: "2px" },
      heatmapCell: { width: "11px", height: "11px", borderRadius: "2px", background: C.heatmapL0, border: "1px solid " + C.heatmapCellBorder, boxSizing: "border-box", cursor: "default" },
      heatmapCellL1: { background: C.heatmapL1 },
      heatmapCellL2: { background: C.heatmapL2 },
      heatmapCellL3: { background: C.heatmapL3 },
      heatmapCellL4: { background: C.heatmapL4 },
      heatmapCellL5: { background: C.heatmapL5 },
      heatmapCellL6: { background: C.heatmapL6 },
      heatmapCellL7: { background: C.heatmapL7 },
      heatmapScaleCell: { width: "11px", height: "11px", borderRadius: "2px", border: "1px solid " + C.heatmapCellBorder, boxSizing: "border-box" },
      heatmapModelBar: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", fontSize: "11px", color: C.text2 },
      heatmapModelSelect: { padding: "3px 8px", fontSize: "11px", borderRadius: "4px", border: "1px solid " + C.hairline, background: "transparent", color: "inherit", cursor: "pointer", fontVariantNumeric: "tabular-nums" },
      heatmapEmpty: { fontSize: "11px", color: C.text3, padding: "16px 0" }
    };    // ===== components =====
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
    }    // ===== config =====
    // v0.3.0 RANGES 扩 granularity + window 字段。每个 range 决定页面上图与按模型表按哪个粒度切片。
    //   granularity ∈ 'day' | 'hour' | 'minute' | 'week'
    //   window 是在该粒度下取末尾多少桶；null = 该粒度默认（day=30, hour=168=7d, minute=1440=24h, week=全部）
    var RANGES = [
      { key: "all", label: "全部·日", granularity: "day", window: 30 },
      { key: "7", label: "近 7 日", granularity: "day", window: 7 },
      { key: "1", label: "今日", granularity: "day", window: 1 },
      { key: "h7", label: "近 7 日·小时", granularity: "hour", window: 168 },
      { key: "h1", label: "今日·小时", granularity: "hour", window: 24 },
      { key: "m1", label: "今日·分钟", granularity: "minute", window: 1440 },
      { key: "w12", label: "近 12 周", granularity: "week", window: 12 }
    ];

    /**
     * 兼容 v0.2.x 旧 localStorage 值：'all' / '30' / '7' / '1' 仍按日；其他 key 在 RANGES 找不到则回退到 'all'。
     */
    function rangeSpec(rangeKey) {
      for (var i = 0; i < RANGES.length; i++) {
        if (RANGES[i].key === rangeKey) return RANGES[i];
      }
      return RANGES[0];
    }

    /* ---------- 显示设置：可隐藏/展示各数据块，偏好持久化 ---------- */

    // 7 个数据块的可见性开关（key → 中文标签）。新增 section 时在此追加并配合 UsageStatsPageBody 渲染。
    // v0.2.2 新增 `heatmap`（GitHub 风格贡献热力图），插入在 chart 与 byModel 之间。
    var VISIBLE_KEYS = ["meta", "cards", "chart", "heatmap", "byModel", "topSessions", "tools"];
    var VISIBLE_LABELS = {
      meta: "顶部元信息（数据源 / 解码 / 生成耗时）",
      cards: "指标卡（6 张：会话 / 请求 / 未命中 / 输出 / 命中 / 速度）",
      chart: "近 30 天用量柱状图",
      heatmap: "贡献热力图（53 周 × 7 日）",
      byModel: "按模型分解表",
      topSessions: "会话用量 Top",
      tools: "工具调用 Top"
    };
    var STORAGE_VISIBLE_KEY = "dsh-usage-stats/visible-v1";

    /* ---------- 热力图模型筛选：独立 key 持久化（与 visibility 解耦） ---------- */
    // null = 全部模型聚合；非 null = 仅该 model 的 input/output 投影到每日。
    // schema 单值（model 字符串），不做版本号——任何非字符串值视为 null。
    var STORAGE_HEATMAP_MODEL_KEY = "dsh-usage-stats/heatmap-model-v1";
    function loadHeatmapModel() {
      if (!STORAGE_OK) return null;
      try {
        var v = localStorage.getItem(STORAGE_HEATMAP_MODEL_KEY);
        if (v == null || v === "null") return null;
        return typeof v === "string" && v.length > 0 ? v : null;
      } catch (e) { return null; }
    }
    function saveHeatmapModel(model) {
      if (!STORAGE_OK) return;
      try {
        if (model == null) localStorage.removeItem(STORAGE_HEATMAP_MODEL_KEY);
        else localStorage.setItem(STORAGE_HEATMAP_MODEL_KEY, String(model));
      } catch (e) {
        console.warn("[usage-stats] 保存热力图模型筛选失败:", e && e.message);
      }
    }

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
    }    // ===== visibility panel =====
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
    }    // ===== page =====
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
      var r = rangeSpec(range);
      var seriesSource = d.byTrend[r.granularity] || [];
      var winSeries = r.window != null ? seriesSource.slice(-r.window) : seriesSource;
      var winSet = null;
      if (r.window != null) {
        winSet = {};
        for (var wi = 0; wi < winSeries.length; wi++) winSet[winSeries[wi].bucket] = true;
      }
      var rangeTotals = r.window != null ? sumBuckets(winSeries) : d.totals;
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
        var heatmapModelBar = d.byModel.length > 0
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
                d.byModel.map(function (m) {
                  return React.createElement("option", { key: m.model, value: m.model }, m.model);
                })
              )
            )
          : null;
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
            HeatmapCalendar(d.byDay || [], heatmapModel, d.byModel || [])
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
    }    // ===== apply =====
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