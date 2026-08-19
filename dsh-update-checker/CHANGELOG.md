# Changelog

本文件记录 `dsh-update-checker` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.1] - 2026-08-19

作为独立 npm 包发布的初始版本，包含以下已有功能。

### 新增

- 设置页新增"更新"栏目，排序靠前，显示当前安装版本、npm 上的最新版本与是否有可用更新。
- 完整的 semver 比较：除主版本 / 次版本 / 修订号外，同时比较预发布段（如 `-rc.N`、`-alpha.N`、`-beta.N`）——正式版高于预发布版，数字标识符按数值比较，字符串标识符按字典序比较，数字标识符低于字符串标识符。
- 一键升级：二次确认并展示目标版本后，执行 `npm install -g @deepseek-ai/dsh@latest`。
- 升级完成后不自动重启，界面提示需重启 DSH 才会实际生效。
- 宿主半段通过 HTTP 路由向前端暴露版本查询与升级执行能力。
