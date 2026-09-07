# Changelog

本文件记录 `dsh-ui-tweaks` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.10.4] - 2026-09-06

### 修复

- **设置页开关尺寸回退到 v0.5.1 之前的紧凑 pill——v0.10.3「圆圆的」修复只完成了一半**（v0.10.4）：用户实测反馈「v0.10.3 修了 border 之后开关『看起来还是方方的』」——v0.10.3 CHANGELOG 标题写「回归 v0.5.1 之前的「圆圆的」pill 形态」但**实际只删了 border**，尺寸仍为 v0.6.0 合并 simple-mode 时放大的 `36×22` / thumb `18×18`（v0.5.1 是 `34×20` / thumb `16×16`）。
  - **根因（v0.10.3 不彻底的根因）**：v0.6.0（commit `f3c3d5f` 合并 simple-mode 进 ui-tweaks 时）**同时**做了两件事——① 给 `.DTPD_switch` 加 `border:1px solid var(--dsw-alias-border-l2,#94a3b8)`；② 把尺寸从 `width:34px; height:20px` 调到 `width:36px; height:22px`、把 thumb 从 `16×16 + top:2px; left:2px` 调到 `18×18 + top:1px; left:1px`。这两件事是同时发生的，作者大概率没意识到它们共同削弱了 pill 的「圆」——border 是显式的 1px 灰边（用户第一眼能看到），尺寸放大是隐式的（chunky thumb 压缩 pill 末端圆形轮廓）。v0.10.3 看 user 反馈「现在开关都有一点方圆的」时只注意到了 border 这一显式变量，把 border 删了就以为修好；尺寸放大这一隐式变量被漏掉，用户实测「去掉边框后还是方方的」→ 这次才被定位到。
  - **修法：尺寸三个值同时回退到 v0.5.1 之前的紧凑 pill**——
    - `.DTPD_switch` 的 `width:36px; height:22px` → `width:34px; height:20px`
    - `.DTPD_switch::after` 的 `width:18px; height:18px; top:1px; left:1px` → `width:16px; height:16px; top:2px; left:2px`
    - `.DTPD_switch:checked::after` 的 `transform:translateX(14px)` **保持不变**——translateX 14px 在两种宽度下都成立：34px 宽里 `14+16+2=32`、knob 右边距 2px；36px 宽里 `14+18+1=33`、knob 右边距 3px。数值上两种宽度都给 knob 留 2-3px right gap，无需调整
  - **「圆圆的」如何从尺寸放大里恢复**：22px 高度 + 18px thumb + top:1px → thumb 上下边距各 2px（thumb 高度占 switch 高度的 82%），pill 两端的圆形轮廓被厚 thumb 压缩；20px 高度 + 16px thumb + top:2px → thumb 上下边距各 4px（thumb 高度占 switch 高度的 80%，但绝对边距从 2px 增到 4px——视觉上 pill 末端有「更明显的圆」可见）。border-radius:999px 本身没变，变的只是容器和 thumb 的尺寸比例与 thumb 离边缘的距离。
  - **兼容性**：tweak id / `choices` / localStorage key / `.DTPD_switch` 类名 / 设置页 React 组件 / `<input type="checkbox" className="DTPD_switch">` 的 DOM 形状 / debug API / 状态事件总线 全部不动；只改 `SECTION_CSS` 的 `.DTPD_switch` / `.DTPD_switch::after` 两个选择器的 width/height/top/left 共 4 个 CSS 值（其余属性 border-radius:999px / thumb 50% / thumb box-shadow / off 态 fallback 色 / transition / flex / margin / padding 全部保留）。老用户升级后开关状态保留、关闭/开启行为零变化、键盘焦点圈与 ARIA role="switch" 完全不变。
  - **诊断**：浏览器 DevTools inspect 设置页 `.DTPD_switch` 元素——
    - Computed 面板 `width` 应是 `34px`、`height` 应是 `20px`（v0.10.3 时是 36×22）
    - Computed 面板 `border-radius` 仍是 `999px`、`border` 仍是 `medium none currentcolor`（v0.10.3 已删）
    - `::after` 伪元素 `width` 应是 `16px`、`height` 应是 `16px`、`top` 应是 `2px`、`left` 起始 `2px` / 勾选后 `16px`（v0.10.3 时是 18×18 + top:1 / left:1 或 15）
    - 视觉上 pill 两端圆形轮廓比 v0.10.3 更明显（thumb 上下边距从 2px 增到 4px，pill 高度的 20% 留给 thumb 之外的轨道），跟 v0.5.1 之前一致
    - 控制台 `window.__dshUiTweaks.getInjectedCSS()` 返回的 CSS 含 `.DTPD_switch{...width:34px;height:20px;...}` + `.DTPD_switch::after{...width:16px;height:16px;top:2px;left:2px;...}`
  - **改动文件**：`lib/client-src/35-styles.js`（SECTION_CSS 的 `.DTPD_switch` width/height + `.DTPD_switch::after` width/height/top/left 五个值回退 + JSDoc 加 v0.10.4 段 + v0.10.3 段更新为"只完成了一半"叙述）；`lib/client-src/20-constants.js`（VERSION 0.10.3 → 0.10.4 + 头部加 v0.10.4 注释 + v0.10.3 注释加"本次仅去 border、未恢复尺寸"补注）；`lib/client-src/00-banner.js`（加 v0.10.4 banner 段在最顶部 + v0.10.3 banner 段补"本次只完成了一半"叙述）；`package.json`（version 0.10.3 → 0.10.4 + description 开篇换成 v0.10.4 摘要）；本 CHANGELOG 加 [0.10.4] 段；走 `npm run build:client` + `node --check lib/client.js` 语法校验通过。

### 兼容性（DSH 0.1.2-rc.1）

- 与 v0.10.3 相同——DOM 锚点不变（`[data-conversation-scroll]` / `[data-slot=...]` / `[data-chat-flow-kind]` / `[data-variant="think"]` / `[class*="..."]`），CSS Module 类名 hash 变化不命中任何规则，DSH 升级换 hash 行为零变化。
- v0.10.4 仅修改 `.DTPD_switch` / `.DTPD_switch::after` 两个选择器的尺寸 4 个值，与 DSH 0.1.2-rc.1 完全无关——这是本插件自己的开关组件，不依赖任何 DSH DOM 形状。

## [0.10.3] - 2026-09-05

### 修复

- **设置页开关去边框，回归 v0.5.1 之前的「圆圆的」pill 形态**（v0.10.3）：用户反馈「现在开关都有一点方圆的，我更喜欢之前那种圆圆的」。
  - **根因**：v0.6.0（commit `f3c3d5f` 合并 simple-mode 进 ui-tweaks 时）给 `.DTPD_switch` 加了 `border:1px solid var(--dsw-alias-border-l2,#94a3b8)`。在 22px 高的 pill 上绕一圈 1px 灰边，把 pill 的「圆」削弱，视觉上偏「方圆」（介于方形和圆形之间）。v0.5.1 之前（v0.2.0–v0.5.x）没有这条 border，pill 是纯色椭圆，跟用户记忆里的「圆圆的」一致。
  - **修法**：去掉 `.DTPD_switch` 里的 `border:1px solid var(--dsw-alias-border-l2,#94a3b8)` 一段，其它所有属性保留：`width:36px; height:22px; background:var(--dsw-alias-bg-component-disabled,#cbd5e1); border-radius:999px`（pill 形态）+ thumb `18×18` + `border-radius:50%` + `box-shadow:0 1px 2px rgba(0,0,0,.18)`（圆点带阴影）。
  - **off 态可见性**：off 态靠 `background:var(--dsw-alias-bg-component-disabled,#cbd5e1)` 的 fallback 颜色保持可见（亮色主题 `#cbd5e1` 浅灰 / 暗色主题走 var 解析值）。v0.6.0 加 border 时本来就不是为了兜底可见性（CSS comment 里 v0.5.1 写的是"switch 用显式颜色作为 fallback，不依赖 `--dsw-alias-bg-component-disabled`，在某些 DSH 主题下变量值接近背景色导致开关看不见"——这是 fallback 颜色的职责，不是 border 的），所以去掉 border 不影响 fallback 兜底逻辑。
  - **兼容性**：tweak id / `choices` / localStorage key / `.DTPD_switch` 类名 / 设置页 React 组件 / 调试 API 全部不动；只改 `SECTION_CSS` 的 `.DTPD_switch` 一行（删掉 border 声明）。老用户升级后开关状态保留，关闭/开启行为零变化。
  - **诊断**：浏览器 DevTools inspect 设置页 `.DTPD_switch` 元素，Computed 面板 `border` 应是 `medium none currentcolor`（无 border），`border-radius` 仍是 `999px`，pill 形态与 v0.5.1 之前一致；勾选时 `background` 从 fallback 浅灰切到 `--dsw-alias-state-business-primary`（`#2563eb` 蓝），thumb `transform:translateX(14px)` 平滑滑到右侧——开关行为完全保留。
  - **改动文件**：`lib/client-src/35-styles.js`（SECTION_CSS 的 `.DTPD_switch` 删 `border:1px solid ...` 一段 + JSDoc 加 v0.10.3 注释）；`lib/client-src/20-constants.js`（VERSION 0.10.2 → 0.10.3 + 头部 v0.10.3 注释）；`lib/client-src/00-banner.js`（加 v0.10.3 banner 段）；`package.json`（version 0.10.2 → 0.10.3 + description 同步）；本 CHANGELOG 加 [0.10.3] 段；走 `npm run build:client` + `node --check lib/client.js` 语法校验通过。

## [0.10.2] - 2026-09-04

### 修复

