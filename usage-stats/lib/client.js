/**
 * dsh-usage-stats — 浏览器半端（web client bundle，作者：MeganeOnly）
 *
 * 设置 → "使用统计"页。全部数据来自宿主半端 /api/usage-stats/summary
 * （跨会话聚合：token 用量 / 按日趋势 / 按模型 / 会话与工具排行）。
 * 纯展示 + 手动刷新，零外部依赖（react 经 require 取自 shell 模块表）。
 *
 * v0.2.0 新增「显示设置」：页面右上角弹出复选框面板，可独立隐藏/展示
 * 6 个数据块（顶部元信息、指标卡、近 30 天用量图、按模型分解表、
 * 会话用量 Top、工具调用 Top），偏好持久化到 localStorage。
 *
 * v0.2.x 美术度升级：用量图新增 4 条参考线（25/50/75/100%）+ today
 * 竖线 + peak 浮动徽章 + 摘要脚注；图例移入图表顶部并加上 today
 * 日期加粗；图表专用色 token（peakLine 暖陶土、todayLine 中灰、
 * gridDashed/gridBase 浅虚线）。
 *
 * v0.2.1 调色板升级：原"灰+饱和绿"二元对比替换为「蓝-橙」主对
 * （#3b82f6 输入 / #f59e0b 输出），rose-600 单独强调峰值日。
 * 色盲安全（blue/orange 主对）+ 与非图表绿色 accent 拉开层次。
 * 见 `lib/client-src/30-styles.js` 头部注释的设计原则与参考来源。
 *
 * v0.2.2 新增「贡献热力图」：GitHub 风格 53 周 × 7 日方格日历。
 * v0.3.1 调色板改为绿色单色相（用户反馈"大的颜色不改变，只要绿色"）：5 级
 * 仅改明度，不切色相，对齐 GitHub 贡献日历视觉语言。
 * v0.3.2 级别扩 5 → 7（用户反馈"级别多一点"）：阈值细分
 * （1-5% / 5-15% / 15-30% / 30-50% / 50-70% / 70-90% / ≥90%），
 * 中间多插 3 档让日常用量（1-30%）明暗变化更细腻。色阶
 *（`#c6e6ce` / `#9be9a8` / `#7ac281` / `#40c463` / `#30a14e` /
 * `#216e39` / `#0e4429`）。
 * v0.3.3 修复 HeatmapCalendar 渲染异常：`Cannot read properties of undefined (reading 'day')`——
 * v0.3.0 重构 daySeries 后 HeatmapCalendar 内部硬编码 `day.day` 在 host 半段中间状态时抛错；
 * v0.3.3 客户端改用 `dayKey(d) = d.bucket != null ? d.bucket : d.day` 兼容 day/bucket 双 shape
 *（对齐 DayChart `bucketKey` 策略）+ 加 `days[di] == null` 守卫 + `HeatmapCalendar(d.byDay || [], ...)` 防御
 * + host `daySeries` 输出元素同时给 `day` + `bucket` 冗余字段。
 * v0.3.4 治本：所有 `d.X` 直接访问改用顶部声明的 `safeX = d.X || fallback` 兜底（safeByTrend / safeTotals / safeByModel / safeTopSessions / safeTools 五条路径全覆盖）+ catch block 加 `console.error` self-diagn dump d 的关键字段，下次出错 DevTools Console 直接打印哪个字段 undefined / 数组长度 / keys，根来源定位无需 stack trace。
 * 模型筛选独立持久化（localStorage `dsh-usage-stats/heatmap-model-v1`，
 * null = 全部模型聚合；非 null = 仅该模型贡献的 input/output）。
 * 显示设置 7 块 schema 扩 `heatmap` 字段，隐式迁移（缺字段默认 true）。
 * 详见 `lib/client-src/40-components.js` 的 HeatmapCalendar 与
 * `lib/client-src/50-config.js` 的 loadHeatmapModel / saveHeatmapModel。
 *
 * v0.3.0 两特性合并发布：
 *   (a) 子代理消耗归并 — host 解析 DSH SessionHeader 的 parentSession /
 *       delegationDepth / origin 字段（schema 见 dsh-session-persistence-jsonl
 *       README § SessionHeader），把每个 subagent 的 token 沿 parentSession
 *       chain rollup 到 root main session（counts speak in main sessions only，
 *       token lands on its owner）。sessionCount 现在是 root 数；新增
 *       rawSessionCount 保留原始 session 数供高级排查。
 *   (b) 多粒度趋势 — host 端 aggregateSession 同时写 hours / /minutes 桶，
 *       summary 输出 byTrend = { minute / /hour / /day / / /week } 四种粒度零填充序列。
 *       客户端 RANGES 加 7 个 range（兼容 v0.2.x 'all' / '30' / '7' / '1'）：
 *         'all' / '7' / '1' — 按日窗口（day）
 *         'h7' / 'h1' — 按小时（hour / minute）
 *         'm1' — 按分钟（minute）
 *         'w12' — 按周（week，ISO 周一折叠）
 *       DayChart 接受 granularity 参数自适应柱宽（minute 极窄 + overflow-x
 *       auto 滚动）+ X 轴标签按粒度格式（MM-DD / MM-DD HH / MM-DD HH:mm / 周一日期）。
 *       CACHE_VERSION v2 → v4 跳号（中间 v3 不暴露避免用户白经历一次缓存作废重算）。
 *
 * v0.3.6 host 半段 bugfix 审计（lib/index.js）：
 *   (a) 缓存从未被读回 → apply 启动时新增 cacheReady = loadCache(cachePath)
 *       门控所有 summary；DSH 重启后第二次起的请求不再全量重解码。
 *   (b) 跨项目 session 缓存键冲突 → file.id 从 sessionDir.name 升级为
 *       `<projectDir>/<sessionDir>`，CACHE_VERSION 4 → 5 强制一次重算。
 *   (c) tool/call 缺 callId 时不写 pendingCalls/callNames（仍计入 calls），
 *       避免 undefined 键与 tool/result 误配对污染 toolMs。
 *   (d) assistant/message 缺 event.time 时不进任何时间粒度桶，避免污染
 *       1970-01-01 的按日 / 按小时 / 按分钟三组数据。
 *   客户端无变更，但 bundle 仍走 build-client.cjs 重新生成以保持字节同步。
 *
 * v0.3.7 host 半段数字硬化（lib/index.js）：
 *   收敛所有数字入口到 toFiniteNumber(value) — 仅在 value 是有限 number 时
 *   返回原值；NaN / Infinity / -Infinity / 字符串 / null / undefined / 对象
 *   / 数组 / boolean 一律返回 0。修复 v0.3.6 残留的两个漏洞：
 *   (a) `usage.X || 0` 只挡 undefined / null / 0 / ""；对 Infinity / "abc"
 *       / "5" / NaN(侥幸) 仍有污染路径（Infinity 直传 → bucket 变 Infinity；
 *       "abc" → NaN；"5" → 误接受脏数据）。
 *   (b) `typeof event.time === 'number'` 守卫对 NaN / Infinity 都判 true
 *       （typeof 都返回 'number'），让 beijingDayKey(NaN) → "Invalid Da" 污染
 *       按日 / 按小时 / 按分钟桶；toolMs / llmMs 计算产生 NaN 让 UI 显示
 *       "NaN ms"。
 *   应用范围：addUsage 所有 token 字段 + assistant/message 的 usage 写入守卫
 *   + step/start.openStep.time + tool/call.pendingCalls 落库条件
 *   + tool/result.elapsed + assistant/message llmMs 增量 + lastTs 跟踪。
 *   客户端无变更（纯 host 端聚合硬化），bundle 仍走 build-client.cjs 重新生成
 *   以保持 banner 注释字节同步。
 *
 * v0.3.9 历史全量日序列 + 「全部」图表 / 热力图跨 30 天边界（host + client）：
 *   host 端在 summary payload 新增 `byDayAll` 字段——把所有 root.days 合并、
 *   按 yyyy-mm-dd 升序、**不零填充**输出；shape 与 daySeries 一致（`{ day, bucket, ... }`）。
 *   现版 byDay 是近 30 天零填充，超过 30 天的历史完全丢失，且活动稀疏时会出现
 *   一长串"今天用了 0 token"的视觉断点。byDayAll 解决这两个问题。
 *   客户端：
 *     (a) 「全部」图表改用 byDayAll，限最近 53 周（371 天）避免无限长 series
 *         把图压成色带（与热力图 53 周上限对齐）。
 *     (b) 热力图优先用 byDayAll；老 host（v0.3.8.x 及更早，无 byDayAll）回退 byDay
 *         ——完全向后兼容，无字段就退化到旧的"近 30 天"视图。
 *     (c) byTrend / RANGES 不动（h7 / m1 / week 等窗口仍走 byTrend）。
 *   行为：用户上次活动是 60 天前时，进「全部」图表能看到 60 天前那根柱、
 *   热力图能看到 8 周前那一格；之前这两个组件都因超过 30 天零填充而空白。
 *   `CACHE_VERSION` 不变（6 → 6）；aggregateSession 输出的 `agg.days` 始终完整，
 *   byDayAll 派生不需要重解码已有缓存——用户首次请求自然走 re-derive 路径。
 *
 * v0.5.0 架构切换（host 半段重写，客户端随之适配）：
 *   host 从"单体缓存 + 整文件重解码 + 每次请求重算"改为
 *   "每会话记录（水位 + 前缀锚）+ 帧级续读 + 快照 memo"：
 *     (a) 失效键从 header.createdAt（永不变化 → 活跃会话被永久冻结）
 *         改为文件修订令牌 dev:ino:size:mtimeNs:ctimeNs + 日志世代号；
 *     (b) 只读新增字节、只解新增 zstd 帧（水位 lastSeq 去重，撕裂尾帧丢弃重读）；
 *     (c) 分钟桶 48h / 小时桶 15d 裁剪，桶表不再无界增长；
 *     (d) 请求永远立即返回"已发布快照"，扫描在后台单飞推进。
 *   客户端因此新增：
 *     - ScanStatus 状态行（scanning 进度 / legacy 旧缓存占位 / idle 新鲜度 /
 *       errorCount 警示配色），渲染在标题行下方；
 *     - scanning 或 legacy 时 2s 轮询（上限 60 次），完成后自动停在最新数据；
 *     - 「刷新」= ?force=1（只重折有变化的会话）、「全量重算」= ?rebuild=1
 *       （旧存储整体改名后从零重算，界面显示进度）；
 *     - 元信息行改用 discovery / decoded / reused / dataAsOf（host 已移除 home 字段）。
 */window.__ModuleLoader__.load({
  id: "dsh-usage-stats",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");
    var inject = ["slots"];

    var API = "/api/usage-stats/summary";    // ===== formatters =====
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
      return sumBuckets(days);
    }

    /** v0.3.0 多粒度桶求和：byTrend 各粒度共用 { bucket, ...bucket } shape。 */
    function sumBuckets(buckets) {
      var out = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, requests: 0 };
      if (buckets == null) return out;
      for (var i = 0; i < buckets.length; i++) {
        var b = buckets[i];
        out.inputTokens += b.inputTokens || 0;
        out.outputTokens += b.outputTokens || 0;
        out.cacheReadTokens += b.cacheReadTokens || 0;
        out.cacheWriteTokens += b.cacheWriteTokens || 0;
        out.reasoningTokens += b.reasoningTokens || 0;
        out.requests += b.requests || 0;
      }
      return out;
    }

    /** v0.3.0 按桶 key 格式化（byTrend[granularity] 用）。 */
    function fmtBucket(key, granularity) {
      if (key == null) return "";
      if (granularity === "minute") {
        // YYYY-MM-DDTHH:mm → MM-DD HH:mm
        var sp = key.split("T");
        if (sp.length !== 2) return key;
        return sp[0].slice(5) + " " + sp[1];
      }
      if (granularity === "hour") {
        // YYYY-MM-DDTHH → MM-DD HH
        var sp2 = key.split("T");
        if (sp2.length !== 2) return key;
        return sp2[0].slice(5) + " " + sp2[1] + "h";
      }
      if (granularity === "week") {
        // 周一日期，按 MM-DD 显示（与日级一致）
        return key.slice(5);
      }
      // day
        return key.slice(5);
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
    }    // ===== styles =====
