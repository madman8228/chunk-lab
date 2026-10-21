'use strict';
// Derived review artifact only. No publication, database access or approval inheritance.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),materials=require('./lib/vocabulary-materials.cjs'),engine=require('../landing/sentence-cloze-engine');
const input='drafts/scene-wordbooks/borrow-things-v1/audio-a-v3/integrated-v4';
const root=path.resolve(__dirname,'..');
const choices={
 borrow:[['borrow','borrow 表示向别人借来使用，符合这里的请求。'],['lend','lend 表示借给别人；这里是我请求借用你的物品。'],['return','return 表示归还，不是请求借用。']],
 charger:[['charger','charger 是给设备充电的充电器。'],['pen','pen 是笔，不是本场景中的充电器。'],['umbrella','umbrella 是雨伞，不是本场景中的充电器。']],
 lend:[['lend','lend somebody something 表示把某物借给某人。'],['borrow','borrow something from somebody 表示向某人借来，不用于这里的双宾语结构。'],['return','return 在此应表示归还；本句的目标是主动借给对方。']],
 return:[['return','return 在这里表示归还借来的笔。'],['borrow','borrow 是借来，本句要求的是明天归还。'],['buy','buy 是购买，不是归还。']],
 pen:[['pen','pen 是本场景中请求使用的笔。'],['charger','charger 是充电器，不是笔。'],['umbrella','umbrella 是雨伞，不是笔。']],
 umbrella:[['umbrella','umbrella 是下雨时使用的雨伞。'],['pen','pen 是笔，不能对应本场景的雨伞。'],['charger','charger 是充电器，不能对应本场景的雨伞。']]
};
function build(library,wordbook){
 materials.validate(library);const result=structuredClone(library);
 for(const activity of result.activities){const sense=result.senses.find(row=>row.senseId===activity.senseRef.senseId),options=choices[sense.word];if(!options)throw Error('未编写的目标：'+sense.word);
  activity.wordChoice={field:engine.blanks(activity.exercise)[0].id,options:options.map(([text,feedback],i)=>({id:'option-'+i,text,feedback})),correctOptionId:'option-0'};
  const chunks=activity.guidedSteps.map((step,i)=>({id:'chunk-'+i,text:step.answer}));activity.chunkOrder={chunks,correctOrder:chunks.map(row=>row.id)};Object.assign(activity,materials.versioned(activity));
 }
 // The existing application texts require the full adult unit's senses. Keep that
 // semantic boundary instead of splitting units and silently dropping targets.
 for(const course of result.courses){for(const unit of course.units)for(const ref of unit.activityRefs)ref.revision=result.activities.find(row=>row.itemId===ref.itemId).revision;Object.assign(course,materials.versioned(course));}
 materials.validate(result);
 const assetBindings=wordbook.items.map(item=>({itemId:item.itemId,images:structuredClone(item.images)}));
 return {library:result,assetBindings};
}
async function prepare(){
 const files=['library.json','wordbook.json','approval.json'].map(name=>({name,bytes:fs.readFileSync(path.join(root,input,name))})),library=JSON.parse(files[0].bytes),wordbook=JSON.parse(files[1].bytes),built=build(library,wordbook),courses=[];
 for(const course of built.library.courses){const preview=await materials.previewCourse(built.library,course.courseId);courses.push({courseId:course.courseId,audience:course.audience,levelProposal:course.levelProposal,levelReview:'pending',preview});}
 const assets=[...new Set(wordbook.items.flatMap(item=>[...item.images.wide,...item.images.mobile,item.dictation.audio.url,item.sentenceAudio.audio.url]))].map(file=>{const bytes=fs.readFileSync(path.join(root,file));if(file.endsWith('.webp')&&bytes.length>=20000)throw Error('图片超预算：'+file);return {path:file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});
 return {format:'borrow-pilot-review',schemaVersion:1,stage:'draft',publishable:false,review:{content:'pending',level:'pending',imageMapping:'pending',rights:'pending',publication:'not-authorized',readAloud:'deferred'},sources:files.map(file=>({path:input+'/'+file.name,sha256:crypto.createHash('sha256').update(file.bytes).digest('hex')})),...built,assets,courses};
}
if(require.main===module)(async()=>{const output=process.argv[2];if(!output)throw Error('需要指定新的审阅包文件路径；拒绝覆盖已有文件');const review=await prepare();fs.writeFileSync(output,JSON.stringify(review,null,2)+'\n',{flag:'wx'});console.log('已生成待审包：'+output+'；无账号写入、发布或语音验证。');})().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={build,prepare};
