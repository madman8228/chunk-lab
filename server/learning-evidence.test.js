'use strict';
const assert=require('node:assert/strict');
const {createDataRows}=require('./services/data-rows');
let stored=null;
const rows=createDataRows({stmt:function(sql){
  if(sql.indexOf('SELECT data_json FROM user_sentence_stats')===0)return {get:function(userId,key){return userId===7&&key==='deck#cid'&&stored?{data_json:JSON.stringify(stored)}:null;}};
  if(sql.indexOf('INSERT INTO user_sentence_stats')===0)return {run:function(userId,key,deckId,json){stored=JSON.parse(json);}};
  throw new Error('Unexpected SQL '+sql);
}});
const older={id:'pass',at:100,ok:true,type:'assessment',stage:'initial'};
const newer={id:'fail',at:200,ok:false,type:'assessment',stage:'initial'};
rows.upsertSentenceStat(7,'deck#cid',{deckId:'deck',times:1,learningV1:{version:1,dueAt:300,evidence:[older]}},1);
rows.upsertSentenceStat(7,'deck#cid',{deckId:'deck',times:2},2);
assert.deepEqual(stored.learningV1.evidence,[older],'legacy client must not erase learning proof');
rows.upsertSentenceStat(7,'deck#cid',{deckId:'deck',times:3,learningV1:{version:1,dueAt:400,lastExposureAt:200,evidence:[newer]}},3);
assert.deepEqual(stored.learningV1.evidence,[older,newer],'server must retain unique evidence from both copies');
assert.equal(stored.learningV1.dueAt,400,'latest learning schedule should win while evidence merges');
const passConflict={id:'shared-id',at:10,ok:true,assisted:false,type:'assessment'};
const failConflict={id:'shared-id',at:20,ok:false,assisted:false,type:'assessment'};
rows.upsertSentenceStat(7,'deck#cid',{deckId:'deck',times:4,learningV1:{version:1,dueAt:500,evidence:[passConflict]}},4);
rows.upsertSentenceStat(7,'deck#cid',{deckId:'deck',times:5,learningV1:{version:1,dueAt:500,evidence:[failConflict]}},5);
assert.equal(stored.learningV1.evidence.find(event=>event.id==='shared-id').ok,false,
  'the server must choose the adverse payload for conflicting copies of one immutable event ID');
console.log('learning-evidence.test.js passed');
