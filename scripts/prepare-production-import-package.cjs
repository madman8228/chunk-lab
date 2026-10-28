'use strict';

const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const draftModel = require('../js/wordbook-draft');
const { assemble } = require('../server/services/textbook-wordbook-package');
const { loadProduction } = require('./lib/textbook-production.cjs');
const { configuration } = require('./serve-textbook-production.cjs');
const { readImportPackage } = require('./lib/system-wordbook-package.cjs');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function targetSpan(item, forms) {
  for(const form of [...new Set([forms[item.itemId]||forms[item.term],item.term].filter(Boolean))]){
   if(typeof form!=='string'||!form.trim())throw Error('目标词形无效');
   let start = item.english.toLowerCase().indexOf(form.toLowerCase());
   while(start>=0&&(/[A-Za-z]/.test(item.english[start-1]||'')||/[A-Za-z]/.test(item.english[start+form.length]||'')))start=item.english.toLowerCase().indexOf(form.toLowerCase(),start+1);
   if(start>=0)return { start, length: form.length, text: item.english.slice(start, start + form.length) };
  }
  throw Error('目标词形需明确绑定：' + item.term + ' / ' + item.english);
}

function bookIdentity(sourceBook,bookId){
 if(sourceBook.bookId!==bookId||sourceBook.publisher!=='人民教育出版社')throw Error('教材来源身份不匹配');
 let meta=sourceBook;
 if(bookId==='textbook-wordbook:primary-pep-grade6-lower-2013-20261015')meta={...meta,schoolStage:'小学',grade:'六年级',volume:'下册',series:'PEP',coverApprovalYear:2013};
 if(/^textbook-wordbook:pep-junior-grade8-(upper|lower)-2024$/.test(bookId))meta={...meta,schoolStage:'初中',grade:'八年级',volume:bookId.includes('-upper-')?'上册':'下册',series:'人教版英语',coverApprovalYear:2024};
 if(!['小学','初中'].includes(meta.schoolStage)||!meta.grade||!['上册','下册','全一册'].includes(meta.volume)||!meta.series||!meta.coverApprovalYear)throw Error('教材学段、年级、系列、册别或审定年份尚未核定');
 const facets={schoolStages:[meta.schoolStage],publisherId:meta.publisher,textbookVersion:'人教版',seriesId:meta.series,edition:String(meta.coverApprovalYear),grades:[meta.grade],volume:meta.volume};
 return {bookId,title:`${meta.schoolStage==='小学'?meta.series+'英语':'人教版英语'} ${meta.grade}${meta.volume}（${meta.coverApprovalYear}）`,catalog:{description:'含已审核原创例句、配图、单词与句子音频。',facets}};
}
function prepare(snapshot, bookId, output, forms, appRoot, catalogFile) {
  if (fs.existsSync(output)) throw Error('请选择新的版本目录');
  const book = snapshot.books.find(row => row.id === bookId);
  if (!book) throw Error('教材未进入生产目录');
  if (snapshot.errors.some(row => row.bookId === bookId)) throw Error('教材有文件核验异常');
  const queue = JSON.parse(fs.readFileSync(book.queuePath, 'utf8'));
  let sourceRecords=[];
  if(queue.source?.sha256){
    const bytes=fs.readFileSync(path.resolve(appRoot,queue.source.path));
    if(hash(bytes)!==queue.source.sha256)throw Error('教材音标来源摘要变化，请重新核验源文件');
    sourceRecords=JSON.parse(bytes).records||[];
  }
  const identity=bookIdentity(queue.book,bookId);
  const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
  const catalogAssets = new Map(catalog.assets.map(row => [row.sha256, row]));
  const units = [], assets = new Map(), blockers = [], targetBindings = [];
  const addAsset = (file, sha256, bytes, extension, role) => {
    const data = fs.readFileSync(file);
    if (hash(data) !== sha256 || data.length !== bytes) throw Error('源文件摘要变化：' + file);
    const name = 'assets/' + sha256 + extension;
    assets.set(name, { file, sha256, bytes, role });
    return name;
  };
  const items = book.items.map(row => {
    try {
      if (row.reviewStatus !== 'approved' || !row.wordAudio || !row.sentenceAudio) throw Error('审核或音频尚未齐全');
      const span = targetSpan(row, forms);
      if (row.imageHashes.length !== 1) throw Error('配图需明确唯一绑定');
      const image = catalogAssets.get(row.imageHashes[0]);
      if (!image || image.bytes >= 20000 || image.width * 9 !== image.height * 16) throw Error('插画不满足16:9及20KB限制');
      const imageUrl = addAsset(path.resolve(appRoot, image.path), image.sha256, image.bytes, '.webp', 'image/webp');
      const audio = sha256 => {
        const asset = snapshot.audioFiles.get(sha256);
        if (!asset) throw Error('缺少音频文件');
        return { url: addAsset(asset.file, sha256, asset.bytes, '.ogg', 'audio/ogg'), mimeType: 'audio/ogg', sha256, bytes: asset.bytes };
      };
      if (!units.some(unit => unit.unitId === row.unitId)) units.push({ unitId: row.unitId, title: row.unit, itemIds: [] });
      units.find(unit => unit.unitId === row.unitId).itemIds.push(row.itemId);
      targetBindings.push({ itemId: row.itemId, term: row.term, target: span.text, sentenceFingerprint: row.sentenceFingerprint });
      const original=sourceRecords.find(record=>(record.entryId||record.itemId)===row.itemId&&record.unitId===row.unitId&&record.term===row.term&&record.meaning===row.meaning);
      const phonetic=original&&(!original.phoneticScope||original.phoneticScope==='term')?original.phonetic?.trim():undefined;
      return { itemId: row.itemId, unitId: row.unitId, word: row.term, meaning: row.meaning,...(phonetic?{phonetic}:{}), scene: row.chinese, translation: row.chinese,
        exercise: draftModel.exercise(row.english.slice(0, span.start) + '[' + span.text + ']' + row.english.slice(span.start + span.length)),
        images: { wide: [imageUrl], mobile: [imageUrl] }, dictation: { audio: audio(row.wordAudio), answers: row.wordDictationAnswers || [row.term] },
        sentenceAudio: { text: row.english, audio: audio(row.sentenceAudio) } };
    } catch (error) { blockers.push({ itemId: row.itemId, term: row.term, english: row.english, reason: error.message }); return null; }
  }).filter(Boolean);
  fs.mkdirSync(output, { recursive: true });
  if (blockers.length) {
    const report = { bookId, status: 'blocked', expected: book.taskCount, ready: items.length, blockers };
    fs.writeFileSync(path.join(output, 'preflight.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    return report;
  }
  if (items.length !== book.taskCount) throw Error('词条数量不一致');
  const sourceBook = queue.book;
  const source = { format: 'textbook-wordbook-package', schemaVersion: 1, book: identity, units,
    drafts: units.map(unit => ({ schemaVersion: 1, book: { ...identity, units: [{ unitId: unit.unitId, title: unit.title }] }, items: items.filter(item => item.unitId === unit.unitId) })) };
  assemble(source);
  for (const draft of source.drafts) { const errors = draftModel.validate(draft, { requireImages: true }); if (errors.length) throw Error(errors.join('；')); }
  fs.mkdirSync(path.join(output, 'assets'));
  const files = [];
  const write = (name, data, role) => { fs.writeFileSync(path.join(output, name), data, { flag: 'wx' }); files.push({ path: name, sha256: hash(data), bytes: data.length, role }); };
  write('import-source.json', Buffer.from(JSON.stringify(source, null, 2) + '\n'), 'textbook-wordbook-import-source');
  write('source-evidence.json', Buffer.from(JSON.stringify({ bookId, sourceBook, sourceSha256: book.sourceSha256, sourcePath: queue.source.path, reviewRevision: snapshot.reviewRevision, targetBindings }, null, 2) + '\n'), 'source-review-bindings');
  for (const [name, asset] of assets) { const data = fs.readFileSync(asset.file); if (hash(data) !== asset.sha256) throw Error('复制前素材变化'); write(name, data, asset.role); }
  const manifest = { format: 'textbook-system-import-draft', schemaVersion: 1, bookId, createdAt: new Date().toISOString(), publishable: false, status: 'draft-needs-content-review', counts: { units: units.length, words: items.length, sentenceAudios: items.length, assets: assets.size }, files };
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'manifest.json'), manifestBytes, { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'checksums.json'), JSON.stringify({ files: [...files, { path: 'manifest.json', sha256: hash(manifestBytes), bytes: manifestBytes.length }] }, null, 2) + '\n', { flag: 'wx' });
  readImportPackage(output);
  return { bookId, output, ...manifest.counts, status: manifest.status };
}

if (require.main === module) {
  const args = process.argv.slice(2), value = name => { const i = args.indexOf(name); if (i < 0 || !args[i + 1]) throw Error('需要 ' + name); return args[i + 1]; };
  try {
    const config = configuration(), snapshot = loadProduction(config), allBindings = JSON.parse(fs.readFileSync(value('--bindings'), 'utf8'));
    const bindings = args.includes('--book') ? allBindings.filter(entry => entry.bookId === value('--book')) : allBindings;
    if (!bindings.length) throw Error('没有匹配的教材打包配置');
    for (const entry of bindings) console.log(JSON.stringify(prepare(snapshot, entry.bookId, path.resolve(entry.output), entry.forms, config.appRoot, config.catalogFile), null, 2));
  } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
module.exports = { targetSpan, prepare,bookIdentity };
