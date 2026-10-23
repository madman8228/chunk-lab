'use strict';

const fs=require('node:fs'),path=require('node:path');
const {loadCatalog}=require('./serve-textbook-sentence-review.cjs');
const root=path.resolve(__dirname,'..'),args=process.argv.slice(2);
const option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const sourceRoot=path.resolve(option('--sources','E:/chunk-practice-asset-sources/textbooks'));
const packageRoot=path.resolve(option('--packages','E:/chunk-practice-assets/textbooks'));
const output=path.resolve(option('--out','output/textbook-production-status/20261022-v1'));
const catalogFile=path.resolve(option('--catalog','output/vocabulary-illustrations/catalog-20261022-reviewed-v1.json'));
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const optional=file=>fs.existsSync(file)?read(file):null;
if(fs.existsSync(output))throw Error('Choose a new output directory');
const decisions=optional(path.join(root,'output/textbook-sentence-review/review-decisions.json'));
const catalog=read(catalogFile),books=loadCatalog(sourceRoot);
const audio=[];
for(const directory of fs.readdirSync(sourceRoot,{withFileTypes:true}).filter(x=>x.isDirectory())){
 const base=path.join(sourceRoot,directory.name,'audio-batches');if(!fs.existsSync(base))continue;
 const batches=[];
 for(const batch of fs.readdirSync(base,{withFileTypes:true}).filter(x=>x.isDirectory())){
  const file=path.join(base,batch.name,'delivery-manifest.json');if(!fs.existsSync(file))continue;
  const manifest=read(file);let oggFiles=0;
  function count(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())count(p);else if(entry.name.endsWith('.ogg'))oggFiles++;}}
  count(path.dirname(file));
  batches.push({manifest:file,format:manifest.format,bookId:manifest.bookId||manifest.book?.bookId,oggFiles});
 }
 if(batches.length)audio.push({directory:directory.name,batches});
}
const rows=books.map(book=>{
 const review={approved:0,changesRequested:0,pending:0};
 for(const unit of book.draftUnits)for(const item of unit.items){const event=decisions?.events.filter(e=>e.bookId===book.id&&e.unitId===unit.id&&e.itemId===item.itemId&&e.sourceSha256===book.sourceSha256&&e.sentenceFingerprint===item.sentenceFingerprint).at(-1);review[event?.decision==='approved'?'approved':event?.decision==='changes-requested'?'changesRequested':'pending']++;}
 const batches=audio.flatMap(x=>x.batches).filter(x=>x.bookId===book.id);
 return {bookId:book.id,label:book.label,course:book.course,sourceSha256:book.sourceSha256,items:book.taskCount,sentenceDrafts:book.draftCount,sentenceReview:review,audioBatches:batches,imageBindings:catalog.bindings.filter(b=>b.course===book.course).length,reviewUrl:'http://127.0.0.1:4199/?'+new URLSearchParams({bookId:book.id,unitId:book.units[0]?.id||''})};
});
const packages=[];
for(const entry of fs.readdirSync(packageRoot,{withFileTypes:true}).filter(x=>x.isDirectory())){
 const revisions=path.join(packageRoot,entry.name,'revisions');if(!fs.existsSync(revisions))continue;
 const versions=fs.readdirSync(revisions).filter(x=>/^\d{8}-v\d+$/.test(x)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
 for(const version of versions){const file=path.join(revisions,version,'manifest.json');if(!fs.existsSync(file))continue;const m=read(file);packages.push({book:entry.name,version:m.packageVersion,path:path.dirname(file),counts:m.counts,audioAssets:m.audioAssets?.length||0,audioStatus:m.audioStatus});break;}
}
const imageOnlyCourses=[...new Set(catalog.bindings.map(b=>b.course))].filter(course=>!books.some(b=>b.course===course)&&!course.startsWith('people-grade9-full-2013')).map(course=>({course,bindings:catalog.bindings.filter(b=>b.course===course).length,status:'Not in the approved-source sentence production catalog; resolve textbook identity before audio production.'}));
const wordlistFile=path.join(root,'docs/source-materials/people-grade9-upper-2024-review-v3.json'),wordlist=optional(wordlistFile);
const highschoolFile=path.join(root,'output/highschool-internal-preview-QLWtEz/report.json'),highschool=optional(highschoolFile);
const publications=[];
const publishedRoot=path.join(root,'server/data/wordbook-publications');
if(fs.existsSync(publishedRoot)){
 const versions=require('../server/services/public-wordbook-versions').createPublicWordbookVersions({publishedRoot});
 for(const dir of fs.readdirSync(publishedRoot).filter(x=>/^[a-f0-9]{64}$/.test(x))){const manifest=optional(path.join(publishedRoot,dir,'manifest.json'));for(const book of manifest?.books||[]){const active=versions.current(book.bookId);publications.push({bookId:book.bookId,title:active.book.title,items:active.book.itemCount,releaseId:active.releaseId,legacy:active.legacy});}}
}
const report={generatedAt:new Date().toISOString(),sourceRoot,packageRoot,catalog:catalogFile,reuse:catalog.reuseResolution?{approvedGroups:catalog.reuseResolution.appliedGroups.length,decisionRevision:catalog.reuseResolution.decisionRevision}:null,books:rows,audioInventory:audio,packages,publications,imageOnlyCourses,wordlistCandidate:wordlist?{source:wordlistFile,items:wordlist.vocabularyText.split(/\r?\n/).filter(Boolean).length,reviewUrl:'http://127.0.0.1:4206/',status:'Candidate; separate wordlist approval required'}:null,highschoolSnapshot:highschool?{source:highschoolFile,createdAt:highschool.createdAt,books:highschool.books}:null,notes:['Audio file counts are inventory counts; they do not imply listening approval or publication.','Review decisions are matched to current source and sentence hashes.','Package revisions come from manifests; README text is not used to select a version.','Publications are read from the default local publication directory; remote production is not inferred.']};
const lines=['# 教材生产进度','',`生成时间：${report.generatedAt}`,'','由实际词表、句子审核记录、音频交付清单和课程包清单生成。文件数量不代表已审听或已发布。','','| 教材 | 词目 | 例句通过 / 待改 / 待审 | 单词音频交付 | 句子音频交付 |','|---|---:|---:|---:|---:|',...rows.map(b=>`| ${b.label} | ${b.items} | ${b.sentenceReview.approved} / ${b.sentenceReview.changesRequested} / ${b.sentenceReview.pending} | ${b.audioBatches.filter(x=>x.format==='textbook-audio-delivery').reduce((n,x)=>n+x.oggFiles,0)} | ${b.audioBatches.filter(x=>x.format==='textbook-sentence-audio-delivery').reduce((n,x)=>n+x.oggFiles,0)} |`),'','## 最新课程资产包','',...packages.map(p=>`- ${p.book}：${p.version}，${p.audioAssets} 条音频；${p.path}`),'','## 下一批审阅','','[七年级上册 Starter Unit 1](http://127.0.0.1:4199/?bookId=textbook-wordbook%3Apep-junior-grade7-upper-2024&unitId=starter-unit-1)','','完整文件路径、批次和输入摘要见同目录 status.json。'];
lines.push('','## 待核定及扩展教材','',...imageOnlyCourses.map(b=>`- ${b.course}：${b.bindings} 条图片绑定，尚未进入当前例句生产目录。`),...(report.wordlistCandidate?[`- 九年级上册 2024：${report.wordlistCandidate.items} 条修订候选词目；词表审核入口 http://127.0.0.1:4206/ 。`]:[]),...(highschool?.books||[]).map(b=>`- ${b.title}：${b.itemCount} 条；配图待修改 ${b.counts.changes}、待审 ${b.counts.pending}（快照时间 ${highschool.createdAt}）。`),'','## 本地已激活发布版本','',...publications.map(p=>`- ${p.title}：${p.items} 条；release ${p.releaseId}。`));
fs.mkdirSync(output,{recursive:true});
for(const [name,value] of [['status.json',JSON.stringify(report,null,2)+'\n'],['STATUS.md',lines.join('\n')+'\n']])fs.writeFileSync(path.join(output,name),value,{flag:'wx'});
console.log(JSON.stringify({output,books:rows.length,items:rows.reduce((n,b)=>n+b.items,0),packages:packages.length}));
