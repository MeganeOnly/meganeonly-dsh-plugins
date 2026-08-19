# 维护性：client bundle 模块化

本文档解释 `lib/client-src/` 子文件的拆分结构、维护流程与边界规则。读者：维护者与自动化维护工具（AI agent、代码 review 工具）。

## 一、问题背景

DSH 客户端 bundle 必须是单一文件（`window.__ModuleLoader__.load({ id, factory })` 契约，运行时按文件路径 `/plugins/<id>/client.js` 加载，无法直接拆成多个 HTTP 文件）。在 `v0.1.x` 到 `v0.3.x` 的迭代中，`lib/client.js` 从数百行增长到 1586 行 / 88 KB；同时维护越来越困难：

- **人类**打开一次要扫 1500+ 行才能定位函数
- **AI agent** 的 "读完整个文件再改一处" 模式在长文件下反复出现漏改、误改（同一个变量在多处同名，下游的引用会被一刀切地全局替换）
- **diff 噪声**：单次改动看起来只动几行，但 reviewer 必须读完整个文件上下文才能判断影响范围

## 二、解决方案

```
lib/
  client.js                  ← 生成的 artifact（仍入库，与 file: 部署同步）
  build-client.cjs           ← 把 client-src/ 拼回 client.js 的脚本
  client-src/                ← 编辑入口（按职责拆分的源文件）
    00-banner.js             顶部 JSDoc 注释块
    10-loader-open.js        window.__ModuleLoader__.load({ id, factory: ... }) 开头
    20-constants.js          常量（STORAGE_KEY / DRAWER_ATTR / ...）
    30-utils.js              date / fetch helpers
    40-summary.js            sendRepoSummaryToSession + buildSummaryText
    50-toast.js              showToast
    60-styles.js             CSS 字符串 + injectCSS
    70-storage.js            LocalStorageStore
    80-controller.js         Controller 类（含状态 + 仓库动作 + commit + merge/...）
    90-fab.js                FAB 图标 + mountFab
    A0-drawer.js             mountDrawer（互斥协议 + DOM 挂载）
    B0-view.js               renderDrawerView（header / push / commit / merge / body / config）
    C0-apply.js              apply 函数 + exports
    Z9-loader-close.js       闭合 load() + return module.exports
```

DSH 客户端 bundle 的契约不变：`lib/client.js` 仍然是单一 `__ModuleLoader__.load(...)` 文件。`build-client.cjs` 把 `lib/client-src/*.js` 按文件名升序拼接（v0.3.0 拆解后含 13 个 section 文件 + 3 个 scaffolding 文件，详见 § 三；当前 bundle 大小 90082 字节）。

## 三、命名规则（控制拼接顺序）

源文件用 `NN-name.js` 两位前缀；前缀按字典升序拼接到输出中。

| 前缀          | 角色                                                         |
| ------------- | ------------------------------------------------------------ |
| `00-`         | banner（顶部注释块）                                         |
| `10-`         | loader envelope opening（`__ModuleLoader__.load({...})` 开头） |
| `20-` `25-` `30-` … | 拆出的 section（每个文件一个职责：constants / utils / summary / toast / styles / storage / controller / fab / drawer / view / apply） |
| `Z9-`         | 末尾 scaffolding：`Z9-loader-close.js` 永远是拼接链的最后一个 |

**为什么用前缀**：ASCII 字典序里 `Z` > 数字 → 任何带 `Z` 前缀的文件排在任何数字前缀之后 → "末尾收尾段（loader close）" 始终在最末，不需要随拆解进度 rename。

## 三半、Section marker 约定（硬约束）

**每一个 section 文件的首行必须是 `    // ===== X =====`**（4 空格缩进 + 名称）。

- 名称与文件名 `NN-name.js` 的 `name` 部分保持一致（kebab-case 或中文皆可；现有文件用 "CSS" / "Controller" / "LocalStorageStore（钉住列表）" 等原 section 标题）
- 唯一允许破例的是 `00-banner.js`（整块就是一个 `/** ... */`，自身已经是注释，再加 marker 冗余）
- 拆解前若原始 bundle 中某 section 缺此 marker，**preflight 步骤必做**：在 section 顶行插入一行 `    // ===== X =====`

示例（60-styles.js / 40-summary.js）：

```js
// 60-styles.js
    // ===== CSS =====
    var CSS = "" + ...

// 40-summary.js
    // ===== summary =====
    /** 把当前会话里发"仓库摘要"消息... */
    function sendRepoSummaryToSession(...) { ... }
```

不允许（首行只能是 `    // ===== X =====`，**除 `00-banner.js` 例外**）：

```js
function NAME(...) { ... }     // 首行直接函数声明
/** JSDoc */                  // 首行 JSDoc
var X = ...;                  // 首行变量
```

**结果一致性**：所有 section 文件首行 100% 同形，未来按 marker 定位 boundary 的提取/合并逻辑无需为特例再写代码。

