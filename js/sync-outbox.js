/* Versioned-entity outbox foundation. Not wired into save paths yet.
 * The adapter must commit each synchronous reducer as one transaction.
 * Never populate an unknown baseline by fetching cloud state after an edit. */
(function(root,factory){
  if(typeof module === 'object' && module.exports) module.exports = factory();
  else root.SyncOutbox = factory();
})(typeof window !== 'undefined' ? window : globalThis,function(){
  'use strict';
  var GROUPS = ['decks','courses','courseProgress','kv'];
  function clone(value){ return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function fail(code,message){ var e = new Error(message); e.code = code; throw e; }
  function target(entity,id){
    if(GROUPS.indexOf(entity)<0 || typeof id!=='string' || !id) fail('INVALID_TARGET','无效的同步项目');
    if(entity==='kv' && ['best','stats','settings'].indexOf(id)<0) fail('INVALID_TARGET','不支持的小字段');
    return JSON.stringify([entity,id]);
  }
  function content(state){
    if(!state || typeof state.deleted!=='boolean') fail('INVALID_CONTENT','缺少删除状态');
    if(state.deleted ? state.value!==null : !state.value || typeof state.value!=='object' || Array.isArray(state.value)) fail('INVALID_CONTENT','同步内容格式错误');
    return {deleted:state.deleted,value:clone(state.value)};
  }
  function revision(value){ return Number.isSafeInteger(value) && value>=0; }
  function create(adapter, options){
    options = options || {};
    var makeId = options.makeId || function(){ return globalThis.crypto.randomUUID(); };
    function forAccount(baseURL,accountId){
      if(typeof baseURL!=='string' || typeof accountId!=='string' || !accountId.trim()) fail('INVALID_SCOPE','必须指定服务地址和账号');
      var scope = JSON.stringify([baseURL.replace(/\/+$/,''),accountId]);
      var prefix = scope + '\n';
      function key(entity,id){ return prefix + target(entity,id); }
      function initial(entity,id){return {scope:scope,entity:entity,id:id,baseKnown:false,base:null,lastRev:0,head:null,next:null};}
      function request(state,desired){
        var rev = Math.max(state.lastRev,(state.base && state.base.rev)||0)+1;
        if(!Number.isSafeInteger(rev)) fail('REVISION_OVERFLOW','版本号超出范围');
        state.lastRev = rev;
        return {operationId:makeId(),entity:state.entity,id:state.id,rev:rev,
          baseKnown:state.baseKnown,baseRev:state.baseKnown ? state.base.rev : null,
          deleted:desired.deleted,value:clone(desired.value),status:'queued'};
      }
      return {
        scope:scope,
        // Only accepted/unchanged remote state may establish the baseline.
        observe: function(entity,id,remote){
          var value=content(remote);
          if(remote.rev!==null && !revision(remote.rev)) fail('INVALID_REVISION','基础版本无效');
          if(remote.rev===null && !remote.deleted) fail('INVALID_REVISION','不存在的项目不能携带内容');
          var k=key(entity,id);
          return adapter.transact([k],function(rows){
            var state=rows[k] || initial(entity,id);
            if(state.head) fail('PENDING_CHANGES','已有待发改动，不能用新的云端版本替换基础版本');
            if(state.baseKnown && state.base.rev!==null && (remote.rev===null || remote.rev<state.base.rev)) fail('STALE_BASELINE','不能回退已经确认的基础版本');
            state.baseKnown=true; state.base={rev:remote.rev,deleted:value.deleted,value:value.value};
            state.lastRev=Math.max(state.lastRev,remote.rev||0); rows[k]=state;
            return clone(state.base);
          });
        },
        // All entities in one local change are staged atomically. Queued drafts
        // coalesce; an already-sent request is immutable and gets a successor.
        stage: function(changes){
          if(!Array.isArray(changes) || !changes.length) return Promise.reject(new Error('待发改动不能为空'));
          var prepared=changes.map(function(c){return {key:key(c.entity,c.id),entity:c.entity,id:c.id,desired:content(c)};});
          if(new Set(prepared.map(function(c){return c.key;})).size!==prepared.length) fail('DUPLICATE_TARGET','同批不能重复修改同一项目');
          return adapter.transact(prepared.map(function(c){return c.key;}),function(rows){
            return prepared.map(function(c){
              var state=rows[c.key] || initial(c.entity,c.id), op=request(state,c.desired);
              if(state.head && state.head.status!=='queued') state.next=op;
              else state.head=op;
              rows[c.key]=state; return clone(op);
            });
          });
        },
        prepare: function(entity,id){
          var k=key(entity,id);
          return adapter.transact([k],function(rows){
            var state=rows[k]; if(!state || !state.head) return null;
            if(state.head.status==='conflict') fail('SYNC_CONFLICT','请先处理该项目的同步冲突');
            if(!state.head.baseKnown) fail('BASELINE_REQUIRED','历史改动缺少确认基线，需要先对账');
            state.head.status='sending'; rows[k]=state;
            return clone(state.head); // Retry returns the exact same operation ID/body.
          });
        },
        acknowledge: function(entity,id,operationId,confirmedRev){
          var k=key(entity,id);
          return adapter.transact([k],function(rows){
            var state=rows[k], head=state && state.head;
            if(!head || head.operationId!==operationId) return false;
            if(head.status!=='sending' || !revision(confirmedRev) || confirmedRev<head.rev) fail('INVALID_RECEIPT','不能确认未发送或版本不符的操作');
            state.baseKnown=true; state.base={rev:confirmedRev,deleted:head.deleted,value:clone(head.value)};
            state.lastRev=Math.max(state.lastRev,confirmedRev);
            state.head=state.next; state.next=null;
            if(state.head){
              state.head.baseKnown=true; state.head.baseRev=confirmedRev;
              state.head.rev=Math.max(state.head.rev,confirmedRev+1);
              if(!revision(state.head.rev)) fail('REVISION_OVERFLOW','版本号超出范围');
              state.lastRev=state.head.rev;
            }
            rows[k]=state; return true;
          });
        },
        conflict: function(entity,id,operationId,detail){
          var k=key(entity,id);
          return adapter.transact([k],function(rows){
            var state=rows[k];
            if(!state || !state.head || state.head.operationId!==operationId) return false;
            if(state.head.status!=='sending') fail('INVALID_RECEIPT','未发送的操作不能标记为服务端冲突');
            state.head.status='conflict'; state.head.conflict=clone(detail); rows[k]=state;
            return true;
          });
        },
        pending: function(){return adapter.list(prefix).then(function(rows){return rows.filter(function(s){return !!s.head;}).map(clone);});}
      };
    }
    return {forAccount:forAccount};
  }

  function createIndexedDBAdapter(indexedDB, keyRange){
    var opening;
    function open(){
      if(!opening) opening=new Promise(function(resolve,reject){
        var blocked=false, req=indexedDB.open('chunklab-sync-outbox',1);
        req.onupgradeneeded=function(){req.result.createObjectStore('entries');};
        req.onerror=function(){reject(req.error);};
        req.onblocked=function(){blocked=true;reject(new Error('待发存储被旧页面占用'));};
        req.onsuccess=function(){
          if(blocked){req.result.close();return;}
          req.result.onversionchange=function(){req.result.close();opening=null;};resolve(req.result);
        };
      }).catch(function(e){opening=null;throw e;});
      return opening;
    }
    return {
      transact: async function(keys,reduce){
        var db=await open();
        return new Promise(function(resolve,reject){
          var tx=db.transaction('entries','readwrite'), store=tx.objectStore('entries');
          var rows=Object.create(null), remaining=keys.length, result, error;
          tx.oncomplete=function(){resolve(result);};
          tx.onerror=tx.onabort=function(){reject(error || tx.error || new Error('待发记录保存失败'));};
          function apply(){
            try{
              result=reduce(rows);
              if(result && typeof result.then==='function') fail('ASYNC_REDUCER','事务更新不能跨异步任务');
              keys.forEach(function(k){if(rows[k]!==undefined) store.put(rows[k],k);});
            }catch(e){error=e;tx.abort();}
          }
          if(!remaining){apply();return;}
          keys.forEach(function(k){var req=store.get(k);req.onsuccess=function(){rows[k]=req.result;if(--remaining===0) apply();};});
        });
      },
      list: async function(prefix){
        var db=await open();
        return new Promise(function(resolve,reject){
          var tx=db.transaction('entries','readonly');
          var req=tx.objectStore('entries').getAll(keyRange.bound(prefix,prefix+'\uffff'));
          tx.oncomplete=function(){resolve(req.result);};
          tx.onerror=tx.onabort=function(){reject(tx.error || new Error('读取待发记录失败'));};
        });
      }
    };
  }
  return {create:create,createIndexedDBAdapter:createIndexedDBAdapter};
});
