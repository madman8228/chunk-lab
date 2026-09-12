/**
 * idb.js · IndexedDB 存储层（ADR：大对象迁出 localStorage，解除 5MB 配额）
 *
 * 承接 courses（含 base64 图片，最大）、courseProgress，以及句子级学习档案
 * （sentenceStats）与练习事件日志（events）。后两者是 2026-09-10 扩容到 8000 句时
 * 新增的：它们是「随练习量无限增长」的数据，localStorage 无增量写语义 →
 * 每次答题都要全量 JSON.stringify 并整键覆写（8000 句实测 188ms/次，且体积超 5MB
 * 配额后 setItem 直接抛 QuotaExceeded，旧代码只 console.error → 静默丢数据）。
 * 迁到 IDB 后热路径只需写「变更的那几行」。
 *
 * 设计：
 *   - 内存缓存桥在 core.js（loadMem 内存优先），本模块只负责 IndexedDB 读写，不碰 localStorage。
 *   - 全部 store 按实体逐条存（增量友好）：courses→courseId、progress→cid、
 *     sentenceStats→key(deckId#cid)、events→id。
 *   - 全量替换语义（clear + 批量 put，单事务）：putCourses / putProgress /
 *     replaceSentenceStats / replaceEvents；
 *     增量语义（只写传入的行，单事务）：putSentenceStats / deleteSentenceStats / appendEvents。
 *
 * 迁移：v2 新增统计存储，v3 新增 syncIntents，v4 新增 syncMeta；只建缺失存储，不动既有数据。
 * 浏览器：<script src="js/idb.js"></script>（core.js 之前加载）
 */
