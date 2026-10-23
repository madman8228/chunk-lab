'use strict';
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const events={},renders=[],requests=[],timers=new Map();let owner='a',projected={},resume={},fail=false,localGate=null,visible=true,timerId=0;
 const location={href:'http://test.invalid/main.html?view=home',search:'?view=home'};
 const sandbox={URL,URLSearchParams,Map,Object,Promise,location,history:{pushState(){}},navigator:{onLine:true},setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);},addEventListener(name,fn){events[name]=fn;},
  AccountStorage:{get owner(){return owner;},assertCurrent(){}},ChunkAPI:{getBase:()=>'',getToken:()=>owner,request:async url=>{requests.push(url);if(fail)throw Error('network unavailable');return url==='/api/course-library'?{courses:[]}:{resources:[{resourceId:owner+'-book'}]};}},
  LearningWorkspace:{resourcesFromCatalog:()=>[],normalizeResource:r=>r},LearningWorkspaceView:{render:(_,data)=>renders.push(data)},
  LearningWorkspaceStore:{read:async()=>{if(localGate)await localGate;return {projected};}},ServerCache:{read:async()=>({snapshot:{mem:{vocabularyResume:resume}}})}};
 sandbox.window=sandbox;vm.runInNewContext(fs.readFileSync('js/learning-workspace-runtime.js','utf8'),sandbox);
 const runtime=sandbox.LearningWorkspaceRuntime.create({read:()=>({catalog:{courses:[]},joinedCourseIds:[]}),container:()=>({}),visible:()=>visible,show(){}});
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 runtime.show();await settle();assert.equal(requests.length,2,'personal wordbooks and independent course directory are separate reads');
 projected={saved:{selected:true}};resume={book:{itemId:'next'}};
 for(let i=0;i<5;i++){events['server-cache-applied']();await settle();}
 assert.equal(requests.length,2,'confirmed progress events must not refetch unrelated remote lists');
 assert.equal(renders.at(-1).preferences.saved.selected,true,'confirmed local preferences still update');
 assert.equal(renders.at(-1).vocabularyResumes.book.itemId,'next');
 location.search='?view=discover';runtime.show();await settle();const before=requests.length;
 events['server-cache-applied']();await settle();assert.equal(requests.length,before,'discovery progress events do not refetch either remote list');
 events.focus();await settle();assert.equal(requests.length,before+3,'focus still refreshes remote lists');
 events['personal-wordbooks-restored']();await settle();assert.equal(requests.length,before+6,'restoring personal content still refreshes remote lists');
 owner='b';events['server-cache-applied']();await settle();assert.equal(requests.length,before+9,'account changes require complete initialization');
 assert.ok(renders.at(-1).resources.every(resource=>resource.resourceId==='b-book'),'previous account resources are not retained');
 let release;localGate=new Promise(resolve=>{release=resolve;});
 const priorFocus=requests.length;events['server-cache-applied']();events.focus();
 release();localGate=null;await settle();assert.equal(requests.length,priorFocus+3,'remote refresh during a local read is not swallowed');
 fail=true;await runtime.refresh();assert.equal(timers.size,1);
 const errorStatus=renders.at(-1).status,beforeFailureEvent=requests.length;
 events['server-cache-applied']();await settle();
 assert.equal(requests.length,beforeFailureEvent,'confirmation does not circumvent network retry backoff');
 assert.equal(renders.at(-1).status,errorStatus,'local refresh preserves remote failure information');
 assert.equal(timers.size,1,'local refresh preserves scheduled remote recovery');
 fail=false;events.online();await settle();assert.equal(timers.size,0);
 visible=false;const beforeHidden=requests.length;events['server-cache-applied']();events.focus();await settle();assert.equal(requests.length,beforeHidden);
 console.log('Workspace cache request budget: five home events and discovery event cause no remote list requests; local progress, focus, restore and account refresh retained.');
})().catch(error=>{console.error(error);process.exitCode=1;});
