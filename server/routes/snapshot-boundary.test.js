'use strict';
const assert = require('node:assert/strict');
const { registerDataRoutes } = require('./data');
const { registerBackupRoutes } = require('./backup');
const routes = new Map();
const app = Object.fromEntries(['get','post','put'].map(method => [method,(url,auth,handler)=>routes.set(method+' '+url,handler)]));
const snapshot={seq:17,mem:{decks:[{id:'keep-course'}],reinforceBook:[]},courses:[{courseId:'keep-story'}],courseProgress:{}};
const before=JSON.stringify(snapshot);
const reads=[];
let activeFormat='legacy-v1';
const learningSnapshot={format:'references-v1',seq:21,mem:{decks:[],settings:{sound:true}},courses:[],courseProgress:{}};
const wordbookArchive={format:'personal-wordbooks-archive',version:1,owner:7,rows:[{book_id:'personal-book:fixture',version:1}]};
const options={app,auth:{authenticate(){}},writeProtocol:3,learningDataFormat:{forUser(){return activeFormat;}},
  readMemSnapshot(userId,since){reads.push({userId,since});return snapshot;},
  readLearningSnapshot(){return learningSnapshot;},personalWordbooks:{archive(userId){return {...wordbookArchive,owner:userId};}}};
registerDataRoutes(options);
registerBackupRoutes(options);
assert.equal(routes.has('put /api/data'),true,'protocol 3 exposes an explicit retired-write response');
assert.equal(routes.has('post /api/import'),false,'export routes must not construct old import writes');
function call(key,req={userId:7,query:{}}){
  const res={statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
  res.headers={};res.set=function(key,value){this.headers[key]=value;return this;};
  routes.get(key)(req,res);return res;
}
assert.deepEqual(call('get /api/data',{userId:7,query:{since:'12'}}).body,snapshot);
assert.deepEqual(reads.pop(),{userId:7,since:12});
assert.equal(call('get /api/data',{userId:7,query:{since:'invalid'}}).statusCode,400);
assert.deepEqual(call('get /api/export').body.courses,snapshot.courses);
assert.equal(call('put /api/data',{userId:7,body:{decks:[{id:'must-not-write'}]}}).statusCode,428);
activeFormat='references-v1';
const oldRead=call('get /api/data',{userId:7,query:{}});
assert.equal(oldRead.statusCode,428,'migrated accounts cannot download the old mixed snapshot');
assert.equal(oldRead.body.code,'LEARNING_DATA_FORMAT_UPGRADE_REQUIRED');
const oldWrite=call('put /api/data',{userId:7,body:{decks:[{id:'must-not-write'}]}});
assert.equal(oldWrite.body.code,'LEARNING_DATA_FORMAT_UPGRADE_REQUIRED');
const newRead=call('get /api/learning-data',{userId:7,query:{}});
assert.equal(newRead.body.format,'references-v1');
const newExport=call('get /api/export',{userId:7,query:{}});
assert.equal(newExport.body.__version,3);
assert.equal(newExport.body.format,'references-v1');
assert.equal(Object.hasOwn(newExport.body,'courses'),false,'new learning backups exclude all course bodies');
assert.deepEqual(newExport.body.personalWordbooks,{...wordbookArchive,owner:7},'personal vocabulary content remains in a separate explicit archive');
assert.equal(JSON.stringify(snapshot),before,'read and export preserve course content');
console.log('[snapshot-boundary] read and export work without a legacy writer and preserve courses');
