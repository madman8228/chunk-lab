'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const previousPath = path.join(root, 'docs/source-materials/people-grade9-upper-2024-review-v2.json');
const sourcePath = path.join(root, 'docs/source-materials/people-grade9-upper-2024.json');
const scanManifestPath = path.join(root, 'docs/source-materials/people-grade9-upper-2024-scan-recovery-20261021.json');
const outputPath = path.join(root, 'docs/source-materials/people-grade9-upper-2024-review-v3.json');
const scanRoot = path.resolve(process.argv[2] || 'E:/chunk-practice-asset-sources/textbooks/pep-junior-grade9-upper-2024/source-scans/20261021-v1');
const backupRoot = path.resolve(process.argv[3] || 'D:/chunk-practice-backups/pep-grade9-upper-2024-source-pages-20261021');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();

if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite ${outputPath}`);
const previous = JSON.parse(fs.readFileSync(previousPath, 'utf8'));
const sourceBytes = fs.readFileSync(sourcePath);
const source = JSON.parse(sourceBytes.toString('utf8'));
const scanManifest = JSON.parse(fs.readFileSync(scanManifestPath, 'utf8'));
if (previous.reviewStatus !== 'pending-user-review' || previous.sourceAudit?.approval !== 'not approved') {
  throw new Error('Expected an unapproved v2 candidate');
}
if (sha256(sourceBytes) !== previous.sourceAudit.originalSourceSha256.toUpperCase()) throw new Error('Original transcription changed since v2');

for (const page of scanManifest.pages) {
  const expected = page.sha256.toUpperCase();
  const sourceHash = sha256(fs.readFileSync(path.join(scanRoot, page.file)));
  const backupHash = sha256(fs.readFileSync(path.join(backupRoot, page.file)));
  if (sourceHash !== expected || backupHash !== expected) throw new Error(`Source/backup scan hash mismatch: p.${page.page}`);
}

const lines = previous.vocabularyText.split(/\r?\n/).filter(Boolean);
const incorrect = 'Unit 7|tape|磁带；录音带|68';
const corrected = 'Unit 7|tape|磁带；录像带|68';
const matches = lines.flatMap((line, index) => line === incorrect ? [index] : []);
if (matches.length !== 1) throw new Error(`Expected one incorrect v2 tape row, found ${matches.length}`);
lines[matches[0]] = corrected;
const rows = lines.map(line => line.split('|'));
if (lines.length !== 484 || rows.some(row => row.length !== 4)) throw new Error('Unexpected v2 candidate shape');
const keys = rows.map(row => `${row[0]}|${row[1].toLowerCase()}`);
if (new Set(keys).size !== keys.length) throw new Error('Duplicate unit/headword in proposed v3');

const draft = structuredClone(previous);
draft.revision = 'scan-verified-review-v3';
draft.vocabularyText = lines.join('\n');
draft.sourceAudit = {
  ...previous.sourceAudit,
  supersedes: 'people-grade9-upper-2024-review-v2.json',
  v2Sha256: sha256(fs.readFileSync(previousPath)),
  correction: {
    scanPage: 114,
    textbookPage: 68,
    item: 'Unit 7 / tape',
    withdrawnProposal: '磁带；录音带',
    scanVerifiedText: '磁带；录像带',
    evidence: `Both preserved copies of ${scanManifest.pages.find(page => page.page === 114).file} match the scan manifest SHA-256.`
  },
  approval: 'not approved'
};
draft.notes.push('Revision v3 withdraws the v2 tape-gloss change after direct verification against scan page 114; v2 is preserved unchanged. This candidate remains pending user review and must not be used for image/audio production or release.');
fs.writeFileSync(outputPath, `${JSON.stringify(draft, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ outputPath, rows: lines.length, verifiedScans: scanManifest.pages.length, correction: draft.sourceAudit.correction, status: draft.reviewStatus }, null, 2));