- **`conversation-shift` 半屏浏览器看起来奇怪 + 新建会话界面不生效**（v0.10.2）：用户反馈两个症状——「对话区右缩，全屏时效果很好，但半屏看起来很奇怪」+「对话区右缩，在『新建会话』界面不生效，我希望它生效」。两个症状是同一个 bug 的两面。
  - **根因（一个 bug 引发两个症状）**：v0.5.3 的 `findChatflowTargets()` 同时给 chatflow 容器和 input 容器打 `data-dsh-ui-tweaks-shift-target` 标记，CSS 对两个元素都加 `padding-right:380px !important` → 实际叠加成 **双 padding 760px**。DSH 当前的 DOM 结构是 `ConversationRoot > scrollBody [data-conversation-scroll] > { session, composerSeat }`——composer 是 scrollBody 的子元素而非兄弟，所以**单 padding 在 scrollBody 上就能同步影响消息内容 + 输入框**，无需再额外标 input。v0.5.3 同时标 chatflow + input 是「DSH 早期结构里 composer 在 scrollBody 外的兜底」残留。
    - **症状一（半屏）**：全屏视口 1920px / conv 列 ≈ 1640px → 1640 - 760 = 880px 内容区 → 聊天气泡（DSH `--dsh-chat-content-width:748px`）仍能放下 → 用户感「效果很好」；半屏视口 960px / conv 列 ≈ 680px → 680 - 760 = -80px（负值溢出）→ 用户感「看起来很奇怪」
    - **症状二（新建会话）**：空会话（hero composer + 无消息）里 `[data-chat-flow-kind]` 不存在 → v0.5.3 策略 1（overflow + chat-flow-kind 探测）漏判 → 落到 input 探测 → 单 padding 加在 ConversationRoot 上 → 但 hero composer 在 scrollBody 里 `align-self:center` 居中，scrollBody 也在 ConversationRoot 里居中 → 整列右移 380px 在居中布局里视觉上「不明显」，用户感「不生效」
  - **修法两条**：
    1. **`findChatflowTargets()` 探测策略首选 DSH 稳定锚点 `[data-conversation-scroll]`**——DSH `ConversationRoot.scrollBody` 上 DSH 源码（`dsh-client-ui-conversation/lib/client.js:14487` in 0.1.2-rc.1）显式 `setAttribute("data-conversation-scroll", "")` 的属性，**不含构建 hash**，跨 DSH 版本不变。命中即返回，**不再额外标 input**——单 padding 同步影响消息 + 输入框。该策略与 v0.7.3 HoverCard `[class*="_hoverContent"]` / v0.10.0 stats-line-position `data-slot=...` 同源的 hash-independence 策略；DSH 升级换 hash 不影响命中。v0.5.3 的 overflow + chat-flow-kind 探测保留作**兜底策略 2**（DSH 极端改名 `data-conversation-scroll` 时仍能工作），input 探测保留作**兜底策略 3**（DSH 未来把 composer 拆出 scrollBody 时的最后防线）。
    2. **`buildCSS` 输出改成 `padding-right: min(Npx, 40%) !important`**——保留用户在全屏的偏好像素，半屏时 40% 上限自动收紧到「聊天列 60% 内容 + 40% 右缩」的比例。聊天气泡（748px max）始终可读。CSS `min()` 是逐元素计算的，`40%` 是父元素（命中元素本身的直接父 = ConversationRoot / scrollBody 包裹层）宽度的 40%。需要更激进收紧可改设置页 `conversationShiftPx`；需要更宽保留（如窄屏下也想保 380）改本 CSS 的 40% 为更大值。
  - **兼容性**：tweak id `conversation-shift` / localStorage key `conversationShift` + `conversationShiftPx` / 数字输入框（0–800）/ 设置页 UI / 调试 API / 调试高亮（`conversation-shift-debug` 黄色 outline + 浮动标签）全部不动；只改 chatflow 探测顺序（v0.5.3 策略保留作兜底）+ CSS 输出值的 `min()` 包裹 + tweak description 加一句窄屏自适应说明。
  - **改动文件**：`45-chatflow-marks.js` 的 `findChatflowTargets()` 策略重排（[data-conversation-scroll] 首选 + 命中即返回 + 不再额外探测 input）+ 头部 v0.10.2 banner 注释；`25-tweaks.js` conversation-shift `buildCSS` 改 `min(Npx, 40%)` + description 同步；`20-constants.js` VERSION 0.10.1 → 0.10.2 + 头部 v0.10.2 注释 + 新增 `SHIFT_SCROLL_SEL` 常量；`00-banner.js` 加 v0.10.2 banner 段；`package.json` version 0.10.1 → 0.10.2 + description 同步；`README.md` / `docs/maintainability.md` 同步；走 `npm run build:client` + `node --check lib/client.js` 语法校验。

### 兼容性（DSH 0.1.2-rc.1）

- DOM 锚点全部保留：`[data-conversation-scroll]`（DSH 0.1.2-rc.1 `dsh-client-ui-conversation/lib/client.js:14487`）、`[data-slot="conversation.composer.dock"]`（line 15716）、`[data-slot="conversation.session.header.actions"]`（line 14593）、`[data-chat-flow-kind]`（覆盖 `user` / `tool-call` / `context` / `compaction` / `manual-compaction` / `model-retry` / `turn-error` / `turn-max-tokens`）全部存在。
- `conversation.composer.dock` slot 在 DSH 0.1.2-rc.1 仍只有 1 个 occupant（StatsLine）——grep 验证 slot catalog 第 16188 行未新增 token 用量 occupant；DSH 0.1.2 新增"回答末尾 token 显示"是 UI 层（独立位置），不影响本插件 stats-line-position 隐藏行为。
- v0.10.0 / v0.10.1 / v0.10.2 三个修复在 DSH 0.1.2-rc.1 浏览器实测下未观察到回归；v0.10.2 CHANGELOG 中 line 12 引用"dsh-client-ui-conversation/lib/client.js:7277"系旧版行号，新版（0.1.2-rc.1）实际是 line 14487——文件行号变了但 `data-conversation-scroll` 属性名不变。

## [0.10.1] - 2026-08-30

### 修复

- **`stats-line-position` 非「底部」时输入框下移 24px**（v0.10.1）：用户反馈 v0.10.0「这样就导致了发消息的框往下走了一点点，我希望它还是处于原来的位置」。
  - **根因**：统计行是 composer 卡片的 **footer**（`conversation.composer.dock` 作为输入条的 `footer` prop 渲染），高 24px（DSH `.FJxK0a_root` 的 `line-height:20px` + `padding:4px calc(...) 0px`）；而 composer seat 是**贴着滚动容器底部**的——DSH `.wSkVaW_composerSeat{position:sticky;bottom:0}`。`display:none` 把统计行从布局里彻底移除 → 卡片整体变矮 24px → 底边被钉住，顶边（也就是输入行）只能往下挪 24px。
  - **修法**：`display:none` → `visibility:hidden`。元素的盒子仍然生成、仍然参与布局、React 仍然照常更新它的文本，只是不渲染 → 24px 分毫不差地保留，输入框位置与「底部」位置完全一致。CSS 从
    ```css
    [data-slot="conversation.composer.dock"]{display:none !important;}
    ```
    改为
    ```css
    [data-slot="conversation.composer.dock"],
    [data-slot="conversation.composer.dock"] *{visibility:hidden !important;}
    ```
    两条选择器：出口自身 + 其所有后代。`visibility` 本身是**继承属性**，出口那层的 `display:contents` 不生成盒子但仍能把 `hidden` 传给子元素；后代那条是显式兜底，防 DSH 将来给统计行自己写 `visibility`。
  - **为什么不补一个硬编码 24px padding**：那样要把 DSH 的字号 / 行高 / padding 数值抄进插件，DSH 一改统计行样式就错位。`visibility` 让浏览器自己算高度，天然跟随。
  - **冲突核对**：DSH `dsh-client-ui-conversation` 的 ConversationRoot CSS 里只有一条 visibility 规则——`.wSkVaW_root[data-phase=settling] .wSkVaW_composerSeat{visibility:hidden}`（settling 阶段整个 seat 都隐藏），**没有**任何 `visibility:visible` 的后代重置会与本规则打架。
  - **有意的代价**：非「底部」位置时输入框下方保留一条 24px 空白——这正是把输入框钉在原位所必须的空间，已在 tweak description 与 README 注明。
  - **兼容性**：tweak id / `choices` / localStorage key `statsLinePosition` / 镜像逻辑 / controller / 诊断 API / 设置页 UI 全部不动，只改 `buildCSS` 输出的隐藏属性。
  - **改动文件**：`lib/client-src/25-tweaks.js`（stats-line-position `buildCSS` 的隐藏规则 + v0.10.1 注释段）；`lib/client-src/20-constants.js`（VERSION 0.10.0 → 0.10.1 + 头部 v0.10.1 段）；`lib/client-src/69-stats-line-position.js`（头部注释同步）；`lib/client-src/00-banner.js`；`package.json`；`README.md`；`docs/maintainability.md`

## [0.10.0] - 2026-08-29

### 新增

- **`stats-line-position`：对话底部运行统计行的位置可三选一**（v0.10.0）：用户反馈对话底部那行统计（`3 轮 · 45 步 | LLM 12m13s · 工具调用 1m21s | 首 token 平均 2.9s · 71 tok/s | 缓存命中 96% | 输入 3.6M tok · 输出 42.7K tok`）希望能选位置。新增 tweak 提供三个选项：
  | 选项 | 行为 |
  | --- | --- |
  | `bottom`（默认） | DSH 原样。不输出任何 CSS，controller 停机——老用户升级后视觉零变化 |
  | `top` | 底部原生行整条隐藏，改在顶部标题行「对话名 + 模式」**右边**显示（内容完全一致；标题行放不下时省略号截断，鼠标悬停看全文） |
  | `hidden` | 底部原生行整条隐藏，不再显示 |
  - **锚点选择：slot 出口属性而不是 CSS module 类名**。这行统计由 DSH `dsh-client-ui-conversation` 的 `StatsLine` 组件渲染，注册在 slot `conversation.composer.dock`（id `stats`，order 0）。DSH renderer（`dsh-client-ui-renderer` 的 `SlotOutlet`）给**每个** slot 出口包一层 `<div data-slot="<slot key>" style="display:contents">`——这个属性不含构建 hash，跨 DSH 版本稳定；而统计行自身的类名 `.FJxK0a_root` 每次 DSH 构建都会变。顶部标题簇同理走 `[data-slot="conversation.session.header.actions"]` 的祖父节点定位（该出口就是「模式」标签所在处，其祖父即 `titleCluster`），只在主路径失效时才退回 `[class*="_titleCluster"]` 子串匹配。
  - **隐藏走纯 CSS**：
    ```css
    [data-slot="conversation.composer.dock"]{display:none !important;}
    ```
    `!important` 是必需的——出口的 `display:contents` 是 **inline style**，普通样式表规则压不过它。DSH 自己的 slot 目录（`dsh-cordis-client-runner` 的 slot catalog）把该 slot 的 occupants 记为 `["client-ui-conversation StatsLine id 'stats'"]`，唯一占位者就是统计行，所以隐藏整个出口 == 隐藏统计行。**已知代价**：若将来有第三方插件也往 `conversation.composer.dock` 注册条目，本 tweak 选 `top` / `hidden` 时会连带隐藏它——已在 tweak description 与 README 注明。
  - **顶部走「镜像」而不是搬 DOM**：把 DSH 渲染的原生统计行 `appendChild` 到标题簇里是行不通的——React 下次卸载它（`StatsLine` 在 groups 为空时 `return null`，新会话开局必然发生）会对**它记录的原父节点**调 `removeChild` → `NotFoundError` 崩掉整棵 React 树。镜像方案：原生节点始终留在原位（只是 `display:none`，React 照常更新它的文本），本插件另建一个 React 不认识的尾部子节点挂到标题簇末尾，400ms 轮询把原生行的**子节点** `cloneNode(true)` 搬进去。搬子节点而不是克隆根，是为了保留分隔符 `<span class="..._sep">` 的类名（DSH 自己的 `_sep{color;margin:0 10px}` 继续生效，视觉与底部一致），同时甩掉克隆根上底部专用的 `text-align:center` / `width:100%` / `max-width:var(--dsh-chat-content-width)` / padding。与 v0.9.6 `disclosure-end-collapse` 往 body 末尾 `appendChild` 按钮同一模式——追加到容器末尾的外来节点不干扰 React 协调。
  - **轮询而非 MutationObserver**：统计行内容按「步」更新（不是按 token 流），400ms 足够跟手；而它的文本变化是 `characterData` mutation，要用 observer 就得在 document 上开 `characterData + subtree`，对话流式输出时每个 token 都触发，开销远大于一次 `textContent` 比较。文本没变则整段跳过，不做无谓 DOM 重建（`title` 属性兼作「上次内容」缓存与悬停 tooltip）。轮询同时兼任**自愈**：DSH 换会话重建 header 后下一 tick 自动在新标题簇补上镜像，并清掉别处残留的孤儿镜像，保证全页面只有一个。
  - **框架能力：TweakRow 支持 `choices`**。这是本插件第一条**非布尔** tweak——`configKeys.enabled` 存的是 `"bottom"` / `"top"` / `"hidden"` 字符串（与其它「仅开关型」tweak 一样 enabled 与 value 复用同一 key，localStorage 只多一个字段）。`TweakRow` 见到 tweak 上的 `choices`（`[{value,label}]`）就渲染 `<select class="DTPD_select">` 而不是开关；数字输入行的判定不变（仍看 `k2 !== k1`），开关型 tweak 完全走原路径、行为零变化。受控 `<select>` 的 value 在 state 是脏值时退回第一个选项，避免 React 落到空白项。
  - **兼容性**：老用户升级后该 localStorage key 不存在 → `defaultState()` 补 `"bottom"` → 视觉零变化，无需迁移。脏值 / 老布尔值由 `statsNormalizePosition()` 统一退回 `"bottom"`（已测 `undefined` / `true` / 任意字符串）。其它九条 tweak 的 id / localStorage key / CSS / 类名 / attribute / 调试 API 全不动。
  - **改动文件**：新增 `lib/client-src/69-stats-line-position.js`（controller + 镜像逻辑 + 两个锚点定位）；`lib/client-src/20-constants.js`（加 `STATS_DOCK_SEL` / `STATS_HEADER_ACTIONS_SEL` / `STATS_TITLE_CLUSTER_HINT_SEL` / `STATS_ROOT_HINT_SEL` / `STATS_MIRROR_ATTR` / `STATS_POS_*` / `STATS_POLL_MS`，VERSION 0.9.15 → 0.10.0）；`lib/client-src/25-tweaks.js`（加 `stats-line-position` 条目含 `choices` 与 `buildCSS`）；`lib/client-src/75-react-tweak-row.js`（`choices` → `<select>`）；`lib/client-src/35-styles.js`（`.DTPD_select`）；`lib/client-src/85-apply.js`（controller 接线 + 状态事件跟随 + 诊断 API）；`lib/client-src/00-banner.js`；`package.json`；`README.md`；`docs/maintainability.md`

