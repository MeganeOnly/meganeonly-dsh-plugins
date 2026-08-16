/**
 * dsh-simple-mode — 浏览器半端（web client bundle）
 *
 * 功能（作者：MeganeOnly）：
 * 1) 设置 → 通用 里新增一行“隐藏思考与工具调用过程”（默认开）。
 * 2) 打开时：
 *    - think 推理行（assistant 节点内的 reasoning block，官方渲染为 data-variant="think"）
 *      整体隐藏 —— 覆盖 assistant-step 渲染器，只渲染正文文本与图片；
 *    - 工具调用卡片（key: tool-call）与上下文注入行（key: context）整体隐藏；
 *    - 双保险：除渲染 null 外，另注入全局 CSS 按 data-chat-flow-kind 直接隐藏
 *      对应整行，纯推理/纯工具的节点行完全消失，不留下白色空白。
 * 3) 输入框上方常驻一条极简状态行：正在思考…/正在阅读…/正在执行命令…，
 *    运行结束自动消失 —— 让非技术用户知道“还在工作”，又不看技术细节。
 *
 * 隐藏仅为展示层（不渲染/display:none），对话数据与日志不受影响。
 *
 * 依赖经 require() 取得（react、dsh-client-runtime/client、dsh-client-ui-primitives、
 * dsh-client-ui-attachment 由 shell 模块表提供）。
 */
