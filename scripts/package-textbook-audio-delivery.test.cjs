'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { prepareApprovedSentenceQueue } = require('./prepare-approved-textbook-sentence-queue.cjs');
const { validateBatch } = require('./package-textbook-audio-delivery.cjs');

function sentenceFixture() {
  const sourceHash = 'a'.repeat(64);
  const queue = {
    format: 'textbook-audio-task-queue', schemaVersion: 1, publishable: false,
    book: { bookId: 'book-1' }, source: { sha256: sourceHash }, counts: { wordTasks: 2, sentenceTasks: 2 },
    tasks: [1, 2].flatMap(index => {
      const itemId = `unit-1:entry:${String(index).padStart(3, '0')}`;
      return [{ taskId: `${itemId}::word`, itemId, unitId: 'unit-1', kind: 'word', status: 'generated' }, {
        taskId: `${itemId}::sentence`, bookId: 'book-1', unitId: 'unit-1', itemId, unit: 'Unit 1', section: 'Unit 1', order: index,
        textbookPage: 1, displayText: `word-${index}`, meaning: '释义', kind: 'sentence', status: 'pending-final-text', spokenText: null,
      }];
    })
  };
  const draft = { bookId: 'book-1', unitId: 'unit-1', sourceVocabularySha256: sourceHash, reviewStatus: 'pending-user-review', publishable: false,
    sentences: [1, 2].map(index => ({ itemId: `unit-1:entry:${String(index).padStart(3, '0')}`, english: `Sentence ${index}.`, chinese: '中文。', status: 'pending-review' })) };
  const prepared = prepareApprovedSentenceQueue({ queue, draft, confirmation: '通过：book-1，Unit 1' });
  for (const task of prepared.queue.tasks.filter(row => row.kind === 'sentence')) task.status = 'generated';
  const generation = { format: 'textbook-audio-masters', publishable: false, records: prepared.queue.tasks.filter(row => row.kind === 'sentence').map(task => ({
    taskId: task.taskId, kind: 'sentence', itemId: task.itemId, inputFingerprint: task.inputFingerprint, text: task.spokenText,
  })) };
  return { queue: prepared.queue, generation };
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}

test('accepts sentence audio only when each generated task is bound to an explicit scope approval', () => {
  const fixture = sentenceFixture();
  assert.equal(validateBatch(fixture.queue, fixture.generation, 'sentence').taskCount, 2);
  const wordQueue = structuredClone(fixture.queue);
  const wordTasks = wordQueue.tasks.filter(task => task.kind === 'word');
  const wordGeneration = { format: 'textbook-audio-masters', publishable: false, records: wordTasks.map((task, index) => {
    task.spokenText = `word-${index + 1}`;
    task.inputFingerprint = `fingerprint-${index + 1}`;
    return { taskId: task.taskId, kind: 'word', itemId: task.itemId, inputFingerprint: task.inputFingerprint, text: task.spokenText };
  }) };
  assert.equal(validateBatch(wordQueue, wordGeneration).taskCount, 2, 'the default word-packaging path remains supported');
  const noApproval = structuredClone(fixture.queue);
  noApproval.approvals = [];
  assert.throws(() => validateBatch(noApproval, fixture.generation, 'sentence'), /no matching user approval/);
  const changedSource = structuredClone(fixture.queue);
  changedSource.source.sha256 = 'b'.repeat(64);
  assert.throws(() => validateBatch(changedSource, fixture.generation, 'sentence'), /no matching user approval/);
});

test('rejects incomplete, duplicated, mismatched, or still-ready selected tasks', () => {
  const fixture = sentenceFixture();
  const partial = structuredClone(fixture.queue);
  partial.tasks.find(task => task.kind === 'sentence').status = 'ready';
  assert.throws(() => validateBatch(partial, fixture.generation, 'sentence'), /remain ready/);
  const duplicate = structuredClone(fixture.generation);
  duplicate.records.push(duplicate.records[0]);
  assert.throws(() => validateBatch(fixture.queue, duplicate, 'sentence'), /incomplete or duplicated/);
  const mismatch = structuredClone(fixture.generation);
  mismatch.records[0].text += ' changed';
  assert.throws(() => validateBatch(fixture.queue, mismatch, 'sentence'), /Task\/text mismatch/);
  assert.throws(() => validateBatch(fixture.queue, fixture.generation, 'other'), /Unsupported audio kind/);
});

test('packages an approved sentence fixture into verified local Ogg/Opus delivery', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'textbook-sentence-opus-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const batch = path.join(root, 'approved-unit-v1');
  const masters = path.join(batch, 'masters');
  fs.mkdirSync(masters, { recursive: true });
  const wavPath = path.join(masters, 'technical-tone-fixture.wav');
  const tone = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', wavPath], { encoding: 'utf8', windowsHide: true });
  assert.equal(tone.status, 0, tone.stderr);
  const audioBytes = fs.readFileSync(wavPath);
  const fixture = sentenceFixture();
  fixture.generation.records = fixture.generation.records.map(row => ({
    ...row,
    displayText: row.itemId,
    pronunciationRule: 'default-g2p',
    language: 'en-US', voice: 'af_heart', speed: 1,
    path: 'masters/technical-tone-fixture.wav',
    sha256: crypto.createHash('sha256').update(audioBytes).digest('hex'),
    bytes: audioBytes.length, durationSeconds: 1,
  }));
  fixture.generation.voice = 'af_heart';
  fixture.generation.language = 'en-US';
  writeJson(path.join(batch, 'audio-task-queue.json'), fixture.queue);
  writeJson(path.join(batch, 'generation-manifest.json'), fixture.generation);

  const packageResult = spawnSync(process.execPath, [path.join(__dirname, 'package-textbook-audio-delivery.cjs'), '--batch', batch, '--kind', 'sentence'], { encoding: 'utf8', windowsHide: true });
  assert.equal(packageResult.status, 0, packageResult.stderr || packageResult.stdout);
  const manifest = JSON.parse(fs.readFileSync(path.join(batch, 'delivery-manifest.json'), 'utf8'));
  assert.equal(manifest.format, 'textbook-sentence-audio-delivery');
  assert.equal(manifest.publishable, false);
  assert.equal(manifest.counts.sentenceBindings, 2);
  assert.equal(manifest.records.length, 2);
  for (const file of manifest.files) {
    const output = path.join(batch, ...file.path.split('/'));
    const bytes = fs.readFileSync(output);
    assert.equal(bytes.toString('ascii', 0, 4), 'OggS');
    assert.ok(bytes.includes(Buffer.from('OpusHead')));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256);
  }
});
