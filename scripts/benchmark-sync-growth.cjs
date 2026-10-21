'use strict';
// Opt-in long-running benchmark, deliberately not part of the default *.test suite.
// All writes target newly allocated temporary databases; reports contain sizes/timings only.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{performance}=require('node:perf_hooks');
const root=path.resolve(__dirname,'..'),Database=require('../server/node_modules/better-sqlite3');
const {MistakeEvidence}=require('../js/mistake-evidence.cjs');
const {createSnapshotReader}=require('../server/services/data-snapshot');
function option(name,fallback){const value=process.argv.find(arg=>arg.startsWith('--'+name+'='));return value?Number(value.split('=')[1]):fallback;}
const days=option('days',365),answers=option('answers',20),pool=option('pool',1000);
const evidenceDelta=process.argv.includes('--evidence-delta');
const {evidenceHash}=require('../server/services/receipt-evidence-delta');
const scenarioOption=process.argv.find(arg=>arg.startsWith('--scenario='))?.split('=')[1];
assert.ok(!scenarioOption||['rotation','daily-hotspot'].includes(scenarioOption),'unsupported synthetic scenario');
for(const [value,max]of[[days,365],[answers,50],[pool,2000]])assert.ok(Number.isInteger(value)&&value>=1&&value<=max,'benchmark parameter outside bounded range');
const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'chunklab-sync-growth-'));
const checkpoints=[...new Set([30,100,365,days].filter(day=>day<=days))].sort((a,b)=>a-b);
const report={schemaVersion:1,startedAt:new Date().toISOString(),assumptions:{days,answersPerDay:answers,pool,checkpoints,evidenceDelta,errorRate:'approximately 10%',
  scenarios:scenarioOption?[scenarioOption]:['rotation','daily-hotspot'],dates:'accelerated historical occurredAt timestamps, ending yesterday; receivedAt remains real execution time',
  excluded:['concurrency/load capacity','browser paint and memory','usage/trial heartbeats','real server 2c2g hardware'],
  machine:{cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem()}},scenarios:[]};
