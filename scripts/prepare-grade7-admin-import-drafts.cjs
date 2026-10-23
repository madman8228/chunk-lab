'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const draftModel = require('../js/wordbook-draft');
const textbookModel = require('../server/services/textbook-wordbook-package');
const { unitTitles } = require('./lib/textbook-unit-titles.cjs');

const assetStore = 'E:/chunk-practice-assets';
const grades = ['upper', 'lower'];
const exceptions = new Map([
  ['goose', 'geese'], ['would (’d) like to', "We'd like to"], ['re (email)', 'Re:'], ['a lot of / lots of', 'lots of'],
  ['at the back (of)', 'at the back of'], ['help sb with', 'help me with'], ['work out', 'worked out'],
  ['fall in love with', 'fell in love with'], ['get dressed', 'gets dressed'], ['go to bed', 'goes to bed'], ['blow out', 'blew out'],
  ['not ... at all', 'not scary at all'], ["make sb's/the bed", 'make my bed'], ['belong to', 'belongs to'],
  ['What about ...?', 'What about'], ['go with', 'goes well with'], ['too ... to', 'too hot to'], ['call back', 'call you back'],
  ['drop off', 'drop us off'], ['stay in', 'stayed in'], ['feel like', 'feels like'], ['make progress', 'made progress'],
  ['run after', 'ran after'], ['try on', 'tried on'], ['from ... to ...', 'from the museum to the river'], ['teach', 'taught'],
  ['go away', 'went away'], ['search for', 'searched for'], ['lay', 'laid'], ["to sb's surprise", 'To our surprise'],
  ['come out', 'came out'], ['make a promise', 'made a promise'], ['set ... free', 'set the small fish free'],
  ['succeed in doing sth', 'succeeded in finding']
]);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const safe = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

