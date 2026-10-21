'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Database=require('./node_modules/better-sqlite3');
const {createPersonalWordbooks}=require('./services/personal-wordbooks');
const draftModel=require('../js/wordbook-draft');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'personal-wordbook-images-'));
const schema='CREATE TABLE personal_wordbook_versions(user_id INTEGER,book_id TEXT,version INTEGER,revision TEXT,package_json TEXT,created_at TEXT DEFAULT (datetime(\'now\')),PRIMARY KEY(user_id,book_id,version));';
(async()=>{
 const db=new Database(':memory:'),restoredDb=new Database(':memory:');
 try{
  db.exec(schema);restoredDb.exec(schema);fs.mkdirSync(path.join(temp,'assets'));
  const webp=path.join(temp,'assets/scene.webp'),avif=path.join(temp,'assets/scene.avif');
  fs.writeFileSync(webp,Buffer.alloc(19999));fs.writeFileSync(avif,Buffer.alloc(15000));
  const draft={schemaVersion:1,book:{bookId:'image-fixture',title:'带插图的个人词书',units:[{unitId:'u1',title:'Unit 1'}]},items:[{itemId:'fixture:connect',unitId:'u1',word:'connect',meaning:'连接',scene:'把图片联系起来',translation:'把图片联系起来。',exercise:draftModel.exercise('[Connect] the pictures.'),images:{wide:['assets/scene.avif','assets/scene.webp'],mobile:['assets/scene.webp']}}]};
  const service=createPersonalWordbooks({db,appRoot:temp}),restore=createPersonalWordbooks({db:restoredDb,appRoot:temp});
  const saved=await service.save(1,draft);assert.equal(saved.itemCount,1);
  const book=service.book(saved.bookId,1),ref=book.items[0];
  assert.deepEqual(service.item(ref.itemId,ref.contentRevision,1).images,draft.items[0].images);
  const archive=service.archive(1),preview=await restore.previewRestore(1,archive);
  await restore.restore(1,archive,preview.fingerprint,true);
  assert.deepEqual(restore.archive(1),archive,'image references survive exact archive recovery');
  await assert.rejects(restore.restore(1,archive,preview.fingerprint,true),/已有内容/);
  fs.writeFileSync(avif,Buffer.alloc(20000));
  await assert.rejects(service.save(1,draft),/20000/,'every alternative format is size checked');
  await assert.rejects(restore.previewRestore(1,archive),/20000/);
  fs.writeFileSync(avif,Buffer.alloc(15000));
  const missing=structuredClone(draft);missing.items[0].images.mobile=['assets/missing.webp'];
  await assert.rejects(service.save(1,missing),/不存在|缺失/);
  const incomplete=structuredClone(draft);incomplete.items[0].images.mobile=[];
  await assert.rejects(service.save(1,incomplete),/宽屏.*手机|wide.*mobile/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM personal_wordbook_versions').get().n,1,'failed image checks do not append revisions');
  console.log('Personal illustrated wordbooks: save, exact archive recovery, no overwrite, missing files, profile completeness and 20000-byte boundary passed.');
 }finally{db.close();restoredDb.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
