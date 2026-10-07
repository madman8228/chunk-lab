'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function main() {
  const nodes = new Map(), calls = [];
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { value:'', textContent:'', innerHTML:'', className:'',
      classList:{add(){},remove(){}}, listeners:{}, addEventListener(event, handler){this.listeners[event]=handler;} });
    return nodes.get(id);
  }
  const context = { console, setTimeout:()=>0, clearTimeout(){}, confirm:()=>false, addEventListener(){},
    location:{protocol:'http:'}, localStorage:{getItem:key=>key==='chunklab_admin_token'?'test-token':null,setItem(){},removeItem(){}},
    document:{getElementById:node,querySelectorAll:()=>[]},
    fetch(url,options){return new Promise(resolve=>calls.push({url,options,resolve}));} };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(require.resolve('./content-studio.js'),'utf8'),context);
  async function reply(call,data) { call.resolve({ok:true,status:200,text:async()=>JSON.stringify(data)}); for(let i=0;i<6;i++)await new Promise(setImmediate); }
  await reply(calls.shift(),{});
  await reply(calls.shift(),{courses:[{id:'a',name:'A',itemCount:1},{id:'b',name:'B',itemCount:1}]});
  const pendingA = calls.shift();
  node('courses').listeners.click({target:{closest:()=>({dataset:{course:'b'}})}});
  const pendingB = calls.shift();
  function course(id) {return {course:{id,name:id.toUpperCase(),items:[{sentence:'Hello.',translation:'你好',chunks:['Hello.'],hints:['你好']}]},revision:0};}
  await reply(pendingB,course('b'));
  assert.equal(node('activeCourse').textContent,'B');
  await reply(pendingA,course('a'));
  assert.equal(node('activeCourse').textContent,'B','late course response must not overwrite the selected course');
  node('sentence').value='Edited original.';
  node('editor').listeners.input();
  node('courses').listeners.click({target:{closest:()=>({dataset:{course:'a'}})}});
  assert.equal(calls.length,0,'cancelled unsaved switch must not fetch or discard edits');
  node('save').listeners.click();
  await new Promise(setImmediate);
  const saving = calls.shift();
  assert.ok(saving.url.endsWith('/b/draft'));
  node('courses').listeners.click({target:{closest:()=>({dataset:{course:'a'}})}});
  node('save').listeners.click();
  assert.equal(calls.length,0,'save in flight must block course switching and duplicate submits');
  await reply(saving,{revision:1});
  assert.equal(node('revision').textContent,'草稿版本 1');
  console.log('[content-studio] stale course response ignored');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
