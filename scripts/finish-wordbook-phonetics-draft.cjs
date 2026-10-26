'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const key = word => word.toLowerCase().replace(/[’‘]/g, "'").replace(/[!?.,]+$/g, '').replace(/\s+/g, ' ').trim();
function authored(text) {
  const entries = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [word, ipa] = line.split('\t');
    if (!word || !ipa || entries.has(key(word))) throw Error('Invalid/duplicate authored entry: ' + word);
    entries.set(key(word), ipa);
  }
  return entries;
}
// Convert legacy dictionary symbol conventions only for NEW supplements.
// No source textbook transcription is passed through this conversion.
function modernize(raw, word) {
  let ipa = raw.trim().replaceAll('ә', 'ə').replaceAll('є', 'e').replace(/[εɛ]/g, 'e').replaceAll('^', 'ɡ').replaceAll('g', 'ɡ')
    .replaceAll(':', 'ː').replaceAll("'", 'ˈ').replace(/,\s+/g, '; ').replaceAll(',', 'ˌ');
  ipa = ipa.replaceAll('əː', 'ɜː').replaceAll('ɒː', 'ɔː').replaceAll('aː', 'ɑː').replaceAll('oː', 'ɔː').replaceAll('əu', 'əʊ').replaceAll('ei', 'eɪ').replaceAll('ai', 'aɪ').replaceAll('au', 'aʊ').replaceAll('ɔi', 'ɔɪ').replaceAll('oi', 'ɔɪ');
  ipa = ipa.replace(/i(?!ː)/g, 'ɪ').replace(/u(?!ː)/g, 'ʊ').replace(/ɔ(?!ː|ɪ)/g, 'ɒ');
  if (/y$|ie$|ee$/i.test(word)) ipa = ipa.replace(/(?<![aeɔ])ɪ$/u, 'i');
  if (/r$|re$/i.test(word) && /ə$|ɜː$|ɑː$|ɔː$/u.test(ipa)) ipa += '(r)';
  ipa = ipa.replace(/hw/g, 'w');
  if (!/^[a-zɑɒæəɜɪʊɔʌɡʃʒθðŋːˈˌ().;\sɪʊ]+$/u.test(ipa)) return null;
  if (/ɝ|ɚ|oʊ|ɐ/u.test(ipa)) return null;
  return ipa;
}
function choose(item, source, manual) {
  const normalized = key(item.word), meaning = item.meaning || '';
  let ipa = manual.get(normalized), method = 'authored-whole-entry';
  if (normalized === 'read' && /过去/.test(meaning)) ipa = 'red';
  if (normalized === 'lead' && /铅/.test(meaning)) ipa = 'led';
  if (normalized === 'use' && !/使用|用；|利用|运用/.test(meaning)) ipa = 'juːs';
  if (normalized === 'close' && /亲密|近的|接近/.test(meaning)) ipa = 'kləʊs';
  if (normalized === 'record' && /记录|唱片/.test(meaning) && !/录制|录音/.test(meaning)) { ipa = 'ˈrekɔːd; rɪˈkɔːd'; }
  if (!ipa) { const entry = source.get(normalized); if (entry?.phonetic) { ipa = modernize(entry.phonetic, item.word); method = 'whole-dictionary-entry-legacy-notation-converted'; } }
  if (!ipa) return { pending: true, reason: 'No reliable whole-entry transcription; never assembled token by token' };
  const risks = [];
  if (method.startsWith('whole-dictionary')) risks.push('dictionary-dialect-and-sense-review');
  if (/\s/.test(normalized)) risks.push('phrase-stress-and-weak-form-review');
  if (/^[A-Z]/.test(item.word) && !/^(Good|Here|You|Thank|Nice|Happy|Be|I)(\b|')/.test(item.word)) risks.push('proper-name-or-initialism-review');
  if (ipa.includes(';')) risks.push('alternative-readings-review');
  if (method.startsWith('whole-dictionary') && (ipa.match(/ˈ/g) || []).length > 1) risks.push('multiple-primary-stress-review');
  const provisionalName = risks.includes('proper-name-or-initialism-review') && method === 'authored-whole-entry';
  if (provisionalName) risks.push('unverified-english-name-adaptation-not-official-pronunciation');
  return { phonetic: '/' + ipa + '/', method, risks, status: provisionalName ? 'provisional-name-candidate-not-verified' : 'supplement-draft-pending-content-review', releaseEligible: false };
}
function finish(input, sources, editorial, output) {
  if (fs.existsSync(output)) throw Error('Output must be new');
  const reportBytes = fs.readFileSync(path.join(input, 'report.json')), report = JSON.parse(reportBytes);
  const sourceBytes = fs.readFileSync(path.join(sources, 'source.json')), dictionary = JSON.parse(sourceBytes);
  if (hash(fs.readFileSync(path.join(sources, 'ecdict.csv'))) !== dictionary.sha256) throw Error('Dictionary hash mismatch');
  if (hash(reportBytes) !== dictionary.inputSha256) throw Error('Dictionary target changed');
  const dictionaryMap = new Map(dictionary.entries.map(row => [key(row.word), row]));
  const manualBytes = fs.readFileSync(editorial), manual = authored(manualBytes.toString('utf8'));
  const books = [], packages = [];
  for (const book of report.books) {
    const dir = hash(JSON.stringify(book.bookId)), basePath = path.join(input, dir, 'candidate.json'), baseBytes = fs.readFileSync(basePath);
    const candidate = JSON.parse(baseBytes), changes = [], pending = [];
    for (const row of book.pending) {
      const item = candidate.items.find(item => item.itemId === row.itemId);
      if (!item || item.phonetic || item.word !== row.word || item.meaning !== row.meaning) throw Error('Pending identity mismatch');
      const result = choose(item, dictionaryMap, manual);
      if (result.pending) { pending.push({ ...row, reason: result.reason }); continue; }
      item.phonetic = result.phonetic;
      const { contentRevision, ...body } = item;
      item.contentRevision = hash(JSON.stringify(body));
      candidate.index.books[0].items.find(ref => ref.itemId === item.itemId).contentRevision = item.contentRevision;
      changes.push({ itemId: item.itemId, word: item.word, meaning: item.meaning, ...result,
        evidence: result.method === 'authored-whole-entry' ? { file: path.resolve(editorial), sha256: hash(manualBytes), kind: 'editorial-not-textbook-quote' } : { dictionary: dictionary.name, commit: dictionary.commit, sourceSha256: dictionary.sha256, raw: dictionaryMap.get(key(item.word)), kind: 'dictionary-not-textbook-quote' } });
    }
    candidate.index.books[0].revision = hash(JSON.stringify(candidate.index.books[0].items));
    candidate.published = false;
    packages.push({ dir, candidate });
    books.push({ bookId: book.bookId, title: book.title, basePath, baseSha256: hash(baseBytes), changes, pending });
  }
  const rows = books.flatMap(book => book.changes), pending = books.flatMap(book => book.pending);
  const totals = { target: report.totals.pending, supplemented: rows.length, unresolved: pending.length, pendingContentReview: rows.length, provisionalNameCandidates: rows.filter(row => row.status === 'provisional-name-candidate-not-verified').length, allItems: report.totals.items, filledTotal: report.totals.items - pending.length, authored: rows.filter(row => row.method === 'authored-whole-entry').length, dictionary: rows.filter(row => row.method !== 'authored-whole-entry').length };
  if (totals.supplemented + totals.unresolved !== totals.target) throw Error('Incomplete target inventory');
  fs.mkdirSync(output, { recursive: true });
  for (const { dir, candidate } of packages) { fs.mkdirSync(path.join(output, dir)); fs.writeFileSync(path.join(output, dir, 'candidate.json'), JSON.stringify(candidate, null, 2) + '\n', { flag: 'wx' }); }
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ published: false, input: path.resolve(input), inputSha256: hash(reportBytes), sources: path.resolve(sources), sourceManifestSha256: hash(sourceBytes), editorial: path.resolve(editorial), editorialSha256: hash(manualBytes), convention: '教材式英式IPA补充草稿，不冒充教材原文。单词按整词词典转写，短语为整条人工补写。所有新增仍待内容审核，不自动发布。', totals, books }, null, 2) + '\n', { flag: 'wx' });
  const escape = value => String(value).replaceAll('|', '\\|');
  fs.writeFileSync(path.join(output, 'review.md'), '# 音标补充草稿\n\n新增内容待审核，不是教材引文；没有声称已完成逐项校准。\n\n' + JSON.stringify(totals) + '\n\n| 课程 | 词项 | 释义 | 音标 | 方法 | 风险 |\n|---|---|---|---|---|---|\n' + books.flatMap(book => book.changes.map(row => '| ' + [book.title, row.word, row.meaning, row.phonetic, row.method, row.risks.join(', ')].map(escape).join(' | ') + ' |')).join('\n') + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'unresolved.json'), JSON.stringify(pending, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'priority-review.md'), '# 高风险音标候选\n\n专名为未经核准的英语适应读法候选，不是本人或官方读法；不能据字段齐全认定校准完成。以下项目均不可自动发布。\n\n| 课程 | 词项 | 候选 | 风险 |\n|---|---|---|---|\n' + books.flatMap(book => book.changes.filter(row => row.risks.some(risk => /proper-name|alternative|multiple-primary/.test(risk))).map(row => '| ' + [book.title, row.word, row.phonetic, row.risks.join(', ')].map(escape).join(' | ') + ' |')).join('\n') + '\n', { flag: 'wx' });
  return totals;
}
if (require.main === module) console.log(JSON.stringify(finish(...process.argv.slice(2)), null, 2));
module.exports = { key, authored, modernize, choose, finish };
