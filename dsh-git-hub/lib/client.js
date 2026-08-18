/**
 * dsh-git-hub — 浏览器半端（web client bundle，作者：MeganeOnly）
 *
 * v0.1.0：右侧 FAB + 抽屉 + 本地 git 仓库列表 + 一键推送 + 推到当前对话。
 *
 * 设计要点（与 dsh-task-pool 一致的部分，不重复说明）：
 *   - 零 React 依赖，纯 DOM + 模板字符串
 *   - FAB 自挂 document.body，top:108px / right:24px（task-pool 在 56px,本插件下移 8px 避让），44×44 圆形 DSH 风格浅色按钮
 *   - 抽屉 420px 宽，position:fixed + transform 滑入
 *   - 互斥协议：dsh-panel-activate CustomEvent + <html data-dsh-github-drawer-open>
 *   - 多面板互斥时主动 remove 其它面板 attr
 *   - 持久化降级：localStorage 不可用时退化为内存 + console.warn
 *   - CSS 注入：<style data-plugin-css="dsh-git-hub/drawer.css"> 去重
 *   - 自愈 DOM 挂载：MutationObserver 监听 body
 *
 * 数据形态：localStorage key dsh.gitHub.v1
 *   schema v1 = { pinnedPaths: string[] }                      （v0.1.0）
 *   schema v2 = { pinnedPaths: string[], hiddenPaths: string[] }（v0.1.6 新增 hiddenPaths；
 *                                                             缺字段默认 []，隐式迁移 v1 → v2，
 *                                                             schema 演进不升 key）
 */
