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
  const evidence = { times: 1, learningV1: { version: 1, phase: 'learning', evidence: [{
    id: 'assessment-1', key: 'deck#item', sessionId: 'session-1', type: 'assessment', mode: 'typing',
    contentFingerprint: 'v1-a', policyVersion: 1, stage: 'initial', at: 100, ok: true,
    firstAttempt: true, eligibleAt: 90,
  }] } };
  const changedStage = JSON.parse(JSON.stringify(evidence));
  changedStage.learningV1.evidence[0].stage = 'delayed';
  assert.notEqual(CoreStatsSignature.statSig(evidence), CoreStatsSignature.statSig(changedStage), 'assessment stage must participate in sync signature');
  assert.deepEqual(CoreStatsSignature.eventSnapshot([]), { count: 0, firstId: null, lastId: null });
  assert.deepEqual(CoreStatsSignature.eventSnapshot([{ id: 'a' }, { id: 'b' }]), { count: 2, firstId: 'a', lastId: 'b' });
  console.log('core-stats-signature.test.js passed');
})().catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