const quantile=(values,q)=>{const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(sorted.length*q)-1)]||0;};
const timeStats=values=>({samples:values.length,medianMs:+quantile(values,.5).toFixed(2),p95Ms:+quantile(values,.95).toFixed(2),maxMs:+Math.max(0,...values).toFixed(2)});
function sumFiles(dir){return fs.readdirSync(dir).filter(name=>/^chunklab\.db(?:-wal|-shm)?$/.test(name)).reduce((sum,name)=>sum+fs.statSync(path.join(dir,name)).size,0);}
async function scenario(name){
  const dir=path.join(workspace,name);fs.mkdirSync(dir);
  const port=require('../e2e/lib/free-port').freePort(11900,200),base='http://127.0.0.1:'+port;
  let child,db,stderr='';
  try{
    child=spawn(process.execPath,['server/index.js'],{cwd:root,windowsHide:true,stdio:['ignore','ignore','pipe'],env:{...process.env,
      CHUNKLAB_DATA_DIR:dir,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'test',REQUIRE_AUTH:'true',PHONE_AUTH_ENABLED:'false',CHUNKLAB_WRITE_PROTOCOL:'3',
      JWT_SECRET:crypto.randomBytes(40).toString('hex'),ADMIN_JWT_SECRET:crypto.randomBytes(40).toString('hex'),MEMBERSHIP_CONTENT_GRANT_KEY:crypto.randomBytes(32).toString('base64')}});
    child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-2000);});
    let ready=false;for(let i=0;i<150;i++){
      if(child.exitCode!==null)throw Error('isolated server exited: '+stderr);
      try{ready=(await fetch(base+'/api/health')).ok;}catch(_){}if(ready)break;await new Promise(resolve=>setTimeout(resolve,100));
    }assert.ok(ready,'isolated server starts');
    const signup=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'growth-'+name,password:'SyntheticGrowth2026!'})});
    assert.equal(signup.status,200);const {token}=await signup.json();
    db=new Database(path.join(dir,'chunklab.db'),{readonly:true,fileMustExist:true});
    const userId=db.prepare('SELECT id FROM users WHERE username=?').get('growth-'+name).id;
    const currentSeq=id=>db.prepare('SELECT seq FROM user_change_seq WHERE user_id=?').get(id)?.seq||0;
    const reader=createSnapshotReader({db,currentSeq});
    const headers={Authorization:'Bearer '+token,'Accept-Encoding':'gzip',Accept:'application/vnd.chunklab.delta-receipt+json'};
    async function http(url,body){
      const sent=body?JSON.stringify(body):undefined,start=performance.now();
      const response=await fetch(base+url,{method:body?'POST':'GET',headers:{...headers,...(body?{'Content-Type':'application/json'}:{}),
        ...(body&&evidenceDelta?{Accept:'application/vnd.chunklab.evidence-delta+json; base-seq='+seq}:{})},body:sent,signal:AbortSignal.timeout(30000)});
      const text=await response.text();assert.equal(response.status,200,text.slice(0,200));
      return{body:JSON.parse(text),uploadBytes:sent?Buffer.byteLength(sent):0,decodedBytes:Buffer.byteLength(text),
        transferBodyBytes:Number(response.headers.get('content-length'))||Buffer.byteLength(text),encoding:response.headers.get('content-encoding')||'identity',elapsedMs:performance.now()-start};
    }
    let seq=0;const latencies=[],mistakes=new Map(),evidenceByKey=new Map(),totals={requests:0,uploadBytes:0,decodedResponseBytes:0,transferResponseBodyBytes:0};
    async function operation(type,payload,id,track=true){
      const result=await http('/api/operations',{protocol:3,requestId:id,type,payload,...(type==='deck.put'?{expectedRev:null}:{})});
      const receipt=result.body;assert.equal(receipt.ok,true);assert.equal(receipt.seq,seq+1,'continuous single-user sequence');seq=receipt.seq;
      assert.equal(receipt.changes.seq,seq);assert.equal(receipt.changes.delta,true);
      if(track){latencies.push(result.elapsedMs);totals.requests++;totals.uploadBytes+=result.uploadBytes;totals.decodedResponseBytes+=result.decodedBytes;totals.transferResponseBodyBytes+=result.transferBodyBytes;}
      if(type==='learning.answer'){
        assert.equal(receipt.changes.mem.decks.length,0);assert.equal(receipt.changes.mem.stats.events.length,1);
        assert.equal(Object.hasOwn(receipt.operation,'stat'),false);assert.equal(Object.keys(receipt.changes.mem.stats.bySentence).length,1);
        const key=payload.key,learning=receipt.changes.mem.stats.bySentence[key].learningV1,patch=learning.evidenceDelta;
        if(patch){
          const before=evidenceByKey.get(key)||[];assert.equal(patch.previousHash,evidenceHash(before));assert.equal(patch.previousCount,before.length);
          const next=before.concat(patch.append).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
          assert.equal(patch.nextHash,evidenceHash(next));assert.equal(patch.nextCount,next.length);evidenceByKey.set(key,next);
        }else evidenceByKey.set(key,learning.evidence);
      }
      return result;
    }
    const deckId='growth-deck',items=Array.from({length:pool+1},(_,i)=>({cid:'item-'+i,sentence:'Practice sentence '+i+'.',translation:'合成句子'+i,chunks:['Practice','sentence '+i+'.'],hints:['练习','句子']}));
    await operation('deck.put',{deck:{id:deckId,name:'Synthetic growth course',items}},'growth-create-course-0001',false);
    const rows=[],oneDay=86400000,startDate=Math.floor(Date.now()/oneDay)*oneDay-days*oneDay+3600000;
    let lastSeqBeforeDay=seq,lastAnswer,firstAnswer;
    for(let day=1;day<=days;day++){
      lastSeqBeforeDay=seq;const session='growth-session-'+name+'-'+String(day).padStart(4,'0'),at=startDate+(day-1)*oneDay;
      await operation('learning.resume',{deckId,courseId:deckId,sessionId:session,generation:0,idx:0,practiceMode:'typing'},session+'-resume');
      for(let index=0;index<answers;index++){
        const itemIndex=name==='daily-hotspot'&&index===0?0:1+(((day-1)*answers+index)%pool),item=items[itemIndex];
        const eventId=session+'-answer-'+String(index).padStart(2,'0'),ok=(day+index)%10!==0;
        const payload={eventId,key:deckId+'#'+item.cid,deckId,courseId:deckId,sessionId:session,generation:0,occurredAt:at+index*1000,
          timeZone:'Asia/Shanghai',mode:'typing',contentFingerprint:'synthetic-growth-v1',policyVersion:1,ok,assisted:false,firstAttempt:ok,
          earlyPractice:false,chunkRight:ok?2:1,chunkTotal:2,answerOrder:index};
        if(!ok){
          const key=deckId+'::'+item.sentence,prior=mistakes.get(key)||{_key:key,deckId,deckName:'Synthetic growth course',cid:item.cid,
            sentence:item.sentence,translation:item.translation,chunks:item.chunks,hints:item.hints,mistakes:[],needsReview:true};
          const row=MistakeEvidence.recordEvidence(prior,{eventId,at:payload.occurredAt,mode:'typing',hinted:false,revealed:false,needsReview:true,
            mistakes:[{chunkIdx:1,chunk:item.chunks[1],wrongAnswers:['synthetic incorrect answer'],wrongAttemptCount:1,hintUsed:false}]});
          mistakes.set(key,row);payload.mistake={key,row};
        }
        lastAnswer=await operation('learning.answer',payload,eventId);
        if(index===0)firstAnswer=lastAnswer;
      }
      await operation('learning.roundComplete',{eventId:session+'-complete',sessionId:session,deckId,answerCount:answers,recordBest:true,
        timeZone:'Asia/Shanghai',occurredAt:at+answers*1000},session+'-complete');
      if(day%10===0){assert.ok(sumFiles(dir)<1024*1024*1024,'temporary database exceeded 1 GiB safety ceiling');}
      if(!checkpoints.includes(day)){if(day%25===0)console.log('[growth] '+name+' '+day+'/'+days+' days');continue;}
      const full=await http('/api/data'),unchanged=await http('/api/data?since='+seq),oneDayBehind=await http('/api/data?since='+lastSeqBeforeDay);
      assert.equal(full.body.mem.stats.totalAnswered,day*answers);assert.equal(full.body.mem.stats.totalRounds,day);
      for(const [key,stat]of Object.entries(full.body.mem.stats.bySentence))assert.deepEqual(evidenceByKey.get(key),stat.learningV1.evidence,'incremental client history equals canonical full snapshot');
      assert.equal(Object.keys(full.body.mem.stats.daysLog).length,day);assert.equal(full.body.mem.stats.events.length,day*(answers+1));
      assert.equal(unchanged.body.mem.decks.length,0);assert.equal(unchanged.body.mem.stats.events.length,0);
      assert.equal(oneDayBehind.body.mem.stats.events.length,answers+1);assert.equal(oneDayBehind.body.mem.decks.length,0);
      const tables={};
      for(const [table,column]of[['user_operation_receipts','result_json'],['user_operation_events','result_json'],['user_learning_events','event_json'],
        ['user_sentence_stats','data_json'],['user_events','data_json'],['user_entity_rows','data_json']]){
        tables[table]=db.prepare('SELECT COUNT(*) AS rows,COALESCE(SUM(length(CAST('+column+' AS BLOB))),0) AS jsonBytes FROM '+table+' WHERE user_id=?').get(userId);
      }
      assert.equal(tables.user_learning_events.rows,day*answers);assert.equal(tables.user_operation_receipts.rows,1+day*(answers+2));
      const assembly={};for(const [kind,since]of[['full',null],['unchanged',seq],['oneDayBehind',lastSeqBeforeDay]]){
        const times=[];for(let attempt=0;attempt<7;attempt++){const began=performance.now();reader.readMemSnapshot(userId,since);times.push(performance.now()-began);}assembly[kind]=timeStats(times);
      }
      const hot=full.body.mem.stats.bySentence[deckId+'#item-0'];
      if(name==='daily-hotspot')assert.equal(hot.learningV1.evidence.length,day);
      const size=value=>({uploadBytes:value.uploadBytes,decodedBytes:value.decodedBytes,transferBodyBytes:value.transferBodyBytes,encoding:value.encoding,elapsedMs:+value.elapsedMs.toFixed(2)});
      const result={day,answers:day*answers,seq,answer:size(lastAnswer),firstAnswer:size(firstAnswer),fullStart:size(full),unchangedStart:size(unchanged),oneDayBehindStart:size(oneDayBehind),
        responseBreakdown:{statsBaseBytes:Buffer.byteLength(JSON.stringify({...unchanged.body.mem.stats,bySentence:undefined,events:undefined})),
          lastAnswerStatBytes:Buffer.byteLength(JSON.stringify(lastAnswer.body.changes.mem.stats.bySentence)),
          firstAnswerStatBytes:Buffer.byteLength(JSON.stringify(firstAnswer.body.changes.mem.stats.bySentence)),
          hotEvidenceEntries:hot?.learningV1.evidence.length||0},
        cumulative:{...totals},allWriteLatencies:timeStats(latencies),last100WriteLatencies:timeStats(latencies.slice(-100)),
        snapshotAssembly:assembly,tables,databaseAndWalBytes:sumFiles(dir)};
      rows.push(result);console.log('[growth checkpoint] '+JSON.stringify({scenario:name,...result}));
    }
    assert.equal(db.pragma('quick_check',{simple:true}),'ok');
    const plans={receipt:db.prepare('EXPLAIN QUERY PLAN SELECT result_json FROM user_operation_receipts WHERE user_id=? AND request_id=?').all(userId,'synthetic'),
      sentenceEvidence:db.prepare('EXPLAIN QUERY PLAN SELECT event_json FROM user_learning_events WHERE user_id=? AND sentence_key=? AND generation=?').all(userId,deckId+'#item-0',0)};
    return{name,checkpoints:rows,queryPlans:plans,integrity:'ok'};
  }finally{
    if(db)db.close();if(child&&child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}
  }
}
(async()=>{
  try{
    for(const name of report.assumptions.scenarios)report.scenarios.push(await scenario(name));
    report.completedAt=new Date().toISOString();
    const out=path.join(root,'output/performance');fs.mkdirSync(out,{recursive:true});
    const file=path.join(out,'sync-growth-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'.json');
    fs.writeFileSync(file,JSON.stringify(report,null,2),{flag:'wx'});console.log('[growth report] '+file);
  }finally{
    assert.ok(path.resolve(workspace).startsWith(path.resolve(os.tmpdir())+path.sep));
    fs.rmSync(workspace,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
