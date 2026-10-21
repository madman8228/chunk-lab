import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {checkTranscription,reviewMarkdown,sourceFile,generateExtraction} from './extract-primary-grade3.mjs';

const data = JSON.parse(fs.readFileSync(sourceFile,'utf8'));
const original = JSON.stringify(data), checked = checkTranscription(data);
assert.deepEqual(checked.summary.unitCounts.map(unit=>unit.entries),[24,26,23,18,26,19]);
assert.equal(checked.summary.entries,136); assert.equal(checked.summary.uniqueTerms,135);
assert.equal(checked.summary.indexEntries,135);
assert.deepEqual(checked.summary.types,{word:114,contraction:5,phrase:6,expression:11});
assert.equal(new Set(checked.records.map(record=>record.entryId)).size,136);
assert.deepEqual(checked.records.filter(record=>record.term==='have').map(record=>[record.unit,record.meaning,record.sourceTextPage]),[['Unit 2','有',16],['Unit 6','吃；喝',68]]);
assert.deepEqual(checked.summary.conflicts,[{term:'doll',unit:'Unit 3',unitListStarred:false,indexStarred:true}]);
assert.equal(data.textbook.series,'精通');assert.equal(data.textbook.edition,null);
assert.ok(!checked.records.some(record=>record.term==='mom'),'alias is not silently turned into an extra textbook entry');
const missing = structuredClone(data);missing.units[0].entries.splice(0,1);
assert.throws(()=>checkTranscription(missing),/未在单元表找到/);
const wrongPage = structuredClone(data);wrongPage.units[0].entries[0][2]=999;
assert.throws(()=>checkTranscription(wrongPage),/页码不同/);
const duplicate = structuredClone(data);duplicate.units[0].entries.push(duplicate.units[0].entries[0]);
assert.throws(()=>checkTranscription(duplicate),/重复转录/);
assert.equal(JSON.stringify(data),original,'read-only verification preserves transcription');
assert.ok(reviewMarkdown(data,checked).includes('教材系列由用户确认为精通'));

// Generate into a new temporary output only; never overwrites the delivered files.
const temp = fs.mkdtempSync(path.join(os.tmpdir(),'textbook-extraction-test-'));
try {
  const destination = path.join(temp,'extraction');
  if(data.images.every(image=>fs.existsSync(image.path))){
    generateExtraction(destination);
    const result=JSON.parse(fs.readFileSync(path.join(destination,'extracted-vocabulary.json'),'utf8'));
    assert.equal(result.records.length,136);
    for(const image of data.images)assert.deepEqual(fs.readFileSync(image.path),fs.readFileSync(path.join(destination,'source-images/image-'+image.id+'.png')));
    const before=fs.readFileSync(path.join(destination,'extracted-vocabulary.json'));
    assert.throws(()=>generateExtraction(destination),/未覆盖/);
    assert.deepEqual(fs.readFileSync(path.join(destination,'extracted-vocabulary.json')),before);
    assert.equal(fs.readFileSync(path.join(destination,'vocabulary.csv'),'utf8').split('\r\n').filter(Boolean).length,137);
  }
}finally{
  assert.equal(path.dirname(temp),os.tmpdir());assert.ok(path.basename(temp).startsWith('textbook-extraction-test-'));
  fs.rmSync(temp,{recursive:true,force:true});
}
console.log('Textbook extraction: six units, 136 sense records, 135 A–Z terms, full page checks, original star discrepancy, image fidelity and overwrite refusal passed.');
