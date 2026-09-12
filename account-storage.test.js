'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require.resolve('./js/account-storage.js'),'utf8');
function boot(entries,broken){
  const values=new Map(entries),timers=[];
  const context={URL,atob:s=>Buffer.from(s,'base64').toString('binary'),
    localStorage:{getItem:k=>{if(broken)throw Error('storage denied');return values.get(k)||null;},setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)},
    location:{origin:'https://example.test',reload(){}},document:{documentElement:{style:{}}},
    setTimeout:fn=>timers.push(fn),addEventListener(){}};
  context.window=context;vm.runInNewContext(source,context);return {context,values};
}
const a=boot([['chunklab.v1','legacy data']]);
assert.equal(a.context.AccountStorage.storage.getItem('chunklab.v1'),null);
assert.equal(a.values.get('chunklab.v1'),'legacy data');
a.context.AccountStorage.storage.setItem('chunklab.v1','new data');
assert.equal(a.context.AccountStorage.storage.getItem('chunklab.v1'),'new data');
assert.notEqual(a.context.AccountStorage.databaseName,'chunklab-idb');
const malformed=boot([['chunklab_token','invalid']]);
assert.throws(()=>malformed.context.AccountStorage.storage.getItem('chunklab.v1'),e=>e.code==='ACCOUNT_STORAGE_UNAVAILABLE');
assert.equal(malformed.values.has('chunklab.storage-owner.v1'),false);
const denied=boot([],true);
assert.throws(()=>denied.context.AccountStorage.assertCurrent(),e=>e.code==='ACCOUNT_STORAGE_UNAVAILABLE');
a.values.set('chunklab_api_base','https://other.test');
assert.throws(()=>a.context.AccountStorage.storage.setItem('chunklab.v1','wrong owner'),e=>e.code==='SESSION_CHANGED');
assert.equal(a.values.get('chunklab.v1'),'legacy data');
console.log('[account-storage] unowned data preserved; malformed credentials/storage errors fail closed; stale writes rejected');
