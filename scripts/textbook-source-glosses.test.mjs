import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..','output/textbook-extractions');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
let total=0,pending=0;
for(const [volume,count,missingCount] of [[1,326,6],[2,349,1],[3,393,2]]){
 const dir=path.join(root,`highschool-pep-required${volume}-2019-20261016`),file=JSON.parse(fs.readFileSync(path.join(dir,'source-glosses-v3.json'))),extra=JSON.parse(fs.readFileSync(path.join(dir,'source-missing-entries-v1.json')));
 assert.equal(file.entries.length,count);assert.equal(extra.entries.length,missingCount);
 const entries=[...file.entries,...extra.entries];assert.equal(new Set(entries.map(e=>e.itemId)).size,entries.length);
 assert.equal(hash(fs.readFileSync(path.join(dir,file.sourceText))),file.sourceTextSha256);
 for(const scan of file.sourceScans)assert.equal(hash(fs.readFileSync(path.join(dir,scan.file))),scan.sha256);
 const lines=fs.readFileSync(path.join(dir,file.sourceText),'utf8').split(/\r?\n/);
 for(const e of entries){assert.ok(e.meaning?.trim());assert.equal(e.sourceKind,'supplied-textbook-vocabulary-page');assert.ok(fs.existsSync(path.join(dir,e.sourceImage)));assert.ok(lines[e.sourceLine-1].includes('|'));}
 if(volume===1){assert.equal(entries.find(e=>e.headword==='exchange').meaning,'n. 交换；交流 vt. 交换；交流；交易；兑换');assert.equal(entries.find(e=>e.headword==='extra-curricular').sourceUnit,'Unit 1');}
 if(volume===2)assert.ok(entries.find(e=>e.headword==='absorbed in sth/sb').reviewIssue);
 if(volume===3){assert.equal(entries.find(e=>e.originalHeadword==='consult').headword,'consulate');assert.equal(entries.find(e=>e.headword==='resource').sourceUnit,'Unit 4');assert.equal(entries.find(e=>e.headword==='to be honest').sourceUnit,'Unit 5');}
 total+=file.entries.length;pending+=extra.entries.length;
}
assert.equal(total,1068);assert.equal(pending,9);
console.log('1068个配图词条及9个补录词条：释义完整、ID唯一、扫描及转录哈希一致、来源位置存在；单元和短语修正核对通过。');
