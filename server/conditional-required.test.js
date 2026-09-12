'use strict';

/* Production contract smoke: the old unconditional mutation routes must be
 * closed while the conditional batch route remains usable. */
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
    const reg=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'strict-test',password:'test-password'})});
    assert.equal(reg.status,200);const token=(await reg.json()).token;
    let r=await request(token,'GET','/api/data');
    const seq=r.json.seq;
    const batch=await request(token,'GET','/api/sync/batch');
    assert.equal(batch.status,200);
    assert.equal(batch.json.kind,'batch');
    assert.equal(batch.json.seq,seq);
    assert.match(batch.json.token,/^[a-f0-9]{64}$/);
    assert.deepEqual(batch.json.snapshot.mem.decks,[]);
    for(const [label,method,payload] of [
      ['PUT data','PUT','/api/data'],
      ['POST import','POST','/api/import'],
    ]){const out=await request(token,method,payload,payload==='/api/data'?{}:{mem:{}});assert.equal(out.status,428,label);assert.equal(out.json.code,'CLIENT_UPGRADE_REQUIRED',label);}
    r=await request(token,'POST','/api/courses',{course:{courseId:'legacy-course',title:'legacy'}});
    assert.equal(r.status,428);
    r=await request(token,'DELETE','/api/courses/legacy-course');
    assert.equal(r.status,428);
    const seed=await request(token,'PUT','/api/data',{mem:{decks:[{id:'publish-deck',name:'Publish',items:[]}]},baseSeq:seq,requestId:'strict-seed-01'});
    assert.equal(seed.status,200);
    r=await request(token,'POST','/api/deck/publish',{deckId:'publish-deck',publish:true});
    assert.equal(r.status,428);
    r=await request(token,'GET','/api/data');
    const published=await request(token,'POST','/api/deck/publish',{deckId:'publish-deck',publish:true,baseSeq:r.json.seq,requestId:'strict-publish-01'});
    assert.equal(published.status,200);assert.equal(published.json.isPublic,true);
    r=await request(token,'GET','/api/data');
    const currentDeckRev=r.json.revs.decks['publish-deck'];
    const deleted=await request(token,'PUT','/api/data',{
      mem:{decks:[]},
      deleted:{decks:[{id:'publish-deck',rev:currentDeckRev+1}]},
      revs:{decks:{'publish-deck':currentDeckRev+1}},
      baseRevs:{decks:{'publish-deck':currentDeckRev}},
      baseSeq:r.json.seq,
      requestId:'strict-delete-01'
    });
    assert.equal(deleted.status,200);
    const publicAfterDelete=await fetch(base+'/api/deck/public/publish-deck');
    assert.equal(publicAfterDelete.status,404,'deleted deck must no longer be public');
    console.log('[conditional-required] production mutation guards passed');
  }finally{
    if(server && server.exitCode===null){const ended=new Promise(resolve=>server.once('exit',resolve));server.kill();await ended;}
    fs.rmSync(temp,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
