'use strict';
const assert = require('node:assert/strict');
const { createVisitTracker } = require('./study-usage');
(async () => {
  let now = 0, owner = 'a', visible = true, online = true, calls = 0, fail = false, held = null, hint;
  const tracker = createVisitTracker({ now: () => now, identity: () => owner, visible: () => visible, online: () => online,
    send: () => { calls++; if (held) return held; return fail ? Promise.reject({ retryAfterMs: hint }) : Promise.resolve(); } });
  await tracker.visit(); assert.equal(calls, 1);
  for (now = 10000; now < 60000; now += 10000) await tracker.visit();
  assert.equal(calls, 1, 'healthy cadence remains one per minute');
  await tracker.visit(); assert.equal(calls, 2);
  visible = false; now += 120000; await tracker.visit(); assert.equal(calls, 2);
  visible = true; online = false; await tracker.visit(); assert.equal(calls, 2);
  online = true; fail = true; await tracker.visit(); const failedAt = now;
  now += 10000; await tracker.visit(); assert.equal(calls, 3, 'failure no longer retries every ten seconds');
  now = failedAt + 60000; await tracker.visit(); assert.equal(calls, 4);
  now += 60000; await tracker.visit(); assert.equal(calls, 4, 'second failure waits two minutes');
  now += 60000; await tracker.visit(); assert.equal(calls, 5);
  now += 240000; fail = false; await tracker.visit(); assert.equal(calls, 6);
  now += 60000; await tracker.visit(); assert.equal(calls, 7, 'success resumes ordinary cadence');
  let rejectOld; held = new Promise((_, reject) => { rejectOld = reject; });
  now += 60000; const old = tracker.visit(); await Promise.resolve();
  now += 120000; await tracker.visit(); assert.equal(calls, 8, 'unsettled request cannot overlap');
  owner = 'b'; held = null; await tracker.visit(); assert.equal(calls, 9, 'new account is independent of old request');
  rejectOld(Error('old account failed')); await old;
  now += 60000; await tracker.visit(); assert.equal(calls, 10, 'old failure does not postpone new account');
  fail = true; hint = 600000; now += 60000; await tracker.visit();
  now += 300000; await tracker.visit(); assert.equal(calls, 11, 'server Retry-After is honored beyond client backoff cap');
  now += 300000; await tracker.visit(); assert.equal(calls, 12);
  owner = ''; now += 600000; await tracker.visit(); assert.equal(calls, 12, 'logged out sends nothing');
  let clock = 0, outageCalls = 0;
  const outage = createVisitTracker({ now: () => clock, identity: () => 'synthetic', visible: () => true, online: () => true,
    send: async () => { outageCalls++; throw Error('synthetic server outage'); } });
  for (clock = 0; clock < 3600000; clock += 10000) await outage.visit();
  assert.ok(outageCalls <= 16, 'one hour of persistent failure is bounded, not 360 ten-second retries');
  console.log('One-hour outage: ' + outageCalls + ' visit attempts (previous ten-second retry path: 360)');
  console.log('Visit heartbeat: cadence, hidden/offline, backoff/recovery, in-flight isolation and Retry-After passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
