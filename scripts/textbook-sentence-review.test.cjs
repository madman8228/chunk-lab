'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createReviewServer, loadCatalog } = require('./serve-textbook-sentence-review.cjs');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'textbook-sentence-review-'));
  const bookRoot = path.join(root, 'fixture-book');
  const queuePath = path.join(bookRoot, 'audio-batches', '20261028-audio-queue-v1', 'audio-task-queue.json');
  const draftPath = path.join(bookRoot, 'audio-batches', '20261021-sentence-drafts-v1', 'unit-1-sentences.json');
  const reviewStatePath = path.join(root, 'review-decisions.json');
  const queue = {
    book: { bookId: 'fixture-book-id', course: 'fixture-book', title: 'Fixture Book', publisher: 'Test Publisher', series: 'Test', grade: 'Grade 4', volume: 'Upper' },
    source: { sha256: 'a'.repeat(64) },
    tasks: [
      { bookId: 'fixture-book-id', unitId: 'unit-1', itemId: 'unit-1:entry:001', unit: 'Unit 1', order: 1, kind: 'word', displayText: 'hello', meaning: '你好' },
      { bookId: 'fixture-book-id', unitId: 'unit-1', itemId: 'unit-1:entry:001', unit: 'Unit 1', order: 1, kind: 'sentence', displayText: 'hello', meaning: '你好' }
    ]
  };
  writeJson(queuePath, queue);
  writeJson(draftPath, {
    bookId: 'fixture-book-id', unitId: 'unit-1', sourceVocabularySha256: queue.source.sha256,
    reviewStatus: 'pending-user-review', publishable: false,
    reviewNotes: [{ itemId: 'unit-1:entry:001', note: 'Fixture note.' }],
    sentences: [{ itemId: 'unit-1:entry:001', term: 'hello', english: 'Hello, Sam.', chinese: '你好，萨姆。', reviewNote: 'Check this term.', status: 'pending-review' }]
  });
  return { root, queuePath, draftPath, reviewStatePath };
}

test('immutable sentence revisions preserve drafts and reject stale baselines',t=>{
 const fixture=createFixture();t.after(()=>fs.rmSync(fixture.root,{recursive:true,force:true}));
 const original=fs.readFileSync(fixture.draftPath),book=loadCatalog(fixture.root)[0],item=book.draftUnits[0].items[0];
 const file=path.join(fixture.root,'fixture-book/audio-batches/sentence-revisions/001.json');
 const revision={format:'textbook-sentence-revision',schemaVersion:1,bookId:book.id,sourceSha256:book.sourceSha256,changes:[{unitId:'unit-1',itemId:item.itemId,previousFingerprint:item.sentenceFingerprint,english:'Hello, Jane.',chinese:'你好，简。'}]};
 writeJson(file,revision);const updated=loadCatalog(fixture.root)[0].draftUnits[0].items[0];assert.equal(updated.english,'Hello, Jane.');assert.notEqual(updated.sentenceFingerprint,item.sentenceFingerprint);assert.deepEqual(fs.readFileSync(fixture.draftPath),original);
 revision.changes[0].previousFingerprint='f'.repeat(64);writeJson(file,revision);assert.throws(()=>loadCatalog(fixture.root),/修订基线/);
});

test('loads only pending, source-bound sentence drafts and rejects mismatches', t => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));

  const [book] = loadCatalog(fixture.root);
  assert.equal(book.taskCount, 1);
  assert.equal(book.draftCount, 1);
  assert.equal(book.draftUnits[0].items[0].english, 'Hello, Sam.');
  assert.equal(book.draftUnits[0].items[0].reviewNote, 'Check this term.');

  const queue = JSON.parse(fs.readFileSync(fixture.queuePath, 'utf8'));
  queue.source.sha256 = 'b'.repeat(64);
  writeJson(fixture.queuePath, queue);
  assert.throws(() => loadCatalog(fixture.root), /review metadata/);
});

