'use strict';
const assert=require('node:assert/strict');
const {create}=require('./js/sync-outbox');
function memory(){
  let data={},tail=Promise.resolve(),fail=false;
  return {
    failNext(){fail=true;},
    transact(keys,reduce){
      const task=tail.then(()=>{
        const rows=Object.create(null);
        keys.forEach(k=>{rows[k]=data[k] && structuredClone(data[k]);});
        const result=reduce(rows);
        if(fail){fail=false;throw new Error('disk full');}
        keys.forEach(k=>{if(rows[k]!==undefined)data[k]=structuredClone(rows[k]);});
        return result;
      });
      tail=task.catch(()=>{});return task;
    },
    async list(prefix){await tail;return Object.keys(data).filter(k=>k.startsWith(prefix)).map(k=>structuredClone(data[k]));}
  };
}
async function main(){
  const adapter=memory();let n=0;
  const factory=()=>create(adapter,{makeId:()=>String(++n)});
  const a=factory().forAccount('https://server/','alice');
  const edit=name=>({entity:'decks',id:'d',deleted:false,value:{id:'d',name,items:[]}});
  await a.observe('decks','d',{rev:4,deleted:false,value:edit('old').value});
  await a.stage([edit('first')]);await a.stage([edit('second')]);
  let p=await a.pending();assert.equal(p.length,1);assert.equal(p[0].head.baseRev,4);assert.equal(p[0].head.rev,6);
  const sent=await a.prepare('decks','d');
  await a.stage([edit('during send')]);
  assert.deepEqual(await a.prepare('decks','d'),sent);
  const reopened=factory().forAccount('https://server','alice');
  assert.deepEqual(await reopened.prepare('decks','d'),sent);
  assert.equal(await reopened.acknowledge('decks','d','wrong-id',6),false);
  assert.equal(await reopened.acknowledge('decks','d',sent.operationId,6),true);
  p=await reopened.pending();assert.equal(p[0].head.baseRev,6);assert.equal(p[0].head.value.name,'during send');
  const next=await reopened.prepare('decks','d');
  await reopened.conflict('decks','d',next.operationId,{currentRev:10});
  await assert.rejects(reopened.prepare('decks','d'),e=>e.code==='SYNC_CONFLICT');
  await assert.rejects(reopened.observe('decks','d',{rev:10,deleted:false,value:edit('cloud').value}),e=>e.code==='PENDING_CHANGES');
  await reopened.stage([{...edit('delete'),deleted:true,value:null}]);
  p=await reopened.pending();assert.equal(p[0].head.status,'conflict');assert.equal(p[0].next.deleted,true);
  assert.equal((await factory().forAccount('https://server','bob').pending()).length,0);
  assert.equal((await factory().forAccount('https://other','alice').pending()).length,0);
  const fresh=factory().forAccount('https://server','fresh');
  await fresh.stage([edit('unknown baseline')]);
  await assert.rejects(fresh.prepare('decks','d'),e=>e.code==='BASELINE_REQUIRED');
  assert.equal((await fresh.pending())[0].head.value.name,'unknown baseline');
  const empty=factory().forAccount('https://server','empty');
  await empty.observe('decks','d',{rev:null,deleted:true,value:null});
  adapter.failNext();await assert.rejects(empty.stage([edit('failed')]),/disk full/);
  assert.equal((await empty.pending()).length,0);
  await empty.stage([edit('new')]);const first=await empty.prepare('decks','d');
  assert.equal(first.baseRev,null);assert.equal(first.rev,1);
  await empty.acknowledge('decks','d',first.operationId,1);
  await empty.stage([{...edit('gone'),deleted:true,value:null}]);
  const gone=await empty.prepare('decks','d');assert.equal(gone.baseRev,1);assert.equal(gone.value,null);
  await empty.acknowledge('decks','d',gone.operationId,2);assert.equal((await empty.pending()).length,0);
  console.log('[sync-outbox] coalescing, immutable retries, successor, conflict, scopes, unknown baseline, rollback and deletion passed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
