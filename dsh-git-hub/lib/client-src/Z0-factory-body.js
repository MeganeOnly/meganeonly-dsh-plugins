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
      this.drawerOpen = false;
    }
    Controller.prototype._persist = function () {
      this.store.save({
        pinnedPaths: Array.from(this.pinnedPaths),
        hiddenPaths: Array.from(this.hiddenPaths),
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
        pinnedPaths: Array.from(this.pinnedPaths),
        hiddenPaths: Array.from(this.hiddenPaths),
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
    Controller.prototype.setError = function (msg) {
      this.error = msg;
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
     *    会扫描 F:\AllWorkSpace + E:\ 所有本地 .git 仓库（包括 hidden）；
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

    // ===== FAB =====
    var FAB_ICON_CLOSED = '<svg viewBox="0 0 16 16" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 5.5v5M5.5 8h5"/></svg>';
    var FAB_ICON_OPEN = '<svg viewBox="0 0 16 16" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>';

    function mountFab(controller) {
      var fab = document.createElement("button");
      fab.type = "button";
      fab.dataset.dshGithubFab = "";
      fab.className = "DGH_fab";
      fab.setAttribute("aria-label", "Git/GitHub 管理");

      function render() {
        var snap = controller.getSnapshot();
        if (snap.drawerOpen) {
          fab.dataset.state = "open";
          fab.innerHTML = FAB_ICON_OPEN;
        } else {
          fab.dataset.state = "closed";
          fab.innerHTML = FAB_ICON_CLOSED;
        }
      }

      fab.addEventListener("click", function () { controller.toggleDrawer(); });
      var unsub = controller.subscribe(render);
      render();
      document.body.appendChild(fab);

      return function () {
        unsub();
        fab.remove();
      };
    }

    // ===== 抽屉挂载 =====
    function mountDrawer(controller) {
      var container, viewHandle;

      function ensure() {
        if (container) return;
        container = document.createElement("aside");
        container.dataset.dshGithubDrawer = "";
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
          document.documentElement.removeAttribute("data-dsh-taskpool-drawer-open");
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
          // 关键修复 v0.1.4：检查是否还有别的 panel 抽屉打开（互斥协议 race condition）。
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

      var waitObserver = new MutationObserver(ensure);
      waitObserver.observe(document.body, { childList: true, subtree: true });
      document.addEventListener(ACTIVATE_EVENT, onOtherActivate);
      var unsub = controller.subscribe(applyOpen);
      applyOpen();
      ensure();

      // v0.2.1 智能轮询：移除抽屉状态驱动的常驻 polling 订阅，
      // 改为 pushRepo 触发 + pollPushStatus 自管理的 timer（详见 Controller.prototype.pollPushStatus）。

      return function () {
        document.removeEventListener(ACTIVATE_EVENT, onOtherActivate);
        waitObserver.disconnect();
        unsub();
        // v0.2.1：dispose 时兜底停掉 push poll timer（避免悬挂 interval）
        controller.stopPushPoll();
        document.documentElement.removeAttribute(DRAWER_ATTR);
        if (viewHandle && viewHandle.dispose) viewHandle.dispose();
        if (container) { container.remove(); container = undefined; }
      };
    }

    // ===== 抽屉视图 =====
    function renderDrawerView(container, controller) {
      var headerEl, bodyEl, pushStatusEl;

      function build() {
        container.innerHTML = "";
        pushStatusEl = document.createElement("div");
        pushStatusEl.className = "DGH_pushStatus";
        container.appendChild(pushStatusEl);

        headerEl = document.createElement("header");
        headerEl.className = "DGH_header";
        container.appendChild(headerEl);

        bodyEl = document.createElement("div");
        bodyEl.className = "DGH_body";
        container.appendChild(bodyEl);

        renderHeader();
        renderPushStatus();
        renderBody();
      }

      function renderHeader() {
        var snap = controller.getSnapshot();
        var toolAvail = snap.config && snap.config.toolAvailable;
        var headerHtml =
          '<span class="DGH_title">Git/GitHub</span>' +
          '<button class="DGH_iconBtn" data-action="config" title="配置扫描根路径">' +
            '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.2v2M8 12.8v2M14.8 8h-2M3.2 8h-2M12.95 3.05l-1.4 1.4M4.45 11.55l-1.4 1.4M12.95 12.95l-1.4-1.4M4.45 4.45l-1.4-1.4"/></svg>' +
          '</button>' +
          // v0.1.7：隐藏选择模式 toggle 按钮（↻ 右侧）
          '<button class="DGH_iconBtn" data-action="select-toggle" title="' + (snap.selectionMode ? '退出隐藏选择模式（Esc）' : '进入隐藏选择模式：点击卡片可加入/移出隐藏') + '" data-active="' + (snap.selectionMode ? 'true' : 'false') + '">' +
            (snap.selectionMode
              ? '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>'
              : '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>') +
          '</button>' +
          '<button class="DGH_iconBtn" data-action="refresh" title="刷新仓库状态">' +
            '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3"/></svg>' +
          '</button>' +
          '<span class="DGH_spacer"></span>' +
          '<button class="DGH_pushBtn" data-action="push-all" ' + (toolAvail ? "" : "disabled title=\"daily-push.cjs 不可用\"") + ' title="推送所有可见仓库（自动跳过 hidden）">⬆ 全部推送</button>' +
          '<button class="DGH_iconBtn" data-action="close" title="关闭（Esc）">' +
            '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>' +
          '</button>';
        headerEl.innerHTML = headerHtml;
        var configBtn = headerEl.querySelector('[data-action="config"]');
        if (snap.configPanelOpen) configBtn.dataset.active = "true";
        configBtn.addEventListener("click", function () {
          if (controller.configPanelOpen) controller.closeConfigPanel();
          else controller.openConfigPanel();
        });
        // v0.1.7：隐藏选择模式 toggle
        headerEl.querySelector('[data-action="select-toggle"]').addEventListener("click", function () {
          controller.setSelectionMode(!controller.getSnapshot().selectionMode);
        });
        headerEl.querySelector('[data-action="refresh"]').addEventListener("click", function () {
          controller.refresh(true);
        });
        headerEl.querySelector('[data-action="push-all"]').addEventListener("click", function () {
          controller.pushAll();
        });
        headerEl.querySelector('[data-action="close"]').addEventListener("click", function () {
          controller.closeDrawer();
        });
      }

      function renderPushStatus() {
        var snap = controller.getSnapshot();
        var lp = snap.lastPush;
        if (!lp || !lp.startedAt) {
          pushStatusEl.style.display = "none";
          return;
        }
        pushStatusEl.style.display = "flex";
        var running = !!lp.running;
        var scope = lp.scope === "all" ? "全部推送" : ("推送 " + (lp.repo ? lp.repo.split(/[\\/]/).pop() : "?"));
        var txt = running
          ? (scope + " 运行中（PID=" + (lp.pid || "?") + "）— 去终端看完整输出")
          : (scope + " 已结束 exit=" + (lp.exitCode != null ? lp.exitCode : "?"));
        pushStatusEl.innerHTML = '<span class="DGH_pushStatusDot" data-running="' + (running ? "true" : "false") + '"></span><span>' + escapeHtml(txt) + '</span>';
      }

      /** v0.2.2：渲染 commit 工具区（每个有改动的仓库一行：仓库名 + branch + 文件列表 + 输入框 + 提交按钮） */
      function renderCommitSection(row, controller) {
        var snap = controller.getSnapshot();
        var repos = Array.isArray(snap.commitRepos) ? snap.commitRepos : [];
        var busy = !!snap.commitBusy;

        if (repos.length === 0) {
          row.innerHTML = '<div class="DGH_commitSectionEmpty">所有仓库均无未提交改动 ✓</div>';
          return;
        }

        // 收集所有 input 元素引用，用于 commit 按钮回调
        var inputs = [];
        var html = "";
        for (var i = 0; i < repos.length; i++) {
          var r = repos[i];
          var files = r.files || [];
          // 文件名预览（最多 8 个，超过显示 +N more）
          var fileLines = "";
          var maxShow = 8;
          for (var j = 0; j < Math.min(files.length, maxShow); j++) {
            var f = files[j];
            fileLines += '<span class="DGH_commitFileStatus">' + escapeHtml(f.status || "?") + '</span>' + escapeHtml(f.path) + "\n";
          }
          if (files.length > maxShow) {
            fileLines += '<span style="color:var(--dsw-alias-label-tertiary)">… 还有 ' + (files.length - maxShow) + ' 个</span>';
          }
          var lastTxt = r.lastCommit ? (r.lastCommit.sha + " " + (r.lastCommit.message || "")) : "";
          html +=
            '<div class="DGH_commitRepo" data-repo-path="' + escapeHtml(r.path) + '">' +
              '<div class="DGH_commitRepoName">' +
                escapeHtml(r.name) +
                '<span class="DGH_commitRepoPath" title="' + escapeHtml(r.path) + '">' + escapeHtml(r.path) + '</span>' +
              '</div>' +
              '<div class="DGH_commitMeta">' +
                '<span class="DGH_commitBranch">' + escapeHtml(r.branch || "?") + '</span>' +
                '<span class="DGH_commitBadge">' + files.length + ' 改动</span>' +
                (lastTxt ? '<span style="font-size:10.5px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0" title="' + escapeHtml(lastTxt) + '">' + escapeHtml(lastTxt) + '</span>' : '') +
              '</div>' +
              (fileLines ? '<div class="DGH_commitFiles">' + fileLines + '</div>' : '') +
              '<div class="DGH_commitForm">' +
                '<input class="DGH_commitInput" type="text" placeholder="commit message（单行）" maxlength="200" ' + (busy ? "disabled" : "") + ' />' +
                '<button class="DGH_commitSubmit" ' + (busy ? "disabled" : "") + '>' + (busy ? "提交中…" : "提交") + '</button>' +
              '</div>' +
            '</div>';
        }
        row.innerHTML = html;

        // 给每行挂事件
        var repoRows = row.querySelectorAll(".DGH_commitRepo");
        for (var k = 0; k < repoRows.length; k++) {
          (function (repoEl) {
            var repoPath = repoEl.getAttribute("data-repo-path");
            var input = repoEl.querySelector(".DGH_commitInput");
            var submit = repoEl.querySelector(".DGH_commitSubmit");
            inputs.push(input);
            var doCommit = function () {
              var v = input.value;
              input.value = "";
              controller.commit(repoPath, v);
            };
            submit.addEventListener("click", doCommit);
            input.addEventListener("keydown", function (e) {
              if (e.key === "Enter" && !e.isComposing) {
                e.preventDefault();
                doCommit();
              }
            });
          })(repoRows[k]);
        }
        // 自动聚焦第一个 input（drawer 打开 + 无 commit 进行中）
        if (snap.drawerOpen && !busy && inputs[0]) {
          setTimeout(function () { try { inputs[0].focus({ preventScroll: true }); } catch (_) {} }, 50);
        }
      }

      /**
       * v0.3.0：渲染 merge / pull 工具区。每个可合并仓库一行：
       *   - 仓库名 + path + current branch + 分支数 + upstream 徽章 + 冲突/变基徽章
       *   - 冲突横幅（mergeInProgress / rebaseInProgress）：冲突文件列表 + abort 按钮
       *   - 操作行：源分支下拉 + merge 按钮 + pull 按钮（upstream 存在时）+ rebase 按钮
       *   - 忙态：mergeBusy === repo.path 时所有按钮 disabled
       */
      function renderMergeSection(row, controller) {
        var snap = controller.getSnapshot();
        var repos = Array.isArray(snap.mergeRepos) ? snap.mergeRepos : [];
        var busyPath = snap.mergeBusy || null;
        var lastResult = snap.lastMergeResult || null;

        if (repos.length === 0) {
          row.innerHTML = '<div class="DGH_mergeSectionEmpty">无可合并/拉取的仓库 ✓</div>';
          return;
        }

        var html = "";
        for (var i = 0; i < repos.length; i++) {
          var r = repos[i];
          var branches = Array.isArray(r.branches) ? r.branches : [];
          var current = r.current || "(unknown)";
          var inConflict = !!r.mergeInProgress;
          var inRebase = !!r.rebaseInProgress;
          var hasUpstream = !!r.upstream;
          var otherBranches = branches.filter(function (b) { return !b.isCurrent; });
          var repoBusy = busyPath === r.path;

          html +=
            '<div class="DGH_mergeRepo" data-repo-path="' + escapeHtml(r.path) + '">' +
              '<div class="DGH_mergeRepoName">' +
                escapeHtml(r.name) +
                '<span class="DGH_mergeRepoPath" title="' + escapeHtml(r.path) + '">' + escapeHtml(r.path) + '</span>' +
              '</div>' +
              '<div class="DGH_mergeMeta">' +
                '<span class="DGH_mergeBranch">' + escapeHtml(current) + '</span>' +
                (branches.length > 1
                  ? '<span class="DGH_mergeBadge">' + branches.length + ' 分支</span>'
                  : '') +
                (hasUpstream
                  ? '<span class="DGH_mergeBadge" data-kind="upstream" title="upstream = ' + escapeHtml(r.upstream) + '">↑ ' + escapeHtml(r.upstream) + '</span>'
                  : '') +
                (inConflict
                  ? '<span class="DGH_mergeBadge" data-kind="conflict">⚠ 合并冲突</span>'
                  : '') +
                (inRebase
                  ? '<span class="DGH_mergeBadge" data-kind="rebase">⚠ 变基冲突</span>'
                  : '') +
              '</div>' +
              (function () {
                // 冲突横幅：展示冲突文件列表 + abort 按钮
                if (!inConflict && !inRebase) return "";
                var kind = inRebase ? "rebase" : "merge";
                var list = (lastResult && lastResult.repo === r.path && Array.isArray(lastResult.conflicts) && lastResult.conflicts.length > 0)
                  ? lastResult.conflicts
                  : [];
                var listHtml = list.length > 0
                  ? '<ul class="DGH_mergeConflictList">' + list.map(function (f) { return '<li>' + escapeHtml(f) + '</li>'; }).join("") + '</ul>'
                  : '<div class="DGH_mergeHint">解决冲突后再 commit；或点右侧 abort 终止</div>';
                return '<div class="DGH_mergeConflictBanner">' +
                  '<div class="DGH_mergeConflictTitle">' +
                    '<span>⚠</span><span>' + (inRebase ? '变基冲突未解决' : '合并冲突未解决') + '（在 ' + escapeHtml(current) + ' 上）</span>' +
                  '</div>' +
                  listHtml +
                '</div>';
              })() +
              (inConflict || inRebase
                ? '<div class="DGH_mergeForm">' +
                    '<button class="DGH_abortBtn" data-action="abort" ' + (repoBusy ? "disabled" : "") + '>✕ abort</button>' +
                  '</div>'
                : '<div class="DGH_mergeForm">' +
                    (otherBranches.length > 0
                      ? '<select class="DGH_mergeSelect" data-role="source" ' + (repoBusy ? "disabled" : "") + '>' +
                          otherBranches.map(function (b) { return '<option value="' + escapeHtml(b.name) + '">' + escapeHtml(b.name) + '</option>'; }).join("") +
                        '</select>' +
                        '<button class="DGH_mergeBtn" data-action="merge" ' + (repoBusy ? "disabled" : "") + '>→ merge</button>'
                      : '<span class="DGH_mergeHint">没有其他本地分支可 merge</span>') +
                    (hasUpstream
                      ? '<button class="DGH_pullBtn" data-action="pull" ' + (repoBusy ? "disabled" : "") + ' title="git pull（merge 模式）">↑ pull</button>' +
                        '<button class="DGH_pullBtn" data-action="pull-rebase" ' + (repoBusy ? "disabled" : "") + ' title="git pull --rebase">⤴ rebase</button>'
                      : '') +
                  '</div>') +
              '<div class="DGH_mergeHint">操作前需工作区干净；冲突会保留状态，可 abort 或解决后 commit</div>' +
            '</div>';
        }
        row.innerHTML = html;

        // 挂事件：每行内 buttons / select
        var repoRows = row.querySelectorAll(".DGH_mergeRepo");
        for (var k = 0; k < repoRows.length; k++) {
          (function (repoEl) {
            var repoPath = repoEl.getAttribute("data-repo-path");
            var abortBtn = repoEl.querySelector('[data-action="abort"]');
            var mergeBtn = repoEl.querySelector('[data-action="merge"]');
            var pullBtn = repoEl.querySelector('[data-action="pull"]');
            var rebaseBtn = repoEl.querySelector('[data-action="pull-rebase"]');
            var select = repoEl.querySelector('[data-role="source"]');
            if (abortBtn) abortBtn.addEventListener("click", function () { controller.abortMerge(repoPath); });
            if (mergeBtn) mergeBtn.addEventListener("click", function () {
              var src = select ? select.value : "__none__";
              controller.mergeRepo(repoPath, src, false);
            });
            if (pullBtn) pullBtn.addEventListener("click", function () { controller.pullRepo(repoPath, false); });
            if (rebaseBtn) rebaseBtn.addEventListener("click", function () { controller.pullRepo(repoPath, true); });
          })(repoRows[k]);
        }
      }

      function renderBody() {
        var snap = controller.getSnapshot();

        // v0.2.2：commit 工具区（持久显示，紧贴 header 下；多仓库）
        var existingCommit = bodyEl.querySelector(".DGH_commitSection");
        if (!existingCommit) {
          existingCommit = document.createElement("div");
          existingCommit.className = "DGH_commitSection";
          bodyEl.insertBefore(existingCommit, bodyEl.firstChild);
        }
        renderCommitSection(existingCommit, controller);

        // v0.3.0：merge / pull 工具区（紧贴 commit 区下）
        var existingMerge = bodyEl.querySelector(".DGH_mergeSection");
        if (!existingMerge) {
          existingMerge = document.createElement("div");
          existingMerge.className = "DGH_mergeSection";
          // 插到 commit 区之后（commit 区在第一个位置）
          if (existingCommit.nextSibling) {
            bodyEl.insertBefore(existingMerge, existingCommit.nextSibling);
          } else {
            bodyEl.appendChild(existingMerge);
          }
        }
        renderMergeSection(existingMerge, controller);

        // 配置面板（按需插到 body 顶部）
        var existingCfg = bodyEl.querySelector(".DGH_config");
        if (snap.configPanelOpen) {
          if (!existingCfg) {
            existingCfg = document.createElement("div");
            existingCfg.className = "DGH_config";
            bodyEl.insertBefore(existingCfg, bodyEl.firstChild);
          }
          renderConfigPanel(existingCfg, controller);
        } else if (existingCfg) {
          existingCfg.remove();
        }

        // 错误 banner
        var oldBanner = bodyEl.querySelector(".DGH_errorBanner");
        if (snap.error) {
          if (!oldBanner) {
            oldBanner = document.createElement("div");
            oldBanner.className = "DGH_errorBanner";
            bodyEl.insertBefore(oldBanner, existingCfg ? existingCfg.nextSibling : bodyEl.firstChild);
          }
          oldBanner.innerHTML = '<span>⚠ ' + escapeHtml(snap.error) + '</span><button class="DGH_errorBannerRetry">重试</button>';
          oldBanner.querySelector(".DGH_errorBannerRetry").addEventListener("click", function () {
            controller.refresh(true);
          });
        } else if (oldBanner) {
          oldBanner.remove();
        }

        // v0.1.7："已隐藏 N 个" 小条只在 selectionMode 激活时显示在 body 底部
        var hiddenCount = snap.repos.filter(function (r) { return snap.hiddenPaths.indexOf(r.path) >= 0; }).length;
        // 移除旧的"hiddenBar"（v0.1.6 默认在顶部，v0.1.7 改为仅 selectionMode 模式底部显示）
        var oldHiddenBar = bodyEl.querySelector(".DGH_hiddenBar");
        if (oldHiddenBar) oldHiddenBar.remove();

        // 仓库列表
        var oldList = bodyEl.querySelector(".DGH_list, .DGH_empty, .DGH_loading");
        var newList;
        // v0.1.7 过滤逻辑：默认隐藏所有 hidden；selectionMode 激活时如 showHidden=true 则展开
        var visibleRepos = snap.repos.filter(function (r) {
          var isHidden = snap.hiddenPaths.indexOf(r.path) >= 0;
          // selectionMode=true + showHidden=true：展开；其他情况隐藏
          return !isHidden || (snap.selectionMode && snap.showHidden);
        });
        if (snap.loading && snap.repos.length === 0) {
          newList = document.createElement("div");
          newList.className = "DGH_loading";
          newList.textContent = "扫描中…";
        } else if (visibleRepos.length === 0 && !snap.selectionMode) {
          // 非选择模式下，0 个可见仓库 = 空状态
          newList = document.createElement("div");
          newList.className = "DGH_empty";
          newList.innerHTML = '<strong>没有可见仓库</strong>所有 ' + snap.repos.length + ' 个仓库都已隐藏 — 点 🎯 进入选择模式展开';
        } else if (visibleRepos.length === 0 && snap.selectionMode) {
          // 选择模式下，showHidden=true 但 visibleRepos 为空 = 没有仓库
          newList = document.createElement("div");
          newList.className = "DGH_empty";
          newList.innerHTML = '<strong>没有仓库</strong>配置扫描根目录下没有 .git 仓库';
        } else {
          newList = document.createElement("ul");
          newList.className = "DGH_list";
          // selectionMode 模式下，已隐藏项排前面（用户当前在管理 hidden 列表）
          var sorted = visibleRepos.slice().sort(function (a, b) {
            if (snap.selectionMode) {
              var ah = snap.hiddenPaths.indexOf(a.path) >= 0 ? 0 : 1;
              var bh = snap.hiddenPaths.indexOf(b.path) >= 0 ? 0 : 1;
              if (ah !== bh) return ah - bh;
            }
            var ap = snap.pinnedPaths.indexOf(a.path) >= 0 ? 0 : 1;
            var bp = snap.pinnedPaths.indexOf(b.path) >= 0 ? 0 : 1;
            if (ap !== bp) return ap - bp;
            return a.name.localeCompare(b.name);
          });
          for (var i = 0; i < sorted.length; i++) {
            newList.appendChild(buildRepoCard(sorted[i], snap, controller));
          }
        }
        if (oldList) {
          oldList.replaceWith(newList);
        } else {
          bodyEl.appendChild(newList);
        }

        // v0.1.7：selectionMode 激活时，在 body 底部插入 hiddenBar
        var bottomBar = bodyEl.querySelector(".DGH_hiddenBar");
        if (snap.selectionMode) {
          if (!bottomBar) {
            bottomBar = document.createElement("div");
            bottomBar.className = "DGH_hiddenBar";
            bodyEl.appendChild(bottomBar);
          }
          bottomBar.innerHTML =
            '<span class="DGH_hiddenBarCount">🚫 已隐藏 ' + hiddenCount + ' 个仓库</span>' +
            '<button class="DGH_hiddenBarToggle" data-action="toggle-show">' +
              (snap.showHidden ? '收起列表' : '展开列表（' + hiddenCount + '）') +
            '</button>' +
            '<button class="DGH_hiddenBarExit" data-action="exit-select">✓ 完成</button>';
          bottomBar.querySelector('[data-action="toggle-show"]').addEventListener("click", function () {
            controller.setShowHidden(!controller.getSnapshot().showHidden);
          });
          bottomBar.querySelector('[data-action="exit-select"]').addEventListener("click", function () {
            controller.setSelectionMode(false);
          });
        } else if (bottomBar) {
          bottomBar.remove();
        }
      }

      function renderConfigPanel(panelEl, controller) {
        var snap = controller.getSnapshot();
        var current = (snap.config && snap.config.scanRoots) || [];
        var currentHidden = Array.from(controller.hiddenPaths || []);
        panelEl.innerHTML =
          '<div class="DGH_configLabel">扫描根路径（每行一个）</div>' +
          '<textarea class="DGH_configTextarea" data-role="roots" spellcheck="false" placeholder="例如：&#10;F:\\AllWorkSpace&#10;E:\\">' + escapeHtml(current.join("\n")) + '</textarea>' +
          '<div class="DGH_configLabel" style="margin-top:10px">已隐藏仓库（每行一个绝对路径，不在列表显示）</div>' +
          '<textarea class="DGH_configTextarea" data-role="hidden" spellcheck="false" placeholder="例如：&#10;F:\\AllWorkSpace\\.dsh-plugins.archive&#10;E:\\dsh-skills">' + escapeHtml(currentHidden.join("\n")) + '</textarea>' +
          '<div class="DGH_configFooter">' +
            '<span class="DGH_configHint">保存后自动重新扫描</span>' +
            '<button class="DGH_saveBtn" data-action="save">保存</button>' +
          '</div>';
        var saveBtn = panelEl.querySelector('[data-action="save"]');
        var rootsTa = panelEl.querySelector('[data-role="roots"]');
        var hiddenTa = panelEl.querySelector('[data-role="hidden"]');
        saveBtn.addEventListener("click", function () {
          var lines = rootsTa.value.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
          if (lines.length === 0) {
            showToast("至少填一个根路径", "error");
            return;
          }
          var hiddenLines = hiddenTa.value.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
          saveBtn.disabled = true;
          // 同步保存 scanRoots + hiddenPaths
          controller.saveConfig(lines).then(function () {
            // 更新 hiddenPaths (controller 内部 _persist 一次写)
            controller.hiddenPaths = new Set(hiddenLines);
            controller._persist();
            saveBtn.disabled = false;
            showToast("配置已保存", "info");
          }).catch(function (e) {
            saveBtn.disabled = false;
            showToast("保存失败：" + (e && e.message ? e.message : e), "error");
          });
        });
      }

      function buildRepoCard(repo, snap, controller) {
        var li = document.createElement("li");
        li.className = "DGH_repo";
        li.dataset.repoPath = repo.path;
        if (snap.pinnedPaths.indexOf(repo.path) >= 0) li.dataset.pinned = "true";
        var isHidden = snap.hiddenPaths.indexOf(repo.path) >= 0;
        if (isHidden) li.dataset.hidden = "true";
        // v0.1.7：selectionMode 模式下整张卡片可点切换 hide
        if (snap.selectionMode) li.dataset.selecting = "true";

        var head = document.createElement("div");
        head.className = "DGH_repoHead";

        // v0.2.0 紧凑布局：titleRow 内嵌 push 按钮（右上角）
        var toolAvail = snap.config && snap.config.toolAvailable;
        var pushBtn = document.createElement("button");
        pushBtn.className = "DGH_pushInline";
        pushBtn.textContent = "⬆";
        pushBtn.setAttribute("aria-label", "推送");
        var pushBlocked = !toolAvail || isHidden;
        pushBtn.disabled = pushBlocked;
        pushBtn.title = isHidden
          ? "已隐藏,不允许推送"
          : (toolAvail ? "推送这个仓库（调 daily-push.cjs）" : "daily-push.cjs 不可用");
        pushBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          controller.pushRepo(repo.path);
        });

        var titleRow = document.createElement("div");
        titleRow.className = "DGH_repoTitle";
        titleRow.innerHTML =
          '<span class="DGH_repoName">' + escapeHtml(repo.name) + '</span>' +
          (repo.branch ? '<span class="DGH_repoBranch">' + escapeHtml(repo.branch) + '</span>' : '') +
          // v0.1.7：选择模式 + 已隐藏：显示 "已隐藏" 标记
          (snap.selectionMode && isHidden ? '<span class="DGH_repoMark">已隐藏 ✓</span>' : '');
        head.appendChild(titleRow);
        // push 按钮挂在 titleRow 末尾（与 name + branch 同行右）
        titleRow.appendChild(pushBtn);

        var pathEl = document.createElement("div");
        pathEl.className = "DGH_repoPath";
        pathEl.textContent = repo.path;
        head.appendChild(pathEl);

        // 状态徽章 + 人类语言 tooltip (v0.1.9：徽章悬停说明，零技术语言)
        // v0.2.0：branch 徽章 + 状态徽章合并到一行（更紧凑）
        var badges = document.createElement("div");
        badges.className = "DGH_repoBadges";
        if (repo.error) {
          var warnBadge = document.createElement("span");
          warnBadge.className = "DGH_badge";
          warnBadge.dataset.kind = "warn";
          warnBadge.textContent = "⚠ 读不出 git 状态";
          warnBadge.title = "这个仓库读不出 git 状态（可能是 git 命令超时、权限问题、或仓库已损坏）。错误: " + repo.error;
          badges.appendChild(warnBadge);
        } else {
          var statusBadge = document.createElement("span");
          statusBadge.className = "DGH_badge";
          statusBadge.dataset.kind = repo.status || "unknown";
          if (repo.status === "clean") {
            statusBadge.textContent = "● 干净";
            statusBadge.title = "工作区干净，没未提交的改动";
          } else if (repo.status === "dirty") {
            statusBadge.textContent = "● 有改动";
            statusBadge.title = "有未提交的改动（新增/修改/删除的文件）";
          } else {
            statusBadge.textContent = "● 未知";
            statusBadge.title = "状态未知";
          }
          badges.appendChild(statusBadge);
        }
        if (repo.unpushedCount > 0) {
          var unpushedBadge = document.createElement("span");
          unpushedBadge.className = "DGH_badge";
          unpushedBadge.dataset.kind = "unpushed";
          unpushedBadge.textContent = "↑ " + repo.unpushedCount + " 没推送";
          unpushedBadge.title = "本地有 " + repo.unpushedCount + " 个 commit 没推到 GitHub";
          badges.appendChild(unpushedBadge);
        } else if (repo.unpushedCount === -1 && !repo.error) {
          var noUpstreamBadge = document.createElement("span");
          noUpstreamBadge.className = "DGH_badge";
          noUpstreamBadge.dataset.kind = "warn";
          noUpstreamBadge.textContent = "无上游";
          noUpstreamBadge.title = "还没设置远程追踪分支。第一次推送要用 git push -u";
          badges.appendChild(noUpstreamBadge);
        }
        if (repo.todayCommitCount > 0) {
          var todayBadge = document.createElement("span");
          todayBadge.className = "DGH_badge";
          todayBadge.dataset.kind = "today";
          todayBadge.textContent = "今日 " + repo.todayCommitCount;
          todayBadge.title = "今天（北京时间）这个仓库有 " + repo.todayCommitCount + " 个 commit";
          badges.appendChild(todayBadge);
        }
        head.appendChild(badges);

        if (repo.lastCommit) {
          var lc = document.createElement("div");
          lc.className = "DGH_lastCommit";
          // v0.1.9：完整 message 作为 tooltip（默认显示截断到 50 字）
          var fullMessage = repo.lastCommit.message || "";
          var displayMessage = truncate(fullMessage, 50);
          lc.innerHTML =
            '<span class="DGH_lastCommitSha" title="' + escapeHtml(repo.lastCommit.sha) + '">' + escapeHtml(repo.lastCommit.sha) + '</span>' +
            '<span title="' + escapeHtml(fullMessage) + '">' + escapeHtml(displayMessage) + '</span>' +
            '<span title="' + escapeHtml(repo.lastCommit.date || "") + '">· ' + escapeHtml(relativeTime(parseGitDate(repo.lastCommit.date))) + '</span>';
          head.appendChild(lc);
        }

        li.appendChild(head);

        // v0.1.7：selectionMode 模式下，整张卡片可点 = toggleHide
        // 注意：push 按钮的 click handler 已经 stopPropagation，不会冒泡到这里
        if (snap.selectionMode) {
          li.addEventListener("click", function (e) {
            if (e.target.closest && e.target.closest(".DGH_pushInline")) return;
            controller.toggleHide(repo.path);
          });
        }

        // v0.2.0：去掉单独的操作行 div（push 按钮已内嵌到 titleRow）
        // v0.1.8 简化：卡片操作行只留 ⬆ 推送（之前这里有 actions div）
        // v0.1.7：selectionMode 模式下隐藏操作按钮（避免点击冲突；点卡片本体就够）
        return li;
      }

      function escapeHtml(s) {
        if (s == null) return "";
        return String(s).replace(/[&<>"']/g, function (c) {
          return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
        });
      }
      function truncate(s, n) {
        if (!s) return "";
        return s.length > n ? s.slice(0, n - 1) + "…" : s;
      }

      // 全局 Esc 关闭抽屉
      var keyHandler = function (e) {
        if (!controller.getSnapshot().drawerOpen) return;
        if (e.key !== "Escape") return;
        // Esc 优先级（v0.1.7）：
        //   1) 关闭配置面板
        //   2) 退出 selectionMode（隐藏选择模式）
        //   3) 关闭抽屉
        if (controller.configPanelOpen) { controller.closeConfigPanel(); return; }
        if (controller.selectionMode) { controller.setSelectionMode(false); return; }
        controller.closeDrawer();
      };
      document.addEventListener("keydown", keyHandler);

      build();
      var unsubRender = controller.subscribe(function () {
        renderHeader();
        renderPushStatus();
        renderBody();
      });

      return {
        dispose: function () {
          unsubRender();
          document.removeEventListener("keydown", keyHandler);
          if (container) container.innerHTML = "";
        },
      };
    }

    // ===== apply =====
    function apply(ctx) {
      injectCSS();
      var controller = new Controller(new LocalStorageStore(), { sessions: ctx.sessions });
      // 拉 config（不一定马上完成，但首屏按钮状态依赖 toolAvailable）
      controller.loadConfig();
      try {
        mountFab(controller);
        mountDrawer(controller);
      } catch (e) {
        console.error("[dsh-git-hub] mount failed:", e);
      }
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.name = "dsh-git-hub";
