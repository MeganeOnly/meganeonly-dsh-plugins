    // ===== CSS =====
    var CSS = "" +
      // 抽屉
      "[data-dsh-github-drawer]{position:fixed;top:0;right:0;bottom:0;width:" + DRAWER_WIDTH + "px;max-width:90vw;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);font-size:13px;border-left:1px solid var(--dsw-alias-border-l1);box-shadow:0 2px 12px rgba(0,0,0,.12);z-index:100;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .22s ease;box-sizing:border-box;}" +
      "html[" + DRAWER_ATTR + "] [data-dsh-github-drawer]{transform:translateX(0);}" +
      // header
      ".DGH_header{display:flex;align-items:center;gap:6px;flex:none;padding:14px 14px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);}" +
      ".DGH_title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);padding:0 4px;flex:none;}" +
      ".DGH_iconBtn{font:inherit;cursor:pointer;background:transparent;color:var(--dsw-alias-label-secondary);border:1px solid transparent;border-radius:8px;padding:5px 7px;display:inline-flex;align-items:center;justify-content:center;transition:background .12s,color .12s;flex:none;}" +
      ".DGH_iconBtn:hover{background:var(--dsw-specific-sidebar-nav-item-hover);color:var(--dsw-alias-label-primary);}" +
      ".DGH_iconBtn[data-active=\"true\"]{background:var(--dsw-specific-sidebar-nav-item-active);color:var(--dsw-alias-label-primary);}" +
      ".DGH_spacer{flex:1;min-width:0;}" +
      ".DGH_pushBtn{font:inherit;cursor:pointer;background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground);border:1px solid var(--dsw-alias-button-info-fill);border-radius:8px;padding:6px 10px;font-size:12px;font-weight:500;transition:background .12s,border-color .12s;flex:none;}" +
      ".DGH_pushBtn:hover{background:var(--dsw-alias-button-info-hover);border-color:var(--dsw-alias-button-info-hover);}" +
      ".DGH_pushBtn:disabled{opacity:.45;cursor:not-allowed;}" +
      // v0.2.2：commit 工具区
      ".DGH_commitSection{flex:none;padding:0;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);}" +
      ".DGH_commitSectionEmpty{padding:10px 14px;font-size:11px;color:var(--dsw-alias-label-tertiary);text-align:center;font-style:italic;}" +
      ".DGH_commitRepo{padding:10px 14px;border-top:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;gap:6px;}" +
      ".DGH_commitRepo:first-child{border-top:none;}" +
      ".DGH_commitRepoName{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:6px;}" +
      ".DGH_commitRepoPath{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;color:var(--dsw-alias-label-tertiary);font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;}" +
      ".DGH_commitMeta{font-size:11px;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;gap:6px;flex-wrap:wrap;}" +
      ".DGH_commitBranch{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:4px;padding:1px 6px;}" +
      ".DGH_commitBadge{background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground);border-radius:999px;padding:1px 8px;font-weight:600;}" +
      ".DGH_commitFiles{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:4px;padding:4px 6px;max-height:64px;overflow-y:auto;line-height:1.5;white-space:pre-wrap;word-break:break-all;}" +
      ".DGH_commitFileStatus{color:var(--dsw-alias-button-info-fill);font-weight:600;margin-right:2px;}" +
      ".DGH_commitForm{display:flex;gap:6px;align-items:center;}" +
      ".DGH_commitInput{flex:1;min-width:0;font:inherit;font-size:12px;padding:5px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-sizing:border-box;}" +
      ".DGH_commitInput:focus{outline:none;border-color:var(--dsw-alias-button-info-fill);}" +
      ".DGH_commitInput:disabled{background:var(--dsw-alias-bg-component-disabled);color:var(--dsw-alias-label-tertiary);}" +
      ".DGH_commitSubmit{font:inherit;font-size:12px;font-weight:600;cursor:pointer;background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground);border:1px solid var(--dsw-alias-button-info-fill);border-radius:6px;padding:5px 12px;flex:none;transition:background .12s;}" +
      ".DGH_commitSubmit:hover:not(:disabled){background:var(--dsw-alias-button-info-hover);border-color:var(--dsw-alias-button-info-hover);}" +
      ".DGH_commitSubmit:disabled{background:var(--dsw-alias-bg-component-disabled);color:var(--dsw-alias-label-tertiary);border-color:var(--dsw-alias-border-l1);cursor:not-allowed;}" +
      // v0.3.0：merge / pull 工具区
      ".DGH_mergeSection{flex:none;padding:0;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);}" +
      ".DGH_mergeSectionEmpty{padding:10px 14px;font-size:11px;color:var(--dsw-alias-label-tertiary);text-align:center;font-style:italic;}" +
      ".DGH_mergeRepo{padding:10px 14px;border-top:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;gap:6px;}" +
      ".DGH_mergeRepo:first-child{border-top:none;}" +
      ".DGH_mergeRepoName{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:6px;}" +
      ".DGH_mergeRepoPath{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;color:var(--dsw-alias-label-tertiary);font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;}" +
      ".DGH_mergeMeta{font-size:11px;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;gap:6px;flex-wrap:wrap;}" +
      ".DGH_mergeBranch{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:4px;padding:1px 6px;}" +
      ".DGH_mergeBadge{background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground);border-radius:999px;padding:1px 8px;font-weight:600;}" +
      ".DGH_mergeBadge[data-kind=\"conflict\"]{background:rgba(220,38,38,.85);color:#fff;}" +
      ".DGH_mergeBadge[data-kind=\"rebase\"]{background:rgba(234,88,12,.85);color:#fff;}" +
      ".DGH_mergeBadge[data-kind=\"upstream\"]{background:rgba(99,102,241,.15);color:#4338ca;}" +
      ".DGH_mergeConflictBanner{padding:6px 8px;background:rgba(220,38,38,.1);border:1px solid rgba(220,38,38,.4);border-radius:6px;display:flex;flex-direction:column;gap:4px;font-size:11.5px;color:var(--dsw-alias-state-error-primary);}" +
      ".DGH_mergeConflictTitle{display:flex;align-items:center;gap:6px;font-weight:600;}" +
      ".DGH_mergeConflictList{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;padding-left:18px;list-style:disc;color:var(--dsw-alias-label-secondary);}" +
      ".DGH_mergeConflictList li{margin:1px 0;}" +
      ".DGH_mergeForm{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}" +
      ".DGH_mergeSelect{flex:1;min-width:0;font:inherit;font-size:12px;padding:5px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-sizing:border-box;}" +
      ".DGH_mergeSelect:focus{outline:none;border-color:var(--dsw-alias-button-info-fill);}" +
      ".DGH_mergeSelect:disabled{background:var(--dsw-alias-bg-component-disabled);color:var(--dsw-alias-label-tertiary);}" +
      ".DGH_mergeBtn,.DGH_pullBtn,.DGH_abortBtn{font:inherit;font-size:12px;font-weight:600;cursor:pointer;border-radius:6px;padding:5px 10px;flex:none;transition:background .12s;}" +
      ".DGH_mergeBtn{background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground);border:1px solid var(--dsw-alias-button-info-fill);}" +
      ".DGH_mergeBtn:hover:not(:disabled){background:var(--dsw-alias-button-info-hover);border-color:var(--dsw-alias-button-info-hover);}" +
      ".DGH_pullBtn{background:transparent;color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);}" +
      ".DGH_pullBtn:hover:not(:disabled){background:var(--dsw-specific-sidebar-nav-item-hover);border-color:var(--dsw-alias-label-dimmed);}" +
      ".DGH_abortBtn{background:rgba(220,38,38,.1);color:var(--dsw-alias-state-error-primary);border:1px solid rgba(220,38,38,.4);}" +
      ".DGH_abortBtn:hover:not(:disabled){background:rgba(220,38,38,.18);border-color:rgba(220,38,38,.7);}" +
      ".DGH_mergeBtn:disabled,.DGH_pullBtn:disabled,.DGH_abortBtn:disabled{opacity:.45;cursor:not-allowed;}" +
      ".DGH_mergeHint{font-size:10.5px;color:var(--dsw-alias-label-tertiary);line-height:1.5;}" +
      // 配置面板
      ".DGH_config{border-bottom:1px solid var(--dsw-alias-border-l1);padding:10px 14px;display:flex;flex-direction:column;gap:8px;background:var(--dsw-alias-bg-layer-2);}" +
      ".DGH_configLabel{font-size:11px;color:var(--dsw-alias-label-tertiary);text-transform:uppercase;letter-spacing:.04em;}" +
      ".DGH_configTextarea{font:inherit;font-size:12px;background:var(--dsw-specific-input-major);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 10px;width:100%;box-sizing:border-box;min-height:70px;outline:none;resize:vertical;font-family:inherit;}" +
      ".DGH_configTextarea:focus{border-color:var(--dsw-alias-button-info-fill);}" +
      ".DGH_configFooter{display:flex;align-items:center;gap:8px;}" +
      ".DGH_configHint{font-size:11px;color:var(--dsw-alias-label-tertiary);flex:1;min-width:0;}" +
      ".DGH_saveBtn{font:inherit;cursor:pointer;background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground);border:1px solid var(--dsw-alias-button-info-fill);border-radius:8px;padding:5px 12px;font-size:12px;font-weight:500;transition:background .12s;}" +
      ".DGH_saveBtn:hover{background:var(--dsw-alias-button-info-hover);}" +
      ".DGH_saveBtn:disabled{opacity:.5;cursor:not-allowed;}" +
      // body / list
      ".DGH_body{flex:1;min-height:0;overflow-y:auto;padding:12px 14px 16px;}" +
      ".DGH_empty{padding:36px 12px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.6;}" +
      ".DGH_empty strong{display:block;font-size:14px;color:var(--dsw-alias-label-secondary);margin-bottom:6px;}" +
      ".DGH_loading{padding:24px 8px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:12px;}" +
      ".DGH_list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;}" +
      ".DGH_errorBanner{padding:8px 10px;border-radius:6px;background:rgba(239,68,68,.1);color:var(--dsw-alias-state-error-primary);font-size:12px;margin-bottom:8px;display:flex;align-items:center;gap:8px;}" +
      ".DGH_errorBannerRetry{margin-left:auto;cursor:pointer;background:transparent;border:1px solid currentColor;border-radius:6px;padding:2px 8px;font-size:11px;color:inherit;}" +
      // 仓库卡片
      ".DGH_repo{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;transition:border-color .12s,background .12s;overflow:hidden;}" +
      ".DGH_repo:hover{border-color:var(--dsw-alias-label-dimmed);}" +
      ".DGH_repo[data-pinned=\"true\"]{border-color:var(--dsw-alias-button-info-fill);}" +
      ".DGH_repoHead{padding:7px 10px;display:flex;flex-direction:column;gap:3px;}" +
      ".DGH_repoTitle{display:flex;align-items:center;gap:5px;flex-wrap:wrap;}" +
      ".DGH_repoName{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      ".DGH_repoBranch{font-size:10px;font-family:monospace;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-base);padding:1px 5px;border-radius:3px;border:1px solid var(--dsw-alias-border-l2);flex:none;}" +
      ".DGH_repoPath{font-size:10px;color:var(--dsw-alias-label-tertiary);word-break:break-all;font-family:monospace;opacity:.75;}" +
      ".DGH_repoBadges{display:flex;align-items:center;gap:4px;flex-wrap:wrap;font-size:10px;color:var(--dsw-alias-label-secondary);}" +
      ".DGH_badge{display:inline-flex;align-items:center;gap:3px;padding:1px 6px;border-radius:8px;font-size:10px;line-height:1.4;}" +
      ".DGH_badge[data-kind=\"clean\"]{background:rgba(22,163,74,.12);color:#15803d;}" +
      ".DGH_badge[data-kind=\"dirty\"]{background:rgba(234,179,8,.15);color:#a16207;}" +
      ".DGH_badge[data-kind=\"unknown\"]{background:rgba(148,163,184,.15);color:#475569;}" +
      ".DGH_badge[data-kind=\"unpushed\"]{background:rgba(220,38,38,.12);color:#b91c1c;}" +
      ".DGH_badge[data-kind=\"today\"]{background:rgba(99,102,241,.12);color:#4338ca;}" +
      ".DGH_badge[data-kind=\"warn\"]{background:rgba(234,88,12,.12);color:#9a3412;}" +
      ".DGH_lastCommit{font-size:10px;color:var(--dsw-alias-label-tertiary);display:flex;align-items:baseline;gap:5px;flex-wrap:wrap;opacity:.85;}" +
      ".DGH_lastCommitSha{font-family:monospace;color:var(--dsw-alias-label-secondary);}" +
      // v0.2.0：内嵌 push 按钮（titleRow 右侧；v0.1.8 独立 actions 行已去掉）
      ".DGH_pushInline{flex:none;margin-left:auto;background:transparent;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l2);border-radius:5px;width:22px;height:22px;font:inherit;font-size:13px;line-height:1;cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center;transition:background .12s,border-color .12s,color .12s;}" +
      ".DGH_pushInline:hover:not(:disabled){background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground);border-color:var(--dsw-alias-button-info-fill);}" +
      ".DGH_pushInline:disabled{opacity:.35;cursor:not-allowed;}" +
      // .DGH_repoActions / .DGH_actionBtn 保留（dead code，未来恢复推到对话等按钮时复用）
      ".DGH_repoActions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 12px;border-top:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);}" +
      ".DGH_actionBtn{font:inherit;cursor:pointer;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 10px;font-size:12px;transition:background .12s,border-color .12s;display:inline-flex;align-items:center;gap:4px;}" +
      ".DGH_actionBtn:hover{background:var(--dsw-specific-sidebar-nav-item-hover);border-color:var(--dsw-alias-label-dimmed);}" +
      ".DGH_actionBtn:disabled{opacity:.45;cursor:not-allowed;}" +
      ".DGH_actionBtn[data-variant=\"primary\"]{border-color:var(--dsw-alias-button-info-fill);background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground);}" +
      ".DGH_actionBtn[data-variant=\"primary\"]:hover{background:var(--dsw-alias-button-info-hover);border-color:var(--dsw-alias-button-info-hover);}" +
      ".DGH_pinBtn[data-active=\"true\"]{color:#b45309;}" +
      ".DGH_hideBtn[data-active=\"true\"]{color:#9a3412;background:rgba(154,52,18,.1);}" +
      // v0.1.7：隐藏选择模式 — 卡片可点 + 已隐藏卡视觉
      ".DGH_repo[data-selecting=\"true\"]{cursor:pointer;border-color:rgba(234,88,12,.4);}" +
      ".DGH_repo[data-selecting=\"true\"]:hover{border-color:#ea580c;background:var(--dsw-alias-bg-layer-3);}" +
      ".DGH_repo[data-hidden=\"true\"]{opacity:.6;}" +
      ".DGH_repo[data-hidden=\"true\"] .DGH_repoPath,.DGH_repo[data-hidden=\"true\"] .DGH_repoName{text-decoration:line-through;text-decoration-color:var(--dsw-alias-label-tertiary);}" +
      ".DGH_repoMark{margin-left:6px;font-size:11px;color:#9a3412;background:rgba(154,52,18,.1);padding:2px 6px;border-radius:4px;}" +
      // 隐藏仓库小条（v0.1.7：仅 selectionMode 模式底部显示）
      ".DGH_hiddenBar{display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--dsw-alias-bg-layer-2);border-top:1px solid var(--dsw-alias-border-l2);font-size:12px;color:var(--dsw-alias-label-secondary);flex:none;}" +
      ".DGH_hiddenBarCount{flex:1;min-width:0;}" +
      ".DGH_hiddenBarToggle{cursor:pointer;background:transparent;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:3px 10px;font:inherit;font-size:11px;color:var(--dsw-alias-label-primary);}" +
      ".DGH_hiddenBarToggle:hover{background:var(--dsw-specific-sidebar-nav-item-hover);}" +
      ".DGH_hiddenBarExit{cursor:pointer;background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground);border:1px solid var(--dsw-alias-button-info-fill);border-radius:6px;padding:3px 12px;font:inherit;font-size:12px;font-weight:500;}" +
      ".DGH_hiddenBarExit:hover{background:var(--dsw-alias-button-info-hover);border-color:var(--dsw-alias-button-info-hover);}" +
      // 选择模式 toggle 按钮激活态
      "[data-action=\"select-toggle\"][data-active=\"true\"]{background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground);border-color:var(--dsw-alias-button-info-fill);}" +
      // FAB：top:130px = task-pool FAB(78~122)+ 8px 间距。两个 FAB 同时可见不重叠；
      // drawer 打开互斥协议保证两个 FAB 不会同时进入让位动画
      ".DGH_fab{position:fixed;top:130px;right:24px;width:44px;height:44px;border-radius:50%;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:110;box-shadow:0 2px 8px rgba(0,0,0,.1);transition:transform .12s,right .22s ease,background .12s;padding:0;}" +
      ".DGH_fab:hover{transform:scale(1.06);}" +
      ".DGH_fab[data-state=\"open\"]{background:var(--dsw-alias-bg-layer-3);}" +
      // drawer 打开时 FAB 让位到抽屉的左边外。
      // 让位公式 calc(var(--active-drawer-width) + 24px)：--active-drawer-width 由打开抽屉的
      // panel 在 applyOpen(open) 时 setProperty 设定（task-pool = 380px, git-hub = 420px, ...），
      // 所以 FAB 让位数值随实际打开抽屉宽度变化——避免不同宽度抽屉用固定值导致的位置错乱。
      // 监听 ANY_DRAWER_ATTR（任意右侧抽屉打开）→ 不只是自己抽屉打开。
      // 与 dsh-task-pool / 其他面板共享此协议，互斥协议保证任意时刻只有一个抽屉打开。
      "html[" + ANY_DRAWER_ATTR + "] .DGH_fab{right:calc(var(--active-drawer-width, 380px) + 24px);}" +
      // toast
      ".DGH_toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:10px 16px;font:inherit;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.18);z-index:120;animation:DGH_toastIn .14s ease;}" +
      ".DGH_toast-error{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);}" +
      "@keyframes DGH_toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}" +
      // push 状态条
      ".DGH_pushStatus{padding:6px 12px;font-size:11px;color:var(--dsw-alias-label-tertiary);display:flex;align-items:center;gap:6px;background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-border-l1);}" +
      ".DGH_pushStatusDot{width:6px;height:6px;border-radius:50%;background:#22c55e;flex:none;}" +
      ".DGH_pushStatusDot[data-running=\"true\"]{background:#eab308;animation:DGH_pulse 1s ease-in-out infinite;}" +
      "@keyframes DGH_pulse{0%,100%{opacity:1;}50%{opacity:.5;}}";

    function injectCSS() {
      var tagId = "dsh-git-hub/drawer.css";
      if (document.querySelector("style[data-plugin-css=\"" + tagId + "\"]")) return;
      var tag = document.createElement("style");
      tag.dataset.plugin = "dsh-git-hub";
      tag.dataset.pluginCss = tagId;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

