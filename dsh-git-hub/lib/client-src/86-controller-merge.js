    // ===== controller-merge =====
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

