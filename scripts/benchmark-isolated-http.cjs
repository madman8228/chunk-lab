'use strict';
// Bounded synthetic burst test. No target URL/data-directory options by design.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{performance}=require('node:perf_hooks');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'chunklab-http-burst-'));
const port=require('../e2e/lib/free-port').freePort(12200,200),base='http://127.0.0.1:'+port;
const Database=require('../server/node_modules/better-sqlite3');
const quantile=(values,q)=>{const sorted=values.slice().sort((a,b)=>a-b);return Number((sorted[Math.max(0,Math.ceil(sorted.length*q)-1)]||0).toFixed(2));};
let child,db,stderr='',token='',expectedAnswers=0;
const report={schemaVersion:1,startedAt:new Date().toISOString(),model:{concurrency:[1,4,8],roundsPerWorker:20,
  callsPerRound:['incremental read','answer write','visit heartbeat'],account:'one synthetic account, concurrent tabs/devices',
  excluded:['production hardware capacity','10,000 DAU prediction','3 Mbps bandwidth simulation','real user think time','browser rendering','large course library'],
  machine:{cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,memoryBytes:os.totalmem()}},phases:[]};
async function http(url,body,measure){
  const start=performance.now(),text=body===undefined?undefined:JSON.stringify(body);
  let response,raw='';
  try{
    response=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{...(token?{Authorization:'Bearer '+token}:{}),
      'Content-Type':'application/json',Accept:'application/vnd.chunklab.delta-receipt+json','Accept-Encoding':'gzip'},body:text,signal:AbortSignal.timeout(15000)});
    raw=await response.text();
    assert.equal(response.status,200,url+': '+raw.slice(0,160));
    return JSON.parse(raw);
  }finally{
    if(measure){measure.times.push(performance.now()-start);measure.uploadBytes+=text?Buffer.byteLength(text):0;
      measure.decodedBytes+=Buffer.byteLength(raw);measure.bodyBytes+=Number(response?.headers.get('content-length'))||Buffer.byteLength(raw);
      const status=String(response?.status||'network-error');measure.statuses[status]=(measure.statuses[status]||0)+1;}
  }
}
(async()=>{
  try{
    child=spawn(process.execPath,['server/index.js'],{cwd:root,windowsHide:true,stdio:['ignore','ignore','pipe'],env:{...process.env,
      CHUNKLAB_DATA_DIR:dir,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'test',REQUIRE_AUTH:'true',PHONE_AUTH_ENABLED:'false',CHUNKLAB_WRITE_PROTOCOL:'3',
      JWT_SECRET:crypto.randomBytes(40).toString('hex'),ADMIN_JWT_SECRET:crypto.randomBytes(40).toString('hex'),MEMBERSHIP_CONTENT_GRANT_KEY:crypto.randomBytes(32).toString('base64')}});
    child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-2000);});
    let ready=false;
    for(let i=0;i<150;i++){
      if(child.exitCode!==null)throw Error('isolated server exited: '+stderr);
      try{ready=(await fetch(base+'/api/health',{signal:AbortSignal.timeout(1000)})).ok;}catch(_){}
      if(ready)break;await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(ready,'isolated server ready');
    token=(await http('/api/auth/register',{username:'burst-synthetic',password:'SyntheticBurst2026!'})).token;
    assert.ok(token);
    await http('/api/operations',{protocol:3,requestId:'burst-course-create-0001',type:'deck.put',expectedRev:null,
      payload:{deck:{id:'burst-deck',name:'Synthetic burst test',items:[{cid:'one',sentence:'Synthetic sentence.',translation:'合成测试句',chunks:['Synthetic','sentence.'],hints:['合成','句子']}]}}});
    for(const concurrency of report.model.concurrency){
      const routes={};for(const key of ['read','answer','heartbeat'])routes[key]={times:[],uploadBytes:0,decodedBytes:0,bodyBytes:0,statuses:{}};
      const phase={concurrency,roundsPerWorker:20,routes,errors:[]},start=performance.now();
      let replay;
      const results=await Promise.allSettled(Array.from({length:concurrency},async(_,worker)=>{
        let seq=(await http('/api/data')).seq;
        for(let round=0;round<20;round++){
          const snapshot=await http('/api/data?since='+seq,undefined,routes.read);assert.ok(snapshot.seq>=seq);
          const id='isolated-burst-'+concurrency+'-'+worker+'-'+String(round).padStart(4,'0');
          const op={protocol:3,requestId:id,type:'learning.answer',payload:{eventId:id,key:'burst-deck#one',deckId:'burst-deck',
            ok:round%5!==0,occurredAt:Date.now(),sessionId:'burst-session-'+concurrency+'-'+worker,contentFingerprint:'synthetic-v1',firstAttempt:true,assisted:false}};
          const receipt=await http('/api/operations',op,routes.answer);assert.equal(receipt.ok,true);assert.ok(receipt.seq>snapshot.seq);
          expectedAnswers++;seq=snapshot.seq; // Next read includes this write and any concurrent writes; never skip unseen data.
          replay={op,seq:receipt.seq};
          await http('/api/usage/heartbeat',{},routes.heartbeat);
        }
      }));
      phase.errors=results.filter(result=>result.status==='rejected').map(result=>String(result.reason?.message||result.reason));
      if(phase.errors.length)console.error('[worker errors]',JSON.stringify(phase.errors));
      phase.elapsedMs=Number((performance.now()-start).toFixed(2));
      const state=await http('/api/data');assert.equal(state.mem.stats.totalAnswered,expectedAnswers);
      assert.equal(state.mem.stats.bySentence['burst-deck#one']?.learningV1.evidence.length||0,expectedAnswers);
      if(replay){const repeated=await http('/api/operations',replay.op);assert.equal(repeated.seq,replay.seq);assert.equal((await http('/api/data')).seq,state.seq);}
      phase.expectedAnswers=expectedAnswers;
      for(const metric of Object.values(routes)){
        metric.requests=metric.times.length;metric.p50Ms=quantile(metric.times,.5);metric.p95Ms=quantile(metric.times,.95);metric.p99Ms=quantile(metric.times,.99);delete metric.times;
      }
      phase.measuredRequests=Object.values(routes).reduce((sum,value)=>sum+value.requests,0);
      phase.requestsPerSecond=Number((phase.measuredRequests/(phase.elapsedMs/1000)).toFixed(2));
      report.phases.push(phase);console.log('[isolated burst]',JSON.stringify(phase));
      if(phase.errors.length)break;
    }
    db=new Database(path.join(dir,'chunklab.db'),{readonly:true,fileMustExist:true});
    assert.equal(db.pragma('quick_check',{simple:true}),'ok');
    report.integrity='ok';report.expectedAnswers=expectedAnswers;
    report.completedAt=new Date().toISOString();
    const output=path.join(root,'output/performance');fs.mkdirSync(output,{recursive:true});
    const file=path.join(output,'isolated-http-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'.json');
    fs.writeFileSync(file,JSON.stringify(report,null,2),{flag:'wx'});console.log('[report]',file);
    assert.ok(report.phases.every(phase=>phase.errors.length===0),'all burst workers complete without errors');
  }finally{
    if(db)db.close();
    if(child&&child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(dir,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
