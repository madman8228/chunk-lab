import test from 'node:test';
import assert from 'node:assert/strict';
import { MistakeEvidence } from './evidence.mjs';

const row = { _key: 'd::sentence', deckId: 'd', sentence: 'Where is it?', addedAt: '2026-01-01 00:00:00', mistakes: [{ chunkIdx: 0, chunk: 'Where', userAnswer: 'When / What' }], needsReview: true };
const event = (eventId, at, wrong = 'When') => ({ eventId, at, mode: 'chunkSelection', hinted: false, revealed: false, needsReview: true, mistakes: [{ chunkIdx: 0, chunk: 'Where', wrongAnswers: [wrong], wrongAttemptCount: 2, hintUsed: false }] });

test('old rows become stable, explicitly unknown legacy evidence', () => {
  const first = MistakeEvidence.normalizeEvidenceRow(row);
  assert.equal(first.history.length, 1);
  assert.equal(first.history[0].mode, 'unknown');
  assert.deepEqual(first.history[0].mistakes[0].wrongAnswers, ['When / What']);
  assert.equal(first.history[0].mistakes[0].wrongAttemptCount, null);
  assert.deepEqual(first, MistakeEvidence.normalizeEvidenceRow(row));
});

test('recording and merging evidence is event-idempotent and commutative', () => {
  const base = MistakeEvidence.normalizeEvidenceRow(row);
  const one = MistakeEvidence.recordEvidence(base, event('attempt-1', 1000));
  assert.deepEqual(MistakeEvidence.recordEvidence(one, event('attempt-1', 1000)), one);
  const left = MistakeEvidence.recordEvidence(base, event('attempt-2', 2000, 'Where?'));
  const right = MistakeEvidence.recordEvidence(base, event('attempt-3', 3000, 'Why'));
  assert.deepEqual(MistakeEvidence.mergeEvidenceRows(left, right), MistakeEvidence.mergeEvidenceRows(right, left));
  assert.equal(MistakeEvidence.mergeEvidenceRows(left, right).history.length, 3);
});

test('history and answer sizes are bounded and truncation remains visible', () => {
  let current = MistakeEvidence.normalizeEvidenceRow(row);
  for (let i = 0; i < 23; i += 1) current = MistakeEvidence.recordEvidence(current, event(`attempt-${i}`, i + 1, 'x'.repeat(700)));
  assert.equal(current.history.length, 20);
  assert.equal(current.historyTruncated, true);
  assert.equal(current.history[0].mistakes[0].wrongAnswers[0].length, 500);
  assert.equal(current.history[0].mistakes[0].wrongAttemptCount, 2);
});
