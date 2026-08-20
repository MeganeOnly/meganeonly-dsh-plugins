# dsh-git-hub 拆分清单

本插件的 client bundle 在 `lib/client.js` 已拆分为 `lib/client-src/` 多文件结构。通用规范（marker 约定、ES5 编码风格、构建脚本格式、字节验证、阈值）写在 [`../../docs/maintainability.md`](../../docs/maintainability.md)——**那是本仓库所有 DSH 插件共用的规范**。

本文件只列**本插件**的具体 section 拆分。

## 一、本插件的 section 索引

dsh-git-hub 的 `lib/client-src/` 现行结构（v0.3.0 拆解 + preflight marker）：

| 前缀              | 角色                                                         |
| ----------------- | ------------------------------------------------------------ |
| `00-banner.js`    | 顶部 JSDoc 注释块（design notes + 数据形态 schema）         |
| `10-loader-open.js` | `__ModuleLoader__.load({...})` 开头 + `var inject = ["sessions"]` |
| `20-constants.js` | 常量（`STORAGE_KEY` / `DRAWER_ATTR` / `ANY_DRAWER_ATTR` / `DRAWER_WIDTH` / `PANEL_NAME` / `ACTIVATE_EVENT` / `POLL_INTERVAL_MS`） |
| `30-utils.js`     | date / fetch helpers：`beijingDate` / `pad2` / `beijingDateTime` / `relativeTime` / `parseGitDate` / `apiFetch` |
| `40-summary.js`   | `sendRepoSummaryToSession` + `buildSummaryText`：把仓库摘要拼成 user message 注入当前对话 |
| `50-toast.js`     | `showToast(message, kind)`：右下角临时 toast                  |
| `60-styles.js`    | CSS 字符串 + `injectCSS`：所有 DGH_ 前缀样式                |
| `70-storage.js`   | `LocalStorageStore`（class）+ `load` / `save` 持久化钉住/隐藏列表 |
| `80-controller.js` | `Controller` 类：状态、`refresh` / `loadConfig` / `saveConfig` / `pushRepo` / `pushAll` / `pollPushStatus` / `loadCommitStatus` / `commit` / `mergeRepo` / `pullRepo` / `abortMerge` / `sendRepoToSession` |
| `90-fab.js`       | FAB 图标 + `mountFab(controller)`                            |
| `A0-drawer.js`    | `mountDrawer(controller)`：互斥协议（`KNOWN_DRAWER_ATTRS`）+ DOM 挂载 |
| `B0-view.js`      | `renderDrawerView(container, controller)`：header（含「显示选项」按钮）/ `renderOptionsMenu`（v0.5.0：4 个 section 开关下拉菜单）/ push status / commit 工具区 / merge 工具区 / body / config panel / 仓库卡片 |
| `C0-apply.js`     | `apply(ctx)` 函数 + exports（`apply` / `inject` / `name`） |

## 二、本插件特殊项

- **bundle 大小**：v0.3.0 拆解完成 + preflight marker 后是 90082 字节。所有同类约束在通用 `maintainability.md` § 五
- **互斥协议**：`dsh-panel-activate` CustomEvent + `<html data-dsh-github-drawer-open>` / `data-dsh-any-side-drawer-open`。见 `60-styles.js` 的 FAB 让位 CSS 与 `A0-drawer.js` 的 `KNOWN_DRAWER_ATTRS = [...]`
- **持久化 schema**：`localStorage` key `dsh.gitHub.v1`，schema v4 = `{ pinnedPaths, hiddenPaths, sections: { commit, merge, pushStatus, perCardPush } }`（v1→v2→v3→v4 全部隐式迁移；不升 key）。详细 schema 写在 `00-banner.js` 顶部注释

## 三、相关

- 通用规范：[`../../docs/maintainability.md`](../../docs/maintainability.md)
- 构建脚本：`lib/build-client.cjs`
- 字节校验：`lib/verify-client.cjs`
- DSH 插件作者 skill：`dsh-persistent-plugin-authoring`（DSH skill 目录下）
