'use strict';
const assert = require('node:assert/strict');
const { waitForAsync } = require('../e2e/lib/wait-async');
(async () => {
  let calls = 0;
  const page = { evaluate: async fn => fn() };
  await waitForAsync(page, async () => ++calls === 3, undefined, { timeout: 1000, interval: 1 });
  assert.equal(calls, 3, 'resolved false must be polled again, not accepted as a Promise');
  assert.deepEqual(await waitForAsync(page, async () => ({ requestId: 'confirmed' })), { requestId: 'confirmed' });
  await assert.rejects(waitForAsync(page, async () => false, undefined, { timeout: 10, interval: 1 }), /timed out/);
  await assert.rejects(waitForAsync(page, async () => { throw new Error('condition failed'); }), /condition failed/);
  let navigationCalls = 0;
  assert.equal(await waitForAsync({ evaluate: async () => {
    if (++navigationCalls === 1) throw new Error('Execution context was destroyed, most likely because of a navigation');
    return true;
  } }, () => true, undefined, { interval: 1 }), true);
  assert.equal(navigationCalls, 2);
  console.log('async browser waits: false results retry; timeout and predicate errors fail');
})().catch(error => { console.error(error); process.exitCode = 1; });
