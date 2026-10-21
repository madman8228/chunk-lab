import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
export const sourceFile = path.join(root, 'docs/source-materials/primary-grade3-upper-20261014.json');
const key = term => term.toLocaleLowerCase('en').replaceAll('’', "'").trim();

export function checkTranscription(data) {
  assert.equal(data.format, 'textbook-vocabulary-transcription');
  assert.equal(data.status, 'review-only');
  assert.equal(data.units.length, 6);
  const index = new Map();
  for (const row of data.alphabeticalIndex.entries) {
    const [head, pageText] = row.split('@'), term = head.replace(/^\*/, '');
    assert.ok(term && /^\d+(,\d+)*$/.test(pageText));
    assert.ok(!index.has(key(term)), 'A–Z 表不能重复转录词头：' + term);
    index.set(key(term), { term, pages: pageText.split(',').map(Number), starred: head.startsWith('*') });
  }
  const records = [], conflicts = [], terms = new Set();
  data.units.forEach((unit, i) => {
    assert.equal(unit.unitId, 'unit-' + (i + 1));
    const seen = new Set();
    for (const [j, row] of unit.entries.entries()) {
      assert.equal(row.length, 7);
      const [term, meaning, page, starred, bold, type, note] = row;
      assert.ok(term && meaning && Number.isInteger(page));
      assert.equal(typeof starred, 'boolean'); assert.equal(typeof bold, 'boolean');
      assert.ok(data.legend.types.includes(type));
      const recordKey = key(term) + '@' + page;
      assert.ok(!seen.has(recordKey), '同一单元同页重复转录：' + term); seen.add(recordKey); terms.add(key(term));
      const alphabetical = index.get(key(term));
      assert.ok(alphabetical, '单元词头未在 A–Z 表找到：' + term);
      assert.ok(alphabetical.pages.includes(page), '单元表与索引页码不同：' + term);
      if (alphabetical.starred !== starred) conflicts.push({ term, unit: unit.title, unitListStarred: starred, indexStarred: alphabetical.starred });
      records.push({ entryId: unit.unitId + ':entry:' + String(j + 1).padStart(3, '0'), unitId: unit.unitId,
        unit: unit.title, order: j + 1, term, meaning, sourceTextPage: page, starred, bold,
        type, sourceNote: note, sourceImages: unit.sourceImages.slice(),
        alphabeticalIndexStarred: alphabetical.starred });
    }
  });
  for (const entry of index.values()) {
    assert.ok(terms.has(key(entry.term)), 'A–Z 表词头未在单元表找到：' + entry.term);
    const unitPages = [...new Set(records.filter(record => key(record.term) === key(entry.term)).map(record => record.sourceTextPage))].sort((a,b) => a-b);
    assert.deepEqual(unitPages, entry.pages.slice().sort((a,b) => a-b), '索引义项页码遗漏：' + entry.term);
  }
  return { records, summary: { unitCounts: data.units.map(unit => ({ unit: unit.title, entries: unit.entries.length })),
    entries: records.length, uniqueTerms: terms.size, indexEntries: index.size,
    types: Object.fromEntries(data.legend.types.map(type => [type, records.filter(record => record.type === type).length])),
    starredEntries: records.filter(record => record.starred).length,
    boldEntries: records.filter(record => record.bold).length, conflicts } };
}

