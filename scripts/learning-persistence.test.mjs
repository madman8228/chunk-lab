import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { reducePracticeEvents } from '../src/learning/persistence-reducer.mjs';
import srs from '../srs.js';
const require = createRequire(import.meta.url);
const { reducePracticeEvents: reduceServerPracticeEvents } = require('../server/services/learning-replay.js');

const baseline = {
  deckId: 'deck-a', sentence: 'Original learning record', times: 3, okTimes: 2, wrongTimes: 1, streak: 0, maxStreak: 2,
  lastAt: 1_700_000_000_000, interval: 1, ease: 2.5, dueAt: 0,
  learningV1: { version: 1, evidence: [], baselineAt: 1_700_000_000_000, interval: 1, ease: 2.5, repetition: 0 }
};
const events = [
  { id: 'event-b', key: 'deck-a#sentence', sessionId: 'round-a', at: 1_700_000_100_000, type: 'practice', mode: 'chunk', ok: true, firstAttempt: true },
  { id: 'event-a', key: 'deck-a#sentence', sessionId: 'round-a', at: 1_700_000_050_000, type: 'practice', mode: 'chunk', ok: false, firstAttempt: true }
];

const first = reducePracticeEvents(baseline, events, { srs });
const replayed = reducePracticeEvents(baseline, events.slice().reverse(), { srs });
assert.equal(first.stat.sentence, baseline.sentence, 'replay preserves original record fields');
assert.deepEqual(replayed, first, 'arrival order does not change the replayed projection');
assert.equal(first.eventCount, 2);
assert.equal(first.stat.times, 5, 'the immutable legacy baseline is retained and accepted events are counted once');
assert.equal(first.stat.wrongTimes, 2);
assert.equal(first.stat.okTimes, 3);
assert.deepEqual(first.stat.learningV1.evidence.map((event) => event.id), ['event-a', 'event-b']);
assert.equal(first.stat.lastAt, 1_700_000_100_000);
assert.deepEqual(reduceServerPracticeEvents(baseline, events, { srs }), first,
  'the synchronous server reducer matches the shared domain reducer');

const earlyBaseline = { dueAt: 1_800_000_000_000, interval: 7, ease: 2.5, repetition: 3,
  lastAt: 1_700_000_000_000, learningV1: { version: 1, evidence: [], phase: 'review', dueAt: 1_800_000_000_000,
    interval: 7, ease: 2.5, repetition: 3, lastExposureAt: 1_700_000_000_000 } };
const early = reducePracticeEvents(earlyBaseline, [{ id: 'early-answer', key: 'deck-a#sentence', at: 1_700_000_100_000,
  ok: true, earlyPractice: true }], { srs });
assert.equal(early.stat.dueAt, earlyBaseline.dueAt, 'early practice does not pull a future review forward');
const assisted = reducePracticeEvents(earlyBaseline, [{ id: 'assisted-answer', key: 'deck-a#sentence', at: 1_700_000_100_000,
  ok: true, assisted: true }], { srs });
assert.equal(assisted.stat.learningV1.phase, 'relearning', 'assisted success remains reinforcement evidence');

const exposureAt = 1_700_000_050_000;
const exposed = reducePracticeEvents(earlyBaseline, [{ id: 'exposure-only', key: 'deck-a#sentence', at: exposureAt, type: 'exposure' }], { srs });
assert.equal(exposed.stat.times, earlyBaseline.times || 0, 'exposure does not increment answer totals');
assert.equal(exposed.stat.learningV1.lastExposureAt, exposureAt, 'exposure advances the assessment clock');
assert.equal(exposed.stat.dueAt, earlyBaseline.dueAt, 'exposure does not reschedule SRS');
assert.deepEqual(reduceServerPracticeEvents(earlyBaseline, [{ id: 'exposure-only', key: 'deck-a#sentence', at: exposureAt, type: 'exposure' }], { srs }), exposed,
  'server and browser reducers apply exposure identically');

console.log('learning persistence replay tests passed');
