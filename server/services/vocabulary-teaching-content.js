'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{canonicalHash}=require('../canonical-hash'),model=require('./vocabulary-browse-model');
const fail=(message,status=422)=>Object.assign(Error(message),{status,code:status===409?'CONTENT_VERSION_CHANGED':'INVALID_TEACHING_CONTENT'});
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
function validateStep(step,expectedRevision,item,appRoot,metadataOnly,checked=new Set(),readAsset){
 const p=step.presentation;
 if(expectedRevision!==step.contentRevision||!metadataOnly&&(!item||item.contentRevision!==step.contentRevision))throw fail('预学习步骤与教学项目版本不一致');
 if(!exact(p,['title','text','meaning','explanation','audio'])||['title','text','meaning','explanation'].some(key=>typeof p[key]!=='string'||!p[key].trim()||p[key].length>1000))throw fail('预学习教学文字缺失或过长');
 if(!metadataOnly&&(step.stage==='recognition'&&p.text!==item.word||step.stage==='sentence'&&p.text!==item.example))throw fail('预学习单词或例句与任务不一致');
 const audio=p.audio,extensions={'audio/ogg':'ogg','audio/mpeg':'mp3','audio/wav':'wav'};
 if(!exact(audio,['url','sha256','bytes','mimeType'])||!extensions[audio.mimeType]||!new RegExp('^assets/[A-Za-z0-9._-]+\\.'+extensions[audio.mimeType]+'$').test(audio.url)||!model.revision(audio.sha256)||!Number.isSafeInteger(audio.bytes)||audio.bytes<1||audio.bytes>10000000)throw fail('预学习示范音频引用无效');
 if(metadataOnly)return;
 const key=canonicalHash(audio);if(checked.has(key))return;
 let bytes;if(readAsset)bytes=readAsset(audio.url);else{const assetRoot=fs.realpathSync(path.join(appRoot,'assets')),file=fs.realpathSync(path.join(appRoot,audio.url));if(path.dirname(file)!==assetRoot)throw fail('预学习音频不能越出 assets');bytes=fs.readFileSync(file);}
 if(bytes.length!==audio.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==audio.sha256)throw fail('预学习音频已变化，请重新审核');
 const signature=audio.mimeType==='audio/ogg'?bytes.toString('ascii',0,4)==='OggS':audio.mimeType==='audio/wav'?bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE':bytes.toString('ascii',0,3)==='ID3'||bytes.length>1&&bytes[0]===255&&(bytes[1]&224)===224;
 if(!signature)throw fail('预学习音频格式不一致');checked.add(key);
}
function validateRelease(release,book,items,appRoot,{metadataOnly=false,readAsset}={}){
 if(!exact(release,['schemaVersion','plans','review'])||release.schemaVersion!==1||!Array.isArray(release.plans)||!release.plans.length||release.plans.length>1+(book.units?.length||0))throw fail('预学习发布来源无效');
 const review=release.review;if(!exact(review,['revision','content','assets','rights','reviewer','note'])||review.revision!==canonicalHash(release.plans)||['content','assets','rights'].some(key=>review[key]!=='approved')||typeof review.reviewer!=='string'||!review.reviewer.trim()||review.reviewer.length>200||typeof review.note!=='string'||!review.note.trim()||review.note.length>4000)throw fail('预学习须有绑定本编排的内容、素材和授权审核');
 const byItem=new Map(items.map(item=>[item.itemId,item])),units=new Set(),checked=new Set();
 for(const plan of release.plans){
  model.validate(plan);if(plan.bookId!==book.bookId||plan.bookRevision!==book.revision||units.has(plan.unitId))throw fail('预学习课程版本或单元重复');units.add(plan.unitId);
  const unit=plan.unitId===null?null:book.units?.find(row=>row.unitId===plan.unitId);if(plan.unitId!==null&&!unit)throw fail('预学习单元不存在');
  const unitItems=unit?new Set(unit.itemIds):null,refs=new Map(book.items.filter(ref=>!unitItems||unitItems.has(ref.itemId)).map(ref=>[ref.itemId,ref.contentRevision]));
  for(const step of plan.steps)validateStep(step,refs.get(step.itemId),byItem.get(step.itemId),appRoot,metadataOnly,checked,readAsset);
 }
 return release;
}
function createVocabularyTeachingContent({content,appRoot,resolveImage}){
 const cache=new Map();
 function load(userId,bookId){
  if(!model.validId(bookId))throw fail('预学习读取格式无效',400);
  // Check ownership even on cache hits; the cache never projects an old version.
  const book=content.book(bookId,userId);if(bookId.startsWith('personal-book:'))throw fail('个人草稿预学习尚未开放',422);
  const directory=path.resolve(content.publicationDirectory),folder=path.join(directory,crypto.createHash('sha256').update(JSON.stringify(bookId)).digest('hex')),file=path.join(folder,'teaching.json');
  if(!fs.existsSync(file))return null;
  if(fs.realpathSync(file)!==file||fs.realpathSync(folder)!==folder||fs.realpathSync(directory)!==directory)throw fail('预学习归档路径无效');
  const stat=fs.statSync(file,{bigint:true});if(!stat.isFile()||stat.size>10000000n)throw fail('预学习编排归档超过大小限制或不是文件');
  const signature=[book.revision,stat.size,stat.mtimeNs,stat.ctimeNs,stat.ino].join(':');
  if(cache.get(file)?.signature===signature){const hit=cache.get(file);cache.delete(file);cache.set(file,hit);return hit.release;}
  const release=JSON.parse(fs.readFileSync(file,'utf8'));validateRelease(release,book,[],appRoot,{metadataOnly:true});
  Object.freeze(release.plans);Object.freeze(release.review);Object.freeze(release);
  cache.delete(file);cache.set(file,{signature,release});while(cache.size>4)cache.delete(cache.keys().next().value);return release;
 }
 function options(userId,bookId){
  if(!model.validId(bookId))throw fail('预学习读取格式无效',400);
  if(bookId.startsWith('personal-book:')){content.book(bookId,userId);return [];}
  return (load(userId,bookId)?.plans||[]).map(model.summary);
 }
 function resolvePlan(userId,bookId,planRevision,unitId){
  if(!model.revision(planRevision)||unitId!==undefined&&!model.validId(unitId))throw fail('预学习读取格式无效',400);
  const release=load(userId,bookId);if(!release)throw fail('当前课程没有预学习编排',404);
  const plan=release.plans.find(row=>row.revision===planRevision&&row.unitId===(unitId??null));if(!plan)throw fail('预学习编排版本已变化，原位置保留',409);return plan;
 }
 function catalog(userId,bookId,planRevision,unitId,offset=0,limit=20){
  offset=Number(offset);limit=Number(limit);if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>50)throw fail('目录分页参数无效',400);
  const plan=resolvePlan(userId,bookId,planRevision,unitId);
  return {plan:model.summary(plan),offset,steps:plan.steps.slice(offset,offset+limit).map(step=>({stepId:step.stepId,itemId:step.itemId,stage:step.stage,title:step.presentation.title,text:step.presentation.text})),nextOffset:offset+limit<plan.steps.length?offset+limit:null};
 }
 function step(userId,bookId,planRevision,unitId,stepId){
  if(!model.validId(stepId))throw fail('预学习步骤编号无效',400);
  const plan=resolvePlan(userId,bookId,planRevision,unitId),index=model.position(plan,stepId);if(index<0)throw fail('步骤不属于当前预学习编排',404);
  const current=plan.steps[index],item=content.item(current.itemId,current.contentRevision,userId);
  validateStep(current,current.contentRevision,item,appRoot,false);
  const deliveryImages=resolveImage?Object.fromEntries(['wide','mobile'].map(profile=>[profile,item.images[profile].map(reference=>resolveImage(reference))])):null;
  return {plan:model.summary(plan),step:current,item,...(deliveryImages?{deliveryImages}:{}),position:index,previousStepId:plan.steps[index-1]?.stepId||null,nextStepId:plan.steps[index+1]?.stepId||null};
 }
 return {resolvePlan,options,catalog,step};
}
module.exports={validateRelease,createVocabularyTeachingContent};
