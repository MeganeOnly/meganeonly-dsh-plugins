# dsh-ui-tweaks

DeepSeek Harness (DSH) web profile 的常驻插件：一组可独立开关的界面外观微调，集中在设置页的"界面微调"栏目中管理。

## 功能

当前包含十条微调：

| id | 名称 | 说明 |
| --- | --- | --- |
| `conversation-shift` | 对话区右缩 | 通过 DOM 探测定位对话滚动容器（v0.10.2 起首选 DSH 稳定锚点 `[data-conversation-scroll]`，空会话也命中；v0.5.3 的 overflow+chat-flow-kind / input 探测保留作兜底），为其增加可配置的右侧内边距，给右侧面板让位。**v0.10.2 起像素值在窄屏自动收紧到父元素宽度的 40%**（`min(Npx, 40%)`）——保留全屏偏好像素，半屏浏览器下不会出现 380px 吃掉过多对话宽度的问题。 |
| `conversation-shift-debug` | 对话右缩调试高亮 | 为命中的元素加高亮描边与浮动标签，并在控制台输出命中元素的诊断信息。 |
| `simple-mode` | 简洁模式 | 隐藏思考、工具调用、上下文注入等过程节点；在输入框上方显示一行极简运行状态。**v0.10.12 起错误信息（API 失败 / 4xx 5xx / 超时等）保留可见**——这些是排查问题必须的信号，隐藏后用户看不到失败原因。 |
| `hide-sidebar-tooltip` | 隐藏侧栏悬浮提示 | 隐藏侧栏会话/工作区条目在悬停时弹出的浮层（同时覆盖 Tooltip 与 HoverCard 两种实现）。 |
| `hide-trajectory-tab` | 隐藏"轨迹"标签 | 隐藏对话顶部的轨迹标签页；若当前正停留在轨迹视图，自动切回对话视图。 |
| `hide-chat-tab` | 隐藏"对话"标签 | 隐藏对话顶部的"对话"标签页（默认 view 的标签，纯视觉噪音）；和 `hide-trajectory-tab` 一起开启 → 两个标签都消失。 |
| `first-message-jump` | 上一条我发的消息按钮（Shift+点击 = 回到最早） | 对话区右下角（输入框上方）的悬浮按钮——单击跳到当前视口内最顶部可见 user 消息的上一条，连续单击可一路向上直到第一个可见 user 行（v0.9.4 起 prev 跳过 hidden row——例如 simple-mode `display:none` 隐藏的 compaction 块里的旧 user 行，避免按钮"卡死"在看不见的位置；v0.9.2 起可见性放宽为 `rows.length >= 2`：2 条以上 user 行就显示作为视觉提示，即使已在顶部 click 也是 no-op）。**Shift+单击 = 一键回到最早一条可见 user 行**（v0.9.2 起跳过 compaction / context 容器里的旧 user 行，恢复 v0.8.0 的「回到最早」语义）。 |
| `disclosure-end-collapse` | 展开块末尾收起按钮 | Think / 工具调用 / 上下文注入等折叠块展开后，末尾追加一个"收起"按钮——阅读到底部能直接收起，不用滚回头部再点行。点击调用 row.click() 触发 DSH React onToggle 折叠，body 与按钮一起被 React unmount，无需手动清理。 |
| `sidebar-match-conversation-bg` | 侧栏背景与对话一致 | DSH 默认左侧栏（展示会话列表的区域）有独立的背景色，与对话区的 `--dsw-alias-bg-base` 不同——视觉上有明显分割。开启后把侧栏列容器背景设为对话区同款（用 `--dsw-alias-bg-base`，主题没定义时退化到 `--dsw-alias-bg-layer-1` 再退化到白），让两个区域在背景色上融合。会话项 / 按钮 / hover 态等子元素的视觉行为不变（只改列容器背景）。 |
| `stats-line-position` | 统计行位置 | 对话底部那行运行统计（轮次 / 步数、LLM 与工具耗时、首 token 与吞吐、缓存命中、输入输出 token）的位置，**三选一**：`bottom`（DSH 默认）/ `top`（挪到顶部标题行「对话名 + 模式」右边）/ `hidden`（完全不显示）。非 `bottom` 时原生行用 `visibility` 隐藏而非移除，保留它原本占的 24px——输入框位置与 `bottom` 时完全一致。**0.2.x 起 DSH 把上下文占用计量器（ContextMeter）放进同一条底部 dock 行、与统计行同级，本微调会把它一并隐藏**（想保留计量器请选 `bottom`）。本插件唯一的非布尔微调——设置页渲染下拉框而不是开关。 |

每条微调由 `lib/client.js` 中 `TWEAKS` 数组的一项定义，包含 id、名称、描述、配置键、默认值与 CSS 生成函数；带 `choices` 的条目在设置页渲染下拉框而不是开关。UI 控件、CSS 生成与持久化均以该数组为单一数据源。

设置页每行附带"诊断"按钮，可输出当前状态、生成的 CSS 与命中元素；栏目顶部提供"复制状态到剪贴板"。运行时还暴露 `window.__dshUiTweaks` 调试接口（`getState` / `getInjectedCSS` / `getMatchedElements` / `debug` / `setState` / `reshim` / `firstMessageJump` / `disclosureEndCollapse` / `statsLinePosition`）。

