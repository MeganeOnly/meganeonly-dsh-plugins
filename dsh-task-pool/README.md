# dsh-task-pool

作者：MeganeOnly

DSH 任务池插件 v0.5.3：**右侧抽屉 + 右上角 FAB + 二次确认发送 + 发送后默认删除**。任务池整体进入屏幕右侧 380px fixed 抽屉（挂在 `document.body`），默认收起，**右上角浮动按钮（FAB，top: 56px）** 唤起；与对话**共存**而非覆盖。卡片就地展开编辑：可改标题/描述、可删除、可**"📨 发送到当前对话"**（两次点击才真发，第一次进入 armed 态，按钮变橙色脉冲 + 文字"再点一次确认发送"含倒计时 4→3→2→1，4 秒超时或切换卡片自动撤销）。**v0.5.3 发送成功后默认从池子删除**——可在 `dsh-ui-tweaks` 设置页的 `taskPoolDeleteAfterSend` 开关切换（默认 true；关掉则发送后保留任务）。**这是唯一消耗 token 的路径**（与 ui-task-board 的执行模式同款）——其它操作（新建 / 编辑 / 拖动 / 删除 / 钉住）仍是纯本地操作，不消耗 token。

视觉 token **完全对齐 DSH 原生**：圆角 8px、字体 13px、hover/active 背景用 `--dsw-specific-sidebar-nav-item-hover/active`（与侧边栏入口 / ssh / ui-task-board 同款）；柔和阴影；FAB 用 DSH 风格的浅色卡片按钮（白底 + 浅边）而非浓蓝。**FAB 图标严格以 viewBox 中心 (8,8) 为基准**，正方形 (9.5×9.5) + 十字 (4.5×4.5) 都精确居中。

数据持久化在浏览器 localStorage（key `dsh.taskPool.v1`，schema v2 兼容 v1），跨 DSH 重启与浏览器刷新保留。

## 设计动机

碍于 token 消耗限制，把所有想做的事情集中收集到一个本地池子里，每天由用户自己挑选几个做。不需要任何"自动化执行 / 提醒 / 配额"功能——这正是它与 ui-task-board 的根本区别：ui-task-board 是"任务执行看板"（消耗 token），本插件是"灵感池"（零成本）。

v0.2.0 → v0.4.0 的迭代理由：

1. **右侧抽屉替代中心覆盖**（v0.2.0）：v0.1.0 用"中心面板覆盖"模式会**完全遮挡对话**，无法一边看任务一边跟 agent 沟通；右侧抽屉只占屏幕右侧 420px，对话视野得以保留。
2. **FAB 替代侧边栏入口 + 始终可见 inline input 替代 + 按钮**（v0.3.0）：侧边栏按钮在左侧、抽屉在右侧，**视觉对应违和**；FAB 放在右下角与抽屉同侧，符合"右边抽屉对应右边按钮"语义。+ 按钮依赖 `editingNew` 状态切换 + 列表内联新建行，链路有 3 处脆弱点（input focus/blur 时序抢、renderBody 时序抢、状态不一致），实测经常没反应；**改为 header 始终显示一个 inline input**，回车即保存，彻底回避整个状态机。
3. **FAB 右上 + 视觉统一**（v0.4.0）：用户反馈"右下角位置还行但偏右下"——改为**右上角**（top: 24px; right: 24px）。drawer 打开后 FAB 会被抽屉遮住，通过 CSS `right: calc(420px + 24px)` 让位到抽屉左边界外，CSS transition `right` 与 drawer 的 `transform` 同步（0.22s）。视觉上对齐 DSH 原生：圆角统一 8px、字体 13px、hover/active 用 DSH 专属的 `--dsw-specific-sidebar-nav-item-hover/active`、输入框用 `--dsw-specific-input-major`、FAB 用白底卡片按钮（DSH 风格而非浓蓝）。FAB 图标精确居中（viewBox 中心 (8,8) 为基准；正方形 9.5×9.5 + 十字 4.5×4.5 都对齐到 (8,8)）。

## 功能

