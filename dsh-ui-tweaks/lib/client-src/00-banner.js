/**
 * dsh-ui-tweaks — 浏览器端（web client bundle，作者：MeganeOnly）
 *
 * v0.10.3：设置页开关去边框——回归 v0.5.1 之前的「圆圆的」pill 形态
 *
 *   用户反馈：现在开关「都有一点方圆的」，更喜欢之前「圆圆的」那种。
 *
 *   根因：v0.6.0 给 `.DTPD_switch` 加了 `border:1px solid var(--dsw-alias-border-l2,#94a3b8)`，
 *   在 22px 高的 pill 上绕一圈 1px 灰边，pill 的「圆」被边线削弱，视觉上偏「方圆」。
 *   v0.5.1 之前（v0.2.0–v0.5.x）没有这条 border，pill 看起来是纯色椭圆，跟用户记忆中
 *   的「圆圆的」一致。
 *
 *   修法：去掉 `border:1px solid ...` 这一段，其它所有属性（width:36px / height:22px /
 *   border-radius:999px / thumb 18×18 + 50% / thumb box-shadow）保留。off 态靠
 *   `background:var(--dsw-alias-bg-component-disabled,#cbd5e1)` 的 fallback 颜色
 *   （亮色主题 `#cbd5e1` 浅灰 / 暗色主题走 var 解析值）保持可见，不依赖 border
 *   兜底——v0.5.1 之前就是这个状态，本来就够清晰。
 *
 *   兼容性：tweak id / localStorage key / 类名 / 调试 API / 设置页 UI 全部不动；
 *   只改 `35-styles.js` SECTION_CSS 的 `.DTPD_switch` 一行（删掉 border 声明）。
 *   老用户开关状态保留。
 *
 *   诊断：浏览器 DevTools inspect 设置页开关元素，Computed 面板 `border` 应是
 *   `medium none currentcolor`（无 border），`border-radius` 仍是 `999px`；
 *   pill 形态与 v0.5.1 之前一致。
 *
 *   改动文件：`lib/client-src/35-styles.js`（删 `.DTPD_switch` 的 `border:1px solid ...`，
 *   SECTION_CSS JSDoc 加 v0.10.3 段）；`lib/client-src/20-constants.js`（VERSION 0.10.2
 *   → 0.10.3 + 头部 v0.10.3 注释）；`lib/client-src/00-banner.js`（本段）；
 *   `package.json`（version 0.10.2 → 0.10.3 + description 同步）；`CHANGELOG.md`
 *   加 [0.10.3] 段；走 `npm run build:client` + `node --check lib/client.js`
 *   语法校验通过。
 *
 * v0.10.2：conversation-shift 修复两个用户反馈
 *   1) 半屏浏览器时右缩看起来很奇怪
 *   2) 新建会话界面右缩不生效
 *
 *   根因（一个 bug 引发两个症状）：
 *   v0.5.3 的 chatflow 探测同时给 chatflow 容器和 input 容器打标记，
 *   CSS 对两个元素都加 padding-right → 实际叠加成**双 padding**
 *   （如 380+380=760）。DSH 当前的 DOM 结构是 scrollBody（包了
 *   composerSeat）——composer 是 scrollBody 的子元素而非兄弟，所以单
 *   padding 在 scrollBody 上就能同步影响消息 + 输入框，无需再额外标
 *   input。v0.5.3 同时标 chatflow + input 是「DSH 早期结构里 composer
 *   在 scrollBody 外的兜底」残留，已不需要。
 *
 *     全屏（视口 1920px，conv 列 ≈ 1640px）：1640 - 760 = 880px 内容区
 *     → 聊天气泡 748px 仍能放下 → 「效果很好」
 *     半屏（视口 960px，conv 列 ≈ 680px）：680 - 760 = -80px 溢出
 *     → 「看起来很奇怪」
 *
 *   「新建会话」界面右缩不生效是同一根源：空会话（hero composer +
 *   无消息）里 `[data-chat-flow-kind]` 不存在 → v0.5.3 策略 1 漏判，
 *   落到 input 探测 → 单 padding 在 ConversationRoot 上 → 视觉上
 *   看似没生效（hero composer 居中 + scrollBody 居中 → 整列右移不明显）。
 *
 *   修法两条：
 *   1) **chatflow 探测首选 DSH 稳定锚点 `[data-conversation-scroll]`**
 *      ——DSH `ConversationRoot.scrollBody` 上的属性（DSH 源码
 *      `dsh-client-ui-conversation/lib/client.js:7277` 显式
 *      `setAttribute`）。**空会话也命中**（scrollBody 在 hero composer
 *      仍在）。命中即返回，**不再额外标 input**——单 padding 同步影响
 *      消息内容 + 输入框。新策略与 v0.7.3 HoverCard `[class*="_hoverContent"]`
 *      / v0.10.0 stats-line-position `data-slot=...` 同源的 hash-independence。
 *   2) **CSS 改成 `padding-right: min(Npx, 40%)`**——保留用户在全屏的
 *      偏好像素，半屏时 40% 上限自动收紧到「聊天列 60% 内容 + 40% 右缩」
 *      的比例。聊天气泡（DSH `--dsh-chat-content-width:748px`）始终可读。
 *      需要更小比例直接改设置页 conversationShiftPx。
 *
 *   兼容性：tweak id `conversation-shift` / localStorage key `conversationShift`
 *     / `conversationShiftPx` / 设置页 UI / 调试 API / 调试高亮全部不动；
 *     只改 chatflow 探测顺序（v0.5.3 的 overflow+chat-flow-kind 保留作
 *     兜底）+ CSS 输出值的 `min()` 包裹 + 头部 banner 段。DSH 升级换 hash
 *     不影响 `data-conversation-scroll` 命中（DSH 自己 setAttribute 的
 *     稳定属性）。
 *
 *   诊断：`window.__dshUiTweaks.debug()` 在 conversation-shift 开启时
 *     `getMatchedElements()` 应只命中 1 个 `[data-dsh-ui-tweaks-shift-target]`
 *     元素（scrollBody），不再是 2 个；`getInjectedCSS()` 在 tweak 开启时
 *     应包含 `padding-right:min(380px,40%)` 而不再是 `padding-right:380px`。
 *
 *   改动文件：`45-chatflow-marks.js` findChatflowTargets 策略重排
 *     （[data-conversation-scroll] 首选 + 命中即返回）+ applyChatflowShiftMarks
 *     幂等逻辑保持兼容（只标一个元素，原有的 chatflow/input 双标逻辑天然
 *     兼容 0/1/2 个目标）；`25-tweaks.js` conversation-shift buildCSS
 *     改 `min(Npx, 40%)` + 描述同步；`20-constants.js` VERSION 0.10.1
 *     → 0.10.2 + 头部 v0.10.2 注释 + 新增 `SHIFT_SCROLL_SEL` 常量；
 *     `00-banner.js` 本段；`package.json` version + description 同步；
 *     `README.md` / `CHANGELOG.md` / `docs/maintainability.md` 同步。
 *
 * v0.10.1：stats-line-position 隐藏底部原生统计行时改用 `visibility:hidden`
 *   而不是 `display:none`。
 *
 *   用户反馈 v0.10.0："这样就导致了发消息的框往下走了一点点，我希望它
 *   还是处于原来的位置"。
 *
 *   根因：统计行是 composer 卡片的 footer（`conversation.composer.dock`
 *   作为输入条的 footer prop 渲染），高 24px（DSH `.FJxK0a_root` 的
 *   `line-height:20px` + `padding:4px ... 0px`）；而 composer seat 是
 *   `position:sticky; bottom:0` 贴着滚动容器底部的（DSH
 *   `.wSkVaW_composerSeat`）。`display:none` 把统计行从布局里彻底移除
 *   → 卡片整体变矮 24px → 因为底边被钉住，顶边（也就是输入行）只能
 *   往下挪 24px。
 *
 *   修法：`visibility:hidden` —— 元素的盒子仍然生成、仍然参与布局、
 *   React 仍然照常更新它的文本，只是不渲染。24px 分毫不差地保留，
 *   输入框位置与"底部"位置完全一致。比"补一个硬编码 24px padding"更稳：
 *   不依赖 DSH 的字号 / 行高 / padding 具体数值，DSH 后续改统计行样式
 *   也自动跟随。
 *
 *   CSS 从
 *     [data-slot="conversation.composer.dock"]{display:none !important}
 *   改为
 *     [data-slot="conversation.composer.dock"],
 *     [data-slot="conversation.composer.dock"] *{visibility:hidden !important}
 *   两条选择器：出口自身 + 其所有后代。`visibility` 本身是继承属性，
 *   出口那层 `display:contents` 不生成盒子但仍能把 `hidden` 传给子元素；
 *   后代那条是显式兜底，防 DSH 将来给统计行自己写 `visibility`。
 *   已核对 DSH 侧只有 `.wSkVaW_root[data-phase=settling] .wSkVaW_composerSeat
 *   {visibility:hidden}` 一条 visibility 规则（settling 阶段整个 seat 都
 *   隐藏），没有任何 `visibility:visible` 的后代重置会与本规则冲突。
 *
 *   代价（有意）：非"底部"位置时输入框下方保留一条 24px 空白——这正是
 *   把输入框钉在原位所必须的空间。
 *
 *   兼容性：tweak id / choices / localStorage key / 镜像逻辑 / controller /
 *   诊断 API / 设置页 UI 全部不动，只改 buildCSS 输出的隐藏属性。
 *
 *   改动文件：`25-tweaks.js` 的 stats-line-position buildCSS；
 *     `20-constants.js` VERSION 0.10.0 → 0.10.1 + 头部注释；
 *     `69-stats-line-position.js` 头部注释同步；`00-banner.js` 本段；
 *     `package.json` / `README.md` / `CHANGELOG.md` / `docs/maintainability.md` 同步。
 *
 * v0.10.0：新增 stats-line-position tweak——对话底部那行运行统计
 *   （"3 轮 · 45 步 | LLM 12m13s · 工具调用 1m21s | 首 token 平均 2.9s ·
 *   71 tok/s | 缓存命中 96% | 输入 3.6M tok · 输出 42.7K tok"）现在三选一：
 *
 *     bottom（默认）  DSH 原样，零 CSS、controller 停机
 *     top             底部整条隐藏，改在顶部标题行"对话名 + 模式"右边显示
 *     hidden          底部整条隐藏，不再显示
 *
 *   这行统计由 DSH `dsh-client-ui-conversation` 的 StatsLine 组件渲染，
 *   注册在 slot `conversation.composer.dock`（id "stats"，order 0）。
 *
 *   两个实现要点：
 *
 *   1) 隐藏走**纯 CSS**，锚点是 slot 出口属性而不是 CSS module 类名——
 *      DSH renderer（`dsh-client-ui-renderer` SlotOutlet）给每个 slot 出口
 *      包一层 `<div data-slot="<slot key>" style="display:contents">`，
 *      这个属性不含构建 hash，跨 DSH 版本稳定；而统计行自身的类名
 *      `.FJxK0a_root` 每次 DSH 构建都会变。DSH 自己的 slot 目录把
 *      `conversation.composer.dock` 的 occupants 记为
 *      `["client-ui-conversation StatsLine id 'stats'"]`——唯一占位者就是
 *      统计行，所以隐藏整个出口 == 隐藏统计行。`!important` 必需：出口的
 *      `display:contents` 是 inline style，普通样式表规则压不过它。
 *
 *   2) 顶部走**镜像**而不是搬 DOM——把 DSH 渲染的原生统计行 appendChild
 *      到标题簇里，React 下次卸载它（StatsLine 在 groups 为空时
 *      `return null`，新会话开局必然发生）会对**它记录的原父节点**调
 *      removeChild → NotFoundError 崩掉 React 树。镜像方案：原生节点
 *      始终留在原位（只是 `display:none`，React 照常更新它的文本），
 *      本插件另建一个 React 不认识的尾部子节点，400ms 轮询把原生行的
 *      子节点 `cloneNode(true)` 搬进去（保留 `_sep` 分隔符类名，DSH 自己
 *      的分隔符样式继续生效；不搬克隆根，避免带上底部专用的居中 +
 *      `max-width` + padding）。文本没变则整段跳过，不做无谓 DOM 重建。
 *      与 v0.9.6 disclosure-end-collapse 往 body 末尾 appendChild 按钮
 *      同一模式——已验证不干扰 React 协调。轮询同时兼任自愈：DSH 换会话
 *      重建 header 后下一 tick 自动在新标题簇补上镜像。
 *
 *   顺带的框架能力：TweakRow 支持 `choices`（`[{value,label}]`）——有
 *   choices 的 tweak 在设置页渲染 `<select>` 而不是开关，`configKeys.enabled`
 *   存选项字符串。这是本插件第一条非布尔 tweak；开关型 tweak 走原路径，
 *   行为零变化。脏值 / 老布尔值由 `statsNormalizePosition()` 统一退回
 *   "bottom"，所以老用户升级后视觉零变化。
 *
 *   顺带的维护动作：`68-first-message-jump.js` / `68a-first-message-jump-utils.js`
 *   / `75-react-tweak-row.js` 三个 source 文件末尾缺行尾换行（违反仓库
 *   `docs/maintainability.md` § 五 "每个 source 文件末尾必须有 \n"），
 *   导致拼接时下一个文件的 `// ===== marker =====` 首行被接到上一个文件
 *   的 `}` 后面。补上换行（各 +1 字节），bundle 里所有 section marker
 *   现在都独立成行。
 *
 *   改动文件：新增 `69-stats-line-position.js`（controller + 镜像逻辑）；
 *     `20-constants.js` 加 STATS_* 常量 + VERSION 0.9.15 → 0.10.0；
 *     `25-tweaks.js` 加 stats-line-position 条目（含 choices）；
 *     `75-react-tweak-row.js` 支持 choices 下拉；`35-styles.js` 加
 *     `.DTPD_select`；`85-apply.js` 接线 controller + 诊断
 *     `window.__dshUiTweaks.statsLinePosition()`；`package.json` /
 *     `README.md` / `CHANGELOG.md` / `docs/maintainability.md` 同步。
 *
 * v0.9.15：sidebar-match-conversation-bg 用户实测"展开页面左上角的
 *   部分，过一会就会变成灰色，我鼠标光标移动到上面的时候，又变成了
 *   白色，移走一段时间，又变成灰色"——v0.9.9/v0.9.13/v0.9.14 三层修复
 *   都只覆盖 column + 已知 _root 后代，没考虑 DSH 侧栏作用域内 CSS
 *   变量 `--dsw-specific-sidebar-fill` 的扩散。DSH 内部 sidebarCol /
 *   SidebarRoot 都 `background:var(--dsw-specific-sidebar-fill)`，
 *   column + inner root 的直接 background 覆盖可能因 DSH 后续调整
 *   （cascade 重排、HMR 重注入、theme 异步应用、某些 panel 状态切换等）
 *   失效，露出 sidebar-fill 的浅灰/深灰——hover 触发某些透明层覆盖
 *   时又显出 frame 的白色背景；hover 出后透明层消失重新露出 inner
 *   root 的灰。
 *
 *   修法：三层兜底强制抹掉侧栏作用域内所有 sidebar-fill 变量解析结果——
 *
 *     [data-pane="sidebar"] {
 *       background: var(dsw-alias-bg-base, ...) !important;   // ① 列显式 bg
 *       变量级覆盖在更高作用域应用，详见代码                    // ③ 变量级覆盖
 *     }
 *     [data-pane="sidebar"] [class*="_root"] {
 *       background: var(dsw-alias-bg-base, ...) !important;   // ② _root 后代 bg
 *     }
 *
 *   变量覆盖作用于整个 `[data-pane="sidebar"]` 子树——DSH 后续在此
 *   作用域内加新元素并引用 `--dsw-specific-sidebar-fill` 也会解析为
 *   透明，不再依赖具体选择器是否命中。
 *
 *   - `[class*="_root"]` contains 仍是 hash-independence（DSH CSS module
 *     `<hash>_<name>_root` 约定保留 `_root` 子串）——与 v0.7.3 HoverCard
 *     `[class*="_hoverContent"]` / v0.7.5 Inspect `[class*="_inspectButton"]`
 *     / v0.9.14 sidebar `[class*="_root"]` 同策略
 *   - `!important` 强化在 DSH 后续 column rule 调整时仍生效（DSH sidebarCol
 *     当前 specificity 0,1,0,0 与我们相同，!important 决定胜负）
 *   - 兼容性：tweak id / localStorage key / 调试 API / 类名 / ID /
 *     attribute / 设置页 UI 全部不动；只多了一条 `--dsw-specific-sidebar-fill`
 *     变量覆盖 + 列选择器显式 background + inner root 选择器强化
 *
 *   改动文件：`25-tweaks.js` 的 sidebar-match-conversation-bg buildCSS
 *     加 ③ 变量覆盖 + 列显式 bg；`20-constants.js` VERSION 0.9.14 → 0.9.15；
 *     `00-banner.js` 加本 banner 段；`package.json` version + description
 *     同步；走 `npm run build:client` + `node --check lib/client.js`
 *     语法校验。
 *
 * v0.9.14：sidebar-match-conversation-bg v0.9.13 修复——v0.9.13 用
 *   `[class$="_root"]` ends-with 匹配 SidebarRoot 组件根，但在收起态
 *   DSH 给 root 元素额外拼接 `hHd-Xa_collapsed` + `hHd-Xa_railIn` +
 *   `hHd-Xa_quietBars` 修饰类（见 `dsh-client-ui-sidebar/lib/client.js`
 *   SidebarRoot.js `clsx(root, !wide && collapsed, !wide && everWide &&
 *   railIn, collapsed && wide && fading, !pointerInside && quietBars)`），
 *   整个 className 字符串变成 `"hHd-Xa_root hHd-Xa_collapsed
 *   hHd-Xa_railIn hHd-Xa_quietBars"`，末尾是 `_quietBars` 不是 `_root`——
 *   ends-with 选择器在收起态完全失效，小侧栏仍显示 `--dsw-specific-sidebar-fill`
 *   的灰色 / 深灰。修法：改 `[class*="_root"]` contains 子串匹配，与
 *   className 拼接顺序无关，展开 / 收起两态都命中。
 *
 *   - `[class*="_root"]` contains 仍是 hash-independence（DSH CSS module
 *     `<hash>_<name>_root` 约定保留 `_root` 子串），DSH 升级换 hash
 *     仍命中——策略与 v0.7.3 HoverCard `[class*="_hoverContent"]` /
 *     v0.7.5 Inspect `[class*="_inspectButton"]` 同源
 *   - 兼容性：tweak id / localStorage key / 调试 API / 类名 / ID /
 *     attribute / 设置页 UI 全部不动；只改 buildCSS 输出的选择器子串匹配
 *     字符（`$` → `*`）与头注释；老用户开关状态保留
 *   - WorkspaceList 的 `qDHVXG_root` 也命中但目前无 background 设置，
 *     无视觉副作用
 *
 *   改动文件：`25-tweaks.js` 的 sidebar-match-conversation-bg buildCSS
 *     （`[class$="_root"]` 改 `[class*="_root"]`）；`20-constants.js`
 *     VERSION 0.9.13 → 0.9.14；`00-banner.js` 加本 banner 段；`package.json`
 *     version 同步；走 `npm run build:client` + `node --check lib/client.js`
 *     语法校验。
 *
 * v0.9.13：sidebar-match-conversation-bg v0.9.9 修复——v0.9.9 选择器
 *   `[data-pane="sidebar"]` 只命中 DSH AppFrame 的 sidebarCol 列容器，
 *   但列内的 `<div class="hHd-Xa_root">`（SidebarRoot 组件根，height:100%
 *   完全覆盖列容器）也设了 `background:var(--dsw-specific-sidebar-fill)`
 *   ——v0.9.9 改 column 背景视觉上仍被 inner 的 specific-sidebar-fill
 *   覆盖，用户实测"开启后无变化"。
 *
 *   修法：选择器同时命中 column 与其内 SidebarRoot（后代选择器，无 `>`）——
 *     `[data-pane="sidebar"], [data-pane="sidebar"] [class$="_root"]`
 *   两层都改 `background: var(--dsw-alias-bg-base, ...) !important`，
 *   让可见的侧栏 UI 与对话区背景一致。后代选择器是为兼容 DSH 后续在
 *   sidebarCol 与 SidebarRoot 间插入包装层（动画 / portal 等）；直接子
 *   选择器 `>` 会被切断。
 *
 *   - `[class$="_root"]` ends-with 匹配 DSH CSS module 约定
 *     `<hash>_<name>_root`（SidebarRoot 当前 hash=hHd-Xa，DSH 升级换 hash
 *     仍命中——hash-independence 与 v0.7.3 HoverCard / v0.7.5 Inspect button
 *     同策略）
 *   - AppFrame 的 sidebarCol 内当前只有 SidebarRoot 一个匹配元素
 *     （`renderSlot("sidebar")` 输出）；WorkspaceList 的 `qDHVXG_root` 也
 *     匹配但目前无 background 设置，命中无视觉副作用
 *   - 列边框 `border-right: 1px solid var(--dsw-alias-border-l1)` 保留——
 *     用户原意是背景一致，不是无边界；边框分割由 border 单独承担
 *   - 子元素（会话项 / 按钮 / hover 态 / active 态）零变化，仍由 DSH
 *     `--dsw-specific-sidebar-nav-item-*` 等功能性背景控制
 *   - 兼容性：tweak id `sidebar-match-conversation-bg` 不动、localStorage
 *     key `sidebarMatchConversationBg` 不动、老用户开关状态保留；
 *     调试 API `window.__dshUiTweaks.getInjectedCSS()` 输出仍含本 tweak 段
 *
 *   改动文件：`25-tweaks.js` 的 sidebar-match-conversation-bg buildCSS
 *     （选择器扩为 column + `[class$="_root"]` 后代双命中）；`20-constants.js`
 *     VERSION 0.9.12 → 0.9.13；`00-banner.js` 加本 banner 段；`package.json`
 *     version 同步；走 `npm run build:client` + `node --check lib/client.js`
 *     语法校验。
 *
 * v0.9.12：simple-mode 状态行 v0.9.10 CSS 三层 reset 兜不住 DSH 后续添加的
 *   loader / shimmer child；走 v0.9.10 CHANGELOG [Unreleased] line 63 预设的
 *   JS 回退路径——`createSimpleModeStatusController#purgeTurnStatus()` 在
 *   appendChild 之前清空容器并保留 clock，`watchTurnStatus()` 升级观察
 *   document.body subtree（含 DSH 重渲时新增的任何 turnStatus 立即 purge），
 *   杀零 tick 250ms 间隔的闪援窗口。同时修"几次 think / 工具调用穿插后状态行
 *   像是首行缩进"——CSS 加 `padding-left:0 !important` + `margin-left:0 !important`
 *   让 status 始终贴容器左侧，JS 同步把 inline `style.paddingLeft / marginLeft`
 *   归零作为 DSH 通过 inline style 缩进时的兜底。详情见
 *   `55-simple-mode.js` v0.9.12 banner + `25-tweaks.js` simple-mode buildCSS
 *   v0.9.12 增量段 + `20-constants.js` v0.9.12 VERSION 头注释。
 *
 * v0.9.11：simple-mode 防御性 layout zero——用户反馈"两边的字之间的距离会特别大
 *   但有时候会有时候不会"。根因：`display:none` 在某些 layout context 下不一定
 *   让元素彻底不占布局空间——
 *     - **React VirtualList / react-window 风格**：每个 chat-flow item 有 fixed
 *       slot，`display:none` 不会回收 slot 高度
 *     - **CSS Grid `grid-template-rows: masonry` 或 auto**：grid track 可能
 *       基于 max-content 计算，hidden item 仍占 track
 *     - **React 给 parent 设的 inline style `min-height`** 基于 child 内容计算——
 *       child `display:none` 后 parent 的 inline `min-height` 不会被改写
 *     - **layout 重算时机**：间距时大时小正对应 layout 重算发生在 React 重渲时——
 *       旧消息按"已收敛 layout"渲染（间距正常），新消息边渲边 hide 时 layout 未收敛
 *       （间距偏大）
 *   修法：把 hidden block 的 height / min-height / max-height / margin / padding /
 *     border / outline / flex-basis / flex-grow / grid-area 全部显式归零——
 *     在 block / flex / grid / virtual list 任意 layout context 下都不留残余高度。
 *   兼容性：纯 CSS 加固，所有类名 / ID / attribute / localStorage key 不动。
 *   见 25-tweaks.js simple-mode buildCSS。
 *
 * v0.9.10：simple-mode 状态行 v0.9.8 reset 不彻底——用户反馈"底部的 正在思考
 *   还是会一闪一闪的 而且位置依赖（最左侧不闪，右移一点开始闪）"。
 *   根因诊断：v0.9.8 只 reset 了容器本身的 animation / background / background-clip
 *   三个属性，但 DSH 完全可能用 animation 之外的方式做 shimmer：
 *     - **transition + mask-image linear-gradient 模式**：mask 是一个 110deg 渐变
 *       （透明 → 实 → 透明），transition 让 mask-position 从 0% 移到 100%——
 *       在文字形状里形成移动的"光带"。animation:none 完全杀不掉，因为是 transition
 *       驱动的
 *     - **新加 child 元素做动画**：DSH 完全可能在容器里多塞 <div class="turnStatusLoader">
 *       之类做动画。容器 reset 不影响嵌套子元素
 *     - **::before / ::after 伪元素**：容器 animation:none 不传递到伪元素的具体
 *       background / 自身 animation
 *   位置依赖（最左侧不闪 / 右移一点闪）的合理解释：shimmer / loader 区间在容器
 *   内某段，文字在容器内某位置——两者重叠时 shimmer 可见，不重叠时不闪。
 *
 *   三层防线（纯 CSS 加固，不动类名 / ID / attribute / localStorage key）：
 *     - **第 1 层**：容器 reset 升级——在 v0.9.8 基础上加 transition / text-shadow /
 *       box-shadow / filter / -webkit-mask-image / mask-image / -webkit-mask-* /
 *       transform / text-indent / letter-spacing / word-spacing / text-decoration /
 *       overflow:hidden 等"非 animation 但能产生 shimmer 视觉效果"的属性全部杀掉
 *     - **第 2 层**：伪元素 ::before / ::after 显式 display:none + content:none +
 *       详细 background / mask reset——DSH 经常在伪元素上放 spinner / shimmer 装饰
 *     - **第 3 层**：直接子元素 [class*="turnStatus"] > * 除我们 span 和 clock 外
 *       全部 display:none——任何 DSH 新加的 child loader / shimmer 都干掉
 *   clock 也加防御性 reset（animation / shadow / filter / mask 等）。
 *
 *   保留：v0.9.7 引入的 transition:color .4s ease（活动色平滑过渡）；
 *     visibility:visible !important（v0.7.1 起的祖先 display:none 兜底）。
 *   见 25-tweaks.js simple-mode buildCSS。
 *
 * v0.9.9：新增 sidebar-match-conversation-bg「侧栏背景与对话一致」tweak。
 *   用户反馈 DSH 默认侧栏（data-pane="sidebar"，展示会话列表的区域）
 *   有独立背景色，与对话区（data-pane="conversation"）的 --dsw-alias-bg-base
 *   不同，视觉上有明显分割。开启后把侧栏列容器背景改为对话区同款，让两
 *   个区域在背景色上融合。
 *
 *   - CSS 一条规则：`[data-pane="sidebar"]{background:var(--dsw-alias-bg-base,
 *     var(--dsw-alias-bg-layer-1,#ffffff)) !important}`——三层 fallback：
 *     --dsw-alias-bg-base（DSH 主背景；dsh-ssh 的 mL8Uca_panel 用同款
 *     与对话区"无缝融入"；dsh-client-ui-skin-center #712 注释明确
 *     AppFrame frame + conversation root + details root 是 shell surfaces
 *     共用 bg-base，侧栏不在列）→ --dsw-alias-bg-layer-1（DSH 卡片背景，
 *     退化场景）→ #ffffff（硬值白兜底）。
 *   - 子元素（会话项 / 按钮 / hover 态）零变化——只改列容器背景色。
 *     hover 高亮 `--dsw-specific-sidebar-nav-item-hover`、active 高亮
 *     `--dsw-specific-sidebar-nav-item-active` 等功能性背景保持可见。
 *   - 默认 OFF：v0.9.9 新引入，倾向保守——老用户升级后视觉不变，需要在
 *     设置页显式开启。tweak id `sidebar-match-conversation-bg`，localStorage
 *     key `sidebarMatchConversationBg`。见 `25-tweaks.js` 的
 *     sidebar-match-conversation-bg buildCSS。
 *
 * v0.9.8：simple-mode 状态行接管 DSH 原生 turnStatus——根因不是自家
 *   pulse，是 DSH 的 `linear-gradient + background-clip:text +
 *   animation:1.8s linear infinite dsh-turn-status-shimmer` shimmer
 *   （gradient 在 DSH "Deep diving..." 文字形状里平移，渲染整容器；
 *   我们的 span appendChild 到容器内，被 shimmer 一起染到）。
 *   解决三个用户反馈："正在处理 还在闪" / "时间想出现在 后面" /
 *   "还是比原生高一点点"。整容器接管：
 *   - 杀 shimmer：`[class*="turnStatus"]{animation:none; background:none;
 *     background-clip:border-box; -webkit-text-fill-color:initial}` +
 *     `color:transparent` 抹掉 DSH 文字节点 + `font-size:0`（子级显式
 *     override 到 13px）
 *   - 容器 26px → 18px：DSH 原生 turnStatus height 26px，我们 18px 在
 *     26px 容器居中，垂直空白太多——`height:18px !important` 对齐
 *   - 时间出现在后面：DSH 自带 `.turnStatusClock`（1s setInterval 自动
 *     更新，15s 后才显示）用 flex `order:2` 重排到我们 span（order:1）
 *     后面——纯 CSS、无新 DOM、无新 JS 时间维护
 *   - 8 类活动色追加 `-webkit-text-fill-color` override（DSH 父级
 *     `-webkit-text-fill-color:initial` 不传递到我们的子级）
 *   最终视觉：`[● 正在查找...  5s]` 无动画、无 shimmer、18px 高度、
 *   时间在后面。兼容：类名/ID/attribute/localStorage/debug API 全不动；
 *   见 `25-tweaks.js` simple-mode buildCSS。
 *
 * v0.9.7：simple-mode 状态行两轮「去装饰」——
 *   - 去圆角胶囊灰底：撤掉 `.dsh-ui-tweaks-status` 的 `background:color-mix(...)` /
 *     `border-radius:999px` / 水平 padding
 *   - 去呼吸脉动动画：撤掉 `@keyframes dsh-status-pulse` + `::before`
 *     animation + `@media (prefers-reduced-motion:reduce)`
 *   - 加 `transition:color .4s ease` 让活动切换平滑过渡
 *
 * v0.9.6：折叠块末尾收起按钮——给所有 DisclosureRow 展开后的 body 末尾追加
 *   "收起"按钮，解决"展开后想收起需要一直往前翻到头部"的痛点。覆盖三类
 *   DisclosureRow：ReasoningRow (Think, data-variant="think") / GenericCommandCard
 *   (工具调用输出, data-variant="others") / ContextInjectionRow (上下文注入,
 *   class 含 _root 且 data-open)。JS MutationObserver 巡检 body 元素（仅
 *   expanded 时 body 在 DOM）给每个 body 末尾注入 wrapper div + "收起 ▴" 按钮；
 *   点击调用 row.click() 触发 DSH React onToggle → setExpanded(false) 折叠，
 *   body 与按钮一起被卸载。新增 `disclosure-end-collapse` tweak（默认 ON），
 *   见 `lib/client-src/67-disclosure-end-collapse.js`。
 *
 * v0.9.5：`simple-mode` 状态行工具名识别修复——`simplePickToolNameFromDom`
 *   之前查 `[data-tool-name]`（错属性），DSH `dsh-client-ui-tool/lib/client.js`
 *   ToolRow 实际渲染的是 `[data-tool] = toolName`；同时新增
 *   `simpleIsThinkingFromDom` 识别 reasoning block（不在 tool-call 容器里，
 *   在 `assistant-step` 的 `data-variant="think" data-state="running"` 上）。
 *   两处修复让 v0.9.3 美术度升级的 8 类活动语义色真正生效——v0.9.3 commit
 *   `03a71c1` 起就未生效，所有活动一直 fallback 到 "正在处理…" / generic 灰。
 *   tick() 改用 `simplePickActivityName()` 统一入口：think 优先 → tool-call
 *   → fallback。`simpleActivityCategory` / `simpleActivityText` 扩展覆盖 DSH
 *   真实工具名（`bash_persistent` / `pwsh_persistent` / `read_image` /
 *   `todo_write` / `*_goal` / `subagent` / `workflow` / `ralph` / `skill` /
 *   `ask_user_question` / `job_*` / `send_message` / `interrupt_agent` /
 *   `list_agents` / `cordis_*`）。
 *
 * v0.9.4：`first-message-jump` step-by-step 跳过 hidden row 修复：
 *   - 根因：v0.9.3 之前 `jumpFindPrevUserRow` / `jumpFindNextUserRow` 拿到
 *     `topVisible` 的 DOM 索引后直接返回 `rows[i-1]` / `rows[i+1]`，没再
 *     检查目标行是否实际可见。当 simple-mode（默认 ON）把会话顶部的
 *     compaction 块 `display:none` 隐藏时，里面的旧 user 行
 *     （rows[0..K-1]）仍在 DOM 里、`jumpAllUserRows` 仍会返回——
 *     `jumpFindTopVisibleUserRow` 已正确跳过 height<=0 的行，但 step-by-step
 *     直接 DOM 索引取 `rows[K-1]`（hidden 的旧 compaction user 行）作为
 *     target → `jumpToPrev` 滚到 height=0 的位置 → 用户看不到任何视觉变化，
 *     按钮"卡死"在该行
 *   - 修法：拿到 topVisible 索引后，prev / next 各自向前 / 向后找第一个
 *     `getBoundingClientRect().height > 0` 的 row；找不到返回 null
 *     （按钮仍在但 click 变 no-op，与 v0.9.2 可见性放宽的视觉提示语义一致）
 *   - 区别于 v0.9.2 Shift+点击用 `jumpIsRowInCompaction` 沿父链查
 *     `data-chat-flow-kind` attribute：v0.9.4 用 DOM 渲染高度做"可见性"
 *     判断，更通用——simple-mode 隐藏、自定义 CSS 隐藏等任何 `display:none`
 *     的 user 行都会跳过；simple-mode OFF 时所有行可见，行为不变
 *     （compaction 行仍可逐条 step 进去）
 *
 * v0.9.3：`simple-mode` 状态行美术度升级——三轴叠加：
 *   - **A) Pill 化**：`padding:0 10px 0 8px`（仅水平 padding，保持总高严格 18px 与 DSH
 *     原生 turnStatus 文案如「Deep diving...」同高） + `border-radius:999px` +
 *     `background:color-mix(in srgb, currentColor 8%, transparent)`——取代 v0.9.2
 *     的裸灰文字，"飘字" 变 "状态徽章"，背景跟当前活动色淡出不抢戏
 *   - **B) 呼吸点**：`::before` 6px 圆点 + `@keyframes dsh-status-pulse` 2.4s
 *     **仅透明度**循环（opacity .6↔.9，无 scale——避免几何抖动）——"现在还活着"
 *     的活性信号（`prefers-reduced-motion` 关掉）。v0.9.3 首版的 scale(.85↔1)
 *     + 1.6s 周期 + opacity .35↔.95 三层叠加导致视觉闪烁，已 hotfix
 *   - **C) 语义色**：JS 在 tick() 给 span `setAttribute("data-dsh-activity", ...)`，
 *     CSS 8 条 `[data-dsh-activity="..."]` 规则按类目着色——点继承 currentColor，
 *     单一着色真相源：
 *       think(思辨)=#2563eb 蓝 / read(输入)=#475569 中性 / write(变更)=#d97706 琥珀
 *       bash(执行)=#7c3aed 紫 / task(调度)=#0891b2 青 / plan(计划)=#059669 绿
 *       goal(跟踪)=#db2777 粉 / git(版本)=#64748b 石板 / generic(兜底)=DSH 三级灰
 *   - **hotfix（不 bump 版本）**：去垂直 padding（总高 18px 与 DSH 原生 turnStatus 同高，
 *     不再"高度膨胀"）+ 去 scale + 去 `transition: background-color/color`（消除颜色
 *     切换时的 250ms 过渡闪烁）+ 减弱呼吸幅度（.6↔.9 取代 .35↔.95）+ 减慢周期（2.4s
 *     取代 1.6s）——v0.9.3 首版发布后用户反馈"一闪一闪 + 高度会变 + 跟原生 Deep diving...
 *     不统一" 的根因修复
 *   - **性能**：tick() 用 `lastKey = category + "\u0000" + text` 合并去重——text 或
 *     category 任一变化才写 DOM（保持 v0.7.1 起的 `lastText` 节流效果，250ms 轮询
 *     × React reconciler 触发频率不变）
 *   - **兼容**：`.dsh-ui-tweaks-status` 类名 + `dsh-ui-tweaks-status-row` ID 不动
 *     （调试 API / 验证脚本仍命中）；localStorage `simpleModeEnabled` key 不动
 *     （老用户开关状态保留）；`visibility:visible !important` 兜底保留
 *   - **改动文件**：`25-tweaks.js` 的 simple-mode buildCSS（+~1.5 KB CSS，含 hotfix
 *     校准）+ `55-simple-mode.js` 加 `simpleActivityCategory(name)` + tick() 改 lastKey
 *     （+~400 B JS）+ `20-constants.js` 加 `SIMPLE_STATUS_ACTIVITY_ATTR` 1 行（+~50 B）
 *
 * v0.9.2：`first-message-jump` compaction 跳过 + 可见性放宽：
 *   - Shift+点击现在跳过 compact 摘要里的旧 user 行，直接到当前会话的第
 *     一条 user 消息（v0.9.1 落到 compaction 块下方的某条 user 行——
 *     bug）。新增 `jumpIsRowInCompaction(row)` 沿父链检查
 *     `data-chat-flow-kind="compaction"` / `"manual-compaction"` /
 *     `"context"` 容器，跳过其中的 user 行。
 *   - 可见性从 `target !== null` 放宽为 `rows.length >= 2`：短会话（2 条
 *     user 行）底部 TodoList / 进度卡片出现时也能看到按钮作为提示
 *     （v0.9.1 顶到底部 user 行 `topVisible === firstRow` → target=null
 *     → 按钮直接隐藏——用户反馈"老问题"）。
 *
 * v0.9.1：`first-message-jump` step-by-step 修复 + Shift+点击一键回到最早
 *   （双按钮对称）：
 *   - 锚点从 lastVisible（v0.9.0）改为 topVisible（v0.9.1），修复"上数第二条
 *     卡住"bug——v0.9.0 的 lastVisible 在短消息 + 滚到 rows[1] 时，因为下方
 *     rows[2..N] 仍可见 → lastVisible 始终是 rows[N] → target 始终是
 *     rows[N-1] → 死循环（按钮永不隐藏、永远到不了 rows[0]）。
 *   - 我的按钮：单击 = 上一条；**Shift+单击 = 一键回到最早**（恢复 v0.8.0
 *     的"一键回到最早"语义，但用 Shift 修饰与 step-by-step 共存）
 *   - 原生「回到底部」按钮：单击 = 下一条；**Shift+单击 = 一键到底**——
 *     v0.9.0 / v0.8.0 原生单击"一键到底"的语义现在需要 Shift 修饰；
 *     实现靠 capture-phase document click listener + shiftKey 分发
 *
 * v0.9.0：`first-message-jump` 改为单向上导航——按钮 = "上一条我发的消息"：
 *   点击 = 跳到当前视口内最底部可见 user 消息的上一条；连续点击可一路
 *   向上导航直到最早一条（按钮自动隐藏）。视口内无 user 行（用户在对话
 *   上方空白区）→ 点击跳到最后一条作为入口。按钮 DOM / 位置 / 尺寸 / 样式
 *   / ID / CSS 选择器全部不变；SVG 固定 ▲ 朝上，aria-label / title 固定为
 *   "上一条我发的消息"。localStorage key `firstMessageJump` 不动，老用户
 *   开关状态保留；tweak id `first-message-jump` 保留向后兼容，name 改
 *   `上一条我发的消息按钮`。
 *
 * v0.8.0：新增 first-message-jump「回到最早消息」tweak——对话区右下角
 *   （输入框上方）挂一个悬浮按钮，点击把当前会话最早一条 user 消息
 *   （[data-chat-flow-kind="user"] 第一行）滚到滚动区顶部，长会话里快速
 *   回看最初发的需求。纯 JS DOM 探测（[data-conversation-scroll] 滚动容器
 *   + [data-composer-seat]` 输入框），不依赖 DSH CSS module hash；按钮
 *   挂载 / 显隐 / 定位 / 点击滚动由新增的 68-first-message-jump.js
 *   createFirstMessageJumpController 负责（纯 finder/scanner 函数在
 *   68a-first-message-jump-utils.js——30 KB 阈值维护动作，行为无变化）。
 *   只在最早消息不在当前视口内时显示，右侧抽屉打开时自动隐藏；视觉对齐
 *   DSH 自带「回到底部」按钮。
 *
 * v0.7.5：
 *   1) hide-trajectory-tab 扩展：同时干掉每个工具调用 row 内的 "Inspect"
 *      按钮——DSH 源码 `dsh-client-ui-tool/lib/client.js` 渲染
 *      `<button class="*_inspectButton">`（当前 hash=`o3BgMG` / `CY-8Ka`），
 *      点击后调 `inspectCall(callId)` → `actions.setView("trajectory")`——
 *      本质也是进轨迹视图的入口。CSS 用 `[class*="_inspectButton"]` 命中
 *      （substring match，不依赖 hash——DSH 升级换 hash 仍然命中）。配合
 *      原有 `[data-dsh-ui-tweaks-hidden-tab="trajectory"]` 把"所有进入
 *      轨迹视图的入口"全部关闭，没有 80ms observer 节流闪烁窗口。
 *   2) Tweak row description 收进 HTML `title` 属性。旧实现每条 tweak
 *      始终渲染一段 1-3 行的描述文字（最长 60+ 字），6 条 tweak 在设置页
 *      铺满 200+ 像素高。新实现：description 默认不渲染，鼠标悬停在 row
 *      上时弹出浏览器原生 tooltip——CSS 仅加 `cursor:help` 一个属性。
 *      旧 `.DTPD_itemDesc` 规则移除。
 *
 * v0.7.4：hide-sidebar-tooltip 四次修复——v0.7.3 修了"闪一下"但留下"窄黑框"。
 *   根因：DSH Tooltip 组件是 `<span role="tooltip">` 没背景，纯文字；但 HoverCard
 *   组件的 **card div**（`createPortal(card, document.body)` 的产物）有独立 CSS 类
 *   `_card_<hash>_<line>`（当前 hash = `1b2ny`），CSS 内容是
 *     `position:fixed; z-index:100; width:244px; padding:12px 16px;
 *      border-radius:12px; background:#2C2C2E; box-shadow:lv3`。
 *   所以 v0.7.3 用 `[class*="_hoverContent"]` 隐藏**内容**后，card div 本身
 *   仍可见——背景色 #2C2C2E + box-shadow 就是用户看到的"窄黑框"。
 *
 *   修法：CSS 用 `:has()` 找"含 _hoverContent 后代的 body 直接子 div"——那就是
 *   card div 本身。`:has()` 在 Chromium 105+ 可用（DSH 是 Electron = Chromium），
 *   不依赖 hash。同时把 card class 也加进 CSS 选择器列表（用更具体的
 *   `_card_<hovercard 模块特征>` 模式）做双保险。
 *
 * v0.7.3：hide-sidebar-tooltip 的 HoverCard 部分三次修复——v0.7.1 的 JS
 *   observer 还是能看到"闪一下然后消失"。原因：HoverCard portal div mount
 *   到浏览器 paint 之间有至少一帧延迟；JS observer 即使去掉 80ms throttle
 *   用 microtask 调度，最早也要下一个 microtask 才标记 + 浏览器下一帧
 *   才应用 CSS——用户能看到一帧的"全称 X小时前 空闲"。
 *
 *   修法：CSS 直接命中 HoverCard 内部内容的 workspace CSS module hash 类
 *   （`_hoverContent / _hoverTitle / _hoverTime / _hoverStatus / _hoverPath`）
 *   → display:none!important。CSS 在 mount 时立即生效，根本不画——
 *   视觉上看不到"闪一下"。JS observer（v0.7.1 加的 data-dsh-ui-tweaks-hidden-hover-card
 *   标记）保留作 DSH 升级 hash 变了后的兜底（DSH 升级后 CSS selector 失效，
 *   JS observer 接管——可能闪 80ms，但不至于完全漏网）。
 *
 * v0.7.1：hide-sidebar-tooltip 二次修复——v0.6.1 把 selector 改成
 *   `[role="tooltip"]`，DSH 自己的 Tooltip 组件（`<span role="tooltip">`）确实
 *   被干掉了。但用户反馈"提示还是在"，"全称 X小时前 空闲 这样子"——
 *   实测那个**不是 Tooltip，是 HoverCard**！
 *
 * v0.7.0：新增 hide-trajectory-tab——对话顶部"轨迹"标签页（DSH 开发者视角的
 *   模型/工具事件账本）隐藏。非开发者根本用不上，看了也看不懂。
 *   实现：JS 端 MutationObserver 巡检 `[role="tablist"]` 找文本为 "轨迹"/
 *   "Trajectory" 的按钮，给它打 `data-dsh-ui-tweaks-hidden-tab="trajectory"`
 *   标记；CSS `[data-dsh-ui-tweaks-hidden-tab="trajectory"]{display:none!important}`
 *   隐藏。如果当前 view 正是轨迹（aria-selected="true"），点击"对话"/"Chat"
 *   标签自动切回对话页——避免用户卡在轨迹视图出不来。
 *
 * v0.6.1：hide-sidebar-tooltip 修复——v0.6.0 的三个 selector 都错。
 *   实测 DSH Tooltip 组件（`@deepseek-ai/dsh-client-ui-primitives/lib/types/Tooltip.js`）
 *   渲染时是 `<span role="tooltip" className={undefined} style={{left,top}}>`，
 *   作为锚点元素的兄弟节点 inline 渲染（**不 portal 到 body**），className 是
 *   `undefined`（CSS module stub 是 `var Tooltip_module_css_default = {};`）。
 *   所以 v0.6.0 的：
 *     `body > [role="tooltip"]` ← 不是 body 直接子级
 *     `body > div:has(> [role="tooltip"])` ← 同上
 *     `[class*="TooltipContent"]` ← className 是 undefined，无子串匹配
 *   三条 selector 一条都没命中。
 *   修法：直接 `[role="tooltip"]{display:none!important}`——DSH Tooltip 组件是
 *   唯一用 `role="tooltip"` 的地方，全局干掉无副作用（与 v0.6.0 文档描述
 *   "全局关闭"一致）。
 *
 * v0.6.0：在 v0.5.5 基础上新增 hide-sidebar-tooltip（用户反馈"悬停在左侧栏
 *   工作窗口时弹出展示会话全名的小方框"——Radix 风格的深色浮层根本用不上）。
 *   纯 CSS：隐藏 `body > [role="tooltip"]` + 浮动 portal wrapper +
 *   CSS Module `TooltipContent` 后缀——3 层覆盖 Radix UI Tooltip 在 sidebar
 *   hover 时挂出的任何浮层。如 DSH 升级用新 Tooltip 实现，往 buildCSS 的
 *   selector 列表追加一行即可，UI/开关/持久化完全不动。
 *
 * v0.5.5：v0.5.4 修复『来回弹』后导致『根本不移动』的回归——原因是
 *   startChatflowMarksObserver 在 apply() 跑得太早时找不到 centerCol
 *   （DSH React 还没渲染它），静默失败，DSH 后续渲染时没人去探测
 *   chatflow。修复：把 applyChatflowShiftMarks 集成到 self-shim observer
 *   回调里（self-shim observer 启动早、观察 body subtree，必然能捕获所有
 *   变化）作为兜底；applyChatflowShiftMarks 加幂等性（已是最优标记就
 *   跳过重打），保留 v0.5.4 修过的『不再来回弹』行为。
 *
 * v0.5.4：两处修复
 *   1. 开关动画加速 + 改用 Material 标准加速曲线。背景 / 滑块位移
 *      transition 从 `transition: ... .15s ease` 改为 `transition: ... .08s
 *      cubic-bezier(.4,0,.2,1)`（80ms + Material 标准曲线）。
 *   2. conversation-shift 修"来回弹"视觉循环：
 *      - 去掉 CSS transition（避免 MutationObserver 频繁重打标记时被打断产生
 *        "对话一直向中间拉过去，然后又弹回去"的视觉循环）
 *      - MutationObserver 收窄到只观察 centerCol 直接子元素（之前观察
 *        body+subtree=true，DSH React 在 chatflow 内部每次重渲都触发重打标记），
 *        且只在已标记的元素被 unmount/remount 时才重新探测
 *
 * v0.5.3：JS 动态探测 DOM（找真正的 chatflow 容器 + inputArea），打
 *   data 属性标记，CSS 只命中被标记的元素；探测失败回退标记列容器。
 *   修复 v0.5.2 `> *` 选择器没命中任何元素的问题。
 *
 * v0.5.2：conversation-shift 选择器策略重做——给列内容加 padding-right
 *   而不是给列容器加。让 chatflow 对话内容左移，列容器本身的滚动条 /
 *   滚动指示器保持在原位；padding 区域显示 chatflow 容器的背景色，
 *   与对话内容背景连续。
 *
 * v0.5.1：精简 UI + 修复 v0.5.0 引入的可用性 bug。
 *
 * v0.5.0 修复了什么：
 *  - self-shim + 4 层 fallback selector + MutationObserver，**不再依赖**任何
 *    `@linxin666/*` 桥接包。0 耦合。
 *  - 高对比度调试 outline（4px 黄 + 黑底白字浮动 label）
 *
 * v0.5.1 修复的可用性 bug（v0.4.0 / v0.5.0 用户反馈）：
 *  - 数值输入框之前用 `disabled={!enabled}`，默认 enabled=false 导致数字框锁死，
 *    反人类。**v0.5.1 起数字框永远可编辑**——可以先调像素再开开关
 *  - 开关的 `background` 之前用 `var(--dsw-alias-bg-component-disabled)`，
 *    在某些 DSH 主题下变量值接近背景色，开关**看不见**。
 *    v0.5.1 加 CSS fallback 颜色（`#cbd5e1` 关 / `#2563eb` 开），并显式加 border
 *  - 受控 input 用 draft + useEffect 链路——v0.5.1 改用 `value={value` 直接
 *    受控 + `onChange` 每键更新父 state，消除 race condition
 *  - 移除冗余 UI（每行"诊断"按钮 + 顶部"复制状态"按钮 + 对话区右边界红线 marker
 *    + 描述里的视觉锚点说明）——用户反馈"多此一举"
 *
 * 架构（v0.5.0 起沿用）：
 *  - self-shim 4 层 selector（L1 data-pane / L2 class*=centerCol / L3 grid 解析 /
 *    L4 兜底），加 MutationObserver 在 DSH React 重渲时重新种属性
 *  - 数据通路：localStorage 自管（STORAGE_KEY = "dsh-ui-tweaks/state"）
 *  - 诊断 API：`window.__dshUiTweaks = { VERSION, getState, getInjectedCSS,
 *    getMatchedElements, debug, setState, reshim }`
 *  - TWEAKS 数组仍是 UI + CSS + 持久化的单一数据源
 */
