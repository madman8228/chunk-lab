import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'docs/source-materials/people-grade9-full-2013-supplement.json');
const outDir = path.join(root, 'output/textbook-extractions/people-grade9-full-2013-20261015/supplement-20261015');
const imageDir = path.join(outDir, 'source-images');
const inputDir = 'C:/Users/Administrator/AppData/Local/Temp';

try {
  await readFile(path.join(outDir, 'review.md'));
  throw new Error('Refusing to overwrite existing supplement: ' + outDir);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const data = JSON.parse(await readFile(sourcePath, 'utf8'));
const verbs = data.irregularVerbsText.split('\n').map(line => line.split('|'));
await mkdir(imageDir, { recursive: true });

const imageRecords = [];
for (const [label, originalName] of data.sourceImages) {
  const source = path.join(inputDir, originalName);
  const targetName = label + '.png';
  const bytes = await readFile(source);
  await copyFile(source, path.join(imageDir, targetName));
  imageRecords.push({ label, filename: targetName, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}

const lines = [
  '# 2013 九年级全一册补充页', '',
  '**续接档案：** [people-grade9-full-2013 主整理稿](../review.md)', '',
  data.appendixPages + '.', '',
  'Vocabulary Index pages are retained as scans to avoid duplicating the unit-by-unit word list. The irregular-verb chart is transcribed below for review.', '',
  '## Irregular Verbs', '',
  '| Verb | Past tense | Past participle |', '|---|---|---|'
];
for (const [verb, past, participle] of verbs) lines.push('| ' + verb + ' | ' + past + ' | ' + participle + ' |');
lines.push('', '## Source images', '', '| Image | Bytes | SHA-256 |', '|---|---:|---|');
for (const image of imageRecords) lines.push('| [' + image.filename + '](source-images/' + image.filename + ') | ' + image.bytes + ' | ' + image.sha256 + ' |');
lines.push('', '## Review notes', '', ...data.notes.map(note => '- ' + note), '');

await writeFile(path.join(outDir, 'review.md'), lines.join('\n'), 'utf8');
await writeFile(path.join(outDir, 'source-image-manifest.json'), JSON.stringify(imageRecords, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: outDir, sourceImages: imageRecords.length, irregularVerbs: verbs.length }, null, 2));
