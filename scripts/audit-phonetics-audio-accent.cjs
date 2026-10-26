'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function manifests(root) {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory() && !/^(masters|delivery|prepared|source-images|illustrations|originals|images|tiles|panels)$/i.test(entry.name)) walk(path.join(dir, entry.name));
      else if (entry.isFile() && /^(delivery-manifest|generation-manifest)\.json$/.test(entry.name)) files.push(path.join(dir, entry.name));
    }
  }
  walk(root); return files;
}
function audit(draftRoot, audioRoot, output, additionalManifest) {
  if (fs.existsSync(output)) throw Error('Output must be new');
  const reportBytes = fs.readFileSync(path.join(draftRoot, 'report.json')), draft = JSON.parse(reportBytes);
  const provenance = new Map(), sources = [];
  for (const file of [...manifests(audioRoot), ...(additionalManifest ? [additionalManifest] : [])]) {
    const bytes = fs.readFileSync(file), manifest = JSON.parse(bytes), sourceHash = hash(bytes);
    let used = 0;
    for (const row of manifest.records || manifest.audioAssets || []) {
      const sha256 = row.deliverySha256 || row.sha256;
      const language = row.language || manifest.language || manifest.generation?.language;
      const voice = row.voice || manifest.voice || manifest.generation?.voice;
      if (!/^[a-f0-9]{64}$/.test(sha256 || '') || !language) continue;
      if (!provenance.has(sha256)) provenance.set(sha256, []);
      provenance.get(sha256).push({ language, voice: voice || null, spokenText: row.spokenText || row.text || null, file, sourceHash }); used++;
    }
    if (used) sources.push({ file, sha256: sourceHash, indexed: used });
  }
  const books = [], totals = { items: 0, sentenceAudio: 0, verifiedUS: 0, verifiedGB: 0, unknown: 0, conflictingProvenance: 0, invalidAssets: 0 };
  for (const book of draft.books) {
    const candidate = JSON.parse(fs.readFileSync(path.join(draftRoot, hash(JSON.stringify(book.bookId)), 'candidate.json'))), rows = [];
    for (const item of candidate.items) {
      totals.items++;
      const audio = item.learning?.sentenceAudio?.audio;
      if (!audio) { rows.push({ itemId: item.itemId, word: item.word, status: 'no-sentence-audio' }); continue; }
      totals.sentenceAudio++;
      if (!/^assets\/[A-Za-z0-9._-]+\.(ogg|mp3|wav)$/.test(audio.url)) throw Error('Unexpected audio path');
      const asset = path.resolve(__dirname, '..', audio.url), valid = fs.existsSync(asset) && hash(fs.readFileSync(asset)) === audio.sha256;
      const matches = provenance.get(audio.sha256) || [], languages = [...new Set(matches.map(row => row.language))];
      let status = !valid ? 'invalid-asset' : languages.length > 1 ? 'conflicting-provenance' : languages[0] === 'en-US' ? 'recorded-en-US' : languages[0] === 'en-GB' ? 'recorded-en-GB' : 'unknown-accent';
      const key = { 'invalid-asset': 'invalidAssets', 'conflicting-provenance': 'conflictingProvenance', 'recorded-en-US': 'verifiedUS', 'recorded-en-GB': 'verifiedGB', 'unknown-accent': 'unknown' }[status]; totals[key]++;
      rows.push({ itemId: item.itemId, word: item.word, phonetic: item.phonetic, sentenceAudioSha256: audio.sha256, status, evidence: matches });
    }
    books.push({ bookId: book.bookId, title: book.title, rows });
  }
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ productionChanged: false, method: 'Exact delivered asset SHA-256 linked to explicit generation language metadata; no default locale inference, no listening claim.', draftReportSha256: hash(reportBytes), totals, sources, books }, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'README.md'), '# 音标与现有例句音频口音核查\n\n只读检查，未重新生成或覆盖音频。按当前课程音频文件哈希匹配原生成清单的明确语言配置，不凭文件名或默认值判断，也不声称逐条人工听审。\n\n' + JSON.stringify(totals, null, 2) + '\n\n英式补充音标与已确认的 en-US 音频有口音配置不一致；不代表所有词在两种口音下发音都不同。原音频和记录应保留；若要统一，需单独生成并审核英式新音频，不能只修改语言标签。\n', { flag: 'wx' });
  return totals;
}
if (require.main === module) console.log(JSON.stringify(audit(...process.argv.slice(2)), null, 2));
module.exports = { audit };
