# Changelog

本文件记录 `dsh-skill-manager` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-08-19

作为独立 npm 包发布的初始版本，包含以下已有功能。

### 新增

- 设置页新增"Skill 管理"页面：列出用户级 skill 并显示作者署名。
- 搜索与分组：按启用中 / 已停用 / 项目级 / 诊断分组展示。
- 一键启用 / 停用：停用通过注册高优先级的同名"影子"条目遮蔽原条目实现，不修改任何 `SKILL.md` 文件；按 skill 名全局生效，包含项目级同名 skill。
- 即时生效：变更后主动使 skill 缓存失效，无需重启 DSH。
- 扫描范围覆盖用户级 skill 目录（`DSH_HOME/skills`、`~/.agents/skills`）与最近会话的项目根目录。
