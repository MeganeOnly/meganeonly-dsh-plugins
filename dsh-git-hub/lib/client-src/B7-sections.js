    // ===== 工具区 =====
    /**
     * v0.2.2：渲染 commit 工具区（每个有改动的仓库一行：仓库名 + branch + 文件列表 + 输入框 + 提交按钮）。
     *
     * 外部依赖：escapeHtml（30-utils.js）、showToast（50-toast.js）——同 factory body 顶层。
     *
     * @param {HTMLElement} row 已经创建好的 .DGH_commitSection 容器
     * @param {Object} controller 用于 commit() 动作
     */
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
     *
     * 外部依赖：escapeHtml（30-utils.js）——同 factory body 顶层。
     *
     * @param {HTMLElement} row 已经创建好的 .DGH_mergeSection 容器
     * @param {Object} controller 用于 mergeRepo / pullRepo / abortMerge 动作
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

