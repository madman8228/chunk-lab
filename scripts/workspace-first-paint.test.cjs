'use strict';
// Synthetic async sources only: no real account, storage, or server.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
async function main(){
 let release,releasePersonal,prepared=false;
 const gate=new Promise(resolve=>{release=()=>{prepared=true;resolve();};});
 const personal=new Promise(resolve=>{releasePersonal=resolve;});
 const renders=[],events={};
 const sandbox={URL,URLSearchParams,Map,Object,Promise,location:{href:'http://test.invalid/main.html?view=home',search:'?view=home'},
  history:{pushState(){}},navigator:{onLine:true},setTimeout:()=>1,clearTimeout(){},
  addEventListener:(name,fn)=>{events[name]=fn;},AccountStorage:{owner:'synthetic',assertCurrent(){}},
  ChunkAPI:{getToken:()=> 'synthetic',getBase:()=>'',request:()=>personal},
  LearningWorkspace:{resourcesFromCatalog:()=>[],normalizeResource:r=>r},
  LearningWorkspaceView:{render:(_,data)=>renders.push(data)},
  LearningWorkspaceStore:{read:async()=>({projected:{}})},ServerCache:{read:async()=>({snapshot:{mem:{}}})}};
 sandbox.window=sandbox;
 vm.runInNewContext(fs.readFileSync('js/learning-workspace-runtime.js','utf8'),sandbox);
 const runtime=sandbox.LearningWorkspaceRuntime.create({prepare:()=>gate,read:()=>({catalog:{courses:[]},courseRows:prepared?[{title:'Ready course'}]:[],joinedCourseIds:[]}),container:()=>({}),visible:()=>true,show(){}});
 runtime.show();
 assert.equal(renders.at(-1).loading,true,'first paint must be a stable loading view, not incomplete course/empty UI');
 runtime.render();
 assert.ok(renders.every(data=>data.loading),'background redraw must not expose intermediate models');
 releasePersonal({resources:[]});await Promise.resolve();
 assert.ok(renders.every(data=>data.loading),'personal response alone must not expose unfinished progress');
 release();await runtime.refresh();
 assert.equal(renders.at(-1).loading,false);
 assert.equal(renders.at(-1).courseRows.length,1);
 assert.equal(renders.at(-1).status,'','startup notice must not insert then remove an extra row');
 assert.equal(renders.filter(data=>!data.loading).length,1,'publish one complete first view');
 const before=renders.length;
 await runtime.refresh();
 assert.ok(renders.slice(before).every(data=>!data.loading),'background updates do not flash the loading view again');
 const degraded=sandbox.LearningWorkspaceRuntime.create({prepare:async()=>{throw Error('offline');},read:()=>({catalog:{courses:[]},courseRows:[{title:'Cached course'}],joinedCourseIds:[]}),container:()=>({}),visible:()=>true,show(){}});
 degraded.show();await degraded.refresh();
 assert.equal(renders.at(-1).loading,false,'failed startup leaves a readable recovery state, never an endless skeleton');
 assert.match(renders.at(-1).status,/已有内容保留/);
 console.log('Workspace first paint: stable loading → one complete view, no intermediate empty/partial rows.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
