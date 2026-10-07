'use strict';
/* Protocol-3 acceptance: durable queue, lost ACK deduplication, cache retry,
 * account isolation, explicit restoration and preservation of original rows.
 * Each constituent allocates its own temporary database and isolated port.
 * Do not restore the retired conflict UI to satisfy this test. */
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
for (const file of ['server-store-queue.test.js', 'explicit-recovery.test.js', 'sync-resolution-nullrev.test.js']) {
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], {
    cwd: root, env: process.env, stdio: 'inherit', windowsHide: true
  });
  if (result.error || result.status !== 0) {
    console.error('[sync-recovery] failed:', file, result.error || result.signal || result.status);
    process.exit(result.status || 1);
  }
}
console.log('[sync-recovery] protocol-3 recovery protection passed');
