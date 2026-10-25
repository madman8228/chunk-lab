'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

async function main(){
  const events={},renders=[],requests=[];
  let owner='first',fail=false,token='one',raceMode=false,raceCalls=0,releaseRaceFirst,resolveRaceStarted,resolveRaceSecond;
  const raceStarted=new Promise(resolve=>resolveRaceStarted=resolve),raceSecond=new Promise(resolve=>resolveRaceSecond=resolve);
  const context={URL,URLSearchParams,Map,Set,Object,Promise,setTimeout,clearTimeout,
    location:{search:'?view=my-learning'},history:{pushState(){},replaceState(){}},
    navigator:{onLine:true},
    AccountStorage:{get owner(){return owner;},assertCurrent(){}},
    CL:{getCloudConfig:()=>({requireAuth:true})},
    ChunkAPI:{getBase:()=>'/api',getToken:()=>token,request:async url=>{
      requests.push(url);
      if(url.startsWith('/api/learning-archive/vocabulary/courses')){
        if(raceMode){
          raceCalls++;
          if(raceCalls===1){resolveRaceStarted();return new Promise(resolve=>releaseRaceFirst=()=>resolve({confirmed:true,items:[{bookId:'race-book',state:'in-progress',completedItems:1,totalItems:3}],nextOffset:null}));}
          if(raceCalls===2){resolveRaceSecond();return {confirmed:true,items:[{bookId:'race-book',state:'in-progress',completedItems:2,totalItems:3}],nextOffset:null};}
          return {confirmed:true,items:[{bookId:'race-book',state:'in-progress',completedItems:2,totalItems:3}],nextOffset:null};
        }
        if(fail)throw Error('offline');
        if(url.endsWith('offset=0'))return {confirmed:true,items:[{bookId:owner+'-book',state:'completed'}],nextOffset:100};
        return {confirmed:true,items:[{bookId:owner+'-updated',state:'updated'}],nextOffset:null};
      }
      if(url==='/api/course-library')return {courses:[]};
      return {resources:[]};
    }},
    LearningWorkspace:{resourcesFromCatalog:()=>[],normalizeResource:value=>value},
    LearningWorkspaceView:{render:(_container,data)=>renders.push(structuredClone(data))},
    LearningWorkspaceStore:{read:async()=>({projected:{}})},
    ServerCache:{read:async()=>({snapshot:{mem:{}}})},
    addEventListener:(name,fn)=>{events[name]=fn;}
  };
  context.window=context;
  const runtimeSource=fs.readFileSync('js/learning-workspace-runtime.js','utf8');
  assert.doesNotMatch(runtimeSource,/课程总进度/,'home progress markup omits the redundant label');
  vm.runInNewContext(runtimeSource,context);
  const runtime=context.LearningWorkspaceRuntime.create({visible:()=>true,show(){},container:()=>null,
    read:()=>({catalog:{courses:[]},memberships:{},joinedCourseIds:[],due:0})});
  runtime.show();await runtime.refresh();
  assert.equal(renders.at(-1).vocabularyCourses['first-book'].state,'completed');
  assert.equal(renders.at(-1).vocabularyCourses['first-updated'].state,'updated');
  assert.ok(requests.some(url=>url.endsWith('offset=100')),'all metadata pages are read');
  fail=true;await runtime.refresh();
  assert.equal(renders.at(-1).completionReadFailed,true,'read failure cannot look like an empty confirmed result');
  fail=false;events['server-cache-applied']();await runtime.refresh(true);
  assert.equal(renders.at(-1).completionReadFailed,false,'confirmed learning changes refresh completion');
  owner='second';token='two';await runtime.refresh();runtime.render();
  assert.equal(renders.at(-1).vocabularyCourses['first-book'],undefined,'completion does not leak across accounts');
  assert.equal(renders.at(-1).vocabularyCourses['second-book'].state,'completed');
  owner='race';token='race';raceMode=true;const staleRefresh=runtime.refresh();await raceStarted;
  events['server-cache-applied']();releaseRaceFirst();await staleRefresh;
  await Promise.race([raceSecond,new Promise((_,reject)=>setTimeout(()=>reject(Error('confirmed update did not trigger a replacement course-progress read')),1500))]);
  assert.equal(raceCalls,2,'a cache update during an in-flight progress read schedules one replacement read');
  for(let attempt=0;attempt<50&&renders.at(-1).vocabularyCourses['race-book']?.completedItems!==2;attempt++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(renders.at(-1).vocabularyCourses['race-book'].completedItems,2,'a stale in-flight response cannot overwrite newly confirmed progress');
  console.log('Completion runtime: pagination, read failure, refresh and account isolation passed');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
