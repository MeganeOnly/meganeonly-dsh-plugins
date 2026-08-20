#!/usr/bin/env node
// lib/build-client.cjs
//
// 把 lib/client-src/*.js 按文件名字母序拼接成 lib/client.js。
//
// 背景：DSH 客户端 bundle 必须为单一文件（__ModuleLoader__.load(...) 契约，
// 见 dsh-persistent-plugin-authoring §III）。直接维护一个几百到上千行的单文件
// 容易让人类与 AI 都"读不下"——本脚本把源拆成多个模块文件，重新拼成同
// 一份 client.js。
//
// 用法：
//   node lib/build-client.cjs
// 或：
//   npm run build:client
//
// 编辑流程：
//   1. 改 lib/client-src/*.js
//   2. 跑本脚本
//   3. 验证 lib/client.js 仍是合法 bundle（node --check lib/client.js）
//   4. 提交 client-src/* 与 client.js（client.js 是生成产物，但仍入库以
//      与 file: 依赖部署保持同步，见 dsh-persistent-plugin-authoring §IV.4）

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SOURCE_DIR = path.join(ROOT, 'client-src');
const OUTPUT_PATH = path.join(ROOT, 'client.js');

if (!fs.existsSync(SOURCE_DIR)) {
  console.error('[build-client] missing dir:', SOURCE_DIR);
  process.exit(1);
}

// 按文件名字母升序。命名约定 "NN-name.js"：NN 是两位数字前缀。
// 数字 + 字符前缀都按字典序排，先动手的（loader-open）排在前，后动手的（loader-close）排在后。
const files = fs.readdirSync(SOURCE_DIR)
  .filter((f) => f.endsWith('.js'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

if (files.length === 0) {
  console.error('[build-client] no .js sources under', SOURCE_DIR);
  process.exit(1);
}

// 每个源文件末尾已有一个 '\n'（写源码时约定），简单 join 即可。
const parts = files.map((f) => fs.readFileSync(path.join(SOURCE_DIR, f), 'utf8'));
const output = parts.join('');

fs.writeFileSync(OUTPUT_PATH, output, 'utf8');

const outputBytes = Buffer.byteLength(output, 'utf8');
console.log(`[build-client] wrote ${OUTPUT_PATH} (${files.length} sources, ${outputBytes} bytes)`);
files.forEach((f, i) => {
  const b = Buffer.byteLength(parts[i], 'utf8');
  console.log(`  - client-src/${f}: ${b} bytes`);
});