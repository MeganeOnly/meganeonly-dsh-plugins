    // ===== config =====
    // v0.3.0 RANGES 扩 granularity + window 字段。每个 range 决定页面上图与按模型表按哪个粒度切片。
    //   granularity ∈ 'day' | 'hour' | 'minute' | 'week'
    //   window 是在该粒度下取末尾多少桶；null = 该粒度默认（day=30, hour=168=7d, minute=1440=24h, week=全部）
    var RANGES = [
      { key: "all", label: "全部·日", granularity: "day", window: 30 },
      { key: "7", label: "近 7 日", granularity: "day", window: 7 },
      { key: "1", label: "今日", granularity: "day", window: 1 },
      { key: "h7", label: "近 7 日·小时", granularity: "hour", window: 168 },
      { key: "h1", label: "今日·小时", granularity: "hour", window: 24 },
      { key: "m1", label: "今日·分钟", granularity: "minute", window: 1440 },
      { key: "w12", label: "近 12 周", granularity: "week", window: 12 }
    ];

    /**
     * 兼容 v0.2.x 旧 localStorage 值：'all' / '30' / '7' / '1' 仍按日；其他 key 在 RANGES 找不到则回退到 'all'。
     */
    function rangeSpec(rangeKey) {
      for (var i = 0; i < RANGES.length; i++) {
        if (RANGES[i].key === rangeKey) return RANGES[i];
      }
      return RANGES[0];
    }

    /* ---------- 显示设置：可隐藏/展示各数据块，偏好持久化 ---------- */

    // 7 个数据块的可见性开关（key → 中文标签）。新增 section 时在此追加并配合 UsageStatsPageBody 渲染。
    // v0.2.2 新增 `heatmap`（GitHub 风格贡献热力图），插入在 chart 与 byModel 之间。
    var VISIBLE_KEYS = ["meta", "cards", "chart", "heatmap", "byModel", "topSessions", "tools"];
    var VISIBLE_LABELS = {
      meta: "顶部元信息（数据源 / 解码 / 生成耗时）",
      cards: "指标卡（6 张：会话 / 请求 / 未命中 / 输出 / 命中 / 速度）",
      chart: "近 30 天用量柱状图",
      heatmap: "贡献热力图（53 周 × 7 日）",
      byModel: "按模型分解表",
      topSessions: "会话用量 Top",
      tools: "工具调用 Top"
    };
    var STORAGE_VISIBLE_KEY = "dsh-usage-stats/visible-v1";

    /* ---------- 热力图模型筛选：独立 key 持久化（与 visibility 解耦） ---------- */
    // null = 全部模型聚合；非 null = 仅该 model 的 input/output 投影到每日。
    // schema 单值（model 字符串），不做版本号——任何非字符串值视为 null。
    var STORAGE_HEATMAP_MODEL_KEY = "dsh-usage-stats/heatmap-model-v1";
    function loadHeatmapModel() {
      if (!STORAGE_OK) return null;
      try {
        var v = localStorage.getItem(STORAGE_HEATMAP_MODEL_KEY);
        if (v == null || v === "null") return null;
        return typeof v === "string" && v.length > 0 ? v : null;
      } catch (e) { return null; }
    }
    function saveHeatmapModel(model) {
      if (!STORAGE_OK) return;
      try {
        if (model == null) localStorage.removeItem(STORAGE_HEATMAP_MODEL_KEY);
        else localStorage.setItem(STORAGE_HEATMAP_MODEL_KEY, String(model));
      } catch (e) {
        console.warn("[usage-stats] 保存热力图模型筛选失败:", e && e.message);
      }
    }

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