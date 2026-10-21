'use strict';
const fs=require('node:fs'),model=require('./lib/vocabulary-materials.cjs'),sceneReview=require('./lib/scene-wordbook-review.cjs');
function build(review){
 sceneReview.validate(review);
 const source=model.versioned({sourceId:'source:borrow-original-v1',kind:'original',title:'借东西原创草稿第一版词表快照',metadata:{originNote:'来源于独立审阅草稿 borrow-things-v1/review.json；原始草稿保留，未获内容审核或发布批准。'},
  entries:review.wordbook.items.map(item=>({entryId:item.itemId,headword:item.word,gloss:item.meaning,rawText:item.word+' · '+item.meaning,location:{unit:review.wordbook.book.units.find(unit=>unit.unitId===item.unitId).title}}))});
 const senses=review.wordbook.items.map(item=>{
  const note=review.targetNotes.find(row=>row.itemId===item.itemId);
  return model.versioned({senseId:'sense:'+item.itemId,word:item.word,meaning:item.meaning,partOfSpeech:note.partOfSpeech,definition:note.sense,sourceRefs:[{sourceId:source.sourceId,revision:source.revision,entryId:item.itemId}]});
 });
 const activities=review.wordbook.items.map((item,index)=>model.versioned({itemId:item.itemId,senseRef:{senseId:senses[index].senseId,revision:senses[index].revision},authorship:'original',scene:item.scene,translation:item.translation,exercise:structuredClone(item.exercise),guidedSteps:structuredClone(item.guidedSteps),images:structuredClone(item.images)}));
 const applications=review.materials.map(material=>model.versioned({materialId:material.materialId,kind:material.kind,authorship:'original',title:material.title,lines:material.lines.map(line=>{
  const result={en:line.en,zh:line.zh,senseRefs:line.targets.map(id=>{const sense=senses.find(row=>row.senseId==='sense:'+id);return {senseId:sense.senseId,revision:sense.revision};})};
  if(line.speaker!==undefined)result.speaker=line.speaker;return result;
 })}));
 const ref=activity=>({itemId:activity.itemId,revision:activity.revision});
 const courses=[
  model.versioned({courseId:'draft:borrow-adult-v1',title:'成人日常：借东西（编排草稿）',module:'vocabulary',audience:'adult',levelProposal:'A2',units:[{unitId:'draft:borrow-adult:unit1',title:'借用与归还',activityRefs:activities.map(ref),materialRefs:applications.map(material=>({materialId:material.materialId,revision:material.revision}))}]}),
  model.versioned({courseId:'draft:borrow-starter-v1',title:'基础词义入口（仅编排示例，难度待审）',module:'vocabulary',audience:'beginner',levelProposal:'A1',units:[{unitId:'draft:borrow-starter:unit1',title:'选择三个目标，不复制原任务',activityRefs:['pen','borrow','umbrella'].map(word=>ref(activities.find(activity=>activity.itemId.endsWith(':'+word)))),materialRefs:[]}]})
 ];
 const library={format:'vocabulary-material-library',schemaVersion:1,stage:'draft',sources:[source],senses,activities,applications,courses};model.validate(library);return library;
}
if(require.main===module){
 try{
  const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('用法：node scripts/prepare-borrow-material-library.cjs <review.json> <新的材料草稿.json>');
  if(fs.statSync(input).size>10_000_000)throw Error('输入过大');
  const library=build(JSON.parse(fs.readFileSync(input,'utf8')));
  fs.writeFileSync(output,JSON.stringify(library,null,2)+'\n',{flag:'wx'});
  console.log('已创建独立草稿（拒绝覆盖已有文件）；未导入、未保存账号、未发布：'+output);
 }catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={build};
