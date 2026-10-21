'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),input=path.join(root,'drafts/scene-wordbooks/borrow-things-v1/audio-a-v3/integrated-v4'),read=name=>JSON.parse(fs.readFileSync(path.join(input,name),'utf8')),model=require('../scripts/lib/vocabulary-materials.cjs');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'word-choice-content-'));let service;
(async()=>{try{
 const appRoot=path.join(temp,'app'),dataDir=path.join(temp,'data');fs.mkdirSync(dataDir);fs.mkdirSync(path.join(appRoot,'assets'),{recursive:true});fs.mkdirSync(path.join(appRoot,'content/vocabulary'),{recursive:true});fs.writeFileSync(path.join(appRoot,'content/vocabulary/index.json'),JSON.stringify({schemaVersion:1,books:[]}));
 const draft=read('wordbook.json'),library=read('library.json'),original=JSON.stringify(library),task=library.activities.find(row=>row.itemId===draft.items[0].itemId);
 task.wordChoice={field:'blank1',options:[{id:'borrow',text:'borrow',feedback:'请求借入物品。'},{id:'lend',text:'lend',feedback:'lend是借出，动作方向不同。'}],correctOptionId:'borrow'};Object.assign(task,model.versioned(task));
 for(const course of library.courses){for(const unit of course.units)for(const ref of unit.activityRefs)if(ref.itemId===task.itemId)ref.revision=task.revision;Object.assign(course,model.versioned(course));}
 for(const url of new Set(draft.items.flatMap(item=>[...item.images.wide,item.dictation.audio.url,item.sentenceAudio.audio.url])))fs.copyFileSync(path.join(root,url),path.join(appRoot,url));
 service=require('./services/vocabulary-material-library').createVocabularyMaterialLibrary({storePath:path.join(dataDir,'vocabulary-material-library.sqlite')});const saved=service.save('fixture',library,null);
 const content=require('./services/vocabulary-content').createVocabularyContent({appRoot,publishedRoot:path.join(dataDir,'wordbook-publications')}),publisher=require('./services/wordbook-publisher').createWordbookPublisher({appRoot,content}),release=require('./services/vocabulary-material-release').createVocabularyMaterialRelease({service,publisher,appRoot});
 const preparation={revision:saved.revision,courseId:library.courses[0].courseId,images:library.courses[0].units.flatMap(unit=>unit.activityRefs.map(ref=>({itemId:ref.itemId,url:draft.items.find(item=>item.itemId===ref.itemId).images.wide[0]}))),review:{revision:saved.revision,content:'pending',level:'pending',assets:'pending',rights:'pending',reviewer:'isolated synthetic fixture',note:'Not an approval of original course content'}};
 await assert.rejects(release.validate('fixture',preparation),/人工审核/);for(const key of ['content','level','assets','rights'])preparation.review[key]='approved';
 const validation=await release.validate('fixture',preparation);await release.publish('fixture',preparation,validation.fingerprint,true);
 const item=content.item(task.itemId);assert.deepEqual(item.learning.wordChoice.options,task.wordChoice.options);assert.equal(item.learning.wordChoice.correctOptionId,task.wordChoice.correctOptionId);
 // A well-formed alternative explanation must still be rejected when it disagrees with provenance.
 const preview=await service.preview('fixture',saved.revision,preparation.courseId),candidate=preview.wordbookPackage;
 const deliveries=candidate.items.map((item,index)=>{const asset=preparation.images[index],bytes=fs.readFileSync(path.join(appRoot,asset.url));item.images={wide:[asset.url],mobile:[asset.url]};return {itemId:item.itemId,url:asset.url,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});
 candidate.materialRelease={format:'vocabulary-material-release',schemaVersion:1,libraryRef:preview.libraryRef,courseRef:preview.courseRef,library,review:preparation.review,deliveries};
 const validate=require('./services/vocabulary-material-release').validateMaterialRelease;validate(candidate,appRoot);
 const corrupted=structuredClone(candidate);corrupted.index.books[0].bookId='isolated-bad-choice-revision';corrupted.items[0].learning.wordChoice.revision='0'.repeat(64);
 for(const changed of corrupted.items){const {contentRevision,...body}=changed;changed.contentRevision=hash(body);}corrupted.index.books[0].items=corrupted.items.map(({itemId,contentRevision})=>({itemId,contentRevision}));corrupted.index.books[0].revision=hash(corrupted.index.books[0].items);
 const emptyPublisher=require('./services/wordbook-publisher').createWordbookPublisher({appRoot,content:{index:()=>({schemaVersion:1,books:[]})}});
 assert.throws(()=>emptyPublisher.validate(corrupted),/选词任务版本/,'a valid outer item hash must not hide a fabricated practice revision');
 candidate.items[0].learning.wordChoice.options[1].feedback='来源中不存在的新解释';assert.throws(()=>validate(candidate,appRoot),/选词与原材料/);
 assert.equal(JSON.stringify(read('library.json')),original,'original library never replaced');
 const backup=await require('./services/vocabulary-material-backup').backupVocabularyMaterials({dataDir,appRoot,backupDir:path.join(temp,'backup')}),recovery=path.join(temp,'recovery');fs.cpSync(backup.path,recovery,{recursive:true});fs.mkdirSync(path.join(recovery,'content/vocabulary'),{recursive:true});fs.writeFileSync(path.join(recovery,'content/vocabulary/index.json'),JSON.stringify({schemaVersion:1,books:[]}));
 const restored=require('./services/vocabulary-content').createVocabularyContent({appRoot:recovery,publishedRoot:path.join(recovery,'wordbook-publications')});assert.deepEqual(restored.item(task.itemId).learning.wordChoice,item.learning.wordChoice);
 assert.equal(item.learning.wordChoice.revision,hash(task.wordChoice));
 const Database=require('./node_modules/better-sqlite3'),privateDb=new Database(':memory:'),restoredDb=new Database(':memory:');
 try{
  const schema="CREATE TABLE personal_wordbook_versions(user_id INTEGER,book_id TEXT,version INTEGER,revision TEXT,package_json TEXT,created_at TEXT DEFAULT (datetime('now')),PRIMARY KEY(user_id,book_id,version));";privateDb.exec(schema);restoredDb.exec(schema);
  const create=require('./services/personal-wordbooks').createPersonalWordbooks,personal=create({db:privateDb,appRoot}),recovered=create({db:restoredDb,appRoot});draft.items[0].wordChoice=structuredClone(task.wordChoice);
  const savedPrivate=await personal.save(1,draft),archive=personal.archive(1),preview=await recovered.previewRestore(1,archive);await recovered.restore(1,archive,preview.fingerprint,true);
  assert.deepEqual(recovered.archive(1),archive,'personal archives retain the exact choice configuration');const ref=recovered.book(savedPrivate.bookId,1).items[0];assert.deepEqual(recovered.item(ref.itemId,ref.contentRevision,1).learning.wordChoice,item.learning.wordChoice);
  await assert.rejects(recovered.restore(1,archive,preview.fingerprint,true),/已有内容/);assert.deepEqual(recovered.archive(1),archive,'nonempty target never overwritten');
 }finally{privateDb.close();restoredDb.close();}
 console.log('Word-choice content: pending-review rejection, isolated immutable publication, provenance mismatch rejection, source preservation and fresh-directory backup/read recovery passed; no learning capability enabled.');
 }finally{service?.close();assert.equal(path.dirname(fs.realpathSync(temp)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(temp).startsWith('word-choice-content-'));fs.rmSync(temp,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
