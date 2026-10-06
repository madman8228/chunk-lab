'use strict';

/* A restore baseline may initialize an empty account, never replace assets.
   Recheck inside the same transaction as writing, even after a valid preview. */
function createRecoveryBaselineWriter({db,isAccountEmpty,getWriter,upsertEntityRow}) {
  return db.transaction(function(userId,body,sourceId) {
    if(!isAccountEmpty(userId,sourceId)) {
      const error=new Error('账号已有数据，不能用备份整体覆盖');
      error.code='RECOVERY_ACCOUNT_NOT_EMPTY';
      error.status=409;
      throw error;
    }
    const seq=getWriter()(userId,body,true);
    (body.logicalCourses||[]).forEach(course=>upsertEntityRow(userId,'logicalCourse',course.id,course,seq));
    return seq;
  });
}

module.exports={createRecoveryBaselineWriter};
