(function(global){
 'use strict';
 const identity=()=>LearningSessionBootstrap.identity();
 function create({bookId,planRevision,unitId}){
  const owner=identity(),key='vocabulary-browse-content:'+JSON.stringify([ChunkAPI.getBase(),AccountStorage.owner,bookId,planRevision,unitId||null]),base='/api/wordbooks/'+encodeURIComponent(bookId),query='?planRevision='+encodeURIComponent(planRevision)+(unitId?'&unitId='+encodeURIComponent(unitId):'');
  let confirmed=null,cursor=null,tail=null,blocked=false,experience=null;
  const reviews=new WeakMap();
  function guard(){AccountStorage.assertCurrent();if(owner!==identity())throw Error('账号或服务已变化，请重新打开课程；原记录保留。');}
  async function read(){guard();const row=await IDBStore.readSyncMeta(key);guard();return row||{key,steps:{},catalog:{},order:[]};}
  async function remember(field,value){guard();await IDBStore.updateSyncMeta(key,row=>{row[field]=value;return row;});guard();}
  async function request(url,cached){guard();try{const value=await ChunkAPI.request(url,{timeoutMs:12000});guard();return value;}catch(error){guard();if(!error.status&&cached)return cached;throw error;}}
  async function pending(){guard();const rows=await ServerStore.pending();guard();return rows.filter(row=>row.owner===AccountStorage.owner&&row.operation?.type==='vocabulary.browse'&&row.operation.payload.bookId===bookId&&row.operation.payload.planRevision===planRevision&&(row.operation.payload.unitId||undefined)===unitId);}
  async function reconcile(){
   guard();if(!confirmed)throw Error('课程位置尚未读取');
   const cache=await ServerCache.read();guard();const cached=cache?.snapshot?.mem?.vocabularyBrowseResume?.[confirmed.scopeKey],rev=cache?.snapshot?.revs?.vocabularyBrowseResume?.[confirmed.scopeKey];
   if(cached&&rev>confirmed.resumeRev)confirmed={...confirmed,resume:cached,resumeRev:rev};
   cursor=confirmed.resume?{stepId:confirmed.resume.stepId,status:confirmed.resume.status}:{stepId:confirmed.plan.firstStepId,status:'active'};tail=null;blocked=false;
   if(!confirmed.canPersist&&experience)cursor={...experience};
   const rows=await pending(),covered=rows.findIndex(row=>row.requestId===confirmed.resume?.requestId);
   for(let i=0;i<rows.length;i++){
    const row=rows[i],p=row.operation.payload;
    if(i<=covered||row.receipt?.seq<=confirmed.resumeRev)continue;
    if(row.status==='blocked'){blocked=true;break;}
    const follows=tail?p.afterRequestId===tail:p.afterRequestId?p.afterRequestId===confirmed.resume?.requestId:p.expectedResumeRev===confirmed.resumeRev;
    if(!follows||p.stepId!==cursor.stepId){blocked=true;break;}
    if(p.action==='continue'){if(typeof p.targetStepId!=='string'){blocked=true;break;}cursor={stepId:p.targetStepId,status:p.stepId===confirmed.plan.lastStepId?'browsed':'active'};}
    else if(p.action==='jump')cursor={stepId:p.targetStepId,status:'active'};
    else if(p.action==='restart')cursor={stepId:confirmed.plan.firstStepId,status:'active'};
    tail=row.requestId;
   }
   return {confirmed,cursor:{...cursor},pending:rows.filter(row=>!row.receipt&&row.requestId!==confirmed.resume?.requestId).length,blocked};
  }
  async function open(){const local=await read();confirmed=await request(base+'/browse-state'+query,local.state);if(confirmed.plan?.revision!==planRevision||confirmed.plan.bookId!==bookId)throw Error('教学编排版本不一致');await remember('state',confirmed);return reconcile();}
  async function step(stepId){
   const local=await read(),value=await request(base+'/teaching-step'+query+'&stepId='+encodeURIComponent(stepId),local.steps?.[stepId]);
   if(value.plan?.revision!==planRevision||value.step?.stepId!==stepId)throw Error('教学步骤版本不一致');
   guard();await IDBStore.updateSyncMeta(key,row=>{row.steps=row.steps||{};row.order=(row.order||[]).filter(id=>id!==stepId);row.order.push(stepId);row.steps[stepId]=value;while(row.order.length>60)delete row.steps[row.order.shift()];return row;});guard();return value;
  }
  async function catalog(offset=0){const local=await read(),value=await request(base+'/teaching-catalog'+query+'&offset='+offset+'&limit=20',local.catalog?.[offset]);guard();await IDBStore.updateSyncMeta(key,row=>{row.catalog=row.catalog||{};row.catalog[offset]=value;const pages=Object.keys(row.catalog);if(pages.length>5)delete row.catalog[pages.find(page=>page!==String(offset))];return row;});guard();return value;}
  async function enqueue(action,targetStepId){
   const state=await reconcile();if(blocked)throw Error('浏览位置发生冲突，待保存记录保留；请连接后重新读取。');
   const p={bookId,bookRevision:confirmed.plan.bookRevision,planRevision,stepId:cursor.stepId,action,...(unitId?{unitId}:{}),...(tail?{afterRequestId:tail}:{expectedResumeRev:confirmed.resumeRev}),...(targetStepId!==undefined?{targetStepId}:{})};
   if(!state.confirmed.canPersist){experience=action==='restart'?{stepId:confirmed.plan.firstStepId,status:'active'}:action==='continue'?{stepId:targetStepId,status:cursor.stepId===confirmed.plan.lastStepId?'browsed':'active'}:action==='jump'?{stepId:targetStepId,status:'active'}:cursor;return {cursor:experience,pending:0,blocked:false,confirmed};}
   guard();await ServerStore.submit('vocabulary.browse',p,{requestId:crypto.randomUUID()});guard();return reconcile();
  }
  async function reviewConflict(){
   const rows=await pending(),first=rows[0];
   if(!first||first.status!=='blocked'||first.lastError!=='RESUME_CONFLICT')throw Error('没有可处理的浏览位置冲突，请重新读取。');
   // A choice must compare against a fresh server response, never an offline cache.
   const cloud=await ChunkAPI.request(base+'/browse-state'+query,{timeoutMs:12000});guard();
   if(!cloud.canPersist||cloud.plan?.revision!==planRevision||cloud.plan.bookId!==bookId||(cloud.plan.unitId||undefined)!==unitId)throw Error('课程或保存资格已变化，原记录保留。');
   let localStepId=first.operation.payload.stepId;
   for(let i=0;i<rows.length;i++){
    const row=rows[i],p=row.operation.payload;
    if(row.receipt||row.status==='acked-awaiting-apply'||row.scope!==first.scope||p.bookRevision!==cloud.plan.bookRevision||p.stepId!==localStepId||i&&p.afterRequestId!==rows[i-1].requestId)throw Error('本机冲突链已变化，原记录保留。');
    if(p.action==='continue'||p.action==='jump'){if(typeof p.targetStepId!=='string')throw Error('本机浏览目标无效，原记录保留。');localStepId=p.targetStepId;}
    else if(p.action==='restart')localStepId=cloud.plan.firstStepId;
    else if(p.action!=='pause')throw Error('本机浏览操作无效，原记录保留。');
   }
   const cloudStepId=cloud.resume?.stepId||cloud.plan.firstStepId;
   async function freshStep(id){const value=await ChunkAPI.request(base+'/teaching-step'+query+'&stepId='+encodeURIComponent(id),{timeoutMs:12000});guard();if(value.plan?.revision!==planRevision||value.step?.stepId!==id)throw Error('教学步骤已变化，原记录保留。');return value;}
   const cloudStep=await freshStep(cloudStepId),localStep=localStepId===cloudStepId?cloudStep:await freshStep(localStepId);
   if(JSON.stringify(await pending())!==JSON.stringify(rows))throw Error('待保存记录已变化，请重新核对。');
   const review={cloud,cloudStep,localStep,selection:{owner:AccountStorage.owner,scope:first.scope,bookId,planRevision,unitId:unitId||null,requestIds:rows.map(row=>row.requestId)}};
   reviews.set(review,JSON.parse(JSON.stringify(review)));return review;
  }
  async function resolveConflict(review,choice,options){
   guard();const saved=reviews.get(review);
   if(!saved||options?.confirmed!==true||!['cloud','local'].includes(choice))throw Error('请先核对浏览位置并明确确认选择。');
   const result=await ServerStore.resolveVocabularyBrowseConflict({...saved.selection,choice,confirmed:true},{resumeRev:saved.cloud.resumeRev,stepId:saved.cloudStep.step.stepId,bookRevision:saved.cloud.plan.bookRevision,targetStepId:saved.localStep.step.stepId});guard();
   reviews.delete(review);confirmed=result.cloud;await remember('state',confirmed);
   return {...await reconcile(),archive:result.archive};
  }
  return {open,step,catalog,enqueue,reconcile,reviewConflict,resolveConflict};
 }
 global.VocabularyBrowseStore={create};
})(window);
