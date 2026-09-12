'use strict';
const assert = require('node:assert/strict');
const {assertRevisionAccepted:accept} = require('./sync-conflict');
const {validatePutPayload:validate} = require('./validate');
const current={rev:7,deleted:false,value:{name:'remote'}};
assert.throws(()=>accept('decks','d',100,false,{name:'offline'},current,6),e=>e.code==='SYNC_CONFLICT' && e.conflicts[0].reason==='BASE_REV_MISMATCH');
assert.doesNotThrow(()=>accept('decks','d',8,false,{name:'new'},current,7));
assert.doesNotThrow(()=>accept('decks','d',7,false,{name:'remote'},current,6));
assert.doesNotThrow(()=>accept('decks','d',1,false,{name:'new'},null,null));
assert.throws(()=>accept('decks','d',1,false,{name:'new'},{...current,rev:0},null));
assert.throws(()=>accept('decks','d',8,false,{name:'new'},null,7));
// Compatibility is deliberate until all clients have a persisted baseline/outbox.
assert.doesNotThrow(()=>accept('decks','d',100,false,{name:'legacy'},current));
const payload={mem:{decks:[{id:'d',name:'new',items:[]}]},revs:{decks:{d:8}},baseRevs:{decks:{d:7}}};
assert.equal(validate(payload),null);
for(const base of [-1,1.2,'7',true,Number.MAX_SAFE_INTEGER+1]) {
  assert.ok(validate({...payload,baseRevs:{decks:{d:base}}}));
}
for(const rev of [0,-1,null,'8',1.5,Number.MAX_SAFE_INTEGER+1]) {
  assert.ok(validate({...payload,revs:{decks:{d:rev}}}));
}
assert.ok(validate({...payload,baseRevs:{}}));
assert.ok(validate({...payload,baseRevs:null}));
assert.ok(validate({...payload,deleted:{decks:[{id:'d',rev:9}]}}));
assert.ok(validate({...payload,mem:{decks:[...payload.mem.decks,...payload.mem.decks]}}));
assert.ok(validate({...payload,deleted:{decks:{id:'d',rev:9}}}));
assert.ok(validate({...payload,deleted:{decks:[null]}}));
assert.equal(validate({...payload,baseRevs:{decks:{d:null}}}),null);
console.log('[sync-conflict] base revision, absence, retries, validation and legacy compatibility passed');
