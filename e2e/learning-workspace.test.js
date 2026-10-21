'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright-core');
const {waitForAsync}=require('./lib/wait-for-async');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'chunk-workspace-e2e-'));
const port=require('./lib/free-port').freePort(11200,100),base='http://127.0.0.1:'+port;
let server,browser,logs='';
async function waitServer(){for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await new Promise(resolve=>setTimeout(resolve,100));}throw Error('server timeout '+logs);}
async function ready(page){await page.waitForFunction(()=>window._mainBooted&&window.CL&&CL.serverPersistenceReady()&&document.querySelector('.learning-workspace'),null,{timeout:20000});await page.waitForFunction(()=>!document.querySelector('.workspace-status')?.textContent.includes('正在读取'),null,{timeout:12000});}
async function cardAction(card,name){
  if(!await card.locator('.content-card-menu').evaluate(node=>node.open))await card.locator('.content-card-menu > summary').click();
  await card.getByRole('button',{name,exact:true}).click();
}
async function savedCard(page,card){
  const id=await card.getAttribute('data-resource');
  await waitForAsync(page,async id=>{
    const data=await ChunkAPI.getData();
    return data.mem.learningWorkspace['resource:'+id]?.selected===true&&(await ServerStore.pending()).length===0;
  },id,{timeout:15000});
  await card.getByRole('button',{name:'取消收藏',exact:true,includeHidden:true}).waitFor({state:'attached'});
}
async function main(){try{
  fs.mkdirSync(path.join(temp,'app/content'),{recursive:true});
  fs.copyFileSync(path.join(root,'content/manifest.json'),path.join(temp,'app/content/manifest.json'));
  require('./lib/prepare-ui-root')(path.join(temp,'app'));
  server=spawn(process.execPath,['index.js'],{cwd:path.join(root,'server'),env:{...process.env,PORT:String(port),CHUNKLAB_DATA_DIR:path.join(temp,'data'),CHUNKLAB_APP_ROOT:path.join(temp,'app'),NODE_ENV:'test',CHUNKLAB_WRITE_PROTOCOL:'3',REQUIRE_AUTH:'true',JWT_SECRET:'isolated-workspace-user-secret-at-least-32-characters',PHONE_AUTH_ENABLED:'false',ADMIN_PASSWORD:'isolated-workspace-pass',ADMIN_JWT_SECRET:'isolated-workspace-admin-secret-at-least-32-characters',MEMBERSHIP_CONTENT_GRANT_KEY:crypto.randomBytes(32).toString('base64')},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',chunk=>logs+=chunk);server.stderr.on('data',chunk=>logs+=chunk);await waitServer();
  const adminResponse=await fetch(base+'/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:'isolated-workspace-pass'})});assert.equal(adminResponse.status,200);
  const adminSession=await adminResponse.json();
  const adminHeaders={'content-type':'application/json',authorization:'Bearer '+adminSession.token};
  const draft={format:'chunklab-ai-course',formatVersion:'1.1',title:'隔离工作台学习课程',description:'Synthetic workspace acceptance fixture',
    targetCefr:'A1',contentForm:'article',roles:[],learning:{template:'sentence-practice',version:1,modes:['chunkSelection'],defaultMode:'chunkSelection'},
    items:[['We are ready.','我们准备好了。'],['Let us begin.','我们开始吧。'],['See you soon.','回头见。']].map(([en,zh])=>({en,zh,chunks:[en],hints:[zh]}))};
  const preparedResponse=await fetch(base+'/api/admin/membership/course-publications/prepare',{method:'POST',headers:adminHeaders,
    body:JSON.stringify({draft,images:[],requestId:'workspace_fixture_prepare_001'})});
  const prepared=await preparedResponse.json();assert.equal(preparedResponse.status,200,JSON.stringify(prepared));
  const publishedResponse=await fetch(base+'/api/admin/membership/course-publications/publish',{method:'POST',headers:adminHeaders,
    body:JSON.stringify({publicationId:prepared.publicationId,contentHash:prepared.contentHash,registryVersion:prepared.registryVersion,
      accessLevel:'free',acceptWarnings:true,requestId:'workspace_fixture_publish_001'})});
  assert.equal(publishedResponse.status,200,await publishedResponse.text());
  const protectedCatalog=await (await fetch(base+'/api/course-content/catalog')).json();
  assert.ok(protectedCatalog.courses.some(course=>course.courseId===prepared.publicationId),'published synthetic content is available before opening the workspace');
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}}),page=await context.newPage();
  const registered=await fetch(base+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'workspace-owner-a',password:'test-workspace-pass'})});
  assert.equal(registered.status,200);const session=await registered.json();
  await context.addInitScript(token=>localStorage.setItem('chunklab_token',token),session.token);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/main.html?view=discover');await ready(page);
  await page.getByRole('button',{name:/^单词本（\d+）$/}).click();
  await page.getByText('没有找到相关内容，试试更短的关键词。',{exact:true}).waitFor();
  assert.equal(await page.locator('#discoverBody .workspace-card').count(),0,'the isolated catalog has no vocabulary books');
  await page.locator('#discoverBody').getByRole('button',{name:/^课程（\d+）$/}).click();
  const cards=page.locator('#discoverBody .workspace-card');assert.ok(await cards.count()>0);
  await page.getByRole('link',{name:'首页',exact:true}).click();
  assert.equal(await page.locator('.workspace-shortcuts').count(),0,'homepage no longer exposes abstract tool shortcuts');
  await page.getByRole('link',{name:'发现',exact:true}).click();
  const title=await cards.first().locator('h3').textContent();
  const directory=(await (await fetch(base+'/api/library')).json()).resources;
  const resource=directory.find(row=>row.sourceRefs.some(ref=>ref.type==='protected-course'&&ref.id===prepared.publicationId));
  const publicRef=directory.flatMap(row=>row.sourceRefs).find(ref=>ref.type==='sentence-deck');
  assert.ok(resource);
  const discoveryOutput=path.join(root,'output/playwright/learning-workspace');fs.mkdirSync(discoveryOutput,{recursive:true});
  for(const width of [946,390]){
    await page.setViewportSize({width,height:932});await page.reload();await ready(page);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'discovery overflow at '+width);
    if(width===946){
      assert.equal(await page.locator('.discover-more').count(),0,'empty advanced filters are not displayed');
      const layout=await cards.first().evaluate(node=>({cover:getComputedStyle(node.querySelector('img')).aspectRatio,
        title:getComputedStyle(node.querySelector('h3')).whiteSpace}));
      assert.deepEqual(layout,{cover:'4 / 3',title:'nowrap'},'discovery follows the shared cover-card layout');
    }
    await page.screenshot({path:path.join(discoveryOutput,'discover-'+width+'.png'),fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1000});await page.reload();await ready(page);
  // Metadata administration uses only the isolated directory and database.
  const adminContext=await browser.newContext({serviceWorkers:'block'});await adminContext.addInitScript(token=>localStorage.setItem('chunklab_admin_token',token),adminSession.token);
  const adminPage=await adminContext.newPage();await adminPage.goto(base+'/content-studio.html');await adminPage.getByRole('button',{name:'目录分类',exact:true}).click();
  await adminPage.getByText('选择内容，或新建引用集合。',{exact:true}).waitFor();
  await adminPage.getByRole('button',{name:'新建引用集合',exact:true}).click();
  await adminPage.getByLabel('稳定内容编号',{exact:true}).fill('collection:workspace-test-one');
  await adminPage.getByLabel('标题',{exact:true}).fill('隔离目录测试课程');
  await adminPage.getByLabel('学段',{exact:true}).fill('小学');
  await adminPage.getByLabel('水平',{exact:true}).fill('A1');
  await adminPage.getByLabel('公开素材引用',{exact:true}).selectOption(JSON.stringify(publicRef));
  await adminPage.getByRole('button',{name:'保存目录草稿',exact:true}).click();await adminPage.getByText(/目录草稿已保存/).waitFor();
  assert.equal((await (await fetch(base+'/api/library')).json()).resources.some(row=>row.resourceId==='collection:workspace-test-one'),false);
  await adminPage.getByRole('button',{name:'发布目录分类',exact:true}).click();await adminPage.getByText(/目录分类已发布/).waitFor();
  for(let i=2;i<=4;i++){const id='collection:workspace-test-'+i,metadata={resourceId:id,kind:'course',title:'隔离目录测试 '+i,sourceRefs:[publicRef],facets:{levels:[i===4?'A2':'A1'],schoolStages:['小学']}};
    assert.equal((await fetch(base+'/api/admin/library/resources/'+id+'/draft',{method:'PUT',headers:adminHeaders,body:JSON.stringify({baseRevision:0,resource:metadata})})).status,200);
    assert.equal((await fetch(base+'/api/admin/library/resources/'+id+'/publish',{method:'POST',headers:adminHeaders,body:'{"revision":1}'})).status,200);
  }
  await page.evaluate(()=>workspace().refresh());
  await page.locator('#discoverBody input[name=levels][value=A1]').check();
  await page.waitForFunction(()=>new URLSearchParams(location.search).getAll('levels').includes('A1'));
  assert.equal(await page.locator('#discoverBody .workspace-card').count(),3);
  await page.setViewportSize({width:390,height:900});await page.reload();await ready(page);
  await page.getByRole('button',{name:'筛选内容',exact:true}).click();assert.equal(await page.getByRole('dialog',{name:'筛选内容'}).isVisible(),true);
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'筛选内容',exact:true}).evaluate(node=>node===document.activeElement),true);
  await page.getByRole('button',{name:'筛选内容',exact:true}).click();await page.getByRole('dialog').locator('input[name=levels][value=A2]').click();
  await page.waitForFunction(()=>new URLSearchParams(location.search).getAll('levels').includes('A2'));
  if(await page.getByRole('dialog').isVisible())await page.getByRole('dialog').getByRole('button',{name:'关闭筛选',exact:true}).click();
  assert.equal(await page.locator('#discoverBody input[name=levels][value=A2]').isChecked(),true,'the rerendered immediate filter keeps A2 selected');
  assert.deepEqual(new URL(page.url()).searchParams.getAll('levels'),['A1','A2']);assert.equal(await page.locator('#discoverBody .workspace-card').count(),4);
  await page.getByRole('button',{name:'水平：A1 · 移除',exact:true}).click();assert.deepEqual(new URL(page.url()).searchParams.getAll('levels'),['A2']);assert.equal(await page.locator('#discoverBody .workspace-card').count(),1);
  await page.goBack();assert.equal(await page.locator('#discoverBody .workspace-card').count(),4);await page.reload();await ready(page);assert.deepEqual(new URL(page.url()).searchParams.getAll('levels'),['A1','A2']);
  await page.setViewportSize({width:1440,height:1000});await page.reload();await ready(page);
  for(const level of ['A1','A2'])await page.getByRole('button',{name:'水平：'+level+' · 移除',exact:true}).click();
  assert.deepEqual(new URL(page.url()).searchParams.getAll('levels'),[]);
  for(let i=1;i<=4;i++){
    const id=i===1?'collection:workspace-test-one':'collection:workspace-test-'+i;
    const card=page.locator('#discoverBody .workspace-card[data-resource="'+id+'"]');
    assert.equal(await card.getAttribute('data-resource'),id);
    await cardAction(card,'收藏');await savedCard(page,card);
  }
  assert.equal(await page.evaluate(async()=>Object.values((await ChunkAPI.getData()).mem.learningWorkspace).filter(row=>row.itemType==='resource'&&row.selected).length),4);
  const target=page.locator('#discoverBody .workspace-card').filter({has:page.locator('h3').filter({hasText:resource.title})}).first();
  await cardAction(target,'收藏');await savedCard(page,target);
  const saved=await page.evaluate(async id=>{const data=await ChunkAPI.getData();return data.mem.learningWorkspace['resource:'+id];},resource.resourceId);assert.equal(saved.selected,true);
  const replay=await page.evaluate(async id=>{const operation={protocol:3,requestId:'workspace-idempotence-test-001',type:'workspace.select',payload:{itemType:'resource',targetId:id,selected:true}};
    const first=await ChunkAPI.request('/api/operations',{method:'POST',body:JSON.stringify(operation)}),second=await ChunkAPI.request('/api/operations',{method:'POST',body:JSON.stringify(operation)});
    let reused;try{await ChunkAPI.request('/api/operations',{method:'POST',body:JSON.stringify({...operation,payload:{...operation.payload,selected:false}})});}catch(error){reused=error.status;}
    const delta=await ChunkAPI.request('/api/data?since='+(first.seq-1));return {first:first.seq,second:second.seq,reused,delta:delta.mem.learningWorkspace['resource:'+id]};},resource.resourceId);
  assert.equal(replay.first,replay.second);assert.equal(replay.reused,409);assert.equal(replay.delta.selected,true);
  await page.getByRole('link',{name:'我的内容',exact:true}).click();
  await page.locator('.library-categories').getByRole('button',{name:/^收藏/}).click();
  await page.locator('#myLearningBody h3').filter({hasText:resource.title}).waitFor();
  await page.reload();await ready(page);assert.match(page.url(),/view=my-learning/);
  await page.getByRole('link',{name:'发现',exact:true}).click();
  await cardAction(target,'加入学习');
  await page.locator('.course-access-panel').getByRole('button',{name:'开始学习',exact:true}).click();
  await page.waitForFunction(()=>!document.getElementById('pagePractice').classList.contains('hidden')&&window.S&&S.deck,null,{timeout:15000});
  // Exercise the application's answer controls, not a synthetic server answer.
  await page.waitForFunction(()=>S.deck&&Array.isArray(S.deck.items)&&S.deck.items.length>0,null,{timeout:15000});
  await page.waitForFunction(()=>document.querySelector('#stageChoices .choice'),null,{timeout:15000});
  const deckId=await page.evaluate(()=>S.deck.id);
  const beforeAnswers=await page.evaluate(async()=>((await ChunkAPI.getData()).mem.stats||{}).totalAnswered||0);
  const chunkCount=await page.evaluate(()=>cur().chunks.length);
  for(let i=0;i<chunkCount;i++){
    const selector=await page.evaluate(()=>'#stageChoices .choice[data-v="'+CSS.escape(cur().chunks[S.chunkIdx])+'"]');
    await page.locator(selector).click();
  }
  await waitForAsync(page,async before=>((await ChunkAPI.getData()).mem.stats||{}).totalAnswered>before,beforeAnswers,{timeout:15000});
  await page.locator('#btnNext').click();
  await waitForAsync(page,async id=>Object.values((await ChunkAPI.getData()).learningResumes||{}).some(row=>row.deckId===id&&row.idx===1),deckId,{timeout:15000});
  await page.locator('#btnExitPractice').click();await page.locator('.learning-workspace:visible').waitFor();
  const token=await page.evaluate(()=>ChunkAPI.getToken());
  const second=await browser.newContext({serviceWorkers:'block'});
  await second.addInitScript(token=>{localStorage.setItem('chunklab_token',token);},token);
  const other=await second.newPage();await other.goto(base+'/main.html?view=my-learning');await ready(other);
  await other.locator('#myLearningBody h3').filter({hasText:resource.title}).waitFor({timeout:15000});
  assert.equal(await other.locator('.library-categories button').count(),3);
  assert.equal(await other.locator('.library-categories button[aria-pressed=true]').innerText().then(text=>text.startsWith('全部')),true);
  assert.equal(await other.locator('#myLearningBody .library-progress-detail').count(),0,'management does not duplicate homepage progress cards');
  await other.getByRole('searchbox',{name:'搜索我的内容'}).fill('不存在的隔离课程');
  await other.waitForFunction(()=>new URLSearchParams(location.search).get('contentQuery')==='不存在的隔离课程');
  await other.getByText('没有符合条件的内容。',{exact:true}).waitFor();
  await other.reload();await ready(other);
  assert.equal(await other.getByRole('searchbox',{name:'搜索我的内容'}).inputValue(),'不存在的隔离课程');
  await other.getByRole('searchbox',{name:'搜索我的内容'}).fill('');
  await other.waitForFunction(()=>!new URLSearchParams(location.search).get('contentQuery'));
  const otherCard=other.locator('#myLearningBody .workspace-card[data-resource="'+resource.resourceId+'"]');
  await otherCard.locator('.library-primary').waitFor({state:'attached'});
  assert.equal(await otherCard.locator('.library-primary').getAttribute('href'),'main.html?protectedCourse='+encodeURIComponent(prepared.publicationId));
  const libraryBackground=await other.evaluate(()=>getComputedStyle(document.body).backgroundImage);
  assert.match(libraryBackground,/linear-gradient/);
  const libraryOutput=path.join(root,'output/playwright/learning-workspace');fs.mkdirSync(libraryOutput,{recursive:true});
  for(const width of [946,390]){
    await other.setViewportSize({width,height:1000});
    assert.equal(await other.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'library overflow at '+width);
    await other.screenshot({path:path.join(libraryOutput,'library-'+width+'.png'),fullPage:true});
  }
  await otherCard.locator('.library-more summary').click();
  assert.equal(await otherCard.getByRole('button',{name:'退出在学',exact:true}).isVisible(),true);
  await otherCard.locator('.library-more summary').focus();
  await other.evaluate(()=>workspace().render());
  assert.equal(await otherCard.locator('.library-more').evaluate(node=>node.open),true);
  assert.equal(await otherCard.locator('.library-more summary').evaluate(node=>node===document.activeElement),true);
  await other.keyboard.press('Escape');
  assert.equal(await otherCard.locator('.library-more').evaluate(node=>node.open),false);
  await otherCard.locator('.library-more summary').click();
  await otherCard.locator('.library-primary').click();
  await other.waitForURL('**/main.html?protectedCourse='+encodeURIComponent(prepared.publicationId));
  await other.locator('.course-access-panel').getByRole('button',{name:/^(开始学习|继续学习)$/}).click();
  await other.waitForFunction(id=>S.deck&&S.deck.id===id&&cur(),deckId,{timeout:15000});
  assert.equal(await other.evaluate(()=>cur().sentence),'Let us begin.','the second device opens the confirmed next sentence');
  await other.locator('#btnExitPractice').click();
  await other.getByRole('link',{name:'我的内容',exact:true}).click();await ready(other);
  await other.getByRole('link',{name:'首页',exact:true}).click();
  assert.equal(await other.evaluate(()=>getComputedStyle(document.body).backgroundImage),libraryBackground,'navigation keeps the same background');
  await other.locator('.workspace-active .hd-main-action').first().waitFor({timeout:12000});
  assert.equal(await other.locator('.workspace-resume').count(),0);
  const homeRow=other.locator('.workspace-active .hd-row').filter({hasText:resource.title});
  await homeRow.getByText('已加入学习 · 打开后读取最新位置',{exact:true}).waitFor();
  assert.equal(await homeRow.getByRole('progressbar').count(),0,'protected metadata does not fabricate ordinary-deck coverage');
  const homeSnapshot=await other.evaluate(async()=>ChunkAPI.getData());
  assert.ok(Object.entries(homeSnapshot.mem.stats.bySentence).some(([key,row])=>key.startsWith(deckId+'#')&&row.times===1),'the protected answer remains confirmed despite the metadata-only home display');
  assert.ok(Object.values(homeSnapshot.learningResumes).some(row=>row.deckId===deckId&&row.idx===1),'home navigation preserves the confirmed next-sentence checkpoint');
  assert.ok(await homeRow.locator('.hc-course-cover img').count()>0,'active course keeps its cover');
  assert.equal(await homeRow.locator('.hd-select-lessons').count(),0,'a single-unit fixture has no multi-lesson picker');
  assert.equal(await homeRow.locator('.hd-action').getAttribute('href'),'main.html?protectedCourse='+encodeURIComponent(prepared.publicationId));
  assert.equal(await other.locator('.workspace-active .home-add-course').isVisible(),true);
  const courseAction=homeRow.locator('.hd-main-action');
  await courseAction.hover();
  assert.equal(await courseAction.evaluate(node=>getComputedStyle(node).backgroundColor),'rgba(0, 0, 0, 0)','course hover must not paint a yellow inner block');
  assert.equal(await other.locator('.workspace-tool-links,.workspace-tool-editor').count(),0);
  await courseAction.click();
  await other.locator('.course-access-panel').getByRole('button',{name:/^(开始学习|继续学习)$/}).click();
  await other.waitForFunction(id=>S.deck&&S.deck.id===id&&cur(),deckId,{timeout:15000});
  assert.equal(await other.evaluate(()=>cur().sentence),'Let us begin.','home continuation honors the protected checkpoint');
  await other.locator('#btnExitPractice').click();await other.locator('.learning-workspace:visible').waitFor();
  const out=path.join(root,'output/playwright/learning-workspace');fs.mkdirSync(out,{recursive:true});
  for(const width of [1440,946,390,360]){await other.setViewportSize({width,height:1000});assert.equal(await other.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow at '+width);await other.screenshot({path:path.join(out,'home-'+width+'.png'),fullPage:true});}
  await page.goto(base+'/main.html?view=discover');await ready(page);
  const offlineTarget=page.locator('#discoverBody .workspace-card[data-resource="collection:workspace-test-one"]');
  await page.route('**/api/operations',route=>route.abort());
  await cardAction(offlineTarget,'取消收藏');await offlineTarget.getByText('待保存',{exact:true}).waitFor({state:'attached'});
  assert.equal(await page.evaluate(async()=> (await ChunkAPI.getData()).mem.learningWorkspace['resource:collection:workspace-test-one'].selected),true,'offline cancellation must not claim confirmed save');
  await page.unroute('**/api/operations');await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await waitForAsync(page,async()=> (await ChunkAPI.getData()).mem.learningWorkspace['resource:collection:workspace-test-one'].selected===false,null,{timeout:15000});
  await page.evaluate(()=>workspace().refresh());await offlineTarget.getByRole('button',{name:'收藏',exact:true,includeHidden:true}).waitFor({state:'attached'});
  await page.route('**/api/library',route=>route.abort());
  await page.evaluate(()=>workspace().refresh());await page.getByText(/内容目录读取失败/).waitFor();
  assert.ok(await cards.count()>0,'last readable directory remains visible');await page.unroute('**/api/library');
  await page.route('**/api/library',route=>route.abort());await page.route('**/api/personal-wordbooks',route=>route.abort());
  await page.evaluate(()=>workspace().refresh());await page.getByText('部分内容未能读取，已保留现有内容。',{exact:true}).waitFor();
  assert.ok(await cards.count()>0,'combined read failure keeps the last readable directory');await page.unroute('**/api/library');await page.unroute('**/api/personal-wordbooks');
  await page.getByRole('button',{name:'重试',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#discoverBody .workspace-status')?.textContent.includes('读取失败'));
  await page.route('**/api/library',route=>route.abort());await page.route('**/api/personal-wordbooks',route=>route.abort());
  await page.getByRole('link',{name:'我的内容',exact:true}).click();
  await page.evaluate(()=>workspace().refresh());
  const libraryNotice=page.locator('#noticeBannerRail .notice-banner-message [role="status"]');
  await libraryNotice.getByText('内容暂时无法加载。',{exact:true}).waitFor();
  assert.equal(await libraryNotice.innerText(),'内容暂时无法加载。','my content hides internal resource names and cache details');
  assert.equal(await page.getByRole('searchbox',{name:'搜索我的内容'}).count(),0,'search is hidden while the content directory is unavailable');
  assert.equal(await page.getByRole('link',{name:'创建/导入',exact:true}).count(),0,'create/import is hidden while the content directory is unavailable');
  assert.ok(await page.locator('#myLearningBody .workspace-card').count()>0,'my content keeps the last readable cards');
  await page.unroute('**/api/library');await page.unroute('**/api/personal-wordbooks');
  await page.getByRole('button',{name:'重试',exact:true}).click();
  await libraryNotice.waitFor({state:'detached'});
  await page.getByRole('searchbox',{name:'搜索我的内容'}).waitFor();
  assert.equal(await page.getByRole('link',{name:'创建/导入',exact:true}).count(),1,'controls return after a successful retry');
  assert.equal(errors.length,0,errors.join('\n'));
  await other.goto(base+'/');await other.waitForURL('**/main.html?view=home');await ready(other);
  const bResponse=await fetch(base+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'workspace-owner-b',password:'test-workspace-pass'})});assert.equal(bResponse.status,200);
  const bSession=await bResponse.json(),bContext=await browser.newContext({serviceWorkers:'block'});await bContext.addInitScript(token=>localStorage.setItem('chunklab_token',token),bSession.token);
  const bPage=await bContext.newPage();await bPage.goto(base+'/main.html?view=my-learning');await ready(bPage);assert.equal(await bPage.locator('#myLearningBody .workspace-card').count(),0);
  const emptyDiscover=bPage.locator('#myLearningBody .library-empty-discover');await emptyDiscover.waitFor();
  assert.equal(await emptyDiscover.evaluate(node=>node.parentElement.textContent),'你还没有个人内容，去发现选一份开始','empty-state copy has no spaces around the discovery link');
  assert.equal(await emptyDiscover.evaluate(node=>getComputedStyle(node).textDecorationLine),'none','discovery link has no underline');
  assert.equal(await bPage.evaluate(async()=>Object.values((await ChunkAPI.getData()).mem.learningWorkspace||{}).filter(row=>row.selected).length),0,'account B must not inherit A favorites or pinned tools');
  assert.ok([401,403].includes((await fetch(base+'/api/admin/library/resources/collection:workspace-test-one/publish',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+bSession.token},body:'{"revision":1}'})).status));
  console.log('workspace E2E: discovery, save, reload, join, exit, second context, network failure and four widths passed; isolated port '+port+'; first title '+title);
}finally{
  if(browser)await browser.close();
  if(server&&server.exitCode===null)await new Promise(resolve=>{server.once('close',resolve);server.kill();});
  assert.equal(path.dirname(temp),os.tmpdir());assert.ok(path.basename(temp).startsWith('chunk-workspace-e2e-'));fs.rmSync(temp,{recursive:true,force:true});
}}
main().catch(error=>{console.error(error.stack||error);console.error(logs.slice(-2000));process.exitCode=1;});
