# 项目决策日志（dsh-plugins 项目级）

> 本文件记录与 `E:\dsh-plugins` 仓库直接相关的决策（约定、取舍、踩过的坑、理由）。
>
> 与 `F:\AllWorkSpace\DECISIONS.md`（工作区级决策日志）的区别：
>
> - 本文件（项目级）：约束对象是**本仓库源码**——部署链路、推送策略、API 选择、selector 适配等。GitHub clone 后可独立阅读。
> - F 盘工作区级：约束对象是 F:\AllWorkSpace 多项目工作区——多项目协作、跨项目约定等。本机访问；GitHub clone 看不到。
>
> 二者**不互通**：新决策只追加到当前所在仓库（开发 dsh-plugins 时追加到这里；F 盘工作区级决策才追加到 F 盘）。历史决策保留在原位置，不复制不搬迁。
>
> 决策规则（不重复工作区级）：AGENTS.md（规则）> 本文件（事实）；冲突时以工作区级 AGENTS.md 为准并在本文件追加「更正」条目。

条目格式：`- [E###] 决策 | 理由 | 日期 | 状态`（状态：active / superseded）

## 活跃决策

- [E001] dsh-plugins 仓库从 `F:\AllWorkSpace\dsh-plugins` 迁移到 `E:\dsh-plugins` | F:\AllWorkSpace 已演变为多项目工作区（workbench / dsh-plugins / tools / reports），把 dsh-plugins 单独迁到 E 盘让"仓库 = 项目"一一对应；用 `git clone --no-hardlinks` 平移保留全部 git 历史与 GitHub remote；未提交改动在 F 盘先 git commit 成 snapshot（commit `c94156d`，本地未 push）后随历史迁入；`git clone` 后 origin 默认指向本地源不是 GitHub，必须 `git remote set-url origin https://github.com/MeganeOnly/meganeonly-dsh-plugins.git` 修正；clone 不携带源仓库的 `[user]` 段，必须给本仓库 `git config user.name/user.email`（保持与原仓库一致：`MeganeOnly` / `MeganeOnly@users.noreply.github.com`），否则 commit 会因无 identity 失败；E 盘同时新建 `CONTRIBUTING.md`（项目级开发者文档）、`DECISIONS.md`（本文件）、改写 `LEGACY-LOCATION.md`（去掉 AGENTS.md / DECISIONS.md 引用，因为这两个已在 E 盘自洽）形成自洽项目仓库；F 盘 AGENTS.md 精简为工作区级，DSH 插件开发约定搬到 `CONTRIBUTING.md`；F 盘 `F:\AllWorkSpace\dsh-plugins` 重命名为 `.dsh-plugins.archive`（30 天观察期，30 天后手动删除释放空间）；DSH 部署路径 `F:\.dsh\plugins\` 与 profile `F:\.dsh\profiles\web\` 不动（与源码仓库位置解耦） | 用户主动要求；DSH 部署链路与仓库路径解耦 → 迁移不破坏插件运行；双决策日志分工避免"约定与代码物理分离"对 GitHub clone 失效的问题 | 2026-08-17 | active