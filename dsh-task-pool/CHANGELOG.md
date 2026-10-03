# Changelog

本文件记录 `dsh-task-pool` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.6.4] - 2026-10-03

### 兼容性

- 已对照本机安装的 DSH v0.2.0-rc.2 源码逐条核验，本插件接口契约全部成立，**无需改动任何代码**：
  - 宿主半端 `lib/index.js` 仍是零副作用占位：`export const inject = []`（L17）、`apply()` 为空函数体（L19-21）；`ctx.systemPrompt` / `ctx.webServer` / `ctx.inject` 三个名字**只出现在文件头注释**（L9-11）中，不在可执行代码里——注释描述与实际行为一致，未注册 system prompt 段、未注册 HTTP 路由、不读写磁盘。
  - 不涉及 `ctx.webServer.register`，因此无需路由查重守卫；`tools/check-dsh-contract.cjs` 对本包的包清单（`dsh.bundle.patch` / `dsh.client.platform` / `exports["./client"]` / `lib/index.js` / `lib/client.js`）与 client bundle 的 `__ModuleLoader__` 信封 id 校验全部通过。
  - 浏览器半端只依赖 slot key `conversation.input.dock`：0.2.0-rc.2 的 slot catalog 中该 key 仍为 `list` / `session`（`@deepseek-ai/dsh-cordis-client-runner/lib/client.js:3004-3006`），FAB / 抽屉注册照旧。
  - 数据持久化仍走浏览器 `localStorage`（key `dsh.taskPool.v1`），不触及 `ctx.agents` / `ctx.session` / `ctx.subprocess` 等宿主运行时 API。
- **client 半端未改**：`lib/client-src/*.js` 与产物 `lib/client.js` 本轮均未编辑，因此**未跑** `node lib/build-client.cjs` / `node lib/verify-client.cjs`（无源改动即无需重建，避免无谓的产物扰动）。`lib/client.js` 保持 46223 字节，与 v0.6.2 注释精简后的体积一致。

### 改动文件

- `CHANGELOG.md`（本段）
- `package.json`（version 0.6.3 → 0.6.4）

## [Unreleased]

### 兼容性

- 已对照 DSH v0.1.5-rc.1 源码（`deepseek-ai/deepseek-harness@dsh-v0.1.5-rc.1`，SHA `183f08e9c6dde7e36cd2318eaee70b0da08fb35e`）的破坏性变更清单做兼容性核对，本插件无代码变更：
  - 客户端 FAB / 抽屉 slot `conversation.input.dock` 在 v0.1.5-rc.1 源码中**未重命名**（§ 三-5 重命名清单仅是 release notes 提示，源码实际保留原 key），FAB / 抽屉注册照旧。
  - 数据持久化走 `localStorage`（key `dsh.taskPool.v1`）+ 自管 UI 状态，不依赖 DSH agent / session / inbox 运行时 API。
  - 不涉及 `ctx.agents` / `ctx.session` / `ctx.subprocess` 字段访问，`§ 三` 全部 14 项清单均不命中。
- 行为零变化——升级 DSH 内核至 v0.1.5-rc.1 不需改本插件任何代码。

### 改动文件

- `CHANGELOG.md`（本段）
- `package.json`（version 0.6.2 → 0.6.3）

## [0.6.2] - 2026-09-04

### 注释精简

- **注释精简**：移除 19 行冗余段头 + 版本历程注释；保留 section marker / WHY / JSDoc。
  - 移除 9 处段首中文重复 marker（`// ===== 常量 =====` 等）+ 中文类名 / 角色描述（"LocalStorageTaskStore"、"FAB 图标（精确居中）"、"Right drawer mount"、"Drawer view"）
  - 移除 `30-styles.js` 的 8 处 inline CSS 段头（`// 抽屉容器` / `// header` / `// body / list` / `// 单条长条卡片` / `// 拖动视觉提示` / `// 卡片展开面板` / `// header 内的"发送后删除"开关（全局）` / `// FAB（…）`）
  - 移除 `40-controller.js` / `50-drawer.js` 的 `[perf v0.x]` / `[perf v0.5.x]` 版本号 stamp——保留 `[perf]` WHY 主体但去掉版本引用
  - 移除 `40-controller.js` 段首 `BoardController（v0.5.0：新增 deps + confirmSend + sendTask） =====` 这类带版本历程的 marker
