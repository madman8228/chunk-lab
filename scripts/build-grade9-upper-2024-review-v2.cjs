const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'docs/source-materials/people-grade9-upper-2024.json');
const outputPath = path.join(root, 'docs/source-materials/people-grade9-upper-2024-review-v2.json');
const auditPath = path.join(root, 'docs/source-materials/people-grade9-upper-2024-scan-recovery-20261021.json');

if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite ${outputPath}`);
const originalBuffer = fs.readFileSync(sourcePath);
const original = JSON.parse(originalBuffer.toString('utf8'));
const lines = original.vocabularyText.split(/\r?\n/).filter(Boolean);
if (lines.length !== 477) throw new Error(`Expected 477 source rows; found ${lines.length}`);

function replace(oldLine, newLine) {
  const indexes = lines.flatMap((line, index) => line === oldLine ? [index] : []);
  if (indexes.length !== 1) throw new Error(`Expected one exact source row, found ${indexes.length}: ${oldLine}`);
  lines[indexes[0]] = newLine;
}

function remove(line) {
  const indexes = lines.flatMap((value, index) => value === line ? [index] : []);
  if (indexes.length !== 1) throw new Error(`Expected one exact source row to remove, found ${indexes.length}: ${line}`);
  lines.splice(indexes[0], 1);
}

function insertAfter(anchor, addition) {
  const indexes = lines.flatMap((line, index) => line === anchor ? [index] : []);
  if (indexes.length !== 1) throw new Error(`Expected one insertion anchor, found ${indexes.length}: ${anchor}`);
  lines.splice(indexes[0] + 1, 0, addition);
}

const replacements = [
  ['Unit 3|click|点击；（使）发出咔嗒声|28', 'Unit 3|click|（用鼠标或在触摸板上）点击；（使）发出咔嗒声|28'],
  ['Unit 4|mix|混合；弄乱|33', 'Unit 4|mix up|混淆；弄乱|33'],
  ['Unit 4|case|情况；事实|34', 'Unit 4|case|情况；实情|34'],
  ['Unit 4|pardon|原谅|35', 'Unit 4|pardon|原谅；请再说一遍；抱歉|35'],
  ['Unit 5|officer|官员；军官；警官|46', 'Unit 5|officer|官员；军官|46'],
  ['Unit 5|ideal|理想的；最合适的|46', 'Unit 5|ideal|理想的；最合适的；理想；完美的人（或事物）|46'],
  ['Unit 5|certain|某些；确定的|46', 'Unit 5|certain|某些；确定的；（不提及人或事物的名称时用）某些|46'],
  ['Unit 5|gradually|逐渐地；逐渐地|48', 'Unit 5|gradually|逐渐地；逐步地|48'],
  ['Unit 6|crowd|人（太）多的；拥挤的|58', 'Unit 6|crowded|人（太）多的；拥挤的|58'],
  ['Unit 6|board|在船（或火车、飞机）上；板；牌子|56', 'Unit 6|board|板；牌子|56'],
  ['Unit 6|survey|测绘；民意调查|58', 'Unit 6|survey|调查；民意调查|58'],
  ['Unit 7|folk|民间的|62', 'Unit 7|folk|民间的；民间音乐；（pl. folks）各位|62'],
  ['Unit 7|classical|古典音乐的；古典的|62', 'Unit 7|classical|古典音乐的；古典的；古典音乐|62'],
  ['Unit 7|pop|流行音乐；蹦出|62', 'Unit 7|pop|流行音乐；涌出|62'],
  ['Unit 7|rap|说唱乐；表演说唱音乐|62', 'Unit 7|rap|说唱音乐；表演说唱音乐|62'],
  ['Unit 7|policeman|警察|65', 'Unit 7|policewoman|女警察|65'],
  ['Unit 7|outdo|胜过；超过|66', 'Unit 7|outdo|胜过|66'],
  ['Unit 7|soul|真挚情感；灵魂|66', 'Unit 7|soul|真挚感情；灵魂|66'],
  ['Unit 7|characteristic|特征；品质；典型的|66', 'Unit 7|characteristic|特征；品质；典型的；独特的|66'],
  ['Unit 7|tape|磁带；录像带|68', 'Unit 7|tape|磁带；录音带|68'],
  ['Unit 7|tap|（用手指或脚）打节拍；轻敲|68', 'Unit 7|tap|（用手指或脚）打节拍；轻敲；水龙头；轻拍|68'],
  ['Unit 7|champion|冠军；扞卫|68', 'Unit 7|champion|冠军；捍卫|68'],
  ['Unit 7|flowing|流畅的；松懈的|68', 'Unit 7|flowing|流畅的；松散的|68'],
  ['Unit 8|make up ground on sb/sth|逼近正在前面的人或物|73', 'Unit 8|make up ground on sb/sth|逼近正在向前的人或物|73'],
  ['Unit 8|smooth|顺利的；顺利的；光滑的|73', 'Unit 8|smooth|顺利的；光滑的|73'],
  ['Unit 8|worldwide|世界范围的；在全世界|77', 'Unit 8|worldwide|世界范围的；在全世界；世界各地|77'],
  ['Unit 8|Roman|古罗马的；罗马的；罗马人|78', 'Unit 8|Roman|古罗马的；罗马的；罗马人；罗马字体|78'],
];
for (const [oldLine, newLine] of replacements) replace(oldLine, newLine);

remove('Unit 7|electronic|电子的|65');

const additions = [
  ['Unit 3|look up|查阅；检查|23', 'Unit 3|dictionary|词典；字典|23'],
  ['Unit 4|case|情况；实情|34', "Unit 4|in sb's case|就某人的情况而言|34"],
  ['Unit 4|divide|分成|39', 'Unit 4|divide sth into|把某物分为|39'],
  ['Unit 6|board|板；牌子|56', 'Unit 6|on board|在船（或火车、飞机）上|56'],
  ['Unit 8|figure|（冰上动作的）花样；数字；人物；认为|74', 'Unit 8|figure skating|花样滑冰|74'],
  ['Unit 8|Roman|古罗马的；罗马的；罗马人；罗马字体|78', 'Unit 8|drown|（使）淹死；（使）溺毙|79'],
  ['Unit 8|drown|（使）淹死；（使）溺毙|79', 'Unit 8|cheer|喝彩声；欢呼|79'],
  ['Unit 8|cheer|喝彩声；欢呼|79', 'Unit 8|crowd|人群；观众|79'],
];
for (const [anchor, line] of additions) insertAfter(anchor, line);

const keys = new Set();
for (const line of lines) {
  const fields = line.split('|');
  if (fields.length !== 4) throw new Error(`Malformed row: ${line}`);
  const key = `${fields[0]}|${fields[1].toLowerCase()}`;
  if (keys.has(key)) throw new Error(`Duplicate unit/headword: ${key}`);
  keys.add(key);
}
if (lines.length !== 484) throw new Error(`Expected 484 proposed rows; found ${lines.length}`);

const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
const draft = {
  ...original,
  revision: 'scan-verified-review-v2',
  reviewStatus: 'pending-user-review',
  vocabularyText: lines.join('\n'),
  sourceAudit: {
    originalSourceSha256: crypto.createHash('sha256').update(originalBuffer).digest('hex'),
    scanRecoveryManifest: 'people-grade9-upper-2024-scan-recovery-20261021.json',
    suppliedScanPages: audit.pages.map(({ page, file, sha256 }) => ({ page, file, sha256 })),
    originalRows: 477,
    proposedRows: lines.length,
    changes: 'Provisional transcription corrections and omissions from the supplied printed vocabulary pages; review required before queueing or audio generation.',
    approval: 'not approved'
  },
  notes: [
    ...original.notes,
    'This is a separate proposed scan-reconciled revision. The original review-only source remains unchanged.',
    'Corrections are derived from user-provided Vocabulary in Each Unit scans, printed pages 107–116. This proposal is pending user review and must not be used for audio generation or course release yet.'
  ]
};
fs.writeFileSync(outputPath, `${JSON.stringify(draft, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ outputPath, originalRows: 477, proposedRows: lines.length, additions: additions.length, replacements: replacements.length, removedRows: 1, status: draft.reviewStatus }, null, 2));
