import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import draftModel from '../js/wordbook-draft.js';
import engine from '../landing/sentence-cloze-engine.js';
import { createBeginnerSpeakingDraft, beginnerSourceMapping, courseSources } from '../src/wordbook-authoring/beginner-speaking.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const draft = createBeginnerSpeakingDraft(), mappings = beginnerSourceMapping();
const errors = draftModel.validate(draft, { requireImages: false });
if (errors.length) throw new Error(errors.join('；'));
const sources = courseSources.map(source => JSON.parse(fs.readFileSync(path.join(root, source.file), 'utf8')));
for (const [index, mapping] of mappings.entries()) {
  const source = sources[courseSources.findIndex(value => value.resourceId === mapping.courseResourceId)].items[mapping.sourceLine - 1];
  if (engine.sentence(draft.items[index].exercise) !== source.en || draft.items[index].translation !== source.zh) throw new Error('源课程正文或译文已变化：' + mapping.itemId);
}
const compiled = await draftModel.compile(draft, { requireImages: false });
const report = {
  status: 'review-only', accountImported: false, publicPublished: false,
  originalCoursesChanged: false, itemCount: draft.items.length,
  bookRevision: compiled.index.books[0].revision,
  sourceFiles: courseSources.map((source, i) => ({
    file: source.file, resourceId: source.resourceId,
    sentenceTranslationHash: crypto.createHash('sha256').update(JSON.stringify(sources[i].items.map(item => ({ sentence: item.en, translation: item.zh })))).digest('hex')
  })),
  mappings,
  pending: ['用户审阅词义、场景和填空', '当前登录账号与课程关联验收', '发音示范与音标另行制作、审核', '插图按需制作，每种实际文件严格小于 20000 bytes', '正式服务备份和上线验收']
};
// Generates new deliverables only; never reads a database or writes app content.
const directory = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'output/wordbook-drafts/beginner-speaking-companion-v1');
if (fs.existsSync(directory)) throw new Error('输出目录已存在，未覆盖。请保留原稿并指定一个新的输出目录。');
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, 'wordbook-draft.json'), JSON.stringify(draft, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync(path.join(directory, 'review-report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ directory, itemCount: draft.items.length, sourceCheck: 'exact', validated: true, imported: false, published: false }));
