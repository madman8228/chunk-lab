import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {pepSourceFile,checkPepTranscription,generatePepExtraction,pepReviewMarkdown} from './extract-primary-pep-grade3.mjs';

const data=JSON.parse(fs.readFileSync(pepSourceFile,'utf8')),before=JSON.stringify(data),checked=checkPepTranscription(data);
assert.deepEqual(checked.summary.unitCounts.map(unit=>unit.entries),[15,19,22,19,17,16]);
assert.deepEqual(data.units.map(unit=>unit.contentsStartPage),[2,14,26,38,50,62]);
assert.equal(checked.summary.entries,108);assert.equal(checked.summary.uniqueTerms,107);
assert.equal(checked.summary.indexEntries,107);assert.deepEqual(checked.summary.conflicts,[]);
assert.deepEqual(checked.summary.expressionCounts.map(unit=>unit.entries),[9,5,11,7,8,11]);
assert.equal(checked.expressions.length,51);
assert.deepEqual(checked.records.filter(row=>row.term==='orange').map(row=>[row.unitId,row.meaning,row.sourceTextPage]),[
 ['unit-4','橙子；柑橘',41],['unit-5','橙红色；橙红色的',52]
]);
for(const term of ['smile','purple','one','five','ten']){
 const record=checked.records.find(row=>row.term===term);assert.equal(record.starred,false);assert.equal(record.bold,true);
}
const redPanda=checked.records.find(row=>row.term==='red panda');
assert.equal(redPanda.type,'phrase');assert.equal(redPanda.phoneticScope,'red-only');assert.equal(redPanda.phonetic,'/red/');
assert.equal(checked.expressions.find(row=>row.english==='Use again!').unitId,'unit-5');
assert.deepEqual(checked.expressions.filter(row=>row.english==="No, I don't.").map(row=>row.chinese),['不，我没有。','不，我不喜欢。']);
assert.equal(data.textbook.series,'PEP');assert.equal(data.textbook.edition,null);
assert.ok(!data.units[2].title.includes('Amazing animals'),'use supplied contents title, not a different online edition');
const bad=structuredClone(data);bad.units[0].entries[0][7]='';assert.throws(()=>checkPepTranscription(bad),/音标不能为空/);
assert.equal(JSON.stringify(data),before,'verification does not rewrite source transcription');
assert.ok(pepReviewMarkdown(data,checked).includes('与前一批 136 条'));

const oldSource=new URL('../docs/source-materials/primary-grade3-upper-20261014.json',import.meta.url);
const oldHash=crypto.createHash('sha256').update(fs.readFileSync(oldSource)).digest('hex');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pep-extraction-test-'));
try{
 if(data.images.every(image=>fs.existsSync(image.path))){
  const directory=path.join(temp,'pep');generatePepExtraction(directory);
  const artifact=JSON.parse(fs.readFileSync(path.join(directory,'extracted-vocabulary.json'),'utf8'));
  assert.equal(artifact.records.length,108);assert.equal(artifact.usefulExpressions.length,51);
  assert.equal(artifact.sourceImages.length,11);
  for(const image of data.images)assert.deepEqual(fs.readFileSync(image.path),fs.readFileSync(path.join(directory,'source-images/image-'+image.id+'.png')));
  assert.equal(fs.readFileSync(path.join(directory,'vocabulary.csv'),'utf8').split('\r\n').filter(Boolean).length,109);
  assert.equal(fs.readFileSync(path.join(directory,'expressions.csv'),'utf8').split('\r\n').filter(Boolean).length,52);
  assert.throws(()=>generatePepExtraction(directory),/未覆盖/);
 }
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(oldSource)).digest('hex'),oldHash,'previous non-PEP-identified source remains unchanged');
}finally{
 assert.equal(path.dirname(temp),os.tmpdir());assert.ok(path.basename(temp).startsWith('pep-extraction-test-'));
 fs.rmSync(temp,{recursive:true,force:true});
}
console.log('PEP extraction: six exact unit titles, 108 sense records, 107 indexed terms, 51 expression rows, phonetic preservation, sense separation and both batches protected.');
