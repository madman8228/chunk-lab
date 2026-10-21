'use strict';
const assert=require('node:assert/strict'),model=require('../js/vocabulary-word-dictation');
const item={word:'borrow'},activity={schemaVersion:1,revision:'a'.repeat(64),audio:{url:'assets/borrow-v1.mp3',mimeType:'audio/mpeg',sha256:'b'.repeat(64),bytes:1000},answers:['borrow']};
const before=JSON.stringify(activity);assert.equal(model.validate(item,activity),activity);
for(const word of ['borrow',' BORROW ','ｂｏｒｒｏｗ'])assert.equal(model.evaluate(item,activity,{word}).correct,true);
for(const values of [{word:'lend'},{word:'borrow.'},{word:''},{word:'borrow',hint:true},{blank1:'borrow'},['borrow'],null])assert.equal(model.evaluate(item,activity,values).correct,false);
assert.deepEqual(model.evaluate(item,activity,{word:'borrow'}),{correct:true,assisted:true,practiceType:'word-dictation',ability:'word-spelling-from-authored-audio',practiceRevision:activity.revision});
for(const mutate of [a=>a.audio.url='https://example.com/borrow.mp3',a=>a.audio.url='assets/../borrow.mp3',a=>a.audio.mimeType='audio/unknown',a=>a.audio.sha256='wrong',a=>a.audio.bytes=0,a=>a.audio.bytes=10000001,a=>a.answers=['lend'],a=>a.answers=['borrow','BORROW'],a=>a.mastered=true,a=>a.audio.latest=true]){const candidate=structuredClone(activity);mutate(candidate);assert.throws(()=>model.validate(item,candidate));}
const phrase={...item,word:'take care of'},phraseActivity={...activity,answers:['take care of']};assert.equal(model.evaluate(phrase,phraseActivity,{word:'take  care of'}).correct,true);
assert.equal(JSON.stringify(activity),before);console.log('Word dictation contract: authored local audio, fixed revision/digest, strict answer shape, spelling normalization, rejected shortcuts and assisted-only evidence passed.');
