# Changelog

本文件记录 `dsh-git-hub` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.5.6] - 2026-10-04

### 修复

- **默认路径不再写死在源码里**：`DEFAULT_SCAN_ROOTS` / `DEFAULT_PUSH_TOOL` 此前是硬编码的具体目录与脚本路径，等于把某一台机器的布局当成所有人的默认值——换个环境装上之后，默认扫描的是不存在的目录、推送按钮指向一个不存在的脚本。现在两项都按 **配置文件 > 环境变量 > 未配置** 解析：
  - 配置文件：profile 根 `.git-hub-config.json` 的 `scanRoots` / `pushTool` 字段；
  - 环境变量：`DSH_GIT_HUB_SCAN_ROOTS`（逗号或分号分隔）、`DSH_GIT_HUB_PUSH_TOOL`；
  - 两级都没有时退化为空：面板显示"没有仓库"、推送按钮禁用，tooltip 与接口错误消息直接给出该去哪里补配置。
  - 环境变量里的路径与配置字段走同一套 `normalizePath`（`/` → `\`、盘符根补尾 `\`），`D:` 不会被当成"D 盘当前目录"（依赖 Node cwd）。

### 改动

- `saveConfig(scanRoots, pushTool?)` 改为「读回旧文件 → 合并写入」：面板保存只提交 `scanRoots`，手写的 `pushTool` 与其它未知字段原样保留（此前会把整个文件重写成只剩 `scanRoots`）。`pushTool` 传空串 = 清除该字段、回落环境变量。
- `POST /api/git-hub/config` 新增可选 `pushTool` 字段；`GET /api/git-hub/config` 的 `scanRoots` / `toolPath` / `toolAvailable` 三个键保持不变（客户端契约不变，本轮未改动任何 `client-src`）。
- push 工具路径改为**按请求实时解析**，不再在 `apply()` 启动期探测一次后缓存：补上路径后无需重启 DSH 即可用；`push-all` / `repos/push` 的失败文案区分「从未配置」与「配了但文件不在」。
- `spawnPush(args, scopeLabel, repoPath)` → `spawnPush(toolPath, args, scopeLabel, repoPath)`，路径由调用方解析后传入。
- README 新增 §配置（两项配置的字段 / 环境变量 / 未配置时的行为 / 推送脚本调用约定）。

### 改动文件

- `lib/index.js`
- `README.md`（新增 §配置）
- `CHANGELOG.md`（本段）
- `package.json`（version 0.5.5 → 0.5.6）

### 验证

- `node tools/check-dsh-contract.cjs`：`PASS  dsh-git-hub`（全仓 12/12）
- `node lib/verify-client.cjs`：`BYTE-IDENTICAL ✓`（`lib/client.js` 100200 字节，本轮未改动客户端源码）
- 离线集成核对（临时 harness 直接 import `lib/index.js` + 假 `ctx` / 假 `req,res`，7 组场景 22 条断言全过）：无配置时的空态与 503 文案 / 配置文件两项生效 / 面板只提交 `scanRoots` 时 `pushTool` 保留 / 环境变量兜底（含分号分隔与盘符根归一化）/ 配置覆盖环境变量 + 空串清除 / 旧配置文件（只有 `scanRoots`）向后兼容 / 配置文件损坏时仍可覆盖保存。

## [0.5.5] - 2026-10-03

### 兼容性

- 已对照 DSH 0.2.0-rc.2 实际安装源码（`@deepseek-ai/dsh` 及同目录下的 `@deepseek-ai/*` 依赖包）核验，本插件无代码变更：
  - **host 契约未变**：`ctx.webServer.register({ kind, path, handler })` 签名、`kind: 'exact'` 对应的 `ctx.webServer.exact` Map 形态、重复 `(kind, path)` 直接抛错的行为均与 0.1.5-rc.1 逐字节等价；13 条 `/api/git-hub/*` 路由的注册前查重守卫（`ctx.webServer.exact.has(path)` 命中则告警并跳过）继续成立。
  - **13 条路由在运行实例上全部注册成功**（只读探测）：6 条 GET 路由 `config` / `repos` / `push-status` / `commit-status` / `repos/branches?path=…` / `repos/merge-status` 实测 200；7 条 POST 专用路由（`repos/refresh` / `push-all` / `repos/push` / `commit` / `repos/merge` / `repos/pull` / `repos/merge-abort`）以 GET 探测均返回 405 `method-not-allowed`，说明路由存在且方法守卫先于任何 git 操作执行。全盘扫描类路由耗时属正常范围（`/repos` 约 13 s、`/commit-status` 约 10 s）。
  - **不依赖 DSH subprocess 服务**：git 调用走 Node 内置 `child_process`（`execFile`）在插件进程内完成，0.2.x 关于 subprocess handle 形态的变更不命中本插件。
  - **客户端契约未变**：19 个 `lib/client-src/*.js` 中除 `window.__ModuleLoader__.load({ id, factory })` 信封外，不使用 `ctx.slots` / `slots.inject` / `data-slot` 锚点，也不 `require` 平台模块（客户端为原生 DOM + 同源 fetch）；`dsh.bundle.patch` / `dsh.client.platform = "web"` / `exports["./client"]` 三项硬必需齐备。

### 改动文件

- `CHANGELOG.md`（本段）
- `package.json`（version 0.5.4 → 0.5.5）

### 验证

- `node tools/check-dsh-contract.cjs`：`PASS  dsh-git-hub`
- `node lib/verify-client.cjs`：`BYTE-IDENTICAL ✓`（`lib/client.js` 100200 字节，与 HEAD 一致，本轮未改动任何客户端源码）

## [Unreleased]

### 兼容性

- 已对照 DSH v0.1.5-rc.1 源码（`deepseek-ai/deepseek-harness@dsh-v0.1.5-rc.1`，SHA `183f08e9c6dde7e36cd2318eaee70b0da08fb35e`）的破坏性变更清单做兼容性核对，本插件无代码变更：
  - 本插件不依赖 DSH `subprocess` handle（`lib/index.js` 使用裸 `child_process.execFile(...).pid` 在 Node 进程内调用 git），§ 三-8（subprocess 不再暴露 `pid`）不命中。
  - 客户端 toast `PID=...` 文案为客户端字符串拼接，与 DSH 内核 API 解耦——v0.1.5-rc.1 字符串渲染逻辑不变，文本继续显示。
  - 客户端 bundle（`client-src/`）不涉及 `ctx.agents` / `ctx.slots` 字段访问，无破坏性变更命中点。
- 行为零变化——升级 DSH 内核至 v0.1.5-rc.1 不需改本插件任何代码。

### 加固

- **HTTP 路由注册前查重（防启动崩溃）**：13 条 `/api/git-hub/*` 路由改为统一经本地 `registerRoute()` 注册——先查 `ctx.webServer.exact`，路径已被其他插件占用时告警并跳过该条，不再让 `ctx.webServer.register()` 抛 `duplicate exact route`。DSH 的 webServer 对重复 `(kind, path)` 直接 throw，一次冲突会连带把本次启动打崩（历史案例：两个插件管理器抢同一条 `/api/plugin-manager/list`）。守卫所需的表结构不存在时退回直接注册，不静默失效。
- 行为变化只发生在"路径被占用"这条异常路径上：无冲突时注册的路由数量与顺序与之前完全一致。

### 改动文件

- `CHANGELOG.md`（本段）
- `lib/index.js`（新增 `registerRoute()` 守卫 + 13 处调用点）
- `package.json`（version 0.5.3 → 0.5.4）

## [0.5.2] - 2026-09-06

### 维护

- **注释精简**：移除 19 个 client-src 文件中的冗余段头 / 版本历程注释（"v0.X.Y：xxx 修法 + 根因 + 兼容性 + 改动文件列表"类段头 + inline `v0.X.Y：`前缀），保留所有 section marker / JSDoc banner / WHY（attr 协议 / FAB 让位公式 / 智能轮询 / 抽屉 race condition）。`bundle` 大小由 104641 → 100200 字节（-4.2% / -4.4 KB）。对齐 `dsh-ui-tweaks` v0.10.6 注释精简规范：`CHANGELOG.md` 是版本历程唯一来源，source 文件只保留与当前实现直接相关的"是什么 / 为什么"。详细规则见 `docs/maintainability.md` § 二
- **docs/maintainability.md 重排**：原 § 二"本插件特殊项"前插入新 § 二"注释约定"（与 `dsh-ui-tweaks` § 二 先例对齐），后续章节顺延为 § 三 / § 四；§ 一 section 索引新增 `Z9-loader-close.js` 一行 + 标注 v0.5.2 注释精简

## [0.5.0] - 2026-08-20

### 新增

- **显示选项菜单（统一管理多个功能区可见性）**：把 v0.4.0 加的「commit 工具区 toggle」按钮升级为「显示选项」按钮。drawer header 里同一个位置、同一枚 git-commit-dot-on-line 图标，点开后弹出浮层菜单，列出 4 个功能区的开关：
  1. **commit 工具区** — 顶部手动 commit 输入框（v0.4.0 起；默认隐藏，沿用 v0.4.0 偏好）
  2. **合并工具区** — merge / pull / rebase / abort（v0.3.0 起；默认显示）
  3. **推送状态条** — drawer 顶部 push 进度（默认显示）
  4. **仓库卡片推送按钮** — 每张仓库卡片标题行右上的 ⬆ 推送按钮（默认显示）
  - 每个开关独立：受控渲染——关闭时彻底从 DOM 移除对应节点（不留空容器、不调对应 render 函数、不触发对应 API 请求）
  - 持久化到 `localStorage`（沿用既有 schema 演进不升 key 的约定）：v4 = `{ pinnedPaths, hiddenPaths, sections: { commit, merge, pushStatus, perCardPush } }`；v3 文档里的 `commitSectionVisible` 字段自动映射到 `sections.commit`（保留用户 v0.4.0 默认隐藏偏好），其余 3 个 section 默认 `true`
  - 按钮 `data-active` 反映菜单打开态（菜单开 = 填色、菜单关 = 淡灰）
  - 交互：点按钮 toggle；点菜单外 / 按 Esc 关闭；同一时刻最多一个菜单展开

### 维护

- **localStorage schema v3 → v4 演进**：用 `sections` 对象替代 `commitSectionVisible` 单字段；旧字段保留兼容路径，隐式迁移 v3 → v4，不升 key
- **Controller 拆分**：`toggleCommitSection` 单方法 → `toggleSection(key)` 通用方法（白名单 key ∈ {commit, merge, pushStatus, perCardPush}）；新增 `toggleOptions` / `closeOptions` 管理菜单开/关（不持久化，纯 UI 临时态，跟 `selectionMode` 一致）
- **renderHeader 拆分**：内联 commit-toggle 按钮 → 「显示选项」按钮 + 抽出独立的 `renderOptionsMenu` 函数（菜单内容按需渲染）
- **renderBody 受控扩展**：merge 区、pushStatus、perCardPush 三处新增 sections 守卫；pushStatus 在 render 函数内部检查（不开时彻底清空 + display:none），merge / perCardPush 在 renderBody 调用层守卫

### 修复

- **显示选项菜单 CSS 定位 bug**（v0.5.0 引入）：下拉菜单设 `position:absolute` 但 `position:relative` 加在了 `.DGH_commitToggle` 按钮上；菜单 DOM 实际是 `.DGH_header` 的子元素、不是按钮的子元素，所以 reference 链找不到按钮、向上 reference 到 `<body>`——菜单渲染了内容但视觉上跑到屏幕外，点了按钮看似无反应。Fix：把 `position:relative` 从按钮移到 `.DGH_header`（菜单的直接父容器）。

## [0.5.1] - 2026-09-04

### 修复

- **drive root（盘符根）在 `normalizePath` 被尾部一刀切剥光**：用户输入 `E:\` 想扫整盘 E，保存后 round-trip 回 `E:` —— Windows 上两者不等价，`readdirSync('E:')` 是"E 盘当前工作目录"（依赖 Node cwd），`readdirSync('E:\\')` 才是"E 盘根"。scanner 拿前者扫不到用户预期范围，前端体感"保存按钮无效：明明存的是 `E:\` 怎么 reload 变 `E:`"。修复：`lib/index.js#normalizePath` 改为三步——① 全 `/` 转 `\`；② 末尾单 `\` 剥离，但若剥光剩 `<letter>:`（drive root 标点形式）必须保留；③ 兜底：纯 `<letter>:`（无尾随 `\`）主动补 `\` 把语义锁到 drive root。20 个用例（drive root / subdir / UNC / 空值 / 非字符串输入）全部 round-trip 通过。**需要重启 DSH** 让新 `normalizePath` 载入（与本段上一条 fix 同款 ESM 缓存约束，已运行进程继续走旧代码）。已保存的 `.git-hub-config.json` 里若有残留 `E:` 形式，用户下次在面板里点一次保存即被自动升级为 `E:\`。
- **配置路径修复 + 修正此前的 ReferenceError**：上次的「配置保存写到错位置」修复（v0.5.x 早期实现）改用了 `ctx.baseUrl` 解析 profile 根（正确方向），但实现细节选错了层级——把 `loadConfig` / `saveConfig` 定义在 `apply(ctx)` 闭包内，遗漏了 `getAllRepos` / `listChangedRepos` / `listMergeableRepos` 这 3 个**模块顶层**声明的函数也在引用 `loadConfig`，结果 `apply` 闭包里的 `loadConfig` 对它们不可见，`/api/git-hub/repos` 等接口一调就抛 `ReferenceError: loadConfig is not defined`，前端看到「扫描失败 internal」，抽屉仓库列表为空。本条修正实现：保留 `ctx.baseUrl` 解析（不再 `import.meta.url` 上溯），`configPath` 改为模块级 `let` mutable 引用（取代原顶层 `const`），`apply(ctx)` 同步写入一次后供模块顶层共享；`loadConfig` / `saveConfig` 回归模块顶层，`getAllRepos` 等调用方零改动。两层互相矛盾的「修复」合在一起最终落地：路径正确 + 不再 ReferenceError。重启 DSH 即可看到仓库列表重新扫描成功。

### 维护

- **80-controller.js 二级拆分**：v0.5.0 之后，原 `80-controller.js` 单文件 497 行 / 24 KB，已顶到通用规范 § 八的 50-500 行软目标上限。同 B0-view.js 拆分前一样，AI 局部改多次因全文件过大误伤同变量引用。沿"按域拆分"思路收敛：
  - `pushRepo` / `pushAll` / `pollPushStatus` / `startPushPoll` / `stopPushPoll` 抽出到 `82-controller-push.js`（101 行）
  - `loadCommitStatus` / `commit` 抽出到 `84-controller-commit.js`（62 行）
  - `loadMergeStatus` / `mergeRepo` / `pullRepo` / `abortMerge` / `sendRepoToSession` 抽出到 `86-controller-merge.js`（含域内 `/* ===== v0.3.0 merge / pull / abort ===== */` 注释）
  - `80-controller.js` 收敛到 203 行，仅保留构造器 + 状态切换 + `refresh` / `loadConfig` / `saveConfig` 三个 config 入口
  - 三个 commit 逐步执行，每步 `node --check` + `npm run build/verify:client` 验证；bundle 字节由 104088 → 104197（+109 字节，全是新文件首行 marker + 节边界换行，语义零变化）。`docs/maintainability.md` 同步更新 section 索引
- **B0-view.js 二级拆分**：v0.5.0 之后，原 `B0-view.js` 单文件 639 行 / 38 KB，超出 50-500 行软目标一倍以上，AI 局部改多次因全文件过大误伤同变量引用。进一步收敛：
  - `buildRepoCard(repo, snap, controller)` 抽出到 `B5-repo-card.js`（131 行，独立成文件，无 `renderDrawerView` 闭包依赖）
  - `renderCommitSection` + `renderMergeSection` 抽出到 `B7-sections.js`（185 行，commit / merge-pull 工具区集中）
  - `escapeHtml` 从 `renderDrawerView` 内部上移到 `30-utils.js` 工厂体层级（与 `apiFetch` / `showToast` 同作用域，更便于跨 section 共享）
  - `B0-view.js` 收敛到 336 行，回到 50-500 行目标
  - bundle 字节由 103288 → 104088（+800 字节，来自 JSDoc 注释 + 新文件首行 marker；语义零变化）。`docs/maintainability.md` 同步更新 section 索引

### 兼容性

- DSH 0.1.2-rc.1 实测：浏览器 `/?token=...` 拿到 cookie 后所有 `/api/git-hub/*` 路由正常；`ctx.webServer.register` + `ctx.timer` 契约保持不变。DSH 0.1.2 新增的"完整历史回合导航"是右侧新元素，与本插件右侧 FAB + 抽屉共存（面板互斥协议不变）。

### 维护

- **80-controller.js 二级拆分**：v0.5.0 之后，原 `80-controller.js` 单文件 497 行 / 24 KB，已顶到通用规范 § 八的 50-500 行软目标上限。同 B0-view.js 拆分前一样，AI 局部改多次因全文件过大误伤同变量引用。沿"按域拆分"思路收敛：
  - `pushRepo` / `pushAll` / `pollPushStatus` / `startPushPoll` / `stopPushPoll` 抽出到 `82-controller-push.js`（101 行）
  - `loadCommitStatus` / `commit` 抽出到 `84-controller-commit.js`（62 行）
  - `loadMergeStatus` / `mergeRepo` / `pullRepo` / `abortMerge` / `sendRepoToSession` 抽出到 `86-controller-merge.js`（含域内 `/* ===== v0.3.0 merge / pull / abort ===== */` 注释）
  - `80-controller.js` 收敛到 203 行，仅保留构造器 + 状态切换 + `refresh` / `loadConfig` / `saveConfig` 三个 config 入口
  - 三个 commit 逐步执行，每步 `node --check` + `npm run build/verify:client` 验证；bundle 字节由 104088 → 104197（+109 字节，全是新文件首行 marker + 节边界换行，语义零变化）。`docs/maintainability.md` 同步更新 section 索引
- **B0-view.js 二级拆分**：v0.5.0 之后，原 `B0-view.js` 单文件 639 行 / 38 KB，超出 50-500 行软目标一倍以上，AI 局部改多次因全文件过大误伤同变量引用。进一步收敛：
  - `buildRepoCard(repo, snap, controller)` 抽出到 `B5-repo-card.js`（131 行，独立成文件，无 `renderDrawerView` 闭包依赖）
  - `renderCommitSection` + `renderMergeSection` 抽出到 `B7-sections.js`（185 行，commit / merge-pull 工具区集中）
  - `escapeHtml` 从 `renderDrawerView` 内部上移到 `30-utils.js` 工厂体层级（与 `apiFetch` / `showToast` 同作用域，更便于跨 section 共享）
  - `B0-view.js` 收敛到 336 行，回到 50-500 行目标
  - bundle 字节由 103288 → 104088（+800 字节，来自 JSDoc 注释 + 新文件首行 marker；语义零变化）。`docs/maintainability.md` 同步更新 section 索引

### 新增

- **commit 工具区可见性开关**：抽屉 header 在 refresh 按钮旁新增 git-commit-style toggle（左右两圆点 + 直线的小图标）。点击 = 切换「抽屉顶部 commit 区是否显示」，状态持久化到 `localStorage`（沿用既有 schema 演进不升 key 的约定，新字段 `commitSectionVisible: boolean`，缺字段默认 `false`，隐式迁移 v2 → v3）。
  - 默认隐藏：贴合「commit 工具区在抽屉里几乎是噪声，多数情况下日常 commit 走 daily-push 一条龙就够了」的实际使用方式——首次升级后 commit 区不再自动出现在抽屉顶部，要手动 commit 时再点开。
  - 实现要点：受控渲染——`renderBody` 在开关关闭时彻底从 DOM 移除 `.DGH_commitSection` 节点（不留空容器 + 跳过 `renderCommitSection` 调用，省一次 `loadCommitStatus` 入口触发的网络请求）。merge 区在 commit 区关闭时直接挂在 body 顶部，仓库列表布局不变。
  - toggle 按钮视觉态：`data-active="true"` 填色（同 select-toggle 语义）；`data-active="false"` 淡灰（明确传达「这是关闭态」）。

### 维护

- **client bundle 模块化拆分**：将原 `lib/client.js`（88 KB / 1586 行单文件 bundle）按职责拆成 `lib/client-src/` 下 14 个源文件（constants / utils / summary / toast / styles / storage / controller / fab / drawer / view / apply / ...）。新增 `lib/build-client.cjs` 构建脚本将源文件按文件名升序拼接回 `lib/client.js`；DSH 加载契约（`__ModuleLoader__.load` 单文件）保持不变。
  - 拆分原则：每个 section 一个文件，文件名用两位前缀控制拼接顺序（`00-banner.js` / `10-loader-open.js` / `20-constants.js` / ... / `Z9-loader-close.js`）。`Z0-` / `Z9-` 前缀保证最后加载的"scaffolding"始终排在所有 section 之后，无需按 commit 依次 rename。
  - 字节级一致性保证：每一拆 step 用 `git diff` 验证过 `lib/client.js` 输出与 HEAD 完全一致（同字节数 90030，无任何差异），下游 DSH 加载行为零变化。后续 marker preflight 改动见下一条。
  - 维护流程：编辑 `lib/client-src/*.js` → 跑 `npm run build:client` → 同时提交源与生成的 `client.js`（部署走 `file:` 依赖，详见 `docs/maintainability.md`）。
- **Section marker 约定统一**：v0.3.0 初始拆解中 `summary` / `toast` 两个 section 文件首行不是 `// ===== X =====` 而是 JSDoc，与其他 9 个不一致。补充 marker（`    // ===== summary =====` / `    // ===== toast =====`），现在 11 个 section 文件的首行形式 100% 一致。这是有意 +52 字节（每文件 ≈26 字节的两行 marker）；条目细则写在 `docs/maintainability.md` § 三半。
- 在 `package.json` 中新增 `npm run build:client` / `npm run verify:client` 入口（后者在 13 号 commit 引入，本条 marker 协议 commit 无新增脚本）。

### 新增

- **合并工具区**：抽屉内 commit 区下方新增「🔀 合并」区，每可合并仓库一行：本地分支下拉 → merge 进当前分支 / 拉上游（`git pull` 或 `git pull --rebase`）/ 检测 `.git/MERGE_HEAD` 与 rebase-merge 给出冲突文件列表 + ✕ abort 按钮。仅对「≥2 本地分支 / 有 upstream / 处于合并/变基冲突中」的仓库展示，其他仓库零噪声。
  - 冲突态判定走文件系统（`.git/MERGE_HEAD` / `rebase-merge` / `rebase-apply`），比解析 `status` 输出更可靠，覆盖 merge / rebase / pull --rebase 全部入口。
  - dirty 工作区硬阻断：避免 merge 失败 + 工作区污染难回滚。
  - 冲突不主动 abort → 保留状态给用户决定"解决后 commit"或"abort"。
  - `parseConflictFiles` 处理 Windows stdout 输出（`CONFLICT` 行常写到 stdout 而非 stderr）+ rename `old -> new` / 引号包裹路径 / 去重。
- **手动 commit 工具多仓库**：抽屉顶部 commit 区遍历 scanRoots 下所有有改动的仓库，每行一个仓库 + 输入框 + 提交按钮；繁忙期间所有提交按钮 disabled。

### Host 路由

新增 4 个路由（`lib/index.js`）：

- `GET /api/git-hub/repos/branches?path=...`：列本地分支 + 冲突态
- `POST /api/git-hub/repos/merge`：调 `git merge [--no-ff] <source>`
- `POST /api/git-hub/repos/pull`：调 `git pull [--rebase]`
- `POST /api/git-hub/repos/merge-abort`：调 `git merge --abort` / `rebase --abort`
- `GET /api/git-hub/repos/merge-status`：扫所有可合并仓库（批量渲染用）

## [0.2.1] - 2026-08-19

作为独立 npm 包发布的初始版本，包含以下已有功能。

### 新增

- 右侧悬浮按钮（FAB）+ 右侧抽屉的仓库管理面板，与对话区共存，与同类抽屉面板互斥显示。
- 仓库扫描：遍历配置的根路径，列出其中的 git 仓库；跳过 `node_modules`、构建产物、虚拟环境等常见目录，并限制递归深度与单次扫描数量。
- 仓库卡片：显示分支、工作区是否干净、未推送 commit 数、当日 commit 数与最新 commit 摘要，状态徽章带说明性悬停提示。
- 推送操作：单仓库推送与批量推送，均以独立子进程调用外部推送脚本执行，立即返回而不阻塞界面。
- 推送状态按需轮询：仅在有推送运行时以 4 秒间隔轮询，推送结束或抽屉关闭时自动停止，空闲时不发起网络请求。
- 推到对话：将仓库摘要作为用户消息注入当前会话，便于在对话中继续处理远端事务。
- 钉住与隐藏：钉住的仓库置顶，隐藏的仓库不在列表显示且禁止推送；提供隐藏选择模式便于批量标记。
- 配置面板：在抽屉内编辑扫描根路径列表，以原子写方式持久化到 web profile 根目录下的 `.git-hub-config.json`。
- 宿主半段暴露 `/api/git-hub/*` 系列 HTTP 路由（配置读写、仓库列表、强制刷新、推送触发、推送状态）。
- 界面状态（钉住 / 隐藏列表）持久化在浏览器 `localStorage`，并在存储不可用时降级为内存存储。