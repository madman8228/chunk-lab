'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const model=require('./lib/vocabulary-illustrations.cjs');
const {createReuseReviewServer}=require('./lib/vocabulary-reuse-review.cjs');
const {createVocabularyImageDelivery}=require('../server/middleware/vocabulary-image-delivery');

function setup(t,{crossPolicy=false}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'vocabulary-reuse-review-'));
 t.after(()=>{if(path.dirname(root)!==fs.realpathSync(os.tmpdir()))throw Error('Unsafe test cleanup');fs.rmSync(root,{recursive:true,force:true});});
 const assets=path.join(root,'assets');fs.mkdirSync(assets);
 const sourceRoot=path.resolve(__dirname,'../assets');
 fs.copyFileSync(path.join(sourceRoot,'vocab-u1-after-wide-v1.webp'),path.join(assets,'first.webp'));
 fs.copyFileSync(path.join(sourceRoot,'vocab-u1-after-wide-v2.webp'),path.join(assets,'second.webp'));
 const courses=['course-one','course-two'];
 for(let i=0;i<courses.length;i++){
  const folder=path.join(root,'output/textbook-extractions',courses[i],'unit1-images');fs.mkdirSync(folder,{recursive:true});
  const file='assets/'+(i?'second':'first')+'.webp',bytes=fs.readFileSync(path.join(root,file));
  fs.writeFileSync(path.join(folder,'batch-01-atlas.report.json'),JSON.stringify({styleReference:'approved-style',cells:[{itemId:'apple-1',word:'apple',meaning:'苹果',files:[{path:file,bytes:bytes.length,sha256:model.hash(bytes)}]}]}));
 }
 const review={entries:courses.map((course,i)=>{const file='assets/'+(i?'second':'first')+'.webp',bytes=fs.readFileSync(path.join(root,file));return{bookId:course,unitId:'unit1-images',itemId:'apple-1',image:'/'+file,sha256:model.hash(bytes),status:'pass'};})};
 const catalog=model.buildCatalog(root,{courses,reviews:[review]});
 if(crossPolicy){catalog.bindings[0].stage='primary';catalog.bindings[1].styleReference='other-approved-style';}
 const catalogPath=path.join(root,'catalog.json');fs.writeFileSync(catalogPath,JSON.stringify(catalog));
 const statePath=path.join(root,'decisions.json');
 return{root,catalog,catalogPath,statePath,server:createReuseReviewServer({root,catalogPath,statePath,pagePath:path.resolve(__dirname,'vocabulary-reuse-review.html')})};
}
async function listen(t,server){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));return'http://127.0.0.1:'+server.address().port;}

