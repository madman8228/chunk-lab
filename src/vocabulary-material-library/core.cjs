'use strict';
// Authoring-side, read-only model. It does not register courses or write learning data.
function createModel({hash,draftModel,engine,contract,applicationModel}){
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9:._-]{1,160}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
const text=value=>typeof value==='string'&&!!value.trim()&&value.length<=4000;
function check(ok,message){if(!ok)throw Error(message);}
function fields(value,allowed,label){check(value&&typeof value==='object'&&!Array.isArray(value),label+'必须为对象');check(Object.keys(value).every(key=>allowed.includes(key)),label+'包含未知字段');}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;}
function revisionOf(value){const {revision,...body}=value;return hash(JSON.stringify(canonical(body)));}
function versioned(value){return {...structuredClone(value),revision:revisionOf(value)};}
function rows(values,idKey,allowed,label){
 check(Array.isArray(values)&&values.length<=10000,label+'列表无效');const index=new Map();
 for(const value of values){fields(value,allowed,label);check(validId(value[idKey])&&!index.has(value[idKey]),label+'编号无效或重复');check(value.revision===revisionOf(value),label+'内容版本不匹配：'+value[idKey]);index.set(value[idKey],value);}return index;
}
function resolve(index,ref,idKey,label){fields(ref,[idKey,'revision'],label);const row=index.get(ref[idKey]);check(row&&row.revision===ref.revision,label+'不存在或版本不匹配');return row;}
function sourceRef(sources,ref){fields(ref,['sourceId','revision','entryId'],'来源引用');const source=sources.get(ref.sourceId);check(source&&source.revision===ref.revision,'来源不存在或版本不匹配');const entry=source.entries.find(row=>row.entryId===ref.entryId);check(entry,'原始词条不存在');return {source,entry};}
function validate(library){
 fields(library,['format','schemaVersion','stage','sources','senses','activities','applications','courses'],'材料库');
 check(library.format==='vocabulary-material-library'&&library.schemaVersion===1&&library.stage==='draft','只接受第一版制作草稿，不接受发布或学习记录');
 const sources=rows(library.sources,'sourceId',['sourceId','revision','kind','title','metadata','entries'],'来源');
 const senses=rows(library.senses,'senseId',['senseId','revision','word','meaning','partOfSpeech','definition','sourceRefs'],'词义');
 const activities=rows(library.activities,'itemId',['itemId','revision','senseRef','authorship','scene','translation','exercise','phonetic','phonetics','guidedSteps','dictation','sentenceAudio','wordChoice','chunkOrder','readAloud','images'],'教学任务');
 const applications=rows(library.applications,'materialId',['materialId','revision','kind','authorship','title','lines'],'应用材料');
 const courses=rows(library.courses,'courseId',['courseId','revision','title','module','audience','levelProposal','units'],'课程编排');
 check(sources.size&&senses.size&&activities.size&&courses.size,'来源、词义、教学任务和课程不能是空库');
 for(const source of sources.values()){
  check(['original','wordlist','textbook'].includes(source.kind)&&text(source.title),'来源类型或名称无效');
  fields(source.metadata,source.kind==='textbook'?['publisher','title','edition','volume','unit','requestedPages']:['originNote'],'来源信息');
  if(source.kind==='textbook'){
   check(['publisher','title','edition','volume','unit'].every(key=>text(source.metadata[key]))&&Array.isArray(source.metadata.requestedPages)&&source.metadata.requestedPages.length&&source.metadata.requestedPages.every(text),'教材须明确出版社、书名、版次、册次、单元及请求页');
  }else check(text(source.metadata.originNote),'非教材来源需要来源说明');
  check(Array.isArray(source.entries)&&source.entries.length>0&&source.entries.length<=10000,'来源词条无效');const ids=new Set();
  for(const entry of source.entries){
   fields(entry,['entryId','headword','gloss','rawText','location'],'原始词条');check(validId(entry.entryId)&&!ids.has(entry.entryId)&&text(entry.headword)&&text(entry.gloss)&&text(entry.rawText),'原始词条编号或原文无效');ids.add(entry.entryId);
   fields(entry.location,['unit','textbookPage','scanPage'],'来源位置');check(text(entry.location.unit),'需要明确来源单元或词表分组');
   for(const key of ['textbookPage','scanPage'])if(entry.location[key]!==undefined)check(text(entry.location[key]),'教材页与扫描页必须分别记录');
   if(source.kind==='textbook')check(text(entry.location.textbookPage),'教材词条须记录教材页，不得用扫描页代替');
  }
 }
 for(const sense of senses.values()){
  check(['word','meaning','partOfSpeech','definition'].every(key=>text(sense[key]))&&Array.isArray(sense.sourceRefs)&&sense.sourceRefs.length>0,'词义内容或来源无效');const seen=new Set();
  for(const ref of sense.sourceRefs){const {entry}=sourceRef(sources,ref),key=JSON.stringify([ref.sourceId,ref.entryId]);check(!seen.has(key),'来源引用重复');seen.add(key);check(engine.normalize(entry.headword)===engine.normalize(sense.word),'词义与来源词头不一致');}
 }
 for(const activity of activities.values()){
  const sense=resolve(senses,activity.senseRef,'senseId','词义引用');check(activity.authorship==='original','当前例句／练习必须标为新写内容，不能冒充教材原文');
  check(text(activity.scene)&&text(activity.translation),'教学任务缺少场景或翻译');
  engine.validate(activity.exercise);check(engine.blanks(activity.exercise).some(blank=>blank.answers.some(answer=>engine.normalize(answer)===engine.normalize(sense.word))),'教学任务未练习所引用词义的词头');
  if(activity.guidedSteps!==undefined)contract.validateGuidedActivity(activity,{schemaVersion:1,revision:hash(JSON.stringify(activity.guidedSteps)),steps:activity.guidedSteps},engine);
  if(activity.dictation!==undefined){fields(activity.dictation,['audio','answers'],'听写草稿');contract.validateLearning({word:sense.word,learning:{schemaVersion:1,wordDictation:{...activity.dictation,schemaVersion:1,revision:'a'.repeat(64)}}},engine);}
  if(activity.phonetic!==undefined||activity.phonetics!==undefined)contract.validateLearning({phonetic:activity.phonetic,phonetics:activity.phonetics},engine);
  if(activity.sentenceAudio!==undefined){fields(activity.sentenceAudio,['audio','text','audioByAccent'],'例句音频草稿');contract.validateLearning({exercise:activity.exercise,learning:{schemaVersion:1,sentenceAudio:{...activity.sentenceAudio,schemaVersion:1,revision:'a'.repeat(64)}}},engine);}
  if(activity.wordChoice!==undefined){fields(activity.wordChoice,['field','options','correctOptionId'],'选词草稿');contract.validateLearning({word:sense.word,exercise:activity.exercise,learning:{schemaVersion:1,wordChoice:{...activity.wordChoice,schemaVersion:1,revision:'a'.repeat(64)}}},engine);}
  if(activity.chunkOrder!==undefined){fields(activity.chunkOrder,['chunks','correctOrder'],'拼块草稿');contract.validateLearning({word:sense.word,exercise:activity.exercise,learning:{schemaVersion:1,chunkOrder:{...activity.chunkOrder,schemaVersion:1,revision:'a'.repeat(64)}}},engine);}
  if(activity.readAloud!==undefined){fields(activity.readAloud,['target','text','audio'],'跟读草稿');contract.validateLearning({word:sense.word,exercise:activity.exercise,learning:{schemaVersion:1,readAloud:{...activity.readAloud,schemaVersion:1,revision:'a'.repeat(64)}}},engine);}
  fields(activity.images,['wide','mobile'],'图片');
  check(Array.isArray(activity.images.wide)&&Array.isArray(activity.images.mobile),'图片配置无效');
  const wide=activity.images.wide,mobile=activity.images.mobile;
  check(wide.length===mobile.length&&wide.length<=1&&wide.every((url,index)=>/^assets\/[A-Za-z0-9._-]+\.webp$/.test(url)&&url===mobile[index]),'新内容只能引用一个共享 WebP，不接受 AVIF 或独立手机裁图');
  check(wide.length===0,'本阶段仅接受文字草稿；交付图须另走真实文件大小及语义核验，不能只凭路径接受');
 }
 for(const material of applications.values())applicationModel.validate(material,ref=>resolve(senses,ref,'senseId','应用词义引用'));
 for(const course of courses.values()){
  check(text(course.title)&&course.module==='vocabulary'&&['beginner','adult','textbook','general'].includes(course.audience)&&['A1','A2','B1','B2','C1','C2'].includes(course.levelProposal),'课程编排属性无效');
  check(Array.isArray(course.units)&&course.units.length>0,'课程需要明确单元');const units=new Set(),items=new Set();
  for(const unit of course.units){
   fields(unit,['unitId','title','activityRefs','materialRefs'],'单元');check(validId(unit.unitId)&&!units.has(unit.unitId)&&text(unit.title),'单元身份无效或重复');units.add(unit.unitId);
   check(Array.isArray(unit.activityRefs)&&unit.activityRefs.length>0&&Array.isArray(unit.materialRefs),'单元引用无效');const unitSenses=new Set(),materials=new Set();
   for(const ref of unit.activityRefs){const activity=resolve(activities,ref,'itemId','教学任务引用');check(!items.has(activity.itemId),'同一课程重复编排教学任务');items.add(activity.itemId);unitSenses.add(activity.senseRef.senseId);}
   for(const ref of unit.materialRefs){const material=resolve(applications,ref,'materialId','应用材料引用');check(!materials.has(material.materialId),'单元材料引用重复');materials.add(material.materialId);check(material.lines.every(line=>line.senseRefs.every(target=>unitSenses.has(target.senseId))),'材料目标不属于本单元，不能自动串入其他内容');}
  }
  // Validate the actual legacy projection, rather than implementing a parallel exercise validator.
  const errors=draftModel.validate(projectUnchecked(course,senses,activities),{requireImages:false});check(!errors.length,errors.join('；'));
 }
 return {sources,senses,activities,applications,courses};
}
function projectUnchecked(course,senses,activities){
 return {schemaVersion:1,book:{bookId:course.courseId,title:course.title,catalog:{facets:{levels:[course.levelProposal]}},units:course.units.map(unit=>({unitId:unit.unitId,title:unit.title}))},items:course.units.flatMap(unit=>unit.activityRefs.map(ref=>{
  const activity=activities.get(ref.itemId),sense=senses.get(activity.senseRef.senseId);
  const item={itemId:activity.itemId,unitId:unit.unitId,word:sense.word,meaning:sense.meaning,scene:activity.scene,translation:activity.translation,exercise:structuredClone(activity.exercise),images:structuredClone(activity.images)};
  if(activity.phonetic!==undefined)item.phonetic=activity.phonetic;if(activity.phonetics!==undefined)item.phonetics=structuredClone(activity.phonetics);
  if(activity.guidedSteps!==undefined)item.guidedSteps=structuredClone(activity.guidedSteps);if(activity.dictation!==undefined)item.dictation=structuredClone(activity.dictation);if(activity.sentenceAudio!==undefined)item.sentenceAudio=structuredClone(activity.sentenceAudio);if(activity.wordChoice!==undefined)item.wordChoice=structuredClone(activity.wordChoice);if(activity.chunkOrder!==undefined)item.chunkOrder=structuredClone(activity.chunkOrder);if(activity.readAloud!==undefined)item.readAloud=structuredClone(activity.readAloud);return item;
 }))};
}
async function previewCourse(library,courseId){
 const indexes=validate(library),course=indexes.courses.get(courseId);check(course,'课程编排不存在');
 const draft=projectUnchecked(course,indexes.senses,indexes.activities),wordbookPackage=await draftModel.compile(draft,{requireImages:false});
 const bindings=draft.items.map(item=>{const activity=indexes.activities.get(item.itemId),sense=indexes.senses.get(activity.senseRef.senseId);return {itemId:item.itemId,activityRevision:activity.revision,senseRef:structuredClone(activity.senseRef),sourceRefs:structuredClone(sense.sourceRefs)};});
 return {format:'vocabulary-course-review-preview',stage:'draft',publishable:false,courseRef:{courseId,revision:course.revision},wordbookPackage,bindings,
  applications:course.units.map(unit=>({unitId:unit.unitId,materials:unit.materialRefs.map(ref=>structuredClone(indexes.applications.get(ref.materialId)))}))};
}
function validateTeachingPlans(library,courseId,plans){
 const indexes=validate(library),course=indexes.courses.get(courseId);check(course,'课程编排不存在');
 check(Array.isArray(plans)&&plans.length>0&&plans.length<=course.units.length+1,'教学草稿编排数量无效');
 const scopes=new Set();
 for(const plan of plans){
  fields(plan,['unitId','steps','revision'],'教学草稿编排');
  check(plan.unitId===null||course.units.some(unit=>unit.unitId===plan.unitId),'教学编排单元不存在');
  check(!scopes.has(plan.unitId),'教学编排单元重复');scopes.add(plan.unitId);
  check(plan.revision===revisionOf(plan),'教学编排版本不匹配');
  check(Array.isArray(plan.steps)&&plan.steps.length>0&&plan.steps.length<=100000,'教学步骤数量无效');
  const allowed=new Map(course.units.filter(unit=>plan.unitId===null||unit.unitId===plan.unitId).flatMap(unit=>unit.activityRefs.map(ref=>[ref.itemId,ref.revision]))),ids=new Set();
  for(const step of plan.steps){
   fields(step,['stepId','itemId','activityRevision','stage','presentation'],'教学草稿步骤');
   check(validId(step.stepId)&&!ids.has(step.stepId),'教学步骤身份重复或无效');ids.add(step.stepId);
   check(allowed.get(step.itemId)===step.activityRevision,'教学步骤任务不属于本单元或版本不匹配');
   check(['recognition','phrase','sentence'].includes(step.stage),'教学阶段无效');
   const p=step.presentation;fields(p,['title','text','meaning','explanation','audio'],'教学呈现');
   check(['title','text','meaning','explanation'].every(key=>typeof p[key]==='string'&&p[key].trim()&&p[key].length<=1000),'教学文字缺失或过长');
   const activity=indexes.activities.get(step.itemId),sense=indexes.senses.get(activity.senseRef.senseId);
   check(step.stage!=='recognition'||p.text===sense.word,'认词文字与目标词不一致');
   check(step.stage!=='sentence'||p.text===engine.sentence(activity.exercise),'教学例句与任务不一致');
   fields(p.audio,['url','sha256','bytes','mimeType'],'教学示范音频');
   const extensions={'audio/ogg':'ogg','audio/mpeg':'mp3','audio/wav':'wav'},audio=p.audio;
   check(extensions[audio.mimeType]&&new RegExp('^assets/[A-Za-z0-9._-]+\\.'+extensions[audio.mimeType]+'$').test(audio.url)&&typeof audio.sha256==='string'&&/^[a-f0-9]{64}$/.test(audio.sha256)&&Number.isSafeInteger(audio.bytes)&&audio.bytes>0&&audio.bytes<=10000000,'教学音频引用无效');
  }
 }
 return structuredClone(plans);
}
function prepareDraft(input){
 const source=structuredClone(input);fields(source,['format','schemaVersion','libraryRef','courseRef','library','deliveries',...(source.schemaVersion===2?['teachingPlans']:[])],'材料课程制作文件');
 check(source.format==='vocabulary-material-course-draft'&&[1,2].includes(source.schemaVersion),'材料课程制作格式无效');
 fields(source.libraryRef,['libraryId','revision'],'材料库引用');check(validId(source.libraryRef.libraryId)&&source.libraryRef.revision===revisionOf(source.library),'材料库引用版本不匹配');
 const indexes=validate(source.library),course=resolve(indexes.courses,source.courseRef,'courseId','课程引用'),draft=projectUnchecked(course,indexes.senses,indexes.activities);
 check(Array.isArray(source.deliveries)&&source.deliveries.length===draft.items.length,'交付图与任务数量不一致');const deliveries=new Map();
 for(const delivery of source.deliveries){
  fields(delivery,['itemId','url','bytes','sha256'],'交付图');
  check(validId(delivery.itemId)&&!deliveries.has(delivery.itemId)&&/^assets\/[A-Za-z0-9._-]+\.webp$/.test(delivery.url)&&Number.isSafeInteger(delivery.bytes)&&delivery.bytes>0&&delivery.bytes<20000&&typeof delivery.sha256==='string'&&/^[a-f0-9]{64}$/.test(delivery.sha256),'交付图引用、大小或版本无效');deliveries.set(delivery.itemId,delivery);
 }
 for(const item of draft.items){const delivery=deliveries.get(item.itemId);check(delivery,'任务缺少对应交付图');item.images={wide:[delivery.url],mobile:[delivery.url]};}
 const errors=draftModel.validate(draft);check(!errors.length,errors.join('；'));
 const bindings=draft.items.map(item=>{const activity=indexes.activities.get(item.itemId),sense=indexes.senses.get(activity.senseRef.senseId);return {itemId:item.itemId,activityRevision:activity.revision,senseRef:structuredClone(activity.senseRef),sourceRefs:structuredClone(sense.sourceRefs)};});
 const teachingPlans=source.schemaVersion===2?validateTeachingPlans(source.library,course.courseId,source.teachingPlans):null;
 return {draft,source,bindings,applications:course.units.map(unit=>({unitId:unit.unitId,materials:unit.materialRefs.map(ref=>structuredClone(indexes.applications.get(ref.materialId)))})),...(teachingPlans?{teachingPlans}:{}),assetVerification:'pending',published:false};
}
return {revisionOf,versioned,validate,previewCourse,prepareDraft,validateTeachingPlans};
}
module.exports={createModel};
