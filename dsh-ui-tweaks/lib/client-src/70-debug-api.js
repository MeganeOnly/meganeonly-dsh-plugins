    // ===== debug-api =====
    // ====================================================================
    // 诊断 API（暴露 window.__dshUiTweaks）
    // ====================================================================

    function createDebugAPI() {
      return {
        VERSION: VERSION,
        getState: function () { return loadState(); },
        getInjectedCSS: function () {
          var t = document.querySelector("style[data-plugin-css=\"" + MAIN_CSS_TAG_ID + "\"]");
          return t ? t.textContent : null;
        },
        getMatchedElements: function () {
          // v0.5.3 起：返回 JS 探测打标记的元素 + 列容器对照
          var sels = [
            { key: "column (centerCol / data-pane)", selector: '[' + SHIM_PANE_ATTR + '="' + SHIM_PANE_VALUE + '"], [class*="centerCol"]' },
            { key: "shift targets (JS 探测 + 标记的 chatflow / input / 兜底 column)", selector: '[' + SHIFT_TARGET_ATTR + ']' }
          ];
          var out = {};
          for (var i = 0; i < sels.length; i++) {
            var nodes = document.querySelectorAll(sels[i].selector);
            var arr = [];
            for (var j = 0; j < nodes.length; j++) {
              var n = nodes[j];
              var cs = window.getComputedStyle(n);
              var shiftType = n.getAttribute(SHIFT_TARGET_ATTR) || null;
              arr.push({
                tag: n.tagName,
                cls: n.className,
                shiftType: shiftType,
                padR: cs.paddingRight,
                offsetW: n.offsetWidth,
                offsetH: n.offsetHeight,
                rect: { x: Math.round(n.getBoundingClientRect().x), y: Math.round(n.getBoundingClientRect().y), w: Math.round(n.getBoundingClientRect().width), h: Math.round(n.getBoundingClientRect().height) }
              });
            }
            out[sels[i].key] = arr;
          }
          return out;
        },
        debug: function () {
          console.group("[dsh-ui-tweaks v" + VERSION + "] debug");
          console.log("state:", this.getState());
          console.log("injected CSS:", this.getInjectedCSS());
          console.log("matched elements:", this.getMatchedElements());
          console.groupEnd();
        },
        /** 调试用：直接 patch state，触发 saveState + injectCSS + 状态事件 */
        setState: function (patch) {
          var cur = this.getState();
          var next = {};
          for (var k in cur) next[k] = cur[k];
          for (var k2 in patch) next[k2] = patch[k2];
          saveState(next);
          injectCSS(next);
          if (typeof window !== "undefined" && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: next }));
          }
          return next;
        },
        /** 立即重跑 self-shim（调试用） */
        reshim: function () {
          return applyShellShim();
        }
      };
    }

