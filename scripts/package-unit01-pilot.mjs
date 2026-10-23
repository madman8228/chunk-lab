import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateExpressionPackage} from '../src/expression-course/validate.mjs';

const target=path.resolve(process.argv[2]||'output/expression-course-drafts/unit01-formal-v1');
if(fs.existsSync(target))throw Error('目标已存在，请使用新版本目录');
const source=JSON.parse(fs.readFileSync('assets/expression-unit01-draft-lessons.json','utf8'));
const pkg={format:'chunklab-expression-course',formatVersion:'1.0',courseId:'expression-unit01-tools',title:'零基础入门：听懂指令与请求重复',description:'待审核课程包；不含配图、录音、识别或口语评分。',audience:'adult_beginner',lessons:[],assets:[],reviewActivities:[]};
const files=[];
source.lessons.forEach((draft,li)=>{
 const lessonId=li===0?'L101':'L103',skill=li===0?'understand_basic_instructions':'request_repetition';
 const lesson={schemaVersion:'1.0',lessonId,contentVersion:1,status:'draft',locale:'zh-CN',title:draft.title,communicationGoal:draft.goal,prerequisiteSkillIds:[],taughtSkillIds:[skill],vocabulary:[],audioAssets:[],activities:[],reviewPlan:{intervalDays:[1,3,7,14]}};
 lesson.vocabulary=(li===0?[['listen','Listen','听一听'],['look','Look','看一看'],['start','Start','开始']]:[['again','again','再一次'],['please','please','请']]).map(([id,en,zh])=>({id,en,zh,introducedHere:true}));
 draft.steps.forEach((step,i)=>{
  const assetId=`unit01_${lessonId}_${i}`;
  if(step.english){const file=`expression-draft-${draft.id}-${i}.wav`,bytes=fs.readFileSync(path.join('assets',file));if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw Error('音频格式无效');pkg.assets.push({assetId,mimeType:'audio/wav',localFile:file,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});lesson.audioAssets.push({assetId,text:step.english,locale:'en-US',status:'ready'});files.push({file,bytes});}
  let type,payload,evaluation={countsTowardMastery:false};
  if(step.kind==='intro'){type='meaning_intro';payload={exampleEnglish:step.english,exampleZh:step.explanation,audioAssetId:assetId};}
  else if(step.kind==='listen'){type='listening_choice';payload={audioAssetId:assetId,options:step.options.map((textZh,n)=>({id:`option_${n}`,textZh}))};evaluation={countsTowardMastery:true,correctOptionId:`option_${step.answer}`};}
  else if(step.kind==='choice')return; // 中文意图选择不伪装成听力题。
  else{type='independent_output';payload={scenario:step.prompt,targetMeaning:'请再说一遍。',responseModes:['text']};evaluation={countsTowardMastery:true,acceptedAnswers:step.answers};}
  const activity={id:`${lessonId}_A${String(i+1).padStart(2,'0')}`,type,stage:step.kind==='intro'?'guided':'independent',prompt:step.prompt,skillIds:[skill],payload,evaluation};lesson.activities.push(activity);
 });
 const review=lesson.activities.filter(a=>a.type==='independent_output'||a.type==='listening_choice').slice(-2);
 review.forEach(a=>pkg.reviewActivities.push({lessonId,skillId:skill,activityId:a.id}));pkg.lessons.push(lesson);
});
const result=validateExpressionPackage(pkg,{forPublish:true,availableAssets:pkg.assets.map(a=>a.assetId)});if(!result.valid)throw Error(result.errors.join('\n'));
fs.mkdirSync(target,{recursive:true});files.forEach(({file,bytes})=>fs.writeFileSync(path.join(target,file),bytes,{flag:'wx'}));
fs.writeFileSync(path.join(target,'course-package.json'),JSON.stringify(pkg,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(target,'validation.json'),JSON.stringify({schema:result,lessons:pkg.lessons.length,activities:pkg.lessons.map(l=>({lessonId:l.lessonId,count:l.activities.length})),audioAssets:files.length,published:false},null,2)+'\n',{flag:'wx'});
console.log(target);
const publicFile='assets/expression-unit01-formal-review.json';
if(!fs.existsSync(publicFile))fs.writeFileSync(publicFile,JSON.stringify(pkg,null,2)+'\n',{flag:'wx'});