### 维护

- **补齐三个 source 文件缺失的行尾换行**（v0.10.0）：`lib/client-src/68-first-message-jump.js`、`68a-first-message-jump-utils.js`、`75-react-tweak-row.js` 末尾都缺一个 `\n`，违反仓库 `docs/maintainability.md` § 五 边界规则「每个 source 文件末尾必须有 `\n`（除 `Z9-loader-close.js`）」。后果是拼接时**下一个文件的 `    // ===== marker =====` 首行被接到上一个文件的 `}` 后面**（bundle 里出现 `}    // ===== stats-line-position =====` 这样的行）——语法合法但破坏「bundle 里每个 section marker 独立成行」的可读性约定，且新增 section 时必然踩到。各补 1 字节（共 +3 字节），现在 bundle 里所有 section marker 都独立成行。行为零变化。

### 修复（v0.9.15）

- **`sidebar-match-conversation-bg` 用户实测展开页面左上角部分过一会变灰、hover 变白、移走又变灰**（v0.9.15）：用户反馈"展开页面左上角的部分，过一会就会变成灰色，我鼠标光标移动到上面的时候，又变成了白色，移走一段时间，又变成灰色"——v0.9.9/v0.9.13/v0.9.14 三层修复都只覆盖 column + 已知 `_root` 后代的直接 `background`，没考虑 DSH 侧栏作用域内 CSS 变量 `--dsw-specific-sidebar-fill` 的扩散。DSH 内部 `pI_x6G_sidebarCol` 与 `hHd-Xa_root` 都用 `background:var(--dsw-specific-sidebar-fill)`——column + inner root 直接 background 覆盖在 DSH 后续调整（cascade 重排 / HMR 重注入 / theme 异步应用 / 某些 panel / hover 层状态切换等）下可能失效，露出 sidebar-fill 的浅灰（light `#f9fafb`）/深灰（dark `#1b1b1c`）。hover 触发某些透明层覆盖时又显出 frame 的白底（`--dsw-alias-bg-base` light `#fff` / dark `#151517`）；hover 出后透明层消失又重新露出 inner root 的灰——形成"灰 → hover 白 → 移走又灰"的循环。
  - **三层兜底修法**：从根上抹掉侧栏作用域内所有 `var(--dsw-specific-sidebar-fill)` 解析结果——
    ```css
    [data-pane="sidebar"] {
      background: var(--dsw-alias-bg-base, var(--dsw-alias-bg-layer-1, #ffffff)) !important;
      --dsw-specific-sidebar-fill: transparent;
    }
    [data-pane="sidebar"] [class*="_root"] {
      background: var(--dsw-alias-bg-base, var(--dsw-alias-bg-layer-1, #ffffff)) !important;
    }
    ```
    ① 列显式 background + `!important`（v0.9.9 已存在；v0.9.15 强化）
    ② 内部 `_root` 后代 background（v0.9.13 起；v0.9.14 `$=` 改 `*=` 处理收起态 className）
    ③ `--dsw-specific-sidebar-fill: transparent` 变量级覆盖作用于整个 `[data-pane="sidebar"]` 子树——DSH 后续在此作用域内加新元素（如 panel / overlay / hover 层 / 装饰层）即使引用此变量也解析为透明，不再依赖具体选择器是否命中
  - **兼容性**：tweak id `sidebar-match-conversation-bg` / localStorage key `sidebarMatchConversationBg` / 调试 API / 类名 / ID / attribute / 设置页 UI 全部不动；只多一条 `--dsw-specific-sidebar-fill` 变量覆盖 + 列选择器显式 background + inner root 选择器强化。DSH 升级换 hash 仍命中（className 仍含 `_root` 子串；变量覆盖作用于整个作用域，新元素也被覆盖）
  - **诊断**：浏览器 DevTools inspect 侧栏区域——开启 tweak 后 `[data-pane="sidebar"]` 和其内 `_root` 后代的 computed `background-color` 解析值都应与 `[data-pane="conversation"]` 的 backgroundColor 一致；`getComputedStyle([data-pane="sidebar"]).getPropertyValue('--dsw-specific-sidebar-fill')` 应是 `transparent`；hover / 移走后侧栏任何位置不应再变回 `--dsw-specific-sidebar-fill` 的灰。控制台 `window.__dshUiTweaks.getInjectedCSS()` 返回的 CSS 仍含本 tweak 段
  - **改动文件**：`lib/client-src/25-tweaks.js` 的 sidebar-match-conversation-bg buildCSS（加 ③ `--dsw-specific-sidebar-fill: transparent` + 列显式 background + 注释同步）；`lib/client-src/20-constants.js` VERSION 0.9.14 → 0.9.15 + 头部注释加 v0.9.15 段；`lib/client-src/00-banner.js` 加 v0.9.15 banner 段；`package.json` version + description 同步；走 `npm run build:client` + `node --check lib/client.js` 语法校验

### 修复（v0.9.14）

- **`sidebar-match-conversation-bg` v0.9.13 收起态失效修复**（v0.9.14）：用户反馈"收起时的小侧边栏还是灰的原来的样子"——v0.9.13 CSS 规则 `[data-pane="sidebar"] [class$="_root"]` 在收起态失效。**根因**：DSH `dsh-client-ui-sidebar/lib/client.js` SidebarRoot.js 的 className 是 `clsx(SidebarRoot_module_css_default.root, !wide && SidebarRoot_module_css_default.collapsed, !wide && everWide.current && SidebarRoot_module_css_default.railIn, collapsed && wide && SidebarRoot_module_css_default.fading, !pointerInside && SidebarRoot_module_css_default.quietBars)`——展开态 class 字符串是 `"hHd-Xa_root"`（ends-with `_root` ✓），**收起态** class 字符串是 `"hHd-Xa_root hHd-Xa_collapsed hHd-Xa_railIn"`（可能再加 `hHd-Xa_quietBars`），末尾是 `_railIn` / `_quietBars` / `_collapsed`——`[class$="_root"]` ends-with 匹配失败，v0.9.13 在收起态选择性失效，小侧栏仍显示 `--dsw-specific-sidebar-fill`（light=#f9fafb / dark=#1b1b1c）的灰色 / 深灰。
  - **修法**：选择器 `[class$="_root"]` 改 `[class*="_root"]` contains 子串匹配——与 className 拼接顺序无关，展开 / 收起两态都命中 `_root` 子串。CSS：
    ```css
    [data-pane="sidebar"],
    [data-pane="sidebar"] [class*="_root"] {
      background:var(--dsw-alias-bg-base,var(--dsw-alias-bg-layer-1,#ffffff)) !important;
    }
    ```
  - **兼容性**：仍是 hash-independence（DSH CSS module `<hash>_<name>_root` 约定保留 `_root` 子串）——与 v0.7.3 HoverCard `[class*="_hoverContent"]` / v0.7.5 Inspect `[class*="_inspectButton"]` 同源；DSH 升级换 hash 仍命中；WorkspaceList 的 `qDHVXG_root` 也匹配但目前无 background 设置，无视觉副作用
  - **兼容性**：tweak id `sidebar-match-conversation-bg` / localStorage key `sidebarMatchConversationBg` / 调试 API / 类名 / ID / attribute / 设置页 UI 全部不动；只改 buildCSS 输出选择器的一个字符（`$` → `*`）+ 头注释；老用户开关状态保留
  - **诊断**：浏览器 DevTools inspect 侧栏 UI——收起态 className 应是 `"hHd-Xa_root hHd-Xa_collapsed hHd-Xa_railIn ..."`，`getComputedStyle([data-pane="sidebar"] [class*="_root"]).backgroundColor` 解析值应与 `[data-pane="conversation"]` 的 backgroundColor 一致；展开态同样验证。控制台 `window.__dshUiTweaks.getInjectedCSS()` 返回的 CSS 仍含本 tweak 段
  - **改动文件**：`lib/client-src/25-tweaks.js` 的 sidebar-match-conversation-bg buildCSS（`[class$="_root"]` → `[class*="_root"]` + 注释同步）；`lib/client-src/20-constants.js` VERSION 0.9.13 → 0.9.14 + 头部注释加 v0.9.14 段；`lib/client-src/00-banner.js` 加 v0.9.14 banner 段；`package.json` version + description 同步；走 `npm run build:client` + `node --check lib/client.js` 语法校验

### 修复（v0.9.13）

