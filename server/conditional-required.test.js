'use strict';

/* Production contract smoke: fresh databases use protocol 3; legacy snapshot,
 * import and conditional-batch mutation routes stay closed. */
const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {spawn}=require('child_process');
const port=require('../e2e/lib/free-port').freePort(9450,100),base='http://127.0.0.1:'+port;
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cl-conditional-required-'));
let server;
async function request(token,method,path,payload){
  const res=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload)});
  return {status:res.status,json:await res.json()};
}
async function main(){
  server=spawn(process.execPath,['index.js'],{cwd:__dirname,env:{...process.env,NODE_ENV:'production',PORT:String(port),CHUNKLAB_DATA_DIR:temp,REQUIRE_AUTH:'true',JWT_SECRET:'conditional-required-test-secret'},stdio:'ignore'});
  try{
    let ready=false;
    for(let i=0;i<60;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch(_){}if(ready)break;await new Promise(r=>setTimeout(r,100));}
    assert.ok(ready,'server did not start');
    const config=await fetch(base+'/api/config').then(response=>response.json());
    assert.equal(config.writeProtocol,3);
    assert.equal(config.persistenceMode,'server-authoritative');
    const reg=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'strict-test',password:'test-password'})});
    assert.equal(reg.status,200);const token=(await reg.json()).token;
    let r=await request(token,'GET','/api/data');
    const batch=await request(token,'GET','/api/sync/batch');
    assert.equal(batch.status,200);
    assert.equal(batch.json.kind,'batch');
    assert.equal(batch.json.seq,r.json.seq);
    assert.match(batch.json.token,/^[a-f0-9]{64}$/);
    assert.deepEqual(batch.json.snapshot.mem.decks,[]);
    for(const [label,method,payload] of [
      ['PUT data','PUT','/api/data'],
      ['POST import','POST','/api/import'],
    ]){const out=await request(token,method,payload,payload==='/api/data'?{}:{mem:{}});assert.equal(out.status,428,label);assert.equal(out.json.code,'CLIENT_UPDATE_REQUIRED',label);}
    r=await request(token,'POST','/api/courses',{course:{courseId:'legacy-course',title:'legacy'}});
    assert.equal(r.status,428);
    r=await request(token,'DELETE','/api/courses/legacy-course');
    assert.equal(r.status,428);
    const conditionalSnapshot=await request(token,'PUT','/api/data',{
      mem:{},baseSeq:r.json.seq,requestId:'strict-conditional-snapshot-01'
    });
    assert.equal(conditionalSnapshot.status,428,'even versioned account snapshots are closed in protocol 3');
    assert.equal(conditionalSnapshot.json.code,'CLIENT_UPDATE_REQUIRED');
    const legacyBatchWrite=await request(token,'POST','/api/sync/batch/resolve',{
      baseSeq:r.json.seq,requestId:'strict-legacy-batch-01',snapshot:{mem:{}}
    });
    assert.equal(legacyBatchWrite.status,428,'legacy conditional batch resolution is closed in protocol 3');
    assert.equal(legacyBatchWrite.json.code,'CLIENT_UPDATE_REQUIRED');
    const operation=await request(token,'POST','/api/operations',{
      protocol:3,requestId:'strict-p3-resume-01',type:'learning.resume',
      payload:{deckId:'resume-deck',sessionId:'strict_resume_session_01',generation:0,idx:0,contentCursor:'start',practiceMode:'chunkSelection'}
    });
    assert.equal(operation.status,200,'the operation-based write path remains available');
    const dataAfter=await request(token,'GET','/api/data');
    assert.equal(dataAfter.json.learningResumes.strict_resume_session_01.idx,0);
    console.log('[conditional-required] production protocol-3 mutation guards passed');
  }finally{
    if(server && server.exitCode===null){const ended=new Promise(resolve=>server.once('exit',resolve));server.kill();await ended;}
    fs.rmSync(temp,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
