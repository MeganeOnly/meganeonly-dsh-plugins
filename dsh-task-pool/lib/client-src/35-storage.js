    // ===== storage =====
    // ===== LocalStorageTaskStore =====
    function isTaskShape(v) {
      if (typeof v !== "object" || v === null) return false;
      if (typeof v.id !== "string" || v.id === "") return false;
      if (typeof v.content !== "string") return false;
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
        // 旧数据迁移：title + description 合并成 content
        if (isTaskShape(parsed.tasks[i])) {
          tasks.push(parsed.tasks[i]);
        } else {
          var legacy = parsed.tasks[i];
          if (typeof legacy === "object" && legacy !== null
              && typeof legacy.id === "string" && legacy.id !== ""
              && typeof legacy.title === "string"
              && typeof legacy.createdAt === "number"
              && typeof legacy.updatedAt === "number") {
            var content = legacy.title;
            if (typeof legacy.description === "string" && legacy.description) {
              content = content + "\n\n" + legacy.description;
            }
            tasks.push({
              id: legacy.id,
              content: content,
              createdAt: legacy.createdAt,
              updatedAt: legacy.updatedAt,
              order: typeof legacy.order === "number" ? legacy.order : legacy.createdAt
            });
          } else {
            console.warn("[dsh-task-pool] dropping invalid task row", parsed.tasks[i]);
          }
        }
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

