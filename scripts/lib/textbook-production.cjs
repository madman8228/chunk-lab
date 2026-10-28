'use strict';

const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { loadCatalog, readReviewState, decorateBook } = require('../serve-textbook-sentence-review.cjs');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const key = row => row.unitId + '\n' + row.itemId;
const meaningKey=value=>String(value||'').replace(/^\s*[（(][0-9]+[）)]\s*/,'').trim();
function inside(root, relative) {
  const file = path.resolve(root, relative), rel = path.relative(root, file);
  if (!rel || rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) throw Error('素材路径越出批次目录');
  const actual = fs.realpathSync(file), realRoot = fs.realpathSync(root), realRel = path.relative(realRoot, actual);
  if (realRel === '..' || realRel.startsWith('..' + path.sep) || path.isAbsolute(realRel)) throw Error('素材链接越出批次目录');
  return actual;
}
function loadProduction({ appRoot, sourceRoot, packageRoot, dataRoot, catalogFile, reviewFile }) {
  const state = readReviewState(reviewFile), catalog = require('../../server/services/illustration-review-catalog').applyReviewOverrides(read(catalogFile), path.join(dataRoot,'illustration-review.sqlite'));
  const errors = [], audioFiles = new Map(), checked = new Map();
  const plannedBatches=[];
  const plansRoot=path.join(sourceRoot,'production-plans');
  if(fs.existsSync(plansRoot))for(const entry of fs.readdirSync(plansRoot,{withFileTypes:true}).filter(x=>x.isDirectory())){
    const planFile=path.join(plansRoot,entry.name,'production-plan.json');
    if(!fs.existsSync(planFile))continue;
    const plan=read(planFile);
    if(plan.format!=='textbook-audio-production-plan'||plan.schemaVersion!==1||plan.publishable!==false)throw Error('生产计划格式无效');
    for(const batch of plan.batches){
      const root=fs.realpathSync(path.dirname(planFile)),folder=fs.realpathSync(batch.path),relative=path.relative(root,folder);
      if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('生产计划批次越界');
      plannedBatches.push({folder,bookId:batch.bookId});
    }
  }
  function verified(file, sha256, bytes, kind) {
    const cacheKey = file + ':' + sha256 + ':' + bytes + ':' + kind;
    if (checked.has(cacheKey)) return checked.get(cacheKey);
    const data = fs.readFileSync(file);
    const valid = data.length === bytes && hash(data) === sha256 && (kind === 'image'
      ? data.length < 20000 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP'
      : data.toString('ascii', 0, 4) === 'OggS' && data.includes(Buffer.from('OpusHead')));
    checked.set(cacheKey, valid);
    return valid;
  }
  const imageAssets = new Map(catalog.assets.map(a => [a.assetId, a]));
  const books = loadCatalog(sourceRoot).map(raw => {
    const book = decorateBook(raw, state), queue = read(book.queuePath), byKind = { word: new Map(), sentence: new Map() };
    if (hash(fs.readFileSync(queue.source.path)) !== book.sourceSha256) throw Error('词表来源已变化：' + book.label);
    const words = new Map(queue.tasks.filter(t => t.kind === 'word').map(t => [key(t), t]));
    const sentences = new Map(book.draftUnits.flatMap(u => u.items.map(i => [key({ ...i, unitId: u.id }), i])));
    const batchesRoot = path.dirname(path.dirname(book.queuePath));
    const batchFolders=fs.readdirSync(batchesRoot,{withFileTypes:true}).filter(x=>x.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true})).map(entry=>path.join(batchesRoot,entry.name));
    batchFolders.push(...plannedBatches.filter(row=>row.bookId===book.id).map(row=>row.folder));
    for (const batch of batchFolders) {
      const manifestFile = path.join(batch, 'delivery-manifest.json');
      if (!fs.existsSync(manifestFile)) continue;
      const manifest = read(manifestFile);
      if (manifest.bookId !== book.id || manifest.sourceSha256 !== book.sourceSha256 || !['textbook-audio-delivery', 'textbook-sentence-audio-delivery'].includes(manifest.format)) continue;
      for (const row of manifest.records || []) {
        const kind = row.kind || (manifest.format === 'textbook-sentence-audio-delivery' ? 'sentence' : 'word');
        const expected = kind === 'word' ? words.get(key(row))?.spokenText : sentences.get(key(row))?.english;
        if (!expected || expected.trim() !== row.spokenText?.trim() || !byKind[kind]) continue;
        try {
          const file = inside(batch, row.deliveryPath);
          if (!verified(file, row.deliverySha256, row.deliveryBytes, 'audio')) throw Error('音频摘要、大小或 Opus 格式不匹配');
          byKind[kind].set(key(row), { file, sha256: row.deliverySha256, bytes: row.deliveryBytes, row, batch });
          audioFiles.set(row.deliverySha256, { file, bytes: row.deliveryBytes });
        } catch (error) { errors.push({ bookId: book.id, itemId: row.itemId, kind, message: error.message }); }
      }
    }
    const bindings = catalog.bindings.filter(b => b.course === book.course);
    let images = 0;
    for (const binding of bindings) {
      const asset = imageAssets.get(binding.assetId);
      try {
        if (!asset || binding.review !== 'pass' || !verified(inside(appRoot, asset.path), asset.sha256, asset.bytes, 'image')) throw Error('配图未通过审核或文件核验');
        images++;
      } catch (error) { errors.push({ bookId: book.id, itemId: binding.itemId, kind: 'image', message: error.message }); }
    }
    const items = book.draftUnits.flatMap(unit => unit.items.map(item => {
      const identity = key({ ...item, unitId: unit.id }), word = words.get(identity);
      const imageHashes = [...new Set(bindings.filter(b => b.word === item.term && meaningKey(b.meaning) === meaningKey(item.meaning) && b.review === 'pass').map(b => imageAssets.get(b.assetId)?.sha256).filter(Boolean))];
      return { ...item, unitId: unit.id, unit: word?.section || unit.title,
        imageHashes, wordDictationAnswers: word?.dictationAnswers || [item.term], wordAudio: byKind.word.get(identity)?.sha256 || null, sentenceAudio: byKind.sentence.get(identity)?.sha256 || null };
    }));
    const missing = { word: [...words].filter(([id]) => !byKind.word.has(id)).map(([,task]) => task),
      sentence: items.filter(item => item.reviewStatus === 'approved' && !item.sentenceAudio) };
    return { ...book, items, images, wordAudio: byKind.word.size, sentenceAudio: byKind.sentence.size,
      missingAudio: { word: missing.word.length, sentence: missing.sentence.length }, missing, importPackages: [] };
  });
  if (fs.existsSync(packageRoot)) for (const book of books) {
    const dir = path.join(packageRoot, book.id.replace(/^textbook-wordbook:/, ''), 'revisions');
    if (!fs.existsSync(dir)) continue;
    for (const version of fs.readdirSync(dir).sort((a,b) => b.localeCompare(a, undefined, { numeric: true }))) {
      const folder = path.join(dir, version), manifestFile = path.join(folder, 'manifest.json');
      if (!fs.existsSync(manifestFile)) continue;
      const manifest = read(manifestFile);
      if (manifest.format === 'textbook-system-import-draft' && manifest.bookId === book.id) book.importPackages.push({ path: folder, version, counts: manifest.counts });
    }
  }
  const imports = [], importRoot = path.join(dataRoot, 'system-wordbook-imports');
  if (fs.existsSync(importRoot)) for (const dir of fs.readdirSync(importRoot, { withFileTypes: true }).filter(x => x.isDirectory())) {
    const stateFile = path.join(importRoot, dir.name, 'state.json'), packageFile = path.join(importRoot, dir.name, 'package.json');
    if (!fs.existsSync(stateFile) || !fs.existsSync(packageFile)) continue;
    const current = read(stateFile), candidate = read(packageFile), book = candidate.index.books[0];
    imports.push({ importId: current.importId, bookId: book.bookId, title: book.title, status: current.status,
      createdAt: current.createdAt, itemCount: book.itemCount, operation: current.operation || 'publish', reviewed: !!current.review,archived:fs.existsSync(path.join(importRoot,dir.name,'archive.json'))&&read(path.join(importRoot,dir.name,'archive.json')).active===true,
      href: 'http://127.0.0.1:8787/content-studio.html?view=system-wordbooks&importId=' + encodeURIComponent(current.importId) });
  }
  imports.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const publishedRoot = path.join(dataRoot, 'wordbook-publications');
  const publications = fs.existsSync(publishedRoot) ? require('../../server/services/public-wordbook-versions').createPublicWordbookVersions({ publishedRoot }).publishedBooks().map(x => ({ bookId: x.book.bookId, title: x.book.title, items: x.book.itemCount, releaseId: x.releaseId })) : [];
  const currentImports=new Set(),publishedIds=new Set(publications.map(row=>row.bookId));
  for(const row of imports){row.historicalDraft=row.archived||row.status!=='published'&&row.operation!=='update'&&publishedIds.has(row.bookId)||currentImports.has(row.bookId);if(!row.historicalDraft)currentImports.add(row.bookId);}
  const imageOnly = [...new Set(catalog.bindings.map(b => b.course))].filter(course => !books.some(b => b.course === course)).map(course => ({ course, images: catalog.bindings.filter(b => b.course === course).length }));
  return { format: 'textbook-production-status', schemaVersion: 1, generatedAt: new Date().toISOString(), reviewRevision: state.revision,
    books, imports, publications, imageOnly, errors, audioFiles,
    totals: { books: books.length, words: books.reduce((n,b) => n+b.taskCount,0),
      approvedSentences: books.reduce((n,b) => n+b.reviewSummary.approved,0),
      pendingSentences: books.reduce((n,b) => n+b.reviewSummary.pending,0),
      wordAudio: books.reduce((n,b) => n+b.wordAudio,0), sentenceAudio: books.reduce((n,b) => n+b.sentenceAudio,0),
      eligibleAudio: books.reduce((n,b) => n+b.missingAudio.word+b.missingAudio.sentence,0) } };
}
function publicStatus(snapshot) {
  return { ...snapshot, audioFiles: undefined, books: snapshot.books.map(({ draftUnits, missing, items, queuePath, ...book }) => book) };
}
function prepareAudioPlan(snapshot, output) {
  if (fs.existsSync(output)) throw Error('请选择新的生产批次目录');
  fs.mkdirSync(output, { recursive: true });
  const plan = { format: 'textbook-audio-production-plan', schemaVersion: 1, createdAt: new Date().toISOString(), reviewRevision: snapshot.reviewRevision,
    publishable: false, counts: { ...snapshot.totals }, batches: [] };
  for (const book of snapshot.books) {
    if (!book.missingAudio.word && !book.missingAudio.sentence) continue;
    if (snapshot.errors.some(e => e.bookId === book.id && ['word','sentence'].includes(e.kind))) throw Error('请先处理此教材的音频核验异常：' + book.label);
    const queue = read(book.queuePath), byKey = new Map(queue.tasks.map(task => [task.kind + '\n' + key(task), task]));
    for (const kind of ['word', 'sentence']) {
      const pending = book.missing[kind];
      if (!pending.length) continue;
      const derived = structuredClone(queue);
      derived.tasks = pending.map(item => {
        const original = byKey.get(kind + '\n' + key(item));
        if (!original) throw Error('无法匹配音频任务');
        const task = { ...original, status: 'ready' };
        if (kind === 'sentence') {
          task.spokenText = item.english.trim();
          task.inputFingerprint = hash(Buffer.from(JSON.stringify({ sourceSha256: book.sourceSha256, taskId: task.taskId, sentenceFingerprint: item.sentenceFingerprint, spokenText: task.spokenText })));
        }
        return task;
      });
      derived.approvals = kind === 'sentence' ? book.draftUnits.map(unit => ({ format: 'textbook-sentence-text-approval', schemaVersion: 1, status: 'user-approved',
        confirmationSource: 'hash-bound-review-events', bookId: book.id, unitId: unit.id, sourceVocabularySha256: book.sourceSha256,
        approvedItemIds: pending.filter(item => item.unitId === unit.id).map(item => item.itemId),
        reviewedItems: pending.filter(item => item.unitId === unit.id).map(item => ({ itemId: item.itemId, sentenceFingerprint: item.sentenceFingerprint, reviewRevision: item.reviewRevision })) })) : [];
      derived.counts = { wordTasks: kind === 'word' ? pending.length : 0, sentenceTasks: kind === 'sentence' ? pending.length : 0, ready: kind === 'word' ? pending.length : 0, sentenceReady: kind === 'sentence' ? pending.length : 0, pendingFinalText: 0 };
      const batch = path.join(output, book.id.replace(/^textbook-wordbook:/,''), kind);
      fs.mkdirSync(batch, { recursive: true });
      fs.writeFileSync(path.join(batch, 'audio-task-queue.json'), JSON.stringify(derived,null,2)+'\n', { flag:'wx' });
      plan.batches.push({ bookId: book.id, kind, count: pending.length, path: batch });
    }
  }
  fs.writeFileSync(path.join(output, 'production-plan.json'), JSON.stringify(plan,null,2)+'\n', { flag:'wx' });
  return plan;
}
module.exports = { loadProduction, publicStatus, prepareAudioPlan,meaningKey };
