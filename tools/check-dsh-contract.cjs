#!/usr/bin/env node
// tools/check-dsh-contract.cjs
//
// 离线契约自检：把本仓库各常驻插件的「DSH 接口面」与**本机已安装的 DSH 源码**
// 逐条比对，不需要启动 DSH、不需要浏览器、不需要 network。
//
// 检查项：
//   1. slot key —— client bundle 中 slots.inject / slots.register 的每个 key，
//      以及 CSS/DOM 里 data-slot="..." 的选择器，必须存在于 DSH 的 slot catalog；
//   2. inject 服务名 —— host 半段 `export const inject = [...]` 的每个服务名必须
//      能在已安装的 DSH 包里找到服务定义；
//   3. 包清单 —— package.json 的 dsh.bundle.patch / lib/index.js 齐备；声明了
//      dsh.client 的包还要求 platform = "web"、exports["./client"] 与
//      lib/client.js 齐备，且 client bundle 以 __ModuleLoader__.load 信封收尾。
//      浏览器半段是**可选**的：名册聚合包（如 dsh-plugins-all）只贡献 patch 层，
//      不声明 dsh.client 即视为合法；
//   4. 路由守卫 —— 调 ctx.webServer.register 的插件必须自带查重守卫
//      （仓库硬规则，见 docs/dsh-upgrade-precheck.md §四）。
//
// 用法：
//   node tools/check-dsh-contract.cjs
//   node tools/check-dsh-contract.cjs --dsh "C:\path\to\node_modules\@deepseek-ai\dsh"
//   node tools/check-dsh-contract.cjs --root .
//
// 退出码：0 = 全部通过；1 = 有 FAIL；2 = 环境不可用（找不到 DSH 安装目录）。

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ===== 参数与环境 =====

function parseArgs(argv) {
  const out = { dsh: null, root: null };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dsh' && argv[i + 1] !== undefined) out.dsh = argv[++i];
    else if (arg.startsWith('--dsh=')) out.dsh = arg.slice('--dsh='.length);
    else if (arg === '--root' && argv[i + 1] !== undefined) out.root = argv[++i];
    else if (arg.startsWith('--root=')) out.root = arg.slice('--root='.length);
  }
  return out;
}

// 从 `dsh` 命令的 shim 里反推安装目录：shim 文本里含 .../@deepseek-ai/dsh/lib/bin.js
function dshDirFromShim() {
  const finder = process.platform === 'win32' ? 'where.exe' : 'which';
  let shim;
  try {
    shim = execFileSync(finder, ['dsh'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\r?\n/)[0]
      .trim();
  } catch (err) {
    return null;
  }
  if (!shim) return null;
  const candidates = [shim];
  if (process.platform === 'win32') {
    const dir = path.dirname(shim);
    for (const name of ['dsh.cmd', 'dsh.ps1', 'dsh']) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) candidates.push(p);
    }
  }
  for (const file of candidates) {
    // (a) shim 所在目录向上找 node_modules/@deepseek-ai/dsh（最常见布局）
    let dir = path.dirname(file);
    for (let depth = 0; depth < 4; depth += 1) {
      const guess = path.join(dir, 'node_modules', '@deepseek-ai', 'dsh');
      if (fs.existsSync(path.join(guess, 'package.json'))) return guess;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    // (b) shim 文本里的绝对路径
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (err) {
      continue;
    }
    const win = text.match(/[A-Za-z]:[\\/][^\s"']*@deepseek-ai[\\/]dsh[\\/]lib[\\/]bin\.js/);
    if (win) return path.dirname(path.dirname(win[0]));
    const posix = text.match(/(\/[^\s"';]*@deepseek-ai\/dsh\/lib\/bin\.js)/);
    if (posix) return path.dirname(path.dirname(posix[1]));
  }
  return null;
}

function locateDsh(explicit) {
  const candidates = [];
  if (explicit) candidates.push(explicit);
  if (process.env.DSH_INSTALL) candidates.push(process.env.DSH_INSTALL);
  const fromShim = dshDirFromShim();
  if (fromShim) candidates.push(fromShim);
  for (const c of candidates) {
    const pkg = path.join(c, 'package.json');
    if (fs.existsSync(pkg)) {
      try {
        const j = JSON.parse(fs.readFileSync(pkg, 'utf8'));
        if (j.name === '@deepseek-ai/dsh') return { dir: c, version: j.version };
      } catch (err) {
        /* 继续找下一个候选 */
      }
    }
  }
  return null;
}

// ===== DSH 接口面提取 =====

function dshDepsDir(dshDir, name) {
  const nested = path.join(dshDir, 'node_modules', '@deepseek-ai', name);
  if (fs.existsSync(nested)) return nested;
  const sibling = path.join(path.dirname(dshDir), name);
  if (fs.existsSync(sibling)) return sibling;
  return null;
}

// slot catalog：dsh-cordis-client-runner 的 client bundle 里 CLIENT_SLOT_API 数组
function readSlotCatalog(dshDir) {
  const pkg = dshDepsDir(dshDir, 'dsh-cordis-client-runner');
  if (!pkg) return null;
  const file = path.join(pkg, 'lib', 'client.js');
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf('const CLIENT_SLOT_API = [');
  if (start < 0) return null;
  const end = text.indexOf('\n];', start);
  const slice = text.slice(start, end < 0 ? text.length : end);
  const keys = new Map();
  const re = /key:\s*"([^"]+)"[\s\S]{0,200}?kind:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(slice)) !== null) keys.set(m[1], m[2]);
  return keys.size > 0 ? keys : null;
}

// 服务名：扫已安装的 @deepseek-ai/* 包，取 interface Context { ... } 成员与 super(ctx, "x")
function readServiceNames(dshDir) {
  const depsRoot = path.join(dshDir, 'node_modules', '@deepseek-ai');
  const names = new Set(['loader', 'logger', 'timer', 'webServer']);
  if (!fs.existsSync(depsRoot)) return names;
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        walk(full);
        continue;
      }
      if (!/\.(js|d\.ts)$/.test(entry.name)) continue;
      let text;
      try {
        text = fs.readFileSync(full, 'utf8');
      } catch (err) {
        continue;
      }
      let m;
      const blockRe = /interface Context\s*\{([\s\S]{0,800}?)\n\s*\}/g;
      while ((m = blockRe.exec(text)) !== null) {
        const memberRe = /([A-Za-z_$][\w$]*)\s*:\s*[A-Za-z_$][\w$<>,\[\]\. |]*/g;
        let k;
        while ((k = memberRe.exec(m[1])) !== null) names.add(k[1]);
      }
      const superRe = /super\(ctx,\s*"([^"]+)"/g;
      while ((m = superRe.exec(text)) !== null) names.add(m[1]);
    }
  };
  walk(depsRoot);
  return names;
}

