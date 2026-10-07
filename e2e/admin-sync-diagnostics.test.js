'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { freePort } = require('./lib/free-port');

const ROOT = path.resolve(__dirname, '..');
const PORT = freePort(10880, 80);
const BASE = 'http://127.0.0.1:' + PORT;
const safeQuarantine = {
  userId: 12,
  username: 'learner-test',
  sourceId: 'legacy-safe-source-123',
  sourceHash: 'a'.repeat(64),
  archivedAt: '2026-10-06 09:30:00',
  state: 'archived-unresolved',
  conflict: { entity: 'batch', batch: true, capturedAt: '2026-10-06T01:30:00.000Z', localHash: 'b'.repeat(64), remoteHash: 'c'.repeat(64) }
};
const safeSaveFailure = {
  code: 'ENTITY_CHANGED', status: 409, occurrences: 2,
  latestAt: '2026-10-06 09:45:00', traceId: 'trace-example-789'
};

(async function () {
  const server = http.createServer(function (_req, res) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(ROOT, 'admin.html')));
  });
  let browser;
  let quarantineReads = 0;
  try {
    await new Promise(function (resolve, reject) {
      server.once('error', reject);
      server.listen(PORT, '127.0.0.1', resolve);
    });
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const page = await browser.newPage();
    await page.addInitScript(function () { localStorage.setItem('chunklab_admin_token', 'test-admin-token'); });
    await page.route('**/api/admin/**', async function (route) {
      const url = new URL(route.request().url());
      let body;
      if (url.pathname === '/api/admin/me') body = { admin: { username: 'admin' } };
      else if (url.pathname === '/api/admin/overview') body = {
        range: { startDay: '2026-10-01', endDay: '2026-10-06' },
        accounts: { total: 0, newAccounts: 0, registered: 0, guests: 0 },
        usage: { activeVisitors: 0, activeLearners: 0, answers: 0, mastered: 0 }, daily: [], topCourses: []
      };
      else if (url.pathname === '/api/admin/users') body = { users: [] };
      else if (url.pathname === '/api/admin/feedback') body = { feedback: [] };
      else if (url.pathname === '/api/admin/sync-quarantines') {
        quarantineReads++;
        body = { quarantines: quarantineReads === 1 ? [safeQuarantine] : [] };
      } else if (url.pathname === '/api/admin/save-failures') body = { failures: [safeSaveFailure] };
      else if (url.pathname === '/api/admin/save-health') body = { health: { windowMinutes: 30, activeClients: 2,
        activeAccounts: 1, pending: 4, blocked: 1, retryAttempts: 7, oldestPendingAt: 1791276300000 } };
      else body = { error: 'not found' };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(BASE + '/admin.html', { waitUntil: 'networkidle' });
    await page.waitForFunction(function () {
      return document.querySelector('#syncQuarantineList').innerText.includes('legacy-safe-source-123');
    });
    const rendered = await page.locator('#syncQuarantineList').innerText();
    assert.match(rendered, /learner-test/);
    assert.match(rendered, /整包冲突/);
    assert.match(rendered, /已归档，待复核/);
    assert.match(rendered, /aaaaaaaaaaaa/);
    assert.equal(rendered.includes('private sentence'), false, 'the UI must only render the server-approved metadata summary');
    await page.waitForFunction(function () {
      return document.querySelector('#saveFailureList').innerText.includes('trace-example-789');
    });
    const failureRendered = await page.locator('#saveFailureList').innerText();
    assert.match(failureRendered, /ENTITY_CHANGED/);
    assert.match(failureRendered, /HTTP 409/);
    assert.match(failureRendered, /2 次/);
    assert.equal(failureRendered.includes('private sentence'), false, 'the diagnostic panel cannot render learning content');
    await page.waitForFunction(function () {
      return document.querySelector('#saveHealthSummary').innerText.includes('待处理 4');
    });
    const healthRendered = await page.locator('#saveHealthSummary').innerText();
    assert.match(healthRendered, /2 个活跃设备/);
    assert.match(healthRendered, /阻塞 1/);
    assert.match(healthRendered, /累计重试 7/);
    await page.locator('#syncQuarantineRefresh').click();
    await page.waitForFunction(function () {
      return document.querySelector('#syncQuarantineList').innerText.includes('暂无已保全且待复核');
    });
    assert.equal(quarantineReads, 2, 'the manual refresh reads only the admin summary endpoint');
    console.log('admin-sync-diagnostics: verified summaries render in admin UI, contain no learning content, and refresh cleanly');
  } finally {
    if (browser) await browser.close();
    await new Promise(function (resolve) { server.close(resolve); });
  }
})().catch(function (error) { console.error(error.stack || error); process.exitCode = 1; });
