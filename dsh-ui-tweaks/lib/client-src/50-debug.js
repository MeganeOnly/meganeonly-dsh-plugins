    // ===== debug =====
    // ====================================================================
    // 调试高亮：toggle <html> 属性 + 给命中元素写 data-shift-px
    // ====================================================================

    function inspectMatch(selector) {
      if (typeof document === "undefined") return { selector: selector, found: false };
      var el = document.querySelector(selector);
      if (el === null) return { selector: selector, found: false };
      var cs = (typeof window !== "undefined" && window.getComputedStyle) ? window.getComputedStyle(el) : null;
      var rect = (typeof el.getBoundingClientRect === "function") ? el.getBoundingClientRect() : null;
      return {
        selector: selector,
        found: true,
        tagName: el.tagName,
        className: typeof el.className === "string" ? el.className : "",
        offsetWidth: el.offsetWidth,
        offsetHeight: el.offsetHeight,
        paddingRight: cs ? cs.paddingRight : "",
        boxSizing: cs ? cs.boxSizing : "",
        position: cs ? cs.position : "",
        display: cs ? cs.display : "",
        rect: rect ? { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) } : null
      };
    }

    /**
     * 切调试高亮 + 把当前 px 值写到命中元素上（让 ::before label 显出来）。
     * @param enabled 调试模式开关
     * @param shiftEnabled 对话右缩开关（label 文案区分两种状态）
     * @param shiftPx 当前右缩像素值
     */
    function applyDebugMode(enabled, shiftEnabled, shiftPx) {
      if (typeof document === "undefined") return;
      if (enabled) {
        document.documentElement.setAttribute(DEBUG_HTML_ATTR, "");
        // v0.5.3 起：写到 JS 探测标记的元素 [data-dsh-ui-tweaks-shift-target] 上
        var nodes = document.querySelectorAll('[' + SHIFT_TARGET_ATTR + ']');
        for (var i = 0; i < nodes.length; i++) {
          nodes[i].setAttribute("data-shift-px", String(shiftPx || 0));
        }
        try {
          console.info("[dsh-ui-tweaks] conversation-shift-debug matched elements (JS 探测标记的元素):", [
            inspectMatch('[' + SHIFT_TARGET_ATTR + ']')
          ]);
        } catch (e) { /* 静默 */ }
      } else {
        document.documentElement.removeAttribute(DEBUG_HTML_ATTR);
      }
    }

