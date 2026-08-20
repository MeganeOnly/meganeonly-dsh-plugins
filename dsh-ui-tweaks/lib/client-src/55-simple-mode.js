    // ===== simple-mode =====
    // ====================================================================
    // 简洁模式：状态行 DOM controller（从原 dsh-simple-mode/lib/client.js 移植）
    // ====================================================================

    function simpleActivityText(name) {
      if (!name) return "正在处理…";
      if (name === "think" || (typeof name === "string" && name.indexOf("reason") === 0)) return "正在思考…";
      if (name === "read" || name === "web_fetch") return "正在阅读…";
      if (name === "web_search") return "正在搜索…";
      if (name === "edit" || name === "write") return "正在修改文件…";
      if (name === "grep" || name === "glob") return "正在查找…";
      if (name === "bash" || name === "pwsh" || name === "run_code") return "正在执行命令…";
      // 子 agent / 任务调度——不细分工具名（task / subagent / agent），统一文案即可
      if (name === "task" || name === "subagent" || name === "agent") return "正在调度子任务…";
      // 待办 / 计划类（todo / plan / update_plan）——内部细节差异不影响用户视角
      if (name === "todo" || name === "plan" || name === "update_plan") return "正在整理计划…";
      // 代码智能查询——LSP 类工具用户能识别即可
      if (name === "lsp" || name === "intellisense") return "正在查询代码…";
      // goal / objective 类工具（DSH 目标/任务跟踪）
      if (name === "goal" || name === "objective") return "正在处理目标…";
      // git / commit / push ——代码版本控制
      if (name === "commit" || name === "git") return "正在提交代码…";
      if (name === "push") return "正在推送…";
      return "正在处理…";
    }

    function simplePickToolNameFromDom() {
      if (typeof document === "undefined") return null;
      var nodes = document.querySelectorAll('[data-chat-flow-kind="tool-call"]');
      if (nodes.length === 0) return null;
      var last = nodes[nodes.length - 1];
      var named = last.querySelector("[data-tool-name]");
      if (named) {
        var dn = named.getAttribute("data-tool-name");
        if (dn) return dn;
      }
      var named2 = last.querySelector("[data-name]");
      if (named2) {
        var dn2 = named2.getAttribute("data-name");
        if (dn2) return dn2;
      }
      var labels = last.querySelectorAll('[class*="toolName"], [class*="toolLabel"]');
      for (var i = 0; i < labels.length; i++) {
        var t = (labels[i].textContent || "").trim();
        if (t) return t;
      }
      return null;
    }

    function simpleIsRunningFromDom() {
      if (typeof document === "undefined") return false;
      return document.querySelector(SIMPLE_TURN_STATUS_SEL) !== null;
    }

    function createSimpleModeStatusController() {
      var current = null;
      var turnObserver = null;
      var intervalId = null;
      var lastTurnStatus = null;
      // 暴露给 apply() 读取的运行状态——避免外部另起 `_running` 标志导致状态
      // 不一致（apply() 的 onStateChange 用 simpleController.running 读判断，
      // 与 createTrajectoryTabHider 的 `get running()` 风格对齐）。
      var isRunning = false;
      // 缓存上次写入 span 的文本——tick 每 250ms 跑一次，但 99% 时间工具名没变，
      // 不写 DOM 就不会触发 React reconciler 监听 attribute / textContent 变化。
      var lastText = null;

      function ensureStatusSpan() {
        if (typeof document === "undefined") return null;
        var existing = document.getElementById(SIMPLE_STATUS_ID);
        if (existing !== null) return existing;
        var span = document.createElement("span");
        span.id = SIMPLE_STATUS_ID;
        span.className = SIMPLE_STATUS_CLASS;
        span.textContent = "正在处理…";
        return span;
      }

      function findTurnStatus() {
        if (typeof document === "undefined") return null;
        var nodes = document.querySelectorAll(SIMPLE_TURN_STATUS_SEL);
        // 倒序遍历——文档顺序里最新 turn 在最后。当前正在运行的 turn 的 status
        // 元素会一直被 DSH 重渲保持在 DOM 末尾；历史已结束 turn 的 status 元素
        // 同样含 turnStatus 类但排在前。取最后一个可以确保状态行只注入当前 turn,
        // 滚动到上方看历史对话时不会被错误地注入到旧 turn 上。
        for (var i = nodes.length - 1; i >= 0; i--) {
          var el = nodes[i];
          if (el.querySelector("#" + SIMPLE_STATUS_ID) !== null) continue;
          return el;
        }
        return null;
      }

      function attach() {
        if (typeof document === "undefined") return;
        // 已经在 attach 到当前 turnStatus——watchTurnStatus 的 MutationObserver
        // 会负责把 span 重新挂回去（DSH 偶尔会把它 detach），不需要每 250ms 重新
        // 跑 findTurnStatus + ensureStatusSpan + appendChild。tick 高频轮询下
        // 跳过这些 DOM 操作显著降低开销。
        if (current !== null) {
          var existing = document.getElementById(SIMPLE_STATUS_ID);
          if (existing !== null && existing.parentNode !== null) return;
        }
        var turnStatus = findTurnStatus();
        if (turnStatus === null) { current = null; return; }
        if (turnStatus !== lastTurnStatus) {
          lastTurnStatus = turnStatus;
          watchTurnStatus(turnStatus);
        }
        var span = ensureStatusSpan();
        if (span.parentNode !== turnStatus) turnStatus.appendChild(span);
        current = turnStatus;
      }

      function detach() {
        if (typeof document === "undefined") return;
        var span = document.getElementById(SIMPLE_STATUS_ID);
        if (span !== null && span.parentNode !== null) span.parentNode.removeChild(span);
      }

      function watchTurnStatus(el) {
        if (turnObserver !== null) { turnObserver.disconnect(); turnObserver = null; }
        if (typeof MutationObserver === "undefined") return;
        turnObserver = new MutationObserver(function () {
          if (typeof document === "undefined") return;
          var span = document.getElementById(SIMPLE_STATUS_ID);
          if (span === null) return;
          if (span.parentNode !== el) el.appendChild(span);
        });
        turnObserver.observe(el.parentNode || document.body, { childList: true, subtree: false });
      }

      function tick() {
        if (typeof document === "undefined") return;
        if (!simpleIsRunningFromDom()) {
          if (current !== null) { detach(); current = null; }
          lastText = null;
          return;
        }
        attach();
        var span = document.getElementById(SIMPLE_STATUS_ID);
        if (span === null) return;
        var text = simpleActivityText(simplePickToolNameFromDom());
        // 文字未变就跳过 setTextContent——tick 每 250ms 跑，绝大多数 tick
        // 工具名不变，写 DOM 触发 mutation listeners 是浪费。
        if (text === lastText) return;
        lastText = text;
        span.textContent = text;
      }

      function start() {
        if (typeof window === "undefined") return;
        if (intervalId !== null) return;
        isRunning = true;
        intervalId = window.setInterval(tick, SIMPLE_POLL_MS);
        tick();
      }
      function stop() {
        if (intervalId !== null) { window.clearInterval(intervalId); intervalId = null; }
        if (turnObserver !== null) { turnObserver.disconnect(); turnObserver = null; }
        detach();
        current = null;
        lastTurnStatus = null;
        lastText = null;
        isRunning = false;
      }
      return {
        start: start,
        stop: stop,
        get running() { return isRunning; }
      };
    }

