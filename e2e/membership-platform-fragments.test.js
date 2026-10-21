'use strict';
// Read workspace course sources only; all output and HTTP state use a new temporary root.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const express=require('node:module').createRequire(path.resolve(__dirname,'../server/package.json'))('express');
const {performance}=require('node:perf_hooks');
const {LegacyCourseInventory,prepareLegacyCourseBundle}=require('../server/services/membership/legacy-course-inventory');
const {ContentRegistry}=require('../server/services/membership/content-registry');
const {ContentGrantService}=require('../server/services/membership/content-grant-service');
const {registerCourseFragmentRoutes}=require('../server/routes/course-fragments');
async function main(){
  const appRoot=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'chunklab-platform-http-')),privateRoot=path.join(temp,'candidate');
  const inventory=new LegacyCourseInventory({appRoot}),courseIds=inventory.catalog().courses.map(course=>course.id);
  const report=prepareLegacyCourseBundle({inventory,courseIds,output:privateRoot});
  const body=fs.readFileSync(path.join(privateRoot,'candidate.json'),'utf8');
  const registry=new ContentRegistry({appRoot,protectedRoot:privateRoot,activeManifest:()=>({body})});
  const started=performance.now(),snapshot=registry.snapshot(),coldCatalogMs=performance.now()-started;
  let checks=0,now=100000;
  const decisions=new Map(courseIds.map(id=>[id,{allowed:true,mode:'free',policyRevision:1,membershipRevision:1}]));
  // Injected policy/auth isolates the content delivery contract; this is not real account activation certification.
  const grants=new ContentGrantService({keyProvider:()=>Buffer.alloc(32,71),now:()=>now,resolveScope:(...args)=>registry.fragmentScope(...args),authorize:courseId=>{checks++;return decisions.get(courseId);}});
  const app=express();app.use(express.json());
  registerCourseFragmentRoutes({app,registry,grants,auth:{authenticate(req,res,next){if(req.get('Authorization')!=='Bearer isolated-account')return res.status(401).end();req.userId=1;next();}}});
  const server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));});
  const base='http://127.0.0.1:'+server.address().port;
  let units=0,items=0,fragments=0,last;
  const loopStart=performance.now();
  try{
    for(const course of snapshot.courses)for(const unit of course.units){
      units++;const original=JSON.parse(fs.readFileSync(path.join(privateRoot,unit.file))).items;
      assert.equal(unit.recordIdentity.deckId,unit.contentRef.id);
      assert.equal(unit.recordIdentity.generationScope,'course:'+unit.contentRef.id);
      for(const fragment of unit.fragments){
        const issued=await fetch(base+'/api/learning-sessions/content-grant',{method:'POST',headers:{Authorization:'Bearer isolated-account','Content-Type':'application/json'},body:JSON.stringify({courseId:course.courseId,unitId:unit.unitId,cursor:fragment.cursor,purpose:'practice',requestId:crypto.randomUUID()})});
        assert.equal(issued.status,200);const grant=await issued.json();
        const headers={Authorization:'Bearer isolated-account','X-Course-Grant':grant.grant,'X-Course-Id':course.courseId,'X-Course-Unit':unit.unitId,'X-Course-Purpose':'practice'};
        const url=base+'/api/course-fragments/'+fragment.fragmentId;
        const response=await fetch(url,{headers});assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
        const payload=await response.json();assert.deepEqual(payload.items,original.slice(fragment.cursor,fragment.cursor+fragment.itemIds.length));assert.deepEqual(payload.recordIdentity,unit.recordIdentity);
        assert.deepEqual(registry.load(course.courseId,unit.unitId,fragment.cursor).payload.items,payload.items);
        items+=payload.items.length;fragments++;last={url,headers,courseId:course.courseId};
      }
    }
    const hotStart=performance.now();for(let i=0;i<100;i++)registry.snapshot();const hotCatalog100Ms=performance.now()-hotStart;
    assert.equal((await fetch(last.url,{headers:{Authorization:'Bearer isolated-account'}})).status,403);
    decisions.set(last.courseId,{allowed:true,mode:'member',endsAt:now+10000,policyRevision:2,membershipRevision:1});
    assert.equal((await fetch(last.url,{headers:last.headers})).status,403,'free grant invalidated when policy changes');
    decisions.set(last.courseId,{allowed:false,reasonCode:'MEMBERSHIP_REQUIRED',policyRevision:3,membershipRevision:2});
    assert.equal((await fetch(last.url,{headers:last.headers,method:'HEAD'})).status,403,'warm cache cannot bypass current access');
    now+=30001;assert.equal((await fetch(last.url,{headers:last.headers})).status,403);
    assert.ok(checks>=fragments*2);
    const evidence={courses:snapshot.courses.length,units,items,fragments,coldCatalogMs,hotCatalog100Ms,deliveryLoopMs:performance.now()-loopStart,authorizationChecks:checks,sourceCoverage:report.coverage,publicSharesChecked:report.publicSharesChecked,activationReady:false,temp,scope:'isolated real fragment HTTP routes with injected policy/auth; not full app/browser/production activation'};
    const output=path.join(appRoot,'output/membership-source-review');fs.mkdirSync(output,{recursive:true});const file=path.join(output,'all-platform-http-'+Date.now()+'.json');fs.writeFileSync(file,JSON.stringify(evidence,null,2),{flag:'wx'});
    console.log(JSON.stringify({...evidence,evidence:file}));
  }finally{await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
