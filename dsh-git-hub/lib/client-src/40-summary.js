    // ===== summary =====
    /** 把当前会话里发"仓库摘要"消息（走 task-pool 同款 sessions.driver.prompt）。 */
    function sendRepoSummaryToSession(sessions, repo, depsRef) {
      try {
        if (!sessions || typeof sessions.list.getSnapshot !== "function") return Promise.reject(new Error("sessions 服务不可用"));
        var snap = sessions.list.getSnapshot();
        var currentId = snap && snap.current;
        if (!currentId) return Promise.reject(new Error("没有当前会话"));
        var binding = typeof sessions.binding === "function" ? sessions.binding(currentId) : null;
        var driver = binding && binding.session ? binding.session : null;
        if (!driver || typeof driver.prompt !== "function") return Promise.reject(new Error("当前会话 driver 不可用"));
        var text = buildSummaryText(repo);
        var promise = driver.prompt([{ type: "text", text: text }], "queue");
        if (promise && typeof promise.then === "function") return promise;
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e);
      }
    }

    /** 把单仓库的"事实摘要" + 触发 agent 调 mcp__github__ 处理 GitHub 侧 的提示，作为 user message。 */
    function buildSummaryText(repo) {
      var lines = [];
      lines.push("请帮我处理这个仓库的 GitHub 侧问题：");
      lines.push("");
      lines.push("- path: " + repo.path);
      lines.push("- name: " + repo.name);
      lines.push("- branch: " + (repo.branch || "(unknown)"));
      lines.push("- upstream: " + (repo.upstream || "(none)"));
      lines.push("- working tree: " + (repo.status || "unknown"));
      lines.push("- unpushed commits: " + (repo.unpushedCount === -1 ? "(no upstream)" : repo.unpushedCount));
      lines.push("- today commits: " + (repo.todayCommitCount || 0));
      if (repo.lastCommit) {
        lines.push("- last commit: " + repo.lastCommit.sha + " " + repo.lastCommit.message + " (" + (repo.lastCommit.date || "?") + ")");
      }
      if (repo.error) lines.push("- git warning: " + repo.error);
      lines.push("");
      lines.push("请按需调用 mcp__github__ 系列工具查 GitHub 侧状态（open issues / open PRs / latest release / CI 等），并把发现总结给我。");
      return lines.join("\n");
    }

