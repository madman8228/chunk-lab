'use strict';
// Read-only audit of the assembled launch draft and retained illustration candidates.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),base=path.join(root,'output/textbook-extractions/people-grade9-full-2013-20261015');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const source=read(path.join(base,'whole-book-launch-v1/textbook-text-draft.json'));
const draft=require('../server/services/textbook-wordbook-package').assemble(source);
(async()=>{
 await require('../js/wordbook-draft').compile(draft,{requireImages:false});
 const units=[];
 for(let n=1;n<=14;n++){
  const entries=source.drafts[n-1].items,candidates=new Map(),folder=path.join(base,'unit'+n+'-images');
  if(n<=3)for(const item of entries)candidates.set(item.itemId,{word:item.word,files:[{path:item.images.wide[0]}]});
  else if(fs.existsSync(folder)){
   const batches=new Map();
   for(const name of fs.readdirSync(folder).filter(name=>name.endsWith('.report.json'))){
    const report=read(path.join(folder,name)),key=name.match(/batch-(\d+)/)?.[1]||name,version=Number(report.batchId?.match(/-v(\d+)$/)?.[1]||1);
    if(!batches.has(key)||batches.get(key).version<version)batches.set(key,{report,version});
   }
   for(const {report} of batches.values())for(const cell of report.cells||[])candidates.set(cell.itemId,cell);
  }
  const issues=[];let verifiedFiles=0;
  for(const item of entries){
   const candidate=candidates.get(item.itemId),file=candidate?.files?.find(file=>file.path.endsWith('.webp'));
   if(!file){issues.push({itemId:item.itemId,word:item.word,kind:'missing-image-candidate'});continue;}
   if(candidate.word!==item.word)issues.push({itemId:item.itemId,word:item.word,candidateWord:candidate.word,kind:'changed-headword-needs-scene-check'});
   const target=path.join(root,file.path);
   if(!fs.existsSync(target)){issues.push({itemId:item.itemId,kind:'missing-file'});continue;}
   const bytes=fs.readFileSync(target),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
   if(bytes.length>=20000)issues.push({itemId:item.itemId,kind:'image-over-budget',bytes:bytes.length});
   else if(file.sha256&&sha256!==file.sha256)issues.push({itemId:item.itemId,kind:'image-hash-mismatch'});
   else verifiedFiles++;
  }
  units.push({unit:n,items:entries.length,verifiedCandidateFiles:verifiedFiles,associatedImages:entries.filter(item=>item.images.wide.length).length,issues});
 }
 console.log(JSON.stringify({title:draft.book.title,unitCount:units.length,itemCount:draft.items.length,textCompile:'pass',published:false,scope:'Local draft only; candidate file checks do not approve illustration semantics.',units},null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