export function reviewMarkdown(data, checked) {
  const s = checked.summary;
  const typeNames = { word:'单词', contraction:'缩写', phrase:'短语', expression:'表达' };
  const escape = value => String(value).replaceAll('|', '\\|').replaceAll('\n',' ');
  const lines = ['# 英语三年级上册：图片词表提取稿', '',
    '状态：待审提取材料，未导入账号、未公开发布。', '',
    '封面确认：人民教育出版社 · 小学三年级 · 上册 · 2024 审定。' + (data.textbook.series ? '教材系列由用户确认为' + data.textbook.series + '；具体版次与单元名称仍待版权页/目录确认。' : '封面未见 PEP 标识；具体系列、版次与单元名称仍待版权页/目录确认。'), '',
    `共 ${s.entries} 条单元记录、${s.uniqueTerms} 个不同词头/表达。have 在 Unit 2（有）和 Unit 6（吃；喝）分别保留；A–Z 索引不另建重复学习项。`, '',
    '| 单元 | 条目数 |', '|---|---:|', ...s.unitCounts.map(unit => `| ${unit.unit} | ${unit.entries} |`), '',
    '## 原表标记', '', '“*”表示原表标出的课程标准二级词；黑体表示要求理解、运用，白体表示只要求在语境中理解。两者是不同标记，不自动互相推导。类型是整理标注，不是教材给出的标签。页码是教材正文页码。', '',
    '## 待确认', '', ...data.reviewIssues.map(issue => '- ' + (issue.term ? issue.term + '：' : '') + issue.note), '',
    '词条已经提取，不因缺少版次而阻止审阅；但不会带未知版次自动创建教材课程。尚未增加例句、音标、发音或插图。', ''];
  for (const unit of data.units) {
    lines.push('## ' + unit.title, '', '| 顺序 | 词语 | 原表释义 | 正文页码 | 星号 | 字体 | 类型 | 备注 |', '|---:|---|---|---:|---|---|---|---|');
    for (const row of checked.records.filter(record => record.unitId === unit.unitId)) lines.push(`| ${row.order} | ${escape(row.term)} | ${escape(row.meaning)} | ${row.sourceTextPage} | ${row.starred?'*':'—'} | ${row.bold?'黑体':'白体'} | ${typeNames[row.type]} | ${escape(row.sourceNote)} |`);
    lines.push('');
  }
  lines.push('## 来源与核对', '', '来自用户提供的 7 张图片：1–3 为按单元词表，4–6 为 A–Z 词表，7 为封面。原图原样保存在 source-images 中，未压缩、改画或作为学习插图发布。两份独立转录的词头和正文页码已程序核对；doll 星号冲突保留为待审，程序核对不代替人工识字审查。', '');
  return lines.join('\n');
}

export function generateExtraction(directory) {
  const data = JSON.parse(fs.readFileSync(sourceFile, 'utf8')), checked = checkTranscription(data);
  if (fs.existsSync(directory)) throw new Error('输出目录已存在，未覆盖原提取稿。');
  for (const image of data.images) if (!fs.existsSync(image.path)) throw new Error('缺少原图，未创建不完整提取包：' + image.id);
  fs.mkdirSync(path.join(directory,'source-images'), {recursive:true});
  const images = data.images.map(image => {
    const file = 'source-images/image-' + image.id + '.png';
    fs.copyFileSync(image.path, path.join(directory,file), fs.constants.COPYFILE_EXCL);
    return {id:image.id, role:image.role, file, sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,file))).digest('hex')};
  });
  const artifact = {format:'textbook-vocabulary-extraction',version:1,status:'review-only',textbook:data.textbook,legend:data.legend,
    summary:checked.summary,units:data.units.map(({entries,...unit})=>unit),records:checked.records,
    sourceImages:images,alphabeticalIndex:data.alphabeticalIndex,reviewIssues:data.reviewIssues,limitations:data.limitations};
  const columns = ['entryId','unit','order','term','meaning','sourceTextPage','starred','bold','type','sourceNote','alphabeticalIndexStarred'];
  const csvCell = value => '"' + String(value).replaceAll('"','""') + '"';
  const csv = [columns.map(csvCell).join(','), ...checked.records.map(record=>columns.map(column=>csvCell(record[column])).join(','))].join('\r\n') + '\r\n';
  fs.writeFileSync(path.join(directory,'extracted-vocabulary.json'), JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(directory,'vocabulary.csv'), '\ufeff'+csv,{flag:'wx'});
  fs.writeFileSync(path.join(directory,'review.md'),reviewMarkdown(data,checked),{flag:'wx'});
  return checked.summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--check') console.log(JSON.stringify(checkTranscription(JSON.parse(fs.readFileSync(sourceFile,'utf8'))).summary,null,2));
  else { const directory = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root,'output/textbook-extractions/primary-grade3-upper-20261014'); console.log(JSON.stringify({directory,...generateExtraction(directory)},null,2)); }
}
