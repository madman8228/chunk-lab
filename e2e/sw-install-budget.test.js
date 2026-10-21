'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright-core');

// Static fixture server, OS-allocated port and a fresh browser context. No API,
// accounts, application database or existing browser profile is accessed.
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
function list(name) {
  return Array.from(source.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\n\\];'))[1]
    .matchAll(/'([^']+)'/g), m => m[1]);
}
const hard = list('PRECACHE'), soft = list('PRECACHE_SOFT');
const allowed = new Set([...hard, ...soft, '/sw.js']);
const hits = [];
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  hits.push(pathname);
  res.setHeader('Cache-Control', 'no-store');
  if (pathname === '/sw-fixture.html') {
    res.setHeader('Content-Type', 'text/html');
    // Do not mistake the browser's implicit /favicon.ico request for SW prefetch.
    return res.end('<!doctype html><link rel="icon" href="data:,"><title>Isolated SW budget fixture</title>');
  }
  if (!allowed.has(pathname)) { res.statusCode = 404; return res.end(); }
  const file = path.join(root, pathname.slice(1));
  const type = /\.(m?js)$/.test(file) ? 'text/javascript' : /\.html$/.test(file) ? 'text/html' : 'application/octet-stream';
  res.setHeader('Content-Type', type);
  fs.createReadStream(file).on('error', () => { res.statusCode = 404; res.end(); }).pipe(res);
});

(async function () {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(base + '/sw-fixture.html');
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    assert.equal(hits.filter(url => soft.includes(url)).length, 0, 'install must not fetch optional resources');
    assert.ok(hard.every(url => hits.includes(url)), 'all atomic resources installed');
    const optional = ['/assets/jqka-learning-garden-v1.png', '/assets/textbook-drafts.css?v=1', '/js/textbook-drafts.js?v=1'];
    for (const url of optional) {
      assert.ok(soft.includes(url.split('?')[0]), 'visited optional asset remains versioned: ' + url);
      assert.equal(await page.evaluate(async url => (await fetch(url)).status, url), 200);
      // Let the asynchronous runtime cache.put complete before going offline.
      await page.waitForFunction(async url => {
        const keys = await caches.keys();
        return !!(await (await caches.open(keys.find(key => key.startsWith('chunklab-')))).match(location.origin + url));
      }, url);
    }
    await context.setOffline(true);
    const results = await page.evaluate(async urls => Promise.all(urls.map(async url => {
      const response = await fetch(url);
      return { url, status: response.status, bytes: (await response.arrayBuffer()).byteLength };
    })), [...hard, ...optional]);
    assert.ok(results.every(row => row.status === 200 && row.bytes > 0), 'installed bundle and visited optional assets remain readable offline');
    for (const url of optional) {
      assert.equal(hits.filter(hit => hit === url.split('?')[0]).length, 1, 'revisiting optional assets does not contact server: ' + url);
    }
    const apiBypass = await page.evaluate(async () => {
      try { await fetch('/api/synthetic-private-data'); return false; } catch (_) { return true; }
    });
    assert.ok(apiBypass, 'API requests are not served from static cache');
    console.log('SW real-browser budget: no optional prefetch; ' + hard.length + ' atomic files + visited image and author assets readable offline; API bypass passed');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
