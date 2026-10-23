'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const option = name => {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1]) throw new Error(`Missing ${name}`);
  return args[index + 1];
};
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const stableJson = value => JSON.stringify(value, Object.keys(value).sort());
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function prepareApprovedSentenceQueue({ queue, draft, confirmation, recordedAt = new Date().toISOString() }) {
  if (queue.format !== 'textbook-audio-task-queue' || queue.schemaVersion !== 1 || queue.publishable !== false) {
    throw new Error('Unsupported or publishable source queue');
  }
  if (!confirmation || !confirmation.trim()) throw new Error('An explicit user confirmation record is required');
  if (draft.bookId !== queue.book.bookId || draft.sourceVocabularySha256 !== queue.source.sha256) {
    throw new Error('Draft identity/source hash does not match the queue');
  }
  if (draft.reviewStatus !== 'pending-user-review' || draft.publishable !== false) {
    throw new Error('Expected an unapproved, non-publishable review draft');
  }
  const unitId = draft.unitId;
  if (!unitId) throw new Error('Draft has no unitId');

  const sentences = draft.sentences;
  if (!Array.isArray(sentences) || !sentences.length) throw new Error('Draft has no sentence rows');
  const sentenceById = new Map();
  for (const sentence of sentences) {
    if (!sentence.itemId || !sentence.english?.trim() || !sentence.chinese?.trim() || sentence.status !== 'pending-review' || sentenceById.has(sentence.itemId)) {
      throw new Error(`Invalid, duplicated, or already reviewed sentence: ${sentence.itemId || '(missing itemId)'}`);
    }
    sentenceById.set(sentence.itemId, sentence);
  }

  const targetTasks = queue.tasks.filter(task => task.kind === 'sentence' && task.unitId === unitId);
  if (targetTasks.length !== sentences.length || new Set(targetTasks.map(task => task.itemId)).size !== targetTasks.length) {
    throw new Error('Queue and review draft item counts/identities do not match');
  }
  const seen = new Set();
  const approvedItemIds = [];
  const preparedQueue = structuredClone(queue);
  for (const task of preparedQueue.tasks) {
    if (task.kind !== 'sentence' || task.unitId !== unitId) continue;
    const sentence = sentenceById.get(task.itemId);
    if (!sentence || seen.has(task.itemId) || task.status !== 'pending-final-text') {
      throw new Error(`Sentence task is missing, duplicated, or not awaiting final text: ${task.taskId}`);
    }
    seen.add(task.itemId);
    const input = {
      sourceHash: queue.source.sha256,
      bookId: task.bookId,
      unitId: task.unitId,
      itemId: task.itemId,
      unit: task.unit,
      section: task.section,
      order: task.order,
      textbookPage: task.textbookPage,
      displayText: task.displayText,
      meaning: task.meaning,
      kind: 'sentence',
      spokenText: sentence.english.trim(),
    };
    task.spokenText = sentence.english.trim();
    task.inputFingerprint = sha256(Buffer.from(stableJson(input)));
    task.status = 'ready';
    approvedItemIds.push(task.itemId);
  }
  if (seen.size !== sentenceById.size) throw new Error('Draft contains entries without matching queue tasks');

  const approval = {
    format: 'textbook-sentence-text-approval',
    schemaVersion: 1,
    status: 'user-approved',
    recordedAt,
    confirmationSource: 'codex-conversation',
    confirmation: confirmation.trim(),
    bookId: queue.book.bookId,
    unitId,
    sourceVocabularySha256: queue.source.sha256,
    draftSha256: sha256(Buffer.from(JSON.stringify(draft))),
    approvedItemIds: approvedItemIds.sort(),
    publishable: false,
  };
  preparedQueue.approvals = [...(preparedQueue.approvals || []), approval];
  preparedQueue.counts = {
    ...preparedQueue.counts,
    sentenceReady: preparedQueue.tasks.filter(task => task.kind === 'sentence' && task.status === 'ready').length,
    pendingFinalText: preparedQueue.tasks.filter(task => task.kind === 'sentence' && task.status === 'pending-final-text').length,
  };
  return { queue: preparedQueue, approval };
}

function main() {
  const queuePath = path.resolve(option('--queue'));
  const draftPath = path.resolve(option('--draft'));
  const output = path.resolve(option('--out'));
  const result = prepareApprovedSentenceQueue({
    queue: readJson(queuePath),
    draft: readJson(draftPath),
    confirmation: option('--confirmation'),
  });
  if (fs.existsSync(output)) throw new Error(`Refusing to overwrite derived queue: ${output}`);
  const parent = path.dirname(output);
  fs.mkdirSync(parent, { recursive: true });
  const stage = fs.mkdtempSync(path.join(parent, '.approved-sentence-queue-'));
  try {
    fs.writeFileSync(path.join(stage, 'audio-task-queue.json'), JSON.stringify(result.queue, null, 2) + '\n', { flag: 'wx' });
    fs.writeFileSync(path.join(stage, 'approval-record.json'), JSON.stringify(result.approval, null, 2) + '\n', { flag: 'wx' });
    fs.renameSync(stage, output);
  } catch (error) {
    throw new Error(`${error.message}\nStaged approval artifacts retained at: ${stage}`);
  }
  console.log(JSON.stringify({ output, bookId: result.approval.bookId, unitId: result.approval.unitId, approvedItems: result.approval.approvedItemIds.length, pendingSentenceTasks: result.queue.counts.pendingFinalText, publishable: false }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { prepareApprovedSentenceQueue };
