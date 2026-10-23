'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
const writeJson = (file, data) => fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, { flag: 'wx' });

test('builds an additive pending v3, checks both scan copies and preserves prior drafts', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'grade9-review-v3-'));
  try {
    const project = path.join(temp, 'project');
    const sourceRoot = path.join(temp, 'source-scans');
    const backupRoot = path.join(temp, 'backup-scans');
    const docs = path.join(project, 'docs/source-materials');
    const scripts = path.join(project, 'scripts');
    fs.mkdirSync(docs, { recursive: true });
    fs.mkdirSync(scripts, { recursive: true });
    fs.mkdirSync(sourceRoot);
    fs.mkdirSync(backupRoot);
    fs.copyFileSync(path.join(__dirname, 'build-grade9-upper-2024-review-v3.cjs'), path.join(scripts, 'build-grade9-upper-2024-review-v3.cjs'));

    const original = { vocabularyText: Array.from({ length: 477 }, (_, index) => `Unit 1|source-${index}|gloss|1`).join('\n') };
    const originalBytes = Buffer.from(`${JSON.stringify(original)}\n`);
    const originalPath = path.join(docs, 'people-grade9-upper-2024.json');
    fs.writeFileSync(originalPath, originalBytes);
    const rows = Array.from({ length: 483 }, (_, index) => `Unit 1|term-${index}|gloss|1`);
    rows.push('Unit 7|tape|磁带；录音带|68');
    const previousPath = path.join(docs, 'people-grade9-upper-2024-review-v2.json');
    const previous = {
      reviewStatus: 'pending-user-review',
      vocabularyText: rows.join('\n'),
      sourceAudit: { originalSourceSha256: hash(originalBytes).toLowerCase(), approval: 'not approved', suppliedScanPages: [] },
      notes: ['prior candidate note']
    };
    writeJson(previousPath, previous);
    const manifest = { pages: [] };
    for (let page = 107; page <= 116; page++) {
      const file = `p${page}.png`, bytes = Buffer.from(`synthetic scan ${page}`);
      fs.writeFileSync(path.join(sourceRoot, file), bytes);
      fs.writeFileSync(path.join(backupRoot, file), bytes);
      manifest.pages.push({ page, file, sha256: hash(bytes) });
    }
    writeJson(path.join(docs, 'people-grade9-upper-2024-scan-recovery-20261021.json'), manifest);
    const previousBytes = fs.readFileSync(previousPath);
    const invoke = () => execFileSync(process.execPath, [path.join(scripts, 'build-grade9-upper-2024-review-v3.cjs'), sourceRoot, backupRoot], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });

    invoke();
    const outputPath = path.join(docs, 'people-grade9-upper-2024-review-v3.json');
    const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    assert.equal(output.vocabularyText.split('\n').length, 484);
    assert.ok(output.vocabularyText.includes('Unit 7|tape|磁带；录像带|68'));
    assert.ok(!output.vocabularyText.includes('Unit 7|tape|磁带；录音带|68'));
    assert.equal(output.reviewStatus, 'pending-user-review');
    assert.equal(output.sourceAudit.approval, 'not approved');
    assert.equal(output.sourceAudit.supersedes, 'people-grade9-upper-2024-review-v2.json');
    assert.equal(hash(fs.readFileSync(previousPath)), hash(previousBytes));
    assert.deepEqual(fs.readFileSync(originalPath), originalBytes);
    assert.throws(invoke, /Refusing to overwrite/);
  } finally {
    const target = fs.realpathSync(temp);
    assert.equal(path.dirname(target).toLowerCase(), fs.realpathSync(os.tmpdir()).toLowerCase());
    assert.ok(path.basename(target).startsWith('grade9-review-v3-'));
    fs.rmSync(target, { recursive: true, force: true });
  }
});
