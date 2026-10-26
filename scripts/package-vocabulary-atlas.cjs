#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const library = require('./lib/vocabulary-illustrations.cjs');
const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const root = path.resolve(option('--root') || path.resolve(__dirname, '..'));
const fail = message => { throw new Error(message); };
const inside = relative => {
  if (typeof relative !== 'string' || path.isAbsolute(relative)) fail('Expected a repository-relative path');
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(root + path.sep)) fail('Path leaves repository: ' + relative);
  return absolute;
};
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run = (command, parameters) => execFileSync(command, parameters, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 });
const dimensions = file => JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', file])).streams[0];
const exclusiveCopy = (source, destination) => {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
};
const manifestArg = option('--manifest');
if (!args.includes('--manifest') || !manifestArg) fail('Usage: --manifest <json> --source <png> [--generation-seconds N], or --manifest <json> --apply-draft');
const manifestFile = path.resolve(manifestArg);
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const { batchId, unit, version, cells } = manifest;
if (args.includes('--preflight')) {
  for (const key of ['--catalog', '--stage', '--out']) if (!args.includes(key) || !option(key)) fail('Preflight requires ' + key);
  const catalogFile = path.resolve(option('--catalog'));
  const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
  const result = library.plan(catalog, manifest, { stage: option('--stage') });
  result.preflight = { catalogSha256: hash(catalogFile), manifestSha256: hash(manifestFile), stage: option('--stage') };
  fs.writeFileSync(option('--out'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ plan: option('--out'), items: result.items.map(i => ({ word: i.word, action: i.action, approvedCandidates: i.candidates.length })) }));
  process.exit(0);
}
const assetStemPrefix = manifest.assetPrefix || `u${unit}-`;
if (!/^[a-z0-9-]+$/.test(batchId) || !Number.isInteger(unit) || unit < 1 || !Number.isInteger(version) || version < 1) fail('Invalid batch/unit/version');
if (!/^[a-z0-9-]+-$/.test(assetStemPrefix)) fail('Invalid assetPrefix');
const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
if (!Array.isArray(cells) || cells.length < 1 || cells.length > 4 || new Set(cells.map(c => c.position)).size !== cells.length || new Set(cells.map(c => c.slug)).size !== cells.length) fail('One to four distinct positions and slugs required');
for (const cell of cells) if (!positions.includes(cell.position) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cell.slug) || !cell.word || !cell.itemId) fail('Invalid cell identity');
const draftFile = manifest.draft ? inside(manifest.draft) : null;
const draft = draftFile ? JSON.parse(fs.readFileSync(draftFile, 'utf8')) : null;
if (draft) for (const cell of cells) {
  const matches = draft.items.filter(item => item.itemId === cell.itemId && item.word === cell.word);
  if (matches.length !== 1) fail('Draft word/id mismatch: ' + cell.word);
  if (matches[0].images.wide.length || matches[0].images.mobile.length) fail('Refusing to replace existing refs: ' + cell.word);
}
const atlasRelative = `ref/words-pic/atlases/${batchId}.png`;
const reportFile = manifestFile.replace(/\.json$/, '.report.json');
if (reportFile === manifestFile) fail('Manifest filename must end in .json');
const currentPreflight = () => {
  for (const key of ['--catalog', '--plan']) if (!args.includes(key) || !option(key)) fail('New atlas packaging requires a current ' + key);
  const catalogFile = path.resolve(option('--catalog'));
  const planFile = path.resolve(option('--plan'));
  const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  const stage = plan.preflight?.stage;
  if (plan.format !== 'vocabulary-illustration-plan' || plan.schemaVersion !== 1 || plan.batchId !== batchId || !['primary', 'junior', 'adult'].includes(stage)) fail('Invalid or mismatched preflight plan');
  if (plan.preflight.catalogSha256 !== hash(catalogFile) || plan.preflight.manifestSha256 !== hash(manifestFile)) fail('Preflight plan is stale; rerun preflight');
  const expectedPlan = library.plan(catalog, manifest, { stage });
  if (JSON.stringify(plan.items) !== JSON.stringify(expectedPlan.items)) fail('Preflight plan content does not match the current catalog and manifest');
  if (plan.items.length !== cells.length || plan.items.some(item => item.action !== 'generate')) {
    const blocked = plan.items.filter(item => item.action !== 'generate').map(item => item.word);
    fail('Refusing duplicate generation; reuse/review existing candidates first: ' + blocked.join(', '));
  }
  return { planFile, plan, planSha256: hash(planFile), catalogSha256: hash(catalogFile), manifestSha256: hash(manifestFile), stage };
};
const singlePolicy = 'single-wide-webp-v1';
const legacyPolicy = 'legacy-responsive-v1';
const expected = (cell, policy = singlePolicy) => ({
    master: `ref/words-pic/split/masters/${policy === legacyPolicy ? `${cell.slug}-v${version}` : `${assetStemPrefix}${cell.slug}-v${version}`}.png`,
  wide: (policy === legacyPolicy ? ['avif', 'webp'] : ['webp']).map(format => `assets/vocab-${assetStemPrefix}${cell.slug}-wide-v${version}.${format}`),
  mobile: policy === legacyPolicy
    ? ['avif', 'webp'].map(format => `assets/vocab-u${unit}-${cell.slug}-mobile-v${version}.${format}`)
    : [`assets/vocab-${assetStemPrefix}${cell.slug}-wide-v${version}.webp`]
});
if (args.includes('--apply-draft')) {
  if (!draftFile) fail('--apply-draft requires a manifest with a draft path');
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  // Reports written before the single-file policy retain their original four-file mapping.
  const policy = report.deliveryPolicy === undefined ? legacyPolicy : report.deliveryPolicy;
  if (![singlePolicy, legacyPolicy].includes(policy)) fail('Unknown delivery policy: ' + policy);
  if (report.preflight) {
    const preflight = currentPreflight();
    if (report.preflight.planSha256 !== preflight.planSha256 || report.preflight.catalogSha256 !== preflight.catalogSha256 || report.preflight.manifestSha256 !== preflight.manifestSha256) fail('Preflight inputs changed after packaging');
  }
  if (report.batchId !== batchId || report.atlas !== atlasRelative || hash(inside(atlasRelative)) !== report.atlasSha256) fail('Atlas report mismatch');
  for (const cell of cells) {
    const entry = report.cells.find(x => x.itemId === cell.itemId && x.word === cell.word && x.slug === cell.slug && x.position === cell.position);
    const names = expected(cell, policy);
    if (!entry || entry.master !== names.master || hash(inside(names.master)) !== entry.masterSha256) fail('Master identity/hash mismatch: ' + cell.word);
    const files = [...new Set([...names.wide, ...names.mobile])];
    if (!Array.isArray(entry.files) || entry.files.length !== files.length) fail('Delivery file count mismatch: ' + cell.word);
    for (const file of files) {
      const record = entry.files.find(x => x.path === file);
      const absolute = inside(file);
      const size = fs.statSync(absolute).size;
      if (!record || size <= 0 || size >= 20000 || size !== record.bytes || hash(absolute) !== record.sha256) fail('Delivery validation failed: ' + file);
      const dim = dimensions(absolute);
      const width = policy === legacyPolicy && names.mobile.includes(file) ? 384 : 512;
      if (dim.width !== width || dim.height !== 288) fail('Delivery validation failed: ' + file);
    }
    const item = draft.items.find(x => x.itemId === cell.itemId);
    item.images = { wide: names.wide, mobile: names.mobile };
  }
  fs.writeFileSync(draftFile, JSON.stringify(draft, null, 2) + '\n');
  console.log(JSON.stringify({ applied: cells.map(c => ({ word: c.word, slug: c.slug })), draft: manifest.draft }));
  process.exit(0);
}
if (!args.includes('--source') || !option('--source')) fail('--source is required for packaging');
const preflight = currentPreflight();
const source = path.resolve(option('--source'));
const start = Date.now();
const dim = dimensions(source);
if (!dim || dim.width < 1024 || dim.height < 576) fail('Atlas too small for four panels');
const planned = [atlasRelative, ...cells.flatMap(c => { const n = expected(c); return [n.master, ...n.wide]; })];
for (const file of [...planned.map(inside), reportFile]) if (fs.existsSync(file)) fail('Refusing to overwrite: ' + file);
const rectangles = cells.map(cell => {
  const index = positions.indexOf(cell.position);
  const x0 = index % 2 ? Math.floor(dim.width / 2) : 0;
  const y0 = index >= 2 ? Math.floor(dim.height / 2) : 0;
  const x1 = index % 2 ? dim.width : Math.floor(dim.width / 2);
  const y1 = index >= 2 ? dim.height : Math.floor(dim.height / 2);
  const rect = cell.rect || [x0 + 4, y0 + 4, x1 - x0 - 8, y1 - y0 - 8];
  if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isInteger) || rect[0] < 0 || rect[1] < 0 || rect[2] < 512 || rect[3] < 288 || rect[0] + rect[2] > dim.width || rect[1] + rect[3] > dim.height) fail('Invalid/small crop: ' + cell.word);
  return rect;
});
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vocabulary-atlas-'));
exclusiveCopy(source, inside(atlasRelative));
  const report = { batchId, assetPrefix: assetStemPrefix, deliveryPolicy: singlePolicy, preflight: { catalogSha256: preflight.catalogSha256, manifestSha256: preflight.manifestSha256, planSha256: preflight.planSha256, stage: preflight.stage }, atlas: atlasRelative, atlasSha256: hash(source), atlasDimensions: dim, styleReference: manifest.styleReference, generationSeconds: args.includes('--generation-seconds') ? Number(option('--generation-seconds')) : null, cells: [] };
