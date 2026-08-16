/**
 * dsh-peak-hour-lock — 浏览器半端（web client bundle，作者：MeganeOnly）
 *
 * 打包格式与官方社区插件一致：window.__ModuleLoader__.load({ id, factory })。
 * 本包零外部依赖（不 require react 等），全部能力经 Cordis 上下文 ctx 取得。
 *
 * 机制（与 Host 半端配合）：
 * - 高峰期不锁定输入框，用户照常输入发送；Host 在 agent/pre-step 拦截并暂存，
 *   高峰期结束后自动补发回原会话（不活跃会话自动从磁盘恢复）；
 * - 输入框上方显示状态横幅：高峰期提示 + 已暂存条数 + 自动补发倒计时
 *   （入队条数增加时横幅闪烁提醒）；轮询宿主 /api/peak-hour-lock/status，
 *   API 不可用时用本地北京时间兜底；
 * - “管理”面板：卡片式条目（编辑 / 立即发送 / 删除二次确认），支持批量
 *   “全部发送 / 清空”；“立即发送”在高峰期内禁用（Host 亦有 409 守卫，
 *   避免 followup 再次被拦截导致循环入队）。
 *
 * 依赖经 require() 取得（react 由 shell 模块表提供）。
 */
window.__ModuleLoader__.load({
  id: "dsh-peak-hour-lock",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");

    var inject = ["slots"];

    var PEAK_1_START = 530; // 8:50
    var PEAK_1_END = 720; // 12:00
    var PEAK_2_START = 830; // 13:50
    var PEAK_2_END = 1080; // 18:00
    var OFFSET_MS = 2 * 60 * 1000;

    // ---------- 时间工具 ----------
    function beijingMinutes() {
      var now = new Date(Date.now() + 8 * 3600 * 1000);
      return now.getUTCHours() * 60 + now.getUTCMinutes();
    }

    function inPeakWindow() {
      var m = beijingMinutes();
      return (m >= PEAK_1_START && m < PEAK_1_END) || (m >= PEAK_2_START && m < PEAK_2_END);
    }

    function pad(n) {
      return String(n).padStart(2, "0");
    }

    /** 毫秒时间戳 → 北京时区 HH:MM。 */
    function formatBeijing(ms) {
      var d = new Date(ms + 8 * 3600 * 1000);
      return pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes());
    }

    /** 当日北京时间的分钟数 → 绝对毫秒时间戳。 */
    function beijingDateAt(minutes) {
      var now = new Date(Date.now() + 8 * 3600 * 1000);
      var start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      return start - 8 * 3600 * 1000 + minutes * 60 * 1000;
    }

    /** 当前高峰期的预计补发时刻（未入队时本地兜底用）。 */
    function nextFlushAt() {
      var m = beijingMinutes();
      if (m >= PEAK_1_START && m < PEAK_1_END) return beijingDateAt(PEAK_1_END) + OFFSET_MS;
      if (m >= PEAK_2_START && m < PEAK_2_END) return beijingDateAt(PEAK_2_END) + OFFSET_MS;
      return null;
    }

    /** 毫秒剩余 → “X 小时 X 分 / X 分 X 秒 / X 秒”。 */
    function formatRemaining(ms) {
      if (ms <= 0) return "即将";
      var s = Math.ceil(ms / 1000);
      if (s < 60) return s + " 秒";
      var m = Math.floor(s / 60);
      s = s % 60;
      if (m < 60) return m + " 分 " + s + " 秒";
      var h = Math.floor(m / 60);
      m = m % 60;
      return h + " 小时 " + m + " 分";
    }

    /** 当日分钟数 → “HH:MM”。 */
    function formatMinutes(m) {
      return pad(Math.floor(m / 60)) + ":" + pad(m % 60);
    }

    function shortSession(id) {
      return String(id || "").replace(/^session-/, "").slice(0, 8);
    }

    // ---------- API ----------
    function postQueue(body) {
      return fetch("/api/peak-hour-lock/queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then(function (r) { return r.json(); });
    }

    /** 失败返回 null（调用方保留旧列表并提示）。 */
    function fetchQueue() {
      return fetch("/api/peak-hour-lock/queue")
        .then(function (r) { return r.json(); })
        .then(function (d) { return d && d.ok ? d.entries : null; })
        .catch(function () { return null; });
    }

    function fetchStatus() {
      return fetch("/api/peak-hour-lock/status")
        .then(function (r) { return r.json(); })
        .catch(function () { return null; });
    }

    // ---------- 样式 ----------
    var CSS_TEXT = [
      ".dsh-phl{font-size:12px;color:#78350f;line-height:1.5}",
      ".dsh-phl-banner{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px;background:#fef3c7;border:1px solid #fcd34d}",
      ".dsh-phl-dot{width:8px;height:8px;border-radius:50%;background:#f59e0b;flex:none}",
      ".dsh-phl-msg{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".dsh-phl-flash{animation:dsh-phl-flash 1.4s ease-out}",
      "@keyframes dsh-phl-flash{0%{box-shadow:0 0 0 2px rgba(245,158,11,.55)}100%{box-shadow:0 0 0 2px rgba(245,158,11,0)}}",
      ".dsh-phl-btn{font-size:12px;padding:3px 10px;border-radius:6px;border:1px solid #e7c98a;background:#fff;color:#92400e;cursor:pointer;transition:background .15s,border-color .15s,transform .05s}",
      ".dsh-phl-btn:hover:not(:disabled){background:#fff7e6;border-color:#eec96b}",
      ".dsh-phl-btn:active:not(:disabled){transform:translateY(1px)}",
      ".dsh-phl-btn:disabled{opacity:.45;cursor:default}",
      ".dsh-phl-btn-primary{background:#f59e0b;border-color:#d97706;color:#fff}",
      ".dsh-phl-btn-primary:hover:not(:disabled){background:#fbbf24;border-color:#d97706}",
      ".dsh-phl-btn-danger{color:#b91c1c;border-color:#f3c1c1}",
      ".dsh-phl-btn-danger:hover:not(:disabled){background:#fef2f2;border-color:#ef9a9a}",
      ".dsh-phl-panel{margin-top:8px;padding:10px;border-radius:10px;border:1px solid #fcd34d;background:#fffbeb;max-height:45vh;overflow-y:auto}",
      ".dsh-phl-header{display:flex;align-items:center;gap:8px;margin-bottom:4px}",
      ".dsh-phl-title{font-weight:600;color:#92400e}",
      ".dsh-phl-count{font-size:11px;padding:0 7px;border-radius:999px;background:#f59e0b;color:#fff;line-height:16px}",
      ".dsh-phl-spacer{flex:1}",
      ".dsh-phl-note{font-size:11px;color:#b91c1c;padding:2px 0 4px}",
      ".dsh-phl-item{background:#fff;border:1px solid #f2e3bd;border-radius:8px;padding:8px 10px;margin-top:8px}",
      ".dsh-phl-meta{font-size:11px;color:#926b3c;display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px}",
      ".dsh-phl-tag{padding:1px 7px;border-radius:999px;font-size:10px;border:1px solid}",
      ".dsh-phl-tag-ok{color:#15803d;border-color:#bbf7d0;background:#f0fdf4}",
      ".dsh-phl-tag-bad{color:#b91c1c;border-color:#fecaca;background:#fef2f2}",
      ".dsh-phl-textarea{width:100%;box-sizing:border-box;font-size:13px;font-family:inherit;padding:6px 8px;border-radius:6px;border:1px solid #e7c98a;background:#fffdf5;resize:vertical;outline:none;transition:border-color .15s,box-shadow .15s}",
      ".dsh-phl-textarea:focus{border-color:#f59e0b;box-shadow:0 0 0 2px rgba(245,158,11,.18)}",
      ".dsh-phl-actions{margin-top:6px;display:flex;gap:6px;align-items:center;justify-content:flex-end;flex-wrap:wrap}",
      ".dsh-phl-empty{font-size:12px;color:#a17a44;padding:10px 0 4px;text-align:center}",
      ".dsh-phl-foot{margin-top:8px;font-size:11px;color:#a17a44}",
    ].join("");

    function injectCss() {
      if (document.querySelector("style[data-plugin-css='dsh-peak-hour-lock']")) return;
      var style = document.createElement("style");
      style.dataset.pluginCss = "dsh-peak-hour-lock";
      style.textContent = CSS_TEXT;
      document.head.appendChild(style);
    }

    // ---------- 组件 ----------
    function Btn(props) {
      var cls = "dsh-phl-btn";
      if (props.kind === "primary") cls += " dsh-phl-btn-primary";
      else if (props.kind === "danger") cls += " dsh-phl-btn-danger";
      return React.createElement("button", {
        className: cls,
        disabled: props.disabled,
        title: props.title || undefined,
        onClick: props.onClick,
      }, props.children);
    }

    /** 单条暂存消息卡片：文本编辑 + 保存 / 立即发送 / 删除（二次确认）。 */
    function QueueItem(props) {
      var entry = props.entry;
      var draftState = React.useState(entry.text);
      var draft = draftState[0];
      var setDraft = draftState[1];
      var busyState = React.useState("");
      var busy = busyState[0];
      var setBusy = busyState[1];
      var confirmState = React.useState(false);
      var confirmDel = confirmState[0];
      var setConfirmDel = confirmState[1];

      function act(promise, label) {
        setBusy(label);
        return promise
          .then(function (d) {
            if (!d || !d.ok) {
              var msg = "操作失败";
              if (d && d.error === "in-peak") msg = "高峰期间不能立即发送";
              else if (d && d.error === "session-unavailable") msg = "发送失败：原会话无法恢复";
              setBusy(msg);
              window.setTimeout(function () { setBusy(""); }, 4000);
              return false;
            }
            return true;
          })
          .catch(function () {
            setBusy("操作失败");
            window.setTimeout(function () { setBusy(""); }, 4000);
            return false;
          });
      }

      /** 立即发送：草稿有改动时先保存再发送，保证发出的是当前看到的内容。 */
      function sendNow() {
        var go = function () {
          act(postQueue({ action: "send", id: entry.id }), "send").then(function (ok) {
            if (ok) props.reload();
          });
        };
        if (draft !== entry.text && draft.trim() !== "") {
          act(postQueue({ action: "update", id: entry.id, text: draft }), "save").then(function (ok) {
            if (!ok) return;
            go();
          });
        } else {
          go();
        }
      }

      function askDelete() {
        setConfirmDel(true);
        window.setTimeout(function () { setConfirmDel(false); }, 3000);
      }

      var disabled = busy !== "" || props.busyAll;
      var busyText = busy === "save" ? "保存中…" : busy === "send" ? "发送中…" : busy === "del" ? "删除中…" : busy;

      return React.createElement(
        "div",
        { className: "dsh-phl-item" },
        React.createElement(
          "div",
          { className: "dsh-phl-meta" },
          React.createElement("span", null, formatBeijing(entry.ts)),
          React.createElement("span", null, "会话 " + shortSession(entry.sessionId)),
          React.createElement(
            "span",
            { className: entry.blocked ? "dsh-phl-tag dsh-phl-tag-bad" : "dsh-phl-tag dsh-phl-tag-ok" },
            entry.blocked ? "补发失败" : "待补发"
          )
        ),
        React.createElement("textarea", {
          className: "dsh-phl-textarea",
          value: draft,
          disabled: props.busyAll,
          onChange: function (e) { setDraft(e.target.value); },
          rows: Math.min(6, Math.max(2, draft.split("\n").length)),
        }),
        React.createElement(
          "div",
          { className: "dsh-phl-actions" },
          React.createElement(
            Btn,
            {
              disabled: disabled || draft === entry.text || draft.trim() === "",
              onClick: function () {
                act(postQueue({ action: "update", id: entry.id, text: draft }), "save").then(function (ok) {
                  if (ok) props.reload();
                });
              },
            },
            "保存修改"
          ),
          React.createElement(
            Btn,
            {
              kind: "primary",
              disabled: disabled || draft.trim() === "" || props.inPeak,
              title: props.inPeak ? "高峰期间不能立即发送" : undefined,
              onClick: sendNow,
            },
            "立即发送"
          ),
          confirmDel
            ? React.createElement(
                Btn,
                {
                  kind: "danger",
                  disabled: busy !== "",
                  onClick: function () {
                    act(postQueue({ action: "delete", id: entry.id }), "del").then(function (ok) {
                      if (ok) props.reload();
                    });
                  },
                },
                "确认删除"
              )
            : React.createElement(
                Btn,
                {
                  kind: "danger",
                  disabled: busy !== "",
                  onClick: askDelete,
                },
                "删除"
              ),
          busy !== ""
            ? React.createElement("span", { style: { fontSize: "11px", opacity: 0.7, color: "#926b3c" } }, busyText)
            : null
        )
      );
    }

    /** 管理面板：标题 + 批量操作 + 条目列表 + 高峰时段说明。 */
    function PeakPanel(props) {
      var items = props.items;
      var reload = props.reload;
      var inPeak = props.inPeak;
      var config = props.config;

      var busyState = React.useState(false);
      var busyAll = busyState[0];
      var setBusyAll = busyState[1];
      var clearState = React.useState(false);
      var confirmClear = clearState[0];
      var setConfirmClear = clearState[1];
      var noteState = React.useState("");
      var note = noteState[0];
      var setNote = noteState[1];

      function sendAll() {
        if (!items || items.length === 0) return;
        setBusyAll(true);
        setNote("");
        var seq = Promise.resolve();
        var failed = 0;
        items.forEach(function (entry) {
          seq = seq.then(function () {
            return postQueue({ action: "send", id: entry.id }).then(function (d) {
              if (!d || !d.ok) failed += 1;
            });
          });
        });
        seq
          .then(function () {
            setBusyAll(false);
            if (failed > 0) {
              setNote(failed + " 条发送失败（原会话不可用），已保留在队列中");
              window.setTimeout(function () { setNote(""); }, 6000);
            }
            reload();
          })
          .catch(function () {
            setBusyAll(false);
            setNote("发送中断，请重试");
            window.setTimeout(function () { setNote(""); }, 6000);
            reload();
          });
      }

      function clearAll() {
        postQueue({ action: "clear" }).then(function (d) {
          if (d && d.ok) reload();
        });
      }

      function askClear() {
        setConfirmClear(true);
        window.setTimeout(function () { setConfirmClear(false); }, 3000);
      }

      var count = items && items.length;

      return React.createElement(
        "div",
        { className: "dsh-phl-panel" },
        React.createElement(
          "div",
          { className: "dsh-phl-header" },
          React.createElement("span", { className: "dsh-phl-title" }, "暂存队列"),
          count ? React.createElement("span", { className: "dsh-phl-count" }, count) : null,
          React.createElement("span", { className: "dsh-phl-spacer" }),
          React.createElement(
            Btn,
            {
              kind: "primary",
              disabled: busyAll || !count || inPeak,
              title: inPeak ? "高峰期间不能立即发送" : undefined,
              onClick: sendAll,
            },
            busyAll ? "发送中…" : "全部发送"
          ),
          confirmClear
            ? React.createElement(
                Btn,
                { kind: "danger", disabled: busyAll || !count, onClick: clearAll },
                "确认清空"
              )
            : React.createElement(
                Btn,
                { kind: "danger", disabled: busyAll || !count, onClick: askClear },
                "清空"
              )
        ),
        note !== "" ? React.createElement("div", { className: "dsh-phl-note" }, note) : null,
        items === null
          ? React.createElement("div", { className: "dsh-phl-empty" }, props.loadFailed ? "读取失败，稍后自动重试" : "读取中…")
          : items.length === 0
            ? React.createElement("div", { className: "dsh-phl-empty" }, "队列为空")
            : items.map(function (entry) {
                return React.createElement(QueueItem, {
                  key: entry.id,
                  entry: entry,
                  reload: reload,
                  inPeak: inPeak,
                  busyAll: busyAll,
                });
              }),
        config
          ? React.createElement(
              "div",
              { className: "dsh-phl-foot" },
              "高峰时段 " +
                formatMinutes(config.peak1[0]) + "–" + formatMinutes(config.peak1[1]) +
                " / " +
                formatMinutes(config.peak2[0]) + "–" + formatMinutes(config.peak2[1]) +
                "，结束后约 " + config.offsetMinutes + " 分钟自动补发"
            )
          : null
      );
    }

    /** 输入框上方状态横幅 + 可展开的暂存管理面板。 */
    function PeakStatusLine() {
      var statusState = React.useState({ inPeak: false, queued: 0, flushAt: null, blocked: 0, config: null });
      var setStatus = statusState[1];
      var openState = React.useState(false);
      var open = openState[0];
      var setOpen = openState[1];
      var itemsState = React.useState(null);
      var items = itemsState[0];
      var setItems = itemsState[1];
      var tickState = React.useState(Date.now());
      var setTick = tickState[1];
      var flashState = React.useState(false);
      var setFlash = flashState[1];
      var failState = React.useState(false);
      var setLoadFailed = failState[1];

      var openRef = React.useRef(false);
      openRef.current = open;
      var prevQueuedRef = React.useRef(0);
      var initedRef = React.useRef(false);
      var flashTimerRef = React.useRef(null);

      var reloadQueue = React.useCallback(function () {
        fetchQueue().then(function (list) {
          setItems(list);
          setLoadFailed(list === null);
        });
      }, []);

      React.useEffect(function () {
        var load = function () {
          fetchStatus().then(function (d) {
            if (!d || !d.ok) {
              // API 不可用（如宿主半端未加载）→ 本地兜底
              setStatus({ inPeak: inPeakWindow(), queued: 0, flushAt: null, blocked: 0, config: null });
              return;
            }
            setStatus({ inPeak: d.inPeak, queued: d.queued, flushAt: d.flushAt, blocked: d.blocked || 0, config: d.config });
            // 入队条数增加 → 横幅闪烁提醒
            if (initedRef.current && d.queued > prevQueuedRef.current && d.inPeak) {
              setFlash(true);
              if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
              flashTimerRef.current = window.setTimeout(function () { setFlash(false); }, 1600);
            }
            prevQueuedRef.current = d.queued;
            initedRef.current = true;
            if (openRef.current && d.queued > 0) reloadQueue();
            if (d.queued === 0) setOpen(false);
          });
        };
        load();
        var id = setInterval(load, 20000);
        return function () { clearInterval(id); };
      }, []);

      // 倒计时秒级刷新
      React.useEffect(function () {
        var id = setInterval(function () { setTick(Date.now()); }, 1000);
        return function () { clearInterval(id); };
      }, []);

      React.useEffect(function () {
        if (open) reloadQueue();
      }, [open]);

      var s = statusState[0];
      if (!s.inPeak && s.queued === 0) return null;

      var flushTarget = s.flushAt;
      if (!flushTarget && s.inPeak) flushTarget = nextFlushAt();
      var remaining = flushTarget ? formatRemaining(flushTarget - tickState[0]) : null;

      var text;
      if (s.inPeak) {
        text = "高峰时段 · 消息将暂存" + (s.queued > 0 ? "，已暂存 " + s.queued + " 条" : "");
        if (remaining) text += " · 约 " + remaining + " 后自动发出";
      } else if (remaining) {
        text = s.queued + " 条暂存消息 · 约 " + remaining + " 后自动发回原会话";
      } else if (s.blocked > 0) {
        text = s.queued + " 条暂存消息未能自动发出（原会话无法恢复），可编辑后手动发送或删除";
      } else {
        text = s.queued + " 条暂存消息 · 即将自动发回原会话";
      }

      return React.createElement(
        "div",
        { className: "dsh-phl" },
        React.createElement(
          "div",
          { className: "dsh-phl-banner" + (flash ? " dsh-phl-flash" : "") },
          s.inPeak ? React.createElement("span", { className: "dsh-phl-dot" }) : null,
          React.createElement("span", { className: "dsh-phl-msg" }, text),
          s.queued > 0
            ? React.createElement(
                Btn,
                { onClick: function () { setOpen(!open); } },
                open ? "收起" : "管理"
              )
            : null
        ),
        open
          ? React.createElement(PeakPanel, {
              items: items,
              reload: reloadQueue,
              inPeak: s.inPeak,
              config: s.config,
              loadFailed: failState[0],
            })
          : null
      );
    }

    function apply(ctx) {
      injectCss();
      ctx.slots.inject("conversation.input.dock", function () {
        return ctx.slots.register(
          { name: "conversation.input.dock", id: "peak-hour-lock-status", order: -10 },
          PeakStatusLine
        );
      });
    }

    exports.name = "peak-hour-lock";
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});