### `conversation-shift` 的实现约定与已知代价（v0.10.2 起）

- **首选 DSH 稳定锚点 `[data-conversation-scroll]`**（v0.10.2 起）：DSH `ConversationRoot.scrollBody` 上 DSH 源码（`dsh-client-ui-conversation/lib/client.js:7277`）显式 `setAttribute` 的属性，**不含构建 hash**，跨 DSH 版本不变。该属性在「空会话（hero composer + 无消息）」时也命中——v0.5.3 的 overflow + `[data-chat-flow-kind]` 探测在空会话找不到任何元素导致右缩不生效，本修复解决。DSH 升级换 hash 不影响命中（与 v0.7.3 HoverCard `[class*="_hoverContent"]` / v0.10.0 stats-line-position `data-slot=...` 同源的 hash-independence 策略）。
- **单 padding 而非双 padding**（v0.10.2 起）：v0.5.3 实现同时给 chatflow 容器和 input 容器打标记，CSS 对两个元素各加 `padding-right:380px` 叠加成 760px 双 padding——全屏 conv 列 1640px 还容得下，半屏 680px 直接溢出。DSH 当前 DOM 结构是 scrollBody 已包了 composerSeat（composer 是 scrollBody 的子元素而非兄弟），所以单 padding 在 scrollBody 上就能同步影响消息 + 输入框，无需再额外标 input。input 探测保留作兜底（DSH 未来把 composer 拆出 scrollBody 时的最后防线）。
- **CSS 用 `padding-right: min(Npx, 40%)`**（v0.10.2 起）：保留用户在全屏的偏好像素，半屏浏览器自动收紧到「聊天列 60% 内容 + 40% 右缩」的比例——聊天气泡（DSH `--dsh-chat-content-width:748px`）始终可读。`40%` 是父元素宽度的 40%（CSS `min()` 是逐元素计算的）。需要更激进收紧可改设置页 `conversationShiftPx`；需要更宽保留（如窄屏下也想保 380px）改本 CSS 的 40% 为更大值。

### `stats-line-position` 的实现约定与已知代价（v0.10.0 起）

- **隐藏的是整个底部 dock 行**：选 `top` 或 `hidden` 时，CSS 隐藏的是 slot 出口 `[data-slot="conversation.composer.dock"]`（而不是统计行自身的类名——后者是 CSS module hash，每次 DSH 构建都会变），外加一条以出口为锚的兄弟选择器 `[data-slot="conversation.composer.dock"] ~ *`。0.2.x 起 DSH 把上下文占用计量器（ContextMeter）作为**后继兄弟**放进同一条 dock 行，只隐藏出口会把它留下；兄弟选择器把出口之后的同级节点一并隐藏（ContextMeter 根节点是 `<span>`，故用 `~ *` 而非 `~ div`）。**老版本 DSH 上这一行只有统计行**，出口没有后继兄弟，该规则零命中、行为无变化。已知代价：若将来有别的插件也往这同一个 slot / 这一行放东西，会被一并隐藏。
- **用 `visibility` 隐藏，不是 `display:none`**（v0.10.1 起）：统计行是输入框卡片的 footer，而卡片是贴着对话区底部的——把它从布局里移除会让卡片变矮 24px，输入框随之下移 24px。改用 `visibility:hidden` 后元素照常占位（React 也照常更新它的文本），输入框位置与 `bottom` 时**完全一致**。代价是输入框下方保留一条 24px 空白——这正是把输入框钉在原位所必须的空间。
- **顶部显示的是「镜像」而不是原生节点**：原生统计行始终留在原位（只是被隐藏），插件另建一个自己的元素挂在标题簇末尾，按 400ms 周期克隆内容。这样做是为了不把 React 拥有的 DOM 节点搬走——搬走后 React 卸载它时会找不到父节点而报错。因此顶部统计的更新有最多约 0.4 秒延迟，且标题行放不下时会省略号截断（鼠标悬停看全文）。
- **切换会话或刷新页面后自动恢复**：镜像随标题行被 DSH 重建而重建，同一时刻页面上只会存在一个。
- **镜像源只在 slot 出口子树内取**（v0.10.13 起显式收窄）：`statsFindSource()` 以 `[data-slot="conversation.composer.dock"]` 元素为根查询统计行根节点，候选还要过 `outlet.contains()` 校验——0.2.x 的 ContextMeter 与出口同级（根节点类名同样含 `_root`），不在子树内，不会被误当镜像源；校验同时挡住将来 DSH 结构调整。

### `first-message-jump` 启用后的额外副作用（v0.9.1 起）

开启 `first-message-jump` 后，DSH 自带的「回到底部」悬浮按钮也会被一起改造为「单击 / Shift+单击」的对称模式：

- **单击「回到底部」按钮**（原本一键到底）→ 现在改为向下走一条 user 行（`topVisible → next`）。连续单击可一路向下走到对话末尾。
- **Shift+单击「回到底部」按钮** → 一键到底（DSH 原生 handler 正常跑，恢复原本的"一键到底"语义）。

两个按钮都用「单击 step 一条 / Shift+单击 极限」的对称模式——我的按钮专注向上，原生按钮专注向下，行为镜像。若不想要这个副作用，关掉 `first-message-jump` 即可，原生按钮会退化为原本的"单击一键到底"。

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
