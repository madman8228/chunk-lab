'use strict';

const assert = require('node:assert/strict');

(async function () {
  const activity = (await import('../src/core/activity.mjs')).CoreActivity;
  const today = new Date(2026, 8, 19, 12, 0, 0);
  const mem = { stats: { totalAnswered: 2, bySentence: { a: { times: 2 } }, events: [{ id: 'e1', kind: 'answer', at: today.toISOString() }, { id: 'e1', kind: 'answer', at: today.toISOString() }, { id: 'r1', kind: 'round', at: today.toISOString() }], daysLog: {} } };
  assert.equal(activity.ymd(today), '2026-09-19');
  assert.equal(activity.answerStatsAudit(mem).eventAnswered, 1);
  assert.equal(activity.dailyActivity(mem)['2026-09-19'].answered, 1);
  assert.equal(activity.streakDays(mem, today), 1);
  assert.equal(activity.bumpDaysLog(mem, today), 1);
  assert.equal(activity.backfillDaysLog(mem), 0);
  console.log('core-activity.test.js passed');
})().catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
