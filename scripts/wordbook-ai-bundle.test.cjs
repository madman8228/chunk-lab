'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
(async () => {
  let htmlLoads = 0;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost'), file = path.resolve(root, '.' + url.pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    let body = fs.readFileSync(file);
    if (url.pathname === '/wordbook-create.html' && ++htmlLoads === 1) body = body.toString().replace(/<details id="bookAIReceive" open><summary id="bookAIReceiveSummary">[^<]*<\/summary>/, '').replace('</div></details>\n<p id="bookAIStatus"', '</div>\n<p id="bookAIStatus"');
    if (url.pathname === '/assets/wordbook-create.css' && htmlLoads === 1) body = body.toString().split('.book-create [hidden]')[0];
    res.setHeader('Content-Type', /\.js$/.test(file) ? 'text/javascript' : /\.css$/.test(file) ? 'text/css' : 'text/html'); res.end(body);
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.addInitScript(() => { window.copiedPrompts = []; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { copiedPrompts.push(text); } } }); });
    const page = await context.newPage(); await page.goto('http://127.0.0.1:' + server.address().port + '/wordbook-create.html');
    await page.waitForFunction(() => document.querySelector('#bookAIWorkbench').getAttribute('aria-busy') === 'false');
    assert.equal(await page.locator('#bookAIReceive').count(), 0, 'fixture matches old HTML missing receive wrapper');
    assert.equal(await page.locator('#copyBookContinue').isVisible(), false, 'old CSS cannot reveal hidden controls');
    await page.locator('#copyBookPrompt').click();
    await page.waitForFunction(() => document.querySelector('#bookAIWorkbench').getAttribute('aria-busy') === 'false');
    const status = await page.locator('#bookAIStatus').innerText();
    assert.equal(await page.evaluate(() => copiedPrompts.length), 1, 'copy must work without optional receive wrapper: ' + status);
    assert.match(await page.evaluate(() => copiedPrompts[0]), /wordbook-ai-batch/);
    assert.doesNotMatch(status, /Cannot set properties|当前内容保留/);
    assert.equal(await page.locator('#bookAIUpdateNotice').isVisible(), true, 'mixed DOM offers a deliberate update instead of reload loops');
    assert.equal(htmlLoads, 1, 'copy does not automatically reload the page');
    await page.locator('#bookAIResult').fill('尚未完成的 AI 输出：保留这段内容');
    const sessionUrl = page.url();
    await Promise.all([page.waitForNavigation(), page.locator('#bookAIUpdateButton').click()]);
    await page.waitForFunction(() => document.querySelector('#bookAIWorkbench').getAttribute('aria-busy') === 'false');
    assert.equal(page.url(), sessionUrl, 'manual update keeps the same draft session');
    assert.equal(await page.locator('#bookAIReceive').count(), 1, 'manual update loads current markup');
    assert.equal(await page.locator('#bookAIResult').inputValue(), '尚未完成的 AI 输出：保留这段内容', 'save before update preserves unfinished pasted text');
    assert.equal(htmlLoads, 2, 'manual update reloads once');
    console.log('Wordbook mixed-version copy and save-before-update regressions passed.');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
