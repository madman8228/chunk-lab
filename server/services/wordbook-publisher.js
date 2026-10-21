'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const model=require('../../js/vocabulary-study.cjs'),contract=require('../../js/vocabulary-course-contract'),engine=require('../../landing/sentence-cloze-engine');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(message,status=422)=>Object.assign(Error(message),{status});
function createWordbookPublisher({appRoot,content,versions,checkImageAliases=()=>{}}){
 const directory=path.resolve(content.publicationDirectory||path.join(appRoot,'content/vocabulary/published'));
 function checkAsset(url,illustration,readAsset){
  if(typeof url!=='string'||!/^assets\/[A-Za-z0-9._-]+\.(avif|webp|png|jpg|svg)$/.test(url)||illustration&&!/\.webp$/.test(url))throw fail('新单词本插画只接受 WebP');
  let bytes;
  if(readAsset)bytes=readAsset(url);
  else{const root=fs.realpathSync(path.join(appRoot,'assets')),file=fs.realpathSync(path.join(appRoot,url)),relative=path.relative(root,file);if(relative.startsWith('..')||path.isAbsolute(relative))throw fail('素材不能越出 assets 目录');const stat=fs.statSync(file);if(!stat.isFile())throw fail('素材文件无效：'+url);bytes=fs.readFileSync(file);}
  if(!Buffer.isBuffer(bytes)||!bytes.length)throw fail('素材文件无效：'+url);
  try{require('./vocabulary-publication-assets').inspectBytes({url,kind:illustration?'illustration':'cover'},bytes);}catch(error){throw fail(error.message);}
 }
 function validate(candidate,{readAsset,updateBaseReleaseId}={}){
  if(!fs.existsSync(path.join(appRoot,'content/vocabulary/index.json')))throw fail('原单词本目录尚未就绪；不创建替代目录',503);
  if(!candidate||candidate.format!=='wordbook-prepared-package'||candidate.schemaVersion!==1||candidate.published!==false||!Array.isArray(candidate.items)||candidate.items.length>10000||Buffer.byteLength(JSON.stringify(candidate))>10000000)throw fail('待发布包格式或大小无效');
  if(Object.keys(candidate).some(k=>!['format','schemaVersion','index','items','assetVerification','published','materialRelease','teachingRelease'].includes(k)))throw fail('内容包含未知包字段');
  model.validateIndex(candidate.index);if(candidate.index.books.length!==1)throw fail('每次只能追加一本单词本');
  const book=candidate.index.books[0],existing=content.index(),isUpdate=typeof updateBaseReleaseId==='string';
  if(book.relatedCourseIds!==undefined&&(!Array.isArray(book.relatedCourseIds)||book.relatedCourseIds.length))throw fail('制作草稿中的个人课程关联不能直接公开；请保留原草稿，公开目录关联需单独审核');
  if(isUpdate){
   if(!versions)throw fail('教材版本服务尚未就绪',503);
   const base=versions.current(book.bookId),prior=base.book;
   if(base.releaseId!==updateBaseReleaseId)throw fail('教材已更新，请基于最新版本重新导入',409);
   if(book.title!==prior.title||JSON.stringify(book.catalog||null)!==JSON.stringify(prior.catalog||null))throw fail('教材名称与版本信息必须保持不变；本次只处理词条内容纠错',422);
   if(candidate.materialRelease!==undefined||candidate.teachingRelease!==undefined||base.candidate?.materialRelease!==undefined)throw fail('当前仅支持不含教学编排或材料版本的教材修订',422);
   const shape=row=>JSON.stringify({units:(row.units||[]).map(unit=>({unitId:unit.unitId,title:unit.title,itemIds:unit.itemIds})),items:row.items.map(ref=>ref.itemId)});
   if(shape(prior)!==shape(book))throw fail('教材目录或词条身份发生变化；本次修订仅支持固定目录内容纠错',422);
  }else if(existing.books.some(b=>b.bookId===book.bookId))throw fail('单词本编号已存在；不会覆盖旧课程，请核查是否已发布',409);
  if(book.revision!==hash(book.items)||book.units&&book.structureRevision!==hash(book.units))throw fail('课程或单元版本校验失败');
  if(candidate.items.length!==book.items.length)throw fail('教学项目与索引数量不一致');
  const prior=new Set(existing.books.flatMap(b=>b.items.map(r=>r.itemId))),items=new Map(),filenames=new Set();
  for(const item of candidate.items){
   if(!item||items.has(item.itemId))throw fail('教学项目编号重复；不会替换',409);
   if(prior.has(item.itemId)&&!isUpdate){
    const original=content.item(item.itemId,item.contentRevision);
    if(hash(original)!==hash(item))throw fail('教学项目与旧课程内容冲突；不会替换',409);
   }
   const filename=String(item.itemId).replace(/:/g,'_').toLowerCase();if(filenames.has(filename)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(filename))throw fail('项目文件名冲突或不可用');filenames.add(filename);
   const ref=book.items.find(r=>r.itemId===item.itemId),{contentRevision,...body}=item;
   if(!ref||ref.contentRevision!==contentRevision||hash(body)!==contentRevision)throw fail('教学内容版本校验失败');
   for(const key of ['word','meaning','scene','translation','example'])if(typeof item[key]!=='string'||!item[key].trim()||item[key].length>1000)throw fail('教学文本缺失或过长：'+key);
   engine.validate(item.exercise);contract.validateLearning(item,engine);
   require('./vocabulary-dictation-assets').validateDictationAssets(item,appRoot,readAsset);
   if(engine.normalize(item.example)!==engine.normalize(engine.sentence(item.exercise)))throw fail('例句与练习不一致');
   if(item.learning?.guidedExpression&&item.learning.guidedExpression.revision!==hash(item.learning.guidedExpression.steps))throw fail('中文引导版本不一致');
   const choice=item.learning?.wordChoice;
   if(choice&&choice.revision!==hash({field:choice.field,options:choice.options,correctOptionId:choice.correctOptionId}))throw fail('选词任务版本不一致');
   const order=item.learning?.chunkOrder;
   if(order&&order.revision!==hash({chunks:order.chunks,correctOrder:order.correctOrder}))throw fail('拼块任务版本不一致');
   const wide=item.images?.wide,mobile=item.images?.mobile;
   if(!Array.isArray(wide)||!Array.isArray(mobile)||wide.length!==1||mobile.length!==1||wide[0]!==mobile[0]||!wide[0].endsWith('.webp'))throw fail('新单词本每词需使用同一张宽屏 WebP（宽屏与窄屏共用）');
   checkAsset(wide[0],true,readAsset);
   items.set(item.itemId,item);
  }
  if(book.catalog?.coverUrl)checkAsset(book.catalog.coverUrl,false,readAsset);
  checkImageAliases(candidate.items.flatMap(item=>item.images.wide.map(url=>({url,sha256:crypto.createHash('sha256').update(readAsset?readAsset(url):fs.readFileSync(path.join(appRoot,url))).digest('hex')}))));
  if(candidate.materialRelease!==undefined)require('./vocabulary-material-release').validateMaterialRelease(candidate,appRoot,readAsset);
  if(candidate.teachingRelease!==undefined)require('./vocabulary-teaching-content').validateRelease(candidate.teachingRelease,book,candidate.items,appRoot,{readAsset});
  model.validateIndex({schemaVersion:1,books:isUpdate?existing.books.map(row=>row.bookId===book.bookId?book:row).concat(existing.books.some(row=>row.bookId===book.bookId)?[]:[book]):[...existing.books,book]},{allowItemVersions:isUpdate});
  return {bookId:book.bookId,title:book.title,itemCount:book.itemCount,unitCount:book.units?.length||0,fingerprint:hash(candidate),ready:true};
 }
 function publish(candidate,fingerprint,confirmed,publication){
  if(confirmed!==true)throw fail('需要核对预览并明确确认发布',428);
  const parent=path.dirname(directory);if(fs.realpathSync(parent)!==parent)throw fail('单词本目录不能通过符号链接转向其他目录');
  fs.mkdirSync(directory,{recursive:true});
  if(fs.realpathSync(directory)!==directory)throw fail('发布目录不能是符号链接');
  const lock=path.join(directory,'.publish.lock');let handle;
  try{handle=fs.openSync(lock,'wx');}catch(e){if(e.code==='EEXIST')throw fail('另一个发布正在进行，请稍后重试',409);throw e;}
  let staging;
  try{
   const result=validate(candidate);if(result.fingerprint!==fingerprint)throw fail('校验后内容已改变，请重新校验和确认',409);
   const destination=path.join(directory,hash(candidate.index.books[0].bookId));if(fs.existsSync(destination)){
    if(publication&&fs.existsSync(path.join(destination,'publication.json'))){const prior=JSON.parse(fs.readFileSync(path.join(destination,'publication.json'),'utf8'));if(prior.importId===publication.importId&&prior.packageFingerprint===publication.packageFingerprint)return {...result,published:true,href:'wordbook-details.html?book='+encodeURIComponent(result.bookId)};}
    throw fail('单词本编号已存在；不会覆盖旧课程，请核查是否已发布',409);
   }
   staging=fs.mkdtempSync(path.join(directory,'.pending-'));fs.mkdirSync(path.join(staging,'items'));
   fs.writeFileSync(path.join(staging,'manifest.json'),JSON.stringify(candidate.index),{flag:'wx'});
   fs.writeFileSync(path.join(staging,'practices.json'),JSON.stringify(require('./vocabulary-practice-summary').build(candidate.index.books[0],candidate.items)),{flag:'wx'});
   if(candidate.teachingRelease)fs.writeFileSync(path.join(staging,'teaching.json'),JSON.stringify(candidate.teachingRelease),{flag:'wx'});
   if(candidate.materialRelease)fs.writeFileSync(path.join(staging,'materials.json'),JSON.stringify({bookRevision:candidate.index.books[0].revision,releaseRevision:hash(candidate.materialRelease),release:candidate.materialRelease}),{flag:'wx'});
   if(publication)fs.writeFileSync(path.join(staging,'publication.json'),JSON.stringify(publication),{flag:'wx'});
   for(const item of candidate.items)fs.writeFileSync(path.join(staging,'items',item.itemId.replace(/:/g,'_')+'.json'),JSON.stringify(item),{flag:'wx'});
   // Flush the complete staged package before exposing its directory atomically.
   for(const file of [path.join(staging,'manifest.json'),path.join(staging,'practices.json'),...(candidate.teachingRelease?[path.join(staging,'teaching.json')]:[]),...(candidate.materialRelease?[path.join(staging,'materials.json')]:[]),...(publication?[path.join(staging,'publication.json')]:[]),...candidate.items.map(item=>path.join(staging,'items',item.itemId.replace(/:/g,'_')+'.json'))]){const fd=fs.openSync(file,'r+');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
   fs.renameSync(staging,destination);staging=null;content.invalidate();
   return {...result,published:true,href:'wordbook-details.html?book='+encodeURIComponent(result.bookId)};
  }finally{
   if(staging){const resolved=path.resolve(staging);if(path.dirname(resolved)!==directory||!path.basename(resolved).startsWith('.pending-'))throw Error('暂存清理目标不安全');fs.rmSync(resolved,{recursive:true,force:true});}
   fs.closeSync(handle);fs.unlinkSync(lock);
  }
 }
 function publishRevision(candidate,fingerprint,expectedBaseReleaseId,publication){
  if(!versions)throw fail('教材版本服务尚未就绪',503);
  const committed=versions.findActivatedImport?.(candidate.index.books[0].bookId,publication?.importId,publication?.packageFingerprint);
  if(committed)return {bookId:committed.book.bookId,title:committed.book.title,itemCount:committed.book.itemCount,unitCount:committed.book.units?.length||0,fingerprint:null,published:true,releaseId:committed.releaseId,previousReleaseId:committed.activation?.baseReleaseId||null,href:'wordbook-details.html?book='+encodeURIComponent(committed.book.bookId)};
  const result=validate(candidate,{updateBaseReleaseId:expectedBaseReleaseId});
  if(result.fingerprint!==fingerprint)throw fail('校验后内容已改变，请重新校验和确认',409);
  const receipt={...publication};
  const installed=versions.install(candidate,receipt);
  const active=versions.activate({bookId:result.bookId,expectedBaseReleaseId,releaseId:installed.releaseId,action:'update',reviewId:publication?.review?.reviewId||null});
  content.invalidate();
  return {...result,published:true,releaseId:active.releaseId,previousReleaseId:expectedBaseReleaseId,href:'wordbook-details.html?book='+encodeURIComponent(result.bookId)};
 }
 function publishedBooks(){
  const books=versions?versions.publishedBooks().map(row=>({book:row.book,releaseId:row.releaseId})):content.index().books.map(book=>({book,releaseId:book.revision}));
  return books.map(({book,releaseId})=>({bookId:book.bookId,title:book.title,itemCount:book.itemCount,releaseId,revision:book.revision}));
 }
 function releaseHistory(bookId){if(!versions)throw fail('教材版本服务尚未就绪',503);return versions.history(bookId).map(({releaseId,book,legacy,activeReleaseId})=>({releaseId,bookRevision:book.revision,title:book.title,itemCount:book.itemCount,legacy,active:releaseId===activeReleaseId}));}
 function releaseCandidate(bookId,releaseId){if(!versions)throw fail('教材版本服务尚未就绪',503);return versions.history(bookId).find(row=>row.releaseId===releaseId)||null;}
 function rollback({bookId,expectedBaseReleaseId,releaseId,reviewId,adminId}){
  if(!versions)throw fail('教材版本服务尚未就绪',503);
  const result=versions.activate({bookId,expectedBaseReleaseId,releaseId,action:'rollback',reviewId,adminId});content.invalidate();return {bookId,releaseId:result.releaseId,previousReleaseId:expectedBaseReleaseId,rolledBack:true};
 }
 function findImport(importId,packageFingerprint){
  if(!fs.existsSync(directory))return null;
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
   if(!entry.isDirectory()||! /^[a-f0-9]{64}$/.test(entry.name))continue;
   const folder=path.join(directory,entry.name),receiptFile=path.join(folder,'publication.json');if(!fs.existsSync(receiptFile))continue;
   const receipt=JSON.parse(fs.readFileSync(receiptFile,'utf8'));if(receipt.importId!==importId||receipt.packageFingerprint!==packageFingerprint)continue;
   const index=model.validateIndex(JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'))),book=index.books[0];
   return {bookId:book.bookId,title:book.title,itemCount:book.itemCount,unitCount:book.units?.length||0,fingerprint:null,ready:true,published:true,href:'wordbook-details.html?book='+encodeURIComponent(book.bookId)};
  }
  return null;
 }
 return {validate,publish,publishRevision,findImport,publishedBooks,releaseHistory,releaseCandidate,rollback,currentRelease:bookId=>versions?.current(bookId)||null};
}
module.exports={createWordbookPublisher};
