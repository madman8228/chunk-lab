/* Explicit repair: isolate a contaminated confirmation partition, never reset it. */
(function(g){
 'use strict';
 const stores={courses:'courseId',progress:'cid',sentenceStats:'key',events:'id',syncIntents:'key',syncMeta:'key',pendingOperations:'requestId',assessmentDrafts:'sessionId',navigationHandoffs:'id'};
 function identity(){
  const raw=g.localStorage.getItem('chunklab.session.v1'),session=JSON.parse(raw||'null');
  const token=g.localStorage.getItem('chunklab_token'),base=g.localStorage.getItem('chunklab_api_base')||'';
  if(!token)throw Error('请先登录，原数据未修改');
  if(session&&((session.token||null)!==token||(session.base||'')!==base))throw Error('登录记录不一致，原数据未修改');
  const uid=String(JSON.parse(g.atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).uid);
  const apiBase=new URL(base||'/',g.location.origin).href.replace(/\/+$/,'');
  const owner=JSON.stringify([apiBase,uid]),pointer='chunklab.restore.active.'+encodeURIComponent(owner);
  const revision=g.localStorage.getItem(pointer)||'';
  const originalDatabase=g.localStorage.getItem('chunklab.storage-owner.v1')===owner?'chunklab-idb':'chunklab-idb-'+encodeURIComponent(owner);
  return {uid,owner,scope:JSON.stringify([apiBase,owner,3]),apiBase,token,raw,pointer,revision,database:originalDatabase+(revision?'-restore-'+revision:''),originalDatabase};
 }
 function assertIdentity(captured){const current=identity();if(current.owner!==captured.owner||current.raw!==captured.raw||current.token!==captured.token||current.revision!==captured.revision)throw Error('账号或确认分区已经变化，修复已停止');if(g.localStorage.getItem('chunklab.restore.pending.'+encodeURIComponent(captured.owner)))throw Error('存在未完成的恢复操作，修复已停止');}
 function open(name,create){return new Promise((resolve,reject)=>{
  let finished=false;const req=g.indexedDB.open(name,create?9:undefined),timer=g.setTimeout(()=>{finished=true;reject(Error('本地数据库等待超时，原数据未修改'));},8000);
  req.onupgradeneeded=()=>{if(!create){req.transaction.abort();return;}Object.keys(stores).forEach(s=>req.result.createObjectStore(s,{keyPath:stores[s]}));};
  req.onsuccess=()=>{g.clearTimeout(timer);if(finished){req.result.close();return;}resolve(req.result);};
  req.onerror=req.onblocked=()=>{g.clearTimeout(timer);finished=true;reject(req.error||Error('本地数据库被其他页面阻塞'));};
 });}
 async function readCache(name){const db=await open(name,false);try{return await new Promise((resolve,reject)=>{const tx=db.transaction('syncMeta','readonly'),req=tx.objectStore('syncMeta').get('server-cache-v3');let row;req.onsuccess=()=>{row=req.result;};tx.oncomplete=()=>resolve(row);tx.onabort=tx.onerror=()=>reject(tx.error||Error('确认缓存读取失败'));});}finally{db.close();}}
 async function get(captured,path){const controller=new AbortController(),timer=g.setTimeout(()=>controller.abort(),8000);try{const response=await g.fetch(captured.apiBase+path,{method:'GET',cache:'no-store',headers:{Authorization:'Bearer '+captured.token},signal:controller.signal});if(!response.ok)throw Error('服务确认失败：HTTP '+response.status);return await response.json();}finally{g.clearTimeout(timer);}}
 async function repair(options){
  const captured=identity();assertIdentity(captured);
  if(captured.uid!==String(options.expectedUid))throw Error('当前账号不是指定修复账号，原数据未修改');
  if(!g.indexedDB.databases)throw Error('浏览器不支持安全核验数据库清单，修复已停止');
  const existing=await g.indexedDB.databases();if(!existing.some(d=>d.name===captured.database))throw Error('原分区不存在，修复已停止');
  const before=await readCache(captured.database);assertIdentity(captured);
  if(!before||before.owner!==captured.owner||before.scope!==captured.scope||before.appliedSeq!==options.expectedCachedSeq)throw Error('原缓存与指定修复条件不符，原数据未修改');
  const config=await get(captured,'/api/config');assertIdentity(captured);
  if(config.persistenceMode!=='server-authoritative'||Number(config.writeProtocol)!==3)throw Error('服务保存协议不符，修复已停止');
  const incoming=await get(captured,'/api/data');assertIdentity(captured);
  if(incoming.delta===true||!incoming.mem||!Number.isSafeInteger(incoming.seq)||incoming.seq>=before.appliedSeq)throw Error('服务响应不符合已确认的水位冲突，修复已停止');
  const row=g.ServerCache.mergeSnapshot(null,incoming);row.owner=captured.owner;row.scope=captured.scope;
  const revision='confirm-'+g.crypto.randomUUID(),database=captured.originalDatabase+'-restore-'+revision;
  if((await g.indexedDB.databases()).some(d=>d.name===database))throw Error('新分区名称冲突，修复已停止');
  const db=await open(database,true);
  try{await new Promise((resolve,reject)=>{const tx=db.transaction('syncMeta','readwrite');tx.objectStore('syncMeta').add(row);tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error||Error('新确认分区未能保存'));});}finally{db.close();}
  const verified=await readCache(database);
  if(!verified||verified.owner!==captured.owner||verified.appliedSeq!==incoming.seq||JSON.stringify(verified.snapshot)!==JSON.stringify(row.snapshot))throw Error('新分区校验失败，原分区继续使用');
  const unchanged=await readCache(captured.database);
  if(!unchanged||JSON.stringify(unchanged)!==JSON.stringify(before))throw Error('原分区已被其他页面修改，请关闭练习页后重试');
  assertIdentity(captured);
  // Record only partition metadata; no course data, credentials or operations are copied.
  g.localStorage.setItem('chunklab.confirmation-repair.'+revision,JSON.stringify({version:1,owner:captured.owner,previousRevision:captured.revision,originalDatabase:captured.database,newDatabase:database,previousSeq:before.appliedSeq,confirmedSeq:incoming.seq,at:Date.now()}));
  g.localStorage.setItem(captured.pointer,revision);
  return {previousSeq:before.appliedSeq,confirmedSeq:incoming.seq,revision};
 }
 g.BrowserConfirmationRepair={repair};
})(window);
