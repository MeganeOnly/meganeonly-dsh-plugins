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
 * v0.2.2 新增「贡献热力图」：GitHub 风格 53 周 × 7 日方格日历，
 * 颜色严控色板（L1-L3 蓝主对浅→深 / L4 橙爆日 / L5 rose 异常日，
 * 复用 v0.2.1 inputBar / outputBar / peakLine 同色，不引入新色板）。
 * 模型筛选独立持久化（localStorage `dsh-usage-stats/heatmap-model-v1`，
 * null = 全部模型聚合；非 null = 仅该模型贡献的 input/output）。
 * 显示设置 7 块 schema 扩 `heatmap` 字段，隐式迁移（缺字段默认 true）。
 * 详见 `lib/client-src/40-components.js` 的 HeatmapCalendar 与
 * `lib/client-src/50-config.js` 的 loadHeatmapModel / saveHeatmapModel。
 */