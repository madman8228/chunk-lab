'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),dictation=require('../../js/vocabulary-word-dictation');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function validateDictationAssets(item,appRoot,readAsset){
 const word=item.learning?.wordDictation,sentence=item.learning?.sentenceAudio,readAloud=item.learning?.readAloud;
 if(word)dictation.validate(item,word);
 if(sentence)require('../../js/vocabulary-sentence-audio').validate(item,sentence,require('../../landing/sentence-cloze-engine'));
 if(readAloud)require('../../js/vocabulary-read-aloud').validate(item,readAloud,require('../../landing/sentence-cloze-engine'));
 for(const activity of [word,sentence,readAloud].filter(Boolean)){
 const body=activity===word?{audio:activity.audio,answers:activity.answers}:activity===readAloud?{target:activity.target,text:activity.text,audio:activity.audio}:{audio:activity.audio,text:activity.text};
 if(activity.revision!==hash(JSON.stringify(body)))throw Error('课程音频任务版本不一致');
 let bytes;
 if(readAsset){bytes=readAsset(activity.audio.url);if(!bytes)throw Object.assign(Error('听写音频文件缺失：'+activity.audio.url),{code:'ENOENT'});}
 else{
  const root=fs.realpathSync(path.join(appRoot,'assets')),file=fs.realpathSync(path.join(appRoot,activity.audio.url));
  if(path.dirname(file)!==root)throw Error('听写音频不能越出 assets 目录');
  const stat=fs.statSync(file);if(!stat.isFile()||stat.size!==activity.audio.bytes)throw Error('听写音频文件或大小不匹配');bytes=fs.readFileSync(file);
 }
 if(bytes.length!==activity.audio.bytes||hash(bytes)!==activity.audio.sha256)throw Error('课程音频内容或大小已变化，请重新审核');
 const mime=activity.audio.mimeType,signature=mime==='audio/wav'?bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE':mime==='audio/ogg'?bytes.toString('ascii',0,4)==='OggS':bytes.toString('ascii',0,3)==='ID3'||bytes.length>1&&bytes[0]===255&&(bytes[1]&224)===224;
 if(!signature)throw Error('听写音频格式与 MIME 不一致');
 }
 return word;
}
module.exports={validateDictationAssets};
