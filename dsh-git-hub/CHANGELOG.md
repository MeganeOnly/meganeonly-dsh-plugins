# Changelog

本文件记录 `dsh-git-hub` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增

- **合并工具区**：抽屉内 commit 区下方新增「🔀 合并」区，每可合并仓库一行：本地分支下拉 → merge 进当前分支 / 拉上游（`git pull` 或 `git pull --rebase`）/ 检测 `.git/MERGE_HEAD` 与 rebase-merge 给出冲突文件列表 + ✕ abort 按钮。仅对「≥2 本地分支 / 有 upstream / 处于合并/变基冲突中」的仓库展示，其他仓库零噪声。
  - 冲突态判定走文件系统（`.git/MERGE_HEAD` / `rebase-merge` / `rebase-apply`），比解析 `status` 输出更可靠，覆盖 merge / rebase / pull --rebase 全部入口。
  - dirty 工作区硬阻断：避免 merge 失败 + 工作区污染难回滚。
  - 冲突不主动 abort → 保留状态给用户决定"解决后 commit"或"abort"。
  - `parseConflictFiles` 处理 Windows stdout 输出（`CONFLICT` 行常写到 stdout 而非 stderr）+ rename `old -> new` / 引号包裹路径 / 去重。
- **手动 commit 工具多仓库**：抽屉顶部 commit 区遍历 scanRoots 下所有有改动的仓库，每行一个仓库 + 输入框 + 提交按钮；繁忙期间所有提交按钮 disabled。

### Host 路由

新增 4 个路由（`lib/index.js`）：

- `GET /api/git-hub/repos/branches?path=...`：列本地分支 + 冲突态
- `POST /api/git-hub/repos/merge`：调 `git merge [--no-ff] <source>`
- `POST /api/git-hub/repos/pull`：调 `git pull [--rebase]`
- `POST /api/git-hub/repos/merge-abort`：调 `git merge --abort` / `rebase --abort`
- `GET /api/git-hub/repos/merge-status`：扫所有可合并仓库（批量渲染用）

## [0.2.1] - 2026-08-19

作为独立 npm 包发布的初始版本，包含以下已有功能。

### 新增

- 右侧悬浮按钮（FAB）+ 右侧抽屉的仓库管理面板，与对话区共存，与同类抽屉面板互斥显示。
- 仓库扫描：遍历配置的根路径，列出其中的 git 仓库；跳过 `node_modules`、构建产物、虚拟环境等常见目录，并限制递归深度与单次扫描数量。
- 仓库卡片：显示分支、工作区是否干净、未推送 commit 数、当日 commit 数与最新 commit 摘要，状态徽章带说明性悬停提示。
- 推送操作：单仓库推送与批量推送，均以独立子进程调用外部推送脚本执行，立即返回而不阻塞界面。
- 推送状态按需轮询：仅在有推送运行时以 4 秒间隔轮询，推送结束或抽屉关闭时自动停止，空闲时不发起网络请求。
- 推到对话：将仓库摘要作为用户消息注入当前会话，便于在对话中继续处理远端事务。
- 钉住与隐藏：钉住的仓库置顶，隐藏的仓库不在列表显示且禁止推送；提供隐藏选择模式便于批量标记。
- 配置面板：在抽屉内编辑扫描根路径列表，以原子写方式持久化到 web profile 根目录下的 `.git-hub-config.json`。
- 宿主半段暴露 `/api/git-hub/*` 系列 HTTP 路由（配置读写、仓库列表、强制刷新、推送触发、推送状态）。
- 界面状态（钉住 / 隐藏列表）持久化在浏览器 `localStorage`，并在存储不可用时降级为内存存储。