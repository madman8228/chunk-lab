'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {encodeReceipt,decodeReceipt,MAX_BYTES}=require('./operation-receipt-storage');
const evidence=Array.from({length:300},(_,i)=>({id:'synthetic-'+i,at:1700000000000+i,key:'deck#one',ok:i%3!==0,note:'中文与 emoji ❤️ 保留'}));
const stat={times:300,learningV1:{evidence}};
const result={ok:true,requestId:'synthetic-receipt-001',seq:301,outcome:'applied',operation:{entity:'answer',id:'synthetic-event-001',key:'deck#one',stat,totalAnswered:300},
  changes:{delta:true,seq:301,mem:{stats:{bySentence:{'deck#one':stat},daysLog:{'2026-10-17':{rounds:1}}}}}};
const original=JSON.stringify(result),stored=encodeReceipt(result),metadata=JSON.parse(stored);
assert.ok(Buffer.byteLength(stored)<Buffer.byteLength(original)/4,'large repeated evidence compresses substantially');
assert.equal(metadata.seq,301);assert.equal(metadata.operation.key,'deck#one');assert.equal(Object.hasOwn(metadata.operation,'stat'),false);
assert.deepEqual(decodeReceipt(stored),result);assert.equal(JSON.stringify(result),original,'encoding does not mutate in-memory result');
assert.deepEqual(decodeReceipt(original),result,'legacy plain receipts decode unchanged');
for(const value of [{ok:true,seq:1},{...result,changes:{small:true},operation:{entity:'test'}},{...result,operation:{entity:'answer',stat:null}}]){
  assert.deepEqual(decodeReceipt(encodeReceipt(value)),value);
}
const wordbook={...result,operation:{entity:'vocabularyResume',action:'start',bookId:'book',sessionId:'session',scopeKey:'unit'}};
const queryable=JSON.parse(encodeReceipt(wordbook));
assert.deepEqual(queryable.operation,wordbook.operation,'wordbook SQL metadata remains directly queryable');
for(const modify of [body=>body.data='broken',body=>body.version=2,body=>body.bytes++,body=>body.bytes=MAX_BYTES+1,body=>body.codec='unknown']){
  const bad=JSON.parse(stored);modify(bad._receiptBody);assert.throws(()=>decodeReceipt(JSON.stringify(bad)),error=>error.code==='OPERATION_RECEIPT_CORRUPT');
}
for(const bad of ['not-json','null','[]'])assert.throws(()=>decodeReceipt(bad),error=>error.code==='OPERATION_RECEIPT_CORRUPT');
const bomb=JSON.parse(stored);bomb._receiptBody.bytes=1024;
bomb._receiptBody.data=require('node:zlib').gzipSync(Buffer.alloc(MAX_BYTES+1)).toString('base64');
assert.throws(()=>decodeReceipt(JSON.stringify(bomb)),error=>error.code==='OPERATION_RECEIPT_CORRUPT','decoder enforces actual inflated size, not just claimed length');
const huge={...result,changes:{data:'x'.repeat(MAX_BYTES+1)}};
assert.equal(Object.hasOwn(JSON.parse(encodeReceipt(huge)),'_receiptBody'),false,'large imports bypass synchronous compression');
const random={...result,changes:{data:crypto.randomBytes(1800).toString('base64')},operation:{entity:'test'}};
const randomStored=encodeReceipt(random);assert.ok(Buffer.byteLength(randomStored)<=Buffer.byteLength(JSON.stringify(random)));assert.deepEqual(decodeReceipt(randomStored),random);
console.log('receipt storage codec: lossless/legacy/Unicode, visible metadata, bounded decode, corrupt fail-closed, large import bypass and no expansion passed');
