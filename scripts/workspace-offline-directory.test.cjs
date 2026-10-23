'use strict';
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const rows=new Map();let owner='a',base='server-a',mode='online',release;
 function page(){
  const renders=[],events={};
  const win={URL,URLSearchParams,Map,Object,Promise,location:{href:'http://test/main.html?view=my-learning',search:'?view=my-learning'},history:{pushState(){}},navigator:{onLine:true},setTimeout:()=>1,clearTimeout(){},addEventListener:(name,fn)=>events[name]=fn,
   AccountStorage:{get owner(){return owner;},assertCurrent(){},storage:{getItem:k=>rows.get(owner+':'+k)||null,setItem:(k,v)=>rows.set(owner+':'+k,v)}},
   ChunkAPI:{getBase:()=>base,getToken:()=>owner,request:async url=>{if(mode==='pending')await new Promise(resolve=>{release=resolve;});if(mode!=='online')throw Error('offline');if(url.includes('learning-archive'))return {confirmed:true,items:[],nextOffset:null};if(url==='/api/course-library')return {courses:[]};return {resources:[{resourceId:url.includes('personal-wordbooks')?'personal-'+owner:'public-'+base}]};}},
   LearningWorkspace:{resourcesFromCatalog:()=>[{resourceId:'builtin',visibility:'public'}],normalizeResource:r=>r},LearningWorkspaceView:{render:(_,data)=>renders.push(data)},LearningWorkspaceStore:{read:async()=>({projected:{}})},ServerCache:{read:async()=>({snapshot:{mem:{}}})}};
  win.window=win;vm.runInNewContext(fs.readFileSync('js/learning-workspace-runtime.js','utf8'),win);
  const runtime=win.LearningWorkspaceRuntime.create({read:()=>({catalog:{},joinedCourseIds:[]}),container:()=>({}),visible:()=>true,show(){}});
  return {runtime,renders,events};
 }
 let p=page();p.runtime.show();await p.runtime.refresh();assert.equal(rows.size,1,'successful metadata responses are persisted');
 mode='pending';p=page();p.runtime.show();await new Promise(resolve=>setImmediate(resolve));
 assert.ok(p.renders.some(r=>r.resources?.some(row=>row.resourceId==='personal-a')),'cached directory renders while remote requests remain pending');
 // Separate offline reload avoids altering the pending request under test.
 mode='offline';p=page();p.runtime.show();await p.runtime.refresh();assert.ok(p.renders.at(-1).resources.some(r=>r.resourceId==='personal-a'));
 assert.equal(p.renders.at(-1).status,'正在显示已缓存内容，连接恢复后自动更新。');
 owner='b';p=page();p.runtime.show();await p.runtime.refresh();assert.ok(!p.renders.at(-1).resources.some(r=>r.resourceId==='personal-a'),'no cross-account fallback');
 owner='a';base='server-b';p=page();p.runtime.show();await p.runtime.refresh();assert.ok(!p.renders.at(-1).resources.some(r=>r.resourceId==='personal-a'),'no cross-server fallback');
 assert.equal(rows.size,1,'offline failure never overwrites the last successful directory');
 console.log('Workspace offline directory: early cached render, offline reload, account/base isolation and failure preservation passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
