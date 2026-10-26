'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const library=require('./lib/vocabulary-illustrations.cjs');
const id='sha256:'+'a'.repeat(64);
const catalog={format:'vocabulary-illustration-catalog',schemaVersion:1,assets:[{assetId:id,path:'assets/test.webp',sha256:'a'.repeat(64),bytes:100,width:512,height:288,objectKey:'vocabulary/'+ 'a'.repeat(64)+'.webp'}],aliases:{'assets/test.webp':id},bindings:[{word:'I',meaning:'我',stage:'primary',styleReference:'campus',assetId:id,path:'assets/test.webp',review:'pass'}]};
const manifest={batchId:'core',styleReference:'office',cells:[{itemId:'core:i',word:'I',meaning:'我'}]};
const review={assetId:id,decision:'unsuitable-for-target',sceneReviewed:true,reason:'The approved child character does not match the fixed adult speaker required by this target.'};
test('target-specific review allows a different character family without changing original approval',()=>{
 assert.equal(library.plan(catalog,manifest,{stage:'adult'}).items[0].action,'review-existing-candidates');
 const reviewed=structuredClone(manifest);reviewed.cells[0].candidateReviews=[review];
 assert.equal(library.plan(catalog,reviewed,{stage:'adult'}).items[0].action,'generate');
 assert.equal(catalog.bindings[0].review,'pass');
 assert.equal(library.plan(catalog,reviewed,{stage:'primary',styleReference:'campus'}).items[0].action,'select-approved-image','an exact approved candidate still blocks generation');
});
test('unreviewed or changed candidate identities cannot be bypassed',()=>{
 for(const patch of [{assetId:'sha256:'+'b'.repeat(64)},{sceneReviewed:false},{reason:''}]){
  const changed=structuredClone(manifest);changed.cells[0].candidateReviews=[{...review,...patch}];
  assert.throws(()=>library.plan(catalog,changed,{stage:'adult'}),/hash-bound/);
 }
 const added=structuredClone(catalog);const nextId='sha256:'+'b'.repeat(64);
 added.assets.push({...added.assets[0],assetId:nextId,sha256:'b'.repeat(64),path:'assets/second.webp',objectKey:'vocabulary/'+'b'.repeat(64)+'.webp'});added.aliases['assets/second.webp']=nextId;added.bindings.push({...added.bindings[0],assetId:nextId,path:'assets/second.webp'});
 const reviewed=structuredClone(manifest);reviewed.cells[0].candidateReviews=[review];
 assert.equal(library.plan(added,reviewed,{stage:'adult'}).items[0].action,'review-existing-candidates');
});
