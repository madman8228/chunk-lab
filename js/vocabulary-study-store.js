(function(global){
  'use strict';
  const identity=()=>LearningSessionBootstrap.identity();
  const localWrites=new Set();
  let unit=null;
  const offline=()=>navigator.onLine===false||CL.getPersistenceState?.()==='offline';
  async function scopeKey(bookId,scope){
    const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
    const key=scope.unitId?'unit:'+await hash([bookId,scope.unitId]):bookId;
    return VocabularyCourseContract.separatePractice(scope.practiceType)?'practice:'+await hash([key,scope.practiceType]):key;
  }
  async function waitForLocalWrites(){const captured=identity();await Promise.all([...localWrites]);if(identity()!==captured)throw Error('账号已变化');}
  async function pending(bookId,unitId,practiceType){const captured=identity(),rows=await ServerStore.pending();if(identity()!==captured)throw Error('账号已变化');
    return rows.filter(row=>row.owner===AccountStorage.owner&&['vocabulary.session','vocabulary.complete','vocabulary.rehearse','vocabulary.attempt'].includes(row.operation?.type)&&row.operation.payload.bookId===bookId&&(row.operation.payload.unitId||undefined)===unitId&&
      (VocabularyCourseContract.separatePractice(practiceType)?row.operation.payload.practiceType===practiceType:!VocabularyCourseContract.separatePractice(row.operation.payload.practiceType)));}
  async function state(bookId,offset=0,scope={}){const captured=identity(),key='vocabulary-confirmed-state:'+JSON.stringify([ChunkAPI.getBase(),AccountStorage.owner,bookId,scope.unitId||null,scope.practiceType||null]);
    const guard=()=>{AccountStorage.assertCurrent();if(identity()!==captured)throw Error('账号已变化');};
    const query=(scope.unitId?'&unitId='+encodeURIComponent(scope.unitId)+'&structureRevision='+encodeURIComponent(scope.structureRevision):'')+(VocabularyCourseContract.separatePractice(scope.practiceType)?'&practiceType='+encodeURIComponent(scope.practiceType):'');
    if(!unit||!offline())try{const row=await ChunkAPI.request('/api/wordbooks/'+encodeURIComponent(bookId)+'/state?offset='+offset+'&limit=20'+query);guard();if(unit)await IDBStore.updateSyncMeta(key,()=>({key,state:row}));guard();return row;}catch(error){guard();if(!unit||!(error instanceof TypeError||error.name==='AbortError'||error.code==='REQUEST_TIMEOUT'))throw error;}
    const local=await IDBStore.readSyncMeta(key);guard();
    if(!local?.state||local.state.bookRevision!==unit.revision)throw Error('本账号在此版本的学习位置尚未保存，请联网进入一次。');
    const value=structuredClone(local.state),cache=await ServerCache.read(),id=await scopeKey(bookId,scope);guard();
    const resume=cache?.snapshot?.mem?.vocabularyResume?.[id],rev=cache?.snapshot?.revs?.vocabularyResume?.[id];
    if(resume?.bookRevision===unit.revision&&Number.isSafeInteger(rev)&&rev>=value.resumeRev){value.resume=resume;value.resumeRev=rev;}
    const rows=await pending(bookId,scope.unitId,scope.practiceType);guard();
    for(const row of rows){if(row.receipt||row.status==='deferred-version')continue;if(row.status==='blocked')throw Error('待保存记录需要联网核对，原记录已保留。');const op=row.operation,p=op.payload;if(p.bookRevision!==unit.revision)throw Error('旧版练习仍待保存，请联网核对。');
      if(op.type==='vocabulary.session'&&p.action==='start')value.resume={bookId,bookRevision:unit.revision,itemId:p.itemId,sessionId:p.sessionId,status:'in-progress',practiceType:p.practiceType};
      if(op.type==='vocabulary.complete'||op.type==='vocabulary.rehearse'){
        const next=unit.items.findIndex(item=>item.itemId===p.itemId)+1;
        value.resume={...value.resume,itemId:unit.items[next]?.itemId||null,status:next>=unit.items.length?'completed':'in-progress'};
      }
    }
    value.resumePosition=value.resume?.status==='completed'?unit.items.length:value.resume?unit.items.findIndex(item=>item.itemId===value.resume.itemId):0;
    value.offline=true;return value;}
  async function submit(type,payload,requestId=crypto.randomUUID()){
    const captured=identity(),commit=unit&&offline()?ServerStore.submit(type,payload,{requestId}):ServerStore.submitCommitted(type,payload,{requestId});
    const durable=commit.durable||commit;localWrites.add(durable);durable.then(()=>localWrites.delete(durable),()=>localWrites.delete(durable));
    const receipt=await commit;AccountStorage.assertCurrent();if(identity()!==captured)throw Error('账号已变化，原记录保留');return receipt;}
  global.VocabularyStudyStore={pending,state,submit,waitForLocalWrites,useUnit:value=>{unit=value;},offline};
})(window);
