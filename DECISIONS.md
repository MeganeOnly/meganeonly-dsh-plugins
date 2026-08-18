# 项目决策日志（dsh-plugins 项目级）

本文件记录与本仓库源码直接相关的决策（约束本仓库代码的取舍、踩过的坑、理由）。

> **本仓库 + 本机工作区** 的双日志分工：
>
> - 本文件（项目级，GitHub 可访问）：约束本仓库源码——API 选择 / selector 适配 / 共享协议等，GitHub clone 后可独立阅读。
> - 本机工作区级决策日志（**仅本机访问**，GitHub clone 看不到）：约束多项目协作、跨项目约定等。完整路径与作者本地约定见仓库维护者的内部笔记。
>
> 二者**不互通**：新决策只追加到当前所在仓库（开发 dsh-plugins 时追加到这里；本机工作区级决策才追加到本机日志）。历史决策保留在原位置，不复制不搬迁。

条目格式：

```
- [E###] 标题
  理由：
  日期：
  状态：active / superseded
```

---

## 活跃决策

### E002 · dsh-update-checker 迁入仓库

**理由**：原 v0.1.0 写完后直接放 DSH 部署目录（用户的 `~/.dsh/plugins/dsh-update-checker/`），没进仓库——用户报告"更新插件版本对比 bug"时发现它不在仓库里，无 git 历史。按 DSH 插件部署约定"仓库 = 权威源 / 部署目录 = 副本 / git push 与 DSH 实际运行解耦" 把它纳入仓库。

**实施**：迁移起点是已修过 bug 的 v0.1.1 状态（不是 v0.1.0），E 仓库首个 commit 就是 v0.1.1——这是从运行中的代码 snapshot 入库，不是从历史起点回溯。E 仓库源码与 F 盘部署副本 SHA256 一致。日常开发从 E 仓库改 → `Copy-Item` 到 F 盘部署副本 → `Copy-Item` 到 profile node_modules → 重启 DSH。

**日期**：2026-08-17 · **状态**：active

---

### E003 · dsh-ui-tweaks v0.6.0 合并原 `simple-mode/` 并删除独立目录

**理由**：原 `simple-mode` 作为独立插件维护在 `simple-mode/{cordis.patch.yml, lib/client.js, lib/index.js, package.json}`；v0.4.0 起 simple-mode 的全部能力（开关 + 状态行 DOM controller）已并入 `dsh-ui-tweaks` 的 `TWEAKS` 数组，独立目录已不再被任何地方引用。v0.6.0 决定物理删除独立 `simple-mode/` 目录，单一 UI 调整来源比双目录维护成本更低。

**实施**：README 表格与说明已只剩 dsh-ui-tweaks 一项；删除与 v0.6.0 同 commit 完成，避免仓库内出现"已删除但 git 还能 checkout 出来"的半状态。

**日期**：2026-08-18 · **状态**：active

---

### E005 · 新建 dsh-git-hub 插件（v0.1.0）

**核心设计**：右侧 FAB + 抽屉模式（对齐 task-pool），host half 走 `ctx.webServer.register` 暴露 7 个 `/api/git-hub/*` 路由，client half 复用 task-pool 的互斥协议 + CSS 注入 + 持久化降级 + FAB 让位动画。**复用 daily-push.cjs** 作为推送工具，**GitHub 侧视角由"推到当前对话"按钮**让 agent 调 `mcp__github__` 完成（host half 不直接调 GitHub API，零造轮子）。

**默认配置**：扫描根为作者本机的工作区根 + DSH 部署目录（用户可在 ⚙ 配置；本仓库克隆后默认走用户自己的扫描根）。配置存 web profile 根的 `.git-hub-config.json`（原子写）。扫描时跳过 `node_modules / .git / worktrees / target / build / dist / .venv / venv / __pycache__ / .next / .cache / .parcel-cache / .turbo / coverage / .idea / .vscode` 与所有 `.git*` 开头目录。git 命令 `timeout: 5000ms` + 失败 fallback，单仓库状态串行执行，5s 缓存。

**MVP 范围最小**：commit 时机由用户手动（白天终端），push 时机由用户手动触发（晚上统一走 daily-push.cjs）。后续可扩展 GitHub 侧视角 / SSE 流式推送进度 / 多根路径切换 / 自定义 commit message / 一键 rebase --onto。

**踩坑教训**：FAB 位置 v0.1.0 → v0.1.1：原 `top: 56px; right: 24px` 与 task-pool FAB 完全重叠（实测发现"和另一个图标重叠了"）——改成 `top: 108px; right: 24px` 避让。

**日期**：2026-08-18 · **状态**：active

---

### E006 · 跨面板 FAB 让位协议升级

**核心设计**：引入统一 attr `data-dsh-any-side-drawer-open`，任意右侧抽屉打开时设、全部抽屉关闭时移除；**所有 FAB CSS 监听这个 attr → 让位到 `calc(var(--active-drawer-width) + 24px)`（抽屉左边外）**。`--active-drawer-width` 由打开抽屉的 panel 在 `applyOpen(open)` 时 setProperty 自己的 `DRAWER_WIDTH`（task-pool = 380px, git-hub = 420px），让位数值随实际抽屉宽度变化——不同宽度抽屉不会位置错乱。

**取代旧方案**：原来每个 panel 自己抽屉打开 → 自己 FAB `right: 444px` 横移，但**别的面板抽屉打开时自己的 FAB 不动 → 被遮挡**。

