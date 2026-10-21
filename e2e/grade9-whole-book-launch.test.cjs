'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),base=path.join(root,'output/textbook-extractions/people-grade9-full-2013-20261015/whole-book-launch-v1');
(async()=>{
 const source=JSON.parse(fs.readFileSync(path.join(base,'textbook-ready-v1.json'),'utf8'));
 const draft=require('../server/services/textbook-wordbook-package').assemble(source),instance=await require('../scripts/serve-wordbook-acceptance.cjs').createAcceptance(0);
 try{
  assert.notEqual(path.resolve(instance.dataDir),path.join(root,'server/data'));
  const urls=new Set(draft.items.flatMap(i=>[...i.images.wide,...i.images.mobile]));if(draft.book.catalog?.coverUrl)urls.add(draft.book.catalog.coverUrl);
  for(const url of urls){
   const from=path.join(root,url),to=path.join(instance.appRoot,url);fs.mkdirSync(path.dirname(to),{recursive:true});
   if(fs.existsSync(to))assert.deepEqual(fs.readFileSync(to),fs.readFileSync(from));else fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);
  }
  const request=(route,body)=>instance.request('/api/admin/system-wordbooks'+route,instance.adminToken,body);
  const imported=await request('',source),valid=await request('/'+imported.importId+'/validate',{revision:imported.revision});
  const review=await request('/'+imported.importId+'/review',{revision:valid.revision,fingerprint:valid.fingerprint,approved:true,note:'ISOLATED TEST COPY ONLY'});
  const result=await request('/'+imported.importId+'/publish',{revision:valid.revision,fingerprint:valid.fingerprint,reviewId:review.reviewId,confirmed:true,rightsConfirmed:true});
  assert.equal(result.published,true);assert.equal(result.itemCount,628);
  const route='/api/wordbooks/'+encodeURIComponent(source.book.bookId),details=await instance.request(route+'/details');assert.equal(details.units.length,14);
  let checked=0;
  for(const unit of source.units){
   const page=await instance.request(route+'/units/'+encodeURIComponent(unit.unitId)+'/items?limit=20');
   assert.ok(page.items.length);assert.equal(page.items[0].itemId,unit.itemIds[0]);
   for(const id of unit.itemIds){const item=await instance.request('/api/vocabulary-items/'+encodeURIComponent(id));assert.equal(item.itemId,id);checked++;}
  }
  await instance.restartBackend();const after=await instance.request(route+'/details');assert.equal(after.units.length,14);
  const report={isolated:true,liveChanged:false,publishedTestCopy:true,units:14,itemsChecked:checked,images:urls.size,packageSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(base,'textbook-ready-v1.json'))).digest('hex'),restartPersistence:'pass'};
  fs.writeFileSync(path.join(base,'isolated-publication-test-v1.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));
 }finally{await instance.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
