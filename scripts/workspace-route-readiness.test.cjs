'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 let release;const directory=new Promise(resolve=>release=resolve),renders=[];
 const location={href:'http://test.invalid/main.html?view=home',search:'?view=home'};
 const sandbox={URL,URLSearchParams,Map,Object,Promise,location,history:{pushState(){}},navigator:{onLine:true},setTimeout:()=>1,clearTimeout(){},addEventListener(){},
  AccountStorage:{owner:'fixture',assertCurrent(){}},ChunkAPI:{getToken:()=>'',getBase:()=>'',request:()=>directory},
  LearningWorkspace:{resourcesFromCatalog:()=>[],normalizeResource:r=>r},LearningWorkspaceView:{render:(_,data)=>renders.push(data)},
  LearningWorkspaceStore:{read:async()=>({projected:{}})},ServerCache:{read:async()=>({})}};
 sandbox.window=sandbox;vm.runInNewContext(fs.readFileSync('js/learning-workspace-runtime.js','utf8'),sandbox);
 const runtime=sandbox.LearningWorkspaceRuntime.create({read:()=>({catalog:{courses:[]},joinedCourseIds:[]}),container:()=>({}),visible:()=>true,show(){}});
 runtime.show();await runtime.refresh();assert.equal(renders.at(-1).loading,false);
 location.search='?view=discover';runtime.show();
 assert.equal(renders.at(-1).loading,true,'first visit to discovery must not paint an incomplete local-only catalog');
 release({resources:[{resourceId:'remote-course'}]});await runtime.refresh();
 assert.equal(renders.at(-1).loading,false);assert.equal(renders.at(-1).resources.length,1);
 location.search='?view=home';runtime.show();assert.equal(renders.at(-1).loading,false,'returning to a ready route stays readable');
 console.log('Workspace route readiness: first-visit gate and ready-route background refresh passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
