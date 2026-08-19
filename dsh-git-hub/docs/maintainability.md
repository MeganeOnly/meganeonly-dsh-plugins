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
    25-...</naming>
    ...                      
    Z9-loader-close.js       闭合 load() + return module.exports
```

DSH 客户端 bundle 的契约不变：`lib/client.js` 仍然是单一 `__ModuleLoader__.load(...)` 文件。`build-client.cjs` 把 `lib/client-src/*.js` 按文件名升序拼接，生成的内容与拆分前完全一致（字节级一致，90030 字节，详见 § 五）。

## 三、命名规则（控制拼接顺序）

源文件用 `NN-name.js` 两位前缀；前缀按字典升序拼接到输出中。

| 前缀          | 角色                                                         |
| ------------- | ------------------------------------------------------------ |
| `00-`         | banner（顶部注释块）                                         |
| `10-`         | loader envelope opening（`__ModuleLoader__.load({...})` 开头） |
| `20-` `25-` `30-` … | 拆出的 section（每个文件一个职责：constants / utils / summary / toast / styles / storage / controller / fab / drawer / view / apply） |
| `Z9-`         | 末尾 scaffolding：`Z9-loader-close.js` 永远是拼接链的最后一个 |

**为什么用前缀**：ASCII 字典序里 `Z` > 数字 → 任何带 `Z` 前缀的文件排在任何数字前缀之后 → "末尾收尾段（loader close）" 始终在最末，不需要随拆解进度 rename。

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

## 五、字节级一致保证（为什么能 byte-identical）

`lib/client.js` 的内容是 1500+ 行手工写就的 JS；拆分后用脚本拼接理论上会引入 boundary 处的换行差异。为了验证，把每一 step 的拆解都用同一个字节-比较脚本（`node -e "...Buffer.compare..."`）核对一次：

- 拼接顺序与原 `lib/client.js` 一致（同 1500 多行按相同顺序出现）
- 文件末尾无多余换行（原文件无 trailing newline，loader-close 也不加）
- section 之间的空行（blank separator）显式保留：在每一 section 文件尾加 `\n\n`（一个 \n 结束 section，最后一个 \n 是 blank separator 的 terminator；factory-body 不再保留 blank）

每一拆 commit 后用 `git diff lib/client.js` 检验：应显示 zero diff。CI / pre-commit 可以加这一检查。

## 六、添加新 section

1. 创建 `lib/client-src/NN-newsection.js`，按职责决定前缀 `NN`（参考现有命名）
2. 文件以 section 内容开始（不需要 `// =====` 之类分隔符；如果有 JSDoc，必须以 `/**` 起始）
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
