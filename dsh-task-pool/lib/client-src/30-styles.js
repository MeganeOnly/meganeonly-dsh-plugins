    // ===== styles =====
    // ===== CSS =====
    var CSS = "" +
      // 抽屉容器
      "[data-dsh-taskpool-drawer]{position:fixed;top:0;right:0;bottom:0;width:" + DRAWER_WIDTH + "px;max-width:90vw;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);font-size:13px;border-left:1px solid var(--dsw-alias-border-l1);box-shadow:0 2px 12px rgba(0,0,0,.12);z-index:100;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .22s ease;box-sizing:border-box;}" +
      "html[" + DRAWER_ATTR + "] [data-dsh-taskpool-drawer]{transform:translateX(0);}" +
      // header
      ".DTPD_header{display:flex;align-items:center;gap:8px;flex:none;padding:14px 16px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);}" +
      ".DTPD_newPlus{flex:none;font-size:18px;font-weight:600;color:var(--dsw-alias-label-tertiary);width:18px;text-align:center;line-height:1;user-select:none;}" +
      ".DTPD_newInput{flex:1;min-width:0;background:var(--dsw-specific-input-major);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:6px 10px;border-radius:8px;outline:none;transition:border-color .12s;box-sizing:border-box;}" +
      ".DTPD_newInput:focus{border-color:var(--dsw-alias-button-info-fill);}" +
      ".DTPD_newInput::placeholder{color:var(--dsw-alias-label-tertiary);}" +
      ".DTPD_iconBtn{font:inherit;cursor:pointer;background:transparent;color:var(--dsw-alias-label-secondary);border:1px solid transparent;border-radius:8px;padding:6px 8px;display:inline-flex;align-items:center;justify-content:center;transition:background .12s,color .12s;flex:none;}" +
      ".DTPD_iconBtn:hover{background:var(--dsw-specific-sidebar-nav-item-hover);color:var(--dsw-alias-label-primary);}" +
      ".DTPD_iconBtn[data-active=\"true\"]{background:var(--dsw-specific-sidebar-nav-item-active);color:var(--dsw-alias-label-primary);}" +
      // body / list
      ".DTPD_body{flex:1;min-height:0;overflow-y:auto;padding:12px 16px 16px;}" +
      ".DTPD_empty{padding:24px 8px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:13px;}" +
      ".DTPD_list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;}" +
      // 单条长条卡片
      ".DTPD_row{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;transition:border-color .12s,background .12s;overflow:hidden;}" +
      ".DTPD_row:hover{border-color:var(--dsw-alias-label-dimmed);}" +
      ".DTPD_row[data-expanded=\"true\"]{border-color:var(--dsw-alias-button-info-fill);background:var(--dsw-alias-bg-layer-3);}" +
      ".DTPD_rowHead{display:flex;align-items:stretch;gap:8px;padding:10px 12px;cursor:pointer;}" +
      ".DTPD_handle{display:flex;align-items:center;justify-content:center;width:18px;flex:none;color:var(--dsw-alias-label-tertiary);cursor:grab;border-radius:4px;}" +
      ".DTPD_handle:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-specific-sidebar-nav-item-hover);}" +
      ".DTPD_handle:active{cursor:grabbing;}" +
      ".DTPD_rowMain{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}" +
      ".DTPD_rowContent{font-size:13px;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      ".DTPD_rowMeta{flex:none;font-size:12px;color:var(--dsw-alias-label-tertiary);align-self:center;}" +
      ".DTPD_rowChevron{flex:none;align-self:center;color:var(--dsw-alias-label-tertiary);font-size:10px;width:14px;height:14px;display:flex;align-items:center;justify-content:center;transition:transform .14s;}" +
      ".DTPD_row[data-expanded=\"true\"] .DTPD_rowChevron{transform:rotate(90deg);color:var(--dsw-alias-label-primary);}" +
      // 拖动视觉提示
      ".DTPD_row.DTPD_dragging{opacity:.4;}" +
      ".DTPD_row.DTPD_dropBefore{box-shadow:0 -2px 0 var(--dsw-alias-button-info-fill);}" +
      ".DTPD_row.DTPD_dropAfter{box-shadow:0 2px 0 var(--dsw-alias-button-info-fill);}" +
      ".DTPD_list.DTPD_dropEnd{box-shadow:0 2px 0 var(--dsw-alias-button-info-fill) inset;}" +
      // 卡片展开面板
      ".DTPD_panel{border-top:1px solid var(--dsw-alias-border-l2);padding:12px;display:flex;flex-direction:column;gap:10px;background:var(--dsw-alias-bg-base);animation:DTPD_fadeIn .14s ease;}" +
      "@keyframes DTPD_fadeIn{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:translateY(0);}}" +
      ".DTPD_textarea{font:inherit;background:var(--dsw-specific-input-major);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:8px 10px;outline:none;width:100%;box-sizing:border-box;font-size:13px;resize:vertical;min-height:140px;font-family:inherit;line-height:1.5;}" +
      ".DTPD_textarea:focus{border-color:var(--dsw-alias-button-info-fill);}" +
      ".DTPD_label{font-size:11px;color:var(--dsw-alias-label-tertiary);text-transform:uppercase;letter-spacing:.04em;}" +
      ".DTPD_meta{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:1.5;}" +
      ".DTPD_panelFooter{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px;}" +
      // header 内的"发送后删除"开关（全局）
      ".DTPD_toggleHeader{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer;user-select:none;white-space:nowrap;}" +
      ".DTPD_toggleHeader input[type=checkbox]{width:13px;height:13px;cursor:pointer;margin:0;accent-color:var(--dsw-alias-button-info-fill);}" +
      ".DTPD_toggleHeader:hover{color:var(--dsw-alias-label-primary);}" +
      ".DTPD_btn{font:inherit;cursor:pointer;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:5px 12px;font-size:13px;transition:background .12s,border-color .12s;}" +
      ".DTPD_btn:hover{background:var(--dsw-specific-sidebar-nav-item-hover);border-color:var(--dsw-alias-label-dimmed);}" +
      ".DTPD_btnPrimary{border-color:var(--dsw-alias-button-info-fill);background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground);}" +
      ".DTPD_btnPrimary:hover{border-color:var(--dsw-alias-button-info-hover);background:var(--dsw-alias-button-info-hover);}" +
      ".DTPD_btnDanger{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);background:transparent;}" +
      ".DTPD_btnDanger:hover{background:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-label-primary-foreground);}" +
      ".DTPD_btnDangerConfirm{animation:DTPD_pulse 1s ease-in-out infinite;}" +
      ".DTPD_btnSendConfirm{background:#ea580c !important;border-color:#ea580c !important;color:#fff !important;animation:DTPD_pulse 1s ease-in-out infinite;}" +
      "@keyframes DTPD_pulse{0%,100%{opacity:1;}50%{opacity:.55;}}" +
      // FAB（右上角，top:78px 避开 DSH 顶部元素重叠；drawer 打开自动让位；下移 22px = 球半径）
      ".DTPD_fab{position:fixed;top:78px;right:24px;width:44px;height:44px;border-radius:50%;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:110;box-shadow:0 2px 8px rgba(0,0,0,.1);transition:transform .12s,right .22s ease,background .12s;padding:0;}" +
      ".DTPD_fab:hover{transform:scale(1.06);}" +
      ".DTPD_fab[data-state=\"open\"]{background:var(--dsw-alias-bg-layer-3);}" +
      ".DTPD_fab[data-pinned=\"true\"]::after{content:\"\";position:absolute;top:8px;right:8px;width:8px;height:8px;border-radius:50%;background:#16a34a;border:1.5px solid var(--dsw-alias-bg-base);}" +
      // drawer 打开时 FAB 让位到抽屉的左边外。
      // 让位公式 calc(var(--active-drawer-width) + 24px)：--active-drawer-width 由打开抽屉的
      // panel 在 applyOpen(open) 时 setProperty 设定（task-pool = 380px, git-hub = 420px, ...），
      // 所以 FAB 让位数值随实际打开抽屉宽度变化——避免不同宽度抽屉用固定值导致的位置错乱。
      // 监听 ANY_DRAWER_ATTR（任意右侧抽屉打开）→ 不只是自己抽屉打开。
      // 与 dsh-git-hub / 其他面板共享此协议，互斥协议保证任意时刻只有一个抽屉打开。
      "html[" + ANY_DRAWER_ATTR + "] .DTPD_fab{right:calc(var(--active-drawer-width, 380px) + 24px);}";

    function injectCSS() {
      var tagId = "dsh-task-pool/drawer.css";
      if (document.querySelector("style[data-plugin-css=\"" + tagId + "\"]")) return;
      var tag = document.createElement("style");
      tag.dataset.plugin = "dsh-task-pool";
      tag.dataset.pluginCss = tagId;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

