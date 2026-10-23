'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createReviewServer } = require('./serve-grade9-upper-2024-word-review.cjs');

function write(file, contents) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, contents); }
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'grade9-word-review-'));
  const scanRoot = path.join(root, 'scans'), backupRoot = path.join(root, 'backup');
  const pages = Array.from({ length: 10 }, (_, i) => ({ page: i + 107, file: `p${i + 107}.png`, sha256: '' }));
  for (const page of pages) {
    const bytes = Buffer.from(`isolated fake scan ${page.page}`); page.sha256 = require('node:crypto').createHash('sha256').update(bytes).digest('hex').toUpperCase();
    write(path.join(scanRoot, page.file), bytes); write(path.join(backupRoot, page.file), bytes);
  }
  const rows = Array.from({ length: 34 }, (_, i) => `| ${107 + (i % 10)} | Unit 1 / p.${i + 1} | Source difference ${i + 1} | Candidate ${i + 1} |`).join('\n');
  const draftPath = path.join(root, 'draft.json'), reviewPath = path.join(root, 'review.md'), statePath = path.join(root, 'state', 'decisions.json');
  write(draftPath, JSON.stringify({ revision: 'scan-verified-review-v3', reviewStatus: 'pending-user-review', sourceAudit: { approval: 'not approved', suppliedScanPages: pages }, vocabularyText: Array.from({ length: 484 }, () => 'Unit 1|entry|gloss|1').join('\n') }));
  write(reviewPath, `| 扫描页 | 单元 / 教材页 | 原稿差异 | v3 候选 |\n| --- | --- | --- | --- |\n${rows}\n`);
  return { root, scanRoot, backupRoot, draftPath, reviewPath, statePath };
}
function listen(server) { return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`))); }

test('supports scan-confirmed per-finding decisions without modifying the candidate', async t => {
  const f = fixture(); t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));
  const draftBefore = fs.readFileSync(f.draftPath); const reviewBefore = fs.readFileSync(f.reviewPath);
  const server = createReviewServer(f); const origin = await listen(server); t.after(() => new Promise(resolve => server.close(resolve)));
  let response = await fetch(`${origin}/api/items`); assert.equal(response.status, 200);
  let data = await response.json(); assert.equal(data.itemCount, 484); assert.equal(data.items.length, 34); assert.equal(data.summary.pending, 34);
  const item = data.items[0];
  assert.equal((await fetch(`${origin}/scans/not-a-source.png`)).status, 404);
  response = await fetch(`${origin}/api/review`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: item.id, decision: 'approved', scanReviewed: false, baseRevision: 0 }) });
  assert.equal(response.status, 400); assert.equal(fs.existsSync(f.statePath), false);
  response = await fetch(`${origin}/api/review`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: item.id, decision: 'approved', scanReviewed: true, baseRevision: 0, note: 'Checked against scan.' }) });
  assert.equal(response.status, 200); assert.equal((await response.json()).status, 'approved');
  response = await fetch(`${origin}/api/review`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: item.id, decision: 'approved', scanReviewed: true, baseRevision: 0 }) });
  assert.equal(response.status, 409);
  data = await (await fetch(`${origin}/api/items`)).json(); assert.equal(data.summary.approved, 1); assert.equal(data.items[0].note, 'Checked against scan.');
  assert.deepEqual(fs.readFileSync(f.draftPath), draftBefore); assert.deepEqual(fs.readFileSync(f.reviewPath), reviewBefore);
  assert.equal(JSON.parse(fs.readFileSync(f.statePath, 'utf8')).events.length, 1);
});

test('refuses an unverified or changed source scan and prevents state in scan roots', t => {
  const f = fixture(); t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(f.backupRoot, 'p107.png'), 'not the same scan');
  assert.throws(() => createReviewServer(f), /hash mismatch/);
  fs.writeFileSync(path.join(f.backupRoot, 'p107.png'), fs.readFileSync(path.join(f.scanRoot, 'p107.png')));
  assert.throws(() => createReviewServer({ ...f, statePath: path.join(f.scanRoot, 'decisions.json') }), /outside source scans/);
});
