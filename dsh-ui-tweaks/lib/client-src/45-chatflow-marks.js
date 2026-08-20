    // ===== chatflow-marks =====
    // ====================================================================
    // v0.5.3 + v0.5.5：动态探测 chatflow 容器 + 输入框，打标记给 CSS 命中
    // --------------------------------------------------------------------
    // 背景：v0.5.2 用 `> *` 选择器假设 centerCol 直接子元素是 chatflow 容器
    //   ——实测 DSH centerCol 实际 DOM 结构可能更深（chatflow 可能在子级的子级，
    //   或用 portal 渲染），`> *` 命中 0 个元素 → 对话"根本不移动"。
    // v0.5.3 解法：JS 探测实际 DOM，找到真正的 chatflow 容器和输入框，
    //   给它们打 data 属性标记；CSS 只命中被标记的元素。探测失败时回退
    //   给 centerCol 列容器打标记（v0.5.1 行为兜底）。
    // ====================================================================

    /**
     * 在 centerCol 列容器内探测 chatflow 容器和输入框。
     * 探测策略：
     *   chatflow：含 [data-chat-flow-kind] 节点的 overflow:auto/scroll 容器
     *     （典型 DSH chatflow 滚动容器；overscroll-behavior 也可能命中但少见）
     *   inputArea：contenteditable=true / textarea / role=textbox 的最近祖先
     * 返回 { chatflow, input, found }；任一找到即为 found=true。
     */
    function findChatflowTargets(centerColEl) {
      if (!centerColEl || typeof document === "undefined") {
        return { chatflow: null, input: null, found: false };
      }

      // 策略 1: chatflow 容器（overflow 容器 + 含 [data-chat-flow-kind]）
      var chatflow = null;
      var all = centerColEl.querySelectorAll("*");
      for (var i = 0; i < all.length; i++) {
        var n = all[i];
        var cs = window.getComputedStyle ? window.getComputedStyle(n) : null;
        if (!cs) continue;
        var ovY = cs.overflowY;
        var ov = cs.overflow;
        if ((ovY === "auto" || ovY === "scroll" || ov === "auto" || ov === "scroll") &&
            n.querySelector("[data-chat-flow-kind]")) {
          chatflow = n;
          break;
        }
      }

      // 策略 2: inputArea
      var input = null;
      var inputNode = centerColEl.querySelector(
        '[contenteditable="true"], textarea, [role="textbox"]'
      );
      if (inputNode) {
        input = inputNode;
        while (input && input.parentElement && input.parentElement !== centerColEl) {
          input = input.parentElement;
        }
        if (!input || input.parentElement !== centerColEl) input = null;
      }

      return {
        chatflow: chatflow,
        input: input,
        found: !!(chatflow || input)
      };
    }

    /**
     * 探测 + 标记：清理旧标记，按探测结果给元素打 data-dsh-ui-tweaks-shift-target。
     *   - 探测成功 → chatflow 元素打 "chatflow" / inputArea 打 "input"
     *   - 探测失败 → centerCol 列容器打 "column"（v0.5.1 行为兜底）
     *
     * v0.5.5 幂等性：检查现有标记是否和探测结果一致，一致就跳过重打。
     *   避免在 self-shim observer（高频触发）回调里反复清理 + 重打标记
     *   ——v0.5.4 已修了"来回弹"循环，这里不能倒退回去。
     * 返回探测结果。MutationObserver 在 DSH React 重渲时再次调用。
     */
    function applyChatflowShiftMarks() {
      if (typeof document === "undefined") return null;
      // 找 centerCol 列容器（self-shim 已种 data-pane，或用类名兜底）
      var col = document.querySelector(
        "[" + SHIM_PANE_ATTR + '="' + SHIM_PANE_VALUE + '"]'
      ) || document.querySelector('[class*="centerCol"]');
      if (!col) return null;

      // 先探测（不动 DOM，只算结果）
      var found = findChatflowTargets(col);

      // v0.5.5 幂等性检查：现有标记和探测结果一致就不重打
      var existingMarks = col.querySelectorAll("[" + SHIFT_TARGET_ATTR + "]");
      var existingColMark = col.getAttribute(SHIFT_TARGET_ATTR);
      var needUpdate = false;

      if (found.found) {
        // 期望：chatflow / input 打标记，col 本身不打
        if (existingColMark) needUpdate = true;
        if (found.chatflow && (
            !found.chatflow.hasAttribute(SHIFT_TARGET_ATTR) ||
            found.chatflow.getAttribute(SHIFT_TARGET_ATTR) !== SHIFT_TARGET_CHATFLOW
          )) needUpdate = true;
        if (found.input && (
            !found.input.hasAttribute(SHIFT_TARGET_ATTR) ||
            found.input.getAttribute(SHIFT_TARGET_ATTR) !== SHIFT_TARGET_INPUT
          )) needUpdate = true;
        // 旧标记不在期望位置（被 DSH React unmount 的元素）也算需要更新
        for (var i = 0; i < existingMarks.length; i++) {
          var m = existingMarks[i];
          if (m === col) continue; // col 自身的标记由上面的 existingColMark 判断
          if (found.chatflow && m === found.chatflow) continue;
          if (found.input && m === found.input) continue;
          // m 是孤儿标记（指向的元素已经被 DSH 卸载）
          needUpdate = true;
          break;
        }
      } else {
        // 期望：col 自身打 "column" 标记
        if (!existingColMark || existingColMark !== SHIFT_TARGET_COLUMN) needUpdate = true;
        for (var j = 0; j < existingMarks.length; j++) {
          if (existingMarks[j] !== col) { needUpdate = true; break; }
        }
      }

      if (!needUpdate) {
        // 已是最优标记——不重打，避免破坏 v0.5.4 修过的"来回弹"
        return found;
      }

      // 需要更新：清理旧标记
      for (var k = 0; k < existingMarks.length; k++) {
        existingMarks[k].removeAttribute(SHIFT_TARGET_ATTR);
      }
      if (existingColMark) col.removeAttribute(SHIFT_TARGET_ATTR);

      // 打新标记
      if (found.found) {
        if (found.chatflow) {
          found.chatflow.setAttribute(SHIFT_TARGET_ATTR, SHIFT_TARGET_CHATFLOW);
        }
        if (found.input) {
          found.input.setAttribute(SHIFT_TARGET_ATTR, SHIFT_TARGET_INPUT);
        }
      } else {
        // 兜底：标记列容器
        col.setAttribute(SHIFT_TARGET_ATTR, SHIFT_TARGET_COLUMN);
      }

      if (typeof console !== "undefined" && console.debug) {
        console.debug("[dsh-ui-tweaks] chatflow shift marks:", {
          found: found.found,
          updated: true,
          chatflow: found.chatflow
            ? found.chatflow.tagName + "." +
              (typeof found.chatflow.className === "string"
                ? found.chatflow.className
                : "(svg/other)")
            : null,
          input: found.input
            ? found.input.tagName + "." +
              (typeof found.input.className === "string"
                ? found.input.className
                : "(svg/other)")
            : null,
          fallbackColumn: !found.found
        });
      }

      return found;
    }

    /**
     * v0.5.3 + v0.5.4：chatflow 标记的 MutationObserver。
     * **只观察 centerCol 的直接子元素变化**（不观察 subtree），且**只在已标记的
     * chatflow / input 元素被 unmount/remount 时才重新探测**。
     *
     * 之前的实现：观察 body + subtree=true → DSH React 在 chatflow 内部每次
     *   重渲（消息增删、状态更新、thinking 状态切换等）都会触发 → 清理旧标记
     *   → 重新打标记 → 配合 transition: padding-right .22s ease 产生"来回弹"
     *   视觉循环（用户反馈"一致向中间拉过去，然后又会弹回去"）。
     *
     * 现在的实现：观察范围收窄到 centerCol 直接子元素；只在"被替换的节点
     *   是已标记的 chatflow / input 元素"时才重新探测。DSH chatflow 内部
     *   的 React 重渲不会触发——标记元素没被换掉，不需要重新打。
     *
     * 注意：v0.5.5 把 self-shim observer 也加进 applyChatflowShiftMarks 触发了，
     *   所以这个 observer 只针对"centerCol 直接子元素被 unmount/remount"
     *   这种局部事件——避免和 self-shim observer 全局观察重复触发。
     */
    var chatflowMarksObserver = null;
    function startChatflowMarksObserver() {
      if (chatflowMarksObserver !== null) return chatflowMarksObserver; // 单例
      if (typeof MutationObserver === "undefined" || typeof document === "undefined") return null;
      // 找当前 centerCol 列容器（self-shim 已种 data-pane 或类名兜底）
      var col = document.querySelector(
        "[" + SHIM_PANE_ATTR + '="' + SHIM_PANE_VALUE + '"]'
      ) || document.querySelector('[class*="centerCol"]');
      if (!col) return null;

      chatflowMarksObserver = new MutationObserver(function (mutations) {
        // 只在 addedNodes / removedNodes 里出现带 SHIFT_TARGET_ATTR 标记的元素时才重跑
        // ——说明 chatflow 容器或 inputArea 被 unmount/remount
        var needsReshim = false;
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          if (m.type !== "childList") continue;
          // 检查 addedNodes
          for (var k = 0; k < m.addedNodes.length; k++) {
            var n = m.addedNodes[k];
            if (n.nodeType !== 1) continue;
            // 新加的节点本身是标记元素 OR 包含标记元素
            if (n.hasAttribute && n.hasAttribute(SHIFT_TARGET_ATTR)) {
              needsReshim = true;
              break;
            }
            if (n.querySelector && n.querySelector("[" + SHIFT_TARGET_ATTR + "]")) {
              needsReshim = true;
              break;
            }
          }
          if (needsReshim) break;
          // 检查 removedNodes
          for (var k2 = 0; k2 < m.removedNodes.length; k2++) {
            var rn = m.removedNodes[k2];
            if (rn.nodeType === 1 && rn.hasAttribute && rn.hasAttribute(SHIFT_TARGET_ATTR)) {
              needsReshim = true;
              break;
            }
          }
          if (needsReshim) break;
        }
        if (!needsReshim) return;
        // throttle：避免短时间内反复探测
        if (chatflowMarksObserver._pending) return;
        chatflowMarksObserver._pending = true;
        (typeof window !== "undefined" && window.setTimeout)
          ? window.setTimeout(function () {
              chatflowMarksObserver._pending = false;
              applyChatflowShiftMarks();
            }, 80)
          : applyChatflowShiftMarks();
      });
      try {
        // 只观察 centerCol 的直接子元素变化（不观察 subtree）——
        // DSH React 在 chatflow 内部重渲不会触发，只有 chatflow / inputArea
        // 本身被替换时才会触发
        chatflowMarksObserver.observe(col, { childList: true });
      } catch (e) {
        // 静默
      }
      return chatflowMarksObserver;
    }

