    // ===== LocalStorageStore（钉住/隐藏/commit 区可见性） =====
    function LocalStorageStore() {
      var storage;
      try {
        var probe = "__dsh_github_probe__";
        globalThis.localStorage.setItem(probe, probe);
        globalThis.localStorage.removeItem(probe);
        storage = globalThis.localStorage;
      } catch (e) {
        console.warn("[dsh-git-hub] localStorage unavailable, in-memory only");
        storage = undefined;
      }
      this.storage = storage;
    }
    LocalStorageStore.prototype.load = function () {
      if (!this.storage) return { pinnedPaths: [], hiddenPaths: [], commitSectionVisible: false };
      try {
        var raw = this.storage.getItem(STORAGE_KEY);
        if (!raw) return { pinnedPaths: [], hiddenPaths: [], commitSectionVisible: false };
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return { pinnedPaths: [], hiddenPaths: [], commitSectionVisible: false };
        var pinned = Array.isArray(parsed.pinnedPaths) ? parsed.pinnedPaths.filter(function (p) { return typeof p === "string"; }) : [];
        // v1 → v2 隐式迁移：旧文档无 hiddenPaths，默认空数组
        var hidden = Array.isArray(parsed.hiddenPaths) ? parsed.hiddenPaths.filter(function (p) { return typeof p === "string"; }) : [];
        // v2 → v3 隐式迁移：旧文档无 commitSectionVisible，默认 false（v0.4.0 起的用户偏好默认）
        // 缺字段 → false，意图：「我感覺我用不上」= 默认隐藏，需要时再点开
        var commitSectionVisible = typeof parsed.commitSectionVisible === "boolean" ? parsed.commitSectionVisible : false;
        return { pinnedPaths: pinned, hiddenPaths: hidden, commitSectionVisible: commitSectionVisible };
      } catch (e) {
        console.error("[dsh-git-hub] load failed; starting empty", e);
        return { pinnedPaths: [], hiddenPaths: [], commitSectionVisible: false };
      }
    };
    LocalStorageStore.prototype.save = function (doc) {
      if (!this.storage) return;
      try {
        this.storage.setItem(STORAGE_KEY, JSON.stringify({
          pinnedPaths: Array.isArray(doc.pinnedPaths) ? doc.pinnedPaths : [],
          hiddenPaths: Array.isArray(doc.hiddenPaths) ? doc.hiddenPaths : [],
          // v0.4.0：commit 工具区可见性开关持久化
          commitSectionVisible: typeof doc.commitSectionVisible === "boolean" ? doc.commitSectionVisible : false,
        }));
      } catch (e) {
        console.error("[dsh-git-hub] save failed", e);
      }
    };