async function main() {
  const prepared = [];
  const decisions = readJson('output/textbook-sentence-review/review-decisions.json');
  for (const grade of grades) {
    const shortBook = `pep-junior-grade7-${grade}-2024`;
    const course = `people-grade7-${grade}-2024-20261015`;
    const bookId = `textbook-wordbook:${shortBook}`;
    const revision = path.join(assetStore, 'textbooks', shortBook, 'revisions', '20261022-v1');
    const output = path.join(assetStore, 'textbooks', shortBook, 'revisions', '20261022-admin-import-v1');
    if (fs.existsSync(output)) throw Error('Refusing to overwrite existing import draft: ' + output);
    const candidate = readJson(path.join(revision, 'course-candidate.json'));
    const extraction = readJson(`output/textbook-extractions/${course}/extracted-vocabulary.json`);
    const titleForSection = unitTitles(readJson(`docs/source-materials/people-grade7-${grade}-2024.json`));
    const latest = new Map();
    for (const event of decisions.events) if (event.bookId === bookId) latest.set(event.itemId, event);
    const candidateItems = new Map(candidate.items.map(item => [item.itemId, item]));
    const unitsMap = new Map();
    const sourceItems = [];
    for (const record of extraction.records) {
      const approved = latest.get(record.entryId);
      const packaged = candidateItems.get(record.entryId);
      if (!approved || approved.decision !== 'approved' || !approved.text?.english || !approved.text?.chinese || !packaged) throw Error('Missing approved sentence or candidate binding: ' + record.entryId);
      const english = approved.text.english;
      const expected = [exceptions.get(record.term), record.term].filter(Boolean);
      const found = expected.map(form => ({ form, start: english.toLocaleLowerCase().indexOf(form.toLocaleLowerCase()) })).find(row => row.start >= 0);
      const start = found?.start ?? -1;
      if (start < 0) throw Error(`Target form not found: ${record.term} => ${expected}: ${english}`);
      const target = english.slice(start, start + found.form.length);
      const cloze = english.slice(0, start) + '[' + target + ']' + english.slice(start + target.length);
      const unit = unitsMap.get(record.unitId) || { unitId: record.unitId, title: titleForSection(record.section), itemIds: [] };
      unit.itemIds.push(record.entryId);
      unitsMap.set(record.unitId, unit);
      const name = safe(record.entryId);
      const imageName = `${name}-image.webp`, wordAudioName = `${name}-word.ogg`, sentenceAudioName = `${name}-sentence.ogg`;
      const assetRoot = revision;
      const copySources = [
        { source: path.join(assetRoot, packaged.illustration.path), filename: imageName, mimeType: 'image/webp', sha256: packaged.illustration.sha256, bytes: packaged.illustration.bytes },
        { source: path.join(assetRoot, packaged.wordAudio.path), filename: wordAudioName, mimeType: 'audio/ogg', sha256: packaged.wordAudio.sha256, bytes: packaged.wordAudio.bytes },
        { source: path.join(assetRoot, packaged.sentenceAudio.path), filename: sentenceAudioName, mimeType: 'audio/ogg', sha256: packaged.sentenceAudio.sha256, bytes: packaged.sentenceAudio.bytes }
      ];
      sourceItems.push({ item: {
        itemId: record.entryId, unitId: record.unitId, word: record.term, meaning: record.meaning,
        scene: approved.text.chinese, translation: approved.text.chinese,
        exercise: draftModel.exercise(cloze),
        images: { wide: [`assets/${imageName}`], mobile: [`assets/${imageName}`] },
        dictation: { audio: { url: `assets/${wordAudioName}`, mimeType: 'audio/ogg', sha256: packaged.wordAudio.sha256, bytes: packaged.wordAudio.bytes }, answers: [record.term] },
        sentenceAudio: { text: english, audio: { url: `assets/${sentenceAudioName}`, mimeType: 'audio/ogg', sha256: packaged.sentenceAudio.sha256, bytes: packaged.sentenceAudio.bytes } }
      }, copySources });
    }
    const upper = grade === 'upper';
    const facets = { schoolStages: ['初中'], publisherId: '人民教育出版社', textbookVersion: '人教版', seriesId: '人教版英语', edition: '2024', grades: ['七年级'], volume: upper ? '上册' : '下册' };
    const title = `人教版英语 七年级${upper ? '上' : '下'}册（2024）`;
    const units = [...unitsMap.values()];
    const book = { bookId, title, catalog: { description: '基于已核定教材词条，含审核例句、单词与句子音频及配图。', facets } };
    const packageSource = { format: 'textbook-wordbook-package', schemaVersion: 1, book,
      units: units.map(({ unitId, title, itemIds }) => ({ unitId, title, itemIds })),
      drafts: units.map(unit => ({ schemaVersion: 1,
        book: { ...book, units: [{ unitId: unit.unitId, title: unit.title }] },
        items: sourceItems.filter(row => row.item.unitId === unit.unitId).map(row => row.item)
      })) };
    const assembled = textbookModel.assemble(packageSource);
    for (const draft of packageSource.drafts) {
      const errors = draftModel.validate(draft, { requireImages: true });
      if (errors.length) throw Error(bookId + ' draft validation: ' + errors.slice(0, 8).join('；'));
    }
    prepared.push({ grade, bookId, output, packageSource, items: sourceItems, counts: { units: units.length, words: sourceItems.length, sentenceAudios: sourceItems.length } });
    if (assembled.items.length !== extraction.records.length) throw Error('Assembled item count mismatch: ' + bookId);
  }

  for (const entry of prepared) {
    fs.mkdirSync(path.join(entry.output, 'assets'), { recursive: true });
    const payload = Buffer.from(JSON.stringify(entry.packageSource, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(entry.output, 'import-source.json'), payload, { flag: 'wx' });
    const assets = new Map();
    for (const row of entry.items) for (const asset of row.copySources) {
      const prior = assets.get(asset.filename);
      if (prior && prior.sha256 !== asset.sha256) throw Error('Import asset filename collision: ' + asset.filename);
      assets.set(asset.filename, asset);
    }
    const manifestFiles = [{ path: 'import-source.json', sha256: hash(payload), bytes: payload.length, role: 'textbook-wordbook-import-source' }];
    for (const asset of assets.values()) {
      const bytes = fs.readFileSync(asset.source);
      if (bytes.length !== asset.bytes || hash(bytes) !== asset.sha256) throw Error('Source asset changed: ' + asset.source);
      fs.writeFileSync(path.join(entry.output, 'assets', asset.filename), bytes, { flag: 'wx' });
      manifestFiles.push({ path: 'assets/' + asset.filename, sha256: asset.sha256, bytes: asset.bytes, role: asset.mimeType });
    }
    const metadata = { format: 'textbook-system-import-draft', schemaVersion: 1, bookId: entry.bookId, createdAt: new Date().toISOString(),
      status: 'draft-needs-content-review', publishable: false,
      warning: '例句与译文来自已审核文本；scene 暂以中文例句占位，词汇填空由例句中的目标词形生成，须在系统课程审核中复核后再发布。',
      counts: { ...entry.counts, assets: assets.size }, files: manifestFiles.sort((a, b) => a.path.localeCompare(b.path)) };
    const manifest = Buffer.from(JSON.stringify(metadata, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(entry.output, 'manifest.json'), manifest, { flag: 'wx' });
    const checksums = { format: 'textbook-system-import-draft-checksums', schemaVersion: 1,
      files: [...manifestFiles, { path: 'manifest.json', sha256: hash(manifest), bytes: manifest.length }].sort((a, b) => a.path.localeCompare(b.path)) };
    fs.writeFileSync(path.join(entry.output, 'checksums.json'), JSON.stringify(checksums, null, 2), { flag: 'wx' });
    const totalBytes = checksums.files.reduce((sum, file) => sum + file.bytes, 0);
    console.log(JSON.stringify({ draft: entry.output, bookId: entry.bookId, ...metadata.counts, sourceJsonBytes: payload.length, totalBytes, publishable: false }, null, 2));
  }
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
