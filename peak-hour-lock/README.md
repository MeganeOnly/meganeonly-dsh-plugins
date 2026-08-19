# dsh-peak-hour-lock

DeepSeek Harness (DSH) web profile 的常驻插件：在指定的高峰时段按 provider / model 白名单拦截发送，并在高峰结束后自动补发。

## 功能

- **时段拦截**：北京时间 8:50–12:00 与 13:50–18:00（含高峰前 10 分钟缓冲）内，拦截包含用户真实输入的步骤；高峰前已在运行的任务不受影响。
- **白名单匹配**：仅拦截 `config.lockModels` 中命中的 provider / model 组合，默认只锁 `deepseek-official`，避免误伤同名的第三方转发、本地镜像等线路。`model` 写 `*` 表示该 provider 下全部模型。
- **消息暂存**：被拦截的消息按会话暂存到 profile 目录下的队列文件，不会丢失。
- **自动补发**：高峰结束后等待约 2 分钟缓冲，逐条补发回原会话；会话不活跃时先从磁盘恢复再投递，恢复失败则退避后重试。
- **暂存管理**：输入框上方的面板可查看、编辑、删除或立即发送单条暂存消息；状态横幅显示当前锁定的 provider / model。
- **陈旧条目清理**：启动时自动清理超过 `staleAfterMs`（默认 7 天）的暂存条目，状态接口返回清理数量供界面展示；设为 `0` 可关闭该行为。

## 安装

插件既可以从本仓库子目录安装，也可以作为独立 npm 包安装。

**从 monorepo 子目录安装**

克隆仓库后，在 DSH web profile 的 `package.json` 中以 `file:` 协议引用该子目录：

```json
{
  "dependencies": {
    "dsh-peak-hour-lock": "file:<到仓库的相对路径>/peak-hour-lock"
  }
}
```

**从 npm 包安装**

```json
{
  "dependencies": {
    "dsh-peak-hour-lock": "^0.3.3"
  }
}
```

## 启用

在同一份 profile `package.json` 的 `dsh.profile.bundles` 数组中加入包名：

```json
{
  "dsh": {
    "profile": {
      "bundles": ["dsh-peak-hour-lock"]
    }
  }
}
```

随后在 profile 目录安装依赖：

```bash
pnpm install --no-frozen-lockfile
```

## 配置

在 profile 的 `cordis.patch.yml` 中调整锁定范围：

```yaml
- id: peak-hour-lock
  config:
    lockModels:
      - provider: deepseek-official
        model: '*'
```

## 运行与生效

- 宿主半段挂载在 `agent/pre-step` 事件上执行拦截、维护暂存队列并驱动补发，**修改后需重启 DSH** 才会生效。
- 浏览器半段渲染状态横幅与暂存管理面板，**刷新页面**即可加载最新版本。
- 暂存队列以原子写方式保存在 web profile 目录下的 `.peak-hour-lock-queue.json`。

临时停用可在 profile 的 `cordis.patch.yml` 中追加：

```yaml
- id: peak-hour-lock
  disabled: true
```

## 许可证

[MIT](./LICENSE)
