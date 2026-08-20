# Changelog

本文件记录 `dsh-git-hub` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.5.0] - 2026-08-20

### 新增

- **显示选项菜单（统一管理多个功能区可见性）**：把 v0.4.0 加的「commit 工具区 toggle」按钮升级为「显示选项」按钮。drawer header 里同一个位置、同一枚 git-commit-dot-on-line 图标，点开后弹出浮层菜单，列出 4 个功能区的开关：
  1. **commit 工具区** — 顶部手动 commit 输入框（v0.4.0 起；默认隐藏，沿用 v0.4.0 偏好）
  2. **合并工具区** — merge / pull / rebase / abort（v0.3.0 起；默认显示）
  3. **推送状态条** — drawer 顶部 push 进度（默认显示）
  4. **仓库卡片推送按钮** — 每张仓库卡片标题行右上的 ⬆ 推送按钮（默认显示）
  - 每个开关独立：受控渲染——关闭时彻底从 DOM 移除对应节点（不留空容器、不调对应 render 函数、不触发对应 API 请求）
  - 持久化到 `localStorage`（沿用既有 schema 演进不升 key 的约定）：v4 = `{ pinnedPaths, hiddenPaths, sections: { commit, merge, pushStatus, perCardPush } }`；v3 文档里的 `commitSectionVisible` 字段自动映射到 `sections.commit`（保留用户 v0.4.0 默认隐藏偏好），其余 3 个 section 默认 `true`
  - 按钮 `data-active` 反映菜单打开态（菜单开 = 填色、菜单关 = 淡灰）
  - 交互：点按钮 toggle；点菜单外 / 按 Esc 关闭；同一时刻最多一个菜单展开

### 维护

- **localStorage schema v3 → v4 演进**：用 `sections` 对象替代 `commitSectionVisible` 单字段；旧字段保留兼容路径，隐式迁移 v3 → v4，不升 key
- **Controller 拆分**：`toggleCommitSection` 单方法 → `toggleSection(key)` 通用方法（白名单 key ∈ {commit, merge, pushStatus, perCardPush}）；新增 `toggleOptions` / `closeOptions` 管理菜单开/关（不持久化，纯 UI 临时态，跟 `selectionMode` 一致）
- **renderHeader 拆分**：内联 commit-toggle 按钮 → 「显示选项」按钮 + 抽出独立的 `renderOptionsMenu` 函数（菜单内容按需渲染）
- **renderBody 受控扩展**：merge 区、pushStatus、perCardPush 三处新增 sections 守卫；pushStatus 在 render 函数内部检查（不开时彻底清空 + display:none），merge / perCardPush 在 renderBody 调用层守卫

## [Unreleased]

### 新增

- **commit 工具区可见性开关**：抽屉 header 在 refresh 按钮旁新增 git-commit-style toggle（左右两圆点 + 直线的小图标）。点击 = 切换「抽屉顶部 commit 区是否显示」，状态持久化到 `localStorage`（沿用既有 schema 演进不升 key 的约定，新字段 `commitSectionVisible: boolean`，缺字段默认 `false`，隐式迁移 v2 → v3）。
  - 默认隐藏：贴合「commit 工具区在抽屉里几乎是噪声，多数情况下日常 commit 走 daily-push 一条龙就够了」的实际使用方式——首次升级后 commit 区不再自动出现在抽屉顶部，要手动 commit 时再点开。
  - 实现要点：受控渲染——`renderBody` 在开关关闭时彻底从 DOM 移除 `.DGH_commitSection` 节点（不留空容器 + 跳过 `renderCommitSection` 调用，省一次 `loadCommitStatus` 入口触发的网络请求）。merge 区在 commit 区关闭时直接挂在 body 顶部，仓库列表布局不变。
  - toggle 按钮视觉态：`data-active="true"` 填色（同 select-toggle 语义）；`data-active="false"` 淡灰（明确传达「这是关闭态」）。

### 维护

- **client bundle 模块化拆分**：将原 `lib/client.js`（88 KB / 1586 行单文件 bundle）按职责拆成 `lib/client-src/` 下 14 个源文件（constants / utils / summary / toast / styles / storage / controller / fab / drawer / view / apply / ...）。新增 `lib/build-client.cjs` 构建脚本将源文件按文件名升序拼接回 `lib/client.js`；DSH 加载契约（`__ModuleLoader__.load` 单文件）保持不变。
  - 拆分原则：每个 section 一个文件，文件名用两位前缀控制拼接顺序（`00-banner.js` / `10-loader-open.js` / `20-constants.js` / ... / `Z9-loader-close.js`）。`Z0-` / `Z9-` 前缀保证最后加载的"scaffolding"始终排在所有 section 之后，无需按 commit 依次 rename。
  - 字节级一致性保证：每一拆 step 用 `git diff` 验证过 `lib/client.js` 输出与 HEAD 完全一致（同字节数 90030，无任何差异），下游 DSH 加载行为零变化。后续 marker preflight 改动见下一条。
  - 维护流程：编辑 `lib/client-src/*.js` → 跑 `npm run build:client` → 同时提交源与生成的 `client.js`（部署走 `file:` 依赖，详见 `docs/maintainability.md`）。
- **Section marker 约定统一**：v0.3.0 初始拆解中 `summary` / `toast` 两个 section 文件首行不是 `// ===== X =====` 而是 JSDoc，与其他 9 个不一致。补充 marker（`    // ===== summary =====` / `    // ===== toast =====`），现在 11 个 section 文件的首行形式 100% 一致。这是有意 +52 字节（每文件 ≈26 字节的两行 marker）；条目细则写在 `docs/maintainability.md` § 三半。
- 在 `package.json` 中新增 `npm run build:client` / `npm run verify:client` 入口（后者在 13 号 commit 引入，本条 marker 协议 commit 无新增脚本）。

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