'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'chunklab-payload-budget-'));
const port=require('../e2e/lib/free-port').freePort(11700,100),base='http://127.0.0.1:'+port;
let child;
(async()=>{
  try{
    child=spawn(process.execPath,['server/index.js'],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,
      CHUNKLAB_DATA_DIR:dir,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'test',REQUIRE_AUTH:'true',PHONE_AUTH_ENABLED:'false',CHUNKLAB_WRITE_PROTOCOL:'3',
      JWT_SECRET:crypto.randomBytes(40).toString('hex'),ADMIN_JWT_SECRET:crypto.randomBytes(40).toString('hex'),MEMBERSHIP_CONTENT_GRANT_KEY:crypto.randomBytes(32).toString('base64')}});
    let ready=false;
    for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch(_){}if(ready)break;await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
    const registered=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'payload-test',password:'SyntheticPayload2026!'})});
    assert.equal(registered.status,200);const {token}=await registered.json();
    async function execute(body,compact=false){
      const json=JSON.stringify(body),response=await fetch(base+'/api/operations',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,
        ...(compact?{Accept:'application/vnd.chunklab.delta-receipt+json'}:{})},body:json});
      const text=await response.text();assert.equal(response.status,200,text.slice(0,120));
      return{result:JSON.parse(text),up:Buffer.byteLength(json),down:Buffer.byteLength(text)};
    }
    await execute({protocol:3,requestId:'payload-unrelated-deck-0001',type:'deck.put',expectedRev:null,payload:{deck:{id:'unrelated-content',name:'Synthetic unrelated course',
      items:Array.from({length:200},(_,i)=>({cid:'unrelated-'+i,sentence:'Unchanged teaching content '+i,chunks:['Unchanged','teaching content '+i],hints:['不变','教学内容']}))}}});
    const sizes=[];let lastOperation;
    for(let index=0;index<30;index++){
      const id='payload-answer-'+String(index).padStart(4,'0');
      lastOperation={protocol:3,requestId:id,type:'learning.answer',payload:{eventId:id,deckId:'synthetic-practice',key:'synthetic-practice#one',
        sessionId:'synthetic-payload-session',generation:0,occurredAt:Date.now(),timeZone:'UTC',mode:'typing',contentFingerprint:'synthetic-fixed-version',
        policyVersion:1,ok:true,assisted:false,firstAttempt:true,earlyPractice:false,chunkRight:2,chunkTotal:2,answerOrder:index}};
      const item=await execute(lastOperation);
      const delta=item.result.changes;
      assert.equal(delta.delta,true);assert.equal(delta.mem.decks.length,0,'unchanged course content never returns in an answer delta');
      assert.equal(delta.courses.length,0);assert.equal(Object.keys(delta.mem.stats.bySentence).length,1);
      assert.equal(delta.mem.stats.events.length,1,'append-only events are incremental, not whole event history');
      assert.ok(item.up<1000,'normal answer uploads one small event, not the whole learning archive');
      sizes.push({uploadBytes:item.up,decodedReceiptBytes:item.down,deltaBytes:Buffer.byteLength(JSON.stringify(delta)),
        repeatedOperationStatBytes:Buffer.byteLength(JSON.stringify(item.result.operation.stat)),
        evidenceCount:delta.mem.stats.bySentence['synthetic-practice#one'].learningV1.evidence.length});
    }
    const compact=await execute(lastOperation,true);
    assert.equal(Object.hasOwn(compact.result.operation,'stat'),false);assert.equal(compact.result.seq,31);
    assert.equal(compact.result.changes.mem.stats.bySentence['synthetic-practice#one'].learningV1.evidence.length,30);
    const historical=await(await fetch(base+'/api/operations/'+lastOperation.requestId,{headers:{Authorization:'Bearer '+token}})).json();
    assert.equal(historical.operation.stat.times,30,'original receipt remains available for recovery/legacy callers');
    console.log('sync payload budget (synthetic, decoded JSON): '+JSON.stringify({first:sizes[0],thirtieth:sizes[29],compactThirtiethBytes:compact.down}));
  }finally{
    if(child&&child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(dir,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
