# dsh-git-hub

作者：MeganeOnly

DSH 右侧 FAB + 抽屉模式的本地 git 仓库管理面板 v0.1.0。
扫描本地配置的根目录下所有 git 仓库，显示每个仓库的 branch / dirty / 未推送 commit 数 / 今日 commit 数 / 最新 commit 摘要，支持一键调 `daily-push.cjs` 推送（全部或单个），支持把仓库摘要发到当前对话让 agent 调 `mcp__github__` 处理 GitHub 侧问题（open issues / PRs / release 等）。
**零造轮子**：host half 复用 Git CLI（不自己写协议解析），push 复用 `F:\AllWorkSpace\tools\daily-push.cjs`，GitHub 视角由 `mcp__github__` 经"推到对话"间接接入。

## 设计动机

碍于个人单设备 + GitHub 不稳定的实际情况，git 推送需要变成"白天 commit / 晚上统一 push"两段节奏（详见 `git-workflow-solo` + `personal-preferences`）。这个插件解决的是：

- **快速总览**：下午 commit 完后，想看看"今天一共 commit 了多少，哪些仓库还有未推送"——不用逐个 `cd` + `git log`
- **晚间一键推送**：到点统一 `daily-push.cjs --all`，抽屉里直接点不用去终端翻路径
- **不重复造轮子**：不写 GitHub API 客户端（用 `mcp__github__`）；不写 git push 编排（用 `daily-push.cjs`）；不写 zstd 解压（DSH 自带）；只做"面板 + 触发"

## 功能

### 仓库列表

- **右上角 FAB**（`top: 108px; right: 24px`，44×44 圆形，DSH 风格浅色卡片按钮）：点开 / 关闭右侧 420px 抽屉；与 task-pool 抽屉**互斥**（`dsh-panel-activate` CustomEvent）；**位置选择**：task-pool FAB 在 `top: 56px`（占 56~100px 区域），本插件 FAB 移到 `top: 108px`（task-pool 下方 8px 间距），两个 FAB 同时可见不重叠
- **任意抽屉打开时 FAB 让位到抽屉左边外**（v0.1.2 → v0.1.3 → v0.1.4 迭代）：与 task-pool / 其他面板共享 `data-dsh-any-side-drawer-open` 统一 attr；任意右侧抽屉打开时（不只是自己的），所有 FAB 都让位到 `calc(var(--active-drawer-width) + 24px)`（抽屉左边界外）；`--active-drawer-width` 由打开抽屉的 panel 在 `applyOpen(open)` 时 setProperty（task-pool = 380px, git-hub = 420px），让位数值随实际抽屉宽度变化；**v0.1.3 hotfix**：原 v0.1.2 误写成 `left: 24px`（跑到屏幕最左侧），回滚到 `right: 444px`；**v0.1.4 hotfix**：让位公式改为 CSS 变量（解决不同宽度抽屉位置错乱）+ `applyOpen` 引入 `isOtherDrawerOpen(selfAttr)` 检查修互斥协议 race condition（开抽屉 A 去点 B 时不再误移除统一 attr / CSS 变量）；与 task-pool 共享 `KNOWN_DRAWER_ATTRS` 列表
- **v0.1.5 关键修复 ESM `require` bug**：host half 原代码在 ESM 模块里用 `require('node:fs')` 调同步 API（readdirSync / statSync），ESM 没有 `require` → 抛 ReferenceError → 被 try/catch 静默吞错 → `scanRoot` 永远返回空数组 → `/api/git-hub/repos` 永远返回 0 仓库（用户实测触发，API 设了 scanRoots 后仍然 0 仓库才发现）；修复：改用 `import { readdirSync, statSync } from 'node:fs'` 顶层导入；**修复后必须重启 DSH**（host half bundle 在启动时加载，运行时不会自动 HMR）
- 抽屉打开后立即拉一次 `GET /api/git-hub/repos`（host half 5 秒缓存，避免每次开抽屉都全量扫）
- 每个仓库卡片显示：
  - 仓库名 + branch + 完整路径
  - 状态徽章：`● clean`（绿）/ `● dirty`（黄）/ `● ?`（灰）
  - 未推送徽章：`↑ N 未推送`（红）/ `无 upstream`（警告）
  - 今日徽章：`今日 N`（蓝）
  - 警告徽章：git 命令失败的错误信息
  - 最新 commit：`短 SHA + message 摘要 + 相对时间`

### 操作

