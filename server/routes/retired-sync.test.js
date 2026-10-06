'use strict';
const assert = require('node:assert/strict');
const Database = require('../node_modules/better-sqlite3');
const { registerRetiredSyncRoutes } = require('./retired-sync');
const db = new Database(':memory:');
db.exec('CREATE TABLE user_sync_resolutions (user_id INTEGER,request_id TEXT,backup_json TEXT,result_json TEXT)');
db.prepare('INSERT INTO user_sync_resolutions VALUES (?,?,?,?)').run(1, 'archive', '{"courses":["keep"]}', '{"ok":true}');
const routes = new Map();
const app = Object.fromEntries(['get','post','put','delete'].map(method => [method, (url, auth, handler) => routes.set(method+' '+url, handler)]));
registerRetiredSyncRoutes({ app, auth:{ authenticate(){} }, db });
function call(method, url, userId=1, id='archive') {
  const res={ statusCode:200, status(n){this.statusCode=n;return this;}, json(value){this.body=value;return this;} };
  routes.get(method+' '+url)({ userId, params:{ id }, body:{ choice:'local' } },res);
  return res;
}
const before=db.serialize();
for(const [method,url] of [['get','/api/sync/batch'],['get','/api/sync/entity'],['post','/api/sync/batch/resolve'],['post','/api/sync/resolve'],['put','/api/data'],['post','/api/import'],['post','/api/courses'],['delete','/api/courses/:courseId'],['post','/api/deck/publish']]) {
  const res=call(method,url);
  assert.equal(res.statusCode,428);
  assert.equal(res.body.code,'CLIENT_UPDATE_REQUIRED');
}
for(const url of ['/api/sync/resolutions/:id','/api/sync/batch/resolutions/:id']) {
  assert.deepEqual(call('get',url).body,{ backup:{ courses:['keep'] },result:{ok:true} });
  assert.equal(call('get',url,2).statusCode,404);
  assert.equal(call('get',url,1,'missing').statusCode,404);
}
assert.deepEqual(db.serialize(),before,'all retired endpoints preserve stored data');
db.close();
console.log('[retired-sync] old writers fenced; archives readable, account isolated and unchanged');
