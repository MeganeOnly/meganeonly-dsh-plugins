# Changelog

本文件记录 `dsh-task-pool` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 重构

- **client bundle 拆分**（按 `docs/maintainability.md` 通用规范）：原 970 行 / 46.1 KB 单文件 `lib/client.js` 超过触发阈值（≥ 700 行 / 30 KB），拆为 12 个 source section（`lib/client-src/00-banner.js` 到 `Z9-loader-close.js`）。新增 `lib/build-client.cjs`（拼回 client.js）与 `lib/verify-client.cjs`（与 HEAD 字节级校验）脚本；`package.json` 加 `build:client` / `verify:client` / `prepare` 脚本。段首 marker 改为英文 short-name（与文件名 `name` 部分一致），原中文 marker 注释保留作为内部说明。

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
