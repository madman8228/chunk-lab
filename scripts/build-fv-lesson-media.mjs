import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const root='drafts/zero-english/fv-pronunciation-v1/audio-v1/';
const manifest=JSON.parse(fs.readFileSync(root+'manifest.json','utf8')),media={};
for(const row of manifest.audio){const bytes=fs.readFileSync(root+row.file);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),row.sha256);media[row.id]='data:audio/mpeg;base64,'+bytes.toString('base64');}
assert.equal(Object.keys(media).length,8);
fs.writeFileSync('js/pronunciation-fv-media.js','// Whole-word listening candidates; not isolated phoneme recordings or approved releases.\nwindow.FvLessonMedia='+JSON.stringify(media)+';\n');
console.log('Eight word recordings verified and bundled for the standalone lesson.');
