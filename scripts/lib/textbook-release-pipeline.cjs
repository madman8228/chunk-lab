'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {prepare,bookIdentity}=require('../prepare-production-import-package.cjs');
const {qualifyPackage,readImportPackage,stagePackage}=require('./system-wordbook-package.cjs');
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function bindingsFor(bookId){
 const primary=require('../primary-import-target-bindings.json');
 const junior=require('../grade8-import-target-bindings.json');
 return primary[bookId]||junior.find(row=>row.bookId===bookId)?.forms||{};
}
function importService(config){
 const publishedRoot=path.join(config.dataRoot,'wordbook-publications');
 const versions=require('../../server/services/public-wordbook-versions').createPublicWordbookVersions({publishedRoot});
 const content=require('../../server/services/vocabulary-content').createVocabularyContent({appRoot:config.appRoot,publishedRoot,versions});
 const images=require('../../server/middleware/vocabulary-image-delivery').configuredVocabularyImageDelivery(config.appRoot,process.env,{publishedRoot});
 const publisher=require('../../server/services/wordbook-publisher').createWordbookPublisher({appRoot:config.appRoot,content,versions,checkImageAliases:images.checkAliases});
 return require('../../server/services/admin-wordbook-imports').createAdminWordbookImports({appRoot:config.appRoot,dataDirectory:path.join(config.dataRoot,'system-wordbook-imports'),publisher,checkAliases:images.checkAliases});
}
async function runRelease({config,snapshot,bookIds,action,onProgress=()=>{},service}){
 if(!['prepare','stage'].includes(action))throw Error('制作操作无效');
 const results=[];
 for(const bookId of bookIds){
  try{
   const book=snapshot.books.find(b=>b.id===bookId);if(!book)throw Error('教材未进入生产目录');
   if(snapshot.publications.some(b=>b.bookId===bookId)){results.push({bookId,status:'published',message:'已有上架版本，请通过课程修订流程更新'});onProgress(results);continue;}
   const queue=JSON.parse(fs.readFileSync(book.queuePath,'utf8')),identity=bookIdentity(queue.book,bookId),forms=bindingsFor(bookId);
   const fingerprint=digest({version:1,source:book.sourceSha256,identity,forms,items:book.items.map(i=>[i.unitId,i.itemId,i.term,i.meaning,i.sentenceFingerprint,i.reviewStatus,i.imageHashes,i.wordAudio,i.sentenceAudio])});
   const key=bookId.replace(/^textbook-wordbook:/,'');if(!/^[a-z0-9-]+$/.test(key))throw Error('教材编号无效');
   const versions=path.join(config.packageRoot,key,'revisions'),prefix='production-'+fingerprint.slice(0,20),raw=path.join(versions,prefix+'-source'),qualified=path.join(versions,prefix+'-qualified');
   let prepared;
   if(fs.existsSync(path.join(raw,'manifest.json')))readImportPackage(raw);
   else if(fs.existsSync(path.join(raw,'preflight.json')))prepared=JSON.parse(fs.readFileSync(path.join(raw,'preflight.json'),'utf8'));
   else if(fs.existsSync(raw))throw Error('上次打包未完成，诊断目录已保留；需检查后使用新版本');
   else prepared=prepare(snapshot,bookId,raw,forms,config.appRoot,config.catalogFile);
   if(prepared?.status==='blocked'){results.push({...prepared,packageFingerprint:fingerprint});onProgress(results);continue;}
   onProgress(results,{bookId,step:'校验课程包'});
   if(fs.existsSync(qualified))readImportPackage(qualified);else qualifyPackage(raw,qualified);
   if(action==='prepare'){results.push({bookId,status:'prepared',directory:qualified,packageFingerprint:fingerprint});onProgress(results);continue;}
   onProgress(results,{bookId,step:'导入待审核'});
   const staged=await stagePackage({directory:qualified,bookId,service:service||(service=importService(config)),importsRoot:path.join(config.dataRoot,'system-wordbook-imports'),productionBook:book});
   results.push({...staged,status:'staged',directory:qualified,packageFingerprint:fingerprint});onProgress(results);
  }catch(error){results.push({bookId,status:'failed',message:error.message});onProgress(results);}
 }
 return results;
}
module.exports={runRelease,bindingsFor,importService};