- **右上角 FAB**（固定 `top: 56px; right: 24px`，44×44 圆形，DSH 风格浅色卡片按钮）：始终显示，点击切换抽屉；drawer 关闭时图标 = 方块+加号（任务池入口），drawer 打开时图标 = ×（关闭）；📌 钉住时 FAB 右上有小绿点
- **drawer 打开时 FAB 自动让位**：CSS `right: calc(380px + 24px)` 让 FAB 平滑移到抽屉左边界外，不被遮挡（0.22s transition 与 drawer 同步）
- **发送后默认删除任务**（v0.5.3）：`📨 发送到当前对话` 成功 → 任务自动从池子删除。
- **全局"发送后删除"开关**（v0.5.3）：抽屉 header 内（`+ [inline input] [☐ 发送后删除] [📌] [×]`）——**全局**控制所有任务，**不**是 per-task。勾选=发送后删除（默认），取消勾选=发送后保留。设置持久化在 `dsh.taskPool.v1` 的 `deleteAfterSend` 字段（v3 schema）。
- 抽屉出现时**不影响对话内容**（对话仍可见、可输入、工具调用等不受干扰）
- 抽屉 header：
  - `+` 图标（静态） + **inline input** "新建任务…回车保存"（始终可见；回车即新建，trim 非空；失焦不做任何事避免误触）
  - **📌 钉住**按钮：toggle 持久化钉住状态；钉住后下次启动抽屉自动显示；按钮图标根据 pinned 切换（实心/空心）
  - **× 关闭**按钮：抽屉滑出
- 列表：单列长条卡片（标题 + 描述预览 + 创建时间 + 拖动手柄 + ▶ chevron）
- 点击卡片：**就地展开**（卡片下方出现编辑面板：标题输入框、描述 textarea、创建/更新时间、删除按钮、收起按钮）；再点该卡片 / Esc / 点别处自动收起；同一时刻只允许一张展开
- 拖动：长按拖动 handle → 列内上下重排，落点显示蓝色插入线
- 空池子显示"还没有任务，在上面输入回车即可添加"占位
- 任务数过多（>50）列表自动竖向滚动
- 全局键盘：**Esc** 优先级处理 → 撤销删除二次确认 / 收起展开 / 关闭抽屉（input / textarea 内部 Esc 由各自处理）
- 所有数据存 localStorage，刷新/重启 DSH 不丢失

## 状态机

| 操作 | drawerOpen | pinned | 持久化 |
| --- | --- | --- | --- |
| DSH 启动 | `= pinned` | 从 store 读 | pinned 是 |
| FAB 点击 | `toggle` | 不变 | 仅 drawerOpen（会话级） |
| 抽屉 × 按钮 | `false` | 不变 | 否 |
| 抽屉 📌 按钮 | `true`（保证可见） | `toggle` | pinned 是 |
| 抽屉自动收起（点侧边栏会话/项目行时） | `false` | 不变 | 否 |
| header inline input 回车 | drawerOpen 不变；新增 task | — | tasks 是 |
| 卡片点击 | drawerOpen 不变；expandedId 切换 | — | 仅 expandedId（会话级） |
| 📨 发送成功（二次确认第 2 次按） | drawerOpen 不变 | — | task **删除**（默认）/保留（`taskPoolDeleteAfterSend=false`） |

`drawerOpen=true` 时 `<html>` 加 `data-dsh-taskpool-drawer-open` 属性 → CSS 让抽屉滑入。

## 安装

按 dsh-plugins 总 README「安装」节的统一流程：

1. 插件源放 `F:\.dsh\plugins\dsh-task-pool\`（实际仓库源码在 `F:\AllWorkSpace\dsh-plugins\dsh-task-pool\`，按 D005 部署为独立副本）
2. 编辑 `F:\.dsh\profiles\web\package.json`：
   - `dependencies` 加 `"dsh-task-pool": "file:../../plugins/dsh-task-pool"`
   - `dsh.profile.bundles` 加 `"dsh-task-pool"`
3. 安装：
   ```bat
   cmd /c "cd /d F:\.dsh\profiles\web && pnpm install --no-frozen-lockfile"
   ```
4. 手动同步源码副本（pnpm v11 的 `file:` 是拷贝非硬链接且 install 不感知内容变化）：
   ```powershell
   Copy-Item F:\AllWorkSpace\dsh-plugins\dsh-task-pool\lib\* F:\.dsh\profiles\web\node_modules\dsh-task-pool\lib\ -Recurse -Force
   Copy-Item F:\AllWorkSpace\dsh-plugins\dsh-task-pool\package.json F:\.dsh\profiles\web\node_modules\dsh-task-pool\package.json -Force
   Copy-Item F:\AllWorkSpace\dsh-plugins\dsh-task-pool\cordis.patch.yml F:\.dsh\profiles\web\node_modules\dsh-task-pool\cordis.patch.yml -Force
   ```
5. **无需重启 DSH**——客户端 bundle 路由按请求读文件且 cache-control: no-cache，浏览器刷新即生效

## 数据模型

```ts
type Task = {
  id: string         // uuid
  title: string      // 必填，trim 后非空
  description: string// 可空
  createdAt: number  // ms epoch
  updatedAt: number  // ms epoch，每次编辑刷新
  order: number      // 同 createdAt，重排时不依赖此字段（顺序由数组下标决定）
}

