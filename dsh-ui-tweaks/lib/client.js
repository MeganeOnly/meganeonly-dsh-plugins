/**
 * dsh-ui-tweaks — 浏览器端（web client bundle，作者：MeganeOnly）
 *
 * v0.3.1 起：UiTweaksSection 自包含（不依赖 props.initialState），直接传
 * 函数组件引用给 ctx.slots.register（与 dsh-usage-stats 同模式）；React
 * key 用 jsx 第三参数而非 spread props（消除 React "key in spread" 警告）。
 *
 * 数据通路：tweak 状态完全由浏览器侧用 localStorage 自管（不再走 DSH
 * settingsScope / DSH settings namespace）。根因是 DSH API gateway
 * `@deepseek-ai/dsh-host-apiproxy` 的 `exposedNamespaces()` 硬编码白名单
 * 只覆盖 8 个 DSH 内置 namespace，第三方 host-plane 插件 namespace 全部
 * silent filter。详见 DECISIONS.md C003。
 *
 * UI 集成：注册 settings.section slot（id="ui-tweaks", order=5），用 React
 * 函数组件 UiTweaksSection 渲染 TWEAKS 列表；每条 tweak 一个 row：标题 +
 * 描述 + 开关 + 可选数字输入。状态变化立即写 localStorage + 重生成 CSS
 * 注入 <head>。不走 staging/save。
 *
 * 加新 tweak：往 lib/client.js 的 TWEAKS 数组 push 一条 + 不需要改其它
 * 代码（React UI 按 TWEAKS 数组自动渲染，CSS 生成按 TWEAKS 数组自动构建，
 * loadState/saveState 自动覆盖）。
 */
