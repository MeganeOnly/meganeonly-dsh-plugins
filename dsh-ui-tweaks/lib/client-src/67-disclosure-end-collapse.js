    // ===== disclosure-end-collapse =====
    // ====================================================================
    // v0.9.6：折叠块末尾收起按钮——给所有 DisclosureRow 展开后的 body 末尾
    //   追加"收起"按钮，解决"展开后想收起需要一直往前翻到头部"的痛点
    // --------------------------------------------------------------------
    // 背景：DSH 用 DisclosureRow 渲染三类可展开块——
    //   1. ReasoningRow (data-variant="think"): Think 推理块——长内容最常见
    //   2. GenericCommandCard (data-variant="others"): 工具调用输出（bash /
    //      edit / read / grep / glob 等多行输出时 body 才会渲染）
    //   3. ContextInjectionRow (class 含 _root 且 data-open): 上下文注入
    // 全部 expandOnRowClick=true——点击头部行切换展开。展开后阅读完毕想收起
    //   时必须滚回头部点行；长 Think 内容滚回很烦（尤其 reasoning 流式输出几 KB）。
    //
    // 解法：JS MutationObserver 巡检 body 元素（仅当 expanded 时 body 才在 DOM 里）
    //   给每个 body 末尾注入 wrapper div + "收起 ▴" 按钮。点击时找 body 父元素
    //   里 className 含 _row 的兄弟，调 .click() 触发 DSH React onToggle →
    //   setExpanded(false) → row 折叠，body 与按钮一起被卸载。stopPropagation
    //   防止冒泡——虽然 row 是 body 的兄弟不在祖先链上，但保险起见 stop。
    //
    // 兼容性：依赖 DSH row 元素接收 native click 事件并触发 React handler。
    //   React 17+ 委托到 root container，row.click() 会冒泡触发 onToggle。
    //   不修改 DSH 任何代码，纯附加层。
    //
    // v0.9.6 决策依据：之前反复考虑把按钮放在 body 内 vs body 外（兄弟）。
    //   选 body 内（append）— 按钮随 body 一起出现/消失，无需复杂生命周期管理；
    //   body 卸载时按钮自动 remove（React unmount 也会带走 wrapper div）；
    //   inline 位置由 body padding-left/margin-left 决定（Think 22px / Command
    //   16px / Context 22px），无需每个变体单独处理 indent。
    // ====================================================================

    /**
     * 给定已展开的 body 元素，找它在 DisclosureRow 里的"点击行"——也就是
     *   触发 setExpanded 反转的 row 元素。
     *
     * 布局：DisclosureRow 把 row（点击行）和 children（body）作为直接兄弟
     *   放进同一个 wrapper 节点。body.parentElement 就是 wrapper。
     *
     * 找 row 策略：
     *   1. 优先：在 wrapper.children 里找 className 含 `_row` 子串的——
     *      DSH CSS module hash 约定（`QWLzlG_row` / `_Xvjua_row` 等），
     *      ContextInjectionRow 不传 rowClassName 时用默认行类，子串匹配仍命中
     *   2. 兜底：wrapper.firstElementChild 不是 body 时就是 row——
     *      DisclosureRow 标准布局 row 在前 body 在后
     */
    function findRowForBody(bodyEl) {
      var wrapper = bodyEl.parentElement;
      if (!wrapper) return null;
      var children = wrapper.children;
      for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (c === bodyEl) continue;
        if (c.className && typeof c.className === "string" &&
            c.className.indexOf("_row") >= 0) {
          return c;
        }
      }
      if (wrapper.firstElementChild && wrapper.firstElementChild !== bodyEl) {
        return wrapper.firstElementChild;
      }
      return null;
    }

    /**
     * 给 body 末尾注入"收起"按钮。幂等——已注入则跳过。
     *   注入结构：<body>...text...<wrap><button>收起 ▴</button></wrap></body>
     *   wrap 强制 display:block 让按钮独占一行（不被 pre-wrap 文本内联吃掉）
     */
    function injectCollapseButton(bodyEl) {
      if (typeof document === "undefined") return;
      if (bodyEl.querySelector("[" + DISCLOSURE_END_COLLAPSE_WRAP_ATTR + "]")) return;

      var wrap = document.createElement("div");
      wrap.setAttribute(DISCLOSURE_END_COLLAPSE_WRAP_ATTR, "");

      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute(DISCLOSURE_END_COLLAPSE_ATTR, "");
      btn.textContent = "收起 ▴";
      btn.title = "收起";
      btn.setAttribute("aria-label", "收起");

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        // row.click() 触发 DSH React 的 onToggle → setExpanded(false) →
        //   body 与本按钮一起被卸载。无需手动 remove。
        var row = findRowForBody(bodyEl);
        if (row && typeof row.click === "function") {
          row.click();
        }
      });

      wrap.appendChild(btn);
      bodyEl.appendChild(wrap);
    }

    /** 巡检所有展开的 DisclosureRow body，注入按钮。 */
    function scanBodies() {
      if (typeof document === "undefined") return;
      var bodies = document.querySelectorAll(DISCLOSURE_BODY_SELECTORS);
      for (var i = 0; i < bodies.length; i++) {
        injectCollapseButton(bodies[i]);
      }
    }

    /** stop 时清理所有已注入的按钮（防御性——正常情况下 button 随 body 卸载）。 */
    function removeAllInjectedButtons() {
      if (typeof document === "undefined") return;
      var wraps = document.querySelectorAll("[" + DISCLOSURE_END_COLLAPSE_WRAP_ATTR + "]");
      for (var i = 0; i < wraps.length; i++) {
        var w = wraps[i];
        if (w.parentNode) w.parentNode.removeChild(w);
      }
    }

    /**
     * v0.9.6：DisclosureRow 末尾收起按钮 controller。start 时挂 MutationObserver
     *   观察 body subtree（DSH React 在 expand/collapse 时挂载/卸载 body）；
     *   80ms throttle 同 v0.7.0 tab-hider / v0.6.2 hover-card-hider 节奏，
     *   避免 DSH 高频重渲时反复探测。
     *   立即跑一次 scanBodies()，确保首次启动时已展开的 block 立刻有按钮
     *   （无需等下一次 mutation）。
     */
    function createDisclosureEndCollapseController() {
      var observer = null;
      var isRunning = false;

      function start() {
        if (isRunning) return;
        if (typeof document === "undefined" || !document.body) return;
        isRunning = true;
        if (typeof MutationObserver === "undefined") {
          scanBodies();
          return;
        }
        observer = new MutationObserver(function () {
          if (observer._pending) return;
          observer._pending = true;
          (typeof window !== "undefined" && window.setTimeout)
            ? window.setTimeout(function () {
                observer._pending = false;
                scanBodies();
              }, 80)
            : scanBodies();
        });
        try {
          observer.observe(document.body, { childList: true, subtree: true });
        } catch (e) { /* 静默 */ }
        scanBodies();
      }

      function stop() {
        isRunning = false;
        if (observer !== null) { observer.disconnect(); observer = null; }
        removeAllInjectedButtons();
      }

      return {
        start: start,
        stop: stop,
        get running() { return isRunning; }
      };
    }
