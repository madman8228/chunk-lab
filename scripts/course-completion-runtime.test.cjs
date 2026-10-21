'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

async function main(){
  const events={},renders=[],requests=[];
  let owner='first',fail=false,token='one';
  const context={URL,URLSearchParams,Map,Set,Object,Promise,setTimeout,clearTimeout,
    location:{search:'?view=my-learning'},history:{pushState(){},replaceState(){}},
    navigator:{onLine:true},
    AccountStorage:{get owner(){return owner;},assertCurrent(){}},
    CL:{getCloudConfig:()=>({requireAuth:true})},
    ChunkAPI:{getBase:()=>'/api',getToken:()=>token,request:async url=>{
      requests.push(url);
      if(url.startsWith('/api/learning-archive/vocabulary/courses')){
        if(fail)throw Error('offline');
        if(url.endsWith('offset=0'))return {confirmed:true,items:[{bookId:owner+'-book',state:'completed'}],nextOffset:100};
        return {confirmed:true,items:[{bookId:owner+'-updated',state:'updated'}],nextOffset:null};
      }
      return {resources:[]};
    }},
    LearningWorkspace:{resourcesFromCatalog:()=>[],normalizeResource:value=>value},
    LearningWorkspaceView:{render:(_container,data)=>renders.push(structuredClone(data))},
    LearningWorkspaceStore:{read:async()=>({projected:{}})},
    ServerCache:{read:async()=>({snapshot:{mem:{}}})},
    addEventListener:(name,fn)=>{events[name]=fn;}
  };
  context.window=context;
  vm.runInNewContext(fs.readFileSync('js/learning-workspace-runtime.js','utf8'),context);
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
  console.log('Completion runtime: pagination, read failure, refresh and account isolation passed');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
