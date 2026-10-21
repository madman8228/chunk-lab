'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const reviewModel=require('./lib/scene-wordbook-review.cjs'),draftModel=require('../js/wordbook-draft'),contract=require('../js/vocabulary-course-contract'),engine=require('../landing/sentence-cloze-engine'),contentModel=require('../js/vocabulary-study.cjs');
const file='drafts/scene-wordbooks/borrow-things-v1/review.json';
(async()=>{
 const bytes=fs.readFileSync(file),review=JSON.parse(bytes),before=JSON.stringify(review);
 const {summary,wordbookPackage}=await reviewModel.prepare(review);
 assert.deepEqual([summary.items,summary.units,summary.dialogues,summary.readings],[6,1,2,1]);
 assert.equal(summary.publishable,false);assert.equal(summary.reviewOnly,true);
 contentModel.validateIndex(wordbookPackage.index);
 for(const item of wordbookPackage.items){
  contract.validateLearning(item,engine);
  const values=Object.fromEntries(engine.blanks(item.exercise).map(blank=>[blank.id,blank.answers[0]]));
  assert.equal(engine.evaluate(item.exercise,values).correct,true);
  assert.equal(engine.evaluate(item.exercise,{}).correct,false);
  assert.equal(contract.capabilities(item,engine).find(row=>row.practiceType==='guided-expression').available,true);
  assert.equal(contract.capabilities(item,engine).find(row=>row.practiceType==='word-dictation').available,false);
 }
 assert.equal(wordbookPackage.published,false);assert.equal(wordbookPackage.assetVerification,'pending');
 await assert.rejects(()=>draftModel.compile(review.wordbook),/插画/,'formal compile still blocks absent assets');
 const reject=(change,pattern)=>{const bad=structuredClone(review);change(bad);assert.throws(()=>reviewModel.validate(bad),pattern);};
 reject(b=>b.review.content='approved',/已审核/);
 reject(b=>b.module='chunks',/场景词汇/);
 reject(b=>b.published=true,/未知字段/);
 reject(b=>b.wordbook.items[0].itemId=b.wordbook.items[1].itemId,/重复/);
 reject(b=>b.materials[0].lines[0].targets=['foreign:word'],/不存在/);
 reject(b=>b.materials[0].lines[0].targets.push(b.materials[0].lines[0].targets[0]),/重复/);
 reject(b=>b.materials[0].unitId='foreign:unit',/单元无效/);
 reject(b=>b.materials[0].materialId=b.materials[1].materialId,/重复/);
 reject(b=>b.materials[0].lines[0].en='This is borrowed.',/未出现/);
 reject(b=>b.materials[0].lines[0].zh='',/双语/);
 reject(b=>delete b.materials[0].lines[0].speaker,/说话人/);
 reject(b=>b.materials.push({...structuredClone(b.materials[2]),materialId:'scene:new',kind:'dictation'}),/类型/);
 reject(b=>b.materials.forEach(m=>m.lines.forEach(line=>line.targets=line.targets.filter(id=>!id.endsWith(':umbrella')))),/未进入/);
 reject(b=>b.wordbook.items[0].guidedSteps[1].answer='lend',/原句|不匹配/);
 reject(b=>b.wordbook.items[0].word='unrelated',/目标词/);
 reject(b=>b.levelProposal='C1',/水平不一致/);
 reject(b=>b.wordbook.items[0].images.wide=['assets/unverified.webp'],/未经核验/);
 // Cross-unit references must fail even if the ID exists in the same book.
 reject(b=>{b.wordbook.book.units.push({unitId:'scene:unit2',title:'另一个单元'});b.wordbook.items[5].unitId='scene:unit2';},/跨单元/);
 assert.equal(JSON.stringify(review),before,'input is immutable');assert.deepEqual(fs.readFileSync(file),bytes,'draft source unchanged');
 const second=await reviewModel.prepare(review);assert.equal(second.wordbookPackage.index.books[0].revision,wordbookPackage.index.books[0].revision,'deterministic content versions');
 console.log('Scene vocabulary review: 6 existing-engine items, 3 linked materials, rejection cases, immutable draft, stable versions and publication block passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