- **`sidebar-match-conversation-bg` v0.9.9 未生效修复**（v0.9.13）：用户反馈"侧栏背景与对话一致 开启了 但视觉上没有变化"——v0.9.9 CSS 规则 `[data-pane="sidebar"]{background:var(--dsw-alias-bg-base, ...) !important}` 只命中 DSH AppFrame 的 sidebarCol 列容器，但 DSH AppFrame 内的 `<div class="hHd-Xa_root">`（`@deepseek-ai/dsh-client-ui-sidebar` 的 SidebarRoot 组件根，`height:100%`）**也设了** `background:var(--dsw-specific-sidebar-fill)`——inner root 用 `height:100%` 完全覆盖列容器（column 是 AppFrame grid 子元素，inner 是 `flex-direction:column` 填满），column 改 background 视觉上仍被 inner 的 specific-sidebar-fill 覆盖（实际值 light=`#f9fafb` / dark=`#1b1b1c`，与对话区 `--dsw-alias-bg-base` 的 light=`#fff` / dark=`#151517` 明显不同）。**根因**：v0.9.9 author 没意识到 inner root 也设了 background——CHANGELOG v0.9.9 line 81-90 写"子元素零变化 / 只改列容器背景色"时漏掉了 column 的唯一直接子 SidebarRoot。
  - **修法（选择器扩为双层）**：
    ```css
    [data-pane="sidebar"],
    [data-pane="sidebar"] [class$="_root"] {
      background:var(--dsw-alias-bg-base,var(--dsw-alias-bg-layer-1,#ffffff)) !important;
    }
    ```
    - 列 column（v0.9.9 已命中）：保留——DSH 后续给 column 加 wrapper（DragHandle 等）时不会露出灰色边角
    - inner root（v0.9.13 新增）：实际可见的侧栏 UI 容器，必须改——两层都用 bg-base 后可见侧栏背景与对话区一致
    - 列边框 `border-right: 1px solid var(--dsw-alias-border-l1)` 保留——用户原意是"背景一致"不是"无边界"，边框分割由 border 单独承担，移除会偏离需求；如有用户后续反馈想去掉边框再单独修
    - 子元素（会话项 / 按钮 / hover 态 / active 态）零变化——仍由 DSH `--dsw-specific-sidebar-nav-item-*` 等功能性背景控制
  - **选择器策略**：`[class$="_root"]` ends-with 匹配 DSH CSS module 约定 `<hash>_<name>_root`（SidebarRoot 当前 hash=`hHd-Xa`，DSH 升级换 hash 仍命中——hash-independence 与 v0.7.3 HoverCard / v0.7.5 Inspect button 同策略）；用后代选择器（无 `>`）而非直接子选择器，是为了兼容 DSH 后续在 sidebarCol 与 SidebarRoot 之间插入包装层（如动画 / portal mount point）——直接子选择器会被切断；WorkspaceList 的 `qDHVXG_root` 也匹配但目前无 background 设置，命中无视觉副作用；若 DSH 后续给它加 background，bg-base 仍保持视觉统一
  - **兼容性**：tweak id `sidebar-match-conversation-bg` / localStorage key `sidebarMatchConversationBg` / 调试 API / 类名 / ID / attribute / 设置页 UI 全部不动；只改 buildCSS 输出的选择器列表与头注释；老用户升级后开关状态保留，开启后**侧栏可见区域**背景改为对话区同款
  - **诊断**：浏览器 DevTools inspect 侧栏 UI 区域——开启 tweak 后 `getComputedStyle([data-pane="sidebar"] > [class$="_root"]).backgroundColor` 解析值应与 `[data-pane="conversation"]` 的 backgroundColor 一致；关闭后恢复 DSH 默认 `--dsw-specific-sidebar-fill`（light=`#f9fafb` / dark=`#1b1b1c`）。控制台 `window.__dshUiTweaks.getInjectedCSS()` 返回的 CSS 仍含本 tweak 段
  - **改动文件**：`lib/client-src/25-tweaks.js` 的 sidebar-match-conversation-bg buildCSS（选择器扩为 column + `[class$="_root"]` 双命中 + 注释同步）；`lib/client-src/20-constants.js` VERSION 0.9.12 → 0.9.13 + 头部注释加 v0.9.13 段；`lib/client-src/00-banner.js` 加 v0.9.13 banner 段；`package.json` version + description 同步；走 `npm run build:client` + `node --check lib/client.js` 语法校验

### 修复（v0.9.12）

- **`simple-mode` 状态行 v0.9.10 三层 CSS reset 兜不住——执行 v0.9.10 CHANGELOG 预设的 JS 回退路径**（v0.9.12）：v0.9.10 / v0.9.11 后用户反馈两个症状——
  1. **底部 "正在思考 / 正在处理…" 还是会一闪一闪**——v0.9.10 三层 CSS reset（容器 reset + 伪元素 reset + 直接子元素 reset）杀尽了 transition / mask-image / shadow / filter / transform 等 animation 之外能产生 shimmer 的视觉动效源，但 v0.9.10 line 63 CHANGELOG [Unreleased] 已预判"如果仍漏，下一步走 JS 路径"——本次落地。两层 JS 接管：
     - **`purgeTurnStatus(turnStatus)` 新增**（`55-simple-mode.js`）：在 `attach()` 调 `findTurnStatus()` 之后、`appendChild(span)` 之前，`while (turnStatus.firstChild) turnStatus.removeChild(...)` 清空容器，用 `querySelector('[class*="turnStatusClock"]')` 找回 clock 再追加回去。DSH loader / shimmer child（包括 React mount 第一帧 CSS 还没应用时的瞬闪）一律在 JS 阶段干掉。
     - **`watchTurnStatus()` 升级**：原来观察 `el.parentNode`（`subtree:false`），DSH 替换 assistant-step 节点后 observer 变僵尸；新实现观察 `document.body` (`childList:true, subtree:true`)，mutation 触发时——
       1) 检查我们 span 是否仍挂在 current turnStatus，不是就 reattach
       2) 任何 added node（直接添加或深层嵌套）匹配 `[class*="turnStatus"]` 就**立即** purge，杀零 tick 250ms 间隔的闪援窗口（DSH 重渲立刻被拦截，不再等下一个 tick）
  2. **几次 think / 工具调用穿插后状态行 "像是首行缩进"**——DSH 在 assistant-step 节点累加后沿父链逐步加 padding-left 缩进，v0.9.10 的 `[class*="turnStatus"]{ ... }` reset 作用在容器本身不够（祖先链 padding 才能视觉上把 status 推右），CSS 补 `padding-left:0 !important` + `margin-left:0 !important` 让 status 始终贴容器左侧，`purgeTurnStatus()` 同步把 inline `style.paddingLeft / marginLeft` 归零作 DSH 通过 inline style 设 padding 时的兜底。
  - **不改 DSH 原生时钟颜色**（用户明确澄清"没有要求它变白"，原句 "应该是变成白色了" 是描述不是需求）；DSH 原生 `flex order:1 / order:2` 时间放在最右位置继续保留
  - **保留** v0.9.10 的三层 CSS 防线（容器 reset + 伪元素 reset + 直接子元素 reset + clock 防御性 reset）——JS 接管是 belt-and-suspenders，CSS 不撤
  - **兼容性**：所有 tweak id / 类名 / ID / attribute / localStorage key 全不动；新增 `purgeTurnStatus` 函数与 `watchTurnStatus` 的 body subtree 观察仅作用于已存在的 DOM 节点（find / querySelector / removeChild / appendChild 标准 API），不引入任何新 attribute / className / ID；JS 调用顺序与 DSH 自己 1s `setInterval` 更新 clock 文本不冲突（clock node 是同一个）
  - **改动文件**：`lib/client-src/55-simple-mode.js` 加 `purgeTurnStatus()` 函数 + 重写 `watchTurnStatus()` 观察 body subtree + `attach()` 里调 purgeTurnStatus；`lib/client-src/25-tweaks.js` simple-mode buildCSS 加 `padding-left:0 !important; margin-left:0 !important` + 注释同步；`lib/client-src/00-banner.js` 加 v0.9.12 banner 段；`20-constants.js` VERSION 0.9.11 → 0.9.12；`package.json` version 同步；走 `npm run build:client` + `node --check lib/client.js` 语法校验。

### 修复（v0.9.11）

- **`simple-mode` hidden block 间距过大**（v0.9.11）：用户反馈"两边的字之间的距离会特别大 但有时候会有时候不会"——大量思考 + 各种操作隐藏后，可见 user message 与 assistant response 之间的垂直间距过大（且时大时小不一致）。
  - **根因诊断**：`display:none` 在某些 layout context 下不一定让元素彻底不占布局空间——
    - **React VirtualList / react-window 风格**：每个 chat-flow item 有 fixed slot，`display:none` 不会回收 slot 高度
    - **CSS Grid `grid-template-rows: masonry` 或 auto**：grid track 可能基于 max-content 计算，hidden item 仍占 track
    - **React 给 parent 设的 inline style `min-height`** 基于 child 内容计算——child `display:none` 后 parent 的 inline `min-height` 不会被改写
    - **layout 重算时机**：间距时大时小正对应 layout 重算发生在 React 重渲时——旧消息按"已收敛 layout"渲染（间距正常），新消息边渲边 hide 时 layout 未收敛（间距偏大）
  - **修法**：在 `display:none` 基础上加防御性 layout zero——把 hidden block 的 height / min-height / max-height / margin / padding / border / outline / flex-basis / flex-grow / grid-area 全部显式归零，确保在 block / flex / grid / virtual list 任意 layout context 下都不留残余高度
  - **CSS**：
    ```css
    [data-chat-flow-kind="tool-call"],
    [data-chat-flow-kind="context"],
    [data-variant="think"],
    [data-chat-flow-kind="compaction"],
    [data-chat-flow-kind="manual-compaction"],
    [data-chat-flow-kind="model-retry"],
    [data-chat-flow-kind="turn-error"],
    [data-chat-flow-kind="turn-max-tokens"]{
      display:none !important;
      height:0 !important;
      min-height:0 !important;
      max-height:0 !important;
      margin:0 !important;
      padding:0 !important;
      border:0 !important;
      outline:0 !important;
      flex:0 0 0 !important;
      flex-basis:0 !important;
      flex-grow:0 !important;
      grid-area:auto !important
    }
    ```
  - **兼容性**：纯 CSS 加固，所有类名 / ID / attribute / localStorage key 不动；`display:none` 之外的所有新规则只是把"display:none 没杀干净的残余布局"显式归零，对 DSH 正常路径（无 simple-mode）零影响
  - **诊断**：DevTools inspect 任一 hidden block（如 `[data-variant="think"]`）的 Computed 面板——`display` 应是 `none`、`height` / `min-height` / `max-height` / `margin` / `padding` / `border` 全部应是 `0px`、`flex-basis` 应是 `0px`
  - **回退路径**：如果 v0.9.11 防御性 layout zero 仍不够（比如 DSH 用 JS 计算 inline style 的 min-height 而不是 CSS），下一步走 JS 路径——在 simple-mode 启用时遍历 hidden block 的所有祖先节点，用 `element.style.minHeight = '0'` 显式覆盖 inline style
  - **改动文件**：`lib/client-src/25-tweaks.js` 的 simple-mode buildCSS（隐藏规则合并成一条 + 加 12 条防御性规则）；`lib/client-src/00-banner.js` 加 v0.9.11 banner 段；`20-constants.js` VERSION 0.9.10 → 0.9.11；`package.json` version 同步；走 `npm run build:client` + `node --check lib/client.js` 语法校验

### 修复（v0.9.10）

- **`simple-mode` 状态行 v0.9.8 reset 不彻底**（v0.9.10）：用户反馈"底部的 正在思考 还是会一闪一闪的 而且位置依赖（最左侧不闪，右移一点开始闪）"——v0.9.8 整容器接管只 reset 了 `animation` / `background` / `background-clip` 三个属性，没覆盖 DSH 可能用 animation 之外方式做的 shimmer。**根因诊断**：
  - **transition + mask-image linear-gradient 模式**：mask 是 110deg 渐变（透明 → 实 → 透明），transition 让 `mask-position` 从 0% 移到 100%——在文字形状里形成移动的"光带"。`animation:none` 杀不掉这种 shimmer，因为是 transition 驱动的（不是 keyframes）
  - **新加 child 元素做动画**：DSH 完全可能在容器里多塞 `<div class="turnStatusLoader">` 之类做动画——容器 reset 不影响嵌套子元素
  - **::before / ::after 伪元素**：容器 `animation:none` 不传递到伪元素的具体 background / 自身 animation
  - **位置依赖的合理解释**：shimmer / loader 区间在容器内某段，文字在容器内某位置——两者重叠时 shimmer 可见，不重叠时不闪
