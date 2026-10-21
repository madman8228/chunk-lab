const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {series}=require('../js/stats-growth.js');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../js/learning-engine.js'),'utf8'),context);
const resolve=context.LearningEngine.resolveLearningState;
const day=86400000,now=new Date(2026,9,16,12).getTime();
test('repeated answers count once; undated legacy records are not backfilled',()=>{
 const result=series([{key:'a',stat:{times:3}},{key:'b',stat:{times:2,lastAt:now}}],[{kind:'answer',key:'a',at:now-day},{kind:'answer',key:'a',at:now}],now,resolve);
 assert.equal(result.rows.at(-1).learned,1);assert.equal(result.missing,1);assert.equal(result.hasAssessment,false);
});
test('mastery follows real delayed evidence and later failure, ignoring future events',()=>{
 const evidence=[{id:'i',at:now-12*day,stage:'initial',sessionId:'one',type:'assessment',ok:true,firstAttempt:true,contentFingerprint:'v1'},
 {id:'d',at:now-4*day,stage:'delayed',sessionId:'two',type:'assessment',ok:true,firstAttempt:true,contentFingerprint:'v1'},
 {id:'f',at:now-day,type:'practice',ok:false,contentFingerprint:'v1'},
 {id:'future',at:now+day,stage:'delayed',sessionId:'three',type:'assessment',ok:true,firstAttempt:true,contentFingerprint:'v1'}];
 const result=series([{key:'a',fingerprint:'v1',stat:{times:2,learningV1:{evidence}}}],[],now,resolve);
 assert.equal(result.rows.at(-3).mastered,1);assert.equal(result.rows.at(-1).mastered,0);assert.equal(result.rows.at(-1).learned,1);
});
test('outdated content does not count as verified mastery',()=>{
 const result=series([{key:'a',fingerprint:'new',stat:{learningV1:{evidence:[{id:'x',at:now-day,type:'assessment',stage:'delayed',contentFingerprint:'old'}]}}}],[],now,resolve);
 assert.equal(result.hasAssessment,false);assert.equal(result.rows.at(-1).mastered,0);
});
