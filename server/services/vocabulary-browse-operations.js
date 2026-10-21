'use strict';
const model=require('./vocabulary-browse-model');
const {decodeReceipt}=require('./operation-receipt-storage');
// Invoked inside the existing operations transaction; it never allocates receipts or writes assessment facts.
function createVocabularyBrowseOperations({db,resolvePlan,upsertEntityRow,operationError,now=Date.now,enabled=false}){
  function fail(message,code='INVALID_OPERATION',status=400){throw operationError(message,code,status);}
  function eligible(userId){return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='user_phone_identities'").get()&&!!db.prepare('SELECT 1 FROM user_phone_identities WHERE user_id=?').get(userId);}
  function planFor(userId,bookId,planRevision,unitId){
    if(!enabled||typeof resolvePlan!=='function')fail('预学习续学尚未开放','PRACTICE_UNAVAILABLE',422);
    const plan=resolvePlan(userId,bookId,planRevision,unitId);model.validate(plan);
    if(plan.bookId!==bookId||plan.revision!==planRevision||plan.unitId!==(unitId??null))fail('预学习编排版本不一致，原记录保留','CONTENT_VERSION_CHANGED',409);
    return plan;
  }
  function saved(userId,key){const row=db.prepare("SELECT data_json,seq FROM user_entity_rows WHERE user_id=? AND kind='vocabularyBrowseResume' AND item_key=? AND deleted_at IS NULL").get(userId,key);return {resume:row?JSON.parse(row.data_json):null,resumeRev:row?Number(row.seq):0};}
  function state(userId,bookId,planRevision,unitId){const plan=planFor(userId,bookId,planRevision,unitId);return {canPersist:eligible(userId),scopeKey:model.scope(plan),plan:model.summary(plan),...saved(userId,model.scope(plan)),assessment:false};}
  function apply(userId,body,seq){
    if(body.type!=='vocabulary.browse')return null;
    if(!enabled)fail('预学习续学尚未开放','PRACTICE_UNAVAILABLE',422);
    if(!eligible(userId))fail('绑定手机号后可保存浏览位置；当前可使用体验模式','PHONE_IDENTITY_REQUIRED',403);
    const p=body.payload,keys=['bookId','bookRevision','planRevision','unitId','stepId','action','targetStepId','expectedResumeRev','afterRequestId'];
    const chained=p&&Object.hasOwn(p,'afterRequestId'),validExpected=chained?typeof p.afterRequestId==='string'&&/^[A-Za-z0-9_-]{16,100}$/.test(p.afterRequestId)&&p.expectedResumeRev===undefined:Number.isSafeInteger(p?.expectedResumeRev)&&p.expectedResumeRev>=0;
    if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(key=>!keys.includes(key))||body.expected!==undefined||body.expectedRev!==undefined||!model.validId(p.bookId)||!model.validId(p.stepId)||!model.revision(p.bookRevision)||!model.revision(p.planRevision)||!validExpected||!Number.isSafeInteger(seq)||seq<1||Buffer.byteLength(JSON.stringify(body))>16384)fail('预学习保存格式无效');
    const plan=planFor(userId,p.bookId,p.planRevision,p.unitId);
    if(plan.bookRevision!==p.bookRevision)fail('课程版本不一致，原记录保留','CONTENT_VERSION_CHANGED',409);
    const key=model.scope(plan),prior=saved(userId,key),cursor=prior.resume||model.initial(plan);
    let expected=p.expectedResumeRev;
    if(chained){
      const row=db.prepare('SELECT result_json FROM user_operation_receipts WHERE user_id=? AND request_id=?').get(userId,p.afterRequestId),receipt=row&&decodeReceipt(row.result_json),operation=receipt?.operation;
      if(!operation||operation.entity!=='vocabularyBrowseResume'||operation.id!==key||operation.planRevision!==plan.revision||operation.outcome!=='applied'||operation.rev!==receipt.seq)fail('前序浏览记录尚未确认或不属于本编排，待保存记录保留','RESUME_CONFLICT',409);
      expected=operation.rev;
    }
    if(expected!==prior.resumeRev||p.stepId!==cursor.stepId)fail('浏览位置已被更新，请重新读取','RESUME_CONFLICT',409);
    let next;try{next=model.transition(plan,cursor,p.action,p.targetStepId);}catch(error){fail(error.message);}
    const value={...next,bookId:plan.bookId,bookRevision:plan.bookRevision,planRevision:plan.revision,unitId:plan.unitId,serverTime:now(),requestId:body.requestId,assessment:false};
    upsertEntityRow(userId,'vocabularyBrowseResume',key,value,seq);
    return {entity:'vocabularyBrowseResume',id:key,scopeKey:key,bookId:plan.bookId,planRevision:plan.revision,action:p.action,rev:seq,outcome:'applied',assessment:false};
  }
  return {apply,state,enabled:enabled===true};
}
module.exports={createVocabularyBrowseOperations};
