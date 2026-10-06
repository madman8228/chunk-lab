'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { freePort } = require('../e2e/lib/free-port');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-cli-recovery-'));
const backupDir = path.join(dataDir, 'backups');
const port = freePort(9710, 80);
const base = 'http://127.0.0.1:' + port;
const cli = path.join(__dirname, 'backup-cli.js');
const secret = 'backup-cli-recovery-isolated-test-secret';
let server;

async function request(method, route, token, payload) {
  const response = await fetch(base + route, { method,
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(payload ? { 'Content-Type': 'application/json' } : {}) },
    body: payload ? JSON.stringify(payload) : undefined });
  const body = await response.json();
  return { status: response.status, body };
}

async function startServer() {
  server = spawn(process.execPath, ['index.js'], { cwd: __dirname, stdio: 'ignore',
    env: { ...process.env, NODE_ENV: 'test', PORT: String(port), CHUNKLAB_DATA_DIR: dataDir,
      REQUIRE_AUTH: 'true', JWT_SECRET: secret, CHUNKLAB_WRITE_PROTOCOL: '3' } });
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error('isolated protocol-3 server exited during startup');
    try { if ((await fetch(base + '/api/health')).ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 75));
  }
  throw new Error('isolated protocol-3 server did not start');
}

function runCli(args, token) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: path.dirname(__dirname),
      env: { ...process.env, BASE_URL: base, TOKEN: token, BACKUP_DIR: backupDir },
      stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