window.__ModuleLoader__.load({
  id: "dsh-git-hub",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var inject = ["sessions"]; // sessions 用于"推到当前对话"

    // ===== 常量 =====
    var STORAGE_KEY = "dsh.gitHub.v1";
    var DRAWER_ATTR = "data-dsh-github-drawer-open";
    // 任何右侧抽屉打开时设的统一 attr；所有 FAB CSS 监听它→让位到屏幕左侧
    // （侧边栏区域），而不是被自己的抽屉遮挡。互斥协议保证任意时刻只有一个抽屉打开。
    // 与 dsh-task-pool / 其他面板共享此协议（v0.1.1+ 协议升级）。
    var ANY_DRAWER_ATTR = "data-dsh-any-side-drawer-open";
    var DRAWER_WIDTH = 420;
    var PANEL_NAME = "github";
    var ACTIVATE_EVENT = "dsh-panel-activate";
    var POLL_INTERVAL_MS = 4000; // 抽屉打开时轮询 push-status 看推送进度

    // ===== 工具函数 =====
    function beijingDate(ms) { return new Date(ms + 8 * 3600 * 1000); }
    function pad2(n) { return String(n).padStart(2, "0"); }
    function beijingDateTime(ms) {
      var dt = beijingDate(ms);
      return dt.getUTCFullYear() + "-" + pad2(dt.getUTCMonth() + 1) + "-" + pad2(dt.getUTCDate())
        + " " + pad2(dt.getUTCHours()) + ":" + pad2(dt.getUTCMinutes());
    }
    function relativeTime(ms) {
      if (!ms) return "";
      var diff = Date.now() - ms;
      if (diff < 0) diff = 0;
      var m = Math.floor(diff / 60000);
      if (m < 1) return "刚刚";
      if (m < 60) return m + " 分钟前";
      var h = Math.floor(m / 60);
      if (h < 24) return h + " 小时前";
      var d = Math.floor(h / 24);
      if (d < 30) return d + " 天前";
      var dt = beijingDate(ms);
      return dt.getUTCFullYear() + "-" + pad2(dt.getUTCMonth() + 1) + "-" + pad2(dt.getUTCDate());
    }

    /** 把 git 字符串 ("2025-08-18T12:34:56+08:00") 解析为 ms；解析失败返回 0。 */
    function parseGitDate(s) {
      if (!s) return 0;
      var t = Date.parse(s);
      return isNaN(t) ? 0 : t;
    }

    /** fetch 包装：JSON 请求 + 错误处理。 */
    function apiFetch(path, opts) {
      opts = opts || {};
      var init = {
        method: opts.method || "GET",
        headers: { "content-type": "application/json" },
      };
      if (opts.body) init.body = JSON.stringify(opts.body);
      return fetch(path, init).then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
          if (!res.ok) {
            var msg = (data && data.error) ? data.error : ("HTTP " + res.status);
            return Promise.reject(new Error(msg));
          }
          return data;
        });
      });
    }

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

    /** 临时 toast：右下角小提示，2.5s 自动消失。 */
    function showToast(message, kind) {
      var tagId = "dsh-git-hub/toast";
      var old = document.querySelector("[data-plugin-css=\"" + tagId + "\"]");
      // 用同一 CSS 容器，但每次插入一个 div（toast 节点本身不算 CSS）
      var toast = document.createElement("div");
      toast.className = "DGH_toast DGH_toast-" + (kind || "info");
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(function () {
        if (document.body.contains(toast)) toast.remove();
      }, 2500);
    }

    // ===== CSS =====
    var CSS = "" +
      // 抽屉
      "[data-dsh-github-drawer]{position:fixed;top:0;right:0;bottom:0;width:" + DRAWER_WIDTH + "px;max-width:90vw;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);font-size:13px;border-left:1px solid var(--dsw-alias-border-l1);box-shadow:0 2px 12px rgba(0,0,0,.12);z-index:100;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .22s ease;box-sizing:border-box;}" +
      "html[" + DRAWER_ATTR + "] [data-dsh-github-drawer]{transform:translateX(0);}" +
      // header
      ".DGH_header{display:flex;align-items:center;gap:6px;flex:none;padding:14px 14px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);}" +
      ".DGH_title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);padding:0 4px;flex:none;}" +
      ".DGH_iconBtn{font:inherit;cursor:pointer;background:transparent;color:var(--dsw-alias-label-secondary);border:1px solid transparent;border-radius:8px;padding:5px 7px;display:inline-flex;align-items:center;justify-content:center;transition:background .12s,color .12s;flex:none;}" +
      ".DGH_iconBtn:hover{background:var(--dsw-specific-sidebar-nav-item-hover);color:var(--dsw-alias-label-primary);}" +
      ".DGH_iconBtn[data-active=\"true\"]{background:var(--dsw-specific-sidebar-nav-item-active);color:var(--dsw-alias-label-primary);}" +
      ".DGH_spacer{flex:1;min-width:0;}" +
      ".DGH_pushBtn{font:inherit;cursor:pointer;background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground);border:1px solid var(--dsw-alias-button-info-fill);border-radius:8px;padding:6px 10px;font-size:12px;font-weight:500;transition:background .12s,border-color .12s;flex:none;}" +
      ".DGH_pushBtn:hover{background:var(--dsw-alias-button-info-hover);border-color:var(--dsw-alias-button-info-hover);}" +
      ".DGH_pushBtn:disabled{opacity:.45;cursor:not-allowed;}" +
      // 配置面板
      ".DGH_config{border-bottom:1px solid var(--dsw-alias-border-l1);padding:10px 14px;display:flex;flex-direction:column;gap:8px;background:var(--dsw-alias-bg-layer-2);}" +
      ".DGH_configLabel{font-size:11px;color:var(--dsw-alias-label-tertiary);text-transform:uppercase;letter-spacing:.04em;}" +
      ".DGH_configTextarea{font:inherit;font-size:12px;background:var(--dsw-specific-input-major);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 10px;width:100%;box-sizing:border-box;min-height:70px;outline:none;resize:vertical;font-family:inherit;}" +
      ".DGH_configTextarea:focus{border-color:var(--dsw-alias-button-info-fill);}" +
      ".DGH_configFooter{display:flex;align-items:center;gap:8px;}" +
      ".DGH_configHint{font-size:11px;color:var(--dsw-alias-label-tertiary);flex:1;min-width:0;}" +
      ".DGH_saveBtn{font:inherit;cursor:pointer;background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground);border:1px solid var(--dsw-alias-button-info-fill);border-radius:8px;padding:5px 12px;font-size:12px;font-weight:500;transition:background .12s;}" +
      ".DGH_saveBtn:hover{background:var(--dsw-alias-button-info-hover);}" +
      ".DGH_saveBtn:disabled{opacity:.5;cursor:not-allowed;}" +
      // body / list
      ".DGH_body{flex:1;min-height:0;overflow-y:auto;padding:12px 14px 16px;}" +
      ".DGH_empty{padding:36px 12px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.6;}" +
      ".DGH_empty strong{display:block;font-size:14px;color:var(--dsw-alias-label-secondary);margin-bottom:6px;}" +
      ".DGH_loading{padding:24px 8px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:12px;}" +
      ".DGH_list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;}" +
      ".DGH_errorBanner{padding:8px 10px;border-radius:6px;background:rgba(239,68,68,.1);color:var(--dsw-alias-state-error-primary);font-size:12px;margin-bottom:8px;display:flex;align-items:center;gap:8px;}" +
      ".DGH_errorBannerRetry{margin-left:auto;cursor:pointer;background:transparent;border:1px solid currentColor;border-radius:6px;padding:2px 8px;font-size:11px;color:inherit;}" +
      // 仓库卡片
      ".DGH_repo{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;transition:border-color .12s,background .12s;overflow:hidden;}" +
      ".DGH_repo:hover{border-color:var(--dsw-alias-label-dimmed);}" +
      ".DGH_repo[data-pinned=\"true\"]{border-color:var(--dsw-alias-button-info-fill);}" +
      ".DGH_repoHead{padding:10px 12px;display:flex;flex-direction:column;gap:6px;}" +
      ".DGH_repoTitle{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}" +
      ".DGH_repoName{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);}" +
      ".DGH_repoBranch{font-size:11px;font-family:monospace;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-base);padding:2px 6px;border-radius:4px;border:1px solid var(--dsw-alias-border-l2);}" +
      ".DGH_repoPath{font-size:11px;color:var(--dsw-alias-label-tertiary);word-break:break-all;font-family:monospace;}" +
      ".DGH_repoBadges{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px;color:var(--dsw-alias-label-secondary);}" +
      ".DGH_badge{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:10px;font-size:11px;line-height:1.4;}" +
      ".DGH_badge[data-kind=\"clean\"]{background:rgba(22,163,74,.12);color:#15803d;}" +
      ".DGH_badge[data-kind=\"dirty\"]{background:rgba(234,179,8,.15);color:#a16207;}" +
      ".DGH_badge[data-kind=\"unknown\"]{background:rgba(148,163,184,.15);color:#475569;}" +
      ".DGH_badge[data-kind=\"unpushed\"]{background:rgba(220,38,38,.12);color:#b91c1c;}" +
      ".DGH_badge[data-kind=\"today\"]{background:rgba(99,102,241,.12);color:#4338ca;}" +
      ".DGH_badge[data-kind=\"warn\"]{background:rgba(234,88,12,.12);color:#9a3412;}" +
      ".DGH_lastCommit{font-size:11px;color:var(--dsw-alias-label-tertiary);display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;}" +
      ".DGH_lastCommitSha{font-family:monospace;color:var(--dsw-alias-label-secondary);}" +
      ".DGH_repoActions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 12px;border-top:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);}" +
      ".DGH_actionBtn{font:inherit;cursor:pointer;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 10px;font-size:12px;transition:background .12s,border-color .12s;display:inline-flex;align-items:center;gap:4px;}" +
      ".DGH_actionBtn:hover{background:var(--dsw-specific-sidebar-nav-item-hover);border-color:var(--dsw-alias-label-dimmed);}" +
      ".DGH_actionBtn:disabled{opacity:.45;cursor:not-allowed;}" +
      ".DGH_actionBtn[data-variant=\"primary\"]{border-color:var(--dsw-alias-button-info-fill);background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground);}" +
      ".DGH_actionBtn[data-variant=\"primary\"]:hover{background:var(--dsw-alias-button-info-hover);border-color:var(--dsw-alias-button-info-hover);}" +
      ".DGH_pinBtn[data-active=\"true\"]{color:#b45309;}" +
      ".DGH_hideBtn[data-active=\"true\"]{color:#9a3412;background:rgba(154,52,18,.1);}" +
      // v0.1.7：隐藏选择模式 — 卡片可点 + 已隐藏卡视觉
      ".DGH_repo[data-selecting=\"true\"]{cursor:pointer;border-color:rgba(234,88,12,.4);}" +
      ".DGH_repo[data-selecting=\"true\"]:hover{border-color:#ea580c;background:var(--dsw-alias-bg-layer-3);}" +
      ".DGH_repo[data-hidden=\"true\"]{opacity:.6;}" +
      ".DGH_repo[data-hidden=\"true\"] .DGH_repoPath,.DGH_repo[data-hidden=\"true\"] .DGH_repoName{text-decoration:line-through;text-decoration-color:var(--dsw-alias-label-tertiary);}" +
      ".DGH_repoMark{margin-left:6px;font-size:11px;color:#9a3412;background:rgba(154,52,18,.1);padding:2px 6px;border-radius:4px;}" +
      // 隐藏仓库小条（v0.1.7：仅 selectionMode 模式底部显示）
      ".DGH_hiddenBar{display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--dsw-alias-bg-layer-2);border-top:1px solid var(--dsw-alias-border-l2);font-size:12px;color:var(--dsw-alias-label-secondary);flex:none;}" +
      ".DGH_hiddenBarCount{flex:1;min-width:0;}" +
      ".DGH_hiddenBarToggle{cursor:pointer;background:transparent;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:3px 10px;font:inherit;font-size:11px;color:var(--dsw-alias-label-primary);}" +
      ".DGH_hiddenBarToggle:hover{background:var(--dsw-specific-sidebar-nav-item-hover);}" +
      ".DGH_hiddenBarExit{cursor:pointer;background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground);border:1px solid var(--dsw-alias-button-info-fill);border-radius:6px;padding:3px 12px;font:inherit;font-size:12px;font-weight:500;}" +
      ".DGH_hiddenBarExit:hover{background:var(--dsw-alias-button-info-hover);border-color:var(--dsw-alias-button-info-hover);}" +
      // 选择模式 toggle 按钮激活态
      "[data-action=\"select-toggle\"][data-active=\"true\"]{background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground);border-color:var(--dsw-alias-button-info-fill);}" +
      // FAB：top:108px = task-pool FAB(56~100)+ 8px 间距。两个 FAB 同时可见不重叠；
      // drawer 打开互斥协议保证两个 FAB 不会同时进入让位动画
      ".DGH_fab{position:fixed;top:108px;right:24px;width:44px;height:44px;border-radius:50%;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:110;box-shadow:0 2px 8px rgba(0,0,0,.1);transition:transform .12s,right .22s ease,background .12s;padding:0;}" +
      ".DGH_fab:hover{transform:scale(1.06);}" +
      ".DGH_fab[data-state=\"open\"]{background:var(--dsw-alias-bg-layer-3);}" +
      // drawer 打开时 FAB 让位到抽屉的左边外。
      // 让位公式 calc(var(--active-drawer-width) + 24px)：--active-drawer-width 由打开抽屉的
      // panel 在 applyOpen(open) 时 setProperty 设定（task-pool = 380px, git-hub = 420px, ...），
      // 所以 FAB 让位数值随实际打开抽屉宽度变化——避免不同宽度抽屉用固定值导致的位置错乱。
      // 监听 ANY_DRAWER_ATTR（任意右侧抽屉打开）→ 不只是自己抽屉打开。
      // 与 dsh-task-pool / 其他面板共享此协议，互斥协议保证任意时刻只有一个抽屉打开。
      "html[" + ANY_DRAWER_ATTR + "] .DGH_fab{right:calc(var(--active-drawer-width, 380px) + 24px);}" +
      // toast
      ".DGH_toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:10px 16px;font:inherit;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.18);z-index:120;animation:DGH_toastIn .14s ease;}" +
      ".DGH_toast-error{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);}" +
      "@keyframes DGH_toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}" +
      // push 状态条
      ".DGH_pushStatus{padding:6px 12px;font-size:11px;color:var(--dsw-alias-label-tertiary);display:flex;align-items:center;gap:6px;background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-border-l1);}" +
      ".DGH_pushStatusDot{width:6px;height:6px;border-radius:50%;background:#22c55e;flex:none;}" +
      ".DGH_pushStatusDot[data-running=\"true\"]{background:#eab308;animation:DGH_pulse 1s ease-in-out infinite;}" +
      "@keyframes DGH_pulse{0%,100%{opacity:1;}50%{opacity:.5;}}";

    function injectCSS() {
      var tagId = "dsh-git-hub/drawer.css";
      if (document.querySelector("style[data-plugin-css=\"" + tagId + "\"]")) return;
      var tag = document.createElement("style");
      tag.dataset.plugin = "dsh-git-hub";
      tag.dataset.pluginCss = tagId;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    // ===== LocalStorageStore（钉住列表） =====
    function LocalStorageStore() {
      var storage;
      try {
        var probe = "__dsh_github_probe__";
        globalThis.localStorage.setItem(probe, probe);
        globalThis.localStorage.removeItem(probe);
        storage = globalThis.localStorage;
      } catch (e) {
        console.warn("[dsh-git-hub] localStorage unavailable, in-memory only");
        storage = undefined;
      }
      this.storage = storage;
    }
    LocalStorageStore.prototype.load = function () {
      if (!this.storage) return { pinnedPaths: [], hiddenPaths: [] };
      try {
        var raw = this.storage.getItem(STORAGE_KEY);
        if (!raw) return { pinnedPaths: [], hiddenPaths: [] };
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return { pinnedPaths: [], hiddenPaths: [] };
        var pinned = Array.isArray(parsed.pinnedPaths) ? parsed.pinnedPaths.filter(function (p) { return typeof p === "string"; }) : [];
        // v1 → v2 隐式迁移：旧文档无 hiddenPaths，默认空数组
        var hidden = Array.isArray(parsed.hiddenPaths) ? parsed.hiddenPaths.filter(function (p) { return typeof p === "string"; }) : [];
        return { pinnedPaths: pinned, hiddenPaths: hidden };
      } catch (e) {
        console.error("[dsh-git-hub] load failed; starting empty", e);
        return { pinnedPaths: [], hiddenPaths: [] };
      }
    };
    LocalStorageStore.prototype.save = function (doc) {
      if (!this.storage) return;
      try {
        this.storage.setItem(STORAGE_KEY, JSON.stringify({
          pinnedPaths: Array.isArray(doc.pinnedPaths) ? doc.pinnedPaths : [],
          hiddenPaths: Array.isArray(doc.hiddenPaths) ? doc.hiddenPaths : [],
        }));
      } catch (e) {
        console.error("[dsh-git-hub] save failed", e);
      }
    };

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
        pinnedPaths: Array.from(this.pinnedPaths),
        hiddenPaths: Array.from(this.hiddenPaths),
        drawerOpen: this.drawerOpen,
      };
    };
    Controller.prototype.toggleDrawer = function () {
      this.drawerOpen = !this.drawerOpen;
      if (this.drawerOpen) {
        // 抽屉打开：拉数据
        this.refresh(false);
        this.pollPushStatus();
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
        // 启动后等几秒轮询 push-status
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
    /** 轮询 push-status（抽屉打开时跑） */
    Controller.prototype.pollPushStatus = function () {
      var self = this;
      if (!self.drawerOpen) return;
      apiFetch("/api/git-hub/push-status").then(function (data) {
        if (data && data.ok && data.lastPush && data.lastPush.startedAt) {
          self.lastPush = data.lastPush;
          self.notify();
        }
      }).catch(function () { /* ignore */ });
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

      // 抽屉打开时启动 polling
      var pollTimer = null;
      controller.subscribe(function () {
        if (controller.getSnapshot().drawerOpen) {
          if (!pollTimer) {
            pollTimer = setInterval(function () { controller.pollPushStatus(); }, POLL_INTERVAL_MS);
          }
        } else {
          if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        }
      });

      return function () {
        document.removeEventListener(ACTIVATE_EVENT, onOtherActivate);
        waitObserver.disconnect();
        unsub();
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
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

      function renderBody() {
        var snap = controller.getSnapshot();

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

        var titleRow = document.createElement("div");
        titleRow.className = "DGH_repoTitle";
        titleRow.innerHTML =
          '<span class="DGH_repoName">' + escapeHtml(repo.name) + '</span>' +
          (repo.branch ? '<span class="DGH_repoBranch">' + escapeHtml(repo.branch) + '</span>' : '') +
          // v0.1.7：选择模式 + 已隐藏：显示 "已隐藏" 标记
          (snap.selectionMode && isHidden ? '<span class="DGH_repoMark">已隐藏 ✓</span>' : '');
        head.appendChild(titleRow);

        var pathEl = document.createElement("div");
        pathEl.className = "DGH_repoPath";
        pathEl.textContent = repo.path;
        head.appendChild(pathEl);

        // 状态徽章
        var badges = document.createElement("div");
        badges.className = "DGH_repoBadges";
        if (repo.error) {
          var warnBadge = document.createElement("span");
          warnBadge.className = "DGH_badge";
          warnBadge.dataset.kind = "warn";
          warnBadge.textContent = "⚠ " + repo.error;
          warnBadge.title = repo.error;
          badges.appendChild(warnBadge);
        } else {
          var statusBadge = document.createElement("span");
          statusBadge.className = "DGH_badge";
          statusBadge.dataset.kind = repo.status || "unknown";
          statusBadge.textContent = repo.status === "clean" ? "● clean" : repo.status === "dirty" ? "● dirty" : "● ?";
          badges.appendChild(statusBadge);
        }
        if (repo.unpushedCount > 0) {
          var unpushedBadge = document.createElement("span");
          unpushedBadge.className = "DGH_badge";
          unpushedBadge.dataset.kind = "unpushed";
          unpushedBadge.textContent = "↑ " + repo.unpushedCount + " 未推送";
          badges.appendChild(unpushedBadge);
        } else if (repo.unpushedCount === -1 && !repo.error) {
          var noUpstreamBadge = document.createElement("span");
          noUpstreamBadge.className = "DGH_badge";
          noUpstreamBadge.dataset.kind = "warn";
          noUpstreamBadge.textContent = "无 upstream";
          noUpstreamBadge.title = "没有 origin/xxx 追踪分支";
          badges.appendChild(noUpstreamBadge);
        }
        if (repo.todayCommitCount > 0) {
          var todayBadge = document.createElement("span");
          todayBadge.className = "DGH_badge";
          todayBadge.dataset.kind = "today";
          todayBadge.textContent = "今日 " + repo.todayCommitCount;
          badges.appendChild(todayBadge);
        }
        head.appendChild(badges);

        if (repo.lastCommit) {
          var lc = document.createElement("div");
          lc.className = "DGH_lastCommit";
          lc.innerHTML =
            '<span class="DGH_lastCommitSha">' + escapeHtml(repo.lastCommit.sha) + '</span>' +
            '<span>' + escapeHtml(truncate(repo.lastCommit.message, 50)) + '</span>' +
            '<span>· ' + escapeHtml(relativeTime(parseGitDate(repo.lastCommit.date))) + '</span>';
          head.appendChild(lc);
        }

        li.appendChild(head);

        // v0.1.7：selectionMode 模式下，整张卡片可点 = toggleHide
        // 注意：操作按钮行内的点击会 stopPropagation 不会冒泡到这里
        if (snap.selectionMode) {
          li.addEventListener("click", function (e) {
            // 阻止操作按钮行点击冒泡触发
            if (e.target.closest && e.target.closest(".DGH_repoActions")) return;
            controller.toggleHide(repo.path);
          });
        }

        // 操作行
        var actions = document.createElement("div");
        actions.className = "DGH_repoActions";
        // v0.1.7：selectionMode 模式下隐藏操作按钮（避免点击冲突；点卡片本体就够）
        if (!snap.selectionMode) {
          actions.style.display = "";
        } else {
          actions.style.display = "none";
        }
        var toolAvail = snap.config && snap.config.toolAvailable;
        var pushBtn = document.createElement("button");
        pushBtn.className = "DGH_actionBtn";
        pushBtn.dataset.variant = "primary";
        pushBtn.textContent = "⬆ 推送";
        // v0.1.7：hidden 仓库 push 按钮置灰（用户语义"几乎等于不要碰"）
        var pushBlocked = !toolAvail || isHidden;
        pushBtn.disabled = pushBlocked;
        pushBtn.title = isHidden
          ? "已隐藏,不允许推送（用户语义:几乎等于不要碰）。先取消隐藏再试。"
          : (toolAvail ? "调 daily-push.cjs 推送" : "daily-push.cjs 不可用");
        pushBtn.addEventListener("click", function (e) {
          // selectionMode 下 actions 是隐藏的，但仍 stopPropagation 防止误触发
          e.stopPropagation();
          controller.pushRepo(repo.path);
        });
        actions.appendChild(pushBtn);

        // v0.1.8 简化：卡片操作行只留 ⬆ 推送；💬 推到对话 / 📌 钉 / 🚫 隐 都去掉
        //   - 隐藏：通过 🎯 选择模式整张卡片可点切换
        //   - 推到对话 / 钉住：如果用户后续要恢复，会再加回到别的位置（header / 长按等）

        li.appendChild(actions);
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
    return module.exports;
  },
});