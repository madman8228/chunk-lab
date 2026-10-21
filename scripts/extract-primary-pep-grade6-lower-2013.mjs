import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'docs/source-materials/primary-pep-grade6-lower-2013-20261015.json');
const outDir = path.join(root, 'output/textbook-extractions/primary-pep-grade6-lower-2013-20261015');
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
  '**Edition:** ' + data.edition.title + ' — ' + data.edition.approval,
  '**Scope:** Review-only transcription; original screenshots retained below.', '',
  '## Contents', '', ...data.edition.contents.map(([title, page]) => '- p. ' + page + ': ' + title), '',
  '## Words in each unit', '',
  'Source note: the printed book distinguishes black-type and white-type words by learning requirements. This transcription does not encode bold styling.', ''
];
for (const unit of data.units) {
  lines.push('### Unit ' + unit.unit + ': ' + unit.title, '', '| Word / phrase | Chinese meaning / note | Textbook page |', '|---|---|---:|');
  for (const [word, meaning, page] of unit.words) lines.push('| ' + word + ' | ' + meaning + ' | ' + page + ' |');
  lines.push('');
}
lines.push('## Useful expressions', '', '| Unit | English | Chinese | Page |', '|---:|---|---|---:|');
for (const [unit, english, chinese, page] of data.expressions) lines.push('| ' + unit + ' | ' + english + ' | ' + chinese + ' | ' + page + ' |');
lines.push('', '## Proverbs', '', '| English | Chinese |', '|---|---|');
for (const [english, chinese] of data.proverbs) lines.push('| ' + english + ' | ' + chinese + ' |');
lines.push('', '## Irregular verbs', '', '| Infinitive | Past tense |', '|---|---|');
for (const [infinitive, past] of data.irregularVerbs) lines.push('| ' + infinitive + ' | ' + past + ' |');
lines.push('', '## Short plays (source pages retained)', '', ...data.shortPlays.map(play => '- **' + play.title + '** — pp. ' + play.pages.join('–') + '; see preserved source images.'), '');
lines.push('## Source image manifest', '', '| Image | Bytes | SHA-256 |', '|---|---:|---|');
for (const image of imageRecords) lines.push('| [' + image.filename + '](source-images/' + image.filename + ') | ' + image.bytes + ' | ' + image.sha256 + ' |');
lines.push('', '## Review notes', '', ...data.notes.map(note => '- ' + note), '');

await writeFile(path.join(outDir, 'review.md'), lines.join('\n'), 'utf8');
await writeFile(path.join(outDir, 'source-image-manifest.json'), JSON.stringify(imageRecords, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  output: outDir,
  sourceImages: imageRecords.length,
  unitWords: data.units.reduce((count, unit) => count + unit.words.length, 0),
  expressions: data.expressions.length,
  proverbs: data.proverbs.length,
  irregularVerbs: data.irregularVerbs.length
}, null, 2));
