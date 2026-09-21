import assert from 'node:assert/strict';
import { consumeStartHandoff, resolveEntry } from '../src/main/entry.mjs';
import { createLifecycle } from '../src/main/lifecycle.mjs';
import { selectResumeDeck } from '../src/main/resume.mjs';
import { createBootCoordinator } from '../src/main/boot.mjs';
import { createAudioFeedback, createSpeechFeedback, createVisualFeedback, createFeedbackEffects } from '../src/main/feedback-effects.mjs';
import { evaluateChunkAnswer } from '../src/main/answer-evaluation.mjs';

const intent = { version: 1, kind: 'unit', unitId: 'lesson-1' };

assert.deepEqual(resolveEntry({ search: '?course=c1&lesson=l1', navigationType: 'reload' }), {
  kind: 'catalog', course: 'c1', lesson: 'l1', explicit: true,
});
assert.deepEqual(resolveEntry({ search: '', navigationType: 'reload', intent, deck: { id: 'd1' } }), { kind: 'home' });
assert.deepEqual(resolveEntry({ search: '', navigationType: 'navigate', intent }), { kind: 'unit', unitId: 'lesson-1' });
assert.deepEqual(resolveEntry({ search: '?autostart=1', review: { ts: 100, deck: { id: 'review' } }, now: 101 }), { kind: 'review', deck: { id: 'review' }, explicit: true });
assert.equal(resolveEntry({ search: '?autostart=1', review: { ts: 100, deck: { id: 'review' } }, now: 30101 }).kind, 'invalid');

function storage(values) {
  return {
    getItem: (key) => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null,
    removeItem: (key) => { delete values[key]; },
  };
}
const handoffSession = storage({
  _startIntent: JSON.stringify({ version: 1, kind: 'unit', unitId: 'lesson-1' }),
  _startDeck: JSON.stringify({ id: 'ignored' }),
});
assert.deepEqual(consumeStartHandoff({ sessionStorage: handoffSession, businessStorage: storage({}), now: 100 }), {
  kind: 'unit', unitId: 'lesson-1',
});
assert.equal(handoffSession.getItem('_startIntent'), null);
assert.equal(handoffSession.getItem('_startDeck'), JSON.stringify({ id: 'ignored' }));
const reviewStorage = storage({
  chunklab_pending_review_deck: JSON.stringify({ ts: 100, deck: { id: 'review' } }),
});
assert.deepEqual(consumeStartHandoff({ sessionStorage: storage({}), businessStorage: reviewStorage, now: 101 }), {
  kind: 'review', deck: { id: 'review' },
});
assert.equal(reviewStorage.getItem('chunklab_pending_review_deck'), null);

const states = [];
const lifecycle = createLifecycle({ onState: (state) => states.push(state) });
const first = lifecycle.begin('first');
const second = lifecycle.begin('second');
assert.equal(lifecycle.isCurrent(first), false);
assert.equal(lifecycle.isCurrent(second), true);
assert.equal(lifecycle.complete(first, 'stale'), false);
assert.equal(lifecycle.complete(second, 'fresh'), true);
assert.equal(lifecycle.getState(), 'ready');
assert.deepEqual(states.map((state) => state.state), ['loading', 'loading', 'ready']);

const decks = [
  { id: 'active', items: [{}, {}, {}] },
  { id: 'recent', items: [{}, {}] },
  { id: 'first', items: [{}] },
];
const byId = (id) => decks.find((deck) => deck.id === id) || null;
assert.deepEqual(selectResumeDeck({
  mem: { activeDeckId: 'active', progress: { active: { idx: 1 } } },
  findDeck: byId,
  allDecks: () => decks,
}), { deck: decks[0], index: 1, resumed: true });
assert.deepEqual(selectResumeDeck({
  mem: { activeDeckId: 'active', progress: { active: { idx: 3 } }, best: { recent: { lastPlayed: 20 } } },
  findDeck: byId,
  allDecks: () => decks,
}), { deck: decks[0], index: 0, resumed: false });
assert.deepEqual(selectResumeDeck({
  mem: { best: { recent: { lastPlayed: 20 } } },
  findDeck: byId,
  allDecks: () => decks,
}), { deck: decks[1], index: 0, resumed: false });

