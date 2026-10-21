'use strict';
// All packaging/application writes are confined to a fresh synthetic fixture root.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const draftModel = require('../js/wordbook-draft');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-single-webp-'));
const run = (command, args) => execFileSync(command, args, { windowsHide: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const dimensions = file => JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', file])).streams[0];
try {
  const scripts = path.join(fixture, 'scripts');
  fs.mkdirSync(scripts);
  const script = path.join(scripts, 'package-vocabulary-atlas.cjs');
  fs.copyFileSync(path.join(__dirname, 'package-vocabulary-atlas.cjs'), script);
  const source = path.join(fixture, 'source.png');
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=1280x800', '-vf', 'drawbox=x=640:y=0:w=640:h=400:color=green:t=fill,drawbox=x=0:y=400:w=640:h=400:color=blue:t=fill,drawbox=x=640:y=400:w=640:h=400:color=yellow:t=fill', '-frames:v', '1', source]);
  const sourceHash = sha(source);
  const cells = ['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((position, i) => ({ position, word: ['red', 'green', 'blue', 'yellow'][i], slug: 'fixture-' + i, itemId: 'fixture:' + i }));
  const draft = { schemaVersion: 1, book: { bookId: 'fixture-book', title: 'Synthetic atlas fixture', units: [{ unitId: 'fixture-unit', title: 'Colors' }], catalog: { facets: { schoolStages: ['小学'], grades: ['三年级'] } } }, items: cells.map(c => ({ itemId: c.itemId, unitId: 'fixture-unit', word: c.word, meaning: '颜色', scene: '颜色卡片', translation: '它是这种颜色。', exercise: draftModel.exercise('It is [' + c.word + '].'), images: { wide: [], mobile: [] } })) };
  const draftFile = path.join(fixture, 'draft.json');
  writeJson(draftFile, draft);
  const manifest = { batchId: 'fixture-single', unit: 99, version: 1, assetPrefix: 'fixture-course-u99-', draft: 'draft.json', cells };
  const manifestFile = path.join(fixture, 'batch.json');
  writeJson(manifestFile, manifest);
  const invoke = (...args) => run(process.execPath, [script, '--manifest', manifestFile, ...args]);
  invoke('--source', source);
  const reportFile = path.join(fixture, 'batch.report.json');
  const report = JSON.parse(fs.readFileSync(reportFile));
  assert.equal(report.deliveryPolicy, 'single-wide-webp-v1');
  assert.equal(report.cells.length, 4);
  assert.equal(fs.readdirSync(path.join(fixture, 'assets')).length, 4, 'four words produce exactly four delivery files');
  for (const cell of report.cells) {
    assert.equal(cell.files.length, 1);
    assert.match(cell.files[0].path, /-wide-v1\.webp$/);
    const file = path.join(fixture, cell.files[0].path);
    assert.ok(fs.statSync(file).size > 0 && fs.statSync(file).size < 20000);
    assert.equal(sha(file), cell.files[0].sha256);
    assert.deepEqual(dimensions(file), { width: 512, height: 288 });
    assert.ok(fs.existsSync(path.join(fixture, cell.master)));
  }
  // The taller synthetic panel must be contained, preserving its top and bottom.
  const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', path.join(fixture, report.cells[0].files[0].path), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-frames:v', '1', '-'], { windowsHide: true });
  const left = [...raw.subarray((144 * 512 + 2) * 3, (144 * 512 + 2) * 3 + 3)];
  assert.ok(left.every(v => v > 220), 'a taller panel is padded at the sides rather than cropped vertically');
  const unchangedDraft = fs.readFileSync(draftFile, 'utf8');
  const firstFile = path.join(fixture, report.cells[0].files[0].path), original = fs.readFileSync(firstFile);
  fs.writeFileSync(firstFile, Buffer.alloc(20000));
  assert.throws(() => invoke('--apply-draft'), /Delivery validation failed/);
  assert.equal(fs.readFileSync(draftFile, 'utf8'), unchangedDraft, 'invalid delivery cannot update the draft');
  fs.writeFileSync(firstFile, original);
  writeJson(reportFile, { ...report, deliveryPolicy: 'unknown' });
  assert.throws(() => invoke('--apply-draft'), /Unknown delivery policy/);
  writeJson(reportFile, report);
  invoke('--apply-draft');
  const applied = JSON.parse(fs.readFileSync(draftFile));
  assert.deepEqual(draftModel.validate(applied), []);
  for (const item of applied.items) {
    assert.equal(item.images.wide.length, 1);
    assert.deepEqual(item.images.mobile, item.images.wide);
  }
  const appliedHash = sha(draftFile);
  assert.throws(() => invoke('--source', source), /Refusing to replace existing refs/);
  assert.equal(sha(draftFile), appliedHash);
  assert.equal(sha(source), sourceHash);
  assert.equal(sha(path.join(fixture, report.atlas)), sourceHash);

  // Old reports remain applicable with their original four filenames and dimensions.
  const legacyCell = { ...cells[0], slug: 'fixture-legacy' };
  const legacyManifest = { ...manifest, assetPrefix: undefined, batchId: 'fixture-legacy', cells: [legacyCell] };
  const legacyDraft = { ...draft, items: [draft.items[0]] };
  writeJson(draftFile, legacyDraft);
  writeJson(manifestFile, legacyManifest);
  const atlas = 'ref/words-pic/atlases/fixture-legacy.png';
  const master = 'ref/words-pic/split/masters/fixture-legacy-v1.png';
  fs.copyFileSync(source, path.join(fixture, atlas));
  fs.copyFileSync(path.join(fixture, report.cells[0].master), path.join(fixture, master));
  const files = [];
  for (const profile of ['wide', 'mobile']) for (const format of ['avif', 'webp']) {
    const relative = 'assets/vocab-u99-fixture-legacy-' + profile + '-v1.' + format;
    const file = path.join(fixture, relative);
    const codec = format === 'avif' ? ['-c:v', 'libaom-av1', '-still-picture', '1', '-crf', '50', '-b:v', '0'] : ['-c:v', 'libwebp', '-quality', '35'];
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', path.join(fixture, master), '-vf', 'scale=' + (profile === 'wide' ? 512 : 384) + ':288', '-frames:v', '1', ...codec, file]);
    files.push({ path: relative, bytes: fs.statSync(file).size, sha256: sha(file) });
  }
  writeJson(reportFile, { batchId: legacyManifest.batchId, atlas, atlasSha256: sourceHash, cells: [{ ...legacyCell, master, masterSha256: sha(path.join(fixture, master)), files }] });
  invoke('--apply-draft');
  const legacyApplied = JSON.parse(fs.readFileSync(draftFile)).items[0];
  assert.deepEqual(legacyApplied.images.wide, files.slice(0, 2).map(f => f.path));
  assert.deepEqual(legacyApplied.images.mobile, files.slice(2).map(f => f.path));
  console.log('Atlas packaging: four shared WebP files, full-panel fitting, strict budget, immutable originals, draft validation and legacy report compatibility passed.');
} finally {
  const target = fs.realpathSync(fixture);
  assert.equal(path.dirname(target).toLowerCase(), fs.realpathSync(os.tmpdir()).toLowerCase());
  assert.ok(path.basename(target).startsWith('atlas-single-webp-'));
  fs.rmSync(target, { recursive: true, force: true });
}
