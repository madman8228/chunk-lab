import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'docs/source-materials/primary-grade6-lower-one-grade-start-2013-20261015.json');
const outDir = path.join(root, 'output/textbook-extractions/primary-grade6-lower-one-grade-start-2013-20261015');
const imageDir = path.join(outDir, 'source-images');
const inputDir = 'C:/Users/Administrator/AppData/Local/Temp';

try {
  await readFile(path.join(outDir, 'review.md'));
  throw new Error('Refusing to overwrite existing extraction: ' + outDir);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const data = JSON.parse(await readFile(sourcePath, 'utf8'));
await mkdir(imageDir, { recursive: true });
const imageRecords = [];
for (const [label, originalName] of data.sourceImages) {
  const source = path.join(inputDir, originalName);
  const targetName = label + '.png';
  const target = path.join(imageDir, targetName);
  const bytes = await readFile(source);
  await copyFile(source, target);
  imageRecords.push({ label, filename: targetName, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}

const lines = [
  '# ' + data.edition.titleZh, '',
  '**Edition:** ' + data.edition.title + ' — ' + data.edition.approval, '',
  'Review-only transcription. This is a separate edition record; it is not merged with the three-grade starting point textbook.', '',
  '## Contents', '', ...data.edition.contents.map(([title, page]) => '- p. ' + page + ': ' + title), '',
  '## Appendix 1: Words in each unit', '',
  '| Unit | English | Chinese | Textbook page |', '|---:|---|---|---:|'
];
for (const unit of data.units) {
  for (const [word, meaning, page] of unit.words) lines.push('| ' + unit.unit + ' — ' + unit.title + ' | ' + word + ' | ' + meaning + ' | ' + page + ' |');
}
lines.push('', '## Appendix 2: Vocabulary', '', 'The alphabetical vocabulary index repeats the unit words above. Refer to the preserved pages 64–65 for the printed alphabetic layout and full page references.', '', '## Source images', '', '| Image | Bytes | SHA-256 |', '|---|---:|---|');
for (const image of imageRecords) lines.push('| [' + image.filename + '](source-images/' + image.filename + ') | ' + image.bytes + ' | ' + image.sha256 + ' |');
lines.push('', '## Review notes', '', ...data.notes.map(note => '- ' + note), '');

await writeFile(path.join(outDir, 'review.md'), lines.join('\n'), 'utf8');
await writeFile(path.join(outDir, 'source-image-manifest.json'), JSON.stringify(imageRecords, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  output: outDir,
  sourceImages: imageRecords.length,
  unitWords: data.units.reduce((count, unit) => count + unit.words.length, 0)
}, null, 2));
