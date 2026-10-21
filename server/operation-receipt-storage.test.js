'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),Database=require('better-sqlite3');
const {encodeReceipt}=require('./services/operation-receipt-storage');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'chunklab-receipt-storage-'));
const port=require('../e2e/lib/free-port').freePort(12100,100),base='http://127.0.0.1:'+port;
let child,db;
(async()=>{
  try{
    child=spawn(process.execPath,['server/index.js'],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,
      CHUNKLAB_DATA_DIR:dir,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'test',REQUIRE_AUTH:'true',PHONE_AUTH_ENABLED:'false',CHUNKLAB_WRITE_PROTOCOL:'3',
      JWT_SECRET:crypto.randomBytes(40).toString('hex'),ADMIN_JWT_SECRET:crypto.randomBytes(40).toString('hex'),MEMBERSHIP_CONTENT_GRANT_KEY:crypto.randomBytes(32).toString('base64')}});
    let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch(_){}if(ready)break;await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
    async function register(username){const response=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'SyntheticStorage2026!'})});assert.equal(response.status,200);return response.json();}
    const account=await register('storage-one'),other=await register('storage-two');
    db=new Database(path.join(dir,'chunklab.db'));const userId=db.prepare('SELECT id FROM users WHERE username=?').get('storage-one').id;
    async function send(body,token=account.token){const response=await fetch(base+'/api/operations',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});return{status:response.status,body:await response.json()};}
    const answer={protocol:3,requestId:'storage-request-answer-0001',type:'learning.answer',payload:{eventId:'storage-event-answer-0001',key:'synthetic#one',deckId:'synthetic',ok:true}};
    const first=await send(answer);assert.equal(first.status,200);
    const selected=()=>db.prepare('SELECT * FROM user_operation_receipts WHERE user_id=? AND request_id=?').get(userId,answer.requestId);
    const original=selected();assert.ok(JSON.parse(original.result_json)._receiptBody);
    const eventRow=db.prepare('SELECT * FROM user_operation_events WHERE user_id=? AND event_id=?').get(userId,answer.payload.eventId);
    assert.equal(JSON.parse(eventRow.result_json).receiptReference,1);assert.ok(eventRow.result_json.length<160);
    assert.deepEqual((await send(answer)).body,{...first.body,duplicate:true});
    const alias={...answer,requestId:'storage-request-alias-0001'};
    const replay=await send(alias);assert.equal(replay.status,200);assert.equal(replay.body.outcome,'already-applied');
    assert.deepEqual(replay.body.changes,first.body.changes);assert.deepEqual(replay.body.operation,first.body.operation);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_learning_events WHERE user_id=?').get(userId).n,1);
    assert.equal((await send({...answer,payload:{...answer.payload,ok:false}})).body.code,'REQUEST_ID_REUSED');
    assert.equal((await send({...alias,requestId:'storage-event-hash-conflict',payload:{...answer.payload,ok:false}})).body.code,'EVENT_ID_REUSED');
    const fetched=await fetch(base+'/api/operations/'+answer.requestId,{headers:{Authorization:'Bearer '+account.token}});
    assert.deepEqual(await fetched.json(),first.body,'HTTP receipt lookup restores the exact original result');
    assert.equal((await fetch(base+'/api/operations/'+answer.requestId,{headers:{Authorization:'Bearer '+other.token}})).status,404);
    assert.equal((await send(answer,other.token)).status,200,'the same IDs belong to independent account namespaces');
    // Convert only newly allocated synthetic rows to the legacy format, not production data.
    const update=db.prepare('UPDATE user_operation_receipts SET result_json=? WHERE user_id=? AND request_id=?');
    update.run(JSON.stringify(first.body),userId,answer.requestId);
    db.prepare('UPDATE user_operation_events SET result_json=? WHERE user_id=? AND event_id=?').run(JSON.stringify(first.body),userId,answer.payload.eventId);
    const oldAlias=await send({...answer,requestId:'storage-legacy-event-retry'});
    assert.equal(oldAlias.status,200);assert.deepEqual(oldAlias.body.changes,first.body.changes);
    assert.deepEqual((await send(answer)).body,{...first.body,duplicate:true},'plain legacy request replay remains valid');
    assert.equal(selected().result_json,JSON.stringify(first.body),'reading old receipts never rewrites them');
    // Restore the new format and damage it. An existing corrupt receipt must
    // block replay, never cause a fresh application or a missing-record guess.
    update.run(original.result_json,userId,answer.requestId);
    db.prepare('UPDATE user_operation_events SET result_json=? WHERE user_id=? AND event_id=?').run(eventRow.result_json,userId,answer.payload.eventId);
    const damaged=JSON.parse(original.result_json);damaged._receiptBody.data='corrupt';
    update.run(JSON.stringify(damaged),userId,answer.requestId);
    assert.equal((await send(answer)).body.code,'OPERATION_RECEIPT_CORRUPT');
    assert.equal((await send({...answer,requestId:'storage-corrupt-event-retry'})).body.code,'OPERATION_RECEIPT_CORRUPT');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_learning_events WHERE user_id=?').get(userId).n,1);
    update.run(original.result_json,userId,answer.requestId);
    const badMarker={receiptReference:1,requestId:'no-such-source-request',seq:first.body.seq};
    db.prepare('UPDATE user_operation_events SET operation_id=?,result_json=? WHERE user_id=? AND event_id=?')
      .run(badMarker.requestId,JSON.stringify(badMarker),userId,answer.payload.eventId);
    assert.equal((await send({...answer,requestId:'storage-missing-source-retry'})).body.code,'OPERATION_RECEIPT_CORRUPT');
    db.prepare('UPDATE user_operation_events SET operation_id=?,result_json=? WHERE user_id=? AND event_id=?')
      .run(eventRow.operation_id,eventRow.result_json,userId,answer.payload.eventId);
    // Trigger failure after the canonical receipt insert: all state and the
    // reference must roll back together, retaining the right to retry the ID.
    const beforeSeq=db.prepare('SELECT seq FROM user_change_seq WHERE user_id=?').get(userId).seq;
    db.exec("CREATE TRIGGER fail_synthetic_event BEFORE INSERT ON user_operation_events WHEN NEW.event_id='storage-rollback-event-001' BEGIN SELECT RAISE(ABORT,'synthetic rollback'); END");
    const rollback={...answer,requestId:'storage-rollback-request-001',payload:{...answer.payload,eventId:'storage-rollback-event-001'}};
    assert.equal((await send(rollback)).status,500);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_operation_receipts WHERE user_id=? AND request_id=?').get(userId,rollback.requestId).n,0);
    assert.equal(db.prepare('SELECT seq FROM user_change_seq WHERE user_id=?').get(userId).seq,beforeSeq);
    db.exec('DROP TRIGGER fail_synthetic_event');assert.equal((await send(rollback)).status,200);
    // The direct JSON metadata queries used by old wordbook-session recovery
    // still see their fields, even when the large delta is compressed.
    const vocabulary={ok:true,seq:99,operation:{action:'start',bookId:'synthetic-book',sessionId:'synthetic-session'},changes:{payload:'unchanged'.repeat(2000)}};
    assert.deepEqual(db.prepare("SELECT json_extract(?,'$.operation.action') AS action,json_extract(?,'$.seq') AS seq").get(encodeReceipt(vocabulary),encodeReceipt(vocabulary)),{action:'start',seq:99});
    assert.equal(db.pragma('quick_check',{simple:true}),'ok');
    console.log('receipt storage HTTP/SQLite: compressed lookup, event references, legacy no-rewrite, exact retry, hashes/accounts, corrupt/missing-source refusal and atomic rollback passed');
  }finally{
    if(db)db.close();if(child&&child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(dir,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