window.__ModuleLoader__.load({
  id: "dsh-ui-tweaks",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var react = require("react");
    var jsxRuntime = require("react/jsx-runtime");

    var inject = ["slots"];

    var MAIN_CSS_TAG_ID = "dsh-ui-tweaks/main.css";
    var SECTION_CSS_TAG_ID = "dsh-ui-tweaks/Section.css";
    var STORAGE_KEY = "dsh-ui-tweaks/state";

    /**
     * 集中维护的 UI 微调清单。每条 tweak：
     *   - id：稳定标识（注入 CSS 注释 + React key）
     *   - name：人类可读标题
     *   - description：人类可读说明（用户视角，不写开发者术语）
     *   - configKeys.enabled / configKeys.value：localStorage 持久化的字段名
     *     （若 enabled == value 表示此 tweak 只有开关没有参数）
     *   - defaults：未设值时的默认
     *   - buildCSS(state)：根据当前 settings 生成 CSS 字符串；返回 null 表示不注入
     */
    var TWEAKS = [
      {
        id: "conversation-shift",
        name: "对话区右缩",
        description: "把中间的对话窗口从右边压缩 N 像素，给右侧面板腾出空间。",
        configKeys: { enabled: "conversationShift", value: "conversationShiftPx" },
        defaults: { enabled: false, value: 380 },
        buildCSS: function (state) {
          if (!state.conversationShift) return null;
          var px = Number(state.conversationShiftPx);
          if (!isFinite(px) || px < 0) px = 380;
          return "/* === conversation-shift : centerCol padding-right " + px + "px === */\n" +
            "html [class*=\"centerCol\"]{padding-right:" + px + "px !important;transition:padding-right .22s ease;}";
        }
      }
      // ↓ 未来加在这里
    ];

    // ====================================================================
    // localStorage 持久化（按 dsh-persistent-plugin-authoring skill §三
    // "localStorage 持久化降级" + "schema 演进不升 localStorage key"）
    // ====================================================================

    /** 探针可用性。storage 不可用时 = undefined，load 返回默认、save 静默跳过。 */
    var storage = null;
    try {
      var probeKey = STORAGE_KEY + "__probe__";
      window.localStorage.setItem(probeKey, "1");
      window.localStorage.removeItem(probeKey);
      storage = window.localStorage;
    } catch (e) {
      console.warn("[dsh-ui-tweaks] localStorage unavailable, tweaks will not persist across reloads:", e);
    }

    /** 用 TWEAKS 默认值构造初始 state（不读 storage）。 */
    function defaultState() {
      var state = {};
      for (var i = 0; i < TWEAKS.length; i++) {
        var t = TWEAKS[i];
        state[t.configKeys.enabled] = t.defaults.enabled;
        state[t.configKeys.value] = t.defaults.value;
      }
      return state;
    }

    /** 从 storage 读 state，与 defaultState 合并（缺字段默认 false / 0）。损坏则回退默认。 */
    function loadState() {
      var state = defaultState();
      if (!storage) return state;
      var raw;
      try { raw = storage.getItem(STORAGE_KEY); } catch (e) { return state; }
      if (!raw) return state;
      try {
        var saved = JSON.parse(raw);
        if (saved && typeof saved === "object") {
          for (var k in saved) {
            if (Object.prototype.hasOwnProperty.call(state, k)) state[k] = saved[k];
          }
        }
      } catch (e) { /* 损坏则用默认 */ }
      return state;
    }

    /** 写 state 到 storage（始终写完整 state，无稀疏 patch）。 */
    function saveState(state) {
      if (!storage) return;
      try {
        var out = {};
        for (var i = 0; i < TWEAKS.length; i++) {
          var t = TWEAKS[i];
          out[t.configKeys.enabled] = state[t.configKeys.enabled];
          out[t.configKeys.value] = state[t.configKeys.value];
        }
        storage.setItem(STORAGE_KEY, JSON.stringify(out));
      } catch (e) { /* 静默 */ }
    }

    // ====================================================================
    // CSS 注入（按 dsh-persistent-plugin-authoring skill §三 "注入全局 CSS"）
    // ====================================================================

    /** 把当前 state 翻译为一段 CSS（多条 tweak 拼接）。 */
    function buildCSS(state) {
      var blocks = [];
      for (var i = 0; i < TWEAKS.length; i++) {
        var css = TWEAKS[i].buildCSS(state);
        if (css) blocks.push(css);
      }
      return blocks.join("\n\n");
    }

    /** 注入主 CSS 标签（去重 + 重建）。即使未打开设置页也需运行。 */
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

    /** section section 样式（与 DSH 原生设置页 token 对齐）。仅注入一次。 */
    var SECTION_CSS =
      ".DTPD_section{max-width:760px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:18px;display:flex}\n" +
      ".DTPD_section h2{margin:0;font-size:18px;font-weight:600}\n" +
      ".DTPD_intro{color:var(--dsw-alias-label-tertiary);margin:0 0 4px;font-size:13px}\n" +
      ".DTPD_list{flex-direction:column;gap:10px;margin:0;padding:0;list-style:none;display:flex}\n" +
      ".DTPD_item{box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;flex-direction:column;gap:8px;padding:14px 16px;display:flex}\n" +
      ".DTPD_itemHead{flex-direction:row;justify-content:space-between;align-items:center;gap:12px;display:flex}\n" +
      ".DTPD_itemName{margin:0;font-size:14px;font-weight:500;line-height:22px}\n" +
      ".DTPD_itemDesc{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}\n" +
      ".DTPD_switch{appearance:none;cursor:pointer;width:34px;height:20px;background:var(--dsw-alias-bg-component-disabled);border-radius:999px;position:relative;transition:background .15s ease;flex:none}\n" +
      ".DTPD_switch:checked{background:var(--dsw-alias-state-business-primary)}\n" +
      ".DTPD_switch::after{content:\"\";position:absolute;top:2px;left:2px;width:16px;height:16px;background:var(--dsw-alias-bg-layer-1);border-radius:50%;transition:transform .15s ease}\n" +
      ".DTPD_switch:checked::after{transform:translateX(14px)}\n" +
      ".DTPD_switch:disabled{cursor:not-allowed;opacity:.55}\n" +
      ".DTPD_valueRow{align-items:center;gap:8px;display:flex}\n" +
      ".DTPD_valueLabel{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;min-width:64px}\n" +
      ".DTPD_input{box-sizing:border-box;width:120px;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-input-major);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 8px;font-family:inherit;font-size:13px;line-height:20px}\n" +
      ".DTPD_input:focus{border-color:var(--dsw-alias-state-business-primary);outline:none}\n" +
      ".DTPD_input:disabled{opacity:.55;cursor:not-allowed}";

    function injectSectionCSS() {
      if (document.querySelector("style[data-plugin-css=\"" + SECTION_CSS_TAG_ID + "\"]")) return;
      var tag = document.createElement("style");
      tag.dataset.plugin = "dsh-ui-tweaks";
      tag.dataset.pluginCss = SECTION_CSS_TAG_ID;
      tag.textContent = SECTION_CSS;
      document.head.appendChild(tag);
    }

    // ====================================================================
    // React 组件
    // ====================================================================

    /**
     * 单条 tweak 的 row：标题 + 描述 + 开关 + 可选数字输入。
     * 无 props 依赖（state/setState 从父传），关闭后数字框 disabled。
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

      var draftState = react.useState(String(value));
      var draft = draftState[0];
      var setDraft = draftState[1];
      react.useEffect(function () { setDraft(String(value)); }, [value]);

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
              onChange: function (e) {
                var next = {};
                for (var k in state) next[k] = state[k];
                next[k1] = !!e.target.checked;
                setState(next);
              }
            })
          ]
        }),
        jsxRuntime.jsx("p", { className: "DTPD_itemDesc", children: t.description })
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
                step: 10,
                value: draft,
                disabled: !enabled,
                onChange: function (e) { setDraft(e.target.value); },
                onBlur: function () {
                  var n = Number(draft);
                  if (isFinite(n) && n >= 0 && n !== value) {
                    var next = {};
                    for (var k in state) next[k] = state[k];
                    next[k2] = n;
                    setState(next);
                  } else {
                    setDraft(String(value));
                  }
                }
              }),
              jsxRuntime.jsx("span", {
                style: { color: "var(--dsw-alias-label-tertiary)", fontSize: "12px" },
                children: "px"
              })
            ]
          })
        );
      }

      return jsxRuntime.jsx("li", {
        className: "DTPD_item",
        "data-tweak-id": t.id,
        children: children
      });
    }

    /**
     * 顶级 section 组件。自包含——不依赖 props，直接在内部 useState 用
     * loadState() 做 lazy init（与 dsh-usage-stats 的 UsageStatsPage 同模式：
     * 直接传给 ctx.slots.register 作为函数组件引用，DSH slot 框架按
     * <UiTweaksSection /> 渲染）。
     */
    function UiTweaksSection() {
      var stateState = react.useState(loadState);
      var state = stateState[0];
      var setState = stateState[1];

      // 状态变化时持久化 + CSS 重注入（toggle 立即可见 + 跨重启生效）
      react.useEffect(function () {
        saveState(state);
        injectCSS(state);
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
          jsxRuntime.jsx("p", { className: "DTPD_intro", children: "DSH 外观微调合集。状态存于本机 localStorage（dsh-ui-tweaks/state）。" }),
          jsxRuntime.jsx("ul", { className: "DTPD_list", children: rows })
        ]
      });
    }

    // ====================================================================
    // apply（loader 调一次，DSH 启动时执行）
    // ====================================================================

    function apply(ctx) {
      // 1) 注入初始 CSS：即便用户没打开设置页，tweak 状态也立即生效
      //    （DSH 启动时跑一次；后续用户改值由 UiTweaksSection 的 useEffect 触发）
      injectCSS(loadState());
      injectSectionCSS();

      // 2) 注册 settings.section slot
      //    order=5 排在 "通用"(0) 之后、"插件"(15) 之前
      //    thunk 返回 React 元素（与 dshmarket 同模式；DSH slot 框架调
      //    thunk 拿元素 → 渲染）。UiTweaksSection 自包含（无 props 依赖，
      //    内部 useState 用 loadState() 做 lazy init），调用时 props=null
      //    不会崩。
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "ui-tweaks",
          order: 5,
          label: function () { return "界面微调"; }
        }, function () {
          // 传 {} 而非 null/undefined：React 18 dev mode 的 jsx-runtime
          // 对 props=undefined 抛 hasOwnProperty.call 错误（实测）。
          // UiTweaksSection 自包含，不读 props。
          return jsxRuntime.jsx(UiTweaksSection, {});
        });
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.name = "dsh-ui-tweaks";
    return module.exports;
  }
});