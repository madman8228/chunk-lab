'use strict';

// Playwright's waitForFunction polls the predicate's immediate return value.
// An async predicate returns a truthy Promise, even if it resolves to false.
// Await each evaluation in Node before deciding whether the condition is met.
async function waitForAsync(page, predicate, arg, options = {}) {
  const timeout = options.timeout ?? 30000;
  const deadline = Date.now() + timeout;
  do {
    const result = await page.evaluate(predicate, arg);
    if (result) return result;
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise(resolve => setTimeout(resolve, Math.min(100, remaining)));
  } while (Date.now() < deadline);
  throw new Error('Async condition did not become true within ' + timeout + 'ms');
}

module.exports = { waitForAsync };