- **三层防线**（纯 CSS 加固，不动类名 / ID / attribute / localStorage key）：
  - **第 1 层**：容器 `[class*="turnStatus"]` reset 升级——在 v0.9.8 基础上加 `transition:none` / `text-shadow:none` / `box-shadow:none` / `filter:none` / `-webkit-mask-image:none` / `mask-image:none` / `-webkit-mask-*` 全套 / `transform:none` / `text-indent:0` / `letter-spacing:normal` / `word-spacing:normal` / `text-decoration:none` / `overflow:hidden`——杀尽"非 animation 但能产生 shimmer 视觉效果"的属性
  - **第 2 层**：伪元素 `[class*="turnStatus"]::before, ::after` 显式 `display:none` + `content:none` + 详细 background / mask reset——DSH 经常在伪元素上放 spinner / shimmer 装饰
  - **第 3 层**：直接子元素 `[class*="turnStatus"] > *:not(.dsh-ui-tweaks-status):not([class*="turnStatusClock"])` 全部 `display:none !important`——任何 DSH 新加的 child loader / shimmer 一律干掉
  - **clock 防御性 reset**：`[class*="turnStatusClock"]` 加 `animation:none` / `transition:none` / `text-shadow:none` / `box-shadow:none` / `filter:none` / `-webkit-mask-image:none` / `mask-image:none`——DSH clock 自己可能有 shadow / filter / mask 等 animation 之外的视觉效果
- **保留**：v0.9.7 引入的 `transition:color .4s ease`（活动色平滑过渡）；`visibility:visible !important`（v0.7.1 起的祖先 display:none 兜底）。
- **兼容性**：所有 tweak id / 类名 / ID / attribute / localStorage key 全不动；纯 CSS 加固，浏览器中观察到的视觉差异（DSH 原生 shimmer / loader 装饰全部消失）。
- **诊断**：浏览器 DevTools inspect `[class*="turnStatus"]` 元素 Computed 面板——`animation` / `transition` / `background-image` / `-webkit-mask-image` / `box-shadow` / `text-shadow` / `filter` / `transform` 全部应是 `none` / `initial`；`overflow` 应是 `hidden`；伪元素 `display:none`；直接子元素（除 span 和 clock）`display:none`。
- **改动文件**：`lib/client-src/25-tweaks.js` 的 simple-mode buildCSS（+~1.5 KB CSS 含 25+ 行注释）；`lib/client-src/00-banner.js` 加 v0.9.10 banner 段；`20-constants.js` VERSION 0.9.9 → 0.9.10；`package.json` version 同步；走 `npm run build:client` + `node --check lib/client.js` 语法校验。
- **回退路径**：如果 v0.9.10 三层防线仍漏掉某个 DSH 视觉效果，下一步走 JS 路径——`createSimpleModeStatusController` 的 `attach()` 里在 append 我们 span 前先 `while (turnStatus.firstChild) turnStatus.removeChild(turnStatus.firstChild);` 清空容器再 append（保留 clock 用 querySelector 找回再追加）。

### 新增（v0.9.9）

- **`sidebar-match-conversation-bg` 侧栏背景与对话一致**（v0.9.9）：DSH 默认左侧栏（展示会话列表的区域，`data-pane="sidebar"`）有独立背景色，与对话区（`data-pane="conversation"`）的 `--dsw-alias-bg-base` 不同——视觉上有明显的边界分割。开启后把侧栏列容器背景设为对话区同款，让两个区域在背景色上融合。
  - **CSS 一条规则**：`[data-pane="sidebar"]{background:var(--dsw-alias-bg-base, var(--dsw-alias-bg-layer-1, #ffffff)) !important}`——三层 fallback 链：
    - `--dsw-alias-bg-base`（DSH 主背景，主路径）
    - `--dsw-alias-bg-layer-1`（DSH 卡片背景，主题没定义 bg-base 时退化）
    - `#ffffff`（硬值白兜底）
  - **DSH bg-base 的来源证据**：
    - `dsh-ssh` 的 panel（`mL8Uca_panel`）用 `background:var(--dsw-alias-bg-base)` 来"无缝融入"对话区
    - `dsh-client-ui-skin-center` #712 注释明确 AppFrame frame + conversation root + details root 是"shell surfaces"共用 bg-base，sidebar 不在这个列表里——所以侧栏有独立视觉背景
  - **子元素零变化**：会话项 / 按钮 / hover 态保持原样——`--dsw-specific-sidebar-nav-item-hover` / `--dsw-specific-sidebar-nav-item-active` 等功能性背景不动。只改列容器背景色，会话列表的交互行为完全不变。
  - **默认 OFF**：v0.9.9 新引入，倾向保守——老用户升级后视觉不变，需要在设置页显式开启。与 v0.9.6 disclosure-end-collapse 的"默认 ON"反着来（后者修复 UX 痛点必开，前者是视觉偏好可选）。
  - **新增 tweak 项**：`{ id: "sidebar-match-conversation-bg", name: "侧栏背景与对话一致", configKeys: { enabled: "sidebarMatchConversationBg", value: "sidebarMatchConversationBg" } }`——localStorage key `sidebarMatchConversationBg`
  - **兼容性**：不动现有任何 CSS / JS / 持久化字段 / 调试 API。DSH 升级 CSS Module hash 改了 `[data-pane="sidebar"]` 选择器仍命中（attribute selector 不依赖 hash）。
  - **诊断**：浏览器 DevTools inspect `[data-pane="sidebar"]` 元素的 Computed `background-color`——开启后应是 `var(--dsw-alias-bg-base)` 解析后的颜色，与 `[data-pane="conversation"]` 的 background-color 一致；关闭后恢复 DSH 默认侧栏背景。
  - **测试/构建**：`lib/client-src/25-tweaks.js` 的 TWEAKS 数组新增一项（buildCSS 输出 ~280 B CSS）；`lib/client-src/00-banner.js` 加 v0.9.9 banner 段；`20-constants.js` VERSION 字符串 0.9.8 → 0.9.9；`package.json` version 同步；走 `npm run build:client` + `node --check lib/client.js` 语法校验。

### 修复（v0.9.8）

- **`simple-mode` 状态行接管 DSH 原生 turnStatus 视觉呈现**（v0.9.8）：解决 v0.9.7 后三个用户反馈：（1）「正在处理」还在闪（2）时间想出现在后面（3）还是比原生高一点点。**根因诊断**：v0.9.7 只撤了我们自己 `::before` 上的 `@keyframes dsh-status-pulse`；用户看到的「正在处理」不是「正在处理…」我们的 fallback 文本，而是 DSH 原生 TurnStatus 组件（`dsh-client-ui-conversation/lib/client.js:5591`）的 `linear-gradient + background-clip:text + animation:1.8s linear infinite Md3f7G_dsh-turn-status-shimmer` 做的 shimmer effect——gradient 在 DSH "Deep diving..." 文字形状里平移。我们的 `<span class="dsh-ui-tweaks-status">` 是 appendChild 到 `<div class="Md3f7G_turnStatus">` 内的，shimmer 渲染整容器，包括 DSH 原生文字 + 我们 append 的 span，看起来整个 status 在闪。**整容器接管**（在 `.dsh-ui-tweaks-status` 之前加 `[class*="turnStatus"]{ ... }` 块）：
  - **杀 shimmer**：`animation:none !important` + `background:none !important` + `background-clip:border-box !important` + `-webkit-background-clip:border-box !important` + `-webkit-text-fill-color:initial !important` ——DSH 父级这条 CSS 让文字用 gradient 填充的整套招全 reset
  - **抹 DSH "Deep diving..." 文字节点**：CSS 选不中 text 节点，靠父级 `color:transparent !important` + `font-size:0 !important`，子级 `.dsh-ui-tweaks-status` 和 `[class*="turnStatusClock"]` 都显式 `font-size:13px !important` override 回来
  - **容器 26px → 18px**：之前我们 18px 在 DSH 原生 26px 容器居中，垂直空白多——`height:18px !important` 改写对齐；用户反馈"还是比原生高一点点"指的就是这个 26px 容器 + 18px 内容居中的视觉错位
  - **时间出现在后面**：DSH 自带 `.turnStatusClock`（每 1s setInterval 自动更新，15s 后才显示——DSH 原生 `showClock = elapsedMs >= 15e3` 不改）用 flex `order:2` 重排到我们的 span（`order:1`）后面——纯 CSS、无新 DOM、无新 JS 时间维护
  - **8 类活动色追加 `-webkit-text-fill-color` 同色 override**：DSH 父级 `-webkit-text-fill-color:initial` 经测试不传递到子级 `.dsh-ui-tweaks-status`，得在每条 `[data-dsh-activity="..."]` 加 `-webkit-text-fill-color:... !important`（与 `color` 同色）才能真正显示活动色
  - `.dsh-ui-tweaks-status` 自身：`line-height:18px` + `height:18px` + `margin-left:0`（之前 10px 是和 DSH "Deep diving..." 之间留空，现在 DSH 文字抹掉了不需要空隙）+ `order:1` + `transition:color .4s ease, -webkit-text-fill-color .4s ease`（活动色平滑过渡，v0.9.7 沿用的"宁可切换慢一点"）
  - **最终视觉**：`[● 正在查找...  5s]`（静态圆点 + 8 类活动色文字 + DSH 自动更新时钟），无任何动画、无 shimmer、18px 高度、时间在后面
  - **兼容性**：`.dsh-ui-tweaks-status` 类名 / `dsh-ui-tweaks-status-row` ID / `[data-dsh-activity]` attr / `localStorage simpleModeEnabled` / 调试 API `window.__dshUiTweaks` / `[data-chat-flow-kind="tool-call"]{display:none}` 等隐藏规则——全部不动。仅在浏览器中观察到的视觉差异（DSH shimmer 消失 + 时间位置重排 + 容器高度匹配）。DSH 升级 CSS Module hash 改了 `[class*="turnStatus"]` / `[class*="turnStatusClock"]` 仍 substring 命中。
  - **测试/构建**：`lib/client-src/25-tweaks.js` 的 simple-mode buildCSS 加 `[class*="turnStatus"]` 块 + `[class*="turnStatusClock"]` 块 + 改 `.dsh-ui-tweaks-status` + 8 类活动色加 `-webkit-text-fill-color`；`lib/client-src/00-banner.js` + `20-constants.js` VERSION + CHANGELOG + package.json 同步；走 `npm run build:client` + `node --check lib/client.js` 语法校验
  - **诊断**：浏览器控制台 `document.querySelector('.Md3f7G_turnStatus').style.animation` 应是 `none`（带 important 来源）；`getComputedStyle(.turnStatusClock).order` 若是 2 则生效（DSH 内联样式 / 父级 flex）；`getComputedStyle(.dsh-ui-tweaks-status).order` 若是 1 则生效

### 优化（v0.9.7）

