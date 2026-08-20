    // ===== LocalStorageStore（钉住/隐藏/sections 可见性） =====
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
      if (!this.storage) return { pinnedPaths: [], hiddenPaths: [], sections: defaultSections() };
      try {
        var raw = this.storage.getItem(STORAGE_KEY);
        if (!raw) return { pinnedPaths: [], hiddenPaths: [], sections: defaultSections() };
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return { pinnedPaths: [], hiddenPaths: [], sections: defaultSections() };
        var pinned = Array.isArray(parsed.pinnedPaths) ? parsed.pinnedPaths.filter(function (p) { return typeof p === "string"; }) : [];
        // v1 → v2 隐式迁移：旧文档无 hiddenPaths，默认空数组
        var hidden = Array.isArray(parsed.hiddenPaths) ? parsed.hiddenPaths.filter(function (p) { return typeof p === "string"; }) : [];
        // v2/v3 → v4 隐式迁移：旧文档无 sections 字段——v4 schema 是 sections 对象
        // 兼容路径：v3 文档里 commitSectionVisible 映射到 sections.commit（保留 v0.4.0 默认隐藏语义）
        var sections = defaultSections();
        if (parsed.sections && typeof parsed.sections === "object") {
          if (typeof parsed.sections.commit === "boolean") sections.commit = parsed.sections.commit;
          if (typeof parsed.sections.merge === "boolean") sections.merge = parsed.sections.merge;
          if (typeof parsed.sections.pushStatus === "boolean") sections.pushStatus = parsed.sections.pushStatus;
          if (typeof parsed.sections.perCardPush === "boolean") sections.perCardPush = parsed.sections.perCardPush;
        } else if (typeof parsed.commitSectionVisible === "boolean") {
          // v3 兼容：旧字段映射到 sections.commit，其他三个保持默认 true
          sections.commit = parsed.commitSectionVisible;
        }
        return { pinnedPaths: pinned, hiddenPaths: hidden, sections: sections };
      } catch (e) {
        console.error("[dsh-git-hub] load failed; starting empty", e);
        return { pinnedPaths: [], hiddenPaths: [], sections: defaultSections() };
      }
    };
    LocalStorageStore.prototype.save = function (doc) {
      if (!this.storage) return;
      try {
        // v0.5.0：sections 对象替代 v0.4.0 的 commitSectionVisible 字段
        // 缺字段时每个开关取对应默认值（commit=false；其他三个=true）
        var inSections = (doc.sections && typeof doc.sections === "object") ? doc.sections : {};
        var sections = {
          commit: typeof inSections.commit === "boolean" ? inSections.commit : false,
          merge: typeof inSections.merge === "boolean" ? inSections.merge : true,
          pushStatus: typeof inSections.pushStatus === "boolean" ? inSections.pushStatus : true,
          perCardPush: typeof inSections.perCardPush === "boolean" ? inSections.perCardPush : true,
        };
        this.storage.setItem(STORAGE_KEY, JSON.stringify({
          pinnedPaths: Array.isArray(doc.pinnedPaths) ? doc.pinnedPaths : [],
          hiddenPaths: Array.isArray(doc.hiddenPaths) ? doc.hiddenPaths : [],
          sections: sections,
        }));
      } catch (e) {
        console.error("[dsh-git-hub] save failed", e);
      }
    };

    /** v0.5.0：sections 默认状态。commit 沿用 v0.4.0 用户偏好（默认隐藏），其他三个默认显示。 */
    function defaultSections() {
      return { commit: false, merge: true, pushStatus: true, perCardPush: true };
    }

