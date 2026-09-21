/* Pure answer matching: UI decides what to render, this module decides whether it matches. */
export function evaluateChunkAnswer(options = {}) {
  const value = options.value;
  const right = options.right;
  const alternatives = Array.isArray(options.alternatives) ? options.alternatives : [];
  const normalize = typeof options.normalize === 'function' ? options.normalize : (text) => String(text == null ? '' : text);

  if (typeof options.judge === 'function') {
    try {
      return !!options.judge(value, right, alternatives);
    } catch (_) {
      /* Keep the historical fallback when the optional engine is unavailable or throws. */
    }
  }
  return [right].concat(alternatives).some((candidate) => normalize(value) === normalize(candidate));
}
