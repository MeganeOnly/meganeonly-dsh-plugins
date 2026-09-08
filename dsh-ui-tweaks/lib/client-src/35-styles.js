    // ===== styles =====
    // CSS 注入

    function buildCSS(state) {
      var blocks = [];
      for (var i = 0; i < TWEAKS.length; i++) {
        var css = TWEAKS[i].buildCSS(state);
        if (css) blocks.push(css);
      }
      var debugBlock = buildDebugHighlightCSS(state);
      if (debugBlock) blocks.push(debugBlock);
      return blocks.join("\n\n");
    }

    /** 调试高亮 CSS（4px 黄色 outline + 浮动 label）。只有 conversationShiftDebug 开启时输出。 */
    function buildDebugHighlightCSS(state) {
      if (!state.conversationShiftDebug) return null;
      var px = Number(state.conversationShiftPx);
      if (!isFinite(px) || px < 0) px = 380;
      if (px > 800) px = 800;
      var labelText = "DSH UI TWEAKS · 对话内容 · 当前右缩 " + px + "px (debug)";
      return [
        "/* === conversation-shift-debug : 高亮 JS 探测标记的元素 === */",
        "html[data-dsh-ui-tweaks-shift-debug] [" + SHIFT_TARGET_ATTR + "]{",
        "  outline:4px solid #facc15 !important;",
        "  outline-offset:-4px;",
        "  box-shadow:inset 0 0 0 1px rgba(0,0,0,.5) !important;",
        "  position:relative !important;",
        "}",
        "html[data-dsh-ui-tweaks-shift-debug] [" + SHIFT_TARGET_ATTR + "]::before{",
        "  content:\"" + labelText + "\";",
        "  position:absolute;",
        "  top:-22px;",
        "  left:0;",
        "  background:#000;",
        "  color:#fff;",
        "  font:600 11px/20px ui-monospace,Menlo,Consolas,monospace;",
        "  padding:1px 8px;",
        "  border-radius:4px;",
        "  white-space:nowrap;",
        "  z-index:99999;",
        "  pointer-events:none;",
        "}"
      ].join("\n");
    }

    function injectCSS(state) {
      var old = document.querySelector("style[data-plugin-css=\"" + MAIN_CSS_TAG_ID + "\"]");
      if (old) old.remove();
      var css = buildCSS(state);
      if (!css) return;
      var tag = document.createElement("style");
      tag.dataset.plugin = "dsh-ui-tweaks";
      tag.dataset.pluginCss = MAIN_CSS_TAG_ID;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    /**
     * Section 样式。注入一次。
     *
     * v0.5.1 设计：switch 用显式 fallback 色（不依赖 `--dsw-alias-bg-component-disabled`，
     * 该变量在某些 DSH 主题下接近背景色导致开关看不见）；input 永远不 disabled。
     * v0.7.5：description 从 `<p>` 收进 `title` 属性，row 默认不渲染描述，给
     * `.DTPD_item` 加 `cursor:help` 提示可悬停看说明；移除 `.DTPD_itemDesc` 规则。
     * v0.10.0：加 `.DTPD_select`——"多选一"tweak（首例 stats-line-position）
     * 头部右侧渲染下拉框而非开关，外观对齐 `.DTPD_input`。
     * v0.10.3：去掉 `.DTPD_switch` 的 `border:1px solid`（v0.6.0 起加的）——
     * 1px 边框让 pill 看起来"有点方圆"。但本次仅去 border、未恢复尺寸。
     * v0.10.4：`.DTPD_switch` 尺寸从 v0.6.0 放大的 `36×22` / thumb `18×18` 回退到
     * v0.5.1 之前的 `34×20` / thumb `16×16`——用户实测"去掉边框后还是方方的"，
     * 真正的"圆圆的"需要在更紧凑尺寸下两端圆形轮廓才能显现。
     *   thumb `top:1px → 2px`、`left:1px → 2px`：22px 高 + 18px thumb 只剩 2px
     *   上下边距，pill 的"圆"被压缩；20px 高 + 16px thumb + 2px 边距 = 4px 边距，
     *   pill 两端圆形轮廓更明显。
     *   translateX 保持 `14px`：34px 宽里 `14+16+2=32`、knob 右边距 2px；36px 宽
     *   里 `14+18+1=33`、knob 右边距 3px，数值上都成立。
     */
    var SECTION_CSS =
      ".DTPD_section{max-width:760px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:18px;display:flex}\n" +
      ".DTPD_section h2{margin:0;font-size:18px;font-weight:600}\n" +
      ".DTPD_intro{color:var(--dsw-alias-label-tertiary);margin:0 0 4px;font-size:13px}\n" +
      ".DTPD_list{flex-direction:column;gap:10px;margin:0;padding:0;list-style:none;display:flex}\n" +
      ".DTPD_item{cursor:help;box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;flex-direction:column;gap:8px;padding:14px 16px;display:flex}\n" +
      ".DTPD_itemHead{flex-direction:row;justify-content:space-between;align-items:center;gap:12px;display:flex}\n" +
      ".DTPD_itemName{margin:0;font-size:14px;font-weight:500;line-height:22px}\n" +
      ".DTPD_switch{appearance:none;-webkit-appearance:none;cursor:pointer;width:34px;height:20px;background:var(--dsw-alias-bg-component-disabled,#cbd5e1);border-radius:999px;position:relative;transition:background .15s ease;flex:none;margin:0;padding:0}\n" +
      ".DTPD_switch:checked{background:var(--dsw-alias-state-business-primary,#2563eb)}\n" +
      ".DTPD_switch::after{content:\"\";position:absolute;top:2px;left:2px;width:16px;height:16px;background:var(--dsw-alias-bg-layer-1,#fff);border-radius:50%;transition:transform .15s ease;box-shadow:0 1px 2px rgba(0,0,0,.18)}\n" +
      ".DTPD_switch:checked::after{transform:translateX(14px)}\n" +
      ".DTPD_valueRow{align-items:center;gap:8px;display:flex}\n" +
      ".DTPD_valueLabel{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;min-width:64px}\n" +
      ".DTPD_input{box-sizing:border-box;width:120px;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-input-major,#fff);border:1px solid var(--dsw-alias-border-l2,#94a3b8);border-radius:6px;padding:4px 8px;font-family:inherit;font-size:13px;line-height:20px}\n" +
      ".DTPD_input:focus{border-color:var(--dsw-alias-state-business-primary,#2563eb);outline:none}\n" +
      ".DTPD_select{box-sizing:border-box;flex:none;min-width:150px;cursor:pointer;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-input-major,#fff);border:1px solid var(--dsw-alias-border-l2,#94a3b8);border-radius:6px;padding:4px 8px;font-family:inherit;font-size:13px;line-height:20px}\n" +
      ".DTPD_select:focus{border-color:var(--dsw-alias-state-business-primary,#2563eb);outline:none}";

    function injectSectionCSS() {
      if (document.querySelector("style[data-plugin-css=\"" + SECTION_CSS_TAG_ID + "\"]")) return;
      var tag = document.createElement("style");
      tag.dataset.plugin = "dsh-ui-tweaks";
      tag.dataset.pluginCss = SECTION_CSS_TAG_ID;
      tag.textContent = SECTION_CSS;
      document.head.appendChild(tag);
    }

