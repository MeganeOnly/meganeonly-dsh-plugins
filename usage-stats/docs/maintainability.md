# dsh-usage-stats 拆分清单

本插件的 client bundle 在 `lib/client.js` 已拆分为 `lib/client-src/` 多文件结构。通用规范（marker 约定、ES5 编码风格、构建脚本格式、字节验证、阈值）写在 [`../../docs/maintainability.md`](../../docs/maintainability.md)——**那是本仓库所有 DSH 插件共用的规范**。

本文件只列**本插件**的具体 section 拆分。

## 一、本插件的 section 索引

dsh-usage-stats 的 `lib/client-src/` 现行结构（v0.2.0 拆解）：

| 前缀                | 角色                                                         |
| ------------------- | ------------------------------------------------------------ |
| `00-banner.js`      | 顶部 JSDoc 注释块（功能说明 + v0.2.0 新增「显示设置」摘要）  |
| `10-loader-open.js` | `__ModuleLoader__.load({...})` 开头 + `var inject = ["slots"]` + `var API = "..."`（envelope opening，不加 marker） |
| `20-formatters.js`  | 格式化与聚合：`fmtTokens` / `fmtDuration` / `fmtDate` / `fmtTime` / `fmtSpeed` / `fmtRatio` / `sumDays` / `modelInView` |
| `30-styles.js`      | 样式 token：`C` 颜色变量 + `s` 样式对象（含 panel 相关）    |
| `40-components.js`  | 复用子组件：`Card` / `DayChart` / `Table`                    |
| `50-config.js`      | 常量与持久化：`RANGES`（时间窗口）+ 显示设置 6 键配置 + `defaultVisible` / `loadVisible` / `saveVisible` / `setAllVisible` / `toggleOne` |
| `60-panel.js`       | `VisibilityPanel` 组件（复选框面板）                         |
| `70-page.js`        | 页面主函数：`UsageStatsPage`（顶层，含 visibility / panelOpen state + useEffect 持久化 + click-outside 监听）+ `UsageStatsPageBody`（按 visibility 过滤渲染 6 个数据块） |
| `Z0-apply.js`       | `apply(ctx)` 函数 + `exports.inject` / `exports.apply`       |
| `Z9-loader-close.js`| `return module.exports;\n  },\n});`（bundle 末尾闭合，无换行） |

## 二、本插件特殊项

- **bundle 大小**：v0.2.0 拆解完成（含 marker preflight）后是 33344 字节。原 commit `756defa` 提交的 v0.2.0 单文件是 33076 字节（净增量约 268 字节，全部来自 `// ===== X =====` marker 替换原 `/* ---------- xxx ---------- */` 注释；功能字节不变）。所有同类约束在通用 `maintainability.md` § 五
- **显示设置持久化**：`localStorage` key `dsh-usage-stats/visible-v1`，schema `{ meta: boolean, cards: boolean, chart: boolean, byModel: boolean, topSessions: boolean, tools: boolean }`。`loadVisible` 用隐式迁移（缺字段默认 `true`）。详见 `50-config.js`
- **localStorage 降级**：`STORAGE_OK` 在模块装载时一次性检测 QuotaExceededError / SecurityError；不可用时偏好不持久化但功能仍可用并 `console.warn`。详见 `50-config.js` IIFE
- **click-outside 协议**：显示设置面板挂 `[data-usage-stats-panel]` 标记；按钮 wrap 挂 `[data-usage-stats-panel-btn]`；点击 document.mousedown 时 `closest("[data-...])` 判断是否在内部 → 不用 React refs，避坑 DSH DOM 结构不稳。详见 `70-page.js` useEffect
- **本插件用 React.createElement**：与 dsh-git-hub（vanilla DOM）不同。`Object.assign({}, style1, style2)` 用于样式合并（ES5 兼容）
- **形参命名陷阱**：原版 `sessionRows.map(function (s) { ... })` 中形参 `s` 遮蔽外层样式对象 `var s`，导致 `s.tdName`/`s.td`/`s.num` 失效。v0.2.0 已修复为 `function (sess) { ... }`

## 四、相关

- 通用规范：[`../../docs/maintainability.md`](../../docs/maintainability.md)
- 构建脚本：`lib/build-client.cjs`
- 字节校验：`lib/verify-client.cjs`
- DSH 插件作者 skill：`dsh-persistent-plugin-authoring`（DSH skill 目录下）