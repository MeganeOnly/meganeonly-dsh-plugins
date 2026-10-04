# Changelog

dsh-plugins-all 的变更记录。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-10-04

### 新增

- 初次入库：DSH 常驻插件的名册聚合包。
  - 用一份 `cordis.patch.yml`（11 个 `- insert:` 块）把仓库内 11 个插件的名册行一次性插入 web profile，profile 侧只需为本包登记一个 bundle 条目。
  - `aggregate.json` 为收录清单真源；`scripts/aggregate.cjs` 从各成员自己的 `cordis.patch.yml` 逐行投影出 insert 块，并校验成员目录、`dsh.bundle.patch` 存在性、`name` 与包名一致、行 id 与包名不重复，以及本包 `dependencies` 与清单一致（含 `file:` specifier 指向的目录是否对得上）。
  - `npm run build:patch` 生成、`npm run verify:patch` 只校验不写盘。
  - 行 id 与各插件独立安装时保持一致，profile 层已有的按 id 停用条目在聚合后继续有效。
  - `dsh-test` 收录但默认 `disabled: true`（插入不挂载）。
  - 本包不自插名册行，也不提供浏览器半段。
  - `package.json#dependencies` 声明全部成员（`file:../<目录>`），描述的是成员发布到 npm 之后的装载形态。

### 已知限制

- **本地装法下成员不能只靠本包声明**：pnpm 对本地目录依赖（`link:` / `file:`）都不递归安装，成员必须由 profile 自己列进 `dependencies`。实测 `link:`+`link:`、`link:`+`file:`、`file:`+`file:` 三种组合成员都不会进 profile 的 `node_modules`；等成员发布到 npm、specifier 换成版本号后才可收敛为"只登记本包一个依赖"。
- 相应地，成员会出现在 DSH 自带插件管理页的「已安装」分组里并标成**已关闭**——那是包级标签（按包名是否在 `dsh.profile.bundles` 里判定），成员的名册行其实照常挂载。成员的单插件启停要用 profile `cordis.patch.yml` 的 id 定向覆盖，不要用那张卡上的开关。

### 改动文件

- `package.json`、`aggregate.json`、`cordis.patch.yml`、`scripts/aggregate.cjs`、`lib/index.js`、`README.md`、`CHANGELOG.md`、`LICENSE`

### 验证

- `npm run verify:patch`：生成结果与清单一致；把成员 specifier 改错目录 / 删掉一个成员，生成器分别报错退出（负例实测）
- `dsh --profile web --dump-config`：216 行合成条目树与聚合前逐行一致，11 行名册行按预期出现，`dsh-test` 为 disabled
