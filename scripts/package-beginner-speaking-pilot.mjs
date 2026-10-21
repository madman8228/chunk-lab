import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import chunkShape from '../js/chunk-shape.js';
import { AiDraftValidator } from '../src/course-authoring/draft-validator.mjs';
import { SentenceCourseAdapter } from '../src/course-authoring/sentence-adapter.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'output/course-drafts/beginner-speaking-pilot');
if (fs.existsSync(output)) throw new Error('输出目录已存在，请保留原文件，指定新的制作流程后再生成。');
const markdown = fs.readFileSync(path.join(root, 'docs/beginner-speaking-pilot-draft.md'), 'utf8');
const explanations = new Map([...markdown.matchAll(/^- \*\*([123]-\d{2})\*\*：(.+)$/gm)].map((match) => [match[1], match[2]]));
const titles = ['第一次见面', '身边的人和物', '数字、星期和简单约定'];
const objectives = ['完成问候、自我介绍与初次见面。', '指认身边事物，并区分距离和数量。', '表达钟点、星期和简单约定。'];
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validator = new AiDraftValidator({ chunkShape, schemaValidator: {
  validate(schema, value) { const check = ajv.compile(schema); return { valid: !!check(value), errors: check.errors || [] }; }
} });
const adapter = new SentenceCourseAdapter();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'content/manifest.json'), 'utf8'));
const normalize = (text) => String(text).toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9]/g, '');
const existing = new Map();
for (const deck of manifest.decks) for (const shard of deck.shards) {
  for (const item of JSON.parse(fs.readFileSync(path.join(root, shard.url), 'utf8')).items) {
    const key = normalize(item.sentence);
    const matches = existing.get(key) || [];
    matches.push({ deckId: deck.id, cid: item.cid, sentence: item.sentence });
    existing.set(key, matches);
  }
}
const files = [], overlaps = [];
for (let lesson = 1; lesson <= 3; lesson++) {
  const rows = markdown.split(/\r?\n/).filter((line) => new RegExp(`^\\| ${lesson}-\\d{2} `).test(line));
  if (rows.length !== 10) throw new Error(`第 ${lesson} 课必须有 10 条核心表达。`);
  const draft = {
    format: 'chunklab-ai-course', formatVersion: '1.1',
    title: `零基础开口 · ${lesson} ${titles[lesson - 1]}`,
    description: `${objectives[lesson - 1]}原创试点课。A1 为内容设计目标，尚非分级认证。应用任务见配套审看文档。`,
    targetCefr: 'A1', contentForm: 'sentences', roles: [],
    learning: { template: 'sentence-practice', version: 1, modes: ['typing', 'chunkSelection'], defaultMode: 'typing' },
    items: rows.map((line) => {
      const [id, en, zh, chunks, hints] = line.split('|').slice(1, -1).map((cell) => cell.trim());
      const explanation = explanations.get(id);
      if (!explanation) throw new Error(`${id} 缺少讲解。`);
      const matches = existing.get(normalize(en));
      if (matches) overlaps.push({ reviewId: id, sentence: en, existing: matches });
      return { en, zh, chunks: chunks.split(' / '), hints: hints.split(' / '), explanation };
    })
  };
  const result = validator.validate(draft);
  if (!result.valid) throw new Error(JSON.stringify(result.issues));
  const deck = adapter.compile(draft, { deckId: `beginner-speaking-pilot-${lesson}` });
  const exported = adapter.projectForExport(deck);
  if (JSON.stringify(exported.items) !== JSON.stringify(draft.items)) throw new Error('原生课程转换未完整保留内容。');
  files.push({ name: `lesson-${lesson}.json`, value: draft });
}
fs.mkdirSync(output, { recursive: true });
for (const file of files) fs.writeFileSync(path.join(output, file.name), JSON.stringify(file.value, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync(path.join(output, 'overlap-report.json'), JSON.stringify({ scope: 'local builtin content only', overlapCount: overlaps.length, overlaps }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, lessons: files.length, items: 30, matchedExisting: overlaps.length, schemaAndSemanticValidation: 'passed', nativeRoundTrip: 'passed' }, null, 2));
