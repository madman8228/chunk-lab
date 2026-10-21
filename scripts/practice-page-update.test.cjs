'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('vocabulary-practice.html','utf8');
const match=html.match(/<script id="practice-bundle-update">([\s\S]*?)<\/script>/);
assert.ok(match,'Standalone practice must apply completed bundle updates, not keep old page layout');
async function scenario(controlled,blocker){
  let reloads=0,updates=0,observer,blocked=blocker,visible=true;
  const events={},documentEvents={};
  vm.runInNewContext(match[1],{
    navigator:{serviceWorker:{controller:controlled?{}:null,addEventListener(n,f){events[n]=f;},async register(){return{async update(){updates++;}};}}},
    document:{get visibilityState(){return visible?'visible':'hidden';},documentElement:{},querySelector(selector){assert.ok(selector.includes('.practice-panel:not([hidden])'));assert.ok(selector.includes('.practice-panel[data-paused="true"]'));return blocked?{}:null;},addEventListener(n,f){documentEvents[n]=f;}},
    location:{reload(){reloads++;}},MutationObserver:class{constructor(fn){observer=fn;}observe(){}disconnect(){}},
  });
  await new Promise(r=>setImmediate(r));assert.equal(updates,1);
  events.controllerchange();
  assert.equal(reloads,controlled&&!blocked?1:0,'Do not refresh during practice/account entry or first installation');
  if(controlled&&blocked){
    visible=false;blocked=false;observer();assert.equal(reloads,0,'Do not reload background tabs');
    visible=true;documentEvents.visibilitychange();assert.equal(reloads,1,'Apply when returned to safe introduction');
  }
  events.controllerchange();assert.ok(reloads<=1,'No reload loop');
}
(async()=>{
  await scenario(true,false);await scenario(true,'practice');await scenario(true,'paused');await scenario(true,'account');await scenario(false,false);
  console.log('PASS: practice updates on introduction, defers active practice/account input, preserves first install and avoids reload loops');
})().catch(e=>{console.error(e);process.exitCode=1;});
