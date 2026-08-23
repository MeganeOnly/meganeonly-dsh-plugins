    // ===== 样式 =====
    var S = {
      row: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 4px", borderBottom: "1px solid rgba(128,128,128,0.2)" },
      dim: { opacity: 0.6, fontSize: "12px", marginTop: "2px" },
      btn: { padding: "4px 14px", borderRadius: "6px", border: "1px solid rgba(128,128,128,0.4)", background: "transparent", cursor: "pointer" },
      msg: { padding: "8px 12px", borderRadius: "6px", marginBottom: "8px", fontSize: "13px" },
      searchStyle: { width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: "6px", border: "1px solid rgba(128,128,128,0.35)", background: "rgba(128,128,128,0.08)", color: "inherit", fontSize: "13px", outline: "none", marginBottom: "12px" },
      secHeader: { display: "flex", alignItems: "center", gap: "6px", padding: "9px 6px", cursor: "pointer", userSelect: "none", borderRadius: "6px", borderBottom: "1px solid rgba(128,128,128,0.18)", fontWeight: 600, fontSize: "13px" },
      chevron: { display: "inline-block", width: "14px", fontSize: "11px", color: "rgba(128,128,128,0.9)" },
      countPill: { marginLeft: "2px", fontSize: "11px", fontWeight: 400, color: "rgba(128,128,128,0.9)", background: "rgba(128,128,128,0.15)", borderRadius: "9px", padding: "0 7px", lineHeight: "16px" },
      mineTitle: { fontWeight: 700, color: "#4ade80" },
      mineBadge: { marginLeft: "8px", fontSize: "11px", fontWeight: 700, padding: "1px 8px", borderRadius: "10px", background: "#4ade80", color: "#052e16", verticalAlign: "1px" },
      presetBadge: { marginLeft: "8px", fontSize: "11px", fontWeight: 700, padding: "1px 8px", borderRadius: "10px", background: "rgba(125,211,252,0.25)", color: "#0c4a6e", verticalAlign: "1px" },
      shadowBadge: { marginLeft: "6px", fontSize: "10px", fontWeight: 600, padding: "0 6px", borderRadius: "8px", background: "rgba(255,193,7,0.25)", color: "#8a6d00", verticalAlign: "1px" },
      descStyle: { marginTop: "2px", fontSize: "12px", opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
      pauseStyle: { opacity: 0.55 },
      nameStyle: { fontWeight: 600 },
      statusBadge: { marginLeft: "8px", fontSize: "11px", fontWeight: 600, padding: "1px 8px", borderRadius: "10px", verticalAlign: "1px", whiteSpace: "nowrap" },
      restartBadge: { marginLeft: "6px", fontSize: "10px", fontWeight: 600, padding: "0 6px", borderRadius: "8px", background: "rgba(255,193,7,0.25)", color: "#8a6d00", verticalAlign: "1px" },
      toolRow: { display: "flex", alignItems: "baseline", gap: "10px", padding: "4px 6px", fontSize: "12px" },
      toolName: { fontFamily: "var(--ds-font-family-code, monospace)", fontSize: "12px", opacity: 0.85, whiteSpace: "nowrap" },
      toolDesc: { opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 },
      tabBar: { display: "flex", gap: "6px", borderBottom: "1px solid rgba(128,128,128,0.25)", paddingBottom: "10px" },
      tabBtn: { padding: "6px 18px", borderRadius: "8px", border: "1px solid rgba(128,128,128,0.35)", background: "transparent", color: "inherit", cursor: "pointer", fontSize: "13px", fontWeight: 500 },
      tabActive: { padding: "6px 18px", borderRadius: "8px", border: "1px solid #4ade80", background: "rgba(74,222,128,0.15)", color: "#4ade80", cursor: "pointer", fontSize: "13px", fontWeight: 600 },
      tabHint: { marginTop: "8px", fontSize: "12px", opacity: 0.55 }
    };
    S.okStyle = Object.assign({ background: "rgba(40,167,69,0.15)", color: "#1e7e34" }, S.msg);
    S.errStyle = Object.assign({ background: "rgba(220,53,69,0.12)", color: "#b02a37" }, S.msg);
    S.warnStyle = Object.assign({ background: "rgba(255,193,7,0.12)", color: "#8a6d00" }, S.msg);

