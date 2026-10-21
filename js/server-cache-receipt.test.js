'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const copy=value=>JSON.parse(JSON.stringify(value));
const snapshot=seq=>({seq,delta:true,mem:{decks:[],stats:{totalAnswered:seq,bySentence:{},events:[]}},courses:[],
  courseProgress:{},learningResumes:{},learningGenerations:{'course:synthetic':0},revs:{},deleted:{},entityGone:{}});
const receipt=seq=>({ok:true,requestId:'synthetic-'+seq,seq,changes:snapshot(seq)});
let owner='one',row,commits=0,reads=0,stale=false,switchOnRead=false,events=0;
const pending=new Map();
const win={location:{origin:'https://synthetic.invalid'},AccountStorage:{get owner(){return owner;},assertCurrent(){}},ChunkAPI:{getBase:()=>''},
  CustomEvent:function(type,options){this.type=type;this.detail=options.detail;},dispatchEvent:()=>events++,
  IDBStore:{readServerCache:async()=>{reads++;if(switchOnRead){owner='two';switchOnRead=false;}return copy(row);},
    commitServerCache:async(next,expected)=>{
      commits++;if(stale||row.appliedSeq!==expected)return{applied:false,stale:true};
      row=copy(next);const retired=[];for(const [id,item]of pending){if(item.receipt.seq<=row.appliedSeq){retired.push(item);pending.delete(id);}}
      return{applied:true,retired};
    }}};
vm.runInNewContext(fs.readFileSync(require.resolve('./server-cache.js'),'utf8'),{window:win,URL,console,Set,Date,Promise});
function base(seq){row={key:'server-cache-v3',owner,scope:JSON.stringify(['https://synthetic.invalid',owner,3]),appliedSeq:seq,
  snapshot:{...snapshot(seq),delta:false,mem:{decks:[],settings:{sound:false},stats:{totalAnswered:seq,bySentence:{},events:[]}}}};}
(async()=>{
  base(1);pending.set('synthetic-2',{requestId:'synthetic-2',receipt:receipt(2)});
  let result=await win.ServerCache.applyReceipt(receipt(2));
  assert.equal(result.cache.appliedSeq,2);assert.equal(result.retired.length,1);assert.equal(pending.size,0);
  assert.equal(row.snapshot.mem.settings.sound,false);assert.equal(events,1);
  const before=commits;assert.equal(await win.ServerCache.applyReceipt(receipt(4)),null);assert.equal(commits,before,'sequence gap never commits');
  const invalid=receipt(3);delete invalid.changes.learningGenerations;
  assert.equal(await win.ServerCache.applyReceipt(invalid),null);assert.equal(await win.ServerCache.applyReceipt({ok:true,seq:3,changes:[]}),null);
  base(7);pending.set('synthetic-2',{requestId:'synthetic-2',receipt:receipt(2)});
  result=await win.ServerCache.applyReceipt(receipt(2));assert.equal(result.cache.appliedSeq,7);assert.equal(pending.size,0,'covered ACK retired without rollback');
  base(1);stale=true;assert.equal(await win.ServerCache.applyReceipt(receipt(2)),null);assert.equal(row.appliedSeq,1);stale=false;
  switchOnRead=true;await assert.rejects(()=>win.ServerCache.applyReceipt(receipt(2)),error=>error.code==='SESSION_CHANGED');
  assert.equal(row.appliedSeq,1);assert.ok(reads>0);
  console.log('receipt delta: exact baseline, atomic retirement, preserved fields, gaps, malformed response, covered ACK, CAS race and account switch passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
