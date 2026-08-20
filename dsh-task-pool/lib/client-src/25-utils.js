    // ===== utils =====
    // ===== 工具函数 =====
    function uuid() {
      var c = globalThis.crypto;
      if (c && c.getRandomValues) {
        var b = c.getRandomValues(new Uint8Array(16));
        b[6] = b[6] & 15 | 64;
        b[8] = b[8] & 63 | 128;
        var hex = "";
        for (var i = 0; i < 16; i++) hex += (b[i] + 256).toString(16).slice(1);
        return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
      }
      return "t-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    }

    function pad2(n) { return String(n).padStart(2, "0"); }
    function beijingDate(ms) { return new Date(ms + 8 * 3600 * 1000); }

    function relativeTime(ms) {
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

    function beijingDateTime(ms) {
      var dt = beijingDate(ms);
      return dt.getUTCFullYear() + "-" + pad2(dt.getUTCMonth() + 1) + "-" + pad2(dt.getUTCDate())
        + " " + pad2(dt.getUTCHours()) + ":" + pad2(dt.getUTCMinutes());
    }

