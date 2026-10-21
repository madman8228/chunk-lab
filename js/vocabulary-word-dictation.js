/* Shared word-dictation content and answer rules; no audio playback or storage. */
(function(root){
 'use strict';
 const check=(value,message)=>{if(!value)throw Error(message);};
 const normalize=value=>String(value).normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
 function validate(item,activity){
  check(activity&&activity.schemaVersion===1&&/^[a-f0-9]{64}$/.test(activity.revision||''),'听写配置版本无效');
  check(Object.keys(activity).every(key=>['schemaVersion','revision','audio','answers'].includes(key)),'听写配置包含未知字段');
  const audio=activity.audio;
  check(audio&&Object.keys(audio).every(key=>['url','sha256','bytes','mimeType'].includes(key)),'听写音频配置无效');
  const formats={'audio/mpeg':'mp3','audio/ogg':'ogg','audio/wav':'wav'},extension=formats[audio.mimeType];
  check(extension&&typeof audio.url==='string'&&new RegExp('^assets/[A-Za-z0-9._-]+\\.'+extension+'$').test(audio.url),'听写只接受明确的本地音频，不使用临时语音合成冒充课程素材');
  check(/^[a-f0-9]{64}$/.test(audio.sha256||'')&&Number.isSafeInteger(audio.bytes)&&audio.bytes>0&&audio.bytes<=10000000,'听写音频摘要或大小无效');
  check(typeof item.word==='string'&&item.word.trim()&&Array.isArray(activity.answers)&&activity.answers.length>0&&activity.answers.length<=8,'听写答案无效');
  check(activity.answers.every(answer=>typeof answer==='string'&&answer.trim()&&answer.length<=200),'听写答案缺失或过长');
  const answers=activity.answers.map(normalize);check(new Set(answers).size===answers.length&&answers.includes(normalize(item.word)),'听写答案重复或遗漏原词');
  return activity;
 }
 function evaluate(item,activity,values){
  validate(item,activity);
  const valid=values&&typeof values==='object'&&!Array.isArray(values)&&Object.keys(values).length===1&&Object.hasOwn(values,'word')&&typeof values.word==='string'&&values.word.length<=200;
  return {correct:!!valid&&activity.answers.some(answer=>normalize(answer)===normalize(values.word)),assisted:true,practiceType:'word-dictation',ability:'word-spelling-from-authored-audio',practiceRevision:activity.revision};
 }
 const api={normalize,validate,evaluate};root.VocabularyWordDictation=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
