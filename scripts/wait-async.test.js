'use strict';
const assert = require('node:assert/strict');
const { waitForAsync } = require('../e2e/lib/wait-async');
(async () => {
  let calls = 0;
  const page = { evaluate: async fn => fn() };
  await waitForAsync(page, async () => ++calls === 3, undefined, { timeout: 1000, interval: 1 });
  assert.equal(calls, 3, 'resolved false must be polled again, not accepted as a Promise');
  await assert.rejects(waitForAsync(page, async () => false, undefined, { timeout: 10, interval: 1 }), /timed out/);
  await assert.rejects(waitForAsync(page, async () => { throw new Error('condition failed'); }), /condition failed/);
  console.log('async browser waits: false results retry; timeout and predicate errors fail');
})().catch(error => { console.error(error); process.exitCode = 1; });
