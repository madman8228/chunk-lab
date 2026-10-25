import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const dir='drafts/zero-english/progressive-building-v1/',raw=fs.readFileSync(dir+'lesson-design.json');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const approval=JSON.parse(fs.readFileSync(dir+'content-approval-20261024.json','utf8'));assert.equal(hash(raw),approval.sourceFileSha256);assert.equal(approval.contentReview,'approved');
const design=JSON.parse(raw),manifest=JSON.parse(fs.readFileSync(dir+'audio-v1/manifest.json','utf8')),audio={};assert.equal(manifest.sourceFileSha256,hash(raw));
for(const row of manifest.audio){const bytes=fs.readFileSync(dir+'audio-v1/'+row.file);assert.equal(hash(bytes),row.sha256);audio[row.id]='data:audio/mpeg;base64,'+bytes.toString('base64');}
assert.equal(Object.keys(audio).length,9);
fs.writeFileSync('js/progressive-building-preview-data.js','// Standalone teaching candidate; not a published assessment package.\nwindow.ProgressiveBuildingPreview='+JSON.stringify({design,audio})+';\n');
console.log('Approved teaching design and nine audio candidates bound to preview.');
