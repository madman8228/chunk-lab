'use strict';
const assert=require('node:assert/strict'),Database=require('./node_modules/better-sqlite3'),{canonicalHash}=require('./canonical-hash'),model=require('./services/vocabulary-browse-model'),{createVocabularyBrowseOperations}=require('./services/vocabulary-browse-operations');
const db=new Database(':memory:');
try{
 db.exec(`CREATE TABLE user_phone_identities(user_id INTEGER);INSERT INTO user_phone_identities VALUES(1),(2);
 CREATE TABLE user_entity_rows(user_id INTEGER,kind TEXT,item_key TEXT,data_json TEXT,seq INTEGER,deleted_at TEXT,PRIMARY KEY(user_id,kind,item_key));
 CREATE TABLE vocabulary_study_events(user_id INTEGER,data_json TEXT);INSERT INTO vocabulary_study_events VALUES(1,'original-answer');
 CREATE TABLE vocabulary_item_progress(user_id INTEGER,data_json TEXT);INSERT INTO vocabulary_item_progress VALUES(1,'original-mastery');
 CREATE TABLE vocabulary_practice_reports(user_id INTEGER,data_json TEXT);INSERT INTO vocabulary_practice_reports VALUES(1,'original-report');`);
 const body={schemaVersion:1,bookId:'test:objects',bookRevision:'a'.repeat(64),unitId:null,steps:['pen','book','bag'].flatMap(itemId=>['recognition','phrase','sentence'].map(stage=>({stepId:itemId+':'+stage,itemId,contentRevision:'b'.repeat(64),stage})))};
 const plan={...body,revision:canonicalHash(body)},plans=new Map([[plan.revision,plan]]),snap=()=>['vocabulary_study_events','vocabulary_item_progress','vocabulary_practice_reports'].map(table=>db.prepare('SELECT * FROM '+table).all()),before=snap();
 const options={db,enabled:true,resolvePlan:(user,id,revision)=>{assert.ok([1,2].includes(user));const found=plans.get(revision);if(!found)throw Object.assign(Error('unknown version'),{code:'CONTENT_VERSION_CHANGED'});return found;},operationError:(message,code,status)=>Object.assign(Error(message),{code,status}),upsertEntityRow:(user,kind,key,value,seq)=>db.prepare('INSERT INTO user_entity_rows(user_id,kind,item_key,data_json,seq) VALUES(?,?,?,?,?) ON CONFLICT(user_id,kind,item_key) DO UPDATE SET data_json=excluded.data_json,seq=excluded.seq').run(user,kind,key,JSON.stringify(value),seq)};
 const ops=createVocabularyBrowseOperations(options);let seq=0;const apply=(action,extra={},user=1)=>{const state=ops.state(user,plan.bookId,plan.revision);return db.transaction(()=>ops.apply(user,{type:'vocabulary.browse',payload:{bookId:plan.bookId,bookRevision:plan.bookRevision,planRevision:plan.revision,stepId:state.resume?.stepId||plan.steps[0].stepId,expectedResumeRev:state.resumeRev,action,...extra}},++seq))();};
 assert.equal(ops.state(1,plan.bookId,plan.revision).resume,null);
 assert.equal(apply('continue').assessment,false);assert.equal(ops.state(1,plan.bookId,plan.revision).resume.stepId,'pen:phrase');
 const stale=ops.state(1,plan.bookId,plan.revision);apply('pause');assert.equal(ops.state(1,plan.bookId,plan.revision).resume.stepId,'pen:phrase');
 assert.throws(()=>apply('continue',{expectedResumeRev:stale.resumeRev}),error=>error.code==='RESUME_CONFLICT');
 apply('jump',{targetStepId:'bag:sentence'});assert.equal(ops.state(1,plan.bookId,plan.revision).resume.status,'active');apply('continue');assert.equal(ops.state(1,plan.bookId,plan.revision).resume.status,'browsed');assert.throws(()=>apply('continue'),/已经浏览完/);apply('restart');assert.equal(ops.state(1,plan.bookId,plan.revision).resume.stepId,'pen:recognition');
 for(let i=0;i<9;i++)apply('continue');assert.equal(ops.state(1,plan.bookId,plan.revision).resume.status,'browsed');
 assert.equal(ops.state(2,plan.bookId,plan.revision).resume,null);apply('continue',{},2);assert.equal(ops.state(1,plan.bookId,plan.revision).resume.status,'browsed');
 const revisionBody={...body,bookRevision:'c'.repeat(64)},newPlan={...revisionBody,revision:canonicalHash(revisionBody)};plans.set(newPlan.revision,newPlan);assert.equal(ops.state(1,plan.bookId,newPlan.revision).resume,null);assert.equal(ops.state(1,plan.bookId,plan.revision).resume.status,'browsed');
 const unitBody={...body,unitId:'unit:one'},unitPlan={...unitBody,revision:canonicalHash(unitBody)};plans.set(unitPlan.revision,unitPlan);assert.equal(ops.state(1,plan.bookId,unitPlan.revision,'unit:one').resume,null);assert.throws(()=>ops.state(1,plan.bookId,unitPlan.revision,'unit:other'),error=>error.code==='CONTENT_VERSION_CHANGED');
 const otherBody={...body,bookId:'test:second-course'},otherPlan={...otherBody,revision:canonicalHash(otherBody)};plans.set(otherPlan.revision,otherPlan);assert.equal(ops.state(1,otherPlan.bookId,otherPlan.revision).resume,null);assert.notEqual(model.scope(otherPlan),model.scope(plan));
 assert.throws(()=>apply('jump',{targetStepId:'foreign-step'}),/不属于/);assert.throws(()=>apply('restart',{answers:{word:'pen'}}),/格式/);assert.throws(()=>apply('restart',{bookRevision:'d'.repeat(64)}),error=>error.code==='CONTENT_VERSION_CHANGED');
 assert.throws(()=>model.validate({...plan,steps:[...plan.steps].reverse()}),/摘要/);assert.throws(()=>model.validate({...plan,steps:[plan.steps[0],plan.steps[0]]}),/身份/);
 assert.throws(()=>createVocabularyBrowseOperations({...options,enabled:false}).state(1,plan.bookId,plan.revision),error=>error.code==='PRACTICE_UNAVAILABLE');assert.throws(()=>ops.apply(3,{type:'vocabulary.browse',payload:{}},10),error=>error.code==='PHONE_IDENTITY_REQUIRED');
 assert.equal(ops.apply(1,{type:'vocabulary.complete'},100),null);assert.deepEqual(snap(),before);assert.equal(db.prepare("SELECT COUNT(*) n FROM user_entity_rows WHERE kind!='vocabularyBrowseResume'").get().n,0);
 console.log('Vocabulary browse: nine steps, honest browsed state, jump/restart/pause, CAS, account/unit/version isolation, disabled/eligibility and untouched assessment facts passed (in-memory only).');
}finally{db.close();}
