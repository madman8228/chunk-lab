'use strict';

/* In-memory auth rate limiter. Keep policy state separate from Express routes. */
function createAuthRateLimiter(options) {
  const config = options || {};
  const windowMs = Number(config.windowMs) > 0 ? Number(config.windowMs) : 15 * 60 * 1000;
  const buckets = new Map();

  function trim(array, now) {
    while (array.length && array[0] <= now - windowMs) array.shift();
  }
  function rateBlocked(ip, kind, max) {
    const bucket = buckets.get(ip);
    const array = bucket && bucket[kind];
    if (!array) return false;
    trim(array, Date.now());
    return array.length >= max;
  }
  function rateHit(ip, kind, max) {
    const now = Date.now();
    let bucket = buckets.get(ip);
    if (!bucket) { bucket = {}; buckets.set(ip, bucket); }
    let array = bucket[kind];
    if (!array) { array = []; bucket[kind] = array; }
    trim(array, now);
    if (array.length >= max) return false;
    array.push(now);
    return true;
  }
  function rateClear(ip, kind) {
    const bucket = buckets.get(ip);
    if (bucket) delete bucket[kind];
  }
  function cleanup() {
    const now = Date.now();
    for (const [ip, bucket] of buckets) {
      for (const kind of Object.keys(bucket)) {
        trim(bucket[kind], now);
        if (!bucket[kind].length) delete bucket[kind];
      }
      if (!Object.keys(bucket).length) buckets.delete(ip);
    }
  }
  const timer = setInterval(cleanup, windowMs);
  if (timer.unref) timer.unref();
  function send429(res) {
    res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
    return res.status(429).json({ error: '操作过于频繁，请 15 分钟后再试' });
  }
  return Object.freeze({ rateBlocked, rateHit, rateClear, send429, cleanup, close: () => clearInterval(timer), buckets });
}

module.exports = { createAuthRateLimiter };
