/**
 * dsh-ui-tweaks — 浏览器半端（web client bundle，作者：MeganeOnly）
 *
 * v0.2.1（bug fix）：v0.2.0 把 schema 注册到 ctx.settings 就算完工，但
 * DSH 设置页**不会**自动渲染这个 namespace——每个可见 section 必须有
 * 显式的 React 组件注册到 `settings.section` slot。本版本补一个独立顶层
 * "界面微调" section（与"通用"/"插件"同级），用 schemastery schema
 * 之外的 React 直接渲染控件（开关 + 数字输入），立即写入 settings
 * namespace（不走 staging/save）。
 *
 * CSS 副作用保留（settingsScope 订阅 + buildCSS → <style data-plugin-css
 * 注入 <head>），与 v0.2.0 完全相同——只是 UI 入口补上。
 *
 * 加新 tweak 三步：
 *   1. lib/client.js TWEAKS 数组 push 一条（id/name/configKeys/defaults/buildCSS）
 *   2. lib/index.js schemastery Config 加对应字段
 *   3. 不需要改其它代码（TWEAKS 数组驱动 React 渲染 + CSS 生成）
 */
window.__ModuleLoader__.load({
  id: "dsh-ui-tweaks",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var react = require("react");
    var jsxRuntime = require("react/jsx-runtime");

    var inject = ["settingsScope", "slots"];

    var CSS_TAG_ID = "dsh-ui-tweaks/main.css";
    var SECTION_TAG_ID = "dsh-ui-tweaks/Section.css";

    /**
     * 集中维护的 UI 微调清单。每条 tweak：
     *   - id：稳定标识（注入 CSS 注释 + React key）
     *   - name / description：人类可读
     *   - configKeys.enabled / configKeys.value：对应 settings schema 字段名
     *   - defaults：未设值时的默认（与 host half schema default 一致）
     *   - buildCSS(state)：根据当前 settings 生成 CSS 字符串；返回 null 表示不注入
     *
     * 加新 tweak：push 一条 + 在 lib/index.js 加对应 schema 字段。
     */
    var TWEAKS = [
      {
        id: "conversation-shift",
        name: "对话左移让位",
        description: "让 DSH 主框架的 centerCol（对话列容器）永久右缩 N 像素，给右侧面板（如任务池抽屉）让出空间。与 task-pool 抽屉状态解耦——开关开启后始终生效，不依赖抽屉是否打开。",
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

    function getEffective(scopeValue, key, fallback) {
      if (scopeValue == null) return fallback;
      return Object.prototype.hasOwnProperty.call(scopeValue, key) ? scopeValue[key] : fallback;
    }

    function buildCSS(scopeValue) {
      var blocks = [];
      for (var i = 0; i < TWEAKS.length; i++) {
        var t = TWEAKS[i];
        var state = {};
        var k1 = t.configKeys.enabled;
        var k2 = t.configKeys.value;
        state[k1] = getEffective(scopeValue, k1, t.defaults.enabled);
        state[k2] = getEffective(scopeValue, k2, t.defaults.value);
        var css = t.buildCSS(state);
        if (css) blocks.push(css);
      }
      return blocks.join("\n\n");
    }

    function injectCSS(scopeValue) {
      var old = document.querySelector("style[data-plugin-css=\"" + CSS_TAG_ID + "\"]");
      if (old) old.remove();
      var css = buildCSS(scopeValue);
      if (!css) return;
      var tag = document.createElement("style");
      tag.dataset.plugin = "dsh-ui-tweaks";
      tag.dataset.pluginCss = CSS_TAG_ID;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    /**
     * Controller：包装 settingsScope，让 React 组件能用 useSyncExternalStore
     * 订阅。每次 scope 变更重算 snapshot（保证引用变化触发 React 重渲染）。
     *
     * API：
     *   - getSnapshot() → 当前 snapshot
     *   - subscribe(fn) → 订阅变化
     *   - set(field, value) → 写入单个字段（立即生效，无需 staging）
     */
    function UiTweaksController(scope) {
      this.scope = scope;
      this._listeners = new Set();
      this._snap = this._compute();
      var self = this;
      this._dispose = scope.subscribe(function () {
        self._snap = self._compute();
        self._listeners.forEach(function (fn) {
          try { fn(); } catch (e) { /* swallow */ }
        });
      });
    }
    UiTweaksController.prototype._compute = function () {
      var s = this.scope.getSnapshot();
      var out = {
        available: s.status === "ready",
        writable: s.writable,
      };
      for (var i = 0; i < TWEAKS.length; i++) {
        var t = TWEAKS[i];
        var k1 = t.configKeys.enabled;
        var k2 = t.configKeys.value;
        out[k1] = getEffective(s.value, k1, t.defaults.enabled);
        out[k2] = getEffective(s.value, k2, t.defaults.value);
      }
      return out;
    };
    UiTweaksController.prototype.getSnapshot = function () {
      return this._snap;
    };
    UiTweaksController.prototype.subscribe = function (fn) {
      this._listeners.add(fn);
      var self = this;
      return function () { self._listeners.delete(fn); };
    };
    UiTweaksController.prototype.set = function (field, value) {
      return this.scope.set(field, value);
    };
    UiTweaksController.prototype.dispose = function () {
      if (this._dispose) { this._dispose(); this._dispose = null; }
    };

    /**
     * section 自己的 CSS（与 DSH 原生 token 对齐，参见
     * SettingsRoot / GeneralSection / BashCard 的视觉语言）。
     * 注入一次即可，修改后再刷新 <style> 节点。
     */
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
      ".DTPD_input:disabled{opacity:.55;cursor:not-allowed}\n" +
      ".DTPD_loading{color:var(--dsw-alias-label-tertiary);font-size:13px}";
    if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=\"" + SECTION_TAG_ID + "\"]") === null) {
      var sectionTag = document.createElement("style");
      sectionTag.dataset.plugin = "dsh-ui-tweaks";
      sectionTag.dataset.pluginCss = SECTION_TAG_ID;
      sectionTag.textContent = SECTION_CSS;
      document.head.appendChild(sectionTag);
    }

    /**
     * 单条 tweak 的 row：标题 + 描述 + 控件区（开关 + 可选数字输入）。
     * 开关变化立即 controller.set(field, checked)；数字输入 onBlur 立即写入。
     */
    function TweakRow(props) {
      var t = props.tweak;
      var snap = props.snap;
      var writable = props.writable;
      var k1 = t.configKeys.enabled;
      var k2 = t.configKeys.value;
      var enabled = snap[k1];
      var value = snap[k2];

      var inputEl = react.useRef(null);
      var useState = react.useState;
      var draft = useState(String(value))[0];
      var setDraft = useState(String(value))[1];
      var useEffect = react.useEffect;
      useEffect(function () {
        // 外部值变化时同步草稿
        setDraft(String(value));
      }, [value]);

      var hasValueInput = k2 !== k1;

      var rows = [
        jsxRuntime.jsxs("div", {
          key: "head",
          className: "DTPD_itemHead",
          children: [
            jsxRuntime.jsx("h3", { key: "name", className: "DTPD_itemName", children: t.name }),
            jsxRuntime.jsx("input", {
              key: "switch",
              type: "checkbox",
              className: "DTPD_switch",
              role: "switch",
              "aria-label": t.name,
              checked: !!enabled,
              disabled: !writable,
              onChange: function (e) {
                props.controller.set(k1, !!e.target.checked);
              }
            })
          ]
        }),
        jsxRuntime.jsx("p", { key: "desc", className: "DTPD_itemDesc", children: t.description })
      ];

      if (hasValueInput) {
        rows.push(
          jsxRuntime.jsxs("div", {
            key: "valueRow",
            className: "DTPD_valueRow",
            children: [
              jsxRuntime.jsx("label", {
                key: "label",
                className: "DTPD_valueLabel",
                children: "像素值"
              }),
              jsxRuntime.jsx("input", {
                key: "input",
                ref: inputEl,
                className: "DTPD_input",
                type: "number",
                min: 0,
                step: 10,
                value: draft,
                disabled: !writable || !enabled,
                onChange: function (e) { setDraft(e.target.value); },
                onBlur: function () {
                  var n = Number(draft);
                  if (isFinite(n) && n >= 0 && n !== value) {
                    props.controller.set(k2, n);
                  } else {
                    setDraft(String(value)); // 还原
                  }
                }
              }),
              jsxRuntime.jsx("span", {
                key: "px",
                style: { color: "var(--dsw-alias-label-tertiary)", fontSize: "12px" },
                children: "px"
              })
            ]
          })
        );
      }

      return jsxRuntime.jsx("li", {
        key: t.id,
        className: "DTPD_item",
        "data-tweak-id": t.id,
        children: rows
      });
    }

    /**
     * 顶级 section 组件（注册到 settings.section slot）。
     * props 由 slot 框架注入：{ controller, close, t }.
     */
    function UiTweaksSection(props) {
      var controller = props.controller;
      var useSyncExternalStore = react.useSyncExternalStore;
      var snap = useSyncExternalStore(
        function (cb) { return controller.subscribe(cb); },
        function () { return controller.getSnapshot(); }
      );

      if (!snap.available) {
        return jsxRuntime.jsx("p", {
          className: "DTPD_loading",
          children: "加载中…"
        });
      }

      var rows = [];
      for (var i = 0; i < TWEAKS.length; i++) {
        rows.push(jsxRuntime.jsx(TweakRow, {
          tweak: TWEAKS[i],
          snap: snap,
          controller: controller,
          writable: !!snap.writable
        }, TWEAKS[i].id));
      }

      return jsxRuntime.jsxs("div", {
        className: "DTPD_section",
        children: [
          jsxRuntime.jsx("h2", { key: "title", children: "界面微调" }),
          jsxRuntime.jsx("p", {
            key: "intro",
            className: "DTPD_intro",
            children: "DSH 外观微调合集。每条 tweak 立即写入，CSS 注入到 <head>。"
          }),
          jsxRuntime.jsx("ul", {
            key: "list",
            className: "DTPD_list",
            children: rows
          })
        ]
      });
    }

    function apply(ctx) {
      // 1) 包装 settingsScope → controller（CSS + UI 共用一个 scope 实例）
      var scope = ctx.settingsScope.bind({ namespace: "ui-tweaks" });
      var controller = new UiTweaksController(scope);

      // 2) CSS 注入副作用（v0.2.0 已存在，保留）
      function sync() {
        var snap = scope.getSnapshot();
        injectCSS(snap && snap.value);
      }
      scope.subscribe(sync);
      sync();

      // 3) 注册 settings.section slot（独立顶层 "界面微调"）
      // order=5 排在 "通用"(0) 之后、"插件"(15) 之前
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "ui-tweaks",
          order: 5,
          label: function () { return "界面微调"; },
          inject: function () { return { controller: controller }; }
        }, UiTweaksSection);
      });

      // 4) fiber dispose 时清理 controller
      ctx.effect(function () { return function () { controller.dispose(); }; });
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.name = "dsh-ui-tweaks";
    return module.exports;
  }
});