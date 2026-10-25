'use strict';
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
async function check(controlled){
  const listeners={},nodes=[];let checks=0,reloads=0;
  const registration={update:async()=>{checks++;},addEventListener:(name,fn)=>{listeners[name]=fn;}};
  const document={visibilityState:'visible',addEventListener:(name,fn)=>{listeners[name]=fn;},body:{append:node=>nodes.push(node)},createElement:()=>({style:{},setAttribute(name,value){this[name]=value;},remove(){this.removed=true;},append(...children){this.children=children;}})};
  const sandbox={document,Date,navigator:{onLine:true,serviceWorker:{controller:controlled?{}:null,addEventListener:(name,fn)=>{listeners[name]=fn;},register:async()=>registration}},location:{reload(){reloads++;}},addEventListener:(name,fn)=>{listeners[name]=fn;}};
  sandbox.window=sandbox;vm.runInNewContext(fs.readFileSync('js/page-update.js','utf8'),sandbox);await new Promise(setImmediate);
  assert.equal(checks,1);assert.equal(reloads,0);
  listeners.controllerchange();assert.equal(nodes.length,controlled?1:0,'first install does not announce an update');
  if(controlled){listeners.controllerchange();assert.equal(nodes.length,1);assert.equal(reloads,0);nodes[0].children[1].onclick();assert.equal(reloads,1,'only clicking refresh reloads');const close=nodes[0].children.find(node=>node['aria-label']==='关闭更新提示');assert.ok(close,'update notice must have a close button');close.onclick();assert.equal(nodes[0].removed,true);listeners.controllerchange();assert.equal(nodes.length,1,'dismissed notice stays dismissed for this page');}
}
async function waitingUpdate(){
  const listeners={},nodes=[],messages=[];let reloads=0;
  const waiting={postMessage:message=>messages.push(message)};
  const registration={waiting,update:async()=>{},addEventListener:(name,fn)=>{listeners[name]=fn;}};
  const sandbox={Date,navigator:{onLine:true,serviceWorker:{controller:{},addEventListener:(name,fn)=>{listeners[name]=fn;},register:async()=>registration}},location:{reload(){reloads++;}},addEventListener(){},document:{visibilityState:'visible',addEventListener(){},body:{append:node=>nodes.push(node)},createElement:()=>({style:{},setAttribute(){},remove(){},append(...children){this.children=children;}})}};
  sandbox.window=sandbox;vm.runInNewContext(fs.readFileSync('js/page-update.js','utf8'),sandbox);await new Promise(setImmediate);
  assert.equal(nodes.length,1);nodes[0].children[1].onclick();assert.equal(messages[0].type,'ACTIVATE_UPDATE');assert.equal(reloads,0,'waiting worker must activate before reload');listeners.controllerchange();assert.equal(reloads,1,'reload after new worker takes control');
}
Promise.all([check(true),check(false),waitingUpdate()]).then(()=>console.log('Page updates: dismiss, duplicate events, first install, explicit refresh and waiting-worker activation passed')).catch(error=>{console.error(error);process.exitCode=1;});
