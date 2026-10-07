/* A v3 activation is persisted per SQLite database and legacy writes stay shut. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const Database = require(path.join(root, 'server', 'node_modules', 'better-sqlite3'));
const port = require('./lib/free-port').freePort(9700, 100);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-protocol-sticky-'));
const productionDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-protocol-production-default-'));
let child;

function start(protocol3, options) {
  const settings = options || {};
  const env = Object.assign({}, process.env, {
    PORT: String(port), CHUNKLAB_DATA_DIR: settings.dataDir || dataDir,
    NODE_ENV: settings.nodeEnv || 'test'
  });
  if (settings.nodeEnv === 'production') {
    env.REQUIRE_AUTH = 'true';
    env.JWT_SECRET = 'isolated-production-protocol-default-test-secret';
  }
  if (protocol3) env.CHUNKLAB_WRITE_PROTOCOL = '3';
  else delete env.CHUNKLAB_WRITE_PROTOCOL;
  child = spawn(process.execPath, ['index.js'], { cwd: path.join(root, 'server'), env, stdio: 'ignore' });
  return new Promise((resolve, reject) => {
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      http.get('http://127.0.0.1:' + port + '/api/health', response => {
        response.resume();
        if (response.statusCode === 200) { clearInterval(timer); resolve(); }
      }).on('error', () => {});
      if (tries > 100) { clearInterval(timer); reject(new Error('isolated server did not start')); }
      if (child.exitCode != null) { clearInterval(timer); reject(new Error('isolated server exited: ' + child.exitCode)); }
    }, 100);
  });
}

function stop() {
  if (!child) return Promise.resolve();
  const current = child;
  child = null;
  return new Promise(resolve => {
    current.once('close', resolve);
    current.kill('SIGTERM');
  });
}

async function request(pathname, method, body) {
  const response = await fetch('http://127.0.0.1:' + port + pathname, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

(async () => {
  try {
    await start(true);
    assert.equal((await request('/api/config', 'GET')).body.writeProtocol, 3);
    const sessionId = 'sticky_resume_session_01';
    const resumeReceipt = await request('/api/operations', 'POST', { protocol: 3, requestId: 'sticky_resume_request_01',
      type: 'learning.resume', payload: { deckId: 'resume-deck', sessionId, generation: 0, idx: 6, contentCursor: 'page-2', practiceMode: 'chunkSelection' } });
    assert.equal(resumeReceipt.status, 200);
    const resumeSnapshot = await request('/api/data', 'GET');
    assert.equal(resumeSnapshot.body.learningResumes[sessionId].idx, 6, 'the checkpoint appears in the server snapshot');
    const roundReceipt = await request('/api/operations', 'POST', { protocol: 3, requestId: 'sticky_round_request_01', type: 'learning.roundComplete',
      payload: { eventId: 'sticky_round_event_001', sessionId, timeZone: 'Asia/Shanghai', occurredAt: Date.now() } });
    assert.equal(roundReceipt.status, 200);
    const resumeDelta = await request('/api/data?since=' + resumeReceipt.body.seq, 'GET');
    assert.ok(resumeDelta.body.deleted.learningResumes.includes(sessionId), 'the completion delta tombstones the checkpoint');
    const inspectDb = new Database(path.join(dataDir, 'chunklab.db'), { readonly: true });
    const storedProtocol = inspectDb.prepare("SELECT setting_value FROM app_runtime_settings WHERE setting_key='write_protocol'").get();
    inspectDb.close();
    assert.equal(storedProtocol && storedProtocol.setting_value, '3', 'protocol activation is written into this isolated database');
    await stop();
    await start(false);
    assert.equal((await request('/api/config', 'GET')).body.writeProtocol, 3,
      'a restart cannot downgrade a database that has activated protocol 3');
    for (const [url, method, body] of [
      ['/api/data', 'PUT', { mem: {} }],
      ['/api/import', 'POST', { mem: {} }],
      ['/api/sync/resolve', 'POST', {}],
      ['/api/sync/batch/resolve', 'POST', {}],
      ['/api/courses', 'POST', { course: {} }],
      ['/api/courses/legacy-course', 'DELETE'],
      ['/api/deck/publish', 'POST', { deckId: 'legacy-deck', publish: true }],
    ]) {
      const result = await request(url, method, body);
      assert.equal(result.status, 428, method + ' ' + url + ' remains gated after restart');
      assert.equal(result.body.code, 'CLIENT_UPDATE_REQUIRED');
    }

    await stop();
    await start(false, { nodeEnv: 'production', dataDir: productionDataDir });
    const freshProduction = await request('/api/config', 'GET');
    assert.equal(freshProduction.body.writeProtocol, 3, 'a fresh production database defaults to protocol 3');
    assert.equal(freshProduction.body.persistenceMode, 'server-authoritative');
    const productionDb = new Database(path.join(productionDataDir, 'chunklab.db'), { readonly: true });
    const productionMarker = productionDb.prepare("SELECT setting_value FROM app_runtime_settings WHERE setting_key='write_protocol'").get();
    productionDb.close();
    assert.equal(productionMarker && productionMarker.setting_value, '3', 'the production default is persisted before serving writes');
    const productionAccount = await request('/api/auth/register', 'POST', { username: 'production-default', password: 'test-password' });
    assert.equal(productionAccount.status, 200);
    const rejectedFreshProductionSnapshot = await fetch('http://127.0.0.1:' + port + '/api/data', {
      method: 'PUT', headers: { Authorization: 'Bearer ' + productionAccount.body.token, 'content-type': 'application/json' },
      body: JSON.stringify({ mem: {} })
    });
    assert.equal(rejectedFreshProductionSnapshot.status, 428, 'fresh production defaults also close legacy snapshot writes');
    assert.equal((await rejectedFreshProductionSnapshot.json()).code, 'CLIENT_UPDATE_REQUIRED');
    console.log('protocol activation persistence and legacy write gates passed');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await stop();
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (_) {}
    try { fs.rmSync(productionDataDir, { recursive: true, force: true }); } catch (_) {}
  }
})();
