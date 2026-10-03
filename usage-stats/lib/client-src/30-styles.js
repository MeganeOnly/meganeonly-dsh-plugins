    // ===== styles =====
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
      // v0.4.1：5 段堆叠柱状图扩展色（每根柱代表 5 类 token 的真实占比，
      // 比 v0.3.0 的"input+output 双段"信息密度 ×2.5）。
      //   cacheWriteBar  cacheReadBar  inputBar  outputBar  reasoningBar
      //   #93c5fd        #60a5fa       #3b82f6   #f59e0b   #fbbf24
      // 梯度方向：cacheWrite（最便宜）→ reasoning（最贵），bottom→top。
      // 严控色板：5 个都是 tailwindcss 调色板的相邻色阶，色相不跳。
      cacheWriteBar: "#93c5fd",
      cacheReadBar: "#60a5fa",
      reasoningBar: "#fbbf24",
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
      // 扫描状态行（v0.5.0：后台重算进度 / 旧缓存占位 / 数据新鲜度）
      statusBar: { display: "flex", alignItems: "center", gap: "10px", marginTop: "10px", padding: "7px 11px", borderRadius: "5px", border: "1px solid " + C.hairline, background: C.faint, fontSize: "11px", color: C.text2, fontVariantNumeric: "tabular-nums" },
      statusWarn: { borderColor: "rgba(176,42,55,0.25)", background: C.errSoft, color: C.err },
      statusDot: { width: "7px", height: "7px", borderRadius: "50%", background: C.accent, flex: "0 0 auto" },
      statusTrack: { flex: "1 1 120px", height: "3px", borderRadius: "2px", background: C.hairlineSoft, overflow: "hidden", minWidth: "80px" },
      statusFill: { height: "100%", borderRadius: "2px", background: C.accent },
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
      heatmapDowCol: { display: "flex", flexDirection: "column", gap: "1px", paddingRight: "4px" },
      // v0.4.1：dow 标签高度从 11→9 同步缩，与 heatmapCell 9px 对齐（不缩会让行错位）
      heatmapDowLabel: { height: "9px", fontSize: "10px", color: C.heatmapLabel, textAlign: "right", lineHeight: "9px" },
      heatmapGrid: { display: "flex", gap: "1px" },
      heatmapWeekCol: { display: "flex", flexDirection: "column", gap: "1px" },
      // v0.4.1：cell 11×11 + gap 2 缩到 9×9 + gap 1（视觉密度约 +20%）。
      // 53 周宽度从 689px → 530px，配合右侧栏腾出空间；保留 border-radius 2 让
      // 单元格仍然像"色块"而不是像素点。
      heatmapCell: { width: "9px", height: "9px", borderRadius: "2px", background: C.heatmapL0, border: "1px solid " + C.heatmapCellBorder, boxSizing: "border-box", cursor: "default" },
      heatmapCellL1: { background: C.heatmapL1 },
      heatmapCellL2: { background: C.heatmapL2 },
      heatmapCellL3: { background: C.heatmapL3 },
      heatmapCellL4: { background: C.heatmapL4 },
      heatmapCellL5: { background: C.heatmapL5 },
      heatmapCellL6: { background: C.heatmapL6 },
      heatmapCellL7: { background: C.heatmapL7 },
      // v0.4.1：图例单元同步缩到 9×9（与 heatmapCell 一致）
      heatmapScaleCell: { width: "9px", height: "9px", borderRadius: "2px", border: "1px solid " + C.heatmapCellBorder, boxSizing: "border-box" },
      heatmapModelBar: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", fontSize: "11px", color: C.text2 },
      heatmapModelSelect: { padding: "3px 8px", fontSize: "11px", borderRadius: "4px", border: "1px solid " + C.hairline, background: "transparent", color: "inherit", cursor: "pointer", fontVariantNumeric: "tabular-nums" },
      heatmapEmpty: { fontSize: "11px", color: C.text3, padding: "16px 0" }
    };