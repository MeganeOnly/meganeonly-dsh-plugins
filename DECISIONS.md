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
- [E002] dsh-update-checker 从 `F:\.dsh\plugins\dsh-update-checker\`（独立维护部署副本）迁入 `E:\dsh-plugins\dsh-update-checker\`（仓库源码） | E001 后所有 DSH 插件都已在 E 仓库，唯独 dsh-update-checker 是 2026-08-15 写完后直接放 `F:\.dsh\plugins\` 没进仓库——用户报告 "更新插件版本对比 bug" 时发现它不在仓库里无 git 历史；按 E001 的精神"仓库 = 权威源 / F 盘 = 部署副本 / git push 与 DSH 实际运行解耦" 把它纳入仓库；E 仓库源码与 F 盘部署副本仍 D005 约定走手动 `Copy-Item` 同步（pnpm v11 file: 拷贝非硬链接且 install 不感知内容变化），git 操作完全不影响 DSH 运行时；迁移起点是已修过 bug 的 v0.1.1 状态（不是 v0.1.0），E 仓库首个 commit 就是 v0.1.1——这是从运行中的代码 snapshot 入库，不是从历史起点回溯；F 盘 `F:\.dsh\plugins\dsh-update-checker\` 与 E 仓库新子目录初始 SHA256 一致；日常开发从 E 仓库改 → `Copy-Item` 到 F 盘部署副本 → `Copy-Item` 到 profile node_modules → 重启 DSH（host half 改动按 D033 强制） | 用户主动要求；DSH 部署链路与仓库位置解耦 → 迁移不破坏插件运行；插件纳入仓库后才有 git 历史与跨设备同步能力 | 2026-08-17 | active
- [E003] dsh-ui-tweaks v0.6.0 合并原 `simple-mode/` 并删除独立目录 | 原 `simple-mode` 作为独立插件维护在 `simple-mode/{cordis.patch.yml, lib/client.js, lib/index.js, package.json}`；v0.4.0 起 simple-mode 的全部能力（开关 + 状态行 DOM controller）已并入 `dsh-ui-tweaks` 的 `TWEAKS` 数组（参见 dsh-ui-tweaks README 与 lib/client.js），独立目录已不再被任何地方引用；v0.6.0 决定物理删除独立 `simple-mode/` 目录，单一 UI 调整来源比双目录维护成本更低；README 表格与说明已只剩 dsh-ui-tweaks 一项；删除与 v0.6.0 同 commit 完成，避免仓库内出现"已删除但 git 还能 checkout 出来"的半状态 | 用户主动要求；UI 调整天然聚合在 dsh-ui-tweaks；单一来源降低维护成本 | 2026-08-18 | active
- [E004] 不在本地 clone `MeganeOnly/meganeonly-dsh-skills`；`F:\.dsh\skills\` 是本地真源 | GitHub 公开版（`MeganeOnly/meganeonly-dsh-skills`）是公开子集；本机 `F:\.dsh\skills\`（DSH 用户级 skill 目录）是含个人信息的本地真源（21 个 skill，含 `personal-preferences` 等含隐私的本地扩展）；用户 2026-08-18 决定**日常不更新 GitHub**，需要时单开任务；**agent 守则**：用户说"改 skill" → 默认读 / 写 `F:\.dsh\skills\<name>\SKILL.md`；**禁止** `git clone https://github.com/MeganeOnly/meganeonly-dsh-skills` 到任何本地路径（含 `F:\AllWorkSpace\` / `E:\` / `F:\.dsh\skills\`），clone 会让 agent 误把公开子集覆盖或污染 F 盘个人版本，导致隐私泄露或本地扩展丢失；用户主动说"更新 GitHub skill / 发 skill 到 GitHub"时另开任务处理 | 用户主动要求；隐私保护 + 避免 agent 误读误改 | 2026-08-18 | active