test('lists exact-sense different-hash groups without writing state',async t=>{
 const f=setup(t),base=await listen(t,f.server),response=await fetch(base+'/api/groups'),payload=await response.json();
 assert.equal(response.status,200);assert.equal(payload.groups.length,1);assert.equal(payload.groups[0].status,'pending');assert.equal(payload.groups[0].assetCount,2);assert.equal(fs.existsSync(f.statePath),false);
 const page=await fetch(base+'/').then(x=>x.text());for(const id of ['search','scope','next-pending'])assert.match(page,new RegExp('id="'+id+'"'));assert.doesNotMatch(page,/scene-reviewed|我已检查候选图片/);assert.match(page,/choose\.onclick=\(\)=>save\('reuse',candidate\.assetId\)/);assert.match(page,/sceneReviewed:decision==='reuse'/);assert.match(page,/pending=summaries\.filter\(row=>row\.status==='pending'/);assert.match(page,/await loadGroup\(pending\[0\]\.groupId\)/);
 const group=await fetch(base+'/api/group?id='+payload.groups[0].groupId).then(r=>r.json());assert.equal(group.entries.length,2);assert.equal(group.candidates.length,2);
 assert.equal((await fetch(base+'/'+group.candidates[0].path)).status,200);assert.equal((await fetch(base+'/assets/not-in-catalog.webp')).status,404);
});

test('groups cross-stage and cross-style matches for manual review',async t=>{
 const f=setup(t,{crossPolicy:true}),baseGroup=require('./lib/vocabulary-reuse-review.cjs').makeGroups(f.catalog)[0],changed=structuredClone(f.catalog);changed.bindings[0].styleReference='later-approved-style';
 assert.notEqual(require('./lib/vocabulary-reuse-review.cjs').makeGroups(changed)[0].fingerprint,baseGroup.fingerprint,'a changed style invalidates prior target-scene review');
 const server=f.server,base=await listen(t,server),payload=await fetch(base+'/api/groups').then(r=>r.json());
 assert.equal(payload.groups.length,1);assert.equal(payload.groups[0].crossStage,true);assert.equal(payload.groups[0].crossStyle,true);
 assert.deepEqual(payload.groups[0].stages,['junior','primary']);assert.equal(payload.groups[0].styleReferences.length,2);
});

test('resolved shared aliases safely override only their original publication receipts',t=>{
 const f=setup(t,{crossPolicy:true}),group=require('./lib/vocabulary-reuse-review.cjs').makeGroups(f.catalog)[0],catalogSha256=model.hash(fs.readFileSync(f.catalogPath));
 const state={format:'vocabulary-reuse-review-decisions',schemaVersion:1,revision:1,events:[{revision:1,catalogSha256,groupId:group.groupId,groupFingerprint:group.fingerprint,word:group.word,meaning:group.meaning,stages:group.stages,styleReferences:group.styleReferences,entries:group.entries.map(({sourceKey,assetId,path})=>({sourceKey,assetId,path})),decision:'reuse',assetId:group.candidates[0].assetId,sceneReviewed:true}]};
 const resolved=model.applyReviewedReuse(f.root,{catalog:f.catalog,catalogSha256,state}).catalog,publishedRoot=path.join(f.root,'published');
 for(const binding of f.catalog.bindings){const folder=path.join(publishedRoot,binding.assetId.slice(7));fs.mkdirSync(folder,{recursive:true});const asset=f.catalog.assets.find(row=>row.assetId===binding.assetId);fs.writeFileSync(path.join(folder,'publication.json'),JSON.stringify({assets:[{kind:'illustration',url:binding.path,sha256:binding.assetId.slice(7),bytes:asset.bytes}]}));}
 const delivery=createVocabularyImageDelivery({root:f.root,catalog:resolved,publishedRoot});for(const binding of resolved.bindings)assert.equal(delivery.resolveImage(binding.path),`/_vocab-images/${group.candidates[0].assetId.slice(7)}.webp`);
 const unsigned=structuredClone(resolved);delete unsigned.reuseResolution;const unsafe=createVocabularyImageDelivery({root:f.root,catalog:unsigned,publishedRoot});assert.throws(()=>unsafe.resolveImage(resolved.bindings[0].path),/conflicts with an existing catalog/);
});

test('refuses to resolve a group if any reviewed source image changed after approval',t=>{
 const f=setup(t),review=require('./lib/vocabulary-reuse-review.cjs'),group=review.makeGroups(f.catalog)[0],catalogSha256=model.hash(fs.readFileSync(f.catalogPath)),candidate=group.candidates[0],changed=group.candidates.find(row=>row.assetId!==candidate.assetId);
 const state={format:'vocabulary-reuse-review-decisions',schemaVersion:1,revision:1,events:[{revision:1,catalogSha256,groupId:group.groupId,groupFingerprint:group.fingerprint,decision:'reuse',assetId:candidate.assetId,sceneReviewed:true}]};
 const changedAsset=f.catalog.assets.find(row=>row.assetId===changed.assetId);fs.writeFileSync(path.join(f.root,changedAsset.path),Buffer.alloc(16));
 assert.throws(()=>model.applyReviewedReuse(f.root,{catalog:f.catalog,catalogSha256,state}),/Source illustration hash changed after review/);
});

test('treats the explicit reuse action as target-scene approval and saves a hash-bound decision',async t=>{
 const f=setup(t),base=await listen(t,f.server),summary=await fetch(base+'/api/groups').then(r=>r.json()),group=await fetch(base+'/api/group?id='+summary.groups[0].groupId).then(r=>r.json());
 const payload={groupId:group.groupId,decision:'reuse',assetId:group.candidates[0].assetId,baseRevision:0,note:'Same sense; checked all target courses'};
 payload.sceneReviewed=true;
 const saved=await fetch(base+'/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});assert.equal(saved.status,200);assert.equal((await saved.json()).status,'reuse');
 assert.equal(fs.existsSync(f.statePath),true);assert.equal(JSON.stringify(f.catalog),fs.readFileSync(f.catalogPath,'utf8'));
 assert.equal(JSON.parse(fs.readFileSync(f.statePath,'utf8')).events[0].sceneReviewed,true);
 const stale=await fetch(base+'/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});assert.equal(stale.status,409);
 const refreshed=await fetch(base+'/api/group?id='+group.groupId).then(r=>r.json());assert.equal(refreshed.status,'reuse');assert.equal(refreshed.assetId,payload.assetId);
 const result=model.applyReviewedReuse(f.root,{catalog:f.catalog,catalogSha256:model.hash(fs.readFileSync(f.catalogPath)),state:JSON.parse(fs.readFileSync(f.statePath,'utf8'))});
 assert.equal(result.summary.appliedGroups,1);assert.equal(result.summary.assetsBefore,2);assert.equal(result.summary.assetsAfter,1);
 assert.equal(new Set(result.catalog.bindings.map(binding=>binding.assetId)).size,1);assert.equal(new Set(result.catalog.bindings.map(binding=>binding.path)).size,2);
 assert.equal(result.catalog.aliases[result.catalog.bindings[0].path],payload.assetId);assert.equal(fs.existsSync(path.join(f.root,'assets/first.webp')),true);assert.equal(fs.existsSync(path.join(f.root,'assets/second.webp')),true);
 assert.equal(model.validateCatalog(result.catalog),result.catalog);
});

test('rejects a selected image outside the hash-bound candidate set',async t=>{
 const f=setup(t),base=await listen(t,f.server),summary=await fetch(base+'/api/groups').then(r=>r.json()),groupId=summary.groups[0].groupId;
 const response=await fetch(base+'/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({groupId,decision:'reuse',assetId:'sha256:'+'0'.repeat(64),baseRevision:0})});
 assert.equal(response.status,400);assert.equal(fs.existsSync(f.statePath),false);
});
