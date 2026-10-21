'use strict';
/* Public CI installs root dependencies only. Several server tests spawn
 * server/index.js, which resolves its own package.json dependencies. Install
 * them once when missing so `npm run test:server` works in a clean checkout
 * without editing the workflow (which requires the OAuth workflow scope). */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const expressEntry = path.join(root, 'server', 'node_modules', 'express', 'index.js');
if (fs.existsSync(expressEntry)) process.exit(0);

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
console.log('[server-deps] server/node_modules is missing; installing server/package-lock.json');
const result = spawnSync(npm, ['ci', '--prefix', 'server', '--no-audit', '--no-fund'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32'
});
if (result.error) {
  console.error('[server-deps] failed to start npm:', result.error.message);
  process.exit(1);
}
process.exit(result.status == null ? 1 : result.status);
