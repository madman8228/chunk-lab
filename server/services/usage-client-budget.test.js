'use strict';
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { createTracker } = require('../../js/study-usage');
const { initializeUsageSchema, createUsageAnalytics } = require('./usage-analytics');

(async function () {
  // A fresh in-memory database only; never open application data.
  const db = new Database(':memory:');
  try {
    db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY); INSERT INTO users VALUES(1),(2)');
    initializeUsageSchema(db);
    let time = Date.parse('2026-10-17T12:00:00+08:00'), owner = 1, visible = true, ids = 0;
    let calls = 0, lostResponse = false;
    const usage = createUsageAnalytics({ db, now: () => time });
    const tracker = createTracker({ now: () => time, identity: () => String(owner), visible: () => visible,
      context: () => ({ kind: 'sentence', resourceId: 'synthetic-deck' }),
      sessionId: () => 'synthetic-session-' + (++ids),
      send: async body => {
        calls++; usage.pulse(owner, body);
        if (lostResponse) throw new Error('synthetic lost response');
      } });
    const settle = () => new Promise(resolve => setImmediate(resolve));
    async function advance(seconds) {
      for (let i = 0; i < seconds; i++) {
        time += 1000; tracker.sample();
        if (i % 10 === 9) await tracker.flush();
        await settle();
      }
    }
    lostResponse = true;
    tracker.sample(); await settle();
    assert.equal(calls, 1, 'initial zero baseline is necessary and retained');
    lostResponse = false; await tracker.flush();
    assert.equal(calls, 2, 'a failed zero baseline must still retry');
    await advance(20);
    assert.equal(usage.userTime(1, false).totalMs, 20000, 'first study interval is not lost');
    const beforeEmpty = calls;
    await tracker.flush(); await tracker.flush();
    assert.equal(calls, beforeEmpty, 'no redundant empty database writes');
    visible = false; tracker.sample(); await settle();
    await advance(120);
    assert.equal(calls, beforeEmpty, 'hidden tab performs no study writes');
    visible = true; tracker.interact(); tracker.sample(); await settle();
    assert.equal(calls, beforeEmpty + 1, 'resume sends a fresh timing baseline');
    await advance(10);
    assert.equal(usage.userTime(1, false).totalMs, 30000, 'hidden gap does not add time');
    lostResponse = true; await advance(10);
    lostResponse = false; await tracker.flush();
    assert.equal(usage.userTime(1, false).totalMs, 40000, 'acknowledgement loss and retry do not duplicate time');
    owner = 2; tracker.sample(); await settle(); await advance(10);
    assert.equal(usage.userTime(2, false).totalMs, 10000, 'account switching starts an independent baseline');
    assert.equal(usage.userTime(1, false).totalMs, 40000);
    console.log('usage client/server budget: baselines, hidden gaps, zero-write suppression, replay and account isolation passed');
  } finally { db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
