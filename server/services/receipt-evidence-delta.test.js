'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const {formatReceipt,DELTA_RECEIPT_MEDIA}=require('../routes/operations');
const {EVIDENCE_RECEIPT_MEDIA,receiptBase}=require('./receipt-evidence-delta');
const copy=value=>JSON.parse(JSON.stringify(value));
const events=Array.from({length:365},(_,i)=>({id:'event-'+String(i).padStart(4,'0'),at:1700000000000+i*1000,type:'practice',ok:i%7!==0,sessionId:'session-'+i,
  contentFingerprint:'version-one',firstAttempt:true,assisted:false,policyVersion:1}));
function make(added=events.at(-1),source=events){
  const sorted=source.slice().sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
  const stat={times:365,dueAt:1800000000000,learningV1:{version:1,phase:'learning',evidence:sorted}};
  return{ok:true,seq:20,requestId:'synthetic-request',operation:{entity:'answer',id:added.id,key:'deck#one',stat},changes:{seq:20,delta:true,
    mem:{decks:[],stats:{bySentence:{'deck#one':stat},events:[added]}},courses:[],learningGenerations:{},revs:{},deleted:{},entityGone:{}}};
}
function fixture(original,added,options={}){
  let owner='one',commits=0;
  const before=original.changes.mem.stats.bySentence['deck#one'].learningV1.evidence.filter(event=>event.id!==added.id);
  let row={owner,scope:'synthetic',appliedSeq:19,snapshot:{mem:{decks:[],settings:{sound:false},stats:{bySentence:{'deck#one':{learningV1:{evidence:copy(before)}}},events:[]}},seq:19}};
  if(options.changeBefore)options.changeBefore(row.snapshot.mem.stats.bySentence['deck#one'].learningV1.evidence);
  const win={TextEncoder,crypto:options.noCrypto?undefined:{subtle:{digest:async(...args)=>{const result=await webcrypto.subtle.digest(...args);if(options.switchOwner)owner='two';return result;}}},
    location:{origin:'https://synthetic.invalid'},AccountStorage:{get owner(){return owner;},assertCurrent(){}},ChunkAPI:{getBase:()=>''},
    IDBStore:{readServerCache:async()=>copy(row),commitServerCache:async(next)=>{commits++;if(options.stale)return{applied:false,stale:true};row=copy(next);return{applied:true,retired:[]};}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../../js/server-cache'),'utf8'),{window:win,URL,console,TextEncoder,Set,Date,Promise});
  return{cache:win.ServerCache,row:()=>row,commits:()=>commits};
}
(async()=>{
  const original=make(),added=events.at(-1),before=JSON.stringify(original),accept=EVIDENCE_RECEIPT_MEDIA+'; base-seq=19';
  const patch=formatReceipt(original,accept),learning=patch.changes.mem.stats.bySentence['deck#one'].learningV1;
  assert.equal(learning.evidence,undefined);assert.equal(learning.evidenceDelta.append.length,1);
  assert.ok(Buffer.byteLength(JSON.stringify(patch))<Buffer.byteLength(JSON.stringify(formatReceipt(original,DELTA_RECEIPT_MEDIA)))/8);
  assert.equal(JSON.stringify(original),before,'wire projection does not mutate canonical receipt/history');
  const short=make(events[30],events.slice(0,31));
  assert.deepEqual(formatReceipt(short,accept),formatReceipt(short,DELTA_RECEIPT_MEDIA),'short histories avoid proof overhead');
  let f=fixture(original,added),applied=await f.cache.applyReceipt(copy(patch));
  assert.ok(applied);assert.deepEqual(f.row().snapshot.mem.stats.bySentence['deck#one'],original.changes.mem.stats.bySentence['deck#one']);
  assert.equal(f.row().snapshot.mem.settings.sound,false);assert.equal(f.commits(),1);
  assert.ok(formatReceipt(original,EVIDENCE_RECEIPT_MEDIA+'; base-seq=18').changes.mem.stats.bySentence['deck#one'].learningV1.evidence);
  assert.ok(formatReceipt(original,DELTA_RECEIPT_MEDIA).changes.mem.stats.bySentence['deck#one'].learningV1.evidence);
  for(const value of ['bad',EVIDENCE_RECEIPT_MEDIA+'; base-seq=-1',EVIDENCE_RECEIPT_MEDIA+'; base-seq=9007199254740992'])assert.equal(receiptBase(value),null);
  for(const options of [{changeBefore:list=>{list[0].ok=!list[0].ok;}},{noCrypto:true},{stale:true}]){
    f=fixture(original,added,options);assert.equal(await f.cache.applyReceipt(copy(patch)),null);assert.equal(f.row().appliedSeq,19);
  }
  for(const change of [p=>p.nextHash='a'.repeat(64),p=>p.previousCount--,p=>p.baseSeq--,p=>p.version=2,
    p=>p.append[0].id=events[0].id]){
    const bad=copy(patch);change(bad.changes.mem.stats.bySentence['deck#one'].learningV1.evidenceDelta);
    f=fixture(original,added);assert.equal(await f.cache.applyReceipt(bad),null);assert.equal(f.commits(),0);
  }
  f=fixture(original,added,{switchOwner:true});await assert.rejects(()=>f.cache.applyReceipt(copy(patch)),error=>error.code==='SESSION_CHANGED');assert.equal(f.commits(),0);
  // Delayed/offline event insertion must preserve full chronological ordering,
  // not just append to the displayed array and change mastery interpretation.
  const late=events[150],lateOriginal=make(late),latePatch=formatReceipt(lateOriginal,accept);
  f=fixture(lateOriginal,late);assert.ok(await f.cache.applyReceipt(copy(latePatch)));
  assert.deepEqual(f.row().snapshot.mem.stats.bySentence['deck#one'].learningV1.evidence,lateOriginal.changes.mem.stats.bySentence['deck#one'].learningV1.evidence);
  const engine=require('../../js/learning-engine.cjs'),day=86400000,at=1700000000000;
  const initial={id:'assessment-initial',at,type:'assessment',stage:'initial',sessionId:'initial-session',ok:true,firstAttempt:true,assisted:false,contentFingerprint:'version-one'};
  const delayed={...initial,id:'assessment-delayed',at:at+8*day,stage:'delayed',sessionId:'delayed-session'};
  const practice=Array.from({length:40},(_,i)=>({...events[i],id:'positive-practice-'+i,at:at+(9+i)*day,ok:true}));
  for(const history of [[initial,...practice],[initial,delayed,...practice],[initial,delayed,...practice,{...practice.at(-1),id:'later-failure',at:at+49*day,ok:false}]]){
    const added=history.at(-1),original=make(added,history),wire=formatReceipt(original,accept);
    f=fixture(original,added);assert.ok(await f.cache.applyReceipt(copy(wire)));
    const expected=engine.resolveLearningState({stat:original.changes.mem.stats.bySentence['deck#one'],contentFingerprint:'version-one',now:at+50*day});
    const actual=engine.resolveLearningState({stat:f.row().snapshot.mem.stats.bySentence['deck#one'],contentFingerprint:'version-one',now:at+50*day});
    assert.deepEqual(actual,expected,'initial pass, delayed mastery and later failure retain the same learning interpretation');
  }
  console.log('evidence delta: 365-event reduction, exact reconstruction, legacy/gap fallback, hashes, corruption, no-crypto, late ordering, CAS and account switch passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
