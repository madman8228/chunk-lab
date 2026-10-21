'use strict';
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const timers=new Map(),events={},renders=[];let timerId=0,calls=0,fail=true;
 const location={href:'http://test.invalid/main.html?view=home',search:'?view=home'};
 const sandbox={URL,URLSearchParams,Map,Object,location,history:{pushState(){}},navigator:{onLine:true},
  AccountStorage:{owner:'account-a',assertCurrent(){}},ChunkAPI:{getBase:()=>'',getToken:()=>'',request:async()=>{calls++;if(fail)throw Error('network failed');return {resources:[{resourceId:'public-course'}]};}},
  LearningWorkspace:{resourcesFromCatalog:()=>[{resourceId:'local-course',visibility:'public'}],normalizeResource:r=>r},
  LearningWorkspaceView:{render:(_container,data)=>renders.push(data)},LearningWorkspaceStore:{read:async()=>({projected:{}})},ServerCache:{read:async()=>({snapshot:{mem:{}}})},
  setTimeout(fn,delay){timers.set(++timerId,{fn,delay});return timerId;},clearTimeout(id){timers.delete(id);},addEventListener(name,fn){events[name]=fn;}
 };sandbox.window=sandbox;
 vm.runInNewContext(fs.readFileSync('js/learning-workspace-runtime.js','utf8'),sandbox);
 const runtime=sandbox.LearningWorkspaceRuntime.create({read:()=>({catalog:{},joinedCourseIds:[]}),container:()=>({}),visible:()=>true,show(){}});
 runtime.show();await runtime.refresh();
 assert.equal(calls,0,'home must not depend on remote discovery directory');
 location.search='?view=discover';runtime.show();await runtime.refresh();
 assert.equal(calls,1,'concurrent refreshes share one directory request');
 assert.equal(renders.at(-1).resources[0].resourceId,'local-course','failed fetch preserves readable catalog');
 assert.ok(timers.size===1,'directory failure schedules one background retry');
 const pending=[...timers.values()][0];assert.ok(pending.delay>=1000);
 fail=false;timers.clear();pending.fn();await runtime.refresh();
 assert.ok(renders.at(-1).resources.some(r=>r.resourceId==='public-course'),'background retry recovers without a user retry button');
 assert.equal(timers.size,0,'successful recovery stops retries');
 fail=true;await runtime.refresh();sandbox.navigator.onLine=false;
 const offlineTimer=[...timers.values()][0],before=calls;timers.clear();offlineTimer.fn();
 assert.equal(calls,before,'offline timers do not issue failing network requests');
 fail=false;sandbox.navigator.onLine=true;events.online();await runtime.refresh();
 assert.equal(timers.size,0,'online recovery cancels the retry timer');
 console.log('Workspace: home independent of discovery API; preserved local catalog; automatic recovery passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
