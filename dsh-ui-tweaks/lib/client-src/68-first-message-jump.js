    // ===== first-message-jump =====
    // ====================================================================
    // v0.8.0「回到最早消息」按钮 controller：
    // 在对话区右下角（输入框上方）挂一个悬浮按钮，点击把当前会话最早一条
    // user 消息（[data-chat-flow-kind="user"] 第一行）滚到滚动区顶部。
    //
    // DOM 契约（DSH 当前版本，均为稳定 attribute，不随 CSS module hash 变化）：
    //   - 滚动容器：[data-conversation-scroll]（ConversationRoot.scrollBody）
    //   - 用户消息行：[data-chat-flow-kind="user"]（ChatNodeSeat 的 kind 标记）
    //   - 输入框 seat：[data-composer-seat]（sticky bottom，随输入高度变化）
    // 按钮样式由 25-tweaks.js 的 buildCSS 输出；本 controller 只负责挂载 /
    // 显隐 / 定位 / 点击滚动，与 tweak 开关同生命周期。
    // ====================================================================

    function createFirstMessageJumpController() {
      var button = null;
      var scrollport = null;
      var boundScrollTarget = null;
      var visible = false;
      var isRunning = false;
      var observer = null;
      var rootObserver = null;
      var resizeObserver = null;
      var resizeObserved = null;  // 当前被 ResizeObserver 观察的输入框 seat 元素
      var jumpLastNative = null;  // 上次见过的原生「回到底部」按钮 rect（原生缺席时复用，避免跳动）
      var jumpLastPadR = null;    // 上次记录的滚动容器 padding-right（右缩变化时清记忆）
      var jumpLastComposerH = null; // 上次记录的 --dsh-composer-height（底部任务条出现/消失时清记忆）

      /** 当前会话滚动容器：取第一个可见（非零尺寸）的 [data-conversation-scroll]。 */
      function jumpFindScrollport() {
        if (typeof document === "undefined") return null;
        var nodes = document.querySelectorAll(JUMP_SCROLL_SEL);
        var fallback = null;
        for (var i = 0; i < nodes.length; i++) {
          if (fallback === null) fallback = nodes[i];
          var r = nodes[i].getBoundingClientRect();
          if (r && r.width > 0 && r.height > 0) return nodes[i];
        }
        return fallback;
      }

      /** 最早一条 user 消息行（DOM 顺序即时间顺序）。 */
      function jumpFindFirstUserRow(port) {
        if (!port) return null;
        return port.querySelector(JUMP_USER_ROW_SEL);
      }

      function jumpIsDrawerOpen() {
        return typeof document !== "undefined" &&
          document.documentElement.hasAttribute(JUMP_DRAWER_ATTR);
      }

      /**
       * 当前打开的右侧抽屉宽度（px）。读 html 上的 --active-drawer-width
       * （task-pool / git-hub 等面板打开时按 FAB 让位协议设置）。无抽屉返回 null。
       */
      function jumpDrawerWidth() {
        if (!jumpIsDrawerOpen()) return null;
        if (typeof document === "undefined" || !window.getComputedStyle) return null;
        var cs = window.getComputedStyle(document.documentElement);
        var raw = cs ? cs.getPropertyValue("--active-drawer-width") : "";
        var n = raw ? parseFloat(raw) : NaN;
        return isFinite(n) ? n : null;
      }

      /**
       * 抽屉是否真的盖住按钮。按钮右缘距视口右侧为 right；抽屉覆盖视口右侧 [0, 抽屉宽]。
       * 仅当 right < 抽屉宽（按钮落在抽屉阴影内）才视为遮挡。conversation-shift 已把
       * 内容让位到抽屉左侧时 right >= 抽屉宽 → 不遮挡，按钮保持可见可点。
       */
      function jumpCoveredByDrawer() {
        var dw = jumpDrawerWidth();
        if (dw === null) return true; // 有抽屉但读不到宽度 → 保守隐藏
        var right = parseFloat(button.style.right);
        if (!isFinite(right)) return true;
        return right < dw - 2;
      }

      /** 滚动容器当前的 padding-right（conversation-shift 的右缩 px；读不到按 0）。 */
      function jumpScrollportPadR() {
        if (!scrollport) return null;
        var cs = (typeof window !== "undefined" && window.getComputedStyle)
          ? window.getComputedStyle(scrollport) : null;
        if (!cs) return null;
        var pr = cs.paddingRight;
        var n = pr ? parseFloat(pr) : NaN;
        return isFinite(n) ? n : 0;
      }

      /** 当前 --dsh-composer-height（输入区高，含底部任务条等 dock；读不到按 152）。 */
      function jumpComposerHeight() {
        if (!scrollport) return 152;
        var cs = (typeof window !== "undefined" && window.getComputedStyle)
          ? window.getComputedStyle(scrollport) : null;
        if (!cs) return 152;
        var raw = cs.getPropertyValue("--dsh-composer-height");
        var n = raw ? parseFloat(raw) : NaN;
        return isFinite(n) && n > 0 ? n : 152;
      }

      /**
       * 需要显示：最早 user 行**不在**滚动区视口顶部附近的可见带内。
       * 三种情况：
       *   - 已滚出视口上方（正常聊天时停在底部，最早消息在上面）→ 显示；
       *   - 顶部在视口顶部附近带内（JUMP_NEAR_TOP_PX，已能看到起点）→ 隐藏；
       *   - 顶部明显低于视口顶部（前面垫了大段上下文/压缩块）→ 显示。
       * 可见带 = [portTop - 8, portTop + JUMP_NEAR_TOP_PX]。
       * 右侧抽屉是否真的盖住按钮由 jumpUpdate 里 jumpCoveredByDrawer 判断
       * （conversation-shift 已让位时按钮在抽屉左边，不需要隐藏）。
       */
      function jumpShouldShow(port, row) {
        if (!port || !row) return false;
        var portRect = port.getBoundingClientRect();
        var rowRect = row.getBoundingClientRect();
        if (!portRect || !rowRect) return false;
        var rowTop = rowRect.top;
        var bandTop = portRect.top - 8;
        var bandBottom = portRect.top + JUMP_NEAR_TOP_PX;
        return rowTop < bandTop || rowTop > bandBottom;
      }

      /** 原生「回到底部」按钮：按 aria-label 匹配（zh/en），找不到返回 null。 */
      function jumpFindNativeBottomButton() {
        if (typeof document === "undefined") return null;
        var el = document.querySelector('[aria-label="回到底部"]');
        if (el) return el;
        return document.querySelector('[aria-label="Back to bottom"]');
      }

      /** 按"原生按钮的右缘 + 顶边"定位本按钮：右缘对齐、底缘悬在其上 JUMP_NATIVE_GAP。 */
      function jumpApplyTo(nativeRight, nativeTop) {
        var right = Math.max(8, window.innerWidth - nativeRight);
        var bottom = window.innerHeight - nativeTop + JUMP_NATIVE_GAP;
        button.style.right = Math.round(right) + "px";
        button.style.bottom = Math.round(bottom) + "px";
      }

      /**
       * 计算"原生按钮应出现的位置"（右缘 x）。从未见过原生按钮时的兜底：
       *   - 首选：直接量内容列的右缘——最早 user 行的父元素就是 .Md3f7G_column
       *     （max-width 内容宽、margin 0 auto 居中），原生槽位的 padding-right
       *     正是把它右缘对齐到内容列右缘。量 DOM 天然跟随 conversation-shift /
       *     内容宽变化，无需读 cw/padR。
       *   - 兜底：读不到行时退回公式（内容列居中 + 扣滚动容器 padding-right）。
       */
      function jumpComputeNativeRight() {
        var row = jumpFindFirstUserRow(scrollport);
        if (row && row.parentElement) {
          var colRect = row.parentElement.getBoundingClientRect();
          if (colRect && colRect.width > 0 && isFinite(colRect.right)) return colRect.right;
        }
        var portRect = scrollport.getBoundingClientRect();
        if (!portRect || portRect.width <= 0 || portRect.height <= 0) return null;
        var contentWidth = 748;
        var padR = 0;
        var cs = (typeof window !== "undefined" && window.getComputedStyle)
          ? window.getComputedStyle(scrollport) : null;
        if (cs) {
          var raw = cs.getPropertyValue("--dsh-chat-content-width");
          var parsed = parseFloat(raw);
          if (isFinite(parsed) && parsed > 0) contentWidth = parsed;
          var pr = cs.paddingRight;
          var p = pr ? parseFloat(pr) : NaN;
          if (isFinite(p) && p > 0) padR = p;
        }
        var effective = Math.min(contentWidth, portRect.width - padR);
        if (effective < 0) effective = 0;
        return portRect.left + (portRect.width - padR + effective) / 2;
      }

      /**
       * 定位策略（核心：任何时刻都只用一个位置源，杜绝"动一下"）：
       *   1) 原生按钮在场 → 直接锚定，并**记住**它的 rect；
       *   2) 原生按钮不在场（停在底部，`!atBottom` 才渲染）→ 复用上次记住的 rect——
       *      与"原生按钮将要出现的位置"完全一致，来回切换不再跳动；
       *   3) 从未见过原生按钮 → 用兜底公式估算"原生按钮应出现的位置"。
       * 原生按钮位置天然跟随「对话区右缩」（conversation-shift）等一切布局偏移，
       * 锚定/记忆路径无需自己算偏移。
       */
      function jumpPositionButton() {
        if (!button || !scrollport) return;
        var native = jumpFindNativeBottomButton();
        if (native) {
          var nr = native.getBoundingClientRect();
          if (nr && nr.width > 0 && nr.height > 0) {
            jumpLastNative = { right: nr.right, top: nr.top };
            jumpApplyTo(nr.right, nr.top);
            return;
          }
        }
        if (jumpLastNative) {
          jumpApplyTo(jumpLastNative.right, jumpLastNative.top);
          return;
        }
        var contentRight = jumpComputeNativeRight();
        if (contentRight === null) return;
        // 从未见过原生按钮：估算其顶边。原生槽位 CSS 是
        //   position:sticky; bottom:calc(var(--dsh-composer-height) + 16px)，按钮 34px
        // → 按钮顶边 = 滚动容器底 - composerHeight - (16 + 34)。
        // --dsh-composer-height 由 DSH 内联设置在滚动容器上（seat.offsetHeight），
        // 与原生槽位用的是同一个值——保证兜底与锚定位置完全重合。
        var portRect = scrollport.getBoundingClientRect();
        var nativeTop = portRect.bottom - jumpComposerHeight() - (16 + 34);
        jumpApplyTo(contentRight, nativeTop);
      }

      /** 幂等切换显隐（只写真正变化的状态）。 */
      function jumpSetVisible(next) {
        if (visible === next) return;
        visible = next;
        if (!button) return;
        if (next) button.setAttribute("data-visible", "");
        else button.removeAttribute("data-visible");
      }

      function jumpUpdate() {
        if (!isRunning) return;
        var nextPort = jumpFindScrollport();
        if (nextPort !== scrollport) {
          jumpBindScroll(nextPort);
          scrollport = nextPort;
          // 注意：不在这里清 jumpLastNative——原生按钮位置由布局决定（内容列 + 输入框高），
          // 会话/视图切换后布局不变，清掉反而会在回切对话时先按兜底公式定位造成跳动。
          // 视口尺寸变化 / 右缩 padding 变化（真正改变布局）才清。
        }
        // 右缩开关/宽度变化（conversation-shift）→ 旧的原生按钮位置失效，等下次锚定重新记忆
        var padRNow = jumpScrollportPadR();
        if (padRNow !== jumpLastPadR) {
          jumpLastPadR = padRNow;
          jumpLastNative = null;
        }
        // 输入区高度变化（底部任务条等 input.dock 出现/消失、多行输入）→ 同样失效
        var composerHNow = jumpComposerHeight();
        if (composerHNow !== jumpLastComposerH) {
          jumpLastComposerH = composerHNow;
          jumpLastNative = null;
        }
        if (!button && typeof document !== "undefined" && document.body) jumpCreateButton();
        var row = jumpFindFirstUserRow(scrollport);
        var show = jumpShouldShow(scrollport, row);
        if (show) jumpPositionButton();
        // 抽屉遮挡检查：conversation-shift 已让位时不遮挡 → 保持可见
        if (show && jumpIsDrawerOpen() && jumpCoveredByDrawer()) show = false;
        jumpSetVisible(show);
        // 输入框高度变化（多行输入/收起）时重新定位——观察 composer seat 元素
        if (scrollport && resizeObserver) {
          var composerEl = scrollport.querySelector(JUMP_COMPOSER_SEL);
          if (composerEl && composerEl !== resizeObserved) {
            if (resizeObserved) {
              try { resizeObserver.unobserve(resizeObserved); } catch (e) { /* 静默 */ }
            }
            resizeObserver.observe(composerEl);
            resizeObserved = composerEl;
          }
        }
      }

      function jumpBindScroll(port) {
        if (boundScrollTarget === port) return;
        if (boundScrollTarget) boundScrollTarget.removeEventListener("scroll", jumpOnScroll, true);
        boundScrollTarget = port || null;
        if (boundScrollTarget) boundScrollTarget.addEventListener("scroll", jumpOnScroll, true);
      }

      function jumpOnScroll() {
        jumpScheduleUpdate();
      }

      /** 视口尺寸变化：布局真变了，旧的原生按钮位置失效，清掉等下次锚定重新记忆。 */
      function jumpOnResize() {
        jumpLastNative = null;
        jumpScheduleUpdate();
      }

      function jumpScheduleUpdate() {
        if (!isRunning) return;
        if (observer && observer._pending) return;
        if (observer) observer._pending = true;
        window.setTimeout(function () {
          if (observer) observer._pending = false;
          jumpUpdate();
        }, 120);
      }

      /** 点击：把最早 user 行滚到滚动区顶部（留 JUMP_TOP_PADDING 呼吸），无则回顶。 */
      function jumpToFirst() {
        var port = jumpFindScrollport();
        if (!port) return;
        var row = jumpFindFirstUserRow(port);
        var target = 0;
        if (row) {
          var portRect = port.getBoundingClientRect();
          var rowRect = row.getBoundingClientRect();
          if (portRect && rowRect) {
            var off = rowRect.top - portRect.top + port.scrollTop - JUMP_TOP_PADDING;
            if (off > 0) target = off;
          }
        }
        port.scrollTop = target;
        jumpScheduleUpdate();
      }

      function jumpCreateButton() {
        if (button || typeof document === "undefined" || !document.body) return;
        button = document.createElement("button");
        button.type = "button";
        button.id = JUMP_BTN_ID;
        button.setAttribute("data-dsh-ui-tweaks-jump", "");
        button.setAttribute("aria-label", "回到最早消息");
        button.setAttribute("title", "回到最早消息");
        button.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 10.5L8 6l4.5 4.5"/></svg>';
        button.addEventListener("click", jumpToFirst);
        document.body.appendChild(button);
      }

      function start() {
        if (isRunning) return;
        isRunning = true;
        if (typeof window !== "undefined") {
          window.addEventListener("resize", jumpOnResize);
          if (typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(function () {
              // 输入区高度变化（底部任务条等 dock 出现/消失）→ 旧原生按钮位置失效
              jumpLastNative = null;
              jumpScheduleUpdate();
            });
          }
        }
        if (typeof MutationObserver === "undefined" || typeof document === "undefined") {
          jumpUpdate();
          return;
        }
        // 宽监听：body 子树变化（会话切换 / 消息追加 / 布局重建）触发重算
        observer = new MutationObserver(function () { jumpScheduleUpdate(); });
        try {
          observer.observe(document.body, { childList: true, subtree: true });
        } catch (e) { /* 静默：body 未就绪等极端情况 */ }
        // 抽屉 attr 在 documentElement 上，body 监听看不到，单独窄监听
        rootObserver = new MutationObserver(function () { jumpScheduleUpdate(); });
        try {
          rootObserver.observe(document.documentElement, { attributes: true, attributeFilter: [JUMP_DRAWER_ATTR] });
        } catch (e) { /* 静默 */ }
        jumpUpdate();
      }

      function stop() {
        if (!isRunning) return;
        isRunning = false;
        if (observer) { observer.disconnect(); observer = null; }
        if (rootObserver) { rootObserver.disconnect(); rootObserver = null; }
        if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
        resizeObserved = null;
        if (boundScrollTarget) {
          boundScrollTarget.removeEventListener("scroll", jumpOnScroll, true);
          boundScrollTarget = null;
        }
        if (typeof window !== "undefined") window.removeEventListener("resize", jumpOnResize);
        if (button && button.parentNode) button.parentNode.removeChild(button);
        button = null;
        scrollport = null;
        visible = false;
        jumpLastNative = null;
        jumpLastPadR = null;
        jumpLastComposerH = null;
      }

      /** 诊断快照（window.__dshUiTweaks.firstMessageJump() 用）。 */
      function getState() {
        var port = jumpFindScrollport();
        var row = jumpFindFirstUserRow(port);
        return {
          running: isRunning,
          scrollport: port ? { tag: port.tagName, cls: (typeof port.className === "string") ? port.className : "" } : null,
          firstUserRow: row ? {
            kind: row.getAttribute("data-chat-flow-kind"),
            topOffset: row.getBoundingClientRect().top - (port ? port.getBoundingClientRect().top : 0)
          } : null,
          visible: visible,
          drawerOpen: jumpIsDrawerOpen()
        };
      }

      return {
        start: start,
        stop: stop,
        getState: getState,
        get running() { return isRunning; }
      };
    }

