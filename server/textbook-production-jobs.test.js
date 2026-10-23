'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createTextbookProduction}=require('./services/textbook-production');
test('background status worker returns a snapshot through IPC',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'production-status-test-'));
 try{
  const sources=path.join(root,'sources');fs.mkdirSync(sources);const catalog=path.join(root,'catalog.json');fs.writeFileSync(catalog,JSON.stringify({assets:[],bindings:Array.from({length:500},(_,i)=>({course:'fixture-'+i+'-'+('x'.repeat(500))}))}));
  const service=createTextbookProduction({config:{appRoot:path.resolve(__dirname,'..'),sourceRoot:sources,packageRoot:path.join(root,'packages'),dataRoot:path.join(root,'data'),catalogFile:catalog,reviewFile:path.join(root,'review.json')}});
  const result=await service.status();assert.equal(result.totals.books,0);assert.equal(result.imageOnly.length,500,'large IPC snapshots must be fully delivered before disconnect');assert.deepEqual(result.jobs,[]);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('interrupted jobs retain progress and hide private configuration',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'production-job-test-'));
 try{
  const dir=path.join(root,'textbook-production-jobs');fs.mkdirSync(dir);
  const id=crypto.randomUUID(),file=path.join(dir,id+'.json');
  fs.writeFileSync(file,JSON.stringify({id,status:'running',pid:2147483647,createdAt:new Date().toISOString(),results:[{status:'staged',importId:'preserved'}],config:{sourceRoot:'private'}}));
  const service=createTextbookProduction({config:{dataRoot:root}}),saved=service.job(id);
  assert.equal(saved.status,'failed');assert.equal(saved.config,undefined);assert.equal(saved.results[0].importId,'preserved');
  assert.equal(JSON.parse(fs.readFileSync(file)).config.sourceRoot,'private');assert.throws(()=>service.job('../state'),/编号无效/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