- **`simple-mode` 状态行两轮「去装饰」**（v0.9.7）：用户对 v0.9.3 美术度升级的两层叠加装饰（圆角胶囊灰底 + 呼吸点闪烁）都反馈过剩——前者「简洁模式不需要 badge 铺底」，后者「一闪一闪比活动切换更抢戏，宁可切换慢也不能接受脉动」。
  - **第 1 轮——去圆角胶囊灰底**：v0.9.3 给 `.dsh-ui-tweaks-status` 加的 `background:color-mix(in srgb, currentColor 8%, transparent)` 在 `read` 类（grep / glob「正在查找…」着色 `#475569`）这种基础色偏中性的活动下，8% tint 出图是明显的灰色色块；与「简洁模式」初衷冲突。撤掉三件套：`.dsh-ui-tweaks-status` 的 `background:color-mix(...)` + `border-radius:999px` + 水平 padding（`padding:0 10px 0 8px` → `padding:0`），圆角胶囊外壳彻底消失。
  - **第 2 轮——去呼吸脉动动画**：v0.9.3 给 `.dsh-ui-tweaks-status::before` 加的 `@keyframes dsh-status-pulse`（2.4s 周期 opacity .6↔.9 循环）在简单思考 → 工具调用 → 工具调用 → ... 几秒钟的活动期内会重复跳多次，pulse 的「1-2 秒一次明暗交替」与活动切换的「文字内容/色变化」重叠叠加，用户报告视觉上是「一闪一闪」节奏感强的闪烁，比「现在还在跑」的信号更醒目——反客为主。用户表态宁可切换不那么准确、过渡缓慢，也不能接受脉动。撤掉 `@keyframes dsh-status-pulse` + `::before` 上的 `animation` + 配套 `@media (prefers-reduced-motion:reduce)` 媒体查询规则（animation 没了这条规则就剩空壳）。圆点保留为静态 6×6（颜色继承 `currentColor`、opacity 0.7、无 animation/transition）；活动切换的色变靠 `.dsh-ui-tweaks-status` 新增的 `transition:color .4s ease`——`text` + `::before dot` 都跟着平滑过渡。`.4s` 比 2.4s 慢切换但仅在变化瞬间，慢切换比持续脉动更不刺眼。
  - **最终形态**：`[● 正在查找…]` 极简文字行（静态圆点 + 8 类活动色 text + `margin-left:10px`），与 DSH 原生 turnStatus 文案（如「Deep diving...」）同层内联——更像带状态前缀的一条普通文字而非 badge。
  - **兼容性**：`.dsh-ui-tweaks-status` 类名 / `dsh-ui-tweaks-status-row` ID / `[data-dsh-activity]` attr / `[data-chat-flow-kind="tool-call"]{display:none}` 等隐藏规则 / `localStorage simpleModeEnabled` / 调试 API `window.__dshUiTweaks` 全不动；DSH 主题颜色变量缺失时硬值 fallback 不动；状态行总高仍 18px（`line-height:18px` 不变，与 DSH 原生 turnStatus 文案同高对齐）。仅在浏览器中观察到的视觉差异（灰底消失 + 脉动消失 + 颜色切换平滑）。
  - **测试/构建**：`lib/client-src/25-tweaks.js` 的 simple-mode buildCSS 注释 + CSS 同步更新；`@keyframes` 与 `prefers-reduced-motion` 规则直接删除（不留死代码）；走 `npm run build:client`（无需重测，CSS-only） + `node --check lib/client.js` 语法校验
  - **诊断**：`window.__dshUiTweaks.getInjectedCSS()` 返回的 CSS 仍命中 `.dsh-ui-tweaks-status` 选择器；用户在浏览器控制台跑 `document.querySelector('.dsh-ui-tweaks-status')` 检查 `getComputedStyle(.background)` 应为 `rgba(0, 0, 0, 0)` 而非 `color-mix(...)`；`getComputedStyle(.animation)` / `getComputedStyle(::before, '.animation')` 应为 `none`；`getComputedStyle(.transition)` 应含 `color 0.4s ease`

### 新增（v0.9.6）

- **`disclosure-end-collapse` 折叠块末尾收起按钮**（v0.9.6）：DSH 用 `DisclosureRow` 渲染三类可展开块——`ReasoningRow`（Think，模型推理块）/ `GenericCommandCard`（工具调用输出，bash / edit / read / grep 等多行输出时 body 才会渲染）/ `ContextInjectionRow`（上下文注入）。全部 `expandOnRowClick: true`——点击头部行切换展开，但展开后想收起必须滚回头部再点。长 Think 内容（几 KB reasoning）滚回非常烦。
  - **解法**：JS `MutationObserver` 巡检 body 元素（仅当 `expanded === true` 时 body 才会出现在 DOM）给每个 body 末尾注入 wrapper div + "收起 ▴" 按钮。点击按钮 → `e.preventDefault() + e.stopPropagation()` → 找 body 父元素里 className 含 `_row` 的兄弟（DisclosureRow 标准布局 row 在前 body 在后），调 `.click()` 触发 DSH React `onToggle` → `setExpanded(false)` → row 折叠，body 与按钮一起被 React unmount，无需手动清理
  - **DOM 选择器**（`20-constants.js` 的 `DISCLOSURE_BODY_SELECTORS` 单点拼接，三类变体一处维护）：`[data-variant="think"] [class*="thinkBody"]` + `[data-variant="others"] [class*="_body"]` + `[class*="_root"][data-open] [class*="_body"]`。substring match 不依赖 DSH CSS module hash，DSH 升级换 hash 仍命中
  - **按钮 CSS**：wrapper `display:block` 强制独占一行（不被 pre-wrap 文本内联吃掉）；按钮 chip 形态（边框 + 圆角 + hover 背景），`var(--dsw-alias-*)` fallback 链防止主题切到没有这些变量时不可见。inline 位置由各 body 自身的 padding-left / margin-left 决定（Think 22px / Command 16px / Context 22px），无需按变体分别处理 indent
  - **生命周期**：80ms throttle 同 `tab-hider` / `hover-card-hider` 节奏；首次 `start()` 立即跑一次 `scanBodies()`，已展开的 block 立刻有按钮；`stop()` 时防御性清理所有已注入按钮（正常路径下 React unmount 会带走）
  - **默认 ON**：本 tweak v0.9.6 新引入，无 backward compat 顾虑；老用户升级后自动启用，若不需要可在设置页关闭
  - **新增 tweak 项**：`{ id: "disclosure-end-collapse", name: "展开块末尾收起按钮", configKeys: { enabled: "disclosureEndCollapse", value: "disclosureEndCollapse" } }`——localStorage key `disclosureEndCollapse`
  - **新增 section 文件**：`lib/client-src/67-disclosure-end-collapse.js`（`createDisclosureEndCollapseController` 工厂 + 4 个纯函数 `findRowForBody` / `injectCollapseButton` / `scanBodies` / `removeAllInjectedButtons`）
  - **诊断**：`window.__dshUiTweaks.disclosureEndCollapse()` 返回 `{ running: bool }`
  - **不修改 DSH 任何代码**——纯附加层；DSH 升级 DisclosureRow 内部结构变化（CSS module hash 变了 / rowClassName 命名规则变了）也不影响工作：button 通过 substring match `_row` 找 row，DSH CSS module hash 一直沿用 `_<name>_row` 约定，context 的默认 rowClassName 也含 `_row`

### 修复

- **`simple-mode` 状态行工具名识别修复**（v0.9.5）：v0.9.3 美术度升级（8 类活动语义色：think 蓝 / read 中性 / write 琥珀 / bash 紫 / task 青 / plan 绿 / goal 粉 / git 石板）**从发布起就未生效**——所有活动都 fallback 到 "正在处理…" / generic 灰。两处根因同时修：
  - **`simplePickToolNameFromDom` 错属性**：之前查 `[data-tool-name]`，但 DSH `dsh-client-ui-tool/lib/client.js` ToolRow 实际渲染的是 `[data-tool] = toolName`（`"data-tool": toolName`）。v0.9.3 升级时命名错误，从 v0.9.3 commit `03a71c1` 起 simplePickToolNameFromDom 返回 null 100%，simpleActivityText(null) 永远 "正在处理…"。修法：主路径改为 `[data-tool]`；保留 `[data-name]` / `[class*="toolName"]` / `[class*="toolLabel"]` 作 fallback（与 v0.7.3 hide-sidebar-tooltip 的 substring 策略一致——DSH 升级切属性约定仍能命中）。
  - **think / reasoning block 不在 tool-call 容器里**：模型思考时，DSH 渲染 `<div data-chat-flow-kind="assistant-step">` 内含 `<div data-variant="think" data-state="running">`（`dsh-client-ui-conversation/lib/client.js` ReasoningRow）——即使修了 data-tool 也识别不到。新增 `simpleIsThinkingFromDom()` 单独探测 `[data-state="running"]` 的 think 块；新增 `simplePickActivityName()` 统一入口——think 优先 → tool-call → fallback（generic）。tick() 改用 `simplePickActivityName()`。
  - **`simpleActivityCategory` / `simpleActivityText` 扩展**：覆盖 DSH 全部内置工具——`bash_persistent` / `pwsh_persistent` / `read_image` 归读 / 写 / shell；`todo_write` 取代 v0.9.3 错写的 `todo`（DSH 实际是 `todo_write`）；`get_goal` / `create_goal` / `update_goal` 归 goal；`subagent` / `workflow` / `ralph` / `ask_user_question` / `job_output` / `job_list` / `job_kill` / `send_message` / `interrupt_agent` / `list_agents` / `skill` 归 task；`cordis_*` 走 prefix 匹配（DSH 注册名 `cordis_define` / `cordis_run` / `cordis_stop` / `cordis_undefine` / `cordis_package_inspect` / `cordis_runtime_inspect`）。`run_code` 仍归 bash（执行类）——为不引入第 9 色。
  - **不变**：`.dsh-ui-tweaks-status` 类名 / `dsh-ui-tweaks-status-row` ID / `[data-dsh-activity]` attr / CSS 8 类活动色 / lastKey 节流 / `visibility:visible !important` 兜底 / `prefers-reduced-motion` 关呼吸——纯逻辑修复，UI 形态不变
  - **验证**：浏览器控制台 `window.__dshUiTweaks.simpleController`（v0.9.5 起的调试 API，如未暴露调 `getState()` 看 `lastActivity` 字段确认 tick() 切换）—— bash / read / write / edit / think 时分别显示对应色与文案

### 修复

- **`first-message-jump` step-by-step 上一条 / 下一条 跳过 hidden row**（v0.9.4）：v0.9.3 之前 `jumpFindPrevUserRow` / `jumpFindNextUserRow` 拿到 `topVisible` 的 DOM 索引后直接返回 `rows[i-1]` / `rows[i+1]`，**没有再检查目标行是否实际可见**。当 simple-mode（默认 ON）把会话顶部的 compaction 块 `display:none` 隐藏时，里面的旧 user 行（rows[0..K-1]）仍然在 DOM 里、`jumpAllUserRows` 仍会返回——而 `jumpFindTopVisibleUserRow` 已经正确跳过了 height<=0 的行，所以锚点（topVisible）通常是 rows[K]。但再点一次"上一条"，`jumpFindPrevUserRow` 直接返回 rows[K-1]（hidden 的旧 compaction user 行），`jumpToPrev` 滚到了一个 `height=0` 的位置 → 用户看不到任何视觉变化，按钮看起来"卡死"在该行，再点也无反应（直到下次 compact 边界变化或 simple-mode 切换）。同样的问题在 `jumpFindNextUserRow`（罕见但若 hidden 行不在顶部而是夹在中间会触发）。修法：拿到 topVisible 索引后，prev / next 各自向前 / 向后找第一个 `getBoundingClientRect().height > 0` 的 row；找不到就返回 null（与"上一条 step 到边界后按钮看似还在但 Shift+点击仍能直达第一行"的语义一致——v0.9.2 可见性放宽后的视觉提示不变）。区别于 v0.9.2 的 Shift+点击用 `jumpIsRowInCompaction` 沿父链检查 `data-chat-flow-kind` attribute：v0.9.4 用 DOM 渲染高度（`getBoundingClientRect().height > 0`）做"可见性"判断，更通用——simple-mode 隐藏、自定义 CSS 隐藏等任何 `display:none` 的 user 行都会跳过；simple-mode OFF 时所有行可见，行为不变（compaction 行仍可逐条 step 进去）。

