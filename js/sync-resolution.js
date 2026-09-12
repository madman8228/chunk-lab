/* User-confirmed sync resolution. A separate small IDB journal survives failed HTTP
   replies/reloads without putting course images into localStorage. */
(function(global){
  'use strict';
  var opening, active = null;
  function scope(){
    var token = global.ChunkAPI.getToken(), uid = 'open';
    if(token){
      try {
        var payload = JSON.parse(global.atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
        if(payload.uid == null) throw new Error('missing uid');
        uid = String(payload.uid);
      }
      catch(e){ throw new Error('登录状态无法识别，请重新登录'); }
    }
    return global.ChunkAPI.getBase().replace(/\/+$/, '') + '|' + uid;
  }
  function db(){
    if(!opening) opening = new Promise(function(resolve,reject){
      if(!global.indexedDB) return reject(new Error('浏览器存储不可用，无法备份处理请求'));
      var blocked = false, req = global.indexedDB.open('chunklab-sync-recovery', 1);
      req.onupgradeneeded = function(){ req.result.createObjectStore('pending'); };
      req.onsuccess = function(){
        if(blocked){ req.result.close(); return; }
        req.result.onversionchange = function(){ req.result.close(); opening = null; };
        resolve(req.result);
      };
      req.onblocked = function(){ blocked = true; reject(new Error('恢复存储被其他页面占用，请关闭旧页面后重试')); };
      req.onerror = function(){ reject(req.error); };
    }).catch(function(e){ opening = null; throw e; });
    return opening;
  }
  async function journal(op, key, value){
    var connection = await db();
    return new Promise(function(resolve,reject){
      var tx = connection.transaction('pending', op === 'get' ? 'readonly' : 'readwrite');
      var store = tx.objectStore('pending');
      var req = op === 'get' ? store.get(key) : op === 'put' ? store.put(value,key) : store.delete(key);
      tx.oncomplete = function(){ resolve(req.result); };
      tx.onerror = tx.onabort = function(){ reject(tx.error || new Error('处理请求保存失败')); };
    });
  }
  async function restorePause(){
    try { var pending = await journal('get', scope()); global.CL.setResolutionPaused(!!pending || !!active); return pending || null; }
    catch(e){ global.CL.setResolutionPaused(true); throw e; }
  }
  async function preview(){
    var pending = await restorePause();
    if(pending) return { pending: true, ...pending.preview };
    var conflict = (global.CL.getSyncConflict() || [])[0];
    /* A restored namespace is deliberately held locally.  It has no normal
       409 marker yet, but it still needs the account-level comparison entry
       point before cloud sync can be resumed. */
    var held = false;
    try { held = !!(global.AccountStorage && global.AccountStorage.storage.getItem('chunklab.restore-cloud-hold')); } catch(e) { throw e; }
    if(!conflict && held && global.ChunkAPI.getSyncBatch){
      var heldBatch = await global.ChunkAPI.getSyncBatch();
      var heldState = global.BatchSync ? await global.BatchSync.state() : null;
      var heldPendingId = heldState && heldState.pending && heldState.pending.requestId;
      var heldRequestId = heldPendingId || ('restore-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
      return { batch: true, entity: 'batch', id: heldRequestId,
        local: { rev: 0, deleted: false, value: global.CL.readSyncSnapshot() },
        remote: { rev: heldBatch.seq, deleted: false, value: heldBatch.snapshot },
        remoteToken: heldBatch.token };
    }
    if(!conflict) return null;
    if(conflict.entity === 'batch'){
      if(!global.ChunkAPI.getSyncBatch) throw new Error('当前客户端不支持整账号冲突比较，请升级后重试');
      var batch = await global.ChunkAPI.getSyncBatch();
      var batchState = global.BatchSync ? await global.BatchSync.state() : null;
      var pendingId = batchState && batchState.pending && batchState.pending.requestId;
      return { batch: true, entity: 'batch', id: pendingId || conflict.id,
        local: { rev: 0, deleted: false, value: global.CL.readSyncSnapshot() },
        remote: { rev: batch.seq, deleted: false, value: batch.snapshot },
        remoteToken: batch.token };
    }
    var remote = await global.ChunkAPI.getSyncEntity(conflict.entity, conflict.id);
    return { entity: conflict.entity, id: conflict.id, local: global.CL.readSyncLocal(conflict.entity, conflict.id), remote: remote };
  }
  async function execute(record, key){
    global.CL.setResolutionPaused(true);
    await global.CL.waitForSync();
    var receipt;
    try {
      if(scope() !== key) throw new Error('账号已切换，请在原账号下继续处理');
      receipt = record.preview.batch
        ? await global.ChunkAPI.resolveSyncBatch(record.request)
        : await global.ChunkAPI.resolveSync(record.request);
      if(scope() !== key) throw new Error('账号已切换，处理记录已保留，请回到原账号继续');
      if(!receipt || receipt.ok !== true) throw new Error('服务器尚未确认处理完成');
      if(record.preview.batch) await global.CL.applySyncBatchResolution(receipt, record.preview.local.value);
      else await global.CL.applySyncResolution(receipt, record.preview.local);
      await journal('delete', key);
      return receipt;
    }catch(e){
      /* A batch may already have committed on the server before local
         activation failed. Keep its journal for the same-request retry; a
         single-entity stale/local-change preview can still be discarded. */
      if(e.code === 'RESOLUTION_STALE' || (e.code === 'LOCAL_CHANGED' && !record.preview.batch)) await journal('delete', key);
      throw e;
    }finally{
      // A failed journal read must never unlock ordinary writes.
      try {
        var pending = await journal('get', scope());
        global.CL.setResolutionPaused(!!pending);
      }catch(e){ global.CL.setResolutionPaused(true); }
    }
  }
  function single(action){
    if(active) return active;
    active = Promise.resolve().then(action).finally(function(){ active = null; });
    return active;
  }
  function resolve(view, choice){
    return single(async function(){
      var key = scope();
      if(await journal('get', key)) throw new Error('上次处理尚未确认，请先继续上次处理');
      global.CL.setResolutionPaused(true);
      await global.CL.waitForSync();
      var current = view.batch ? global.CL.readSyncSnapshot() : global.CL.readSyncLocal(view.entity, view.id);
      var expectedLocal = view.batch ? view.local.value : view.local;
      if(JSON.stringify(current) !== JSON.stringify(expectedLocal)){
        global.CL.setResolutionPaused(false); throw new Error('本机已有新修改，请重新查看双方版本');
      }
      var requestId = view.batch && view.id && /^[a-zA-Z0-9_-]{8,80}$/.test(view.id)
        ? view.id : 'resolution-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      var record = { preview: view, request: view.batch
        ? { requestId: requestId, expectedToken: view.remoteToken, choice: choice, local: view.local.value }
        : { requestId: requestId, entity: view.entity, id: view.id, local: view.local, expectedToken: view.remote.token, choice: choice } };
      try { await journal('put', key, record); }
      catch(e){ global.CL.setResolutionPaused(false); throw e; }
      return execute(record, key);
    });
  }
  function retry(){ return single(async function(){
    var key = scope(), record = await journal('get', key);
    if(!record) throw new Error('没有待继续的处理');
    return execute(record,key);
  }); }
  global.SyncResolution = { preview: preview, resolve: resolve, retry: retry, restorePause: restorePause };
})(window);
