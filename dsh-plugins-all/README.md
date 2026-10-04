# dsh-plugins-all

DSH 常驻插件的**名册聚合包**：用一份 `cordis.patch.yml` 把本仓库各插件的名册行一次性插入 web profile，profile 侧只需要登记本包一个 bundle。

本包不含宿主逻辑，也不含浏览器半段——它做的事情全部在那份 patch 文件里。

## 它解决的问题

DSH 启动时按 `dsh.profile.bundles` 的顺序，逐层叠加每个 bundle 包的 `dsh.bundle.patch` 指定的 patch 文件。patch 文件是一个 YAML 数组，**可以写任意多个 `- insert:` 块**，每块向名册插入一行 `{ id, name }`（`name` 是包名，loader 以 profile 根为解析基准去找它的 `package.json`）。

于是「N 个插件」可以被压缩成「1 个 bundle 条目 + N 个 insert 块」：

```jsonc
// profile package.json
{
  "dependencies": {
    "dsh-plugins-all": "link:../dsh-plugins/dsh-plugins-all"
    // 各成员插件仍需在这里（见下节「成员包仍需安装」）
  },
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-plugins-all"]
    }
  }
}
```

新增插件时不必再动 profile——改一处清单、跑一次生成、重启即可。

## 成员包仍需安装

本包只负责**报名**，不负责把成员的包装进 profile。名册行里的 `name` 由 loader 从 profile 根解析，因此每个成员包仍必须是 profile 的依赖（`link:` / `file:` / npm 版本号都行）。

区别只在于：它们**不再需要**出现在 `dsh.profile.bundles` 里。

## 硬约束：同一个包不能注册两次

client bundle 的注册 id 就是包名。同一个包如果在名册里出现两次（比如既被本包收录、又单独列在 `bundles` 里），第二次 `__ModuleLoader__.load` 会抛：

```
client-modules: duplicate factory registration for "<包名>" (bundle executed twice without invalidate?)
```

同名行 id 则在构建客户端图时抛 `client-modules: duplicate graph entry "<行 id>"`。

所以：**被本包收录的插件必须从 `dsh.profile.bundles` 里移除，两边不能同时登记。**

## 安装

1. 把本包与全部成员包放到本机任意位置，例如 `<your-dsh-plugins-dir>/<package>`；
2. 编辑 web profile 的 `package.json`：

   ```jsonc
   {
     "dependencies": {
       "dsh-plugins-all": "link:<路径>/dsh-plugins-all",
       "dsh-manager-hub": "link:<路径>/dsh-manager-hub"
       // …其余成员包同样各一行
     },
     "dsh": {
       "profile": {
         "bundles": [
           "@deepseek-ai/dsh-base",
           "@deepseek-ai/dsh-web-app",
           "dsh-plugins-all"
         ]
       }
     }
   }
   ```

3. 在 profile 目录安装依赖：

   ```bat
   pnpm install --no-frozen-lockfile
   ```

4. 重启 DSH（名册在启动时组装）。

成员包自身的改动仍然刷新浏览器即可生效——本包不改变各插件的加载路径。

## 收录清单

清单真源是同目录下的 `aggregate.json`。当前收录：

| 成员包 | 行 id | 说明 |
| --- | --- | --- |
| `dsh-manager-hub` | `manager-hub` | 设置页统一「管理」入口（UI 聚合） |
| `dsh-plugin-manager` | `megane-plugin-manager` | 插件管理（行 id 刻意避开官方 `plugin-manager`） |
| `dsh-skill-manager` | `skill-manager` | Skill 管理 |
| `dsh-mcp-manager` | `mcp-manager` | MCP 管理 |
| `dsh-usage-stats` | `usage-stats` | 使用统计 |
| `dsh-update-checker` | `update-checker` | 更新检查 |
| `dsh-task-pool` | `task-pool` | 任务池抽屉 |
| `dsh-git-hub` | `git-hub` | Git/GitHub 管理面板 |
| `dsh-ui-tweaks` | `ui-tweaks` | 外观微调合集 |
| `dsh-peak-hour-lock` | `peak-hour-lock` | 高峰时段拦截发送（行自带 `config.lockModels`） |
| `dsh-test` | `dsh-test` | 管道健康检查器；清单里标了 `disabled`，插入但不挂载 |

行 id 与各插件独立安装时用的 id 保持一致——这样 profile 的 `cordis.patch.yml` 里已有的按 id 停用条目（例如 `- id: peak-hour-lock` + `disabled: true`）在聚合后继续有效。

## 启用 / 停用单个成员

行定义由本包生成，但**启停仍归 profile 的 `cordis.patch.yml`**（它在所有 bundle 层之后应用）。在 profile 的 `cordis.patch.yml` 追加：

```yaml
- id: peak-hour-lock
  disabled: true
```

`dsh-test` 的默认关闭写在生成结果里（`disabled: true` 那一行）。要打开它，把 `aggregate.json` 里对应成员的 `disabled` 去掉、重新生成，或者反向在 profile 的 `cordis.patch.yml` 里补一条 `- id: dsh-test` + `disabled: false`。

## 增删成员

1. 改 `aggregate.json` 的 `members`（`dir` 是相对本仓库根的插件目录名，目录名不一定等于包名）；
2. 跑生成器：

   ```bash
   npm run build:patch     # 等价于 node scripts/aggregate.cjs
   npm run verify:patch    # 只校验磁盘内容与清单一致，不写文件
   ```

3. 在 profile 的 `dependencies` 里补上/移除成员包，并确认它已经从 `dsh.profile.bundles` 移出；
4. `pnpm install` + 重启 DSH。

生成器会把每个成员自己的 `cordis.patch.yml` 里的 insert 块**逐行搬**过来（只剥注释与空行，不解析 YAML 语义），因此 `config` 之类的附加字段原样保留。它同时校验：

- 成员目录存在、`package.json` 声明了 `dsh.bundle.patch`，且该文件存在；
- 成员的 patch 只含一个顶层 `- insert:` 块，且每块只含一行一包；
- insert 行的 `name` 与成员 `package.json` 的 `name` 一致（防止目录改名后失联）；
- 行 id 与包名在清单内都不重复。

任何一条不过就报错退出，不会写出半成品。

## 目录结构

```
dsh-plugins-all/
  package.json           包清单（dsh.bundle.patch 指向 cordis.patch.yml；无 dsh.client）
  aggregate.json         收录清单（真源）
  cordis.patch.yml       生成结果 —— 提交入库，不手工编辑
  scripts/aggregate.cjs  生成器 / 校验器
  lib/index.js           宿主半端占位（本包不自插行，正常启动下不会被 import）
```

本包没有客户端半段，也没有 `lib/client-src/`，因此不涉及 `docs/maintainability.md` 的 bundle 拆分规范。

## 许可

[MIT](./LICENSE)