// ===== 插件扫描 =====

function listPluginDirs(root) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(root, e.name))
    .filter((dir) => fs.existsSync(path.join(dir, 'package.json')))
    .filter((dir) => {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
        return j.dsh !== undefined && j.dsh.bundle !== undefined;
      } catch (err) {
        return false;
      }
    });
}

// 去掉 // 行注释与 /* */ 块注释，避免"注释里提到 API"被当成真实调用
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

function jsFilesUnder(dir) {  const out = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(full);
      } else if (entry.name.endsWith('.js')) out.push(full);
    }
  };
  walk(dir);
  return out;
}

function checkPlugin(dir, ctx) {
  const problems = [];
  const notes = [];
  const pkgPath = path.join(dir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const label = pkg.name || path.basename(dir);

  // 3. 包清单
  if (!pkg.dsh || !pkg.dsh.bundle || typeof pkg.dsh.bundle.patch !== 'string') {
    problems.push('package.json 缺少 dsh.bundle.patch');
  } else {
    const patchFile = path.join(dir, pkg.dsh.bundle.patch);
    if (!fs.existsSync(patchFile)) problems.push(`dsh.bundle.patch 指向的文件不存在：${pkg.dsh.bundle.patch}`);
  }
  // 浏览器半段是可选的：名册聚合包这类只贡献 patch 层 / 宿主半段的包不声明 dsh.client。
  // 声明了就必须齐全；没声明却放着 lib/client.js 也要报——那份文件永远不会被加载。
  const declaresClient = Boolean(pkg.dsh && pkg.dsh.client);
  if (declaresClient && pkg.dsh.client.platform !== 'web') {
    problems.push(`dsh.client.platform 必须是 "web"（当前 ${JSON.stringify(pkg.dsh.client.platform)}）`);
  }
  const hostFile = path.join(dir, typeof pkg.main === 'string' ? pkg.main : 'lib/index.js');
  if (!fs.existsSync(hostFile)) problems.push('host 半段入口不存在：' + path.relative(dir, hostFile));

  const clientFile = path.join(dir, 'lib', 'client.js');
  const hasClientFile = fs.existsSync(clientFile);
  if (!declaresClient && !hasClientFile) {
    notes.push('无浏览器半段（只贡献 patch 层或宿主半段）');
  } else {
    if (!declaresClient) problems.push('存在 lib/client.js，但 package.json 未声明 dsh.client.platform = "web"');
    if (!pkg.exports || typeof pkg.exports['./client'] !== 'string') {
      problems.push('package.json exports 缺少 "./client"');
    }
    if (!hasClientFile) {
      problems.push('缺少 lib/client.js');
    } else {
      const text = fs.readFileSync(clientFile, 'utf8');
      if (text.indexOf('__ModuleLoader__.load(') < 0) problems.push('lib/client.js 不是 ModuleLoader 信封');
      const idMatch = text.match(/__ModuleLoader__\.load\(\{\s*\n?\s*id:\s*["']([^"']+)["']/);
      if (idMatch && idMatch[1] !== pkg.name) {
        problems.push(`client bundle 的 id (${idMatch[1]}) 与包名 (${pkg.name}) 不一致`);
      }
    }
  }

  // 1 + 2. 源码级扫描（有 client-src 时扫源码，否则扫产物）
  const srcDir = path.join(dir, 'lib', 'client-src');
  const scanFiles = fs.existsSync(srcDir) ? jsFilesUnder(srcDir) : [clientFile].filter((f) => fs.existsSync(f));
  const injectKeys = new Set();
  const registerKeys = new Set();
  const selectorKeys = new Set();
  for (const file of scanFiles) {
    const text = fs.readFileSync(file, 'utf8');
    let m;
    const injectRe = /slots\.inject\(\s*["']([^"']+)["']/g;
    while ((m = injectRe.exec(text)) !== null) injectKeys.add(m[1]);
    const nameRe = /name:\s*["']([a-z][A-Za-z0-9-]*(?:\.[A-Za-z0-9-]+)+)["']/g;
    while ((m = nameRe.exec(text)) !== null) registerKeys.add(m[1]);
    const selRe = /data-slot=\\?["']([^"'\\]+)\\?["']/g;
    while ((m = selRe.exec(text)) !== null) selectorKeys.add(m[1]);
  }
  if (ctx.slots) {
    for (const key of injectKeys) if (!ctx.slots.has(key)) problems.push(`slots.inject 的 slot key 不在 catalog：${key}`);
    for (const key of registerKeys) if (!ctx.slots.has(key)) problems.push(`slots.register 的 slot key 不在 catalog：${key}`);
    for (const key of selectorKeys) {
      if (key.indexOf('<') >= 0) continue; // 文档/模板占位符
      if (!ctx.slots.has(key)) problems.push(`data-slot 选择器不是已知 slot key：${key}`);
    }
  } else {
    notes.push('未能提取 slot catalog，跳过 slot key 校验');
  }

  // 2. inject 服务名（host 半段）
  if (fs.existsSync(hostFile)) {
    const hostText = fs.readFileSync(hostFile, 'utf8');
    const m = hostText.match(/export\s+const\s+inject\s*=\s*\[([^\]]*)\]/);
    if (m) {
      const injects = m[1]
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
      for (const service of injects) {
        if (ctx.services && !ctx.services.has(service)) problems.push(`inject 的服务名在已安装 DSH 中找不到：${service}`);
      }
    }
    // 4. 路由守卫
    const hostCode = stripComments(hostText);
    if (/webServer\.register\(/.test(hostCode)) {
      if (!/webServer\.(exact|prefixes)/.test(hostCode)) {
        problems.push('调用 webServer.register 但未见查重守卫（webServer.exact / prefixes）');
      }
    }
  }

  return { label, problems, notes };
}

// ===== main =====

function main() {
  const args = parseArgs(process.argv);
  const root = path.resolve(args.root || path.join(__dirname, '..'));
  const found = locateDsh(args.dsh);
  if (!found) {
    console.error('[check-dsh-contract] 找不到 DSH 安装目录；用 --dsh <dir> 或 DSH_INSTALL 指定');
    process.exit(2);
  }
  const slots = readSlotCatalog(found.dir);
  const services = readServiceNames(found.dir);
  console.log(`[check-dsh-contract] DSH ${found.version} @ ${found.dir}`);
  console.log(`[check-dsh-contract] slot catalog: ${slots ? slots.size + ' keys' : 'unavailable'}；服务名: ${services.size}`);

  const dirs = listPluginDirs(root);
  if (dirs.length === 0) {
    console.error('[check-dsh-contract] 未找到任何带 dsh.bundle 的插件目录');
    process.exit(2);
  }
  let failed = 0;
  for (const dir of dirs.sort()) {
    const result = checkPlugin(dir, { slots, services });
    if (result.problems.length === 0) {
      console.log(`  PASS  ${result.label}`);
      for (const note of result.notes) console.log(`        note: ${note}`);
    } else {
      failed += 1;
      console.log(`  FAIL  ${result.label}`);
      for (const problem of result.problems) console.log(`        - ${problem}`);
    }
  }
  console.log(`[check-dsh-contract] ${dirs.length - failed}/${dirs.length} 通过`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
