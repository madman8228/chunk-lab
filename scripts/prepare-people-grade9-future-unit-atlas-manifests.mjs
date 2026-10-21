import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'docs/source-materials/people-grade9-full-2013.json');
const outputRoot = path.join(root, 'output/textbook-extractions/people-grade9-full-2013-20261015');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const entries = source.vocabularyText.trim().split(/\r?\n/).map(line => {
  const [unitLabel, word, meaning, textbookPage] = line.split('|');
  return { unit: Number(unitLabel.match(/\d+/)?.[0]), word, meaning, textbookPage: Number(textbookPage) };
});
const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const summary = [];
for (let unit = 4; unit <= 14; unit++) {
  const rows = entries.filter(entry => entry.unit === unit);
  if (!rows.length) throw new Error(`Unit ${unit} has no source entries`);
  const outputDir = path.join(outputRoot, `unit${unit}-images`);
  fs.mkdirSync(outputDir, { recursive: true });
  const batches = [];
  for (let start = 0; start < rows.length; start += 4) {
    const chunk = rows.slice(start, start + 4);
    const cells = chunk.map((entry, index) => ({
      position: positions[index],
      word: entry.word,
      meaning: entry.meaning,
      textbookPage: entry.textbookPage,
      itemId: `pep-g9-2013-u${unit}:${String(start + index + 1).padStart(2, '0')}`,
      slug: slug(entry.word)
    }));
    const batchNumber = Math.floor(start / 4) + 1;
    const batchId = `unit${unit}-batch${String(batchNumber).padStart(2, '0')}-${cells.map(cell => cell.slug).join('-')}-v1`;
    const filename = `batch-${String(batchNumber).padStart(2, '0')}-atlas.json`;
    const manifest = {
      batchId,
      unit,
      version: 1,
      deliveryPolicy: 'single-wide-webp-v1',
      styleReference: 'ref/words-pic/split/masters/connect-with-v2.png',
      cells
    };
    fs.writeFileSync(path.join(outputDir, filename), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    batches.push({ manifest: filename, words: cells.map(cell => cell.word) });
  }
  summary.push({ unit, words: rows.length, batches: batches.length, batches });
}
console.log(JSON.stringify({ units: summary.length, words: summary.reduce((sum, row) => sum + row.words, 0), summary }, null, 2));
