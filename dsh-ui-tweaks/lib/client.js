/**
 * dsh-ui-tweaks — 浏览器端（web client bundle，作者：MeganeOnly）
 *
 * v0.10.4：设置页开关尺寸回退到 v0.5.1 之前的紧凑 pill——真的「圆圆的」需要更紧凑的尺寸
 *
 *   用户反馈：v0.10.3 修了 border 之后开关「看起来还是方方的」。
 *
 *   根因：v0.10.3 标题写「回归 v0.5.1 之前的「圆圆的」pill 形态」但**只完成了一半**——
 *   v0.6.0 合并 simple-mode 进 ui-tweaks 时，把 `.DTPD_switch` 尺寸从 v0.5.1 的
 *   `34×20` / thumb `16×16` 调大到 `36×22` / thumb `18×18`，**同时**加了 1px solid border。
 *   v0.10.3 只删了 border、但忘了把尺寸回退——结果是「无 border 的 36×22 大版本」，
 *   在 22px 高度上 thumb `18×18 + top:1px` 只剩 2px 上下边距、pill 两端的圆形
 *   轮廓被厚 thumb 压缩，视觉上仍是「方圆」（chunky rectangle）。
 *
 *   「圆圆的」v0.5.1 形态：34×20 + thumb 16×16 + top:2px left:2px + 4px 上下边距
 *   —— pill 两端的圆形轮廓明显可见，跟用户记忆中一致。
 *
 *   修法：尺寸三个值同时回退——
 *     - `.DTPD_switch` 的 `width:36px;height:22px` → `width:34px;height:20px`
 *     - `.DTPD_switch::after` 的 `width:18px;height:18px;top:1px;left:1px` → `width:16px;height:16px;top:2px;left:2px`
 *     - `.DTPD_switch:checked::after` 的 `transform:translateX(14px)` 保持不变
 *       （34px 宽里 14+16+2=32、knob 右边距 2px；36px 宽里 14+18+1=33、knob 右边距 3px——
 *       数值上 translateX 14px 在两种宽度下都成立，knob 右侧都留 2-3px gap）
 *   其它属性（border-radius:999px / thumb border-radius:50% / thumb box-shadow /
 *   off 态 fallback 色 / transition / flex / margin / padding 等）全部保留。
 *
 *   兼容性：tweak id / localStorage key / 类名 / 调试 API / 设置页 UI / React 组件
 *   / debug API / 节流轮询 等全部不动；只改 `35-styles.js` SECTION_CSS 的
 *   `.DTPD_switch` / `.DTPD_switch::after` 两个选择器的 width/height/top/left
 *   共四个值，老用户开关状态保留、关闭/开启行为零变化。
 *
 *   诊断：浏览器 DevTools inspect 设置页 `.DTPD_switch` 元素——
 *     - Computed 面板 `width` 应是 `34px`、`height` 应是 `20px`（v0.10.3 时是 36×22）
 *     - Computed 面板 `border-radius` 仍是 `999px`、`border` 仍是 `medium none currentcolor`
 *     - `::after` 伪元素 `width` 应是 `16px`、`height` 应是 `16px`、`top` 应是 `2px`、
 *       `left` 起始 `2px` / 勾选后 `16px`（v0.10.3 时是 18×18 + top:1 / left:1 → 15）
 *     - 视觉上 pill 两端圆形轮廓比 v0.10.3 更明显（thumb 上下边距从 2px 增到 4px，
 *       pill 高度的 20% 留给 thumb 之外的轨道），跟 v0.5.1 之前一致
 *
 *   改动文件：`lib/client-src/35-styles.js`（SECTION_CSS 的 `.DTPD_switch` /
 *   `.DTPD_switch::after` 尺寸回退 + JSDoc 加 v0.10.4 段）；`lib/client-src/20-constants.js`
 *   （VERSION 0.10.3 → 0.10.4 + 头部 v0.10.4 注释）；`lib/client-src/00-banner.js`（本段）；
 *   `package.json`（version 0.10.3 → 0.10.4 + description 同步）；`CHANGELOG.md`
 *   加 [0.10.4] 段；走 `npm run build:client` + `node --check lib/client.js`
 *   语法校验通过。
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
 *   修法（部分）：去掉 `border:1px solid ...` 这一段，其它所有属性（width:36px / height:22px /
 *   border-radius:999px / thumb 18×18 + 50% / thumb box-shadow）保留。off 态靠
 *   `background:var(--dsw-alias-bg-component-disabled,#cbd5e1)` 的 fallback 颜色
 *   （亮色主题 `#cbd5e1` 浅灰 / 暗色主题走 var 解析值）保持可见，不依赖 border
 *   兜底——v0.5.1 之前就是这个状态，本来就够清晰。
 *
 *   **本次只完成了一半**：尺寸仍为 v0.6.0 放大的 36×22 / thumb 18×18，没回退到
 *   v0.5.1 的 34×20 / thumb 16×16。用户实测「去掉边框后还是方方的」→ v0.10.4
 *   继续把尺寸回退到 v0.5.1 之前的 34×20 / thumb 16×16。详见 v0.10.4 banner 段。
 *
 *   兼容性：tweak id / localStorage key / 类名 / 调试 API / 设置页 UI 全部不动；
 *   只改 `35-styles.js` SECTION_CSS 的 `.DTPD_switch` 一行（删掉 border 声明）。
 *   老用户开关状态保留。
 *
 *   诊断：浏览器 DevTools inspect 设置页开关元素，Computed 面板 `border` 应是
 *   `medium none currentcolor`（无 border），`border-radius` 仍是 `999px`；
 *   pill 形态与 v0.5.1 之前**部分**一致（border 一致，尺寸仍是 v0.6.0 放大版）。
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
window.__ModuleLoader__.load({
  id: "dsh-ui-tweaks",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var react = require("react");
    var jsxRuntime = require("react/jsx-runtime");

    var inject = ["slots"];

    // ===== constants =====
        // v0.10.1：stats-line-position 隐藏底部原生行时改用 `visibility:hidden`
        //   而不是 `display:none`——用户反馈 v0.10.0 "发消息的框往下走了一点点"。
        //   根因：统计行是 composer 卡片的 footer（高 24px = line-height 20 +
        //   padding-top 4），而 composer seat 是 `position:sticky;bottom:0` 贴底的
        //   （DSH `.wSkVaW_composerSeat`），卡片变矮 24px 就等于输入行整体下移
        //   24px。visibility 保留盒子（照常参与布局、React 照常更新其文本），
        //   高度分毫不差地保留 → 输入框位置与"底部"位置完全一致；比补一个
        //   硬编码 24px padding 更稳（不依赖 DSH 的字号 / 行高 / padding 数值）。
        //   代价：非"底部"位置时输入框下方保留一条 24px 空白——这正是把输入框
        //   钉在原位所必须的空间。详见 `25-tweaks.js` 的 stats-line-position
        //   buildCSS v0.10.1 段 + `00-banner.js` v0.10.1 banner 段。
        // v0.10.0：新增 stats-line-position tweak——对话底部那行统计
        //   （"N 轮 · M 步 | LLM ... | 首 token ... | 缓存命中 ...% | 输入/输出 tok"）
        //   现在可三选一：底部（DSH 默认）/ 顶部标题右侧 / 不显示。
        //   这是本插件第一条**非布尔**的 tweak——configKeys.enabled 存的是
        //   "bottom" / "top" / "hidden" 字符串；TweakRow 通过新增的
        //   `choices` 字段判断渲染下拉框而非开关（有 choices 就不渲染开关）。
        //   实现要点见 `69-stats-line-position.js` 头部注释：
        //     - 隐藏走纯 CSS（`[data-slot="conversation.composer.dock"]`
        //       出口 visibility:hidden !important，v0.10.1 起；v0.10.0 曾用
        //       display:none 但会让贴底的输入框下移 24px）——DSH renderer
        //       给每个 slot 出口包的 `data-slot` 属性不含 hash，比 CSS module
        //       类名稳定
        //     - 顶部走"镜像"（本插件 createElement 的元素 append 到标题簇
        //       末尾，周期性克隆原生行内容）——不搬 React 拥有的 DOM 节点，
        //       避免 React 卸载原节点时 removeChild 找不到父节点而崩树
        // v0.9.15：sidebar-match-conversation-bg 用户实测"展开页面左上角的
        //   部分，过一会就会变成灰色，我鼠标光标移动到上面的时候，又变成
        //   了白色，移走一段时间，又变成灰色"——v0.9.9/v0.9.13/v0.9.14 三层
        //   都只覆盖 column + 已知 _root 后代，没考虑 DSH 侧栏作用域内 CSS
        //   变量 `--dsw-specific-sidebar-fill` 的扩散——DSH 内部 sidebarCol /
        //   SidebarRoot 都引用此变量赋值 background，column + inner root
        //   直接 background 覆盖可能因 DSH 后续调整（如 cascade 重排、
        //   HMR 重注入、theme 异步应用、panel hover 切换状态等）失效，
        //   露出 sidebar-fill 的灰；hover 触发某些透明层覆盖又显出白色
        //   frame 背景；hover 出后透明层消失重新露出 inner root 的灰。
        //   修法：三层兜底——① 列显式 background + !important 强化
        //   + ② 内部 _root 后代 background + ③ `--dsw-specific-sidebar-fill`
        //   变量级覆盖为 transparent，让侧栏作用域内任何 `var(--dsw-specific-sidebar-fill)`
        //   引用解析为透明，从根上消除"侧栏内任何元素用 sidebar-fill 色
        //   覆盖 frame 背景"的可能。
        //   兼容性：tweak id / localStorage key / 调试 API / 类名 / ID /
        //   attribute / 设置页 UI 全部不动；只多了一条 `--dsw-specific-sidebar-fill`
        //   变量覆盖 + 列选择器显式 background。DSH 升级换 hash 也仍命中
        //   （className 仍含 `_root` 子串；变量覆盖作用于整个作用域，新元素
        //   也被覆盖）。
        //   详见 `25-tweaks.js` 的 sidebar-match-conversation-bg buildCSS
        //   v0.9.15 段 + `00-banner.js` v0.9.15 banner 段 + CHANGELOG v0.9.15。
        // v0.9.14：sidebar-match-conversation-bg v0.9.13 在收起态失效——
        //   DSH SidebarRoot 收起态额外加 `hHd-Xa_collapsed` + `hHd-Xa_railIn`
        //   + `hHd-Xa_quietBars` 类，整个 className 字符串从 `"hHd-Xa_root"`
        //   变成 `"hHd-Xa_root hHd-Xa_collapsed hHd-Xa_railIn hHd-Xa_quietBars"`，
        //   末尾不再是 `_root`——`[class$="_root"]` ends-with 匹配失效，小侧栏
        //   仍显示 `--dsw-specific-sidebar-fill` 的灰。改 `[class*="_root"]`
        //   contains 后与 className 拼接顺序无关，展开 / 收起两态都命中。
        //   其他 tweak / 类名 / ID / attribute / localStorage key / 调试 API
        //   全不动。详见 `25-tweaks.js` 的 sidebar-match-conversation-bg
        //   buildCSS v0.9.14 段 + `00-banner.js` v0.9.14 banner 段 + CHANGELOG v0.9.14。
        // v0.9.13：sidebar-match-conversation-bg v0.9.9 选择器只命中 sidebarCol，
        //   但 DSH AppFrame 内的 `<div class="hHd-Xa_root">`（SidebarRoot 组件根，
        //   height:100%）也设了 `background:var(--dsw-specific-sidebar-fill)`，
        //   完全覆盖 column——column 改背景视觉上仍被 inner 的特定色盖住，
        //   用户实测"开启后无变化"。修法：选择器同时命中 column + 其内
        //   SidebarRoot（`[class*="_root"]` contains，DSH CSS module
        //   `<hash>_<name>_root` 约定，hash-independence；后代选择器
        //   兼容 DSH 后续在两者间加包装层）。其他 tweak / 类名 /
        //   ID / attribute / localStorage key / 调试 API 全不动。详见
        //   `25-tweaks.js` 的 sidebar-match-conversation-bg buildCSS v0.9.13 段
        //   + `00-banner.js` v0.9.13 banner 段 + CHANGELOG v0.9.13。
        // v0.9.12：simple-mode 状态行 v0.9.10 CSS 三层 reset 兜不住 DSH 后续添加的
        //   loader / shimmer 子元素；走 v0.9.10 CHANGELOG [Unreleased] line 63 预设的
        //   JS 回退路径——`createSimpleModeStatusController#purgeTurnStatus()` 在
        //   appendChild 前清空容器并保留 clock；`watchTurnStatus()` 升级观察
        //   document.body subtree（含 DSH 重渲时新增的任何 turnStatus 立即 purge），
        //   杀零 tick 250ms 间隔的闪援窗口。同时修"几次穿插后像首行缩进"——CSS 加
        //   `padding-left:0 !important` + `margin-left:0 !important`，JS 同步把 inline
        //   `style.paddingLeft / marginLeft` 归零。详情见 `lib/client-src/55-simple-mode.js`
        //   v0.9.12 banner 段 + `25-tweaks.js` simple-mode buildCSS v0.9.12 增量段。
        // v0.9.11：simple-mode 防御性 layout zero——用户反馈"两边的字之间的距离会特别大
        //   但有时候会有时候不会"。根因：`display:none` 在某些 layout context（CSS Grid
        //   / React VirtualList fixed slot / React inline style min-height based on
        //   child 内容等）下不一定让元素彻底不占布局空间。间距时大时小正对应 layout
        //   重算发生在 React 重渲时。修法：把 hidden block 的 height / min-height /
        //   max-height / margin / padding / border / outline / flex-basis /
        //   flex-grow / grid-area 全部显式归零——在 block / flex / grid / virtual list
        //   任意 layout context 下都不留残余高度。兼容性：纯 CSS 加固。
        // v0.9.10：simple-mode 状态行 v0.9.8 reset 不彻底——用户反馈"底部的 正在思考
        //   还是会一闪一闪的 而且位置依赖（最左侧不闪，右移一点开始闪）"。
        //   v0.9.8 只 reset 了 animation / background / background-clip，DSH 可能用
        //   transition + mask-image linear-gradient 替代 animation 做 shimmer（animation:none
        //   杀不掉 transition 驱动的效果）；也可能在容器里多塞新 child 做动画 / 在 ::before
        //   上放 spinner。v0.9.10 三层防线：1) 容器升级 reset（+ transition / text-shadow /
        //   box-shadow / filter / mask-image / transform / overflow 等）2) 伪元素
        //   ::before / ::after 显式 display:none 3) 直接子元素除我们 span 和 clock 外
        //   全部 display:none。clock 也加防御性 reset。兼容性：纯 CSS 加固，所有类名 /
        //   ID / attribute / localStorage key 不动。
        // v0.9.9：新增 sidebar-match-conversation-bg tweak——DSH 默认侧栏（data-pane="sidebar"）
        //   有独立背景色，与对话区（data-pane="conversation"）的 --dsw-alias-bg-base
        //   不同。开启后把侧栏列容器的背景设为对话区同款，让两个区域在背景色上融合。
        //   CSS 用 `var(--dsw-alias-bg-base,var(--dsw-alias-bg-layer-1,#ffffff))` 三层
        //   fallback 链（来源证据：dsh-ssh 的 mL8Uca_panel 用 --dsw-alias-bg-base 与
        //   对话区"无缝融入"；dsh-client-ui-skin-center #712 注释明确 AppFrame frame +
        //   conversation root + details root 是 shell surfaces 共用 bg-base，侧栏不在列）。
        //   子元素（会话项 / 按钮 / hover 态）不动——只改列容器背景。默认 OFF。
        //   见 25-tweaks.js 的 sidebar-match-conversation-bg buildCSS。
        // v0.9.8：simple-mode 状态行接管 DSH 原生 turnStatus 视觉呈现——
        //   用户反馈三个问题（"正在处理 还在闪" / "时间想出现在 后面" /
        //   "还是比原生高一点点"）根因不是 v0.9.7 撤掉的自家 pulse，而是
        //   DSH `dsh-client-ui-conversation/lib/client.js:5591` 原生
        //   TurnStatus 组件的 shimmer effect（gradient + background-clip:text
        //   + 1.8s linear infinite dsh-turn-status-shimmer）。我们的 span
        //   appendChild 到这个容器里，被 shimmer 染到。整容器接管：
        //   1) 杀 shimmer：[class*="turnStatus"]{animation:none; background:none;
        //      background-clip:border-box; -webkit-text-fill-color:initial}
        //   2) 抹 "Deep diving..." 文字节点：父级 color:transparent + font-size:0
        //      + 子级 override（DSH .turnStatusClock 也必须 override）
        //   3) 容器 26px → 18px：之前 18px text 在 26px 容器居中垂直空白太多
        //   4) DSH .turnStatusClock flex order:2 重排到我们 span（order:1）后——
        //      "时间出现在 后面" 纯 CSS 解决，DSH 1s setInterval 自动维护
        //   5) 8 类活动色 + -webkit-text-fill-color 同色 override（防父级传递）
        //   其它 ID/class/attribute/localStorage key / debug API 全保留。
        // v0.9.7：simple-mode 状态行两轮「去装饰」——撤自家 pulse 和 pill 灰底
        //   （v0.9.8 接管整容器后 v0.9.7 那些 CSS 规则被父级 reset 影响）。
        // v0.9.5：simple-mode 状态行工具名识别修复——simplePickToolNameFromDom
        // 之前查 [data-tool-name]（错属性），DSH 实际渲染 [data-tool]（见
        // dsh-client-ui-tool ToolRow.js）；同时新增 simpleIsThinkingFromDom
        // 识别 reasoning block（不在 tool-call 容器里，assistant-step
        // data-variant="think"）。两处合并让 v0.9.3 美术度升级的 8 类语义色
        // 真正生效（think 蓝 / read 中性 / write 琥珀 / bash 紫 / task 青 /
        // plan 绿 / goal 粉 / git 石板——之前一直停在 generic 灰）。
        // v0.10.2：conversation-shift 双 padding bug + 窄屏不可用 bug 修复
        //   1) chatflow 探测升级首选 DSH 稳定锚点 [data-conversation-scroll]
        //      ——空会话（hero composer 无消息）也能命中。命中即返回，
        //      **不再额外标 input**——scrollBody 在 DSH 结构里已包了 composerSeat，
        //      单 padding 同步影响消息 + 输入框；v0.5.3 同时标 chatflow+input
        //      导致双 padding 在窄屏叠加成不可用宽度（680-760=-80 溢出）
        //   2) CSS 改成 `padding-right: min(Npx, 40%)`——保留用户在全屏的偏好像素，
        //      半屏时 40% 上限自动收紧到「聊天列 60% 内容 + 40% 右缩」的比例
        //   详见 `45-chatflow-marks.js` v0.10.2 banner 段 + `25-tweaks.js` 的
        //   conversation-shift buildCSS v0.10.2 注释段。
        // v0.10.4：把 `.DTPD_switch` 尺寸从 v0.6.0 起放大的 `36×22` /
        //   thumb `18×18` 回退到 v0.5.1 之前的 `34×20` / thumb `16×16`——
        //   用户实测反馈 v0.10.3 修了 border 但「开关看起来还是方方的」，
        //   真正的「圆圆的」需要在更紧凑的尺寸下两端圆形轮廓才能显现。
        //   v0.6.0 合并 simple-mode 时一并把尺寸调大（border 也是那时加
        //   的），v0.10.3 只删 border、忘了改尺寸；本次完整回退到 v0.5.1
        //   之前的紧凑 pill。translateX 保持 `14px`（数值上 34px 宽与
        //   36px 宽都能让 knob 右边距保持 2-3px）。详见 `35-styles.js`
        //   的 v0.10.4 注释段 + CHANGELOG [0.10.4]。
        // v0.10.3：去掉设置页开关的 1px solid border（v0.6.0 起加的）——
        //   用户反馈边框让 pill 看起来「有点方圆」不够圆润，去掉后跟
        //   v0.5.1 之前无边框版一致。off 态靠 background fallback 色（`#cbd5e1`）
        //   保持可见，无需 border 兜底。但本次仅去 border、未恢复尺寸——
        //   尺寸仍为 v0.6.0 放大的 36×22 / thumb 18×18，用户实测「去掉
        //   边框后还是方方的」→ v0.10.4 继续把尺寸回退到 v0.5.1 之前的
        //   34×20 / thumb 16×16。详见 `35-styles.js` 的 v0.10.4 注释段。
        var VERSION = "0.10.4";
        var MAIN_CSS_TAG_ID = "dsh-ui-tweaks/main.css";
        var SECTION_CSS_TAG_ID = "dsh-ui-tweaks/Section.css";
        var STORAGE_KEY = "dsh-ui-tweaks/state";
        var DEBUG_HTML_ATTR = "data-dsh-ui-tweaks-shift-debug";
        var SHIM_PANE_ATTR = "data-pane";
        var SHIM_PANE_VALUE = "conversation";
        var SHELL_FRAME_ATTR = "data-pane-shell";
        var SHELL_FRAME_VALUE = "frame";
        var SHELL_SIDEBAR_ATTR_VALUE = "sidebar";
        var SHELL_DETAILS_ATTR_VALUE = "details";
        var STATE_EVENT = "dsh-ui-tweaks-state-change";
        var DEBUG_API_KEY = "__dshUiTweaks";
        var SIMPLE_STATUS_ID = "dsh-ui-tweaks-status-row";
        var SIMPLE_STATUS_CLASS = "dsh-ui-tweaks-status";
        // v0.9.3：tick() 给状态 span 写 data-dsh-activity 标记当前活动类目（think / read /
        // write / bash / task / plan / goal / git / generic），CSS 按类目着色。
        // span 由 ensureStatusSpan() 创建并由本插件独占——与 DSH 内部属性不冲突。
        var SIMPLE_STATUS_ACTIVITY_ATTR = "data-dsh-activity";
        var SIMPLE_TURN_STATUS_SEL = '[class*="turnStatus"]';
        var SIMPLE_POLL_MS = 250;
        // v0.9.6：折叠块末尾收起按钮——给所有 DisclosureRow 展开后的 body 末尾
        //   追加"收起"按钮，解决"展开后想收起需要一直往前翻到头部"的痛点。
        //   目标三类 DisclosureRow：ReasoningRow（Think, data-variant="think"）、
        //   GenericCommandCard（工具调用输出, data-variant="others"）、
        //   ContextInjectionRow（上下文注入, class 含 _root 且 data-open）。
        //   button 在 body 元素里（wrapper div + button），点击时找 body 父元素
        //   里 rowClassName 那行调 .click()——DSH React onToggle 触发折叠，body 与
        //   按钮一起被卸载；stopPropagation 避免冒泡到 row（虽然 row 是 body 兄弟
        //   不是祖先，但 click 也会途经 DisclosureRow wrapper——保险起见 stop）。
        var DISCLOSURE_END_COLLAPSE_WRAP_ATTR = "data-dsh-ui-tweaks-disclosure-collapse-wrap";
        var DISCLOSURE_END_COLLAPSE_ATTR = "data-dsh-ui-tweaks-disclosure-collapse";
        // 三大 DisclosureRow 的 body 选择器（暴露给 controller 复用）
        var DISCLOSURE_BODY_SELECTORS = [
          '[data-variant="think"] [class*="thinkBody"]',
          '[data-variant="others"] [class*="_body"]',
          '[class*="_root"][data-open] [class*="_body"]'
        ].join(", ");
        // v0.10.0：统计行位置（stats-line-position tweak）。
        //   锚点全部走 DSH renderer 的 slot 出口属性 `data-slot="<slot key>"`
        //   （dsh-client-ui-renderer SlotOutlet 给每个出口包一层
        //   `<div data-slot=... style="display:contents">`）——不含 CSS module
        //   hash，跨 DSH 版本稳定；只有兜底选择器才用 `[class*="..."]` 子串匹配。
        var STATS_DOCK_SEL = '[data-slot="conversation.composer.dock"]';          // 底部统计行出口（唯一占位者 = StatsLine）
        var STATS_HEADER_ACTIONS_SEL = '[data-slot="conversation.session.header.actions"]'; // 顶部"模式"标签出口（其祖父 = 标题簇）
        var STATS_TITLE_CLUSTER_HINT_SEL = '[class*="_titleCluster"]';            // 兜底：标题簇（对话名 + 模式那一簇）
        var STATS_ROOT_HINT_SEL = '[class*="_root"]';                             // 出口内定位 StatsLine 根元素
        var STATS_MIRROR_ATTR = "data-dsh-ui-tweaks-stats-mirror";                // 顶部镜像元素标记（本插件独占）
        var STATS_POS_BOTTOM = "bottom";
        var STATS_POS_TOP = "top";
        var STATS_POS_HIDDEN = "hidden";
        var STATS_POLL_MS = 400;   // 镜像同步轮询间隔（统计行按"步"更新，不必更密）
        // v0.5.3：动态探测 chatflow 容器 + 输入框，打标记给 CSS 命中
        var SHIFT_TARGET_ATTR = "data-dsh-ui-tweaks-shift-target";
        var SHIFT_TARGET_CHATFLOW = "chatflow";
        var SHIFT_TARGET_INPUT = "input";
        var SHIFT_TARGET_COLUMN = "column";  // 兜底：探测失败时标记列容器
        // v0.10.2：DSH 稳定锚点首选——ConversationRoot.scrollBody 上的
        //   `data-conversation-scroll=""`（DSH 源码 `dsh-client-ui-conversation/
        //   lib/client.js:7277` 显式 `setAttribute` 的属性，不含构建 hash）。
        //   与 v0.8.0 JUMP_SCROLL_SEL 是同一个属性，但本 tweak 用于「整列右缩」
        //   而 first-message-jump 用于「滚到上一条 user 行」——职责不同、保持
        //   各自常量便于读者按文件回溯。两者同时为 DSH 升级兼容锚点：DSH 改名
        //   时本常量 + JUMP_SCROLL_SEL 同步更新即可。
        var SHIFT_SCROLL_SEL = "[data-conversation-scroll]";
        // v0.8.0：「回到最早消息」按钮（first-message-jump tweak）→ v0.9.0 改为「上一条」导航
        var JUMP_BTN_ID = "dsh-ui-tweaks-jump-btn";
        var JUMP_SCROLL_SEL = "[data-conversation-scroll]";   // DSH 会话滚动容器（scrollBody）
        var JUMP_USER_ROW_SEL = '[data-chat-flow-kind="user"]'; // 用户消息行（ChatNodeSeat）
        var JUMP_COMPOSER_SEL = "[data-composer-seat]";        // 输入框 seat（sticky bottom）
        var JUMP_DRAWER_ATTR = "data-dsh-any-side-drawer-open"; // 右侧抽屉互斥统一 attr
        var JUMP_TOP_PADDING = 12;   // 跳转后目标 user 行顶部与视口顶部的留白
        var JUMP_NATIVE_GAP = 8;     // 主路径：按钮底缘悬在原生「回到底部」按钮顶部的间距
        // v0.9.2：可见性放宽（rows.length >= 2）+ Shift+点击跳过 compaction 块直达"当前会话第一条"
        var JUMP_LABEL = "上一条我发的消息";  // aria-label（单一语义，与 v0.9.0 / v0.9.1 同）
        // v0.9.1：title 加 Shift 修饰提示——浏览器原生 tooltip 悬停时显示；
        // aria-label 不加，避免屏幕阅读器读出"shift+点击"这种修饰
        var JUMP_BUTTON_TITLE = "上一条我发的消息（Shift+点击 = 回到最早）";  // title 属性（v0.9.1 新增）
        // SVG 上箭头（与 v0.8.0 同一 path：▲ 朝上表示"上一条"）
        var JUMP_SVG_UP = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 10.5L8 6l4.5 4.5"/></svg>';

    // ===== tweaks =====
    /**
     * 集中维护的 UI 微调清单。每条 tweak：
     *   - id：稳定标识（注入 CSS 注释 + React key）
     *   - name：人类可读标题
     *   - description：人类可读说明（用户视角，不写开发者术语）
     *   - configKeys.enabled / configKeys.value：localStorage 持久化的字段名
     *   - defaults：未设值时的默认
     *   - buildCSS(state)：根据当前 state 生成 CSS 字符串；返回 null 表示不输出
     *     （但 side effect 仍由 apply() 协调——调试模式切 <html> 属性等）
     */
    var TWEAKS = [
      {
        id: "conversation-shift",
        name: "对话区右缩",
        description: "让对话列内的对话内容（消息气泡）整体左移 N 像素，腾出右侧空间——列容器本身宽度不变，滚动条与滚动指示器保持在原位。v0.10.2 起像素值在窄屏自动收紧到对话列宽度的 40%（`min(Npx, 40%)`），避免半屏浏览器时 380px 缩进吃掉过多对话宽度。",
        configKeys: { enabled: "conversationShift", value: "conversationShiftPx" },
        defaults: { enabled: false, value: 380 },
        buildCSS: function (state) {
          if (!state.conversationShift) return null;
          var px = Number(state.conversationShiftPx);
          if (!isFinite(px) || px < 0) px = 380;
          if (px > 800) px = 800; // safety cap
          // v0.5.3 + v0.5.4：命中 JS 探测标记的元素，无 transition
          // （去掉 transition 是 v0.5.4 的关键修复：避免在 MutationObserver 频繁重打
          //   标记时被打断产生"来回弹"视觉循环）
          // v0.10.2：`min(380px, 40%)` 适配窄屏——保留用户在全屏的偏好像素，半屏时
          //   40% 上限自动收紧到「聊天列 60% 内容 + 40% 右缩」的比例，聊天气泡（DSH
          //   `--dsh-chat-content-width:748px`）始终可读。CSS `min()` 是逐元素计
          //   算的——`padding-right:min(380px,40%)` 里 40% 是父元素（命中元素本身
          //   的直接父 = ConversationRoot / scrollBody 包裹层）宽度的 40%。需要更小
          //   比例可在设置页直接改 conversationShiftPx；需要更激进收紧请改本 CSS。
          return "/* === conversation-shift : 命中 JS 探测标记的元素 min(" + px + "px, 40%)（v0.10.2 起，窄屏自动收紧；无 transition）=== */\n" +
            "html [" + SHIFT_TARGET_ATTR + "]{padding-right:min(" + px + "px,40%) !important;box-sizing:border-box !important;}";
        }
      },
      {
        id: "conversation-shift-debug",
        name: "对话右缩调试高亮",
        description: "开启后给命中的对话列加 4px 黄色 outline + 黑底白字浮动标签（标签显示当前右缩像素值）。调试用——对话右缩关闭时也能开。",
        configKeys: { enabled: "conversationShiftDebug", value: "conversationShiftDebug" },
        defaults: { enabled: false, value: false },
        // 调试高亮的 CSS 由 buildDebugHighlightCSS() 统一生成（依赖 conversationShiftPx），
        // 这里返回 null。apply() 在切调试模式时调用 applyDebugMode() 处理。
        // 保留这条 buildCSS 是为了满足 TWEAKS 数据契约（每条 tweak 必须有 buildCSS 字段），
        // 抽掉会让 buildCSS() 内需要 if (id === "conversation-shift-debug") 分支，
        // 反而破坏"数组即唯一真理"的约定。
        buildCSS: function (state) {
          return null;
        }
      },
      {
        id: "simple-mode",
        name: "简洁模式",
        description: "隐藏思考与工具调用过程，只在输入框上方显示一条极简状态行（正在思考…/正在阅读…/正在执行命令…）。",
        // 仅开关型 tweak：enabled 和 value 复用同一 key。TweakRow 通过
        // `hasValueInput = k2 !== k1` 检测 k1===k2 时不渲染数字输入框——这样
        // localStorage 里只存一个布尔字段，不浪费空间，也不暴露无意义的数字配置。
        // 其它"有数字输入框"的 tweak (如 conversation-shift) 用 enabled + value
        // 两个不同的 key。
        configKeys: { enabled: "simpleModeEnabled", value: "simpleModeEnabled" },
        defaults: { enabled: true, value: true },
        // v0.9.3 三轴（pill + 呼吸 @keyframes + 8 类活动色）已在 v0.9.7 撤掉；
        // 当前是纯静态圆点 + 8 类活动色（见下方 ::before 注释）。
        buildCSS: function (state) {
          if (!state.simpleModeEnabled) return null;
          return "/* === simple-mode : hide tool-call / context / think / process rows === */\n" +
            // v0.9.11：防御性 layout zero——`display:none` 在某些 layout context
            //   （CSS Grid / React VirtualList / parent 有 inline style min-height
            //   基于 child 内容等）下不一定让元素彻底不占布局空间——virtual list
            //   每个 item 有 fixed slot，`display:none` 不会回收 slot；CSS Grid
            //   `grid-template-rows: masonry` 类似；React 给 parent 设的
            //   `style={{minHeight: ...}}` 也不被 child 的 `display:none` 影响。
            //   用户反馈"两边的字之间的距离会特别大 但有时候会有时候不会"——
            //   间距时大时小正对应 layout 重算发生在 React 重渲时（旧消息按"已收敛
            //   layout"渲染间距正常，新消息边渲边 hide 时 layout 未收敛间距偏大）。
            //   修法：把 hidden block 的 height / min-height / max-height /
            //   margin / padding / border / outline / flex-basis / flex-grow /
            //   grid-area 全部显式归零——在 block / flex / grid / virtual list
            //   任意 layout context 下都不留残余高度。
            //   兼容性：纯 CSS 加固，不动类名 / ID / attribute / localStorage key。
            '[data-chat-flow-kind="tool-call"],' +
            '[data-chat-flow-kind="context"],' +
            '[data-variant="think"],' +
            '[data-chat-flow-kind="compaction"],' +
            '[data-chat-flow-kind="manual-compaction"],' +
            '[data-chat-flow-kind="model-retry"],' +
            '[data-chat-flow-kind="turn-error"],' +
            '[data-chat-flow-kind="turn-max-tokens"]{' +
              "display:none !important;" +
              "height:0 !important;" +
              "min-height:0 !important;" +
              "max-height:0 !important;" +
              "margin:0 !important;" +
              "padding:0 !important;" +
              "border:0 !important;" +
              "outline:0 !important;" +
              "flex:0 0 0 !important;" +
              "flex-basis:0 !important;" +
              "flex-grow:0 !important;" +
              "grid-area:auto !important" +
            "}\n" +
            // —— v0.9.10 status row —— 接管 DSH 原生 turnStatus 视觉呈现。
            //   v0.9.8 整容器接管：杀 DSH animation / background / background-clip /
            //   -webkit-text-fill-color / color:transparent / font-size:0 抹 DSH 文字 /
            //   容器 26px → 18px / flex order 重排 clock。
            //   v0.9.10 用户反馈"底部的 正在思考 还是会一闪一闪的 而且位置依赖
            //   （最左侧不闪，右移一点开始闪）"——v0.9.8 的 reset 不够彻底。三层防线：
            //
            //   **第 1 层**：容器本身的 reset 升级——v0.9.8 只 reset 了 animation /
            //     background / background-clip。v0.9.10 加 transition / text-shadow /
            //     box-shadow / filter / -webkit-mask-image / mask-image / transform
            //     等"非 animation 但能产生 shimmer 视觉效果"的属性全部杀掉——
            //     DSH 完全可能用 `transition + mask-image linear-gradient` 替代
            //     animation 做 shimmer（animation:none 杀不掉 transition 驱动的效果）。
            //     加 background-image / background-size / background-position 等
            //     详细 background 子属性 reset（background:none 不一定覆盖 background-image:
            //     linear-gradient / -webkit-mask-image 等）。加 overflow:hidden
            //     裁掉任何超出容器宽度的子元素视觉溢出。
            //
            //   **第 2 层**：伪元素 ::before / ::after 显式杀掉——v0.9.8 容器 reset 不
            //     传递到伪元素的具体 background / animation。DSH 完全可能在 ::before
            //     上放 spinner / shimmer 装饰元素。display:none + content:none 双保险。
            //
            //   **第 3 层**：直接子元素除我们 span 和 clock 外全部 display:none——
            //     DSH 完全可能在容器里多塞 <div class="turnStatusLoader"> 之类的新
            //     child 做动画。子元素选择器（[class*="turnStatus"] > *）不依赖 hash，
            //     DSH 升级换 class 名 / 加新 child 都一律干掉。
            //   child 隐藏的副作用：DSH "Deep diving..." 文字节点是 text node 不是
            //     element，CSS selector 命中不到——但 v0.9.8 起父级 color:transparent +
            //     font-size:0 已让它无形 + 零宽，足够；第 3 层只防 DSH 新加 element child。
            //
            //   关于位置依赖（最左侧不闪 / 右移一点闪）：最可能是 mask-image +
            //     background-position + transition 驱动的 shimmer（gradient 范围在容器
            //     内某段，文字在容器内某位置，两者重叠时 shimmer 可见，不重叠时不闪），
            //     也可能是 DSH 新加的 child loader（位于容器左侧，文字右移到 loader
            //     区域就闪）。两层 reset + child 隐藏覆盖两种可能。
            //
            //   保留：v0.9.7 引入的 transition:color .4s ease（活动色平滑过渡）；
            //     visibility:visible !important（v0.7.1 起的祖先 display:none 兜底）。
            //
            //   兼容性：[class*="turnStatus"] / [class*="turnStatusClock"] / .dsh-ui-tweaks-status
            //     类名 / ID / attribute / localStorage key 全不动——纯 CSS 加固。
            //
            //   v0.9.12 增量（补 v0.9.10 / v0.9.11 还没修干净的症状）：
            //   - 用户反馈"几次 think / 工具调用穿插后状态行像是首行缩进"——
            //     DSH 在 assistant-step 节点累加后会沿父链逐步加上 padding-left
            //     缩进，CSS reset 作用在 `[class*="turnStatus"]` 节点本身不够（祖先
            //     链上的 padding 才能视觉上把 status 推右）。补 `padding-left:0 !important`
            //     + `margin-left:0 !important` 让 status 始终贴容器左侧，配合
            //     `55-simple-mode.js#purgeTurnStatus()` 走 inline `style.paddingLeft / marginLeft`
            //     兜底 DSH 通过 inline style 设的 padding。flash 的彻底根治在 JS 层——见
            //     `lib/client-src/55-simple-mode.js` v0.9.12 banner 段说明。
            // visibility:visible !important 仍保留（v0.7.1 起的祖先 display:none 兜底）
            "[class*=\"turnStatus\"]{" +
              // 容器 reset——v0.9.8 起的基础 + v0.9.10 增量
              "animation:none !important;" +
              "background:none !important;" +
              "background-image:none !important;" +
              "background-clip:border-box !important;" +
              "background-attachment:initial !important;" +
              "background-blend-mode:initial !important;" +
              "background-origin:initial !important;" +
              "background-position:initial !important;" +
              "background-repeat:initial !important;" +
              "background-size:initial !important;" +
              "-webkit-background-clip:border-box !important;" +
              "-webkit-text-fill-color:initial !important;" +
              "color:transparent !important;" +
              "font-size:0 !important;" +
              "line-height:0 !important;" +
              "height:18px !important;" +
              "align-items:center !important;" +
              // v0.9.10 新增——杀 transition / shadow / filter / mask 等 animation 之外的
              //   视觉动效源（DSH 完全可能用 transition + mask-position 做 shimmer）
              "transition:none !important;" +
              "text-shadow:none !important;" +
              "box-shadow:none !important;" +
              "filter:none !important;" +
              "-webkit-mask-image:none !important;" +
              "mask-image:none !important;" +
              "-webkit-mask-size:initial !important;" +
              "mask-size:initial !important;" +
              "-webkit-mask-position:initial !important;" +
              "mask-position:initial !important;" +
              "-webkit-mask-repeat:initial !important;" +
              "mask-repeat:initial !important;" +
              "transform:none !important;" +
              "opacity:1 !important;" +
              "text-indent:0 !important;" +
              "letter-spacing:normal !important;" +
              "word-spacing:normal !important;" +
              "text-decoration:none !important;" +
              // v0.9.12：padding-left / margin-left 显式归零——用户反馈"几次穿插后像
              //   首行缩进"——DSH 在 assistant-step 累加后给 turnStatus 父链加缩进
              //   padding 是常见手法，我方 CSS reset 只作用当前节点不够。padding 归
              //   零让状态行始终贴容器左侧。inline 兜底由 55-simple-mode.js 的
              //   purgeTurnStatus() 同步保证。
              "padding-left:0 !important;" +
              "margin-left:0 !important;" +
              // 裁掉任何超出容器宽度的子元素视觉溢出（DSH loader / shimmer 即使没被 child
              //   选择器命中也可能溢出到容器外）
              "overflow:hidden !important" +
            "}\n" +
            // v0.9.10：伪元素显式杀掉——DSH 经常在 ::before / ::after 上放 spinner / shimmer
            //   装饰，容器 animation:none 不传递到伪元素的具体 background / 自身 animation
            "[class*=\"turnStatus\"]::before," +
            "[class*=\"turnStatus\"]::after{" +
              "animation:none !important;" +
              "background:none !important;" +
              "background-image:none !important;" +
              "-webkit-background-clip:border-box !important;" +
              "-webkit-text-fill-color:initial !important;" +
              "color:transparent !important;" +
              "content:none !important;" +
              "display:none !important;" +
              "height:0 !important;" +
              "width:0 !important;" +
              "margin:0 !important;" +
              "padding:0 !important;" +
              "transition:none !important;" +
              "transform:none !important;" +
              "filter:none !important;" +
              "-webkit-mask-image:none !important;" +
              "mask-image:none !important;" +
              "text-shadow:none !important;" +
              "box-shadow:none !important" +
            "}\n" +
            // v0.9.10：直接子元素除我们 span 和 clock 外全部隐藏——DSH 完全可能在容器里
            //   多塞新 child（<div class="turnStatusLoader"> 等）做动画。substring selector
            //   不依赖 hash，DSH 升级换 class 名 / 加新 child 一律干掉。text node 不是
            //   element 命中不到，但 v0.9.8 起父级 color:transparent + font-size:0 已让它
            //   无形 + 零宽
            "[class*=\"turnStatus\"] > *:not(.dsh-ui-tweaks-status):not([class*=\"turnStatusClock\"]){display:none !important}\n" +
            ".dsh-ui-tweaks-status{" +
              "display:inline-flex !important;" +
              "align-items:center;" +
              "gap:6px;" +
              "padding:0;" +
              "margin-left:0;" +
              "font-size:13px !important;" +
              "line-height:18px;" +
              "height:18px;" +
              "color:var(--dsw-alias-label-tertiary) !important;" +
              "-webkit-text-fill-color:var(--dsw-alias-label-tertiary) !important;" +
              "vertical-align:middle;" +
              "flex:none;" +
              "white-space:nowrap;" +
              "order:1;" +
              "transition:color .4s ease, -webkit-text-fill-color .4s ease;" +
              "visibility:visible !important" +
            "}\n" +
            // —— 静态点 ::before —— v0.9.7 撤掉 v0.9.3–v0.9.6 的呼吸动画
            //   （用户反馈：2.4s 周期 opacity .6↔.9 持续闪烁太难受——
            //   "一闪一闪"的感觉比活动切换的"现在还在跑"信号更强，反客为主。
            //   用户表态宁可切换不那么准确、过渡缓慢，也不能接受脉动）。
            //   保留 6×6 圆点作为"当前有一个活动"的视觉锚，颜色继承
            //   currentColor 跟着文字的 8 类活动色一起平滑过渡（.4s ease），
            //   opacity 0.7 不抢戏。无 animation / 无 transition，完全静态。
            //   活动色变化在 .dsh-ui-tweaks-status 上 transition:color .4s ease
            //   接管——text + ::before dot 都跟着平滑过渡。
            ".dsh-ui-tweaks-status::before{" +
              "content:\"\";" +
              "width:6px;" +
              "height:6px;" +
              "border-radius:50%;" +
              "background:currentColor;" +
              "opacity:.7;" +
              "flex:none" +
            "}\n" +
            // —— DSH 自带 .turnStatusClock 时间元素 —— v0.9.8 用 flex order
            //   重排到我们 span 后面（order:2 vs ours 1），解决用户反馈
            //   "时间出现在 正在处理...的后面"——纯 CSS、无新 DOM。DSH 自己
            //   每 1s setInterval 自动更新文本，15s 后才出现（DSH 原生
            //   `showClock = elapsedMs >= 15e3`，不改）。font-size:0 从父级
            //   继承会被吃掉，必须显式 override 到 13px；颜色与活动色独立——
            //   始终 tertiary，不跟活动色走（时间应该是中性信息，不抢戏）。
            //   font-variant-numeric:tabular-nums 让数字宽度一致（"5s"→"10s"
            //   切换时数字部分不抖）。
            //   v0.9.10：clock 加防御性 reset——DSH clock 自己可能有 shadow /
            //   filter / mask 等 animation 之外的视觉效果
            "[class*=\"turnStatusClock\"]{" +
              "order:2;" +
              "margin-left:8px;" +
              "font-size:13px !important;" +
              "color:var(--dsw-alias-label-tertiary);" +
              "-webkit-text-fill-color:var(--dsw-alias-label-tertiary);" +
              "font-variant-numeric:tabular-nums;" +
              "font-weight:400;" +
              "animation:none !important;" +
              "background:none !important;" +
              "background-image:none !important;" +
              "-webkit-background-clip:border-box !important;" +
              "transition:none !important;" +
              "text-shadow:none !important;" +
              "box-shadow:none !important;" +
              "filter:none !important;" +
              "-webkit-mask-image:none !important;" +
              "mask-image:none !important;" +
              "visibility:visible !important" +
            "}\n" +
            // —— 8 类活动语义色 —— JS tick() 给 span setAttribute("data-dsh-activity", ...)
            // 顺序：think (思辨) / read (输入) / write (变更) / bash (执行) /
            //       task (调度) / plan (计划) / goal (跟踪) / git (版本) / generic (兜底)
            // 硬值 fallback——主题切到没有这些变量的主题时仍能着色
            ".dsh-ui-tweaks-status[data-dsh-activity=\"think\"]   {color:#2563eb !important;-webkit-text-fill-color:#2563eb !important}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"read\"]    {color:#475569 !important;-webkit-text-fill-color:#475569 !important}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"write\"]   {color:#d97706 !important;-webkit-text-fill-color:#d97706 !important}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"bash\"]    {color:#7c3aed !important;-webkit-text-fill-color:#7c3aed !important}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"task\"]    {color:#0891b2 !important;-webkit-text-fill-color:#0891b2 !important}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"plan\"]    {color:#059669 !important;-webkit-text-fill-color:#059669 !important}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"goal\"]    {color:#db2777 !important;-webkit-text-fill-color:#db2777 !important}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"git\"]     {color:#64748b !important;-webkit-text-fill-color:#64748b !important}" +
            ".dsh-ui-tweaks-status[data-dsh-activity=\"generic\"] {color:var(--dsw-alias-label-tertiary) !important;-webkit-text-fill-color:var(--dsw-alias-label-tertiary) !important}";
        }
      },
      {
        // v0.6.0 新增 → v0.6.1 修 Tooltip selector → v0.6.2 补 HoverCard selector。
        //
        // 历史：
        // v0.6.0 三 selector 全错（Radix portal 假设错的——DSH 不用 Radix）。
        // v0.6.1 改成 `[role="tooltip"]`——杀掉了 DSH Tooltip 组件（确实修好了
        //   "新会话"等按钮上的简短 Tooltip 浮层）。
        // v0.6.2 发现用户报的"全称 X小时前 空闲"提示**不是 Tooltip，是 HoverCard**！
        //   HoverCard 在 `dsh-client-ui-primitives/lib/types/HoverCard.js`：card 通过
        //   `createPortal(card, document.body)` 渲染到 body 直接子级 div，没有 className
        //   （HoverCard.module.css 是空 stub），role 只在 copyable 时才有。
        //   内部内容是 SessionHoverContent / WorkspaceHoverContent，CSS Module hash
        //   类名 `YDXeBa_hoverContent / _hoverTitle / _hoverTime / _hoverStatus / _hoverPath`。
        //   修法：JS MutationObserver 巡检 body 直接子 div，找到含上面任一 hash
        //   类的，打 `data-dsh-ui-tweaks-hidden-hover-card` 标记；CSS 命中隐藏。
        // v0.7.3 v0.6.2 修了 HoverCard 但用户反馈"闪一下然后消失"——因为
        //   JS observer 至少要一个 microtask + 80ms throttle 才标记 + 浏览器
        //   下一帧才应用 CSS。这段窗口期用户能看到一帧的"全称 X小时前 空闲"。
        //   修法：CSS 直接命中 HoverCard 内部内容的 hash 类（_hoverContent /
        //   _hoverTitle / _hoverTime / _hoverStatus / _hoverPath 任一）→
        //   display:none!important。CSS 在 mount 时立即生效，根本不画——
        //   视觉上看不到"闪一下"。JS observer 保留作 DSH 升级 hash 变了后
        //   的兜底。
        // v0.7.4 v0.7.3 还有"窄黑框"——因为 HoverCard card div（不是内容）有
        //   自己的 CSS 类 `_card_<hash>_<line>`（当前 hash=1b2ny），CSS 内容是
        //     `position:fixed; z-index:100; width:244px; padding:12px 16px;
        //      border-radius:12px; background:#2C2C2E; box-shadow:lv3`。
        //   隐藏了 _hoverContent 内容，但 card div 本身（背景色 #2C2C2E）还在。
        //   修法：用 CSS `:has()` 找"含 _hoverContent 后代的 body 直接子 div"
        //   ——就是 card div。`:has()` 在 Chromium 105+ 可用，DSH Electron 是现代 Chromium。
        //   同时用更具体的 card class 模式（`_card_<hovercard module hash>`）
        //   做双保险。CSS 在 mount 时立即生效——彻底消除"闪"+"窄框"。
        id: "hide-sidebar-tooltip",
        name: "隐藏侧栏悬浮提示",
        description: "鼠标悬停在左侧栏会话项 / 工作窗口时弹出的深色卡片——展示会话全名 + 相对时间 + 状态（开发者用的 HoverCard），以及按钮上的简短 Tooltip 浮层。开启后全部关掉，根本用不上。",
        configKeys: { enabled: "hideSidebarTooltip", value: "hideSidebarTooltip" },
        defaults: { enabled: true, value: true },
        buildCSS: function (state) {
          if (!state.hideSidebarTooltip) return null;
          return "/* === hide-sidebar-tooltip v0.7.4 : DSH Tooltip + HoverCard (含 card div 本体) — 四层 selector === */\n" +
            // L1: DSH Tooltip 组件（@deepseek-ai/dsh-client-ui-primitives 的 Tooltip.js）
            //     渲染 <span role="tooltip"> 作为锚点的兄弟节点 inline 渲染——
            //     不 portal 到 body；className 是 undefined（CSS module stub 是空对象）。
            //     全 app 里 role="tooltip" 只在 Tooltip 组件里出现——全局干掉无副作用。
            "[role=\"tooltip\"]{display:none!important}\n" +
            // L2: HoverCard **内容** CSS module hash 类（DSH workspace 包，当前 hash 是 YDXeBa_）。
            //     隐藏 SessionHoverContent / WorkspaceHoverContent 内部元素——
            //     标题、时间、状态、路径。
            //     这是**主防线**——CSS 在 mount 时立即生效，根本不画。
            "[class*=\"_hoverContent\"],[class*=\"_hoverTitle\"],[class*=\"_hoverTime\"],[class*=\"_hoverStatus\"],[class*=\"_hoverPath\"]{display:none!important}\n" +
            // L3: HoverCard **card div 本身**——v0.7.4 新增。card div 有自己的 CSS 类
            //     `_card_<hash>_<line>`，CSS 给它 `background:#2C2C2E; box-shadow:lv3`——
            //     即使隐藏了内容（v0.7.3），card 背景框仍在——就是用户看到的"窄黑框"。
            //     用 `:has(> [class*=_hoverContent])` 找"含 hoverContent 直接子元素
            //     的 body > div"——这是 card div（content 是它的直接子元素）。
            //     `:has()` 在 Chromium 105+ 可用，DSH Electron 是现代 Chromium。
            //     这条不依赖 hash——彻底解决"窄框"问题。
            "body > div:has(> [class*=\"_hoverContent\"]){display:none!important}\n" +
            // L4: 兜底——JS observer（v0.7.1 加的 createSidebarHoverCardHider）
            //     给 portal 出来的 body > div 打 data-dsh-ui-tweaks-hidden-hover-card
            //     标记。L2/L3 失效时（DSH 升级 hash 变了 或 :has() 不支持）L4 接管——
            //     可能闪 80ms+（observer throttle），但不会完全漏。
            "[data-dsh-ui-tweaks-hidden-hover-card]{display:none!important}";
        }
      },
      {
        // v0.7.0 新增。DSH 对话顶部在 v0.1.0-rc.X 起多了"轨迹"标签页
        // （id="trajectory"）——开发者视角的模型/工具调用事件账本（turn/step/
        // tool-call 时间线 + 详细记录）。非开发者根本不需要，看了也看不懂。
        //
        // 渲染结构（DSH 源码 `dsh-client-ui-conversation/lib/client.js:7034-7047`）：
        //   tabs = [role="tablist"] 容器
        //   tabs.map(viewTab => jsx("button", { role:"tab", "aria-selected":..., children: viewTab.label }))
        //   viewTab.label = t("view.trajectory") → "轨迹"(zh) / "Trajectory"(en)
        //
        // 纯 CSS 没法匹配"按钮文本是 轨迹"—CSS 没有 :text() 选择器。
        // 解法：JS 端用 MutationObserver 巡检 [role="tablist"] 找文本匹配的按钮，
        // 给它打 data-dsh-ui-tweaks-hidden-tab="trajectory" 标记 → CSS 命中隐藏。
        // 配套副作用：如果当前 view 正是轨迹（aria-selected="true"），点击"对话"/
        // "Chat" 标签自动切回对话页——避免用户卡在轨迹视图出不来。
        //
        // v0.7.5：tab 按钮外的"Inspect" 入口也封掉——DSH 在每个工具调用
        // （edit / pwsh / read / grep / glob / bash / write 等）的 row 右上
        // 渲染一个 `<button class="*_inspectButton">`（CSS Module hash class，
        // 当前 hash=`o3BgMG` / `CY-8Ka`），点击后调 `inspectCall(callId)` →
        // `actions.setView("trajectory")`——本质也是进轨迹视图的入口。
        // 用户开 hide-trajectory-tab 的目的是"所有轨迹入口都不见"，所以
        // 这条 tweak 同时干掉两类入口：
        //   1) 顶部 tablist 的"轨迹"/"Trajectory"按钮（v0.7.0 起，JS 标记 +
        //      CSS attribute selector 命中）
        //   2) 每个工具行内的"Inspect"按钮（v0.7.5 起，CSS substring 命中
        //      `[class*="_inspectButton"]`，不依赖 hash——DSH 升级换 hash 也
        //      不需要改这里）
        // 工具行 Inspect 按钮 hover 时 `opacity:1` 的过渡（transition:opacity
        // .1s）会在 hide-trajectory-tab 关掉时正常 fade in——这里 `display:none
        // !important` 直接消失，没有 fade 闪烁窗口。
        id: "hide-trajectory-tab",
        name: "隐藏对话中的\"轨迹\"标签",
        description: "对话顶部多了一个\"轨迹\"标签——展示模型/工具调用的事件账本（开发者视角）。同时把每个工具调用行（edit / pwsh / read / grep 等）右上角的\"Inspect\"按钮也关掉——点击它也会进入轨迹视图。非开发者用不上，看着也容易困惑。开启后完全隐藏这些入口；如果当前正停在轨迹视图会自动切回对话页。",
        configKeys: { enabled: "hideTrajectoryTab", value: "hideTrajectoryTab" },
        defaults: { enabled: true, value: true },
        buildCSS: function (state) {
          if (!state.hideTrajectoryTab) return null;
          return "/* === hide-trajectory-tab v0.7.5 : 顶部 tablist 的 \"轨迹\"/\"Trajectory\" 按钮 + 每个工具行的 \"Inspect\" 按钮 === */\n" +
            // 顶部 tablist 的"轨迹"/"Trajectory" 按钮——JS observer 标记 + CSS attribute selector 命中。
            // 纯 CSS 没法匹配"按钮文本是 轨迹"—CSS 没有 :text() 选择器；JS observer 巡检
            // [role="tablist"] 找文本匹配按钮打标记，CSS 命中隐藏。
            "[data-dsh-ui-tweaks-hidden-tab=\"trajectory\"]{display:none!important}\n" +
            // v0.7.5 新增：每个工具调用 row 内的"Inspect"按钮——
            // DSH 源码 `dsh-client-ui-tool/lib/client.js` 中 ToolRow / BashRow
            // 渲染 `<button class="*_inspectButton">`，点击后调
            // `inspectCall(callId)` → `actions.setView("trajectory")` ——也是
            // 进入轨迹视图的入口。substring match `_inspectButton` 不依赖 hash，
            // DSH 升级换 hash 仍然命中。
            "[class*=\"_inspectButton\"]{display:none!important}";
        }
      },
      {
        // v0.7.2 新增。和 hide-trajectory-tab 配套——两个 tab 按钮都关掉后，
        // tablist 整体视觉上消失（DSH `tabs.length > 1` 才渲染 tablist——
        // 但 DSH 仍注册 2 个 view entry，所以 tablist DOM 还在，只是两个按钮
        // 都被 display:none）。
        //
        // 单独开 hide-chat-tab 也有意义：默认 view 永远是"对话"，标签按钮
        // 显示"对话"毫无信息量（用户看到它也不会做任何事）——纯视觉噪音。
        // 开启后整个 tablist 视觉消失（前提是也开了 hide-trajectory-tab）。
        //
        // 实现和 trajectory hider 一样：JS 端用通用 createTabHider 工厂（v0.7.2
        // 重构了 createTrajectoryTabHider 为 createTabHider(opts)），target="对话"，
        // safe="对话"（DSH 默认 view）——如果当前不在对话（比如用户手动切到轨迹
        // 后再开启 hide-chat-tab），强制 click 对话切回。
        id: "hide-chat-tab",
        name: "隐藏对话中的\"对话\"标签",
        description: "对话顶部\"对话\"标签——开启后和 hide-trajectory-tab 一起把两个标签都关掉，整个 tablist 视觉消失。\"对话\"是默认 view，标签显示它毫无信息量，纯噪音。如果当前正停在轨迹视图会自动切回对话页。",
        configKeys: { enabled: "hideChatTab", value: "hideChatTab" },
        defaults: { enabled: true, value: true },
        buildCSS: function (state) {
          if (!state.hideChatTab) return null;
          return "/* === hide-chat-tab v0.7.2 : JS-side MutationObserver 给 \"对话\"/\"Chat\" 按钮打 data-dsh-ui-tweaks-hidden-tab=\"chat\"，CSS 命中隐藏 === */\n" +
            "[data-dsh-ui-tweaks-hidden-tab=\"chat\"]{display:none!important}";
        }
      },
      {
        // v0.9.6 新增：折叠块末尾收起按钮。DSH 用 DisclosureRow 渲染三类可展开块——
        //   ReasoningRow (data-variant="think") / GenericCommandCard (data-variant="others")
        //   / ContextInjectionRow (class 含 _root 且 data-open)。展开后阅读完毕想收起时
        //   必须滚回头部点行——长 Think 内容滚回很烦。
        // 解决：在每个展开后 body 末尾追加一个"收起 ▴"按钮（仅当 expanded 时 body 才会
        //   在 DOM 里），点击调用 row.click() 触发 DSH React onToggle 折叠。
        // 默认 ON——本 tweak 是 v0.9.6 新引入，无 backward compat 顾虑。
        // CSS 输出：按钮 wrapper 强制 display:block 独占一行，按钮 chip 形态（边框 + 圆角 +
        //   hover 背景）；DSH 主题变量 fallback 链防止主题切到没有这些变量的仍可见。
        id: "disclosure-end-collapse",
        name: "展开块末尾收起按钮",
        description: "Think / 工具调用 / 上下文注入等折叠块展开后，末尾追加一个\"收起\"按钮——阅读到底部能直接收起，不用滚回头部再点行。",
        // 仅开关型 tweak：enabled 和 value 复用同一 key（与 simple-mode 同模式），
        //   localStorage 只存一个布尔字段；TweakRow 通过 k2===k1 检测不渲染数字框。
        configKeys: { enabled: "disclosureEndCollapse", value: "disclosureEndCollapse" },
        defaults: { enabled: true, value: true },
        buildCSS: function (state) {
          if (!state.disclosureEndCollapse) return null;
          return "/* === disclosure-end-collapse v0.9.6 : DisclosureRow 展开后 body 末尾追加\"收起\"按钮 (Think / 工具调用输出 / 上下文注入) === */\n" +
            // wrapper div 强制 display:block 让按钮独占一行——不被 pre-wrap 文本内联吃掉
            "[data-dsh-ui-tweaks-disclosure-collapse-wrap]{display:block;margin:6px 0 2px 0}\n" +
            // 按钮 chip 形态：边框 + 圆角 + hover 背景；DSH 主题变量 fallback 链
            "[data-dsh-ui-tweaks-disclosure-collapse]{" +
              "display:inline-flex;" +
              "align-items:center;" +
              "gap:4px;" +
              "padding:3px 10px;" +
              "border:1px solid var(--dsw-alias-border-l1,#e5e7eb);" +
              "border-radius:6px;" +
              "background:var(--dsw-alias-bg-layer-1,#ffffff);" +
              "color:var(--dsw-alias-label-tertiary,#6b7280);" +
              "font-size:12px;" +
              "line-height:16px;" +
              "cursor:pointer;" +
              "user-select:none;" +
              "font-family:inherit;" +
              "transition:background .12s ease,color .12s ease,border-color .12s ease" +
            "}\n" +
            "[data-dsh-ui-tweaks-disclosure-collapse]:hover{" +
              "background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04));" +
              "color:var(--dsw-alias-label-secondary,#374151);" +
              "border-color:var(--dsw-alias-border-l2,#d0d5dd)" +
            "}\n" +
            "[data-dsh-ui-tweaks-disclosure-collapse]:focus-visible{" +
              "outline:2px solid var(--dsw-alias-state-business-primary,#2563eb);" +
              "outline-offset:2px" +
            "}";
        }
      },
      {
        // v0.8.0 新增「回到最早消息」（v0.8.0 单击直达）。
        // v0.9.0 改为「上一条」单向上导航（v0.9.0 用 lastVisible 作锚点，
        //   短消息场景下"上数第二条"卡死——见 jumpFindPrevUserRow 注释）。
        // v0.9.1：上数第二条 bug 修复（lastVisible → topVisible）+ Shift+点击
        //   一键回到最早 + 原生「回到底部」按钮同步改为单击下一条 / Shift+点击
        //   一键到底。
        // v0.9.2：可见性放宽（rows.length >= 2 即显示，短会话也可见）+ Shift+
        //   点击跳过 compaction 块直达"当前会话第一条"（不再落到 compact
        //   摘要里的旧 user 行）。
        // 按钮形态 / 位置 / 尺寸 / ID / CSS 选择器 / 内部 path 全不变；
        // aria-label 保持单一语义「上一条我发的消息」；title 加 Shift 修饰
        // 提示供悬停时查看。
        // 按钮的挂载 / 显隐 / 定位 / 点击滚动 / 原生按钮 capture-phase 钩子
        // 由 68-first-message-jump.js 的 createFirstMessageJumpController 负责；
        // 纯 finder/scanner 函数（jumpFindScrollport / jumpAllUserRows /
        // jumpFindPrevUserRow 等）在 68a-first-message-jump-utils.js——主
        // 文件 vs 工具文件拆分是 maintainability.md 30 KB 阈值的维护动作，
        // 行为无变化（client-src/ 按文件名升序整段拼接进 bundle，函数名
        // 共享工厂函数 scope）。
        // 本 buildCSS 只输出按钮的静态样式（right/bottom 定位由 JS 每次显隐时
        // 内联设置）。
        // tweak id / localStorage key（firstMessageJump）保留向后兼容，老用户
        // 开关状态不丢。
        id: "first-message-jump",
        name: "上一条我发的消息按钮（Shift+点击 = 回到最早）",
        description: "对话区右下角悬浮按钮——单击跳到当前视口内最顶部可见 user 消息的上一条，连续单击可一路向上直到最早一条（按钮始终可见作为提示——v0.9.2 起 rows.length>=2 即显示）。Shift+单击 = 跳过 compact 摘要里的旧 user 行，直接到当前会话的第一条 user 消息（v0.9.2 起跳过 compaction / context 容器）。对称地，DSH 自带「回到底部」按钮的单击行为也被改为：单击 = 下一条 user 行，Shift+单击 = 一键到底——两个按钮都用「单击 step / Shift+单击 极限」的对称模式。",
        configKeys: { enabled: "firstMessageJump", value: "firstMessageJump" },
        defaults: { enabled: true, value: true },
        buildCSS: function (state) {
          if (!state.firstMessageJump) return null;
          return "/* === first-message-jump v0.9.2 : 上一条我发的消息按钮（单击上一条 / Shift+单击跳过 compaction 块直达当前会话第一条；样式对齐 DSH 自带「回到底部」按钮）=== */\n" +
            "[data-dsh-ui-tweaks-jump]{" +
              "position:fixed;" +
              "right:20px;" +
              "bottom:180px;" +  // 兜底初值；每次显隐时 JS 重设 right/bottom
              "width:34px;height:34px;" +
              "border-radius:100px;" +
              "border:1px solid var(--dsw-alias-border-l2,#d0d5dd);" +
              "color:var(--dsw-alias-label-primary,#111827);" +
              "background:var(--dsw-alias-button-floating-fill,#ffffff);" +
              "box-shadow:var(--dsw-shadow-lv2,0 2px 8px rgba(0,0,0,.12));" +
              "cursor:pointer;" +
              "display:flex;align-items:center;justify-content:center;" +
              "z-index:90;" +
              "padding:0;margin:0;" +
              "opacity:0;" +
              "pointer-events:none;" +
              "transform:translateY(6px);" +
              "transition:opacity .18s ease,transform .18s ease,background .12s ease;" +
            "}\n" +
            "[data-dsh-ui-tweaks-jump]:hover{" +
              "background:var(--dsw-alias-button-floating-hover,#f1f3f5);" +
            "}\n" +
            "[data-dsh-ui-tweaks-jump][data-visible]{opacity:1;pointer-events:auto;transform:translateY(0);}";
        }
      },
      {
        // v0.9.9 新增：侧栏背景与对话一致。
        //
        // 用户反馈：DSH 默认侧栏（展示会话列表的左侧栏，data-pane="sidebar"）
        //   有自己独立的背景色，与对话区（data-pane="conversation"）的
        //   `--dsw-alias-bg-base` 不同——视觉上有清晰的边界分割。开启后让
        //   两个区域在背景色上融合。
        //
        // 实现：纯 CSS 一条规则——把 [data-pane="sidebar"] 的 background 设为
        //   与对话区同款的 DSH 主题变量 `--dsw-alias-bg-base`。来源证据：
        //     - dsh-ssh 的 panel（"data-pane=conversation" 上的 mL8Uca_panel）
        //       用 `background:var(--dsw-alias-bg-base)` 来"无缝融入"对话区
        //     - dsh-client-ui-skin-center #712 注释明确 AppFrame frame +
        //       conversation root + details root 共同"paint the opaque app
        //       base background via hashed CSS-module classes"——侧栏不在
        //       这个列表里，所以有独立的视觉背景
        //   fallback 链：`--dsw-alias-bg-base` → `--dsw-alias-bg-layer-1` →
        //   `#ffffff`——主题切到没定义 bg-base 时退化到 layer-1（与简单
        //   模式状态行按钮背景同款），再退化到硬值白。
        //
        // v0.9.13 增量：v0.9.9 只命中 sidebarCol，但 DSH AppFrame 内 `<div class="
        //   pI_x6G_sidebarCol">`（column，self-shim 在这层打 data-pane="sidebar"）
        //   与其内 `<div class="hHd-Xa_root">`（SidebarRoot 组件根，height:100%）
        //   **都**有 `background:var(--dsw-specific-sidebar-fill)`——inner root
        //   完全覆盖 column（height:100% + flex 布局），column 改背景后视觉
        //   上仍被 inner 的 specific-sidebar-fill（与对话不同的灰色 / 深灰）
        //   覆盖。实测"开启后视觉无变化"。修法：选择器同时命中 column 与
        //   内部 SidebarRoot（`[class*="_root"]` contains 匹配 DSH CSS module
        //   命名约定 `<hash>_<name>_root`，hash-independence 与 v0.7.3 HoverCard
        //   同策略），让两层都用 bg-base。
        //   - 列 column（v0.9.9 已命中）：命中 background 实际不可见但保持——
        //     DSH 后续给 column 加新 wrapper（DragHandle 等）可能露出底色
        //   - inner root（v0.9.13 新增）：实际可见侧栏 UI 容器，必须改
        //   - 列边框 border-right 保留——用户原意是背景一致，不是无边界；
        //     边框分割由 border 单独承担，移除会偏离需求
        //   - 子元素（会话项 / 按钮 / hover 态）不动——它们有功能性背景，
        //     视觉行为零变化
        //   - 后代选择器（无 `>`）：DSH 当前 sidebarCol 直接子就是 SidebarRoot，
        //     但若未来在两者间加 wrapper（如动画层 / portal mount point），
        //     后代选择器仍能命中内部 `_root`；直接子选择器 `>` 会被切断。
        //     内层 qDHVXG_root（WorkspaceList 根，目前无 background）即使被
        //     命中也没视觉副作用（无 bg → bg-base 仍透明覆盖）；若 DSH 后续
        //     给它加 background，bg-base 仍是一致的对话区色——保持视觉统一
        //   - **v0.9.14 增量**：用 `*=`（contains）而非 `*=` 上的 `^=` 或 `$=`——
        //     DSH SidebarRoot 在收起状态额外加 `hHd-Xa_collapsed` + `hHd-Xa_railIn`
        //     类，整个 className 字符串从 `"hHd-Xa_root"` 变成
        //     `"hHd-Xa_root hHd-Xa_collapsed hHd-Xa_railIn hHd-Xa_quietBars"`
        //     （末尾是 `_railIn` 或 `_quietBars`），`[class$="_root"]` ends-with
        //     匹配失效——收起时小侧栏仍是 `--dsw-specific-sidebar-fill` 的灰。
        //     改 `[class*="_root"]` contains 后匹配 className 任何位置含 `_root`
        //     子串的元素，与 className 是否拼接后续修饰类无关，展开/收起两态
        //     都命中
        //
        // 默认 OFF：本 tweak 是 v0.9.9 新引入，倾向保守——老用户升级后默认
        //   视觉不变，需要在设置页显式开启；与 v0.9.6 disclosure-end-collapse
        //   的"默认 ON"反着来（后者是修复 UX 痛点必开，前者是视觉偏好可选）。
        id: "sidebar-match-conversation-bg",
        name: "侧栏背景与对话一致",
        description: "DSH 默认左侧栏（展示会话列表的区域）有独立的背景色，与对话区视觉上有明显分割。开启后把侧栏列容器及其内 SidebarRoot（高度 100% 完全覆盖列容器）的背景都设为对话区同款，让两个区域在背景色上融合。会话项 / 按钮 / hover 态等子元素的视觉行为不变。",
        // 仅开关型 tweak：enabled 和 value 复用同一 key（与 simple-mode / hide-* 同模式），
        //   localStorage 只存一个布尔字段；TweakRow 通过 k2===k1 检测不渲染数字框。
        configKeys: { enabled: "sidebarMatchConversationBg", value: "sidebarMatchConversationBg" },
        defaults: { enabled: false, value: false },
        buildCSS: function (state) {
          if (!state.sidebarMatchConversationBg) return null;
          // 三层 fallback 链：--dsw-alias-bg-base（DSH 主背景，ssh / task-board 面板用同款）
          //   → --dsw-alias-bg-layer-1（DSH 卡片背景，disclosure 按钮背景同款）
          //   → #ffffff（硬值白）。任意一层在当前主题下可用即可。
          //
          // v0.9.15 三层防线（覆盖此 tweak 自 v0.9.9 以来的所有已知失效场景）：
          //   ① `[data-pane="sidebar"]` 自己 → column（v0.9.9 起就有）
          //   ② `[data-pane="sidebar"] [class*="_root"]` → SidebarRoot + 任何 _root 结尾类
          //      的后代元素（v0.9.13 起；v0.9.14 把 `$=` 改 `*=` 处理收起态 className
          //      末尾被修饰类占据的情况）
          //   ③ `--dsw-specific-sidebar-fill: transparent` → 覆盖整个侧栏作用域内
          //      该 CSS 变量的值。任何在侧栏后代里 `var(--dsw-specific-sidebar-fill)`
          //      引用的元素都解析为 transparent——即使 DSH 后续在侧栏里加新元素并
          //      引用此变量，也不会再显示原色。这是最稳的兜底。
          //   ④ `background: ...` 显式赋给 `[data-pane="sidebar"]` 自身（与 ① 重复但
          //      + !important 强化，DSH `pI_x6G_sidebarCol` 的 `border-right` 等
          //      同规则组 CSS 变量修改可能引发 cascade 重排时仍生效）
          //
          // 用户实测"展开页面左上角的部分，过一会就会变成灰色，hover 变白，
          // 移走一段时间又变灰"——v0.9.14 之前 hover 行为可能来自某个我们
          // 没覆盖到的元素（如 panelRoot 或后代 root 类组件）；v0.9.15 加
          // 变量级别 + 多层 selector 兜底后理论上不再出现这种边角情况。
          //
          // 兼容性：DSH 升级换 hash 也仍命中（className 仍含 `_root` 子串，
          //   v0.7.3 / v0.7.5 同策略）；不变类名 / ID / attribute / 调试 API / localStorage。
          return "/* === sidebar-match-conversation-bg v0.9.15 : 侧栏 [data-pane=\"sidebar\"] 列容器 + 其内所有 _root 后代 + --dsw-specific-sidebar-fill 变量覆盖，三层兜底强制 background 与对话区一致 === */\n" +
            // ① 列容器显式 background（带 !important）
            "[data-pane=\"sidebar\"] {" +
              "background:var(--dsw-alias-bg-base,var(--dsw-alias-bg-layer-1,#ffffff)) !important;" +
              // ③ 变量级覆盖：让侧栏作用域内所有 `var(--dsw-specific-sidebar-fill)`
              //   引用都解析为 transparent。即使 DSH 在该作用域内加新元素（panel / overlay /
              //   hover 层 / 装饰层）使用此变量，也不再显示原 sidebar-fill 色
              "--dsw-specific-sidebar-fill:transparent;" +
            "}\n" +
            // ② 内部 _root 后代（SidebarRoot + 任何 _root 结尾类的组件如 WorkspaceList root）
            "[data-pane=\"sidebar\"] [class*=\"_root\"] {" +
              "background:var(--dsw-alias-bg-base,var(--dsw-alias-bg-layer-1,#ffffff)) !important" +
            "}";
        }
      },
      {
        // v0.10.0 新增：统计行位置（本插件第一条三选一 tweak）。
        //
        // 用户反馈：对话底部那行统计（"3 轮 · 45 步 | LLM 12m13s · 工具调用
        //   1m21s | 首 token 平均 2.9s · 71 tok/s | 缓存命中 96% | 输入
        //   3.6M tok · 输出 42.7K tok"）想能选位置——保持底部 / 挪到顶部
        //   "对话名 + 模式"右边 / 干脆不显示。
        //
        // 数据形态：与其它"仅开关型"tweak 一样 enabled 与 value 复用同一
        //   key（localStorage 只存一个字段），但存的是**字符串**
        //   "bottom" / "top" / "hidden" 而不是布尔。TweakRow 见到
        //   `choices` 字段就渲染 <select> 而不是开关（见 75-react-tweak-row.js）。
        //   老用户升级后该 key 不存在 → defaultState() 补 "bottom" → 视觉零变化。
        //   脏值 / 老布尔值由 statsNormalizePosition() 统一退回 "bottom"。
        //
        // CSS 侧只负责"隐藏原生行"（top / hidden 两种位置都要隐藏）：
        //   隐藏的是整个 `conversation.composer.dock` slot 出口。DSH 自己的
        //   slot 目录把该 slot 的 occupants 记为
        //   `["client-ui-conversation StatsLine id 'stats'"]`——唯一占位者
        //   就是统计行，所以隐藏整个出口 == 隐藏统计行，且完全不依赖
        //   CSS module hash 类名（`.FJxK0a_root` 每次 DSH 构建都会变）。
        //
        // **v0.10.1：用 `visibility:hidden` 而不是 `display:none`**——
        //   用户反馈 v0.10.0 "发消息的框往下走了一点点"。根因：统计行是
        //   composer 卡片的 footer（`conversation.composer.dock` 作为输入条的
        //   footer prop 渲染），高 24px（`line-height:20px` + `padding-top:4px`）；
        //   而 composer seat 是**贴着滚动容器底部**的（sticky bottom），卡片
        //   变矮 24px 就等于输入行整体下移 24px。`display:none` 把元素从布局里
        //   彻底移除 → 卡片变矮 → 输入框下移；`visibility:hidden` 保留元素的
        //   盒子（照常参与布局、照常被 React 更新文本），只是不渲染 → 高度
        //   分毫不差地保留，输入框位置与"底部"位置时完全一致。
        //   比"补一个硬编码 24px padding"更稳：不依赖 DSH 的字号 / 行高 /
        //   padding 数值，DSH 后续改统计行样式也自动跟随。
        //   代价：非"底部"位置时输入框下方保留一条 24px 空白（这正是把输入框
        //   钉在原位所必须的空间）。
        //   两条选择器：出口自身 + 其所有后代。`visibility` 本身是继承属性，
        //   出口那层 `display:contents` 不生成盒子但仍能把 `hidden` 传给子元素；
        //   后代那条是显式兜底，防 DSH 将来给统计行显式写 `visibility`。
        //   `!important` 必需：出口的 `display:contents` 是 **inline style**，
        //   普通样式表规则压不过它（这里虽然改的是 visibility 而非 display，
        //   但同规则组内保持一致的 !important 强度，避免 DSH 后续加规则时翻盘）。
        //
        // 顶部镜像的 DOM 维护由 69-stats-line-position.js 的 controller 负责
        //   （apply() 按状态启停），这里只出镜像的外观 CSS。
        id: "stats-line-position",
        name: "统计行位置",
        description: "对话底部那行运行统计（轮次 / 步数、LLM 与工具耗时、首 token 与吞吐、缓存命中、输入输出 token）的位置。「底部」是 DSH 默认；「顶部标题右侧」把它挪到对话名与模式标签右边（内容与底部完全一致，标题行放不下时省略号截断，鼠标悬停看全文）；「不显示」则完全隐藏。非「底部」时原生行用 visibility 隐藏而非移除，保留它原本占的 24px——这样输入框位置与「底部」时完全一致，代价是输入框下方留一条等高空白。注意：隐藏作用于整个底部 dock 区域——目前 DSH 里该区域的唯一内容就是这行统计，但若将来有别的插件也往这里放东西，会被一并隐藏。",
        choices: [
          { value: STATS_POS_BOTTOM, label: "底部（DSH 默认）" },
          { value: STATS_POS_TOP, label: "顶部标题右侧" },
          { value: STATS_POS_HIDDEN, label: "不显示" }
        ],
        configKeys: { enabled: "statsLinePosition", value: "statsLinePosition" },
        defaults: { enabled: STATS_POS_BOTTOM, value: STATS_POS_BOTTOM },
        buildCSS: function (state) {
          var pos = statsNormalizePosition(state.statsLinePosition);
          if (pos === STATS_POS_BOTTOM) return null;
          // v0.10.1：visibility 而非 display——保留 24px 占位，输入框不下移
          var css = "/* === stats-line-position v0.10.1 : " + pos + " —— 隐藏底部 composer.dock 出口（唯一占位者 = DSH StatsLine）；用 visibility 保留占位，输入框不下移 === */\n" +
            STATS_DOCK_SEL + "," + STATS_DOCK_SEL + " *{visibility:hidden !important;}";
          if (pos !== STATS_POS_TOP) return css;
          // 顶部镜像外观：跟着标题簇的 flex 流排在"模式"标签右边（titleCluster
          //   自带 gap:10px，无需额外 margin）。可收缩 + 省略号，避免长统计
          //   把面包屑挤没；颜色 / 字号对齐 DSH 原生统计行（tertiary label /
          //   12px / 20px 行高）；tabular-nums 让数字跳动时宽度稳定。
          //   分隔符 `<span class="..._sep">` 是从原生行克隆来的，DSH 自己的
          //   `_sep` 规则（color + margin:0 10px）继续生效，不用我们重写。
          return css + "\n" +
            "[" + STATS_MIRROR_ATTR + "]{" +
              "flex:0 1 auto;" +
              "min-width:0;" +
              "overflow:hidden;" +
              "white-space:nowrap;" +
              "text-overflow:ellipsis;" +
              "color:var(--dsw-alias-label-tertiary);" +
              "font-size:12px;" +
              "line-height:20px;" +
              "font-variant-numeric:tabular-nums;" +
              "cursor:default;" +
            "}\n" +
            // 无统计可显示时（新会话开局 StatsLine 返回 null）镜像为空——
            //   连同 titleCluster 的 gap 一起去掉，标题行不留可疑空隙
            "[" + STATS_MIRROR_ATTR + "]:empty{display:none;}";
        }
      }
    ];

    // ===== storage =====
    // ====================================================================
    // localStorage 持久化（按 dsh-persistent-plugin-authoring skill §三）
    // ====================================================================

    var storage = null;
    try {
      var probeKey = STORAGE_KEY + "__probe__";
      window.localStorage.setItem(probeKey, "1");
      window.localStorage.removeItem(probeKey);
      storage = window.localStorage;
    } catch (e) {
      console.warn("[dsh-ui-tweaks] localStorage unavailable, tweaks will not persist across reloads:", e);
    }

    function defaultState() {
      var state = {};
      for (var i = 0; i < TWEAKS.length; i++) {
        var t = TWEAKS[i];
        state[t.configKeys.enabled] = t.defaults.enabled;
        state[t.configKeys.value] = t.defaults.value;
      }
      return state;
    }

    function loadState() {
      var state = defaultState();
      if (!storage) return state;
      var raw;
      try { raw = storage.getItem(STORAGE_KEY); } catch (e) { return state; }
      if (!raw) return state;
      try {
        var saved = JSON.parse(raw);
        if (saved && typeof saved === "object") {
          for (var k in saved) {
            if (Object.prototype.hasOwnProperty.call(state, k)) state[k] = saved[k];
          }
        }
      } catch (e) { /* 损坏则用默认 */ }
      return state;
    }

    function saveState(state) {
      if (!storage) return;
      try {
        var out = {};
        for (var i = 0; i < TWEAKS.length; i++) {
          var t = TWEAKS[i];
          out[t.configKeys.enabled] = state[t.configKeys.enabled];
          out[t.configKeys.value] = state[t.configKeys.value];
        }
        storage.setItem(STORAGE_KEY, JSON.stringify(out));
      } catch (e) { /* 静默 */ }
    }

    // ===== styles =====
    // ====================================================================
    // CSS 注入
    // ====================================================================

    function buildCSS(state) {
      var blocks = [];
      for (var i = 0; i < TWEAKS.length; i++) {
        var css = TWEAKS[i].buildCSS(state);
        if (css) blocks.push(css);
      }
      // 调试高亮的 CSS 单独生成（依赖 shiftPx）
      var debugBlock = buildDebugHighlightCSS(state);
      if (debugBlock) blocks.push(debugBlock);
      return blocks.join("\n\n");
    }

    /** 调试高亮 CSS（4px 黄色 outline + 浮动 label）。只有 conversationShiftDebug 开启时输出。 */
    function buildDebugHighlightCSS(state) {
      if (!state.conversationShiftDebug) return null;
      var px = Number(state.conversationShiftPx);
      if (!isFinite(px) || px < 0) px = 380;
      if (px > 800) px = 800;
      var labelText = "DSH UI TWEAKS · 对话内容 · 当前右缩 " + px + "px (debug)";
      return [
        "/* === conversation-shift-debug : 高亮 JS 探测标记的元素 === */",
        "html[data-dsh-ui-tweaks-shift-debug] [" + SHIFT_TARGET_ATTR + "]{",
        "  outline:4px solid #facc15 !important;",
        "  outline-offset:-4px;",
        "  box-shadow:inset 0 0 0 1px rgba(0,0,0,.5) !important;",
        "  position:relative !important;",
        "}",
        "html[data-dsh-ui-tweaks-shift-debug] [" + SHIFT_TARGET_ATTR + "]::before{",
        "  content:\"" + labelText + "\";",
        "  position:absolute;",
        "  top:-22px;",
        "  left:0;",
        "  background:#000;",
        "  color:#fff;",
        "  font:600 11px/20px ui-monospace,Menlo,Consolas,monospace;",
        "  padding:1px 8px;",
        "  border-radius:4px;",
        "  white-space:nowrap;",
        "  z-index:99999;",
        "  pointer-events:none;",
        "}"
      ].join("\n");
    }

    function injectCSS(state) {
      var old = document.querySelector("style[data-plugin-css=\"" + MAIN_CSS_TAG_ID + "\"]");
      if (old) old.remove();
      var css = buildCSS(state);
      if (!css) return;
      var tag = document.createElement("style");
      tag.dataset.plugin = "dsh-ui-tweaks";
      tag.dataset.pluginCss = MAIN_CSS_TAG_ID;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    /**
     * Section 样式。注入一次。
     *
     * 设计选择（v0.5.1）：
     *  - switch 用显式颜色作为 fallback（不依赖 `--dsw-alias-bg-component-disabled`，
     *    在某些 DSH 主题下变量值接近背景色导致开关看不见）。fallback 链：
     *    `var(--dsw-alias-bg-component-disabled, #cbd5e1)`。
     *  - input 不再用 :disabled 样式（v0.5.1 起永远不 disabled）。
     *  - 移除 .DTPD_actionsRow / .DTPD_btn 样式（按钮已去掉）。
     *
     * v0.7.5：description 从 `<p>` 收进 `title` 属性后，row 默认不再渲染描述——
     * 给 `.DTPD_item` 加 `cursor:help` 提示可悬停看说明；同时删除
     * `.DTPD_itemDesc` 规则（不再被任何 JSX 引用）。
     *
     * v0.10.0：加 `.DTPD_select`——"多选一"tweak（首例 stats-line-position）
     * 头部右侧渲染下拉框而非开关。外观对齐已有的 `.DTPD_input` 数字框
     * （同边框 / 圆角 / 内边距 / focus 色），只是宽度按内容给个下限。
     *
     * v0.10.4：把 `.DTPD_switch` 尺寸从 v0.6.0 起放大的 `36×22` / thumb `18×18`
     *   回退到 v0.5.1 之前的 `34×20` / thumb `16×16`——用户实测反馈
     *   「现在开关看起来方方的」（v0.10.3 修了 border 但尺寸仍偏大，
     *   视觉上仍偏方圆，达不到用户记忆里的「圆圆的」）。v0.6.0 合并
     *   simple-mode 时一并把尺寸调大（border 也是那时加的），v0.10.3
     *   只删 border、忘了改尺寸。本次同时把尺寸恢复到 v0.5.1 之前的
     *   紧凑 pill：thumb `top:2px; left:2px`（v0.6.0 起是 `top:1px; left:1px`
     *   ——22px 高 + 18px thumb 只剩 2px 上下边距，看上去 thumb 几乎贴满高度，
     *   pill 的「圆」被压缩；20px 高 + 16px thumb + 2px 上下边距 = 4px 边距，
     *   pill 两端圆形轮廓更明显）。translateX 保持 `14px`（v0.5.1 与
     *   v0.6.0 起都是这个值，34px 宽里 14+16+2=32、knob 右边距 2px，
     *   36px 宽里 14+18+1=33、knob 右边距 3px，数值上都成立）。
     * v0.10.3：去掉 `.DTPD_switch` 的 `border:1px solid`（v0.6.0 起加的）——
     *   用户反馈 1px 边框让开关看起来"有点方圆"，去掉后 pill 形态更纯净。
     *   off 态靠 background fallback 颜色（`#cbd5e1`）保持可见，无需
     *   border 兜底。但本次仅去 border、**未恢复尺寸**——尺寸仍为 v0.6.0
     *   放大的 36×22 / thumb 18×18，用户实测「去掉边框后还是方方的」→
     *   v0.10.4 继续把尺寸回退到 v0.5.1 之前的 34×20 / thumb 16×16。
     */
    var SECTION_CSS =
      ".DTPD_section{max-width:760px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:18px;display:flex}\n" +
      ".DTPD_section h2{margin:0;font-size:18px;font-weight:600}\n" +
      ".DTPD_intro{color:var(--dsw-alias-label-tertiary);margin:0 0 4px;font-size:13px}\n" +
      ".DTPD_list{flex-direction:column;gap:10px;margin:0;padding:0;list-style:none;display:flex}\n" +
      // v0.7.5：cursor:help 提示"悬停可看 description"——description 移到 <li title=...>
      ".DTPD_item{cursor:help;box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;flex-direction:column;gap:8px;padding:14px 16px;display:flex}\n" +
      ".DTPD_itemHead{flex-direction:row;justify-content:space-between;align-items:center;gap:12px;display:flex}\n" +
      ".DTPD_itemName{margin:0;font-size:14px;font-weight:500;line-height:22px}\n" +
      // v0.7.5：.DTPD_itemDesc 规则移除——description 改用 HTML title，不渲染 <p>
      // v0.10.4：尺寸从 v0.6.0 起放大的 36×22 / thumb 18×18 回退到 v0.5.1
      //   之前的 34×20 / thumb 16×16——用户实测「去掉边框后还是方方的」，
      //   真正的「圆圆的」需要在更紧凑的尺寸下、两端圆形轮廓才能显现出来。
      ".DTPD_switch{appearance:none;-webkit-appearance:none;cursor:pointer;width:34px;height:20px;background:var(--dsw-alias-bg-component-disabled,#cbd5e1);border-radius:999px;position:relative;transition:background .15s ease;flex:none;margin:0;padding:0}\n" +
      ".DTPD_switch:checked{background:var(--dsw-alias-state-business-primary,#2563eb)}\n" +
      ".DTPD_switch::after{content:\"\";position:absolute;top:2px;left:2px;width:16px;height:16px;background:var(--dsw-alias-bg-layer-1,#fff);border-radius:50%;transition:transform .15s ease;box-shadow:0 1px 2px rgba(0,0,0,.18)}\n" +
      ".DTPD_switch:checked::after{transform:translateX(14px)}\n" +
      ".DTPD_valueRow{align-items:center;gap:8px;display:flex}\n" +
      ".DTPD_valueLabel{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;min-width:64px}\n" +
      ".DTPD_input{box-sizing:border-box;width:120px;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-input-major,#fff);border:1px solid var(--dsw-alias-border-l2,#94a3b8);border-radius:6px;padding:4px 8px;font-family:inherit;font-size:13px;line-height:20px}\n" +
      ".DTPD_input:focus{border-color:var(--dsw-alias-state-business-primary,#2563eb);outline:none}\n" +
      // v0.10.0：多选一 tweak 的下拉框（stats-line-position 首用）
      ".DTPD_select{box-sizing:border-box;flex:none;min-width:150px;cursor:pointer;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-input-major,#fff);border:1px solid var(--dsw-alias-border-l2,#94a3b8);border-radius:6px;padding:4px 8px;font-family:inherit;font-size:13px;line-height:20px}\n" +
      ".DTPD_select:focus{border-color:var(--dsw-alias-state-business-primary,#2563eb);outline:none}";

    function injectSectionCSS() {
      if (document.querySelector("style[data-plugin-css=\"" + SECTION_CSS_TAG_ID + "\"]")) return;
      var tag = document.createElement("style");
      tag.dataset.plugin = "dsh-ui-tweaks";
      tag.dataset.pluginCss = SECTION_CSS_TAG_ID;
      tag.textContent = SECTION_CSS;
      document.head.appendChild(tag);
    }

    // ===== shim =====
    // ====================================================================
    // Self-shim：自己种 data-pane="conversation" 属性
    // 4 层 selector 策略，按可信度递减
    // ====================================================================

    /**
     * 找 AppFrame（grid 容器）的 3 个 grid 子元素：sidebar / center / details。
     * 通过 gridTemplateColumns 解析 + 子元素位置判断。
     * 返回 { frame, sidebar, center, details }；找不到则字段为 null。
     */
    function discoverFrameTriptych() {
      if (typeof document === "undefined") return null;
      // 策略 A：已知类名后缀（DSH 当前版本）
      var sidebarA = document.querySelector('[class*="sidebarCol"]');
      var centerA = document.querySelector('[class*="centerCol"]');
      var detailsA = document.querySelector('[class*="detailsCol"]');
      if (sidebarA && centerA && detailsA) {
        return { frame: sidebarA.parentElement, sidebar: sidebarA, center: centerA, details: detailsA };
      }
      // 策略 B：解析 grid-template-columns，找含 minmax(0, 1fr) 的 grid + 3 个子元素
      var grids = document.querySelectorAll('div');
      for (var i = 0; i < grids.length; i++) {
        var g = grids[i];
        var style = window.getComputedStyle ? window.getComputedStyle(g) : null;
        if (!style || style.display !== 'grid') continue;
        // 必须是 3 列 grid
        var cols = style.gridTemplateColumns;
        if (!cols) continue;
        var parts = cols.split(/\s+/);
        if (parts.length !== 3) continue;
        // 中间一列必须是 minmax(0, 1fr) 这种弹性单位
        if (!/minmax\(0,\s*1fr\)|1fr/.test(parts[1])) continue;
        var kids = Array.from(g.children);
        if (kids.length < 3) continue;
        // 按 grid-column 隐式分配：第一个是 sidebar，中间是 center，最后是 details
        return { frame: g, sidebar: kids[0], center: kids[1], details: kids[2] };
      }
      return null;
    }

    /** 找到 conversation 列元素（4 层 fallback）。返回 null 表示完全没找到。 */
    function findConversationPane() {
      // L1: 自己或外部已种的 data-pane="conversation"
      var l1 = document.querySelector('[' + SHIM_PANE_ATTR + '="' + SHIM_PANE_VALUE + '"]');
      if (l1) return { el: l1, layer: "L1" };
      // L2: CSS Module 类名后缀（DSH 当前版本：pI_x6G_centerCol）
      var l2 = document.querySelector('[class*="centerCol"]');
      if (l2) return { el: l2, layer: "L2" };
      // L3: grid 中间列（不依赖 class 名）
      var trip = discoverFrameTriptych();
      if (trip && trip.center) return { el: trip.center, layer: "L3" };
      // L4: 保底，未来 DSH 可能自加 data-pane-shell="conversation"——目前没找到元素
      return { el: null, layer: "L4-miss" };
    }

    /** 在元素上种属性（已种则跳过）。 */
    function stampIfMissing(el, name, value) {
      if (!el) return false;
      if (el.getAttribute && el.getAttribute(name) === value) return false;
      el.setAttribute(name, value);
      return true;
    }

    /** 应用 self-shim：找到 conversation 列并种 data-pane 属性。返回解析层（用于诊断）。 */
    function applyShellShim() {
      var found = findConversationPane();
      if (!found.el) {
        if (typeof console !== "undefined" && console.debug) {
          console.debug("[dsh-ui-tweaks] shell shim: 0 strategies matched — conversation column not found");
        }
        return null;
      }
      // 1) 给 conversation 列种 data-pane
      stampIfMissing(found.el, SHIM_PANE_ATTR, SHIM_PANE_VALUE);
      // 2) 顺便给整个 AppFrame 也种一下（L4 兜底，同时方便其它插件识别）
      var trip = discoverFrameTriptych();
      if (trip) {
        if (trip.frame) stampIfMissing(trip.frame, SHELL_FRAME_ATTR, SHELL_FRAME_VALUE);
        if (trip.sidebar) stampIfMissing(trip.sidebar, SHIM_PANE_ATTR, SHELL_SIDEBAR_ATTR_VALUE);
        if (trip.details) stampIfMissing(trip.details, SHIM_PANE_ATTR, SHELL_DETAILS_ATTR_VALUE);
      }
      if (typeof console !== "undefined" && console.debug) {
        console.debug("[dsh-ui-tweaks] shell shim resolved via " + found.layer);
      }
      return found;
    }

    /**
     * 启动 self-shim MutationObserver。DSH React 重渲会 unmount/remount
     * grid 子树，需要重新种属性。
     */
    function startShellShimObserver() {
      if (typeof MutationObserver === "undefined" || typeof document === "undefined") return;
      var observer = new MutationObserver(function () {
        // v0.5.5 patch：self-shim 重跑时顺便跑一次 chatflow 探测。
        // 原因：startChatflowMarksObserver 在 apply() 时如果 centerCol 还没
        //   渲染就会找不到 col 而静默失败，DSH React 后续渲染 centerCol
        //   时没人去探测 chatflow 容器。self-shim observer 启动早且观察
        //   body subtree，必然能捕获后续所有变化——是 chatflow 探测的兜底。
        // 配合 applyChatflowShiftMarks v0.5.5 幂等性：已是最优标记就跳过
        //   重打，不会破坏 v0.5.4 修过的"来回弹"循环。
        applyShellShim();
        applyChatflowShiftMarks();
      });
      try {
        observer.observe(document.body, { childList: true, subtree: true });
      } catch (e) {
        // 静默：极端情况下（如 document.body 还没准备好）不报错
      }
      return observer;
    }

    // ===== chatflow-marks =====
    // v0.5.3 + v0.5.5：动态探测 chatflow 容器 + 输入框，打标记给 CSS 命中
    // 背景：v0.5.2 用 `> *` 选择器假设 centerCol 直接子元素是 chatflow 容器
    //   ——实测 DSH centerCol 实际 DOM 结构可能更深（chatflow 可能在子级的子级，
    //   或用 portal 渲染），`> *` 命中 0 个元素 → 对话"根本不移动"。
    // v0.5.3 解法：JS 探测实际 DOM，找到真正的 chatflow 容器和输入框，
    //   给它们打 data 属性标记；CSS 只命中被标记的元素。探测失败时回退
    //   给 centerCol 列容器打标记（v0.5.1 行为兜底）。
    //
    // v0.10.2：探测策略升级 + 单元素标记
    //   1) **新增 DSH 锚点 [data-conversation-scroll]**——DSH `ConversationRoot`
    //      给 scrollBody 打的稳定属性（不含构建 hash），跨版本不变；v0.5.3 的
    //      overflow+chat-flow-kind 检测在**空会话**时找不到任何元素（没有
    //      `[data-chat-flow-kind]`），导致「新建会话」界面右缩不生效——
    //      用户实测反馈。新策略把这层 DSH 自己的稳定属性作为首选，命中即停
    //      （与 v0.7.3 HoverCard `[class*="_hoverContent"]`、v0.10.0
    //      stats-line-position `data-slot=...` 同源的 hash-independence 策略）。
    //   2) **chatflow 命中后不再额外标 input**——v0.5.3 的实现同时给 chatflow
    //      和 input 打标记，CSS 对两个元素都加 padding-right → 实际叠加成
    //      **双 padding**（如 380+380=760）。scrollBody 在 DSH 结构里**已经
    //      包了 composerSeat**（composer 是 scrollBody 的子元素而非兄弟），
    //      所以单 padding 在 scrollBody 上同时影响消息内容 + 输入框，无需
    //      再额外标 input。input 检测只作为 chatflow 失败时的兜底（DSH 未来
    //      把 composer 拆出 scrollBody 仍能命中）。**用户反馈的「半屏时
    //      看起来很奇怪」**就是双 padding 在窄屏下叠加成不可用宽度——
    //      全屏时 1640-760=880 还能容下 748px 聊天气泡，半屏时 680-760=-80
    //      直接溢出 / 被裁。这条改动把「单 padding」行为重新拉回正轨。
    //   3) **CSS 在 v0.10.2 buildCSS 同步改成 min(Npx, 40%)**——保留用户在
    //      全屏的偏好像素，窄屏自动收紧到对话列宽度的 40%，聊天气泡始终
    //      可读（748px max 在 408px 内容区也能水平居中显示）。
    /**
     * 在 centerCol 列容器内探测 chatflow 容器和输入框。
     * 探测策略（v0.10.2 起）：
     *   策略 1（首选）：DSH scrollBody 锚点 `[data-conversation-scroll]`——
     *     `ConversationRoot.scrollBody` 上 DSH 自己打的稳定属性，跨版本
     *     不变；命中即返回，**不再额外探测 input**（避免 v0.5.3 的双 padding
     *     bug——见头注释）。
     *   策略 2（兜底）：v0.5.3 原始的 overflow + [data-chat-flow-kind] 探测
     *     ——DSH 升级去掉 `data-conversation-scroll` 时仍能工作（有消息时）。
     *   策略 3（兜底）：input 探测（contenteditable=true / textarea / role=
     *     textbox 的最近祖先）。只有 chatflow 完全没找到时才使用（DSH 极端
     *     布局变动把 composer 拆出 scrollBody 的场景）。
     * 返回 { chatflow, input, found }；任一找到即为 found=true。
     */
    function findChatflowTargets(centerColEl) {
      if (!centerColEl || typeof document === "undefined") {
        return { chatflow: null, input: null, found: false };
      }

      var chatflow = null;

      // 策略 1（v0.10.2 起首选）：DSH 稳定锚点 [data-conversation-scroll]
      //   ConversationRoot 的 scrollBody——空会话（有 composer 无消息）也命中
      //   ——v0.5.3 的 overflow+chat-flow-kind 在空会话会失效。
      //   命中后直接返回，不走 input 探测（避免双 padding，见头注释）。
      var scrollEl = centerColEl.querySelector(SHIFT_SCROLL_SEL);
      if (scrollEl) {
        return {
          chatflow: scrollEl,
          input: null,
          found: true
        };
      }

      // 策略 2（v0.5.3 兜底）：overflow 容器 + 含 [data-chat-flow-kind]
      //   仅在策略 1 失败时跑——DSH 升级把 data-conversation-scroll 改名的
      //   兜底路径（有消息时仍能工作）。命中后同样不再标 input。
      var all = centerColEl.querySelectorAll("*");
      for (var i = 0; i < all.length; i++) {
        var n = all[i];
        var cs = window.getComputedStyle ? window.getComputedStyle(n) : null;
        if (!cs) continue;
        var ovY = cs.overflowY;
        var ov = cs.overflow;
        if ((ovY === "auto" || ovY === "scroll" || ov === "auto" || ov === "scroll") &&
            n.querySelector("[data-chat-flow-kind]")) {
          chatflow = n;
          break;
        }
      }
      if (chatflow) {
        return {
          chatflow: chatflow,
          input: null,
          found: true
        };
      }

      // 策略 3（v0.5.3 兜底）：input 探测——DSH 未来把 composer 拆出 scrollBody
      //   时的最后防线。contenteditable=true / textarea / role=textbox 的最近
      //   祖先（向上走到 centerCol 的直接子）。
      var input = null;
      var inputNode = centerColEl.querySelector(
        '[contenteditable="true"], textarea, [role="textbox"]'
      );
      if (inputNode) {
        input = inputNode;
        while (input && input.parentElement && input.parentElement !== centerColEl) {
          input = input.parentElement;
        }
        if (!input || input.parentElement !== centerColEl) input = null;
      }

      return {
        chatflow: null,
        input: input,
        found: !!input
      };
    }

    /**
     * 探测 + 标记：清理旧标记，按探测结果给元素打 data-dsh-ui-tweaks-shift-target。
     *   - 探测成功 → chatflow 元素打 "chatflow" / inputArea 打 "input"
     *   - 探测失败 → centerCol 列容器打 "column"（v0.5.1 行为兜底）
     *
     * v0.5.5 幂等性：检查现有标记是否和探测结果一致，一致就跳过重打。
     *   避免在 self-shim observer（高频触发）回调里反复清理 + 重打标记
     *   ——v0.5.4 已修了"来回弹"循环，这里不能倒退回去。
     * 返回探测结果。MutationObserver 在 DSH React 重渲时再次调用。
     */
    function applyChatflowShiftMarks() {
      if (typeof document === "undefined") return null;
      // 找 centerCol 列容器（self-shim 已种 data-pane，或用类名兜底）
      var col = document.querySelector(
        "[" + SHIM_PANE_ATTR + '="' + SHIM_PANE_VALUE + '"]'
      ) || document.querySelector('[class*="centerCol"]');
      if (!col) return null;

      // 先探测（不动 DOM，只算结果）
      var found = findChatflowTargets(col);

      // v0.5.5 幂等性检查：现有标记和探测结果一致就不重打
      var existingMarks = col.querySelectorAll("[" + SHIFT_TARGET_ATTR + "]");
      var existingColMark = col.getAttribute(SHIFT_TARGET_ATTR);
      var needUpdate = false;

      if (found.found) {
        // 期望：chatflow / input 打标记，col 本身不打
        if (existingColMark) needUpdate = true;
        if (found.chatflow && (
            !found.chatflow.hasAttribute(SHIFT_TARGET_ATTR) ||
            found.chatflow.getAttribute(SHIFT_TARGET_ATTR) !== SHIFT_TARGET_CHATFLOW
          )) needUpdate = true;
        if (found.input && (
            !found.input.hasAttribute(SHIFT_TARGET_ATTR) ||
            found.input.getAttribute(SHIFT_TARGET_ATTR) !== SHIFT_TARGET_INPUT
          )) needUpdate = true;
        // 旧标记不在期望位置（被 DSH React unmount 的元素）也算需要更新
        for (var i = 0; i < existingMarks.length; i++) {
          var m = existingMarks[i];
          if (m === col) continue; // col 自身的标记由上面的 existingColMark 判断
          if (found.chatflow && m === found.chatflow) continue;
          if (found.input && m === found.input) continue;
          // m 是孤儿标记（指向的元素已经被 DSH 卸载）
          needUpdate = true;
          break;
        }
      } else {
        // 期望：col 自身打 "column" 标记
        if (!existingColMark || existingColMark !== SHIFT_TARGET_COLUMN) needUpdate = true;
        for (var j = 0; j < existingMarks.length; j++) {
          if (existingMarks[j] !== col) { needUpdate = true; break; }
        }
      }

      if (!needUpdate) {
        // 已是最优标记——不重打，避免破坏 v0.5.4 修过的"来回弹"
        return found;
      }

      // 需要更新：清理旧标记 + 打新标记
      for (var k = 0; k < existingMarks.length; k++) {
        existingMarks[k].removeAttribute(SHIFT_TARGET_ATTR);
      }
      if (existingColMark) col.removeAttribute(SHIFT_TARGET_ATTR);

      if (found.found) {
        if (found.chatflow) {
          found.chatflow.setAttribute(SHIFT_TARGET_ATTR, SHIFT_TARGET_CHATFLOW);
        }
        if (found.input) {
          found.input.setAttribute(SHIFT_TARGET_ATTR, SHIFT_TARGET_INPUT);
        }
      } else {
        // 兜底：标记列容器
        col.setAttribute(SHIFT_TARGET_ATTR, SHIFT_TARGET_COLUMN);
      }

      if (typeof console !== "undefined" && console.debug) {
        console.debug("[dsh-ui-tweaks] chatflow shift marks:", {
          found: found.found,
          updated: true,
          chatflow: found.chatflow
            ? found.chatflow.tagName + "." +
              (typeof found.chatflow.className === "string"
                ? found.chatflow.className
                : "(svg/other)")
            : null,
          input: found.input
            ? found.input.tagName + "." +
              (typeof found.input.className === "string"
                ? found.input.className
                : "(svg/other)")
            : null,
          fallbackColumn: !found.found
        });
      }

      return found;
    }

    /**
     * v0.5.3 + v0.5.4：chatflow 标记的 MutationObserver。
     * **只观察 centerCol 的直接子元素变化**（不观察 subtree），且**只在已标记的
     * chatflow / input 元素被 unmount/remount 时才重新探测**。
     *
     * 之前的实现：观察 body + subtree=true → DSH React 在 chatflow 内部每次
     *   重渲（消息增删、状态更新、thinking 状态切换等）都会触发 → 清理旧标记
     *   → 重新打标记 → 配合 transition: padding-right .22s ease 产生"来回弹"
     *   视觉循环（用户反馈"一致向中间拉过去，然后又会弹回去"）。
     *
     * 现在的实现：观察范围收窄到 centerCol 直接子元素；只在"被替换的节点
     *   是已标记的 chatflow / input 元素"时才重新探测。DSH chatflow 内部
     *   的 React 重渲不会触发——标记元素没被换掉，不需要重新打。
     *
     * 注意：v0.5.5 把 self-shim observer 也加进 applyChatflowShiftMarks 触发了，
     *   所以这个 observer 只针对"centerCol 直接子元素被 unmount/remount"
     *   这种局部事件——避免和 self-shim observer 全局观察重复触发。
     */
    var chatflowMarksObserver = null;
    function startChatflowMarksObserver() {
      if (chatflowMarksObserver !== null) return chatflowMarksObserver; // 单例
      if (typeof MutationObserver === "undefined" || typeof document === "undefined") return null;
      // 找当前 centerCol 列容器（self-shim 已种 data-pane 或类名兜底）
      var col = document.querySelector(
        "[" + SHIM_PANE_ATTR + '="' + SHIM_PANE_VALUE + '"]'
      ) || document.querySelector('[class*="centerCol"]');
      if (!col) return null;

      chatflowMarksObserver = new MutationObserver(function (mutations) {
        // 只在 addedNodes / removedNodes 里出现带 SHIFT_TARGET_ATTR 标记的元素时才重跑
        // ——说明 chatflow 容器或 inputArea 被 unmount/remount
        var needsReshim = false;
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          if (m.type !== "childList") continue;
          // 检查 addedNodes
          for (var k = 0; k < m.addedNodes.length; k++) {
            var n = m.addedNodes[k];
            if (n.nodeType !== 1) continue;
            // 新加的节点本身是标记元素 OR 包含标记元素
            if (n.hasAttribute && n.hasAttribute(SHIFT_TARGET_ATTR)) {
              needsReshim = true;
              break;
            }
            if (n.querySelector && n.querySelector("[" + SHIFT_TARGET_ATTR + "]")) {
              needsReshim = true;
              break;
            }
          }
          if (needsReshim) break;
          // 检查 removedNodes
          for (var k2 = 0; k2 < m.removedNodes.length; k2++) {
            var rn = m.removedNodes[k2];
            if (rn.nodeType === 1 && rn.hasAttribute && rn.hasAttribute(SHIFT_TARGET_ATTR)) {
              needsReshim = true;
              break;
            }
          }
          if (needsReshim) break;
        }
        if (!needsReshim) return;
        // throttle：避免短时间内反复探测
        if (chatflowMarksObserver._pending) return;
        chatflowMarksObserver._pending = true;
        (typeof window !== "undefined" && window.setTimeout)
          ? window.setTimeout(function () {
              chatflowMarksObserver._pending = false;
              applyChatflowShiftMarks();
            }, 80)
          : applyChatflowShiftMarks();
      });
      try {
        // 只观察 centerCol 的直接子元素变化（不观察 subtree）——
        // DSH React 在 chatflow 内部重渲不会触发，只有 chatflow / inputArea
        // 本身被替换时才会触发
        chatflowMarksObserver.observe(col, { childList: true });
      } catch (e) {
        // 静默
      }
      return chatflowMarksObserver;
    }

    // ===== debug =====
    // ====================================================================
    // 调试高亮：toggle <html> 属性 + 给命中元素写 data-shift-px
    // ====================================================================

    function inspectMatch(selector) {
      if (typeof document === "undefined") return { selector: selector, found: false };
      var el = document.querySelector(selector);
      if (el === null) return { selector: selector, found: false };
      var cs = (typeof window !== "undefined" && window.getComputedStyle) ? window.getComputedStyle(el) : null;
      var rect = (typeof el.getBoundingClientRect === "function") ? el.getBoundingClientRect() : null;
      return {
        selector: selector,
        found: true,
        tagName: el.tagName,
        className: typeof el.className === "string" ? el.className : "",
        offsetWidth: el.offsetWidth,
        offsetHeight: el.offsetHeight,
        paddingRight: cs ? cs.paddingRight : "",
        boxSizing: cs ? cs.boxSizing : "",
        position: cs ? cs.position : "",
        display: cs ? cs.display : "",
        rect: rect ? { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) } : null
      };
    }

    /**
     * 切调试高亮 + 把当前 px 值写到命中元素上（让 ::before label 显出来）。
     * 调试模式独立于 conversation-shift 开关——README 已说明"对话右缩关闭时也能开"。
     * @param enabled 调试模式开关
     * @param shiftPx 当前右缩像素值
     */
    function applyDebugMode(enabled, shiftPx) {
      if (typeof document === "undefined") return;
      if (enabled) {
        document.documentElement.setAttribute(DEBUG_HTML_ATTR, "");
        // v0.5.3 起：写到 JS 探测标记的元素 [data-dsh-ui-tweaks-shift-target] 上
        var nodes = document.querySelectorAll('[' + SHIFT_TARGET_ATTR + ']');
        for (var i = 0; i < nodes.length; i++) {
          nodes[i].setAttribute("data-shift-px", String(shiftPx || 0));
        }
        try {
          console.info("[dsh-ui-tweaks] conversation-shift-debug matched elements (JS 探测标记的元素):", [
            inspectMatch('[' + SHIFT_TARGET_ATTR + ']')
          ]);
        } catch (e) { /* 静默 */ }
      } else {
        document.documentElement.removeAttribute(DEBUG_HTML_ATTR);
        // 防御性：清理上次留下的 data-shift-px 属性，避免在 DOM 上残留
        var stale = document.querySelectorAll('[' + SHIFT_TARGET_ATTR + '][data-shift-px]');
        for (var j = 0; j < stale.length; j++) {
          stale[j].removeAttribute("data-shift-px");
        }
      }
    }

    // ===== simple-mode =====
    // 简洁模式：状态行 DOM controller（从原 dsh-simple-mode/lib/client.js 移植）
    //
    // v0.9.12 关键修复：v0.9.10 三层 CSS reset 不够（用户反馈 v0.9.10 / v0.9.11
    //   后底部状态行还是会一闪一闪的，且 think / 工具调用穿插几次后会"首行缩进"）。
    //   走 v0.9.10 CHANGELOG [Unreleased] line 63 预设的回退路径——
    //   JS 路径接管容器：
    //     1) `purgeTurnStatus()` 在 appendChild 之前先清空容器，保留 clock 再追加，
    //        杀干净 DSH 原生的 loader / shimmer child（v0.9.10 CSS 第 3 层 `[class*
    //        ="turnStatus"] > *:not(.dsh-ui-tweaks-status):not([class*="turnStatusClock"])`
    //        没覆盖的子元素——例如 DSH 升级后改 class 名而 substring 失效的 loader，
    //        或 React mount 后第一帧 CSS 还没应用时的瞬闪）
    //     2) `watchTurnStatus()` 升级：观察 document.body subtree（不再是 DSH 重渲
    //        时被换掉的 el.parentNode），任何新 turnStatus 节点（直接添加或深层
    //        嵌套）出现就**立即** purge——杀零 tick 250ms 间隔的闪援窗口
    //     3) `purgeTurnStatus()` 同时把 turnStatus 的 inline padding-left /
    //        margin-left 归零，修"穿插几次后 status 像是首行缩进"——DSH 在
    //        assistant-step 累加后给 turnStatus 父链加缩进 padding 是常见手法，
    //        我方 CSS reset 只作用当前节点不够
    //
    // v0.9.5 关键修复：`simplePickToolNameFromDom` 之前查 `[data-tool-name]`
    // 找不到任何工具名——DSH 实际渲染的是 `data-tool`（见 dsh-client-ui-tool
    // lib/client.js ToolRow：`"data-tool": toolName`）。这导致 v0.9.3 起的 8 类
    // 语义色（think 蓝 / read 中性 / write 琥珀 / bash 紫 / task 青 / plan
    // 绿 / goal 粉 / git 石板）**全部从 v0.9.3 发布起就未生效过**——所有活动
    // 都 fallback 到 "正在处理…" / generic 灰。同时 think / reasoning block
    // 不在 tool-call 容器里（它在 assistant-step 的 data-variant="think"
    // 上），即使修了 data-tool 也识别不到。新增 simpleIsThinkingFromDom +
    // simplePickActivityName 统一入口：think 优先 → tool-call → fallback。
    // 真实工具名映射扩展覆盖 DSH 全部内置工具（bash / pwsh / *_persistent /
    // read_image / todo_write / *_goal / subagent / workflow / ralph / skill /
    // ask_user_question / job_* / send_message / interrupt_agent / list_agents
    // / cordis_* 等）——见 simpleActivityCategory / simpleActivityText 注释。

    function simpleActivityText(name) {
      if (!name) return "正在处理…";
      // think / reason——reasoning block（data-variant="think"）不在 tool-call
      // 容器里，由 simpleIsThinkingFromDom 提前返回 "think"
      if (name === "think" || (typeof name === "string" && name.indexOf("reason") === 0)) return "正在思考…";
      // 文件系统读取类（含 read_image）
      if (name === "read" || name === "read_image" || name === "web_fetch") return "正在阅读…";
      if (name === "web_search") return "正在搜索…";
      if (name === "grep" || name === "glob") return "正在查找…";
      // 文件编辑类
      if (name === "edit" || name === "write") return "正在修改文件…";
      // shell / 代码执行
      if (name === "bash" || name === "bash_persistent" || name === "pwsh" || name === "pwsh_persistent" || name === "run_code") return "正在执行命令…";
      // 任务调度——subagent / workflow / ralph / agent 控制 / 消息
      if (name === "subagent" || name === "workflow" || name === "ralph" || name === "task" || name === "agent") return "正在调度子任务…";
      if (name === "send_message" || name === "interrupt_agent" || name === "list_agents") return "正在协调子任务…";
      if (name === "ask_user_question") return "等待你回答…";
      // 任务清单 / 计划——DSH 实际是 todo_write（v0.9.3 之前错把 todo 写这里）
      if (name === "todo_write" || name === "todo" || name === "plan" || name === "update_plan") return "正在整理计划…";
      // 目标跟踪
      if (name === "get_goal" || name === "create_goal" || name === "update_goal" || name === "goal" || name === "objective") return "正在处理目标…";
      // jobs / skill 类轻量
      if (name === "job_output" || name === "job_list" || name === "job_kill" || name === "skill") return "正在调度…";
      // 历史扩展名——保留兼容（新工具未必启用，但 fallback 不至于坏）
      if (name === "lsp" || name === "intellisense") return "正在查询代码…";
      if (name === "commit" || name === "git") return "正在提交代码…";
      if (name === "push") return "正在推送…";
      return "正在处理…";
    }

    // v0.9.3：simpleActivityCategory(name) 返回活动类目（think / read / write /
    // bash / task / plan / goal / git / generic）。simpleActivityText 给出文案，
    // 这个给出颜色——两个轴解耦，新增工具只需在这里加一行 + CSS 加一条着色规则。
    //
    // v0.9.5 扩展：覆盖 DSH 实际工具名。`run_code` 从 bash 移到 code 单独类目
    // ——但 CSS 当前只支持 8 类（think/read/write/bash/task/plan/goal/git），
    // 为了不引入第 9 色，run_code 仍归 bash（执行类）。`todo_write` 取代
    // v0.9.3 写错的 `todo`（DSH 实际是 `todo_write`，`todo` 永远查不到）。
    // `subagent` / `workflow` / `ralph` / `job_*` / `ask_user_question` /
    // `send_message` / `interrupt_agent` / `list_agents` / `skill` 归 task。
    // cordis_* 走 prefix 匹配（DSH 注册名 `cordis_define` / `cordis_run` 等）。
    function simpleActivityCategory(name) {
      if (!name) return "generic";
      if (name === "think" || (typeof name === "string" && name.indexOf("reason") === 0)) return "think";
      if (name === "read" || name === "read_image" || name === "web_fetch" || name === "web_search" || name === "grep" || name === "glob") return "read";
      if (name === "edit" || name === "write") return "write";
      if (name === "bash" || name === "bash_persistent" || name === "pwsh" || name === "pwsh_persistent" || name === "run_code") return "bash";
      if (name === "subagent" || name === "workflow" || name === "ralph" || name === "task" || name === "agent" || name === "send_message" || name === "interrupt_agent" || name === "list_agents" || name === "ask_user_question" || name === "job_output" || name === "job_list" || name === "job_kill" || name === "skill" || (typeof name === "string" && name.indexOf("cordis_") === 0)) return "task";
      if (name === "todo_write" || name === "todo" || name === "plan" || name === "update_plan") return "plan";
      if (name === "get_goal" || name === "create_goal" || name === "update_goal" || name === "goal" || name === "objective") return "goal";
      if (name === "commit" || name === "git" || name === "push") return "git";
      return "generic";
    }

    // v0.9.5：simplePickToolNameFromDom 改查 `[data-tool]`（DSH 实际渲染的
    // 属性名，见 dsh-client-ui-tool/lib/client.js ToolRow：`"data-tool": toolName`）。
    // 旧路径 `[data-tool-name]` 是命名错误——v0.9.3 美术度升级时
    // 写错了 selector，从 v0.9.3 发布起 8 类语义色**全部未生效**。
    // 保留 `[data-name]` / `[class*="toolName"]` / `[class*="toolLabel"]`
    // 作 fallback——以防 DSH 未来切换到不同的属性约定（substring match 不依赖 hash，
    // 与 v0.7.3 hide-sidebar-tooltip CSS 的 substring 策略一致）。
    function simplePickToolNameFromDom() {
      if (typeof document === "undefined") return null;
      var nodes = document.querySelectorAll('[data-chat-flow-kind="tool-call"]');
      if (nodes.length === 0) return null;
      var last = nodes[nodes.length - 1];
      // 主路径：DSH ToolRow 渲染的 data-tool 属性（v0.9.5 起）
      var named = last.querySelector("[data-tool]");
      if (named) {
        var dn = named.getAttribute("data-tool");
        if (dn) return dn;
      }
      // 兜底 1：data-name——历史 DSH 早期可能用过
      var named2 = last.querySelector("[data-name]");
      if (named2) {
        var dn2 = named2.getAttribute("data-name");
        if (dn2) return dn2;
      }
      // 兜底 2：CSS module hash class 子串匹配（DSH 升级换 hash 仍命中）
      var labels = last.querySelectorAll('[class*="toolName"], [class*="toolLabel"]');
      for (var i = 0; i < labels.length; i++) {
        var t = (labels[i].textContent || "").trim();
        if (t) return t;
      }
      return null;
    }

    // v0.9.5：reasoning / think block 渲染在 assistant-step 节点的
    // `[data-variant="think"]` 上（见 dsh-client-ui-conversation/lib/client.js
    // ReasoningRow：`"data-variant": "think"` + `"data-state": "running"`），
    // 不在 tool-call 容器里——simplePickToolNameFromDom 找不到。
    // 单独探测 `[data-state="running"]` 的 think block，存在即认为正在思考。
    // 注意 simple-mode 已把 `[data-variant="think"]` 整行 display:none，但
    // querySelectorAll 不看渲染状态——DOM 里有就能命中。
    function simpleIsThinkingFromDom() {
      if (typeof document === "undefined") return false;
      // 只在当前有 assistant-step 节点（最近的一批）里查——性能优化，避免每次
      // 250ms tick 扫整个 DOM。`[data-chat-flow-kind="assistant-step"]` 与
      // `simplePickToolNameFromDom` 的 `[data-chat-flow-kind="tool-call"]` 对称。
      var steps = document.querySelectorAll('[data-chat-flow-kind="assistant-step"]');
      if (steps.length === 0) return false;
      // 取最后一个（最新）assistant-step 内的 think block
      var last = steps[steps.length - 1];
      // 找 data-state="running" 的 think 块——reasoning 正在流式输出
      var running = last.querySelector('[data-variant="think"][data-state="running"]');
      return running !== null;
    }

    // v0.9.5：simplePickActivityName 统一入口。think（reasoning 流式）优先于
    // tool-call——因为模型先 think 再调工具，think 状态先出现时还没 tool-call
    // 节点；tool-call 出现后由 simplePickToolNameFromDom 接替。返回 "think" /
    // "toolName" / null（generic fallback）三种。
    // 性能：两个 querySelector 各自 250ms 一次，单次 0.5ms 量级，可忽略。
    function simplePickActivityName() {
      if (simpleIsThinkingFromDom()) return "think";
      return simplePickToolNameFromDom();
    }

    function simpleIsRunningFromDom() {
      if (typeof document === "undefined") return false;
      return document.querySelector(SIMPLE_TURN_STATUS_SEL) !== null;
    }

    function createSimpleModeStatusController() {
      var current = null;
      var turnObserver = null;
      var intervalId = null;
      var lastTurnStatus = null;
      // 暴露给 apply() 读取的运行状态——避免外部另起 `_running` 标志导致状态
      // 不一致（apply() 的 onStateChange 用 simpleController.running 读判断，
      // 与 createTrajectoryTabHider 的 `get running()` 风格对齐）。
      var isRunning = false;
      // v0.9.3：缓存上次写入 span 的 (category, text) 合并 key——tick 每 250ms 跑一次，
      // 但 99% 时间工具名没变（同时 category 也不变），不写 DOM 就不会触发 React
      // reconciler 监听 attribute / textContent 变化。category 用 "\u0000" 与 text
      // 隔开防止碰撞（工具名 / 文案里都不会出现 NUL）。
      var lastKey = null;

      function ensureStatusSpan() {
        if (typeof document === "undefined") return null;
        var existing = document.getElementById(SIMPLE_STATUS_ID);
        if (existing !== null) return existing;
        var span = document.createElement("span");
        span.id = SIMPLE_STATUS_ID;
        span.className = SIMPLE_STATUS_CLASS;
        span.textContent = "正在处理…";
        return span;
      }

      // [perf v0.x] tick() 高频（250ms）跑，findTurnStatus + getLatestTurnStatus
      // 都走 querySelectorAll(SIMPLE_TURN_STATUS_SEL)——两个调用共享一次结果。
      function queryTurnStatusList() {
        if (typeof document === "undefined") return null;
        return document.querySelectorAll(SIMPLE_TURN_STATUS_SEL);
      }

      function findTurnStatus(nodes) {
        if (nodes === undefined) nodes = queryTurnStatusList();
        if (nodes === null) return null;
        // 倒序遍历——文档顺序里最新 turn 在最后。当前正在运行的 turn 的 status
        // 元素会一直被 DSH 重渲保持在 DOM 末尾；历史已结束 turn 的 status 元素
        // 同样含 turnStatus 类但排在前。取最后一个可以确保状态行只注入当前 turn,
        // 滚动到上方看历史对话时不会被错误地注入到旧 turn 上。
        for (var i = nodes.length - 1; i >= 0; i--) {
          var el = nodes[i];
          if (el.querySelector("#" + SIMPLE_STATUS_ID) !== null) continue;
          return el;
        }
        return null;
      }

      // v0.9.12：清空容器并保留 clock——v0.9.10 CHANGELOG [Unreleased] line 63
      //   预设的回退路径。DSH loader / shimmer child（包括 React mount 第一帧
      //   CSS 还没应用时的瞬闪）一律在 JS 阶段干掉，比 v0.9.10 三层 CSS reset
      //   更彻底。同时把 inline padding/margin 归零，修 assistant-step 累加后
      //   状态行看起来像"首行缩进"。
      function purgeTurnStatus(turnStatus) {
        if (turnStatus === null || turnStatus === undefined) return;
        if (typeof document === "undefined") return;
        // 保存 clock（无论 DSH 是否已渲染——querySelector 返回 null 时跳过）
        var clock = turnStatus.querySelector('[class*="turnStatusClock"]');
        // 抹掉所有子节点——包括 DSH loader / shimmer / 我们的 span（旧）/ 其它
        while (turnStatus.firstChild) turnStatus.removeChild(turnStatus.firstChild);
        // 还原 clock 到容器里（如果之前有的话）
        if (clock !== null) turnStatus.appendChild(clock);
        // 防御性归零 inline padding/margin——修"穿插几次后像首行缩进"
        turnStatus.style.paddingLeft = '0';
        turnStatus.style.marginLeft = '0';
      }

      // 取 DOM 里文档顺序的最后一个 turnStatus（最新的 turn）。
      // 与 findTurnStatus 的区别：本函数不跳过任何 turnStatus——拿到
      // 当前正在运行的 turn（即使它已包含我们的 span）。
      // DSH 在历史已结束 turn 里会保留 [class*="turnStatus"] 节点，
      // 此时最新 turnStatus 与 current 可能不同，需走 reattach 路径。
      function getLatestTurnStatus(nodes) {
        if (nodes === undefined) nodes = queryTurnStatusList();
        if (nodes === null) return null;
        return nodes.length > 0 ? nodes[nodes.length - 1] : null;
      }

      function attach() {
        if (typeof document === "undefined") return;
        // [perf] tick 高频（250ms）；先把 turnStatus 节点列表查一次，
        // 后续 findTurnStatus / getLatestTurnStatus 共享。
        var nodes = queryTurnStatusList();
        // 已经在 attach 到当前 turnStatus——watchTurnStatus 的 MutationObserver
        // 会负责把 span 重新挂回去（DSH 偶尔会把它 detach），不需要每 250ms 重新
        // 跑 findTurnStatus + ensureStatusSpan + appendChild。
        //
        // 守卫条件收紧：除了「span 已挂在某个父节点」之外，还要求 current 是
        // DOM 里文档顺序的最后一个 turnStatus。DSH 在历史 turn 里会保留
        // [class*="turnStatus"] 节点不删（completed turn 仍可见），此时若用户
        // 开启新一轮，DSH 在尾部新增 turnStatus，原来的 current 不再是"最新"，
        // 必须走 reattach 路径把 span 搬过去——否则旧 turn 上的 status 行
        // 会跟到历史里。
        if (current !== null) {
          var existing = document.getElementById(SIMPLE_STATUS_ID);
          if (existing !== null && existing.parentNode === current && current === getLatestTurnStatus(nodes)) return;
        }
        var turnStatus = findTurnStatus(nodes);
        if (turnStatus === null) { current = null; return; }
        if (turnStatus !== lastTurnStatus) {
          lastTurnStatus = turnStatus;
          watchTurnStatus();
        }
        // v0.9.12：先 purge 后 append——v0.9.10 CSS 没杀干净的 DSH child 在
        // 这步一律干掉。appendChild 触发 turnStatus 的 layout 重排但不触发
        // MutationObserver（subtree 自身 childList 没变），开销可忽略。
        purgeTurnStatus(turnStatus);
        var span = ensureStatusSpan();
        if (span.parentNode !== turnStatus) turnStatus.appendChild(span);
        current = turnStatus;
      }

      function detach() {
        if (typeof document === "undefined") return;
        var span = document.getElementById(SIMPLE_STATUS_ID);
        if (span !== null && span.parentNode !== null) span.parentNode.removeChild(span);
      }

      // v0.9.12：watchTurnStatus 升级——观察 document.body subtree 而非
      // `el.parentNode`（v0.9.11 旧实现局限：DSH 在 React 重渲时会换掉整个
      // assistant-step 节点，旧 observer 失去目标后变僵尸）。新策略：
      //   1) 任何 mutation 触发时检查当前 span 是否仍挂在我们想挂的 turnStatus
      //      上；不是就 reattach（保留 purge 以防 DSH 偷偷在 mount 后塞 loader）
      //   2) 任何 added node（直接添加或深层嵌套）含 turnStatus，立即 purge——
      //      杀零 tick 250ms 间隔的闪援窗口：DSH 重渲立刻被拦截
      function watchTurnStatus() {
        if (turnObserver !== null) { turnObserver.disconnect(); turnObserver = null; }
        if (typeof MutationObserver === "undefined") return;
        turnObserver = new MutationObserver(function (records) {
          if (typeof document === "undefined") return;
          var span = document.getElementById(SIMPLE_STATUS_ID);
          // 1) Reattach：如果我们 span 已 orphaned 但 turnStatus 还在
          if (span !== null && current !== null && span.parentNode !== current) {
            if (current.parentNode !== null) current.appendChild(span);
          }
          // 2) Purge 任何新增的 turnStatus 节点（直接添加或深层）——
          //    包括整个 `[class*="turnStatus"]` 被 DSH 替换 / 重渲时的新实例
          for (var i = 0; i < records.length; i++) {
            var rec = records[i];
            for (var j = 0; j < rec.addedNodes.length; j++) {
              var added = rec.addedNodes[j];
              if (added === null || added === undefined) continue;
              if (added.nodeType !== 1) continue;
              if (typeof added.matches === "function" && added.matches(SIMPLE_TURN_STATUS_SEL)) {
                purgeTurnStatus(added);
                // 如果我们目前还没 attach，新出现的 turnStatus 就是目标
                if (current === null) current = added;
              }
              var sub = null;
              try { sub = added.querySelectorAll(SIMPLE_TURN_STATUS_SEL); } catch (_) { sub = []; }
              for (var k = 0; k < sub.length; k++) {
                purgeTurnStatus(sub[k]);
                if (current === null) current = sub[k];
              }
            }
          }
          // 3) 如果我们 span 完全丢失 / current 失效，下次 tick() 会重新 attach
        });
        turnObserver.observe(document.body, { childList: true, subtree: true });
      }

      function tick() {
        if (typeof document === "undefined") return;
        if (!simpleIsRunningFromDom()) {
          if (current !== null) { detach(); current = null; }
          lastKey = null;
          return;
        }
        attach();
        var span = document.getElementById(SIMPLE_STATUS_ID);
        if (span === null) return;
        // v0.9.5：simplePickActivityName 统一入口——think 优先于 tool-call。
        // 之前直接调 simplePickToolNameFromDom 时，think 状态返回 null →
        // "正在处理…"（generic 灰）；reasoning block 不在 tool-call 容器里
        // 这件事从 v0.9.3 美术度升级起就一直没解决。
        var name = simplePickActivityName();
        var text = simpleActivityText(name);
        // v0.9.3：category 给 CSS 着色用（[data-dsh-activity]），与 text 同步写。
        // 合并 key = category + "\u0000" + text——任一变化才走 DOM 写，避免 250ms
        // 轮询 × React reconciler 监听 attribute / textContent 变化的浪费。
        var category = simpleActivityCategory(name);
        var key = category + "\u0000" + text;
        if (key === lastKey) return;
        lastKey = key;
        span.textContent = text;
        span.setAttribute(SIMPLE_STATUS_ACTIVITY_ATTR, category);
      }

      function start() {
        if (typeof window === "undefined") return;
        if (intervalId !== null) return;
        isRunning = true;
        intervalId = window.setInterval(tick, SIMPLE_POLL_MS);
        tick();
      }
      function stop() {
        if (intervalId !== null) { window.clearInterval(intervalId); intervalId = null; }
        if (turnObserver !== null) { turnObserver.disconnect(); turnObserver = null; }
        detach();
        current = null;
        lastTurnStatus = null;
        lastKey = null;
        isRunning = false;
      }
      return {
        start: start,
        stop: stop,
        get running() { return isRunning; }
      };
    }

    // ===== tab-hider =====
    // v0.7.0 + v0.7.2：通用 tab hider 工厂（hide-trajectory-tab + hide-chat-tab 副作用）
    // DSH 对话顶部有 [role="tablist"] 包含 "对话"(Chat) + "轨迹"(Trajectory)
    // 两个标签（renderSlot("conversation.view", ...) 注册的两个 view entry）。
    // 用户点击"轨迹"会进入 TrajectoryView——开发者视角的事件账本。
    //
    // v0.7.2 重构：原 createTrajectoryTabHider 拆成通用 createTabHider(opts)
    // 工厂——`{ targetLabels, hiddenValue, safeLabels }`——两个 tweak 都用。
    //   - hide-trajectory-tab：target="轨迹", safe="对话"
    //   - hide-chat-tab：      target="对话", safe="对话"
    // safe 都是"对话"（DSH 默认 view）——避免两个 tab 都被关掉后用户卡在轨迹。
    //
    // controller 职责：
    //   1. 巡检 [role="tablist"] 内按钮文本，找到 targetLabels 匹配的按钮，
    //      打 data-dsh-ui-tweaks-hidden-tab=<hiddenValue> 标记（CSS 命中隐藏）
    //   2. 如果 safeLabels 匹配的"安全 tab"当前不是 aria-selected="true"——
    //      程序点击它（即使被 CSS display:none，click 仍能触发 React setView），
    //      确保 view 在默认对话页，避免用户卡在轨迹视图
    //
    // MutationObserver 观察 document.body 子树——DSH React 重渲或切换会话
    // 会重建 tablist，必须重新巡检。

    // 多语言匹配集合。DSH 用 zh / en 两种 UI 语言；其它 locale 暂不支持。
    var TRAJECTORY_TAB_LABELS = ["轨迹", "Trajectory"];
    var CHAT_TAB_LABELS = ["对话", "Chat"];
    var TRAJECTORY_TAB_HIDDEN_ATTR = "data-dsh-ui-tweaks-hidden-tab";

    function findTabButtonByLabels(labels) {
      if (typeof document === "undefined") return null;
      var tabs = document.querySelectorAll('[role="tablist"] [role="tab"]');
      for (var i = 0; i < tabs.length; i++) {
        var text = (tabs[i].textContent || "").trim();
        for (var j = 0; j < labels.length; j++) {
          if (text === labels[j]) return tabs[i];
        }
      }
      return null;
    }

    /**
     * v0.7.0 起的通用 tab hider 工厂。负责两件事：
     *   1. 给目标 tab 按钮打 data-dsh-ui-tweaks-hidden-tab=<hiddenValue> 标记
     *      → CSS 命中隐藏
     *   2. 确保"安全 tab"始终是当前选中的——避免两个 tab 都被隐藏时用户
     *      卡在某个非默认 view 上出不来。安全 tab 在 DSH 里就是 Chat
     *      （default view）。
     *
     * 用法：
     *   - hide-trajectory-tab：
     *       targetLabels = ["轨迹", "Trajectory"]
     *       hiddenValue = "trajectory"
     *       safeLabels = ["对话", "Chat"]
     *     行为：标记轨迹 tab 隐藏；如果轨迹被选中（用户之前手动切到轨迹
     *     视图），点击对话 tab 切回——避免两个 tab 都关后用户卡在轨迹。
     *
     *   - hide-chat-tab：
     *       targetLabels = ["对话", "Chat"]
     *       hiddenValue = "chat"
     *       safeLabels = ["对话", "Chat"]   // 同 target（chat 是 default）
     *     行为：标记对话 tab 隐藏；如果对话不是当前选中的（即用户在轨迹
     *     视图），点击对话 tab 切回——同上原因。
     *
     * safeLabels 之所以设成"对话"而不是"轨迹"——chat 是 DSH 默认 view，
     * hide-trajectory + hide-chat 一起开时，安全的归宿就是 chat（即使两个
     * tab 按钮都不可见，程序 click 仍能切 view）。
     */
    function createTabHider(opts) {
      var observer = null;
      var isRunning = false;

      function tick() {
        if (typeof document === "undefined") return;

        // 1) 标记目标 tab 隐藏
        var target = findTabButtonByLabels(opts.targetLabels);
        if (target && target.getAttribute(TRAJECTORY_TAB_HIDDEN_ATTR) !== opts.hiddenValue) {
          target.setAttribute(TRAJECTORY_TAB_HIDDEN_ATTR, opts.hiddenValue);
        }

        // 2) 确保安全 tab 始终是当前选中（即使其按钮被 CSS display:none，
        //    程序 click 仍能触发 React 的 setView，切 view）
        var safe = findTabButtonByLabels(opts.safeLabels);
        if (safe && safe.getAttribute("aria-selected") !== "true") {
          if (typeof safe.click === "function") safe.click();
        }
      }

      function start() {
        if (isRunning) return;
        isRunning = true;
        if (typeof MutationObserver === "undefined" || typeof document === "undefined") {
          tick();
          return;
        }
        observer = new MutationObserver(function () {
          // throttle：避免短时间内反复探测
          if (observer._pending) return;
          observer._pending = true;
          (typeof window !== "undefined" && window.setTimeout)
            ? window.setTimeout(function () {
                observer._pending = false;
                tick();
              }, 80)
            : tick();
        });
        try {
          observer.observe(document.body, { childList: true, subtree: true });
        } catch (e) { /* 静默：极端情况下（如 document.body 还没准备好）不报错 */ }
        // 立即跑一次（start 时立即生效，不要等下一次 mutation）
        tick();
      }

      function stop() {
        isRunning = false;
        if (observer !== null) { observer.disconnect(); observer = null; }
        // 移除已打的标记（CSS 注入也会被移除，状态自洽）
        if (typeof document !== "undefined") {
          var marked = document.querySelectorAll(
            '[' + TRAJECTORY_TAB_HIDDEN_ATTR + '="' + opts.hiddenValue + '"]'
          );
          for (var i = 0; i < marked.length; i++) {
            marked[i].removeAttribute(TRAJECTORY_TAB_HIDDEN_ATTR);
          }
        }
      }

      return {
        start: start,
        stop: stop,
        get running() { return isRunning; }
      };
    }

    // ===== hover-card-hider =====
    // v0.6.2：侧栏 HoverCard 隐藏 controller（hide-sidebar-tooltip 副作用）
    // DSH HoverCard 组件（`@deepseek-ai/dsh-client-ui-primitives/lib/types/HoverCard.js`）
    // 在侧栏会话项 / 工作窗口 hover 500ms 后，通过 `createPortal(card, document.body)`
    // 渲染一个 div 到 body 直接子级。card 本身没有 className（HoverCard.module.css
    // 是空 stub），role 只在 copyable=true 时才有 role="button"。
    //
    // 内部内容：
    //   - 会话：SessionHoverContent（`dsh-client-ui-workspace/lib/client.js:614`），
    //           CSS Module hash 类名 `YDXeBa_hoverContent / _hoverTitle / _hoverTime / _hoverStatus`
    //   - 工作窗口：WorkspaceHoverContent（同上 :417），类名同上 + `YDXeBa_hoverPath`
    //
    // controller 职责：
    //   1. 巡检 body 直接子元素 div，找到含 hover 相关 hash 类的 div
    //      （content / title / time / status / path 任何一个命中即视为 HoverCard）
    //   2. 给这个 div 打 `data-dsh-ui-tweaks-hidden-hover-card="true"` 标记
    //   3. CSS `[data-dsh-ui-tweaks-hidden-hover-card]{display:none!important}` 命中隐藏
    //
    // 为什么用 JS 标记 + attribute selector 而不是直接 CSS class selector：
    //   - 不用 JS：得写 `[class*="YDXeBa_hoverContent"]` 这种 selector，
    //     依赖 DSH CSS module hash——hash 随 DSH 升级会变（v0.6.0 → v0.6.1
    //     我们的 selector 因为依赖 TooltipContent 字串就出过事）。
    //   - 用 JS：attribute 名（`data-dsh-ui-tweaks-hidden-hover-card`）由我们
    //     控制，永远不变；唯一变的"探测目标"是 DSH 的 CSS module hash 类名
    //     ——集中在一个数组里，DSH 升级后改一处即可。
    //
    // 为什么探测 body 直接子元素（而不是用 `:has()` 选择器）：
    //   - `:has()` 也能命中，但每次 DSH 升级后 CSS 选择器都得改；JS-side 探测
    //     更稳健——只要 DSH 把卡片 portal 到 body（HoverCard 实现就是这样），
    //     逻辑就不变。
    //
    // MutationObserver 观察 document.body 子树——DSH React hover 行为会让
    // HoverCard 动态 mount/unmount portal div，必须重新巡检。

    // HoverCard 内部内容用到的 CSS Module hash 类名（DSH workspace 包）。
    // 包含 _hoverContent（外层 wrapper）+ _hoverTitle / _hoverTime / _hoverStatus
    // / _hoverPath（内部子元素）。
    // 任一命中即视为 HoverCard——content 可能不存在（copyable + copied 状态下
    // content 被 .YDXeBa_copied 替代），但 _hoverContent wrapper 总会存在。
    // 用 `_hoverContent` 作为主指标，其它作为冗余。
    // DSH 升级后 hash 变了改这里一处即可（其它 selector 都是 attribute selector 不受影响）。
    var HOVER_CARD_CLASS_HINTS = [
      "_hoverContent",
      "_hoverTitle",
      "_hoverTime",
      "_hoverStatus",
      "_hoverPath"
    ];
    var HOVER_CARD_HIDDEN_ATTR = "data-dsh-ui-tweaks-hidden-hover-card";
    var HOVER_CARD_HIDDEN_VALUE = "true";

    function isHoverCardRoot(el) {
      // el 是 body 的直接子 div。看它或它的后代是否含 hover 相关 hash 类名。
      if (!el || el.nodeType !== 1) return false;
      if (el.tagName !== "DIV") return false;
      for (var i = 0; i < HOVER_CARD_CLASS_HINTS.length; i++) {
        var hint = HOVER_CARD_CLASS_HINTS[i];
        // 自身或后代匹配即视为 HoverCard
        if (typeof el.querySelector === "function" &&
            el.querySelector('[class*="' + hint + '"]')) {
          return true;
        }
        // 自身 className 也匹配（极少数情况下 HoverCard card 自身就带 hash 类）
        var cls = (typeof el.className === "string") ? el.className : "";
        if (cls.indexOf(hint) >= 0) return true;
      }
      return false;
    }

    function createSidebarHoverCardHider() {
      var observer = null;
      var isRunning = false;

      function tick() {
        if (typeof document === "undefined" || !document.body) return;
        var children = document.body.children;
        for (var i = 0; i < children.length; i++) {
          var child = children[i];
          if (!isHoverCardRoot(child)) continue;
          // 已标记过则跳过（节流）
          if (child.getAttribute(HOVER_CARD_HIDDEN_ATTR) === HOVER_CARD_HIDDEN_VALUE) continue;
          child.setAttribute(HOVER_CARD_HIDDEN_ATTR, HOVER_CARD_HIDDEN_VALUE);
        }
      }

      function start() {
        if (isRunning) return;
        isRunning = true;
        if (typeof MutationObserver === "undefined" || typeof document === "undefined" || !document.body) {
          tick();
          return;
        }
        observer = new MutationObserver(function () {
          // throttle：避免短时间内反复探测（HoverCard hover/unhover 频繁触发）
          if (observer._pending) return;
          observer._pending = true;
          (typeof window !== "undefined" && window.setTimeout)
            ? window.setTimeout(function () {
                observer._pending = false;
                tick();
              }, 80)
            : tick();
        });
        try {
          observer.observe(document.body, { childList: true, subtree: true });
        } catch (e) { /* 静默：极端情况下（如 document.body 还没准备好）不报错 */ }
        // 立即跑一次（start 时立即生效，不要等下一次 mutation）
        tick();
      }

      function stop() {
        isRunning = false;
        if (observer !== null) { observer.disconnect(); observer = null; }
        // 移除已打的标记（CSS 注入也会被移除，状态自洽）
        if (typeof document !== "undefined" && document.body) {
          var marked = document.body.querySelectorAll('[' + HOVER_CARD_HIDDEN_ATTR + ']');
          for (var i = 0; i < marked.length; i++) {
            marked[i].removeAttribute(HOVER_CARD_HIDDEN_ATTR);
          }
        }
      }

      return {
        start: start,
        stop: stop,
        get running() { return isRunning; }
      };
    }

    // ===== disclosure-end-collapse =====
    // ====================================================================
    // v0.9.6：折叠块末尾收起按钮——给所有 DisclosureRow 展开后的 body 末尾
    //   追加"收起"按钮，解决"展开后想收起需要一直往前翻到头部"的痛点
    // --------------------------------------------------------------------
    // 背景：DSH 用 DisclosureRow 渲染三类可展开块——
    //   1. ReasoningRow (data-variant="think"): Think 推理块——长内容最常见
    //   2. GenericCommandCard (data-variant="others"): 工具调用输出（bash /
    //      edit / read / grep / glob 等多行输出时 body 才会渲染）
    //   3. ContextInjectionRow (class 含 _root 且 data-open): 上下文注入
    // 全部 expandOnRowClick=true——点击头部行切换展开。展开后阅读完毕想收起
    //   时必须滚回头部点行；长 Think 内容滚回很烦（尤其 reasoning 流式输出几 KB）。
    //
    // 解法：JS MutationObserver 巡检 body 元素（仅当 expanded 时 body 才在 DOM 里）
    //   给每个 body 末尾注入 wrapper div + "收起 ▴" 按钮。点击时找 body 父元素
    //   里 className 含 _row 的兄弟，调 .click() 触发 DSH React onToggle →
    //   setExpanded(false) → row 折叠，body 与按钮一起被卸载。stopPropagation
    //   防止冒泡——虽然 row 是 body 的兄弟不在祖先链上，但保险起见 stop。
    //
    // 兼容性：依赖 DSH row 元素接收 native click 事件并触发 React handler。
    //   React 17+ 委托到 root container，row.click() 会冒泡触发 onToggle。
    //   不修改 DSH 任何代码，纯附加层。
    //
    // v0.9.6 决策依据：之前反复考虑把按钮放在 body 内 vs body 外（兄弟）。
    //   选 body 内（append）— 按钮随 body 一起出现/消失，无需复杂生命周期管理；
    //   body 卸载时按钮自动 remove（React unmount 也会带走 wrapper div）；
    //   inline 位置由 body padding-left/margin-left 决定（Think 22px / Command
    //   16px / Context 22px），无需每个变体单独处理 indent。
    // ====================================================================

    /**
     * 给定已展开的 body 元素，找它在 DisclosureRow 里的"点击行"——也就是
     *   触发 setExpanded 反转的 row 元素。
     *
     * 布局：DisclosureRow 把 row（点击行）和 children（body）作为直接兄弟
     *   放进同一个 wrapper 节点。body.parentElement 就是 wrapper。
     *
     * 找 row 策略：
     *   1. 优先：在 wrapper.children 里找 className 含 `_row` 子串的——
     *      DSH CSS module hash 约定（`QWLzlG_row` / `_Xvjua_row` 等），
     *      ContextInjectionRow 不传 rowClassName 时用默认行类，子串匹配仍命中
     *   2. 兜底：wrapper.firstElementChild 不是 body 时就是 row——
     *      DisclosureRow 标准布局 row 在前 body 在后
     */
    function findRowForBody(bodyEl) {
      var wrapper = bodyEl.parentElement;
      if (!wrapper) return null;
      var children = wrapper.children;
      for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (c === bodyEl) continue;
        if (c.className && typeof c.className === "string" &&
            c.className.indexOf("_row") >= 0) {
          return c;
        }
      }
      if (wrapper.firstElementChild && wrapper.firstElementChild !== bodyEl) {
        return wrapper.firstElementChild;
      }
      return null;
    }

    /**
     * 给 body 末尾注入"收起"按钮。幂等——已注入则跳过。
     *   注入结构：<body>...text...<wrap><button>收起 ▴</button></wrap></body>
     *   wrap 强制 display:block 让按钮独占一行（不被 pre-wrap 文本内联吃掉）
     */
    function injectCollapseButton(bodyEl) {
      if (typeof document === "undefined") return;
      if (bodyEl.querySelector("[" + DISCLOSURE_END_COLLAPSE_WRAP_ATTR + "]")) return;

      var wrap = document.createElement("div");
      wrap.setAttribute(DISCLOSURE_END_COLLAPSE_WRAP_ATTR, "");

      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute(DISCLOSURE_END_COLLAPSE_ATTR, "");
      btn.textContent = "收起 ▴";
      btn.title = "收起";
      btn.setAttribute("aria-label", "收起");

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        // row.click() 触发 DSH React 的 onToggle → setExpanded(false) →
        //   body 与本按钮一起被卸载。无需手动 remove。
        var row = findRowForBody(bodyEl);
        if (row && typeof row.click === "function") {
          row.click();
        }
      });

      wrap.appendChild(btn);
      bodyEl.appendChild(wrap);
    }

    /** 巡检所有展开的 DisclosureRow body，注入按钮。 */
    function scanBodies() {
      if (typeof document === "undefined") return;
      var bodies = document.querySelectorAll(DISCLOSURE_BODY_SELECTORS);
      for (var i = 0; i < bodies.length; i++) {
        injectCollapseButton(bodies[i]);
      }
    }

    /** stop 时清理所有已注入的按钮（防御性——正常情况下 button 随 body 卸载）。 */
    function removeAllInjectedButtons() {
      if (typeof document === "undefined") return;
      var wraps = document.querySelectorAll("[" + DISCLOSURE_END_COLLAPSE_WRAP_ATTR + "]");
      for (var i = 0; i < wraps.length; i++) {
        var w = wraps[i];
        if (w.parentNode) w.parentNode.removeChild(w);
      }
    }

    /**
     * v0.9.6：DisclosureRow 末尾收起按钮 controller。start 时挂 MutationObserver
     *   观察 body subtree（DSH React 在 expand/collapse 时挂载/卸载 body）；
     *   80ms throttle 同 v0.7.0 tab-hider / v0.6.2 hover-card-hider 节奏，
     *   避免 DSH 高频重渲时反复探测。
     *   立即跑一次 scanBodies()，确保首次启动时已展开的 block 立刻有按钮
     *   （无需等下一次 mutation）。
     */
    function createDisclosureEndCollapseController() {
      var observer = null;
      var isRunning = false;

      function start() {
        if (isRunning) return;
        if (typeof document === "undefined" || !document.body) return;
        isRunning = true;
        if (typeof MutationObserver === "undefined") {
          scanBodies();
          return;
        }
        observer = new MutationObserver(function () {
          if (observer._pending) return;
          observer._pending = true;
          (typeof window !== "undefined" && window.setTimeout)
            ? window.setTimeout(function () {
                observer._pending = false;
                scanBodies();
              }, 80)
            : scanBodies();
        });
        try {
          observer.observe(document.body, { childList: true, subtree: true });
        } catch (e) { /* 静默 */ }
        scanBodies();
      }

      function stop() {
        isRunning = false;
        if (observer !== null) { observer.disconnect(); observer = null; }
        removeAllInjectedButtons();
      }

      return {
        start: start,
        stop: stop,
        get running() { return isRunning; }
      };
    }

    // ===== first-message-jump =====
    // ====================================================================
    // v0.9.1：上数第二条卡住 bug 修复 + Shift+点击一键极限（双按钮对称）：
    //   - 用 topVisible（视口内最顶部可见 user 行）替代 lastVisible 作
    //     为锚点；v0.9.0 的 lastVisible 锚点在短消息 + 滚到 rows[1] 时
    //     会因为下方 rows[2..N] 仍可见 → lastVisible 始终是 rows[N]
    //     → target 始终是 rows[N-1] → 死循环（按钮永不隐藏、永远到
    //     不了 rows[0]）。topVisible = rows[1] 时 target = rows[0]，
    //     点击后 topVisible = rows[0] → target = null → 按钮正确隐藏。
    //   - 单击我的按钮 = 上一条 user 行（topVisible.previous）
    //   - **Shift+单击**我的按钮 = 一键到 rows[0]（恢复 v0.8.0 的
    //     "一键回到最早"语义，但用 Shift 修饰，与 step-by-step 共存）
    //   - 单击原生「回到底部」按钮 = 下一条 user 行（topVisible.next）——
    //     行为从 v0.9.0 / v0.8.0 的"一键到底"改为"下一条"
    //   - **Shift+单击**原生「回到底部」按钮 = 一键到 rows[N]（原本的
    //     "一键到底"语义现在需要 Shift 修饰；DSH 原生 click handler
    //     不被 preventDefault，让它正常跑就行）
    //
    // v0.9.0：「上一条我发的消息」按钮 controller（单向上导航）——
    // 对话区右下角（输入框上方）挂一个悬浮按钮，**点击 = 跳到当前视口内
    // 最底部可见的 user 消息的上一条**。连续点击可一路向上导航，最终到
    // 达最早一条 user 消息（即 v0.8.0 的"回到最早"终点）。
    // 实现用 lastVisible（视口内最底部可见 user 行）作为锚点——在短
    // 消息场景下有"上数第二条卡住"bug，v0.9.1 改用 topVisible 修复。
    //
    // v0.8.0：原"回到最早消息"按钮——点击一次直达最早一条 user 行。
    //
    // 按钮外观：单 SVG ▲（朝上）+ aria-label "上一条我发的消息" +
    // title "上一条我发的消息（Shift+点击 = 回到最早）"。DOM / 位置 /
    // 尺寸 / 样式 / ID / CSS 选择器 [data-dsh-ui-tweaks-jump] 全部
    // 不变；localStorage key `firstMessageJump` 不动，老用户开关状态
    // 保留。
    //
    // DOM 契约（DSH 当前版本，均为稳定 attribute，不随 CSS module hash 变化）：
    //   - 滚动容器：[data-conversation-scroll]（ConversationRoot.scrollBody）
    //   - 用户消息行：[data-chat-flow-kind="user"]（ChatNodeSeat 的 kind 标记）
    //   - 输入框 seat：[data-composer-seat]（sticky bottom，随输入高度变化）
    //   - 原生「回到底部」按钮：aria-label "回到底部" / "Back to bottom"
    // 按钮样式由 25-tweaks.js 的 buildCSS 输出；本 controller 只负责挂载 /
    // 显隐 / 定位 / 点击滚动，与 tweak 开关同生命周期。原生「回到底部」
    // 按钮的钩子（capture-phase document click listener）也在本文件——
    // 负责拦截 click 事件并按 Shift 状态分发到"下一条"或"放行原生"。
    //
    // 文件拆分（v0.9.x → v0.9.2）：纯 finder / scanner 函数（不依赖
    // 闭包状态，全部以 port 作参数）抽到 68a-first-message-jump-utils.js
    // ——主文件从 645 行 / 31.2 KB 降到 ~430 行 / ~21 KB，回到
    // maintainability.md 30 KB 阈值下。函数名共享工厂函数 scope（client-src/
    // 按文件名升序整段拼接），不需要 require/import。共享常量 (JUMP_*_SEL
    // / JUMP_DRAWER_ATTR) 仍由 20-constants.js 单点定义。
    // ====================================================================

    function createFirstMessageJumpController() {
      // 控制器逻辑（定位 / 显隐 / 点击 / 生命周期 / 诊断）；纯 finder/scanner 见 68a

      var button = null;
      var scrollport = null;
      var boundScrollTarget = null;
      var visible = false;
      var isRunning = false;
      var observer = null;
      var rootObserver = null;
      var resizeObserver = null;
      var resizeObserved = null;  // 当前被 ResizeObserver 观察的输入框 seat 元素
      var jumpLastNative = null;  // 上次见过的原生「回到底部」按钮 rect（原生缺席时复用，避免跳动）
      var jumpLastPadR = null;    // 上次记录的滚动容器 padding-right（右缩变化时清记忆）
      var jumpLastComposerH = null; // 上次记录的 --dsh-composer-height（底部任务条出现/消失时清记忆）
      var nativeListenerInstalled = false;  // v0.9.1：原生按钮 capture-phase document click listener 是否已挂（防重复）

      /**
       * 抽屉是否真的盖住按钮。按钮右缘距视口右侧为 right；抽屉覆盖视口右侧 [0, 抽屉宽]。
       * 仅当 right < 抽屉宽（按钮落在抽屉阴影内）才视为遮挡。conversation-shift 已把
       * 内容让位到抽屉左侧时 right >= 抽屉宽 → 不遮挡，按钮保持可见可点。
       */
      function jumpCoveredByDrawer() {
        var dw = jumpDrawerWidth();
        if (dw === null) return true; // 有抽屉但读不到宽度 → 保守隐藏
        var right = parseFloat(button.style.right);
        if (!isFinite(right)) return true;
        return right < dw - 2;
      }

      /** 滚动容器当前的 padding-right（conversation-shift 的右缩 px；读不到按 0）。 */
      function jumpScrollportPadR() {
        if (!scrollport) return null;
        var cs = (typeof window !== "undefined" && window.getComputedStyle)
          ? window.getComputedStyle(scrollport) : null;
        if (!cs) return null;
        var pr = cs.paddingRight;
        var n = pr ? parseFloat(pr) : NaN;
        return isFinite(n) ? n : 0;
      }

      /** 当前 --dsh-composer-height（输入区高，含底部任务条等 dock；读不到按 152）。 */
      function jumpComposerHeight() {
        if (!scrollport) return 152;
        var cs = (typeof window !== "undefined" && window.getComputedStyle)
          ? window.getComputedStyle(scrollport) : null;
        if (!cs) return 152;
        var raw = cs.getPropertyValue("--dsh-composer-height");
        var n = raw ? parseFloat(raw) : NaN;
        return isFinite(n) && n > 0 ? n : 152;
      }

      /** 原生「回到底部」按钮：按 aria-label 匹配（zh/en），找不到返回 null。 */
      function jumpFindNativeBottomButton() {
        if (typeof document === "undefined") return null;
        var el = document.querySelector('[aria-label="回到底部"]');
        if (el) return el;
        return document.querySelector('[aria-label="Back to bottom"]');
      }

      /** 按"原生按钮的右缘 + 顶边"定位本按钮：右缘对齐、底缘悬在其上 JUMP_NATIVE_GAP。 */
      function jumpApplyTo(nativeRight, nativeTop) {
        var right = Math.max(8, window.innerWidth - nativeRight);
        var bottom = window.innerHeight - nativeTop + JUMP_NATIVE_GAP;
        button.style.right = Math.round(right) + "px";
        button.style.bottom = Math.round(bottom) + "px";
      }

      /**
       * 计算"原生按钮应出现的位置"（右缘 x）。从未见过原生按钮时的兜底：
       *   - 首选：直接量内容列的右缘——最早 user 行的父元素就是 .Md3f7G_column
       *     （max-width 内容宽、margin 0 auto 居中），原生槽位的 padding-right
       *     正是把它右缘对齐到内容列右缘。量 DOM 天然跟随 conversation-shift /
       *     内容宽变化，无需读 cw/padR。
       *   - 兜底：读不到行时退回公式（内容列居中 + 扣滚动容器 padding-right）。
       */
      function jumpComputeNativeRight() {
        var row = jumpFindFirstUserRow(scrollport);
        if (row && row.parentElement) {
          var colRect = row.parentElement.getBoundingClientRect();
          if (colRect && colRect.width > 0 && isFinite(colRect.right)) return colRect.right;
        }
        var portRect = scrollport.getBoundingClientRect();
        if (!portRect || portRect.width <= 0 || portRect.height <= 0) return null;
        var contentWidth = 748;
        var padR = 0;
        var cs = (typeof window !== "undefined" && window.getComputedStyle)
          ? window.getComputedStyle(scrollport) : null;
        if (cs) {
          var raw = cs.getPropertyValue("--dsh-chat-content-width");
          var parsed = parseFloat(raw);
          if (isFinite(parsed) && parsed > 0) contentWidth = parsed;
          var pr = cs.paddingRight;
          var p = pr ? parseFloat(pr) : NaN;
          if (isFinite(p) && p > 0) padR = p;
        }
        var effective = Math.min(contentWidth, portRect.width - padR);
        if (effective < 0) effective = 0;
        return portRect.left + (portRect.width - padR + effective) / 2;
      }

      /**
       * 定位策略（核心：任何时刻都只用一个位置源，杜绝"动一下"）：
       *   1) 原生按钮在场 → 直接锚定，并**记住**它的 rect；
       *   2) 原生按钮不在场（停在底部，`!atBottom` 才渲染）→ 复用上次记住的 rect——
       *      与"原生按钮将要出现的位置"完全一致，来回切换不再跳动；
       *   3) 从未见过原生按钮 → 用兜底公式估算"原生按钮应出现的位置"。
       * 原生按钮位置天然跟随「对话区右缩」（conversation-shift）等一切布局偏移，
       * 锚定/记忆路径无需自己算偏移。
       */
      function jumpPositionButton() {
        if (!button || !scrollport) return;
        var native = jumpFindNativeBottomButton();
        if (native) {
          var nr = native.getBoundingClientRect();
          if (nr && nr.width > 0 && nr.height > 0) {
            jumpLastNative = { right: nr.right, top: nr.top };
            jumpApplyTo(nr.right, nr.top);
            return;
          }
        }
        if (jumpLastNative) {
          jumpApplyTo(jumpLastNative.right, jumpLastNative.top);
          return;
        }
        var contentRight = jumpComputeNativeRight();
        if (contentRight === null) return;
        // 从未见过原生按钮：估算其顶边——原生槽位 CSS 是
        //   position:sticky; bottom:calc(var(--dsh-composer-height) + 16px)，按钮 34px
        // → 按钮顶边 = 滚动容器底 - composerHeight - (16 + 34)。
        // 16 = 原生槽位底部到 seat 顶的额外间距；34 = DSH 自带「回到底部」按钮高。
        // --dsh-composer-height 由 DSH 内联设置在滚动容器上（seat.offsetHeight），
        // 与原生槽位用的是同一个值——保证兜底与锚定位置完全重合。
        var portRect = scrollport.getBoundingClientRect();
        var nativeTop = portRect.bottom - jumpComposerHeight() - (16 + 34);
        jumpApplyTo(contentRight, nativeTop);
      }

      /** 幂等切换显隐（只写真正变化的状态）。 */
      function jumpSetVisible(next) {
        if (visible === next) return;
        visible = next;
        if (!button) return;
        if (next) button.setAttribute("data-visible", "");
        else button.removeAttribute("data-visible");
      }

      function jumpUpdate() {
        if (!isRunning) return;
        var nextPort = jumpFindScrollport();
        if (nextPort !== scrollport) {
          jumpBindScroll(nextPort);
          scrollport = nextPort;
          // 注意：不在这里清 jumpLastNative——原生按钮位置由布局决定（内容列 + 输入框高），
          // 会话/视图切换后布局不变，清掉反而会在回切对话时先按兜底公式定位造成跳动。
          // 视口尺寸变化 / 右缩 padding 变化（真正改变布局）才清。
        }
        // 右缩开关/宽度变化（conversation-shift）→ 旧的原生按钮位置失效，等下次锚定重新记忆
        var padRNow = jumpScrollportPadR();
        if (padRNow !== jumpLastPadR) {
          jumpLastPadR = padRNow;
          jumpLastNative = null;
        }
        // 输入区高度变化（底部任务条等 input.dock 出现/消失、多行输入）→ 同样失效
        var composerHNow = jumpComposerHeight();
        if (composerHNow !== jumpLastComposerH) {
          jumpLastComposerH = composerHNow;
          jumpLastNative = null;
        }
        if (!button && typeof document !== "undefined" && document.body) jumpCreateButton();
        // v0.9.1：钩原生「回到底部」按钮（幂等）。document 上挂一次 capture-phase
        // click listener；命中原生按钮时按 Shift 状态分发到"下一条"或"放行原生"。
        jumpHookNativeButton();
        // v0.9.2：可见性放宽——只要 rows.length >= 2 就显示（短会话也可见）。
        // v0.9.1 用 `target !== null` 判断：topVisible === firstRow 时按钮
        // 隐藏——但这导致短会话（2 条 user 行）底部 TodoList 卡片出现时按钮
        // 直接不出现（用户反馈"老问题"）；topVisible === firstRow 时其实
        // jumpToPrev 是 no-op（已在最顶），但按钮仍可见作为"导航面板存在"的
        // 视觉提示；Shift+点击仍能到最顶。锚点 topVisible（v0.9.1）替代
        // lastVisible（v0.9.0）——修复"上数第二条卡住"bug 这点不变。
        var allRows = jumpAllUserRows(scrollport);
        var target = jumpFindPrevUserRow(scrollport);
        var show = (allRows.length >= 2);
        if (show) jumpPositionButton();
        // 抽屉遮挡检查：conversation-shift 已让位时不遮挡 → 保持可见
        if (show && jumpIsDrawerOpen() && jumpCoveredByDrawer()) show = false;
        jumpSetVisible(show);
        // 输入框高度变化（多行输入/收起）时重新定位——观察 composer seat 元素
        if (scrollport && resizeObserver) {
          var composerEl = scrollport.querySelector(JUMP_COMPOSER_SEL);
          if (composerEl && composerEl !== resizeObserved) {
            if (resizeObserved) {
              try { resizeObserver.unobserve(resizeObserved); } catch (e) { /* 静默 */ }
            }
            resizeObserver.observe(composerEl);
            resizeObserved = composerEl;
          }
        }
      }

      function jumpBindScroll(port) {
        if (boundScrollTarget === port) return;
        if (boundScrollTarget) boundScrollTarget.removeEventListener("scroll", jumpOnScroll, true);
        boundScrollTarget = port || null;
        if (boundScrollTarget) boundScrollTarget.addEventListener("scroll", jumpOnScroll, true);
      }

      function jumpOnScroll() {
        jumpScheduleUpdate();
      }

      /** 视口尺寸变化：布局真变了，旧的原生按钮位置失效，清掉等下次锚定重新记忆。 */
      function jumpOnResize() {
        jumpLastNative = null;
        jumpScheduleUpdate();
      }

      function jumpScheduleUpdate() {
        if (!isRunning) return;
        if (observer && observer._pending) return;
        if (observer) observer._pending = true;
        window.setTimeout(function () {
          if (observer) observer._pending = false;
          jumpUpdate();
        }, 120);
      }

      /**
       * 点击：跳到"上一条"user 行（jumpFindPrevUserRow 计算）。连续点击
       * 可一路向上，最终到达 firstRow——此时按钮自动隐藏（target === null）。
       * v0.9.1：锚点从 lastVisible 改为 topVisible，修复"上数第二条卡住"
       * bug（详见 jumpFindPrevUserRow 注释）。
       */
      function jumpToPrev() {
        var port = jumpFindScrollport();
        if (!port) return;
        var row = jumpFindPrevUserRow(port);
        if (!row) return; // 已无路可上（极少见，jumpUpdate 也会隐藏按钮）
        var portRect = port.getBoundingClientRect();
        var rowRect = row.getBoundingClientRect();
        var target = 0;
        if (portRect && rowRect) {
          var off = rowRect.top - portRect.top + port.scrollTop - JUMP_TOP_PADDING;
          if (off > 0) target = off;
        }
        port.scrollTop = target;
        jumpScheduleUpdate();
      }

      /**
       * v0.9.1：Shift+单击我的按钮 → 一键到 rows[0]（最早一条 user 行）。
       * 与 v0.8.0 的「jumpToFirst」逻辑一致——把 firstRow 滚到视口顶部
       * + JUMP_TOP_PADDING。无 firstRow（空对话）则回顶（scrollTop=0）。
       * v0.9.2：firstRow 取的是「跳过 compaction 块后的第一条」——
       * jumpFindFirstRealUserRow()。这样 Shift+点击直达"当前会话的
       * 第一条"，而不是 compact 摘要里的旧 user 行（v0.9.1 落到了
       * compaction 块下方的某条 user 行——bug）。
       */
      function jumpToFirst() {
        var port = jumpFindScrollport();
        if (!port) return;
        var row = jumpFindFirstRealUserRow(port);
        if (!row) return;
        var portRect = port.getBoundingClientRect();
        var rowRect = row.getBoundingClientRect();
        var target = 0;
        if (portRect && rowRect) {
          var off = rowRect.top - portRect.top + port.scrollTop - JUMP_TOP_PADDING;
          if (off > 0) target = off;
        }
        port.scrollTop = target;
        jumpScheduleUpdate();
      }

      /**
       * v0.9.2：找"当前会话的第一条 user 行"——跳过 compaction / context
       * 容器里的 user 行。详见 jumpIsRowInCompaction。
       * 兜底：所有 user 行都在 compaction 里（极端情况）→ 返回 DOM 顺序的
       * 第一条（保留 v0.9.1 行为，宁可给一个错的目标也不要 no-op）。
       */
      function jumpFindFirstRealUserRow(port) {
        var rows = jumpAllUserRows(port);
        for (var i = 0; i < rows.length; i++) {
          if (!jumpIsRowInCompaction(rows[i])) {
            return rows[i];
          }
        }
        return rows.length > 0 ? rows[0] : null;
      }

      /**
       * v0.9.1：单击原生「回到底部」按钮（无 Shift）→ "下一条"user 行
       * （jumpFindNextUserRow 计算）。几何与 jumpToPrev 完全对称——
       * 把 target 滚到视口顶部 + JUMP_TOP_PADDING。锚点都用 topVisible：
       *   - 用户在中间（视口内含多条 user 行）→ 滚到 topVisible.next
       *   - 用户在顶部（只 rows[0] 可见）→ 滚到 rows[1]
       *   - 用户在底部（只 rows[N] 可见）→ topVisible === lastRow → target = null → no-op
       *   - 视口内无 user 行（页面刚打开 / 在对话外空白区）→ 滚到 rows[0] 作起点
       */
      function jumpToNext() {
        var port = jumpFindScrollport();
        if (!port) return;
        var row = jumpFindNextUserRow(port);
        if (!row) return;
        var portRect = port.getBoundingClientRect();
        var rowRect = row.getBoundingClientRect();
        var target = 0;
        if (portRect && rowRect) {
          var off = rowRect.top - portRect.top + port.scrollTop - JUMP_TOP_PADDING;
          if (off > 0) target = off;
        }
        port.scrollTop = target;
        jumpScheduleUpdate();
      }

      /**
       * v0.9.1：我的按钮的 click 处理器。
       *   - e.shiftKey === true  → jumpToFirst()（一键到 rows[0]）
       *   - e.shiftKey === false → jumpToPrev()（step-by-step 上一条）
       * 浏览器在 click 事件上对 shift 键的判定由 MouseEvent.shiftKey 给
       * 出——不需要自己跟踪 keydown/keyup。Edge case：合成事件（脚本
       * dispatchEvent）可能 shiftKey=false 但本意是"Shift+单击"——这
       * 是正常 DSH 用户流程不会触发的场景，忽略即可。
       */
      function jumpOnButtonClick(e) {
        if (e && e.shiftKey) {
          jumpToFirst();
        } else {
          jumpToPrev();
        }
      }

      /**
       * v0.9.1：原生「回到底部」按钮的 capture-phase click 钩子。
       * 监听器挂在 document 上（capture phase），先于任何 bubble phase
       * 监听器（包括 DSH 在原生 button 上的 onClick 与可能存在的祖先
       * delegation）触发——这样我们有"否决"权：
       *   - e.shiftKey === true → 不 preventDefault，让 DSH 原生 handler
       *     跑（它的语义本来就是"一键到底"）→ 行为退化为 v0.8.0
       *   - e.shiftKey === false → preventDefault + stopImmediatePropagation
       *     阻止原生 handler 跑，改由 jumpToNext() 做"下一条"导航
       *
       * 命中判定靠手动 walk 父链找 aria-label——target 可能是原生 button
       * 内部的子元素（SVG 等），不依赖 closest()（保持 ES5-only 风格）。
       * document listener 只挂一次（nativeListenerInstalled flag），原生
       * button 被 DSH 重渲时不需要重新挂——listener 一直在 document 上，
       * 新 button 也会被覆盖。
       */
      function jumpOnNativeClick(e) {
        if (!e || !e.target) return;
        var target = e.target;
        var foundNative = false;
        // Walk up 父链找 aria-label 匹配的 button（含其子元素被点的情况）
        while (target && target.nodeType === 1) {
          var label = (typeof target.getAttribute === "function")
            ? target.getAttribute("aria-label")
            : null;
          if (label === "回到底部" || label === "Back to bottom") {
            foundNative = true;
            break;
          }
          target = target.parentElement;
        }
        if (!foundNative) return;
        if (e.shiftKey) {
          // Shift+点击原生按钮 = 一键到底（DSH 原生 handler 跑就行）
          return;
        }
        // 单击原生按钮 = 拦截，由我们做"下一条"
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        jumpToNext();
      }

      /**
       * v0.9.1：在 document 上挂一次 capture-phase click listener。
       * 幂等：nativeListenerInstalled flag 防止重复挂。
       * 调用时机：jumpUpdate() 内每次都尝试挂——若已挂则立刻返回；这样
       * 既能早期挂上（start 后首次 jumpUpdate），又能容错（理论上
       * stop() 卸载后 start() 再挂）。
       */
      function jumpHookNativeButton() {
        if (typeof document === "undefined") return;
        if (nativeListenerInstalled) return;
        try {
          document.addEventListener("click", jumpOnNativeClick, true);
          nativeListenerInstalled = true;
        } catch (e) { /* 静默：极端环境 document 不可写 */ }
      }

      function jumpCreateButton() {
        if (button || typeof document === "undefined" || !document.body) return;
        button = document.createElement("button");
        button.type = "button";
        button.id = JUMP_BTN_ID;
        button.setAttribute("data-dsh-ui-tweaks-jump", "");
        button.setAttribute("aria-label", JUMP_LABEL);
        button.setAttribute("title", JUMP_BUTTON_TITLE);
        button.innerHTML = JUMP_SVG_UP;
        button.addEventListener("click", jumpOnButtonClick);
        document.body.appendChild(button);
      }

      function start() {
        if (isRunning) return;
        isRunning = true;
        if (typeof window !== "undefined") {
          window.addEventListener("resize", jumpOnResize);
          if (typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(function () {
              // 输入区高度变化（底部任务条等 dock 出现/消失）→ 旧原生按钮位置失效
              jumpLastNative = null;
              jumpScheduleUpdate();
            });
          }
        }
        if (typeof MutationObserver === "undefined" || typeof document === "undefined") {
          jumpUpdate();
          return;
        }
        // 宽监听：body 子树变化（会话切换 / 消息追加 / 布局重建）触发重算
        observer = new MutationObserver(function () { jumpScheduleUpdate(); });
        try {
          observer.observe(document.body, { childList: true, subtree: true });
        } catch (e) { /* 静默：body 未就绪等极端情况 */ }
        // 抽屉 attr 在 documentElement 上，body 监听看不到，单独窄监听
        rootObserver = new MutationObserver(function () { jumpScheduleUpdate(); });
        try {
          rootObserver.observe(document.documentElement, { attributes: true, attributeFilter: [JUMP_DRAWER_ATTR] });
        } catch (e) { /* 静默 */ }
        jumpUpdate();
      }

      function stop() {
        if (!isRunning) return;
        isRunning = false;
        if (observer) { observer.disconnect(); observer = null; }
        if (rootObserver) { rootObserver.disconnect(); rootObserver = null; }
        if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
        resizeObserved = null;
        if (boundScrollTarget) {
          boundScrollTarget.removeEventListener("scroll", jumpOnScroll, true);
          boundScrollTarget = null;
        }
        if (typeof window !== "undefined") window.removeEventListener("resize", jumpOnResize);
        // v0.9.1：拆掉原生按钮的 capture-phase click listener（幂等：未挂也安全）
        if (typeof document !== "undefined" && nativeListenerInstalled) {
          try { document.removeEventListener("click", jumpOnNativeClick, true); } catch (e) { /* 静默 */ }
          nativeListenerInstalled = false;
        }
        if (button && button.parentNode) button.parentNode.removeChild(button);
        button = null;
        scrollport = null;
        visible = false;
        jumpLastNative = null;
        jumpLastPadR = null;
        jumpLastComposerH = null;
      }

      /** 诊断快照（window.__dshUiTweaks.firstMessageJump() 用）。 */
      function getState() {
        var port = jumpFindScrollport();
        var rows = jumpAllUserRows(port);
        var firstRow = rows.length > 0 ? rows[0] : null;
        var lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
        var topVisible = jumpFindTopVisibleUserRow(port);  // v0.9.1：导航锚点
        var lastVisible = jumpFindLastVisibleUserRow(port);  // 诊断：v0.9.0 旧锚点（保留对照）
        var prevTarget = jumpFindPrevUserRow(port);
        var nextTarget = jumpFindNextUserRow(port);  // v0.9.1：原生按钮单击目标
        function rowInfo(r) {
          if (!r || !port) return null;
          var rt = r.getBoundingClientRect();
          return {
            kind: r.getAttribute("data-chat-flow-kind"),
            topOffset: rt.top - port.getBoundingClientRect().top
          };
        }
        return {
          running: isRunning,
          scrollport: port ? { tag: port.tagName, cls: (typeof port.className === "string") ? port.className : "" } : null,
          totalUserRows: rows.length,
          firstUserRow: rowInfo(firstRow),
          lastUserRow: rowInfo(lastRow),
          topVisibleUserRow: rowInfo(topVisible),    // v0.9.1：当前锚点
          lastVisibleUserRow: rowInfo(lastVisible),  // 诊断：v0.9.0 旧锚点（保留对照）
          targetRow: rowInfo(prevTarget),            // 我的按钮单击 → target
          nextUserRow: rowInfo(nextTarget),          // v0.9.1：原生按钮单击 → target
          scrollTop: port ? port.scrollTop : 0,
          visible: visible,
          drawerOpen: jumpIsDrawerOpen(),
          nativeHooked: nativeListenerInstalled      // v0.9.1：原生按钮 capture-phase listener 是否已挂
        };
      }

      return {
        start: start,
        stop: stop,
        getState: getState,
        get running() { return isRunning; }
      };
    }

    // ===== first-message-jump utils =====
    // ====================================================================
    // 纯 finder / scanner 函数（不依赖 closure 状态，全部以 `port` 作参
    // 数）。从 68-first-message-jump.js 拆出（v0.9.0 → v0.9.2 三轮迭
    // 代累积后主文件 645 行 / 31.2 KB，超过 maintainability.md 的 30 KB
    // 阈值）。拆分后主文件回到 ~430 行 / ~21 KB 阈值下，utils 本文件
    // ~220 行 / ~9 KB。
    //
    // 与主文件的关系：所有函数共享一个工厂函数体（client-src/*.js 按
    // 文件名升序整段拼接进 lib/client.js），所以 jump* 函数名在主文
    // 件里仍可直接调用。共享常量 (JUMP_SCROLL_SEL / JUMP_USER_ROW_SEL /
    // JUMP_DRAWER_ATTR) 由 20-constants.js 单点定义。
    //
    // 函数清单：
    //   - jumpFindScrollport         滚动容器查询
    //   - jumpAllUserRows            当前会话所有 user 行（DOM 顺序，
    //                                 转静态数组避免 NodeList live 错位）
    //   - jumpFindFirstUserRow       firstRow（DOM 顺序最早；v0.9.2 仍
    //                                 保留作为内部锚点）
    //   - jumpFindLastUserRow        lastRow
    //   - jumpIsRowInCompaction      v0.9.2：判断 row 是否嵌在
    //                                 compaction / context 容器里
    //   - jumpFindFirstRealUserRow   v0.9.2：跳过 compact 块的"当前会话
    //                                 第一条 user 行"——Shift+点击的终点
    //   - jumpFindLastVisibleUserRow 视口内最底部可见 user 行（v0.9.0
    //                                 锚点，保留作诊断对照）
    //   - jumpFindTopVisibleUserRow  v0.9.1 起当前锚点：视口内最顶部可见
    //                                 user 行——v0.9.0 的 lastVisible 在
    //                                 短消息 + 滚到 rows[1] 时会卡死
    //                                 （下方 rows[2..N] 仍可见 → 死循环）
    //   - jumpFindPrevUserRow        我的按钮单击 target（v0.9.1 锚点
    //                                 改为 topVisible 修复"上数第二条卡住"
    //                                 bug）
    //   - jumpFindNextUserRow        v0.9.1：原生「回到底部」按钮单击
    //                                 target——几何与 prev 完全对称
    //   - jumpIsDrawerOpen           右侧抽屉是否打开（attr 探测）
    //   - jumpDrawerWidth            抽屉覆盖到视口右侧的宽度（px）——读
    //                                 --active-drawer-width
    // ====================================================================

    /** 当前会话滚动容器：取第一个可见（非零尺寸）的 [data-conversation-scroll]。 */
    function jumpFindScrollport() {
      if (typeof document === "undefined") return null;
      var nodes = document.querySelectorAll(JUMP_SCROLL_SEL);
      var fallback = null;
      for (var i = 0; i < nodes.length; i++) {
        if (fallback === null) fallback = nodes[i];
        var r = nodes[i].getBoundingClientRect();
        if (r && r.width > 0 && r.height > 0) return nodes[i];
      }
      return fallback;
    }

    /**
     * 当前会话所有 user 行（DOM 顺序即时间顺序）。每次调用实时查询，
     * 不缓存（DOM 重建时引用失效；用户消息流式生成 / 删除 / React 重渲都
     * 会让旧引用作废）。
     */
    function jumpAllUserRows(port) {
      if (!port) return [];
      var nodes = port.querySelectorAll(JUMP_USER_ROW_SEL);
      // NodeList 是 live 的，转成静态数组避免迭代中 DOM 变化引起索引错位
      var arr = [];
      for (var i = 0; i < nodes.length; i++) arr.push(nodes[i]);
      return arr;
    }

    /** 最早一条 user 行（firstRow），无则 null。 */
    function jumpFindFirstUserRow(port) {
      var rows = jumpAllUserRows(port);
      return rows.length > 0 ? rows[0] : null;
    }

    /**
     * v0.9.2：判断一个 user 行是否"嵌在" compaction / context 容器里。
     * 沿父链向上走，遇到的第一个有 `data-chat-flow-kind` 属性的祖先
     * 若属于 compaction / manual-compaction / context 之一，即视为嵌
     * 在被压缩或注入的上下文里——不当作"当前会话真实的第一条"。
     *
     * 用途：jumpFindFirstUserRow 用它跳过 compact 块里的 user 行———
     * 用户期望的"第一条我发的消息"是 compaction 块之后的当前会话起点，
     * 而不是 compact 摘要里旧会话的 user 行（v0.9.1 这里返回 compaction
     * 里那条——bug）。
     */
    function jumpIsRowInCompaction(row) {
      if (!row) return false;
      var parent = row.parentElement;
      while (parent && parent !== document.body && parent.nodeType === 1) {
        var kind = (typeof parent.getAttribute === "function")
          ? parent.getAttribute("data-chat-flow-kind")
          : null;
        if (kind === "compaction" || kind === "manual-compaction" || kind === "context") {
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    }

    /** 最近一条 user 行（lastRow），无则 null。 */
    function jumpFindLastUserRow(port) {
      var rows = jumpAllUserRows(port);
      return rows.length > 0 ? rows[rows.length - 1] : null;
    }

    /**
     * 找"视口内最底部可见的 user 行"——与当前视口相交、且在 DOM 顺序
     * 中位置最靠后的那一条。可见判定 = rect 与 viewport rect 相交：
     *   row.bottom > portTop && row.top < portBottom
     * 这是"至少有一像素在视口内"的真正相交判定，比 v0.8.0 的"行顶
     * 在 viewport 顶部 200px 带内"更精确——可以正确处理"row 顶部在
     * viewport 中下部但 row 本体仍可见"的情况。
     * 视口内无 user 行 → 返回 null。
     * v0.9.1：仍保留此函数——供 `getState()` 诊断使用 + 上数第二条
     * 死循环场景的旧逻辑参考。
     */
    function jumpFindLastVisibleUserRow(port) {
      if (!port) return null;
      var rows = jumpAllUserRows(port);
      if (rows.length === 0) return null;
      var portRect = port.getBoundingClientRect();
      if (!portRect || portRect.height <= 0) return null;
      var lastVisible = null;
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i].getBoundingClientRect();
        if (!r || r.height <= 0) continue;
        // 行顶在视口下方之上（未完全滚出底部） + 行底在视口顶部之下（未完全滚出顶部）
        if (r.top < portRect.bottom && r.bottom > portRect.top) {
          lastVisible = rows[i];
        } else if (r.top >= portRect.bottom) {
          // 已超过视口底部，且 DOM 顺序后续行只会更靠后 → 后续都不可能可见，break
          break;
        }
      }
      return lastVisible;
    }

    /**
     * v0.9.1：找"视口内最顶部可见的 user 行"——与当前视口相交、且在
     * DOM 顺序中位置最靠前的那一条。可见判定同 lastVisible。
     * 视口内无 user 行 → 返回 null。
     *
     * 与 `jumpFindLastVisibleUserRow` 的区别：topVisible 是 DOM 顺序
     * 第一个可见的（最靠顶），lastVisible 是最后一个可见的（最靠底）。
     * v0.9.1 把 step-by-step 导航的锚点从 lastVisible 改为 topVisible
     * ——lastVisible 在短消息 + 滚到 rows[1] 时会卡死（因为下方 rows
     * [2..N] 仍可见 → lastVisible 始终是 rows[N]），topVisible 没有
     * 这个问题（topVisible 始终是当前视口顶部那条 user 行）。
     */
    function jumpFindTopVisibleUserRow(port) {
      if (!port) return null;
      var rows = jumpAllUserRows(port);
      if (rows.length === 0) return null;
      var portRect = port.getBoundingClientRect();
      if (!portRect || portRect.height <= 0) return null;
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i].getBoundingClientRect();
        if (!r || r.height <= 0) continue;
        // 行顶在视口下方之上（未完全滚出底部） + 行底在视口顶部之下（未完全滚出顶部）
        if (r.top < portRect.bottom && r.bottom > portRect.top) {
          return rows[i];
        } else if (r.top >= portRect.bottom) {
          // 已超过视口底部 → 后续都不可能可见，break
          break;
        }
      }
      return null;
    }

    /**
     * 找"上一条"——按钮点击的 target 行（v0.9.1 用 topVisible）：
     *   - 视口内最顶部可见 user 行 = topVisible
     *     - 若 topVisible 存在：target = topVisible 的 DOM 顺序上一条**且实际可见**
     *     - 若 topVisible 不存在（视口在所有 user 之上）：target = lastRow（首次入口）
     *   - 前面都是 hidden row：target = null（已在第一个可见 row，无路可上）
     *
     * v0.9.1 改用 topVisible 的关键修复：v0.9.0 用 lastVisible 时，
     * rows[1] 已在视口顶部但 rows[2..N] 仍可见 → lastVisible 始终是
     * rows[N] → target 始终是 rows[N-1] → 死循环（按钮永不隐藏、
     * 永远到不了 rows[0]）。改用 topVisible 后：
     *   topVisible = rows[1] → target = rows[0]
     *   点击 → 滚到 rows[0] → topVisible = rows[0] → target = null → 按钮隐藏 ✓
     *
     * v0.9.4：上一条跳过 hidden row（`getBoundingClientRect().height <= 0`）。
     * 修复：simple-mode（默认 ON）会把 compaction / context 块 `display:none`
     * 隐藏，但它们的 user 行（rows[0..K-1]）仍然在 DOM 里——`jumpAllUserRows`
     * 会返回它们，`jumpFindTopVisibleUserRow` 也正确跳过了；但原来的
     * `jumpFindPrevUserRow` 直接返回 `rows[i-1]`，当 `topVisible` 是"第一个
     * 可见 user 行"（rows[K]）时，`rows[K-1]` 是 hidden 的旧 compaction user
     * 行——target 滚到了一个用户看不见的位置 → 按钮看起来"卡死"在该行，
     * 即使再点也无变化。修正：从 topVisible 向前找第一个 height>0 的 row，
     * 没有就返回 null（与"上一条 step 到边界后按钮看似还在但 Shift+点击仍
     * 能直达第一行"的语义一致）。
     */
    function jumpFindPrevUserRow(port) {
      var rows = jumpAllUserRows(port);
      if (rows.length === 0) return null;
      var lastRow = rows[rows.length - 1];
      var topVisible = jumpFindTopVisibleUserRow(port);
      if (!topVisible) {
        // 视口内无 user 行：跳到最后一条作为入口（用户在对话上方空白区）
        return lastRow;
      }
      // 找 topVisible 在 rows 中的索引，向前找第一个实际可见（height>0）的 row
      for (var i = 0; i < rows.length; i++) {
        if (rows[i] === topVisible) {
          for (var j = i - 1; j >= 0; j--) {
            var prevRect = rows[j].getBoundingClientRect();
            if (prevRect && prevRect.height > 0) return rows[j];
          }
          // 前面都是 hidden row（simple-mode 隐藏的 compaction 行等）——
          // 已到"第一个可见 user 行"，无路可上
          return null;
        }
      }
      // 兜底：理论上不可达（topVisible 是 querySelectorAll 结果之一）
      return null;
    }

    /**
     * v0.9.1：找"下一条"——原生「回到底部」按钮单击拦截时的 target 行。
     * 锚点同样用 topVisible（与 prev 对称）：
     *   - 视口内最顶部可见 user 行 = topVisible
     *     - 若 topVisible 存在：target = topVisible 的 DOM 顺序下一条**且实际可见**
     *     - 若 topVisible 不存在（视口在所有 user 之上/之下）：
     *       target = firstRow（"从对话起点开始往下一条"——自然入口）
     *   - 后面都是 hidden row：target = null（已在最后一个可见 row，无路可下）
     *
     * 与 prev 对称：prev 用 lastRow 作为"无可见"时的入口（页面刚打开
     * 时跳到最新一条作为起点）；next 用 firstRow（"从对话起点开始往
     * 下走"——起点即入口）。语义对称。
     *
     * v0.9.4：与 prev 对称——下一条也跳过 hidden row（height<=0），
     * 避免 simple-mode 隐藏的 compaction 行（罕见但可能的"中间夹一个
     * 隐藏块"结构）被当成 target 滚过去用户却看不到。
     */
    function jumpFindNextUserRow(port) {
      var rows = jumpAllUserRows(port);
      if (rows.length === 0) return null;
      var firstRow = rows[0];
      var lastRow = rows[rows.length - 1];
      var topVisible = jumpFindTopVisibleUserRow(port);
      if (!topVisible) {
        // 视口内无 user 行：从对话起点开始（firstRow 本身）作为入口
        return firstRow;
      }
      // 找 topVisible 在 rows 中的索引，向后找第一个实际可见（height>0）的 row
      for (var i = 0; i < rows.length; i++) {
        if (rows[i] === topVisible) {
          for (var j = i + 1; j < rows.length; j++) {
            var nextRect = rows[j].getBoundingClientRect();
            if (nextRect && nextRect.height > 0) return rows[j];
          }
          // 后面都是 hidden row（simple-mode 隐藏的 compaction 行等）——
          // 已到"最后一个可见 user 行"，无路可下
          return null;
        }
      }
      // 兜底：理论上不可达
      return null;
    }

    function jumpIsDrawerOpen() {
      return typeof document !== "undefined" &&
        document.documentElement.hasAttribute(JUMP_DRAWER_ATTR);
    }

    /**
     * 当前打开的右侧抽屉宽度（px）。读 html 上的 --active-drawer-width
     * （task-pool / git-hub 等面板打开时按 FAB 让位协议设置）。无抽屉返回 null。
     */
    function jumpDrawerWidth() {
      if (!jumpIsDrawerOpen()) return null;
      if (typeof document === "undefined" || !window.getComputedStyle) return null;
      var cs = window.getComputedStyle(document.documentElement);
      var raw = cs ? cs.getPropertyValue("--active-drawer-width") : "";
      var n = raw ? parseFloat(raw) : NaN;
      return isFinite(n) ? n : null;
    }

    // ===== stats-line-position =====
    // ====================================================================
    // v0.10.0：统计行位置（stats-line-position tweak）
    // --------------------------------------------------------------------
    // DSH 对话底部那行统计（"3 轮 · 45 步 | LLM 12m13s · 工具调用 1m21s |
    //   首 token 平均 2.9s · 71 tok/s | 缓存命中 96% | 输入 3.6M tok ·
    //   输出 42.7K tok"）由 dsh-client-ui-conversation 的 StatsLine 组件渲染，
    //   注册在 slot `conversation.composer.dock`（order 0，id "stats"）。
    //
    // 三种位置：
    //   - bottom（默认）：DSH 原样，本控制器不启动，buildCSS 返回 null
    //   - top：底部原生行整条隐藏，另在顶部标题行（"对话名 + 模式"那一簇）
    //     右侧渲染一个**本插件独占的镜像元素**，内容周期性从原生行克隆
    //   - hidden：底部原生行整条隐藏，不渲染镜像
    //
    // v0.10.1：隐藏用 `visibility:hidden` 而不是 `display:none`——统计行是
    //   composer 卡片的 footer，而 composer seat 是 `position:sticky;bottom:0`
    //   贴底的，卡片变矮 24px 就等于输入行整体下移 24px（用户实测"发消息的框
    //   往下走了一点点"）。visibility 保留盒子（照常参与布局、照常被 React
    //   更新文本），高度分毫不差地保留，输入框位置与"底部"完全一致。
    //   详见 `25-tweaks.js` 的 stats-line-position buildCSS v0.10.1 段。
    //
    // 为什么"镜像"而不是"搬 DOM"：原生统计行与顶部标题行都是 DSH React
    //   渲染的节点。把原生节点 appendChild 到别的容器里，React 在下次
    //   卸载它（StatsLine 在 groups 为空时 return null，新会话开局必然发生）
    //   时会对**它记录的原父节点**调 removeChild → NotFoundError 崩 React 树。
    //   镜像方案里原生节点始终留在原位（只是不可见——React 照常更新
    //   它的文本），我们只读它的内容；镜像是本插件 createElement 出来的、
    //   React 不认识的额外尾部子节点（与 v0.9.6 disclosure-end-collapse
    //   往 body 末尾 appendChild 按钮同一模式，已验证不干扰 React 协调）。
    //
    // 为什么锚点用 `[data-slot="..."]` 而不是 CSS module 类名：DSH renderer
    //   （dsh-client-ui-renderer SlotOutlet）给**每个** slot 出口包一层
    //   `<div data-slot="<slot key>" style="display:contents">`——不含 hash、
    //   跨 DSH 版本稳定，比 `.FJxK0a_root` 这类每次构建都会变的 CSS module
    //   hash 类名可靠得多。注意这层的 `display:contents` 是 inline style，
    //   同规则组一律带 `!important` 以免被它或 DSH 后续规则翻盘。
    //
    // 隐藏粒度：直接隐藏整个 `conversation.composer.dock` 出口。DSH 自己的
    //   slot 目录（dsh-cordis-client-runner 的 slot catalog）把该 slot 的
    //   occupants 记为 `["client-ui-conversation StatsLine id 'stats'"]`——
    //   唯一占位者就是统计行，所以隐藏整个出口 == 隐藏统计行，且不依赖任何
    //   hash 类名。代价：若将来有第三方插件也往 composer.dock 注册条目，
    //   本 tweak 开启（top / hidden）时会连带隐藏它——已在 tweak description
    //   与 README 注明。
    // ====================================================================

    /** 把任意持久化值归一到三个合法位置之一（脏数据 / 老版本布尔值都退回 bottom）。 */
    function statsNormalizePosition(value) {
      if (value === STATS_POS_TOP) return STATS_POS_TOP;
      if (value === STATS_POS_HIDDEN) return STATS_POS_HIDDEN;
      return STATS_POS_BOTTOM;
    }

    /**
     * 找 DSH 原生统计行的根元素（StatsLine 的 `<div className={...root}>`）。
     *
     * 策略：先用稳定锚点 `[data-slot="conversation.composer.dock"]` 圈定范围，
     *   再在其中取**最内层**的 `[class*="_root"]`——DSH 用 Tooltip 包裹
     *   StatsLine，若 Tooltip 将来也带 `_root` 类名，最内层那个才是统计行
     *   自身。全都没命中时退回出口的第一个元素子节点。
     */
    function statsFindSource() {
      if (typeof document === "undefined") return null;
      var dock = document.querySelector(STATS_DOCK_SEL);
      if (!dock) return null;
      var list = dock.querySelectorAll(STATS_ROOT_HINT_SEL);
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i].querySelector(STATS_ROOT_HINT_SEL) === null) return list[i];
      }
      return dock.firstElementChild;
    }

    /**
     * 找顶部标题簇容器——也就是"对话名 + 模式"横向排布的那个 flex 容器
     *   （DSH ConversationRoot 的 titleCluster：children = [面包屑 nav,
     *   headerActions]）。镜像 append 到它末尾即落在模式标签右边。
     *
     * 主路径：`[data-slot="conversation.session.header.actions"]` 出口
     *   → 父（headerActions 包装 div）→ 父（titleCluster）。全程无 hash。
     * 兜底：`[class*="_titleCluster"]` 子串匹配（与 v0.7.3 HoverCard /
     *   v0.9.14 sidebar 同策略的 hash-independence 写法）。
     */
    function statsFindTitleCluster() {
      if (typeof document === "undefined") return null;
      var actions = document.querySelector(STATS_HEADER_ACTIONS_SEL);
      if (actions && actions.parentElement && actions.parentElement.parentElement) {
        return actions.parentElement.parentElement;
      }
      return document.querySelector(STATS_TITLE_CLUSTER_HINT_SEL);
    }

    /** 清掉页面上所有本插件的统计行镜像（切位置 / 停用 / header 被重建时）。 */
    function statsRemoveMirror() {
      if (typeof document === "undefined") return;
      var nodes = document.querySelectorAll("[" + STATS_MIRROR_ATTR + "]");
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
      }
    }

    /**
     * 确保标题簇末尾有一个镜像元素。幂等——已有则直接返回。
     *   当前标题簇里没有时，先把别处残留的孤儿镜像清掉（DSH 换会话重建
     *   header 的场景），再新建，保证全页面只存在一个镜像。
     */
    function statsEnsureMirror() {
      if (typeof document === "undefined") return null;
      var cluster = statsFindTitleCluster();
      if (!cluster) return null;
      var existing = cluster.querySelector("[" + STATS_MIRROR_ATTR + "]");
      if (existing) return existing;
      statsRemoveMirror();
      var mirror = document.createElement("div");
      mirror.setAttribute(STATS_MIRROR_ATTR, "");
      cluster.appendChild(mirror);
      return mirror;
    }

    /**
     * 把原生统计行的内容克隆进镜像。
     *   - 用 `cloneNode(true)` 后逐个搬运子节点，而不是直接塞克隆根——
     *     克隆根带着 DSH 的 `_root` 类（`text-align:center` / `width:100%` /
     *     `max-width:var(--dsh-chat-content-width)` / 底部专用 padding），
     *     放进标题行会撑破布局；只搬子节点则保留分隔符 `<span class="..._sep">`
     *     的类名，DSH 自己的 `.._sep{color:...;margin:0 10px}` 继续生效，
     *     视觉与底部原生行一致。
     *   - 文本没变就整段跳过，避免每 400ms 无谓重建 DOM（也顺带避免
     *     镜像自身的 mutation 触发别的观察者）。用 `title` 同时兼作
     *     "上次内容"缓存与鼠标悬停时的完整内容 tooltip（标题行窄，
     *     镜像会 ellipsis 截断）。
     */
    function statsSyncMirror(mirror, source) {
      var text = source === null ? "" : (source.textContent || "");
      if (mirror.title === text) return;
      mirror.title = text;
      while (mirror.firstChild) mirror.removeChild(mirror.firstChild);
      if (text === "" || source === null) return;
      var clone = source.cloneNode(true);
      while (clone.firstChild) mirror.appendChild(clone.firstChild);
    }

    /**
     * v0.10.0：统计行位置 controller。
     *
     * 只有 top 位置需要运行（维护镜像）；bottom / hidden 都只靠 buildCSS
     *   的纯 CSS 生效，controller 停机。
     *
     * 轮询而非 MutationObserver：统计行内容按"步"更新（不是按 token 流），
     *   400ms 轮询足够跟手；而统计行文本变化是 characterData mutation，
     *   要用 observer 就得在 document 上开 characterData+subtree——对话
     *   流式输出时每个 token 都会触发，开销远大于一次 textContent 比较。
     *   节奏与 v0.9.x simple-mode 状态行的 setInterval 轮询一致。
     *   轮询同时兼任"自愈"：DSH 换会话重建 header 后下一 tick 自动补镜像。
     */
    function createStatsLinePositionController() {
      var intervalId = null;
      var isRunning = false;

      function tick() {
        var mirror = statsEnsureMirror();
        if (mirror === null) return;
        statsSyncMirror(mirror, statsFindSource());
      }

      function start() {
        if (isRunning) return;
        if (typeof window === "undefined" || !window.setInterval) return;
        isRunning = true;
        intervalId = window.setInterval(tick, STATS_POLL_MS);
        tick();
      }

      function stop() {
        if (intervalId !== null && typeof window !== "undefined" && window.clearInterval) {
          window.clearInterval(intervalId);
        }
        intervalId = null;
        isRunning = false;
        statsRemoveMirror();
      }

      /** 按当前位置值启停。返回归一化后的位置，方便调用方记录 / 诊断。 */
      function sync(position) {
        var pos = statsNormalizePosition(position);
        if (pos === STATS_POS_TOP) start();
        else stop();
        return pos;
      }

      return {
        start: start,
        stop: stop,
        sync: sync,
        get running() { return isRunning; }
      };
    }

    // ===== debug-api =====
    // 诊断 API（暴露 window.__dshUiTweaks）

    function createDebugAPI() {
      return {
        VERSION: VERSION,
        getState: function () { return loadState(); },
        getInjectedCSS: function () {
          var t = document.querySelector("style[data-plugin-css=\"" + MAIN_CSS_TAG_ID + "\"]");
          return t ? t.textContent : null;
        },
        getMatchedElements: function () {
          // v0.5.3 起：返回 JS 探测打标记的元素 + 列容器对照
          var sels = [
            { key: "column (centerCol / data-pane)", selector: '[' + SHIM_PANE_ATTR + '="' + SHIM_PANE_VALUE + '"], [class*="centerCol"]' },
            { key: "shift targets (JS 探测 + 标记的 chatflow / input / 兜底 column)", selector: '[' + SHIFT_TARGET_ATTR + ']' }
          ];
          var out = {};
          for (var i = 0; i < sels.length; i++) {
            var nodes = document.querySelectorAll(sels[i].selector);
            var arr = [];
            for (var j = 0; j < nodes.length; j++) {
              var n = nodes[j];
              var cs = window.getComputedStyle(n);
              var shiftType = n.getAttribute(SHIFT_TARGET_ATTR) || null;
              arr.push({
                tag: n.tagName,
                cls: n.className,
                shiftType: shiftType,
                padR: cs.paddingRight,
                offsetW: n.offsetWidth,
                offsetH: n.offsetHeight,
                rect: { x: Math.round(n.getBoundingClientRect().x), y: Math.round(n.getBoundingClientRect().y), w: Math.round(n.getBoundingClientRect().width), h: Math.round(n.getBoundingClientRect().height) }
              });
            }
            out[sels[i].key] = arr;
          }
          return out;
        },
        debug: function () {
          console.group("[dsh-ui-tweaks v" + VERSION + "] debug");
          console.log("state:", this.getState());
          console.log("injected CSS:", this.getInjectedCSS());
          console.log("matched elements:", this.getMatchedElements());
          console.groupEnd();
        },
        /** 调试用：直接 patch state，触发 saveState + injectCSS + 状态事件 */
        setState: function (patch) {
          var cur = this.getState();
          var next = {};
          for (var k in cur) next[k] = cur[k];
          for (var k2 in patch) next[k2] = patch[k2];
          saveState(next);
          injectCSS(next);
          if (typeof window !== "undefined" && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: next }));
          }
          return next;
        },
        /** 立即重跑 self-shim（调试用） */
        reshim: function () {
          return applyShellShim();
        }
      };
    }

    // ===== react-tweak-row =====
    // React 组件

    /**
     * 单条 tweak 的 row：标题 + 开关 + 可选数字输入。description 隐藏在
     * `title` 属性里——鼠标悬停时由浏览器原生 tooltip 显示。
     *
     * 设计选择（v0.5.1）：
     *  - 开关**永远不 disabled**——用户必须能拨动它（v0.4.0 / v0.5.0 默认 enabled=false，
     *    但 UI 仍要可点；之前 `disabled={!enabled}` 用在 number input 是 bug，因为用户
     *    看不见开关时就被锁住，反人类）
     *  - number input 也**永远不 disabled**——可以先调像素再开开关
     *  - number input 用受控 value={value} + onChange 每键更新 parent state，
     *    没有 draft/useEffect 链。简化、消除受控输入框 边界 race condition。
     *
     * v0.7.5：description 从始终渲染的 `<p>` 收进 HTML `title` 属性。
     *   旧实现：每条 tweak 始终渲染一段 1-3 行的描述文字（最长 60+ 字），6 条 tweak
     *   在设置页铺满 200+ 像素高——但实际只有"刚开插件 / 想不起来某条做什么"时
     *   才需要看描述。新实现：description 默认不渲染，鼠标悬停在 row 上（或键盘
     *   focus）时弹出浏览器原生 tooltip（HTML `title` 属性）——所见即所得、无
     *   额外 CSS、无 JS state。CSS 同步加 `cursor:help` 提示可悬停。
     *
     * v0.10.0：支持"多选一"tweak。tweak 带 `choices`（`[{value,label}]`）时，
     *   头部右侧渲染 `<select>` 而不是开关——此时 `configKeys.enabled` 存的是
     *   选项字符串而非布尔（首例：stats-line-position 的 bottom/top/hidden）。
     *   数字输入行的判定不变（仍看 `k2 !== k1`），所以"多选一"tweak 天然不带
     *   数字框；开关型 tweak 完全不受影响（没有 choices 就走原路径）。
     */
    function TweakRow(props) {
      var t = props.tweak;
      var state = props.state;
      var setState = props.setState;
      var k1 = t.configKeys.enabled;
      var k2 = t.configKeys.value;
      var enabled = state[k1];
      var value = state[k2];
      var hasValueInput = k2 !== k1;
      var choices = t.choices || null;
      var control = null;
      var options = [];
      var i;

      function onToggle(e) {
        var next = {};
        for (var k in state) next[k] = state[k];
        next[k1] = !!e.target.checked;
        setState(next);
      }

      function onChoiceChange(e) {
        var raw = e.target.value;
        var next = {};
        for (var k in state) next[k] = state[k];
        next[k1] = raw;
        setState(next);
      }

      function onNumberChange(e) {
        var raw = e.target.value;
        if (raw === "" || raw === "-") return; // 允许临时清空，不写 state
        var n = Number(raw);
        if (!isFinite(n) || n < 0) return;
        if (n > 800) n = 800; // 与 input max="800" + 25-tweaks.js / 35-styles.js cap 对齐
        if (n === value) return;
        var next = {};
        for (var k in state) next[k] = state[k];
        next[k2] = n;
        setState(next);
      }

      if (choices !== null) {
        for (i = 0; i < choices.length; i++) {
          options.push(jsxRuntime.jsx("option", {
            value: choices[i].value,
            children: choices[i].label
          }, choices[i].value));
        }
        // 受控 <select>：value 取当前 state；state 里是脏值 / 缺省时退回第一个
        // 选项，避免 React 受控组件拿到不存在的 value 而落到空白项
        var current = enabled;
        var matched = false;
        for (i = 0; i < choices.length; i++) {
          if (choices[i].value === current) { matched = true; break; }
        }
        if (!matched) current = choices.length > 0 ? choices[0].value : "";
        control = jsxRuntime.jsx("select", {
          className: "DTPD_select",
          "aria-label": t.name,
          value: current,
          onChange: onChoiceChange,
          children: options
        });
      } else {
        control = jsxRuntime.jsx("input", {
          type: "checkbox",
          className: "DTPD_switch",
          role: "switch",
          "aria-label": t.name,
          checked: !!enabled,
          onChange: onToggle
        });
      }

      var children = [
        jsxRuntime.jsxs("div", {
          className: "DTPD_itemHead",
          children: [
            jsxRuntime.jsx("h3", { className: "DTPD_itemName", children: t.name }),
            control
          ]
        })
      ];

      if (hasValueInput) {
        children.push(
          jsxRuntime.jsxs("div", {
            className: "DTPD_valueRow",
            children: [
              jsxRuntime.jsx("label", { className: "DTPD_valueLabel", children: "像素值" }),
              jsxRuntime.jsx("input", {
                className: "DTPD_input",
                type: "number",
                min: 0,
                max: 800,
                step: 10,
                value: value,
                onChange: onNumberChange
              }),
              jsxRuntime.jsx("span", {
                style: { color: "var(--dsw-alias-label-tertiary)", fontSize: "12px" },
                children: "px (0–800)"
              })
            ]
          })
        );
      }

      return jsxRuntime.jsx("li", {
        className: "DTPD_item",
        "data-tweak-id": t.id,
        title: t.description,
        children: children
      });
    }

    // ===== react-section =====
    /** 顶级 section 组件。自包含——内部 useState 用 loadState() 做 lazy init。 */
    function UiTweaksSection() {
      var stateState = react.useState(loadState);
      var state = stateState[0];
      var setState = stateState[1];

      react.useEffect(function () {
        saveState(state);
        injectCSS(state);
        if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
          try {
            window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: state }));
          } catch (e) { /* 静默 */ }
        }
      }, [state]);

      var rows = [];
      for (var i = 0; i < TWEAKS.length; i++) {
        rows.push(jsxRuntime.jsx(TweakRow, {
          tweak: TWEAKS[i],
          state: state,
          setState: setState
        }, TWEAKS[i].id));
      }

      return jsxRuntime.jsxs("div", {
        className: "DTPD_section",
        children: [
          jsxRuntime.jsx("h2", { children: "界面微调" }),
          jsxRuntime.jsx("p", {
            className: "DTPD_intro",
            children: "DSH 外观微调合集。状态存于本机 localStorage（dsh-ui-tweaks/state）。浏览器 console 跑 window.__dshUiTweaks.debug() 可看完整诊断。"
          }),
          jsxRuntime.jsx("ul", { className: "DTPD_list", children: rows })
        ]
      });
    }

    // ===== apply =====
    // apply（loader 调一次，DSH 启动时执行）

    function apply(ctx) {
      // 1) self-shim（先于 CSS 注入，让 [data-pane="conversation"] 选择器在第一次 injectCSS 时就命中）
      applyShellShim();
      // v0.5.3：探测 chatflow 容器 + 输入框并打标记（在 CSS 注入之前——
      //   CSS 选择器是 [data-dsh-ui-tweaks-shift-target]，必须先有标记才能命中）
      applyChatflowShiftMarks();
      startShellShimObserver();
      // v0.5.4：MutationObserver 在 DSH React 重渲时同时重新打 chatflow 标记
      //   （之前的 startShellShimObserver 只负责 self-shim——现在扩展，但实际交给
      //    专门的 startChatflowMarksObserver；v0.5.5 在 startShellShimObserver 回调里
      //    也补了一次 applyChatflowShiftMarks 作为兜底——双保险）
      startChatflowMarksObserver();

      // 2) 初始 CSS（即便用户没打开设置页也立即跑；后续 UI 变化由 UiTweaksSection useEffect 触发）
      var initialState = loadState();
      injectCSS(initialState);
      injectSectionCSS();

      // 3) 诊断 API（必须早于 settings UI 注册——UI 里的"诊断"按钮会用到）
      if (typeof window !== "undefined") {
        window[DEBUG_API_KEY] = createDebugAPI();
      }

      // 4) settings.panel 挂载点（order:5）
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "ui-tweaks",
          order: 5,
          label: function () { return "界面微调"; }
        }, function () {
          return jsxRuntime.jsx(UiTweaksSection, {});
        });
      });

      // 5) 调试模式：按 initialState 即时生效
      var px = Number(initialState.conversationShiftPx);
      if (!isFinite(px) || px < 0) px = 380;
      if (px > 800) px = 800; // safety cap（与 25-tweaks.js / 35-styles.js 对齐）
      applyDebugMode(!!initialState.conversationShiftDebug, px);

      // 6) 简洁模式状态行 controller
      var simpleController = createSimpleModeStatusController();
      if (initialState.simpleModeEnabled) simpleController.start();

      // 6b) v0.7.0 + v0.7.2：tab 隐藏 controllers（用通用 createTabHider 工厂）
      //     hide-trajectory-tab 标记 "轨迹" 按钮 + 兜底点击"对话"切回
      //     hide-chat-tab       标记 "对话" 按钮 + 兜底确保在"对话"视图
      //     两个 safe tab 都是 "对话"（DSH 默认 view）——避免两个 tab 都隐藏
      //     后用户卡在轨迹视图出不来。
      var trajectoryHider = createTabHider({
        targetLabels: TRAJECTORY_TAB_LABELS,
        hiddenValue: "trajectory",
        safeLabels: CHAT_TAB_LABELS
      });
      if (initialState.hideTrajectoryTab) trajectoryHider.start();
      var chatHider = createTabHider({
        targetLabels: CHAT_TAB_LABELS,
        hiddenValue: "chat",
        safeLabels: CHAT_TAB_LABELS
      });
      if (initialState.hideChatTab) chatHider.start();

      // 6c) 侧栏 HoverCard 隐藏 controller（v0.6.2）
      var hoverCardHider = createSidebarHoverCardHider();
      if (initialState.hideSidebarTooltip) hoverCardHider.start();

      // 6d) first-message-jump 按钮 controller（v0.8.0）
      var firstMessageJump = createFirstMessageJumpController();
      if (initialState.firstMessageJump) firstMessageJump.start();

      // 6e) 把按钮诊断挂到 window.__dshUiTweaks.firstMessageJump()
      if (typeof window !== "undefined" && window[DEBUG_API_KEY]) {
        window[DEBUG_API_KEY].firstMessageJump = function () {
          return firstMessageJump.getState();
        };
      }

      // 6f) disclosure-end-collapse controller（v0.9.6）——覆盖三类 DisclosureRow
      //     展开块：ReasoningRow (Think) / GenericCommandCard（工具调用输出）/
      //     ContextInjectionRow（上下文注入）。详见 67-...js 头部注释。
      var disclosureEndCollapse = createDisclosureEndCollapseController();
      if (initialState.disclosureEndCollapse) disclosureEndCollapse.start();

      // 6g) 诊断挂到 window.__dshUiTweaks.disclosureEndCollapse() 看 running 状态
      if (typeof window !== "undefined" && window[DEBUG_API_KEY]) {
        window[DEBUG_API_KEY].disclosureEndCollapse = function () {
          return { running: disclosureEndCollapse.running };
        };
      }

      // 6h) v0.10.0：统计行位置 controller（stats-line-position tweak）
      //     bottom = DSH 默认（controller 停机，无 CSS）；
      //     hidden = 纯 CSS 隐藏底部 dock 出口（controller 仍停机）；
      //     top    = 纯 CSS 隐藏底部 + controller 在顶部标题簇维护镜像。
      //     sync() 内部做归一化，脏值 / 老布尔值都退回 bottom。
      var statsLinePosition = createStatsLinePositionController();
      statsLinePosition.sync(initialState.statsLinePosition);

      // 6i) v0.10.0：诊断挂到 window.__dshUiTweaks.statsLinePosition()——
      //     一次看清位置、镜像是否已建、两个锚点是否命中（DSH 升级后
      //     若 slot key 改名，这里会直接显示 source/cluster 为 false）
      if (typeof window !== "undefined" && window[DEBUG_API_KEY]) {
        window[DEBUG_API_KEY].statsLinePosition = function () {
          return {
            position: statsNormalizePosition(loadState().statsLinePosition),
            running: statsLinePosition.running,
            sourceFound: statsFindSource() !== null,
            titleClusterFound: statsFindTitleCluster() !== null,
            mirrorMounted: typeof document !== "undefined" &&
              document.querySelector("[" + STATS_MIRROR_ATTR + "]") !== null
          };
        };
      }

      // 7) UI 状态变化 → 启停各 controller
      function onStateChange(e) {
        var detail = (e && e.detail) || null;
        if (!detail || typeof detail !== "object") return;
        var newPx = Number(detail.conversationShiftPx);
        if (!isFinite(newPx) || newPx < 0) newPx = 380;
        if (newPx > 800) newPx = 800; // safety cap（与 25-tweaks.js / 35-styles.js 对齐）
        applyDebugMode(!!detail.conversationShiftDebug, newPx);
        if (detail.simpleModeEnabled) {
          if (!simpleController.running) {
            simpleController.start();
          }
        } else {
          if (simpleController.running) {
            simpleController.stop();
          }
        }
        if (detail.hideTrajectoryTab) {
          if (!trajectoryHider.running) trajectoryHider.start();
        } else {
          if (trajectoryHider.running) trajectoryHider.stop();
        }
        if (detail.hideChatTab) {
          if (!chatHider.running) chatHider.start();
        } else {
          if (chatHider.running) chatHider.stop();
        }
        // v0.6.2：HoverCard hider 跟随 hideSidebarTooltip 开关
        if (detail.hideSidebarTooltip) {
          if (!hoverCardHider.running) hoverCardHider.start();
        } else {
          if (hoverCardHider.running) hoverCardHider.stop();
        }
        // v0.8.0：first-message-jump 按钮跟随开关
        if (detail.firstMessageJump) {
          if (!firstMessageJump.running) firstMessageJump.start();
        } else {
          if (firstMessageJump.running) firstMessageJump.stop();
        }
        // v0.9.6：disclosure-end-collapse controller 跟随开关
        if (detail.disclosureEndCollapse) {
          if (!disclosureEndCollapse.running) disclosureEndCollapse.start();
        } else {
          if (disclosureEndCollapse.running) disclosureEndCollapse.stop();
        }
        // v0.10.0：统计行位置——三态（bottom / top / hidden）由 sync() 内部
        //   判定启停，不需要在这里读 running；隐藏与否已由 injectCSS 处理
        statsLinePosition.sync(detail.statsLinePosition);
      }
      if (typeof window !== "undefined" && window.addEventListener) {
        window.addEventListener(STATE_EVENT, onStateChange);
      }
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.name = "dsh-ui-tweaks";
    return module.exports;
  }
});