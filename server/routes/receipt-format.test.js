'use strict';
const assert=require('node:assert/strict');
const {formatReceipt,DELTA_RECEIPT_MEDIA}=require('./operations');
const stat={times:30,learningV1:{evidence:[{id:'synthetic',at:1}]}};
const original={ok:true,seq:3,requestId:'synthetic-receipt',operation:{entity:'answer',key:'course#one',stat,totalAnswered:30},
  changes:{seq:3,delta:true,mem:{stats:{bySentence:{'course#one':stat}}}}};
const before=JSON.stringify(original),compact=formatReceipt(original,DELTA_RECEIPT_MEDIA);
assert.equal(Object.hasOwn(compact.operation,'stat'),false);
assert.equal(compact.changes.mem.stats.bySentence['course#one'],stat);
assert.equal(JSON.stringify(original),before,'durable receipt is not mutated');
assert.equal(formatReceipt(original,undefined),original,'legacy response unchanged');
assert.equal(formatReceipt(original,'application/json'),original);
for(const changed of [{...original,changes:undefined},{...original,changes:{...original.changes,seq:4}},
  {...original,operation:{...original.operation,key:'other'}}])assert.equal(formatReceipt(changed,DELTA_RECEIPT_MEDIA),changed);
console.log('receipt format: explicit opt-in only, canonical delta retained, legacy/invalid responses unchanged, durable receipt immutable');
