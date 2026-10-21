/* Authored sentence ordering; stable block identities, no progress or UI writes. */
(function(root){
 'use strict';
 const check=(value,message)=>{if(!value)throw Error(message);};
 const normalize=value=>String(value).normalize('NFKC').trim().replace(/[’‘]/g,"'").replace(/\s+/g,' ').toLowerCase();
 const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
 function validate(item,activity,engine){
  check(activity&&activity.schemaVersion===1&&/^[a-f0-9]{64}$/.test(activity.revision||''),'拼块配置版本无效');
  check(Object.keys(activity).every(key=>['schemaVersion','revision','chunks','correctOrder'].includes(key)),'拼块配置包含未知字段');engine.validate(item.exercise);
  check(typeof item.word==='string'&&item.word.trim()&&engine.blanks(item.exercise).some(blank=>blank.answers.some(answer=>engine.normalize(answer)===engine.normalize(item.word))),'拼块须练习当前词义的词头');
  check(Array.isArray(activity.chunks)&&activity.chunks.length>=2&&activity.chunks.length<=24,'拼块需要2至24个明确编写的词块');const chunks=new Map();
  for(const chunk of activity.chunks){check(chunk&&Object.keys(chunk).every(key=>['id','text'].includes(key))&&id(chunk.id)&&!chunks.has(chunk.id)&&typeof chunk.text==='string'&&chunk.text.trim()&&chunk.text.length<=1000,'词块编号重复或文本无效');chunks.set(chunk.id,chunk.text);}
  check(Array.isArray(activity.correctOrder)&&activity.correctOrder.length===chunks.size&&new Set(activity.correctOrder).size===chunks.size&&Array.from(activity.correctOrder).every(key=>typeof key==='string'&&chunks.has(key)),'拼块标准顺序须完整使用每个编号一次');
  const sentence=activity.correctOrder.map(key=>chunks.get(key)).join(' ');check(sentence.length<=1000&&normalize(sentence)===normalize(engine.sentence(item.exercise)),'拼块顺序、词块或标点改变了原句');return activity;
 }
 function evaluate(item,activity,values,engine){
  validate(item,activity,engine);const chunks=new Map(activity.chunks.map(chunk=>[chunk.id,chunk.text]));
  const ids=values&&typeof values==='object'&&!Array.isArray(values)&&Object.keys(values).length===1&&Object.hasOwn(values,'chunkIds')?values.chunkIds:null;
  const complete=Array.isArray(ids)&&ids.length===chunks.size&&new Set(ids).size===chunks.size&&Array.from(ids).every(key=>typeof key==='string'&&chunks.has(key));
  const correct=!!complete&&normalize(ids.map(key=>chunks.get(key)).join(' '))===normalize(engine.sentence(item.exercise));
  return {correct,assisted:true,practiceType:'chunk-order',ability:'authored-sentence-ordering',practiceRevision:activity.revision};
 }
 const api={normalize,validate,evaluate};root.VocabularyChunkOrder=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
