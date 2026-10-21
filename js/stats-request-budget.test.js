'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
function fixture() {
  let visible = true, owner = 'synthetic-a', tab = 'overview';
  const handlers = {}, requests = [], deferred = [];
  function node() { return { dataset:{}, children:[], hidden:false, tagName:'DIV', append(){}, replaceChildren(){}, contains(){return false;},
    querySelector(){return null;},querySelectorAll(){return [];},setAttribute(){},addEventListener(){},focus(){} }; }
  const nodes = new Map();
  const document = { visibilityState:'visible', getElementById(id){ if(!nodes.has(id))nodes.set(id,node());return nodes.get(id); },createElement:node };
  const window = { document, AccountStorage:{get owner(){return owner;}}, statsSurfaceVisible:()=>visible,
    ChunkAPI:{isLoggedIn:()=>true,getBase:()=>'',request:path=>{
      requests.push(path);
      if (deferred.length) return new Promise(resolve=>deferred.shift()(resolve));
      return Promise.resolve(path.includes('summary')?{confirmed:true,domains:[]}:{confirmed:true,items:[],nextOffset:null});
    }},addEventListener:(name,fn)=>{handlers[name]=fn;},
    renderStats:()=>window.StatsVocabulary&&window.StatsVocabulary.render(tab) };
  vm.runInNewContext(fs.readFileSync(require.resolve('./stats-vocabulary'), 'utf8'), {window, document, console,
    statsSurfaceVisible:()=>visible, Promise,Set,Date});
  return {window,requests,handlers,deferred,setVisible:v=>{visible=v;},setOwner:v=>{owner=v;},
    setTab:v=>{tab=v;window.StatsVocabulary.render(v);}, settle:async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));}};
}
(async()=>{
  const f=fixture(); await f.settle();
  assert.equal(f.requests.length,1,'overview loads summary only');
  f.setVisible(false);
  for(let i=0;i<3;i++){f.handlers['server-cache-applied']({detail:{owner:'synthetic-a'}});await f.settle();}
  assert.equal(f.requests.length,1,'hidden saves issue no vocabulary reads');
  f.setVisible(true); f.handlers['stats-surface-visibility'](); await f.settle();
  assert.equal(f.requests.length,2,'reopening coalesces hidden invalidations into one summary read');
  f.setTab('sent'); await f.settle();
  assert.equal(f.requests.filter(p=>p.includes('/events')).length,1,'details load on first detail view');
  f.setTab('overview');f.setTab('sent'); await f.settle();
  assert.equal(f.requests.filter(p=>p.includes('/events')).length,1,'unchanged details are reused');
  f.setVisible(false); f.handlers['focus']();await f.settle();assert.equal(f.requests.length,3);
  f.setOwner('synthetic-b');f.handlers['cloud-config-changed']();await f.settle();assert.equal(f.requests.length,3);
  f.setVisible(true);f.handlers['stats-surface-visibility']();await f.settle();
  assert.equal(f.requests.length,5,'new account gets its own summary and visible details');
  const pending=fixture();await pending.settle();
  let finish;
  pending.deferred.push(resolve=>{finish=resolve;});
  pending.handlers['server-cache-applied']({detail:{owner:'synthetic-a'}});
  pending.setVisible(false);pending.setTab('sent');
  finish({confirmed:true,domains:[]});await pending.settle();
  assert.equal(pending.requests.length,2,'a request finishing while hidden cannot start details');
  pending.setVisible(true);pending.handlers['stats-surface-visibility']();await pending.settle();
  assert.equal(pending.requests.length,3,'reopen loads pending details without repeating the clean summary');
  pending.deferred.push(resolve=>resolve(Promise.reject(new Error('synthetic network failure'))));
  pending.window.StatsVocabulary.load();await pending.settle();
  const failedCount=pending.requests.length;
  pending.setTab('overview');await pending.settle();
  assert.equal(pending.requests.length,failedCount,'failed summary does not create a render retry loop');
  pending.window.StatsVocabulary.load();await pending.settle();
  assert.equal(pending.requests.length,failedCount+1,'explicit retry still works');
  console.log('stats request budget: lazy details, hidden dirty coalescing, focus and account reload passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