window.__ModuleLoader__.load({
  id: "dsh-simple-mode",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");
    var runtime = require("@deepseek-ai/dsh-client-runtime/client");
    var primitives = require("@deepseek-ai/dsh-client-ui-primitives");
    var attachment = require("@deepseek-ai/dsh-client-ui-attachment");
    var MarkdownText = primitives.MarkdownText;
    var ImageGallery = attachment.ImageGallery;

    var inject = ["slots", "settingsScope"];

    var NAMESPACE = "dsh-simple-mode";
    var HIDE_FIELD = "hideToolCalls";

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

    /** 工具名 → 非技术化的进行中文案。 */
    function activityText(name) {
      if (!name) return "正在处理…";
      if (name === "think" || name.indexOf("reason") === 0) return "正在思考…";
      if (name === "read" || name === "web_fetch") return "正在阅读…";
      if (name === "web_search") return "正在搜索…";
      if (name === "edit" || name === "write") return "正在修改文件…";
      if (name === "grep" || name === "glob") return "正在查找…";
      if (name === "bash" || name === "pwsh" || name === "run_code") return "正在执行命令…";
      return "正在处理…";
    }

    /** 输入框上方的状态行：运行中显示，结束即消失。 */
    function StatusLine({ useSession }) {
      var running = useSession(function (s) { return s.running; }) ?? false;
      var toolName = useSession(function (s) {
        var nodes = s.chat && s.chat.nodes;
        if (!nodes) return null;
        var iter = nodes.values();
        for (var next = iter.next(); !next.done; next = iter.next()) {
          var node = next.value;
          if (node.kind !== "tool-call") continue;
          var root = node.data && node.data.root;
          if (root && !("kind" in root) && root.name) return root.name;
        }
        return null;
      });
      if (!running) return null;
      return React.createElement(
        "div",
        { style: { padding: "4px 2px", fontSize: "12px", opacity: 0.75 } },
        activityText(toolName)
      );
    }

    /** 设置行：隐藏思考与工具调用过程。 */
    function HideToolsRow({ useHideToolCalls, setHideToolCalls }) {
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

    /** Markdown 代码块复制按钮文案（官方 locale 的等价中文常量）。 */
    var CODE_LABELS = { copyLabel: "复制", copiedLabel: "已复制" };

    /** 图片组的加载/预览文案（MessageImageLabels 中文常量）。 */
    var IMG_LABELS = {
      image: "图片",
      open: "查看原图",
      openNamed: function (label) { return "查看原图：" + label; },
      loading: "加载中…",
      loadFailed: "加载失败，点击重试",
      lightbox: { dialog: "图片预览", close: "关闭" }
    };

    /**
     * 简洁版助手消息渲染器（覆盖官方 assistant-step 渲染器，priority -1 shadow winner）：
     * 只渲染正文文本与图片；think（reasoning）与工具调用块一律跳过；
     * 没有任何可见内容时返回 null —— 官方 flowItem:empty{display:none} 使整行
     * 消失，不留下空白间隙。
     */
    function SimpleAssistantView(props) {
      var data = props.node.data;
      var streaming = data.status === "running";
      var interrupted = data.status === "interrupted";
      var blocks = data.blocks;
      var rendered = [];
      for (var i = 0; i < blocks.length; i++) {
        var block = blocks[i];
        if (block === void 0) continue;
        if (block.kind === "text" && block.text.trim() !== "") {
          rendered.push(React.createElement(MarkdownText, {
            key: i,
            text: block.text,
            streaming: streaming,
            codeLabels: CODE_LABELS
          }));
        } else if (block.kind === "image") {
          var group = [block];
          while (i + 1 < blocks.length) {
            var next = blocks[i + 1];
            if (next === void 0 || next.kind !== "image") break;
            group.push(next);
            i += 1;
          }
          var images = group.map(function (b) { return { attachment: b.attachment }; });
          rendered.push(React.createElement(ImageGallery, {
            key: i,
            images: images,
            load: props.loadImage,
            align: "start",
            labels: IMG_LABELS
          }));
        }
        // reasoning（think）/ 空文本 / tool-call / other → 跳过，不渲染
      }
      if (rendered.length === 0) return null;
      return React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "8px" } },
        rendered,
        interrupted
          ? React.createElement("span", { style: { opacity: 0.6, fontSize: "12px" } }, "（已停止）")
          : null
      );
    }

    /** 隐藏用的全局 CSS：直接按节点 kind 隐藏整行（双保险，不依赖 flowItem:empty）。 */
    var CSS_ID = "dsh-simple-mode-hide-css";
    var HIDE_CSS = [
      '[data-chat-flow-kind="tool-call"]{display:none!important}',
      '[data-chat-flow-kind="context"]{display:none!important}',
      '[data-chat-flow-kind="assistant-step"]:empty{display:none!important}'
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

    function apply(ctx) {
      var scope = ctx.settingsScope.bind({ namespace: NAMESPACE });
      var policy = HidePolicy(scope);

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

      // 2) 输入框上方：状态行
      ctx.slots.inject("conversation.input.dock", function () {
        return ctx.slots.register(
          { name: "conversation.input.dock", id: "simple-mode-status", order: 0 },
          StatusLine
        );
      });

      // 3) 隐藏思考/上下文注入/工具调用过程（跟随开关动态注册/注销）
      ctx.slots.inject("conversation.chat.node", function () {
        var disposers = null;
        var cssTag = null;
        function register() {
          if (disposers !== null) return;
          disposers = [
            // 工具调用卡片整体隐藏（key: tool-call → 官方 ToolCallTree 的 shadow winner）
            ctx.slots.register(
              { name: "conversation.chat.node", key: "tool-call", priority: -1 },
              function () { return null; }
            ),
            // 上下文注入行整体隐藏（key: context → 官方 ContextInjectionRow 的 shadow winner）
            ctx.slots.register(
              { name: "conversation.chat.node", key: "context", priority: -1 },
              function () { return null; }
            ),
            // think 推理行隐藏：覆盖 assistant-step，只渲染正文/图片
            ctx.slots.register(
              { name: "conversation.chat.node", key: "assistant-step", priority: -1 },
              SimpleAssistantView
            )
          ];
          cssTag = injectCss();
        }
        function unregister() {
          if (disposers === null) return;
          disposers.forEach(function (dispose) { dispose(); });
          disposers = null;
          removeCss(cssTag);
          cssTag = null;
        }
        if (policy.store.getSnapshot()) register();
        var unsub = policy.store.subscribe(function () {
          if (policy.store.getSnapshot()) register();
          else unregister();
        });
        return function () {
          unsub();
          unregister();
        };
      });
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});
