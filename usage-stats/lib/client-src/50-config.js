// ===== config =====
    var RANGES = [
      { key: "all", label: "全部" },
      { key: "30", label: "近 30 日" },
      { key: "7", label: "近 7 日" },
      { key: "1", label: "今日" }
    ];

    /* ---------- 显示设置：可隐藏/展示各数据块，偏好持久化 ---------- */

    // 6 个数据块的可见性开关（key → 中文标签）。新增 section 时在此追加并配合 UsageStatsPageBody 渲染。
    var VISIBLE_KEYS = ["meta", "cards", "chart", "byModel", "topSessions", "tools"];
    var VISIBLE_LABELS = {
      meta: "顶部元信息（数据源 / 解码 / 生成耗时）",
      cards: "指标卡（6 张：会话 / 请求 / 未命中 / 输出 / 命中 / 速度）",
      chart: "近 30 天用量柱状图",
      byModel: "按模型分解表",
      topSessions: "会话用量 Top",
      tools: "工具调用 Top"
    };
    var STORAGE_VISIBLE_KEY = "dsh-usage-stats/visible-v1";

    function defaultVisible() {
      var out = {};
      for (var i = 0; i < VISIBLE_KEYS.length; i++) out[VISIBLE_KEYS[i]] = true;
      return out;
    }

    // localStorage 降级探测：QuotaExceededError / SecurityError → 偏好不持久化但功能仍可用
    var STORAGE_OK = (function () {
      try {
        if (typeof localStorage === "undefined") return false;
        localStorage.setItem("__dsh_usage_stats_probe__", "1");
        localStorage.removeItem("__dsh_usage_stats_probe__");
        return true;
      } catch (e) {
        console.warn("[usage-stats] localStorage 不可用，显示设置无法跨刷新保留:", e && e.message);
        return false;
      }
    })();

    function loadVisible() {
      if (!STORAGE_OK) return defaultVisible();
      try {
        var raw = localStorage.getItem(STORAGE_VISIBLE_KEY);
        if (raw == null) return defaultVisible();
        var parsed = JSON.parse(raw);
        if (parsed == null || typeof parsed !== "object") return defaultVisible();
        var out = defaultVisible();
        for (var i = 0; i < VISIBLE_KEYS.length; i++) {
          var k = VISIBLE_KEYS[i];
          if (typeof parsed[k] === "boolean") out[k] = parsed[k];
        }
        return out;
      } catch (e) {
        return defaultVisible();
      }
    }

    function saveVisible(v) {
      if (!STORAGE_OK) return;
      try {
        localStorage.setItem(STORAGE_VISIBLE_KEY, JSON.stringify(v));
      } catch (e) {
        console.warn("[usage-stats] 保存显示偏好失败:", e && e.message);
      }
    }

    function setAllVisible(val) {
      var out = {};
      for (var i = 0; i < VISIBLE_KEYS.length; i++) out[VISIBLE_KEYS[i]] = !!val;
      return out;
    }

    function toggleOne(visibility, key, val) {
      var out = {};
      for (var i = 0; i < VISIBLE_KEYS.length; i++) {
        var k = VISIBLE_KEYS[i];
        out[k] = (k === key) ? !!val : visibility[k];
      }
      return out;
    }