import test from 'node:test';
import assert from 'node:assert/strict';
import { createKeyboardState, handleChunkKey, confirmChunkCandidate, cancelChunkCandidate } from './keyboard.mjs';

const candidates = [
  { id: 'i-first', initial: 'i' },
  { id: 'english', initial: 'e' },
  { id: 'i-second', initial: 'i' },
];

test('same initial floats candidates in sequence and Enter confirms only the raised item', () => {
  let state = createKeyboardState();
  let result = handleChunkKey(state, 'i', candidates);
  assert.equal(result.action, 'float');
  assert.equal(result.candidate.id, 'i-first');
  state = result.state;
  result = handleChunkKey(state, 'i', candidates);
  assert.equal(result.candidate.id, 'i-second');
  const confirmed = confirmChunkCandidate(result.state);
  assert.equal(confirmed.candidate.id, 'i-second');
});

test('a unique initial selects immediately and disabled duplicates are skipped', () => {
  assert.equal(handleChunkKey(createKeyboardState(), 'e', candidates).candidate.id, 'english');
  const result = handleChunkKey(createKeyboardState(), 'i', [{ ...candidates[0], disabled: true }, candidates[2]]);
  assert.equal(result.action, 'select');
  assert.equal(result.candidate.id, 'i-second');
});

test('Escape cancels the floating candidate and non-letter keys are ignored', () => {
  const pending = handleChunkKey(createKeyboardState(), 'i', candidates).state;
  assert.equal(cancelChunkCandidate(pending).candidateIndex, -1);
  assert.equal(handleChunkKey(pending, 'Enter', candidates).action, 'ignored');
});
