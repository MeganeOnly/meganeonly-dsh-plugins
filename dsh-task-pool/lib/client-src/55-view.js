    // ===== view =====
    // ===== Drawer view =====
    function renderDrawerView(container, controller) {
      var headerEl, bodyEl, listEl, newInputEl;
      var keyHandler = null;
      var deleteTimer = null;
      var sendCountdownInterval = null;

      function build() {
        container.innerHTML = "";
        headerEl = document.createElement("header");
        headerEl.className = "DTPD_header";
        container.appendChild(headerEl);
        bodyEl = document.createElement("div");
        bodyEl.className = "DTPD_body";
        container.appendChild(bodyEl);
        renderHeader();
        renderBody();
        bindGlobalKey();
      }

      function renderHeader() {
        var snap = controller.getSnapshot();
        headerEl.innerHTML =
          '<span class="DTPD_newPlus" aria-hidden="true">+</span>' +
          '<input class="DTPD_newInput" type="text" placeholder="新建任务内容…回车保存" autocomplete="off" spellcheck="false" />' +
          // 全局"发送后删除"开关：放在 inline input 与 📌 之间
          '<label class="DTPD_toggle DTPD_toggleHeader" title="开关：所有任务发送成功后是否从池子里删除">' +
            '<input type="checkbox" data-action="deleteAfterSend" ' + (snap.deleteAfterSend ? "checked" : "") + ' />' +
            '<span>发送后删除</span>' +
          '</label>' +
          '<button class="DTPD_iconBtn" data-action="pin" title="钉住：重启后自动显示">' +
            '<svg viewBox="0 0 16 16" width="14" height="14" fill="' + (snap.pinned ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 1.5l4.2 4.2-1.8 1.8-1.2-1.2-2.1 2.1.6 2.6-1.4 1.4L6 9.5 3.2 12.3l-.7-.7 2.8-2.8-2.9-2.9 1.4-1.4 2.6.6 2.1-2.1L7.3 1.7z"/></svg>' +
          '</button>' +
          '<button class="DTPD_iconBtn" data-action="close" title="关闭抽屉（Esc）" aria-label="关闭">' +
            '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>' +
          '</button>';
        var pinBtn = headerEl.querySelector('[data-action="pin"]');
        if (snap.pinned) pinBtn.dataset.active = "true";
        newInputEl = headerEl.querySelector(".DTPD_newInput");
        newInputEl.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            var v = newInputEl.value;
            newInputEl.value = "";
            controller.createTask({ content: v });
          }
        });
        // 全局"发送后删除"开关：与 BoardController.deleteAfterSend 双向同步
        var deleteAfterSendInput = headerEl.querySelector('[data-action="deleteAfterSend"]');
        deleteAfterSendInput.addEventListener("change", function () {
          controller.setDeleteAfterSend(deleteAfterSendInput.checked);
        });
        pinBtn.addEventListener("click", function () { controller.togglePin(); });
        headerEl.querySelector('[data-action="close"]').addEventListener("click", function () { controller.closeDrawer(); });
      }

      function renderBody() {
        var snap = controller.getSnapshot();
        bodyEl.innerHTML = "";

        if (snap.tasks.length === 0) {
          var empty = document.createElement("div");
          empty.className = "DTPD_empty";
          empty.textContent = "还没有任务，在上面输入回车即可添加";
          bodyEl.appendChild(empty);
          listEl = undefined;
          return;
        }

        listEl = document.createElement("ul");
        listEl.className = "DTPD_list";
        for (var i = 0; i < snap.tasks.length; i++) {
          var li = document.createElement("li");
          li.className = "DTPD_row";
          li.dataset.taskId = snap.tasks[i].id;
          li.appendChild(buildTaskHead(snap.tasks[i]));
          if (snap.expandedId === snap.tasks[i].id) {
            li.dataset.expanded = "true";
            li.appendChild(buildExpandPanel(snap.tasks[i], snap.confirmSend, snap.confirmDelete));
          }
          listEl.appendChild(li);
        }
        bodyEl.appendChild(listEl);
        bindDrag();
      }

      function buildTaskHead(task) {
        var head = document.createElement("div");
        head.className = "DTPD_rowHead";
        head.dataset.role = "head";

        var handle = document.createElement("span");
        handle.className = "DTPD_handle";
        handle.title = "拖动重排";
        handle.draggable = true;
        handle.dataset.role = "handle";
        handle.innerHTML = '<svg viewBox="0 0 8 14" width="8" height="14" fill="currentColor" aria-hidden="true"><circle cx="2" cy="2" r="1"/><circle cx="6" cy="2" r="1"/><circle cx="2" cy="7" r="1"/><circle cx="6" cy="7" r="1"/><circle cx="2" cy="12" r="1"/><circle cx="6" cy="12" r="1"/></svg>';
        head.appendChild(handle);

        var main = document.createElement("div");
        main.className = "DTPD_rowMain";
        var contentEl = document.createElement("div");
        contentEl.className = "DTPD_rowContent";
        contentEl.textContent = task.content;
        main.appendChild(contentEl);
        head.appendChild(main);

        var meta = document.createElement("span");
        meta.className = "DTPD_rowMeta";
        meta.textContent = relativeTime(task.createdAt);
        head.appendChild(meta);

        var chevron = document.createElement("span");
        chevron.className = "DTPD_rowChevron";
        chevron.textContent = "▶";
        head.appendChild(chevron);

        head.addEventListener("click", function (e) {
          if (e.target.closest && e.target.closest('[data-role="handle"]')) return;
          controller.expandTask(task.id);
        });
        return head;
      }

      function buildExpandPanel(task, confirmSendId, confirmDeleteId) {
        var panel = document.createElement("div");
        panel.className = "DTPD_panel";
        panel.dataset.role = "panel";

        var contentLabel = document.createElement("div");
        contentLabel.className = "DTPD_label";
        contentLabel.textContent = "内容";
        panel.appendChild(contentLabel);
        var contentInput = document.createElement("textarea");
        contentInput.className = "DTPD_textarea";
        contentInput.rows = 6;
        contentInput.placeholder = "任务内容（Enter 换行，Ctrl/⌘+Enter 保存）";
        contentInput.value = task.content;
        contentInput.addEventListener("change", function () { controller.updateTask(task.id, { content: contentInput.value }); });
        contentInput.addEventListener("keydown", function (e) {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); contentInput.blur(); }
          if (e.key === "Escape") { e.preventDefault(); controller.collapseTask(); }
        });
        panel.appendChild(contentInput);

        var meta = document.createElement("div");
        meta.className = "DTPD_meta";
        meta.innerHTML =
          '<div>创建：' + beijingDateTime(task.createdAt) + '</div>' +
          '<div>更新：' + beijingDateTime(task.updatedAt) + '</div>';
        panel.appendChild(meta);

        // footer：发送到对话 / 删除 / 收起
        var footer = document.createElement("div");
        footer.className = "DTPD_panelFooter";

        var sendBtn = document.createElement("button");
        sendBtn.type = "button";
        var isSendArmed = (confirmSendId === task.id);
        sendBtn.className = "DTPD_btn DTPD_btnPrimary" + (isSendArmed ? " DTPD_btnSendConfirm" : "");
        sendBtn.textContent = isSendArmed ? "再点一次确认发送（4）" : "📨 发送到当前对话";
        sendBtn.addEventListener("click", function () { controller.requestSend(task.id); });
        footer.appendChild(sendBtn);

        var dangerBtn = document.createElement("button");
        dangerBtn.type = "button";
        dangerBtn.className = "DTPD_btn DTPD_btnDanger" + (confirmDeleteId === task.id ? " DTPD_btnDangerConfirm" : "");
        dangerBtn.textContent = (confirmDeleteId === task.id) ? "再点一次确认删除（不可恢复）" : "删除任务";
        dangerBtn.addEventListener("click", function () {
          if (controller.confirmDelete === task.id) {
            controller.deleteTask(task.id);
            return;
          }
          controller.requestDelete(task.id);
          dangerBtn.textContent = "再点一次确认删除（不可恢复）";
          dangerBtn.classList.add("DTPD_btnDangerConfirm");
          if (deleteTimer) clearTimeout(deleteTimer);
          deleteTimer = setTimeout(function () {
            if (document.body.contains(dangerBtn) && controller.confirmDelete === task.id) {
              controller.clearConfirmDelete();
            }
          }, 4000);
        });
        footer.appendChild(dangerBtn);

        var collapseBtn = document.createElement("button");
        collapseBtn.type = "button";
        collapseBtn.className = "DTPD_btn";
        collapseBtn.textContent = "收起";
        collapseBtn.addEventListener("click", function () { controller.collapseTask(); });
        footer.appendChild(collapseBtn);

        panel.appendChild(footer);

        // 发送 armed 倒计时：每秒把按钮文字里的数字 4 → 3 → 2 → 1 更新
        if (isSendArmed) startSendCountdown(task.id, sendBtn);

        setTimeout(function () {
          if (document.body.contains(contentInput)) {
            contentInput.focus();
            // 不 select，避免误删整段；只把光标移到末尾
            var len = contentInput.value.length;
            try { contentInput.setSelectionRange(len, len); } catch (_) { contentInput.focus(); }
          }
        }, 0);

        return panel;
      }

      // ===== 拖动 =====
      function bindDrag() {
        if (!listEl) return;
        var draggedId = null;

        var handles = listEl.querySelectorAll('[data-role="handle"]');
        for (var i = 0; i < handles.length; i++) {
          (function (handle) {
            var li = handle.closest('.DTPD_row');
            if (!li) return;
            var id = li.dataset.taskId;
            if (!id) return;
            handle.addEventListener("dragstart", function (e) {
              draggedId = id;
              if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = "move";
                try { e.dataTransfer.setData("text/plain", id); } catch (_) {}
              }
              li.classList.add("DTPD_dragging");
            });
            handle.addEventListener("dragend", function () {
              draggedId = null;
              li.classList.remove("DTPD_dragging");
              clearDropMarks();
            });
          })(handles[i]);
        }

        var rows = listEl.querySelectorAll('.DTPD_row');
        for (var j = 0; j < rows.length; j++) {
          (function (row) {
            row.addEventListener("dragover", function (e) {
              if (!draggedId || row.dataset.taskId === draggedId) return;
              e.preventDefault();
              if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
              var rect = row.getBoundingClientRect();
              var before = (e.clientY - rect.top) < rect.height / 2;
              row.classList.toggle("DTPD_dropBefore", before);
              row.classList.toggle("DTPD_dropAfter", !before);
            });
            row.addEventListener("dragleave", function () {
              row.classList.remove("DTPD_dropBefore", "DTPD_dropAfter");
            });
            row.addEventListener("drop", function (e) {
              e.preventDefault();
              var id = draggedId || (e.dataTransfer && e.dataTransfer.getData("text/plain"));
              var targetId = row.dataset.taskId;
              if (!id || id === targetId) return;
              var rect = row.getBoundingClientRect();
              var position = (e.clientY - rect.top) < rect.height / 2 ? "before" : "after";
              controller.reorder(id, targetId, position);
            });
          })(rows[j]);
        }

        listEl.addEventListener("dragover", function (e) {
          if (!draggedId) return;
          if (e.target === listEl) {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
            listEl.classList.add("DTPD_dropEnd");
          }
        });
        listEl.addEventListener("dragleave", function (e) {
          if (e.target === listEl) listEl.classList.remove("DTPD_dropEnd");
        });
        listEl.addEventListener("drop", function (e) {
          if (!draggedId) return;
          if (e.target !== listEl) return;
          e.preventDefault();
          listEl.classList.remove("DTPD_dropEnd");
          controller.reorder(draggedId, null, "after");
        });
      }

      function clearDropMarks() {
        if (!listEl) return;
        listEl.classList.remove("DTPD_dropEnd");
        var marks = listEl.querySelectorAll('.DTPD_dropBefore, .DTPD_dropAfter');
        for (var i = 0; i < marks.length; i++) {
          marks[i].classList.remove("DTPD_dropBefore", "DTPD_dropAfter");
        }
      }

      /** 启动 armed 倒计时：按钮文字里的数字每秒 4 → 3 → 2 → 1，第 4 秒清 armed。 */
      function startSendCountdown(taskId, sendBtn) {
        stopSendCountdown();
        var remaining = 4;
        function tick() {
          if (controller.confirmSend !== taskId) { stopSendCountdown(); return; }
          if (remaining <= 0) {
            controller.clearConfirmSend();
            stopSendCountdown();
            return;
          }
          sendBtn.textContent = "再点一次确认发送（" + remaining + "）";
          remaining--;
        }
        tick(); // 立即显示 "（4）"
        sendCountdownInterval = setInterval(tick, 1000);
      }
      function stopSendCountdown() {
        if (sendCountdownInterval) {
          clearInterval(sendCountdownInterval);
          sendCountdownInterval = null;
        }
      }

      function bindGlobalKey() {
        unbindGlobalKey();
        keyHandler = function (e) {
          if (!controller.getSnapshot().drawerOpen) return;
          if (e.key !== "Escape") return;
          var snap = controller.getSnapshot();
          if (snap.confirmSend !== undefined) { controller.clearConfirmSend(); return; }
          if (snap.confirmDelete !== false) { controller.clearConfirmDelete(); return; }
          if (snap.expandedId !== undefined) { controller.collapseTask(); return; }
          controller.closeDrawer();
        };
        document.addEventListener("keydown", keyHandler);
      }
      function unbindGlobalKey() {
        if (keyHandler) { document.removeEventListener("keydown", keyHandler); keyHandler = null; }
      }

      build();
      var unsubRender = controller.subscribe(function () {
        renderHeader();
        renderBody();
      });

      return {
        dispose: function () {
          unsubRender();
          unbindGlobalKey();
          if (deleteTimer) { clearTimeout(deleteTimer); deleteTimer = null; }
          if (sendCountdownInterval) { clearInterval(sendCountdownInterval); sendCountdownInterval = null; }
          if (container) container.innerHTML = "";
        }
      };
    }

