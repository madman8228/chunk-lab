export function createKeyboardState() {
  return { pendingKey: null, candidates: [], candidateIndex: -1 };
}

export function handleChunkKey(state, key, candidates) {
  const letter = key.toLowerCase();
  if (!/^[a-z]$/.test(letter)) return { state, action: 'ignored' };
  const eligible = candidates.filter(candidate => !candidate.disabled && candidate.initial?.toLowerCase() === letter);
  if (eligible.length === 0) return { state: createKeyboardState(), action: 'unmatched' };

  if (eligible.length === 1) {
    return { state: createKeyboardState(), action: 'select', candidate: eligible[0] };
  }

  if (state.pendingKey !== letter || state.candidates.length !== eligible.length || state.candidates.some((item, i) => item.id !== eligible[i].id)) {
    return { state: { pendingKey: letter, candidates: eligible, candidateIndex: 0 }, action: 'float', candidate: eligible[0] };
  }
  const candidateIndex = (state.candidateIndex + 1) % eligible.length;
  return { state: { pendingKey: letter, candidates: eligible, candidateIndex }, action: 'float', candidate: eligible[candidateIndex] };
}

export function confirmChunkCandidate(state) {
  if (state.candidateIndex < 0) return { state, action: 'none' };
  const candidate = state.candidates[state.candidateIndex];
  return { state: createKeyboardState(), action: 'select', candidate };
}

export function cancelChunkCandidate(state) {
  return state.candidateIndex < 0 ? state : createKeyboardState();
}
