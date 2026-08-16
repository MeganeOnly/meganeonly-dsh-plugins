/**
 * dsh-peak-hour-lock — 浏览器半端（web client bundle，作者：MeganeOnly）
 *
 * 打包格式与官方社区插件一致：window.__ModuleLoader__.load({ id, factory })。
 * 本包零外部依赖（不 require react 等），全部能力经 Cordis 上下文 ctx 取得。
 *
 * 机制（与 Host 半端配合）：
 * - 高峰期不再锁定输入框（ComposerBlock），用户照常输入发送；
 * - Host 半端在 agent/pre-step 拦截并暂存用户消息，高峰期结束后自动补发
 *   （发回消息被拦截时所在的会话；会话不活跃时 Host 会自动从磁盘恢复）；
 * - 本端在输入框上方显示状态行：高峰期提示 + 已暂存条数 + 预计补发时刻
 *   （轮询宿主 /api/peak-hour-lock/status，失败时用本地北京时间兜底）；
 * - 状态行右侧“管理”按钮展开面板：查看 / 编辑 / 删除 / 立即发送暂存消息
 *   （经 /api/peak-hour-lock/queue）。
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

    function postQueue(body) {
      return fetch("/api/peak-hour-lock/queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then(function (r) { return r.json(); });
    }

    function fetchQueue() {
      return fetch("/api/peak-hour-lock/queue")
        .then(function (r) { return r.json(); })
        .then(function (d) { return d && d.ok ? d.entries : []; })
        .catch(function () { return null; });
    }

    var btnStyle = {
      fontSize: "12px",
      padding: "2px 10px",
      borderRadius: "4px",
      border: "1px solid #fcd34d",
      background: "#fff",
      color: "#92400e",
      cursor: "pointer",
    };

    /** 单条暂存消息：文本框 + 保存 / 删除 / 立即发送。 */
    function QueueItem(props) {
      var entry = props.entry;
      var draftState = React.useState(entry.text);
      var draft = draftState[0];
      var setDraft = draftState[1];
      var busyState = React.useState("");
      var busy = busyState[0];
      var setBusy = busyState[1];

      function act(promise, label) {
        setBusy(label);
        return promise
          .then(function (d) {
            if (!d || !d.ok) {
              setBusy(d && d.error === "session-unavailable" ? "发送失败：原会话无法恢复" : "操作失败");
              window.setTimeout(function () { setBusy(""); }, 4000);
              return false;
            }
            return true;
          })
          .catch(function () {
            setBusy("操作失败");
            return false;
          });
      }

      /** 立即发送：草稿有改动时先保存再发送，保证发出的是当前看到的内容。 */
      function sendNow() {
        setBusy("send");
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

      return React.createElement(
        "div",
        { style: { padding: "6px 0", borderBottom: "1px dashed #fde68a" } },
        React.createElement(
          "div",
          { style: { fontSize: "11px", opacity: 0.75, marginBottom: "4px" } },
          formatBeijing(entry.ts) +
            " · 发回原会话 " +
            String(entry.sessionId || "").replace(/^session-/, "").slice(0, 8) +
            (entry.blocked ? " · 自动补发失败，可手动处理" : "")
        ),
        React.createElement("textarea", {
          value: draft,
          onChange: function (e) { setDraft(e.target.value); },
          rows: Math.min(6, Math.max(2, draft.split("\n").length)),
          style: {
            width: "100%",
            boxSizing: "border-box",
            fontSize: "13px",
            padding: "4px 6px",
            borderRadius: "4px",
            border: "1px solid #fcd34d",
            background: "#fffbeb",
            fontFamily: "inherit",
          },
        }),
        React.createElement(
          "div",
          { style: { marginTop: "4px", display: "flex", gap: "6px", alignItems: "center" } },
          React.createElement(
            "button",
            {
              style: btnStyle,
              disabled: busy !== "" || draft === entry.text || draft.trim() === "",
              onClick: function () {
                act(postQueue({ action: "update", id: entry.id, text: draft }), "save").then(function (ok) {
                  if (ok) props.reload();
                });
              },
            },
            "保存修改"
          ),
          React.createElement(
            "button",
            {
              style: btnStyle,
              disabled: busy !== "" || draft.trim() === "",
              onClick: sendNow,
            },
            "立即发送"
          ),
          React.createElement(
            "button",
            {
              style: btnStyle,
              disabled: busy !== "",
              onClick: function () {
                act(postQueue({ action: "delete", id: entry.id }), "del").then(function (ok) {
                  if (ok) props.reload();
                });
              },
            },
            "删除"
          ),
          busy !== "" ? React.createElement("span", { style: { fontSize: "11px", opacity: 0.7 } },
            busy === "save" ? "保存中…" : busy === "send" ? "发送中…" : busy === "del" ? "删除中…" : busy) : null
        )
      );
    }

    /** 输入框上方状态行 + 可展开的暂存管理面板。 */
    function PeakStatusLine() {
      var state = React.useState({ inPeak: false, queued: 0, flushAt: null, blocked: 0 });
      var setState = state[1];
      var openState = React.useState(false);
      var open = openState[0];
      var setOpen = openState[1];
      var itemsState = React.useState(null);
      var items = itemsState[0];
      var setItems = itemsState[1];

      var openRef = React.useRef(false);
      openRef.current = open;

      var reloadQueue = React.useCallback(function () {
        fetchQueue().then(setItems);
      }, []);

      React.useEffect(function () {
        var load = function () {
          fetch("/api/peak-hour-lock/status")
            .then(function (r) { return r.json(); })
            .then(function (d) {
              if (d && d.ok) {
                setState({ inPeak: d.inPeak, queued: d.queued, flushAt: d.flushAt, blocked: d.blocked || 0 });
                if (openRef.current && d.queued > 0) reloadQueue();
                if (d.queued === 0) setOpen(false);
              }
            })
            .catch(function () {
              // API 不可用（如宿主半端未加载）→ 本地兜底
              setState({ inPeak: inPeakWindow(), queued: 0, flushAt: null, blocked: 0 });
            });
        };
        load();
        var id = setInterval(load, 20000);
        return function () { clearInterval(id); };
      }, []);

      React.useEffect(function () {
        if (open) reloadQueue();
      }, [open]);

      var s = state[0];
      if (!s.inPeak && s.queued === 0) return null;
      var text;
      if (s.inPeak) {
        text = "高峰期 发送将被暂存" + (s.queued > 0 ? "（已暂存 " + s.queued + " 条）" : "") +
          (s.flushAt ? "，" + formatBeijing(s.flushAt) + " 自动发出" : "");
      } else if (s.flushAt) {
        text = "有 " + s.queued + " 条高峰期暂存消息，约 " + formatBeijing(s.flushAt) + " 自动发回原会话";
      } else if (s.blocked > 0) {
        text = "有 " + s.queued + " 条暂存消息未能自动发出（原会话无法恢复），可编辑后手动发送或删除";
      } else {
        text = "有 " + s.queued + " 条高峰期暂存消息，即将自动发回原会话";
      }
      return React.createElement(
        "div",
        { style: { padding: "4px 2px", fontSize: "12px", color: "#b45309" } },
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "8px" } },
          React.createElement("span", { style: { opacity: 0.9 } }, text),
          s.queued > 0
            ? React.createElement(
                "button",
                {
                  style: {
                    fontSize: "11px",
                    padding: "1px 8px",
                    borderRadius: "4px",
                    border: "1px solid #fcd34d",
                    background: open ? "#fef3c7" : "#fff",
                    cursor: "pointer",
                    color: "#92400e",
                  },
                  onClick: function () { setOpen(!open); },
                },
                open ? "收起" : "管理"
              )
            : null
        ),
        open
          ? React.createElement(
              "div",
              {
                style: {
                  marginTop: "6px",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #fcd34d",
                  background: "#fffbeb",
                  maxHeight: "40vh",
                  overflowY: "auto",
                },
              },
              items === null
                ? React.createElement("div", { style: { fontSize: "12px", opacity: 0.7 } }, "读取中…")
                : items.length === 0
                  ? React.createElement("div", { style: { fontSize: "12px", opacity: 0.7 } }, "队列为空")
                  : items.map(function (entry) {
                      return React.createElement(QueueItem, { key: entry.id, entry: entry, reload: reloadQueue });
                    })
            )
          : null
      );
    }

    function apply(ctx) {
      ctx.slots.inject("conversation.input.dock", function () {
        return ctx.slots.register(
          { name: "conversation.input.dock", id: "peak-hour-lock-status", order: -10 },
          PeakStatusLine
        );
      });
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});
