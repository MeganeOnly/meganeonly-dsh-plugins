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

