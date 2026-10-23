import {createOfflineUnitStore} from './offline-unit-store.mjs';
import {OfflineCourseSource} from './offline-course-source.mjs';
export function createOfflineCourseCache(win){
  const store=createOfflineUnitStore({indexedDB:win.indexedDB});
  const identity=()=>JSON.stringify([win.AccountStorage.owner,win.AccountStorage.sessionEpoch,win.ChunkAPI.getBase(),win.ChunkAPI.getToken()]);
  const owner=()=>String(JSON.parse(win.AccountStorage.owner)[1]);
  const service=()=>new URL(win.ChunkAPI.getBase()||'/',win.location.href).origin;
  const key=(courseId,unitId)=>'sentence-offline:'+JSON.stringify([service(),courseId,unitId]);
  function metadata(courseId,unitId){return JSON.parse(win.AccountStorage.storage.getItem(key(courseId,unitId))||'null');}
  function guard(captured){win.AccountStorage.assertCurrent();if(identity()!==captured)throw Object.assign(Error('SESSION_CHANGED'),{code:'SESSION_CHANGED'});}
  async function read(reference){
    const captured=identity(),entry=metadata(reference.courseId,reference.unitId);guard(captured);
    if(!entry)throw Object.assign(Error('本课节尚未离线保存，请联网打开一次。'),{code:'UNIT_NOT_CACHED'});
    const scope={accountId:owner(),service:service(),courseId:reference.courseId,unitId:reference.unitId,contentVersion:entry.contentVersion};
    const value=await store.read({scope,publicKey:entry.publicKey,lastConfirmedTime:entry.lastConfirmedTime});guard(captured);
    const recordTime=time=>{
      guard(captured);
      const current=metadata(reference.courseId,reference.unitId);
      if(time<current.lastConfirmedTime)throw Error('OFFLINE_CLOCK_ROLLBACK');
      if(time>current.lastConfirmedTime){current.lastConfirmedTime=time;win.AccountStorage.storage.setItem(key(reference.courseId,reference.unitId),JSON.stringify(current));}
    };
    return {...value,scope,publicKey:entry.publicKey,lastConfirmedTime:entry.lastConfirmedTime,recordTime};
  }
  return {
    source:new OfflineCourseSource({readPackage:read,captureScope:identity}),
    async catalog(courseId,unitId){
      if(!unitId)throw Object.assign(Error('UNIT_NOT_CACHED'),{code:'UNIT_NOT_CACHED'});
      await read({courseId,unitId});return {courses:[metadata(courseId,unitId).course]};
    },
    async prepare(course,unit){
      const captured=identity(),route='/api/offline-courses/'+encodeURIComponent(course.courseId)+'/units/'+encodeURIComponent(unit.unitId);
      const {publicKey}=await win.ChunkAPI.request('/api/offline-courses/public-key',{timeoutMs:8000});guard(captured);
      const {body,license}=await win.ChunkAPI.request(route,{timeoutMs:15000});guard(captured);
      if(typeof body!=='string')throw Error('INVALID_OFFLINE_BODY');
      const scope={accountId:owner(),service:service(),courseId:course.courseId,unitId:unit.unitId,contentVersion:unit.contentVersion};
      const claims=await store.save({scope,publicKey,license,body:new TextEncoder().encode(body)});guard(captured);
      win.AccountStorage.storage.setItem(key(course.courseId,unit.unitId),JSON.stringify({course,contentVersion:unit.contentVersion,publicKey,lastConfirmedTime:claims.issuedAt}));
    }
  };
}
