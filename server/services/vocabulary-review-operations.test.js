'use strict';
const assert=require('node:assert/strict');
const Database=require('../node_modules/better-sqlite3');
const {createVocabularyReviewOperations}=require('./vocabulary-review-operations');

const db=new Database(':memory:');
try{
  db.exec(`CREATE TABLE user_phone_identities(user_id INTEGER,phone TEXT);
    INSERT INTO user_phone_identities VALUES(1,'temporary-test-identity');
    CREATE TABLE user_entity_rows(user_id INTEGER,kind TEXT,item_key TEXT,data_json TEXT,seq INTEGER,deleted_at TEXT,PRIMARY KEY(user_id,kind,item_key));
    CREATE TABLE vocabulary_attempt_events(user_id INTEGER,attempt_id TEXT,scope_key TEXT,session_id TEXT,item_id TEXT,resource_id TEXT,content_revision TEXT,data_json TEXT,occurred_at INTEGER,seq INTEGER);
    CREATE TABLE vocabulary_study_events(user_id INTEGER,event_id TEXT,item_id TEXT,resource_id TEXT,content_revision TEXT,data_json TEXT,occurred_at INTEGER,seq INTEGER);`);
  const book={bookId:'book-test',revision:'book-revision',title:'测试词书',items:Array.from({length:12},(_,index)=>({itemId:'word-'+String(index).padStart(2,'0'),contentRevision:'content-'+index}))};
  const content={book:(id,userId)=>{assert.equal(id,book.bookId);assert.equal(userId,1);return book;},item:(id,revision)=>({itemId:id,contentRevision:revision,exercise:{}})};
  const insert=db.prepare('INSERT INTO vocabulary_attempt_events VALUES(?,?,?,?,?,?,?,?,?,?)');
  book.items.forEach((ref,index)=>insert.run(1,'wrong-'+index,'scope-'+index,'regular-session',ref.itemId,'wordbook:'+book.bookId,ref.contentRevision,
    JSON.stringify({correct:false,practiceType:'sentence-cloze'}),1000+index,1));
  const upsert=(userId,kind,itemKey,value,seq)=>db.prepare(`INSERT INTO user_entity_rows(user_id,kind,item_key,data_json,seq) VALUES(?,?,?,?,?)
    ON CONFLICT(user_id,kind,item_key) DO UPDATE SET data_json=excluded.data_json,seq=excluded.seq`).run(userId,kind,itemKey,JSON.stringify(value),seq);
  const service=createVocabularyReviewOperations({db,content,upsertEntityRow:upsert,now:()=>2000,operationError:(message,code,status)=>Object.assign(Error(message),{code,status})});
  const result=service.apply(1,{type:'vocabulary.review.session',requestId:'review-start-id-01',payload:{action:'start',sessionId:'review-session-01',bookId:book.bookId,
    bookRevision:book.revision,practiceType:'sentence-cloze',kind:'wrong',expectedSessionRev:0}},2);
  assert.equal(result.count,10,'sessions hard-cap their queues to ten entries');
  const session=JSON.parse(db.prepare('SELECT data_json FROM user_entity_rows WHERE user_id=1 AND kind=? AND item_key=?').get('vocabularyReviewSession','review-session-01').data_json);
  assert.deepEqual(session.queue.map(row=>row.itemId),book.items.slice(0,10).map(row=>row.itemId),'queue ordering is stable and later items remain outside this session');
  console.log('Vocabulary review operations: deterministic ten-item session cap passed.');
}finally{db.close();}
