# Changelog

dsh-plugins-all 的变更记录。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-10-04

### 新增

- 初次入库：DSH 常驻插件的名册聚合包。
  - 用一份 `cordis.patch.yml`（11 个 `- insert:` 块）把仓库内 11 个插件的名册行一次性插入 web profile，profile 侧只需登记本包一个 bundle 条目。
  - `aggregate.json` 为收录清单真源；`scripts/aggregate.cjs` 从各成员自己的 `cordis.patch.yml` 逐行投影出 insert 块，并校验成员目录、`dsh.bundle.patch` 存在性、`name` 与包名一致、行 id 与包名不重复。
  - `npm run build:patch` 生成、`npm run verify:patch` 只校验不写盘。
  - 行 id 与各插件独立安装时保持一致，profile 层已有的按 id 停用条目在聚合后继续有效。
  - `dsh-test` 收录但默认 `disabled: true`（插入不挂载）。
  - 本包不自插名册行，也不提供浏览器半段。

### 改动文件

- `package.json`、`aggregate.json`、`cordis.patch.yml`、`scripts/aggregate.cjs`、`lib/index.js`、`README.md`、`CHANGELOG.md`、`LICENSE`

### 验证

- `npm run verify:patch`：生成结果与清单一致
- `dsh --profile web --dump-config`：11 行名册行按预期出现，`dsh-test` 为 disabled