// v1 文档（v0.1.0 时期；v0.3.0 兼容加载）：
// { tasks: Task[], selectedTaskId?: string }

// v2 文档（v0.2.0 起）：
// { tasks: Task[], pinned: boolean }
```

localStorage key：`dsh.taskPool.v1`（保持不变，schema 演进不升 key）。

**v1 → v2 迁移**：load 时检测文档结构，v1 文档（无 `pinned` 但有 `selectedTaskId`，或都没有）的 `tasks` 保留、`selectedTaskId` 丢弃、`pinned` 默认 false。下次任何 mutation 后自动写 v2 格式。

## 显式不做

- 多抽屉（同时显示多个任务池视图）
- 抽屉宽度可拖拽调宽（420px 固定）
- 抽屉内的"搜索"功能（超出"纯池子"语义）
- 抽屉与对话的"split view"双列布局（对话始终全宽；抽屉出现时只遮挡右侧 420px）
- 多 Tab 切换（任务池是单一视图）
- 任何 token 消耗路径（system prompt 段、agent followup）
- inline input 的失焦保存（v0.2.0 + 按钮模式曾用 blur 自动保存，实测与 renderBody 时序抢焦点，导致用户输入的文字被吞；v0.3.0 改为只有回车才保存）

## 风险与回退

- **白屏 / 加载失败**：在 `F:\.dsh\profiles\web\cordis.patch.yml` 追加：
  ```yaml
  - id: task-pool
    disabled: true
  ```
  刷新即恢复，源码不动。
- **彻底卸载**：`F:\.dsh\profiles\web\package.json` 移除 `dsh-task-pool` 依赖与 bundle 条目 → `pnpm install` → 删除 `F:\.dsh\plugins\dsh-task-pool\`。
- **清空任务数据**：浏览器 DevTools → Application → Local Storage → 删除 `dsh.taskPool.v1`。
- **重置钉住状态**：浏览器 DevTools → Application → Local Storage → 编辑 `dsh.taskPool.v1` 的 `pinned: false`。

## 实现要点

- **零 React 依赖**：纯 DOM + 模板字符串。HTML5 drag 事件直接挂 DOM 元素，避免 React 受控组件 re-render 干扰 dragover。bundle 体积小、调试直观。
- **FAB 自挂 `document.body`**：右下角浮动按钮是侧边栏入口的替代方案——视觉对应"右侧抽屉 ↔ 右下角 FAB"，避免"右边功能放左边按钮"的违和。FAB 始终可见，点击 toggle；图标根据 drawerOpen 切换（方块+加号 ↔ ×）；pinned 时右上角小绿点指示。
- **header inline input 始终可见**：v0.2.0 的 `editingNew` 状态 + 列表内联新建行链路有 3 处脆弱点（input focus/blur 时序抢、renderBody 时序抢、状态不一致），实测 + 按钮经常无反应。v0.3.0 彻底删除 `editingNew` 状态，header 里始终显示一个 input，回车即创建——**用户任何时候都能直接打字新建**，无需任何状态切换。
- **v1 数据兼容**：schema 演进不升 key，从 v1 文档隐式迁移到 v2，避免破坏用户已有数据。
- **互斥协议**：保留 ui-task-board 已建立的 `dsh-panel-activate` CustomEvent + `<html data-dsh-*>` 属性机制；本插件的 active attr 改为 `data-dsh-taskpool-drawer-open`，激活时主动 remove 其它面板的 active attr。
- **自愈 DOM 挂载**：MutationObserver 监听 body 变化，React 重渲染后丢失 FAB 或抽屉容器时自动重插。
- **持久化降级**：localStorage 不可用（隐私模式）时退化为内存 store，控制台 warn；功能可用但刷新即丢。
- **就地展开互斥**：`expandTask(id)` 时若 id 与当前 expandedId 相同 → 收起；否则覆盖。同时 `confirmDelete` 也互斥，确保抽屉里只有一个交互面板。
- **Esc 优先级**：删除二次确认（`confirmDelete`）> 展开卡片（`expandedId`）> 关闭抽屉，逐级取消。input / textarea 内部 Esc 由各自处理（`titleInput` Esc = 收起卡片；`descInput` Esc 不绑）。