# dsh-git-hub 拆分清单

本插件的 client bundle 在 `lib/client.js` 已拆分为 `lib/client-src/` 多文件结构。通用规范（marker 约定、ES5 编码风格、构建脚本格式、字节验证、阈值）写在 [`../../docs/maintainability.md`](../../docs/maintainability.md)——**那是本仓库所有 DSH 插件共用的规范**。

本文件只列**本插件**的具体 section 拆分 + 注释约定（v0.5.2 起精简注释后）。

## 一、本插件的 section 索引

dsh-git-hub 的 `lib/client-src/` 现行结构（v0.5.x 拆解 + v0.5.2 注释精简后 19 个文件；具体 section 职责见各文件头注释）：

| 前缀                   | 角色                                                                       |
| ---------------------- | -------------------------------------------------------------------------- |
| `00-banner.js`         | 顶部 JSDoc 注释块（design notes + 数据形态 schema）；v0.5.2 起保留整块（架构锚点） |
| `10-loader-open.js`    | `__ModuleLoader__.load({...})` 开头 + `var inject = ["sessions"]`          |
| `20-constants.js`      | 常量（`STORAGE_KEY` / `DRAWER_ATTR` / `ANY_DRAWER_ATTR` / `DRAWER_WIDTH` / `PANEL_NAME` / `ACTIVATE_EVENT` / `POLL_INTERVAL_MS`）+ attr 协议 WHY |
| `30-utils.js`          | date / fetch / HTML helpers：`beijingDate` / `pad2` / `beijingDateTime` / `relativeTime` / `parseGitDate` / `apiFetch` / `escapeHtml`（v0.5.x 从 B0-view.js 上移到工厂体层级） |
| `40-summary.js`        | `sendRepoSummaryToSession` + `buildSummaryText`：把仓库摘要拼成 user message 注入当前对话 |
| `50-toast.js`          | `showToast(message, kind)`：右下角临时 toast                                |
| `60-styles.js`         | CSS 字符串 + `injectCSS`：所有 DGH_ 前缀样式（含 FAB 让位公式 `calc(var(--active-drawer-width) + 24px)` + 抽屉 race condition 注释） |
| `70-storage.js`        | `LocalStorageStore`（class）+ `load` / `save` 持久化钉住/隐藏/sections；隐式迁移 v1→v2→v3→v4 不升 key |
| `80-controller.js`     | `Controller` 类：构造器 + 状态 + 持久化 + UI 切换（`toggleDrawer` / `togglePin` / `toggleHide` / `setSelectionMode` / `toggleOptions` / `toggleSection`）+ config（`refresh` / `loadConfig` / `saveConfig`）；含 push 智能轮询 toggleDrawer 联动说明 |
| `82-controller-push.js` | push 子系统：`pushRepo` / `pushAll` / `pollPushStatus` / `startPushPoll` / `stopPushPoll`；含智能轮询核心说明 |
| `84-controller-commit.js` | commit 子系统：`loadCommitStatus` / `commit`                            |
| `86-controller-merge.js` | merge / pull / abort + send 子系统：`loadMergeStatus` / `mergeRepo` / `pullRepo` / `abortMerge` / `sendRepoToSession` |
| `90-fab.js`            | FAB 图标 + `mountFab(controller)`                                          |
| `A0-drawer.js`         | `mountDrawer(controller)`：互斥协议（`KNOWN_DRAWER_ATTRS`）+ DOM 挂载；含抽屉 race condition 关键修复长注释（live bug） |
| `B0-view.js`           | `renderDrawerView(container, controller)`：header（`「显示选项」按钮`）/ `renderOptionsMenu` / push status / body 编排 / config panel（diff-skip 缓存 + 受控渲染守卫） |
| `B5-repo-card.js`      | `buildRepoCard(repo, snap, controller)` + `truncate`：单仓库卡片 DOM 构造 |
| `B7-sections.js`       | `renderCommitSection(row, controller)` + `renderMergeSection(row, controller)`：commit / merge-pull 工具区 |
| `C0-apply.js`          | `apply(ctx)` 函数 + exports（`apply` / `inject` / `name`）                 |
| `Z9-loader-close.js`   | 闭合 `__ModuleLoader__.load` + `return module.exports`                     |

## 二、注释约定（v0.5.2 起的精简规范）

v0.5.2 之前，每个 source 文件的 header 都有 30–190 行版本历程（"v0.X.Y 起 + 修复 + 根因 + 兼容性 + 改动文件列表"）+ 多段 inline 版本注释解释"为什么这段代码这么写"。这些注释与 `CHANGELOG.md` 高度重复，加起来让 `lib/client.js` bundle 多出 ~4 KB 注释载荷。

**v0.5.2 起的规则**：

