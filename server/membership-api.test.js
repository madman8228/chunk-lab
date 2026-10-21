'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const Database = require('better-sqlite3');
const { createMembershipRepository } = require('./services/membership/repository');
const { createMembershipCodeIssuer } = require('./services/membership/code-issuer');
const { createEntitlementService } = require('./services/membership/entitlement-service');
const { createMembershipAdminService } = require('./services/membership/admin-service');
const { createMembershipService } = require('./services/membership/membership-service');
const { createRedemptionService } = require('./services/membership/redemption-service');
const { registerMembershipRoutes } = require('./routes/membership');
const { registerAdminMembershipRoutes } = require('./routes/admin-membership');

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-membership-api-'));
  let db, server;
  try {
    db = new Database(path.join(dir, 'isolated.db'));
    db.pragma('foreign_keys = ON');
    db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT NOT NULL);
      INSERT INTO users VALUES(1,'admin-test-user'); INSERT INTO users VALUES(2,'guest_test-user');`);
    const repository = createMembershipRepository(db);
    const secret = crypto.randomBytes(32);
    const keyProvider = { current: () => ({ version: 'test-v1', secret }), get: v => v === 'test-v1' ? { version: v, secret } : null, versions: () => ['test-v1'] };
    const issuer = createMembershipCodeIssuer({ repository, keyProvider });
    const entitlements = createEntitlementService({ db });
    const membershipAdmin = createMembershipAdminService({ db, repository, issuer });
    const membership = createMembershipService({ db, repository, entitlements });
    const redemption = createRedemptionService({ db, repository, issuer, entitlements });
    const auth = {
      authenticate(req, _res, next) { req.userId = Number(req.get('x-test-user') || 1); next(); },
      readUser(id) { return db.prepare('SELECT id,username FROM users WHERE id=?').get(id); }
    };
    const adminOnly = (req, _res, next) => { req.admin = { id: 1 }; next(); };
    const app = express(); app.use(express.json());
    registerMembershipRoutes({ app, auth, membership, redemption });
    registerAdminMembershipRoutes({ app, adminOnly, membershipAdmin, repository, entitlements });
    server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    const base = 'http://127.0.0.1:' + server.address().port;
    const call = (url, options = {}) => fetch(base + url, { ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });

    const status = await call('/api/membership');
    assert.equal(status.status, 200);
    assert.equal(status.headers.get('cache-control'), 'private, no-store');
    const anonymousRedeem = await call('/api/membership/redeem', { method: 'POST', headers: { 'x-test-user': '2' },
      body: JSON.stringify({ code: 'CL1-0000-0000-0000-0000-0000-0000-0000-0000', requestId: 'request_api_guest_01' }) });
    assert.equal(anonymousRedeem.status, 403);

    const issuedResponse = await call('/api/admin/membership/code-batches/issue-export', { method: 'POST',
      body: JSON.stringify({ planKey: 'quarterly', quantity: 1, requestId: 'request_api_issue_01' }) });
    assert.equal(issuedResponse.status, 200);
    assert.match(issuedResponse.headers.get('content-type'), /text\/csv/);
    assert.equal(issuedResponse.headers.get('x-membership-batch-status'), 'paused');
    const csv = await issuedResponse.text();
    assert.match(csv, /"batch_id","code_id","plan_key","term_months","redeem_by","code"/);
    const code = csv.match(/"(CL1(?:-[A-Z2-7]{4}){8})"\r\n$/)?.[1];
    assert.ok(code, 'CSV contains one grouped redeem code');
    const batchId = issuedResponse.headers.get('x-membership-batch-id');
    const duplicateIssue = await call('/api/admin/membership/code-batches/issue-export', { method: 'POST',
      body: JSON.stringify({ planKey: 'quarterly', quantity: 1, requestId: 'request_api_issue_01' }) });
    assert.equal(duplicateIssue.status, 409);
    assert.doesNotMatch(await duplicateIssue.text(), /CL1-/);

    const activate = await call('/api/admin/membership/code-batches/' + batchId + '/action', { method: 'POST',
      body: JSON.stringify({ action: 'activate', baseRevision: 1, requestId: 'request_api_activate_01' }) });
    assert.equal(activate.status, 200);
    const redeemed = await call('/api/membership/redeem', { method: 'POST',
      body: JSON.stringify({ code, requestId: 'request_api_redeem_01' }) });
    assert.equal(redeemed.status, 200);
    assert.equal((await redeemed.json()).membership.entitlement.active, true);
    console.log('membership routes and CSV export passed on an isolated port');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (db) db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
