import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(root, 'output', 'textbook-extractions');
const styleReference = 'ref/words-pic/split/masters/textbook-wide-v2.png';

const courses = [
  { source: 'people-grade7-lower-2024.json', dir: 'people-grade7-lower-2024-20261015', slug: 'g7-lower' },
  { source: 'people-grade7-upper-2024.json', dir: 'people-grade7-upper-2024-20261015', slug: 'g7-upper' },
  { source: 'people-grade8-lower-2024.json', dir: 'people-grade8-lower-2024-20261015', slug: 'g8-lower' },
  { source: 'people-grade8-upper-2024.json', dir: 'people-grade8-upper-2024-20261015', slug: 'g8-upper' },
];

const slugify = value => String(value)
  .toLowerCase()
  .replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'item';

const parseRows = data => {
  if (Array.isArray(data.vocabulary)) return data.vocabulary;
  return String(data.vocabularyText || '').split(/\r?\n/).filter(Boolean).map(line => {
    const [section, word, meaning, page] = line.split('|');
    return [section, word, meaning, Number(page)];
  });
};

const sectionInfo = section => {
  const match = String(section).match(/(\d+)$/);
  if (!match) throw new Error('Cannot determine unit number: ' + section);
  const unit = Number(match[1]);
  const starter = /^starter\s+unit/i.test(section);
  const key = starter ? `starter-unit-${unit}` : `unit-${unit}`;
  return { unit, key, starter };
};

for (const course of courses) {
  const source = JSON.parse(await readFile(path.join(root, 'docs', 'source-materials', course.source), 'utf8'));
  const rows = parseRows(source);
  const records = [];
  const grouped = new Map();
  for (const [section, term, meaning, textbookPage] of rows) {
    const info = sectionInfo(section);
    const list = grouped.get(info.key) || [];
    const order = list.length + 1;
    const record = {
      unitId: info.key,
      unit: info.unit,
      section,
      order,
      term,
      meaning,
      textbookPage,
      entryId: `${info.key}:entry:${String(order).padStart(3, '0')}`,
      slug: slugify(term),
    };
    list.push(record);
    grouped.set(info.key, list);
    records.push(record);
  }

  const courseDir = path.join(outputRoot, course.dir);
  const extractionPath = path.join(courseDir, 'extracted-vocabulary.json');
  await writeFile(extractionPath, JSON.stringify({
    course: course.dir,
    edition: source.edition,
    sourceFile: `docs/source-materials/${course.source}`,
    scope: 'Vocabulary in Each Unit only; A–Z and appendices excluded',
    records,
  }, null, 2) + '\n', { flag: 'wx' });

  for (const [unitKey, unitRecords] of grouped) {
    const info = sectionInfo(unitRecords[0].section);
    const unitDirName = info.starter ? `unit${info.unit}-starter-images` : `unit${info.unit}-images`;
    const unitDir = path.join(courseDir, unitDirName);
    await mkdir(unitDir, { recursive: true });
    const assetPrefix = `${course.slug}-${info.starter ? 'starter-' : ''}u${info.unit}-`;
    for (let index = 0; index < unitRecords.length; index += 4) {
      const batch = unitRecords.slice(index, index + 4);
      const batchNo = String(Math.floor(index / 4) + 1).padStart(2, '0');
      const batchSlug = batch.map(record => record.slug).join('-').slice(0, 100);
      const batchId = `${course.slug}-${info.key}-batch${batchNo}-${batchSlug}-v1`;
      const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
      const manifest = {
        batchId,
        unit: info.unit,
        version: 1,
        assetPrefix,
        styleReference,
        deliveryPolicy: 'single-wide-webp-v1',
        cells: batch.map((record, cellIndex) => ({
          position: positions[cellIndex],
          word: record.term,
          meaning: record.meaning,
          itemId: record.entryId,
          slug: record.slug,
        })),
      };
      await writeFile(path.join(unitDir, `batch-${batchNo}-atlas.json`), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    }
  }
  console.log(JSON.stringify({ course: course.dir, records: records.length, units: grouped.size }, null, 2));
}
