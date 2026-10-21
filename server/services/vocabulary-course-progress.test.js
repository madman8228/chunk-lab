'use strict';
const assert=require('node:assert/strict');
const Database=require('../node_modules/better-sqlite3');
const {createVocabularyCourseProgress}=require('./vocabulary-course-progress');

const digest=n=>String(n).padStart(64,'0');
function makeBook(revision,itemIds,units=[]){return {bookId:'personal-book:course',revision:digest(revision),structureRevision:units.length?digest(90+revision):null,title:'验收课程',itemCount:itemIds.length,items:itemIds.map((itemId,i)=>({itemId,contentRevision:digest(i+1)})),units};}
const units1=[{unitId:'unit-1',title:'第一单元',itemIds:['item-1']}];
const old=makeBook(1,['item-1'],units1),current=makeBook(2,['item-1','item-2'],[...units1,{unitId:'unit-2',title:'第二单元',itemIds:['item-2']}]);
const db=new Database(':memory:');
try{
  db.exec(`CREATE TABLE vocabulary_study_events(user_id INTEGER,event_id TEXT,item_id TEXT,resource_id TEXT,content_revision TEXT,data_json TEXT,occurred_at INTEGER);
    CREATE TABLE vocabulary_attempt_events(user_id INTEGER,attempt_id TEXT,item_id TEXT,resource_id TEXT,occurred_at INTEGER);
    CREATE TABLE vocabulary_practice_reports(user_id INTEGER,report_id TEXT,item_id TEXT,resource_id TEXT,occurred_at INTEGER);
    CREATE TABLE user_entity_rows(user_id INTEGER,kind TEXT,item_key TEXT,data_json TEXT,deleted_at TEXT);`);
  const content={book:(id,owner)=>{if(id!==current.bookId||owner!==1)throw Object.assign(Error('not found'),{status:404});return current;},personal:{
    versions:(id,owner)=>{if(id!==current.bookId||owner!==1)throw Object.assign(Error('not found'),{status:404});return [old,current];},
    resources:owner=>owner===1?[{sourceRefs:[{id:current.bookId}]}]:[],
  }};
  const progress=createVocabularyCourseProgress({db,content});
  db.prepare('INSERT INTO user_entity_rows VALUES(?,?,?,?,NULL)').run(1,'vocabularyResume',current.bookId,JSON.stringify({bookId:current.bookId,status:'completed'}));
  let row=progress.course(1,current.bookId);
  assert.equal(row.state,'not-started','a completed cursor or skips are not completion evidence');
  assert.equal(row.completedItems,0);

  function complete({id,revision,structureRevision,itemId,at,practiceType='sentence-cloze',evidenceVersion=2}){
    const ref=(revision===old.revision?old:current).items.find(value=>value.itemId===itemId);
    db.prepare('INSERT INTO vocabulary_study_events VALUES(?,?,?,?,?,?,?)').run(1,id,itemId,'wordbook:'+current.bookId,ref.contentRevision,JSON.stringify({evidenceVersion,bookRevision:revision,sessionId:'session-'+id,structureRevision,unitId:null,practiceType,practiceRevision:ref.contentRevision}),at);
  }
  complete({id:'legacy',revision:old.revision,structureRevision:old.structureRevision,itemId:'item-1',at:100});
  row=progress.course(1,current.bookId);
  assert.equal(row.state,'updated');assert.equal(row.completedItems,1);assert.equal(row.totalItems,2);
  assert.equal(row.units[0].completedItems,1);assert.equal(row.units[1].completedItems,0);
  assert.equal(row.completedVersions.length,1);assert.equal(row.completedVersions[0].completedAt,100);

  complete({id:'new',revision:current.revision,structureRevision:current.structureRevision,itemId:'item-2',at:200,practiceType:'word-choice'});
  complete({id:'repeat',revision:current.revision,structureRevision:current.structureRevision,itemId:'item-2',at:250,practiceType:'chunk-order'});
  row=progress.course(1,current.bookId);
  assert.equal(row.state,'completed');assert.equal(row.completedItems,2);assert.equal(row.completedAt,200);
  assert.equal(row.completedVersions.length,2);assert.equal(row.lastActivityAt,250);

  db.prepare('INSERT INTO vocabulary_study_events VALUES(?,?,?,?,?,?,?)').run(1,'unversioned','item-1','wordbook:'+current.bookId,old.items[0].contentRevision,JSON.stringify({practiceType:'guided-expression'}),300);
  row=progress.course(1,current.bookId);
  assert.equal(row.state,'completed','unverifiable historical rows do not downgrade fully verified current completion');
  assert.equal(row.evidence,'partial-history');assert.equal(row.legacyEventCount,1);

  const summary=progress.courses(1);
  assert.equal(summary.confirmed,true);assert.equal(summary.policy,'practice-coverage-v1');
  assert.equal(summary.totals.currentCompletedCourses,1);assert.equal(summary.totals.everCompletedCourses,1);
  assert.equal(summary.items.length,1);
  assert.throws(()=>progress.courses(1,{limit:101}),/分页/);
  assert.throws(()=>progress.course(2,current.bookId),/not found/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM vocabulary_study_events').get().n,4,'the projection is read-only');

  const draftBook={...makeBook(4,Array.from({length:6},(_,i)=>'shared-'+i)),bookId:'draft:borrow-adult-v1',title:'成人日常：借东西（编排草稿）'};
  const personalBook={...makeBook(5,Array.from({length:6},(_,i)=>'shared-'+i)),bookId:'personal-book:borrow-copy',title:draftBook.title};
  const books=new Map([[draftBook.bookId,draftBook],[personalBook.bookId,personalBook]]);
  const separateProgress=createVocabularyCourseProgress({db,content:{book:id=>{const book=books.get(id);if(!book)throw Object.assign(Error('not found'),{status:404});return book;},personal:{versions:id=>[books.get(id)],resources:()=>[{sourceRefs:[{id:personalBook.bookId}]}]}}});
  function completeSeparate(book,itemIndex,id,at){
    const ref=book.items[itemIndex];
    db.prepare('INSERT INTO vocabulary_study_events VALUES(?,?,?,?,?,?,?)').run(1,id,ref.itemId,'wordbook:'+book.bookId,ref.contentRevision,JSON.stringify({evidenceVersion:2,bookRevision:book.revision,sessionId:'session-'+id,structureRevision:null,unitId:null,practiceType:'word-choice',practiceRevision:ref.contentRevision}),at);
  }
  [0,1,2,3,4,4,0].forEach((itemIndex,index)=>completeSeparate(draftBook,itemIndex,'draft-'+index,400+index));
  [0,1,2,2].forEach((itemIndex,index)=>completeSeparate(personalBook,itemIndex,'personal-'+index,500+index));
  const draftProgress=separateProgress.course(1,draftBook.bookId),personalProgress=separateProgress.course(1,personalBook.bookId);
  assert.equal(draftProgress.completedItems,5,'repeated practice within the draft counts each distinct word once');
  assert.equal(personalProgress.completedItems,3,'personal-course history remains independent of draft history');
  const separateSummary=separateProgress.courses(1);
  assert.deepEqual(separateSummary.items.filter(item=>books.has(item.bookId)).map(item=>[item.bookId,item.completedItems]).sort(),[[draftBook.bookId,5],[personalBook.bookId,3]].sort());

  const publicOld=makeBook(20,['public-1','public-2']),publicNew=makeBook(21,['public-1','public-2']);publicOld.bookId=publicNew.bookId='textbook-wordbook:public-version-fixture';
  publicNew.items[0].contentRevision=digest(99);const publicContent={active:publicNew,book:id=>id===publicNew.bookId?publicContent.active:null,versions:()=>[{book:publicOld,releaseId:'a'},{book:publicNew,releaseId:'b'}]};
  const publicProgress=createVocabularyCourseProgress({db,content:publicContent});
  function publicComplete(book,ref,id,at){db.prepare('INSERT INTO vocabulary_study_events VALUES(?,?,?,?,?,?,?)').run(1,id,ref.itemId,'wordbook:'+book.bookId,ref.contentRevision,JSON.stringify({evidenceVersion:2,bookRevision:book.revision,sessionId:'session-'+id,structureRevision:null,unitId:null,practiceType:'sentence-cloze',practiceRevision:ref.contentRevision}),at);}
  publicComplete(publicOld,publicOld.items[0],'public-old-1',600);publicComplete(publicOld,publicOld.items[1],'public-old-2',610);
  let publicRow=publicProgress.course(1,publicOld.bookId);assert.equal(publicRow.state,'updated');assert.equal(publicRow.completedItems,1,'only the unchanged item carries its evidence to the corrected release');assert.equal(publicRow.completedVersions.length,1);
  publicComplete(publicNew,publicNew.items[0],'public-new-1',620);publicRow=publicProgress.course(1,publicOld.bookId);assert.equal(publicRow.state,'completed');assert.equal(publicRow.completedVersions.length,2);
  publicContent.active=publicOld;publicRow=publicProgress.course(1,publicOld.bookId);assert.equal(publicRow.state,'completed','rollback restores the already-completed content version without rewriting records');assert.equal(publicRow.completedVersions.length,2);

  const large={...makeBook(3,Array.from({length:10000},(_,i)=>'scale-'+i)),bookId:'public-scale-course',title:'规模验收'};
  const scale=createVocabularyCourseProgress({db,content:{book:id=>id===large.bookId?large:current}});
  const started=performance.now(),largeRow=scale.course(1,large.bookId),elapsed=Math.round(performance.now()-started);
  assert.equal(largeRow.totalItems,10000);assert.equal(largeRow.completedItems,0);assert.equal(largeRow.state,'not-started');
  console.log('10,000-item course projection passed in '+elapsed+'ms without loading per-item media');
}finally{db.close();}
console.log('vocabulary course progress: skips, append-only history, duplicate modes, units and owner isolation passed');
