# dsh-ui-tweaks

DeepSeek Harness (DSH) web profile 的常驻插件：一组可独立开关的界面外观微调，集中在设置页的"界面微调"栏目中管理。

## 功能

当前包含六条微调：

| id | 名称 | 说明 |
| --- | --- | --- |
| `conversation-shift` | 对话区右缩 | 通过 DOM 探测定位对话流容器与输入区，为其增加可配置的右侧内边距，给右侧面板让位；探测失败时回退到对话列容器。 |
| `conversation-shift-debug` | 对话右缩调试高亮 | 为命中的元素加高亮描边与浮动标签，并在控制台输出命中元素的诊断信息。 |
| `simple-mode` | 简洁模式 | 隐藏思考、工具调用、上下文注入等过程节点；在输入框上方显示一行极简运行状态。 |
| `hide-sidebar-tooltip` | 隐藏侧栏悬浮提示 | 隐藏侧栏会话/工作区条目在悬停时弹出的浮层（同时覆盖 Tooltip 与 HoverCard 两种实现）。 |
| `hide-trajectory-tab` | 隐藏"轨迹"标签 | 隐藏对话顶部的轨迹标签页；若当前正停留在轨迹视图，自动切回对话视图。 |
| `hide-chat-tab` | 隐藏"对话"标签 | 隐藏对话顶部的"对话"标签页（默认 view 的标签，纯视觉噪音）；和 `hide-trajectory-tab` 一起开启 → 两个标签都消失。 |

每条微调由 `lib/client.js` 中 `TWEAKS` 数组的一项定义，包含 id、名称、描述、配置键、默认值与 CSS 生成函数。UI 控件、CSS 生成与持久化均以该数组为单一数据源。

设置页每行附带"诊断"按钮，可输出当前状态、生成的 CSS 与命中元素；栏目顶部提供"复制状态到剪贴板"。运行时还暴露 `window.__dshUiTweaks` 调试接口（`getState` / `getInjectedCSS` / `getMatchedElements` / `debug` / `setState` / `reshim`）。

## 安装

插件既可以从本仓库子目录安装，也可以作为独立 npm 包安装。

**从 monorepo 子目录安装**

克隆仓库后，在 DSH web profile 的 `package.json` 中以 `file:` 协议引用该子目录：

```json
{
  "dependencies": {
    "dsh-ui-tweaks": "file:<到仓库的相对路径>/dsh-ui-tweaks"
  }
}
```

**从 npm 包安装**

```json
{
  "dependencies": {
    "dsh-ui-tweaks": "^0.7.1"
  }
}
```

## 启用

在同一份 profile `package.json` 的 `dsh.profile.bundles` 数组中加入包名：

```json
{
  "dsh": {
    "profile": {
      "bundles": ["dsh-ui-tweaks"]
    }
  }
}
```

随后在 profile 目录安装依赖：

```bash
pnpm install --no-frozen-lockfile
```

## 运行与生效

- 宿主半段为零副作用占位实现，不注册设置命名空间、不读写磁盘。
- 浏览器半段承担全部功能，**刷新页面**即可加载最新版本；首次安装或调整 `bundles` 名册后需重启 DSH。
- 微调状态保存在浏览器 `localStorage`（键 `dsh-ui-tweaks/state`）；新增字段按缺省值隐式补齐，无需迁移。
- 部分选择器依赖 DSH 前端的类名与结构，DSH 升级后可能需要相应更新提示常量。

临时停用可在 profile 的 `cordis.patch.yml` 中追加：

```yaml
- id: ui-tweaks
  disabled: true
```

## 许可证

[MIT](./LICENSE)
