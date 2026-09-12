'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {spawn}=require('child_process');
const port=require('../e2e/lib/free-port').freePort(9400,100),base='http://127.0.0.1:'+port;
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cl-batch-version-'));
let server,count=0;
function check(label,value){assert.ok(value,label);count++;console.log('  ✓ '+label);}
async function request(token,method,body){
  if(body!==undefined)body=Object.assign({mem:{}},body);
  const response=await fetch(base+'/api/data',{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,body:await response.json()};
}
(async()=>{try{
  server=spawn(process.execPath,['index.js'],{cwd:__dirname,env:{...process.env,PORT:String(port),CHUNKLAB_DATA_DIR:temp,REQUIRE_AUTH:'true',JWT_SECRET:require('crypto').randomBytes(32).toString('hex'),NODE_ENV:'test'},stdio:'ignore'});
  let ready=false;
  for(let i=0;i<60;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch(_){}if(ready)break;await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready);
  async function register(username){const r=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'test-password'})});assert.ok(r.ok);return (await r.json()).token;}
  const a=await register('batch-alice'),b=await register('batch-bob');
  let before=(await request(a,'GET')).body;
  const first=await request(a,'PUT',{baseSeq:before.seq,statsDelta:{sbs:{sentence:{times:1}},evs:[{id:'event-a',at:1}]}});
  check('基线一致时返回已提交的版本号',first.status===200 && first.body.seq>before.seq);
  const stale=await request(a,'PUT',{baseSeq:before.seq,mem:{decks:[{id:'must-not-write',name:'blocked',items:[]}]},statsDelta:{sbs:{sentence:{times:99}},evs:[{id:'must-not-append',at:2}]},entityDelta:{mastered:{up:{'must-not-master':1}}}});
  check('旧基线即使携带不同实体也整批拒绝',stale.status===409 && stale.body.conflicts[0].reason==='BASE_SEQ_MISMATCH');
  const after=(await request(a,'GET')).body;
  check('拒绝后数据和版本号均不变化',JSON.stringify(after)===JSON.stringify((await request(a,'GET')).body) && after.seq===first.body.seq && after.mem.stats.bySentence.sentence.times===1 && !after.mem.decks.some(d=>d.id==='must-not-write') && !after.mem.stats.events.some(e=>e.id==='must-not-append') && !after.mem.mastered['must-not-master']);
  const removed=await request(a,'PUT',{baseSeq:after.seq,statsDelta:{sbsGone:['sentence']}});
  check('按已读版本删除成功',removed.status===200);
  const resurrect=await request(a,'PUT',{baseSeq:after.seq,statsDelta:{sbs:{sentence:{times:2}}}});
  check('删除后的旧客户端写入不能复活记录',resurrect.status===409 && !(await request(a,'GET')).body.mem.stats.bySentence.sentence);
  const bob=await request(b,'GET');
  check('另一账号的版本空间独立', (await request(b,'PUT',{baseSeq:bob.body.seq,statsDelta:{sbs:{sentence:{times:3}}}})).status===200);
  for(const baseSeq of [-1,1.5,'1',null,Number.MAX_SAFE_INTEGER+1])check('非法基线拒绝：'+String(baseSeq),(await request(a,'PUT',{baseSeq})).status===400);
  const latest=(await request(a,'GET')).body.seq;
  const race=await Promise.all([request(a,'PUT',{baseSeq:latest,statsDelta:{sbs:{race:{times:1}}}}),request(a,'PUT',{baseSeq:latest,statsDelta:{sbs:{race:{times:2}}}})]);
  check('并发提交同一基线只能有一方成功',race.filter(r=>r.status===200).length===1 && race.filter(r=>r.status===409).length===1);
  let current=(await request(a,'GET')).body;
  const retryBody={baseSeq:current.seq,requestId:'receipt-test-01',statsDelta:{sbs:{receipt:{times:4}}}};
  const committed=await request(a,'PUT',retryBody);
  check('带回执请求首次提交成功',committed.status===200);
  const next=await request(a,'PUT',{baseSeq:committed.body.seq,statsDelta:{sbs:{receipt:{times:5}}}});
  const retry=await request(a,'PUT',retryBody);
  check('其他写入后重试仍返回原回执，不覆盖新值',retry.status===200 && retry.body.seq===committed.body.seq && (await request(a,'GET')).body.mem.stats.bySentence.receipt.times===5 && (await request(a,'GET')).body.seq===next.body.seq);
  const reused=await request(a,'PUT',{...retryBody,statsDelta:{sbs:{receipt:{times:99}}}});
  check('同请求编号不同内容被拒绝',reused.status===409 && reused.body.conflicts[0].reason==='REQUEST_ID_REUSED');
  current=(await request(a,'GET')).body;
  const broken={baseSeq:current.seq,requestId:'rollback-receipt',mem:{decks:[{id:'rollback-deck',name:'must rollback',items:[]}]},statsDelta:{sbs:{broken:{times:1}},evs:[{id:{},at:1}]}};
  // Use a statement failure after deck/stat writes, not a validation rejection.
  const Database=require('better-sqlite3'),db=new Database(path.join(temp,'chunklab.db'));
  try{db.exec("CREATE TRIGGER test_abort_event BEFORE INSERT ON user_events WHEN NEW.id='[object Object]' BEGIN SELECT RAISE(ABORT, 'test failure'); END;");
    const failed=await request(a,'PUT',broken);
    const unchanged=(await request(a,'GET')).body;
    check('事务中途失败时题库、学习记录和版本全部回滚',failed.status===500 && unchanged.seq===current.seq && !unchanged.mem.decks.some(d=>d.id==='rollback-deck') && !unchanged.mem.stats.bySentence.broken);
    check('失败事务不留下成功回执',db.prepare('SELECT COUNT(*) AS n FROM user_batch_receipts WHERE request_id=?').get('rollback-receipt').n===0);
  }finally{db.exec('DROP TRIGGER IF EXISTS test_abort_event');db.close();}
  check('失败后原请求可完整重试',(await request(a,'PUT',broken)).status===200);
  for(const requestId of ['',null,'short','x'.repeat(81)])check('非法请求编号拒绝：'+String(requestId).slice(0,8),(await request(a,'PUT',{baseSeq:0,requestId})).status===400);
  check('无基线不能请求幂等回执',(await request(a,'PUT',{requestId:'no-base-receipt'})).status===400);
  let seq=(await request(a,'GET')).body.seq;
  for(let i=0;i<257;i++){
    const result=await request(a,'PUT',{baseSeq:seq,requestId:'bounded-receipt-'+i});
    assert.equal(result.status,200);seq=result.body.seq;
  }
  const bounded=new Database(path.join(temp,'chunklab.db'));
  try{check('每账号回执历史不超过256条',bounded.prepare('SELECT COUNT(*) AS n FROM user_batch_receipts WHERE user_id=(SELECT id FROM users WHERE username=?)').get('batch-alice').n===256);}finally{bounded.close();}
  check('已淘汰回执的旧请求被拒绝而非重写',(await request(a,'PUT',retryBody)).status===409 && (await request(a,'GET')).body.seq===seq);
  const bobSeq=(await request(b,'GET')).body.seq;
  check('相同请求编号在不同账号下互不影响',(await request(b,'PUT',{baseSeq:bobSeq,requestId:'bounded-receipt-256'})).status===200);
  console.log('[batch-version] '+count+' passed; conditional batch contract verified');
}finally{
  if(server && server.exitCode===null){const ended=new Promise(r=>server.once('exit',r));server.kill();await ended;}
  fs.rmSync(temp,{recursive:true,force:true});
}})().catch(e=>{console.error(e);process.exitCode=1;});
