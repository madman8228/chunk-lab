'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');

const pagePath = path.join(__dirname, 'textbook-sentence-review.html');
const defaultReviewStatePath = path.resolve(__dirname, '../output/textbook-sentence-review/review-decisions.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function emptyReviewState() {
  return { format: 'textbook-sentence-review-decisions', schemaVersion: 1, revision: 0, events: [] };
}

function readReviewState(filePath) {
  if (!fs.existsSync(filePath)) return emptyReviewState();
  const state = readJson(filePath);
  if (state.format !== 'textbook-sentence-review-decisions' || state.schemaVersion !== 1 || !Number.isSafeInteger(state.revision) || !Array.isArray(state.events)) {
    throw new Error(`Unsupported or damaged sentence review state: ${filePath}`);
  }
  return state;
}

function writeReviewState(filePath, state) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { flag: 'wx' });
    fs.renameSync(temporary, filePath);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
}

function sameItem(event, book, unit, item) {
  return event.bookId === book.id && event.unitId === unit.id && event.itemId === item.itemId;
}

function currentItemDecision(state, book, unit, item) {
  const events = state.events.filter(event => sameItem(event, book, unit, item));
  const current = [...events].reverse().find(event => event.sourceSha256 === book.sourceSha256 && event.sentenceFingerprint === item.sentenceFingerprint);
  return {
    reviewStatus: current?.decision === 'approved' ? 'approved' : current?.decision === 'changes-requested' ? 'changes-requested' : 'pending',
    decisionNote: current?.note || '',
    reviewRevision: current?.revision || 0,
    staleReview: events.length > 0 && !current,
  };
}

function reviewSummary(items) {
  return items.reduce((summary, item) => {
    const status = item.reviewStatus || 'pending';
    if (status === 'approved') summary.approved += 1;
    else if (status === 'changes-requested') summary.changesRequested += 1;
    else summary.pending += 1;
    return summary;
  }, { approved: 0, changesRequested: 0, pending: 0 });
}

function decorateBook(book, state) {
  const units = book.draftUnits.map(unit => ({
    ...unit,
    items: unit.items.map(item => ({ ...item, ...currentItemDecision(state, book, unit, item) })),
  }));
  return {
    ...book,
    reviewSummary: reviewSummary(units.flatMap(unit => unit.items)),
    units: units.map(unit => ({ id: unit.id, title: unit.title, count: unit.items.length, reviewSummary: reviewSummary(unit.items) })),
    draftUnits: units,
  };
}

async function readRequestJson(request, maxBytes = 16 * 1024) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body, 'utf8') > maxBytes) throw Object.assign(new Error('Request body too large'), { statusCode: 413 });
  }
  try { return JSON.parse(body); } catch { throw Object.assign(new Error('Invalid JSON request body'), { statusCode: 400 }); }
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(value));
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function courseLabel(book, bookId) {
  const course = book.course || bookId;
  const match = course.match(/grade(\d+)-(upper|lower)(?:-(20\d{2})(?:-|$))?/i);
  const gradeNames = ['', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级'];
  const grade = book.grade || (match ? gradeNames[Number(match[1])] : '');
  const volume = book.volume || (match ? (match[2].toLowerCase() === 'upper' ? '上册' : '下册') : '');
  const series = book.series || (course.includes('jingtong') ? '精通' : (match ? 'PEP' : ''));
  const year = book.coverApprovalYear || (match ? match[3] : '');
  const parts = [grade, volume, series, year].filter(Boolean);
  return parts.length ? parts.join(' ') : course;
}

function walkFiles(directory, predicate, result = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walkFiles(entryPath, predicate, result);
    else if (entry.isFile() && predicate(entry.name, entryPath)) result.push(entryPath);
  }
  return result;
}

