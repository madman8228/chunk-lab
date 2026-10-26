'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const contract = require('../js/vocabulary-course-contract');
const study = require('../js/vocabulary-study.cjs');
const sentenceEngine = require('../landing/sentence-cloze-engine');

const root = path.resolve(__dirname, '..');
const reviewPath = path.join(root, 'output/wordbook-phonetics-en-us-ipa-20261026-v1/review-items.json');
const sourceManifestPath = path.join(root, 'output/wordbook-bilingual-phrase-integration-20261026-v1/manifest.json');
const samplePath = path.join(root, 'output/wordbook-us-ipa-standard-sample-20261026-v1/comparison.json');
const defaultOutput = path.join(root, 'output/wordbook-us-ipa-cambridge-20261026-v1');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const jsonHash = value => hash(Buffer.from(JSON.stringify(value)));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function normalizeDisplay(ipa) {
  return `/${ipa.replace(/\./g, '')}/`;
}

function decodeText(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').trim();
}

function parseCambridgeUs(html) {
  const mainEnd = html.indexOf('<div class="lmt-20 lmb-25 hax"');
  const main = mainEnd < 0 ? html : html.slice(0, mainEnd);
  // Only whole-word pronunciations: sound-by-sound sections also carry US markers.
  const starts = [...main.matchAll(/<span class="primary-pron"><span data-pron-region="US"/g)].map(match => match.index + match[0].indexOf('data-pron-region'));
  const readings = [];
  for (let i = 0; i < starts.length; i += 1) {
    const nextRegion = main.indexOf('data-pron-region="', starts[i] + 24);
    const block = main.slice(starts[i], nextRegion < 0 ? main.length : nextRegion);
    const match = block.match(/class="ipa">([\s\S]*?)<\/span>\//);
    if (!match) continue;
    const ipa = decodeText(match[1]);
    if (ipa && !readings.includes(ipa)) readings.push(ipa);
  }
  return readings;
}

function loadCache(file) {
  const cache = new Map();
  if (!fs.existsSync(file)) return cache;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    cache.set(row.word.toLowerCase(), row);
  }
  return cache;
}

