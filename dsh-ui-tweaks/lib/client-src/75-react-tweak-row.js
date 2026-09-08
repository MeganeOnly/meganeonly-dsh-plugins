    // ===== react-tweak-row =====
    // React 组件

    /**
     * 单条 tweak 的 row：标题 + 控件（开关 或 多选一下拉框）+ 可选数字输入。
     * description 隐藏在 `title` 属性里——鼠标悬停时由浏览器原生 tooltip 显示。
     *
     * v0.5.1 设计：开关 / number input 都**永远不 disabled**——用户必须能拨动 / 调像素
     *   再开开关（旧 v0.4.0 `disabled={!enabled}` 把数字框锁死反人类）。number input
     *   用受控 value={value} + onChange 每键更新 parent state——消除 draft / useEffect
     *   链路的 race condition。
     * v0.7.5：description 从始终渲染的 `<p>` 收进 HTML `title` 属性——6 条 tweak 在
     *   设置页铺满 200+ 像素过高，实际只有"刚开插件 / 想不起来某条做什么"时才看，
     *   悬停浏览器原生 tooltip 更精炼；CSS 加 `cursor:help` 提示。
     * v0.10.0：支持"多选一"tweak。tweak 带 `choices`（`[{value,label}]`）时头部右侧
     *   渲染 `<select>` 而不是开关——`configKeys.enabled` 存选项字符串（首例
     *   stats-line-position 的 bottom/top/hidden）。数字输入行的判定不变
     *   （仍看 `k2 !== k1`），开关型 tweak 不受影响。
     */
    function TweakRow(props) {
      var t = props.tweak;
      var state = props.state;
      var setState = props.setState;
      var k1 = t.configKeys.enabled;
      var k2 = t.configKeys.value;
      var enabled = state[k1];
      var value = state[k2];
      var hasValueInput = k2 !== k1;
      var choices = t.choices || null;
      var control = null;
      var options = [];
      var i;

      function onToggle(e) {
        var next = {};
        for (var k in state) next[k] = state[k];
        next[k1] = !!e.target.checked;
        setState(next);
      }

      function onChoiceChange(e) {
        var raw = e.target.value;
        var next = {};
        for (var k in state) next[k] = state[k];
        next[k1] = raw;
        setState(next);
      }

      function onNumberChange(e) {
        var raw = e.target.value;
        if (raw === "" || raw === "-") return; // 允许临时清空，不写 state
        var n = Number(raw);
        if (!isFinite(n) || n < 0) return;
        if (n > 800) n = 800; // 与 input max="800" + 25-tweaks.js / 35-styles.js cap 对齐
        if (n === value) return;
        var next = {};
        for (var k in state) next[k] = state[k];
        next[k2] = n;
        setState(next);
      }

      if (choices !== null) {
        for (i = 0; i < choices.length; i++) {
          options.push(jsxRuntime.jsx("option", {
            value: choices[i].value,
            children: choices[i].label
          }, choices[i].value));
        }
        // 受控 <select>：value 取当前 state；state 里是脏值 / 缺省时退回第一个
        // 选项，避免 React 受控组件拿到不存在的 value 而落到空白项
        var current = enabled;
        var matched = false;
        for (i = 0; i < choices.length; i++) {
          if (choices[i].value === current) { matched = true; break; }
        }
        if (!matched) current = choices.length > 0 ? choices[0].value : "";
        control = jsxRuntime.jsx("select", {
          className: "DTPD_select",
          "aria-label": t.name,
          value: current,
          onChange: onChoiceChange,
          children: options
        });
      } else {
        control = jsxRuntime.jsx("input", {
          type: "checkbox",
          className: "DTPD_switch",
          role: "switch",
          "aria-label": t.name,
          checked: !!enabled,
          onChange: onToggle
        });
      }

      var children = [
        jsxRuntime.jsxs("div", {
          className: "DTPD_itemHead",
          children: [
            jsxRuntime.jsx("h3", { className: "DTPD_itemName", children: t.name }),
            control
          ]
        })
      ];

      if (hasValueInput) {
        children.push(
          jsxRuntime.jsxs("div", {
            className: "DTPD_valueRow",
            children: [
              jsxRuntime.jsx("label", { className: "DTPD_valueLabel", children: "像素值" }),
              jsxRuntime.jsx("input", {
                className: "DTPD_input",
                type: "number",
                min: 0,
                max: 800,
                step: 10,
                value: value,
                onChange: onNumberChange
              }),
              jsxRuntime.jsx("span", {
                style: { color: "var(--dsw-alias-label-tertiary)", fontSize: "12px" },
                children: "px (0–800)"
              })
            ]
          })
        );
      }

      return jsxRuntime.jsx("li", {
        className: "DTPD_item",
        "data-tweak-id": t.id,
        title: t.description,
        children: children
      });
    }

