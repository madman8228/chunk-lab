/* Shared content contract; never writes course assets or account storage. */
(function(root){
 'use strict';
 const validId=v=>typeof v==='string'&&!['__proto__','constructor','prototype'].includes(v)&&/^[A-Za-z0-9:._-]{1,160}$/.test(v);
 const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=1000;
 const revision=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
 const modes=Object.freeze({
  'sentence-cloze':Object.freeze({label:'句子填空',implemented:true,inputs:['typing']}),
  'guided-expression':Object.freeze({label:'中文引导表达',implemented:true,inputs:['typing','chunks']}),
  'read-aloud':Object.freeze({label:'跟读',implemented:true,inputs:['speech'],independent:true,learningKey:'readAloud'}),
  'word-choice':Object.freeze({label:'选词填空',implemented:true,inputs:['choice'],independent:true,learningKey:'wordChoice'}),
  'chunk-order':Object.freeze({label:'词序拼块',implemented:true,inputs:['chunks'],independent:true,learningKey:'chunkOrder'}),
  'word-dictation':Object.freeze({label:'单词听写',implemented:true,inputs:['typing'],independent:true,learningKey:'wordDictation'})
 });
 const dimensions=['audiences','schoolStages','grades','levels','goals','topics','exams'],scalars=['seriesId','publisherId','textbookVersion','edition','volume'];
 function check(value,message){if(!value)throw Error(message);}
 function validateBookStructure(book){
  if(book.catalog!==undefined){
   const c=book.catalog;check(c&&typeof c==='object'&&!Array.isArray(c),'目录信息无效');
   check(Object.keys(c).every(k=>['description','coverUrl','facets'].includes(k)),'目录包含未知字段');
   if(c.description!==undefined)check(text(c.description),'简介无效');
   if(c.coverUrl!==undefined)check(typeof c.coverUrl==='string'&&/^assets\/[A-Za-z0-9._-]+\.(avif|webp|png|jpg|svg)$/.test(c.coverUrl),'封面路径无效');
   const facets=c.facets||{};check(facets&&typeof facets==='object'&&!Array.isArray(facets),'分类无效');
   check(Object.keys(facets).every(k=>dimensions.includes(k)||scalars.includes(k)),'未知分类字段');
   for(const [k,v] of Object.entries(facets))check(dimensions.includes(k)?Array.isArray(v)&&v.length<=20&&v.every(x=>text(x)&&x.length<=60):text(v)&&v.length<=100,'分类值无效：'+k);
  }
  if(book.units===undefined)return book;
  check(revision(book.structureRevision),'单元结构需要独立版本');check(Array.isArray(book.units)&&book.units.length>0,'单元列表无效');
  const seen=new Set(),assigned=[];
  for(const u of book.units){
   check(u&&validId(u.unitId)&&!seen.has(u.unitId)&&text(u.title),'单元身份或标题无效');seen.add(u.unitId);
   check(Object.keys(u).every(k=>['unitId','title','itemIds'].includes(k)),'单元包含未知字段');
   check(Array.isArray(u.itemIds)&&u.itemIds.length>0&&u.itemIds.every(validId),'单元引用无效');assigned.push(...u.itemIds);
  }
  check(assigned.length===book.items.length&&assigned.every((v,i)=>v===book.items[i].itemId),'单元必须按顺序完整分配项目，不得重复、遗漏或跨书引用');return book;
 }
 function validateGuidedActivity(item,activity,engine){
  check(activity&&activity.schemaVersion===1&&revision(activity.revision),'引导练习版本无效');
  check(Object.keys(activity).every(k=>['schemaVersion','revision','steps'].includes(k)),'引导练习包含未知字段');
  const steps=activity.steps;check(Array.isArray(steps)&&steps.length>0&&steps.length<=100,'引导步骤无效');engine.validate(item.exercise);
  const fields=engine.blanks(item.exercise),assigned=new Set();
  for(const s of steps){
   check(s&&Object.keys(s).every(k=>['prompt','answer','choices','field'].includes(k))&&text(s.prompt)&&text(s.answer),'引导提示或答案无效');
   check(Array.isArray(s.choices)&&s.choices.length>=2&&s.choices.length<=8&&s.choices.every(text),'引导选项无效');
   const choices=s.choices.map(engine.normalize);check(new Set(choices).size===choices.length&&choices.includes(engine.normalize(s.answer)),'选项重复或缺少正确答案');
   if(s.field!==undefined){const f=fields.find(f=>f.id===s.field);check(f&&!assigned.has(s.field)&&f.answers.some(a=>engine.normalize(a)===engine.normalize(s.answer)),'答案字段不匹配');assigned.add(s.field);}
  }
  check(assigned.size===fields.length,'引导练习遗漏原题字段');check(engine.normalize(steps.map(s=>s.answer).join(' '))===engine.normalize(engine.sentence(item.exercise)),'引导步骤改变了原句');return activity;
 }
 function validateLearning(item,engine){
  if(item.learning===undefined)return item;
  check(item.learning&&item.learning.schemaVersion===1,'教学配置版本无效');
  check(Object.keys(item.learning).every(k=>['schemaVersion','guidedExpression','wordDictation','sentenceAudio','wordChoice','chunkOrder','readAloud'].includes(k)),'包含未支持的练习配置');
  if(item.learning.readAloud!==undefined){const model=root.VocabularyReadAloud||(typeof require==='function'?require('./vocabulary-read-aloud'):null);check(model,'跟读校验器尚未加载');model.validate(item,item.learning.readAloud,engine);}
  if(item.learning.chunkOrder!==undefined){const model=root.VocabularyChunkOrder||(typeof require==='function'?require('./vocabulary-chunk-order'):null);check(model,'拼块校验器尚未加载');model.validate(item,item.learning.chunkOrder,engine);}
  if(item.learning.wordChoice!==undefined){const model=root.VocabularyWordChoice||(typeof require==='function'?require('./vocabulary-word-choice'):null);check(model,'选词校验器尚未加载');model.validate(item,item.learning.wordChoice,engine);}
  if(item.learning.sentenceAudio!==undefined){const model=root.VocabularySentenceAudio||(typeof require==='function'?require('./vocabulary-sentence-audio'):null);check(model,'例句音频校验器尚未加载');model.validate(item,item.learning.sentenceAudio,engine);}
  if(item.learning.guidedExpression!==undefined)validateGuidedActivity(item,item.learning.guidedExpression,engine);
  if(item.learning.wordDictation!==undefined){const dictation=root.VocabularyWordDictation||(typeof require==='function'?require('./vocabulary-word-dictation'):null);check(dictation,'听写内容校验器尚未加载');dictation.validate(item,item.learning.wordDictation);}return item;
 }
 function capabilities(item,engine){
  validateLearning(item,engine);
  return Object.entries(modes).map(([practiceType,m])=>{
   const missing=practiceType==='guided-expression'&&!item.learning?.guidedExpression?'缺少中文引导素材':practiceType==='word-dictation'&&!item.learning?.wordDictation?'缺少课程听写音频':practiceType==='word-choice'&&!item.learning?.wordChoice?'缺少课程选词素材':practiceType==='chunk-order'&&!item.learning?.chunkOrder?'缺少课程拼块素材':practiceType==='read-aloud'&&!item.learning?.readAloud?'缺少课程跟读示范':'';
   return {practiceType,label:m.label,available:m.implemented&&!missing,inputs:m.inputs.slice(),reason:!m.implemented?'尚未实现':missing};
  });
 }
 function details(book){
  validateBookStructure(book);
  return {bookId:book.bookId,revision:book.revision,title:book.title,itemCount:book.itemCount,catalog:book.catalog||null,relatedCourseIds:(book.relatedCourseIds||[]).slice(),structureRevision:book.structureRevision||null,features:{unitSessions:true},
   units:(book.units||[]).map(u=>({unitId:u.unitId,title:u.title,itemCount:u.itemIds.length})),organization:book.units?'units':'flat'};
 }
 const separatePractice=practiceType=>typeof practiceType==='string'&&Object.hasOwn(modes,practiceType)&&modes[practiceType].independent===true;
 const api={modes,separatePractice,validateBookStructure,validateGuidedActivity,validateLearning,capabilities,details};root.VocabularyCourseContract=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