test('serves pending review data without creating a decision file', async t => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  const before = crypto.createHash('sha256').update(fs.readFileSync(fixture.queuePath)).digest('hex');
  const beforeDraft = crypto.createHash('sha256').update(fs.readFileSync(fixture.draftPath)).digest('hex');
  const server = createReviewServer(fixture.root, { reviewStatePath: fixture.reviewStatePath });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;

  const booksResponse = await fetch(`${origin}/api/books`);
  assert.equal(booksResponse.status, 200);
  const books = await booksResponse.json();
  assert.equal(books.length, 1);
  assert.equal(books[0].draftCount, 1);

  const unitResponse = await fetch(`${origin}/api/unit?bookId=fixture-book-id&unitId=unit-1`);
  assert.equal(unitResponse.status, 200);
  const unit = await unitResponse.json();
  assert.equal(unit.items[0].term, 'hello');
  assert.equal(unit.items[0].reviewNote, 'Check this term.');
  assert.equal(unit.items[0].reviewStatus, 'pending');
  assert.equal(unit.items[0].reviewRevision, 0);
  assert.equal((await fetch(`${origin}/api/unit?bookId=unknown&unitId=unit-1`)).status, 404);
  assert.equal((await fetch(`${origin}/api/books`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${origin}/not-a-route`)).status, 404);

  const after = crypto.createHash('sha256').update(fs.readFileSync(fixture.queuePath)).digest('hex');
  const afterDraft = crypto.createHash('sha256').update(fs.readFileSync(fixture.draftPath)).digest('hex');
  assert.equal(after, before);
  assert.equal(afterDraft, beforeDraft);
  assert.equal(fs.existsSync(fixture.reviewStatePath), false);
});

test('records pass, needs-changes, and reset as append-only decisions outside the draft', async t => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  const beforeQueue = crypto.createHash('sha256').update(fs.readFileSync(fixture.queuePath)).digest('hex');
  const beforeDraft = crypto.createHash('sha256').update(fs.readFileSync(fixture.draftPath)).digest('hex');
  const server = createReviewServer(fixture.root, { reviewStatePath: fixture.reviewStatePath });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const endpoint = `${origin}/api/review`;
  const base = { bookId: 'fixture-book-id', unitId: 'unit-1', itemId: 'unit-1:entry:001' };

  const approved = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...base, decision: 'approved', note: '', baseItemRevision: 0 }) });
  assert.equal(approved.status, 200);
  const approvedResult = await approved.json();
  assert.equal(approvedResult.reviewStatus, 'approved');
  assert.equal(approvedResult.reviewRevision, 1);

  const changed = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...base, decision: 'changes-requested', note: 'Use the other meaning.', baseItemRevision: 1 }) });
  assert.equal(changed.status, 200);
  assert.equal((await changed.json()).reviewStatus, 'changes-requested');

  const reset = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...base, decision: 'reset', note: '', baseItemRevision: 2 }) });
  assert.equal(reset.status, 200);
  assert.equal((await reset.json()).reviewStatus, 'pending');

  const state = JSON.parse(fs.readFileSync(fixture.reviewStatePath, 'utf8'));
  assert.equal(state.events.length, 3);
  assert.deepEqual(state.events.map(event => event.decision), ['approved', 'changes-requested', 'reset']);
  assert.equal(state.events[1].note, 'Use the other meaning.');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(fixture.queuePath)).digest('hex'), beforeQueue);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(fixture.draftPath)).digest('hex'), beforeDraft);
});

test('rejects stale writes and invalidates a decision after sentence text changes', async t => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  const base = { bookId: 'fixture-book-id', unitId: 'unit-1', itemId: 'unit-1:entry:001' };
  const server = createReviewServer(fixture.root, { reviewStatePath: fixture.reviewStatePath });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = body => fetch(`${origin}/api/review`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const mark = await request({ ...base, decision: 'approved', note: '', baseItemRevision: 0 });
  assert.equal(mark.status, 200);
  const staleWrite = await request({ ...base, decision: 'changes-requested', note: 'Stale tab', baseItemRevision: 0 });
  assert.equal(staleWrite.status, 409);
  await new Promise(resolve => server.close(resolve));

  const draft = JSON.parse(fs.readFileSync(fixture.draftPath, 'utf8'));
  draft.sentences[0].english = 'Hello there, Sam.';
  writeJson(fixture.draftPath, draft);
  const changedServer = createReviewServer(fixture.root, { reviewStatePath: fixture.reviewStatePath });
  await new Promise(resolve => changedServer.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => changedServer.close(resolve)));
  const unit = await (await fetch(`http://127.0.0.1:${changedServer.address().port}/api/unit?bookId=fixture-book-id&unitId=unit-1`)).json();
  assert.equal(unit.items[0].english, 'Hello there, Sam.');
  assert.equal(unit.items[0].reviewStatus, 'pending');
  assert.equal(unit.items[0].staleReview, true);
});

test('validates decision payloads and exposes review controls in the page', async t => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  const server = createReviewServer(fixture.root, { reviewStatePath: fixture.reviewStatePath });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const bad = await fetch(`${origin}/api/review`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bookId: 'fixture-book-id', unitId: 'unit-1', itemId: 'missing', decision: 'approved', baseItemRevision: 0 }) });
  assert.equal(bad.status, 404);
  const html = await (await fetch(origin)).text();
  assert.match(html, /通过/);
  assert.match(html, /需修改/);
  assert.match(html, /审核结论独立保存在本机/);
});