## 三三、client-src 编码风格（硬约束）

编辑 `lib/client-src/*.js` 时**必须遵守**：这些 source 被原样拼进 bundle，AI 维护时不需要重新理解风格；改了不一致的风格，diff review 与 AI 重构（"把 var 改成 const"这种 whole-file 改造）会变得困难且无收益。

**语言级别**：ES5 语法，无 ES2015+ 特性。

| 允许 | 不允许（哪怕能跑） |
| --- | --- |
| `var X = ...` | `const X` / `let X` |
| `function NAME(...) { ... }` 函数声明 | `var NAME = (...) => ...` / `const NAME = function() {}` 之外的行内赋值 |
| `function NAME(...) { ... }` + `NAME.prototype.method = function() {...}` | `class NAME { method() { ... } }` |
| 字符串双引号 `"..."` | 模板字符串 `` `...` `` / 单引号 `'...'`（除 `'__none__'` 这类约定常量外） |
| `===` / `!==` | `==` / `!=`（允许 B0-view.js 现有的 `s == null` 这种 legacy 写法渐迁，但不引入新用法） |
| `.then(function() {...})` | `async function` / `await` |
| `for` / `while` 经典循环 | `for (const x of arr)` / `.forEach(function() {...})`（允许 callback 形式） |

**唯一允许箭头函数的位置**：`10-loader-open.js` 的 `factory: (require) => { ... }` —— 这是 `window.__ModuleLoader__.load` 的 spec 强制的。其他文件里的内部函数全部使用 `function` 声明。

**模块 / 类结构模式**（本项目仅有的"类"）：

```js
function ModuleName(arg1, deps) {
  this.field = ...;
}
ModuleName.prototype.methodName = function (arg) {
  var self = this;
  return apiFetch(...).then(function (data) {
    return self.field;
  });
};
```

控制器类（Controller / LocalStorageStore）就是这套；新加的"类"也按这个写，不引 `class` 关键字——保持 bundle 零编译依赖（参考 `dsh-persistent-plugin-authoring` § III "peek-hour-lock 即手写零依赖，语法检查通过即可"）。

**注释规范**：

```js
/** 单行 JSDoc 描述函数/方法做什么。 */      // 用在文档化过的 public 函数/方法上
function publicMethod() { ... }                // 主行紧跟 JSDoc 之上，无空行

// 行内注释（解释 why，不解释 what）             // 中文 / 英文都接受；项目里现以中文为主
this.dirty = false;  // 单字段后置注释 OK
```

- JSDoc 用单行 `/** ... */` 即可，本项目不强制 @param/@returns 完整 tag
- 章节内子模块用 `// ----- xxx -----` 或 `/* ===== v0.X.X xxx ===== */` 隔开（如 80-controller.js 里的 v0.3.0 merge/pull/abort 段落）
- 不要在生成的 bundle 文件里写 linter-disable 行

**字符串拼接**：用 `+` 而不是模板字符串：

```js
// ✓
showToast(repoName + " 已 commit " + data.sha + "（" + data.filesChanged + " 个文件）", "info");
// ✗ （模板字符串在这里是异类）
showToast(`${repoName} 已 commit ${data.sha}（${data.filesChanged} 个文件）`, "info");
```

**async 流程**：所有异步走 Promise + `.then(function() {})` 链式，**不用** `async/await`。`Controller.prototype.commit` / `mergeRepo` / `pullRepo` 等都是这个模式。

**DOM**：

- 仅用 vanilla DOM API：`document.createElement`、`element.appendChild`、`element.addEventListener`、`element.querySelector`、`element.dataset.xxx`
- 不要引 React / jQuery / shadcn 等任何库
- 多面板互斥、隐藏选择模式、抽屉滑入等都用 `position:fixed` + `<html data-...>` 属性 + CustomEvent 协调（参见 `dsh-persistent-plugin-authoring` § III）

**模块边界**：source 文件之间**不**互 require/import。所有跨 section 共享的"私有常量"放 `20-constants.js`。其它（如 `apiFetch`、`showToast`、`escapeHtml`）通过**同 factory body 内顶层定义 + 引用**——拼接产物里这些都在同一个 closure 范围内。

**禁止的"AI 风格漂移"清单**——以下模式虽然 JS 合法，但**禁止在 client-src 中使用**，原因是会让 future AI 重构脚本（如全局 "var → const"）的危险区域扩大：

```js
// 全部禁止
const X = 1;
let Y = 2;
const arrow = (a) => a + 1;
class Foo {}
async function bar() { await something; }
const tmpl = `hello ${name}`;
arr.map(x => x * 2);
arr.forEach(x => do(x));
for (const x of arr) { ... }
```

