/**
 * dsh-update-checker — 浏览器半端（web client bundle，作者：MeganeOnly）
 *
 * 在设置页新增"更新"section：
 * - 显示当前版本 / npm 最新版本 / 是否有更新；
 * - "检查更新"按钮：手动重新查 npm；
 * - "一键更新"按钮：先二次确认（显示目标版本），确认后调用宿主执行
 *   npm install -g @deepseek-ai/dsh@latest；完成后提示"请重启 DSH 生效"。
 *
 * 升级期间轮询 /api/dsh-update/status 直到 updating 结束。
 */
window.__ModuleLoader__.load({
  id: "dsh-update-checker",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");

    var inject = ["slots"];

    // ---------- API ----------
    function fetchStatus() {
      return fetch("/api/dsh-update/status")
        .then(function (r) { return r.json(); })
        .catch(function () { return null; });
    }

    function postCheck() {
      return fetch("/api/dsh-update/check", { method: "POST" })
        .then(function (r) { return r.json(); })
        .catch(function () { return null; });
    }

    function postUpdate() {
      return fetch("/api/dsh-update/update", { method: "POST" })
        .then(function (r) { return r.json(); })
        .catch(function () { return null; });
    }

    // ---------- 样式 ----------
    var CSS_TEXT = [
      ".duc{max-width:560px;font-size:13px;line-height:1.6}",
      ".duc-card{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:10px;padding:14px 16px;margin-top:12px;background:var(--dsw-alias-surface-2,transparent)}",
      ".duc-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
      ".duc-label{color:var(--dsw-alias-label-secondary,#6b7280);min-width:64px}",
      ".duc-value{font-weight:600;font-variant-numeric:tabular-nums}",
      ".duc-tag{font-size:11px;padding:1px 8px;border-radius:999px;border:1px solid}",
      ".duc-tag-ok{color:#15803d;border-color:#bbf7d0;background:#f0fdf4}",
      ".duc-tag-new{color:#b45309;border-color:#fcd34d;background:#fffbeb}",
      ".duc-tag-busy{color:#1d4ed8;border-color:#bfdbfe;background:#eff6ff}",
      ".duc-actions{margin-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}",
      ".duc-btn{font-size:12px;padding:4px 12px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2,#d1d5db);background:var(--dsw-alias-interactive-bg,transparent);color:var(--dsw-alias-label-primary,#111827);cursor:pointer;transition:filter .15s}",
      ".duc-btn:hover:not(:disabled){filter:brightness(.96)}",
      ".duc-btn:disabled{opacity:.45;cursor:default}",
      ".duc-btn-primary{background:#2563eb;border-color:#2563eb;color:#fff}",
      ".duc-btn-danger{color:#b91c1c;border-color:#f3c1c1}",
      ".duc-note{margin-top:10px;font-size:12px}",
      ".duc-note-ok{color:#15803d}",
      ".duc-note-err{color:#b91c1c}",
      ".duc-note-warn{color:#b45309}",
      ".duc-dim{color:var(--dsw-alias-label-tertiary,#9ca3af)}",
      ".duc-restart{display:inline-block;margin-top:10px;padding:6px 14px;border-radius:8px;background:#dcfce7;border:1px solid #86efac;color:#166534;font-weight:600}",
      ".duc-output{white-space:pre-wrap;word-break:break-all;font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-secondary,#6b7280);background:var(--dsw-alias-surface-1,#f9fafb);border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:6px;padding:8px;margin-top:8px;max-height:160px;overflow:auto}",
      ".duc-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(2px)}",
      ".duc-overlay-card{background:#fff;color:#0f172a;border-radius:12px;padding:22px 28px;box-shadow:0 12px 40px rgba(0,0,0,.35);max-width:420px;text-align:center;font-size:14px;line-height:1.6}",
      ".duc-overlay-spinner{width:36px;height:36px;border-radius:50%;border:3px solid #cbd5e1;border-top-color:#2563eb;margin:0 auto 14px;animation:duc-spin 1s linear infinite}",
      "@keyframes duc-spin{to{transform:rotate(360deg)}}",
      ".duc-overlay-title{font-size:16px;font-weight:700;margin-bottom:6px}",
      ".duc-overlay-warn{color:#b45309;font-weight:600;margin-top:8px}",
      ".duc-shim-warn{margin-top:8px;padding:8px 12px;border-radius:6px;background:#fef3c7;border:1px solid #fcd34d;color:#92400e;font-size:12px}",
      ".duc-shim-recovered{margin-top:8px;padding:8px 12px;border-radius:6px;background:#dcfce7;border:1px solid #86efac;color:#166534;font-size:12px}",
    ].join("");

    function injectCss() {
      if (document.querySelector("style[data-plugin-css='dsh-update-checker']")) return;
      var style = document.createElement("style");
      style.dataset.pluginCss = "dsh-update-checker";
      style.textContent = CSS_TEXT;
      document.head.appendChild(style);
    }

    // ---------- 组件 ----------
    // 升级中遮罩：防止用户在 npm 全局安装被打断期间误关闭 DSH / 浏览器
    function UpdatingOverlay() {
      return React.createElement(
        "div",
        { className: "duc-overlay" },
        React.createElement(
          "div",
          { className: "duc-overlay-card" },
          React.createElement("div", { className: "duc-overlay-spinner" }),
          React.createElement(
            "div",
            { className: "duc-overlay-title" },
            "升级进行中"
          ),
          React.createElement(
            "div",
            null,
            "正在更新 DeepSeek Harness 本体，请勿关闭 DSH 或浏览器。"
          ),
          React.createElement(
            "div",
            { className: "duc-overlay-warn" },
            "升级过程中关闭可能损坏 dsh 命令，需手动 npm install -g 修复。"
          )
        )
      );
    }

    function UpdatePage() {
      var state = React.useState({
        current: null,
        latest: null,
        hasUpdate: false,
        checking: false,
        updating: false,
        lastCheckError: null,
        updateResult: null,
        shimSnapshot: null,
        shimRecovery: null,
      });
      var s = state[0];
      var setS = state[1];
      var confirmState = React.useState(false);
      var confirmUpdate = confirmState[0];
      var setConfirmUpdate = confirmState[1];

      function applySnapshot(d) {
        if (!d || !d.ok) {
          setS(function (old) {
            return { ...old, checking: false, updating: false, lastCheckError: "无法连接宿主 API" };
          });
          return;
        }
        setS({
          current: d.current,
          latest: d.latest,
          hasUpdate: d.hasUpdate,
          checking: d.checking,
          updating: d.updating,
          lastCheckError: d.lastCheckError || null,
          updateResult: d.updateResult,
          shimSnapshot: d.shimSnapshot || null,
          shimRecovery: d.shimRecovery || null,
        });
      }

      React.useEffect(function () {
        fetchStatus().then(applySnapshot);
      }, []);

      // 更新进行中：轮询直到结束
      React.useEffect(function () {
        if (!s.updating) return;
        var id = setInterval(function () {
          fetchStatus().then(applySnapshot);
        }, 1500);
        return function () { clearInterval(id); };
      }, [s.updating]);

      function doCheck() {
        setS(function (old) { return { ...old, checking: true, checkFeedback: null }; });
        postCheck().then(function (d) {
          applySnapshot(d);
          if (!d || !d.ok) {
            setS(function (old) {
              return { ...old, checkFeedback: { kind: "error", text: "检查失败（无法连接宿主 API）", at: Date.now() } };
            });
            return;
          }
          var feedback = null;
          if (d.hasUpdate) {
            feedback = {
              kind: "new",
              text: "发现新版本 " + (d.latest || "?") + "，可一键更新",
              at: Date.now(),
            };
          } else if (d.current && d.latest) {
            feedback = {
              kind: "ok",
              text: "已是最新版本 " + d.current + "，无需更新",
              at: Date.now(),
            };
          } else {
            feedback = {
              kind: "ok",
              text: "检查完成（当前版本或最新版本信息不完整）",
              at: Date.now(),
            };
          }
          setS(function (old) { return { ...old, checkFeedback: feedback }; });
        });
      }

      function doUpdate() {
        setConfirmUpdate(false);
        setS(function (old) { return { ...old, updating: true, updateResult: null }; });
        postUpdate().then(applySnapshot);
      }

      var tag = null;
      if (s.updating) {
        tag = React.createElement("span", { className: "duc-tag duc-tag-busy" }, "升级中…");
      } else if (s.hasUpdate) {
        tag = React.createElement("span", { className: "duc-tag duc-tag-new" }, "有新版本");
      } else if (s.current && s.latest) {
        tag = React.createElement("span", { className: "duc-tag duc-tag-ok" }, "已是最新");
      }

      return React.createElement(
        "div",
        { className: "duc" },
        React.createElement("h3", { style: { marginTop: 0 } }, "更新"),
        React.createElement(
          "div",
          { className: "duc-card" },
          React.createElement(
            "div",
            { className: "duc-row" },
            React.createElement("span", { className: "duc-label" }, "当前版本"),
            React.createElement("span", { className: "duc-value" }, s.current || "未知"),
            tag
          ),
          React.createElement(
            "div",
            { className: "duc-row", style: { marginTop: "6px" } },
            React.createElement("span", { className: "duc-label" }, "最新版本"),
            React.createElement("span", { className: "duc-value" }, s.latest || "未知")
          ),
          React.createElement(
            "div",
            { className: "duc-actions" },
            React.createElement(
              "button",
              {
                className: "duc-btn",
                disabled: s.checking || s.updating,
                onClick: doCheck,
              },
              s.checking ? "检查中…" : "检查更新"
            ),
            s.hasUpdate && !s.updating
              ? (confirmUpdate
                  ? React.createElement(
                      "button",
                      {
                        className: "duc-btn duc-btn-danger",
                        disabled: s.updating,
                        onClick: doUpdate,
                      },
                      "确认升级到 " + (s.latest || "最新版") + "？"
                    )
                  : React.createElement(
                      "button",
                      {
                        className: "duc-btn duc-btn-primary",
                        disabled: s.updating,
                        onClick: function () { setConfirmUpdate(true); },
                      },
                      "一键更新"
                    ))
              : null
          ),
          s.checkFeedback
            ? React.createElement(
                "div",
                {
                  className:
                    "duc-note " +
                    (s.checkFeedback.kind === "new"
                      ? "duc-note-warn"
                      : s.checkFeedback.kind === "error"
                        ? "duc-note-err"
                        : "duc-note-ok"),
                },
                s.checkFeedback.text +
                  "（" +
                  new Date(s.checkFeedback.at).toLocaleTimeString("zh-CN", { hour12: false }) +
                  "）"
              )
            : null,
          s.lastCheckError
            ? React.createElement(
                "div",
                { className: "duc-note duc-note-err" },
                "检查失败：" + s.lastCheckError
              )
            : null,
          s.updateResult
            ? React.createElement(
                "div",
                null,
                s.updateResult.ok
                  ? React.createElement(
                      "div",
                      null,
                      React.createElement(
                        "div",
                        { className: "duc-note duc-note-ok" },
                        s.updateResult.message
                      ),
                      (function () {
                        var rec = s.updateResult.shimRecovery;
                        if (!rec) return null;
                        if (rec.recovered) {
                          return React.createElement(
                            "div",
                            { className: "duc-shim-recovered" },
                            rec.message || "dsh 命令已被自动恢复"
                          );
                        }
                        if (!rec.existsAfter) {
                          return React.createElement(
                            "div",
                            { className: "duc-shim-warn" },
                            rec.message || "dsh 命令升级后丢失，请手动修复"
                          );
                        }
                        return null;
                      })(),
                      React.createElement(
                        "div",
                        { className: "duc-restart" },
                        "升级完成：请重启 DSH 使新版本生效"
                      )
                    )
                  : React.createElement(
                      "div",
                      { className: "duc-note duc-note-err" },
                      "升级失败：" + (s.updateResult.message || "未知错误")
                    ),
                s.updateResult.output
                  ? React.createElement(
                      "pre",
                      { className: "duc-output" },
                      s.updateResult.output
                    )
                  : null
              )
            : null
        ),
        React.createElement(
          "div",
          { className: "duc-dim", style: { marginTop: "10px" } },
          "仅检查 DeepSeek Harness 本体（@deepseek-ai/dsh）。升级需执行 npm 全局安装，完成后请重启 DSH。"
        ),
        s.updating ? React.createElement(UpdatingOverlay, null) : null
      );
    }

    function apply(ctx) {
      injectCss();
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            id: "update-checker",
            order: 10,
            label: function () { return "更新"; },
          },
          UpdatePage
        );
      });
    }

    exports.name = "update-checker";
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});
