'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const model=require('../../js/vocabulary-study.cjs');
const jsonHash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(message,status=503)=>Object.assign(Error(message),{status});

function createPublicWordbookVersions({publishedRoot}){
 const root=path.resolve(publishedRoot),legacySummaryIds=new Map();
 function directory(bookId){
  if(!model.validId(bookId))throw fail('单词本编号无效',400);
  const dir=path.join(root,crypto.createHash('sha256').update(JSON.stringify(bookId)).digest('hex'));
  if(fs.existsSync(dir)&&fs.lstatSync(dir).isSymbolicLink())throw fail('教材发布目录不能是符号链接');
  return dir;
 }
 function readLegacy(bookId,dir){
  if(fs.existsSync(dir)&&fs.lstatSync(dir).isSymbolicLink())throw fail('教材首版目录不能是符号链接');
  const manifestFile=path.join(dir,'manifest.json');if(!fs.existsSync(manifestFile))throw fail('教材首版不存在',404);if(fs.lstatSync(manifestFile).isSymbolicLink())throw fail('教材首版目录文件不能是符号链接');
  const index=model.validateIndex(JSON.parse(fs.readFileSync(manifestFile,'utf8'))),book=index.books.find(row=>row.bookId===bookId);
  if(!book)throw fail('教材首版身份不匹配');
  const items=book.items.map(ref=>{
   const file=path.join(dir,'items',ref.itemId.replace(/:/g,'_')+'.json');if(!fs.existsSync(file))throw fail('教材首版词条缺失');if(fs.lstatSync(file).isSymbolicLink())throw fail('教材首版词条不能是符号链接');
   const item=JSON.parse(fs.readFileSync(file,'utf8')),{contentRevision,...body}=item;
   if(item.itemId!==ref.itemId||contentRevision!==ref.contentRevision||jsonHash(body)!==contentRevision)throw fail('教材首版词条校验失败');
   return item;
  });
  const candidate={format:'wordbook-prepared-package',schemaVersion:1,index,items,published:false};
  const materialFile=path.join(dir,'materials.json'),teachingFile=path.join(dir,'teaching.json');
  if(fs.existsSync(materialFile)){const stored=JSON.parse(fs.readFileSync(materialFile,'utf8'));candidate.materialRelease=stored.release;}
  if(fs.existsSync(teachingFile))candidate.teachingRelease=JSON.parse(fs.readFileSync(teachingFile,'utf8'));
  return {releaseId:jsonHash({index,items}),candidate,legacy:true,book};
 }
 function readRelease(bookId,dir,releaseId){
  const releaseDir=path.join(dir,'releases',releaseId),file=path.join(releaseDir,'package.json');if(!fs.existsSync(file))throw fail('激活记录引用的教材版本不存在');
  if(fs.lstatSync(releaseDir).isSymbolicLink()||fs.lstatSync(file).isSymbolicLink())throw fail('教材历史版本不能通过符号链接读取');
  const candidate=JSON.parse(fs.readFileSync(file,'utf8'));
  if(jsonHash(candidate)!==releaseId||candidate.index?.books?.length!==1||candidate.index.books[0].bookId!==bookId)throw fail('教材版本摘要或身份校验失败');
  model.validateIndex(candidate.index);
  if(!Array.isArray(candidate.items)||candidate.items.length!==candidate.index.books[0].itemCount)throw fail('教材历史版本词条数量校验失败');
  const manifest=JSON.parse(fs.readFileSync(path.join(releaseDir,'manifest.json'),'utf8'));if(jsonHash(manifest)!==jsonHash(candidate.index))throw fail('教材历史版本目录校验失败');
  const items=new Map(candidate.items.map(item=>[item.itemId,item]));
  for(const ref of candidate.index.books[0].items){const item=items.get(ref.itemId),itemFile=path.join(releaseDir,'items',ref.itemId.replace(/:/g,'_')+'.json');if(!item||!fs.existsSync(itemFile)||fs.lstatSync(itemFile).isSymbolicLink())throw fail('教材历史版本词条文件缺失');const stored=JSON.parse(fs.readFileSync(itemFile,'utf8'));if(jsonHash(stored)!==jsonHash(item))throw fail('教材历史版本词条文件不一致');const {contentRevision,...body}=stored;if(contentRevision!==ref.contentRevision||jsonHash(body)!==contentRevision)throw fail('教材历史版本词条摘要校验失败');}
  return {releaseId,candidate,legacy:false,book:candidate.index.books[0]};
 }
 function activations(bookId,dir,validateReleases=true){
  const folder=path.join(dir,'activations');if(!fs.existsSync(folder))return [];
  if(fs.lstatSync(folder).isSymbolicLink())throw fail('教材激活目录不能是符号链接');
  const names=fs.readdirSync(folder).filter(name=>/^\d{12}-[a-f0-9]{64}\.json$/.test(name)).sort();
  const records=[];let prior=null;
  for(let i=0;i<names.length;i++){
   const name=names[i],sequence=i+1;if(name.slice(0,12)!==String(sequence).padStart(12,'0'))throw fail('教材版本激活序号不连续');
   const record=JSON.parse(fs.readFileSync(path.join(folder,name),'utf8')),{recordHash,...body}=record;
   if(record.sequence!==sequence||record.bookId!==bookId||record.previousActivation!==prior||recordHash!==jsonHash(body)||name!==String(sequence).padStart(12,'0')+'-'+recordHash+'.json'||!['update','rollback'].includes(record.action))throw fail('教材版本激活链校验失败');
   if(!/^[a-f0-9]{64}$/.test(record.releaseId)||!/^[a-f0-9]{64}$/.test(record.baseReleaseId))throw fail('教材版本激活身份无效');
   if(validateReleases)readAny(bookId,dir,record.releaseId);prior=recordHash;records.push(record);
  }
  return records;
 }
 function current(bookId){
  const dir=directory(bookId),legacy=readLegacy(bookId,dir),records=activations(bookId,dir);
  if(!records.length)return legacy;
  const active=readAny(bookId,dir,records.at(-1).releaseId);
  return {...active,activation:records.at(-1),history:records};
 }
 function readAny(bookId,dir,releaseId){const legacy=readLegacy(bookId,dir);return legacy.releaseId===releaseId?legacy:readRelease(bookId,dir,releaseId);}
 function history(bookId){
  const dir=directory(bookId),legacy=readLegacy(bookId,dir),records=activations(bookId,dir),all=[legacy];
  for(const record of records)all.push(readAny(bookId,dir,record.releaseId));
  const seen=new Set();return all.filter(row=>{if(seen.has(row.releaseId))return false;seen.add(row.releaseId);return true;}).map(row=>({...row,activeReleaseId:records.at(-1)?.releaseId||legacy.releaseId}));
 }
 function summaryManifest(bookId,dir){
  const file=path.join(dir,'manifest.json');if(!fs.existsSync(file))throw fail('教材目录清单缺失');
  if(fs.lstatSync(dir).isSymbolicLink()||fs.lstatSync(file).isSymbolicLink())throw fail('教材目录不能通过符号链接读取');
  const index=model.validateIndex(JSON.parse(fs.readFileSync(file,'utf8')));if(index.books.length!==1||index.books[0].bookId!==bookId)throw fail('教材目录身份不匹配');return index;
 }
 // Listing metadata is not a content-validation result. Mutations and learning reads still use current()/history().
 function summary(bookId){
  const dir=directory(bookId),index=summaryManifest(bookId,dir),records=activations(bookId,dir,false);
  let legacyId=records[0]?.baseReleaseId;
  if(!legacyId){const fingerprint=jsonHash(index),cached=legacySummaryIds.get(bookId);if(cached?.fingerprint===fingerprint)legacyId=cached.releaseId;else{legacyId=readLegacy(bookId,dir).releaseId;legacySummaryIds.set(bookId,{fingerprint,releaseId:legacyId});}}
  const releaseId=records.at(-1)?.releaseId||legacyId,activeIndex=releaseId===legacyId?index:summaryManifest(bookId,path.join(dir,'releases',releaseId));
  return {book:activeIndex.books[0],releaseId,legacy:releaseId===legacyId};
 }
 function hasPublished(bookId){const dir=directory(bookId);if(!fs.existsSync(path.join(dir,'manifest.json')))return false;summaryManifest(bookId,dir);return true;}
 function publishedBooks(metadataOnly=false){
  if(!fs.existsSync(root))return [];
  return fs.readdirSync(root,{withFileTypes:true}).filter(entry=>entry.isDirectory()&&/^[a-f0-9]{64}$/.test(entry.name)).map(entry=>{
   const dir=path.join(root,entry.name),manifestFile=path.join(dir,'manifest.json');
   if(!fs.existsSync(manifestFile))throw fail('教材首版目录清单缺失');
   const index=model.validateIndex(JSON.parse(fs.readFileSync(manifestFile,'utf8')));
   if(index.books.length!==1)throw fail('教材首版身份不匹配');
   const bookId=index.books[0].bookId;
   if(path.basename(directory(bookId))!==entry.name)throw fail('教材首版身份不匹配');
   const active=metadataOnly?summary(bookId):current(bookId);
   return {book:active.book,releaseId:active.releaseId};
  });
 }
 function findActivatedImport(bookId,importId,packageFingerprint){
  const dir=directory(bookId),records=activations(bookId,dir);if(!records.length)return null;
  for(const row of history(bookId)){
   const receiptFile=path.join(dir,row.legacy?'publication.json':path.join('releases',row.releaseId,'publication.json'));
   if(!fs.existsSync(receiptFile))continue;
   const receipt=JSON.parse(fs.readFileSync(receiptFile,'utf8'));
   if(receipt.importId===importId&&receipt.packageFingerprint===packageFingerprint&&records.some(record=>record.releaseId===row.releaseId))return {...row,receipt};
  }
  return null;
 }
 function withLock(dir,action){
  fs.mkdirSync(dir,{recursive:true});const lock=path.join(dir,'.publish.lock');let fd;
  try{fd=fs.openSync(lock,'wx');}catch(error){if(error.code==='EEXIST')throw fail('另一个教材发布正在进行，请稍后重试',409);throw error;}
  try{return action();}finally{fs.closeSync(fd);fs.unlinkSync(lock);}
 }
 function activate({bookId,expectedBaseReleaseId,releaseId,action='update',reviewId=null,adminId=null}){
  if(!['update','rollback'].includes(action))throw fail('教材版本操作无效',400);
  const dir=directory(bookId);
  return withLock(dir,()=>{
   const base=current(bookId);if(base.releaseId!==expectedBaseReleaseId)throw fail('教材已被其他管理员更新，请基于最新版本重新操作',409);
   const target=readAny(bookId,dir,releaseId);
   if(action==='rollback'&&!history(bookId).some(row=>row.releaseId===releaseId))throw fail('只能恢复已激活并核验过的教材版本',422);
   if(action==='update'&&!history(bookId).some(row=>row.releaseId===releaseId)&&!fs.existsSync(path.join(dir,'releases',releaseId,'publication.json')))throw fail('新教材版本缺少审核发布回执',422);
   if(target.releaseId===base.releaseId)throw fail('目标版本与当前版本相同',422);
   const previous=base.history?.at(-1)?.recordHash||null,sequence=(base.history?.length||0)+1;
   const body={schemaVersion:1,bookId,sequence,previousActivation:previous,releaseId,baseReleaseId:base.releaseId,action,createdAt:new Date().toISOString(),reviewId,adminId};
   const record={...body,recordHash:jsonHash(body)},folder=path.join(dir,'activations');fs.mkdirSync(folder,{recursive:true});
   const name=String(sequence).padStart(12,'0')+'-'+record.recordHash+'.json',temporary=path.join(folder,'.pending-'+crypto.randomUUID());
   fs.writeFileSync(temporary,JSON.stringify(record),{flag:'wx'});const sync=fs.openSync(temporary,'r+');try{fs.fsyncSync(sync);}finally{fs.closeSync(sync);}
   fs.renameSync(temporary,path.join(folder,name));return {...target,activation:record};
  });
 }
 function install(candidate,publication){
  if(!candidate||candidate.format!=='wordbook-prepared-package'||candidate.index?.books?.length!==1)throw fail('待发布教材包无效',422);
  const bookId=candidate.index.books[0].bookId,releaseId=jsonHash(candidate),dir=directory(bookId),target=path.join(dir,'releases',releaseId),releases=path.join(dir,'releases');
  fs.mkdirSync(releases,{recursive:true});
  if(fs.existsSync(target)){const existing=readRelease(bookId,dir,releaseId);return existing;}
  const staging=fs.mkdtempSync(path.join(releases,'.pending-'));
  try{
   fs.writeFileSync(path.join(staging,'package.json'),JSON.stringify(candidate),{flag:'wx'});
   fs.writeFileSync(path.join(staging,'manifest.json'),JSON.stringify(candidate.index),{flag:'wx'});
   if(publication)fs.writeFileSync(path.join(staging,'publication.json'),JSON.stringify(publication),{flag:'wx'});
   fs.mkdirSync(path.join(staging,'items'));
   for(const item of candidate.items)fs.writeFileSync(path.join(staging,'items',item.itemId.replace(/:/g,'_')+'.json'),JSON.stringify(item),{flag:'wx'});
   for(const file of [path.join(staging,'package.json'),path.join(staging,'manifest.json'),...(publication?[path.join(staging,'publication.json')]:[]),...candidate.items.map(item=>path.join(staging,'items',item.itemId.replace(/:/g,'_')+'.json'))]){const fd=fs.openSync(file,'r+');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
   fs.renameSync(staging,target);return readRelease(bookId,dir,releaseId);
  }catch(error){if(fs.existsSync(staging)&&path.dirname(staging)===releases&&path.basename(staging).startsWith('.pending-'))fs.rmSync(staging,{recursive:true,force:true});throw error;}
 }
 return {current,metadata:summary,history,publishedBooks,publishedSummaries:()=>publishedBooks(true),hasPublished,install,activate,readRelease,readLegacy,readAny,findActivatedImport,directory};
}
module.exports={createPublicWordbookVersions};
