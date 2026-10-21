'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const match=html.match(/<script id="homepage-bundle-update">([\s\S]*?)<\/script>/);
assert.ok(match,'Homepage must check for bundle updates even when its CSS/JS are cached');
let updates=0,reloads=0,dialog=false,observer;
const events={};
vm.runInNewContext(match[1],{
  navigator:{serviceWorker:{controller:{},async register(){return {async update(){updates++;}};},addEventListener(name,fn){events[name]=fn;}}},
  document:{visibilityState:'visible',documentElement:{},querySelector(){return dialog?{}:null;},addEventListener(){}},
  location:{reload(){reloads++;}},
  MutationObserver:class{constructor(fn){observer=fn;}observe(){}disconnect(){}},
});
(async()=>{
  await new Promise(r=>setImmediate(r));
  assert.equal(updates,1);
  dialog=true;events.controllerchange();assert.equal(reloads,0,'Do not interrupt an open login/binding dialog');
  dialog=false;observer();assert.equal(reloads,1,'Apply completed bundle automatically when safe');
  events.controllerchange();assert.equal(reloads,1,'No reload loop');
  console.log('PASS: homepage checks updates and applies the completed bundle without interrupting account input');
})().catch(e=>{console.error(e);process.exitCode=1;});
