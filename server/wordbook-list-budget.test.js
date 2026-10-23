'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const draft=require('../js/wordbook-draft');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'wordbook-list-budget-'));
 try{
  const bookId='list-budget-fixture',publishedRoot=path.join(root,'published'),dir=path.join(publishedRoot,hash(bookId));fs.mkdirSync(path.join(dir,'items'),{recursive:true});
  const candidate=await draft.compile({schemaVersion:1,book:{bookId,title:'隔离性能夹具',units:[{unitId:'u1',title:'Unit 1'}]},items:Array.from({length:120},(_,i)=>({itemId:'list:item:'+i,unitId:'u1',word:'borrow',meaning:'借入',scene:'借物品',translation:'请借给我一本书。',exercise:draft.exercise('Please [borrow] a book.'),images:{wide:['assets/test.webp'],mobile:['assets/test.webp']}}))});
  fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(candidate.index));for(const item of candidate.items)fs.writeFileSync(path.join(dir,'items',item.itemId.replace(/:/g,'_')+'.json'),JSON.stringify(item));
  const versions=require('./services/public-wordbook-versions').createPublicWordbookVersions({publishedRoot}),legacy=versions.current(bookId),changed=structuredClone(candidate);changed.index.books[0].title='隔离性能夹具修正版';const installed=versions.install(changed,{importId:'isolated'});
  versions.activate({bookId,expectedBaseReleaseId:legacy.releaseId,releaseId:installed.releaseId});
  const publisher=require('./services/wordbook-publisher').createWordbookPublisher({appRoot:root,content:{publicationDirectory:publishedRoot,index:()=>({schemaVersion:1,books:[]})},versions});
  const imports=path.join(root,'imports'),id=crypto.randomUUID();fs.mkdirSync(path.join(imports,id),{recursive:true});fs.writeFileSync(path.join(imports,id,'package.json'),JSON.stringify(candidate));fs.writeFileSync(path.join(imports,id,'state.json'),JSON.stringify({importId:id,createdAt:'2026-10-22',status:'validated',revision:'isolated'}));
  const service=require('./services/admin-wordbook-imports').createAdminWordbookImports({appRoot:root,dataDirectory:imports,publisher});
  const original=fs.readFileSync;let itemReads=0,packageReads=0;
  try{
   fs.readFileSync=function(file,...args){if(String(file).startsWith(publishedRoot)){if(String(file).includes(path.sep+'items'+path.sep))itemReads++;if(path.basename(String(file))==='package.json')packageReads++;}return original.call(this,file,...args);};
   const started=performance.now(),rows=publisher.publishedBooks(),drafts=service.list();console.log(JSON.stringify({milliseconds:Math.round(performance.now()-started),itemReads,packageReads}));
   assert.equal(rows[0].releaseId,installed.releaseId);assert.equal(drafts[0].superseded,true);
   assert.equal(itemReads,0,'list summaries must not open teaching item files');assert.equal(packageReads,0,'list summaries must not read historical course packages');
   const overview=service.overview();assert.equal(overview.courses[0].releaseId,installed.releaseId);assert.equal(overview.drafts[0].superseded,true);assert.equal(overview.drafts[0].review,undefined);assert.equal(overview.drafts[0].changedItems,undefined);
  }finally{fs.readFileSync=original;}
  assert.equal(versions.current(bookId).releaseId,installed.releaseId,'strict release loading remains available');
  versions.activate({bookId,expectedBaseReleaseId:installed.releaseId,releaseId:legacy.releaseId,action:'rollback'});
  assert.equal(publisher.publishedBooks()[0].releaseId,legacy.releaseId,'rollback invalidates list selection immediately without a stale TTL');
  versions.activate({bookId,expectedBaseReleaseId:legacy.releaseId,releaseId:installed.releaseId,action:'rollback'});
  fs.writeFileSync(path.join(dir,'releases',installed.releaseId,'items',candidate.items[0].itemId.replace(/:/g,'_')+'.json'),'{}');
  assert.throws(()=>versions.current(bookId),/不一致|摘要校验/,'strict loading must still reject corrupted items');
  console.log('Admin course lists read metadata only; strict release validation is preserved.');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
