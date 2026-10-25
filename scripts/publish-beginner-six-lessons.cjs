'use strict';
// Explicit, system-catalog-only publication. No enrollment/session/account APIs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
require('../server/loadenv');
const Database=require('../server/node_modules/better-sqlite3');
const root=path.resolve(__dirname,'..');
const candidate=path.join(root,'drafts/zero-english/multi-track-v2/release-candidate-20261024-v1');
const base='http://127.0.0.1:8787';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const execute=process.argv.includes('--execute');
async function main(){
 const readiness=JSON.parse(fs.readFileSync(path.join(candidate,'approval-and-readiness.json'),'utf8'));
 const tracks=['sentence-building','pronunciation','phonics'];
 const {validateExpressionPackage}=await import(pathToFileURL(path.join(root,'src/expression-course/validate.mjs')));
 const packages=tracks.map(track=>{
  const dir=path.join(candidate,track),pkg=JSON.parse(fs.readFileSync(path.join(dir,'course-package.json'),'utf8'));
  const approval=readiness.packages.find(p=>p.track===track);assert(approval);
  assert.equal(hash(JSON.stringify(pkg)),approval.candidateContentHash);
  assert.equal(approval.contentReview,'approved');assert.equal(approval.audioReview,'approved');
  for(const asset of pkg.assets){
   const file=path.resolve(dir,asset.localFile);assert(file.startsWith(dir+path.sep));
   const bytes=fs.readFileSync(file);assert.equal(hash(bytes),asset.sha256);assert.equal(bytes.length,asset.size);
  }
  const check=validateExpressionPackage(pkg,{forPublish:true,availableAssets:pkg.assets.map(a=>a.assetId)});
  assert.equal(check.valid,true,JSON.stringify(check.errors));
  return {dir,pkg,contentHash:approval.candidateContentHash};
 });
 assert.equal(packages.reduce((n,p)=>n+p.pkg.lessons.length,0),6);
 assert(process.env.ADMIN_PASSWORD,'Administrator credentials required');
 const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:process.env.ADMIN_PASSWORD})});
 assert.equal(login.status,200,'Administrator authentication required');const {token}=await login.json();
 async function request(route,body){
  const response=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const result=await response.json();assert(response.ok,`${route}: ${response.status} ${JSON.stringify(result)}`);return result;
 }
 const before=(await request('/api/admin/expression-courses')).courses;
 for(const {pkg} of packages)assert(!before.some(c=>c.courseId===pkg.courseId),'Target course ID already exists; do not replace: '+pkg.courseId);
 const database=path.resolve(process.env.CHUNKLAB_DATA_DIR||path.join(root,'server/data'),'chunklab.db');
 assert(fs.existsSync(database));
 const db=new Database(database,{readonly:true,fileMustExist:true});
 try{
  const active=db.prepare("SELECT course_id,active_release FROM expression_courses WHERE status='active' ORDER BY course_id").all();
  assert.deepEqual(active.map(r=>[r.course_id,r.active_release]),before.filter(c=>c.status==='active').map(c=>[c.courseId,c.releaseId]).sort((a,b)=>a[0].localeCompare(b[0])),'Configured database does not match live catalog');
  for(const {pkg} of packages)assert(!db.prepare('SELECT course_id FROM expression_courses WHERE course_id=?').get(pkg.courseId));
 }finally{db.close();}
 if(!execute){console.log(JSON.stringify({mode:'read-only-preflight',database,existingCourses:before.map(c=>c.courseId),newCourses:packages.map(p=>p.pkg.courseId),lessons:6,audio:15,valid:true},null,2));return;}
 const output=path.join(root,'output/expression-course-backups');fs.mkdirSync(output,{recursive:true});
 const run=fs.mkdtempSync(path.join(output,'six-lessons-20261024-'));
 const backupPath=path.join(run,'before-publication.sqlite');
 const live=new Database(database,{readonly:true,fileMustExist:true});
 try{await live.backup(backupPath);}finally{live.close();}
 const backup=new Database(backupPath,{readonly:true,fileMustExist:true});
 try{assert.equal(backup.pragma('integrity_check',{simple:true}),'ok');for(const course of before)assert(backup.prepare('SELECT course_id FROM expression_courses WHERE course_id=?').get(course.courseId));}finally{backup.close();}
 const receipt={date:new Date().toISOString(),base,database,scope:'system-built-in-catalog',accountTarget:null,
  authorization:'发布这六课',backup:{file:backupPath,sha256:hash(fs.readFileSync(backupPath)),integrity:'ok'},
  candidateDirectory:candidate,existingCourseIds:before.map(c=>c.courseId),releases:[],status:'publishing'};
 const receiptFile=path.join(run,'publication-receipt.json');
 const save=()=>fs.writeFileSync(receiptFile,JSON.stringify(receipt,null,2)+'\n');save();
 console.log(JSON.stringify({backup:backupPath,verified:true,database,scope:receipt.scope}));
 for(const {pkg,dir,contentHash} of packages){
  // Recheck live IDs immediately before mutating this course.
  assert(!(await request('/api/admin/expression-courses')).courses.some(c=>c.courseId===pkg.courseId),'Concurrent target course detected');
  for(const asset of pkg.assets){
   const uploaded=await request('/api/admin/expression-assets',{assetId:asset.assetId,mimeType:asset.mimeType,base64:fs.readFileSync(path.join(dir,asset.localFile)).toString('base64')});
   assert.equal(uploaded.sha256,asset.sha256);assert.equal(uploaded.size,asset.size);
  }
  const entry={courseId:pkg.courseId,contentHash,createRequestId:crypto.randomUUID(),publishRequestId:crypto.randomUUID(),status:'creating-draft'};
  receipt.releases.push(entry);save();
  const draft=await request('/api/admin/expression-drafts',{package:pkg,requestId:entry.createRequestId});entry.draftId=draft.draftId;save();
  const route='/api/admin/expression-drafts/'+encodeURIComponent(draft.draftId);
  const checked=await request(route+'/validate',{});assert.equal(checked.valid,true,JSON.stringify(checked.errors));assert.equal(checked.contentHash,contentHash);
  await request(route+'/review',{contentHash});
  entry.status='publishing';save();
  const result=await request(route+'/publish',{expectedRevision:draft.revision,contentHash,requestId:entry.publishRequestId});
  entry.releaseId=result.releaseId;entry.status='published';save();
  const current=(await request('/api/admin/expression-courses')).courses.find(c=>c.courseId===pkg.courseId);
  assert.equal(current.releaseId,result.releaseId);assert.deepEqual(current.package,pkg);entry.verified=true;save();
 }
 const after=(await request('/api/admin/expression-courses')).courses;
 for(const original of before){const current=after.find(c=>c.courseId===original.courseId);assert(current);assert.equal(current.releaseId,original.releaseId);assert.deepEqual(current.package,original.package);}
 assert.equal(after.length,before.length+3);
 receipt.status='published-and-verified';receipt.existingCoursesUnchanged=true;receipt.noAccountEndpointsUsed=true;save();
 console.log(JSON.stringify({status:receipt.status,releases:receipt.releases.map(({courseId,releaseId,verified})=>({courseId,releaseId,verified})),receipt:receiptFile,backup:backupPath},null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