**理由**：client bundle 由 14 个 source 文件拼成，任何"全局风格迁移"或"自动重构"工具如果针对这些文件做替换，会跨文件改变大量语法。但是反过来，**顶层 loader 的 arrow（`(require) => {...}`）** 必须保留——那是被 spec 强制的、跨文件也不需要替换的边界。

## 四、编辑流程

```bash
# 1. 改一个或多个 client-src/*.js
# 2. 跑构建脚本
npm run build:client
# 等价于
node lib/build-client.cjs

# 3. 验证（推荐 step）：
#    a) 字节级一致（与上一次提交对比）
git diff --stat lib/client.js     # 不应出现 diff
npm run verify:client             # 对比 working tree 与 HEAD 的 lib/client.js 字节

#    b) 语法
node --check lib/client.js

#    c) lint（如果启用了）
# npx eslint lib/

# 4. 同时提交源文件 + 生成的 client.js
git add lib/client-src/ lib/client.js
git commit -m "..."
```

**重要**：

- `lib/client.js` **必须**与 `lib/client-src/*.js` 同时提交。`pnpm file:` 依赖是文件拷贝，不是链接；`pnpm install` 不检测内容变化（详见 `dsh-persistent-plugin-authoring` § IV.4）。
- 如果编辑后忘了跑 `build:client`，`lib/client.js` 会与源不同步。提交前检查 `git diff --stat lib/client.js`：应有变更。如果你改的是源文件而 `client.js` 没变，要么 build 没跑，要么编辑没生效。

## 五、字节级一致保证（与最近一次提交对比）

`verify:client` 把工作区的 `lib/client.js` 与 HEAD 提交版本逐字节对比。**目的不是和某个固定的"原版"一致**，而是确保源改动后 bundle 已被重新生成：

- 拆解过程中（commit 2-12）bundle 与 commit 1 完全一致（不引入额外字节）
- 后续 marker preflight（§ 三半）等新增会**有意**增大 bundle 几十字节，verify 报告 DIFFERS 是预期，不算 bug
- `verify:client` 在两种状态都应当**总是可重复**：跑两次结果相同（除非源被改）
- 真正要排查的是"我改了 client-src/ 但 `lib/client.js` 没动"——这时 verify 报 DIFFERS，且 `git diff --stat lib/client.js` 应该跟着源码 diff 一起变更。如果改了源但 bundle 没 diff，意味着 `build:client` 没跑

边界规则（避免后续插件拆分时再踩坑）：

- 文件末尾换行：每个 source 文件末尾必须有 `\n`（除了 `Z9-loader-close.js`，对应原 bundle 末尾无换行）。缺换行 = bundle 丢内容 = syntax error
- section 文件末尾：`\n\n`（一个 \n 结束 section 末行，一个 \n 是 blank separator 的 terminator；除最后一个 section 用 `\n` 单个）
- 文件末尾无多余换行：`Z9-loader-close.js` 末行 `});` 不带 `\n`，对应原 bundle 无 trailing newline

## 六、添加新 section

1. 创建 `lib/client-src/NN-newsection.js`，按职责决定前缀 `NN`（参考现有命名）
2. 文件第一行必须是 `    // ===== X =====`（参见 § 三半 marker 约定）
3. 文件结尾：`\n`（如果你想接续下一个 section）或者 `\n\n`（如果你想加 blank separator）
4. 跑 `npm run build:client`，`git diff lib/client.js` 应该显示 byte-identical 或预期的合理 diff
5. 提交源 + `client.js`

## 七、修改或移动 section

1. 找出现在 / 目标文件的对应字节范围
2. 编辑或移动文件
3. 跑 `npm run build:client`
4. 验证：
   ```bash
   node --check lib/client.js
   git diff --stat lib/client.js  # 应非空（确实改到了）但不破坏结构
   ```
5. 提交

## 八、风险与限制

- **空格严格**：每个 source 文件末尾必须有 `\n`（除了 `Z9-loader-close.js`，它对应原 bundle 末尾的无换行）。如果某文件末尾缺换行，构建脚本会丢内容，bundle 在加载时 syntax error。
- **不嵌套**：源文件之间**不**互相 require/import。整段拼接是把所有代码放进同一个 factory 函数体内。任何想跨文件共享的"私有常量"，都通过 `20-constants.js` 单点定义。
- **命名约定硬性**：禁止引入违反前缀排序的文件（如 `9-` 单数字前缀会乱排）。新文件必须用两位数字或 `A0-` / `B0-` … 等字母+数字前缀。
- **不要拆分过细**：拆分的目的是 50–500 行的文件便于人类阅读、AI 不需要一次性理解 1000+ 行上下文。10 行的工具函数不必拆成单文件。

## 九、相关

- `lib/build-client.cjs`：构建脚本实现
- `docs/maintainability.md`：本文档
- `package.json`：包含 `scripts.build:client`
- `CHANGELOG.md`：拆分变体记录在 `[Unreleased]` 段
