// ===== first-message-jump =====
    // ====================================================================
    // v0.9.1：上数第二条卡住 bug 修复 + Shift+点击一键极限（双按钮对称）：
    //   - 用 topVisible（视口内最顶部可见 user 行）替代 lastVisible 作
    //     为锚点；v0.9.0 的 lastVisible 锚点在短消息 + 滚到 rows[1] 时
    //     会因为下方 rows[2..N] 仍可见 → lastVisible 始终是 rows[N]
    //     → target 始终是 rows[N-1] → 死循环（按钮永不隐藏、永远到
    //     不了 rows[0]）。topVisible = rows[1] 时 target = rows[0]，
    //     点击后 topVisible = rows[0] → target = null → 按钮正确隐藏。
    //   - 单击我的按钮 = 上一条 user 行（topVisible.previous）
    //   - **Shift+单击**我的按钮 = 一键到 rows[0]（恢复 v0.8.0 的
    //     "一键回到最早"语义，但用 Shift 修饰，与 step-by-step 共存）
    //   - 单击原生「回到底部」按钮 = 下一条 user 行（topVisible.next）——
    //     行为从 v0.9.0 / v0.8.0 的"一键到底"改为"下一条"
    //   - **Shift+单击**原生「回到底部」按钮 = 一键到 rows[N]（原本的
    //     "一键到底"语义现在需要 Shift 修饰；DSH 原生 click handler
    //     不被 preventDefault，让它正常跑就行）
    //
    // v0.9.0：「上一条我发的消息」按钮 controller（单向上导航）——
    // 对话区右下角（输入框上方）挂一个悬浮按钮，**点击 = 跳到当前视口内
    // 最底部可见的 user 消息的上一条**。连续点击可一路向上导航，最终到
    // 达最早一条 user 消息（即 v0.8.0 的"回到最早"终点）。
    // 实现用 lastVisible（视口内最底部可见 user 行）作为锚点——在短
    // 消息场景下有"上数第二条卡住"bug，v0.9.1 改用 topVisible 修复。
    //
    // v0.8.0：原"回到最早消息"按钮——点击一次直达最早一条 user 行。
    //
    // 按钮外观：单 SVG ▲（朝上）+ aria-label "上一条我发的消息" +
    // title "上一条我发的消息（Shift+点击 = 回到最早）"。DOM / 位置 /
    // 尺寸 / 样式 / ID / CSS 选择器 [data-dsh-ui-tweaks-jump] 全部
    // 不变；localStorage key `firstMessageJump` 不动，老用户开关状态
    // 保留。
    //
    // DOM 契约（DSH 当前版本，均为稳定 attribute，不随 CSS module hash 变化）：
    //   - 滚动容器：[data-conversation-scroll]（ConversationRoot.scrollBody）
    //   - 用户消息行：[data-chat-flow-kind="user"]（ChatNodeSeat 的 kind 标记）
    //   - 输入框 seat：[data-composer-seat]（sticky bottom，随输入高度变化）
    //   - 原生「回到底部」按钮：aria-label "回到底部" / "Back to bottom"
    // 按钮样式由 25-tweaks.js 的 buildCSS 输出；本 controller 只负责挂载 /
    // 显隐 / 定位 / 点击滚动，与 tweak 开关同生命周期。原生「回到底部」
    // 按钮的钩子（capture-phase document click listener）也在本文件——
    // 负责拦截 click 事件并按 Shift 状态分发到"下一条"或"放行原生"。
    //
    // 文件拆分（v0.9.x → v0.9.2）：纯 finder / scanner 函数（不依赖
    // 闭包状态，全部以 port 作参数）抽到 68a-first-message-jump-utils.js
    // ——主文件从 645 行 / 31.2 KB 降到 ~430 行 / ~21 KB，回到
    // maintainability.md 30 KB 阈值下。函数名共享工厂函数 scope（client-src/
    // 按文件名升序整段拼接），不需要 require/import。共享常量 (JUMP_*_SEL
    // / JUMP_DRAWER_ATTR) 仍由 20-constants.js 单点定义。
    // ====================================================================

    function createFirstMessageJumpController() {
      // 纯 finder/scanner 函数（jumpFindScrollport / jumpAllUserRows /
      // jumpFindFirstUserRow / jumpFindLastUserRow / jumpIsRowInCompaction /
      // jumpFindFirstRealUserRow / jumpFindLastVisibleUserRow /
      // jumpFindTopVisibleUserRow / jumpFindPrevUserRow /
      // jumpFindNextUserRow / jumpIsDrawerOpen / jumpDrawerWidth）由
      // 68a-first-message-jump-utils.js 提供——本文件仅保留依赖闭包状态
      // 的控制器逻辑（定位 / 显隐 / 点击 / 生命周期 / 诊断）。

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
      var nativeListenerInstalled = false;  // v0.9.1：原生按钮 capture-phase document click listener 是否已挂（防重复）

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
        // v0.9.1：钩原生「回到底部」按钮（幂等）。document 上挂一次 capture-phase
        // click listener；命中原生按钮时按 Shift 状态分发到"下一条"或"放行原生"。
        jumpHookNativeButton();
        // v0.9.2：可见性放宽——只要 rows.length >= 2 就显示（短会话也可见）。
        // v0.9.1 用 `target !== null` 判断：topVisible === firstRow 时按钮
        // 隐藏——但这导致短会话（2 条 user 行）底部 TodoList 卡片出现时按钮
        // 直接不出现（用户反馈"老问题"）；topVisible === firstRow 时其实
        // jumpToPrev 是 no-op（已在最顶），但按钮仍可见作为"导航面板存在"的
        // 视觉提示；Shift+点击仍能到最顶。锚点 topVisible（v0.9.1）替代
        // lastVisible（v0.9.0）——修复"上数第二条卡住"bug 这点不变。
        var allRows = jumpAllUserRows(scrollport);
        var target = jumpFindPrevUserRow(scrollport);
        var show = (allRows.length >= 2);
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

      /**
       * 点击：跳到"上一条"user 行（jumpFindPrevUserRow 计算）。连续点击
       * 可一路向上，最终到达 firstRow——此时按钮自动隐藏（target === null）。
       * v0.9.1：锚点从 lastVisible 改为 topVisible，修复"上数第二条卡住"
       * bug（详见 jumpFindPrevUserRow 注释）。
       */
      function jumpToPrev() {
        var port = jumpFindScrollport();
        if (!port) return;
        var row = jumpFindPrevUserRow(port);
        if (!row) return; // 已无路可上（极少见，jumpUpdate 也会隐藏按钮）
        var portRect = port.getBoundingClientRect();
        var rowRect = row.getBoundingClientRect();
        var target = 0;
        if (portRect && rowRect) {
          var off = rowRect.top - portRect.top + port.scrollTop - JUMP_TOP_PADDING;
          if (off > 0) target = off;
        }
        port.scrollTop = target;
        jumpScheduleUpdate();
      }

      /**
       * v0.9.1：Shift+单击我的按钮 → 一键到 rows[0]（最早一条 user 行）。
       * 与 v0.8.0 的「jumpToFirst」逻辑一致——把 firstRow 滚到视口顶部
       * + JUMP_TOP_PADDING。无 firstRow（空对话）则回顶（scrollTop=0）。
       * v0.9.2：firstRow 取的是「跳过 compaction 块后的第一条」——
       * jumpFindFirstRealUserRow()。这样 Shift+点击直达"当前会话的
       * 第一条"，而不是 compact 摘要里的旧 user 行（v0.9.1 落到了
       * compaction 块下方的某条 user 行——bug）。
       */
      function jumpToFirst() {
        var port = jumpFindScrollport();
        if (!port) return;
        var row = jumpFindFirstRealUserRow(port);
        if (!row) return;
        var portRect = port.getBoundingClientRect();
        var rowRect = row.getBoundingClientRect();
        var target = 0;
        if (portRect && rowRect) {
          var off = rowRect.top - portRect.top + port.scrollTop - JUMP_TOP_PADDING;
          if (off > 0) target = off;
        }
        port.scrollTop = target;
        jumpScheduleUpdate();
      }

      /**
       * v0.9.2：找"当前会话的第一条 user 行"——跳过 compaction / context
       * 容器里的 user 行。详见 jumpIsRowInCompaction。
       * 兜底：所有 user 行都在 compaction 里（极端情况）→ 返回 DOM 顺序的
       * 第一条（保留 v0.9.1 行为，宁可给一个错的目标也不要 no-op）。
       */
      function jumpFindFirstRealUserRow(port) {
        var rows = jumpAllUserRows(port);
        for (var i = 0; i < rows.length; i++) {
          if (!jumpIsRowInCompaction(rows[i])) {
            return rows[i];
          }
        }
        return rows.length > 0 ? rows[0] : null;
      }

      /**
       * v0.9.1：单击原生「回到底部」按钮（无 Shift）→ "下一条"user 行
       * （jumpFindNextUserRow 计算）。几何与 jumpToPrev 完全对称——
       * 把 target 滚到视口顶部 + JUMP_TOP_PADDING。锚点都用 topVisible：
       *   - 用户在中间（视口内含多条 user 行）→ 滚到 topVisible.next
       *   - 用户在顶部（只 rows[0] 可见）→ 滚到 rows[1]
       *   - 用户在底部（只 rows[N] 可见）→ topVisible === lastRow → target = null → no-op
       *   - 视口内无 user 行（页面刚打开 / 在对话外空白区）→ 滚到 rows[0] 作起点
       */
      function jumpToNext() {
        var port = jumpFindScrollport();
        if (!port) return;
        var row = jumpFindNextUserRow(port);
        if (!row) return;
        var portRect = port.getBoundingClientRect();
        var rowRect = row.getBoundingClientRect();
        var target = 0;
        if (portRect && rowRect) {
          var off = rowRect.top - portRect.top + port.scrollTop - JUMP_TOP_PADDING;
          if (off > 0) target = off;
        }
        port.scrollTop = target;
        jumpScheduleUpdate();
      }

      /**
       * v0.9.1：我的按钮的 click 处理器。
       *   - e.shiftKey === true  → jumpToFirst()（一键到 rows[0]）
       *   - e.shiftKey === false → jumpToPrev()（step-by-step 上一条）
       * 浏览器在 click 事件上对 shift 键的判定由 MouseEvent.shiftKey 给
       * 出——不需要自己跟踪 keydown/keyup。Edge case：合成事件（脚本
       * dispatchEvent）可能 shiftKey=false 但本意是"Shift+单击"——这
       * 是正常 DSH 用户流程不会触发的场景，忽略即可。
       */
      function jumpOnButtonClick(e) {
        if (e && e.shiftKey) {
          jumpToFirst();
        } else {
          jumpToPrev();
        }
      }

      /**
       * v0.9.1：原生「回到底部」按钮的 capture-phase click 钩子。
       * 监听器挂在 document 上（capture phase），先于任何 bubble phase
       * 监听器（包括 DSH 在原生 button 上的 onClick 与可能存在的祖先
       * delegation）触发——这样我们有"否决"权：
       *   - e.shiftKey === true → 不 preventDefault，让 DSH 原生 handler
       *     跑（它的语义本来就是"一键到底"）→ 行为退化为 v0.8.0
       *   - e.shiftKey === false → preventDefault + stopImmediatePropagation
       *     阻止原生 handler 跑，改由 jumpToNext() 做"下一条"导航
       *
       * 命中判定靠手动 walk 父链找 aria-label——target 可能是原生 button
       * 内部的子元素（SVG 等），不依赖 closest()（保持 ES5-only 风格）。
       * document listener 只挂一次（nativeListenerInstalled flag），原生
       * button 被 DSH 重渲时不需要重新挂——listener 一直在 document 上，
       * 新 button 也会被覆盖。
       */
      function jumpOnNativeClick(e) {
        if (!e || !e.target) return;
        var target = e.target;
        var foundNative = false;
        // Walk up 父链找 aria-label 匹配的 button（含其子元素被点的情况）
        while (target && target.nodeType === 1) {
          var label = (typeof target.getAttribute === "function")
            ? target.getAttribute("aria-label")
            : null;
          if (label === "回到底部" || label === "Back to bottom") {
            foundNative = true;
            break;
          }
          target = target.parentElement;
        }
        if (!foundNative) return;
        if (e.shiftKey) {
          // Shift+点击原生按钮 = 一键到底（DSH 原生 handler 跑就行）
          return;
        }
        // 单击原生按钮 = 拦截，由我们做"下一条"
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        jumpToNext();
      }

      /**
       * v0.9.1：在 document 上挂一次 capture-phase click listener。
       * 幂等：nativeListenerInstalled flag 防止重复挂。
       * 调用时机：jumpUpdate() 内每次都尝试挂——若已挂则立刻返回；这样
       * 既能早期挂上（start 后首次 jumpUpdate），又能容错（理论上
       * stop() 卸载后 start() 再挂）。
       */
      function jumpHookNativeButton() {
        if (typeof document === "undefined") return;
        if (nativeListenerInstalled) return;
        try {
          document.addEventListener("click", jumpOnNativeClick, true);
          nativeListenerInstalled = true;
        } catch (e) { /* 静默：极端环境 document 不可写 */ }
      }

      function jumpCreateButton() {
        if (button || typeof document === "undefined" || !document.body) return;
        button = document.createElement("button");
        button.type = "button";
        button.id = JUMP_BTN_ID;
        button.setAttribute("data-dsh-ui-tweaks-jump", "");
        button.setAttribute("aria-label", JUMP_LABEL);
        button.setAttribute("title", JUMP_BUTTON_TITLE);  // v0.9.1：title 加 Shift 修饰提示
        button.innerHTML = JUMP_SVG_UP;
        button.addEventListener("click", jumpOnButtonClick);  // v0.9.1：分发到 jumpOnButtonClick
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
        // v0.9.1：拆掉原生按钮的 capture-phase click listener（幂等：未挂也安全）
        if (typeof document !== "undefined" && nativeListenerInstalled) {
          try { document.removeEventListener("click", jumpOnNativeClick, true); } catch (e) { /* 静默 */ }
          nativeListenerInstalled = false;
        }
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
        var rows = jumpAllUserRows(port);
        var firstRow = rows.length > 0 ? rows[0] : null;
        var lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
        var topVisible = jumpFindTopVisibleUserRow(port);  // v0.9.1：导航锚点
        var lastVisible = jumpFindLastVisibleUserRow(port);  // 诊断：v0.9.0 旧锚点（保留对照）
        var prevTarget = jumpFindPrevUserRow(port);
        var nextTarget = jumpFindNextUserRow(port);  // v0.9.1：原生按钮单击目标
        function rowInfo(r) {
          if (!r || !port) return null;
          var rt = r.getBoundingClientRect();
          return {
            kind: r.getAttribute("data-chat-flow-kind"),
            topOffset: rt.top - port.getBoundingClientRect().top
          };
        }
        return {
          running: isRunning,
          scrollport: port ? { tag: port.tagName, cls: (typeof port.className === "string") ? port.className : "" } : null,
          totalUserRows: rows.length,
          firstUserRow: rowInfo(firstRow),
          lastUserRow: rowInfo(lastRow),
          topVisibleUserRow: rowInfo(topVisible),    // v0.9.1：当前锚点
          lastVisibleUserRow: rowInfo(lastVisible),  // 诊断：v0.9.0 旧锚点（保留对照）
          targetRow: rowInfo(prevTarget),            // 我的按钮单击 → target
          nextUserRow: rowInfo(nextTarget),          // v0.9.1：原生按钮单击 → target
          scrollTop: port ? port.scrollTop : 0,
          visible: visible,
          drawerOpen: jumpIsDrawerOpen(),
          nativeHooked: nativeListenerInstalled      // v0.9.1：原生按钮 capture-phase listener 是否已挂
        };
      }

      return {
        start: start,
        stop: stop,
        getState: getState,
        get running() { return isRunning; }
      };
    }