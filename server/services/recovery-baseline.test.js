'use strict';
const assert=require('node:assert/strict');
const Database=require('../node_modules/better-sqlite3');
const {createRecoveryBaselineWriter}=require('./recovery-baseline');
const db=new Database(':memory:');
db.exec('CREATE TABLE courses(user_id INTEGER,id TEXT); INSERT INTO courses VALUES(1,\'important-course\');');
let constructed=0,checkedSource;
const insert=db.prepare('INSERT INTO courses VALUES(?,?)');
const write=createRecoveryBaselineWriter({db,
  isAccountEmpty(userId,sourceId){checkedSource=sourceId;return !db.prepare('SELECT 1 FROM courses WHERE user_id=?').get(userId);},
  getWriter(){constructed++;return (userId,body,bypass)=>{
    assert.equal(bypass,true);
    insert.run(userId,body.courseId);
    return 7;
  };},
  upsertEntityRow(userId,kind,id){if(id==='fail')throw Error('simulated failure');insert.run(userId,id);}
});
assert.equal(constructed,0,'ordinary startup does not create a snapshot writer');
const before=db.serialize();
assert.throws(()=>write(1,{courseId:'replacement'}),error=>error.code==='RECOVERY_ACCOUNT_NOT_EMPTY'&&error.status===409);
assert.equal(constructed,0,'nonempty account is blocked before loading writer');
assert.deepEqual(db.serialize(),before,'existing assets unchanged');
assert.throws(()=>write(2,{courseId:'restored',logicalCourses:[{id:'fail'}]}),/simulated failure/);
assert.equal(db.prepare('SELECT count(*) n FROM courses WHERE user_id=2').get().n,0,'partial restore rolls back');
assert.equal(write(2,{courseId:'restored',logicalCourses:[{id:'directory'}]},'archive-source'),7);
assert.equal(checkedSource,'archive-source','empty-account check excludes only the current archive');
assert.deepEqual(db.prepare('SELECT id FROM courses WHERE user_id=2 ORDER BY id').all(),[{id:'directory'},{id:'restored'}]);
assert.throws(()=>write(2,{courseId:'another'}),error=>error.code==='RECOVERY_ACCOUNT_NOT_EMPTY');
assert.deepEqual(db.prepare('SELECT id FROM courses WHERE user_id=1').all(),[{id:'important-course'}]);
db.close();
console.log('[recovery-baseline] lazy writer, nonempty-account protection and atomic restore verified');
