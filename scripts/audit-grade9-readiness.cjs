'use strict';
// Read-only readiness inventory. Does not change drafts, assets or live data.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),base=path.join(root,'output/textbook-extractions/people-grade9-full-2013-20261015');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8')),hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const source=read(path.join(root,'docs/source-materials/people-grade9-full-2013.json'));
const rows=source.vocabularyText.trim().split(/\r?\n/).map(line=>{const [unit,word,meaning,page]=line.split('|');return {unit:Number(unit.replace('Unit ','')),word,meaning,page:Number(page)};});
const results=[];
for(let unit=1;unit<=14;unit++){
 const entries=rows.filter(row=>row.unit===unit),folder=path.join(base,'unit'+unit+'-pilot');
 const files=fs.existsSync(folder)?fs.readdirSync(folder).filter(file=>/^wordbook-draft.*\.json$/.test(file)&&!file.includes('report')):[];
 const drafts=files.map(file=>({file:path.join(folder,file),draft:read(path.join(folder,file))}));
 const selected=drafts.find(row=>row.file.includes('shared-webp'))||drafts[0];
 const issues=[],imageMap=new Map();let missingFiles=0,oversize=0,hashMismatch=0;
 if(unit<=3&&selected){
  for(const [index,item] of selected.draft.items.entries()){
   const src=entries[index],confirmedName=unit===1&&src?.word==='Alexander Bell'&&item.word==='Alexander Graham Bell';if(!src||(!confirmedName&&src.word!==item.word)||src.meaning!==item.meaning)issues.push({itemId:item.itemId,source:src?.word,word:item.word,kind:'source-text-difference'});
   const wide=item.images?.wide||[],mobile=item.images?.mobile||[];
   const url=wide.find(url=>url.endsWith('.webp'));
   if(url)imageMap.set(item.itemId,{word:item.word,meaning:item.meaning,url});
   if(wide.length!==1||mobile.length!==1||wide[0]!==mobile[0]||!wide[0]?.endsWith('.webp'))issues.push({itemId:item.itemId,kind:'legacy-image-references'});
  }
 }else{
  const imageFolder=path.join(base,'unit'+unit+'-images');
  if(fs.existsSync(imageFolder)){
   const batches=new Map();
   for(const filename of fs.readdirSync(imageFolder).filter(name=>/\.report\.json$/.test(name))){
    const report=read(path.join(imageFolder,filename)),key=filename.match(/batch-(\d+)/)?.[1]||filename;
    const previous=batches.get(key),version=Number(report.batchId?.match(/-v(\d+)$/)?.[1]||1);
    if(!previous||version>previous.version)batches.set(key,{report,version});
   }
   for(const {report} of batches.values())for(const cell of report.cells||[]){const file=cell.files?.find(file=>file.path.endsWith('.webp'));if(file)imageMap.set(cell.itemId,{word:cell.word,meaning:cell.meaning,url:file.path,sha256:file.sha256});}
  }
  for(const [index,src] of entries.entries()){
   const itemId='pep-g9-2013-u'+unit+':'+String(index+1).padStart(2,'0'),image=imageMap.get(itemId);
   if(!image)issues.push({itemId,word:src.word,kind:'missing-image-mapping'});
   else if(image.word!==src.word||image.meaning!==src.meaning)issues.push({itemId,word:src.word,mappedWord:image.word,kind:'image-source-difference'});
  }
 }
 for(const image of imageMap.values()){
  const file=path.join(root,image.url);if(!fs.existsSync(file)){missingFiles++;continue;}
  const bytes=fs.readFileSync(file);if(bytes.length>=20000)oversize++;
  if(image.sha256&&hash(bytes)!==image.sha256)hashMismatch++;
 }
 const items=selected?.draft.items||[];
 results.push({unit,sourceWords:entries.length,draft:selected?path.relative(root,selected.file).replace(/\\/g,'/'):null,draftWords:items.length,schemaErrors:selected?require('../js/wordbook-draft').validate(selected.draft,{requireImages:true}):[],imageMappings:imageMap.size,missingFiles,oversize,hashMismatch,examples:items.filter(i=>i.exercise&&i.translation&&i.scene).length,audioConfigured:items.filter(i=>i.dictation||i.sentenceAudio||i.readAloud).length,issues});
}
const manifest=read(path.join(base,'source-image-manifest.json'));
const scanIssues=manifest.flatMap(entry=>{const file=path.join(base,'source-images',entry.filename);if(!fs.existsSync(file))return [{file:entry.filename,kind:'missing-source-scan'}];return hash(fs.readFileSync(file))===entry.sha256?[]:[{file:entry.filename,kind:'source-scan-hash-mismatch'}];});
console.log(JSON.stringify({title:source.edition.titleZh,publisher:source.edition.publisher,edition:'2013',sourceWords:rows.length,sourceScanCount:manifest.length,sourceScanIssues:scanIssues,units:results},null,2));
