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
    /** 推单个仓库 */
    Controller.prototype.pushRepo = function (repoPath) {
      var self = this;
      // v0.1.7：hidden 仓库不让 push（用户语义："几乎等于不要碰"）
      if (this.hiddenPaths.has(repoPath)) {
        showToast("已隐藏,不允许推送。先取消隐藏再试。", "error");
        return Promise.resolve();
      }
      return apiFetch("/api/git-hub/repos/push", {
        method: "POST",
        body: { path: repoPath },
      }).then(function (data) {
        if (!data || !data.ok) throw new Error((data && data.error) || "push failed");
        showToast("已启动推送 PID=" + (data.pid || "?") + "（去终端看完整输出）", "info");
        self.lastPush = { startedAt: data.startedAt, pid: data.pid, exitCode: null, scope: "repo", repo: repoPath, running: true };
        self.notify();
        // v0.2.1 智能轮询：1.5s 后首次 pollPushStatus；pollPushStatus 见 running=true
        // 会自动 startPushPoll；之后每 POLL_INTERVAL_MS 自动续跑直到 exitCode 出现。
        setTimeout(function () { self.pollPushStatus(); }, 1500);
      }).catch(function (e) {
        showToast("推送失败：" + (e && e.message ? e.message : e), "error");
      });
    };
    /**
     * 全部推送：v0.1.7 重写为"循环调 pushRepo 跳过 hidden"
     *  - 原因：host half 的 /api/git-hub/push-all 是调 daily-push.cjs --all，
     *    会扫描本机多盘所有 .git 仓库（包括 hidden）；
     *    但 hidden 用户语义是"几乎等于不要碰"，不能被 daily-push 扫到推送
     *  - 实现：client 端过滤 hidden，只对 visible repos 逐个 spawn daily-push.cjs --repo
     *  - 状态条：依次启动，pollPushStatus 显示"全部推送运行中 X 个"
     */
    Controller.prototype.pushAll = function () {
      var self = this;
      var visibleRepos = this.repos.filter(function (r) {
        return !self.hiddenPaths.has(r.path);
      });
      var skippedCount = this.repos.length - visibleRepos.length;
      if (visibleRepos.length === 0) {
        showToast("所有仓库都已隐藏，无可推送项", "error");
        return Promise.resolve();
      }
      if (skippedCount > 0) {
        showToast("已跳过 " + skippedCount + " 个隐藏仓库，依次推送 " + visibleRepos.length + " 个", "info");
      }
      // 串行启动推送（避免 N 个 daily-push.cjs 同时跑对 git 锁造成压力）
      var i = 0;
      function next() {
        if (i >= visibleRepos.length) return;
        var repo = visibleRepos[i++];
        // pushRepo 内部会 spawn + 更新 lastPush；不阻塞
        self.pushRepo(repo.path);
        // 每个推送间隔 800ms 启动（避免瞬时 N 个 detached 子进程）
        setTimeout(next, 800);
      }
      next();
    };
    /**
     * v0.2.1 智能轮询：单次拉 push-status，根据返回结果决定启/停轮询 timer
     *  - 仅在有推送运行时持续轮询（每 POLL_INTERVAL_MS 一次）
     *  - 推送结束（exitCode != null）或后端无 push 记录 → 停轮询
     *  - 抽屉关闭时由 toggleDrawer 调 stopPushPoll 兜底
     *  - 网络瞬时错误保持轮询状态（避免误判为结束）
     *  - 由 pushRepo 的 setTimeout 1500ms 首次触发；之后由 setInterval 续跑
     */
    Controller.prototype.pollPushStatus = function () {
      var self = this;
      if (!self.drawerOpen) return;
      apiFetch("/api/git-hub/push-status").then(function (data) {
        if (data && data.ok && data.lastPush && data.lastPush.startedAt) {
          self.lastPush = data.lastPush;
          self.notify();
          if (self.lastPush.running) {
            // 推送仍在跑 → 确保 timer 启动（幂等）
            self.startPushPoll();
          } else {
            // 已结束（exitCode 已设）→ 停轮询
            self.stopPushPoll();
          }
        } else {
          // 后端无 push 记录（清空 / 重启后）→ 停轮询
          self.stopPushPoll();
        }
      }).catch(function () {
        // 网络瞬时错误：保持当前 timer 状态，下次再判断
      });
    };
    /** 启动 push-status 轮询 timer（幂等：已在跑则忽略） */
    Controller.prototype.startPushPoll = function () {
      if (this._pushPollTimer) return;
      var self = this;
      this._pushPollTimer = setInterval(function () { self.pollPushStatus(); }, POLL_INTERVAL_MS);
    };
    /** 停止 push-status 轮询 timer（幂等：未在跑则忽略） */
    Controller.prototype.stopPushPoll = function () {
      if (this._pushPollTimer) {
        clearInterval(this._pushPollTimer);
        this._pushPollTimer = null;
      }
    };
    /** v0.2.2：拉所有有改动的 git 仓库（branch + 文件名列表） */
    Controller.prototype.loadCommitStatus = function () {
      var self = this;
      return apiFetch("/api/git-hub/commit-status").then(function (data) {
        if (data && data.ok) {
          self.commitRepos = Array.isArray(data.repos) ? data.repos : [];
          self.notify();
        }
      }).catch(function (e) {
        console.warn("[dsh-git-hub] loadCommitStatus failed:", e);
      });
    };
    /** v0.2.2：手动 commit 指定仓库（git add -A + git commit -m <message>） */
    Controller.prototype.commit = function (repoPath, message) {
      var self = this;
      var msg = (message || "").trim();
      if (!msg) {
        showToast("请输入 commit message", "error");
        return Promise.resolve();
      }
      if (msg.indexOf("\n") >= 0) {
        showToast("message 不支持多行（先用单行，未来可加）", "error");
        return Promise.resolve();
      }
      if (!repoPath) {
        showToast("内部错误：缺仓库路径", "error");
        return Promise.resolve();
      }
      this.commitBusy = true;
      this.notify();
      return apiFetch("/api/git-hub/commit", {
        method: "POST",
        body: { cwd: repoPath, message: msg },
      }).then(function (data) {
        if (!data || !data.ok) {
          var errKey = data && data.error;
          var hint;
          if (errKey === "no-changes") hint = "工作区没有改动，无需 commit";
          else if (errKey === "empty-message") hint = "message 不能为空";
          else if (errKey === "multiline-not-supported") hint = "message 不支持多行";
          else if (errKey === "commit-failed") hint = "commit 失败（看 stderr）";
          else if (errKey === "cwd-not-found") hint = "找不到仓库目录 " + (data.cwd || "");
          else hint = "commit 失败：" + (errKey || "未知错误");
          showToast(hint, "error");
          if (data && data.stderr) console.warn("[dsh-git-hub] commit stderr:", data.stderr);
          return;
        }
        // 仓库名（basename）让 toast 更易读
        var repoName = (data.cwd || "").split(/[\\/]/).pop() || "?";
        showToast(repoName + " 已 commit " + data.sha + "（" + data.filesChanged + " 个文件）", "info");
        // 刷新 commit 状态 + 仓库列表
        return self.loadCommitStatus().then(function () { return self.refresh(true); });
      }).catch(function (e) {
        showToast("commit 失败：" + (e && e.message ? e.message : e), "error");
      }).then(function () {
        self.commitBusy = false;
        self.notify();
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

