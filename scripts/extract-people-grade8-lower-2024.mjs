import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'docs/source-materials/people-grade8-lower-2024.json');
const outDir = path.join(root, 'output/textbook-extractions/people-grade8-lower-2024-20261015');
const imageDir = path.join(outDir, 'source-images');
const inputDir = 'C:/Users/Administrator/AppData/Local/Temp';

try {
  await readFile(path.join(outDir, 'review.md'));
  throw new Error('Refusing to overwrite existing extraction: ' + outDir);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const data = JSON.parse(await readFile(sourcePath, 'utf8'));
const vocabulary = data.vocabularyText.split('\n').map(line => {
  const [unit, word, meaning, page] = line.split('|');
  return [unit, word, meaning, Number(page)];
});
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
  '# ' + data.edition.titleZh, '',
  '**Edition:** ' + data.edition.title + ' — ' + data.edition.publisher + '; ' + data.edition.approvalMark + '.', '',
  'Review-only transcription of Vocabulary in Each Unit, pp. 113–124. A–Z pages and every supplied source screenshot are retained for comparison.', '',
  '## Unit sequence', '', ...Array.from({ length: 8 }, (_, index) => '- Unit ' + (index + 1)), '',
  '## Vocabulary in Each Unit', '',
  '| Unit | English | Chinese gloss | Textbook page |', '|---|---|---|---:|'
];
for (const [unit, word, meaning, page] of vocabulary) lines.push('| ' + unit + ' | ' + word + ' | ' + meaning + ' | ' + page + ' |');
lines.push('', '## Source images', '', '| Image | Bytes | SHA-256 |', '|---|---:|---|');
for (const image of imageRecords) lines.push('| [' + image.filename + '](source-images/' + image.filename + ') | ' + image.bytes + ' | ' + image.sha256 + ' |');
lines.push('', '## Review notes', '', ...data.notes.map(note => '- ' + note), '');

await writeFile(path.join(outDir, 'review.md'), lines.join('\n'), 'utf8');
await writeFile(path.join(outDir, 'source-image-manifest.json'), JSON.stringify(imageRecords, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: outDir, sourceImages: imageRecords.length, vocabularyEntries: vocabulary.length, units: [...new Set(vocabulary.map(row => row[0]))].length }, null, 2));
