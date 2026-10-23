'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex').toUpperCase();
const htmlPath = path.join(__dirname, 'grade9-upper-2024-word-review.html');
const emptyState = hashes => ({ format: 'grade9-upper-vocabulary-review-decisions', schemaVersion: 1, revision: 0, hashes, events: [] });
const inside = (root, file) => {
  const relative = path.relative(root, file);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};
function readState(file, hashes) {
  if (!fs.existsSync(file)) return emptyState(hashes);
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (state.format !== 'grade9-upper-vocabulary-review-decisions' || state.schemaVersion !== 1 || !Number.isSafeInteger(state.revision) || !Array.isArray(state.events) || JSON.stringify(state.hashes) !== JSON.stringify(hashes)) {
    throw new Error('Review state does not match the current v3 candidate and source scans');
  }
  return state;
}
function writeState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { flag: 'wx' });
    fs.renameSync(temporary, file);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
}
async function readBody(request, maxBytes = 8192) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body, 'utf8') > maxBytes) throw Object.assign(new Error('Request body too large'), { statusCode: 413 });
  }
  try { return JSON.parse(body); } catch { throw Object.assign(new Error('Invalid JSON'), { statusCode: 400 }); }
}
function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(payload));
}
function parseFindings(markdown) {
  const rows = markdown.split(/\r?\n/).filter(line => line.startsWith('|') && !line.includes('---') && !line.includes('扫描页'));
  return rows.map(line => {
    const fields = line.slice(1, -1).split('|').map(value => value.trim());
    if (fields.length !== 4) throw new Error('Malformed v3 review table row');
    const scanPage = Number(fields[0]);
    if (!Number.isInteger(scanPage) || scanPage < 107 || scanPage > 116) throw new Error('Invalid scan page in v3 review table');
    return { scanPage, unitPage: fields[1], sourceDifference: fields[2], candidate: fields[3] };
  });
}
function decisionFor(state, finding, hashes) {
  const events = state.events.filter(event => event.id === finding.id);
  const current = [...events].reverse().find(event => event.fingerprint === finding.fingerprint && event.draftSha256 === hashes.draftSha256 && event.reviewSha256 === hashes.reviewSha256 && event.scanSha256 === finding.scanSha256);
  return {
    status: current?.decision === 'approved' ? 'approved' : current?.decision === 'changes-requested' ? 'changes-requested' : 'pending',
    note: current?.note || '',
    revision: current?.revision || 0,
    stale: events.length > 0 && !current,
  };
}
function createReviewServer({ draftPath, reviewPath, scanRoot, backupRoot, statePath, pagePath = htmlPath } = {}) {
  const draftFile = path.resolve(draftPath || '');
  const reviewFile = path.resolve(reviewPath || '');
  const sourceDir = fs.realpathSync(scanRoot || '');
  const backupDir = fs.realpathSync(backupRoot || '');
  const stateFile = path.resolve(statePath || '');
  if (!draftPath || !reviewPath || !scanRoot || !backupRoot || !statePath) throw new Error('Draft, review, scan, backup, and state paths are required');
  if (inside(sourceDir, stateFile) || inside(backupDir, stateFile) || stateFile === draftFile || stateFile === reviewFile) throw new Error('Review state must be outside source scans, backups, and candidate documents');
  const draftBytes = fs.readFileSync(draftFile), reviewBytes = fs.readFileSync(reviewFile);
  const draft = JSON.parse(draftBytes.toString('utf8'));
  if (draft.revision !== 'scan-verified-review-v3' || draft.reviewStatus !== 'pending-user-review' || draft.sourceAudit?.approval !== 'not approved') throw new Error('Expected the pending, unapproved v3 candidate');
  const scanEntries = new Map((draft.sourceAudit.suppliedScanPages || []).map(page => [page.page, page]));
  const scans = new Map();
  for (const page of scanEntries.values()) {
    const source = path.resolve(sourceDir, page.file), backup = path.resolve(backupDir, page.file);
    if (!inside(sourceDir, source) || !inside(backupDir, backup)) throw new Error('Scan path leaves its approved root');
    const realSource = fs.realpathSync(source), realBackup = fs.realpathSync(backup);
    if (!inside(sourceDir, realSource) || !inside(backupDir, realBackup)) throw new Error('Scan symlink leaves its approved root');
    const sourceBytes = fs.readFileSync(realSource), backupBytes = fs.readFileSync(realBackup), expected = page.sha256.toUpperCase();
    if (sha256(sourceBytes) !== expected || sha256(backupBytes) !== expected) throw new Error(`Scan or backup hash mismatch: p.${page.page}`);
    scans.set(page.page, { file: page.file, bytes: sourceBytes, sha256: expected });
  }
  if (scans.size !== 10) throw new Error(`Expected 10 verified source scans, found ${scans.size}`);
  const hashes = { draftSha256: sha256(draftBytes), reviewSha256: sha256(reviewBytes), scanManifestSha256: sha256(Buffer.from(JSON.stringify([...scans].map(([page, scan]) => [page, scan.sha256])))) };
  const rows = parseFindings(reviewBytes.toString('utf8'));
  if (rows.length !== 34) throw new Error(`Expected 34 review findings, found ${rows.length}`);
  const findings = rows.map((row, index) => {
    const scan = scans.get(row.scanPage);
    if (!scan) throw new Error(`No verified scan for page ${row.scanPage}`);
    const id = sha256(Buffer.from(`${row.scanPage}\0${row.unitPage}\0${row.sourceDifference}\0${row.candidate}`)).toLowerCase();
    const finding = { ...row, id, scanFile: scan.file, scanSha256: scan.sha256 };
    finding.fingerprint = sha256(Buffer.from(JSON.stringify({ ...finding, draftSha256: hashes.draftSha256, reviewSha256: hashes.reviewSha256 }))).toLowerCase();
    return finding;
  });
  const byId = new Map(findings.map(finding => [finding.id, finding]));
  const replyError = (response, error) => sendJson(response, error.statusCode || 500, { error: error.statusCode ? error.message : 'review-request-failed' });
  async function saveDecision(request, response) {
    try {
      const body = await readBody(request), finding = byId.get(body?.id);
      if (!finding) return sendJson(response, 404, { error: 'review-item-not-found' });
      if (!['approved', 'changes-requested', 'reset'].includes(body.decision)) return sendJson(response, 400, { error: 'invalid-review-decision' });
      if (body.scanReviewed !== true) return sendJson(response, 400, { error: 'source-scan-not-confirmed' });
      if (!Number.isSafeInteger(body.baseRevision) || body.baseRevision < 0) return sendJson(response, 400, { error: 'invalid-review-revision' });
      if (body.note !== undefined && typeof body.note !== 'string') return sendJson(response, 400, { error: 'invalid-review-note' });
      const note = (body.note || '').trim();
      if (note.length > 2000) return sendJson(response, 400, { error: 'review-note-too-long' });
      const state = readState(stateFile, hashes), current = decisionFor(state, finding, hashes);
      if (body.baseRevision !== current.revision) return sendJson(response, 409, { error: 'review-item-changed', currentRevision: current.revision, status: current.status });
      const revision = state.revision + 1;
      const event = { revision, createdAt: new Date().toISOString(), id: finding.id, fingerprint: finding.fingerprint, draftSha256: hashes.draftSha256, reviewSha256: hashes.reviewSha256, scanPage: finding.scanPage, scanSha256: finding.scanSha256, decision: body.decision, note };
      const next = { ...state, revision, hashes, events: [...state.events, event] };
      writeState(stateFile, next);
      return sendJson(response, 200, { ...decisionFor(next, finding, hashes), revision });
    } catch (error) { return replyError(response, error); }
  }
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (request.method === 'POST' && url.pathname === '/api/review') return saveDecision(request, response);
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405, { Allow: 'GET, HEAD, POST' }); return response.end(); }
    if (url.pathname === '/api/items') {
      try {
        const state = readState(stateFile, hashes);
        const items = findings.map(finding => ({ ...finding, ...decisionFor(state, finding, hashes) }));
        const summary = items.reduce((sum, item) => { sum[item.status === 'approved' ? 'approved' : item.status === 'changes-requested' ? 'changesRequested' : 'pending']++; return sum; }, { approved: 0, changesRequested: 0, pending: 0 });
        return sendJson(response, 200, { format: 'grade9-upper-vocabulary-review', revision: draft.revision, itemCount: draft.vocabularyText.split(/\r?\n/).filter(Boolean).length, hashes, summary, items });
      } catch (error) { return replyError(response, error); }
    }
    if (url.pathname.startsWith('/scans/')) {
      const file = path.basename(url.pathname.slice('/scans/'.length)), page = [...scans.values()].find(scan => scan.file === file);
      if (!page) { response.writeHead(404); return response.end(); }
      response.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
      return response.end(request.method === 'HEAD' ? undefined : page.bytes);
    }
    if (url.pathname === '/' || url.pathname === '/grade9-upper-2024-word-review.html') {
      try {
        const page = fs.readFileSync(pagePath);
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" });
        return response.end(request.method === 'HEAD' ? undefined : page);
      } catch { response.writeHead(500); return response.end('Review page unavailable.'); }
    }
    response.writeHead(404); response.end();
  });
  server.reviewInfo = { findings: findings.length, itemCount: draft.vocabularyText.split(/\r?\n/).filter(Boolean).length, statePath: stateFile, hashes };
  return server;
}

if (require.main === module) {
  const args = process.argv.slice(2), value = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
  const project = path.resolve(__dirname, '..');
  const server = createReviewServer({
    draftPath: value('--draft') || path.join(project, 'docs/source-materials/people-grade9-upper-2024-review-v3.json'),
    reviewPath: value('--review') || path.join(project, 'docs/source-materials/people-grade9-upper-2024-review-v3.md'),
    scanRoot: value('--scan-root') || 'E:/chunk-practice-asset-sources/textbooks/pep-junior-grade9-upper-2024/source-scans/20261021-v1',
    backupRoot: value('--backup-root') || 'D:/chunk-practice-backups/pep-grade9-upper-2024-source-pages-20261021',
    statePath: value('--state') || path.join(project, 'output/textbook-wordlist-review/people-grade9-upper-2024-v3-decisions.json'),
  });
  const port = Number(value('--port') || process.env.GRADE9_UPPER_2024_REVIEW_PORT || 4206);
  server.listen(port, '127.0.0.1', () => console.log(JSON.stringify({ url: `http://127.0.0.1:${port}/`, ...server.reviewInfo })));
}

module.exports = { createReviewServer, parseFindings, readState, decisionFor };
