'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),source=path.join(root,'output/wordbook-phonetics-supplement-full-20261025-v5'),out=path.join(root,'output/wordbook-phonetics-en-gb-audio-20261026-v1'),manifestPath=path.join(out,'generation-manifest.json');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fileHash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const writeNew=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});};
async function main(){
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));if(!manifest.complete||manifest.published!==false||manifest.completedItems!==4174)throw Error('英式音频批次未完整或并非待审核草稿');
 if(fileHash(path.join(source,'report.json'))!==manifest.sourceReportSha256)throw Error('原始音标草稿报告已变化');
 const draftRoot=path.join(out,'draft-candidates'),stagingRoot=path.join(out,'draft-candidates.staging');if(fs.existsSync(draftRoot)||fs.existsSync(stagingRoot))throw Error('拒绝覆盖已存在的草稿包或暂存目录');
 const draftModel=require('../js/wordbook-draft'),model=require('../js/vocabulary-study.cjs'),engine=require('../landing/sentence-cloze-engine'),contract=require('../js/vocabulary-course-contract');
 const sourceReport=JSON.parse(fs.readFileSync(path.join(source,'report.json'),'utf8'));if(sourceReport.totals?.allItems!==4220)throw Error('原始课程条目总数与已审阅批次不符');
 const candidates=fs.readdirSync(source,{withFileTypes:true}).filter(row=>row.isDirectory()&&/^[a-f0-9]{64}$/.test(row.name)).map(row=>path.join(source,row.name,'candidate.json')).sort();
 const packageManifest={format:'wordbook-accent-review-draft',schemaVersion:1,published:false,stage:'pending-listening-review',accent:'en-GB',voice:'bf_emma',sourceReportSha256:manifest.sourceReportSha256,sourceBooks:manifest.books,items:0,books:[],excludedBooks:[]};
 const staged=[];
 if(candidates.length!==manifest.books.length)throw Error('原始课程包数量已变化');
 for(let candidateIndex=0;candidateIndex<candidates.length;candidateIndex++){
  const file=candidates[candidateIndex],sourceRecord=manifest.books[candidateIndex];
  if(path.relative(source,file).replaceAll('\\','/')!==sourceRecord.path.replaceAll('\\','/')||fileHash(file)!==sourceRecord.sha256)throw Error('原始课程包与生成清单不匹配：'+file);
  const candidate=JSON.parse(fs.readFileSync(file,'utf8'));if(candidate.published!==false)throw Error('源候选不是未发布草稿：'+file);
  const book=candidate.index.books[0];if(book.bookId==='pilot-six-v1'){packageManifest.excludedBooks.push({bookId:book.bookId,title:book.title,reason:'Protected demonstration package; no replacement candidate created.'});continue;}
  if(!Array.isArray(book.units))throw Error('正式课程缺少单元结构：'+book.bookId);
  const unitByItem=new Map(book.units.flatMap(unit=>unit.itemIds.map(itemId=>[itemId,unit.unitId])));
  const items=candidate.items.map(item=>{
   if(!item.phonetic?.trim())throw Error('缺少待映射的教材式英式音标：'+item.itemId);
   const draft={itemId:item.itemId,unitId:unitByItem.get(item.itemId),word:item.word,meaning:item.meaning,scene:item.scene,translation:item.translation,exercise:item.exercise,images:item.images};
   if(item.phonetic)draft.phonetics={...(item.phonetics||{}),'en-GB':item.phonetic};
   const learning=item.learning||{};
   if(learning.guidedExpression)draft.guidedSteps=learning.guidedExpression.steps;
   if(learning.wordDictation)draft.dictation={audio:learning.wordDictation.audio,answers:learning.wordDictation.answers};
   if(learning.sentenceAudio){
    const activity=learning.sentenceAudio,key=manifest.items[item.itemId],clip=manifest.clips[key];
    if(!clip||clip.text!==activity.text)throw Error('英式音频与词条原句缺失或不匹配：'+item.itemId);
    const assetPath=path.join(out,clip.path);if(!fs.existsSync(assetPath)||fs.statSync(assetPath).size!==clip.bytes||fileHash(assetPath)!==clip.sha256)throw Error('英式音频文件摘要不匹配：'+item.itemId);
    draft.sentenceAudio={audio:activity.audio,text:activity.text,audioByAccent:{...(activity.audioByAccent||{}),'en-GB':{url:clip.path,sha256:clip.sha256,bytes:clip.bytes,mimeType:clip.mimeType}}};
   }
   if(learning.wordChoice)draft.wordChoice={field:learning.wordChoice.field,options:learning.wordChoice.options,correctOptionId:learning.wordChoice.correctOptionId};
   if(learning.chunkOrder)draft.chunkOrder={chunks:learning.chunkOrder.chunks,correctOrder:learning.chunkOrder.correctOrder};
   if(learning.readAloud)draft.readAloud={target:learning.readAloud.target,text:learning.readAloud.text,audio:learning.readAloud.audio};
   return draft;
  });
  const prepared=await draftModel.compile({schemaVersion:1,book:{bookId:book.bookId,title:book.title,catalog:book.catalog,units:book.units.map(unit=>({unitId:unit.unitId,title:unit.title}))},items},{requireImages:false});
  model.validateIndex(prepared.index);for(const item of prepared.items)contract.validateLearning(item,engine);
  staged.push({bookId:book.bookId,title:book.title,package:prepared});
 }
 const expectedItems=sourceReport.totals.allItems-6;if(packageManifest.excludedBooks.length!==1||packageManifest.excludedBooks[0].bookId!=='pilot-six-v1'||staged.reduce((sum,entry)=>sum+entry.package.items.length,0)!==expectedItems)throw Error('草稿正式课程数或词条数与源报告不匹配');
 for(const entry of staged){const key=crypto.createHash('sha256').update(entry.bookId).digest('hex');const file=path.join(stagingRoot,key,'candidate.json');writeNew(file,entry.package);packageManifest.books.push({bookId:entry.bookId,title:entry.title,path:path.relative(out,path.join(draftRoot,key,'candidate.json')).replaceAll('\\','/'),items:entry.package.items.length,revision:entry.package.index.books[0].revision});packageManifest.items+=entry.package.items.length;}
 writeNew(path.join(stagingRoot,'manifest.json'),packageManifest);fs.renameSync(stagingRoot,draftRoot);
 console.log(JSON.stringify({published:false,stage:packageManifest.stage,books:packageManifest.books.length,items:packageManifest.items,output:draftRoot},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
