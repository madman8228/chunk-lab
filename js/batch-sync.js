/* Durable conditional requests. Baselines must come from an accepted read,
 * never from a last-second fetch that rebases an existing local edit. */
(function(g){
  'use strict';
  var KEY='conditional-batch-v1';
  function fail(code,message){var e=new Error(message);e.code=code;throw e;}
  function validSeq(n){return Number.isSafeInteger(n) && n>=0;}
  async function change(reduce){
    g.AccountStorage.assertCurrent();
    return g.IDBStore.updateSyncMeta(KEY,function(record){
      record=record || {key:KEY,owner:g.AccountStorage.owner,baseline:null,pending:null};
      if(!record.owner) record.owner=g.AccountStorage.owner;
      if(record.baseline===undefined) record.baseline=null;
      if(record.pending===undefined) record.pending=null;
      if(record.acceptedSeq===undefined) record.acceptedSeq=record.baseline;
      if(record.localGeneration===undefined) record.localGeneration=0;
      if(record.acceptedGeneration===undefined) record.acceptedGeneration=record.localGeneration;
      if(record.status===undefined) record.status=record.pending ? 'pending' : (record.baseline===null ? 'needs-reconcile' : 'clean');
      if(record.owner!==g.AccountStorage.owner)fail('SESSION_CHANGED','同步请求账号不一致');
      return reduce(record);
    });
  }
  function lock(work){
    if(!g.navigator.locks)return Promise.reject(new Error('此浏览器不支持安全同步协调'));
    return g.navigator.locks.request('chunklab-batch-'+g.AccountStorage.owner,work);
  }
  async function state(){return change(function(r){return JSON.parse(JSON.stringify(r));});}
  async function observe(seq,expected){
    if(!validSeq(seq))fail('INVALID_BASE','云端版本无效');
    return lock(function(){return change(function(r){
      if(r.pending)fail('BATCH_PENDING','原请求尚未确认，不能推进云端基线');
      if(r.baseline!==expected)fail('BASE_CHANGED','其他页面已改变同步基线，请重新核对');
      r.baseline=seq;r.acceptedSeq=seq;r.acceptedGeneration=r.localGeneration;
      r.status='clean';return seq;
    });});
  }
  async function stage(payload,expected,expectedGeneration,operationReceipts){
    // Clone now: subsequent UI edits must not mutate a request waiting on IDB.
    var snapshot=JSON.parse(JSON.stringify(payload));
    if(!validSeq(expected))fail('UNKNOWN_BASE','缺少已确认的云端基线，不能提交旧数据');
    if(snapshot.baseSeq!==undefined || snapshot.requestId!==undefined)fail('INVALID_BATCH','请求编号与基线由持久队列管理');
    return lock(function(){return change(function(r){
      if(r.pending)fail('BATCH_PENDING','原请求仍待确认，新改动保留在本地');
      if(r.baseline!==expected)fail('BASE_CHANGED','旧页面不能使用新同步基线提交');
      if(expectedGeneration!==undefined && r.localGeneration!==expectedGeneration){
        fail('GENERATION_CHANGED','本地数据已在组装请求后变化，请重新生成请求');
      }
      r.pending={...snapshot,baseSeq:expected,requestId:g.crypto.randomUUID(),capturedGeneration:r.localGeneration,
        operationReceipts:Array.isArray(operationReceipts) ? JSON.parse(JSON.stringify(operationReceipts)) : []};
      r.status='pending';
      return JSON.parse(JSON.stringify(r.pending));
    });});
  }
  async function retry(){return lock(async function(){
    var record=await state();
    if(!record.pending)return null;
    var receipt=await g.ChunkAPI.putData(record.pending);
    g.AccountStorage.assertCurrent();
    if(!receipt || receipt.ok!==true || !validSeq(receipt.seq) || receipt.seq<=record.pending.baseSeq)fail('INVALID_RECEIPT','服务器未返回有效提交回执，请求仍保留');
    if(!g.IDBStore || typeof g.IDBStore.acknowledgeConditionalBatch!=='function')
      fail('STORAGE_UPGRADE_REQUIRED','当前存储不支持原子确认，请升级页面');
    await g.IDBStore.acknowledgeConditionalBatch('conditional-batch-v1',record.pending.requestId,
      receipt.seq,record.pending.capturedGeneration,record.pending.operationReceipts);
    // This seq describes this commit, not the latest server state. The caller
    // must compare newer local edits/remote state before preparing a successor.
    return {receipt:receipt,payload:record.pending};
  });}
  async function noteLocalGeneration(generation){
    if(!Number.isSafeInteger(generation) || generation<0) fail('INVALID_GENERATION','本地代次无效');
    return change(function(r){
      if(generation>r.localGeneration) r.localGeneration=generation;
      if(r.pending) r.status='pending'; else if(r.baseline===null) r.status='needs-reconcile'; else if(r.localGeneration>r.acceptedGeneration) r.status='dirty';
      return r;
    });
  }
  async function finishResolution(seq,requestId){
    if(!validSeq(seq))fail('INVALID_RECEIPT','整账号处理未返回有效版本');
    return lock(function(){return change(function(r){
      if(r.pending && (!requestId || r.pending.requestId!==requestId))fail('BATCH_CHANGED','待发请求已变化，不能确认整账号处理');
      r.baseline=seq;r.acceptedSeq=seq;r.acceptedGeneration=r.localGeneration;r.pending=null;r.status='clean';
      return r;
    });});
  }
  g.BatchSync={state:state,observe:observe,stage:stage,retry:retry,noteLocalGeneration:noteLocalGeneration,finishResolution:finishResolution};
})(window);
