# dsh-skill-manager

DeepSeek Harness (DSH) web profile 的常驻插件：在设置页集中查看与启停 skill。

## 功能

- **skill 清单**：列出用户级 skill（含作者署名），支持搜索与按状态分组（启用中 / 已停用 / 项目级 / 诊断）。
- **一键启停**：停用通过向 skill 注册表注入一条高优先级的同名"影子"条目遮蔽原条目实现，**不修改任何 `SKILL.md` 文件**；停用按 skill 名全局生效，包含项目级同名 skill。
- **即时生效**：变更后主动使缓存失效，无需重启 DSH。
- **扫描范围**：用户级 skill 目录（`DSH_HOME/skills`、`~/.agents/skills`）以及最近会话的项目根目录。

## 安装

插件既可以从本仓库子目录安装，也可以作为独立 npm 包安装。

**从 monorepo 子目录安装**

克隆仓库后，在 DSH web profile 的 `package.json` 中以 `file:` 协议引用该子目录：

```json
{
  "dependencies": {
    "dsh-skill-manager": "file:<到仓库的相对路径>/skill-manager"
  }
}
```

**从 npm 包安装**

```json
{
  "dependencies": {
    "dsh-skill-manager": "^0.1.0"
  }
}
```

## 启用

在同一份 profile `package.json` 的 `dsh.profile.bundles` 数组中加入包名：

```json
{
  "dsh": {
    "profile": {
      "bundles": ["dsh-skill-manager"]
    }
  }
}
```

随后在 profile 目录安装依赖：

```bash
pnpm install --no-frozen-lockfile
```

## 运行与生效

- 宿主半段扫描 skill 目录、注册影子条目并持久化停用清单，**修改后需重启 DSH** 才会生效。
- 浏览器半段渲染设置页的"Skill 管理"页面，**刷新页面**即可加载最新版本。
- **skill 的启停本身即时生效**，无需重启 DSH——这一点与插件启停不同。

临时停用可在 profile 的 `cordis.patch.yml` 中追加：

```yaml
- id: skill-manager
  disabled: true
```

## 许可证

[MIT](./LICENSE)
