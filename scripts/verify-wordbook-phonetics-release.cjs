'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const express = require('../server/node_modules/express');
const { createPublicWordbookVersions } = require('../server/services/public-wordbook-versions');
const { createVocabularyContent } = require('../server/services/vocabulary-content');
const { registerWordbookRoutes } = require('../server/routes/wordbooks');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function verify(root, output) {
  if (fs.existsSync(output)) throw Error('Output must be new');
  const reportPath = path.join(root, 'report.json'), bytes = fs.readFileSync(reportPath), report = JSON.parse(bytes);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'phonetics-release-check-')), publishedRoot = path.join(temp, 'publications');
  fs.mkdirSync(path.join(temp, 'content/vocabulary'), { recursive: true });
  fs.writeFileSync(path.join(temp, 'content/vocabulary/index.json'), JSON.stringify({ schemaVersion: 1, books: [] }));
  const versions = createPublicWordbookVersions({ publishedRoot });
  const samples = [], books = [], candidates = [];
  for (const book of report.books) {
    const dir = hash(JSON.stringify(book.bookId)), base = JSON.parse(fs.readFileSync(book.basePath));
    assert.equal(hash(fs.readFileSync(book.basePath)), book.baseSha256);
    const candidate = JSON.parse(fs.readFileSync(path.join(root, dir, 'candidate.json')));
    const target = path.join(publishedRoot, dir); fs.mkdirSync(path.join(target, 'items'), { recursive: true });
    fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(base.index));
    for (const item of base.items) fs.writeFileSync(path.join(target, 'items', item.itemId.replaceAll(':', '_') + '.json'), JSON.stringify(item));
    if (base.materialRelease) fs.writeFileSync(path.join(target, 'materials.json'), JSON.stringify({ release: base.materialRelease }));
    if (base.teachingRelease) fs.writeFileSync(path.join(target, 'teaching.json'), JSON.stringify(base.teachingRelease));
    const before = versions.current(book.bookId);
    const installed = versions.install(candidate, { reviewId: 'isolated-validation-only', purpose: 'temporary rehearsal, not production publication' });
    versions.activate({ bookId: book.bookId, expectedBaseReleaseId: before.releaseId, releaseId: installed.releaseId, reviewId: 'isolated-validation-only' });
    assert.equal(versions.current(book.bookId).releaseId, installed.releaseId);
    assert.equal(versions.history(book.bookId).length, 2);
    assert.deepEqual(versions.readAny(book.bookId, target, before.releaseId).candidate.items, base.items);
    assert.equal(candidate.index.books[0].structureRevision, base.index.books[0].structureRevision);
    samples.push(candidate.items[0]); candidates.push(candidate);
    books.push({ bookId: book.bookId, items: candidate.items.length, temporaryBaseRelease: before.releaseId, temporaryUpdatedRelease: installed.releaseId });
  }
  // Image files are read-only shared fixtures; all content and publication writes stay in temp.
  fs.symlinkSync(path.resolve(__dirname, '../assets'), path.join(temp, 'assets'), 'junction');
  const content = createVocabularyContent({ appRoot: temp, publishedRoot, versions });
  const actualIndex = content.index();
  assert(report.books.every(book => actualIndex.books.some(row => row.bookId === book.bookId)));
  const app = express(); app.use(express.json({ limit: '1mb' }));
  registerWordbookRoutes({ app, content, auth: { authenticate: (req, res) => res.status(401).json({ error: 'No account access in isolated verification' }) }, study: {} });
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const url = 'http://127.0.0.1:' + server.address().port;
  let checked = 0;
  try {
    for (const candidate of candidates) {
      for (let offset = 0; offset < candidate.items.length; offset += 12) await Promise.all(candidate.items.slice(offset, offset + 12).map(async item => {
        const response = await fetch(url + '/api/vocabulary-items/' + encodeURIComponent(item.itemId) + '?revision=' + item.contentRevision);
        assert.equal(response.status, 200, item.word + ': ' + await response.clone().text());
        assert.equal((await response.json()).phonetic, item.phonetic); checked++;
      }));
    }
  } catch (error) { await new Promise(resolve => server.close(resolve)); throw error; }
  samples.push(...candidates.flatMap(c => c.items).sort((a, b) => b.phonetic.length - a.phonetic.length).slice(0, 5));
  const css = ['/landing/theme.css', '/landing/practice-page.css', '/assets/wordbook-study.css', '/assets/listen-word.css'];
  for (const file of [...css, '/landing/listen-word-view.js']) app.get(file, (req, res) => res.sendFile(path.resolve(__dirname, '..', file.slice(1))));
  app.get('/samples', (req, res) => res.json(samples));
  app.get('/preview', (req, res) => res.type('html').send('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' + css.map(url => '<link rel="stylesheet" href="' + url + '">').join('') + '</head><body class="recognition-page"><main class="learning-workspace wordbook-study"><h1>隔离音标显示检查</h1><button id="run">运行显示检查</button><output id="result">待运行</output><div id="root"></div></main><script src="/landing/listen-word-view.js"></script><script>window.VocabularyCourseAudio={create:()=>({setRate(){},stop(){},destroy(){},play(){throw Error("Audio playback not authorized in fixture")}})};window.runChecks=async()=>{const items=await(await fetch("/samples")).json();let view;const failures=[];for(const item of items){view?.destroy();view=VocabularyListenWordView.create(item,{autoplay:false});document.getElementById("root").replaceChildren(view.element);const el=document.querySelector(".listen-word-pronunciation");if(el.textContent!==item.phonetic||el.getBoundingClientRect().width===0||document.documentElement.scrollWidth>innerWidth)failures.push({word:item.word,phonetic:item.phonetic,scrollWidth:document.documentElement.scrollWidth,width:innerWidth});}const result={width:innerWidth,samples:items.length,failures};document.getElementById("result").textContent=JSON.stringify(result);return result;};document.getElementById("run").onclick=runChecks;</script></body></html>'));
  fs.mkdirSync(output, { recursive: true });
  const result = { reportPath: path.resolve(reportPath), reportSha256: hash(bytes), productionChanged: false, accountAccess: false, temporaryDataDirectory: temp, isolatedUrl: url, books, checkedItems: checked, uiSamples: samples.length, uiStatus: 'pending', audioAccentStatus: 'not-audited: no audio modified or played' };
  fs.writeFileSync(path.join(output, 'validation.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ checkedItems: checked, books: books.length, preview: url + '/preview', output, temp }));
  process.on('SIGINT', () => server.close(() => process.exit(0)));
}
if (require.main === module) verify(...process.argv.slice(2)).catch(error => { console.error(error); process.exitCode = 1; });