async function lookupWord(word) {
  const slug = word.replace(/['’]/g, '-');
  const url = `https://dictionary.cambridge.org/us/pronunciation/english/${encodeURIComponent(slug)}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; wordbook-pronunciation-review/1.0)' }, signal: AbortSignal.timeout(30000) });
      if (response.status === 404) return { word, url, status: 'not-found', readings: [] };
      if (response.status === 429 || response.status >= 500) {
        await wait(1500 * (attempt + 1));
        continue;
      }
      if (!response.ok) return { word, url, status: `http-${response.status}`, readings: [] };
      const readings = parseCambridgeUs(await response.text());
      return { word, url, status: readings.length === 1 ? 'single-us-reading' : readings.length > 1 ? 'multiple-us-readings' : 'no-us-reading', readings };
    } catch (error) {
      if (attempt === 4) return { word, url, status: 'network-error', readings: [], error: error.message };
      await wait(1000 * (attempt + 1));
    }
  }
  return { word, url, status: 'lookup-failed', readings: [] };
}

async function fillCache(words, cache, cacheFile) {
  const todo = words.filter(word => !cache.has(word.toLowerCase()));
  let cursor = 0;
  let done = 0;
  const workers = Array.from({ length: 6 }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= todo.length) return;
      const row = await lookupWord(todo[index]);
      cache.set(row.word.toLowerCase(), row);
      fs.appendFileSync(cacheFile, `${JSON.stringify(row)}\n`);
      done += 1;
      if (done % 50 === 0 || done === todo.length) console.log(`Cambridge lookups ${done}/${todo.length}`);
      await wait(250);
    }
  });
  await Promise.all(workers);
}

function buildPackages({ output, review, sourceManifest, cache }) {
  const changesByBook = new Map();
  const unresolved = [];
  for (const row of review.items) {
    if (row.status !== 'candidate-pending-content-review') continue;
    const source = cache.get(row.word.toLowerCase());
    if (!source || source.status !== 'single-us-reading') {
      unresolved.push({ bookId: row.bookId, itemId: row.itemId, word: row.word, ipaDictUS: row.candidate, status: source?.status || 'missing-lookup' });
      continue;
    }
    const ipa = normalizeDisplay(source.readings[0]);
    if (!changesByBook.has(row.bookId)) changesByBook.set(row.bookId, []);
    changesByBook.get(row.bookId).push({
      bookId: row.bookId, itemId: row.itemId, word: row.word, meaning: row.meaning,
      ipaDictUS: row.candidate, cambridgeUsRaw: `/${source.readings[0]}/`, cambridgeUsDisplay: ipa,
      sourceURL: source.url, sourceSection: 'Cambridge Advanced Learner’s Dictionary · US pronunciation',
      normalization: 'Remove syllable boundary dots only', comparisonStatus: row.candidate === ipa ? 'same-after-dot-removal' : 'differs-review-flags'
    });
  }

  const packageRows = [];
  const changes = [];
  for (const sourceBook of sourceManifest.books) {
    const sourcePath = path.resolve(path.dirname(sourceManifest.path), sourceBook.path);
    const sourceBytes = fs.readFileSync(sourcePath);
    const sourceSha256 = hash(sourceBytes);
    const candidate = JSON.parse(sourceBytes.toString('utf8'));
    const additions = changesByBook.get(sourceBook.bookId) || [];
    for (const change of additions) {
      const item = candidate.items.find(value => value.itemId === change.itemId);
      if (!item || item.word !== change.word || item.meaning !== change.meaning) throw Error(`Item identity mismatch: ${change.itemId}`);
      if (item.phonetics?.['en-US']) throw Error(`Refusing to overwrite existing US IPA: ${change.itemId}`);
      const oldRevision = item.contentRevision;
      item.phonetics = { ...(item.phonetics || {}), 'en-US': change.cambridgeUsDisplay };
      const { contentRevision, ...body } = item;
      item.contentRevision = jsonHash(body);
      const indexRef = candidate.index.books[0].items.find(value => value.itemId === change.itemId);
      if (!indexRef) throw Error(`Missing index reference: ${change.itemId}`);
      indexRef.contentRevision = item.contentRevision;
      changes.push({ ...change, sourceContentRevision: oldRevision, contentRevision: item.contentRevision });
    }
    candidate.index.books[0].revision = jsonHash(candidate.index.books[0].items);
    study.validateIndex(candidate.index);
    for (const item of candidate.items) contract.validateLearning(item, sentenceEngine);
    candidate.published = false;
    const directory = path.join(output, 'candidate-packages', path.basename(path.dirname(sourcePath)));
    fs.mkdirSync(directory, { recursive: true });
    const relativePath = path.relative(output, path.join(directory, 'candidate.json')).replace(/\\/g, '/');
    const bytes = Buffer.from(`${JSON.stringify(candidate, null, 2)}\n`);
    fs.writeFileSync(path.join(directory, 'candidate.json'), bytes, { flag: 'wx' });
    packageRows.push({ bookId: sourceBook.bookId, title: sourceBook.title, path: relativePath, items: candidate.items.length, additions: additions.length, revision: candidate.index.books[0].revision, sourcePath: sourceBook.path, sourceSha256, candidateSha256: hash(bytes) });
  }

  const lookupRows = [...cache.values()].sort((a, b) => a.word.localeCompare(b.word));
  const report = {
    format: 'wordbook-cambridge-us-ipa-integration-report', schemaVersion: 1, published: false,
    status: 'draft-pending-owner-review', lookupCount: lookupRows.length,
    summary: {
      sourceItems: review.items.filter(row => row.status === 'candidate-pending-content-review').length,
      uniqueWordsLookedUp: lookupRows.length,
      itemsAddedFromSingleCambridgeUsReading: changes.length,
      unresolvedItems: unresolved.length,
      lookupStatuses: Object.fromEntries([...new Set(lookupRows.map(row => row.status))].sort().map(status => [status, lookupRows.filter(row => row.status === status).length])),
      ipaDictExactMatchesAfterDotRemoval: changes.filter(row => row.comparisonStatus === 'same-after-dot-removal').length,
      preservedPreviouslyApprovedUsPhraseEntries: 5
    },
    convention: { source: 'Cambridge Advanced Learner’s Dictionary US pronunciation', display: 'Cambridge transcription with syllable dots removed; all other symbols preserved', ipaDictRole: 'comparison only' },
    changesPath: 'changes.json', unresolvedPath: 'unresolved.json', lookupsPath: 'lookups.json',
    sourceManifestSha256: hash(fs.readFileSync(sourceManifest.path)),
    reviewItemsSha256: hash(fs.readFileSync(review.sourcePath)),
    books: packageRows
  };
  fs.writeFileSync(path.join(output, 'changes.json'), `${JSON.stringify(changes, null, 2)}\n`, { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'unresolved.json'), `${JSON.stringify(unresolved, null, 2)}\n`, { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'lookups.json'), `${JSON.stringify(lookupRows, null, 2)}\n`, { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  const md = [
    '# Cambridge 美式音标候选集成审核稿', '',
    '- 状态：本地审核草稿，未发布。',
    `- 处理范围：${report.summary.sourceItems} 条单一读音、全小写单词候选；按 ${report.summary.uniqueWordsLookedUp} 个不同词形查询剑桥美式发音。`,
    `- 单一剑桥美式读音并入候选：${changes.length} 条；需进一步核对或未找到：${unresolved.length} 条。`,
    '- 规则：以剑桥美式原标为准，仅移除音节分隔点；IPA-DICT 只保留在对照字段。',
    '- 不自动处理多读音、大小写/专名疑点及无精确单词条目的项目。',
    '- 每条候选含课程词条 ID、两套音标、剑桥来源链接及修订号，详见 `changes.json`。',
    '- 未匹配项及剑桥返回多条美式读音的项目见 `unresolved.json`；逐词查词结果见 `lookups.json`。',
    '- 20 本候选词书保留原英式音标及已核准的 5 条美式短语音标；账户记录和在线服务未修改。', ''
  ];
  fs.writeFileSync(path.join(output, 'README.md'), `${md.join('\n')}\n`, { flag: 'wx' });
  return report;
}

async function run({ outputPath = defaultOutput } = {}) {
  const output = path.resolve(outputPath);
  const reviewBytes = fs.readFileSync(reviewPath);
  const review = JSON.parse(reviewBytes.toString('utf8'));
  review.sourcePath = reviewPath;
  const sourceManifest = JSON.parse(fs.readFileSync(sourceManifestPath, 'utf8'));
  sourceManifest.path = sourceManifestPath;
  const eligible = review.items.filter(row => row.status === 'candidate-pending-content-review');
  const words = [...new Map(eligible.map(row => [row.word.toLowerCase(), row.word])).values()].sort((a, b) => a.localeCompare(b));
  if (eligible.length !== 2592 || words.length !== 1742 || sourceManifest.books.length !== 20) throw Error(`Unexpected source inventory: ${eligible.length} eligible rows, ${words.length} unique words, ${sourceManifest.books.length} books`);
  const statePath = path.join(output, 'run-state.json');
  const cachePath = path.join(output, 'lookup-cache.jsonl');
  if (!fs.existsSync(output)) {
    fs.mkdirSync(output, { recursive: false });
    fs.writeFileSync(statePath, JSON.stringify({ status: 'in-progress', sourceReviewItemsSha256: hash(reviewBytes), sourceManifestSha256: hash(fs.readFileSync(sourceManifestPath)), eligibleRows: eligible.length, uniqueWords: words.length }, null, 2) + '\n', { flag: 'wx' });
    fs.writeFileSync(cachePath, '', { flag: 'wx' });
    const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
    for (const row of sample.entries) fs.appendFileSync(cachePath, `${JSON.stringify({ word: row.word, url: row.sourceUrl, status: 'single-us-reading', readings: [row.cambridgeUsRaw.slice(1, -1)] })}\n`);
  }
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  if (state.sourceReviewItemsSha256 !== hash(reviewBytes) || state.sourceManifestSha256 !== hash(fs.readFileSync(sourceManifestPath))) throw Error('Resume state does not match the current source files');
  if (state.status === 'complete') return JSON.parse(fs.readFileSync(path.join(output, 'report.json'), 'utf8'));
  const cache = loadCache(cachePath);
  console.log(`Unique words: ${words.length}; cached: ${cache.size}; remaining: ${words.filter(word => !cache.has(word.toLowerCase())).length}`);
  await fillCache(words, cache, cachePath);
  fs.mkdirSync(path.join(output, 'candidate-packages'), { recursive: true });
  const report = buildPackages({ output, review, sourceManifest, cache });
  state.status = 'complete';
  state.completedAt = new Date().toISOString();
  state.reportSummary = report.summary;
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  return report;
}

if (require.main === module) {
  run().then(report => console.log(JSON.stringify({ output: defaultOutput, ...report.summary, published: false }, null, 2))).catch(error => { console.error(error.stack || error); process.exitCode = 1; });
}

module.exports = { normalizeDisplay, parseCambridgeUs, lookupWord, run, defaultOutput };