(async function main() {
  try {
    await startServer();
    const source = await request('POST', '/api/auth/register', null, { username: 'cli-source', password: 'test-password' });
    const target = await request('POST', '/api/auth/register', null, { username: 'cli-target', password: 'test-password' });
    assert.equal(source.status, 200);
    assert.equal(target.status, 200);
    const putDeck = await request('POST', '/api/operations', source.body.token, { protocol: 3,
      requestId: 'cli-source-deck-put-0001', type: 'deck.put', expectedRev: null,
      payload: { deck: { id: 'cli-restore-deck', name: 'CLI restore deck', items: [{ sentence: 'Restored from CLI.' }] } } });
    assert.equal(putDeck.status, 200);

    const backupResult = await runCli(['backup'], source.body.token);
    assert.equal(backupResult.code, 0, backupResult.stderr);
    const files = fs.readdirSync(backupDir).filter(name => name.startsWith('chunklab_backup_') && name.endsWith('.json'));
    assert.equal(files.length, 1);
    const backupPath = path.join(backupDir, files[0]);
    const previewResult = await runCli(['preview', backupPath], target.body.token);
    assert.equal(previewResult.code, 0, previewResult.stderr);
    const previewPath = backupPath + '.preview.json';
    const preview = JSON.parse(fs.readFileSync(previewPath, 'utf8'));
    assert.equal(preview.userId, String(target.body.user.id));
    assert.equal(preview.eligible, true);
    assert.equal(preview.sourceHash.length, 64);

    const noConfirm = await runCli(['apply', previewPath], target.body.token);
    assert.notEqual(noConfirm.code, 0);
    assert.match(noConfirm.stderr, /必须明确确认/);
    const applied = await runCli(['apply', previewPath, '--confirm'], target.body.token);
    assert.equal(applied.code, 0, applied.stderr);
    const restored = await request('GET', '/api/export', target.body.token);
    assert.equal(restored.status, 200);
    assert.equal(restored.body.mem.decks.some(deck => deck.id === 'cli-restore-deck'), true,
      'CLI recovery through preview/apply restores the exported source into an empty account');

    const retry = await runCli(['apply', previewPath, '--confirm'], target.body.token);
    assert.equal(retry.code, 0, retry.stderr);
    assert.match(retry.stdout, /已按固定预览恢复/,
      'retry after an uncertain CLI response is idempotent for the already-applied source');

    const occupied = await request('POST', '/api/auth/register', null, { username: 'cli-occupied', password: 'test-password' });
    assert.equal(occupied.status, 200);
    const existingDeck = await request('POST', '/api/operations', occupied.body.token, { protocol: 3,
      requestId: 'cli-occupied-deck-put-0001', type: 'deck.put', expectedRev: null,
      payload: { deck: { id: 'keep-this-deck', name: 'Existing target data', items: [{ sentence: 'Keep me.' }] } } });
    assert.equal(existingDeck.status, 200);
    const occupiedPreviewResult = await runCli(['preview', backupPath], occupied.body.token);
    assert.equal(occupiedPreviewResult.code, 0, occupiedPreviewResult.stderr);
    const occupiedPreviewPath = backupPath + '.preview.json';
    const occupiedPreview = JSON.parse(fs.readFileSync(occupiedPreviewPath, 'utf8'));
    assert.equal(occupiedPreview.eligible, false, 'non-empty target is explicitly non-applicable');
    assert.equal(occupiedPreview.reason, 'server-not-empty');
    assert.ok(occupiedPreview.merge && occupiedPreview.merge.items.decks.some(item => item.id === 'cli-restore-deck' && item.status === 'add'),
      'the fixed CLI preview shows an explicit safe addition without exposing source payloads');
    const refused = await runCli(['apply', occupiedPreviewPath, '--confirm'], occupied.body.token);
    assert.notEqual(refused.code, 0);
    assert.match(refused.stderr, /明确选择/);
    const occupiedExport = await request('GET', '/api/export', occupied.body.token);
    assert.equal(occupiedExport.body.mem.decks.some(deck => deck.id === 'keep-this-deck'), true,
      'non-empty account remains unchanged without an explicit selection');
    assert.equal(occupiedExport.body.mem.decks.some(deck => deck.id === 'cli-restore-deck'), false);
    const selectionPath = path.join(backupDir, 'selection.json');
    fs.writeFileSync(selectionPath, JSON.stringify({ decks: ['cli-restore-deck'] }));
    const selectedApply = await runCli(['apply', occupiedPreviewPath, '--confirm', '--selection', selectionPath], occupied.body.token);
    assert.equal(selectedApply.code, 0, selectedApply.stderr);
    assert.match(selectedApply.stdout, /已恢复所选无冲突内容/);
    const selectedExport = await request('GET', '/api/export', occupied.body.token);
    assert.equal(selectedExport.body.mem.decks.some(deck => deck.id === 'keep-this-deck'), true,
      'an explicit partial restore never overwrites existing cloud content');
    assert.equal(selectedExport.body.mem.decks.some(deck => deck.id === 'cli-restore-deck'), true,
      'an explicit safe addition is restored from a non-empty account');
    const selectedRetry = await runCli(['apply', occupiedPreviewPath, '--confirm', '--selection', selectionPath], occupied.body.token);
    assert.equal(selectedRetry.code, 0, selectedRetry.stderr);
    assert.match(selectedRetry.stdout, /已恢复所选无冲突内容/,
      'retrying the same selection is idempotent');

    const unknownTarget = await request('POST', '/api/auth/register', null, { username: 'cli-unknown-target', password: 'test-password' });
    assert.equal(unknownTarget.status, 200);
    const unknownExisting = await request('POST', '/api/operations', unknownTarget.body.token, { protocol: 3,
      requestId: 'cli-unknown-existing-deck-0001', type: 'deck.put', expectedRev: null,
      payload: { deck: { id: 'keep-unknown-target', name: 'Keep unknown target', items: [] } } });
    assert.equal(unknownExisting.status, 200);
    const unknownBackupPath = path.join(backupDir, 'unknown-receipt-backup.json');
    fs.writeFileSync(unknownBackupPath, JSON.stringify({ __app: 'chunklab', version: 1,
      exportedAt: '2026-10-04T00:00:00.000Z', mem: { decks: [
        { id: 'cli-unknown-safe-deck', name: 'Safe new deck', items: [] }
      ], stats: {}, settings: {} }, courses: [], courseProgress: {}, reinforceBook: [],
      saveState: { unconfirmedOperations: [{ requestId: 'cli-unknown-old-operation-01',
        operation: { type: 'learning.answer', payload: { answer: 'never replay this' } } }] } }));
    const unknownPreviewResult = await runCli(['preview', unknownBackupPath], unknownTarget.body.token);
    assert.equal(unknownPreviewResult.code, 0, unknownPreviewResult.stderr);
    const unknownPreviewPath = unknownBackupPath + '.preview.json';
    const unknownPreview = JSON.parse(fs.readFileSync(unknownPreviewPath, 'utf8'));
    assert.equal(unknownPreview.reason, 'legacy-receipt-unknown');
    assert.ok(unknownPreview.merge.items.decks.some(item => item.id === 'cli-unknown-safe-deck' && item.status === 'add'));
    const unknownNoSelection = await runCli(['apply', unknownPreviewPath, '--confirm'], unknownTarget.body.token);
    assert.notEqual(unknownNoSelection.code, 0, 'an unknown old operation cannot trigger implicit recovery');
    assert.match(unknownNoSelection.stderr, /明确选择/);
    fs.writeFileSync(selectionPath, JSON.stringify({ decks: ['cli-unknown-safe-deck'] }));
    const unknownSelected = await runCli(['apply', unknownPreviewPath, '--confirm', '--selection', selectionPath], unknownTarget.body.token);
    assert.equal(unknownSelected.code, 0, unknownSelected.stderr);
    const unknownExport = await request('GET', '/api/export', unknownTarget.body.token);
    assert.equal(unknownExport.body.mem.decks.some(deck => deck.id === 'keep-unknown-target'), true);
    assert.equal(unknownExport.body.mem.decks.some(deck => deck.id === 'cli-unknown-safe-deck'), true,
      'CLI can restore only an explicitly selected disjoint addition when a legacy receipt is unknown');
    const unknownManifest = await request('GET', '/api/recovery/' + encodeURIComponent(unknownPreview.sourceId) + '/manifest', unknownTarget.body.token);
    assert.equal(unknownManifest.status, 200);
    assert.equal(unknownManifest.body.manifest.legacyReceipts[0].receipt, 'unknown',
      'selective CLI recovery does not resolve, replay, or discard the original unknown operation');
    console.log('backup-cli-recovery: isolated protocol-3 export, immutable archive, account-bound preview, confirmed apply, and lost-response retry passed');
  } catch (error) {
    console.error('[backup-cli-recovery] failed:', error && error.stack || error);
    process.exitCode = 1;
  } finally {
    if (server && server.exitCode === null) {
      const exited = new Promise(resolve => server.once('exit', resolve));
      server.kill();
      await exited;
    }
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (_) {}
  }
})();
