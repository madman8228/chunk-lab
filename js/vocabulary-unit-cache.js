(function(global){
 'use strict';
 // Shared public teaching content. This database contains no account or progress data.
 let database;
 const clone=value=>structuredClone(value);
 const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
 function open(){if(!database){database=new Promise((resolve,reject)=>{const request=indexedDB.open('chunklab-vocabulary-content-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('units');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});database.catch(()=>{database=null;});}return database;}
 async function storage(key,value){const db=await open();return new Promise((resolve,reject)=>{const transaction=db.transaction('units',value?'readwrite':'readonly'),request=value?transaction.objectStore('units').put(value,key):transaction.objectStore('units').get(key);transaction.oncomplete=()=>resolve(request.result);transaction.onerror=transaction.onabort=()=>reject(transaction.error||Error('本机空间不足，单元尚未离线保存'));});}
 async function validate(value,bookId,unitId,structureRevision){
  if(!value||value.schemaVersion!==1||value.bookId!==bookId||value.unitId!==(unitId||null)||structureRevision&&value.structureRevision!==structureRevision&&value.priorStructureRevision!==structureRevision||!Array.isArray(value.items)||!value.items.length)throw Error('单元内容不完整，请联网重新读取');
  const {fingerprint,...body}=value;if(await digest(body)!==fingerprint)throw Error('单元内容校验失败，请联网重新读取');
  const ids=new Set();for(const item of value.items){const {contentRevision,...body}=item;if(ids.has(item.itemId)||await digest(body)!==contentRevision)throw Error('词条内容校验失败');ids.add(item.itemId);}
  return value;
 }
 async function create({bookId,unitId,structureRevision,onStatus=()=>{}}){
  if(bookId.startsWith('personal-'))return null;
  const base=ChunkAPI.getBase(),identity=LearningSessionBootstrap.identity(),key=JSON.stringify([base,bookId,unitId||null,structureRevision||null]);
  const guard=()=>{AccountStorage.assertCurrent();if(identity!==LearningSessionBootstrap.identity())throw Error('账号或服务已变化，请重新进入课程');};
  const route='/api/wordbooks/'+encodeURIComponent(bookId)+'/offline-unit'+(unitId?'?unitId='+encodeURIComponent(unitId)+'&structureRevision='+encodeURIComponent(structureRevision):'');
  async function download(){guard();const value=await ChunkAPI.request(route,{timeoutMs:20000});await validate(value,bookId,unitId,structureRevision);guard();let saved=true;try{await storage(key,value);}catch(error){saved=false;}guard();onStatus(saved?'本单元文字与练习已保存，可离线学习。':'本机保存失败，当前内容可学习；离线前请重试。');return value;}
  let bundle;
  try{bundle=await storage(key);if(bundle)await validate(bundle,bookId,unitId,structureRevision);}catch(_){bundle=null;}
  guard();
  if(!bundle&&navigator.onLine===false)throw Object.assign(Error('本单元尚未离线保存，请联网打开一次。'),{code:'UNIT_NOT_CACHED'});
  if(bundle){onStatus('已读取本机单元内容。');if(navigator.onLine!==false)download().catch(error=>{if(error.status)onStatus('单元更新暂未完成，继续使用已保存内容。');});}
  else{try{bundle=await download();}catch(error){guard();if(error instanceof TypeError||error.name==='AbortError'||error.code==='REQUEST_TIMEOUT')throw Object.assign(Error('本单元尚未离线保存，请联网打开一次。'),{code:'UNIT_NOT_CACHED'});throw error;}}
  const pinned=clone(bundle);
  return {revision:pinned.revision,structureRevision:pinned.structureRevision,priorStructureRevision:pinned.priorStructureRevision,features:pinned.features,items:pinned.items,
   page(offset=0){return {bookId,revision:pinned.revision,structureRevision:pinned.structureRevision,unitId,title:pinned.title,itemCount:pinned.items.length,items:pinned.items.slice(offset,offset+20).map(item=>({itemId:item.itemId,contentRevision:item.contentRevision})),nextOffset:offset+20<pinned.items.length?offset+20:null};},
   item(id,revision){const value=pinned.items.find(item=>item.itemId===id&&item.contentRevision===revision);if(!value)throw Error('当前单元没有此词条');return clone(value);}
  };
 }
 global.VocabularyUnitCache={create};
 if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
})(window);
