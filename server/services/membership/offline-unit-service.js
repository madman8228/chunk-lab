'use strict';
const crypto=require('node:crypto');
const failure=(code,status=403)=>Object.assign(new Error(code),{code,status});
function createOfflineUnitService({registry,access,licenses,service}){
  return {read({courseId,unitId},userId){
    if(!userId)throw failure('AUTH_REQUIRED',401);
    const decision=access.authorize(courseId,userId);
    if(!decision.allowed||!['free','member'].includes(decision.mode))throw failure('OFFLINE_ACCESS_DENIED');
    const course=registry.course(courseId),unit=course?.units.find(row=>row.unitId===unitId);
    if(!unit||course.contentType!=='sentence'||!unit.contentVersion||!unit.recordIdentity)throw failure('OFFLINE_UNIT_UNAVAILABLE',404);
    const batches=[];let cursor=0;
    do{
      const batch=registry.load(courseId,unitId,cursor).payload;
      if(batch.courseId!==courseId||batch.unitId!==unitId||batch.contentVersion!==unit.contentVersion||batch.cursor!==cursor||!Array.isArray(batch.items)||!batch.items.length)throw failure('OFFLINE_UNIT_INVALID',503);
      if(batch.nextCursor!==null&&batch.nextCursor!==cursor+batch.items.length)throw failure('OFFLINE_UNIT_INVALID',503);
      batches.push(batch);cursor=batch.nextCursor;
      if(batches.length>10000)throw failure('OFFLINE_UNIT_INVALID',503);
    }while(cursor!==null);
    const ids=batches.flatMap(batch=>batch.items.map(item=>item.cid||item.id));
    if(ids.length!==unit.itemIds.length||ids.some((id,index)=>id!==unit.itemIds[index]))throw failure('OFFLINE_UNIT_INVALID',503);
    const body=JSON.stringify({version:1,courseId,unitId,contentVersion:unit.contentVersion,recordIdentity:unit.recordIdentity,batches});
    const sha256=crypto.createHash('sha256').update(body).digest('hex');
    const license=licenses.issue({accountId:String(userId),service,courseId,unitId,contentVersion:unit.contentVersion,sha256},decision);
    return {body,license};
  }};
}
module.exports={createOfflineUnitService};
