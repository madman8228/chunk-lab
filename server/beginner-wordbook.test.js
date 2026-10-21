'use strict';
const assert=require('node:assert/strict'),Database=require('./node_modules/better-sqlite3');
const {createPersonalWordbooks}=require('./services/personal-wordbooks');
const engine=require('../landing/sentence-cloze-engine');
const schema=`
 CREATE TABLE personal_wordbook_versions(user_id INTEGER,book_id TEXT,version INTEGER,revision TEXT,package_json TEXT,created_at TEXT DEFAULT (datetime('now')),PRIMARY KEY(user_id,book_id,version));
 CREATE TABLE user_decks(user_id INTEGER,id TEXT,name TEXT,items_json TEXT,authoring_json TEXT,deleted_at TEXT);
 CREATE TABLE user_courses(user_id INTEGER,data_json TEXT,deleted_at TEXT);
 CREATE TABLE user_entity_rows(user_id INTEGER,kind TEXT,data_json TEXT,deleted_at TEXT);
`;
(async()=>{
 const {createBeginnerSpeakingDraft,courseSources}=await import('../src/wordbook-authoring/beginner-speaking.mjs');
 // Entire test lives in new memory databases; never imports server/db or real rows.
 const db=new Database(':memory:'),restoredDb=new Database(':memory:');
 try{
  db.exec(schema);restoredDb.exec(schema);
  for(const course of courseSources)db.prepare('INSERT INTO user_decks VALUES(?,?,?,?,NULL,NULL)').run(1,course.resourceId.slice('course:user-deck:'.length),course.title,'[]');
  const originals=db.prepare('SELECT * FROM user_decks').all(),draft=createBeginnerSpeakingDraft(),service=createPersonalWordbooks({db});
  await assert.rejects(service.save(2,draft),/关联课程不存在/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM personal_wordbook_versions').get().n,0);
  const result=await service.save(1,draft);assert.equal(result.itemCount,22);
  const book=service.book(result.bookId,1);assert.deepEqual(book.relatedCourseIds,draft.book.relatedCourseIds);
  const {textbookFacets,textbookBookId}=await import('../src/wordbook-authoring/textbook-profile.mjs');
  const textbook={schoolStage:'小学',publisherId:'测试出版社',seriesId:'test-primary-3start',edition:'测试版A',grade:'三年级',volume:'上册'};
  const savedTextbooks=[];
  for(const profile of [textbook,{...textbook,volume:'下册'},{...textbook,seriesId:'test-other-version'}]){
   const fixture=structuredClone(draft);fixture.book.bookId=await textbookBookId(profile);fixture.book.catalog.facets=textbookFacets(profile);
   const saved=await service.save(1,fixture);savedTextbooks.push(saved.bookId);
   const listed=service.resources(1).find(resource=>resource.sourceRefs[0].id===saved.bookId);
   assert.deepEqual(listed.facets,fixture.book.catalog.facets,'catalogue preserves version, grade and volume for actual filtering');
   assert.equal(listed.description,fixture.book.catalog.description);
  }
  assert.equal(new Set(savedTextbooks).size,3,'same grade different volumes and versions coexist');
  const keyRef=book.items.find(ref=>service.item(ref.itemId,ref.contentRevision,1).word==='key');
  const item=service.item(keyRef.itemId,keyRef.contentRevision,1);
  assert.equal(engine.evaluate(item.exercise,{blank1:'keys'}).correct,true);
  assert.match(engine.evaluate(item.exercise,{blank1:'key'}).fields[0].message,/复数/);
  const archive=service.archive(1),restore=createPersonalWordbooks({db:restoredDb}),preview=await restore.previewRestore(1,archive);
  await restore.restore(1,archive,preview.fingerprint,true);
  assert.deepEqual(restore.archive(1),archive,'text, synonyms, feedback and associations survive exact archive recovery');
  assert.deepEqual(db.prepare('SELECT * FROM user_decks').all(),originals,'saving companion vocabulary never edits source courses');
  console.log('Beginner companion: actual 22-word draft private save, owner gating, plural feedback, exact backup recovery and unchanged course fixtures passed.');
 }finally{db.close();restoredDb.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