// 样式 token
//
// 配色原则（v0.2.1 调色板升级，参考 data-viz-color / data-viz-techniques）：
//   1. 二元对比用「蓝-橙」主对（input 蓝 / output 橙）：
//      - 色盲安全（blue/orange 是色觉缺陷下仍可分辨的经典组合）
//      - 冷暖对比鲜明，比原"灰+饱和绿"在浅灰背景下不刺眼
//   2. 峰值用 rose-600 单独强调：与蓝/橙拉开色相距离，"峰值日"真的跳出来
//   3. 通用 accent（绿）保留给非图表元素：btnPrimary / panel 复选框 /
//      输出总计 / 模型比值列。图表不再吃绿色，避免"什么都是绿色"的扁平感
//   4. 灰色 hierarchy 仅用于 hairline / text / 网格 / today 竖线——
//      参考线不应抢数据色
    var C = {
      hairline: "rgba(128,128,128,0.18)",
      hairlineSoft: "rgba(128,128,128,0.10)",
      faint: "rgba(128,128,128,0.06)",
      text1: "inherit",
      text2: "rgba(128,128,128,0.65)",
      text3: "rgba(128,128,128,0.45)",
      accent: "#16a34a",
      accentSoft: "rgba(22,163,74,0.12)",
      accentSolid: "#16a34a",
      err: "#b02a37",
      errSoft: "rgba(176,42,55,0.10)",
      // 图表双系列色（蓝-橙主对，色盲安全）
      inputBar: "#3b82f6",
      inputBarSoft: "rgba(59,130,246,0.12)",
      outputBar: "#f59e0b",
      outputBarSoft: "rgba(245,158,11,0.12)",
      // v0.4.1：5 段堆叠柱状图扩展色（每根柱代表 5 类 token 的真实占比，
      // 比 v0.3.0 的"input+output 双段"信息密度 ×2.5）。
      //   cacheWriteBar  cacheReadBar  inputBar  outputBar  reasoningBar
      //   #93c5fd        #60a5fa       #3b82f6   #f59e0b   #fbbf24
      // 梯度方向：cacheWrite（最便宜）→ reasoning（最贵），bottom→top。
      // 严控色板：5 个都是 tailwindcss 调色板的相邻色阶，色相不跳。
      cacheWriteBar: "#93c5fd",
      cacheReadBar: "#60a5fa",
      reasoningBar: "#fbbf24",
      // 峰值强调色（rose，独立于蓝/橙，peak day 视觉跳出）
      peakLine: "#e11d48",
      peakText: "#be123c",
      peakSoft: "rgba(225,29,72,0.10)",
      peakBorder: "rgba(225,29,72,0.30)",
      // 参考线（保留灰色 hierarchy，不与数据色竞争）
      todayLine: "rgba(128,128,128,0.40)",
      gridDashed: "rgba(128,128,128,0.10)",
      gridBase: "rgba(128,128,128,0.20)",
      // 热力图（v0.3.1：5 级绿色单色相，仅明度梯度，不切色相——对齐 GitHub 贡献日历视觉
      // 语言；用户反馈"大的颜色不改变，只要绿色"后改）。
      //   L0 transparent         无用量
      //   L1 #9be9a8             极淡（1-10% max）
      //   L2 #40c463             中淡（10-30% max）
      //   L3 #30a14e             中深（30-60% max，主绿）
      //   L4 #216e39             深（60-90% max，爆日）
      //   L5 #0e4429             最深（≥90% max，异常日）
      // 严控色板：仅复用 v0.2.1 accent (#16a34a) 衍生，accentSolid / btnPrimary 等保持绿色
      // 一致（"什么都是绿色"在图表外反而成加分项——和图表视觉锚点统一）。
      heatmapL0: "transparent",
      heatmapL1: "#c6e6ce",
      heatmapL2: "#9be9a8",
      heatmapL3: "#7ac281",
      heatmapL4: "#40c463",
      heatmapL5: "#30a14e",
      heatmapL6: "#216e39",
      heatmapL7: "#0e4429",
      heatmapCellBorder: "rgba(128,128,128,0.06)",
      heatmapLabel: "rgba(128,128,128,0.45)"
    };

    var s = {
      // 排版
      pageTitle: { margin: 0, fontSize: "18px", fontWeight: 600, letterSpacing: "-0.01em" },
      meta: { fontSize: "11px", color: C.text3, letterSpacing: "0.02em", lineHeight: 1.6 },
      eyebrow: { fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2 },
      // 控件
      btn: { padding: "5px 12px", fontSize: "12px", borderRadius: "5px", border: "1px solid " + C.hairline, background: "transparent", color: "inherit", cursor: "pointer", transition: "border-color 120ms, background 120ms" },
      btnPrimary: { padding: "5px 12px", fontSize: "12px", borderRadius: "5px", border: "1px solid " + C.accent, background: C.accentSoft, color: C.accent, fontWeight: 600, cursor: "pointer" },
      tab: { padding: "4px 11px", fontSize: "12px", borderRadius: "5px", border: "1px solid transparent", background: "transparent", color: C.text2, cursor: "pointer", fontVariantNumeric: "tabular-nums" },
      tabActive: { padding: "4px 11px", fontSize: "12px", borderRadius: "5px", border: "1px solid " + C.hairline, background: C.faint, color: "inherit", fontWeight: 600, cursor: "default", fontVariantNumeric: "tabular-nums" },
      // 卡片
      card: { flex: "1 1 150px", minWidth: "150px", padding: "14px 16px", borderRadius: "6px", border: "1px solid " + C.hairline, background: "transparent", display: "flex", flexDirection: "column", gap: "6px" },
      cardLabel: { fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2 },
      cardValue: { fontSize: "22px", fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" },
      cardSub: { fontSize: "11px", color: C.text3, fontVariantNumeric: "tabular-nums" },
      // 表格
      th: { textAlign: "left", padding: "8px 10px", fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2, borderBottom: "1px solid " + C.hairline, whiteSpace: "nowrap" },
      td: { padding: "9px 10px", fontSize: "13px", borderBottom: "1px solid " + C.hairlineSoft, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
      tdName: { padding: "9px 10px", fontSize: "13px", borderBottom: "1px solid " + C.hairlineSoft, whiteSpace: "nowrap", fontWeight: 500 },
      num: { textAlign: "right" },
      // 分隔
      hr: { margin: "20px 0 14px", border: "none", borderTop: "1px solid " + C.hairline },
      sectionTitle: { margin: "0 0 10px", fontSize: "13px", fontWeight: 600, letterSpacing: "-0.005em" },
      sectionHint: { marginLeft: "8px", fontSize: "11px", color: C.text3, fontWeight: 400 },
      // 错误
      errBox: { padding: "8px 12px", borderRadius: "5px", background: C.errSoft, border: "1px solid rgba(176,42,55,0.25)", color: C.err, fontSize: "12px", marginBottom: "12px" },
      // 扫描状态行（v0.5.0：后台重算进度 / 旧缓存占位 / 数据新鲜度）
      statusBar: { display: "flex", alignItems: "center", gap: "10px", marginTop: "10px", padding: "7px 11px", borderRadius: "5px", border: "1px solid " + C.hairline, background: C.faint, fontSize: "11px", color: C.text2, fontVariantNumeric: "tabular-nums" },
      statusWarn: { borderColor: "rgba(176,42,55,0.25)", background: C.errSoft, color: C.err },
      statusDot: { width: "7px", height: "7px", borderRadius: "50%", background: C.accent, flex: "0 0 auto" },
      statusTrack: { flex: "1 1 120px", height: "3px", borderRadius: "2px", background: C.hairlineSoft, overflow: "hidden", minWidth: "80px" },
      statusFill: { height: "100%", borderRadius: "2px", background: C.accent },
      // 图表
      chartSection: { marginTop: "4px" },
      chartLegend: { display: "flex", alignItems: "center", gap: "14px", fontSize: "11px", color: C.text2, marginBottom: "12px" },
      chartLegendHint: { marginLeft: "auto", fontSize: "11px", color: C.text3 },
      chartWrap: { position: "relative", height: "100px", overflowX: "auto", overflowY: "hidden" },
      chartGridLine: { position: "absolute", left: 0, right: 0, borderTopStyle: "dashed", borderTopWidth: "1px", borderTopColor: C.gridDashed, pointerEvents: "none" },
      chartGridBase: { position: "absolute", left: 0, right: 0, borderTopStyle: "solid", borderTopWidth: "1px", borderTopColor: C.gridBase, pointerEvents: "none" },
      chartTodayLine: { position: "absolute", top: 0, bottom: 0, width: "1px", background: C.todayLine, opacity: 0.7, pointerEvents: "none" },
      chartPeakLine: { position: "absolute", top: 0, bottom: 0, width: "1px", background: C.peakLine, opacity: 0.55, pointerEvents: "none" },
      chartPeakBadge: { position: "absolute", transform: "translate(-50%, -100%)", padding: "2px 7px", borderRadius: "3px", background: C.peakSoft, border: "1px solid " + C.peakBorder, color: C.peakText, fontSize: "10px", fontWeight: 600, letterSpacing: "0.02em", whiteSpace: "nowrap", pointerEvents: "none", fontVariantNumeric: "tabular-nums" },
      chartBarsRow: { position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", gap: "2px" },
      chartBar: { flex: "1 1 0", minWidth: "4px", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", cursor: "default" },
      chartBarOut: { borderRadius: "1px 1px 0 0", minHeight: 0 },
      chartBarIn: { minHeight: 0 },
      chartAxisRow: { display: "flex", gap: "2px", marginTop: "8px" },
      chartAxis: { flex: "1 1 0", minWidth: "4px", textAlign: "center", fontSize: "10px", color: C.text3, fontVariantNumeric: "tabular-nums" },
      chartAxisToday: { flex: "1 1 0", minWidth: "4px", textAlign: "center", fontSize: "10px", color: C.text2, fontVariantNumeric: "tabular-nums", fontWeight: 600 },
      chartSummary: { display: "flex", gap: "14px", marginTop: "12px", fontSize: "11px", color: C.text3, letterSpacing: "0.02em", flexWrap: "wrap" },
      chartSummaryPeak: { color: C.peakText, fontWeight: 500 },
      chartSummaryTotal: { color: C.text2 },
      // 显示设置面板
      panelWrap: { position: "relative" },
      panel: {
        position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100,
        width: "260px", padding: "12px 14px", borderRadius: "6px",
        border: "1px solid " + C.hairline,
        background: "var(--ds-bg-elevated, #ffffff)",
        boxShadow: "0 6px 24px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)"
      },
      panelTitle: { fontSize: "12px", fontWeight: 600, marginBottom: "8px", color: C.text2, letterSpacing: "0.02em" },
      panelSep: { height: "1px", background: C.hairlineSoft, margin: "10px 0 8px" },
      panelRow: { display: "flex", alignItems: "center", gap: "8px", padding: "4px 0", fontSize: "12px", cursor: "pointer", userSelect: "none" },
      panelCheck: { width: "13px", height: "13px", margin: 0, cursor: "pointer", accentColor: C.accent },
      panelToggleRow: { display: "flex", gap: "6px", marginBottom: "6px" },
      panelToggleBtn: { padding: "3px 9px", fontSize: "11px", borderRadius: "4px", border: "1px solid " + C.hairline, background: "transparent", color: C.text2, cursor: "pointer" },
      // 热力图（v0.2.2）：53 周 × 7 日方格，5 级颜色复用 v0.2.1 蓝橙主对 + rose peak token
      heatmapSection: { marginTop: "4px" },
      heatmapLegend: { display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: C.text2, marginBottom: "12px", flexWrap: "wrap" },
      heatmapLegendHint: { marginLeft: "auto", fontSize: "11px", color: C.text3 },
      heatmapWrap: { display: "inline-block", padding: "10px 12px 8px", border: "1px solid " + C.hairline, borderRadius: "6px", background: "var(--ds-bg-elevated, #ffffff)" },
      heatmapMonthRow: { display: "flex", fontSize: "10px", color: C.heatmapLabel, marginBottom: "4px", letterSpacing: "0.02em", height: "12px" },
      heatmapMonthCell: { position: "absolute", fontSize: "10px", color: C.heatmapLabel },
      heatmapBodyRow: { display: "flex" },
      heatmapDowCol: { display: "flex", flexDirection: "column", gap: "1px", paddingRight: "4px" },
      // v0.4.1：dow 标签高度从 11→9 同步缩，与 heatmapCell 9px 对齐（不缩会让行错位）
      heatmapDowLabel: { height: "9px", fontSize: "10px", color: C.heatmapLabel, textAlign: "right", lineHeight: "9px" },
      heatmapGrid: { display: "flex", gap: "1px" },
      heatmapWeekCol: { display: "flex", flexDirection: "column", gap: "1px" },
      // v0.4.1：cell 11×11 + gap 2 缩到 9×9 + gap 1（视觉密度约 +20%）。
      // 53 周宽度从 689px → 530px，配合右侧栏腾出空间；保留 border-radius 2 让
      // 单元格仍然像"色块"而不是像素点。
      heatmapCell: { width: "9px", height: "9px", borderRadius: "2px", background: C.heatmapL0, border: "1px solid " + C.heatmapCellBorder, boxSizing: "border-box", cursor: "default" },
      heatmapCellL1: { background: C.heatmapL1 },
      heatmapCellL2: { background: C.heatmapL2 },
      heatmapCellL3: { background: C.heatmapL3 },
      heatmapCellL4: { background: C.heatmapL4 },
      heatmapCellL5: { background: C.heatmapL5 },
      heatmapCellL6: { background: C.heatmapL6 },
      heatmapCellL7: { background: C.heatmapL7 },
      // v0.4.1：图例单元同步缩到 9×9（与 heatmapCell 一致）
      heatmapScaleCell: { width: "9px", height: "9px", borderRadius: "2px", border: "1px solid " + C.heatmapCellBorder, boxSizing: "border-box" },
      heatmapModelBar: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", fontSize: "11px", color: C.text2 },
      heatmapModelSelect: { padding: "3px 8px", fontSize: "11px", borderRadius: "4px", border: "1px solid " + C.hairline, background: "transparent", color: "inherit", cursor: "pointer", fontVariantNumeric: "tabular-nums" },
      heatmapEmpty: { fontSize: "11px", color: C.text3, padding: "16px 0" }
    };    // ===== components =====
    /**
     * v0.5.0 扫描状态行。
     *
     * host 半段每次请求都立即返回"已发布快照"，后台扫描在单飞推进；因此客户端需要
     * 一个进度与新鲜度的可视入口：
     *   - scanning：后台重算中（done/total + 进度条），首次安装或全量重建时会持续一段时间
     *   - legacy：当前展示的是 v0.4.x 旧缓存的占位数据，等重算完成后自动被真实值覆盖
     *   - 常态：数据截至时间 + 上次扫描耗时 + 生命周期空洞诊断计数
     *   - errorCount > 0：切换成警示配色并提示条数（明细在 errors 盒里）
     */
    function ScanStatus(d) {
      var scanning = d.scanning === true;
      var legacy = d.legacy === true;
      var progress = d.scanProgress || null;
      var pct = 0;
      if (progress != null && progress.total > 0) {
        pct = Math.max(0, Math.min(100, Math.round((progress.done / progress.total) * 100)));
      }
      var pieces = [];
      if (scanning) {
        pieces.push("后台重算中");
        if (progress != null) {
          if (progress.total > 0) pieces.push(progress.done + "/" + progress.total + " 会话");
          else pieces.push("发现会话中");
          if (progress.changed != null) pieces.push("本次重折 " + progress.changed + " · 复用 " + progress.reused);
        }
        if (legacy) pieces.push("当前展示旧缓存占位数据，重算完成后自动替换");
      } else if (legacy) {
        pieces.push("当前展示旧缓存数据，等待重算完成");
      } else {
        pieces.push("数据已是最新");
        if (d.dataAsOf != null) pieces.push("截至 " + fmtTime(d.dataAsOf));
        if (d.lastScanAt != null) pieces.push("上次扫描 " + fmtTime(d.lastScanAt));
        if (d.reused != null && d.reused > 0) pieces.push("复用 " + d.reused + " 个会话");
      }
      if (d.restartFolds > 0) pieces.push(d.restartFolds + " 个会话日志被改写，已重折叠");
      if (d.errorCount > 0) pieces.push(d.errorCount + " 个会话失败");

      var warn = d.errorCount > 0;
      return React.createElement(
        "div",
        { style: warn ? Object.assign({}, s.statusBar, s.statusWarn) : s.statusBar, "data-usage-stats-status": scanning ? "scanning" : (legacy ? "legacy" : "idle") },
        React.createElement("span", { style: s.statusDot }),
        React.createElement("span", null, pieces.join(" · ")),
        scanning && progress != null && progress.total > 0
          ? React.createElement(
            "span",
            { style: s.statusTrack },
            React.createElement("span", { style: Object.assign({}, s.statusFill, { width: pct + "%" }) })
          )
          : null
      );
    }

    function Card(label, value, sub) {
      return React.createElement(
        "div",
        { style: s.card },
        React.createElement("div", { style: s.cardLabel }, label),
        React.createElement("div", { style: s.cardValue }, value),
        sub != null ? React.createElement("div", { style: s.cardSub }, sub) : null
      );
    }

    /**
     * 用量柱状图（v0.3.0 多粒度；v0.4.1 5 段堆叠）。
     *
     * 输入 buckets 是 byTrend[granularity] 子集（零填充过的窗口序列）。
     *
     * v0.4.1 改造：每根柱从 v0.3.0 的 2 段堆叠（input 蓝 + output 橙）
     * 升级为 5 段堆叠，按"色温从冷到暖"自底向上：
     *   1. cacheWrite  #93c5fd  最便宜
     *   2. cacheRead   #60a5fa  折扣
     *   3. inputMiss   #3b82f6  全价输入
     *   4. output      #f59e0b  输出（不含推理）
     *   5. reasoning   #fbbf24  推理（output 的子集，黄色封顶）
     *
     * 数学约定：reasoning 是 output 的子集，所以 output 段高度 = max(0, output - reasoning)。
     * 这样 5 段总高 = cacheWrite + cacheRead + inputMiss + (output - reasoning) + reasoning
     *             = cacheWrite + cacheRead + inputMiss + output
     *             = totalTokensOf()（不重复算 reasoning）。
     *
     * minute 模式 N=1440 时容器设 overflow-x: auto 让用户横向滚动；其它模式 wrap。
     * 柱宽相对 v0.3.0 收紧：minute 3→2 / hour 8→6 / day|week 22→18。
     * peak 用 input+output+cacheRead+cacheWrite 全量（不含 reasoning 避免双计）。
     */
    function DayChart(buckets, granularity) {
      var N = buckets.length;
      if (N === 0) {
        return React.createElement(
          "div",
          { style: Object.assign({}, s.meta, { padding: "20px 0" }) },
          "当前范围无用量。"
        );
      }
      // [perf v0.4.x] 预合并 5 段柱样式：s.chartBarIn 共享 base（minHeight: 0），
      // 每段只是 background 不同。预合并省 1440 × 4 = 5760 次 Object.assign。
      var barReasoning = Object.assign({}, s.chartBarOut, { background: C.reasoningBar });
      var barOutput = Object.assign({}, s.chartBarIn, { background: C.outputBar });
      var barInput = Object.assign({}, s.chartBarIn, { background: C.inputBar });
      var barCacheRead = Object.assign({}, s.chartBarIn, { background: C.cacheReadBar });
      var barCacheWrite = Object.assign({}, s.chartBarIn, { background: C.cacheWriteBar });
      // v0.4.1：peak 用 totalTokensOf 等价口径——cacheWrite + cacheRead + inputMiss + output，
      // 排除 reasoning（reasoning ⊂ output，避免峰值与 output 段双计）。
      var max = 0;
      var peakIdx = -1;
      var totalInput = 0;
      var totalOutput = 0;
      var totalCacheRead = 0;
      var totalCacheWrite = 0;
      var totalReasoning = 0;
      for (var i = 0; i < N; i++) {
        var di = buckets[i];
        // reasoning 限制在 output 以内（防御性：极少有 provider 报 reasoning > output）
        var outMinusReason = Math.max(0, (di.outputTokens || 0) - Math.min(di.outputTokens || 0, di.reasoningTokens || 0));
        var tot = (di.cacheWriteTokens || 0) + (di.cacheReadTokens || 0) + (di.inputTokens || 0) + outMinusReason;
        if (tot > max) { max = tot; peakIdx = i; }
        totalInput += di.inputTokens || 0;
        totalOutput += di.outputTokens || 0;
        totalCacheRead += di.cacheReadTokens || 0;
        totalCacheWrite += di.cacheWriteTokens || 0;
        totalReasoning += di.reasoningTokens || 0;
      }
      if (max === 0) {
        return React.createElement(
          "div",
          { style: Object.assign({}, s.meta, { padding: "20px 0" }) },
          "当前范围 " + N + " 桶无用量。"
        );
      }
      // v0.4.1：柱宽收紧（minute 3→2 / hour 8→6 / day|week 22→18）。原宽度下日级 30 桶已
      // 占满 600+ 像素并触发横向滚动；5 段堆叠后视觉密度更高，柱宽略收反而更易扫读。
      var pxPerBar = granularity === "minute" ? 2 : (granularity === "hour" ? 6 : 18);
      var totalWidth = N * pxPerBar + (N - 1) * 2;
      var todayIdx = N - 1;
      var todayCenter = ((todayIdx + 0.5) / N) * 100;
      var peakCenter = ((peakIdx + 0.5) / N) * 100;
      function bucketKey(b) { return b.bucket != null ? b.bucket : b.day; }
      function hPx(v) { return Math.round((v / max) * 96); }
      function axisLabel(b) { return fmtBucket(bucketKey(b), granularity); }
      // X 轴稀疏显示：按 N 算步长，避免标签重叠（minute 每 120 标一次 / hour 每 12 / day 每 5）
      var axisStep = N <= 12 ? 1 : (N <= 60 ? 5 : (N <= 168 ? 12 : (N <= 360 ? 30 : 120)));
      function showAxis(i) {
        return (i % axisStep === 0) || i === todayIdx;
      }
      var peakOutMinusReason = Math.max(0, (buckets[peakIdx].outputTokens || 0) - Math.min(buckets[peakIdx].outputTokens || 0, buckets[peakIdx].reasoningTokens || 0));
      var peakTotal = (buckets[peakIdx].cacheWriteTokens || 0) + (buckets[peakIdx].cacheReadTokens || 0) + (buckets[peakIdx].inputTokens || 0) + peakOutMinusReason;
      var peakLabel = "峰值 " + fmtTokens(peakTotal) +
        " · " + fmtBucket(bucketKey(buckets[peakIdx]), granularity);
      return React.createElement(
        "div",
        { style: s.chartSection },
        // v0.4.1：图例 5 色（与 5 段堆叠一一对应）
        React.createElement(
          "div",
          { style: s.chartLegend },
          React.createElement(
            "span",
            { style: { display: "inline-flex", alignItems: "center", gap: "6px" } },
            React.createElement("span", { style: { display: "inline-block", width: "10px", height: "3px", background: C.reasoningBar, borderRadius: "1px" } }),
            "推理"
          ),
          React.createElement(
            "span",
            { style: { display: "inline-flex", alignItems: "center", gap: "6px" } },
            React.createElement("span", { style: { display: "inline-block", width: "10px", height: "3px", background: C.outputBar, borderRadius: "1px" } }),
            "输出"
          ),
          React.createElement(
            "span",
            { style: { display: "inline-flex", alignItems: "center", gap: "6px" } },
            React.createElement("span", { style: { display: "inline-block", width: "10px", height: "3px", background: C.inputBar, borderRadius: "1px" } }),
            "未命中"
          ),
          React.createElement(
            "span",
            { style: { display: "inline-flex", alignItems: "center", gap: "6px" } },
            React.createElement("span", { style: { display: "inline-block", width: "10px", height: "3px", background: C.cacheReadBar, borderRadius: "1px" } }),
            "命中"
          ),
          React.createElement(
            "span",
            { style: { display: "inline-flex", alignItems: "center", gap: "6px" } },
            React.createElement("span", { style: { display: "inline-block", width: "10px", height: "3px", background: C.cacheWriteBar, borderRadius: "1px" } }),
            "缓存写"
          ),
          React.createElement("span", { style: s.chartLegendHint }, "悬停查看明细 · " + (granularity || "day") + " · " + N + " 桶")
        ),
        React.createElement(
          "div",
          { style: s.chartWrap },
          React.createElement("div", { style: Object.assign({}, s.chartGridLine, { top: "25%" }) }),
          React.createElement("div", { style: Object.assign({}, s.chartGridLine, { top: "50%" }) }),
          React.createElement("div", { style: Object.assign({}, s.chartGridLine, { top: "75%" }) }),
          React.createElement("div", { style: Object.assign({}, s.chartGridBase, { top: "100%" }) }),
          React.createElement("div", { style: Object.assign({}, s.chartTodayLine, { left: todayCenter + "%" }) }),
          React.createElement("div", { style: Object.assign({}, s.chartPeakLine, { left: peakCenter + "%" }) }),
          React.createElement("div", {
            style: Object.assign({}, s.chartPeakBadge, { left: peakCenter + "%", top: "-2px" }),
            title: "峰值桶"
          }, peakLabel),
          React.createElement(
            "div",
            { style: Object.assign({}, s.chartBarsRow, { width: totalWidth + "px" }) },
            buckets.map(function (b, i) {
              var k = bucketKey(b);
              // v0.4.1：5 段堆叠。outputMinusReason = output - min(output, reasoning)
              // 保证 reasoning 不超过 output（防御性），5 段总高与 totalTokensOf 一致。
              var safeOut = b.outputTokens || 0;
              var safeReas = Math.min(b.reasoningTokens || 0, safeOut);
              var outputMinusReason = Math.max(0, safeOut - safeReas);
              // v0.4.1：tooltip 包含全部 5 段 token + 请求数（之前只显示 input/output + cacheRead/reasoning）
              var title = k +
                "\n未命中 " + fmtTokens(b.inputTokens || 0) +
                " · 命中 " + fmtTokens(b.cacheReadTokens || 0) +
                " · 缓存写 " + fmtTokens(b.cacheWriteTokens || 0) +
                "\n输出 " + fmtTokens(b.outputTokens || 0) +
                " · 推理 " + fmtTokens(b.reasoningTokens || 0) +
                "\n请求 " + (b.requests || 0) + " 次";
              return React.createElement(
                "div",
                // v0.4.1：override s.chartBar 的 minWidth 4px——minute 模式 pxPerBar=2 时
                // 4px 会把柱撑到 4px 宽，破坏"柱宽收缩"的密度提升。minWidth 跟 width 走。
                { key: k, title: title, style: Object.assign({}, s.chartBar, { width: pxPerBar + "px", minWidth: pxPerBar + "px" }) },
                // DOM 顺序 = 自顶向下（flex-direction: column），故 5 段渲染顺序：
                //   1. reasoning（顶部、黄色封顶、s.chartBarOut 给 top border-radius）
                //   2. output - reasoning（橙色）
                //   3. inputMiss（蓝色）
                //   4. cacheRead（浅蓝）
                //   5. cacheWrite（最浅蓝，底部）
                React.createElement("div", {
                  style: Object.assign({}, barReasoning, { height: hPx(safeReas) + "px" })
                }),
                React.createElement("div", {
                  style: Object.assign({}, barOutput, { height: hPx(outputMinusReason) + "px" })
                }),
                React.createElement("div", {
                  style: Object.assign({}, barInput, { height: hPx(b.inputTokens || 0) + "px" })
                }),
                React.createElement("div", {
                  style: Object.assign({}, barCacheRead, { height: hPx(b.cacheReadTokens || 0) + "px" })
                }),
                React.createElement("div", {
                  style: Object.assign({}, barCacheWrite, { height: hPx(b.cacheWriteTokens || 0) + "px" })
                })
              );
            })
          )
        ),
        React.createElement(
          "div",
          { style: Object.assign({}, s.chartAxisRow, { width: totalWidth + "px" }) },
          buckets.map(function (b, i) {
            var k = bucketKey(b);
            var isToday = i === todayIdx;
            return React.createElement("div", {
              key: k,
              // v0.4.1：override minWidth 4px 同步（同柱体注释）
              style: Object.assign({}, isToday ? s.chartAxisToday : s.chartAxis, { width: pxPerBar + "px", minWidth: pxPerBar + "px" }),
              title: k
            }, showAxis(i) ? axisLabel(b) : "");
          })
        ),
        React.createElement(
          "div",
          { style: s.chartSummary },
          // v0.4.1：总量改成 totalTokensOf 等价口径（input + output + cacheRead + cacheWrite；
          // reasoning 不重复算）。同时把 cacheRead 单独提一行，让用户能直接看到"命中"的节省量。
          React.createElement("span", { style: s.chartSummaryTotal }, "总量 ", fmtTokens(totalInput + totalOutput + totalCacheRead + totalCacheWrite)),
          React.createElement("span", null, "输出 ", React.createElement("span", { style: { color: C.accent, fontWeight: 600 } }, fmtTokens(totalOutput))),
          React.createElement("span", { style: { color: C.cacheReadBar } }, "命中 ", fmtTokens(totalCacheRead)),
          React.createElement("span", { style: { color: C.text3 } }, "推理 ", fmtTokens(totalReasoning)),
          React.createElement("span", { style: s.chartSummaryPeak }, peakLabel)
        )
      );
    }

    function Table(headers, rows) {
      return React.createElement(
        "table",
        { style: { borderCollapse: "collapse", width: "100%" } },
        React.createElement(
          "thead",
          null,
          React.createElement("tr", null, headers.map(function (h, i) {
            return React.createElement("th", { key: i, style: Object.assign({}, s.th, h.num ? s.num : null) }, h.label);
          }))
        ),
        React.createElement("tbody", null, rows)
      );
    }

    /**
     * GitHub 风格贡献热力图（v0.2.2）：53 周 × 7 日方格日历。
     *
     * 输入：
     *   days — byDay 数组（任意顺序，内部排序；可空）
     *   modelFilter — 模型筛选字符串，null = 全部模型聚合
     *   byModel — 完整按模型数组，用于构造 modelDays 索引
     *
     * 渲染：53 周 × 7 日方格（周一在上），5 级颜色严控色板膨胀——
     *   L1-L3 蓝主对浅→深（复用 inputBarSoft 渐进浓度）
     *   L4 橙（outputBar 同色）= 爆日（≥60% max）
     *   L5 rose（peakLine 同色）= 异常日（≥90% max）
     *
     * 月份标签：每跨周首日落新月份时显示「N 月」，absolute 定位到 grid 上方。
     * 悬停 title：日期 + 输入 / 输出 / 请求数 + 当前筛选模型。
     */
    function HeatmapCalendar(days, modelFilter, byModel) {
      // [perf v0.4.x] 预合并 7 个 cell style + empty style，heatmapCell 是 base，
      // heatmapCellL1..L7 只覆盖 background。预合并省掉 53×7×2 ≈ 742 次 Object.assign。
      var cellStyles = [
        s.heatmapCell,
        Object.assign({}, s.heatmapCell, s.heatmapCellL1),
        Object.assign({}, s.heatmapCell, s.heatmapCellL2),
        Object.assign({}, s.heatmapCell, s.heatmapCellL3),
        Object.assign({}, s.heatmapCell, s.heatmapCellL4),
        Object.assign({}, s.heatmapCell, s.heatmapCellL5),
        Object.assign({}, s.heatmapCell, s.heatmapCellL6),
        Object.assign({}, s.heatmapCell, s.heatmapCellL7),
      ];
      if (days == null || days.length === 0) {
        return React.createElement("div", { style: s.heatmapEmpty }, "暂无日级用量。");
      }
      // 预构造 modelDays 索引（按 model name → { day → bucket }）
      var modelIndex = null;
      if (modelFilter != null && byModel != null) {
        modelIndex = {};
        for (var mi = 0; mi < byModel.length; mi++) {
          var m = byModel[mi];
          if (m && m.model) modelIndex[m.model] = m.days || {};
        }
      }
      // dayMap: YYYY-MM-DD → { input, output, requests, total }
      // v0.3.3：用 bucketKey 兼容 day / bucket 双 shape（host v0.3.0 daySeries 输出 { day, ... }，
      // v0.3.3 防御性添加 bucket 字段 → 客户端硬编码 .day 也能跑）
      function dayKey(d) { return d != null ? (d.bucket != null ? d.bucket : d.day) : null; }
      var dayMap = {};
      var max = 0;
      for (var di = 0; di < days.length; di++) {
        var day = days[di];
        if (day == null) continue;
        var k = dayKey(day);
        if (k == null) continue;
        var input = day.inputTokens || 0;
        var output = day.outputTokens || 0;
        var requests = day.requests || 0;
        if (modelIndex != null && modelIndex[modelFilter] && modelIndex[modelFilter][k]) {
          var md = modelIndex[modelFilter][k];
          input = md.inputTokens || 0;
          output = md.outputTokens || 0;
        }
        var tot = input + output;
        if (tot > max) max = tot;
        dayMap[k] = { input: input, output: output, requests: requests, total: tot };
      }
      if (max === 0) {
        return React.createElement("div", { style: s.heatmapEmpty }, "暂无用量。");
      }

      // 时间范围：days 内最早 → 最晚
      var firstDay = null;
      var lastDay = null;
      for (var di2 = 0; di2 < days.length; di2++) {
        var d2 = dayKey(days[di2]);
        if (d2 == null) continue;
        if (firstDay == null || d2 < firstDay) firstDay = d2;
        if (lastDay == null || d2 > lastDay) lastDay = d2;
      }
      var fp = firstDay.split("-");
      var firstDate = new Date(Date.UTC(+fp[0], +fp[1] - 1, +fp[2]));
      var lp = lastDay.split("-");
      var lastDate = new Date(Date.UTC(+lp[0], +lp[1] - 1, +lp[2]));
      // 周一在上 → UTC dow (0=Sun..6=Sat) 转为 0=Mon..6=Sun
      var firstDow = (firstDate.getUTCDay() + 6) % 7;

      // 总周数（含 firstDow 偏移的左侧空列）
      var totalDaysSpan = Math.floor((lastDate.getTime() - firstDate.getTime()) / 86400000) + 1;
      var totalWeeks = Math.ceil((totalDaysSpan + firstDow) / 7);
      // 限 53 周：超出则左截，firstDate 后移到 skipWeeks 周之后
      if (totalWeeks > 53) {
        var skipWeeks = totalWeeks - 53;
        firstDate = new Date(firstDate.getTime() + skipWeeks * 7 * 86400000);
        firstDow = (firstDate.getUTCDay() + 6) % 7;
        totalWeeks = 53;
      }

      // 7 级阈值（基于 max 归一）——v0.3.2 用户反馈"级别多一点"，从 5 级扩 7 级
      function levelFor(tot) {
        if (tot <= 0) return 0;
        var r = tot / max;
        if (r >= 0.9) return 7;
        if (r >= 0.7) return 6;
        if (r >= 0.5) return 5;
        if (r >= 0.3) return 4;
        if (r >= 0.15) return 3;
        if (r >= 0.05) return 2;
        return 1;
      }
      function cellBgStyle(lv) {
        if (lv === 1) return s.heatmapCellL1;
        if (lv === 2) return s.heatmapCellL2;
        if (lv === 3) return s.heatmapCellL3;
        if (lv === 4) return s.heatmapCellL4;
        if (lv === 5) return s.heatmapCellL5;
        if (lv === 6) return s.heatmapCellL6;
        if (lv === 7) return s.heatmapCellL7;
        return null;
      }

      // 月份切换标签收集（每跨周首日落新月份时显示「N 月」）
      var monthLabels = [];
      var prevMonth = -1;
      var weekCols = [];
      for (var wi = 0; wi < totalWeeks; wi++) {
        var weekStart = new Date(firstDate.getTime() + (wi * 7 - firstDow) * 86400000);
        var m = weekStart.getUTCMonth();
        if (m !== prevMonth && weekStart.getTime() <= lastDate.getTime()) {
          monthLabels.push({ weekIdx: wi, label: (m + 1) + "月" });
          prevMonth = m;
        }
        var dayCells = [];
        for (var dwi = 0; dwi < 7; dwi++) {
          var dayOffset = wi * 7 + dwi - firstDow;
          var cellDate = new Date(firstDate.getTime() + dayOffset * 86400000);
          if (dayOffset < 0 || cellDate.getTime() > lastDate.getTime()) {
            // 左侧留白（firstDow 之前）或右侧留白
            dayCells.push(React.createElement("div", { key: dwi, style: s.heatmapCell }));
            continue;
          }
          var ck = cellDate.getUTCFullYear() + "-" +
            ("0" + (cellDate.getUTCMonth() + 1)).slice(-2) + "-" +
            ("0" + cellDate.getUTCDate()).slice(-2);
          var info = dayMap[ck];
          var lv = info ? levelFor(info.total) : 0;
          var cellStyleMerged = cellStyles[lv];
          var titleText;
          if (info) {
            titleText = ck + "\n输入 " + fmtTokens(info.input) + "\n输出 " + fmtTokens(info.output) +
              "\n请求 " + info.requests + " 次" +
              (modelFilter ? "\n模型 " + modelFilter : "");
          } else {
            titleText = ck + "（无用量）";
          }
          dayCells.push(React.createElement("div", { key: dwi, title: titleText, style: cellStyleMerged }));
        }
        weekCols.push(React.createElement("div", { key: wi, style: s.heatmapWeekCol }, dayCells));
      }

      // 月份行（absolute 定位到 grid 上方，与周列同左对齐）
      // v0.4.1：weekColWidth / weekGap 同步缩小（11/2 → 9/1，与 s.heatmapCell / s.heatmapWeekCol 一致）。
      // 这两个常量之前硬编码 11/2（与 styles 解耦），不跟着缩会让月份标签与列错位。
      var weekColWidth = 9;
      var weekGap = 1;
      var weekStride = weekColWidth + weekGap;
      var monthRowNodes = monthLabels.map(function (ml) {
        return React.createElement(
          "div",
          {
            key: ml.weekIdx,
            style: Object.assign({}, s.heatmapMonthCell, { left: (ml.weekIdx * weekStride) + "px" })
          },
          ml.label
        );
      });

      // 星期标签（周一/三/五可见，其余 hidden 占位对齐）
      var dowLabels = ["一", "", "三", "", "五", "", ""];
      var dowLabelNodes = dowLabels.map(function (lbl, i) {
        return React.createElement(
          "div",
          { key: i, style: Object.assign({}, s.heatmapDowLabel, { visibility: lbl === "" ? "hidden" : "visible" }) },
          lbl
        );
      });

      // 图例
      var legend = React.createElement(
        "div",
        { style: s.heatmapLegend },
        React.createElement("span", null, "少"),
        React.createElement("div", { style: Object.assign({}, s.heatmapScaleCell) }),
        // [perf] 7 个图例 cell 也预合并
        React.createElement("div", { style: Object.assign({}, s.heatmapScaleCell, s.heatmapCellL1) }),
        React.createElement("div", { style: Object.assign({}, s.heatmapScaleCell, s.heatmapCellL2) }),
        React.createElement("div", { style: Object.assign({}, s.heatmapScaleCell, s.heatmapCellL3) }),
        React.createElement("div", { style: Object.assign({}, s.heatmapScaleCell, s.heatmapCellL4) }),
        React.createElement("div", { style: Object.assign({}, s.heatmapScaleCell, s.heatmapCellL5) }),
        React.createElement("div", { style: Object.assign({}, s.heatmapScaleCell, s.heatmapCellL6) }),
        React.createElement("div", { style: Object.assign({}, s.heatmapScaleCell, s.heatmapCellL7) }),
        React.createElement("span", null, "多"),
        React.createElement("span", { style: s.heatmapLegendHint }, "过去 53 周 · 悬停查看当日明细")
      );

      return React.createElement(
        "div",
        { style: s.heatmapSection },
        legend,
        React.createElement(
          "div",
          { style: Object.assign({}, s.heatmapWrap, { position: "relative" }) },
          React.createElement(
            "div",
            { style: Object.assign({}, s.heatmapMonthRow, { position: "relative", height: "12px" }) },
            monthRowNodes
          ),
          React.createElement(
            "div",
            { style: s.heatmapBodyRow },
            React.createElement("div", { style: s.heatmapDowCol }, dowLabelNodes),
            React.createElement("div", { style: s.heatmapGrid }, weekCols)
          )
        )
      );
    }    // ===== config =====
    // v0.3.0 RANGES 扩 granularity + window 字段。每个 range 决定页面上图与按模型表按哪个粒度切片。
    //   granularity ∈ 'day' | 'hour' | 'minute' | 'week'
    //   window 是在该粒度下取末尾多少桶；null = 该粒度默认（day=30, hour=168=7d, minute=1440=24h, week=全部）
    // v0.3.9 'all' tab 语义改为"全程指标（safeTotals），图表仍展示最近 30 天"：window 置 null 让
    //   rangeTotals 走 safeTotals（与旧的"30 天切片"区分开），但 70-page.js 仍对 'all' 特殊保留 30 天图表。
    var RANGES = [
      { key: "all", label: "全部", granularity: "day", window: null },
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
    }    // ===== visibility panel =====
    /**
     * 显示设置面板：列出 6 个数据块的复选项 + 全选/全不选快捷按钮。
     * 通过 [data-usage-stats-panel] 属性给外层 click-outside 监听器识别。
     */
    function VisibilityPanel(visibility, setVisibility) {
      var checkedCount = 0;
      for (var i = 0; i < VISIBLE_KEYS.length; i++) if (visibility[VISIBLE_KEYS[i]]) checkedCount++;
      var allOn = checkedCount === VISIBLE_KEYS.length;
      var allOff = checkedCount === 0;
      return React.createElement(
        "div",
        { "data-usage-stats-panel": "1", style: s.panel, onClick: function (e) { e.stopPropagation(); } },
        React.createElement("div", { style: s.panelTitle }, "显示设置"),
        React.createElement(
          "div",
          { style: s.panelToggleRow },
          React.createElement(
            "button",
            { style: s.panelToggleBtn, disabled: allOn, onClick: function () { setVisibility(setAllVisible(true)); } },
            "全选"
          ),
          React.createElement(
            "button",
            { style: s.panelToggleBtn, disabled: allOff, onClick: function () { setVisibility(setAllVisible(false)); } },
            "全不选"
          ),
          React.createElement(
            "span",
            { style: { marginLeft: "auto", fontSize: "11px", color: C.text3 } },
            checkedCount + " / " + VISIBLE_KEYS.length
          )
        ),
        React.createElement("div", { style: s.panelSep }),
        React.createElement(
          "div",
          null,
          VISIBLE_KEYS.map(function (k) {
            return React.createElement(
              "label",
              { key: k, style: s.panelRow },
              React.createElement("input", {
                type: "checkbox",
                style: s.panelCheck,
                checked: visibility[k],
                onChange: function (e) { setVisibility(toggleOne(visibility, k, e.target.checked)); }
              }),
              React.createElement("span", null, VISIBLE_LABELS[k])
            );
          })
        )
      );
    }    // ===== page =====
    function UsageStatsPage() {
      var loading = React.useState(true);
      var data = React.useState(null);
      var error = React.useState(null);
      var rangeState = React.useState("all");
      var visibilityState = React.useState(loadVisible());
      var panelOpenState = React.useState(false);
      var heatmapModelState = React.useState(loadHeatmapModel());
      var setLoading = loading[1];
      var setData = data[1];
      var setError = error[1];
      var setRange = rangeState[1];
      var setVisibility = visibilityState[1];
      var setPanelOpen = panelOpenState[1];
      var setHeatmapModel = heatmapModelState[1];
      // 轮询计数（上限保护）：载荷仍在扫描 / 仍是旧缓存占位时用
      var pollCount = React.useRef(0);

      var load = React.useCallback(function (mode) {
        setLoading(true);
        setError(null);
        // v0.5.0：mode false/undefined = 常规刷新；"force" = 绕过节流重新比对修订；
        // "rebuild" = 让 host 把旧存储整体改名后从零重算（原「强制重算」按钮的语义）。
        // 兼容旧调用：true 等价于 "force"。
        var query = "?t=" + Date.now();
        if (mode === "rebuild") query = "?rebuild=1&t=" + Date.now();
        else if (mode === "force" || mode === true) query = "?force=1&t=" + Date.now();
        fetch(API + query)
          .then(function (res) { return res.json(); })
          .then(function (payload) {
            if (!payload.ok) throw new Error(payload.error || "summary failed");
            setData(payload);
            setLoading(false);
          })
          .catch(function (e) {
            setError(String((e && e.message) || e));
            setLoading(false);
          });
      }, []);

      React.useEffect(function () { load(false); }, [load]);

      // v0.5.0 轮询：host 的响应永远立即返回"已发布快照"，后台扫描在单飞推进。
      // 只要载荷还在 scanning 或仍是 legacy 占位，就 2s 后再拉一次；上限 60 次
      // （约 2 分钟）避免任何异常情况下无限轮询；载荷对象每次 fetch 都换身份，
      // 因此 effect 会随新载荷重新排期。
      React.useEffect(function () {
        var current = data[0];
        if (current == null) return undefined;
        if (!current.scanning && !current.legacy) { pollCount.current = 0; return undefined; }
        if (pollCount.current >= 60) return undefined;
        var timer = setTimeout(function () {
          pollCount.current += 1;
          load(false);
        }, 2000);
        return function () { clearTimeout(timer); };
      }, [data[0], load]);

      // 显示偏好变更后写回 localStorage（首次 mount 的初始值也会触发一次，无害）
      React.useEffect(function () {
        saveVisible(visibilityState[0]);
      }, [visibilityState[0]]);

      // 热力图模型筛选偏好持久化（独立 key，与 visibility 解耦）
      React.useEffect(function () {
        saveHeatmapModel(heatmapModelState[0]);
      }, [heatmapModelState[0]]);

      // 弹出层打开时挂全局 mousedown，点 panel 外部或按钮外部则关闭。
      // 用 data-usage-stats-panel / data-usage-stats-panel-btn 标记避坑（DSH DOM 结构不稳）
      React.useEffect(function () {
        if (!panelOpenState[0]) return undefined;
        function onDocDown(e) {
          var t = e.target;
          if (!t || typeof t.closest !== "function") return;
          if (t.closest("[data-usage-stats-panel]")) return;
          if (t.closest("[data-usage-stats-panel-btn]")) return;
          setPanelOpen(false);
        }
        document.addEventListener("mousedown", onDocDown);
        return function () { document.removeEventListener("mousedown", onDocDown); };
      }, [panelOpenState[0]]);

      var d = data[0];
      if (loading[0] && d == null) {
        return React.createElement(
          "div",
          null,
          React.createElement("h2", { style: s.pageTitle }, "使用统计"),
          React.createElement("div", { style: Object.assign({}, s.meta, { marginTop: "12px" }) }, "加载中…（首次统计需解码全部会话，可能需要几秒）")
        );
      }
      if (error[0] != null) {
        return React.createElement(
          "div",
          null,
          React.createElement("h2", { style: s.pageTitle }, "使用统计"),
          React.createElement("div", { style: Object.assign({}, s.errBox, { marginTop: "12px" }) }, "加载失败：", error[0])
        );
      }
      if (d == null) return React.createElement("h2", { style: s.pageTitle }, "使用统计");
      try {
        return UsageStatsPageBody(d, function (force) { load(force); }, rangeState[0], setRange, visibilityState[0], setVisibility, panelOpenState[0], setPanelOpen, heatmapModelState[0], setHeatmapModel);
      } catch (e) {
        // v0.3.4 治本：catch 时打印 d 的关键字段状态，DevTools Console 自动 dump
        // 让下次出错时能从 console 直接看到 host 半段输出缺哪个字段
        if (typeof console !== "undefined" && console.error) {
          console.error("[usage-stats] render exception; d shape:", {
            byDay: d.byDay ? d.byDay.length + " items, first.keys=" + (d.byDay[0] ? Object.keys(d.byDay[0]).join(",") : "null") : "undefined",
            byTrend: d.byTrend ? Object.keys(d.byTrend).map(function (k) { return k + ":" + (d.byTrend[k] ? d.byTrend[k].length : 0) }).join(" | ") : "undefined",
            byModel: d.byModel ? d.byModel.length + " items, first.keys=" + (d.byModel[0] ? Object.keys(d.byModel[0]).join(",") : "null") : "undefined",
            totals: d.totals ? "present(" + d.totals.requests + " reqs)" : "undefined",
            sessionCount: d.sessionCount,
            rawSessionCount: d.rawSessionCount,
            topSessions: d.topSessions ? d.topSessions.length + " items" : "undefined",
            tools: d.tools ? d.tools.length + " items" : "undefined",
            errors: d.errors
          }, e);
        }
        return React.createElement(
          "div",
          { style: { padding: "12px", color: C.err } },
          React.createElement("h3", null, "渲染异常（诊断模式）"),
          React.createElement("div", null, String((e && e.message) || e)),
          React.createElement("pre", { style: { whiteSpace: "pre-wrap", fontSize: "11px", fontFamily: "monospace" } }, String((e && e.stack) || ""))
        );
      }
    }

    function UsageStatsPageBody(d, reload, range, setRange, visibility, setVisibility, panelOpen, setPanelOpen, heatmapModel, setHeatmapModel) {
      // v0.3.0 时间窗口：粒度切换走 byTrend[r.granularity]，旧 'all' / '30' / '7' / '1' 由 rangeSpec() 兼容
      // v0.3.4 治本：所有 d.X 访问加兜底，老 host 半段（v0.2.x）无 byTrend / totals 也不会抛错
      var safeByTrend = d.byTrend || {};
      var safeTotals = d.totals || sumBuckets([]);
      var safeByModel = d.byModel || [];
      var safeTopSessions = d.topSessions || [];
      var safeTools = d.tools || [];
      // v0.3.9：'all' tab 的图表改用 byDayAll（host 历史全量日序列），
      // 不再用 byTrend.day（最近 30 天零填充）。byDayAll 是 root.days 合并升序
      // 不零填充，老 host（v0.3.8.x 及更早）无 byDayAll 时 fallback 到 byTrend.day
      // 保留旧行为（最近 30 天）。
      // 53 周裁剪：超过 53 周（371 天）时只取最近 53 周，避免无限长 day 系列
      // 把图压成色带（GitHub 贡献日历就是 53 周上限）。
      var HEATMAP_WEEKS = 53;
      var HEATMAP_DAYS = HEATMAP_WEEKS * 7; // 371
      var allSource;
      if (d.byDayAll && d.byDayAll.length > 0) {
        allSource = d.byDayAll.length > HEATMAP_DAYS ? d.byDayAll.slice(-HEATMAP_DAYS) : d.byDayAll;
      } else {
        allSource = safeByTrend.day || [];
      }
      var r = rangeSpec(range);
      var seriesSource = safeByTrend[r.granularity] || [];
      // v0.3.9 'all' tab：window=null 时 rangeTotals 走 safeTotals（全程指标），
      // 图表改走 byDayAll（最近 53 周，避免无限长 day 系列把图压成色带）。
      // 老 host（无 byDayAll 时）退回 byTrend.day 末尾 30 天切片，保留 v0.3.5 的
      // 视觉"最近 30 天"语义。
      var winSeries;
      if (r.window != null) {
        winSeries = seriesSource.slice(-r.window);
      } else if (r.key === "all") {
        winSeries = allSource;
      } else {
        winSeries = seriesSource;
      }
      var winSet = null;
      if (r.window != null) {
        winSet = {};
        for (var wi = 0; wi < winSeries.length; wi++) winSet[winSeries[wi].bucket] = true;
      }
      var rangeTotals = r.window != null ? sumBuckets(winSeries) : safeTotals;
      var rangeLabel = r.label;

      // 顶部：标题 + 范围 tab + 操作（含"显示"按钮 + 弹出层）
      var header = React.createElement(
        "div",
        { style: { display: "flex", alignItems: "baseline", gap: "16px", flexWrap: "wrap" } },
        React.createElement("h2", { style: s.pageTitle }, "使用统计"),
        React.createElement(
          "div",
          { style: { display: "flex", gap: "4px" } },
          RANGES.map(function (r) {
            var active = r.key === range;
            return React.createElement(
              "button",
              { key: r.key, style: active ? s.tabActive : s.tab, onClick: function () { if (!active) setRange(r.key); } },
              r.label
            );
          })
        ),
        React.createElement(
          "div",
          { style: { marginLeft: "auto", display: "flex", gap: "6px", alignItems: "center" } },
          // 显示设置按钮 + 弹出层（包一层 wrap 让 panel 相对按钮定位）
          React.createElement(
            "div",
            { style: s.panelWrap, "data-usage-stats-panel-btn": "1" },
            React.createElement(
              "button",
              {
                style: panelOpen ? s.btnPrimary : s.btn,
                onClick: function () { setPanelOpen(!panelOpen); },
                title: "选择要展示的数据块"
              },
              panelOpen ? "显示 ✓" : "显示"
            ),
            panelOpen ? VisibilityPanel(visibility, setVisibility) : null
          ),
          React.createElement("button", { style: s.btn, onClick: function () { reload("force"); }, title: "立即比对会话日志修订（只重折有变化的会话）" }, "刷新"),
          React.createElement("button", { style: s.btn, onClick: function () { reload("rebuild"); }, title: "丢弃现有统计存储，从日志重新折叠全部会话（耗时较长，界面会显示进度）" }, "全量重算")
        )
      );

      // 元信息：扫描来源 + 折叠/复用 + 数据新鲜度（v0.5.0：不再有 home 字段）
      var discoveryLabel = d.discovery === "listGenerations"
        ? "框架世代枚举"
        : (d.discovery === "walk" ? "目录扫描" : (d.discovery === "sessionQuery" ? "框架列表（慢路径）" : "未知"));
      var metaNode = React.createElement(
        "div",
        { style: Object.assign({}, s.meta, { marginTop: "8px" }) },
        "扫描 ", discoveryLabel,
        " · 本次重折 ", d.decoded, " / 复用 ", d.reused,
        " · 数据截至 ", d.dataAsOf != null ? fmtTime(d.dataAsOf) : "—",
        " · 生成于 ", fmtTime(d.generatedAt), "（", fmtDuration(d.durationMs), "）"
      );

      // 指标卡（6 张）：会话 / 请求 / 未命中 / 输出 / 命中 / 速度
      var t = rangeTotals;
      var cardsNode = React.createElement(
        "div",
        { style: { display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "16px" } },
        Card("会话（main）", String(d.sessionCount), d.rawSessionCount != null && d.rawSessionCount !== d.sessionCount ? ("含 " + (d.rawSessionCount - d.sessionCount) + " 个 subagent 已 rollup") : d.turns + " 轮对话（全程）"),
        Card("模型请求" + (r.window == null ? "" : " · " + rangeLabel), String(t.requests), "纯模型时间 " + fmtDuration(d.llmMs)),
        Card("未命中输入", fmtTokens(t.inputTokens), "缓存写 " + fmtTokens(t.cacheWriteTokens)),
        Card("输出", fmtTokens(t.outputTokens), "其中推理 " + fmtTokens(t.reasoningTokens)),
        Card("命中输入", fmtTokens(t.cacheReadTokens), "缓存读取"),
        Card("生成速度", fmtSpeed(safeTotals.outputTokens, d.llmMs || 0), "全程输出 ÷ 模型时间")
      );

      // 错误盒
      var errorBox = d.errors && d.errors.length > 0
        ? React.createElement("div", { style: Object.assign({}, s.errBox, { marginTop: "12px" }) }, "部分会话解码失败（已跳过）：", d.errors.join("；"))
        : null;

      // 按模型表
      var modelRows = safeByModel.map(function (m) {
        var v = modelInView(m, winSet);
        return React.createElement(
          "tr",
          { key: m.model },
          React.createElement("td", { style: s.tdName, title: m.model }, m.model),
          React.createElement("td", { style: Object.assign({}, s.td, s.num, { fontWeight: 600, color: C.accent }), title: "未命中输入 : 命中输入 : 输出（归一到未命中=1）" }, fmtRatio(v.inputTokens, v.cacheReadTokens, v.outputTokens)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num) }, String(v.requests)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num) }, fmtTokens(v.inputTokens)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num) }, fmtTokens(v.outputTokens)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num, { color: C.text3 }) }, fmtTokens(v.reasoningTokens)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num) }, fmtTokens(v.cacheReadTokens)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num, { color: C.text3 }) }, String(m.sessions))
        );
      });

      // 会话表
      // 注：回调形参避免用 `s`，以免遮蔽外层样式对象 `var s`
      var sessionRows = safeTopSessions.map(function (sess) {
        return React.createElement(
          "tr",
          { key: sess.id },
          React.createElement("td", { style: Object.assign({}, s.tdName, { maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis" }), title: sess.title + "　" + (sess.cwd || "") }, sess.title),
          React.createElement("td", { style: Object.assign({}, s.td, { maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", color: C.text2 }), title: sess.cwd || "" }, sess.cwd ? String(sess.cwd).split(/[\\/]/).filter(Boolean).pop() : "–"),
          React.createElement("td", { style: Object.assign({}, s.td, s.num, { color: C.text2 }) }, fmtDate(sess.createdAt)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num) }, String(sess.requests)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num) }, fmtTokens(sess.outputTokens)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num, { fontWeight: 600 }) }, fmtTokens(sess.tokens))
        );
      });

      // 工具表
      var toolRows = safeTools.map(function (tool) {
        return React.createElement(
          "tr",
          { key: tool.name },
          React.createElement("td", { style: s.tdName }, tool.name),
          React.createElement("td", { style: Object.assign({}, s.td, s.num) }, String(tool.calls)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num) }, fmtDuration(tool.ms)),
          React.createElement("td", { style: Object.assign({}, s.td, s.num, { color: C.text3 }) }, tool.calls > 0 ? (tool.ms / tool.calls / 1000).toFixed(1) + " s/次" : "–")
        );
      });

      // 图表标题（v0.3.0 多粒度）
      var chartTitle = r.label + "用量";
      var chartHint = r.granularity === "week"
        ? "按周折叠（周一为周开始，北京时间）"
        : (r.granularity === "hour" ? "按小时（最近 7d × 24h）" : (r.granularity === "minute" ? "按分钟（最近 24h × 60min）" : null));

      // 各 section 按 visibility 过滤后顺序拼接，第一个不加 hr（紧跟 header/errorBox）
      var sectionNodes = [];
      if (visibility.meta) sectionNodes.push({ key: "meta", node: metaNode });
      if (visibility.cards) sectionNodes.push({ key: "cards", node: cardsNode });
      if (visibility.chart) {
        sectionNodes.push({
          key: "chart",
          node: React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "baseline" } },
              React.createElement("h3", { style: s.sectionTitle }, chartTitle),
              chartHint ? React.createElement("span", { style: s.sectionHint }, "· ", chartHint) : null
            ),
            DayChart(winSeries, r.granularity)
          )
        });
      }
      if (visibility.heatmap) {
        // 模型筛选 select（始终显示，无 byModel 数据时不渲染）
        var heatmapModelBar = safeByModel.length > 0
          ? React.createElement(
              "div",
              { style: s.heatmapModelBar },
              React.createElement("span", null, "模型筛选"),
              React.createElement(
                "select",
                {
                  style: s.heatmapModelSelect,
                  value: heatmapModel || "",
                  onChange: function (e) {
                    var v = e.target.value;
                    setHeatmapModel(v === "" ? null : v);
                  },
                  title: heatmapModel ? "当前只显示该模型的每日贡献" : "显示所有模型的每日贡献"
                },
                React.createElement("option", { value: "" }, "全部"),
                safeByModel.map(function (m) {
                  return React.createElement("option", { key: m.model, value: m.model }, m.model);
                })
              )
            )
          : null;
        // v0.3.9：热力图优先消费 byDayAll（历史全量）；老 host（v0.3.8.x
        // 之前无 byDayAll）回落 byDay（即 byTrend.day，近 30 天零填充），
        // 仍能正常显示——只是超过 30 天的历史跨度会丢失。
        var heatmapSource = d.byDayAll && d.byDayAll.length > 0 ? d.byDayAll : (d.byDay || []);
        sectionNodes.push({
          key: "heatmap",
          node: React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "baseline" } },
              React.createElement("h3", { style: s.sectionTitle }, "贡献热力图"),
              React.createElement("span", { style: s.sectionHint }, "· 过去 53 周 · 5 级颜色对应 token 量（基于窗口 max 归一）")
            ),
            heatmapModelBar,
            HeatmapCalendar(heatmapSource, heatmapModel, d.byModel || [])
          )
        });
      }
      if (visibility.byModel) {
        sectionNodes.push({
          key: "byModel",
          node: React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "baseline" } },
              React.createElement("h3", { style: s.sectionTitle }, "按模型"),
              React.createElement("span", { style: s.sectionHint }, "· ", rangeLabel, " · 比值列：未命中 : 命中 : 输出（归一到未命中=1）")
            ),
            Table(
              [
                { label: "模型" },
                { label: "比值", num: true },
                { label: "请求", num: true },
                { label: "未命中", num: true },
                { label: "输出", num: true },
                { label: "推理", num: true },
                { label: "命中", num: true },
                { label: "会话", num: true }
              ],
              modelRows
            )
          )
        });
      }
      if (visibility.topSessions) {
        sectionNodes.push({
          key: "topSessions",
          node: React.createElement(
            "div",
            null,
            React.createElement(
              "h3",
              { style: s.sectionTitle },
              "会话用量 Top " + safeTopSessions.length,
              React.createElement("span", { style: s.sectionHint }, "· 全程")
            ),
            Table(
              [
                { label: "标题" },
                { label: "目录" },
                { label: "日期", num: true },
                { label: "请求", num: true },
                { label: "输出", num: true },
                { label: "总量", num: true }
              ],
              sessionRows
            )
          )
        });
      }
      if (visibility.tools) {
        sectionNodes.push({
          key: "tools",
          node: React.createElement(
            "div",
            null,
            React.createElement(
              "h3",
              { style: s.sectionTitle },
              "工具调用 Top " + safeTools.length,
              React.createElement("span", { style: s.sectionHint }, "· 全程")
            ),
            Table(
              [
                { label: "工具" },
                { label: "次数", num: true },
                { label: "总耗时", num: true },
                { label: "平均", num: true }
              ],
              toolRows
            )
          )
        });
      }

      return React.createElement(
        "div",
        { style: { maxWidth: "1080px" } },
        header,
        ScanStatus(d),
        errorBox,
        sectionNodes.length === 0
          ? React.createElement("div", { style: Object.assign({}, s.meta, { marginTop: "20px" }) }, "已隐藏全部数据块，点右上角「显示」重新选择。")
          : sectionNodes.map(function (sec, i) {
              return React.createElement(
                "div",
                { key: sec.key },
                i > 0 ? React.createElement("hr", { style: s.hr }) : null,
                sec.node
              );
            })
      );
    }    // ===== apply =====
    function apply(ctx) {
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register(
          {
            name: "settings.section",
            id: "usage-stats",
            order: 40,
            label: function () { return "使用统计"; }
          },
          UsageStatsPage
        );
      });
    }

    exports.inject = inject;
    exports.apply = apply;return module.exports;
  },
});