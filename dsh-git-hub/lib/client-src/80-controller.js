    // ===== Controller =====
    function Controller(store, deps) {
      this.store = store;
      this.deps = deps || {};
      this.config = null;          // { scanRoots, toolPath, toolAvailable }
      this.repos = [];
      this.cachedAt = 0;
      this.loading = false;
      this.error = null;
      this.configPanelOpen = false;
      this.selectionMode = false;  // 隐藏选择模式（点卡片 = toggleHide）
      this.showHidden = false;     // 仅 selectionMode 内有效（模式内展开被隐藏项查看）
      this.lastPush = null;        // 最近推送状态
      this.commitRepos = [];       // 所有 scanRoots 下有改动的 git 仓库
      this.commitBusy = false;     // commit 操作进行中（按钮 disabled + 文字改 "提交中…"）
      this.mergeRepos = [];        // 可合并/拉取的仓库
      this.mergeBusy = null;       // 当前 merge/pull 操作的目标 repo path 或 null
      this.lastMergeResult = null; // 最近一次 merge/pull/abort 结果
      this.listeners = new Set();
      var doc = this.store.load();
      this.pinnedPaths = new Set(doc.pinnedPaths);
      this.hiddenPaths = new Set(doc.hiddenPaths);
      // sections（4 个功能区可见性开关）；defaultSections() 在 70-storage.js 定义（同 factory scope）
      this.sections = (doc.sections && typeof doc.sections === "object") ? doc.sections : defaultSections();
      // options 下拉菜单开关（不持久化——纯 UI 临时态，跟 selectionMode 一致）
      this.optionsOpen = false;
      this.drawerOpen = false;
    }
    Controller.prototype._persist = function () {
      this.store.save({
        pinnedPaths: this.pinnedPaths,       // [perf] 直接暴露 Set，省 Array.from 让 renderer 用 .has
        hiddenPaths: this.hiddenPaths,
        sections: this.sections,
      });
    };
    Controller.prototype.subscribe = function (fn) {
      this.listeners.add(fn);
      var self = this;
      return function () { self.listeners.delete(fn); };
    };
    Controller.prototype.notify = function () {
      var fns = Array.from(this.listeners);
      for (var i = 0; i < fns.length; i++) fns[i]();
    };
    Controller.prototype.getSnapshot = function () {
      return {
        config: this.config,
        repos: this.repos,
        cachedAt: this.cachedAt,
        loading: this.loading,
        error: this.error,
        configPanelOpen: this.configPanelOpen,
        selectionMode: this.selectionMode,
        showHidden: this.showHidden,
        lastPush: this.lastPush,
        commitRepos: this.commitRepos,
        commitBusy: this.commitBusy,
        mergeRepos: this.mergeRepos,
        mergeBusy: this.mergeBusy,
        lastMergeResult: this.lastMergeResult,
        sections: this.sections,
        pinnedPaths: this.pinnedPaths,       // [perf] 直接暴露 Set，省 Array.from 让 renderer 用 .has
        hiddenPaths: this.hiddenPaths,
        optionsOpen: this.optionsOpen,
        drawerOpen: this.drawerOpen,
      };
    };
    Controller.prototype.toggleDrawer = function () {
      this.drawerOpen = !this.drawerOpen;
      if (this.drawerOpen) {
        // 抽屉打开：拉数据 + 探测推送状态（智能轮询：pollPushStatus 内部若发现 push 仍在跑，
        // 会自动 startPushPoll 持续轮询；推送结束自动停）
        this.refresh(false);
        this.pollPushStatus();
        this.loadCommitStatus(); // 刷新 commit 工具行的 branch + 改动数
        this.loadMergeStatus();  // 刷新 merge/pull/abort 工具区
      } else {
        // 抽屉关闭：停掉所有 push 轮询 timer（智能轮询在抽屉关闭时兜底停）
        this.stopPushPoll();
      }
      this.notify();
    };
    Controller.prototype.closeDrawer = function () {
      if (!this.drawerOpen) return;
      this.drawerOpen = false;
      this.notify();
    };
    Controller.prototype.openConfigPanel = function () {
      this.configPanelOpen = true;
      this.notify();
    };
    Controller.prototype.closeConfigPanel = function () {
      this.configPanelOpen = false;
      this.notify();
    };
    Controller.prototype.togglePin = function (repoPath) {
      if (this.pinnedPaths.has(repoPath)) this.pinnedPaths.delete(repoPath);
      else this.pinnedPaths.add(repoPath);
      this._persist();
      this.notify();
    };
    Controller.prototype.toggleHide = function (repoPath) {
      if (this.hiddenPaths.has(repoPath)) this.hiddenPaths.delete(repoPath);
      else this.hiddenPaths.add(repoPath);
      this._persist();
      this.notify();
    };
    Controller.prototype.setShowHidden = function (v) {
      this.showHidden = !!v;
      this.notify();
    };
    Controller.prototype.setSelectionMode = function (v) {
      var next = !!v;
      if (this.selectionMode === next) return;
      this.selectionMode = next;
      // 进入模式默认收起（用户进入模式是为了隐藏，不是为了展开），
      // 退出模式也收起，避免下次进入时显示残留
      this.showHidden = false;
      this.notify();
    };
    /** toggle options 下拉菜单（不持久化，纯 UI 临时态） */
    Controller.prototype.toggleOptions = function () {
      this.optionsOpen = !this.optionsOpen;
      this.notify();
    };
    /** 关闭 options 下拉菜单（用于 Esc / 点菜单外） */
    Controller.prototype.closeOptions = function () {
      if (!this.optionsOpen) return;
      this.optionsOpen = false;
      this.notify();
    };
    Controller.prototype.setError = function (msg) {
      this.error = msg;
      this.notify();
    };
    /** 切换指定 section 的可见性（持久化）。key ∈ {commit, merge, pushStatus, perCardPush} */
    Controller.prototype.toggleSection = function (key) {
      var allowed = ["commit", "merge", "pushStatus", "perCardPush"];
      if (allowed.indexOf(key) < 0) return;
      // 严格 true/false 切换；defaultSections() 已保证 4 个 key 都是 boolean，
      // 此处无需 fallback 处理 undefined（storage.load 已显式迁移）。
      this.sections[key] = this.sections[key] !== true;
      this._persist();
      this.notify();
    };
    Controller.prototype.setLoading = function (v) {
      this.loading = !!v;
      this.notify();
    };
    /** 拉仓库列表。force=true 调 /refresh 清缓存；false 走 /repos（5s 缓存） */
    Controller.prototype.refresh = function (force) {
      var self = this;
      this.setLoading(true);
      var endpoint = force ? "/api/git-hub/repos/refresh" : "/api/git-hub/repos";
      var p = force
        ? apiFetch(endpoint, { method: "POST" })
        : apiFetch(endpoint);
      return p.then(function (data) {
        if (!data || !data.ok) {
          self.setError((data && data.error) || "未知错误");
          return;
        }
        self.repos = Array.isArray(data.repos) ? data.repos : [];
        self.cachedAt = data.cachedAt || Date.now();
        self.error = null;
      }).catch(function (e) {
        self.setError(e && e.message ? e.message : String(e));
      }).then(function () {
        self.setLoading(false);
        // 刷新仓库列表时同步刷 commit 状态（commit / push 后 unpushed 变化）
        return self.loadCommitStatus();
      });
    };
    /** 拉 config（含 toolAvailable） */
    Controller.prototype.loadConfig = function () {
      var self = this;
      return apiFetch("/api/git-hub/config").then(function (data) {
        if (data && data.ok) {
          self.config = data;
          self.notify();
        }
      }).catch(function (e) {
        console.warn("[dsh-git-hub] loadConfig failed:", e);
      });
    };
    /** 保存 config（用户改完扫描根） */
    Controller.prototype.saveConfig = function (scanRootsArr) {
      var self = this;
      return apiFetch("/api/git-hub/config", {
        method: "POST",
        body: { scanRoots: scanRootsArr },
      }).then(function (data) {
        if (!data || !data.ok) throw new Error((data && data.error) || "save failed");
        self.closeConfigPanel();
        return self.refresh(true);
      });
    };
