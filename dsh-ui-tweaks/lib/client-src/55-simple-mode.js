    // ===== simple-mode =====
    // ====================================================================
    // 简洁模式：状态行 DOM controller（从原 dsh-simple-mode/lib/client.js 移植）
    // ====================================================================
    //
    // v0.9.5 关键修复：`simplePickToolNameFromDom` 之前查 `[data-tool-name]`
    // 找不到任何工具名——DSH 实际渲染的是 `data-tool`（见 dsh-client-ui-tool
    // lib/client.js ToolRow：`"data-tool": toolName`）。这导致 v0.9.3 起的 8 类
    // 语义色（think 蓝 / read 中性 / write 琥珀 / bash 紫 / task 青 / plan
    // 绿 / goal 粉 / git 石板）**全部从 v0.9.3 发布起就未生效过**——所有活动
    // 都 fallback 到 "正在处理…" / generic 灰。同时 think / reasoning block
    // 不在 tool-call 容器里（它在 assistant-step 的 data-variant="think"
    // 上），即使修了 data-tool 也识别不到。新增 simpleIsThinkingFromDom +
    // simplePickActivityName 统一入口：think 优先 → tool-call → fallback。
    // 真实工具名映射扩展覆盖 DSH 全部内置工具（bash / pwsh / *_persistent /
    // read_image / todo_write / *_goal / subagent / workflow / ralph / skill /
    // ask_user_question / job_* / send_message / interrupt_agent / list_agents
    // / cordis_* 等）——见 simpleActivityCategory / simpleActivityText 注释。

    function simpleActivityText(name) {
      if (!name) return "正在处理…";
      // think / reason——reasoning block（data-variant="think"）不在 tool-call
      // 容器里，由 simpleIsThinkingFromDom 提前返回 "think"
      if (name === "think" || (typeof name === "string" && name.indexOf("reason") === 0)) return "正在思考…";
      // 文件系统读取类（含 read_image）
      if (name === "read" || name === "read_image" || name === "web_fetch") return "正在阅读…";
      if (name === "web_search") return "正在搜索…";
      if (name === "grep" || name === "glob") return "正在查找…";
      // 文件编辑类
      if (name === "edit" || name === "write") return "正在修改文件…";
      // shell / 代码执行
      if (name === "bash" || name === "bash_persistent" || name === "pwsh" || name === "pwsh_persistent" || name === "run_code") return "正在执行命令…";
      // 任务调度——subagent / workflow / ralph / agent 控制 / 消息
      if (name === "subagent" || name === "workflow" || name === "ralph" || name === "task" || name === "agent") return "正在调度子任务…";
      if (name === "send_message" || name === "interrupt_agent" || name === "list_agents") return "正在协调子任务…";
      if (name === "ask_user_question") return "等待你回答…";
      // 任务清单 / 计划——DSH 实际是 todo_write（v0.9.3 之前错把 todo 写这里）
      if (name === "todo_write" || name === "todo" || name === "plan" || name === "update_plan") return "正在整理计划…";
      // 目标跟踪
      if (name === "get_goal" || name === "create_goal" || name === "update_goal" || name === "goal" || name === "objective") return "正在处理目标…";
      // jobs / skill 类轻量
      if (name === "job_output" || name === "job_list" || name === "job_kill" || name === "skill") return "正在调度…";
      // 历史扩展名——保留兼容（新工具未必启用，但 fallback 不至于坏）
      if (name === "lsp" || name === "intellisense") return "正在查询代码…";
      if (name === "commit" || name === "git") return "正在提交代码…";
      if (name === "push") return "正在推送…";
      return "正在处理…";
    }

    // v0.9.3：simpleActivityCategory(name) 返回活动类目（think / read / write /
    // bash / task / plan / goal / git / generic）。simpleActivityText 给出文案，
    // 这个给出颜色——两个轴解耦，新增工具只需在这里加一行 + CSS 加一条着色规则。
    //
    // v0.9.5 扩展：覆盖 DSH 实际工具名。`run_code` 从 bash 移到 code 单独类目
    // ——但 CSS 当前只支持 8 类（think/read/write/bash/task/plan/goal/git），
    // 为了不引入第 9 色，run_code 仍归 bash（执行类）。`todo_write` 取代
    // v0.9.3 写错的 `todo`（DSH 实际是 `todo_write`，`todo` 永远查不到）。
    // `subagent` / `workflow` / `ralph` / `job_*` / `ask_user_question` /
    // `send_message` / `interrupt_agent` / `list_agents` / `skill` 归 task。
    // cordis_* 走 prefix 匹配（DSH 注册名 `cordis_define` / `cordis_run` 等）。
    function simpleActivityCategory(name) {
      if (!name) return "generic";
      if (name === "think" || (typeof name === "string" && name.indexOf("reason") === 0)) return "think";
      if (name === "read" || name === "read_image" || name === "web_fetch" || name === "web_search" || name === "grep" || name === "glob") return "read";
      if (name === "edit" || name === "write") return "write";
      if (name === "bash" || name === "bash_persistent" || name === "pwsh" || name === "pwsh_persistent" || name === "run_code") return "bash";
      if (name === "subagent" || name === "workflow" || name === "ralph" || name === "task" || name === "agent" || name === "send_message" || name === "interrupt_agent" || name === "list_agents" || name === "ask_user_question" || name === "job_output" || name === "job_list" || name === "job_kill" || name === "skill" || (typeof name === "string" && name.indexOf("cordis_") === 0)) return "task";
      if (name === "todo_write" || name === "todo" || name === "plan" || name === "update_plan") return "plan";
      if (name === "get_goal" || name === "create_goal" || name === "update_goal" || name === "goal" || name === "objective") return "goal";
      if (name === "commit" || name === "git" || name === "push") return "git";
      return "generic";
    }

    // v0.9.5：simplePickToolNameFromDom 改查 `[data-tool]`（DSH 实际渲染的
    // 属性名，见 dsh-client-ui-tool/lib/client.js ToolRow：`"data-tool": toolName`）。
    // 旧路径 `[data-tool-name]` 是命名错误——v0.9.3 美术度升级时
    // 写错了 selector，从 v0.9.3 发布起 8 类语义色**全部未生效**。
    // 保留 `[data-name]` / `[class*="toolName"]` / `[class*="toolLabel"]`
    // 作 fallback——以防 DSH 未来切换到不同的属性约定（substring match 不依赖 hash，
    // 与 v0.7.3 hide-sidebar-tooltip CSS 的 substring 策略一致）。
    function simplePickToolNameFromDom() {
      if (typeof document === "undefined") return null;
      var nodes = document.querySelectorAll('[data-chat-flow-kind="tool-call"]');
      if (nodes.length === 0) return null;
      var last = nodes[nodes.length - 1];
      // 主路径：DSH ToolRow 渲染的 data-tool 属性（v0.9.5 起）
      var named = last.querySelector("[data-tool]");
      if (named) {
        var dn = named.getAttribute("data-tool");
        if (dn) return dn;
      }
      // 兜底 1：data-name——历史 DSH 早期可能用过
      var named2 = last.querySelector("[data-name]");
      if (named2) {
        var dn2 = named2.getAttribute("data-name");
        if (dn2) return dn2;
      }
      // 兜底 2：CSS module hash class 子串匹配（DSH 升级换 hash 仍命中）
      var labels = last.querySelectorAll('[class*="toolName"], [class*="toolLabel"]');
      for (var i = 0; i < labels.length; i++) {
        var t = (labels[i].textContent || "").trim();
        if (t) return t;
      }
      return null;
    }

    // v0.9.5：reasoning / think block 渲染在 assistant-step 节点的
    // `[data-variant="think"]` 上（见 dsh-client-ui-conversation/lib/client.js
    // ReasoningRow：`"data-variant": "think"` + `"data-state": "running"`），
    // 不在 tool-call 容器里——simplePickToolNameFromDom 找不到。
    // 单独探测 `[data-state="running"]` 的 think block，存在即认为正在思考。
    // 注意 simple-mode 已把 `[data-variant="think"]` 整行 display:none，但
    // querySelectorAll 不看渲染状态——DOM 里有就能命中。
    function simpleIsThinkingFromDom() {
      if (typeof document === "undefined") return false;
      // 只在当前有 assistant-step 节点（最近的一批）里查——性能优化，避免每次
      // 250ms tick 扫整个 DOM。`[data-chat-flow-kind="assistant-step"]` 与
      // `simplePickToolNameFromDom` 的 `[data-chat-flow-kind="tool-call"]` 对称。
      var steps = document.querySelectorAll('[data-chat-flow-kind="assistant-step"]');
      if (steps.length === 0) return false;
      // 取最后一个（最新）assistant-step 内的 think block
      var last = steps[steps.length - 1];
      // 找 data-state="running" 的 think 块——reasoning 正在流式输出
      var running = last.querySelector('[data-variant="think"][data-state="running"]');
      return running !== null;
    }

    // v0.9.5：simplePickActivityName 统一入口。think（reasoning 流式）优先于
    // tool-call——因为模型先 think 再调工具，think 状态先出现时还没 tool-call
    // 节点；tool-call 出现后由 simplePickToolNameFromDom 接替。返回 "think" /
    // "toolName" / null（generic fallback）三种。
    // 性能：两个 querySelector 各自 250ms 一次，单次 0.5ms 量级，可忽略。
    function simplePickActivityName() {
      if (simpleIsThinkingFromDom()) return "think";
      return simplePickToolNameFromDom();
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
      // v0.9.3：缓存上次写入 span 的 (category, text) 合并 key——tick 每 250ms 跑一次，
      // 但 99% 时间工具名没变（同时 category 也不变），不写 DOM 就不会触发 React
      // reconciler 监听 attribute / textContent 变化。category 用 "\u0000" 与 text
      // 隔开防止碰撞（工具名 / 文案里都不会出现 NUL）。
      var lastKey = null;

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
          lastKey = null;
          return;
        }
        attach();
        var span = document.getElementById(SIMPLE_STATUS_ID);
        if (span === null) return;
        // v0.9.5：simplePickActivityName 统一入口——think 优先于 tool-call。
        // 之前直接调 simplePickToolNameFromDom 时，think 状态返回 null →
        // "正在处理…"（generic 灰）；reasoning block 不在 tool-call 容器里
        // 这件事从 v0.9.3 美术度升级起就一直没解决。
        var name = simplePickActivityName();
        var text = simpleActivityText(name);
        // v0.9.3：category 给 CSS 着色用（[data-dsh-activity]），与 text 同步写。
        // 合并 key = category + "\u0000" + text——任一变化才走 DOM 写，避免 250ms
        // 轮询 × React reconciler 监听 attribute / textContent 变化的浪费。
        var category = simpleActivityCategory(name);
        var key = category + "\u0000" + text;
        if (key === lastKey) return;
        lastKey = key;
        span.textContent = text;
        span.setAttribute(SIMPLE_STATUS_ACTIVITY_ATTR, category);
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
        lastKey = null;
        isRunning = false;
      }
      return {
        start: start,
        stop: stop,
        get running() { return isRunning; }
      };
    }

