'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const args = process.argv.slice(2);
const option = name => {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1]) throw new Error(`Missing ${name}`);
  return args[index + 1];
};
const optional = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const stable = value => JSON.stringify(value, Object.keys(value).sort());
const spokenForm = term => /^[A-Z]{2,}$/.test(term) ? term.split('').join('. ') + '.' : term;

function main() {
  const sourceFile = path.resolve(option('--source'));
  const bookId = option('--book-id');
  const output = path.resolve(option('--out'));
  const sourceBytes = fs.readFileSync(sourceFile);
  const sourceHash = sha256(sourceBytes);
  const source = JSON.parse(sourceBytes.toString('utf8'));
  const bookSource = source.edition || source.textbook;
  const publisher = bookSource?.publisher || optional('--publisher');
  if (!bookSource || publisher !== '人民教育出版社') throw new Error('Expected an exact reviewed textbook identity from the source or --publisher');
  let sourceRecords = source.records;
  if (!Array.isArray(sourceRecords) && Array.isArray(source.units)) {
    sourceRecords = source.units.flatMap(unit => (unit.words || []).map((word, index) => ({
      unitId: `unit-${unit.unit}`, unit: unit.unit, section: unit.title || `Unit ${unit.unit}`,
      order: index + 1, term: word[0], meaning: word[1], textbookPage: word[2],
      entryId: `unit-${unit.unit}:entry:${String(index + 1).padStart(3, '0')}`,
    })));
  }
  if (!Array.isArray(sourceRecords) || !sourceRecords.length) throw new Error('Source has no structured unit vocabulary records');
  const seen = new Set();
  const records = sourceRecords.map((record, index) => {
    if (!record.entryId || !record.unitId || !record.term || !record.meaning || seen.has(record.entryId)) {
      throw new Error(`Invalid or duplicate source record at index ${index}`);
    }
    seen.add(record.entryId);
    return record;
  });
  if (fs.existsSync(output)) throw new Error(`Refusing to overwrite existing queue: ${output}`);
  const tasks = [];
  for (const record of records) {
    const base = {
      bookId, unitId: record.unitId, itemId: record.entryId, unit: record.unit,
      section: record.section, order: record.order, textbookPage: record.textbookPage,
      displayText: record.term, meaning: record.meaning,
    };
    const spokenText = spokenForm(record.term);
    const pronunciationRule = spokenText === record.term ? 'default-g2p' : 'initialism-letter-names';
    const wordInput = { sourceHash, ...base, kind: 'word', spokenText, pronunciationRule, language: 'en-US', voice: 'af_heart', speed: 1 };
    tasks.push({
      ...base, kind: 'word', taskId: `${bookId}::${record.unitId}::${record.entryId}::word`,
      spokenText, pronunciationRule, language: 'en-US', voice: 'af_heart', speed: 1,
      inputFingerprint: sha256(Buffer.from(stable(wordInput))), status: 'ready',
    });
    const sentenceInput = { sourceHash, ...base, kind: 'sentence', spokenText: null };
    tasks.push({
      ...base, kind: 'sentence', taskId: `${bookId}::${record.unitId}::${record.entryId}::sentence`,
      spokenText: null, language: 'en-US', voice: 'af_heart', speed: 1,
      inputFingerprint: sha256(Buffer.from(stable(sentenceInput))), status: 'pending-final-text',
    });
  }
  const book = {
    bookId, course: source.course || optional('--course') || path.basename(path.dirname(sourceFile)),
    ...bookSource, publisher,
  };
  const queue = {
    format: 'textbook-audio-task-queue', schemaVersion: 1, stage: 'draft', publishable: false,
    book,
    source: { path: sourceFile, sha256: sourceHash, scope: source.scope || 'unit-level vocabulary only', itemCount: records.length },
    voiceProfile: { engine: 'kokoro-onnx', voice: 'af_heart', language: 'en-US', speed: 1 },
    counts: {
      items: records.length, wordTasks: records.length, sentenceTasks: records.length,
      ready: records.length, pendingFinalText: records.length,
    },
    tasks,
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(queue, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ queue: output, bookId, items: records.length, wordTasks: records.length, pendingSentenceTexts: records.length, sourceSha256: sourceHash }, null, 2));
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
