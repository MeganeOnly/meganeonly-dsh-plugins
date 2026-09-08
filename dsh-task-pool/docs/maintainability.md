# dsh-task-pool 拆分清单

本插件的 client bundle 在 `lib/client.js` 已拆分为 `lib/client-src/` 多文件结构。通用规范（marker 约定、ES5 编码风格、构建脚本格式、字节验证、阈值）写在 [`../../docs/maintainability.md`](../../docs/maintainability.md)——**那是本仓库所有 DSH 插件共用的规范**。

本文件只列**本插件**的具体 section 拆分。

## 一、本插件的 section 索引

dsh-task-pool 的 `lib/client-src/` 现行结构（v0.6.0 拆解，v0.6.2 精简注释后 12 个文件；具体 section 职责见各文件头注释）：

| 前缀                  | 角色                                                                       |
| --------------------- | -------------------------------------------------------------------------- |
| `00-banner.js`        | 顶部 JSDoc 注释块（架构 + schema + 持久化 + send 调用路径；v0.6.2 起保留） |
| `10-loader-open.js`   | `__ModuleLoader__.load({...})` 开头 + `var inject = ["sessions"]`           |
| `20-constants.js`     | 常量（`STORAGE_KEY` / `DRAWER_ATTR` / `ANY_DRAWER_ATTR` / `DRAWER_WIDTH` / `PANEL_NAME` / `ACTIVATE_EVENT`） |
| `25-utils.js`         | `uuid` / `pad2` / `beijingDate` / `relativeTime` / `beijingDateTime`       |
| `30-styles.js`        | CSS 字符串 + `injectCSS`（DTPD_section / DTPD_row / DTPD_panel / DTPD_fab 等全部抽屉样式 + FAB 让位公式 `calc(var(--active-drawer-width, 380px) + 24px)` 长解释） |
| `35-storage.js`       | `LocalStorageTaskStore`（class）：`isTaskShape` / `parseDoc`（旧 schema 自动迁移）/ `load` / `save` |
| `40-controller.js`    | `BoardController` 类：状态（`tasks` / `drawerOpen` / `pinned` / `expandedId` / `confirmDelete` / `confirmSend` / `deleteAfterSend` / `listeners`）+ CRUD + `requestSend`（两阶段发送）/ `sendTask`（走 sessions service）/ `reorder` |
| `45-fab.js`           | `mountFab(controller)`：右上角 FAB + 钉住状态点 + open/closed SVG 切换     |
| `50-drawer.js`        | `mountRightDrawer(controller)`：互斥协议（`KNOWN_DRAWER_ATTRS` 4 个 panel）+ `applyOpen`（live race condition 防御性检查 + `isOtherDrawerOpen`）+ `onClickOutside` / `onOtherActivate` |
| `55-view.js`          | `renderDrawerView(container, controller)`：header（包括 inline 新建 + 发送后删除开关 + 钉住 + 关闭）+ body（empty 占位 / list 渲染）+ `buildTaskHead` / `buildExpandPanel` / `bindDrag`（拖动重排）+ `bindGlobalKey`（Esc 优先级链）+ send armed 4 秒倒计时 |
| `60-apply.js`         | `apply(ctx)` 函数：注入样式 + 实例化 `BoardController` + `start()` + `mountFab` + `mountRightDrawer` |
| `Z9-loader-close.js`  | `exports.apply` / `exports.inject` / `exports.name` + `return module.exports` + `});` 收尾 |

## 二、注释约定（v0.6.2 起的精简规范）

v0.6.2 之前，多数 source 文件段首同时有英文 `    // ===== X =====` marker + 中文重复 marker（如 `// ===== 常量 =====` / `// ===== 工具函数 =====` / `// ===== CSS =====` / `// ===== LocalStorageTaskStore =====` / `// ===== BoardController（v0.5.0：…） =====` 等）；`30-styles.js` 还有 `// 抽屉容器` / `// header` / `// body / list` 等 inline 段头标签；`40-controller.js` 与 `50-drawer.js` 有 `[perf v0.x]` / `[perf v0.5.x]` 版本历程注释。冗余注释让 `lib/client.js` 多 ~770 字节注释载荷。

**v0.6.2 起的规则**（mirror `dsh-ui-tweaks/docs/maintainability.md` § 二）：

