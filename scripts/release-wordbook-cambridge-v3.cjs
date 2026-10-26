'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const { createPublicWordbookVersions } = require('../server/services/public-wordbook-versions');
const { createWordbookPublisher } = require('../server/services/wordbook-publisher');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'output/wordbook-us-ipa-cambridge-20261026-v3');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const jsonHash = value => hash(JSON.stringify(value));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });

async function main() {
  // Course schema additions must ship with a matching offline application bundle.
  require('node:child_process').execFileSync(process.execPath, [path.join(root, 'scripts/gen-sw.js'), '--check'], { cwd: root, stdio: 'pipe' });
  require('../server/loadenv');
  assert.equal(path.resolve(process.env.CHUNKLAB_APP_ROOT || root), root);
  const publishedRoot = path.join(path.resolve(process.env.CHUNKLAB_DATA_DIR || path.join(root, 'server/data')), 'wordbook-publications');
  const output = path.join(root, 'output/wordbook-us-ipa-publication-20261026-v2');
  if (fs.existsSync(output)) throw Error('Publication run exists; inspect its receipts before retrying');
  const approvalFile = path.join(root, 'docs/source-materials/wordbook-cambridge-us-v3-approval-20261026.json');
  const approval = read(approvalFile), report = read(path.join(source, 'report.json'));
  for (const row of [...approval.artifacts, ...approval.books]) assert.equal(hash(fs.readFileSync(row.path)), row.sha256);
  const readiness = read(path.join(root, 'output/wordbook-us-ipa-release-readiness-20261026-v1/readiness.json'));
  assert.equal(readiness.status, 'checks-passed');
  const real = createPublicWordbookVersions({ publishedRoot });
  const entries = [];
  for (const book of report.books) {
    const current = real.current(book.bookId), candidate = read(path.join(source, book.path));
    const originals = new Map(current.candidate.items.map(item => [item.itemId, item]));
    assert.equal(originals.size, candidate.items.length);
    for (const item of candidate.items) {
      const prior = originals.get(item.itemId); assert.ok(prior);
      const strip = value => { const body = structuredClone(value); delete body.contentRevision; delete body.phonetics; if (body.learning?.sentenceAudio) { delete body.learning.sentenceAudio.audioByAccent; delete body.learning.sentenceAudio.revision; } return body; };
      assert.deepEqual(strip(prior), strip(item), item.itemId);
    }
    entries.push({ book, current, candidate });
    console.log('Current version verified: ' + book.bookId);
  }
  fs.mkdirSync(output);
  write(path.join(output, 'authorization.json'), { statement: '发布第三版到系统内置课程', date: '2026-10-26', publishedRoot, accountTarget: null, databaseAccess: false, approvalSha256: hash(fs.readFileSync(approvalFile)) });
  const backup = path.join(output, 'backup'); fs.mkdirSync(backup);
  const backupFiles = [];
  function recordFiles(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw Error('Backup cannot contain links');
      if (entry.isDirectory()) recordFiles(file);
      else backupFiles.push({ path: path.relative(backup, file), sha256: hash(fs.readFileSync(file)) });
    }
  }
  for (const entry of entries) {
    const dir = real.directory(entry.book.bookId);
    fs.cpSync(dir, path.join(backup, path.basename(dir)), { recursive: true, errorOnExist: true, force: false });
  }
  recordFiles(backup);
  for (const row of backupFiles) assert.equal(hash(fs.readFileSync(path.join(backup, row.path))), row.sha256);
  write(path.join(output, 'backup-checksums.json'), backupFiles);
  console.log('Recoverable publication backup verified: ' + backupFiles.length + ' files');

  const assetRows = read(path.join(root, 'output/wordbook-us-ipa-release-readiness-20261026-v1/assets.json'));
  const assetMap = new Map(assetRows.map(row => [row.ref, row]));
  // Include unchanged word-dictation/read-aloud clips in publisher validation too.
  for (const entry of entries) for (const item of entry.candidate.items) {
    for (const activity of [item.learning?.wordDictation, item.learning?.readAloud].filter(Boolean)) {
      for (const clip of [activity.audio, ...Object.values(activity.audioByAccent || {})].filter(Boolean)) {
        if (assetMap.has(clip.url)) continue;
        assert.match(clip.url, /^assets\/[A-Za-z0-9._-]+\.(ogg|wav|mp3)$/);
        const file = path.join(root, clip.url), bytes = fs.readFileSync(file);
        assert.equal(bytes.length, clip.bytes); assert.equal(hash(bytes), clip.sha256);
        const row = { ref: clip.url, path: file, bytes: clip.bytes, sha256: clip.sha256, kind: 'audio' };
        assetMap.set(clip.url, row); assetRows.push(row);
      }
    }
  }
  const readAsset = ref => { const row = assetMap.get(ref); if (!row) throw Error('Asset not reviewed: ' + ref); const bytes = fs.readFileSync(row.path); assert.equal(hash(bytes), row.sha256); return bytes; };
  const content = { publicationDirectory: publishedRoot, index: () => ({ schemaVersion: 1, books: entries.map(entry => entry.current.book) }), invalidate() {} };
  const cachedVersions = { current: id => entries.find(entry => entry.book.bookId === id).current };
  const publisher = createWordbookPublisher({ appRoot: root, content, versions: cachedVersions });
  for (const entry of entries) {
    publisher.validate(entry.candidate, { readAsset, updateBaseReleaseId: entry.current.releaseId });
    console.log('Publisher validation passed: ' + entry.book.bookId);
  }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cambridge-v3-rehearsal-'));
  const trial = createPublicWordbookVersions({ publishedRoot: temp });
  for (const entry of entries) {
    const directory = trial.directory(entry.book.bookId); fs.mkdirSync(path.join(directory, 'items'), { recursive: true });
    write(path.join(directory, 'manifest.json'), entry.current.candidate.index);
    for (const item of entry.current.candidate.items) write(path.join(directory, 'items', item.itemId.replaceAll(':', '_') + '.json'), item);
    const before = trial.current(entry.book.bookId);
    const installed = trial.install(entry.candidate, { reviewId: 'isolated-rehearsal' });
    trial.activate({ bookId: entry.book.bookId, expectedBaseReleaseId: before.releaseId, releaseId: installed.releaseId });
    assert.deepEqual(trial.current(entry.book.bookId).candidate, entry.candidate);
    trial.activate({ bookId: entry.book.bookId, expectedBaseReleaseId: installed.releaseId, releaseId: before.releaseId, action: 'rollback' });
    assert.deepEqual(trial.current(entry.book.bookId).candidate.items, entry.current.candidate.items);
  }
  write(path.join(output, 'rehearsal.json'), { status: 'passed', books: entries.length, temporaryDirectory: temp, installationAndRollbackVerified: true });
  if (!process.argv.includes('--publish')) { console.log('Rehearsal complete; publication not requested'); return; }
  const copied = [];
  for (const row of assetRows) {
    const destination = path.join(root, row.ref);
    if (fs.existsSync(destination)) { assert.equal(hash(fs.readFileSync(destination)), row.sha256); continue; }
    fs.copyFileSync(row.path, destination, fs.constants.COPYFILE_EXCL);
    assert.equal(hash(fs.readFileSync(destination)), row.sha256); copied.push(row.ref);
  }
  write(path.join(output, 'new-assets.json'), copied);
  const completed = [];
  try {
    for (const entry of entries) {
      assert.equal(real.current(entry.book.bookId).releaseId, entry.current.releaseId, 'Current course changed during release');
      const installed = real.install(entry.candidate, { review: { reviewId: 'owner-approved-cambridge-v3-20261026' }, authorization: '发布第三版到系统内置课程', approvalSha256: hash(fs.readFileSync(approvalFile)) });
      real.activate({ bookId: entry.book.bookId, expectedBaseReleaseId: entry.current.releaseId, releaseId: installed.releaseId, reviewId: 'owner-approved-cambridge-v3-20261026' });
      completed.push({ bookId: entry.book.bookId, previousReleaseId: entry.current.releaseId, releaseId: installed.releaseId });
      write(path.join(output, 'receipt-' + jsonHash(entry.book.bookId) + '.json'), completed.at(-1));
      assert.deepEqual(real.current(entry.book.bookId).candidate, entry.candidate);
      console.log('Published and verified: ' + entry.book.bookId);
    }
  } catch (error) {
    const rollbacks = [];
    for (const row of [...completed].reverse()) {
      try { real.activate({ bookId: row.bookId, expectedBaseReleaseId: row.releaseId, releaseId: row.previousReleaseId, action: 'rollback', reviewId: 'failed-batch-recovery' }); rollbacks.push({ bookId: row.bookId, restored: true }); }
      catch (failure) { rollbacks.push({ bookId: row.bookId, restored: false, error: failure.message }); }
    }
    write(path.join(output, 'failure.json'), { error: error.message, rollbacks }); throw error;
  }
  write(path.join(output, 'result.json'), { status: 'published-and-verified', books: completed, items: 4214, usPhonetics: 2576, pending: 21, newAssets: copied.length, backup, accountDataChanged: false, serviceRestarted: false });
  console.log('Publication complete: ' + completed.length + ' built-in courses');
}
if (require.main === module) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
