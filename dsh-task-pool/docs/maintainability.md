# dsh-task-pool 拆分清单

本插件的 client bundle 在 `lib/client.js` 已拆分为 `lib/client-src/` 多文件结构。通用规范（marker 约定、ES5 编码风格、构建脚本格式、字节验证、阈值）写在 [`../../docs/maintainability.md`](../../docs/maintainability.md)——**那是本仓库所有 DSH 插件共用的规范**。

本文件只列**本插件**的具体 section 拆分。

## 一、本插件的 section 索引

dsh-task-pool 的 `lib/client-src/` 现行结构（v0.6.0 拆解）：

| 前缀                  | 角色                                                                       |
| --------------------- | -------------------------------------------------------------------------- |
| `00-banner.js`        | 顶部 JSDoc 注释块（v0.6.0 schema 简化说明 + 持久化 + send 调用路径）        |
| `10-loader-open.js`   | `__ModuleLoader__.load({...})` 开头 + `var inject = ["sessions"]`           |
| `20-constants.js`     | 常量（`STORAGE_KEY` / `DRAWER_ATTR` / `ANY_DRAWER_ATTR` / `DRAWER_WIDTH` / `PANEL_NAME` / `ACTIVATE_EVENT`） |
| `25-utils.js`         | `uuid` / `pad2` / `beijingDate` / `relativeTime` / `beijingDateTime`       |
| `30-styles.js`        | CSS 字符串 + `injectCSS`（DTPD_section / DTPD_row / DTPD_panel / DTPD_fab 等全部抽屉样式） |
| `35-storage.js`       | `LocalStorageTaskStore`（class）：`isTaskShape` / `parseDoc`（旧 schema 自动迁移）/ `load` / `save` |
| `40-controller.js`    | `BoardController` 类：状态（`tasks` / `drawerOpen` / `pinned` / `expandedId` / `confirmDelete` / `confirmSend` / `deleteAfterSend` / `listeners`）+ CRUD + `requestSend`（两阶段发送）/ `sendTask`（走 sessions service）/ `reorder` |
| `45-fab.js`           | `mountFab(controller)`：右上角 FAB + 钉住状态点 + open/closed SVG 切换     |
| `50-drawer.js`        | `mountRightDrawer(controller)`：互斥协议（`KNOWN_DRAWER_ATTRS` 4 个 panel）+ `applyOpen`（v0.5.6 race condition 修复）/ `onClickOutside` / `onOtherActivate` + FAB 让位公式 `calc(var(--active-drawer-width, 380px) + 24px)` |
| `55-view.js`          | `renderDrawerView(container, controller)`：header（包括 inline 新建 + 发送后删除开关 + 钉住 + 关闭）+ body（empty 占位 / list 渲染）+ `buildTaskHead` / `buildExpandPanel` / `bindDrag`（拖动重排）+ `bindGlobalKey`（Esc 优先级链）+ send armed 4 秒倒计时 |
| `60-apply.js`         | `apply(ctx)` 函数：注入样式 + 实例化 `BoardController` + `start()` + `mountFab` + `mountRightDrawer` |
| `Z9-loader-close.js`  | `exports.apply` / `exports.inject` / `exports.name` + `return module.exports` + `});` 收尾 |

## 二、本插件特殊项

- **bundle 大小**：v0.6.0 拆解完成 + preflight marker 后是 46491 字节。原 46256 字节（仅中文 marker），9 个英文 marker 替换原中文 marker 引入 235 字节（§ 五 "DIFFERS 是预期"）。所有同类约束在通用 `maintainability.md` § 五
- **持久化**：`localStorage` key `dsh.taskPool.v1`，schema 兼容 v1 / v2 / v3（v0.6.0 引入 `{content}` 单字段；旧 `{title, description}` 自动合并为 `content = title + (description ? "\n\n" + description : "")`）
- **互斥协议**：`dsh-panel-activate` CustomEvent + `<html data-dsh-taskpool-drawer-open>` / `data-dsh-any-side-drawer-open`。`50-drawer.js` 的 `KNOWN_DRAWER_ATTRS = [...]` 列出 4 个 panel attribute（taskpool / github / ssh / taskboard），新增面板时在这里加一行
- **FAB 让位**：FAB 监听 `ANY_DRAWER_ATTR`（任意右侧抽屉打开），让位距离 `calc(var(--active-drawer-width, 380px) + 24px)` 随实际打开抽屉宽度变化——`--active-drawer-width` 由打开抽屉的 panel 在 `applyOpen(open)` 时 setProperty 设定
- **发送双阶段确认**：`requestSend` 第一次进入 `confirmSend` armed 态（按钮文字 "再点一次确认发送（4）" + 4 秒倒计时），第二次再按才真发；超时 / 切换卡片 / Esc 撤销 armed 态。走 `sessions.binding(current).session.driver.prompt([{text}], "queue")` 发到当前会话
- **拖动重排**：通过 HTML5 dragstart/dragover/drop 事件 + `dataTransfer.setData("text/plain", id)`，每行 18px 宽拖手柄（`[data-role="handle"]`）。listEl 末端拖入时高亮整列表底边

## 三、相关

- 通用规范：[`../../docs/maintainability.md`](../../docs/maintainability.md)
- 构建脚本：`lib/build-client.cjs`
- 字节校验：`lib/verify-client.cjs`
- DSH 插件作者 skill：`dsh-persistent-plugin-authoring`（DSH skill 目录下）
