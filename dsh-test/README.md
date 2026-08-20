# dsh-test

DSH 插件开发者用的最小管道健康检查器。本插件**不面向终端用户**——它的作用是在排查「我的插件失踪了」时，先用 dsh-test 验证 DSH 插件管道本身是否健康，再回到自己的插件上排错。

## 何时用 / 何时不用

| 场景 | 是否安装 dsh-test |
| --- | --- |
| 你的 DSH 插件装上后界面里完全看不见 | ✅ 先装 dsh-test 确认是管道问题还是代码问题 |
| 你在按 dsh-persistent-plugin-authoring 搭新插件骨架 | ✅ 作为「最小可工作样本」参考 |
| 你只是想用 DSH 的功能、不写插件 | ❌ 装上多余 |
| 排查完成、确认是 dsh-persistent-plugin-authoring 之外的细节问题 | ❌ 用完可卸 |

## 工作方式

安装并刷新浏览器后，**右下角出现一枚固定徽标**：

| 徽标状态 | 含义 | 排查方向 |
| --- | --- | --- |
| `dsh-test: loading…` 黑底 | 徽标已挂载，正在等 host 响应 | 等待几秒；持续 loading 说明 host 半端没响应 |
| `dsh-test v0.1.0 ok` 绿底 | **三层全跑通**：host 注册 + client 加载 + cordis 名册注入 | ✅ 管道健康，问题在你的插件代码 |
| `dsh-test ERR: ...` 红底 | **哪一层断了**（看错误文案） | 见下方「故障排查」 |

徽标由 client bundle 注入 `document.body`，与 host 半端的 `GET /api/test/hello` 端点做一次 fetch 验证——一次刷新覆盖「bundle 加载 + API 注册 + 跨端调用」三条链路。

## 安装

`dsh-test` 仅作为本仓库（`meganeonly-dsh-plugins`）monorepo 子目录发布，**不发布到 npm**。在 DSH web profile 的 `package.json` 中以 `file:` 协议引用：

```json
{
  "dependencies": {
    "dsh-test": "file:../path/to/meganeonly-dsh-plugins/dsh-test"
  }
}
```

随后在 profile 目录安装依赖：

```bash
pnpm install --no-frozen-lockfile
```

## 启用

在同一份 profile `package.json` 的 `dsh.profile.bundles` 数组中加入包名：

```json
{
  "dsh": {
    "profile": {
      "bundles": ["dsh-test"]
    }
  }
}
```

首次安装或调整 `bundles` 名册后**重启 DSH**；之后修改 `dsh-test` 自身代码仅需**刷新浏览器**即可看到新行为。

临时停用可在 profile 的 `cordis.patch.yml` 中追加：

```yaml
- id: dsh-test
  disabled: true
```

## 故障排查

徽标变红时，按错误文案分层定位：

| 错误文案 | 排查方向 |
| --- | --- |
| `HTTP 404` | host 半端没注册 `/api/test/hello`——大概率是 DSH 没启动 loader、或 profile 的 `cordis.patch.yml` 没被读 |
| `HTTP 405` | 路由注册到了但方法不匹配——检查 `kind: 'exact'` 是否被 DSH 覆盖 |
| `fetch failed` / 网络层错误 | 浏览器到 host 的连通性问题——检查 profile 端口、代理、`credentials: 'same-origin'` 是否被反代剥掉 |
| 徽标一直黑底 `loading…` | client bundle 加载了但 fetch 一直没 resolve——控制台看 `[dsh-test]` 警告 |
| 徽标完全不见 | client bundle 没加载——控制台看 `__ModuleLoader__.load` 是否报错、是不是被 `cordis.patch.yml` 里 `disabled: true` 关掉了 |

控制台开「保留日志」+ 网络面板看 `GET /api/test/hello` 的响应头/体，比看徽标更精确。

## 内部机制

| 层 | 文件 | 作用 |
| --- | --- | --- |
| Host 半端（Node） | `lib/index.js` | 注册 `GET /api/test/hello`，返回 `{ ok, version, loadedAt }` |
| Client 半端（浏览器） | `lib/client.js` | 注入 CSS + 右下角徽标，fetch 上面的端点，根据响应切徽标状态 |
| 名册注入 | `cordis.patch.yml` | `- insert: [{ id: dsh-test, name: dsh-test }]` 让 loader 把它装进 web profile |
| 包元数据 | `package.json` | 声明 `dsh.bundle.patch` + `dsh.client.platform: web`，符合 dsh-persistent-plugin-authoring 规范 |

编码风格遵循 `docs/maintainability.md`（纯 ES5，唯一允许的箭头函数是 `factory: (require) => {...}`）。
CSS 注入遵循 dsh-persistent-plugin-authoring：通过 `data-plugin-css=<唯一id>` 去重，避免 HMR / 重载时样式叠加。

## 卸载

```bash
pnpm remove dsh-test
```

并把 `dsh.profile.bundles` 里的 `"dsh-test"` 删掉。徽标会随下一次刷新消失。

## 作者

MeganeOnly — <https://github.com/MeganeOnly/meganeonly-dsh-plugins>

## 许可

MIT