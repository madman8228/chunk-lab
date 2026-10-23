'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'wordbook-review-budget-'));
 try{
  fs.mkdirSync(path.join(root,'content/vocabulary'),{recursive:true});fs.mkdirSync(path.join(root,'assets'));fs.writeFileSync(path.join(root,'content/vocabulary/index.json'),JSON.stringify({schemaVersion:1,books:[]}));
  const image=fs.readFileSync(path.resolve(__dirname,'../assets/vocab-g7-lower-u1-blind-wide-v1.webp')),audio=Buffer.from('OggS isolated OpusHead fixture'),imageFile=path.join(root,'assets/test.webp'),audioFile=path.join(root,'assets/test.ogg');fs.writeFileSync(imageFile,image);fs.writeFileSync(audioFile,audio);
  const sound={url:'assets/test.ogg',mimeType:'audio/ogg',sha256:digest(audio),bytes:audio.length},draft=require('../js/wordbook-draft');
  const source={schemaVersion:1,book:{bookId:'review-budget',title:'隔离审阅夹具',units:[{unitId:'u1',title:'Unit 1'}]},items:[{itemId:'review-budget:borrow',unitId:'u1',word:'borrow',meaning:'借入',scene:'借书',translation:'我可以借一本书吗？',exercise:draft.exercise('Can I [borrow] a book?'),images:{wide:['assets/test.webp'],mobile:['assets/test.webp']},dictation:{audio:sound,answers:['borrow']},sentenceAudio:{text:'Can I borrow a book?',audio:sound}}]};
  const content=require('./services/vocabulary-content').createVocabularyContent({appRoot:root}),publisher=require('./services/wordbook-publisher').createWordbookPublisher({appRoot:root,content}),service=require('./services/admin-wordbook-imports').createAdminWordbookImports({appRoot:root,dataDirectory:path.join(root,'imports'),publisher});
  const created=await service.importSource(source),checked=service.validate(created.importId,created.revision),stateFile=path.join(root,'imports',created.importId,'state.json'),originalState=fs.readFileSync(stateFile),candidate=JSON.parse(fs.readFileSync(path.join(root,'imports',created.importId,'package.json')));
  const reads=new Map();require('./services/vocabulary-publication-assets').validatePackage(candidate,{appRoot:root,readPrivate:url=>{reads.set(url,(reads.get(url)||0)+1);return fs.readFileSync(path.join(root,url));}});assert.ok([...reads.values()].every(count=>count===1),'each media file is read only once inside one validation, even across audio activities');
  const originalRead=fs.readFileSync;let mediaReads=0;
  try{
   fs.readFileSync=function(file,...args){if(file===imageFile||file===audioFile)mediaReads++;return originalRead.call(this,file,...args);};
   const detail=service.detail(created.importId);assert.equal(detail.validation.fingerprint,checked.fingerprint);service.detail(created.importId);assert.equal(mediaReads,0,'unchanged review reuses verified assets after checking file identities');
   service.validate(created.importId,checked.revision);assert.ok(mediaReads>0,'explicit validation must bypass the preview cache');
  }finally{fs.readFileSync=originalRead;}
  // An ordinary review read does not update the user's review status or approval.
  const afterValidate=fs.readFileSync(stateFile);service.detail(created.importId);assert.deepEqual(fs.readFileSync(stateFile),afterValidate);assert.equal(JSON.parse(originalState).review,null);
  const altered=Buffer.from(image);altered[altered.length-1]^=1;fs.writeFileSync(imageFile,altered);assert.equal(service.detail(created.importId).validation,null,'same-size asset changes invalidate the verified preview');
  const review=service.review(created.importId,{approved:true,revision:checked.revision,fingerprint:checked.fingerprint},{id:'isolated-admin'});
  assert.throws(()=>service.publish(created.importId,{confirmed:true,rightsConfirmed:true,revision:checked.revision,fingerprint:checked.fingerprint,reviewId:review.reviewId}),/素材已变化/,'publication must freshly reject tampered assets even after a cached preview');
  fs.writeFileSync(imageFile,image);assert.ok(service.detail(created.importId).validation);
  fs.unlinkSync(audioFile);const missing=service.detail(created.importId);assert.equal(missing.validation,null);assert.ok(missing.assets.some(asset=>asset.url==='assets/test.ogg'&&asset.missing));
  fs.writeFileSync(audioFile,audio);assert.ok(service.detail(created.importId).validation,'restored original bytes are reverified, not permanently blocked by the cache');
  let validations=0;const validate=publisher.validate;publisher.validate=function(...args){validations++;return validate(...args);};
  mediaReads=0;const start=performance.now();
  try{fs.readFileSync=function(file,...args){if(file===imageFile||file===audioFile)mediaReads++;return originalRead.call(this,file,...args);};service.publish(created.importId,{confirmed:true,rightsConfirmed:true,revision:checked.revision,fingerprint:checked.fingerprint,reviewId:review.reviewId});}finally{fs.readFileSync=originalRead;}
  console.log(JSON.stringify({publishMs:performance.now()-start,precommitValidations:validations,mediaReads}));
  assert.equal(validations,1,'publication has one precommit validation, followed by the independent locked publisher validation');
  assert.ok(mediaReads<=8,'shared word/sentence audio and image alias checks do not multiply precommit disk reads');
  console.log('Review preview: single-read media, version-bound cache, same-size tamper invalidation, missing/restored files, no review writes, and strict publication checks passed.');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
