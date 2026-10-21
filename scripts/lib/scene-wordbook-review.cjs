'use strict';
// Review-side association checks only; production schemas and persistence stay unchanged.
const draftModel=require('../../js/wordbook-draft');
const engine=require('../../landing/sentence-cloze-engine');
function check(value,message){if(!value)throw Error(message);}
function fields(value,allowed,label){check(value&&typeof value==='object'&&!Array.isArray(value),label+'应为对象');check(Object.keys(value).every(key=>allowed.includes(key)),label+'包含未知字段');}
function text(value){return typeof value==='string'&&!!value.trim()&&value.length<=4000;}
function unique(rows,key,label){const ids=new Set();for(const row of rows){check(row&&typeof row[key]==='string'&&/^[A-Za-z0-9:._-]{1,160}$/.test(row[key])&&!['__proto__','constructor','prototype'].includes(row[key])&&!ids.has(row[key]),label+'编号无效或重复');ids.add(row[key]);}}
function appears(sentence,word){const escaped=word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp('(^|[^A-Za-z])'+escaped+'(?=$|[^A-Za-z])','i').test(sentence);}
function validate(review){
 fields(review,['format','schemaVersion','module','origin','levelProposal','review','wordbook','targetNotes','materials'],'审阅包');
 check(review.format==='scene-wordbook-review'&&review.schemaVersion===1,'审阅包版本无效');
 check(review.module==='vocabulary'&&review.origin==='original','当前只支持原创场景词汇草稿');
 check(['A1','A2','B1','B2','C1','C2'].includes(review.levelProposal),'建议水平无效');
 fields(review.review,['content','level','assets'],'审核状态');
 check(['content','level','assets'].every(key=>review.review[key]==='pending'),'第一阶段不得伪装为已审核或可发布');
 const errors=draftModel.validate(review.wordbook,{requireImages:false});check(!errors.length,errors.join('；'));
 check(review.wordbook.book.catalog?.facets?.levels?.length===1&&review.wordbook.book.catalog.facets.levels[0]===review.levelProposal,'词书与审阅建议水平不一致');
 const items=review.wordbook.items,byId=new Map(items.map(item=>[item.itemId,item]));
 for(const item of items){
  check(engine.blanks(item.exercise).some(blank=>blank.answers.some(answer=>engine.normalize(answer)===engine.normalize(item.word))),'目标词与填空不一致：'+item.itemId);
  check(item.images.wide.length===0&&item.images.mobile.length===0,'当前文本审阅阶段不能携带未经核验的交付插图');
 }
 check(Array.isArray(review.targetNotes)&&review.targetNotes.length===items.length,'每个项目需要独立词义说明');unique(review.targetNotes,'itemId','词义说明');
 for(const note of review.targetNotes){fields(note,['itemId','partOfSpeech','sense'],'词义说明');check(byId.has(note.itemId)&&text(note.partOfSpeech)&&text(note.sense),'词义说明引用或内容无效');}
 check(Array.isArray(review.materials)&&review.materials.length>0&&review.materials.length<=200,'材料列表无效');unique(review.materials,'materialId','材料');
 const units=new Set(review.wordbook.book.units.map(unit=>unit.unitId)),covered=new Set();
 for(const material of review.materials){
  fields(material,['materialId','unitId','kind','title','lines'],'材料');
  check(!byId.has(material.materialId)&&units.has(material.unitId)&&['dialogue','reading'].includes(material.kind)&&text(material.title),'材料身份、类型或单元无效');
  check(Array.isArray(material.lines)&&material.lines.length>0&&material.lines.length<=100,'材料正文无效');
  for(const line of material.lines){
   fields(line,['speaker','en','zh','targets'],'材料句子');check(text(line.en)&&text(line.zh),'材料必须提供完整双语正文');
   if(material.kind==='dialogue')check(text(line.speaker),'对话需要说话人');
   else check(line.speaker===undefined,'短文不应包含对话说话人字段');
   check(Array.isArray(line.targets)&&new Set(line.targets).size===line.targets.length,'目标引用重复或无效');
   for(const id of line.targets){const item=byId.get(id);check(item&&item.unitId===material.unitId,'目标引用不存在或跨单元：'+id);check(appears(line.en,item.word),'材料未出现所引用的目标词：'+id);covered.add(id);}
  }
 }
 check(items.every(item=>covered.has(item.itemId)),'存在未进入任何配套材料的目标项目');
 return {bookId:review.wordbook.book.bookId,module:'vocabulary',items:items.length,units:units.size,dialogues:review.materials.filter(row=>row.kind==='dialogue').length,readings:review.materials.filter(row=>row.kind==='reading').length,reviewOnly:true,publishable:false,pending:['人工内容审阅','等级审核','插图制作与核验','生产材料协议与授权','用户发布批准']};
}
async function prepare(review){
 const summary=validate(review);
 // Text-only compilation is a compatibility check, not a publication package.
 const wordbookPackage=await draftModel.compile(review.wordbook,{requireImages:false});
 return {summary,wordbookPackage,materials:structuredClone(review.materials),targetNotes:structuredClone(review.targetNotes)};
}
module.exports={validate,prepare};
