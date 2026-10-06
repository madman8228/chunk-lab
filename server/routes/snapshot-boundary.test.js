'use strict';
const assert = require('node:assert/strict');
const { registerDataRoutes } = require('./data');
const { registerBackupRoutes } = require('./backup');
const routes = new Map();
const app = Object.fromEntries(['get','post','put'].map(method => [method,(url,auth,handler)=>routes.set(method+' '+url,handler)]));
const snapshot={seq:17,mem:{decks:[{id:'keep-course'}],reinforceBook:[]},courses:[{courseId:'keep-story'}],courseProgress:{}};
const before=JSON.stringify(snapshot);
const reads=[];
const options={app,auth:{authenticate(){}},readMemSnapshot(userId,since){reads.push({userId,since});return snapshot;}};
registerDataRoutes(options);
registerBackupRoutes(options);
assert.equal(routes.has('put /api/data'),false,'read routes must not construct old snapshot writes');
assert.equal(routes.has('post /api/import'),false,'export routes must not construct old import writes');
function call(key,req={userId:7,query:{}}){
  const res={statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
  routes.get(key)(req,res);return res;
}
assert.deepEqual(call('get /api/data',{userId:7,query:{since:'12'}}).body,snapshot);
assert.deepEqual(reads.pop(),{userId:7,since:12});
assert.equal(call('get /api/data',{userId:7,query:{since:'invalid'}}).statusCode,400);
assert.deepEqual(call('get /api/export').body.courses,snapshot.courses);
assert.equal(JSON.stringify(snapshot),before,'read and export preserve course content');
console.log('[snapshot-boundary] read and export work without a legacy writer and preserve courses');
