'use strict';
// Playwright's waitForFunction treats a returned Promise as truthy before its
// resolved boolean is known. Poll on the Node side when reading IndexedDB/API.
async function waitForAsync(page, predicate, arg, options = {}) {
  const timeout = options.timeout || 15000;
  const started = Date.now();
  do {
    if (await page.evaluate(predicate, arg)) return;
    if (Date.now() - started >= timeout) break;
    await new Promise(resolve => setTimeout(resolve, options.interval || 50));
  } while (true);
  throw new Error('Async browser condition timed out after ' + timeout + 'ms');
}
module.exports = { waitForAsync };
