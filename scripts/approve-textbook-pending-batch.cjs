'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { loadCatalog, readReviewState, decorateBook } = require('./serve-textbook-sentence-review.cjs');

const appRoot = path.resolve(__dirname, '..');
const sourceRoot = process.env.TEXTBOOK_SENTENCE_REVIEW_ROOT || 'E:/chunk-practice-asset-sources/textbooks';
const reviewFile = path.join(appRoot, 'output/textbook-sentence-review/review-decisions.json');
const approvalNote = '按课程负责人于2026-10-22的明确指示，对当时范围内所有待审原创例句批量标记通过；本记录表示批量授权，不表示逐条人工审听。';

function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function currentBooks(state) { return loadCatalog(sourceRoot).map(book => decorateBook(book, state)); }
function atomicWrite(file, value) {
  const temporary = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
    fs.renameSync(temporary, file);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
}
function pendingRows(book) {
  return book.draftUnits.flatMap(unit => unit.items
    .filter(item => item.reviewStatus === 'pending')
    .map(item => ({ unitId: unit.id, itemId: item.itemId, sentenceFingerprint: item.sentenceFingerprint })));
}

function createScope(outputFile) {
  if (fs.existsSync(outputFile)) throw new Error(`范围清单已存在，拒绝覆盖：${outputFile}`);
  const state = readReviewState(reviewFile);
  const books = currentBooks(state).filter(book => book.reviewSummary.pending > 0);
  const scope = {
    format: 'textbook-bulk-sentence-approval-scope', schemaVersion: 1,
    createdAt: new Date().toISOString(), reviewRevision: state.revision,
    bookCount: books.length,
    pendingCount: books.reduce((count, book) => count + book.reviewSummary.pending, 0),
    books: books.map(book => ({ bookId: book.id, label: book.label, sourceSha256: book.sourceSha256, expectedPending: book.reviewSummary.pending, items: pendingRows(book) })),
    decision: 'approved', note: approvalNote,
  };
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(scope, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ scopeFile: outputFile, reviewRevision: state.revision, books: scope.bookCount, pending: scope.pendingCount }, null, 2));
}

function applyScope(scopeFile, backupDir) {
  const scope = read(scopeFile);
  if (scope.format !== 'textbook-bulk-sentence-approval-scope' || scope.schemaVersion !== 1 || scope.decision !== 'approved' || !Array.isArray(scope.books)) {
    throw new Error('批量审核范围清单无效');
  }
  if (!path.isAbsolute(backupDir) || fs.existsSync(backupDir) && fs.readdirSync(backupDir).length) {
    throw new Error('备份目录必须是绝对路径且为空');
  }
  const state = readReviewState(reviewFile);
  if (state.revision !== scope.reviewRevision) throw new Error(`审核记录已变化：清单版本 ${scope.reviewRevision}，当前版本 ${state.revision}；请重新盘点`);
  const books = new Map(currentBooks(state).map(book => [book.id, book]));
  const selected = scope.books.map(expected => {
    const book = books.get(expected.bookId);
    if (!book || book.sourceSha256 !== expected.sourceSha256) throw new Error(`教材来源已变化：${expected.bookId}`);
    const actual = pendingRows(book);
    if (actual.length !== expected.expectedPending || JSON.stringify(actual) !== JSON.stringify(expected.items)) throw new Error(`待审条目已变化：${expected.bookId}`);
    return { book, items: actual };
  });
  const total = selected.reduce((count, entry) => count + entry.items.length, 0);
  if (selected.length !== scope.bookCount || total !== scope.pendingCount || !total) throw new Error('待审总数与清单不一致');

  fs.mkdirSync(backupDir, { recursive: true });
  const original = fs.readFileSync(reviewFile);
  const backupFile = path.join(backupDir, 'review-decisions.json');
  fs.writeFileSync(backupFile, original, { flag: 'wx' });
  const backupBytes = fs.readFileSync(backupFile);
  if (hash(original) !== hash(backupBytes)) throw new Error('审核记录备份摘要不匹配，未执行批量通过');
  fs.writeFileSync(path.join(backupDir, 'backup-manifest.json'), `${JSON.stringify({
    format: 'textbook-review-state-backup', schemaVersion: 1, createdAt: new Date().toISOString(),
    sourceFile: reviewFile, backupFile, sha256: hash(original), bytes: original.length,
    sourceRevision: state.revision, bookCount: scope.bookCount, pendingCount: total,
    scopeFile, scopeSha256: hash(fs.readFileSync(scopeFile)),
  }, null, 2)}\n`, { flag: 'wx' });

  let revision = state.revision;
  const events = [];
  for (const { book, items } of selected) {
    const unitMap = new Map(book.draftUnits.map(unit => [unit.id, unit]));
    for (const ref of items) {
      const item = unitMap.get(ref.unitId).items.find(candidate => candidate.itemId === ref.itemId);
      events.push({ revision: ++revision, createdAt: new Date().toISOString(), bookId: book.id,
        unitId: ref.unitId, itemId: ref.itemId, sourceSha256: book.sourceSha256,
        sentenceFingerprint: item.sentenceFingerprint, decision: 'approved', note: approvalNote,
        text: { term: item.term, meaning: item.meaning, english: item.english, chinese: item.chinese, sourceNote: item.reviewNote },
      });
    }
  }
  atomicWrite(reviewFile, { ...state, revision, events: [...state.events, ...events] });
  const saved = readReviewState(reviewFile);
  const approvedBooks = currentBooks(saved).filter(book => scope.books.some(entry => entry.bookId === book.id));
  if (saved.revision !== revision || approvedBooks.some(book => book.reviewSummary.pending || book.reviewSummary.changesRequested) ||
      approvedBooks.reduce((count, book) => count + book.reviewSummary.approved, 0) < total) {
    throw new Error('批量通过后的复核失败；请保留备份并检查审核记录');
  }
  console.log(JSON.stringify({ decision: 'approved', reviewRevision: saved.revision, books: approvedBooks.length,
    approved: total, backupFile, backupSha256: hash(backupBytes), note: approvalNote }, null, 2));
}

const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; };
if (args.includes('--create-scope')) {
  const outputFile = option('--out');
  if (!outputFile) throw new Error('--create-scope 需要 --out');
  createScope(path.resolve(outputFile));
} else if (args.includes('--apply-scope')) {
  const scopeFile = option('--apply-scope'), backupDir = option('--backup-dir');
  if (!scopeFile || !backupDir) throw new Error('--apply-scope 需要 --backup-dir');
  applyScope(path.resolve(scopeFile), path.resolve(backupDir));
} else {
  throw new Error('用法：--create-scope --out <new-json>，或 --apply-scope <json> --backup-dir <new-empty-dir>');
}
