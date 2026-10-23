'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {loadCatalog}=require('./serve-textbook-sentence-review.cjs');
const {loadProduction,prepareAudioPlan}=require('./lib/textbook-production.cjs');
const {meaningKey}=require('./lib/textbook-production.cjs');
assert.equal(meaningKey('（1）颜色'),meaningKey('颜色'));
assert.notEqual(meaningKey('颜色'),meaningKey('（2）为……着色'));
const {qualifyPackage,readImportPackage,stagePackage}=require('./lib/system-wordbook-package.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'textbook-production-'));
function write(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof data==='object'&&!Buffer.isBuffer(data)?JSON.stringify(data):data);}
(async()=>{try{
 const app=path.join(temp,'app'),sources=path.join(temp,'sources'),packages=path.join(temp,'packages'),data=path.join(temp,'data');
 const sourceFile=path.join(temp,'vocabulary.json');write(sourceFile,{records:[{entryId:'unit-1:entry:001',term:'borrow'}]});const sourceHash=hash(fs.readFileSync(sourceFile));
 for(const name of ['alpha','beta']){
  const batch=path.join(sources,name,'audio-batches','20261021-audio-queue-v2'),bookId='textbook-wordbook:'+name;
  const base={bookId,unitId:'unit-1',itemId:'unit-1:entry:001',displayText:'borrow',meaning:'借入',unit:1,order:1,language:'en-US',voice:'af_heart',speed:1};
  write(path.join(batch,'audio-task-queue.json'),{format:'textbook-audio-task-queue',schemaVersion:1,publishable:false,book:{bookId,course:name,title:name},source:{path:sourceFile,sha256:sourceHash},tasks:[{...base,kind:'word',taskId:name+'::word',spokenText:'borrow',status:'ready',inputFingerprint:'a'.repeat(64)},{...base,kind:'sentence',taskId:name+'::sentence',spokenText:null,status:'pending-final-text',inputFingerprint:'b'.repeat(64)}],counts:{wordTasks:1,sentenceTasks:1}});
  write(path.join(sources,name,'audio-batches','drafts','unit-1-sentences.json'),{bookId,unitId:'unit-1',sourceVocabularySha256:sourceHash,reviewStatus:'pending-user-review',publishable:false,sentences:[{itemId:base.itemId,term:'borrow',english:'Can I borrow it?',chinese:'我能借用它吗？',status:'pending-review'}]});
 }
 const books=loadCatalog(sources),alpha=books.find(b=>b.id.endsWith(':alpha')),item=alpha.draftUnits[0].items[0],reviewFile=path.join(temp,'reviews.json');
 write(reviewFile,{format:'textbook-sentence-review-decisions',schemaVersion:1,revision:1,events:[{revision:1,bookId:alpha.id,unitId:'unit-1',itemId:item.itemId,sourceSha256:sourceHash,sentenceFingerprint:item.sentenceFingerprint,decision:'approved'}]});
 const catalogFile=path.join(temp,'catalog.json');write(catalogFile,{assets:[],bindings:[]});
 const config={appRoot:app,sourceRoot:sources,packageRoot:packages,dataRoot:data,catalogFile,reviewFile};
 let snapshot=loadProduction(config);assert.equal(snapshot.totals.approvedSentences,1);assert.equal(snapshot.totals.eligibleAudio,3);
 const plan=prepareAudioPlan(snapshot,path.join(temp,'plan'));assert.equal(plan.batches.length,3,'only approved sentences join word generation');
 const derived=JSON.parse(fs.readFileSync(path.join(plan.batches.find(b=>b.kind==='sentence').path,'audio-task-queue.json')));
 assert.equal(derived.approvals[0].reviewedItems[0].sentenceFingerprint,item.sentenceFingerprint);assert.equal(derived.tasks[0].spokenText,item.english);
 const betaDraft=path.join(sources,'alpha/audio-batches/drafts/unit-1-sentences.json'),changed=JSON.parse(fs.readFileSync(betaDraft));changed.sentences[0].english='Please borrow it.';write(betaDraft,changed);
 snapshot=loadProduction(config);assert.equal(snapshot.totals.approvedSentences,0,'editing a sentence invalidates only its matching review');assert.equal(snapshot.totals.eligibleAudio,2);
 const audio=Buffer.from('OggS fixture OpusHead'),sha=hash(audio),audioRoot=path.join(sources,'alpha/audio-batches/20261021-audio-queue-v2');write(path.join(audioRoot,'delivery',sha+'.ogg'),audio);
 write(path.join(audioRoot,'delivery-manifest.json'),{format:'textbook-audio-delivery',bookId:alpha.id,sourceSha256:sourceHash,records:[{unitId:'unit-1',itemId:item.itemId,kind:'word',spokenText:'borrow',deliveryPath:'delivery/'+sha+'.ogg',deliverySha256:sha,deliveryBytes:audio.length}]});
 snapshot=loadProduction(config);assert.equal(snapshot.totals.wordAudio,1,'the same local item id in another textbook cannot borrow this binding');
 write(path.join(audioRoot,'delivery',sha+'.ogg'),Buffer.from('corrupt'));snapshot=loadProduction(config);assert.equal(snapshot.totals.wordAudio,0);assert.equal(snapshot.errors.length,1);assert.throws(()=>prepareAudioPlan(snapshot,path.join(temp,'bad-plan')),/核验异常/);
 const image=fs.readFileSync(path.resolve(__dirname,'../assets/vocab-g7-lower-u1-blind-wide-v1.webp'));
 fs.mkdirSync(path.join(app,'content/vocabulary'),{recursive:true});fs.mkdirSync(path.join(app,'assets'),{recursive:true});write(path.join(app,'content/vocabulary/index.json'),{schemaVersion:1,books:[]});
 const draftModel=require('../js/wordbook-draft'),publishedRoot=path.join(data,'wordbook-publications'),importsRoot=path.join(data,'system-wordbook-imports');
 const versions=require('../server/services/public-wordbook-versions').createPublicWordbookVersions({publishedRoot}),content=require('../server/services/vocabulary-content').createVocabularyContent({appRoot:app,publishedRoot,versions});
 const publisher=require('../server/services/wordbook-publisher').createWordbookPublisher({appRoot:app,content,versions});
 const service=require('../server/services/admin-wordbook-imports').createAdminWordbookImports({appRoot:app,dataDirectory:importsRoot,publisher});
 const results=[];
 for(const name of ['alpha','beta']){
  const root=path.join(temp,'imports',name),book={bookId:'textbook-wordbook:'+name,title:name,catalog:{facets:{publisherId:'隔离出版社',seriesId:'隔离教材',edition:'2026',volume:'全一册',grades:['七年级'],schoolStages:['初中']}}};
  const source={format:'textbook-wordbook-package',schemaVersion:1,book,units:[{unitId:'unit-1',title:'Unit 1',itemIds:[item.itemId]}],drafts:[{schemaVersion:1,book:{...book,units:[{unitId:'unit-1',title:'Unit 1'}]},items:[{itemId:item.itemId,unitId:'unit-1',word:name,meaning:'隔离夹具',scene:'借用物品',translation:'借用物品',exercise:draftModel.exercise('Can I [borrow] it?'),images:{wide:['assets/same-name.webp'],mobile:['assets/same-name.webp']}}]}]};
  const payload=Buffer.from(JSON.stringify(source));write(path.join(root,'import-source.json'),payload);write(path.join(root,'assets/same-name.webp'),image);write(path.join(root,'manifest.json'),{format:'textbook-system-import-draft',schemaVersion:1,bookId:book.bookId,publishable:false,counts:{assets:1},files:[{path:'import-source.json',sha256:hash(payload),bytes:payload.length},{path:'assets/same-name.webp',sha256:hash(image),bytes:image.length}]});
  const output=path.join(temp,'qualified',name);qualifyPackage(root,output);const prepared=readImportPackage(output);
  assert.equal(prepared.draft.items[0].itemId,'textbook-item:'+name+':'+item.itemId);assert.equal(prepared.draft.items[0].images.wide[0],'assets/'+hash(image)+'.webp');
  const staged=await stagePackage({directory:output,bookId:book.bookId,service,importsRoot});assert.equal(staged.status,'validated');assert.equal(staged.published,false);assert.equal(content.index().books.length,0,'staging never publishes or enrolls');
  const evidenceFile=path.join(importsRoot,staged.importId,'production-review.json');
  write(evidenceFile,{format:'textbook-production-review-evidence',schemaVersion:1,packageFingerprint:staged.fingerprint,counts:{sentences:1},items:[{itemId:'private-detail'}]});
  assert.equal(service.detail(staged.importId).productionReview.counts.sentences,1);
  assert.equal(service.detail(staged.importId).productionReview.items,undefined,'the summary does not transfer every review item on each preview request');
  write(evidenceFile,{format:'textbook-production-review-evidence',schemaVersion:1,packageFingerprint:'f'.repeat(64),counts:{sentences:1}});
  assert.equal(service.detail(staged.importId).productionReview,null,'review evidence for another release fingerprint is not reused');
  const retry=await stagePackage({directory:output,bookId:book.bookId,service,importsRoot});assert.equal(retry.importId,staged.importId);assert.equal(retry.added,0,'retry reuses the same draft and its verified files');results.push(staged);
 }
 assert.notEqual(service.itemPage(results[0].importId,0,1).items[0].itemId,service.itemPage(results[1].importId,0,1).items[0].itemId);
 const archivedId=results[0].importId,originalState=fs.readFileSync(path.join(importsRoot,archivedId,'state.json'));
 let state=service.detail(archivedId);
 state=service.setArchived(archivedId,{archived:true,revision:state.revision,archiveRevision:state.archiveRevision},{id:'isolated-test'});
 assert.ok(state.archived);assert.equal(state.archiveRevision,1);
 assert.deepEqual(fs.readFileSync(path.join(importsRoot,archivedId,'state.json')),originalState,'archive preserves original draft bytes');
 assert.throws(()=>service.validate(archivedId),/已归档/);
 assert.throws(()=>service.setArchived(archivedId,{archived:false,revision:state.revision,archiveRevision:0},{id:'isolated-test'}),/状态已变化/);
 state=service.setArchived(archivedId,{archived:false,revision:state.revision,archiveRevision:1},{id:'isolated-test'});
 assert.equal(state.archived,null);assert.equal(state.archiveRevision,2);
 assert.equal(service.list().length,2);console.log('Textbook production: version-bound reviews, cross-book identity, missing audio planning, corrupt-file blocking, immutable qualified packages, resumable staging, recoverable archive and no publication passed.');
}finally{assert.equal(path.dirname(temp),os.tmpdir());assert.ok(path.basename(temp).startsWith('textbook-production-'));fs.rmSync(temp,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
