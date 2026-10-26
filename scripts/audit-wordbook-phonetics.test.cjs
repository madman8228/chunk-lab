'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {prepare}=require('./audit-wordbook-phonetics.cjs'),draftModel=require('../js/wordbook-draft');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
(async()=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'wordbook-phonetics-'));
 try{
  const sourceRoot=path.join(temporary,'sources'),publishedRoot=path.join(temporary,'published'),output=path.join(temporary,'repair');
  const bookId='textbook-wordbook:fixture',folder=path.join(publishedRoot,hash(JSON.stringify(bookId)));
  fs.mkdirSync(path.join(sourceRoot,'fixture'),{recursive:true});fs.mkdirSync(path.join(folder,'items'),{recursive:true});
  const records=[{entryId:'u1:001',unitId:'u1',term:'name',meaning:'名字',phonetic:'/neɪm/',phoneticScope:'term'},{entryId:'u1:002',unitId:'u1',term:'red panda',meaning:'小熊猫',phonetic:'/red/',phoneticScope:'red-only'}];
  const source=Buffer.from(JSON.stringify({records}));fs.writeFileSync(path.join(sourceRoot,'fixture','extracted-vocabulary.json'),source);
  const draft={schemaVersion:1,book:{bookId,title:'音标修复夹具',units:[{unitId:'u1',title:'Unit 1'}]},items:records.map(record=>({itemId:'textbook-item:fixture:'+record.entryId,unitId:'u1',word:record.term,meaning:record.meaning,scene:'测试',translation:'测试',exercise:draftModel.exercise('My ['+record.term+'].'),images:{wide:[],mobile:[]}}))};
  const candidate=await draftModel.compile(draft,{requireImages:false});
  fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(candidate.index));
  fs.writeFileSync(path.join(folder,'publication.json'),JSON.stringify({productionReview:{sourceSha256:hash(source)}}));
  for(const item of candidate.items)fs.writeFileSync(path.join(folder,'items',item.itemId.replace(/:/g,'_')+'.json'),JSON.stringify(item));
  const before=JSON.stringify(candidate),report=prepare({publishedRoot,sourceRoot,output,appRoot:temporary});
  assert.equal(report.totals.recoverable,1);assert.equal(report.totals.unresolved,1);
  assert.equal(report.books[0].unresolved[0].reason,'partial-phonetic-scope');
  const repaired=JSON.parse(fs.readFileSync(path.join(output,path.basename(folder),'candidate.json')));
  assert.equal(repaired.items[0].phonetic,'/neɪm/');assert.equal(repaired.items[1].phonetic,undefined);
  const {contentRevision,...body}=repaired.items[0];assert.equal(contentRevision,hash(JSON.stringify(body)));
  assert.notEqual(repaired.index.books[0].revision,candidate.index.books[0].revision);
  assert.equal(repaired.index.books[0].structureRevision,candidate.index.books[0].structureRevision);
  assert.equal(JSON.stringify(candidate),before);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(folder,'items',candidate.items[0].itemId.replace(/:/g,'_')+'.json'))),candidate.items[0]);
  assert.throws(()=>prepare({publishedRoot,sourceRoot,output,appRoot:temporary}),/新的/);
  console.log('Phonetics repair: hash-bound identity, partial-scope exclusion, immutable originals and revisioned candidates passed.');
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
