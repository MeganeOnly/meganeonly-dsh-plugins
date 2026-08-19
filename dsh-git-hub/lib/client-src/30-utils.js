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

