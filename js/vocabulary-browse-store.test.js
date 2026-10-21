'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'vocabulary-browse-store.js'),'utf8');
function fixture(){
 const plan={bookId:'book',bookRevision:'book-revision',revision:'plan',firstStepId:'one',lastStepId:'three',unitId:null};
 const rows=[{requestId:'first',owner:'owner',scope:'scope',status:'blocked',lastError:'RESUME_CONFLICT',operation:{type:'vocabulary.browse',payload:{bookId:'book',bookRevision:plan.bookRevision,planRevision:'plan',stepId:'one',action:'continue',targetStepId:'two'}}},{requestId:'second',owner:'owner',scope:'scope',status:'pending',operation:{type:'vocabulary.browse',payload:{bookId:'book',bookRevision:plan.bookRevision,planRevision:'plan',stepId:'two',action:'continue',targetStepId:'three',afterRequestId:'first'}}}];
 let identity='identity',fail=false,changed=false,reads=0;const requests=[],resolutions=[],meta={};
 const window={LearningSessionBootstrap:{identity:()=>identity},AccountStorage:{owner:'owner',assertCurrent(){}},ChunkAPI:{getBase:()=>'/api',request:async url=>{requests.push(url);if(fail)throw Error('offline');if(url.includes('browse-state'))return {canPersist:true,plan,resumeRev:9,resume:{stepId:'two'}};const id=new URL('http://test'+url).searchParams.get('stepId');return {plan,step:{stepId:id}};}},ServerStore:{pending:async()=>{reads++;return structuredClone(changed&&reads>1?rows.slice(0,1):rows);}}};
 window.IDBStore={updateSyncMeta:async(key,reduce)=>{meta[key]=reduce(meta[key]||{key});}};
 window.ServerCache={read:async()=>null};
 window.ServerStore.resolveVocabularyBrowseConflict=async(selection,reviewed)=>{
  resolutions.push(structuredClone({selection,reviewed}));rows.splice(0,rows.length);
  if(selection.choice==='local')rows.push({requestId:'replacement',owner:'owner',scope:'scope',status:'pending',operation:{type:'vocabulary.browse',payload:{bookId:'book',bookRevision:plan.bookRevision,planRevision:'plan',action:'jump',stepId:reviewed.stepId,targetStepId:reviewed.targetStepId,expectedResumeRev:reviewed.resumeRev}}});
  return {cloud:{canPersist:true,plan,resumeRev:9,resume:{stepId:'two',status:'active'}},archive:{key:'archive'}};
 };
 vm.runInNewContext(source,{window,...window});
 return {store:window.VocabularyBrowseStore.create({bookId:'book',planRevision:'plan'}),rows,plan,requests,resolutions,offline(){fail=true;},changeQueue(){changed=true;},changeIdentity(){identity='other';}};
}
(async()=>{
 let f=fixture(),review=await f.store.reviewConflict();assert.equal(review.cloud.resumeRev,9);assert.equal(review.cloudStep.step.stepId,'two');assert.equal(review.localStep.step.stepId,'three');assert.deepEqual(Array.from(review.selection.requestIds),['first','second']);assert.equal(review.selection.confirmed,undefined,'read-only review must not imply confirmation');assert.equal(f.requests.length,3);
 f=fixture();f.offline();await assert.rejects(f.store.reviewConflict(),/offline/);
 f=fixture();f.rows[1].operation.payload.afterRequestId='unrelated';await assert.rejects(f.store.reviewConflict(),/冲突链/);
 f=fixture();f.rows[1].receipt={seq:8};await assert.rejects(f.store.reviewConflict(),/冲突链/);
 f=fixture();f.changeQueue();await assert.rejects(f.store.reviewConflict(),/待保存记录已变化/);
 f=fixture();f.changeIdentity();await assert.rejects(f.store.reviewConflict(),/账号或服务已变化/);
 f=fixture();f.plan.unitId='other-unit';await assert.rejects(f.store.reviewConflict(),/课程或保存资格/);
 f=fixture();review=await f.store.reviewConflict();await assert.rejects(f.store.resolveConflict(review,'cloud',{}),/明确确认/);await assert.rejects(f.store.resolveConflict({},'cloud',{confirmed:true}),/明确确认/);assert.equal(f.resolutions.length,0);assert.equal(f.rows.length,2);
 review.cloud.resumeRev=100;review.selection.requestIds.push('tampered');review.localStep.step.stepId='tampered';
 let state=await f.store.resolveConflict(review,'local',{confirmed:true});assert.equal(f.resolutions[0].reviewed.resumeRev,9);assert.equal(f.resolutions[0].reviewed.targetStepId,'three');assert.deepEqual(Array.from(f.resolutions[0].selection.requestIds),['first','second']);assert.equal(state.cursor.stepId,'three');assert.equal(state.pending,1);assert.equal(state.archive.key,'archive');await assert.rejects(f.store.resolveConflict(review,'local',{confirmed:true}),/明确确认/);
 f=fixture();review=await f.store.reviewConflict();state=await f.store.resolveConflict(review,'cloud',{confirmed:true});assert.equal(state.cursor.stepId,'two');assert.equal(state.pending,0);
 console.log('Vocabulary browse conflict review and explicit resolution passed: fresh cloud, exact chain, immutable review, new local request or read-only cloud choice');
})().catch(error=>{console.error(error);process.exitCode=1;});
