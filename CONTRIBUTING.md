# dsh-plugins 开发约定

> 项目级开发者文档。本仓库（`E:\dsh-plugins`）2026-08-17 从 `F:\AllWorkSpace\dsh-plugins` 迁移而来。
>
> - 工作区级元规则（多项目协作 / 署名约定等）见 `F:\AllWorkSpace\AGENTS.md`（**仅本机访问，GitHub clone 看不到**）。
> - 本项目决策历史见 [`DECISIONS.md`](./DECISIONS.md)。
> - 找不到东西去哪找（仅 F 盘本机资源）见 [`LEGACY-LOCATION.md`](./LEGACY-LOCATION.md)。
> - 用户面向的插件总览见 [`README.md`](./README.md)。

---

## 先找现成轮子，不要重复造

在实现任何新功能 / 新插件 / 新工具之前，按顺序检查：

1. **本仓库内**：`E:\dsh-plugins` 里的插件（含 README 中提到但被禁用的）是否已实现或部分实现；
2. **本机已有但未启用的插件**：`F:\.dsh\profiles\web\cordis.patch.yml` 中 `disabled: true` 的条目、`F:\.dsh\profiles\web\node_modules` 里已安装的社区插件；
3. **GitHub / DSH 插件市场**：搜索现成插件（dshmarket、dsh-plugin-hub 的市场源，或直接 GitHub 搜 `dsh-plugin`）；
4. 以上都没有，才自己写；写完考虑是否能直接用别人的方案裁剪。

---

## 署名约定（项目级）

用户署名 **MeganeOnly**。本仓库内的插件/脚本文件头注释带"作者：MeganeOnly"。其它场景（skill frontmatter `metadata.author`、跨项目复述等）见工作区级 `F:\AllWorkSpace\AGENTS.md`。

---

## DSH 插件开发约定

- **源码仓库**：`E:\dsh-plugins`（GitHub 远程：`MeganeOnly/meganeonly-dsh-plugins`）。
- **推送时机**：**没有后台自动同步**——只有用户要求"同步/推送到 GitHub"，或按约定改完 dsh-plugins 源码后的那个会话才执行 `git commit` + push。日常对话/使用 DSH 不碰仓库，也不产生额外 token 消耗。
- **上传守则**：按 skill `git-push-detour` 执行——绝不提交 token、profile 运行数据、临时脚本；提交前 `git status` 逐个检查。
- **生效目录**：`F:\.dsh\plugins\<插件名>`（与仓库同构的独立副本，**不是链接**）。
- **部署链路（两步缺一不可）**：
  1. 源码改动拷到 `F:\.dsh\plugins\<插件名>`；
  2. 同步到 profile 的 `node_modules` 副本——`F:\.dsh\profiles\web\node_modules\dsh-<插件名>`（这是 DSH 实际 `require` 的位置，通过 `file:` 依赖链接）。推荐做法：改完后将 `package.json` 版本号 +1（如 0.3.0 → 0.3.1），再在 profile 目录跑 `pnpm install` 让 pnpm 感知变更并刷新副本；或直接手动 `cp lib/*.js package.json` 过去覆盖。
  3. 重启 DSH 生效。
- **数据文件**：profile 目录 `F:\.dsh\profiles\web` 下的点开头 JSON（如 `.peak-hour-lock-queue.json`）是插件持久化数据，删除/改写前先备份。
- **本机网络特点**：`github.com` 常直连超时，但 `api.github.com` 可达。此时 `git push` 会卡死，按 skill `git-push-detour` 的流程改用 `node F:\AllWorkSpace\tools\mirror-push.cjs <远端main当前SHA>` 镜像推送；网络恢复后 `git pull --rebase origin main` 对齐。

---

## 日常开发 + 晚间推送

**白天**：只 `git commit`（本机，不 push）；不动推送相关命令。

**晚间统一推送**：跑 `F:\AllWorkSpace\tools\daily-push.cjs`：
- 自动 fetch + 检测分歧 + 列将要推送的文件 + 扫描敏感内容 + 默认要求确认
- 安全设计：文件名 deny 列表（`.env` / `cordis.patch.yml` / `.pem` / `credentials.yaml` 等）+ 内容扫描（API key / Bearer / 私钥）+ 文件大小警告
- 完整规则参见 skill `git-push-detour` §六

**仓库创建规则**：本仓库（`E:\dsh-plugins`）是 `git clone --no-hardlinks` 迁过来的（D037），已有完整历史。**未来如有新插件仓库**，先在 GitHub 上 `Create repository`（空 README 不勾），然后**本地 `git clone`**——**不要** `git init` + `git remote add origin`，否则本地历史与 GitHub 没有任何 merge-base，未来 push 必然要 force-push（参考 workbench 2026-08-17 首次开源时遇到的情况）。

**本仓库特殊情况约定**：
- `E:\dsh-plugins` 是权威源码；`F:\AllWorkSpace\dsh-plugins` 已不存在（`.dsh-plugins.archive` 是只读快照，不推）
- 部署到 DSH 走 `F:\.dsh\plugins\<名>` + profile `node_modules` 副本的链路；与 `git push` 操作**完全解耦**——改完源码只需拎到 `F:\.dsh\plugins` + 增 `package.json` 版本号 + profile `pnpm install`，不需要 `git push`
- `git push` 仅用于把源码公开到 GitHub Marketplace / 跨设备同步；不影响 DSH 实际运行

---

## 决策历史

项目级决策日志见 [`DECISIONS.md`](./DECISIONS.md)。新决策只追加到这里——F 盘 `F:\AllWorkSpace\DECISIONS.md` 是工作区级日志（含多项目决策），二者**不互通**。

---

## 迁移记录

本仓库 2026-08-17 从 `F:\AllWorkSpace\dsh-plugins` 整体迁移而来，git 历史与 GitHub remote 完整保留。F 盘原位置已重命名为 `.dsh-plugins.archive`（30 天观察期）。详见 [`DECISIONS.md`](./DECISIONS.md) E001 与 `F:\AllWorkSpace\DECISIONS.md` D037。