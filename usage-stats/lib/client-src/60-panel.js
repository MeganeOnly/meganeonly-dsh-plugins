// ===== visibility panel =====
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
    }