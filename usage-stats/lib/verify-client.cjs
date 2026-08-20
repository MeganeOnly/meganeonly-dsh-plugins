// lib/verify-client.cjs
//
// Verify that lib/client.js is byte-identical to the file committed in HEAD.
// Run via: npm run verify:client
//
// Why: after editing lib/client-src/*.js, the developer MUST also rebuild lib/client.js
// (run `npm run build:client`) before committing. This script catches the case where the
// source was edited but the bundle wasn't regenerated — it returns non-zero exit code
// when working-tree client.js differs from HEAD, and prints the byte count + first diff
// position for diagnostics.
//
// Inside the same workflow it can be used to verify each refactor commit leaves
// lib/client.js unchanged (use --against <commit>).

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const WT_PATH = path.join(ROOT, 'lib', 'client.js');

const args = process.argv.slice(2);
let againstRef = 'HEAD';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--against') againstRef = args[++i];
}

const refBytes = execSync(`git show ${againstRef}:usage-stats/lib/client.js`, { cwd: ROOT });
const wt = fs.readFileSync(WT_PATH);

console.log(`working tree: ${wt.length} bytes`);
console.log(`${againstRef} blob:    ${refBytes.length} bytes`);

if (wt.length === refBytes.length && Buffer.compare(wt, refBytes) === 0) {
  console.log('BYTE-IDENTICAL ✓');
  process.exit(0);
} else {
  console.log('DIFFERS');
  const len = Math.max(wt.length, refBytes.length);
  for (let i = 0; i < len; i++) {
    const wb = i < wt.length ? wt[i] : -1;
    const hb = i < refBytes.length ? refBytes[i] : -1;
    if (wb !== hb) {
      console.log(`  first diff at byte ${i}: WT=${wb} HEAD=${hb}`);
      break;
    }
  }
  process.exit(1);
}