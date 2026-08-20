    // ===== controller =====
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
      var content = (input.content || "").trim();
      if (!content) return undefined;
      var now = Date.now();
      var task = {
        id: uuid(),
        content: content,
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
        if (typeof n.content === "string") n.content = n.content.trim();
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
      var text = task.content;
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

