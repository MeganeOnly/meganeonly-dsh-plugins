    // ===== controller-commit =====
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

