    // ===== apply =====
    // apply（loader 调一次，DSH 启动时执行）

    function apply(ctx) {
      // 1) self-shim（先于 CSS 注入，让 [data-pane="conversation"] 选择器在第一次 injectCSS 时就命中）
      applyShellShim();
      applyChatflowShiftMarks();
      startShellShimObserver();
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

      // 6) 各 controller
      var simpleController = createSimpleModeStatusController();
      if (initialState.simpleModeEnabled) simpleController.start();

      // tab hider（通用 createTabHider 工厂；safe tab 都是 "对话" 兜底——避免两 tab
      // 都隐藏后用户卡在轨迹视图出不来）
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

      var hoverCardHider = createSidebarHoverCardHider();
      if (initialState.hideSidebarTooltip) hoverCardHider.start();

      var firstMessageJump = createFirstMessageJumpController();
      if (initialState.firstMessageJump) firstMessageJump.start();
      if (typeof window !== "undefined" && window[DEBUG_API_KEY]) {
        window[DEBUG_API_KEY].firstMessageJump = function () {
          return firstMessageJump.getState();
        };
      }

      var disclosureEndCollapse = createDisclosureEndCollapseController();
      if (initialState.disclosureEndCollapse) disclosureEndCollapse.start();
      if (typeof window !== "undefined" && window[DEBUG_API_KEY]) {
        window[DEBUG_API_KEY].disclosureEndCollapse = function () {
          return { running: disclosureEndCollapse.running };
        };
      }

      // 统计行位置——三态（bottom / top / hidden）由 sync() 内部判定启停；
      // 隐藏与否已由 injectCSS 处理（visibility:hidden 保留 24px 占位）
      var statsLinePosition = createStatsLinePositionController();
      statsLinePosition.sync(initialState.statsLinePosition);
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
          if (!simpleController.running) simpleController.start();
        } else if (simpleController.running) {
          simpleController.stop();
        }
        if (detail.hideTrajectoryTab) {
          if (!trajectoryHider.running) trajectoryHider.start();
        } else if (trajectoryHider.running) {
          trajectoryHider.stop();
        }
        if (detail.hideChatTab) {
          if (!chatHider.running) chatHider.start();
        } else if (chatHider.running) {
          chatHider.stop();
        }
        if (detail.hideSidebarTooltip) {
          if (!hoverCardHider.running) hoverCardHider.start();
        } else if (hoverCardHider.running) {
          hoverCardHider.stop();
        }
        if (detail.firstMessageJump) {
          if (!firstMessageJump.running) firstMessageJump.start();
        } else if (firstMessageJump.running) {
          firstMessageJump.stop();
        }
        if (detail.disclosureEndCollapse) {
          if (!disclosureEndCollapse.running) disclosureEndCollapse.start();
        } else if (disclosureEndCollapse.running) {
          disclosureEndCollapse.stop();
        }
        statsLinePosition.sync(detail.statsLinePosition);
      }
      if (typeof window !== "undefined" && window.addEventListener) {
        window.addEventListener(STATE_EVENT, onStateChange);
      }
    }
