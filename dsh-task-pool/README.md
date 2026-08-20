# dsh-task-pool

DeepSeek Harness (DSH) web profile 的常驻插件：在界面右侧提供一个纯本地的任务池（想法收集箱）。

## 功能

- **右侧抽屉 + 悬浮按钮（FAB）**：抽屉宽 380 px，与对话区共存而非覆盖；与同类抽屉面板互斥显示。
- **快速新建**：抽屉顶部常驻输入框，回车即创建任务。
- **就地编辑**：点击卡片在原位展开编辑面板，可修改任务内容、查看创建/更新时间、删除任务；同一时刻只展开一张卡片。
- **拖动排序**：拖动手柄在列内上下重排，落点显示插入线。
- **发送到当前对话**：需两次点击确认（第一次进入待确认态并显示 4 秒倒计时），确认后将任务内容作为用户消息发送到当前会话。
- **发送后删除开关**：抽屉头部的全局开关，控制发送成功后是否从池中移除任务（默认移除）。
- **钉住**：钉住后下次启动自动展开抽屉。

除"发送到当前对话"外，其余操作均为纯本地操作，不产生模型调用。

## 安装

插件既可以从本仓库子目录安装，也可以作为独立 npm 包安装。

**从 monorepo 子目录安装**

克隆仓库后，在 DSH web profile 的 `package.json` 中以 `file:` 协议引用该子目录：

```json
{
  "dependencies": {
    "dsh-task-pool": "file:<到仓库的相对路径>/dsh-task-pool"
  }
}
```

**从 npm 包安装**

```json
{
  "dependencies": {
    "dsh-task-pool": "^0.6.0"
  }
}
```

## 启用

在同一份 profile `package.json` 的 `dsh.profile.bundles` 数组中加入包名：

```json
{
  "dsh": {
    "profile": {
      "bundles": ["dsh-task-pool"]
    }
  }
}
```

随后在 profile 目录安装依赖：

```bash
pnpm install --no-frozen-lockfile
```

## 运行与生效

- 宿主半段为零副作用占位实现，不注册路由、不读写磁盘。
- 浏览器半段承担全部功能，**刷新页面**即可加载最新版本；首次安装或调整 `bundles` 名册后需重启 DSH。
- 任务数据保存在浏览器 `localStorage`（键 `dsh.taskPool.v1`），跨刷新与重启保留；`localStorage` 不可用时自动降级为内存存储。

临时停用可在 profile 的 `cordis.patch.yml` 中追加：

```yaml
- id: task-pool
  disabled: true
```

## 许可证

[MIT](./LICENSE)
