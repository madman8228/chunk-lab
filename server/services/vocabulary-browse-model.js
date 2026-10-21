'use strict';
const {canonicalHash}=require('../canonical-hash');
const validId=value=>typeof value==='string'&&!['__proto__','constructor','prototype'].includes(value)&&/^[A-Za-z0-9:._-]{1,160}$/.test(value);
const revision=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const validated=new WeakSet(),positions=new WeakMap(),scopes=new WeakMap();
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}}
function validate(plan){
  if(plan&&typeof plan==='object'&&validated.has(plan))return plan;
  if(!exact(plan,['schemaVersion','bookId','bookRevision','unitId','steps','revision'])||plan.schemaVersion!==1||!validId(plan.bookId)||!revision(plan.bookRevision)||plan.unitId!==null&&!validId(plan.unitId)||!Array.isArray(plan.steps)||!plan.steps.length||plan.steps.length>100000)throw Error('预学习编排格式无效');
  const ids=new Set();
  for(const step of plan.steps){const keys=['stepId','itemId','contentRevision','stage',...(step.presentation===undefined?[]:['presentation'])];if(!exact(step,keys)||!validId(step.stepId)||ids.has(step.stepId)||!validId(step.itemId)||!revision(step.contentRevision)||!['recognition','phrase','sentence'].includes(step.stage))throw Error('预学习步骤身份无效');ids.add(step.stepId);}
  const {revision:actual,...body}=plan;if(!revision(actual)||canonicalHash(body)!==actual)throw Error('预学习编排摘要不一致');freeze(plan);positions.set(plan,new Map(plan.steps.map((step,index)=>[step.stepId,index])));validated.add(plan);return plan;
}
function scope(plan){validate(plan);if(!scopes.has(plan))scopes.set(plan,'browse:'+canonicalHash([plan.bookId,plan.bookRevision,plan.unitId,plan.revision]));return scopes.get(plan);}
function position(plan,stepId){validate(plan);return positions.get(plan).get(stepId)??-1;}
function summary(plan){validate(plan);return {schemaVersion:plan.schemaVersion,bookId:plan.bookId,bookRevision:plan.bookRevision,unitId:plan.unitId,revision:plan.revision,stepCount:plan.steps.length,firstStepId:plan.steps[0].stepId,lastStepId:plan.steps.at(-1).stepId};}
function initial(plan){validate(plan);return {stepId:plan.steps[0].stepId,status:'active'};}
function transition(plan,cursor,action,targetStepId){
  validate(plan);const current=cursor||initial(plan),index=position(plan,current.stepId);
  if(!['active','browsed'].includes(current.status)||index<0||current.status==='browsed'&&index!==plan.steps.length-1)throw Error('预学习位置无效，原记录保留');
  if(action==='continue'){
    if(current.status==='browsed')throw Error('本节已经浏览完，请选择重新浏览');
    const next=index+1<plan.steps.length?{stepId:plan.steps[index+1].stepId,status:'active'}:{stepId:current.stepId,status:'browsed'};
    if(targetStepId!==undefined&&targetStepId!==next.stepId)throw Error('继续操作的目标必须是紧接的步骤');
    return next;
  }
  if(action==='jump'){
    if(position(plan,targetStepId)<0)throw Error('跳转步骤不属于当前编排');
    return {stepId:targetStepId,status:'active'};
  }
  if(action==='restart'){if(targetStepId!==undefined)throw Error('重新浏览不能指定跳转目标');return initial(plan);}
  if(action==='pause'){if(targetStepId!==undefined)throw Error('暂停不能指定跳转目标');return {stepId:current.stepId,status:current.status};}
  throw Error('预学习位置操作无效');
}
module.exports={validate,scope,initial,transition,position,summary,validId,revision};
