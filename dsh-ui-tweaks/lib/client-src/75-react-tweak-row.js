    // ===== react-tweak-row =====
    // ====================================================================
    // React 组件
    // ====================================================================

    /**
     * 单条 tweak 的 row：标题 + 开关 + 可选数字输入。description 隐藏在
     * `title` 属性里——鼠标悬停时由浏览器原生 tooltip 显示。
     *
     * 设计选择（v0.5.1）：
     *  - 开关**永远不 disabled**——用户必须能拨动它（v0.4.0 / v0.5.0 默认 enabled=false，
     *    但 UI 仍要可点；之前 `disabled={!enabled}` 用在 number input 是 bug，因为用户
     *    看不见开关时就被锁住，反人类）
     *  - number input 也**永远不 disabled**——可以先调像素再开开关
     *  - number input 用受控 value={value} + onChange 每键更新 parent state，
     *    没有 draft/useEffect 链。简化、消除受控输入框 边界 race condition。
     *
     * v0.7.5：description 从始终渲染的 `<p>` 收进 HTML `title` 属性。
     *   旧实现：每条 tweak 始终渲染一段 1-3 行的描述文字（最长 60+ 字），6 条 tweak
     *   在设置页铺满 200+ 像素高——但实际只有"刚开插件 / 想不起来某条做什么"时
     *   才需要看描述。新实现：description 默认不渲染，鼠标悬停在 row 上（或键盘
     *   focus）时弹出浏览器原生 tooltip（HTML `title` 属性）——所见即所得、无
     *   额外 CSS、无 JS state。CSS 同步加 `cursor:help` 提示可悬停。
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

      function onToggle(e) {
        var next = {};
        for (var k in state) next[k] = state[k];
        next[k1] = !!e.target.checked;
        setState(next);
      }

      function onNumberChange(e) {
        var raw = e.target.value;
        if (raw === "" || raw === "-") return; // 允许临时清空，不写 state
        var n = Number(raw);
        if (!isFinite(n) || n < 0) return;
        if (n === value) return;
        var next = {};
        for (var k in state) next[k] = state[k];
        next[k2] = n;
        setState(next);
      }

      var children = [
        jsxRuntime.jsxs("div", {
          className: "DTPD_itemHead",
          children: [
            jsxRuntime.jsx("h3", { className: "DTPD_itemName", children: t.name }),
            jsxRuntime.jsx("input", {
              type: "checkbox",
              className: "DTPD_switch",
              role: "switch",
              "aria-label": t.name,
              checked: !!enabled,
              onChange: onToggle
            })
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
        // v0.7.5：description 改 HTML title（浏览器原生 tooltip）—悬停时显示，无需额外 CSS/JS
        title: t.description,
        children: children
      });
    }