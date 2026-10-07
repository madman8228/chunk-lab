/* Run the full user-visible save/recovery acceptance as one repeatable command.
 * Each vertical suite owns a fresh Chromium context and temporary SQLite DB so
 * destructive recovery fixtures cannot leak into neighboring scenarios. */
'use strict';

const path = require('node:path');
const { run } = require('../scripts/run-tests.cjs');

const root = path.resolve(__dirname, '..');
const suites = [
  { file: 'e2e/main-persistence.test.js', label: 'home learning, offline convergence, recovery, archive capacity, and second-device projection' },
  { file: 'e2e/server-assessment-ui.test.js', label: 'offline assessment answers and receipt-gated final result' },
  { file: 'e2e/course-package-v2-import.test.js', label: 'protocol-3 course editing, content-conflict recovery, CRUD, and no legacy writes', protocol3: true },
  { file: 'e2e/legacy-recovery.test.js', label: 'explicit recovery of an unassigned legacy source' },
  { file: 'e2e/recovery-handover-gate.test.js', label: 'startup write gate when a preserved recovery source is unreadable' },
  { file: 'e2e/server-store-queue.test.js', label: 'durable queue, lost ACK, multi-tab order, and late account-switch response' },
];

(async function(){
for (const suite of suites) {
  process.stdout.write(`\n[transparent-save] ${suite.label}\n`);
  const env = Object.assign({}, process.env);
  if (suite.protocol3) env.COURSE_PACKAGE_PROTOCOL3 = '1';
  else delete env.COURSE_PACKAGE_PROTOCOL3;
  const result = await run({id:suite.file,file:suite.file,cwd:'.',group:'browser'}, {env,timeoutMs:180000});
  process.stdout.write(result.output || '');
  if (result.error) {
    console.error(`[transparent-save] could not run ${suite.file}:`, result.error);
    process.exit(result.error.errno || 1);
  }
  if (result.code !== 0) {
    console.error(`[transparent-save] failed: ${suite.file} (exit=${result.code}, timedOut=${result.timedOut})`);
    process.exit(result.code || 1);
  }
}

console.log('\n[transparent-save] all isolated user-visible save and recovery suites passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
