    // ===== react-section =====
    /** 顶级 section 组件。自包含——内部 useState 用 loadState() 做 lazy init。 */
    function UiTweaksSection() {
      var stateState = react.useState(loadState);
      var state = stateState[0];
      var setState = stateState[1];

      react.useEffect(function () {
        saveState(state);
        injectCSS(state);
        if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
          try {
            window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: state }));
          } catch (e) { /* 静默 */ }
        }
      }, [state]);

      var rows = [];
      for (var i = 0; i < TWEAKS.length; i++) {
        rows.push(jsxRuntime.jsx(TweakRow, {
          tweak: TWEAKS[i],
          state: state,
          setState: setState
        }, TWEAKS[i].id));
      }

      return jsxRuntime.jsxs("div", {
        className: "DTPD_section",
        children: [
          jsxRuntime.jsx("h2", { children: "界面微调" }),
          jsxRuntime.jsx("p", {
            className: "DTPD_intro",
            children: "DSH 外观微调合集。状态存于本机 localStorage（dsh-ui-tweaks/state）。浏览器 console 跑 window.__dshUiTweaks.debug() 可看完整诊断。"
          }),
          jsxRuntime.jsx("ul", { className: "DTPD_list", children: rows })
        ]
      });
    }

