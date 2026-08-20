    // ===== 仓库卡片 =====
    /** 截断字符串到指定长度；超过显示 "…"。用于卡片 commit message 预览。 */
    function truncate(s, n) {
      if (!s) return "";
      return s.length > n ? s.slice(0, n - 1) + "…" : s;
    }

    /**
     * v0.1.7+：构造单张仓库卡片 DOM 元素。
     *
     * 职责：表单（hidden / pinned / selectionMode）+ 状态徽章 + 紧凑布局。
     * 外部依赖：escapeHtml（30-utils.js）、truncate（本地）、showToast（50-toast.js）——全部同 factory body 顶层。
     *
     * @param {Object} repo 单仓库条目 { path, name, branch, status, error, unpushedCount, todayCommitCount, lastCommit }
     * @param {Object} snap controller.getSnapshot() 当前快照
     * @param {Object} controller 用于 toggleHide / pushRepo / 等动作
     * @returns {HTMLLIElement} 构造好的 <li> 节点
     */
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
      // v0.5.0：受 sections.perCardPush 开关控制——关闭时不创建 pushBtn（整张卡片不带推送入口）
      var perCardPushOn = snap.sections && snap.sections.perCardPush === true;
      var toolAvail = snap.config && snap.config.toolAvailable;
      var pushBtn = null;
      if (perCardPushOn) {
        pushBtn = document.createElement("button");
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
      }

      var titleRow = document.createElement("div");
      titleRow.className = "DGH_repoTitle";
      titleRow.innerHTML =
        '<span class="DGH_repoName">' + escapeHtml(repo.name) + '</span>' +
        (repo.branch ? '<span class="DGH_repoBranch">' + escapeHtml(repo.branch) + '</span>' : '') +
        // v0.1.7：选择模式 + 已隐藏：显示 "已隐藏" 标记
        (snap.selectionMode && isHidden ? '<span class="DGH_repoMark">已隐藏 ✓</span>' : '');
      head.appendChild(titleRow);
      // push 按钮挂在 titleRow 末尾（与 name + branch 同行右）；v0.5.0：受 sections.perCardPush 控制
      if (pushBtn) titleRow.appendChild(pushBtn);

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

