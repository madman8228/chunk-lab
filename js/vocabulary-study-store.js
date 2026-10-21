(function(global){
  'use strict';
  const identity=()=>LearningSessionBootstrap.identity();
  const localWrites=new Set();
  async function waitForLocalWrites(){const captured=identity();await Promise.all([...localWrites]);if(identity()!==captured)throw Error('账号已变化');}
  async function pending(bookId,unitId,practiceType){const captured=identity(),rows=await ServerStore.pending();if(identity()!==captured)throw Error('账号已变化');
    return rows.filter(row=>row.owner===AccountStorage.owner&&['vocabulary.session','vocabulary.complete','vocabulary.rehearse','vocabulary.attempt'].includes(row.operation?.type)&&row.operation.payload.bookId===bookId&&(row.operation.payload.unitId||undefined)===unitId&&
      (VocabularyCourseContract.separatePractice(practiceType)?row.operation.payload.practiceType===practiceType:!VocabularyCourseContract.separatePractice(row.operation.payload.practiceType)));}
  async function state(bookId,offset=0,scope={}){const captured=identity();const query=(scope.unitId?'&unitId='+encodeURIComponent(scope.unitId)+'&structureRevision='+encodeURIComponent(scope.structureRevision):'')+(VocabularyCourseContract.separatePractice(scope.practiceType)?'&practiceType='+encodeURIComponent(scope.practiceType):'');const row=await ChunkAPI.request('/api/wordbooks/'+encodeURIComponent(bookId)+'/state?offset='+offset+'&limit=20'+query);
    AccountStorage.assertCurrent();if(identity()!==captured)throw Error('账号已变化');return row;}
  async function submit(type,payload,requestId=crypto.randomUUID()){
    const captured=identity(),commit=ServerStore.submitCommitted(type,payload,{requestId});
    const durable=commit.durable||commit;localWrites.add(durable);durable.then(()=>localWrites.delete(durable),()=>localWrites.delete(durable));
    const receipt=await commit;AccountStorage.assertCurrent();if(identity()!==captured)throw Error('账号已变化，原记录保留');return receipt;}
  global.VocabularyStudyStore={pending,state,submit,waitForLocalWrites};
})(window);
