# 找不到东西？去 F:\AllWorkSpace 找

本仓库（`E:\dsh-plugins`）2026-08-17 从 `F:\AllWorkSpace\dsh-plugins` 迁移而来。

仓库本身的全部内容（8 个 DSH 持久插件源码、git 历史、`README.md` / `LICENSE`、本项目级 [`CONTRIBUTING.md`](./CONTRIBUTING.md) / [`DECISIONS.md`](./DECISIONS.md)）都在这里，**不要去 F 盘找代码**。

但以下资源仍在 F 盘 `F:\AllWorkSpace`（仅本机访问，**GitHub clone 后看不到**）：

| 资源 | 路径 | 说明 |
|---|---|---|
| 工作区元规则 | `F:\AllWorkSpace\AGENTS.md` | 多项目协作规则，**不是**本仓库专属（DSH 插件开发约定已搬到本仓库 `CONTRIBUTING.md`） |
| 工作区决策历史 | `F:\AllWorkSpace\DECISIONS.md` | 多项目决策日志；含本仓库历史决策归档（D001–D037） |
| 镜像推送工具 | `F:\AllWorkSpace\tools\mirror-push.cjs` | 通用 git 推送脚本（按 `git-push-detour` skill） |
| 本地工作台项目 | `F:\AllWorkSpace\workbench\` | 独立项目，端口 3180，独立 GitHub 仓库（`MeganeOnly/workbench`） |
| 报告 / 杂项 | `F:\AllWorkSpace\reports\` / `minimax-output\` / `.reasonix\` | 历史产物 |

DSH 部署生效路径（与本仓库位置**无关**）：

- `F:\.dsh\plugins\<插件名>` — 部署目标（每次改完源码要同步到这里）
- `F:\.dsh\profiles\web\` — DSH profile 根（`cordis.patch.yml` / `package.json` / 持久化数据）

---

## 给 GitHub clone 出来的人

如果你从 `https://github.com/MeganeOnly/meganeonly-dsh-plugins` clone 这个仓库，**你不需要关心 F 盘资源**。按这个顺序读：

1. [`README.md`](./README.md) — 仓库是什么、有哪些插件、如何安装
2. [`CONTRIBUTING.md`](./CONTRIBUTING.md) — 开发约定（推送、部署、签名约定）
3. [`DECISIONS.md`](./DECISIONS.md) — 项目级决策历史（约束本仓库源码的取舍）

`LEGACY-LOCATION.md` 是给本机开发者看的；GitHub clone 后本文件内容无关紧要（只是仓库元文件）。