for (const [index, cell] of cells.entries()) {
  const names = expected(cell);
  const rect = rectangles[index];
  const temporaryMaster = path.join(temp, `${cell.slug}.png`);
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', source, '-vf', `crop=${rect[2]}:${rect[3]}:${rect[0]}:${rect[1]}`, '-frames:v', '1', temporaryMaster]);
  exclusiveCopy(temporaryMaster, inside(names.master));
  const entry = { ...cell, rect, master: names.master, masterSha256: hash(inside(names.master)), files: [] };
  for (const relative of names.wide) {
    let selected;
    for (const quality of [35, 30, 25, 20, 15, 12, 10, 8, 6, 4, 2]) {
      const candidate = path.join(temp, `${cell.slug}-wide-${quality}.webp`);
      // Fit the complete panel inside the shared 16:9 image rather than crop its teaching objects.
      const filter = 'scale=512:288:force_original_aspect_ratio=decrease,pad=512:288:(ow-iw)/2:(oh-ih)/2:color=0xfffcf5';
      run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', temporaryMaster, '-vf', filter, '-frames:v', '1', '-c:v', 'libwebp', '-quality', String(quality), '-preset', 'picture', candidate]);
      const bytes = fs.statSync(candidate).size;
      if (bytes > 0 && bytes < 20000) { selected = candidate; break; }
    }
    if (!selected) fail('Could not meet 20KB: ' + relative);
    exclusiveCopy(selected, inside(relative));
    entry.files.push({ path: relative, bytes: fs.statSync(selected).size, sha256: hash(selected) });
  }
  report.cells.push(entry);
}
report.packagingSeconds = Math.round((Date.now() - start) / 1000);
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ report: path.relative(root, reportFile), generationSeconds: report.generationSeconds, packagingSeconds: report.packagingSeconds, mapping: report.cells.map(c => ({ position: c.position, word: c.word, master: c.master, maxBytes: Math.max(...c.files.map(f => f.bytes)) })) }, null, 2));
