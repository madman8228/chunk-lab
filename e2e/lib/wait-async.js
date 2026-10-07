'use strict';
// Playwright's waitForFunction treats a returned Promise as truthy before its
// resolved boolean is known. Poll on the Node side when reading IndexedDB/API.
async function waitForAsync(page, predicate, arg, options = {}) {
  const timeout = options.timeout || 15000;
  const started = Date.now();
  do {
    let result;
    try {
      result = await page.evaluate(predicate, arg);
    } catch (error) {
      // A navigation replaces the realm while an IndexedDB read is pending.
      // Retry that specific transport error only; never swallow test failures.
      if (!/Execution context was destroyed/.test(String(error && error.message)) ||
          (typeof page.isClosed === 'function' && page.isClosed())) throw error;
      result = false;
    }
    if (result) return result;
    if (Date.now() - started >= timeout) break;
    await new Promise(resolve => setTimeout(resolve, options.interval || 50));
  } while (true);
  throw new Error('Async browser condition timed out after ' + timeout + 'ms');
}
module.exports = { waitForAsync };
