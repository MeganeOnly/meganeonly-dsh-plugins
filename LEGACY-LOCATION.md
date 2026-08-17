# 找不到东西？去 F:\AllWorkSpace 找

本仓库（`E:\dsh-plugins`）于 2026-08-17 从 `F:\AllWorkSpace\dsh-plugins` 迁移而来。

仓库本身的全部内容（8 个 DSH 持久插件源码、git 历史、`README.md` / `LICENSE`、未提交改动）都在这里，不要去 F 盘找代码。

但如果你在找以下资源，它们仍在 F 盘 `F:\AllWorkSpace`：

| 资源 | 路径 | 说明 |
|---|---|---|
| 工作区插件开发约定 | `F:\AllWorkSpace\AGENTS.md` | 部署链路 / 推送守则 / 项目记忆规则（按需 `read`） |
| 项目决策日志 | `F:\AllWorkSpace\DECISIONS.md` | "代码里看不出的决策"；含本迁移记录 [D037] |
| 镜像推送工具 | `F:\AllWorkSpace\tools\mirror-push.cjs` | 通用 git 推送脚本（按 git-push-detour skill） |
| 本地工作台项目 | `F:\AllWorkSpace\workbench\` | 独立项目，端口 3180，独立 GitHub 仓库（`MeganeOnly/workbench`） |
| 报告 / 杂项 | `F:\AllWorkSpace\reports\` / `minimax-output\` / `.reasonix\` | 历史产物 |

DSH 部署生效路径（与本仓库位置**无关**）：

- `F:\.dsh\plugins\<插件名>` — 部署目标（每次改完源码要同步到这里）
- `F:\.dsh\profiles\web\` — DSH profile 根（`cordis.patch.yml` / `package.json` / 持久化数据）

如果你刚接手这个仓库、不知道这些约定怎么落地，请从根目录的 `README.md` 开始读。