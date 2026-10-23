'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { prepareApprovedSentenceQueue } = require('./prepare-approved-textbook-sentence-queue.cjs');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'approved-textbook-sentences-'));
  const sourceHash = 'a'.repeat(64);
  const queue = {
    format: 'textbook-audio-task-queue', schemaVersion: 1, publishable: false,
    book: { bookId: 'book-1' }, source: { sha256: sourceHash },
    counts: { sentenceTasks: 2, pendingFinalText: 2 },
    tasks: [1, 2, 3].flatMap(index => {
      const unitId = index < 3 ? 'unit-1' : 'unit-2';
      const itemId = `${unitId}:entry:${String(index).padStart(3, '0')}`;
      return [{ taskId: `${itemId}::word`, itemId, unitId, kind: 'word', status: 'generated' }, {
        taskId: `${itemId}::sentence`, bookId: 'book-1', unitId, itemId, unit: unitId, section: unitId,
        order: index, textbookPage: 1, displayText: `word-${index}`, meaning: `释义${index}`,
        kind: 'sentence', status: 'pending-final-text', spokenText: null,
      }];
    })
  };
  const draft = {
    bookId: 'book-1', unitId: 'unit-1', sourceVocabularySha256: sourceHash,
    reviewStatus: 'pending-user-review', publishable: false,
    sentences: [1, 2].map(index => ({
      itemId: `unit-1:entry:${String(index).padStart(3, '0')}`,
      english: `Example ${index}.`, chinese: `例句${index}。`, status: 'pending-review',
    }))
  };
  return { root, queue, draft };
}

test('creates a source-bound approved queue overlay without changing other units', t => {
  const input = fixture();
  t.after(() => fs.rmSync(input.root, { recursive: true, force: true }));
  const before = JSON.stringify(input.queue);
  const result = prepareApprovedSentenceQueue({ queue: input.queue, draft: input.draft, confirmation: '通过：Book 1，Unit 1。', recordedAt: '2026-10-21T00:00:00.000Z' });
  const selected = result.queue.tasks.filter(task => task.kind === 'sentence' && task.unitId === 'unit-1');
  const other = result.queue.tasks.find(task => task.kind === 'sentence' && task.unitId === 'unit-2');
  assert.deepEqual(selected.map(task => task.status), ['ready', 'ready']);
  assert.deepEqual(selected.map(task => task.spokenText), ['Example 1.', 'Example 2.']);
  assert.ok(selected.every(task => /^[a-f0-9]{64}$/.test(task.inputFingerprint)));
  assert.equal(other.status, 'pending-final-text');
  assert.equal(result.approval.approvedItemIds.length, 2);
  assert.equal(result.approval.publishable, false);
  assert.equal(result.queue.publishable, false);
  assert.equal(JSON.stringify(input.queue), before);
});

test('fails closed for missing confirmation, changed source, incomplete rows, and approved source status', t => {
  const input = fixture();
  t.after(() => fs.rmSync(input.root, { recursive: true, force: true }));
  assert.throws(() => prepareApprovedSentenceQueue({ queue: input.queue, draft: input.draft, confirmation: '' }), /explicit user confirmation/);
  assert.throws(() => prepareApprovedSentenceQueue({ queue: input.queue, draft: { ...input.draft, sourceVocabularySha256: 'b'.repeat(64) }, confirmation: '通过' }), /source hash/);
  assert.throws(() => prepareApprovedSentenceQueue({ queue: input.queue, draft: { ...input.draft, sentences: input.draft.sentences.slice(0, 1) }, confirmation: '通过' }), /counts\/identities/);
  assert.throws(() => prepareApprovedSentenceQueue({ queue: input.queue, draft: { ...input.draft, reviewStatus: 'approved' }, confirmation: '通过' }), /unapproved/);
  const duplicate = structuredClone(input.draft);
  duplicate.sentences[1].itemId = duplicate.sentences[0].itemId;
  assert.throws(() => prepareApprovedSentenceQueue({ queue: input.queue, draft: duplicate, confirmation: '通过' }), /duplicated/);
});
