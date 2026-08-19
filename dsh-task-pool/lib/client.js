/**
 * dsh-task-pool — 浏览器半端（web client bundle，作者：MeganeOnly）
 *
 * v0.5.0：FAB 下移 + 卡片"发送到当前对话"功能（二次确认）。
 *   - FAB 从 top:24px 下移到 top:56px（避开 DSH 顶部元素重叠）；
 *   - 卡片就地展开面板新增"📨 发送到对话"按钮：第一次按进入 armed 态
 *     （按钮变橙色脉冲，文字"再点一次确认发送"），4 秒内再按一次才真正
 *     通过 sessions.driver.prompt 把任务标题+描述作为 user message 发到当前
 *     会话；超时或展开其它卡片自动撤销 armed 态；
 *   - 发送失败不抛错（console.error），不影响任务池；host half 仍为零副作用；
 *   - 视觉 token / FAB 让位 / 抽屉交互等沿用 v0.4.0。
 *
 * 持久化：localStorage（key dsh.taskPool.v1，schema v2 兼容 v1）。
 * 唯一 token 消耗路径：用户主动发送任务到对话时（与 ui-task-board 的执行模式同款）。
 */
window.__ModuleLoader__.load({
  id: "dsh-task-pool",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var inject = ["sessions"]; // sessions 发送任务到当前会话

    // ===== 常量 =====
    var STORAGE_KEY = "dsh.taskPool.v1";
    var DRAWER_ATTR = "data-dsh-taskpool-drawer-open";
    // 任何右侧抽屉打开时设的统一 attr；所有 FAB CSS 监听它→让位到屏幕左侧
    // （侧边栏区域），而不是被自己的抽屉遮挡。互斥协议保证任何时刻只有一个抽屉打开。
    var ANY_DRAWER_ATTR = "data-dsh-any-side-drawer-open";
    var DRAWER_WIDTH = 380;
    var PANEL_NAME = "taskpool";
    var ACTIVATE_EVENT = "dsh-panel-activate";

    // ===== 工具函数 =====
    function uuid() {
      var c = globalThis.crypto;
      if (c && c.getRandomValues) {
        var b = c.getRandomValues(new Uint8Array(16));
        b[6] = b[6] & 15 | 64;
        b[8] = b[8] & 63 | 128;
        var hex = "";
        for (var i = 0; i < 16; i++) hex += (b[i] + 256).toString(16).slice(1);
        return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
      }
      return "t-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    }

    function pad2(n) { return String(n).padStart(2, "0"); }
    function beijingDate(ms) { return new Date(ms + 8 * 3600 * 1000); }

    function relativeTime(ms) {
      var diff = Date.now() - ms;
      if (diff < 0) diff = 0;
      var m = Math.floor(diff / 60000);
      if (m < 1) return "刚刚";
      if (m < 60) return m + " 分钟前";
      var h = Math.floor(m / 60);
      if (h < 24) return h + " 小时前";
      var d = Math.floor(h / 24);
      if (d < 30) return d + " 天前";
      var dt = beijingDate(ms);
      return dt.getUTCFullYear() + "-" + pad2(dt.getUTCMonth() + 1) + "-" + pad2(dt.getUTCDate());
    }

    function beijingDateTime(ms) {
      var dt = beijingDate(ms);
      return dt.getUTCFullYear() + "-" + pad2(dt.getUTCMonth() + 1) + "-" + pad2(dt.getUTCDate())
        + " " + pad2(dt.getUTCHours()) + ":" + pad2(dt.getUTCMinutes());
    }

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
      ".DTPD_rowTitle{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      ".DTPD_rowDesc{font-size:12px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
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
      ".DTPD_input,.DTPD_textarea{font:inherit;background:var(--dsw-specific-input-major);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:8px 10px;outline:none;width:100%;box-sizing:border-box;}" +
      ".DTPD_input:focus,.DTPD_textarea:focus{border-color:var(--dsw-alias-button-info-fill);}" +
      ".DTPD_input{font-size:13px;font-weight:600;}" +
      ".DTPD_textarea{font-size:13px;resize:vertical;min-height:90px;font-family:inherit;}" +
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

    // ===== LocalStorageTaskStore =====
    function isTaskShape(v) {
      if (typeof v !== "object" || v === null) return false;
      if (typeof v.id !== "string" || v.id === "") return false;
      if (typeof v.title !== "string") return false;
      if (typeof v.description !== "string") return false;
      if (typeof v.createdAt !== "number") return false;
      if (typeof v.updatedAt !== "number") return false;
      if (typeof v.order !== "number") return false;
      return true;
    }

    function parseDoc(raw) {
      if (raw === null) return { tasks: [], pinned: false, deleteAfterSend: true };
      var parsed;
      try { parsed = JSON.parse(raw); }
      catch (e) {
        console.error("[dsh-task-pool] ledger is not valid JSON; starting empty", e);
        return { tasks: [], pinned: false, deleteAfterSend: true };
      }
      if (typeof parsed !== "object" || parsed === null || !Array.isArray(parsed.tasks)) {
        console.error("[dsh-task-pool] ledger shape invalid; starting empty");
        return { tasks: [], pinned: false, deleteAfterSend: true };
      }
      var tasks = [];
      for (var i = 0; i < parsed.tasks.length; i++) {
        if (isTaskShape(parsed.tasks[i])) tasks.push(parsed.tasks[i]);
        else console.warn("[dsh-task-pool] dropping invalid task row", parsed.tasks[i]);
      }
      var pinned = typeof parsed.pinned === "boolean" ? parsed.pinned : false;
      var deleteAfterSend = typeof parsed.deleteAfterSend === "boolean" ? parsed.deleteAfterSend : true;
      return { tasks: tasks, pinned: pinned, deleteAfterSend: deleteAfterSend };
    }

    function LocalStorageTaskStore(key) {
      this.key = key || STORAGE_KEY;
      var storage;
      try {
        var probe = "__dsh_taskpool_probe__";
        globalThis.localStorage.setItem(probe, probe);
        globalThis.localStorage.removeItem(probe);
        storage = globalThis.localStorage;
      } catch (e) {
        console.warn("[dsh-task-pool] localStorage unavailable, in-memory only");
        storage = undefined;
      }
      this.storage = storage;
    }
    LocalStorageTaskStore.prototype.load = function () {
      if (!this.storage) return { tasks: [], pinned: false, deleteAfterSend: true };
      try {
        return parseDoc(this.storage.getItem(this.key));
      } catch (e) {
        console.error("[dsh-task-pool] load failed; starting empty", e);
        return { tasks: [], pinned: false, deleteAfterSend: true };
      }
    };
    LocalStorageTaskStore.prototype.save = function (doc) {
      if (!this.storage) return;
      try {
        this.storage.setItem(this.key, JSON.stringify({ tasks: doc.tasks, pinned: !!doc.pinned, deleteAfterSend: doc.deleteAfterSend !== false }));
      } catch (e) {
        console.error("[dsh-task-pool] save failed (persistence skipped)", e);
      }
    };

    // ===== BoardController（v0.5.0：新增 deps + confirmSend + sendTask） =====
    function BoardController(store, deps) {
      this.store = store;
      this.deps = deps || {};
      this.tasks = [];
      this.drawerOpen = false;
      this.pinned = false;
      this.expandedId = undefined;
      this.confirmDelete = false;
      this.confirmSend = undefined;  // taskId armed for two-step send
      this.deleteAfterSend = true;   // 发送成功后是否从池子删除（持久化在 store.deleteAfterSend）
      this.listeners = new Set();
    }
    BoardController.prototype.start = function () {
      var doc = this.store.load();
      this.tasks = doc.tasks;
      this.pinned = doc.pinned;
      this.deleteAfterSend = doc.deleteAfterSend !== false;  // 缺省 true
      this.drawerOpen = this.pinned;
    };
    /** 切换"发送后删除"偏好（持久化）。 */
    BoardController.prototype.setDeleteAfterSend = function (v) {
      var next = !!v;
      if (this.deleteAfterSend === next) return;
      this.deleteAfterSend = next;
      this.notify();
    };
    BoardController.prototype.subscribe = function (fn) {
      this.listeners.add(fn);
      var self = this;
      return function () { self.listeners.delete(fn); };
    };
    BoardController.prototype.notify = function () {
      this.store.save({ tasks: this.tasks, pinned: this.pinned, deleteAfterSend: this.deleteAfterSend });
      var fns = Array.from(this.listeners);
      for (var i = 0; i < fns.length; i++) fns[i]();
    };
    BoardController.prototype.getSnapshot = function () {
      return {
        tasks: this.tasks.slice(),
        drawerOpen: this.drawerOpen,
        pinned: this.pinned,
        expandedId: this.expandedId,
        confirmSend: this.confirmSend,
        deleteAfterSend: this.deleteAfterSend
      };
    };
    BoardController.prototype.toggleDrawer = function () {
      this.drawerOpen = !this.drawerOpen;
      if (this.drawerOpen) this.expandedId = undefined;
      this.notify();
    };
    BoardController.prototype.closeDrawer = function () {
      if (!this.drawerOpen) return;
      this.drawerOpen = false;
      this.expandedId = undefined;
      this.confirmSend = undefined;
      this.notify();
    };
    BoardController.prototype.togglePin = function () {
      this.pinned = !this.pinned;
      this.drawerOpen = true;
      this.notify();
    };
    BoardController.prototype.expandTask = function (id) {
      this.expandedId = (this.expandedId === id) ? undefined : id;
      this.confirmDelete = false;
      this.confirmSend = undefined; // 切换展开时清掉其它卡片的 armed 态
      this.notify();
    };
    BoardController.prototype.collapseTask = function () {
      if (this.expandedId === undefined) return;
      this.expandedId = undefined;
      this.confirmDelete = false;
      this.confirmSend = undefined;
      this.notify();
    };
    BoardController.prototype.createTask = function (input) {
      var title = (input.title || "").trim();
      if (!title) return undefined;
      var now = Date.now();
      var task = {
        id: uuid(),
        title: title,
        description: (input.description || "").trim(),
        createdAt: now,
        updatedAt: now,
        order: now
      };
      this.tasks = [task].concat(this.tasks);
      this.expandedId = task.id;
      this.confirmDelete = false;
      this.confirmSend = undefined;
      this.notify();
      return task;
    };
    BoardController.prototype.updateTask = function (id, patch) {
      var now = Date.now();
      var changed = false;
      var self = this;
      this.tasks = this.tasks.map(function (t) {
        if (t.id !== id) return t;
        changed = true;
        var n = {};
        for (var k in t) if (Object.prototype.hasOwnProperty.call(t, k)) n[k] = t[k];
        for (var p in patch) if (Object.prototype.hasOwnProperty.call(patch, p)) n[p] = patch[p];
        n.updatedAt = now;
        if (typeof n.title === "string") n.title = n.title.trim();
        if (typeof n.description === "string") n.description = n.description.trim();
        return n;
      });
      if (changed) self.notify();
    };
    BoardController.prototype.deleteTask = function (id) {
      var before = this.tasks.length;
      this.tasks = this.tasks.filter(function (t) { return t.id !== id; });
      if (this.expandedId === id) this.expandedId = undefined;
      if (this.confirmSend === id) this.confirmSend = undefined;
      this.confirmDelete = false;
      if (this.tasks.length !== before) this.notify();
    };
    BoardController.prototype.requestDelete = function (id) {
      if (this.confirmDelete === id) {
        this.deleteTask(id);
      } else {
        this.confirmDelete = id;
        this.notify();
      }
    };
    BoardController.prototype.clearConfirmDelete = function () {
      if (this.confirmDelete === undefined) return;
      this.confirmDelete = false;
      this.notify();
    };
    /** 两阶段发送：第一次进入 armed；4 秒内再按一次才真发。 */
    BoardController.prototype.requestSend = function (id) {
      if (this.confirmSend === id) {
        this.sendTask(id);
        return;
      }
      this.confirmSend = id;
      this.confirmDelete = false;
      this.notify();
    };
    BoardController.prototype.clearConfirmSend = function () {
      if (this.confirmSend === undefined) return;
      this.confirmSend = undefined;
      this.notify();
    };
    /** 真发：通过 sessions.binding(current)?.session.driver.prompt 发到当前会话。 */
    BoardController.prototype.sendTask = function (id) {
      var self = this;
      var task = this.findTask(id);
      if (!task) return;
      var sessions = this.deps && this.deps.sessions;
      if (!sessions) {
        console.error("[dsh-task-pool] sessions service unavailable; cannot send");
        this.confirmSend = undefined;
        this.notify();
        return;
      }
      var listSnap = (typeof sessions.list.getSnapshot === "function") ? sessions.list.getSnapshot() : null;
      var currentId = listSnap ? listSnap.current : null;
      if (!currentId) {
        console.error("[dsh-task-pool] no current session; cannot send");
        this.confirmSend = undefined;
        this.notify();
        return;
      }
      var binding = (typeof sessions.binding === "function") ? sessions.binding(currentId) : null;
      var driver = binding && binding.session ? binding.session : null;
      if (!driver || typeof driver.prompt !== "function") {
        console.error("[dsh-task-pool] current session driver unavailable; cannot send");
        this.confirmSend = undefined;
        this.notify();
        return;
      }
      var text = task.title + (task.description ? "\n\n" + task.description : "");
      var promise;
      try {
        promise = driver.prompt([{ type: "text", text: text }], "queue");
      } catch (e) {
        console.error("[dsh-task-pool] driver.prompt threw:", e);
        this.confirmSend = undefined;
        this.notify();
        return;
      }
      if (promise && typeof promise.then === "function") {
        promise.then(
          function () {
            self.confirmSend = undefined;
            // 发送成功后根据设置决定是否删除
            if (self.deleteAfterSend) self.deleteTask(id);
            else self.notify();
          },
          function (err) {
            console.error("[dsh-task-pool] send failed:", err);
            self.confirmSend = undefined;
            self.notify();
          }
        );
      } else {
        this.confirmSend = undefined;
        if (this.deleteAfterSend) this.deleteTask(id);
        else this.notify();
      }
    };
    BoardController.prototype.findTask = function (id) {
      for (var i = 0; i < this.tasks.length; i++) if (this.tasks[i].id === id) return this.tasks[i];
      return undefined;
    };
    BoardController.prototype.reorder = function (id, targetId, position) {
      var tasks = this.tasks.slice();
      var fromIdx = -1;
      for (var i = 0; i < tasks.length; i++) if (tasks[i].id === id) { fromIdx = i; break; }
      if (fromIdx === -1) return;
      var moved = tasks.splice(fromIdx, 1)[0];
      if (targetId === null || targetId === undefined) {
        tasks.push(moved);
      } else {
        var targetIdx = -1;
        for (var j = 0; j < tasks.length; j++) if (tasks[j].id === targetId) { targetIdx = j; break; }
        if (targetIdx === -1) {
          tasks.push(moved);
        } else {
          var insertIdx = position === "before" ? targetIdx : targetIdx + 1;
          tasks.splice(insertIdx, 0, moved);
        }
      }
      this.tasks = tasks;
      this.notify();
    };

    // ===== FAB 图标（精确居中） =====
    var FAB_ICON_CLOSED = '<svg viewBox="0 0 16 16" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.25" y="3.25" width="9.5" height="9.5" rx="1.5"/><path d="M8 5.75v4.5M5.75 8h4.5"/></svg>';
    var FAB_ICON_OPEN = '<svg viewBox="0 0 16 16" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>';

    function mountFab(controller) {
      var fab = document.createElement("button");
      fab.type = "button";
      fab.dataset.dshTaskpoolFab = "";
      fab.className = "DTPD_fab";
      fab.setAttribute("aria-label", "任务池");

      function renderState() {
        var snap = controller.getSnapshot();
        if (snap.drawerOpen) {
          fab.dataset.state = "open";
          fab.innerHTML = FAB_ICON_OPEN;
        } else {
          fab.dataset.state = "closed";
          fab.innerHTML = FAB_ICON_CLOSED;
        }
        if (snap.pinned) fab.dataset.pinned = "true";
        else delete fab.dataset.pinned;
      }

      fab.addEventListener("click", function () { controller.toggleDrawer(); });

      var unsub = controller.subscribe(renderState);
      renderState();
      document.body.appendChild(fab);

      return function () {
        unsub();
        fab.remove();
      };
    }

    // ===== Right drawer mount =====
    function mountRightDrawer(controller) {
      var container, viewHandle;

      function ensure() {
        if (container) return;
        container = document.createElement("aside");
        container.dataset.dshTaskpoolDrawer = "";
        document.body.appendChild(container);
        viewHandle = renderDrawerView(container, controller);
      }

      // 枚举所有已知的 panel drawer attr；isOtherDrawerOpen 检查"还有没有别的 panel 抽屉打开"。
      // 新增面板时在这里加一行（保持原 panel attr 列表是协议的真实源）。
      var KNOWN_DRAWER_ATTRS = [
        "data-dsh-taskpool-drawer-open",
        "data-dsh-github-drawer-open",
        "data-dsh-ssh-active",
        "data-dsh-taskboard-active",
      ];
      function isOtherDrawerOpen(selfAttr) {
        for (var i = 0; i < KNOWN_DRAWER_ATTRS.length; i++) {
          if (KNOWN_DRAWER_ATTRS[i] === selfAttr) continue;
          if (document.documentElement.hasAttribute(KNOWN_DRAWER_ATTRS[i])) return true;
        }
        return false;
      }

      function applyOpen() {
        if (controller.getSnapshot().drawerOpen) {
          document.documentElement.removeAttribute("data-dsh-ssh-active");
          document.documentElement.removeAttribute("data-dsh-taskboard-active");
          document.documentElement.setAttribute(DRAWER_ATTR, "");
          // 设 CSS 变量 --active-drawer-width = 自己抽屉宽度（用于 FAB 让位公式）
          document.documentElement.style.setProperty("--active-drawer-width", DRAWER_WIDTH + "px");
          // 检查是否还有别的 panel 抽屉打开 → 没有才设统一 attr
          // （互斥协议下理论上此时不该有别的抽屉，但防御性检查避免重复设）
          if (!isOtherDrawerOpen(DRAWER_ATTR)) {
            document.documentElement.setAttribute(ANY_DRAWER_ATTR, "");
          }
          document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: PANEL_NAME }));
        } else {
          document.documentElement.removeAttribute(DRAWER_ATTR);
          // 关键修复 v0.5.6：检查是否还有别的 panel 抽屉打开（互斥协议 race condition）。
          // 场景：抽屉 A 打开 → 用户点 B → B applyOpen(open) 先设自己 attr + 移除 A attr，
          // dispatch event 触发 A applyOpen(close)。此时 B 抽屉仍开着，A 关闭分支必须
          // 不能移除统一 attr + CSS 变量——否则 FAB 让位状态会瞬间错乱。
          // 只有 isOtherDrawerOpen 为 false 时（即真的没有任何抽屉打开）才清理。
          if (!isOtherDrawerOpen(DRAWER_ATTR)) {
            document.documentElement.removeAttribute(ANY_DRAWER_ATTR);
            document.documentElement.style.removeProperty("--active-drawer-width");
          }
        }
      }
      function onOtherActivate(e) {
        if (!controller.getSnapshot().drawerOpen) return;
        if (e && e.detail && e.detail !== PANEL_NAME) controller.closeDrawer();
      }

      function onClickOutside(e) {
        if (!controller.getSnapshot().drawerOpen) return;
        var t = e.target;
        if (!t) return;
        if (container && container.contains(t)) return;
        if (t.closest && t.closest('[data-dsh-taskpool-fab]')) return;
        var SIDEBAR_ROW_SELECTOR = '[class*="sessionRow"], [class*="projectRow"], [class*="searchResultRow"], [class*="searchResultWorkspace"], [class*="newSession"]';
        if (t.closest && t.closest(SIDEBAR_ROW_SELECTOR)) {
          controller.closeDrawer();
        }
      }

      var waitObserver = new MutationObserver(ensure);
      waitObserver.observe(document.body, { childList: true, subtree: true });
      document.addEventListener("click", onClickOutside, true);
      document.addEventListener(ACTIVATE_EVENT, onOtherActivate);
      var unsub = controller.subscribe(applyOpen);
      applyOpen();
      ensure();

      return function () {
        document.removeEventListener("click", onClickOutside, true);
        document.removeEventListener(ACTIVATE_EVENT, onOtherActivate);
        waitObserver.disconnect();
        unsub();
        document.documentElement.removeAttribute(DRAWER_ATTR);
        if (viewHandle && viewHandle.dispose) viewHandle.dispose();
        if (container) { container.remove(); container = undefined; }
      };
    }

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
          '<input class="DTPD_newInput" type="text" placeholder="新建任务…回车保存" autocomplete="off" spellcheck="false" />' +
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
            controller.createTask({ title: v });
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
        var titleEl = document.createElement("div");
        titleEl.className = "DTPD_rowTitle";
        titleEl.textContent = task.title;
        main.appendChild(titleEl);
        if (task.description) {
          var desc = document.createElement("div");
          desc.className = "DTPD_rowDesc";
          desc.textContent = task.description;
          main.appendChild(desc);
        }
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

        var titleLabel = document.createElement("div");
        titleLabel.className = "DTPD_label";
        titleLabel.textContent = "标题";
        panel.appendChild(titleLabel);
        var titleInput = document.createElement("input");
        titleInput.type = "text";
        titleInput.className = "DTPD_input";
        titleInput.value = task.title;
        titleInput.addEventListener("change", function () { controller.updateTask(task.id, { title: titleInput.value }); });
        titleInput.addEventListener("keydown", function (e) {
          if (e.key === "Enter") { e.preventDefault(); titleInput.blur(); }
          if (e.key === "Escape") { e.preventDefault(); controller.collapseTask(); }
        });
        panel.appendChild(titleInput);

        var descLabel = document.createElement("div");
        descLabel.className = "DTPD_label";
        descLabel.textContent = "描述";
        panel.appendChild(descLabel);
        var descInput = document.createElement("textarea");
        descInput.className = "DTPD_textarea";
        descInput.rows = 4;
        descInput.placeholder = "补充背景、范围、验收（可选）";
        descInput.value = task.description;
        descInput.addEventListener("change", function () { controller.updateTask(task.id, { description: descInput.value }); });
        descInput.addEventListener("keydown", function (e) {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); descInput.blur(); }
        });
        panel.appendChild(descInput);

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
        sendBtn.textContent = isSendArmed ? "再点一次确认发送到对话（4）" : "📨 发送到当前对话";
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
          if (document.body.contains(titleInput)) {
            titleInput.focus();
            titleInput.select();
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
          sendBtn.textContent = "再点一次确认发送到对话（" + remaining + "）";
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

    // ===== apply =====
    function apply(ctx) {
      injectCSS();
      var controller = new BoardController(
        new LocalStorageTaskStore(),
        { sessions: ctx.sessions }
      );
      controller.start();
      try {
        mountFab(controller);
        mountRightDrawer(controller);
      } catch (e) {
        console.error("[dsh-task-pool] mount failed:", e);
      }
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.name = "dsh-task-pool";
    return module.exports;
  }
});