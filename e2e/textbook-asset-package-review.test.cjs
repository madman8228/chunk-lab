'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright-core');
const { createReviewServer } = require('../scripts/serve-textbook-phonetics-review.cjs');

const packageDir = process.env.TEXTBOOK_ASSET_PACKAGE;

test('archived Grade 9 package can be reviewed at all units, on demand, on desktop and mobile', { skip: !packageDir }, async t => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'grade9-package-relocation-'));
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const relocatedPackage = path.join(temporaryRoot, 'package');
  fs.cpSync(packageDir, relocatedPackage, { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: true });
  const server = createReviewServer({ packageDir: relocatedPackage });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [], imageRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().includes('/package-images/')) imageRequests.push(request.url()); });
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    await page.goto(base + '/textbook-phonetics-review.html');
    await page.locator('#rows tr').nth(627).waitFor();
    assert.equal(await page.locator('#rows tr').count(), 628);
    assert.equal(await page.locator('#unit option').count(), 15);
    assert.equal(await page.locator('.unit-stat').count(), 14);
    assert.equal(await page.locator('img.asset-image[src]').count(), 0);
    assert.equal(imageRequests.length, 0);
    await page.locator('#status').selectOption('needs-source-check');
    await page.waitForFunction(() => document.querySelectorAll('#rows tr').length === 9);
    assert.equal(await page.locator('#rows tr').count(), 9);
    assert.equal(await page.locator('#rows .state .badge').filter({ hasText: '暂不补充' }).count(), 9);
    await page.locator('#status').selectOption('all');
    await page.locator('#rows .asset-preview').first().click();
    await page.locator('#rows img.asset-image:not([hidden])').first().evaluate(image => image.decode());
    assert.equal(imageRequests.length, 1);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 932 });
      const layout = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > innerWidth + 1).slice(0, 6).map(element => ({ tag: element.tagName, className: element.className, right: Math.round(element.getBoundingClientRect().right), width: Math.round(element.getBoundingClientRect().width) })) }));
      assert.equal(layout.scroll <= width, true, JSON.stringify(layout));
    }
    assert.equal((await fetch(base + '/phonetics-data.json', { method: 'POST' })).status, 405);
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
