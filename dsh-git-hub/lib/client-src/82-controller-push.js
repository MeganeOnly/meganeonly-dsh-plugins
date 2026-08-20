    // ===== controller-push =====
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

