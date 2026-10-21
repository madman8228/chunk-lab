/* Authored reference and unverified practice report; no pronunciation judging. */
(function(root){
 'use strict';
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 function validate(item,activity,engine){
  check(activity&&activity.schemaVersion===1&&/^[a-f0-9]{64}$/.test(activity.revision||''),'跟读配置版本无效');
  check(Object.keys(activity).every(key=>['schemaVersion','revision','target','text','audio'].includes(key)),'跟读配置包含未知字段');
  engine.validate(item.exercise);check(typeof item.word==='string'&&item.word.trim(),'跟读词头无效');
  check(['word','sentence'].includes(activity.target),'跟读需要明确单词或例句目标');
  check(typeof activity.text==='string'&&activity.text.trim()&&activity.text.length<=1000&&activity.text===(activity.target==='word'?item.word:engine.sentence(item.exercise)),'跟读文本与目标不一致');
  const audio=activity.audio,formats={'audio/mpeg':'mp3','audio/ogg':'ogg','audio/wav':'wav'};
  check(audio&&Object.keys(audio).every(key=>['url','sha256','bytes','mimeType'].includes(key)),'跟读示范音频配置无效');
  check(formats[audio.mimeType]&&typeof audio.url==='string'&&new RegExp('^assets/[A-Za-z0-9._-]+\\.'+formats[audio.mimeType]+'$').test(audio.url),'跟读示范须使用固定本地课程音频');
  check(/^[a-f0-9]{64}$/.test(audio.sha256||'')&&Number.isSafeInteger(audio.bytes)&&audio.bytes>0&&audio.bytes<=10000000,'跟读音频摘要或大小无效');return activity;
 }
 function report(item,activity,value,engine){
  validate(item,activity,engine);const keys=['listened','recorded','replayed','confirmed'];
  check(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key)&&value[key]===true),'请明确确认听示范、录音和回听；不接受评分或录音上传');
  return {practiceType:'read-aloud',practiceRevision:activity.revision,target:activity.target,audioSha256:activity.audio.sha256,evidence:'unverified-self-report',verification:'unverified',assessment:false,reported:{listened:true,recorded:true,replayed:true,confirmed:true}};
 }
 const api={validate,report};root.VocabularyReadAloud=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