- **bundle 大小**：`lib/client.js` 从 46999 字节 → 46223 字节（-776B / -1.7%）
- **保留的注释**：`30-styles.js` FAB 让位公式长解释（`calc(var(--active-drawer-width, 380px) + 24px)`）、`50-drawer.js` `applyOpen` race condition 长解释（live v0.5.6 关键修复）；`35-storage.js` 旧 schema 迁移说明
- **doc**：`docs/maintainability.md` 新增 § 二「注释约定」+ 调整 § 三 / § 四；通用规范 `docs/maintainability.md` § 三三 + § 三半 继续适用

## [0.6.1] - 2026-09-04

### 重构

- **client bundle 拆分**（按 `docs/maintainability.md` 通用规范）：原 970 行 / 46.1 KB 单文件 `lib/client.js` 超过触发阈值（≥ 700 行 / 30 KB），拆为 12 个 source section（`lib/client-src/00-banner.js` 到 `Z9-loader-close.js`）。新增 `lib/build-client.cjs`（拼回 client.js）与 `lib/verify-client.cjs`（与 HEAD 字节级校验）脚本；`package.json` 加 `build:client` / `verify:client` / `prepare` 脚本。段首 marker 改为英文 short-name（与文件名 `name` 部分一致），原中文 marker 注释保留作为内部说明。

### 兼容性

- client bundle 字节级与 v0.6.0 相同（verify:client BYTE-IDENTICAL）；host 半端零改动；DSH 0.1.2-rc.1 下宿主零副作用占位 `apply()` 仍正常工作，浏览器 FAB / 抽屉 / slot `conversation.input.dock` 注册照旧。

## [0.6.0] - 2026-08-19

任务结构从 `{ title, description }` 双字段简化为单字段 `{ content }`。

### Changed

- 任务卡片从"标题 + 描述预览"两行布局简化为单行内容预览。
- 卡片就地展开面板从"标题 input + 描述 textarea"两栏简化为单段"内容" textarea（Enter 换行，Ctrl/⌘+Enter 保存）。
- 抽屉头部 inline 新建输入框 placeholder 从"新建任务…"改为"新建任务内容…"。
- 发送时直接把 `content` 作为 user message，不再拼接 title 与 description。

### 数据迁移

- 旧 schema `{ title, description, ... }` 在加载时自动迁移：
  - `content = title + (description ? "\n\n" + description : "")`
  - 迁移后的任务在下次保存时只保留新 schema 字段（剥离 `title` / `description`）
- 旧任务的内容不会丢失；只是从两栏合并为一段。

## [0.5.6] - 2026-08-19

作为独立 npm 包发布的初始版本，包含以下已有功能。

### 新增

- 右侧悬浮按钮（FAB）+ 380 px 右侧抽屉的任务池面板，与对话区共存，与同类抽屉面板互斥显示。
- 抽屉头部常驻输入框：回车即创建任务，无需切换任何状态。
- 任务卡片：单列长条布局，显示标题、描述预览与创建时间；点击卡片在原位展开编辑面板（修改标题与描述、查看时间、删除、收起），同一时刻只展开一张。
- 拖动排序：拖动手柄在列内上下重排，落点显示插入线。
- 发送到当前对话：两次点击确认，第一次进入待确认态并显示 4 秒倒计时，超时或切换卡片自动撤销。
- 发送后删除：抽屉头部的全局开关控制发送成功后是否从池中移除任务，默认移除。
- 钉住：钉住后下次启动自动展开抽屉。
- 键盘支持：`Esc` 按优先级依次撤销删除确认、收起展开卡片、关闭抽屉。
- 数据持久化在浏览器 `localStorage`（键 `dsh.taskPool.v1`），兼容早期结构并按缺省值隐式补齐；存储不可用时降级为内存存储。
- 跨面板 FAB 让位协议：任意右侧抽屉打开时，所有 FAB 让位到抽屉左侧外部，让位距离随实际抽屉宽度变化。
- 宿主半段为零副作用占位实现，不注册路由、不读写磁盘。
