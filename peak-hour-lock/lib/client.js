/**
 * dsh-peak-hour-lock — 浏览器半端（web client bundle，作者：MeganeOnly）
 *
 * 打包格式与官方社区插件一致：window.__ModuleLoader__.load({ id, factory })。
 * 本包零外部依赖（不 require react 等），全部能力经 Cordis 上下文 ctx 取得。
 *
 * 机制（与 Host 半端配合）：
 * - 高峰期不再锁定输入框（ComposerBlock），用户照常输入发送；
 * - Host 半端在 agent/pre-step 拦截并暂存用户消息，高峰期结束后自动补发；
 * - 本端在输入框上方显示状态行：高峰期提示 + 已暂存条数 + 预计补发时刻
 *   （轮询宿主 /api/peak-hour-lock/status，失败时用本地北京时间兜底）。
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

    /** 输入框上方状态行：高峰期（或有暂存遗留）时显示，其余时间隐藏。 */
    function PeakStatusLine() {
      var state = React.useState({ inPeak: false, queued: 0, flushAt: null });
      var setState = state[1];
      React.useEffect(function () {
        var load = function () {
          fetch("/api/peak-hour-lock/status")
            .then(function (r) { return r.json(); })
            .then(function (d) {
              if (d && d.ok) setState({ inPeak: d.inPeak, queued: d.queued, flushAt: d.flushAt });
            })
            .catch(function () {
              // API 不可用（如宿主半端未加载）→ 本地兜底
              setState({ inPeak: inPeakWindow(), queued: 0, flushAt: null });
            });
        };
        load();
        var id = setInterval(load, 20000);
        return function () { clearInterval(id); };
      }, []);

      var s = state[0];
      if (!s.inPeak && s.queued === 0) return null;
      var text;
      if (s.inPeak) {
        text = "高峰期 发送将被暂存" + (s.queued > 0 ? "（已暂存 " + s.queued + " 条）" : "") +
          (s.flushAt ? "，" + formatBeijing(s.flushAt) + " 自动发出" : "");
      } else {
        text = "有 " + s.queued + " 条高峰期暂存消息" + (s.flushAt ? "，约 " + formatBeijing(s.flushAt) + " 自动发出" : "，即将自动发出");
      }
      return React.createElement(
        "div",
        { style: { padding: "4px 2px", fontSize: "12px", opacity: 0.85, color: "#b45309" } },
        text
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
