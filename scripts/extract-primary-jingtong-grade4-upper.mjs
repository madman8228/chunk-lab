import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { checkTranscription } from './extract-primary-grade3.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
export const sourceFile = path.join(root, 'docs/source-materials/primary-jingtong-grade4-upper-20261014.json');
const esc = value => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');

function reviewMarkdown(data, checked) {
  const s = checked.summary;
  const typeNames = { word: '单词', contraction: '缩写', phrase: '短语', expression: '表达' };
  const lines = [
    '# 人教精通英语四年级上册：图片词表提取稿', '',
    '状态：待审提取材料；未转成课程练习或公开发布。用户确认教材为精通版。封面圆标的2024仅记录为审定年份，版次/印次仍待版权页。', '',
    `共 ${s.entries} 条单元词义记录、${s.uniqueTerms} 个不同词头或短语。Unit 1 的 play（参加运动/游戏）与 Unit 2 的 play（演奏乐器）分别保留；Unit 1 的 time（次）与 Unit 6 的 time（时间）分别保留。`, '',
    '| 单元 | 目录起页 | 词条数 |', '|---|---:|---:|',
    ...data.units.map(unit => `| ${unit.title} | ${unit.contentsStartPage} | ${unit.entries.length} |`), '',
    '## 原表标记与待审事项', '',
    '“*”表示原表标出的课程标准二级词；黑体表示要求理解、运用，白体表示只要求在语境中理解。星号和字体分别记录。页码沿用教材正文页码。词条类型为整理标注，不是教材印刷标签。', '',
    ...data.reviewIssues.map(issue => '- ' + (issue.term ? issue.term + '：' : '') + issue.note),
    ...(s.conflicts.length ? s.conflicts.map(issue => `- ${issue.term}：单元词表与 A–Z 词汇表的星号不同，保留原表两种标记。`) : ['- 单元词头、正文页码及星号与 A–Z 词汇表已程序交叉核对；仍需人工检查释义及字形。']), '',
    `原图页脚声明：“${data.textbook.printedUsageNotice}”。本稿用于个人审阅；公共发布前需核实授权。`, '',
    '## 单元词表', ''
  ];
  for (const unit of data.units) {
    lines.push(`### ${unit.title}`, '', '| 顺序 | 词语 | 原表释义 | 正文页码 | 星号 | 字体 | 类型 | 备注 |', '|---:|---|---|---:|---|---|---|---|');
    for (const row of checked.records.filter(row => row.unitId === unit.unitId)) {
      lines.push(`| ${row.order} | ${esc(row.term)} | ${esc(row.meaning)} | ${row.sourceTextPage} | ${row.starred ? '*' : '—'} | ${row.bold ? '黑体' : '白体'} | ${typeNames[row.type]} | ${esc(row.sourceNote)} |`);
    }
    lines.push('');
  }
  lines.push('## 目录中的其他内容', '', '| 项目 | 页码 |', '|---|---:|',
    ...data.contents.filter(item => !item.title.startsWith('Unit ')).map(item => `| ${esc(item.title)} | ${item.startPage} |`), '',
    '本批未提供Revision和Appendix 1正文，未根据目录补造词表。9张来源图片原样保存在 source-images，不压缩、不改画、不作为学习插图。', '');
  return lines.join('\n');
}

export function generateExtraction(directory) {
  const data = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  const checked = checkTranscription(data);
  if (fs.existsSync(directory)) throw new Error('输出目录已存在，未覆盖原提取稿。');
  for (const image of data.images) if (!fs.existsSync(image.path)) throw new Error('缺少本批原图，未生成不完整提取包：' + image.id);
  fs.mkdirSync(path.join(directory, 'source-images'), { recursive: true });
  const images = data.images.map(image => {
    const file = 'source-images/image-' + image.id + '.png';
    fs.copyFileSync(image.path, path.join(directory, file), fs.constants.COPYFILE_EXCL);
    return { id: image.id, role: image.role, printedPage: image.printedPage || null, file,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, file))).digest('hex') };
  });
  const artifact = { format: 'textbook-vocabulary-extraction', version: 1, status: 'review-only', textbook: data.textbook,
    contents: data.contents, legend: data.legend, summary: checked.summary,
    units: data.units.map(({ entries, ...unit }) => unit), records: checked.records,
    alphabeticalIndex: data.alphabeticalIndex, sourceImages: images, reviewIssues: data.reviewIssues, limitations: data.limitations };
  const columns = ['entryId', 'unit', 'order', 'term', 'meaning', 'sourceTextPage', 'starred', 'bold', 'type', 'sourceNote', 'alphabeticalIndexStarred'];
  const csvCell = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  const csv = '\ufeff' + [columns, ...checked.records.map(row => columns.map(column => row[column]))]
    .map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  fs.writeFileSync(path.join(directory, 'extracted-vocabulary.json'), JSON.stringify(artifact, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(directory, 'vocabulary.csv'), csv, { flag: 'wx' });
  fs.writeFileSync(path.join(directory, 'review.md'), reviewMarkdown(data, checked), { flag: 'wx' });
  return checked.summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const data = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  if (process.argv[2] === '--check') console.log(JSON.stringify(checkTranscription(data).summary, null, 2));
  else {
    const directory = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'output/textbook-extractions/primary-jingtong-grade4-upper-20261014');
    console.log(JSON.stringify({ directory, ...generateExtraction(directory) }, null, 2));
  }
}
