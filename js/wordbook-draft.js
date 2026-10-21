/* Draft preparation only: no persistence, import, publish or account writes. */
(function(g){
 'use strict';
 const id=v=>typeof v==='string'&&!['__proto__','constructor','prototype'].includes(v)&&/^[A-Za-z0-9:._-]{1,160}$/.test(v);
 const engine=()=>g.JQKAClozeEngine||(typeof require==='function'?require('../landing/sentence-cloze-engine'):null);
 const contract=()=>g.VocabularyCourseContract||(typeof require==='function'?require('./vocabulary-course-contract'):null);
 function exercise(sentence){
  const parts=[];let at=0,n=0;const regex=/\[([^\[\]]+)\]/g;let match;
  while((match=regex.exec(sentence))){if(match.index>at)parts.push({text:sentence.slice(at,match.index)});parts.push({id:'blank'+(++n),label:match[1].trim(),answers:[match[1].trim()]});at=regex.lastIndex;}
  if(at<sentence.length)parts.push({text:sentence.slice(at)});
  if(!n||parts.some(p=>p.text&&/[\[\]]/.test(p.text)))throw Error('请用 [正确答案] 明确标出填空，括号必须成对。');
  return engine().validate({version:1,parts});
 }
 function guidedSteps(source,exercise){
  if(!source.trim())return undefined;
  const used=new Set();return source.split(/\r?\n/).filter(x=>x.trim()).map((line,index)=>{
   const [prompt,answer,...wrong]=line.split('|').map(x=>x.trim());if(!prompt||!answer||wrong.length<1||wrong.some(x=>!x))throw Error('引导第 '+(index+1)+' 行需要：中文提示 | 英文答案 | 干扰选项');
   const step={prompt,answer,choices:[answer,...wrong]},fields=engine().blanks(exercise).filter(p=>p.answers.some(a=>engine().normalize(a)===engine().normalize(answer))&&!used.has(p.id));
   if(fields.length>1)throw Error('同一答案对应多个填空，请通过草稿文件明确步骤的 field');
   if(fields.length===1){step.field=fields[0].id;used.add(step.field);}return step;
  });
 }
 function validate(draft,{requireImages=true}={}){
  const errors=[];if(!draft||draft.schemaVersion!==1||!draft.book||!Array.isArray(draft.items))return ['草稿格式无效'];
  const b=draft.book,sourceUnits=Array.isArray(b.units)?b.units:[];if(!id(b.bookId)||b.bookId==='pilot-six-v1')errors.push('请使用独立的新单词本编号，不能替换六词示范');
  if(Object.keys(draft).some(k=>!['schemaVersion','book','items'].includes(k))||Object.keys(b).some(k=>!['bookId','title','catalog','units','relatedCourseIds'].includes(k)))errors.push('草稿包含未支持字段，不能静默丢弃');
  if(b.relatedCourseIds!==undefined&&(!Array.isArray(b.relatedCourseIds)||b.relatedCourseIds.length>20||b.relatedCourseIds.some(value=>typeof value!=='string'||!/^course:[A-Za-z0-9:._-]{1,193}$/.test(value))||new Set(b.relatedCourseIds).size!==b.relatedCourseIds.length))errors.push('关联课程编号无效或重复');
  if(sourceUnits.some(u=>!u||Object.keys(u).some(k=>!['unitId','title'].includes(k))))errors.push('单元字段无效');
  if(typeof b.title!=='string'||!b.title.trim()||b.title.length>200)errors.push('请填写单词本名称');
  if(!Array.isArray(b.units)||!b.units.length)errors.push('至少需要一个明确的内容单元');
  if(draft.items.length===0||draft.items.length>10000)errors.push('项目数量需为 1–10000');
  const ids=new Set(),unitIds=new Set(sourceUnits.map(u=>u?.unitId));
  draft.items.forEach((item,index)=>{
   const prefix='第 '+(index+1)+' 项：';
   if(!item||typeof item!=='object'||Array.isArray(item)){errors.push(prefix+'教学项目格式无效');return;}
   if(Object.keys(item).some(k=>!['itemId','unitId','word','meaning','scene','translation','exercise','images','guidedSteps','dictation','sentenceAudio','wordChoice','chunkOrder','readAloud'].includes(k)))errors.push(prefix+'包含不支持的字段，不能静默丢弃');
   if(item.readAloud!==undefined)try{if(!item.readAloud||Object.keys(item.readAloud).some(k=>!['target','text','audio'].includes(k)))throw Error('跟读草稿字段无效');contract().validateLearning({...item,learning:{schemaVersion:1,readAloud:{...item.readAloud,schemaVersion:1,revision:'a'.repeat(64)}}},engine());}catch(error){errors.push(prefix+error.message);}
   if(item.chunkOrder!==undefined)try{if(!item.chunkOrder||Object.keys(item.chunkOrder).some(k=>!['chunks','correctOrder'].includes(k)))throw Error('拼块草稿字段无效');contract().validateLearning({...item,learning:{schemaVersion:1,chunkOrder:{...item.chunkOrder,schemaVersion:1,revision:'a'.repeat(64)}}},engine());}catch(error){errors.push(prefix+error.message);}
   if(item.wordChoice!==undefined)try{if(!item.wordChoice||Object.keys(item.wordChoice).some(k=>!['field','options','correctOptionId'].includes(k)))throw Error('选词草稿字段无效');contract().validateLearning({...item,learning:{schemaVersion:1,wordChoice:{...item.wordChoice,schemaVersion:1,revision:'a'.repeat(64)}}},engine());}catch(error){errors.push(prefix+error.message);}
   if(item.sentenceAudio!==undefined)try{if(!item.sentenceAudio||Object.keys(item.sentenceAudio).some(k=>!['audio','text'].includes(k)))throw Error('例句音频草稿字段无效');contract().validateLearning({...item,learning:{schemaVersion:1,sentenceAudio:{...item.sentenceAudio,schemaVersion:1,revision:'a'.repeat(64)}}},engine());}catch(error){errors.push(prefix+error.message);}
   if(!id(item.itemId)||ids.has(item.itemId))errors.push(prefix+'项目编号无效或重复');ids.add(item.itemId);
   if(!unitIds.has(item.unitId))errors.push(prefix+'未分配到有效单元');
   for(const key of ['word','meaning','scene','translation'])if(typeof item[key]!=='string'||!item[key].trim()||item[key].length>1000)errors.push(prefix+'缺少或过长的 '+key);
   try{engine().validate(item.exercise);}catch(e){errors.push(prefix+e.message);}
   for(const profile of ['wide','mobile'])if(!Array.isArray(item.images?.[profile])||requireImages&&!item.images[profile].length||item.images[profile].some(url=>typeof url!=='string'||!/^assets\/[A-Za-z0-9._-]+\.(avif|webp)$/.test(url)))errors.push(prefix+'缺少有效 '+profile+' 插画引用');
   if(item.guidedSteps)try{contract().validateGuidedActivity(item,{schemaVersion:1,revision:'a'.repeat(64),steps:item.guidedSteps},engine());}catch(e){errors.push(prefix+e.message);}
   if(item.dictation!==undefined)try{
    if(!item.dictation||Object.keys(item.dictation).some(key=>!['audio','answers'].includes(key)))throw Error('听写草稿字段无效');
    contract().validateLearning({...item,learning:{schemaVersion:1,wordDictation:{...item.dictation,schemaVersion:1,revision:'a'.repeat(64)}}},engine());
   }catch(e){errors.push(prefix+e.message);}
  });
  try{const units=sourceUnits.map(u=>({...u,itemIds:draft.items.filter(item=>item?.unitId===u?.unitId).map(item=>item.itemId)}));contract().validateBookStructure({catalog:b.catalog,units,structureRevision:'a'.repeat(64),items:units.flatMap(u=>u.itemIds.map(itemId=>({itemId})))});}catch(e){errors.push(e.message);}
  return errors;
 }
 async function compile(draft,{requireImages=true}={}){
  const errors=validate(draft,{requireImages});if(errors.length)throw Error(errors.join('；'));
  const hash=async value=>Array.from(new Uint8Array(await g.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const items=[],grouped=new Map(draft.book.units.map(u=>[u.unitId,[]]));draft.items.forEach(item=>grouped.get(item.unitId).push(item));
  for(const unit of draft.book.units)for(const source of grouped.get(unit.unitId)){
   const item={itemId:source.itemId,word:source.word,meaning:source.meaning,scene:source.scene,example:engine().sentence(source.exercise),translation:source.translation,exercise:source.exercise,images:source.images};
   if(source.guidedSteps)item.learning={schemaVersion:1,guidedExpression:{schemaVersion:1,revision:await hash(source.guidedSteps),steps:source.guidedSteps}};
   if(source.dictation)item.learning={...item.learning,schemaVersion:1,wordDictation:{schemaVersion:1,audio:structuredClone(source.dictation.audio),answers:[...source.dictation.answers],revision:await hash({audio:source.dictation.audio,answers:source.dictation.answers})}};
   if(source.sentenceAudio)item.learning={...item.learning,schemaVersion:1,sentenceAudio:{schemaVersion:1,audio:structuredClone(source.sentenceAudio.audio),text:source.sentenceAudio.text,revision:await hash({audio:source.sentenceAudio.audio,text:source.sentenceAudio.text})}};
   if(source.wordChoice){const body={field:source.wordChoice.field,options:structuredClone(source.wordChoice.options),correctOptionId:source.wordChoice.correctOptionId};item.learning={...item.learning,schemaVersion:1,wordChoice:{schemaVersion:1,...body,revision:await hash(body)}};}
   if(source.chunkOrder){const body={chunks:structuredClone(source.chunkOrder.chunks),correctOrder:[...source.chunkOrder.correctOrder]};item.learning={...item.learning,schemaVersion:1,chunkOrder:{schemaVersion:1,...body,revision:await hash(body)}};}
   if(source.readAloud){const body={target:source.readAloud.target,text:source.readAloud.text,audio:structuredClone(source.readAloud.audio)};item.learning={...item.learning,schemaVersion:1,readAloud:{schemaVersion:1,...body,revision:await hash(body)}};}
   items.push({...item,contentRevision:await hash(item)});
  }
  const refs=items.map(({itemId,contentRevision})=>({itemId,contentRevision})),units=draft.book.units.map(u=>({...u,itemIds:grouped.get(u.unitId).map(item=>item.itemId)}));
  const book={bookId:draft.book.bookId,title:draft.book.title,revision:await hash(refs),itemCount:items.length,items:refs,units,structureRevision:await hash(units),catalog:draft.book.catalog};
  if(draft.book.relatedCourseIds!==undefined)book.relatedCourseIds=[...draft.book.relatedCourseIds];
  return {format:'wordbook-prepared-package',schemaVersion:1,index:{schemaVersion:1,books:[book]},items,assetVerification:'pending',published:false};
 }
 const api={exercise,guidedSteps,validate,compile};g.WordbookDraft=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