(function (global) {
  'use strict';

  var DB_NAME = global.AccountStorage ? global.AccountStorage.databaseName : 'chunklab-idb';
  var DB_VERSION = 4;
  var _db = null;
  var _opening = null;

  /* 所有 objectStore 定义集中一处，建库与升级共用 */
  var STORES = ['courses', 'progress', 'sentenceStats', 'events', 'syncIntents', 'syncMeta'];

  function open() {
    if(global.AccountStorage){
      try{global.AccountStorage.assertCurrent();}catch(error){return Promise.reject(error);}
    }
    if (_db) return Promise.resolve(_db);
    if (_opening) return _opening;
    _opening = new Promise(function (resolve, reject) {
      if (!global.indexedDB) { reject(new Error('IndexedDB 不可用')); return; }
      var req = global.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        /* 逐个判断：老库（v1）升级时只补缺的，不清空既有 courses/progress */
        if (!db.objectStoreNames.contains('courses')) db.createObjectStore('courses', { keyPath: 'courseId' });
        if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress', { keyPath: 'cid' });
        if (!db.objectStoreNames.contains('sentenceStats')) db.createObjectStore('sentenceStats', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('events')) db.createObjectStore('events', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('syncIntents')) db.createObjectStore('syncIntents', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('syncMeta')) db.createObjectStore('syncMeta', { keyPath: 'key' });
      };
      var blocked = false;
      req.onblocked = function(){ blocked=true; reject(new Error('请关闭旧页面后重试存储升级')); };
      req.onsuccess = function (e) {
        if(blocked){e.target.result.close();return;}
        _db = e.target.result;
        // A restore freezes every existing connection before staging a new copy.
        // Check at transaction creation as well as open(): callers may have
        // awaited an already-open connection when the freeze started.
        var transaction=_db.transaction.bind(_db);
        _db.transaction=function(){
          if(global.AccountStorage) global.AccountStorage.assertCurrent();
          return transaction.apply(null,arguments);
        };
        _db.onversionchange=function(){_db.close();_db=null;_opening=null;};
        resolve(_db);
      };
      req.onerror = function () { reject(req.error || new Error('打开 IndexedDB 失败')); };
    });
    _opening.then(null, function () { _opening = null; }); /* 失败后允许重试 */
    return _opening;
  }

  function tx(store, mode) {
    return open().then(function (db) { return db.transaction(store, mode).objectStore(store); });
  }

  /* 通用：单 store 全量读，rows → { keyPath值: 行 } 或数组 */
  function getAllRows(storeName) {
    return tx(storeName, 'readonly').then(function (s) {
      return new Promise(function (resolve, reject) {
        var req = s.getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  /* 通用：单事务里跑一批 put，返回 Promise（rows 为空则跳过，避免无谓事务） */
  function putRows(storeName, rows) {
    if (!rows || !rows.length) return Promise.resolve(0);
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(storeName, 'readwrite');
        var s = t.objectStore(storeName);
        rows.forEach(function (r) { s.put(r); });
        t.oncomplete = function () { resolve(rows.length); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('abort')); };
      });
    });
  }

  /* 通用：单事务里跑一批 delete，返回 Promise */
  function deleteKeys(storeName, keys) {
    if (!keys || !keys.length) return Promise.resolve(0);
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(storeName, 'readwrite');
        var s = t.objectStore(storeName);
        keys.forEach(function (k) { s.delete(k); });
        t.oncomplete = function () { resolve(keys.length); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('abort')); };
      });
    });
  }

  /* Account-wide sync state is metadata, not a business sync intent. During
   * v4 rollout, move the old conditional-batch row in the same transaction so
   * a crash cannot leave the queue half-migrated. */
  function readSyncMeta(key) {
    return tx('syncMeta', 'readonly').then(function (s) {
      return new Promise(function (resolve, reject) {
        var req = s.get(key);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }
  function readBusinessMem() { return readSyncMeta('business-mem-v1'); }
  function updateSyncMeta(key, reduce) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(['syncMeta', 'syncIntents'], 'readwrite');
        var meta = t.objectStore('syncMeta'), legacy = t.objectStore('syncIntents');
        var output, failure;
        t.oncomplete = function () { resolve(output); };
        t.onerror = t.onabort = function () { reject(failure || t.error || new Error('同步元数据保存失败')); };
        meta.get(key).onsuccess = function (event) {
          var current = event.target.result;
          if (current) return apply(current, null);
          legacy.get(key).onsuccess = function (legacyEvent) {
            apply(legacyEvent.target.result || null, legacyEvent.target.result || null);
          };
        };
        function apply(current, migrated) {
          try {
            var base = current || {key:key};
            var next = reduce(base);
            // Reducers may mutate the loaded row in place and return nothing.
            // Persist that row instead of treating the valid update as an error.
            output = next === undefined ? current : next;
            // The reducer's return value is also used as the public result
            // (observe returns a seq and stage returns the pending request).
            // Only a returned row replaces the persisted row; ordinary
            // reducers mutate `current` and return a business result.
            var row = next && next.key === key ? next : base;
            if (!row || row.key !== key) throw new Error('同步元数据键无效');
            meta.put(row);
            if (migrated) legacy.delete(key);
          } catch (error) { failure = error; t.abort(); }
        }
      });
    });
  }

  /* 通用：单事务全量替换 */
  function replaceAll(storeName, rows) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(storeName, 'readwrite');
        var s = t.objectStore(storeName);
        t.oncomplete = function () { resolve(); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('abort')); };
        try {
          s.clear();
          (rows || []).forEach(function (r) { s.put(r); });
        } catch (error) {
          // A synchronous clone/key error must also roll back the preceding clear.
          try { t.abort(); } catch (_) {}
          reject(error);
        }
      });
    });
  }

  /* Read/merge/write share the store lock, even before a tab beacon arrives. */
  function updateValue(storeName, reduce, intentScope, protect, syncState) {
    return open().then(function(db){
      return new Promise(function(resolve,reject){
        var transactionStores=[storeName];
        if(intentScope || protect) transactionStores.push('syncIntents');
        if(syncState) transactionStores.push('syncMeta');
        var tx=db.transaction(transactionStores,'readwrite'), store=tx.objectStore(storeName);
        var result, failure;
        tx.oncomplete=function(){ resolve(result); };
        tx.onerror=tx.onabort=function(){ reject(failure || tx.error || new Error('abort')); };
        store.getAll().onsuccess=function(event){
          if(protect){
            var read=tx.objectStore('syncIntents').getAll();
            read.onsuccess=function(){ apply(event.target.result,read.result); };
          }else apply(event.target.result,[]);
        };
        function apply(current,pending){
          try {
            if(storeName==='progress') {
              var map={}; current.forEach(function(row){ map[row.cid]=row.data; }); current=map;
            }
            var previous=JSON.parse(JSON.stringify(current));
            result=reduce(current);
            if(result && typeof result.then==='function') throw new Error('存储合并必须同步完成');
            if(protect){
              var retained=Object.create(null);
              if(storeName==='courses') result.forEach(function(c){retained[c.courseId]=c;});
              else Object.keys(result).forEach(function(id){retained[id]=result[id];});
              pending.forEach(function(record){
                if(record.scope!==protect.scope || record.entity!==(storeName==='courses' ? 'courses' : 'courseProgress')) return;
                if((protect.allowOperations || []).indexOf(record.operationId)>=0) return;
                if(record.deleted) delete retained[record.id]; else retained[record.id]=record.value;
              });
              result=storeName==='courses' ? Object.keys(retained).map(function(id){return retained[id];}) : retained;
            }
            var rows=storeName==='courses' ? result : Object.keys(result).map(function(cid){return {cid:cid,data:result[cid]};});
            if(intentScope){
              var before={}, after={};
              if(storeName==='courses'){
                previous.forEach(function(c){before[c.courseId]=c;});
                rows.forEach(function(c){after[c.courseId]=c;});
              }else{before=previous;after=result;}
              var journal=tx.objectStore('syncIntents');
              Object.keys(Object.assign({},before,after)).forEach(function(id){
                if(JSON.stringify(before[id])===JSON.stringify(after[id])) return;
                var entity=storeName==='courses' ? 'courses' : 'courseProgress';
                var key=JSON.stringify([intentScope,entity,id]);
                var record={key:key,scope:intentScope,entity:entity,id:id,
                  operationId:global.crypto.randomUUID(),baseKnown:false,
                  deleted:!Object.prototype.hasOwnProperty.call(after,id),
                  value:Object.prototype.hasOwnProperty.call(after,id) ? after[id] : null};
                // Retain the first observed local value for later reconciliation.
                var get=journal.get(key);
                get.onsuccess=function(){
                  try{
                    record.original=get.result ? get.result.original : (before[id]===undefined ? null : before[id]);
                    if(get.result && get.result.frozen) record.frozen=get.result.frozen;
                    journal.put(record);
                  }catch(error){failure=error;tx.abort();}
                };
              });
            }
            store.clear(); rows.forEach(function(row){ store.put(row); });
            if(syncState){
              if(!Number.isSafeInteger(syncState.localGeneration) || syncState.localGeneration<0){
                throw new Error('本地同步代次无效');
              }
              var meta=tx.objectStore('syncMeta'), metaKey=syncState.key || 'conditional-batch-v1';
              meta.get(metaKey).onsuccess=function(event){
                try{
                  var row=event.target.result || {key:metaKey,owner:syncState.owner || null};
                  if(syncState.owner && row.owner && row.owner!==syncState.owner) throw new Error('同步元数据账号不一致');
                  if(syncState.owner && !row.owner) row.owner=syncState.owner;
                  row.schemaVersion=Math.max(row.schemaVersion || 0,syncState.schemaVersion || 1);
                  row.localGeneration=Math.max(row.localGeneration || 0,syncState.localGeneration);
                  meta.put(row);
                }catch(error){failure=error;tx.abort();}
              };
            }
          } catch(error) { failure=error; tx.abort(); }
        }
      });
    });
  }

  // Compare-and-delete: a response for an older edit cannot erase its successor.
  function acknowledgeSyncIntents(scope, receipts){
    return open().then(function(db){return new Promise(function(resolve,reject){
      var tx=db.transaction('syncIntents','readwrite'), store=tx.objectStore('syncIntents'), count=0;
      tx.oncomplete=function(){resolve(count);};
      tx.onerror=tx.onabort=function(){reject(tx.error || new Error('确认待同步记录失败'));};
      receipts.forEach(function(receipt){
        var request=store.get(receipt.key);
        request.onsuccess=function(){
          var current=request.result;
          if(current && current.scope===scope && current.operationId===receipt.operationId){store.delete(receipt.key);count++;}
        };
      });
    });});
  }

  /* Conditional batch receipt boundary: advancing the accepted baseline and
   * deleting only matching business intents must commit together. */
  function acknowledgeConditionalBatch(key, requestId, receiptSeq, capturedGeneration, receipts){
    return open().then(function(db){return new Promise(function(resolve,reject){
      var transaction=db.transaction(['syncMeta','syncIntents'],'readwrite');
      var meta=transaction.objectStore('syncMeta'), intents=transaction.objectStore('syncIntents');
      var failure, result;
      transaction.oncomplete=function(){resolve(result);};
      transaction.onerror=transaction.onabort=function(){reject(failure || transaction.error || new Error('确认条件同步失败'));};
      meta.get(key).onsuccess=function(event){
        try{
          var row=event.target.result;
          if(!row || !row.pending || row.pending.requestId!==requestId) throw new Error('待发请求已变化，不能确认');
          if(!Number.isSafeInteger(receiptSeq) || receiptSeq<0) throw new Error('同步回执版本无效');
          row.baseline=receiptSeq; row.acceptedSeq=receiptSeq;
          row.acceptedGeneration=capturedGeneration;
          row.pending=null; row.status=row.localGeneration>capturedGeneration ? 'dirty' : 'clean';
          meta.put(row);
          var list=Array.isArray(receipts) ? receipts : [], remaining=list.length;
          if(!remaining){result={key:key,baseline:receiptSeq,localGeneration:row.localGeneration};return;}
          list.forEach(function(receipt){
            if(!receipt || typeof receipt.key!=='string' || typeof receipt.operationId!=='string') throw new Error('同步回执记录无效');
            intents.get(receipt.key).onsuccess=function(intentEvent){
              var current=intentEvent.target.result;
              if(current && current.operationId===receipt.operationId) intents.delete(receipt.key);
              if(--remaining===0) result={key:key,baseline:receiptSeq,localGeneration:row.localGeneration};
            };
          });
        }catch(error){failure=error;transaction.abort();}
      };
    });});
  }

  // Freeze before HTTP. A subsequent local edit keeps this request unchanged.
  function freezeSyncIntent(scope, key, operationId, payload){
    return open().then(function(db){return new Promise(function(resolve,reject){
      var tx=db.transaction('syncIntents','readwrite'), store=tx.objectStore('syncIntents'), result=null;
      tx.oncomplete=function(){resolve(result);};
      tx.onerror=tx.onabort=function(){reject(tx.error || new Error('冻结同步请求失败'));};
      store.get(key).onsuccess=function(event){
        var record=event.target.result;
        if(!record || record.scope!==scope) return;
        if(record.frozen){result=record.frozen;return;}
        if(record.operationId!==operationId) return;
        result={operationId:operationId,payload:payload,deleted:record.deleted,value:record.value};
        record.frozen=result; store.put(record);
      };
    });});
  }
  function confirmSyncIntent(scope, key, operationId){
    return open().then(function(db){return new Promise(function(resolve,reject){
      var tx=db.transaction('syncIntents','readwrite'), store=tx.objectStore('syncIntents'), result=false;
      tx.oncomplete=function(){resolve(result);};
      tx.onerror=tx.onabort=function(){reject(tx.error || new Error('确认同步请求失败'));};
      store.get(key).onsuccess=function(event){
        var record=event.target.result;
        if(!record || record.scope!==scope || !record.frozen || record.frozen.operationId!==operationId) return;
        if(record.operationId===operationId) store.delete(key);
        else{
          record.original=record.frozen.deleted ? null : record.frozen.value;
          delete record.frozen; store.put(record);
        }
        result=true;
      };
    });});
  }

  /* 全量载入：{ courses, courseProgress, sentenceStats, events } */
  function loadAll() {
    return Promise.all([
      getAllRows('courses'),
      getAllRows('progress'),
      getAllRows('sentenceStats'),
      getAllRows('events')
    ]).then(function (parts) {
      var progress = {};
      parts[1].forEach(function (r) { progress[r.cid] = r.data; });
      var sentenceStats = {};
      parts[2].forEach(function (r) { sentenceStats[r.key] = r.data; });
      return {
        courses: parts[0],
        courseProgress: progress,
        sentenceStats: sentenceStats,
        events: parts[3]
      };
    });
  }

  /* ★ 定向读取（多标签页三路合并用）：只取一类，避免为了比对而读全库（courses 含 base64，重） */
  function getCourses() {
    return getAllRows('courses');
  }
  function getProgress() {
    return getAllRows('progress').then(function (rows) {
      var map = {};
      (rows || []).forEach(function (r) { if (r && r.cid != null) map[r.cid] = r.data; });
      return map;
    });
  }

  /* 全量替换 courses（单事务） */
  function putCourses(list) {
    return replaceAll('courses', (list || []).filter(function (c) { return c && c.courseId; }));
  }

  /* 全量替换 progress（单事务） */
  function putProgress(map) {
    return replaceAll('progress', Object.keys(map || {}).map(function (cid) { return { cid: cid, data: map[cid] }; }));
  }

  /* ★ 增量写句子档案：只写变更的 key（热路径），单事务 */
  function putSentenceStats(map) {
    var keys = Object.keys(map || {});
    return putRows('sentenceStats', keys.map(function (k) { return { key: k, data: map[k] }; }));
  }

  /* ★ 增量删句子档案：只删确实消失的 key，单事务 */
  function deleteSentenceStats(keys) {
    return deleteKeys('sentenceStats', keys || []);
  }

  /* ★ 全量替换句子档案（仅首次迁移 / 事件合并后重建时使用） */
  function replaceSentenceStats(map) {
    return replaceAll('sentenceStats', Object.keys(map || {}).map(function (k) { return { key: k, data: map[k] }; }));
  }

  /* ★ 增量追加事件（正常路径：只写新增的那几条） */
  function appendEvents(list) {
    return putRows('events', (list || []).filter(function (e) { return e && e.id; }));
  }

  /* ★ 全量替换事件（事件数组被整体重排/替换时使用，如云合并后的并集） */
  function replaceEvents(list) {
    return replaceAll('events', (list || []).filter(function (e) { return e && e.id; }));
  }

  global.IDBStore = {
    /*
     * 学习记录提交合同：sentenceStats、events、学习日志，以及可选的
     * conditional-batch 同步元数据必须在同一个 readwrite 事务中完成。
     * syncState 只允许携带同步状态的小字段；业务大对象仍按行写入，不能
     * 借此恢复「整份 stats 快照」热路径。
     */
    writeStatsBatch: function(batch,scope,syncState){
      return open().then(function(db){return new Promise(function(resolve,reject){
        var stores=['sentenceStats','events'];
        if(scope) stores.push('syncIntents');
        if(syncState || batch.businessMem) stores.push('syncMeta');
        var tx=db.transaction(stores,'readwrite'), failure, committedState=null;
        tx.oncomplete=function(){resolve(committedState);};
        tx.onerror=tx.onabort=function(){reject(failure || tx.error || new Error('学习记录保存失败'));};
        try{
          var stats=tx.objectStore('sentenceStats'), events=tx.objectStore('events');
          if(batch.businessMem){
            var business=batch.businessMem;
            if(!business || !Number.isSafeInteger(business.localGeneration) || business.localGeneration<0){
              throw new Error('本地业务提交代次无效');
            }
            tx.objectStore('syncMeta').put({
              key:'business-mem-v1', owner:business.owner || null,
              schemaVersion:1, localGeneration:business.localGeneration,
              data:business.data || {}
            });
          }
          function intent(entity,id,value,deleted){
            if(!scope) return;
            tx.objectStore('syncIntents').put({key:JSON.stringify([scope,entity,id]),scope:scope,entity:entity,id:id,
              operationId:global.crypto.randomUUID(),value:value,deleted:deleted});
          }
          if(batch.replaceStats) stats.clear();
          Object.keys(batch.stats || {}).forEach(function(key){stats.put({key:key,data:batch.stats[key]});intent('sentenceStats',key,batch.stats[key],false);});
          (batch.gone || []).forEach(function(key){stats.delete(key);intent('sentenceStats',key,null,true);});
          if(batch.replaceEvents) events.clear();
          (batch.events || []).forEach(function(event){events.put(event);intent('events',event.id,event,false);});
          if(syncState){
            if(!Number.isSafeInteger(syncState.localGeneration) || syncState.localGeneration<0){
              throw new Error('本地同步代次无效');
            }
            var meta=tx.objectStore('syncMeta');
            meta.get(syncState.key || 'conditional-batch-v1').onsuccess=function(event){
              try{
                var key=syncState.key || 'conditional-batch-v1';
                var row=event.target.result || {key:key,owner:syncState.owner || null};
                if(syncState.owner && row.owner && row.owner!==syncState.owner){
                  throw new Error('同步元数据账号不一致');
                }
                if(syncState.owner && !row.owner) row.owner=syncState.owner;
                row.schemaVersion=Math.max(row.schemaVersion || 0,syncState.schemaVersion || 1);
                row.localGeneration=Math.max(row.localGeneration || 0,syncState.localGeneration);
                committedState={key:key,localGeneration:row.localGeneration};
                meta.put(row);
              }catch(error){failure=error;tx.abort();}
            };
          }
        }catch(error){failure=error;tx.abort();}
      });});
    },
    open: open,
    loadAll: loadAll,
    getCourses: getCourses,
    getProgress: getProgress,
    updateCourses: function(reduce,scope,protect,syncState){ return updateValue('courses',reduce,scope,protect,syncState); },
    updateProgress: function(reduce,scope,protect,syncState){ return updateValue('progress',reduce,scope,protect,syncState); },
    readSyncIntents: function(scope){ return getAllRows('syncIntents').then(function(rows){return rows.filter(function(r){return r.scope===scope && (r.entity==='courses' || r.entity==='courseProgress');});}); },
    readLearningIntents: function(scope){ return getAllRows('syncIntents').then(function(rows){return rows.filter(function(r){return r.scope===scope && (r.entity==='sentenceStats' || r.entity==='events');});}); },
    acknowledgeSyncIntents: acknowledgeSyncIntents,
    acknowledgeConditionalBatch: acknowledgeConditionalBatch,
    freezeSyncIntent: freezeSyncIntent,
    confirmSyncIntent: confirmSyncIntent,
    putCourses: putCourses,
    putProgress: putProgress,
    putSentenceStats: putSentenceStats,
    deleteSentenceStats: deleteSentenceStats,
    replaceSentenceStats: replaceSentenceStats,
    appendEvents: appendEvents,
    replaceEvents: replaceEvents,
    readSyncMeta: readSyncMeta,
    readBusinessMem: readBusinessMem,
    updateSyncMeta: updateSyncMeta,
    STORES: STORES
  };
})(window);
