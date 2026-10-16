'use strict';
const assert = require('node:assert/strict');
const { createTracker } = require('./study-usage');
(async function () {
  let time = 0, owner = 'account-a', visible = true, active = true, ids = 0, fail = false;
  const sent = [];
  const tracker = createTracker({ now: () => time, identity: () => owner, visible: () => visible,
    context: () => active ? { kind: 'sentence', resourceId: 'deck-one' } : null,
    sessionId: () => 'session-' + (++ids), send: async body => { sent.push({ ...body, owner }); if (fail) throw Error('offline'); } });
  const settle = () => new Promise(resolve => setImmediate(resolve));
  const ticks = async seconds => { for (let i=0;i<seconds;i++) { time+=1000;tracker.sample(); } await settle(); };
  tracker.sample(); await settle();
  await ticks(10); await tracker.flush();
  assert.equal(sent.at(-1).elapsedMs, 10000);
  visible=false;tracker.sample();await settle();await ticks(10);await tracker.flush();
  assert.equal(sent.at(-1).elapsedMs, 0, 'hidden time is excluded');
  visible=true;tracker.interact();await settle();await ticks(10);await tracker.flush();
  assert.equal(sent.at(-1).elapsedMs, 10000);
  await ticks(61);await tracker.flush();const idleCount=sent.length;await ticks(20);await tracker.flush();
  assert.equal(sent.length,idleCount,'idle state stops sending learning pulses');
  tracker.interact();tracker.sample();await settle();await ticks(5);fail=true;await tracker.flush();const failed=sent.at(-1);
  fail=false;await tracker.flush();assert.equal(sent.at(-1).sequence,failed.sequence,'failed pulse retries with the same sequence');
  owner='account-b';tracker.sample();await settle();await ticks(2);await tracker.flush();
  assert.notEqual(sent.at(-1).sessionId,failed.sessionId,'account change rotates session and drops old samples');
  assert.equal(sent.at(-1).owner,'account-b');
  const count=sent.length;active=false;tracker.sample();await settle();await ticks(10);await tracker.flush();
  assert.ok(sent.length<=count+1,'leaving practice stops counting');
  time+=3600000;active=true;tracker.interact();tracker.sample();await settle();
  assert.equal(sent.at(-1).elapsedMs,0,'suspended browser timer cannot create study time');
  console.log('study usage client: foreground, idle, pause, retries, suspension and account switching passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
