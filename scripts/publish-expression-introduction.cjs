'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('../server/loadenv');
const Database = require('../server/node_modules/better-sqlite3');
async function main() {
  const base = 'http://127.0.0.1:8787', courseId = 'expression-unit01-tools';
  const login = await fetch(base + '/api/admin/login', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({password:process.env.ADMIN_PASSWORD}) });
  assert.equal(login.status, 200, 'administrator authentication required');
  const {token} = await login.json();
  async function request(route, body) {
    const response = await fetch(base + route, {method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    const result = await response.json(); assert.ok(response.ok, JSON.stringify(result)); return result;
  }
  const catalog = await request('/api/admin/expression-courses');
  const course = catalog.courses.find(item=>item.courseId===courseId); assert.ok(course);
  const original = structuredClone(course.package);
  const description = fs.readFileSync(path.resolve(__dirname,'../docs/expression-unit01-introduction-review.md'),'utf8').split('## 建议课程简介')[1].split('## 学习顺序')[0].trim();
  if(original.description===description){console.log('Approved introduction already published.');return;}
  const database = path.resolve(process.env.CHUNKLAB_DATA_DIR || path.join(__dirname,'../server/data'),'chunklab.db');
  const backupDir = path.resolve(__dirname,'../output/expression-course-backups'); fs.mkdirSync(backupDir,{recursive:true});
  const backupPath = path.join(backupDir,'introduction-'+Date.now()+'.sqlite');
  const db = new Database(database,{readonly:true});
  try { await db.backup(backupPath); } finally {db.close();}
  const backup = new Database(backupPath,{readonly:true});
  try {assert.equal(backup.pragma('integrity_check',{simple:true}),'ok');assert.ok(backup.prepare('SELECT course_id FROM expression_courses WHERE course_id=?').get(courseId));}finally{backup.close();}
  console.log(JSON.stringify({database,backupPath,target:courseId,scope:'system catalog; no account target'}));
  const pkg = {...original,description};
  const draft = await request('/api/admin/expression-drafts',{package:pkg,requestId:crypto.randomUUID()});
  const route = '/api/admin/expression-drafts/'+encodeURIComponent(draft.draftId);
  const checked = await request(route+'/validate',{}); assert.equal(checked.valid,true,JSON.stringify(checked.errors));
  await request(route+'/review',{contentHash:checked.contentHash});
  const result = await request(route+'/publish',{expectedRevision:draft.revision,contentHash:checked.contentHash,requestId:crypto.randomUUID()});
  const current = (await request('/api/admin/expression-courses')).courses.find(item=>item.courseId===courseId);
  assert.deepEqual(current.package,pkg,'only the approved description may change');
  console.log(JSON.stringify({courseId,releaseId:result.releaseId,verified:true}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
