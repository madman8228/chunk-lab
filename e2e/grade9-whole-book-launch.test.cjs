'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),base=path.join(root,'output/textbook-extractions/people-grade9-full-2013-20261015/whole-book-launch-v1');
(async()=>{
 let source=JSON.parse(fs.readFileSync(path.join(base,'textbook-ready-v1.json'),'utf8'));
 const current=process.env.GRADE9_CURRENT_RELEASE==='1'?require('../server/services/public-wordbook-versions').createPublicWordbookVersions({publishedRoot:path.join(root,'server/data/wordbook-publications')}).current(source.book.bookId):null;
 const draft=current?{book:current.book,items:current.candidate.items}:require('../server/services/textbook-wordbook-package').assemble(source);
 if(current)source={book:current.book,units:current.book.units};
 const instance=await require('../scripts/serve-wordbook-acceptance.cjs').createAcceptance(0);let browser;
 try{
  assert.notEqual(path.resolve(instance.dataDir),path.join(root,'server/data'));
  if(current){
   const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8'),precache=worker.match(/const PRECACHE = \[([\s\S]*?)\];/);assert.ok(precache);
   for(const relative of ['sw.js',...Array.from(precache[1].matchAll(/'([^']+)'/g),match=>match[1].replace(/^\//,''))]){
    const to=path.resolve(instance.appRoot,relative);assert.ok(to.startsWith(instance.appRoot+path.sep));
    if(!fs.existsSync(to)){fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(root,relative),to,fs.constants.COPYFILE_EXCL);}
   }
  }
  const urls=new Set(draft.items.flatMap(i=>[...i.images.wide,...i.images.mobile]));if(draft.book.catalog?.coverUrl)urls.add(draft.book.catalog.coverUrl);
  if(current){const visit=value=>{if(typeof value==='string'&&/^assets\/[A-Za-z0-9/_.-]+$/.test(value))urls.add(value);else if(value&&typeof value==='object')Object.values(value).forEach(visit);};visit(draft);}
  for(const url of urls){
   const from=path.join(root,url),to=path.join(instance.appRoot,url);fs.mkdirSync(path.dirname(to),{recursive:true});
   if(fs.existsSync(to))assert.deepEqual(fs.readFileSync(to),fs.readFileSync(from));else fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);
  }
  const request=(route,body)=>instance.request('/api/admin/system-wordbooks'+route,instance.adminToken,body);
  if(current){
   const directory=crypto.createHash('sha256').update(JSON.stringify(source.book.bookId)).digest('hex');
   fs.cpSync(path.join(root,'server/data/wordbook-publications',directory),path.join(instance.dataDir,'wordbook-publications',directory),{recursive:true,errorOnExist:true,force:false});
   await instance.restartBackend();
  }else{
  const imported=await request('',source),valid=await request('/'+imported.importId+'/validate',{revision:imported.revision});
  const review=await request('/'+imported.importId+'/review',{revision:valid.revision,fingerprint:valid.fingerprint,approved:true,note:'ISOLATED TEST COPY ONLY'});
  const result=await request('/'+imported.importId+'/publish',{revision:valid.revision,fingerprint:valid.fingerprint,reviewId:review.reviewId,confirmed:true,rightsConfirmed:true});
  assert.equal(result.published,true);assert.equal(result.itemCount,628);
  }
  const route='/api/wordbooks/'+encodeURIComponent(source.book.bookId),details=await instance.request(route+'/details');assert.equal(details.units.length,14);
  let checked=0;const itemIds=source.units.flatMap(unit=>unit.itemIds);
  for(const unit of source.units){
   const page=await instance.request(route+'/units/'+encodeURIComponent(unit.unitId)+'/items?limit=20');
   assert.ok(page.items.length);assert.equal(page.items[0].itemId,unit.itemIds[0]);
  }
  await instance.restartBackend();const after=await instance.request(route+'/details');assert.equal(after.units.length,14);
  const itemRoute=id=>'/api/vocabulary-items/'+encodeURIComponent(id)+(current?'?revision='+encodeURIComponent(draft.items.find(item=>item.itemId===id).contentRevision):'');
  const bookId=source.book.bookId,courseId='wordbook:'+bookId,first=draft.items[0],firstItem=await instance.request(itemRoute(first.itemId));
  const postOperation=(token,requestId,type,payload)=>instance.request('/api/operations',token,{protocol:3,requestId,type,payload});
  await postOperation(instance.learnerToken,'grade9-textbook-enrollment-001','course.enrollment',{courseId,joined:true});
  const enrollmentSnapshot=await instance.request('/api/data',instance.learnerToken);
  assert.equal(Object.values(enrollmentSnapshot.courseProgress).some(row=>row.kind==='course-enrollment'&&row.courseId===courseId&&row.joined),true,'the learner stores an enrollment reference, not textbook content');
  const unitScope={unitId:source.units[0].unitId,structureRevision:after.structureRevision},stateRoute='/api/wordbooks/'+encodeURIComponent(bookId)+'/state?unitId='+encodeURIComponent(unitScope.unitId)+'&structureRevision='+encodeURIComponent(unitScope.structureRevision);
  const initialState=await instance.request(stateRoute,instance.learnerToken);
  assert.equal(initialState.canPersist,true);
  const sessionId=crypto.randomUUID();
  await postOperation(instance.learnerToken,'grade9-textbook-session-001','vocabulary.session',{bookId,bookRevision:firstItem.bookRevision||after.revision,itemId:firstItem.itemId,sessionId,action:'start',expectedResumeRev:initialState.resumeRev,...unitScope});
  await postOperation(instance.learnerToken,'grade9-textbook-complete-001','vocabulary.complete',{bookId,bookRevision:firstItem.bookRevision||after.revision,itemId:firstItem.itemId,contentRevision:firstItem.contentRevision,sessionId,answers:{blank1:first.word},...unitScope});
  const savedState=await instance.request(stateRoute,instance.learnerToken);
  assert.equal(savedState.resume.itemId,draft.items[1].itemId,'the saved textbook position advances to the next item');
  assert.equal(Object.hasOwn(savedState.progress,first.itemId),true,'the completion is attached to the learner, not the textbook');
  const learningData=await instance.request('/api/data',instance.learnerToken);
  assert.equal(JSON.stringify(learningData).includes(first.scene),false,'learning synchronization does not duplicate textbook scenes');
  const otherState=await instance.request(stateRoute,instance.otherToken);
  assert.equal(otherState.resume,null,'a second account can read the same textbook without inheriting progress');
  assert.deepEqual(otherState.progress,{});
  const refreshedState=await instance.request(stateRoute,instance.learnerToken);
  assert.equal(refreshedState.resume.itemId,draft.items[1].itemId,'the original learner resumes after a fresh read');
  await instance.restartBackend();
  const resumedAfterRestart=await instance.request(stateRoute,instance.learnerToken);
  assert.equal(resumedAfterRestart.resume.itemId,draft.items[1].itemId,'the original learner resumes after a service restart');
  assert.equal((await instance.request(stateRoute,instance.otherToken)).resume,null);
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});
  const learnerContext=await browser.newContext({serviceWorkers:current?'allow':'block',viewport:{width:1280,height:900}});await learnerContext.addInitScript(token=>localStorage.setItem('chunklab_token',token),instance.learnerToken);
  const learnerPage=await learnerContext.newPage();await learnerPage.goto(instance.base+'/main.html?view=discover&kind=wordbook');
  const discovered=learnerPage.locator('#discoverBody .workspace-card[data-resource="'+courseId+'"]');await discovered.waitFor({timeout:20000});
  await discovered.locator('.content-card-menu > summary').click();await discovered.getByRole('button',{name:'收藏',exact:true}).click();
  await learnerPage.goto(instance.base+'/main.html?view=my-learning');const savedCard=learnerPage.locator('#myLearningBody .workspace-card[data-resource="'+courseId+'"]');await savedCard.waitFor({timeout:15000});
  await savedCard.locator('.content-card-menu > summary').click();await savedCard.getByRole('link',{name:'打开单词本',exact:true}).click();
  await learnerPage.waitForURL('**/wordbook-details.html?book='+encodeURIComponent(bookId)+'**');await learnerPage.locator('.book-unit-list .book-start').first().click();
  const unitSize=source.units[0].itemIds.length;await learnerPage.waitForFunction(size=>document.getElementById('bookPosition')?.textContent==='1 / '+size,unitSize);
  const targetWord=learnerPage.locator('.listen-word-token').first();await targetWord.click();await targetWord.waitFor({state:'visible'});assert.equal(await targetWord.getAttribute('aria-expanded'),'true','the textbook listen-and-recognize interaction reveals word details on demand');
  if(current){const screenshots=path.join(root,'output/playwright/wordbook-redesign');fs.mkdirSync(screenshots,{recursive:true});for(const width of [1043,390]){await learnerPage.setViewportSize({width,height:932});assert.ok(await learnerPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await learnerPage.screenshot({path:path.join(screenshots,'revealed-'+width+'.png'),fullPage:true});await targetWord.click();await learnerPage.screenshot({path:path.join(screenshots,'initial-'+width+'.png'),fullPage:true});await targetWord.click();}}
  await learnerPage.locator('.listen-word-next').click();await learnerPage.waitForFunction(size=>document.getElementById('bookPosition')?.textContent==='2 / '+size,unitSize);
  await learnerPage.reload();await learnerPage.waitForFunction(size=>document.getElementById('bookPosition')?.textContent==='1 / '+size,unitSize);
  assert.equal((await instance.request(stateRoute,instance.learnerToken)).resume.itemId,resumedAfterRestart.resume.itemId,'recognition browsing does not overwrite the learner’s saved exercise progress');
  let offlineReopen=null;
  if(current){
   await learnerPage.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
   await learnerPage.waitForFunction(()=>!!navigator.serviceWorker.controller);await learnerPage.reload();await learnerPage.locator('.listen-word-token').first().waitFor();
   await learnerContext.setOffline(true);
   try{await learnerPage.reload({waitUntil:'domcontentloaded'});await learnerPage.locator('.listen-word-token').first().waitFor({timeout:10000});offlineReopen={status:'pass',realServiceWorker:true};}
   catch(error){offlineReopen={status:'fail',realServiceWorker:true,error:error.message,body:await learnerPage.locator('body').innerText().catch(()=>null)};}
   await learnerContext.setOffline(false);
  }
  const otherContext=await browser.newContext({serviceWorkers:'block'});await otherContext.addInitScript(token=>localStorage.setItem('chunklab_token',token),instance.otherToken);
  const otherPage=await otherContext.newPage();await otherPage.goto(instance.base+'/wordbook.html?book='+encodeURIComponent(bookId)+'&unit='+encodeURIComponent(source.units[0].unitId)+'&structureRevision='+encodeURIComponent(after.structureRevision));
  await otherPage.waitForFunction(size=>document.getElementById('bookPosition')?.textContent==='1 / '+size,unitSize);
  assert.equal(await otherPage.locator('#bookPosition').innerText(),'1 / '+unitSize,'a second browser account reads the same textbook without inheriting the first learner position');
  const apiItemIds=current?itemIds.slice(0,2):itemIds;
  for(let offset=0;offset<apiItemIds.length;offset+=2){const batch=await Promise.all(apiItemIds.slice(offset,offset+2).map(id=>instance.request(itemRoute(id))));batch.forEach((item,index)=>{assert.equal(item.itemId,apiItemIds[offset+index]);checked++;});}
  const report={isolated:true,liveChanged:false,publishedTestCopy:!current,currentReleaseId:current?.releaseId||null,units:14,itemsChecked:checked,images:urls.size,packageSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(base,'textbook-ready-v1.json'))).digest('hex'),restartPersistence:'pass',textbookEnrollmentAndPractice:'pass',accountProgressIsolation:'pass',textbookBrowserDiscoveryBrowseReloadAccountIsolation:'pass',recognitionBrowsingDoesNotWritePracticeProgress:true,learningSnapshotContainsNoTextbookScene:true};
  report.offlineReopen=offlineReopen;
  report.integrityChecked=current?draft.items.length:null;report.apiScope=current?'first two items; full release integrity verified separately':'whole book';
  const reportPath=path.join(base,'isolated-publication-test-'+Date.now()+'.json');fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({...report,reportPath}));
  if(offlineReopen)assert.equal(offlineReopen.status,'pass','current course must reopen from visited cache offline; see report');
 }finally{await browser?.close();await instance.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
