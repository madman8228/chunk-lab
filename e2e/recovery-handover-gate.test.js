/* Unavailable legacy archives must not gate independent current-account learning. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const { waitForAsync } = require('./lib/wait-async');

const root = path.resolve(__dirname, '..');
const port = require('./lib/free-port').freePort(9800, 100);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-recovery-gate-'));
const base = 'http://127.0.0.1:' + port;
let server;
let browser;

function waitForServer() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = setInterval(() => {
      const req = http.get(base + '/api/health', response => {
        response.resume();
        if (response.statusCode === 200) { clearInterval(timer); resolve(); }
      });
      req.on('error', () => {});
      req.setTimeout(600, () => req.destroy());
      if (++attempts >= 200) { clearInterval(timer); reject(new Error('isolated recovery-gate server did not start')); }
    }, 100);
  });
}

(async () => {
  try {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(root, 'server'),
      env: Object.assign({}, process.env, {
        PORT: String(port), CHUNKLAB_DATA_DIR: dataDir, NODE_ENV: 'test', CHUNKLAB_WRITE_PROTOCOL: '3',
      }),
      stdio: 'ignore',
    });
    await waitForServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    const verifiedSource = { sourceId:'synthetic-verified-source', sourceHash:'a'.repeat(64), verified:true,
      createdAt:'2026-10-04T00:00:00.000Z' };
    let sourceRead = 0;
    let recoveryAvailable = false;
    let snapshotReads = 0;
    let operationWrites = 0;
    await page.addInitScript(() => {
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
    });
    await page.route('**/api/recovery/sources*', route => route.fulfill({ status:200,
      contentType:'application/json', body:JSON.stringify({ok:true,items:[verifiedSource],nextCursor:null}) }));
    await page.route('**/api/recovery/*/pending-operations*', async route => {
      sourceRead++;
      if (!recoveryAvailable) {
        await route.fulfill({ status:503, contentType:'application/json', body:JSON.stringify({error:'temporary recovery outage'}) });
        return;
      }
      await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({ok:true,
        sourceId:verifiedSource.sourceId,sourceHash:verifiedSource.sourceHash,owner:JSON.stringify([base,'local']),
        sourceCapturedAt:verifiedSource.createdAt,items:[],nextCursor:null}) });
    });
    page.on('request', request => {
      const url = new URL(request.url());
      if (request.method() === 'GET' && url.pathname === '/api/data') snapshotReads++;
      if (request.method() === 'POST' && url.pathname === '/api/operations') operationWrites++;
    });
    await page.goto(base + '/main.html?recovery-handover-gate=1');
    await page.waitForFunction(() => window.CL && CL.getCloudConfig &&
      CL.getCloudConfig().persistenceMode === 'server-authoritative', null, { timeout:15000 });
    const startupResult = await page.evaluate(() => CL.ensureCloud());
    assert.ok(startupResult, 'startup loads the current account without reading legacy archives');
    assert.equal(sourceRead, 0, 'startup does not inspect archived pending operations');
    assert.equal(await page.evaluate(() => CL.serverPersistenceReady()), true,
      'the current account write gate opens');
    assert.ok(snapshotReads > 0, 'startup loads the confirmed server cache directly');

    const queued = await page.evaluate(() => ServerStore.submit('settings.patch', {patch:{sound:false}}));
    assert.equal(queued.durable, true, 'the user can continue with a durable local queue while the server gate is closed');
    await page.waitForTimeout(200);
    await waitForAsync(page, async requestId =>
      !(await IDBStore.listPendingOperations()).some(row => row.requestId === requestId), queued.requestId);
    assert.ok(operationWrites > 0, 'independent current-account work is saved while legacy recovery is unavailable');

    // The source becomes readable without reloading the page. Startup retry
    // must finish recovery, open the server gate, and drain the same durable
    // operation automatically.
    recoveryAvailable = true;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForFunction(() => CL.serverPersistenceReady(), null, {timeout:10000});
    await waitForAsync(page, async requestId => {
      try {
        const receipt=await ChunkAPI.request('/api/operations/'+encodeURIComponent(requestId),{method:'GET'});
        return !!receipt&&receipt.ok===true;
      } catch (_) { return false; }
    }, queued.requestId, {timeout:10000});
    assert.equal(new URL(page.url()).pathname,'/main.html','recovery and retry do not require a page reload');
    assert.ok(snapshotReads>0,'the confirmed server snapshot loads after recovery becomes complete');
    await waitForAsync(page, async requestId => {
      const rows=await IDBStore.listPendingOperations();
      const receipt=await ChunkAPI.request('/api/operations/'+encodeURIComponent(requestId),{method:'GET'}).catch(()=>null);
      const cache=await ServerCache.read();
      return !rows.some(row=>row.requestId===requestId) && receipt && receipt.ok===true && cache &&
        Number(cache.appliedSeq)>=Number(receipt.seq);
    }, queued.requestId, {timeout:10000});
    const converged = await page.evaluate(async requestId => ({
      pending:(await IDBStore.listPendingOperations()).some(row=>row.requestId===requestId),
      receipt:await ChunkAPI.request('/api/operations/'+encodeURIComponent(requestId),{method:'GET'}),
      appliedSeq:(await ServerCache.read()).appliedSeq,
    }), queued.requestId);
    assert.equal(converged.pending,false,'the exact locally queued operation drains after the gate reopens: '+JSON.stringify(converged));
    assert.ok(converged.receipt.ok&&converged.appliedSeq>=converged.receipt.seq,
      'queue retirement follows the durable receipt and applied cache watermark');
    await context.close();
    console.log('[recovery-handover-gate] current learning stays available without archived operation handover');
  } catch (error) {
    console.error('[recovery-handover-gate] failed:', error && error.stack || error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server) server.kill('SIGTERM');
    try { fs.rmSync(dataDir, { recursive:true, force:true }); } catch (_) {}
  }
})();
