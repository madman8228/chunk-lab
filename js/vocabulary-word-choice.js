/* Authored contextual word-choice rules; no playback, persistence or random distractors. */
(function(root){
 'use strict';
 const check=(value,message)=>{if(!value)throw Error(message);};
 const text=value=>typeof value==='string'&&!!value.trim()&&value.length<=1000;
 const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
 function validate(item,activity,engine){
  check(activity&&activity.schemaVersion===1&&/^[a-f0-9]{64}$/.test(activity.revision||''),'选词配置版本无效');
  check(Object.keys(activity).every(key=>['schemaVersion','revision','field','options','correctOptionId'].includes(key)),'选词配置包含未知字段');
  engine.validate(item.exercise);
  const blanks=engine.blanks(item.exercise),field=blanks.find(blank=>blank.id===activity.field);
  check(blanks.length===1&&field,'选词练习须明确绑定唯一目标填空');
  check(text(item.word)&&field.answers.some(answer=>engine.normalize(answer)===engine.normalize(item.word)),'选词目标须对应当前词义的词头');
  check(Array.isArray(activity.options)&&activity.options.length>=2&&activity.options.length<=6,'选词需要2至6个明确编写的选项');
  const ids=new Set(),labels=new Set();
  for(const option of activity.options){
   check(option&&Object.keys(option).every(key=>['id','text','feedback'].includes(key))&&id(option.id)&&text(option.text)&&text(option.feedback),'选项需要独立编号、文本及教学解释');
   const normalized=engine.normalize(option.text);
   check(normalized&&!ids.has(option.id)&&!labels.has(normalized),'选词编号或归一化文本重复');ids.add(option.id);labels.add(normalized);
   const accepted=field.answers.some(answer=>engine.normalize(answer)===normalized);
   check(accepted===(option.id===activity.correctOptionId),'选词正确项或干扰项与原题答案不一致');
  }
  check(ids.has(activity.correctOptionId),'选词缺少正确选项');return activity;
 }
 function evaluate(item,activity,values,engine){
  validate(item,activity,engine);
  const valid=values&&typeof values==='object'&&!Array.isArray(values)&&Object.keys(values).length===1&&Object.hasOwn(values,'optionId')&&typeof values.optionId==='string';
  const selected=valid?activity.options.find(option=>option.id===values.optionId):null;
  return {correct:!!selected&&selected.id===activity.correctOptionId,feedback:selected?.feedback||'请选择当前练习中的选项。',assisted:true,practiceType:'word-choice',ability:'word-recognition-in-authored-context',practiceRevision:activity.revision};
 }
 const api={validate,evaluate};root.VocabularyWordChoice=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