### 优化（v0.9.3）

- **`simple-mode` 状态行美术度升级**（v0.9.3）：三轴叠加，单一设计语言——
  - **A) Pill 化**（圆角胶囊）：`padding:3px 10px 3px 8px` + `border-radius:999px` + `background:color-mix(in srgb, currentColor 8%, transparent)`——取代 v0.9.2 的裸灰文字，"飘字" 变 "状态徽章"，背景跟当前活动色淡出不抢戏
  - **B) 呼吸点**：`::before` 6px 圆点 + `@keyframes dsh-status-pulse` 1.6s 透明度+缩放循环，"现在还活着" 的活性信号。`@media (prefers-reduced-motion: reduce)` 自动关掉动画（动效敏感用户友好，圆点静态保留仍是 chip 形态）
  - **C) 语义色**：JS 在 `tick()` 给状态 span `setAttribute(SIMPLE_STATUS_ACTIVITY_ATTR, category)`，CSS 8 条 `[data-dsh-activity="..."]` 规则按类目着色——点继承 `currentColor`，单一着色真相源：
    - `think`（思辨）=#2563eb 蓝 / `read`（输入）=#475569 中性 / `write`（变更）=#d97706 琥珀
    - `bash`（执行）=#7c3aed 紫 / `task`（调度）=#0891b2 青 / `plan`（计划）=#059669 绿
    - `goal`（跟踪）=#db2777 粉 / `git`（版本）=#64748b 石板 / `generic`（兜底）=DSH 三级灰
  - **性能**：`tick()` 用 `lastKey = category + "\u0000" + text` 合并去重——text 或 category 任一变化才写 DOM（保持 v0.7.1 起的 `lastText` 节流效果，250 ms 轮询 × React reconciler 触发频率不变）
  - **兼容**：`.dsh-ui-tweaks-status` 类名 + `dsh-ui-tweaks-status-row` ID 不动（调试 API / 验证脚本仍命中）；localStorage `simpleModeEnabled` key 不动（老用户开关状态保留）；`visibility:visible !important` 兜底保留（防止被 simple-mode 隐藏的祖先节点带连累）；DSH 主题颜色变量缺失时硬值 fallback
  - **改动文件**：`25-tweaks.js` 的 simple-mode buildCSS（+1.5 KB CSS）+ `55-simple-mode.js` 加 `simpleActivityCategory(name)` + tick() 改 lastKey 合并去重（+400 B JS）+ `20-constants.js` 加 `SIMPLE_STATUS_ACTIVITY_ATTR` 常量 1 行（+50 B）
  - **首版问题**（见下方 hotfix 段）：v0.9.3 首版用户反馈「一闪一闪 + 高度会变 + 跟原生 Deep diving... 高度不统一」——`padding:3px 10px 3px 8px` 让总高 24px 高于 DSH 原生 turnStatus 的 18px；`scale(.85↔1)` + `opacity(.35↔.95)` + 1.6s 周期 + `transition: background-color/color .25s` 四层动画叠加视觉闪烁。版本号未 bump，作为同版本 hotfix 修复。

### 修复（v0.9.3 hotfix）

- **`simple-mode` 状态行闪烁 + 高度膨胀修复**（v0.9.3 hotfix，版本号不变）：v0.9.3 首版用户反馈「一闪一闪 + 高度会变 + 跟原生 Deep diving... 高度不统一」。三处根因同时修复（CSS 集中在 `25-tweaks.js` 的 simple-mode buildCSS）：
  - **高度对齐 DSH 原生 turnStatus**：`padding:3px 10px 3px 8px` → `padding:0 10px 0 8px`（仅水平 padding）——总高严格等于 `line-height:18px`，与 DSH 原生「Deep diving...」等 turnStatus 文案严格同高，不再"高度膨胀"
  - **去掉几何抖动**：删除 `@keyframes` 里的 `transform:scale(.85↔1)`——scale 让圆点几何尺寸变化（从 5.1px 涨到 6px），与字体稳定尺寸冲突，看上去像"在抖"
  - **去掉颜色过渡闪烁**：删除 `transition:background-color .25s ease,color .25s ease`——color 切换（如 think→bash）时不再有 250ms 颜色过渡闪烁
  - **减弱呼吸幅度**：opacity 范围 `.35↔.95` → `.6↔.9`（变化幅度缩小到 30%，不再算"闪烁"）
  - **减慢呼吸周期**：1.6s → 2.4s（柔和的"心跳节奏"，不抢戏）
  - **保留**：`::before` 圆点 + `@keyframes dsh-status-pulse` + 8 类活动语义色 + pill 形态 + `prefers-reduced-motion` 兜底
  - **版本号不变**：本次为同版本内 hotfix——v0.9.3 还没发布（commit `03a71c1` 未推送），所有 v0.9.3 内容（视觉升级 + 闪烁/高度修复）整体一起作为 v0.9.3 发布

### 修复

- **`first-message-jump` Shift+点击跳过 compaction 块直达当前会话第一条**（v0.9.2）：v0.9.1 的 `jumpFindFirstUserRow` 返回 DOM 顺序的第一条 user 行——若对话顶部有 compact 摘要块（`data-chat-flow-kind="compaction"` / `"manual-compaction"`），里面的旧 user 行会被算成"第一条"，Shift+点击实际落到的是 compact 块下方的某条 user 行（不是当前会话起点）。新增 `jumpIsRowInCompaction(row)` 沿父链检查 `data-chat-flow-kind="compaction"` / `"manual-compaction"` / `"context"` 容器，跳过其中的 user 行。新增 `jumpFindFirstRealUserRow(port)` 作为 Shift+点击的目标；`jumpFindFirstUserRow` 保留作为内部锚点（v0.9.1 行为）。

- **`first-message-jump` 短会话（2 条 user 行）底部 TodoList / 进度卡片出现时按钮不显示**（v0.9.2）：v0.9.1 用 `target !== null` 判断可见性——`topVisible === firstRow` 时（短会话底部 + firstRow 还在视口顶部 + 用户以为自己在底部）`target=null` → 按钮直接不显示（用户反馈"老问题"）。放宽为 `rows.length >= 2`：只要有 2 条以上 user 行按钮就显示（即使已在顶部 user 行），Shift+点击仍能到最顶。

### 新增（v0.9.1）

- **`first-message-jump` step-by-step 上数第二条卡住 bug 修复**（v0.9.1）：v0.9.0 用 `lastVisible`（视口内最底部可见 user 行）作为锚点——当 rows[1] 已在视口顶部但 rows[2..N] 仍可见时，`lastVisible` 始终是 rows[N] → `target` 始终是 rows[N-1] → 点击不前进 → 死循环（按钮永不隐藏、永远到不了 rows[0]）。改用 `topVisible`（视口内最顶部可见 user 行）作为锚点后：`topVisible = rows[1]` 时 `target = rows[0]`，点击滚到 rows[0] 后 `topVisible = rows[0]` → `target = null` → 按钮正确隐藏。

### 新增

- **`first-message-jump` Shift+单击 = 一键回到最早**（v0.9.1）：单击仍是 step-by-step 上一条；按住 Shift 再单击 = 一键到最早一条 user 行（恢复 v0.8.0 的「一键回到最早」语义，但用 Shift 修饰与 step-by-step 共存）。title 属性增加 `（Shift+点击 = 回到最早）` 提示。

- **`first-message-jump` 原生「回到底部」按钮同步改为「单击下一条 / Shift+单击 一键到底」**（v0.9.1）：两个按钮都用「单击 step / Shift+单击 极限」的对称模式。
  - 原生按钮单击：从 v0.9.0 / v0.8.0 的"一键到底"改为"下一条 user 行"（`topVisible → next`）
  - 原生按钮 Shift+单击：一键到底（DSH 原生 click handler 正常跑就行）
  - 实现：capture-phase document click listener（`jumpOnNativeClick`），命中 `aria-label="回到底部"` / `"Back to bottom"` 时按 `shiftKey` 分发——`shiftKey=true` 不 preventDefault（让 DSH 原生 handler 跑），`shiftKey=false` preventDefault + stopImmediatePropagation 后调 `jumpToNext()`

- **`first-message-jump` 诊断增强**（v0.9.1）：`getState()` 返回字段增加 `topVisibleUserRow` / `nextUserRow` / `nativeHooked`；旧锚点 `lastVisibleUserRow` 保留作对照（便于调试 v0.9.0 死循环场景）

### 新增（v0.9.0）

- **`first-message-jump` 单向上导航**（v0.9.0）：按钮 = "上一条我发的消息"——点击跳到当前视口内最底部可见 user 消息的上一条（DOM 顺序），连续点击可一路向上导航直到最早一条 user 消息（此时按钮自动隐藏）。
  - 视口内**无** user 行（用户在对话上方空白区 / 刚开页面）→ 点击跳到最后一条作为入口
  - 视口内最底部可见 user 行 = firstRow → target = null → 按钮自动隐藏（已无路可上）
  - 仅一条 user 行 → 跳过去后按钮隐藏（firstRow === lastVisible）
  - 按钮 DOM / 位置 / 尺寸 / 样式 / ID / `[data-dsh-ui-tweaks-jump]` CSS 选择器全部不变，**保持按钮的整洁**
  - SVG 固定 ▲ 朝上，aria-label / title 固定为 `上一条我发的消息`（不再 mode 翻面）
  - localStorage key `firstMessageJump` 不动，老用户开关状态保留；tweak id `first-message-jump` 保留向后兼容；tweak name 改为 `上一条我发的消息按钮`
  - 常量精简：删 `JUMP_MODE_FIRST` / `JUMP_MODE_LAST` / `JUMP_LABEL_FIRST` / `JUMP_LABEL_LAST` / `JUMP_SVG_LAST` / `JUMP_NEAR_TOP_PX`；`JUMP_SVG_FIRST` 改名为 `JUMP_SVG_UP`；`JUMP_LABEL_FIRST` 合并为 `JUMP_LABEL`
  - 新增 `jumpAllUserRows`（静态数组封装，避免 NodeList live 引发的迭代错位）/ `jumpFindLastVisibleUserRow`（与 viewport rect 真相交判定）/ `jumpFindPrevUserRow`（统一计算 target）；`jumpShouldShow` / `jumpComputeState` 删除，判定完全交给 `target = jumpFindPrevUserRow()` 是否为 null
  - `jumpToFirst` 改名为 `jumpToPrev`；`jumpApplyMode` 删除（不再需要 mode 翻面）；`getState()` 诊断快照返回 `{ totalUserRows, firstUserRow, lastUserRow, lastVisibleUserRow, targetRow, scrollTop, visible, drawerOpen, ... }`

### 新增（v0.8.0）

- **`first-message-jump`**（回到最早消息按钮）：对话区右下角（输入框上方）新增「回到最早消息」悬浮按钮——点击把当前会话最早一条 user 消息（`[data-chat-flow-kind="user"]` 第一行）滚到滚动区顶部，长会话里快速回看最初发的需求，不用一屏屏往上翻。纯 JS DOM 探测（`[data-conversation-scroll]` 滚动容器 + `[data-composer-seat]` 输入框），不依赖 DSH CSS module hash；只在最早消息不在当前视口内时显示，右侧抽屉打开时自动隐藏；视觉对齐 DSH 自带「回到底部」按钮。新增 `createFirstMessageJumpController`（`lib/client-src/68-first-message-jump.js`），诊断可从 `window.__dshUiTweaks.firstMessageJump()` 查看。

