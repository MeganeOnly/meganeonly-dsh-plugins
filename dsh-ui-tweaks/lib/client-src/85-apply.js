    // ===== apply =====
    // apply（loader 调一次，DSH 启动时执行）

    function apply(ctx) {
      // 1) self-shim（先于 CSS 注入，让 [data-pane="conversation"] 选择器在第一次 injectCSS 时就命中）
      applyShellShim();
      // v0.5.3：探测 chatflow 容器 + 输入框并打标记（在 CSS 注入之前——
      //   CSS 选择器是 [data-dsh-ui-tweaks-shift-target]，必须先有标记才能命中）
      applyChatflowShiftMarks();
      startShellShimObserver();
      // v0.5.4：MutationObserver 在 DSH React 重渲时同时重新打 chatflow 标记
      //   （之前的 startShellShimObserver 只负责 self-shim——现在扩展，但实际交给
      //    专门的 startChatflowMarksObserver；v0.5.5 在 startShellShimObserver 回调里
      //    也补了一次 applyChatflowShiftMarks 作为兜底——双保险）
      startChatflowMarksObserver();

      // 2) 初始 CSS（即便用户没打开设置页也立即跑；后续 UI 变化由 UiTweaksSection useEffect 触发）
      var initialState = loadState();
      injectCSS(initialState);
      injectSectionCSS();

      // 3) 诊断 API（必须早于 settings UI 注册——UI 里的"诊断"按钮会用到）
      if (typeof window !== "undefined") {
        window[DEBUG_API_KEY] = createDebugAPI();
      }

      // 4) settings.panel 挂载点（order:5）
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "ui-tweaks",
          order: 5,
          label: function () { return "界面微调"; }
        }, function () {
          return jsxRuntime.jsx(UiTweaksSection, {});
        });
      });

      // 5) 调试模式：按 initialState 即时生效
      var px = Number(initialState.conversationShiftPx);
      if (!isFinite(px) || px < 0) px = 380;
      if (px > 800) px = 800; // safety cap（与 25-tweaks.js / 35-styles.js 对齐）
      applyDebugMode(!!initialState.conversationShiftDebug, px);

      // 6) 简洁模式状态行 controller
      var simpleController = createSimpleModeStatusController();
      if (initialState.simpleModeEnabled) simpleController.start();

      // 6b) v0.7.0 + v0.7.2：tab 隐藏 controllers（用通用 createTabHider 工厂）
      //     hide-trajectory-tab 标记 "轨迹" 按钮 + 兜底点击"对话"切回
      //     hide-chat-tab       标记 "对话" 按钮 + 兜底确保在"对话"视图
      //     两个 safe tab 都是 "对话"（DSH 默认 view）——避免两个 tab 都隐藏
      //     后用户卡在轨迹视图出不来。
      var trajectoryHider = createTabHider({
        targetLabels: TRAJECTORY_TAB_LABELS,
        hiddenValue: "trajectory",
        safeLabels: CHAT_TAB_LABELS
      });
      if (initialState.hideTrajectoryTab) trajectoryHider.start();
      var chatHider = createTabHider({
        targetLabels: CHAT_TAB_LABELS,
        hiddenValue: "chat",
        safeLabels: CHAT_TAB_LABELS
      });
      if (initialState.hideChatTab) chatHider.start();

      // 6c) 侧栏 HoverCard 隐藏 controller（v0.6.2）
      var hoverCardHider = createSidebarHoverCardHider();
      if (initialState.hideSidebarTooltip) hoverCardHider.start();

      // 6d) first-message-jump 按钮 controller（v0.8.0）
      var firstMessageJump = createFirstMessageJumpController();
      if (initialState.firstMessageJump) firstMessageJump.start();

      // 6e) 把按钮诊断挂到 window.__dshUiTweaks.firstMessageJump()
      if (typeof window !== "undefined" && window[DEBUG_API_KEY]) {
        window[DEBUG_API_KEY].firstMessageJump = function () {
          return firstMessageJump.getState();
        };
      }

      // 6f) disclosure-end-collapse controller（v0.9.6）——覆盖三类 DisclosureRow
      //     展开块：ReasoningRow (Think) / GenericCommandCard（工具调用输出）/
      //     ContextInjectionRow（上下文注入）。详见 67-...js 头部注释。
      var disclosureEndCollapse = createDisclosureEndCollapseController();
      if (initialState.disclosureEndCollapse) disclosureEndCollapse.start();

      // 6g) 诊断挂到 window.__dshUiTweaks.disclosureEndCollapse() 看 running 状态
      if (typeof window !== "undefined" && window[DEBUG_API_KEY]) {
        window[DEBUG_API_KEY].disclosureEndCollapse = function () {
          return { running: disclosureEndCollapse.running };
        };
      }

      // 6h) v0.10.0：统计行位置 controller（stats-line-position tweak）
      //     bottom = DSH 默认（controller 停机，无 CSS）；
      //     hidden = 纯 CSS 隐藏底部 dock 出口（controller 仍停机）；
      //     top    = 纯 CSS 隐藏底部 + controller 在顶部标题簇维护镜像。
      //     sync() 内部做归一化，脏值 / 老布尔值都退回 bottom。
      var statsLinePosition = createStatsLinePositionController();
      statsLinePosition.sync(initialState.statsLinePosition);

      // 6i) v0.10.0：诊断挂到 window.__dshUiTweaks.statsLinePosition()——
      //     一次看清位置、镜像是否已建、两个锚点是否命中（DSH 升级后
      //     若 slot key 改名，这里会直接显示 source/cluster 为 false）
      if (typeof window !== "undefined" && window[DEBUG_API_KEY]) {
        window[DEBUG_API_KEY].statsLinePosition = function () {
          return {
            position: statsNormalizePosition(loadState().statsLinePosition),
            running: statsLinePosition.running,
            sourceFound: statsFindSource() !== null,
            titleClusterFound: statsFindTitleCluster() !== null,
            mirrorMounted: typeof document !== "undefined" &&
              document.querySelector("[" + STATS_MIRROR_ATTR + "]") !== null
          };
        };
      }

      // 7) UI 状态变化 → 启停各 controller
      function onStateChange(e) {
        var detail = (e && e.detail) || null;
        if (!detail || typeof detail !== "object") return;
        var newPx = Number(detail.conversationShiftPx);
        if (!isFinite(newPx) || newPx < 0) newPx = 380;
        if (newPx > 800) newPx = 800; // safety cap（与 25-tweaks.js / 35-styles.js 对齐）
        applyDebugMode(!!detail.conversationShiftDebug, newPx);
        if (detail.simpleModeEnabled) {
          if (!simpleController.running) {
            simpleController.start();
          }
        } else {
          if (simpleController.running) {
            simpleController.stop();
          }
        }
        if (detail.hideTrajectoryTab) {
          if (!trajectoryHider.running) trajectoryHider.start();
        } else {
          if (trajectoryHider.running) trajectoryHider.stop();
        }
        if (detail.hideChatTab) {
          if (!chatHider.running) chatHider.start();
        } else {
          if (chatHider.running) chatHider.stop();
        }
        // v0.6.2：HoverCard hider 跟随 hideSidebarTooltip 开关
        if (detail.hideSidebarTooltip) {
          if (!hoverCardHider.running) hoverCardHider.start();
        } else {
          if (hoverCardHider.running) hoverCardHider.stop();
        }
        // v0.8.0：first-message-jump 按钮跟随开关
        if (detail.firstMessageJump) {
          if (!firstMessageJump.running) firstMessageJump.start();
        } else {
          if (firstMessageJump.running) firstMessageJump.stop();
        }
        // v0.9.6：disclosure-end-collapse controller 跟随开关
        if (detail.disclosureEndCollapse) {
          if (!disclosureEndCollapse.running) disclosureEndCollapse.start();
        } else {
          if (disclosureEndCollapse.running) disclosureEndCollapse.stop();
        }
        // v0.10.0：统计行位置——三态（bottom / top / hidden）由 sync() 内部
        //   判定启停，不需要在这里读 running；隐藏与否已由 injectCSS 处理
        statsLinePosition.sync(detail.statsLinePosition);
      }
      if (typeof window !== "undefined" && window.addEventListener) {
        window.addEventListener(STATE_EVENT, onStateChange);
      }
    }