**协议升级 + 互斥 race condition 修复**：`applyOpen(open)` 设自己 attr + setProperty `--active-drawer-width` + 检查 `isOtherDrawerOpen(selfAttr)`（用 `KNOWN_DRAWER_ATTRS` 枚举所有 panel drawer attr）才设统一 attr；`applyOpen(close)` 检查 `isOtherDrawerOpen(selfAttr)` 才移除统一 attr + CSS 变量——**关键修复**：开抽屉 A 去点 B 时，B applyOpen(open) 先设自己 attr + dispatch event，A applyOpen(close) 不能无条条件移除统一 attr / CSS 变量（否则 FAB 让位状态会瞬间错乱）。两个 panel 共享 `KNOWN_DRAWER_ATTRS` 列表（task-pool / github / ssh / task-board），新增面板时双方都要更新。完全解耦，未来新增面板自动支持。

**三次 hotfix 经验**：
- v0.5.4 误读"到左侧"含义 → 写成 `left: 24px`（跑屏幕最左侧），回滚为 `right: 444px`
- v0.5.5 hotfix：不同抽屉宽度（task-pool 380px / git-hub 420px）固定值错位 → 改 CSS 变量 `--active-drawer-width`
- v0.5.6 hotfix：开抽屉 A 去点 B 时 race condition → close 分支加 `isOtherDrawerOpen(selfAttr)` 检查

**日期**：2026-08-18 · **状态**：active

---

### E007 · dsh-git-hub v0.1.5 ESM `require` bug 修复

**bug**：host half 在 ESM 模块里用 `require('node:fs').readdirSync / statSync` 调同步 API（isDirectory / scanRoot 内部），**ESM 没有 `require`** → 抛 ReferenceError → 被 try/catch 静默吞错（`scanRoot` 内层 `try { entries = require('node:fs').readdirSync(...) } catch { return }`）→ `scanRoot` 永远返回空数组 → `/api/git-hub/repos` 永远返回 0 仓库。

**修复**：改用 `import { readdirSync, statSync } from 'node:fs'` 顶层导入，删掉 3 处 `require('node:fs')` 调用。

**踩坑教训**：
- (1) Node 22 检测 ESM `exports` 字段时抛的 `Invalid package config` 跟 syntax 错混在一起，掩盖了真正问题
- (2) 单元测试 + 客户端 mock apply() 都触发不到 host half 的 ESM `require` bug（mock 里手动提供 require / 不走 ESM 解析路径）
- (3) **DSH host half 必须由用户实测才会暴露**——所有 client-side smoke test 都验证不到
- (4) **`try { ... } catch { return }` 是静默吞错的反模式**：当 try 块是"核心功能唯一调用"时，外层 caller 拿不到任何信号去发现"功能没生效"——应该在 catch 里 `console.warn` 或 throw 让 caller 知道
- (5) **bundle patch 启动时加载，运行时不会 HMR**——host half 类 bug 修复后必须重启 DSH 才生效，用户验证路径长

**日期**：2026-08-18 · **状态**：active

---

### E008 · dsh-git-hub v0.1.6 per-repo 隐藏功能

**用户反馈三个问题**：
- (1) 抽屉里有些路径根本不是仓库（归档 / 隐私 / 损坏备份），不该显示
- (2) 不懂"推送"和"推到对话"的区别
- (3) 不认识某些意外目录

**针对 (1) 做 per-repo 隐藏**：localStorage schema v2 `{ pinnedPaths, hiddenPaths }`（v0.1.0 v1 隐式迁移 v2，缺字段默认 []）；UI：每张卡片加 🚫 隐 按钮（与 📌 钉 对称设计），body 顶部「已隐藏 N 个」小条可一键展开/收起被隐藏项，⚙ 配置面板加 hiddenPaths textarea 支持批量编辑。

**踩坑教训**：JSON 字符串里嵌入了未转义 `"..."` 半角双引号（"已隐藏 N 个"），导致 package.json description JSON 解析失败——**写 description 时内部引用必须用全角引号 `「」` 或中文方括号**，不能用 ASCII `"`。

**日期**：2026-08-18 · **状态**：active

---

### E009 · dsh-git-hub v0.1.7 隐藏选择模式 + hidden 阻止 push

**核心设计**：header ↻ 右侧加 🎯/✓ toggle 按钮（默认态 = 圆圈+圆点 SVG，激活态 = × SVG），`selectionMode: boolean` Controller 状态，`setSelectionMode(v)` 切换时重置 `showHidden=false`。`buildRepoCard` 在 selectionMode 时给 li 加 `data-selecting="true"` 属性，整张卡片 click = `controller.toggleHide(repo.path)`，操作按钮行 actions `style.display = "none"`（避免点击冲突），`e.stopPropagation()` 防止点操作按钮时冒泡触发。

**hidden 阻止 push**：`Controller.pushRepo` 入口检查 `hiddenPaths.has(path)`，有则 toast 拒绝；卡片 ⬆ 按钮 hidden 时 `disabled + title="已隐藏,不允许推送"`。

**全部推送**：`Controller.pushAll` 重写为 client 端循环调 `pushRepo`（**不调** host half 的 `/api/git-hub/push-all`，避免 `daily-push.cjs --all` 扫到 hidden 仓库），串行 800ms 间隔避免 N 个 detached 子进程瞬时压力。

**踩坑教训**：JSON description 半角引号问题已在 E008 标注，这次写 v0.1.6+1.7 描述时已用全角引号「」——但仍要警觉，每个版本发布前检查。

**日期**：2026-08-18 · **状态**：active