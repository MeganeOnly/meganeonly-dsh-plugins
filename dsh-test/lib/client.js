/**
 * dsh-test — 浏览器半端（web client bundle）
 *
 * 最小的 client bundle 骨架：apply 阶段在右下角注入一枚固定徽标，
 * 并 fetch /api/test/hello 把响应正文写进徽标，证明 host 半端的端点
 * 也可联通（一次刷新覆盖"bundle 加载 + API 注册 + 跨端调用"三条链路）。
 *
 * 编码风格遵循 docs/maintainability.md § 三三：纯 ES5（无 const/let/
 * 箭头函数/async/模板字符串），唯一允许的箭头函数位置是 factory: (require) => {...}。
 *
 * CSS 注入遵循 dsh-persistent-plugin-authoring § 三：通过
 * data-plugin-css=<唯一id> 去重，避免 HMR / 重载时样式叠加。
 */window.__ModuleLoader__.load({
  id: "dsh-test",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var inject = [];

    // ===== CSS =====
    var CSS_MARKER = "dsh-test";
    var CSS_TEXT = "" +
      "[data-dsh-test-badge]{position:fixed;right:12px;bottom:12px;z-index:2147483647;" +
      "padding:6px 10px;border-radius:6px;background:rgba(0,0,0,0.72);color:#fff;" +
      "font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;" +
      "box-shadow:0 2px 8px rgba(0,0,0,0.25);pointer-events:auto;" +
      "user-select:none;opacity:0.92;transition:opacity .2s ease}" +
      "[data-dsh-test-badge]:hover{opacity:1}" +
      "[data-dsh-test-badge][data-state=\"err\"]" +
      "{background:rgba(160,32,32,0.85)}" +
      "[data-dsh-test-badge][data-state=\"ok\"]" +
      "{background:rgba(20,110,40,0.85)}";

    function injectCssOnce() {
      if (typeof document === "undefined" || !document.head) return;
      var existing = document.querySelector("style[data-plugin-css=\"" + CSS_MARKER + "\"]");
      if (existing) return;
      var style = document.createElement("style");
      style.dataset.pluginCss = CSS_MARKER;
      style.textContent = CSS_TEXT;
      document.head.appendChild(style);
    }

    // ===== badge DOM =====
    function createBadge() {
      var badge = document.createElement("div");
      badge.setAttribute("data-dsh-test-badge", "");
      badge.dataset.state = "loading";
      badge.textContent = "dsh-test: loading…";
      return badge;
    }

    function setBadge(badge, state, text) {
      if (!badge) return;
      badge.dataset.state = state;
      badge.textContent = text;
    }

    function fetchHello() {
      // 浏览器 fetch；DSH web profile 同源 → 走相对路径即可
      return fetch("/api/test/hello", { method: "GET", credentials: "same-origin" })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (body) {
          var version = body && typeof body.version === "string" ? body.version : "?";
          return "dsh-test v" + version + " ok";
        })
        .catch(function (err) {
          return "dsh-test ERR: " + (err && err.message ? err.message : String(err));
        });
    }

    // ===== apply =====
    function apply(ctx) {
      try {
        injectCssOnce();
      } catch (e) {
        // CSS 注入失败不应阻止徽标显示
        if (typeof console !== "undefined") console.warn("[dsh-test] injectCss failed", e);
      }
      var badge = createBadge();
      try {
        document.body.appendChild(badge);
      } catch (e) {
        // body 还没准备好（极端情况）→ 直接放弃，不抛错打断 loader
        if (typeof console !== "undefined") console.warn("[dsh-test] appendBadge failed", e);
        return;
      }
      // 异步获取 host 端响应，更新徽标状态
      fetchHello().then(function (text) {
        var state = text.indexOf("ERR") === 0 ? "err" : "ok";
        setBadge(badge, state, text);
      });
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});