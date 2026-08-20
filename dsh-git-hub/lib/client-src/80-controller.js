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
      this.selectionMode = false;  // v0.1.7：隐藏选择模式（点卡片 = toggleHide）
      this.showHidden = false;     // v0.1.7：仅 selectionMode 内有效（模式内展开被隐藏项查看）
      this.lastPush = null;        // 最近推送状态
      this.commitRepos = [];       // v0.2.2：所有 scanRoots 下有改动的 git 仓库 [{ path, name, branch, files, filesChanged, lastCommit }]
      this.commitBusy = false;     // v0.2.2：commit 操作进行中（按钮 disabled + 文字改 "提交中…"）
      this.mergeRepos = [];        // v0.3.0：可合并/拉取的仓库 [{ path, name, branches, current, upstream, mergeInProgress, rebaseInProgress }]
      this.mergeBusy = null;       // v0.3.0：当前 merge/pull 操作的目标 repo path 或 null（按钮 disabled 用）
      this.lastMergeResult = null; // v0.3.0：最近一次操作结果，{ repo, op, ok, status?, error?, conflicts? }
      this.listeners = new Set();
      var doc = this.store.load();
      this.pinnedPaths = new Set(doc.pinnedPaths);
      this.hiddenPaths = new Set(doc.hiddenPaths);
      // v0.5.0：sections 对象替代 v0.4.0 的 commitSectionVisible 字段
      // defaultSections() 在 70-storage.js 定义（同 factory scope 可访问）
      this.sections = (doc.sections && typeof doc.sections === "object") ? doc.sections : defaultSections();
      // v0.5.0：options 下拉菜单开关（不持久化——纯 UI 临时态，跟 selectionMode 一致）
      this.optionsOpen = false;
      this.drawerOpen = false;
    }
    Controller.prototype._persist = function () {
      this.store.save({
        pinnedPaths: Array.from(this.pinnedPaths),
        hiddenPaths: Array.from(this.hiddenPaths),
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
        commitRepos: this.commitRepos,      // v0.2.2
        commitBusy: this.commitBusy,        // v0.2.2
        mergeRepos: this.mergeRepos,        // v0.3.0
        mergeBusy: this.mergeBusy,          // v0.3.0
        lastMergeResult: this.lastMergeResult, // v0.3.0
        commitSectionVisible: this.sections.commit, // v0.5.0：保留旧字段名作为快照别名（v0.4.0 兼容；view 已切到 sections）
        sections: this.sections,                     // v0.5.0：统一管理 4 个功能区可见性
        pinnedPaths: Array.from(this.pinnedPaths),
        hiddenPaths: Array.from(this.hiddenPaths),
        optionsOpen: this.optionsOpen,               // v0.5.0：options 下拉菜单开关（不持久化）
        drawerOpen: this.drawerOpen,
      };
    };
    Controller.prototype.toggleDrawer = function () {
      this.drawerOpen = !this.drawerOpen;
      if (this.drawerOpen) {
        // 抽屉打开：拉数据 + 探测推送状态（v0.2.1 智能轮询：
        // pollPushStatus 内部若发现 push 仍在跑，会自动 startPushPoll）
        this.refresh(false);
        this.pollPushStatus();
        this.loadCommitStatus(); // v0.2.2：刷新 commit 工具行的 branch + 改动数
        this.loadMergeStatus(); // v0.3.0：刷新 merge/pull/abort 工具区
      } else {
        // 抽屉关闭：v0.2.1 智能轮询，停掉所有 push 轮询 timer
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
      // 进入模式时默认收起（用户进入模式是为了隐藏，不是为了展开）
      // 退出模式时也收起，避免下次进入时显示残留
      this.showHidden = false;
      this.notify();
    };
    /** v0.5.0：toggle options 下拉菜单（不持久化，纯 UI 临时态） */
    Controller.prototype.toggleOptions = function () {
      this.optionsOpen = !this.optionsOpen;
      this.notify();
    };
    /** v0.5.0：关闭 options 下拉菜单（用于 Esc / 点菜单外） */
    Controller.prototype.closeOptions = function () {
      if (!this.optionsOpen) return;
      this.optionsOpen = false;
      this.notify();
    };
    Controller.prototype.setError = function (msg) {
      this.error = msg;
      this.notify();
    };
    /** v0.5.0：切换指定 section 的可见性（持久化）。key ∈ {commit, merge, pushStatus, perCardPush} */
    Controller.prototype.toggleSection = function (key) {
      var allowed = ["commit", "merge", "pushStatus", "perCardPush"];
      if (allowed.indexOf(key) < 0) return;
      // 严格 true/false 切换；缺字段视为默认（false for commit；true for others）
      var cur = this.sections[key];
      var next;
      if (key === "commit") next = cur !== true;
      else next = cur !== true; // 与上面同义；语义：当前非 true 时设为 true，反之设为 false
      this.sections[key] = next;
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
        // v0.2.2：刷新仓库列表时同步刷 commit 状态（commit / push 后 unpushed 变化）
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
        // config 改了 → 重扫
        self.closeConfigPanel();
        return self.refresh(true);
      });
    };

    /* ===== v0.3.0 merge / pull / abort ===== */

    /** 拉所有可合并/拉取的仓库（≥2 本地分支 / 有 upstream / 冲突中） */
    Controller.prototype.loadMergeStatus = function () {
      var self = this;
      return apiFetch("/api/git-hub/repos/merge-status").then(function (data) {
        if (data && data.ok) {
          self.mergeRepos = Array.isArray(data.repos) ? data.repos : [];
          self.notify();
        }
      }).catch(function (e) {
        console.warn("[dsh-git-hub] loadMergeStatus failed:", e);
      });
    };

    /**
     * 把 <source> 分支 merge 进当前分支（source 默认 = 选中的非当前分支）。
     * noFF = true → 强制 merge commit（不 fast-forward），保留分支痕迹
     */
    Controller.prototype.mergeRepo = function (repoPath, source, noFF) {
      var self = this;
      if (!repoPath || !source) {
        showToast("内部错误：缺仓库路径或源分支", "error");
        return Promise.resolve();
      }
      if (source === "__none__") {
        showToast("请选择一个源分支", "error");
        return Promise.resolve();
      }
      this.mergeBusy = repoPath;
      this.lastMergeResult = null;
      this.notify();
      return apiFetch("/api/git-hub/repos/merge", {
        method: "POST",
        body: { path: repoPath, source: source, noFF: !!noFF },
      }).then(function (data) {
        if (!data || !data.ok) {
          var errKey = data && data.error;
          var hint;
          if (errKey === "merge-in-progress") hint = data.hint || "已有未完成的合并";
          else if (errKey === "dirty-worktree") hint = data.hint || "工作区有未提交改动";
          else if (errKey === "invalid-source") hint = data.hint || "找不到分支";
          else if (errKey === "conflict") hint = "合并冲突：" + (data.conflicts || []).join(", ") + "（点 abort 终止）";
          else if (errKey === "merge-failed") hint = "merge 失败（看 stderr）";
          else hint = "merge 失败：" + (errKey || "未知错误");
          showToast(hint, "error");
          if (data && data.stderr) console.warn("[dsh-git-hub] merge stderr:", data.stderr);
          self.lastMergeResult = { repo: repoPath, op: "merge", ok: false, error: errKey, conflicts: data.conflicts || [], stderr: data.stderr };
          return;
        }
        var repoName = repoPath.split(/[\\/]/).pop() || "?";
        var msg;
        if (data.status === "fast-forward") msg = repoName + " 已 fast-forward " + data.headBefore + " → " + data.headAfter;
        else if (data.status === "merged") msg = repoName + " 已 merge（" + data.headAfter + "）";
        else if (data.status === "already-up-to-date") msg = repoName + " 已是最新，无需 merge";
        else msg = repoName + " merge 完成";
        showToast(msg, "info");
        self.lastMergeResult = { repo: repoPath, op: "merge", ok: true, status: data.status, headBefore: data.headBefore, headAfter: data.headAfter };
      }).catch(function (e) {
        showToast("merge 失败：" + (e && e.message ? e.message : e), "error");
      }).then(function () {
        self.mergeBusy = null;
        // 重新拉 merge 状态（HEAD 变了 + 可能产生新分支）+ 仓库列表（branch / upstream）
        return self.loadMergeStatus().then(function () { return self.refresh(true); });
      }).then(function () {
        self.notify();
      });
    };

    /**
     * 拉上游（git pull [--rebase]）。rebase=false → 默认 merge 模式；
     * 冲突时不动合并状态，让用户决定 abort / 解决。
     */
    Controller.prototype.pullRepo = function (repoPath, rebase) {
      var self = this;
      if (!repoPath) {
        showToast("内部错误：缺仓库路径", "error");
        return Promise.resolve();
      }
      this.mergeBusy = repoPath;
      this.lastMergeResult = null;
      this.notify();
      return apiFetch("/api/git-hub/repos/pull", {
        method: "POST",
        body: { path: repoPath, rebase: !!rebase },
      }).then(function (data) {
        if (!data || !data.ok) {
          var errKey = data && data.error;
          var hint;
          if (errKey === "merge-in-progress") hint = data.hint || "已有未完成的合并";
          else if (errKey === "rebase-in-progress") hint = data.hint || "已有未完成的变基";
          else if (errKey === "dirty-worktree") hint = data.hint || "工作区有未提交改动";
          else if (errKey === "no-upstream") hint = data.hint || "当前分支没有 upstream";
          else if (errKey === "conflict") hint = (data.conflictType || "merge") + " 冲突：" + (data.conflicts || []).join(", ") + "（点 abort 终止）";
          else if (errKey === "pull-failed") hint = "pull 失败（看 stderr）";
          else hint = "pull 失败：" + (errKey || "未知错误");
          showToast(hint, "error");
          if (data && data.stderr) console.warn("[dsh-git-hub] pull stderr:", data.stderr);
          self.lastMergeResult = { repo: repoPath, op: "pull", ok: false, error: errKey, conflicts: data.conflicts || [], stderr: data.stderr, conflictType: data.conflictType };
          return;
        }
        var repoName = repoPath.split(/[\\/]/).pop() || "?";
        var msg;
        if (data.status === "already-up-to-date") msg = repoName + " 已是最新，无需 pull";
        else if (data.status === "rebased") msg = repoName + " 已 rebase " + data.headBefore + " → " + data.headAfter;
        else if (data.status === "merged") msg = repoName + " 已 pull " + data.headBefore + " → " + data.headAfter;
        else msg = repoName + " pull 完成";
        showToast(msg, "info");
        self.lastMergeResult = { repo: repoPath, op: "pull", ok: true, status: data.status, headBefore: data.headBefore, headAfter: data.headAfter };
      }).catch(function (e) {
        showToast("pull 失败：" + (e && e.message ? e.message : e), "error");
      }).then(function () {
        self.mergeBusy = null;
        return self.loadMergeStatus().then(function () { return self.refresh(true); });
      }).then(function () {
        self.notify();
      });
    };

    /** Abort merge 或 rebase（取决于当前冲突态） */
    Controller.prototype.abortMerge = function (repoPath) {
      var self = this;
      if (!repoPath) {
        showToast("内部错误：缺仓库路径", "error");
        return Promise.resolve();
      }
      this.mergeBusy = repoPath;
      this.notify();
      return apiFetch("/api/git-hub/repos/merge-abort", {
        method: "POST",
        body: { path: repoPath },
      }).then(function (data) {
        if (!data || !data.ok) {
          var errKey = data && data.error;
          var hint;
          if (errKey === "nothing-to-abort") hint = data.hint || "当前没有进行中的合并/变基";
          else if (errKey === "abort-failed") hint = "abort 失败（看 stderr）";
          else hint = "abort 失败：" + (errKey || "未知错误");
          showToast(hint, "error");
          if (data && data.stderr) console.warn("[dsh-git-hub] abort stderr:", data.stderr);
          return;
        }
        var repoName = repoPath.split(/[\\/]/).pop() || "?";
        showToast(repoName + " 已 abort " + (data.aborted === "rebase" ? "rebase" : "merge"), "info");
      }).catch(function (e) {
        showToast("abort 失败：" + (e && e.message ? e.message : e), "error");
      }).then(function () {
        self.mergeBusy = null;
        return self.loadMergeStatus().then(function () { return self.refresh(true); });
      }).then(function () {
        self.notify();
      });
    };

    /** 把仓库摘要发到当前会话（让 agent 调 mcp__github__） */
    Controller.prototype.sendRepoToSession = function (repo) {
      var self = this;
      return sendRepoSummaryToSession(self.deps.sessions, repo).then(function () {
        showToast("已发送到当前对话", "info");
      }).catch(function (e) {
        showToast("发送失败：" + (e && e.message ? e.message : e), "error");
      });
    };