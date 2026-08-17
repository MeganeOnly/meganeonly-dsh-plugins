/**
 * dsh-simple-mode — 浏览器半端（web client bundle）
 *
 * 功能（作者：MeganeOnly）：
 * 1) 设置 → 通用 里新增一行开关“隐藏思考与工具调用过程”（默认开）。
 * 2) 打开时（纯 CSS，无 slot 覆盖）：
 *    - 工具调用整行：[data-chat-flow-kind="tool-call"]（read/edit/pwsh/bash/grep/glob 等）
 *    - 上下文注入整行：[data-chat-flow-kind="context"]
 *    - think 推理行（assistant 节点内的 reasoning block，data-variant="think"）
 *    - 其它纯过程节点（compaction / manual-compaction / model-retry / turn-error / turn-max-tokens）
 *    整体隐藏 —— 不留白色占位，不污染对话流。
 * 3) 状态行：直接 DOM 注入到 ChatView 内部的 TurnStatus("Deep diving...") 后面，
 *    与之同行显示“正在思考…/正在阅读…/正在执行命令…”，运行结束即消失。
 *    —— 让用户知道“还在工作”，又不看技术细节。
 *
 * 设计取舍：
 * - 隐藏仅靠 CSS 选择器 + display:none。DSH slot key 在新版本中频繁重命名
 *   （tool-call → command 等），slot 渲染器覆盖不稳定；CSS 属性选择器对 buildViewNode
 *   返回的 kind 一直稳定命中，零 JS 渲染干扰。
 * - 状态行位置用 DOM 注入：ChatView 的 TurnStatus 是硬编码的、无 slot 入口，但它的
 *   根 div 带 data-state 属性 + class 含 "turnStatus" substring，DOM 注入足够稳定。
 * - assistant-step 不隐藏（其 text/image 才是用户真正要看的内容）；only hide 思考 + 工具。
 *
 * 依赖经 require() 取得（react、dsh-client-runtime/client 由 shell 模块表提供）。
 */
