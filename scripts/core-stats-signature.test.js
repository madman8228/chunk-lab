'use strict';

const assert = require('node:assert/strict');

(async function () {
  const { CoreStatsSignature } = await import('../src/core/stats-signature.mjs');
  const base = {
    totalRounds: 2,
    totalAnswered: 3,
    bySentence: { a: { times: 2, okTimes: 1, ease: 2.5 } },
    events: [{ id: 'e1' }],
    daysLog: { '2026-09-19': 2 },
  };
  const same = JSON.parse(JSON.stringify(base));
  assert.equal(CoreStatsSignature.statsSig(base), CoreStatsSignature.statsSig(same));
  same.bySentence.a.okTimes += 1;
  assert.notEqual(CoreStatsSignature.statsSig(base), CoreStatsSignature.statsSig(same));
  assert.notEqual(CoreStatsSignature.statSig({ times: 1 }), CoreStatsSignature.statSig({ times: 2 }));
  assert.deepEqual(CoreStatsSignature.eventSnapshot([]), { count: 0, firstId: null, lastId: null });
  assert.deepEqual(CoreStatsSignature.eventSnapshot([{ id: 'a' }, { id: 'b' }]), { count: 2, firstId: 'a', lastId: 'b' });
  console.log('core-stats-signature.test.js passed');
})().catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