- **`hide-chat-tab`**（隐藏"对话"标签）：和 `hide-trajectory-tab` 配套——两个标签都隐藏后 tablist 视觉消失。复用通用 `createTabHider(opts)` 工厂（v0.7.2 重构）。如果当前不在对话视图（比如手动切到轨迹后才开启），程序自动 click 切回。

### 修复

- **first-message-jump 跟随底部任务条（input.dock 任务/进度条）出现/消失重定位**：任务条长在输入区组件里，出现时输入区变高（--dsh-composer-height 变大）。原实现在输入区高度变化后仍复用旧的原生按钮位置，按钮停在任务条后面被盖住 = 失效。现在 composer 高度变化（jumpUpdate 跟踪 + ResizeObserver 双保险）会清掉记忆并按新高度重算，按钮始终悬在任务条上方；锚定路径天然跟随。

- **first-message-jump 水平位置改量 DOM**：兜底不再靠 --dsh-chat-content-width / padding-right 公式推算，而是直接量**最早 user 消息行的父元素（内容列）右缘**——原生槽位的 padding-right 正是把按钮右缘对齐到内容列右缘，量 DOM 天然跟随内容宽 / 右缩等一切变化，彻底对齐原生按钮列。

- **first-message-jump 首次出现 / 视图切换后不再跳动**：兜底公式改读 --dsh-composer-height（DSH 内联在滚动容器上的输入框高，与原生槽位 bottom:calc(var(--dsh-composer-height) + 16px) 同源）——从未见过原生按钮时的估算位置与锚定位置完全重合，首次出现不再跳；视图/会话切换不再清记忆（原生按钮位置由布局决定，跨切换稳定），仅视口尺寸变化 / 右缩 padding 变化才清。

- **first-message-jump 不再因右侧抽屉无条件隐藏**：原逻辑只要 data-dsh-any-side-drawer-open 就隐藏——但开了「对话区右缩」时按钮已让位到抽屉左侧，隐藏反而失效。改为按实际遮挡判断：读 --active-drawer-width，仅当按钮右缘落入抽屉阴影（right < 抽屉宽）才隐藏；右缩让位足够时保持可见可点。

- **`first-message-jump` 按钮在原生按钮出现/消失时不再跳动**：原实现用两套定位（原生在场锚定 / 缺席时公式计算），两套位置有细微差异，导致每次切换都挪一下。改为**记住原生按钮最后一次的 rect**——原生缺席（停在底部）时复用记忆位置，与原生按钮将要出现的位置完全一致；会话/布局重建时清空记忆。配合真实几何（原生按钮顶 = 输入框顶 - 50），公式兜底也与锚定位置重合，冒烟测试覆盖 无原生/在场/消失/再现 四态全程坐标不变。

- **`first-message-jump` 按钮与「对话区右缩」（conversation-shift）联动**：右缩把 `padding-right` 加在滚动容器上，消息内容 / 原生「回到底部」按钮 / 输入框整体左移，按内容列计算的旧定位会偏右。改为**优先锚定原生「回到底部」按钮**（按 `aria-label` 匹配 zh/en，右缘对齐、悬其上方 8px，天然跟随右缩等一切布局偏移）；停在底部原生按钮不渲染时，兜底计算**扣除滚动容器自身的 `padding-right`** 再对齐内容列，与原生按钮可能出现的位置一致。

- **`first-message-jump` 显隐判断修正**：原 `jumpShouldShow` 只把「最早 user 行顶部明显低于视口顶部」判为显示，忽略了正常聊天停在底部时最早消息已滚出视口上方的情况——导致按钮默认根本不出现在屏幕上。修正为「最早 user 行不在视口顶部附近可见带内（滚出上方 / 前面垫了长上下文）即显示」，并补了覆盖底部 / 顶部 / 上下文 / 抽屉打开四种场景的冒烟测试。

- **`hide-trajectory-tab` 扩展：同时隐藏每个工具调用 row 内的 "Inspect" 按钮**（v0.7.5）：
  - 根因：DSH 在每个工具调用（`edit` / `pwsh` / `read` / `grep` / `glob` / `bash` / `write` 等）的 row 内渲染一个 `<button class="*_inspectButton">`（CSS Module hash class，当前 hash=`o3BgMG` / `CY-8Ka`）。点击后调 `inspectCall(callId)` → `actions.setView("trajectory")`——本质也是进轨迹视图的入口。`hide-trajectory-tab` 原本只隐藏顶部 tablist 的"轨迹"按钮，工具行 Inspect 按钮仍可见——用户反馈"应该一起关掉"。
  - 修法：CSS 加 `[class*="_inspectButton"]{display:none!important}`。substring match 不依赖 hash，DSH 升级换 hash 仍然命中。
  - 配合原有的 `[data-dsh-ui-tweaks-hidden-tab="trajectory"]`，"所有进入轨迹视图的入口"全部关闭，没有 80ms observer 节流的闪烁窗口（与 v0.7.3 修 `hide-sidebar-tooltip` HoverCard "闪一下" 的思路一致——CSS 在 mount 时立即生效）。

### 优化

- **`first-message-jump` 按钮位置对齐原生「回到底部」按钮**：原定位在对话区最右缘，宽屏下与 DSH 自带「回到底部」按钮（内容列右缘，748px 居中）不在同一列。改为读取 `--dsh-chat-content-width`（默认 748）计算内容列右缘，按钮与其同一列、悬在原生按钮上方 8px；输入框高度变化时经 ResizeObserver 重新定位。

- **Tweak row description 收进 HTML `title` 属性**（v0.7.5）：
  - 旧实现：每条 tweak 在 row 里始终渲染一段 1-3 行的描述文字（最长 60+ 字），6 条 tweak 在设置页铺满 200+ 像素高——但实际只有"刚开插件 / 想不起来某条做什么"时才需要看描述。
  - 新实现：description 默认不渲染，鼠标悬停在 row 上时弹出浏览器原生 tooltip（HTML `title` 属性）——所见即所得、无额外 CSS、无 JS state。`.DTPD_item` 加 `cursor:help` 提示可悬停。旧 `.DTPD_itemDesc` CSS 规则移除。

## [0.7.1] - 2026-08-19

- **`hide-sidebar-tooltip` HoverCard 修复链**（v0.7.2 → v0.7.3 → v0.7.4）：
  - **v0.7.2 起**：补充 HoverCard 二次修复（v0.7.1 已加 JS observer 标记）
  - **v0.7.3 CSS 主防线**：直接命中 CSS Module hash 类（`_hoverContent` / `_hoverTitle` / `_hoverTime` / `_hoverStatus` / `_hoverPath`），mount 时立即隐藏消除"闪一下"
  - **v0.7.4 `:has()` 干掉 card div 本体**：CSS `:has()` 找含 `_hoverContent` 后代的 body 直接子 div（HoverCard card div 本身，背景 `#2C2C2E` + box-shadow 才是"窄黑框"来源），不依赖任何 hash
  - 四层 selector 协同（v0.7.4 终态）：L1 `[role="tooltip"]`（DSH Tooltip）→ L2 hash 类（HoverCard 内容）→ L3 `body > div:has(> [class*="_hoverContent"])`（card div 本体）→ L4 `data-dsh-ui-tweaks-hidden-hover-card`（JS observer 兜底）

- **`simple-mode` 状态行 controller 三个 bug**：
  - `findTurnStatus` 改为**反向**迭代：滚动到历史 turn 时不再误注入状态行；新 turn 总是 document 顺序的末尾
  - 改用 `get running()` getter 暴露运行态，apply() 直接读 getter 而非外部 flag，与 `createTrajectoryTabHider` / `createSidebarHoverCardHider` 模式一致
  - `.dsh-ui-tweaks-status` CSS 加 `visibility: visible !important`（display 也加 !important）兜底，防止被 simple-mode 隐藏的祖先节点带连累

### 性能

- **`simple-mode` 状态行 controller tick 节流**（每 250ms 一次）：
  - 缓存 `lastText`：仅在解析的 activity 文本真正变化时才写 DOM（避免思考阶段 4×/sec 的无效 MutationObserver / React reconciler 触发）
  - `attach()` 早返回：当前 span 已附着到当前 turnStatus 时跳过 `findTurnStatus` / `ensureStatusSpan` / `appendChild` 整套工作

### 优化

- **`simple-mode` activity 文本映射扩展**：除内置 DSH 工具名（think / read / web_fetch / web_search / edit / write / grep / glob / bash / pwsh / run_code）外，新增覆盖 task / subagent / agent / todo / plan / update_plan / lsp / intellisense / goal / objective / commit / git / push 等更日常的 tool kinds，"正在处理…" 兜底频率降低。

### 重构

- **client bundle 拆分**（按 `docs/maintainability.md` 通用规范）：原 1650 行 / 80.7 KB 单文件 `lib/client.js` 超过触发阈值（≥ 700 行 / 30 KB），拆为 17 个 source section（`lib/client-src/00-banner.js` 到 `Z9-loader-close.js`）。新增 `lib/build-client.cjs`（拼回 client.js）与 `lib/verify-client.cjs`（与 HEAD 字节级校验）脚本；`package.json` 加 `build:client` / `verify:client` / `prepare` 脚本。段首 marker 改用英文 short-name（与文件名 `name` 部分一致），原中文 marker 注释保留作为内部说明。

- **`simple-mode` TWEAKS row 注释**：`configKeys.value === configKeys.enabled` 真实原因写入注释——`TweakRow` 用 `hasValueInput = k2 !== k1` 检测，k1===k2 时不渲染数字输入框，localStorage 只存一个布尔字段，省空间且不暴露无意义的数字配置。**后续读者不要"修"成两个不同的 key。**

## [0.7.1] - 2026-08-19

作为独立 npm 包发布的初始版本，包含以下已有功能。

### 新增

- 设置页独立的"界面微调"顶级栏目，按 `TWEAKS` 数组自动渲染每条微调的开关与参数控件。
- `conversation-shift`（对话区右缩）：通过 DOM 探测定位对话流容器与输入区并标记，CSS 仅命中被标记元素并施加可配置的右侧内边距（默认 380 px，可调 0–800）；探测失败时回退到对话列容器。自带 shim，不依赖任何外部桥接包。
- `conversation-shift-debug`（对话右缩调试高亮）：为命中元素加高亮描边与浮动标签，并在控制台输出命中元素的诊断信息。
- `simple-mode`（简洁模式）：隐藏思考、工具调用、上下文注入等过程节点，并在输入框上方显示一行极简运行状态。
- `hide-sidebar-tooltip`（隐藏侧栏悬浮提示）：同时覆盖 Tooltip 与 HoverCard 两种实现——前者按 `[role="tooltip"]` 命中，后者由 `MutationObserver` 巡检 body 直接子元素后打标记，再由 CSS 隐藏。
- `hide-trajectory-tab`（隐藏"轨迹"标签）：巡检标签栏并按标签文本打标记隐藏；若当前正停留在轨迹视图，自动切回对话视图。
- 诊断能力：每条微调附带"诊断"按钮输出该条的生成 CSS 与命中元素，栏目顶部提供"复制状态到剪贴板"，运行时暴露 `window.__dshUiTweaks` 调试接口。
- 状态由浏览器 `localStorage`（键 `dsh-ui-tweaks/state`）自管，新增字段按缺省值隐式补齐；存储不可用时降级为默认值。
- 宿主半段为零副作用占位实现，不注册设置命名空间、不读写磁盘。