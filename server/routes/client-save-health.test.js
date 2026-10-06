'use strict';

const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const Database = require('better-sqlite3');
const { registerClientSaveHealthRoutes } = require('./client-save-health');

(async function () {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE user_client_save_health (
    user_id INTEGER NOT NULL, client_id TEXT NOT NULL, pending INTEGER NOT NULL,
    blocked INTEGER NOT NULL, retry_attempts INTEGER NOT NULL, oldest_pending_at INTEGER,
    error_code TEXT, trace_id TEXT, updated_at INTEGER NOT NULL,
    PRIMARY KEY(user_id, client_id)
  )`);
  const app = express();
  app.use(express.json());
  registerClientSaveHealthRoutes({ app, db, writeProtocol: 3,
    auth: { authenticate(req, _res, next) { req.userId = Number(req.headers['x-test-user']); next(); } } });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  async function send(userId, payload) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/client-save-health`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Test-User': String(userId) },
      body: JSON.stringify(payload)
    });
    return { status: response.status, body: await response.json() };
  }
  try {
    const report = { version: 1, clientId: 'client-id-0123456789', pending: 4, blocked: 1,
      retryAttempts: 7, oldestPendingAt: Date.now() - 60000,
      errorCode: 'ENTITY_CHANGED', traceId: '12345678-1234-4234-8234-123456789abc' };
    const accepted = await send(4, report);
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.ok, true);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_client_save_health').get().count, 1);
    await send(4, { ...report, pending: 0, blocked: 0, retryAttempts: 0, oldestPendingAt: null, errorCode: null, traceId: null });
    assert.equal(db.prepare('SELECT pending FROM user_client_save_health WHERE user_id=4').get().pending, 0,
      'a drained queue replaces the old client snapshot');
    const invalid = await send(4, { ...report, answerText: 'private learner answer' });
    assert.equal(invalid.status, 400, 'unknown fields are rejected instead of being persisted');
    const foreignClient = await send(5, report);
    assert.equal(foreignClient.status, 200);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_client_save_health').get().count, 2,
      'the authenticated account, not a payload user id, scopes diagnostics');
    const persisted = db.prepare('SELECT * FROM user_client_save_health WHERE user_id=4').get();
    assert.equal(JSON.stringify(persisted).includes('private learner answer'), false);
    console.log('client-save-health: authenticated bounded metadata replaces per-client status without payload data');
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