window.__ModuleLoader__.load({
  id: "dsh-simple-mode",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");
    var runtime = require("@deepseek-ai/dsh-client-runtime/client");

    var inject = ["slots", "settingsScope"];

    var NAMESPACE = "dsh-simple-mode";
    var HIDE_FIELD = "hideToolCalls";

    /** 工具名 → 非技术化的进行中文案。 */
    function activityText(name) {
      if (!name) return "正在处理…";
      if (name === "think" || (typeof name === "string" && name.indexOf("reason") === 0)) return "正在思考…";
      if (name === "read" || name === "web_fetch") return "正在阅读…";
      if (name === "web_search") return "正在搜索…";
      if (name === "edit" || name === "write") return "正在修改文件…";
      if (name === "grep" || name === "glob") return "正在查找…";
      if (name === "bash" || name === "pwsh" || name === "run_code") return "正在执行命令…";
      return "正在处理…";
    }

    /** 偏好策略：本地快照 store + 宿主设置双向同步（默认隐藏）。 */
    function HidePolicy(scope) {
      var store = runtime.createSnapshotStore(true);
      function adopt() {
        var value = scope.getSnapshot().value;
        if (value !== void 0 && typeof value.hideToolCalls === "boolean" && store.getSnapshot() !== value.hideToolCalls) {
          store.set(value.hideToolCalls);
        }
      }
      if (scope !== void 0) {
        scope.subscribe(adopt);
        adopt();
      }
      return {
        store: store,
        set: function (v) {
          if (store.getSnapshot() === v) return;
          store.set(v);
          if (scope !== void 0) scope.set(HIDE_FIELD, v);
        }
      };
    }

    /** 设置行：隐藏思考与工具调用过程。 */
    function HideToolsRow(props) {
      var useHideToolCalls = props.useHideToolCalls;
      var setHideToolCalls = props.setHideToolCalls;
      var on = useHideToolCalls(function (v) { return v; });
      return React.createElement(
        "label",
        { style: { display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", margin: "6px 0" } },
        React.createElement("input", {
          type: "checkbox",
          checked: on === true,
          onChange: function (e) { setHideToolCalls(e.target.checked); }
        }),
        React.createElement("span", null, "隐藏思考与工具调用过程，只显示“正在处理”状态行")
      );
    }

    /**
     * 隐藏用的全局 CSS：按 DSH 渲染出来的实际 DOM 属性/类名直接隐藏整行。
     * - data-chat-flow-kind 来自 buildViewNode 的 chatNode.kind，DSH 各版本稳定。
     * - data-variant="think" 来自 ReasoningRow.module.css，DSH 各版本稳定。
     * - [class*="turnStatus"] 用 substring 匹配，避免 CSS Module 哈希跨版本崩。
     */
    var CSS_ID = "dsh-simple-mode-hide-css";
    var HIDE_CSS = [
      /* 工具调用整行（kind="tool-call"，DSH 新版本里 buildViewNode 仍用这个字面量）*/
      '[data-chat-flow-kind="tool-call"]{display:none!important}',
      /* 上下文注入整行 */
      '[data-chat-flow-kind="context"]{display:none!important}',
      /* think 推理行（assistant 节点内的 ReasoningRow，data-variant="think"）*/
      '[data-variant="think"]{display:none!important}',
      /* 其它纯过程节点 — 全部隐藏，不留白条 */
      '[data-chat-flow-kind="compaction"]{display:none!important}',
      '[data-chat-flow-kind="manual-compaction"]{display:none!important}',
      '[data-chat-flow-kind="model-retry"]{display:none!important}',
      '[data-chat-flow-kind="turn-error"]{display:none!important}',
      '[data-chat-flow-kind="turn-max-tokens"]{display:none!important}',
      /* 状态行：与 TurnStatus("Deep diving...") 同一行，靠右 */
      '.dsh-simple-mode-status{display:inline-flex;align-items:center;gap:6px;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:18px;margin-left:10px;vertical-align:middle;flex:none}'
    ].join(" ");

    function injectCss() {
      if (typeof document === "undefined") return null;
      if (document.querySelector("style[data-plugin-css=\"" + CSS_ID + "\"]") !== null) return null;
      var tag = document.createElement("style");
      tag.dataset.pluginCss = CSS_ID;
      tag.textContent = HIDE_CSS;
      document.head.appendChild(tag);
      return tag;
    }

    function removeCss(tag) {
      if (tag !== null && tag !== void 0 && tag.parentNode) tag.parentNode.removeChild(tag);
    }

    /**
     * DOM 状态行：跟随 s.running + s.chat.nodes 里最新的工具名，
     * 直接 append 到 ChatView 内部的 TurnStatus 元素后面，让它与
     * "Deep diving..." 同 row 排列（CSS 已设 inline-flex 同行对齐）。
     *
     * 不依赖任何 slot（DSH 没在 TurnStatus 旁开 slot），用纯 DOM + MutationObserver
     * 检测 TurnStatus 重渲，1s 心跳定期检测 running/toolName 变化。
     */
    function createStatusDomController(scope) {
      var STATUS_ID = "dsh-simple-mode-status-row";
      var TURN_STATUS_SEL = '[class*="turnStatus"]';
      var POLL_MS = 250;
      var current = null;
      var turnObserver = null;
      var lastTurnStatus = null;

      function snapshot() {
        var value = scope !== void 0 ? scope.getSnapshot().value : void 0;
        return value;
      }

      function pickToolName(nodes) {
        if (!nodes || typeof nodes.values !== "function") return null;
        var iter = nodes.values();
        for (var next = iter.next(); !next.done; next = iter.next()) {
          var node = next.value;
          if (!node || node.kind !== "tool-call") continue;
          var root = node.data && node.data.root;
          if (root && !("kind" in root) && typeof root.name === "string" && root.name !== "") return root.name;
        }
        return null;
      }

      function ensureStatusSpan() {
        if (typeof document === "undefined") return null;
        var existing = document.getElementById(STATUS_ID);
        if (existing !== null) return existing;
        var span = document.createElement("span");
        span.id = STATUS_ID;
        span.className = "dsh-simple-mode-status";
        span.textContent = "正在处理…";
        return span;
      }

      function findTurnStatus() {
        if (typeof document === "undefined") return null;
        var nodes = document.querySelectorAll(TURN_STATUS_SEL);
        for (var i = 0; i < nodes.length; i++) {
          var el = nodes[i];
          if (el.querySelector("#" + STATUS_ID) !== null) continue;
          return el;
        }
        return null;
      }

      function attach() {
        if (typeof document === "undefined") return;
        var turnStatus = findTurnStatus();
        if (turnStatus === null) {
          current = null;
          return;
        }
        if (turnStatus !== lastTurnStatus) {
          lastTurnStatus = turnStatus;
          watchTurnStatus(turnStatus);
        }
        var span = ensureStatusSpan();
        if (span.parentNode !== turnStatus) {
          turnStatus.appendChild(span);
        }
        current = turnStatus;
      }

      function detach() {
        if (typeof document === "undefined") return;
        var span = document.getElementById(STATUS_ID);
        if (span !== null && span.parentNode !== null) {
          span.parentNode.removeChild(span);
        }
      }

      function watchTurnStatus(el) {
        if (turnObserver !== null) {
          turnObserver.disconnect();
          turnObserver = null;
        }
        if (typeof MutationObserver === "undefined") return;
        turnObserver = new MutationObserver(function () {
          // TurnStatus 重渲（DSH 用 React mount/unmount）→ 重新挂载状态行
          if (typeof document === "undefined") return;
          var span = document.getElementById(STATUS_ID);
          if (span === null) {
            // 状态行被移除（running 结束）— 走 tick 的清除路径
            return;
          }
          if (span.parentNode !== el) {
            el.appendChild(span);
          }
        });
        turnObserver.observe(el.parentNode || document.body, { childList: true, subtree: false });
      }

      function tick() {
        if (typeof document === "undefined") return;
        var s = snapshot();
        if (!s || !s.running) {
          if (current !== null) {
            detach();
            current = null;
          }
          return;
        }
        attach();
        var span = document.getElementById(STATUS_ID);
        if (span !== null) {
          var nodes = s.chat && s.chat.nodes;
          span.textContent = activityText(pickToolName(nodes));
        }
      }

      var intervalId = null;
      function start() {
        if (typeof window === "undefined") return;
        if (intervalId !== null) return;
        intervalId = window.setInterval(tick, POLL_MS);
        tick();
      }
      function stop() {
        if (intervalId !== null) {
          window.clearInterval(intervalId);
          intervalId = null;
        }
        if (turnObserver !== null) {
          turnObserver.disconnect();
          turnObserver = null;
        }
        detach();
        current = null;
        lastTurnStatus = null;
      }
      return { start: start, stop: stop, tick: tick };
    }

    function apply(ctx) {
      var scope = ctx.settingsScope.bind({ namespace: NAMESPACE });
      var policy = HidePolicy(scope);
      var domController = createStatusDomController(scope);

      // 1) 设置页通用区：开关行
      ctx.slots.inject("settings.general.item", function () {
        return ctx.slots.register(
          {
            name: "settings.general.item",
            id: "simple-mode-hide-tools",
            order: 30,
            inject: function () {
              return {
                hooks: { hideToolCalls: policy.store },
                setHideToolCalls: function (v) { policy.set(v); }
              };
            }
          },
          HideToolsRow
        );
      });

      // 2) 隐藏（纯 CSS）和状态行（DOM 注入），跟随开关动态启停
      ctx.slots.inject("conversation.chat.node", function () {
        var cssTag = null;
        function enable() {
          if (cssTag === null) cssTag = injectCss();
          domController.start();
        }
        function disable() {
          removeCss(cssTag);
          cssTag = null;
          domController.stop();
        }
        if (policy.store.getSnapshot()) enable();
        var unsub = policy.store.subscribe(function () {
          if (policy.store.getSnapshot()) enable();
          else disable();
        });
        return function () {
          unsub();
          disable();
        };
      });
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});