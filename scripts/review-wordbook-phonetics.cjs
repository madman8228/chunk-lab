'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// These are editorial proposals, not textbook quotations or publication approval.
const proposals = {
  'good afternoon': { phonetic: '美 /ˌɡʊd ˌæftɚˈnuːn/', basis: 'whole-entry', url: 'https://dictionary.cambridge.org/pronunciation/english/good-afternoon' },
  whenever: { phonetic: '美 /wenˈevɚ/', basis: 'whole-entry', url: 'https://dictionary.cambridge.org/pronunciation/english/whenever' },
  'in a hurry': { phonetic: '美 /ɪn ə ˈhɝːi/', basis: 'editorial-combination: article weak form plus dictionary hurry; not a quoted whole-phrase transcription', url: 'https://dictionary.cambridge.org/us/pronunciation/english/hurry', additionalUrl: 'https://assets.cambridge.org/052181/6939/sample/0521816939WS.pdf' },
  'have to': { phonetic: '美 /hæf tə/', basis: 'connected-speech option before a consonant; not the only possible citation form', url: 'https://downloads.bbc.co.uk/learningenglish/towardsadvanced/unit_11/bbc_tims_pron_wkshp_have_to.pdf' }
};
function classify(row) {
  if (row.status === 'previously-source-verified') return ['preserve-source-not-reverified'];
  const flags = [];
  if (row.method !== 'dictionary-entry') flags.push('phrase-or-editorial-review');
  if (/\ba\b/i.test(row.word) && /(?:\/|\s)eɪ(?:\s|\/)/u.test(row.phonetic)) flags.push('article-strong-form-review');
  if (/ɝ/u.test(row.phonetic)) flags.push('rhotic-vowel-convention-review');
  if (/hw/u.test(row.phonetic)) flags.push('wh-variant-review');
  if (row.evidence?.some(e => e.variants?.length > 1)) flags.push('dictionary-variant-selection-review');
  if (row.evidence?.some(e => e.status === 'pending-content-review')) flags.push('editorial-or-sense-review');
  return flags.length ? flags : ['dictionary-entry-not-independently-verified'];
}
function review(input, output) {
  if (fs.existsSync(output)) throw Error('Output must be a new directory');
  const bytes = fs.readFileSync(input), source = JSON.parse(bytes);
  const rows = source.books.flatMap(book => book.changes.map(row => {
    const normalized = row.word.toLowerCase().replace(/[!?.]+$/u, '').trim();
    const proposal = row.status !== 'previously-source-verified' ? proposals[normalized] : undefined;
    return { bookId: book.bookId, course: book.title, itemId: row.itemId, word: row.word, meaning: row.meaning,
      original: row.phonetic, originalStatus: row.status, originalContentRevision: row.contentRevision,
      flags: classify(row), proposal: proposal || null,
      status: proposal ? 'source-supported-editorial-proposal-pending-review' : row.status === 'previously-source-verified' ? 'preserved-not-reverified' : 'pending-independent-verification' };
  }));
  const expected = source.books.reduce((sum, book) => sum + book.total, 0);
  if (rows.length !== expected || new Set(rows.map(r => r.bookId + '\0' + r.itemId)).size !== rows.length) throw Error('Incomplete or duplicate inventory');
  const counts = {};
  for (const row of rows) for (const flag of row.flags) counts[flag] = (counts[flag] || 0) + 1;
  const report = { format: 'wordbook-phonetics-review', published: false, source: path.resolve(input),
    sourceSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    convention: '新增修订目标为剑桥式美式 IPA；教材原标保留。风险标记不是错误判定。未批量替换符号；未发布。',
    totals: { books: source.books.length, items: rows.length, proposals: rows.filter(r => r.proposal).length, counts }, rows };
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  const escape = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
  const table = entries => '| 课程 | 词项 | 原音标 | 修订建议 | 风险/依据 |\n|---|---|---|---|---|\n' + entries.map(r => '| ' + [r.course, r.word, r.original, r.proposal?.phonetic || '待独立核验', r.proposal ? `[来源](${r.proposal.url}) · ${r.proposal.basis}` : r.flags.join(', ')].map(escape).join(' | ') + ' |').join('\n') + '\n';
  const note = '# 全量音标核查：第一轮\n\n' + report.convention + '\n\n完成全量清点与风险筛查，不代表完成逐项词典校准。原有来源恢复状态只代表来源一致，不代表本轮已复核。全部建议待内容审核；课程包、正式数据及学习记录均未改动。\n\n';
  fs.writeFileSync(path.join(output, 'review.md'), note + table(rows), { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'proposals.md'), note + 'have to 为常见语流读法；in a hurry 为有依据的编辑组合，并非词典整条引文。完整依据见 report.json。\n\n' + table(rows.filter(r => r.proposal)), { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'priority.md'), note + table(rows.filter(r => !r.proposal && r.flags.some(f => !['preserve-source-not-reverified', 'dictionary-entry-not-independently-verified'].includes(f)))), { flag: 'wx' });
  return report.totals;
}
if (require.main === module) console.log(JSON.stringify(review(process.argv[2], process.argv[3]), null, 2));
module.exports = { classify, review };
