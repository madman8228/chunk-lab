import {verifyOfflineLicense} from './offline-license.mjs';

export function createOfflineUnitStore({indexedDB,verify=verifyOfflineLicense}){
  let pending;
  function open(){
    if(!pending){pending=new Promise((resolve,reject)=>{
      const request=indexedDB.open('chunklab-sentence-offline-v1',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('units');
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(Error('离线内容库正在其他页面升级，请关闭旧页面后重试。'));
    });pending.catch(()=>{pending=null;});}
    return pending;
  }
  function key(scope){return JSON.stringify(['accountId','service','courseId','unitId','contentVersion'].map(field=>{
    if(typeof scope[field]!=='string'||!scope[field])throw Error('INVALID_OFFLINE_SCOPE');return scope[field];
  }));}
  async function access(scope,value){
    const id=key(scope),db=await open();
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction('units',value===undefined?'readonly':'readwrite');
      const request=value===undefined?transaction.objectStore('units').get(id):transaction.objectStore('units').put(value,id);
      transaction.oncomplete=()=>resolve(request.result);
      transaction.onerror=transaction.onabort=()=>reject(transaction.error||Error('离线内容保存失败，原内容保留。'));
    });
  }
  return {
    async save({scope,license,body,publicKey,now,lastConfirmedTime}){
      // Snapshot before asynchronous validation; never store a caller-mutated buffer.
      const value=structuredClone({license,body});
      const claims=await verify({scope,publicKey,...value,now,lastConfirmedTime});
      await access(scope,value);return claims;
    },
    async read({scope,publicKey,now,lastConfirmedTime}){
      const value=await access(scope);
      if(!value)throw Object.assign(Error('本课节尚未离线保存，请联网打开一次。'),{code:'UNIT_NOT_CACHED'});
      const claims=await verify({scope,publicKey,...value,now,lastConfirmedTime});
      return {...value,claims};
    }
  };
}