function loadCatalog(assetRoot) {
  const root = fs.realpathSync(assetRoot);
  const books = [];

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const bookRoot = path.join(root, entry.name);
    const audioRoot = path.join(bookRoot, 'audio-batches');
    if (!fs.existsSync(audioRoot) || !fs.statSync(audioRoot).isDirectory()) continue;
    const realAudioRoot = fs.realpathSync(audioRoot);
    if (!isInside(root, realAudioRoot)) throw new Error(`Audio batch directory escapes the asset root: ${audioRoot}`);

    const queueFiles = walkFiles(audioRoot, name => name === 'audio-task-queue.json')
      .filter(filePath => path.basename(path.dirname(filePath)).startsWith('20261021-audio-queue-'))
      .sort();
    const draftFiles = walkFiles(audioRoot, name => /^[a-z0-9-]+-sentences\.json$/i.test(name))
      .sort();
    if (!queueFiles.length || !draftFiles.length) continue;

    const queue = readJson(queueFiles.at(-1));
    const bookId = queue.book?.bookId;
    if (!bookId) throw new Error(`Missing bookId in ${queueFiles.at(-1)}`);
    const taskByItem = new Map(queue.tasks
      .filter(task => task.kind === 'sentence')
      .map(task => [`${task.unitId}|${task.itemId}`, task]));
    const units = new Map();
    const seen = new Set();

    for (const filePath of draftFiles) {
      const draft = readJson(filePath);
      if (draft.bookId !== bookId) continue;
      if (draft.sourceVocabularySha256 !== queue.source.sha256 || draft.reviewStatus !== 'pending-user-review' || draft.publishable !== false) {
        throw new Error(`Draft review metadata is not pending or does not match its source: ${filePath}`);
      }
      for (const sentence of draft.sentences || []) {
        const taskKey = `${draft.unitId}|${sentence.itemId}`;
        const task = taskByItem.get(taskKey);
        if (!task) throw new Error(`Draft item does not match its queue: ${filePath} (${sentence.itemId})`);
        if (task.displayText !== sentence.term || sentence.status !== 'pending-review' || !sentence.english || !sentence.chinese) {
          throw new Error(`Draft text or item status does not match its queue: ${filePath} (${sentence.itemId})`);
        }
        if (seen.has(taskKey)) throw new Error(`Duplicate draft item: ${bookId} (${taskKey})`);
        seen.add(taskKey);
        if (!units.has(draft.unitId)) {
          const title = /^\d+$/.test(task.unit || '') ? `Unit ${task.unit}` : task.unit;
          units.set(draft.unitId, { id: draft.unitId, title, items: [], reviewNotes: [] });
        }
        const unit = units.get(draft.unitId);
        unit.items.push({
          itemId: sentence.itemId,
          term: sentence.term,
          meaning: task.meaning || '',
          english: sentence.english,
          chinese: sentence.chinese,
          reviewNote: sentence.reviewNote || '',
          sentenceFingerprint: sha256(Buffer.from(JSON.stringify({
            sourceSha256: queue.source.sha256,
            term: sentence.term,
            meaning: task.meaning || '',
            english: sentence.english,
            chinese: sentence.chinese,
            reviewNote: sentence.reviewNote || '',
          }))),
          status: sentence.status
        });
      }
      for (const note of draft.reviewNotes || []) {
        if (units.has(draft.unitId)) units.get(draft.unitId).reviewNotes.push(note);
        else {
          units.set(draft.unitId, { id: draft.unitId, title: queue.tasks.find(task => task.unitId === draft.unitId)?.unit || draft.unitId, items: [], reviewNotes: [note] });
        }
      }
    }

    const revisionRoot=path.join(audioRoot,'sentence-revisions');
    if(fs.existsSync(revisionRoot))for(const name of fs.readdirSync(revisionRoot).filter(n=>n.endsWith('.json')).sort()){
      const revision=readJson(path.join(revisionRoot,name));
      if(revision.format!=='textbook-sentence-revision'||revision.schemaVersion!==1||revision.bookId!==bookId||revision.sourceSha256!==queue.source.sha256)throw Error('例句修订来源不一致：'+name);
      for(const change of revision.changes){
        const item=units.get(change.unitId)?.items.find(i=>i.itemId===change.itemId);
        if(!item||item.sentenceFingerprint!==change.previousFingerprint||typeof change.english!=='string'||!change.english.trim()||typeof change.chinese!=='string'||!change.chinese.trim())throw Error('例句修订基线或文本无效：'+name);
        item.english=change.english;item.chinese=change.chinese;
        item.sentenceFingerprint=sha256(Buffer.from(JSON.stringify({sourceSha256:queue.source.sha256,term:item.term,meaning:item.meaning,english:item.english,chinese:item.chinese,reviewNote:item.reviewNote})));
      }
    }
    const orderedUnits = [...units.values()].sort((left, right) => {
      const leftTask = queue.tasks.find(task => task.unitId === left.id)?.order || 0;
      const rightTask = queue.tasks.find(task => task.unitId === right.id)?.order || 0;
      return leftTask - rightTask || left.id.localeCompare(right.id);
    });
    const label = courseLabel(queue.book, bookId);
    books.push({
      id: bookId,
      label: label || queue.book.title || bookId,
      title: queue.book.title || '',
      course: queue.book.course || entry.name,
      sourceSha256: queue.source.sha256,
      queuePath: queueFiles.at(-1),
      taskCount: taskByItem.size,
      draftCount: seen.size,
      reviewStatus: 'pending-user-review',
      units: orderedUnits.map(({ id, title, items }) => ({ id, title, count: items.length }))
    });
    books.at(-1).draftUnits = orderedUnits;
  }

  books.sort((left, right) => left.label.localeCompare(right.label, 'zh-CN') || left.id.localeCompare(right.id));
  return books;
}

