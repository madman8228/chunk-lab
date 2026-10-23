/* Explicit, reviewed cache repair. Never discards or rewrites the old partition. */
(function(g){
 'use strict';
 const stores={courses:'courseId',progress:'cid',sentenceStats:'key',events:'id',syncIntents:'key',syncMeta:'key',pendingOperations:'requestId',assessmentDrafts:'sessionId',navigationHandoffs:'id'};
 let currentPreview=null, verifiedBackup=null;
 function identity(){
  const raw=g.localStorage.getItem('chunklab.session.v1'),session=JSON.parse(raw||'null'),token=g.localStorage.getItem('chunklab_token'),base=g.localStorage.getItem('chunklab_api_base')||'';
  if(!token)throw Error('当前没有登录，修复已停止；本地数据未修改');
  if(session&&((session.token||null)!==token||(session.base||'')!==base))throw Error('登录记录不一致，修复已停止');
  let claims;try{claims=JSON.parse(g.atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch(_){throw Error('当前登录身份无法核验，修复已停止');}
  if(!Number.isSafeInteger(claims.uid)||claims.uid<=0)throw Error('当前登录身份无法核验，修复已停止');
  const uid=String(claims.uid),apiBase=new URL(base||'/',g.location.origin).href.replace(/\/+$/,''),owner=JSON.stringify([apiBase,uid]),pointer='chunklab.restore.active.'+encodeURIComponent(owner),revision=g.localStorage.getItem(pointer)||'';
  const originalDatabase=g.localStorage.getItem('chunklab.storage-owner.v1')===owner?'chunklab-idb':'chunklab-idb-'+encodeURIComponent(owner);
  const prefix=originalDatabase==='chunklab-idb'?'':'chunklab.account.'+encodeURIComponent(owner)+'.';
  return {uid,owner,apiBase,token,raw,pointer,revision,database:originalDatabase+(revision?'-restore-'+revision:''),originalDatabase,prefix,epoch:session&&session.epoch||''};
 }
 function assertIdentity(c,lockId){const n=identity();if(n.uid!==c.uid||n.owner!==c.owner||n.raw!==c.raw||n.token!==c.token||n.epoch!==c.epoch||n.revision!==c.revision)throw Error('登录身份或本地分区已变化，修复停止');const lock=g.localStorage.getItem('chunklab.restore.pending.'+encodeURIComponent(c.owner));if(lock&&lock!==lockId)throw Error('存在未完成的恢复操作，修复停止');}
 function open(name){return new Promise((resolve,reject)=>{const req=g.indexedDB.open(name);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('本地分区读取失败'));req.onblocked=()=>reject(Error('本地数据库正被其他页面占用'));});}
 function readPartition(c){return open(c.database).then(db=>new Promise((resolve,reject)=>{try{
  const names=Array.from(db.objectStoreNames);if(!names.length)throw Error('原分区没有可核验的数据表');
  const tx=db.transaction(names,'readonly'),data={};names.forEach(name=>{const req=tx.objectStore(name).getAll();req.onsuccess=()=>{data[name]=req.result;};});
  tx.oncomplete=()=>{const local={};for(let i=0;i<g.localStorage.length;i++){const key=g.localStorage.key(i);if((c.prefix&&key.startsWith(c.prefix))||(!c.prefix&&!key.startsWith('chunklab.account.')&&!key.startsWith('chunklab.restore.pending.')&&!/^(chunklab_token|chunklab_api_base|chunklab\.session\.v1|chunklab\.storage-owner\.v1)$/.test(key)))local[key]=g.localStorage.getItem(key);}resolve({database:c.database,stores:data,local});};
  tx.onerror=tx.onabort=()=>reject(tx.error||Error('本地分区读取失败'));
 }catch(e){reject(e);}finally{db.close();}}));}
 function canonical(value){if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&Object.getPrototypeOf(value)===Object.prototype){return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';}throw Error('分区含有无法安全导出的数据类型，不能继续修复');}
 async function digest(value){const bytes=new TextEncoder().encode(canonical(value)),hash=await g.crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash)).map(n=>n.toString(16).padStart(2,'0')).join('');}
 async function request(c,path,format){const controller=new AbortController(),timer=g.setTimeout(()=>controller.abort(),10000);try{
  const res=await g.fetch(c.apiBase+path,{method:'GET',cache:'no-store',headers:{Authorization:'Bearer '+c.token},signal:controller.signal});assertIdentity(c);
  if(!res.ok)throw Error('服务端读取失败：HTTP '+res.status);
  const account=res.headers.get('X-ChunkLab-Account-Id');if(path!=='/api/config'&&account!==c.uid)throw Error(account===null?'服务端未返回账号确认标识，修复停止':'服务端响应账号与当前登录账号不一致，修复停止');
  if(format&&res.headers.get('X-Learning-Data-Format')!==format)throw Error('服务端学习数据格式未确认，修复停止');
  const body=await res.json();if(format&&body.format!==format)throw Error('服务端数据格式与响应头不一致，修复停止');return body;
 }finally{g.clearTimeout(timer);}}
 async function serverSnapshot(c){
  const formatBody=await request(c,'/api/learning-data/format');const format=formatBody.format;
  if(format!=='legacy-v1'&&format!=='references-v1')throw Error('服务端账号数据格式未知，修复停止');
  let incoming;
  if(format==='references-v1')incoming=await request(c,'/api/learning-data','references-v1');
  else{const config=await request(c,'/api/config');if(config.persistenceMode!=='server-authoritative'||Number(config.writeProtocol)!==3)throw Error('服务端保存协议不匹配，修复停止');incoming=await request(c,'/api/data');}
  if(incoming.delta===true||!incoming.mem||!Number.isSafeInteger(incoming.seq))throw Error('服务端没有返回可确认的完整学习快照');
  return {format,incoming};
 }
 async function preview(){
  currentPreview=null;verifiedBackup=null;const c=identity();assertIdentity(c);
  if(!g.indexedDB.databases)throw Error('当前浏览器无法安全核对本地分区清单');
  const dbs=await g.indexedDB.databases();if(!dbs.some(d=>d.name===c.database))throw Error('当前账号的原分区不存在');
  const partition=await readPartition(c);assertIdentity(c);
  const pendingTransportOperations=(partition.stores.pendingOperations||[]).length;
  const pendingLearningIntents=(partition.stores.syncIntents||[]).length;
  const server=await serverSnapshot(c);assertIdentity(c);
  const expectedKey=server.format==='references-v1'?'learning-cache-v1':'server-cache-v3';
  const cacheKey=(partition.stores.syncMeta||[]).find(x=>x.key===expectedKey);
  if(!cacheKey||cacheKey.owner!==c.owner||cacheKey.scope!==JSON.stringify([c.apiBase,c.owner,3]))throw Error('没有找到与当前账号及服务地址对应的已确认缓存');
  if(Number.isSafeInteger(cacheKey.appliedSeq)&&server.incoming.seq>=cacheKey.appliedSeq)throw Error('服务端水位不低于本地缓存，不符合此工具处理的冲突条件');
  const fingerprint=await digest(partition),cacheFingerprint=await digest(cacheKey),id=g.crypto.randomUUID();
  currentPreview={id,c,partition,fingerprint,cacheFingerprint,cacheKey,server,pendingTransportOperations,pendingLearningIntents};
  const pendingOperations=pendingTransportOperations+pendingLearningIntents;
  return {id,uid:c.uid,apiBase:c.apiBase,database:c.database,format:server.format,localSeq:cacheKey.appliedSeq,serverSeq:server.incoming.seq,pendingOperations,pendingTransportOperations,pendingLearningIntents,storeCounts:Object.fromEntries(Object.entries(partition.stores).map(([k,v])=>[k,v.length])),backupRequired:true,canApply:pendingOperations===0};
 }
 async function exportAndVerify(previewId){
  const p=currentPreview;if(!p||p.id!==previewId)throw Error('预览已失效，请重新检查');
  if(typeof g.showSaveFilePicker!=='function')throw Error('此浏览器不支持可回读验证的备份保存；请使用支持文件保存权限的浏览器');
  assertIdentity(p.c);const fresh=await readPartition(p.c);if(await digest(fresh)!==p.fingerprint)throw Error('预览后本地分区发生变化，请重新预览');
  const text=JSON.stringify({format:'chunklab-browser-partition-backup',version:1,createdAt:new Date().toISOString(),uid:p.c.uid,owner:p.c.owner,database:p.c.database,fingerprint:p.fingerprint,partition:fresh},null,2);
  const handle=await g.showSaveFilePicker({suggestedName:'chunklab-account-'+p.c.uid+'-partition-backup.json',types:[{description:'JSON backup',accept:{'application/json':['.json']}}]});
  const writable=await handle.createWritable();await writable.write(text);await writable.close();
  const saved=await handle.getFile(),savedText=await saved.text();if(savedText!==text||await digest(fresh)!==p.fingerprint)throw Error('备份回读校验失败，禁止切换分区');
  verifiedBackup={previewId,fingerprint:p.fingerprint,name:saved.name};return {name:saved.name,fingerprint:p.fingerprint};
 }
 async function apply(previewId){
  const p=currentPreview;if(!p||p.id!==previewId)throw Error('预览已失效，请重新预览');
  const pendingOperations=p.pendingTransportOperations+p.pendingLearningIntents;
  if(pendingOperations)throw Error('待提交学习操作共 '+pendingOperations+' 条（传输队列 '+p.pendingTransportOperations+'，学习变更 '+p.pendingLearningIntents+'）。请先通过原流程核查处理，修复工具不会丢弃或迁移它们');
  if(!verifiedBackup||verifiedBackup.previewId!==p.id||verifiedBackup.fingerprint!==p.fingerprint)throw Error('请先创建并回读验证完整分区备份');
  assertIdentity(p.c);const fresh=await readPartition(p.c);if(await digest(fresh)!==p.fingerprint)throw Error('本地数据在预览后发生变化，请停止并重新预览');
  const server=await serverSnapshot(p.c);if(server.format!==p.server.format||server.incoming.seq!==p.server.incoming.seq||await digest(server.incoming)!==await digest(p.server.incoming))throw Error('服务端数据在预览后发生变化，请重新预览');
  const row=g.ServerCache.mergeSnapshot(null,server.incoming),key=server.format==='references-v1'?'learning-cache-v1':'server-cache-v3';row.key=key;row.owner=p.c.owner;row.scope=JSON.stringify([p.c.apiBase,p.c.owner,3]);
  const revision='confirm-'+g.crypto.randomUUID(),database=p.c.originalDatabase+'-restore-'+revision;if((await g.indexedDB.databases()).some(d=>d.name===database))throw Error('新分区名称冲突');
  const db=await new Promise((resolve,reject)=>{const req=g.indexedDB.open(database,9);req.onupgradeneeded=()=>Object.keys(stores).forEach(s=>req.result.createObjectStore(s,{keyPath:stores[s]}));req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('新分区被其他页面阻塞'));});
  try{await new Promise((resolve,reject)=>{const tx=db.transaction('syncMeta','readwrite');tx.objectStore('syncMeta').add(row);if(server.format==='references-v1')tx.objectStore('syncMeta').add({key:'learning-format-v1:'+encodeURIComponent(row.scope),owner:p.c.owner,formatScope:row.scope,format:'references-v1',updatedAt:Date.now()});tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error||Error('新学习缓存保存失败'));});}finally{db.close();}
  const verify=await open(database);try{const keys=await new Promise((resolve,reject)=>{const tx=verify.transaction('syncMeta','readonly'),req=tx.objectStore('syncMeta').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});const saved=keys.find(x=>x.key===key);if(!saved||saved.owner!==p.c.owner||saved.appliedSeq!==server.incoming.seq||await digest(saved.snapshot)!==await digest(row.snapshot))throw Error('新分区缓存校验失败；原分区仍保持活动');}finally{verify.close();}
  const lockKey='chunklab.restore.pending.'+encodeURIComponent(p.c.owner),lockId='confirmation-repair-'+g.crypto.randomUUID();
  if(g.localStorage.getItem(lockKey))throw Error('存在未完成的恢复操作，修复停止');
  g.localStorage.setItem(lockKey,lockId);
  try{
   assertIdentity(p.c,lockId);const last=await readPartition(p.c);if(await digest(last)!==p.fingerprint)throw Error('原分区在写入期间发生变化；没有切换指针');
   assertIdentity(p.c,lockId);
   g.localStorage.setItem('chunklab.confirmation-repair.'+revision,JSON.stringify({version:2,owner:p.c.owner,previousRevision:p.c.revision,originalDatabase:p.c.database,newDatabase:database,previousSeq:p.cacheKey.appliedSeq,confirmedSeq:server.incoming.seq,format:server.format,backup:verifiedBackup.name,backupFingerprint:verifiedBackup.fingerprint,at:Date.now()}));
   g.localStorage.setItem(p.c.pointer,revision);return {previousSeq:p.cacheKey.appliedSeq,confirmedSeq:server.incoming.seq,format:server.format,revision};
  }finally{if(g.localStorage.getItem(lockKey)===lockId)g.localStorage.removeItem(lockKey);}
 }
 async function resetDevelopment(){
  if(!/^(127\.0\.0\.1|localhost)$/.test(g.location.hostname))throw Error('此操作仅用于本机开发环境');
  const c=identity(),server=await serverSnapshot(c);assertIdentity(c);
  const revision='dev-reset-'+g.crypto.randomUUID(),database=c.originalDatabase+'-restore-'+revision;
  const db=await new Promise((resolve,reject)=>{const req=g.indexedDB.open(database,9);req.onupgradeneeded=()=>Object.keys(stores).forEach(s=>req.result.createObjectStore(s,{keyPath:stores[s]}));req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  try{await new Promise((resolve,reject)=>{const tx=db.transaction('syncMeta','readwrite'),row=g.ServerCache.mergeSnapshot(null,server.incoming);row.key=server.format==='references-v1'?'learning-cache-v1':'server-cache-v3';row.owner=c.owner;row.scope=JSON.stringify([c.apiBase,c.owner,3]);tx.objectStore('syncMeta').put(row);tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error);});}finally{db.close();}
  assertIdentity(c);g.localStorage.setItem(c.pointer,revision);return {seq:server.incoming.seq};
 }
 g.BrowserConfirmationRepair={preview,exportAndVerify,apply,resetDevelopment};
})(window);
