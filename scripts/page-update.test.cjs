'use strict';
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
async function check(controlled){
  const listeners={},nodes=[];let checks=0,reloads=0;
  const registration={update:async()=>{checks++;},addEventListener:(name,fn)=>{listeners[name]=fn;}};
  const document={visibilityState:'visible',addEventListener:(name,fn)=>{listeners[name]=fn;},body:{append:node=>nodes.push(node)},createElement:()=>({style:{},setAttribute(){},append(...children){this.children=children;}})};
  const sandbox={document,Date,navigator:{onLine:true,serviceWorker:{controller:controlled?{}:null,addEventListener:(name,fn)=>{listeners[name]=fn;},register:async()=>registration}},location:{reload(){reloads++;}},addEventListener:(name,fn)=>{listeners[name]=fn;}};
  sandbox.window=sandbox;vm.runInNewContext(fs.readFileSync('js/page-update.js','utf8'),sandbox);await new Promise(setImmediate);
  assert.equal(checks,1);assert.equal(reloads,0);
  listeners.controllerchange();assert.equal(nodes.length,controlled?1:0,'first install does not announce an update');
  if(controlled){listeners.controllerchange();assert.equal(nodes.length,1);assert.equal(reloads,0);nodes[0].children[1].onclick();assert.equal(reloads,1,'only clicking refresh reloads');}
}
Promise.all([check(true),check(false)]).then(()=>console.log('Page updates: checks, first install, duplicate events and explicit refresh passed')).catch(error=>{console.error(error);process.exitCode=1;});