- **⬆ 推送**（单仓库）：调 `daily-push.cjs --repo <path> --yes`，detached spawn，立即返回 PID + "去终端看完整输出"提示
- **⬆ 全部推送**（header）：调 `daily-push.cjs --repo <path> --yes` 串行循环 visible 仓库（**v0.1.7** 客户端循环替代 host half `daily-push.cjs --all`——避免 daily-push 扫到 hidden 仓库），800ms 间隔启动，自动跳过 hidden
- **💬 推到对话**（单仓库）：把仓库摘要（path / branch / upstream / status / unpushedCount / todayCommitCount / lastCommit + "请用 mcp__github__ 处理"提示）作为 user message 注入当前会话，让 agent 调 `mcp__github__` 查 GitHub 侧
- **📌 钉住**：钉住的仓库在列表顶部；持久化在浏览器 localStorage（key `dsh.gitHub.v1`，schema v2 `pinnedPaths`）
- **🎯 隐藏选择模式 toggle**（v0.1.7，header ↻ 右侧）：按一次进入模式，header 按钮变 ✓；模式下整张卡片可点 = `toggleHide`；body 底部出现「已隐藏 N 个仓库」小条（含展开列表 + ✓ 完成按钮）；Esc 退出；非模式下卡片 click 无操作
- **🚫 隐藏**（v0.1.6）：隐藏的仓库不在列表显示；持久化在 localStorage（`hiddenPaths`）；适用场景：归档目录（.archive）/ 隐私项目（不打算 push 到 GitHub）/ 损坏备份（.broken）等；schema v1 隐式迁移 v2（缺字段默认空数组）；**v0.1.7 强化**：hidden 仓库的 ⬆ 推送按钮置灰 + tooltip「已隐藏,不允许推送」+ controller.pushRepo 入口拒绝
- **⚙ 配置**：展开/折叠配置面板，编辑扫描根路径列表（每行一个），保存后自动重扫
- **↻ 刷新**：调 `POST /api/git-hub/repos/refresh` 强制清缓存重扫
- **× 关闭**：抽屉滑出（FAB 让位动画自动恢复）
- **Esc 键**：关闭抽屉（配置面板打开时先关配置面板）

### 配置

- **扫描根路径**：默认 `F:\AllWorkSpace` + `E:\`，可在 ⚙ 配置面板里编辑（textarea 每行一个路径）
- 配置持久化在 web profile 根 `F:\.dsh\profiles\web\.git-hub-config.json`（原子写：临时文件 + rename）
- **扫描跳过**：递归时跳过 `node_modules / .git / worktrees / target / build / dist / .venv / venv / __pycache__ / .next / .cache / .parcel-cache / .turbo / coverage / .idea / .vscode` 和所有 `.git*` 开头目录

### 性能与限流

- 单仓库状态读取串行执行（避免磁盘 IO 风暴 + git 锁冲突）
- 每个 git 命令 `timeout: 5000ms`，失败 fallback 不阻塞
- 单次扫描最多 200 个仓库（`MAX_REPOS`）
- 递归深度上限 8 层（`MAX_DEPTH`）
- host half 5 秒缓存（`SCAN_CACHE_TTL_MS`）——开抽屉重复触发不会全量重扫；点 ↻ 刷新强制清缓存
- 抽屉打开时 4 秒轮询 `/api/git-hub/push-status` 显示推送进度（PID + 退出码）

## 数据模型

### localStorage `dsh.gitHub.v1`

```ts
{
  pinnedPaths: string[]    // 钉住仓库的绝对路径数组
}

