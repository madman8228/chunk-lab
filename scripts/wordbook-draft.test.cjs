'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const draftModel=require('../js/wordbook-draft'),model=require('../js/vocabulary-study.cjs');
const engine=require('../landing/sentence-cloze-engine'),contract=require('../js/vocabulary-course-contract');
(async()=>{
 const exercise=draftModel.exercise('Can I [borrow] your charger?');
 assert.equal(engine.sentence(exercise),'Can I borrow your charger?');assert.throws(()=>draftModel.exercise('Can I borrow?'),/填空/);
 const steps=draftModel.guidedSteps('我可以吗 | Can I | I can\n借入 | borrow | lend\n你的 | your | my\n充电器 | charger? | phone?',exercise);
 const item={itemId:'new:borrow',unitId:'u1',word:'borrow',meaning:'借入',scene:'向朋友借充电器',translation:'我可以借你的充电器吗？',exercise,guidedSteps:steps,images:{wide:['assets/test.webp'],mobile:['assets/test.webp']}};
 const draft={schemaVersion:1,book:{bookId:'new-book',title:'独立夹具',units:[{unitId:'u1',title:'借用物品'}],catalog:{facets:{schoolStages:['小学'],grades:['三年级']}}},items:[item]};
 const before=JSON.stringify(draft);assert.deepEqual(draftModel.validate(draft),[]);
 const linked=structuredClone(draft);linked.book.relatedCourseIds=['course:user-deck:beginner'];
 const linkedPackage=await draftModel.compile(linked);
 assert.deepEqual(linkedPackage.index.books[0].relatedCourseIds,linked.book.relatedCourseIds);
 assert.deepEqual(contract.details(linkedPackage.index.books[0]).relatedCourseIds,linked.book.relatedCourseIds);
 for(const ids of [['course:user-deck:beginner','course:user-deck:beginner'],['wordbook:bad'],['course:<script>'],Array.from({length:21},(_,i)=>'course:'+i),null]){
  assert.ok(draftModel.validate({...linked,book:{...linked.book,relatedCourseIds:ids}}).some(x=>x.includes('关联课程')));
 }
 assert.ok(draftModel.validate({...draft,items:[{...item,images:{}}]}).some(x=>x.includes('插画')));
 assert.ok(draftModel.validate({...draft,book:{...draft.book,bookId:'pilot-six-v1'}}).some(x=>x.includes('替换')));
 assert.ok(draftModel.validate({...draft,items:[item,item]}).some(x=>x.includes('重复')));
 const result=await draftModel.compile(draft);model.validateIndex(result.index);contract.validateLearning(result.items[0],engine);
 assert.equal(result.index.books[0].revision,linkedPackage.index.books[0].revision,'association does not invalidate learning content revisions');
 const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex'),{contentRevision,...body}=result.items[0];assert.equal(hash(body),contentRevision);
 assert.equal(result.index.books[0].structureRevision,hash(result.index.books[0].units));assert.equal(result.published,false);assert.equal(result.assetVerification,'pending');assert.equal(JSON.stringify(draft),before);
 console.log('Wordbook draft: explicit blanks, guided content, independent IDs, missing assets, duplicate rejection, immutable input and versioned package preparation passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
