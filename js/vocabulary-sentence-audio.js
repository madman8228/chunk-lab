/* Authored sentence audio is content, not a new exercise or mastery signal. */
(function(root){
 'use strict';
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 function validate(item,activity,engine){
  check(activity&&activity.schemaVersion===1&&/^[a-f0-9]{64}$/.test(activity.revision),'例句音频版本无效');
  check(Object.keys(activity).every(k=>['schemaVersion','revision','text','audio'].includes(k)),'例句音频包含未知字段');
  check(typeof activity.text==='string'&&activity.text.length<=4000&&activity.text===engine.sentence(item.exercise),'例句音频文本与当前例句不一致');
  const audio=activity.audio,formats={'audio/mpeg':'mp3','audio/ogg':'ogg','audio/wav':'wav'};
  check(audio&&Object.keys(audio).every(k=>['url','sha256','bytes','mimeType'].includes(k)),'例句音频配置无效');
  check(formats[audio.mimeType]&&typeof audio.url==='string'&&new RegExp('^assets/[A-Za-z0-9._-]+\\.'+formats[audio.mimeType]+'$').test(audio.url),'例句音频必须使用固定本地素材引用');
  check(/^[a-f0-9]{64}$/.test(audio.sha256||'')&&Number.isSafeInteger(audio.bytes)&&audio.bytes>0&&audio.bytes<=10000000,'例句音频摘要或大小无效');
  return activity;
 }
 const api={validate};root.VocabularySentenceAudio=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
