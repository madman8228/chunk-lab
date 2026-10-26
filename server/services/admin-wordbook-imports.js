'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const draftModel=require('../../js/wordbook-draft'),bookModel=require('../../js/vocabulary-study.cjs');
const assetsModel=require('./vocabulary-publication-assets');
const textbookModel=require('./textbook-wordbook-package');
const jsonHash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(message,status=422)=>Object.assign(new Error(message),{status});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const MAX_SOURCE=10000000,MAX_TOTAL_ASSETS=250000000;
const MAX_BATCH_FILES=100;
function createAdminWordbookImports({appRoot,dataDirectory,publisher,checkAliases=()=>{}}){
 const root=path.resolve(dataDirectory);fs.mkdirSync(root,{recursive:true});if(fs.lstatSync(root).isSymbolicLink())throw Error('单词课程导入目录不能是符号链接');
 const summaryCache=new Map(),inspectionCache=new Map();
 function folder(id){if(!UUID.test(id))throw fail('导入草稿编号无效',404);const dir=path.join(root,id);if(!fs.existsSync(dir))throw fail('导入草稿不存在',404);if(fs.lstatSync(dir).isSymbolicLink())throw fail('导入草稿目录无效');return dir;}
 function assetsDirectory(dir){const target=path.join(dir,'assets'),stat=fs.lstatSync(target);if(stat.isSymbolicLink()||!stat.isDirectory())throw fail('草稿素材目录无效');return target;}
 function readState(dir){return JSON.parse(fs.readFileSync(path.join(dir,'state.json'),'utf8'));}
 function readPackage(dir){return JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'));}
 function packageSummary(dir){const file=path.join(dir,'package.json'),stat=fs.statSync(file),stamp=[stat.ino,stat.size,stat.mtimeMs,stat.ctimeMs].join(':'),cached=summaryCache.get(dir);if(cached?.stamp===stamp)return cached.value;const candidate=readPackage(dir),book=candidate.index.books[0],value={title:book.title,bookId:book.bookId,itemCount:candidate.items.length,unitCount:book.units?.length||0};summaryCache.set(dir,{stamp,value});return value;}
 function writeAtomic(dir,name,value){const target=path.join(dir,name),tmp=path.join(dir,'.'+name+'.'+crypto.randomUUID()+'.tmp');fs.writeFileSync(tmp,typeof value==='string'?value:JSON.stringify(value),{flag:'wx'});const fd=fs.openSync(tmp,'r+');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}try{fs.renameSync(tmp,target);}catch(error){try{fs.unlinkSync(tmp);}catch{}throw error;}}
 function assetFiles(candidate){return assetsModel.assetReferences(candidate);}
 function privateRead(dir,url){const file=path.join(assetsDirectory(dir),path.basename(url));if(!fs.existsSync(file))return null;if(fs.lstatSync(file).isSymbolicLink())throw fail('暂存素材不能是符号链接');return fs.readFileSync(file);}
 function archiveState(dir){const file=path.join(dir,'archive.json');return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{active:false,events:[]};}
 function editable(dir){if(archiveState(dir).active)throw fail('此草稿已归档，请恢复后再操作',409);}
 function setArchived(id,body,admin){const dir=folder(id),state=readState(dir),record=archiveState(dir);if(state.published)throw fail('已发布记录无需归档，请通过版本记录查看',409);if(typeof body?.archived!=='boolean'||body.revision!==state.revision||body.archiveRevision!==record.events.length)throw fail('草稿状态已变化，请刷新后重试',409);if(!admin?.id)throw fail('管理员身份无效',401);if(record.active===body.archived)return stateView(dir);const event={archived:body.archived,at:new Date().toISOString(),adminId:String(admin.id)};writeAtomic(dir,'archive.json',{active:body.archived,events:[...record.events,event]});return stateView(dir);}
 function hasPublished(bookId){try{return publisher.hasPublished?publisher.hasPublished(bookId):!!publisher.currentRelease?.(bookId);}catch(error){if(error.status===404)return false;throw error;}}
 function stateView(dir,publishedIds){const state=readState(dir),book=packageSummary(dir),archive=archiveState(dir);return {...state,...book,archiveRevision:archive.events.length,archived:archive.active?archive:null,superseded:!state.published&&state.operation!=='update'&&(publishedIds?publishedIds.has(book.bookId):hasPublished(book.bookId))};}
 function assetStamp(dir,candidate){
  const privateRoot=assetsDirectory(dir),installedRoot=path.join(appRoot,'assets');
  return assetFiles(candidate).map(ref=>{for(const file of [path.join(privateRoot,path.basename(ref.url)),path.join(appRoot,ref.url)]){try{if(file.startsWith(installedRoot+path.sep)&&fs.lstatSync(installedRoot).isSymbolicLink())throw fail('课程素材目录不能是符号链接');const stat=fs.lstatSync(file,{bigint:true});if(stat.isSymbolicLink()||!stat.isFile())throw fail('课程素材文件无效：'+ref.url);return [ref.url,file,String(stat.dev),String(stat.ino),String(stat.size),String(stat.mtimeNs),String(stat.ctimeNs)];}catch(error){if(error.code!=='ENOENT')throw error;}}return [ref.url,'missing'];});
 }
 function resourceStatus(dir,candidate,{cached=false}={}){
  const fingerprint=jsonHash({candidate,files:assetStamp(dir,candidate)}),prior=inspectionCache.get(dir);
  if(cached&&prior?.fingerprint===fingerprint){checkAliases(prior.scan.assets.filter(asset=>asset.kind==='illustration'));return prior.scan;}
  const scan=assetsModel.validatePackage(candidate,{appRoot,readPrivate:url=>privateRead(dir,url),allowMissing:true,checkAlias:checkAliases});
  const folded=new Map();for(const ref of assetFiles(candidate)){const prior=folded.get(ref.url.toLowerCase());if(prior&&prior!==ref.url)throw fail('课程素材文件名大小写冲突：'+prior+' / '+ref.url,409);folded.set(ref.url.toLowerCase(),ref.url);}
  if(fingerprint!==jsonHash({candidate,files:assetStamp(dir,candidate)}))throw fail('核验期间素材发生变化，请重新打开课程',409);
  inspectionCache.delete(dir);inspectionCache.set(dir,{fingerprint,scan});if(inspectionCache.size>8)inspectionCache.delete(inspectionCache.keys().next().value);
  return scan;
 }
 async function importSource(source){
  if(!source||typeof source!=='object'||Array.isArray(source)||Buffer.byteLength(JSON.stringify(source))>MAX_SOURCE)throw fail('课程 JSON 无效或超过 10 MB');
  let candidate;
  if(source.format==='textbook-wordbook-package'){
   candidate=await draftModel.compile(textbookModel.assemble(source),{requireImages:false});
  }else if(textbookModel.isTextbook(source.book||source.index?.books?.[0])){
   throw fail('教材请使用整本教材包导入，不能单独导入单元；请先按完整目录打包');
  }else if(source.format==='wordbook-prepared-package'){
   if(source.schemaVersion!==1||source.published!==false||!Array.isArray(source.items)||!Array.isArray(source.index?.books)||source.index.books.length!==1||Object.keys(source).some(k=>!['format','schemaVersion','index','items','assetVerification','published','materialRelease','teachingRelease'].includes(k)))throw fail('课程包格式无效，只支持尚未发布的单课程包');
   bookModel.validateIndex(source.index);if(source.items.length!==source.index.books[0].itemCount)throw fail('课程包条目数与目录不一致');candidate=structuredClone(source);
  }else if(source.schemaVersion===1&&source.book&&Array.isArray(source.items)){
   const errors=draftModel.validate(source,{requireImages:false});if(errors.length)throw fail(errors.join('；'));
   candidate=await draftModel.compile(source,{requireImages:false});
  }else throw fail('请选择完整的系统单词课程 JSON；词表、个人备份或素材审核报告不能直接上架');
  const initialScan=assetsModel.validatePackage(candidate,{appRoot,allowMissing:true,checkAlias:checkAliases});
  const id=crypto.randomUUID(),dir=path.join(root,id);fs.mkdirSync(dir,{recursive:false});fs.mkdirSync(path.join(dir,'assets'));
  const revision=revisionFor(candidate,initialScan),state={importId:id,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),revision,sourceFormat:source.format||'WordbookDraft',status:initialScan.missing.length?'needs-assets':'needs-validation',fingerprint:null,review:null,published:null};
  try{writeAtomic(dir,'source.json',JSON.stringify(source));writeAtomic(dir,'package.json',candidate);writeAtomic(dir,'state.json',state);return stateView(dir);}
  catch(error){throw error;}
 }
 async function importRevision({bookId,baseReleaseId,source}){
  if(typeof bookId!=='string'||typeof baseReleaseId!=='string'||!/^[a-f0-9]{64}$/.test(baseReleaseId))throw fail('修订课程或基线版本无效');
  const created=await importSource(source),dir=folder(created.importId),candidate=readPackage(dir),book=candidate.index.books[0],base=publisher.currentRelease(bookId);
  if(book.bookId!==bookId)throw fail('修正版必须与已发布课程使用相同课程编号',409);
  if(!base||base.releaseId!==baseReleaseId)throw fail('教材已更新，请刷新后基于当前版本重新导入',409);
  if(book.title!==base.book.title)throw fail('教材名称必须保持不变',422);
  const changedCatalog=JSON.stringify(book.catalog||null)!==JSON.stringify(base.book.catalog||null);
  if(changedCatalog&&!require('./wordbook-unit-titles').sameContentExceptCatalog(base.book,book))throw fail('目录元数据修订须与教学内容纠错分开提交',422);
  if(candidate.materialRelease!==undefined||candidate.teachingRelease!==undefined||base.candidate?.materialRelease!==undefined)throw fail('当前不支持带教学编排或材料版本的课程修订',422);
  const shape=require('./wordbook-unit-titles').directoryIdentity;
  if(shape(base.book)!==shape(book))throw fail('仅支持固定单元和词条目录的内容纠错；目录变化需要单独流程',422);
  const before=new Map(base.candidate.items.map(item=>[item.itemId,item])),after=new Map(candidate.items.map(item=>[item.itemId,item]));
  const changedItems=[];
  for(const item of candidate.items){const old=before.get(item.itemId);if(!old)throw fail('修正版词条身份与当前版本不一致',422);const fields=[];
   for(const key of new Set([...Object.keys(old),...Object.keys(item)]))if(key!=='contentRevision'&&JSON.stringify(old[key])!==JSON.stringify(item[key]))fields.push(key);
   if(fields.length)changedItems.push({itemId:item.itemId,unitId:item.unitId,word:item.word,fields});
  }
  const changedUnits=(book.units||[]).filter((unit,index)=>unit.title!==base.book.units[index].title).map(unit=>({unitId:unit.unitId,before:base.book.units.find(row=>row.unitId===unit.unitId).title,after:unit.title}));
  if(changedUnits.length&&!require('./wordbook-unit-titles').sameContentExceptUnitTitles(base.book,book))throw fail('单元名称修订须与词条内容纠错分开提交',422);
  if(changedItems.length===0&&changedUnits.length===0&&!changedCatalog)throw fail('修正版没有内容变化，不创建新版本',422);
  const state=readState(dir);state.operation='update';state.bookId=bookId;state.baseReleaseId=baseReleaseId;state.changedItems=changedItems;state.changedUnits=changedUnits;if(changedCatalog)state.changedCatalog={before:base.book.catalog||null,after:book.catalog||null};updateState(dir,state);
  return stateView(dir);
 }
 function summaries(publishedIds){return fs.readdirSync(root,{withFileTypes:true}).filter(entry=>entry.isDirectory()&&UUID.test(entry.name)&&fs.existsSync(path.join(root,entry.name,'state.json'))).map(entry=>stateView(path.join(root,entry.name),publishedIds)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
 function overview(){const courses=publisher.publishedBooks(),drafts=summaries(new Set(courses.map(row=>row.bookId))).map(row=>({importId:row.importId,title:row.title,bookId:row.bookId,itemCount:row.itemCount,unitCount:row.unitCount,status:row.status,createdAt:row.createdAt,updatedAt:row.updatedAt,revision:row.revision,operation:row.operation,published:!!row.published,archiveRevision:row.archiveRevision,archived:!!row.archived,superseded:row.superseded}));return {courses,drafts};}
 function previousCandidate(state){if(state.operation!=='update')return null;const prior=publisher.releaseCandidate(state.bookId,state.baseReleaseId);if(!prior)throw fail('修订基线版本无法核实',409);return prior.candidate;}
 function productionReview(dir,state){const file=path.join(dir,'production-review.json');if(!fs.existsSync(file))return null;const record=JSON.parse(fs.readFileSync(file,'utf8'));return record.format==='textbook-production-review-evidence'&&record.schemaVersion===1&&record.packageFingerprint===state.fingerprint?record:null;}
 function previousAssets(id,state,prior){if(!prior)return [];const changed=new Set((state.changedItems||[]).map(row=>row.itemId)),urls=new Set();for(const item of prior.items.filter(row=>changed.has(row.itemId))){for(const url of [...(item.images?.wide||[]),...(item.images?.mobile||[])])urls.add(url);for(const activity of [item.learning?.wordDictation,item.learning?.sentenceAudio,item.learning?.readAloud].filter(Boolean))for(const clip of [activity.audio,...Object.values(activity.audioByAccent||{})])urls.add(clip.url);}return assetFiles(prior).filter(ref=>urls.has(ref.url)).map(ref=>{const bytes=assetsModel.readInstalled(appRoot,ref.url);return {url:ref.url,kind:ref.kind,bytes:bytes.length,sha256:assetsModel.digest(bytes),previous:true};});}
 function detail(id){const dir=folder(id),candidate=readPackage(dir),state=readState(dir),status=stateView(dir),scan=resourceStatus(dir,candidate,{cached:true});let offset=0;const units=(candidate.index.books[0].units||[]).map(unit=>{const result={unitId:unit.unitId,title:unit.title,itemCount:unit.itemIds.length,offset};offset+=unit.itemIds.length;return result;});const prior=previousCandidate(state),before=prior?new Map(prior.items.map(item=>[item.itemId,item])):null,changedItems=(state.changedItems||[]).map(change=>{const old=before?.get(change.itemId),next=candidate.items.find(item=>item.itemId===change.itemId),summary=item=>({meaning:item?.meaning||'',translation:item?.translation||'',example:item?.example||'',imageUrl:item?.images?.wide?.[0]||'',audioUrl:item?.learning?.sentenceAudio?.audio?.url||item?.learning?.wordDictation?.audio?.url||item?.learning?.readAloud?.audio?.url||''});return {...change,before:summary(old),after:summary(next)};});const evidence=productionReview(dir,state);return {...status,validation:!status.archived&&!status.superseded&&['validated','reviewed'].includes(state.status)&&state.fingerprint&&state.revision===revisionFor(candidate,scan)?{ready:true,revision:state.revision,fingerprint:state.fingerprint}:null,changedItems,units,productionReview:evidence?{...evidence,items:undefined}:null,assets:scan.assets.map(({url,kind,bytes,sha256,missing})=>({url,kind,bytes,sha256,missing:!!missing})),previousAssets:previousAssets(id,state,prior),review:status.review,published:status.published};}
 function checkTextbook(dir,candidate){
  if(!textbookModel.isTextbook(candidate.index.books[0])&&readState(dir).sourceFormat!=='textbook-wordbook-package')return;
  const source=JSON.parse(fs.readFileSync(path.join(dir,'source.json'),'utf8'));
  const assembled=textbookModel.assemble(source),book=candidate.index.books[0];
  if(assembled.book.bookId!==book.bookId||JSON.stringify(assembled.book.units)!==JSON.stringify(book.units.map(({unitId,title})=>({unitId,title})))||JSON.stringify(assembled.items.map(item=>item.itemId))!==JSON.stringify(candidate.items.map(item=>item.itemId)))throw fail('教材包与完整目录不一致');
 }
 function revisionFor(candidate,scan){return jsonHash({candidate,assets:scan.assets});}
 function updateState(dir,state){state.updatedAt=new Date().toISOString();writeAtomic(dir,'state.json',state);}
 function packageReader(dir){const buffers=new Map();return url=>{if(!buffers.has(url))buffers.set(url,privateRead(dir,url)||assetsModel.readInstalled(appRoot,url));return buffers.get(url);};}
 function upload(id,filename,bytes){
  editable(folder(id));
  const dir=folder(id),state=readState(dir);if(state.published)throw fail('课程已发布，不能修改',409);
  if(!Buffer.isBuffer(bytes)||!bytes.length)throw fail('素材文件为空');
  const candidate=readPackage(dir),ref=assetFiles(candidate).find(item=>path.basename(item.url)===filename);if(!ref)throw fail('这个文件未被课程引用');
  const current=resourceStatus(dir,candidate),total=current.assets.filter(a=>!a.missing).reduce((sum,a)=>sum+a.bytes,0);if(total+bytes.length>MAX_TOTAL_ASSETS)throw fail('课程交付素材不能超过 250 MB');
  const checked=assetsModel.inspectBytes(ref,bytes),installedPath=path.join(appRoot,ref.url),draftPath=path.join(assetsDirectory(dir),filename);
  if(fs.existsSync(installedPath)){const installed=fs.readFileSync(installedPath);if(assetsModel.digest(installed)!==checked.sha256)throw fail('服务已有同名但内容不同的课程素材，不能覆盖：'+ref.url,409);}
  if(fs.existsSync(draftPath)){const old=fs.readFileSync(draftPath);if(assetsModel.digest(old)!==checked.sha256)throw fail('草稿中已有同名不同内容的素材；请重新导入课程包',409);return detail(id);}
  fs.writeFileSync(draftPath,bytes,{flag:'wx'});const fd=fs.openSync(draftPath,'r+');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  state.revision=revisionFor(candidate,resourceStatus(dir,candidate));state.status='needs-validation';state.fingerprint=null;state.review=null;updateState(dir,state);return detail(id);
 }
 function uploadBatch(id,entries){
  editable(folder(id));
  const dir=folder(id),state=readState(dir);if(state.published)throw fail('课程已发布，不能修改',409);
  if(!Array.isArray(entries)||!entries.length||entries.length>MAX_BATCH_FILES)throw fail('批量素材数量无效，单批最多 100 个文件');
  const candidate=readPackage(dir),refs=new Map(assetFiles(candidate).map(ref=>[path.basename(ref.url),ref])),current=resourceStatus(dir,candidate),seen=new Set(),prepared=[];
  let total=current.assets.filter(asset=>!asset.missing).reduce((sum,asset)=>sum+asset.bytes,0),changed=false;
  for(const entry of entries){
   const filename=entry?.filename,bytes=entry?.bytes;
   if(typeof filename!=='string'||filename!==path.basename(filename)||!/[A-Za-z0-9._-]{1,180}\.(?:webp|mp3|ogg|wav|png|jpe?g)$/i.test(filename))throw fail('素材文件名无效');
   if(seen.has(filename))throw fail('批次中包含重复文件：'+filename,409);seen.add(filename);
   const ref=refs.get(filename);if(!ref)throw fail('这个文件未被课程引用：'+filename);
   if(!Buffer.isBuffer(bytes)||!bytes.length)throw fail('素材文件为空：'+filename);
   const checked=assetsModel.inspectBytes(ref,bytes),installedPath=path.join(appRoot,ref.url),draftPath=path.join(assetsDirectory(dir),filename);
   for(const existingPath of [installedPath,draftPath])if(fs.existsSync(existingPath)){
    const stat=fs.lstatSync(existingPath);if(stat.isSymbolicLink()||!stat.isFile())throw fail('课程素材目标无效：'+ref.url,409);
    if(assetsModel.digest(fs.readFileSync(existingPath))!==checked.sha256)throw fail('课程已有同名但内容不同的素材，不能覆盖：'+ref.url,409);
   }
   if(!fs.existsSync(installedPath)&&!fs.existsSync(draftPath)){total+=bytes.length;if(total>MAX_TOTAL_ASSETS)throw fail('课程交付素材不能超过 250 MB');prepared.push({filename,bytes,draftPath});changed=true;}
  }
  const created=[];
  try{
   for(const file of prepared){
    const temp=path.join(assetsDirectory(dir),'.batch-'+crypto.randomUUID()+'.tmp'),fd=fs.openSync(temp,'wx');
    try{fs.writeFileSync(fd,file.bytes);fs.fsyncSync(fd);try{fs.linkSync(temp,file.draftPath);created.push(file.draftPath);}catch(error){if(error.code!=='EEXIST')throw error;const existing=fs.readFileSync(file.draftPath);if(assetsModel.digest(existing)!==assetsModel.digest(file.bytes))throw fail('并行写入时发现同名不同内容素材：'+file.filename,409);}}
    finally{fs.closeSync(fd);try{fs.unlinkSync(temp);}catch(error){if(error.code!=='ENOENT')throw error;}}
   }
   if(changed){state.revision=revisionFor(candidate,resourceStatus(dir,candidate));state.status='needs-validation';state.fingerprint=null;state.review=null;updateState(dir,state);}
  }catch(error){for(const file of created){try{fs.unlinkSync(file);}catch{}}throw error;}
  return {added:created.length,alreadyPresent:entries.length-created.length,detail:detail(id)};
 }
 function validate(id,revision){
  editable(folder(id));
  const dir=folder(id),state=readState(dir),candidate=readPackage(dir);if(state.published)throw fail('课程已发布',409);const scan=resourceStatus(dir,candidate);
  checkTextbook(dir,candidate);
  if(scan.missing.length)throw fail('课程素材尚未齐全：'+scan.missing.join('、'),409);
  const ready=publisher.validate(candidate,{readAsset:packageReader(dir),...(state.operation==='update'?{updateBaseReleaseId:state.baseReleaseId}:{})}),fingerprint=jsonHash({candidateFingerprint:ready.fingerprint,assetFingerprint:scan.fingerprint,assets:scan.assets,operation:state.operation||'publish',baseReleaseId:state.baseReleaseId||null});
  const nextRevision=revisionFor(candidate,scan);if(revision&&revision!==nextRevision)throw fail('课程内容或素材已变化，请刷新后重新校验',409);
  if(state.revision!==nextRevision||state.fingerprint!==fingerprint)state.review=null;
  state.revision=nextRevision;state.fingerprint=fingerprint;state.status=state.review?'reviewed':'validated';updateState(dir,state);
  return {...ready,revision:nextRevision,fingerprint,assets:scan.assets,status:state.status,review:state.review};
 }
 function review(id,body,admin){
  editable(folder(id));
  const dir=folder(id),state=readState(dir);if(state.published)throw fail('课程已发布，审核状态只读',409);
  if(!state.fingerprint||body?.revision!==state.revision||body?.fingerprint!==state.fingerprint)throw fail('请先校验当前课程与素材',409);
  if(state.issues?.length)throw fail('请先处理已标记的课程问题',409);
  const sensory=body.approved===true,note=body.note??'';
  if(!sensory&&!['content','level','assets','rights'].every(key=>body[key]===true))throw fail('请确认课程审核通过');
  if(typeof note!=='string'||note.length>4000)throw fail('审核备注格式无效');
  const reviewer=String(admin?.id||'');if(!reviewer)throw fail('管理员身份无效',401);
  const record={reviewId:crypto.randomUUID(),revision:state.revision,fingerprint:state.fingerprint,reviewer,reviewedAt:new Date().toISOString(),content:true,level:true,assets:true,rights:sensory?false:true,note:note.trim()};
  state.review=record;state.status='reviewed';updateState(dir,state);return {reviewId:record.reviewId,reviewedAt:record.reviewedAt};
 }
 function markIssue(id,body,admin){
  editable(folder(id));
  const dir=folder(id),state=readState(dir);if(state.published)throw fail('课程已发布，问题标记只读',409);
  const items=readPackage(dir).items,position=items.findIndex(item=>item.itemId===body?.itemId);
  if(position<0||!['image','sentence','translation','audio','practice'].includes(body?.category))throw fail('问题对应的词条或类型无效');
  const note=body.note??'';if(typeof note!=='string'||note.length>1000||typeof body.resolved!=='boolean')throw fail('问题标记格式无效');
  const reviewer=String(admin?.id||'');if(!reviewer)throw fail('管理员身份无效',401);
  const issues=(state.issues||[]).filter(issue=>issue.itemId!==body.itemId||issue.category!==body.category);
  if(!body.resolved)issues.push({itemId:body.itemId,word:items[position].word,position,category:body.category,note:note.trim(),reviewer,updatedAt:new Date().toISOString()});
  state.issues=issues;state.review=null;if(state.fingerprint)state.status='validated';updateState(dir,state);return {issues};
 }
 function promoteAssets(dir,scan){
  const rootAssets=path.resolve(appRoot,'assets');if(!fs.existsSync(rootAssets))throw fail('服务端素材目录不存在',503);if(fs.lstatSync(rootAssets).isSymbolicLink())throw fail('服务端素材目录不能是符号链接');
  for(const asset of scan.assets){if(asset.missing)throw fail('课程素材尚未齐全：'+asset.url,409);const draftPath=path.join(dir,'assets',path.basename(asset.url));if(!fs.existsSync(draftPath))continue;
   const target=path.join(appRoot,asset.url);if(path.dirname(target)!==rootAssets)throw fail('课程素材必须位于 assets 根目录');
   const bytes=fs.readFileSync(draftPath);if(assetsModel.digest(bytes)!==asset.sha256)throw fail('课程素材上传后发生变化，请重新校验',409);
   try{const st=fs.lstatSync(target);if(st.isSymbolicLink()||!st.isFile())throw fail('目标素材路径无效：'+asset.url,409);if(assetsModel.digest(fs.readFileSync(target))!==asset.sha256)throw fail('服务已有同名但内容不同的课程素材，不能覆盖：'+asset.url,409);continue;}
   catch(error){if(error.code!=='ENOENT')throw error;}
   const temp=path.join(rootAssets,'.pending-wordbook-'+crypto.randomUUID()),fd=fs.openSync(temp,'wx');
   try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);try{fs.linkSync(temp,target);}catch(error){if(error.code!=='EEXIST')throw error;const existing=fs.readFileSync(target);if(assetsModel.digest(existing)!==asset.sha256)throw fail('发布期间同名素材发生冲突：'+asset.url,409);}}
   finally{fs.closeSync(fd);try{fs.unlinkSync(temp);}catch(error){if(error.code!=='ENOENT')throw error;}}
  }
 }
 function publish(id,body){
  editable(folder(id));
  const dir=folder(id),state=readState(dir),candidate=readPackage(dir);if(state.published){if(body?.confirmed===true&&body?.reviewId===state.review?.reviewId&&body?.fingerprint===state.fingerprint)return state.published;throw fail('此课程草稿已发布，不能变更或重复发布',409);}
  checkTextbook(dir,candidate);
  const review=state.review;if(!review||review.reviewId!==body?.reviewId||review.revision!==state.revision||review.fingerprint!==body?.fingerprint||body?.confirmed!==true)throw fail('课程或素材审核已失效，请重新校验并确认',409);
  if(state.issues?.length)throw fail('请先处理已标记的课程问题',409);
  if(review.rights!==true&&body.rightsConfirmed!==true)throw fail('发布前请确认素材使用授权');
  if(state.revision!==body.revision||state.fingerprint!==body.fingerprint)throw fail('课程内容或素材已变化，请重新审核',409);
  const committed=state.operation==='update'?null:publisher.findImport?.(id,body.fingerprint);if(committed){state.published={...committed,publishedAt:new Date().toISOString()};state.status='published';updateState(dir,state);return state.published;}
  const scan=resourceStatus(dir,candidate);if(scan.missing.length)throw fail('课程素材尚未齐全',409);
  const ready=publisher.validate(candidate,{readAsset:packageReader(dir),...(state.operation==='update'?{updateBaseReleaseId:state.baseReleaseId}:{})});
  const liveFingerprint=jsonHash({candidateFingerprint:ready.fingerprint,assetFingerprint:scan.fingerprint,assets:scan.assets,operation:state.operation||'publish',baseReleaseId:state.baseReleaseId||null});if(liveFingerprint!==state.fingerprint)throw fail('课程素材已变化，请重新校验和审核',409);
  promoteAssets(dir,scan);
  const receipt={importId:id,packageFingerprint:state.fingerprint,assets:scan.assets.filter(a=>a.kind==='illustration'),productionReview:productionReview(dir,state),review:{...review,rights:true,rightsConfirmedAt:review.rights===true?review.reviewedAt:new Date().toISOString()}};
  const result=state.operation==='update'?publisher.publishRevision(candidate,ready.fingerprint,state.baseReleaseId,receipt):publisher.publish(candidate,ready.fingerprint,true,receipt);
  state.published={...result,publishedAt:new Date().toISOString()};state.status='published';updateState(dir,state);return state.published;
 }
 function itemPage(id,offset=0,limit=20){const dir=folder(id),candidate=readPackage(dir),start=Math.max(0,Number(offset)||0),size=Math.min(20,Math.max(1,Number(limit)||20));return {total:candidate.items.length,offset:start,items:candidate.items.slice(start,start+size)};}
 function readAsset(id,filename){const dir=folder(id),candidate=readPackage(dir),ref=assetFiles(candidate).find(item=>path.basename(item.url)===filename);if(!ref)throw fail('课程没有引用这个素材',404);const staged=privateRead(dir,ref.url);return staged||assetsModel.readInstalled(appRoot,ref.url);}
 function readPreviousAsset(id,filename){const state=readState(folder(id)),candidate=previousCandidate(state);if(!candidate)throw fail('此草稿不是教材修订',404);const ref=assetFiles(candidate).find(item=>path.basename(item.url)===filename);if(!ref)throw fail('基线版本没有引用这个素材',404);return assetsModel.readInstalled(appRoot,ref.url);}
 return {importSource,importRevision,list:summaries,overview,detail,upload,uploadBatch,validate,review,markIssue,publish,setArchived,itemPage,readAsset,readPreviousAsset,published:()=>publisher.publishedBooks(),history:bookId=>publisher.releaseHistory(bookId),rollback:body=>publisher.rollback(body)};
}
module.exports={createAdminWordbookImports,MAX_SOURCE,MAX_TOTAL_ASSETS};
