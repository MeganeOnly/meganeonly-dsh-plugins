# Changelog

本文件记录 `dsh-peak-hour-lock` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.3.3] - 2026-08-19

作为独立 npm 包发布的初始版本，包含以下已有功能。

### 新增

- 高峰时段拦截：北京时间 8:50–12:00 与 13:50–18:00（含高峰前 10 分钟缓冲）内，拦截包含用户真实输入的步骤；高峰前已在运行的任务不受影响。
- provider / model 白名单：仅拦截 `config.lockModels` 中命中的组合，默认只锁 `deepseek-official`，`model` 写 `*` 表示该 provider 下全部模型。
- 消息暂存：被拦截的消息按会话暂存到 web profile 目录下的 `.peak-hour-lock-queue.json`，以原子写方式落盘。
- 自动补发：高峰结束后等待约 2 分钟缓冲，逐条补发回原会话；会话不活跃时先从磁盘恢复再投递，恢复失败退避后重试。
- 暂存管理面板：位于输入框上方，可查看、编辑、删除或立即发送单条暂存消息；状态横幅显示当前锁定的 provider / model。
- 陈旧条目清理：启动时自动清理超过 `staleAfterMs`（默认 7 天）的暂存条目，状态接口返回清理数量供界面展示；设为 `0` 可关闭该行为。