1. **版本历程只在 `CHANGELOG.md`**——任何"v0.X.Y 修了这个"的叙述都进 changelog；source 文件 header / inline 注释只保留与当前实现直接相关的"是什么 / 为什么"，不带版本号。
2. **保留的注释类型**：
   - JSDoc 段（`/** ... */`）说明函数做什么、参数 / 返回含义（v0.5.2 起 banner 保留整块、其他 JSDoc 去掉 `vX.Y.Z：`前缀）
   - 行内 `//` 说明非显然的设计决策（"为什么"不是"做了什么"）——例如 attr 互斥协议、FAB 让位公式、push 智能轮询 why
   - CSS 注释说明 selector 意图（如让位公式 `calc(var(--active-drawer-width) + 24px)` 的来源）
3. **移除的注释类型**：
   - 段落级版本历程（v0.X.Y 起 + 修复 + 根因 + 修法 + 兼容性 + 改动文件列表）
   - "本 tweak 的 N 条要点"长 enumerate
   - 重复"compatibility: 不变类名 / ID / attribute / localStorage key"段落
4. **CHANGELOG.md 是版本历程的唯一来源**——git log + CHANGELOG 段能完整还原任何版本的修复动机 + 文件影响，source 文件不再重复。
5. **通用规范 `docs/maintainability.md` § 三三"注释规范"**继续适用——JSDoc 用单行 `/** ... */`，子模块用 `// ----- xxx -----` 隔开，inline `// why not what`。

**特殊保留（live bug / 跨文件协议）**：

- **A0-drawer.js 抽屉 race condition 长解释**：互斥协议下 A 抽屉关闭分支必须不能移除统一 attr + CSS 变量——是 live bug 修复说明，不是版本历程。保留。
- **20-constants.js attr 协议 WHY**：解释 `ANY_DRAWER_ATTR` / `DRAWER_ATTR` 跨面板互斥语义；与 dsh-task-pool 等共享，跨文件协议说明保留。
- **60-styles.js FAB 让位公式**：让位公式 `calc(var(--active-drawer-width) + 24px)` 的来源（不同宽度抽屉用固定值会错乱）保留——这是 CSS 层的非显然设计。
- **82-controller-push.js 智能轮询核心说明**：仅在有推送运行时持续轮询、推送结束自动停、空闲 0 网络请求——核心策略 WHY 保留。
- **00-banner.js 顶部 JSDoc 整块**：架构 + DOM 锚点约定 + 文件拆分 pointer（详见 `dsh-ui-tweaks` § 二"banner 整块保留"先例）。

## 三、本插件特殊项

- **bundle 大小**：v0.5.2 注释精简后 `lib/client.js` ≈ 100200 字节（原 v0.5.1 104641，-4.2% / -4.4 KB）；v0.5.0 拆解时是 90082 字节，v0.5.x 二级拆分（B0-view.js / 80-controller.js 收敛）后是 104088-104197。所有同类约束在通用 `maintainability.md` § 五
- **bundle 形态**：v0.5.2 仍是 split bundle（19 个 client-src 文件）；阈值是通用规范 § 八的 700 行 / 30 KB 软目标
- **行尾换行**：与通用规范 § 五一致——非末尾 section 文件末尾 `}\n\n`，末尾 section `}\n`，`Z9-loader-close.js` 末行无 `\n`
- **B0-view.js 二级拆分**：v0.5.x 把 B0-view.js 中的 `buildRepoCard`（130 行）+ `renderCommitSection`/`renderMergeSection`（185 行）+ `escapeHtml`（10 行）上移到工厂体层级 → 新增 `B5-repo-card.js` / `B7-sections.js`，`escapeHtml` 收纳到 `30-utils.js`。原因：B0-view.js 单文件 639 行 / 38 KB 远超 50-500 行软目标，AI 局部改多次因全文件过大误伤同变量引用
- **互斥协议**：`dsh-panel-activate` CustomEvent + `<html data-dsh-github-drawer-open>` / `data-dsh-any-side-drawer-open`。见 `60-styles.js` 的 FAB 让位 CSS 与 `A0-drawer.js` 的 `KNOWN_DRAWER_ATTRS = [...]`
- **持久化 schema**：`localStorage` key `dsh.gitHub.v1`，schema v4 = `{ pinnedPaths, hiddenPaths, sections: { commit, merge, pushStatus, perCardPush } }`（v1→v2→v3→v4 全部隐式迁移；不升 key）。详细 schema 写在 `00-banner.js` 顶部注释
- **push 智能轮询**：抽屉打开不立即启动轮询，仅在有推送运行时以 4 秒间隔轮询（`POLL_INTERVAL_MS`），推送结束或抽屉关闭自动停。详见 `82-controller-push.js#pollPushStatus` 与 `20-constants.js#POLL_INTERVAL_MS`

## 四、相关

- 通用规范：[`../../docs/maintainability.md`](../../docs/maintainability.md)
- 兄弟插件 dsh-ui-tweaks 注释精简先例：[`../dsh-ui-tweaks/docs/maintainability.md`](../dsh-ui-tweaks/docs/maintainability.md)
- 构建脚本：`lib/build-client.cjs`
- 字节校验：`lib/verify-client.cjs`
- 版本历程（注释精简后唯一来源）：`CHANGELOG.md`
- DSH 插件作者 skill：`dsh-persistent-plugin-authoring`（DSH skill 目录下）