function createReviewServer(assetRoot, options = {}) {
  const root = fs.realpathSync(assetRoot);
  const reviewStatePath = path.resolve(options.reviewStatePath || defaultReviewStatePath);
  const books = loadCatalog(root).map(book => decorateBook(book, emptyReviewState()));
  const reply = (response, status, value) => sendJson(response, status, value);

  async function saveDecision(request, response) {
    try {
      const body = await readRequestJson(request);
      const { bookId, unitId, itemId, decision } = body || {};
      if (typeof bookId !== 'string' || typeof unitId !== 'string' || typeof itemId !== 'string' || !['approved', 'changes-requested', 'reset'].includes(decision)) {
        return reply(response, 400, { error: 'invalid-review-payload' });
      }
      if (!Number.isSafeInteger(body.baseItemRevision) || body.baseItemRevision < 0) {
        return reply(response, 400, { error: 'invalid-review-revision' });
      }
      if (body.note !== undefined && typeof body.note !== 'string') return reply(response, 400, { error: 'invalid-review-note' });
      const note = (body.note || '').trim();
      if (note.length > 2000) return reply(response, 400, { error: 'review-note-too-long' });

      const freshBooks = loadCatalog(root).map(book => decorateBook(book, emptyReviewState()));
      const book = freshBooks.find(candidate => candidate.id === bookId);
      const unit = book?.draftUnits.find(candidate => candidate.id === unitId);
      const item = unit?.items.find(candidate => candidate.itemId === itemId);
      if (!item) return reply(response, 404, { error: 'review-item-not-found' });

      const state = readReviewState(reviewStatePath);
      const current = currentItemDecision(state, book, unit, item);
      if (body.baseItemRevision !== current.reviewRevision) {
        return reply(response, 409, { error: 'review-item-changed', currentReviewRevision: current.reviewRevision, reviewStatus: current.reviewStatus, note: current.reviewNote });
      }

      const revision = state.revision + 1;
      const event = {
        revision,
        createdAt: new Date().toISOString(),
        bookId,
        unitId,
        itemId,
        sourceSha256: book.sourceSha256,
        sentenceFingerprint: item.sentenceFingerprint,
        decision,
        note,
        text: { term: item.term, meaning: item.meaning, english: item.english, chinese: item.chinese, sourceNote: item.reviewNote },
      };
      const nextState = { ...state, revision, events: [...state.events, event] };
      writeReviewState(reviewStatePath, nextState);
      const saved = currentItemDecision(nextState, book, unit, item);
      return reply(response, 200, { ...saved, revision });
    } catch (error) {
      return reply(response, error.statusCode || 500, { error: error.statusCode ? error.message : 'review-save-failed' });
    }
  }

  return http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (request.method === 'POST' && pathname === '/api/review') {
      saveDecision(request, response);
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD, POST', 'Cache-Control': 'no-store' });
      return response.end();
    }

    let body;
    let type;
    try {
      const state = readReviewState(reviewStatePath);
      if (pathname === '/' || pathname === '/textbook-sentence-review.html') {
        body = fs.readFileSync(pagePath);
        type = 'text/html; charset=utf-8';
      } else if (pathname === '/api/books') {
        const publicBooks = books.map(book => {
          const decorated = decorateBook(book, state);
          const { draftUnits, ...publicBook } = decorated;
          return publicBook;
        });
        body = Buffer.from(JSON.stringify(publicBooks));
        type = 'application/json; charset=utf-8';
      } else if (pathname === '/api/unit') {
        const url = new URL(request.url, 'http://127.0.0.1');
        const book = books.find(candidate => candidate.id === url.searchParams.get('bookId'));
        const unit = book?.draftUnits.find(candidate => candidate.id === url.searchParams.get('unitId'));
        if (!unit) {
          response.writeHead(404, { 'Cache-Control': 'no-store' });
          return response.end();
        }
        const decorated = decorateBook(book, state);
        const currentUnit = decorated.draftUnits.find(candidate => candidate.id === unit.id);
        body = Buffer.from(JSON.stringify({
          bookId: book.id,
          unitId: unit.id,
          title: unit.title,
          items: currentUnit.items,
          reviewNotes: unit.reviewNotes,
          reviewSummary: reviewSummary(currentUnit.items),
        }));
        type = 'application/json; charset=utf-8';
      } else {
        response.writeHead(404, { 'Cache-Control': 'no-store' });
        return response.end();
      }
    } catch {
      response.writeHead(500, { 'Cache-Control': 'no-store' });
      return response.end('Review state could not be read.');
    }

    response.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  });
}

if (require.main === module) {
  const rootArg = process.argv.indexOf('--root');
  const root = path.resolve(process.argv[rootArg + 1] || process.env.TEXTBOOK_SENTENCE_REVIEW_ROOT || 'E:/chunk-practice-asset-sources/textbooks');
  const port = Number(process.env.TEXTBOOK_SENTENCE_REVIEW_PORT || 4199);
  const stateArg = process.argv.indexOf('--state');
  const reviewStatePath = path.resolve((stateArg >= 0 && process.argv[stateArg + 1]) || process.env.TEXTBOOK_SENTENCE_REVIEW_STATE || defaultReviewStatePath);
  createReviewServer(root, { reviewStatePath }).listen(port, '127.0.0.1', () => {
    console.log(`Local textbook sentence review: http://127.0.0.1:${port}/`);
    console.log(`Review decisions are stored separately at ${reviewStatePath}`);
  });
}

module.exports = { createReviewServer, loadCatalog, readReviewState, decorateBook };
