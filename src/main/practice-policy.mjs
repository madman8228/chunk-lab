/* Pure practice-flow policy. Timers and DOM event wiring stay in main.html. */
export function getNextLabel(index, total) {
  return index + 1 >= total ? '查看结果' : '下一题';
}

export function getAutoAdvanceDecision(options = {}) {
  if (options.finished || !options.available) return { eligible: false, seconds: 0 };
  const wrongAttempts = Array.isArray(options.wrongAttempts) ? options.wrongAttempts : [];
  const status = Array.isArray(options.status) ? options.status : [];
  const flawed = wrongAttempts.some((count) => (count || 0) > 0)
    || Boolean(options.hinted)
    || status.some((value) => value === 'bad' || value === 'revealed');
  if (flawed) return { eligible: false, seconds: 0 };
  return { eligible: true, seconds: options.perfectThis ? 3 : 5 };
}