// v2 文档（v0.1.6 起）：
{
  pinnedPaths: string[],   // 钉住仓库的绝对路径数组
  hiddenPaths: string[],   // 隐藏仓库的绝对路径数组（v0.1.6 新增，缺字段默认空数组）
}
```

### 配置文件 `.git-hub-config.json`

```ts
{
  scanRoots: string[]    // 扫描根路径列表（绝对路径，Windows 反斜杠）
}
```

默认 `["F:\\AllWorkSpace", "E:\\"]`。

## HTTP API（host half 暴露）

| 方法 + 路径 | 用途 |
|---|---|
| `GET /api/git-hub/config` | 读配置（`scanRoots` + `toolPath` + `toolAvailable`） |
| `POST /api/git-hub/config` body `{ scanRoots: string[] }` | 改配置 + 落盘 |
| `GET /api/git-hub/repos` | 扫 + 状态（5s 缓存） |
| `POST /api/git-hub/repos/refresh` | 强制重扫 |
| `POST /api/git-hub/push-all` | 后台 spawn `daily-push.cjs --all --yes` |
| `POST /api/git-hub/repos/push` body `{ path: string }` | 后台 spawn `daily-push.cjs --repo <path> --yes` |
| `GET /api/git-hub/push-status` | 最近推送 PID + 退出码 |

## 安装

按 dsh-plugins 总 README「安装」节的统一流程：

1. 插件源放 `F:\.dsh\plugins\dsh-git-hub\`（实际仓库源码在 `E:\dsh-plugins\dsh-git-hub\`，按 D005 部署为独立副本）
2. 编辑 `F:\.dsh\profiles\web\package.json`：
   - `dependencies` 加 `"dsh-git-hub": "file:../../plugins/dsh-git-hub"`
   - `dsh.profile.bundles` 加 `"dsh-git-hub"`
3. 安装：
   ```bat
   cmd /c "cd /d F:\.dsh\profiles\web && pnpm install --no-frozen-lockfile"
   ```
4. 手动同步源码副本（pnpm v11 的 `file:` 是拷贝非硬链接且 install 不感知内容变化）：
   ```powershell
   Copy-Item E:\dsh-plugins\dsh-git-hub\lib\* F:\.dsh\profiles\web\node_modules\dsh-git-hub\lib\ -Recurse -Force
   Copy-Item E:\dsh-plugins\dsh-git-hub\package.json F:\.dsh\profiles\web\node_modules\dsh-git-hub\package.json -Force
   Copy-Item E:\dsh-plugins\dsh-git-hub\cordis.patch.yml F:\.dsh\profiles\web\node_modules\dsh-git-hub\cordis.patch.yml -Force
   ```
5. **重启 DSH** 让 host half 与 patch 生效；浏览器 bundle 的改动刷新页面即可生效

## 状态机

| 操作 | drawerOpen | loading | error | 持久化 |
|---|---|---|---|---|
| DSH 启动 | `false` | `false` | `null` | pinnedPaths 是 / config 是 |
| FAB 点击 | `toggle` | — | — | 否 |
| 抽屉 × 按钮 | `false` | — | — | 否 |
| header ⚙ | toggle configPanel | — | — | 否 |
| header ↻ 刷新 | `true` | `true` | `null` | 否 |
| 配置面板"保存" | `true` | 期间 `true` | — | **scanRoots 是** + 触发重扫 |
| 卡片 ⬆ 推送 | `true` | — | — | 否（spawn detached）；**v0.1.7**：hidden 仓库按钮置灰，pushRepo 入口拒绝 |
| header ⬆ 全部推送 | `true` | — | — | 否（v0.1.7 client 端循环 pushRepo 单仓库，串行 800ms 间隔，自动跳过 hidden） |
| 卡片 💬 推到对话 | `true` | — | — | 否（user message 进当前会话） |
| 卡片 📌 钉 | `true` | — | — | **pinnedPaths 是** |
| 卡片 🚫 隐 | `true` | — | — | **hiddenPaths 是**（v0.1.6；v0.1.7 选择模式下整张卡片可点替代） |
| header 🎯 隐藏选择 toggle | toggle selectionMode | — | — | 否（会话级 `selectionMode`）；v0.1.7 |
| 模式激活 + 卡片 click | `true`（selectionMode） | — | — | **hiddenPaths 是**（toggle）；v0.1.7 |
| body 底部"已隐藏 N 个"小条 | 模式激活时显示 | — | — | 否 |
| 配置面板"已隐藏仓库" textarea 保存 | `true` | — | — | **hiddenPaths 是**（v0.1.6） |
| Esc 键（v0.1.7 优先级） | — | — | — | 1) 关配置面板 → 2) 退出 selectionMode → 3) 关抽屉 |

抽屉打开时 `<html>` 加 `data-dsh-github-drawer-open` 属性 → CSS 让抽屉滑入；其它面板（task-pool / ssh / task-board）激活时通过 `dsh-panel-activate` 事件触发互斥协议自动关闭本抽屉。

## 显式不做（v0.1.0 MVP 范围）

- **手动 commit message 输入 + commit**：commit 走终端（用户实际习惯）；插件不介入 commit 阶段
- **流式回放 daily-push 输出**：MVP 只返回 PID，完整 CLI 输出回终端看（v0.2.0 候选做 SSE）
- **GitHub 侧视角（卡片显示 open issues / PRs 数）**：改走"推到当前对话"按钮让 agent 调 `mcp__github__` 处理，避免 host half 直接调 GitHub API
- **自动定时推送**：晚间推送由用户手动触发（见 `git-workflow-solo` §二）
- **多抽屉同屏**：与 task-pool 等已建立互斥协议
- **自定义 daily-push 路径**：MVP 硬编码 `F:\AllWorkSpace\tools\daily-push.cjs`（与 `git-workflow-solo` §二一致）

## 实现要点

- **零 React 依赖**：纯 DOM + 模板字符串，与 task-pool 同款。bundle 体积小、避免 React 受控组件干扰事件
- **Host half 有真实职责**：与 task-pool 的零副作用 placeholder 不同，本插件 host half 必须注册 7 个 HTTP 路由（扫描、git 命令、spawn daily-push、配置持久化）
- **复用 daily-push.cjs**：推送走 spawn detached 子进程，立即返回 PID + startedAt；不阻塞 HTTP 响应；4 秒轮询 status 显示"运行中 / 已结束"
- **localStorage 持久化降级**：与 task-pool 同款 — try 写删探针捕获 QuotaExceededError / SecurityError，storage=undefined；load 返回空、save 静默跳过；功能仍可用、刷新即丢、console.warn 提示
- **互斥协议**：复用 task-pool 已建立的 `dsh-panel-activate` CustomEvent + `<html data-dsh-*>` 属性机制；本插件 attr = `data-dsh-github-drawer-open`，激活时主动 remove 其它面板的 attr
- **FAB 自挂 `document.body`**：与 task-pool 同款语义——视觉对应"右侧抽屉 ↔ 右上角 FAB"，**vertical offset**（v0.1.1）：task-pool FAB 占 56~100px，本插件移到 `top: 108px`（下方 8px 间距），两个 FAB 同时可见不重叠；**让位方向**（v0.1.2 → v0.1.3 → v0.1.4 迭代）：任意抽屉打开时所有 FAB 都让位到 `calc(var(--active-drawer-width) + 24px)`（抽屉左边外），与 task-pool 共享 `data-dsh-any-side-drawer-open` 统一 attr + `KNOWN_DRAWER_ATTRS` 列表，互斥协议保证任意时刻只有一个抽屉打开
- **host half 真实职责**（v0.1.5 关键修复）：与 task-pool 的零副作用 placeholder 不同，本插件 host half 必须注册 7 个 HTTP 路由 + 跑 git 命令集 + spawn daily-push.cjs + 递归扫描 .git 仓库；**ESM `require` bug**：v0.1.4 之前 host half 在 ESM 模块里调 `require('node:fs').readdirSync` / `statSync`（同步 API），ESM 没有 `require` → ReferenceError → try/catch 静默吞错 → `scanRoot` 永远返回空 → `/api/git-hub/repos` 永远返回 0 仓库；v0.1.5 修复为 `import { readdirSync, statSync } from 'node:fs'` 顶层导入——**这个 bug 只有用户实测设了 scanRoots 后才会发现**（单元测试 + 客户端 smoke 都触发不到），是 host half 类插件容易踩的坑
- **CSS 注入**：`<style data-plugin-css="dsh-git-hub/drawer.css">` 去重 key，DSH 原生 token 颜色（`--dsw-alias-*` / `--dsw-specific-*`）
- **自愈 DOM 挂载**：MutationObserver 监听 body 变化，React 重渲染后丢失 FAB 或抽屉容器时自动重插
- **配置原子写**：临时文件 `.git-hub-config.json.tmp` + rename，避免崩溃留半成品
- **冒烟测试**：交付前 Node mock `window.__ModuleLoader__.load` + fake document + fake fetch + fake sessions 跑 `apply()`，验证 FAB / CSS / drawer / 互斥事件，详见 `F:\AllWorkSpace\tools\tmp-dsh-git-hub-smoke.cjs`（部署后清理）

## 风险与回退

- **白屏 / 加载失败**：在 `F:\.dsh\profiles\web\cordis.patch.yml` 追加：
  ```yaml
  - id: git-hub
    disabled: true
  ```
  重启 DSH 即恢复，源码不动。
- **彻底卸载**：`F:\.dsh\profiles\web\package.json` 移除 `dsh-git-hub` 依赖与 bundle 条目 → `pnpm install` → 删除 `F:\.dsh\plugins\dsh-git-hub\` + 部署副本 + `E:\dsh-plugins\dsh-git-hub\` 源码。
- **清空钉住列表**：浏览器 DevTools → Application → Local Storage → 删除 `dsh.gitHub.v1`
- **重置扫描根**：删除 `F:\.dsh\profiles\web\.git-hub-config.json`（重启后下次启动回到默认 `F:\AllWorkSpace` + `E:\`）
- **daily-push.cjs 工具缺失**：抽屉内所有推送按钮置灰 + tooltip "daily-push.cjs 不可用"，其他功能照常用

## 关联

- `git-workflow-solo`：commit / push 节奏、`.gitignore` 防御性隐私模式
- `git-push-detour`：推送冲突 / 远端分叉 / 网络层问题的兜底（被 daily-push.cjs 内部调用）
- `daily-push.cjs`：本插件的推送工具，路径 `F:\AllWorkSpace\tools\daily-push.cjs`
- `mcp__github__`：通过"推到当前对话"间接接入，提供 GitHub 侧视角（open issues / PRs / commits / releases）
- `dsh-task-pool`：同款 FAB + 抽屉 + 互斥协议 + 持久化降级模式（v0.5.4），本插件复用其模板；v0.5.4 起双方共享 `data-dsh-any-side-drawer-open` 统一 attr 做跨面板 FAB 让位
- `dsh-persistent-plugin-authoring`：持久插件开发与安装手册