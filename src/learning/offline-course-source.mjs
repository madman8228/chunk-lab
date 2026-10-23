import {verifyOfflineLicense} from './offline-license.mjs';
const fail=code=>Object.assign(new Error(code),{code});

// Adapts an already verified, persistent lesson package to CourseContentGateway.
export class OfflineCourseSource {
  constructor({readPackage,captureScope,now=Date.now}){
    this.readPackage=readPackage;this.captureScope=captureScope;this.now=now;this.active=false;
  }
  guard(){if(!this.active||this.scope!==this.captureScope())throw fail('SESSION_CHANGED');}
  async validate(){
    this.guard();
    const time=this.now();
    this.claims=await verifyOfflineLicense({...this.input,now:time,lastConfirmedTime:this.lastObservedTime});this.guard();
    this.confirmTime(time);
  }
  async open(reference,options={}){
    if(options.purpose&&options.purpose!=='practice')throw fail('OFFLINE_PURPOSE_UNAVAILABLE');
    this.scope=this.captureScope();this.active=true;
    try{
      this.input=await this.readPackage(reference);this.lastObservedTime=this.input.lastConfirmedTime||0;await this.validate();
      this.unit=JSON.parse(new TextDecoder().decode(this.input.body));
      if(this.unit.version!==1||this.unit.courseId!==reference.courseId||this.unit.unitId!==reference.unitId||this.unit.contentVersion!==this.input.scope.contentVersion||!this.unit.recordIdentity||!Array.isArray(this.unit.batches)||!this.unit.batches.length)throw fail('OFFLINE_UNIT_INVALID');
      const batch=this.batch(options.cursor||0);
      return {batch,contentVersion:this.unit.contentVersion,recordIdentity:this.unit.recordIdentity};
    }catch(error){this.dispose();throw error;}
  }
  batch(cursor){
    const source=this.unit.batches.find(batch=>cursor>=batch.cursor&&cursor<batch.cursor+batch.items.length);
    if(!source)throw fail('INVALID_CURSOR');
    const batch=structuredClone(source);batch.items=batch.items.slice(cursor-source.cursor);batch.cursor=cursor;return batch;
  }
  confirmTime(time){this.input.recordTime?.(time);this.lastObservedTime=Math.max(this.lastObservedTime,time);}
  checkAdvance(){
    const time=this.now();
    if(!(this.active&&this.scope===this.captureScope()&&this.claims&&time>=this.lastObservedTime&&time>=this.claims.issuedAt&&(this.claims.expiresAt===null||time<this.claims.expiresAt)))return false;
    try{this.confirmTime(time);return true;}catch(_){return false;}
  }
  canPrefetch(){return this.checkAdvance();}
  async authorizeCached(){await this.validate();}
  async loadBatch(cursor){await this.validate();return {batch:this.batch(cursor),contentVersion:this.unit.contentVersion};}
  async loadAssets(){throw fail('OFFLINE_MEDIA_UNAVAILABLE');}
  async pause(){this.guard();}
  dispose(){this.active=false;this.input=null;this.unit=null;this.claims=null;}
}
