import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { checkTranscription } from './extract-primary-grade3.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
export const sourceFile = path.join(root, 'docs/source-materials/primary-jingtong-grade3-lower-20261014.json');

function reviewMarkdown(data, checked) {
  const s = checked.summary;
  const esc = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
  const typeNames = { word: '单词', contraction: '缩写', phrase: '短语', expression: '表达' };
  const lines = [
    '# 人教精通英语三年级下册：图片词表提取稿', '',
    '状态：待审提取材料，未导入课程、未公开发布。', '',
    '系列：精通；册次：三年级下册；目录中的6个单元标题已从本批目录图抄录。具体出版版次与印次未提供，未根据封面审定年份推断。', '',
    `共 ${s.entries} 条单元词义记录、${s.uniqueTerms} 个不同词头/表达。colour 的“颜色”和“为……着色”按第66、70页分别保留。`, '',
    '| 单元 | 条目数 |', '|---|---:|',
    ...s.unitCounts.map(unit => `| ${unit.unit} | ${unit.entries} |`), '',
    '## 原表标记', '',
    '“*”表示原表标出的课程标准二级词；黑体表示要求理解、运用，白体表示只要求在语境中理解。两者独立记录。条目类型是整理标注，不是教材印刷标签。正文页码沿用原表。', '',
    '## 待确认', '',
    ...data.reviewIssues.map(issue => '- ' + (issue.term ? issue.term + '：' : '') + issue.note),
    ...(s.conflicts.length ? s.conflicts.map(issue => `- ${issue.term}：单元表与 A–Z 表星号不一致；已保留两处记录。`) : ['- 单元表与 A–Z 表的词头、页码和星号已程序交叉核对；仍需人工对照原图校对释义和字体。']), '',
    '尚未增加例句、音标、练习、音频或插图；不能直接作为课程包导入。', ''
  ];
  for (const unit of data.units) {
    lines.push(`## ${unit.title}`, '', '| 顺序 | 词语 | 原表释义 | 正文页码 | 星号 | 字体 | 类型 | 备注 |', '|---:|---|---|---:|---|---|---|---|');
    for (const row of checked.records.filter(record => record.unitId === unit.unitId)) {
      lines.push(`| ${row.order} | ${esc(row.term)} | ${esc(row.meaning)} | ${row.sourceTextPage} | ${row.starred ? '*' : '—'} | ${row.bold ? '黑体' : '白体'} | ${typeNames[row.type]} | ${esc(row.sourceNote)} |`);
    }
    lines.push('');
  }
  lines.push('## 来源与核对', '', '来自用户提供的9张图片：1为封面、2为目录、3–5为按单元词表、6–9为 A–Z 词表。原图原样保存在 source-images 中，未压缩、改画或用作学习插图。单元词头和页码与独立 A–Z 表程序交叉核对；程序检查不代替人工校对。', '');
  return lines.join('\n');
}

export function generateExtraction(directory) {
  const data = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  const checked = checkTranscription(data);
  if (fs.existsSync(directory)) throw new Error('输出目录已存在，未覆盖原提取稿。');
  for (const image of data.images) if (!fs.existsSync(image.path)) throw new Error('缺少原图，未创建不完整提取包：' + image.id);
  fs.mkdirSync(path.join(directory, 'source-images'), { recursive: true });
  const images = data.images.map(image => {
    const file = 'source-images/image-' + image.id + '.png';
    fs.copyFileSync(image.path, path.join(directory, file), fs.constants.COPYFILE_EXCL);
    return { id: image.id, role: image.role, file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, file))).digest('hex') };
  });
  const artifact = {
    format: 'textbook-vocabulary-extraction', version: 1, status: 'review-only', textbook: data.textbook,
    contents: data.contents, legend: data.legend, summary: checked.summary,
    units: data.units.map(({ entries, ...unit }) => unit), records: checked.records,
    sourceImages: images, alphabeticalIndex: data.alphabeticalIndex, reviewIssues: data.reviewIssues, limitations: data.limitations
  };
  const columns = ['entryId', 'unit', 'order', 'term', 'meaning', 'sourceTextPage', 'starred', 'bold', 'type', 'sourceNote', 'alphabeticalIndexStarred'];
  const csvCell = value => '"' + String(value).replaceAll('"', '""') + '"';
  const csv = [columns.map(csvCell).join(','), ...checked.records.map(record => columns.map(column => csvCell(record[column])).join(','))].join('\r\n') + '\r\n';
  fs.writeFileSync(path.join(directory, 'extracted-vocabulary.json'), JSON.stringify(artifact, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(directory, 'vocabulary.csv'), '\ufeff' + csv, { flag: 'wx' });
  fs.writeFileSync(path.join(directory, 'review.md'), reviewMarkdown(data, checked), { flag: 'wx' });
  return checked.summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--check') console.log(JSON.stringify(checkTranscription(JSON.parse(fs.readFileSync(sourceFile, 'utf8'))).summary, null, 2));
  else {
    const directory = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'output/textbook-extractions/primary-jingtong-grade3-lower-20261014');
    console.log(JSON.stringify({ directory, ...generateExtraction(directory) }, null, 2));
  }
}
