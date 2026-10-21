'use strict';
const assert=require('node:assert/strict');
global.window=global;let identity='A',pending=[];
global.AccountStorage={owner:'A',assertCurrent(){}};
global.LearningSessionBootstrap={identity:()=>identity};
global.ChunkAPI={request:async()=>({canPersist:true})};
global.ServerStore={pending:async()=>pending,submitCommitted:async()=>({ok:true})};
global.VocabularyCourseContract=require('./vocabulary-course-contract');
require('./vocabulary-study-store');
(async()=>{
  pending=[{owner:'A',operation:{type:'vocabulary.complete',payload:{bookId:'six'}}},{owner:'B',operation:{type:'vocabulary.complete',payload:{bookId:'six'}}},{owner:'A',operation:{type:'workspace.select',payload:{bookId:'six'}}}];
  assert.equal((await VocabularyStudyStore.pending('six')).length,1);
  pending.push({owner:'A',operation:{type:'vocabulary.attempt',payload:{bookId:'six',practiceType:'word-choice'}}},{owner:'B',operation:{type:'vocabulary.attempt',payload:{bookId:'six',practiceType:'word-choice'}}},{owner:'A',operation:{type:'vocabulary.attempt',payload:{bookId:'six',unitId:'u1',practiceType:'word-choice'}}});assert.equal((await VocabularyStudyStore.pending('six',undefined,'word-choice')).length,1);assert.equal((await VocabularyStudyStore.pending('six','u1','word-choice')).length,1);assert.equal((await VocabularyStudyStore.pending('six')).length,1);
  let resolveRead;ChunkAPI.request=()=>new Promise(resolve=>{resolveRead=resolve;});const read=VocabularyStudyStore.state('six');identity='B';resolveRead({canPersist:true,resume:{bookId:'six'}});await assert.rejects(read,/账号已变化/);
  identity='A';let resolveWrite;ServerStore.submitCommitted=()=>new Promise(resolve=>{resolveWrite=resolve;});const write=VocabularyStudyStore.submit('vocabulary.complete',{bookId:'six'},'isolated-request-id');identity='B';resolveWrite({ok:true});await assert.rejects(write,/账号已变化/);
  console.log('vocabulary study store: scoped pending records and stale read/write rejection passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
