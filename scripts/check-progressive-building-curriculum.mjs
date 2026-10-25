import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodes, getNodeLessonIds, loadNodeLesson } from '../src/progressive-building/catalog.mjs';
import { validateLessonV3, validateCatalog } from '../src/progressive-building/schema.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const all = args.includes('--all');
const reportFlag = args.indexOf('--report');
const reportPath = reportFlag >= 0 ? args[reportFlag + 1] : 'docs/curriculum/progressive-building-coverage.json';
if (!reportPath) throw new Error('--report needs a path');
const absoluteReport = path.resolve(root, reportPath);
if (!absoluteReport.startsWith(`${root}${path.sep}`)) throw new Error('Report path must stay inside the project workspace');

validateCatalog(nodes);
const content = [];
const sourceFiles = ['src/progressive-building/catalog.mjs'];
const issues = [];

for (const node of nodes) {
  const lessonIds = getNodeLessonIds(node.id);
  const lessons = [];
  for (const lessonId of lessonIds) {
    try {
      const lesson = validateLessonV3(await loadNodeLesson(node.id, lessonId));
      lessons.push(lesson);
      sourceFiles.push(`src/progressive-building/content/${node.id.toLowerCase()}.mjs`);
    } catch (error) {
      issues.push(`${node.id}/${lessonId}: ${error.message}`);
    }
  }
  const mapped = new Set(lessons.flatMap(lesson => lesson.steps.flatMap(step => step.coverage ?? [])));
  const subgoals = node.subgoalIds.map((id, index) => {
    const authored = lessons.filter(lesson => lesson.subgoalIds.includes(id));
    const steps = authored.flatMap(lesson => lesson.steps.filter(step => step.coverage?.includes(id)));
    const introduction = steps.some(step =>
      ['teach', 'context-choice'].includes(step.activity) && step.phase === 'introduction'
      || step.activity === 'transform' && step.operations?.some(operation => typeof operation.explanation === 'string' && operation.explanation.trim()),
    );
    const operation = steps.some(step => ['transform', 'range-identify', 'identify', 'classify', 'insert-modifier', 'quantity', 'compose'].includes(step.activity));
    const transfer = steps.some(step => ['independent-output', 'delayed-review'].includes(step.activity) && ['transfer', 'delayed-review'].includes(step.phase));
    const review = authored.some(lesson => lesson.review?.stepIds?.some(stepId => lesson.steps.some(step => step.id === stepId && step.coverage?.includes(id))));
    return {
      id,
      description: node.subgoals[index],
      status: mapped.has(id) && introduction && operation && transfer ? 'covered' : 'planned',
      lessonIds: authored.map(lesson => lesson.id),
      stepIds: steps.map(step => step.id),
      evidence: { introduction, operation, transfer, delayedReview: review },
    };
  });
  const status = subgoals.every(item => item.status === 'covered') ? 'preview' : lessonIds.length ? 'draft' : 'planned';
  content.push({ id: node.id, title: node.title, prerequisites: node.prerequisites, status, subgoals });
  if (status !== 'preview') issues.push(`${node.id}: ${subgoals.filter(item => item.status !== 'covered').length} subgoal(s) remain planned`);
}

const sourceHashes = {};
for (const relative of [...new Set(sourceFiles)].sort()) {
  const bytes = await readFile(path.join(root, relative));
  sourceHashes[relative] = createHash('sha256').update(bytes).digest('hex');
}
const report = {
  schemaVersion: 1,
  scope: 'progressive sentence-building PB01–PB50 text preview',
  generatedAt: new Date().toISOString(),
  status: issues.length ? 'in-progress' : 'reviewable-preview',
  totals: {
    knowledgeNodes: nodes.length,
    previewNodes: content.filter(node => node.status === 'preview').length,
    plannedNodes: content.filter(node => node.status !== 'preview').length,
    subgoals: content.reduce((sum, node) => sum + node.subgoals.length, 0),
    coveredSubgoals: content.reduce((sum, node) => sum + node.subgoals.filter(item => item.status === 'covered').length, 0),
  },
  nodes: content,
  sourceHashes,
  issues,
};
await mkdir(path.dirname(absoluteReport), { recursive: true });
await writeFile(absoluteReport, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`PB01–PB50: ${report.totals.previewNodes}/50 preview nodes; ${report.totals.coveredSubgoals}/${report.totals.subgoals} subgoals covered.`);
console.log(`Report: ${path.relative(root, absoluteReport)}`);
if (issues.length) {
  console.error(issues.slice(0, 12).join('\n'));
  if (issues.length > 12) console.error(`... and ${issues.length - 12} more pending items`);
  if (all) process.exitCode = 1;
}