const boot = createBootCoordinator({ entryRequested: false });
assert.equal(boot.shouldPaintLocal(), true);
assert.equal(boot.markLocalPainted(), true);
assert.equal(boot.markLocalPainted(), false);
assert.equal(boot.shouldPaintLocal(), false);
assert.equal(boot.markBooted(), true);
assert.equal(boot.isBooted(), true);
assert.equal(boot.claimEntry(), true);
assert.equal(boot.isEntryClaimed(), true);
assert.deepEqual(boot.snapshot(), { entryRequested: false, booted: true, localPainted: true, entryClaimed: true });

const explicitBoot = createBootCoordinator({ entryRequested: true });
assert.equal(explicitBoot.shouldPaintLocal(), false);
assert.equal(explicitBoot.markLocalPainted(), false);

const audioCalls = [];
const timers = [];
const fakeAudioWindow = {
  AudioContext: class {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    createOscillator() {
      return {
        type: '', frequency: { value: 0 },
        connect() {}, start() {}, stop() { audioCalls.push('stop'); },
      };
    }
    createGain() { return { gain: { value: 0 }, connect() {} }; }
  },
};
const audio = createAudioFeedback({
  window: fakeAudioWindow,
  getSettings: () => ({ sound: true }),
  setTimeout: (fn, delay) => { timers.push({ fn, delay }); },
});
audio.ok();
audio.perfect();
assert.equal(timers.length, 3);
assert.deepEqual(timers.map((timer) => timer.delay), [80, 80, 160]);
timers.forEach((timer) => timer.fn());
assert.equal(audioCalls.length, 5);
const muted = createAudioFeedback({ window: fakeAudioWindow, getSettings: () => ({ sound: false }) });
muted.bad();
assert.equal(audioCalls.length, 5);

const spoken = [];
const fakeSpeechWindow = {
  SpeechSynthesisUtterance: class { constructor(sentence) { this.sentence = sentence; } },
  speechSynthesis: { cancel() { spoken.push('cancel'); }, speak(utterance) { spoken.push(utterance); } },
};
createSpeechFeedback({ window: fakeSpeechWindow, getCurrentItem: () => ({ sentence: 'Every Tom.' }) })();
assert.equal(spoken[0], 'cancel');
assert.equal(spoken[1].sentence, 'Every Tom.');
assert.equal(spoken[1].lang, 'en-US');
assert.equal(spoken[1].rate, 0.92);

const emptyVisual = createVisualFeedback({ document: null, window: {} });
emptyVisual.confetti(1);
emptyVisual.show(1);
emptyVisual.mini(0, 0);
const effects = createFeedbackEffects({ document: null, window: {}, getSettings: () => ({ sound: false }) });
assert.equal(typeof effects.sfx.ok, 'function');
assert.equal(typeof effects.speakSentence, 'function');
assert.equal(typeof effects.fx.confetti, 'function');

const normalizeAnswer = (value) => String(value || '').trim().toLowerCase();
assert.equal(evaluateChunkAnswer({ value: 'Every Tom', right: 'every tom', alternatives: [], normalize: normalizeAnswer }), true);
assert.equal(evaluateChunkAnswer({ value: 'wrong', right: 'right', alternatives: ['correct'], normalize: normalizeAnswer }), false);
assert.equal(evaluateChunkAnswer({
  value: 'input', right: 'right', alternatives: [], normalize: normalizeAnswer,
  judge: () => true,
}), true);
assert.equal(evaluateChunkAnswer({
  value: 'correct', right: 'right', alternatives: ['correct'], normalize: normalizeAnswer,
  judge: () => { throw new Error('optional engine unavailable'); },
}), true);

console.log('[main-lifecycle] entry priority and stale async result protection passed');