1. **版本历程只在 `CHANGELOG.md`**——任何 "v0.X.Y 修了这个 / 拆了这个 / 加了这个" 的叙述都进 changelog；source 文件 header 只保留与当前实现直接相关的 "是什么 / 为什么"，不带版本号。
2. **保留的注释类型**：
   - 段首 marker（`    // ===== X =====`，4 空格缩进，名称 = 文件名 `name` 部分，§ 三半硬约束）
   - JSDoc 段（`/** ... */`）说明函数做什么
   - 行内 `//` 说明非显然的设计决策（WHY 不 WHAT）——例如 `BoardController.confirmSend` 的 two-step armed 语义、`applyOpen` 互斥协议 race condition 防御、`setSelectionRange(len, len)` 不 select 的 UX 原因
   - CSS 长解释（30-styles.js 多行拼接里的结构性 WHY 注释——v0.6.2 仅 FAB 让位公式长解释保留，其它段头已 trim）
3. **移除的注释类型**：
   - 段首中文重复 marker（与英文 marker 同义）+ 中文类名 / 角色描述（"LocalStorageTaskStore"、"FAB 图标（精确居中）"、"Right drawer mount"、"Drawer view"）
   - `// 抽屉容器` / `// header` / `// body / list` / `// 单条长条卡片` / `// 拖动视觉提示` / `// 卡片展开面板` 等只标 inline 段的注释
   - `[perf v0.x]` / `[perf v0.5.x]` 中的版本号 stamp——保留 `[perf]` WHY 主体但去掉版本引用
   - 段首 `BoardController（v0.5.0：新增 deps + confirmSend + sendTask） =====` 这类带版本历程的 marker
4. **CHANGELOG.md 是版本历程的唯一来源**——git log + CHANGELOG 段能完整还原任何版本的修复动机 + 文件影响，source 文件不再重复。
5. **通用规范 `docs/maintainability.md` § 三三「注释规范」** 继续适用——JSDoc 用单行 `/** ... */`，子模块用 `// ----- xxx -----` 隔开，inline `// why not what`。

**live 例外**：`50-drawer.js` 的 `applyOpen` race condition 长解释（"关键修复 v0.5.6：…互斥协议 race condition…"）作为 live 行为说明保留——它解释 *当前* 实现的防御性检查（关闭分支也要先 `isOtherDrawerOpen` 再清 attr），不是版本历程。

## 三、本插件特殊项

- **bundle 大小**：v0.6.2 注释精简后 `lib/client.js` = 46223 字节（原 v0.6.1 46999 字节，-776B / -1.7%）。各 source 文件均未触及行数限制。banner / constants / utils / controller / view 等注释载荷都已最小化，剩余多为持久化 / 互斥协议等活语义注释。
- **持久化**：`localStorage` key `dsh.taskPool.v1`，schema 兼容 v1 / v2 / v3（v0.6.0 引入 `{content}` 单字段；旧 `{title, description}` 自动合并为 `content = title + (description ? "\n\n" + description : "")`）
- **互斥协议**：`dsh-panel-activate` CustomEvent + `<html data-dsh-taskpool-drawer-open>` / `data-dsh-any-side-drawer-open`。`50-drawer.js` 的 `KNOWN_DRAWER_ATTRS = [...]` 列出 4 个 panel attribute（taskpool / github / ssh / taskboard），新增面板时在这里加一行
- **FAB 让位**：FAB 监听 `ANY_DRAWER_ATTR`（任意右侧抽屉打开），让位距离 `calc(var(--active-drawer-width, 380px) + 24px)` 随实际打开抽屉宽度变化——`--active-drawer-width` 由打开抽屉的 panel 在 `applyOpen(open)` 时 setProperty 设定
- **发送双阶段确认**：`requestSend` 第一次进入 `confirmSend` armed 态（按钮文字 "再点一次确认发送（4）" + 4 秒倒计时），第二次再按才真发；超时 / 切换卡片 / Esc 撤销 armed 态。走 `sessions.binding(current).session.driver.prompt([{text}], "queue")` 发到当前会话
- **拖动重排**：通过 HTML5 dragstart/dragover/drop 事件 + `dataTransfer.setData("text/plain", id)`，每行 18px 宽拖手柄（`[data-role="handle"]`）。listEl 末端拖入时高亮整列表底边

## 四、相关

- 通用规范：[`../../docs/maintainability.md`](../../docs/maintainability.md)
- 构建脚本：`lib/build-client.cjs`
- 字节校验：`lib/verify-client.cjs`
- 版本历程（注释精简后唯一来源）：`CHANGELOG.md`
- DSH 插件作者 skill：`dsh-persistent-plugin-authoring`（DSH skill 目录下）