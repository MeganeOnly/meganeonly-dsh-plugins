// ===== formatters =====
    function fmtTokens(n) {
      if (n == null || !isFinite(n)) return "–";
      if (n < 1000) return String(n);
      if (n < 1e6) return (n / 1e3).toFixed(n < 1e5 ? 1 : 0) + "K";
      if (n < 1e9) return (n / 1e6).toFixed(n < 1e8 ? 1 : 0) + "M";
      return (n / 1e9).toFixed(2) + "B";
    }

    function fmtDuration(ms) {
      if (ms == null || !isFinite(ms)) return "–";
      var s = Math.round(ms / 1000);
      if (s < 60) return s + " 秒";
      var m = Math.round(s / 60);
      if (m < 60) return m + " 分钟";
      return (ms / 3600000).toFixed(1) + " 小时";
    }

    function fmtDate(ms) {
      if (ms == null) return "–";
      var d = new Date(ms + 8 * 3600 * 1000);
      var p = function (x) { return String(x).padStart(2, "0"); };
      return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate());
    }

    function fmtTime(ms) {
      var d = new Date(ms + 8 * 3600 * 1000);
      var p = function (x) { return String(x).padStart(2, "0"); };
      return p(d.getUTCHours()) + ":" + p(d.getUTCMinutes());
    }

    function fmtSpeed(tokens, ms) {
      if (!ms || !tokens) return "–";
      return (tokens / (ms / 1000)).toFixed(1) + " tok/s";
    }

    /**
     * 未命中输入 : 命中输入 : 输出，归一到未命中=1。
     * 例：未命中 1M、命中 220M、输出 50M → "1 : 220 : 50"。
     */
    function fmtRatio(miss, hit, output) {
      if (!miss) return "–";
      function part(v) {
        var r = v / miss;
        if (r >= 100) return String(Math.round(r));
        if (r >= 10) return r.toFixed(1);
        return r.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
      }
      return "1 : " + part(hit) + " : " + part(output);
    }

    /** 近 N 日窗口内的逐日桶求和（byDay 已是零填充的最近 30 天）。 */
    function sumDays(days) {
      var out = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 0 };
      for (var i = 0; i < days.length; i++) {
        var b = days[i];
        out.inputTokens += b.inputTokens || 0;
        out.outputTokens += b.outputTokens || 0;
        out.cacheReadTokens += b.cacheReadTokens || 0;
        out.cacheWriteTokens += b.cacheWriteTokens || 0;
        out.reasoningTokens += b.reasoningTokens || 0;
        out.requests += b.requests || 0;
      }
      return out;
    }

    /** 模型在时间窗口内的用量（无按日数据时回退全程合计）。 */
    function modelInView(m, winSet) {
      if (winSet == null || !m.days) {
        return { inputTokens: m.inputTokens, outputTokens: m.outputTokens, cacheReadTokens: m.cacheReadTokens, reasoningTokens: m.reasoningTokens, requests: m.requests };
      }
      var out = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, reasoningTokens: 0, requests: 0 };
      for (var day in m.days) {
        if (!winSet[day]) continue;
        var b = m.days[day];
        out.inputTokens += b.inputTokens || 0;
        out.outputTokens += b.outputTokens || 0;
        out.cacheReadTokens += b.cacheReadTokens || 0;
        out.reasoningTokens += b.reasoningTokens || 0;
        out.requests += b.requests || 0;
      }
      return out;
    }