// ===== styles =====
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
    };