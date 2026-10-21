'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process'),{chromium}=require('playwright-core'),Database=require('../server/node_modules/better-sqlite3');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'wordbook-study-e2e-'));
const port=require('./lib/free-port').freePort(11300,100),base='http://127.0.0.1:'+port;
let server,browser,db,logs='';
async function start(){for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(base+'/api/health')).ok)return;}catch(_){}await new Promise(resolve=>setTimeout(resolve,100));}throw Error('server timeout');}
async function request(route,token,body){const res=await fetch(base+route,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,data:await res.json()};}
async function ready(page){await page.waitForSelector('#studyRoot input',{timeout:15000});await page.waitForFunction(()=>!document.getElementById('bookStatus').textContent.includes('正在读取'));}
async function answer(page,item){
  const steps=await page.evaluate(item=>GuidedSentenceContent.forItem(item),item);
  if(steps){for(const step of steps)await page.locator('.guided-form input').fill(step.answer);return;}
  const parts=item.exercise.parts.filter(part=>part.id);for(const part of parts)await page.locator('#studyRoot input[name="'+part.id+'"]').fill(part.answers[0]);await page.locator('#studyRoot input[name="'+parts.at(-1).id+'"]').press('Enter');
}
(async()=>{try{
  const appRoot=path.join(temp,'app');fs.mkdirSync(path.join(appRoot,'content'),{recursive:true});fs.mkdirSync(path.join(appRoot,'assets'));
  fs.copyFileSync(path.join(root,'content/manifest.json'),path.join(appRoot,'content/manifest.json'));
  require('./lib/prepare-ui-root')(appRoot);
  fs.cpSync(path.join(root,'content/vocabulary'),path.join(appRoot,'content/vocabulary'),{recursive:true});
  const index=JSON.parse(fs.readFileSync(path.join(appRoot,'content/vocabulary/index.json'))),book=index.books[0];
  for(const ref of book.items){const item=JSON.parse(fs.readFileSync(path.join(appRoot,'content/vocabulary/items',ref.itemId.replace(/:/g,'_')+'.json')));for(const url of Object.values(item.images).flat())fs.copyFileSync(path.join(root,url),path.join(appRoot,url));}
  server=spawn(process.execPath,['index.js'],{cwd:path.join(root,'server'),env:{...process.env,PORT:String(port),CHUNKLAB_DATA_DIR:path.join(temp,'data'),CHUNKLAB_APP_ROOT:appRoot,NODE_ENV:'test',CHUNKLAB_WRITE_PROTOCOL:'3',REQUIRE_AUTH:'true',PHONE_AUTH_ENABLED:'false',JWT_SECRET:'isolated-wordbook-test-secret-at-least-32-characters'},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',chunk=>logs+=chunk);server.stderr.on('data',chunk=>logs+=chunk);await start();
  const a=await request('/api/auth/register',null,{username:'wordbook-a',password:'isolated-pass'}),b=await request('/api/auth/register',null,{username:'wordbook-b',password:'isolated-pass'});assert.equal(a.status,200);assert.equal(b.status,200);
  db=new Database(path.join(temp,'data/chunklab.db'));
  db.exec('CREATE TABLE IF NOT EXISTS user_phone_identities(phone TEXT PRIMARY KEY,user_id INTEGER UNIQUE,verified_at INTEGER)');
  db.prepare('INSERT INTO user_phone_identities VALUES(?,?,?)').run('test-fixture-phone',a.data.user.id,Date.now());
  db.prepare('INSERT INTO vocabulary_attempts VALUES(?,?,?,?,?)').run(a.data.user.id,'old-pilot-untouched','borrow',0,1234);
  db.prepare('INSERT INTO user_kv(user_id,k,v_json) VALUES(?,?,?)').run(a.data.user.id,'stats','{"totalAnswered":9,"totalRounds":2}');
  db.prepare('INSERT INTO user_courses(user_id,course_id,data_json) VALUES(?,?,?)').run(b.data.user.id,'preserved-old-course','{"courseId":"preserved-old-course","metadata":{"title":"旧课程原文"}}');
  const old=db.prepare('SELECT * FROM vocabulary_attempts').all();
  const originalStats=db.prepare("SELECT v_json FROM user_kv WHERE user_id=? AND k='stats'").get(a.data.user.id),originalCourse=db.prepare('SELECT data_json FROM user_courses WHERE user_id=?').get(b.data.user.id);
  assert.equal((await request('/api/wordbooks/'+book.bookId+'/items?limit=51',null)).status,400);
  assert.equal((await request('/api/vocabulary-items/unknown-project',null)).status,404);
  assert.equal((await request('/api/vocabulary-items/'+encodeURIComponent(book.items[0].itemId)+'?revision=wrong',null)).status,409);
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}});await context.addInitScript(token=>localStorage.setItem('chunklab_token',token),a.data.token);
  const page=await context.newPage(),errors=[],operations=[],images=[];let offline=false;
  page.on('pageerror',error=>errors.push(error.message));page.on('request',req=>{if(/assets\/vocabulary-/.test(req.url()))images.push(req.url());});
  await page.route('**/api/operations',route=>{operations.push(route.request().postDataJSON());return offline?route.abort():route.continue();});
  await page.goto(base+'/main.html?view=discover&kind=wordbook');await page.locator('#discoverBody .workspace-card h3').filter({hasText:/^六词练习$/}).waitFor({timeout:15000});
  const discovered=page.locator('#discoverBody .workspace-card').filter({has:page.locator('h3').filter({hasText:/^六词练习$/})});
  const discoveredId=await discovered.getAttribute('data-resource');
  await discovered.locator('.content-card-menu > summary').click();
  await discovered.getByRole('button',{name:'收藏',exact:true}).click();
  await require('./lib/wait-for-async').waitForAsync(page,async id=>{
    const data=await ChunkAPI.getData();
    return Object.values(data.mem.learningWorkspace||{}).some(row=>row.itemType==='resource'&&row.targetId===id&&row.selected)&&
      (await ServerStore.pending()).length===0;
  },discoveredId,{timeout:15000});
  await discovered.getByRole('button',{name:'取消收藏',exact:true,includeHidden:true}).waitFor({state:'attached'});
  if(!await discovered.locator('.content-card-menu').evaluate(node=>node.open))await discovered.locator('.content-card-menu > summary').click();
  await discovered.getByRole('button',{name:'取消收藏',exact:true}).waitFor();
  await page.getByRole('link',{name:'我的内容',exact:true}).click();await page.locator('.library-categories').getByRole('button',{name:/^收藏/}).click();const saved=page.locator('#myLearningBody .workspace-card').filter({has:page.locator('h3').filter({hasText:/^六词练习$/})});
  await saved.locator('.content-card-menu > summary').click();
  await saved.getByRole('link',{name:'打开单词本',exact:true}).click();
  await page.waitForURL('**/wordbook-details.html?book=pilot-six-v1**');await page.goto(base+'/wordbook.html?book='+encodeURIComponent(book.bookId));await ready(page);
  const first=(await request('/api/vocabulary-items/'+encodeURIComponent(book.items[0].itemId),null)).data;
  await page.locator('#studyRoot input').first().fill('draft');assert.equal(await page.getByRole('button',{name:'暂停',exact:true}).count(),0);assert.equal(await page.locator('#studyRoot input').first().inputValue(),'draft');
  assert.ok(images.length>0&&images.every(url=>url.includes('vocabulary-'+first.word+'-')),'only current project imagery loads');
  await answer(page,first);await page.getByText('辅助练习与下一词位置已保存。',{exact:true}).waitFor({timeout:15000});
  const completion=operations.find(row=>row.type==='vocabulary.complete');assert.ok(completion);
  const replay1=await request('/api/operations',a.data.token,completion),replay2=await request('/api/operations',a.data.token,completion);assert.equal(replay1.data.seq,replay2.data.seq);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM vocabulary_study_events').get().n,1);
  assert.equal((await request('/api/operations',a.data.token,{...completion,payload:{...completion.payload,answers:{}}})).status,409);
  const delta=await request('/api/data?since='+(replay1.data.seq-1),a.data.token);assert.equal(delta.data.mem.vocabularyResume[book.bookId].itemId,book.items[1].itemId);
  assert.equal(delta.data.mem.vocabularyStudySummary[book.bookId].assistedCompleted,1);
  await page.reload();await ready(page);assert.equal(await page.locator('#studyRoot h2').innerText(),'借入');
  const oldSession=(await request('/api/wordbooks/'+book.bookId+'/state',a.data.token)).data;
  const second=await browser.newContext({serviceWorkers:'block'});await second.addInitScript(token=>localStorage.setItem('chunklab_token',token),a.data.token);const other=await second.newPage();
  await other.goto(base+'/main.html?view=home');await other.getByRole('link',{name:'我的内容',exact:true}).click();
  const otherBook=other.locator('#myLearningBody .workspace-card').filter({has:other.locator('h3').filter({hasText:/^六词练习$/})});
  await otherBook.locator('.content-card-menu > summary').click();
  await otherBook.getByRole('link',{name:'打开单词本',exact:true}).click();await other.goto(base+'/wordbook.html?book='+encodeURIComponent(book.bookId));await ready(other);assert.equal(await other.locator('#studyRoot h2').innerText(),'借入');
  const afterStart=(await request('/api/wordbooks/'+book.bookId+'/state',a.data.token)).data;
  assert.notEqual(oldSession.resume.sessionId,afterStart.resume.sessionId);
  const nextItem=(await request('/api/vocabulary-items/'+encodeURIComponent(book.items[1].itemId),null)).data;
  const stale={protocol:3,requestId:'wordbook-stale-fixture-001',type:'vocabulary.complete',payload:{bookId:book.bookId,bookRevision:book.revision,itemId:nextItem.itemId,contentRevision:nextItem.contentRevision,sessionId:oldSession.resume.sessionId,practiceType:oldSession.resume.practiceType||'sentence-cloze',answers:Object.fromEntries(nextItem.exercise.parts.filter(part=>part.id).map(part=>[part.id,part.answers[0]]))}};
  assert.equal((await request('/api/operations',a.data.token,stale)).data.operation.outcome,'resume-stale');assert.equal((await request('/api/wordbooks/'+book.bookId+'/state',a.data.token)).data.resume.sessionId,afterStart.resume.sessionId);
  await page.reload();await ready(page);offline=true;await answer(page,nextItem);await page.getByText('待保存，连接恢复后会自动重试。',{exact:true}).waitFor();
  assert.equal((await request('/api/wordbooks/'+book.bookId+'/state',a.data.token)).data.resume.itemId,nextItem.itemId);
  offline=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.getByText('辅助练习与下一词位置已保存。',{exact:true}).waitFor({timeout:15000});
  const afterSkip=(await request('/api/vocabulary-items/'+encodeURIComponent(book.items[3].itemId),null)).data;
  await page.getByRole('button',{name:'下一词',exact:true}).click();await page.waitForFunction(label=>document.getElementById('bookPosition').textContent===label,'3 / '+book.itemCount);await page.getByRole('button',{name:'跳过',exact:true}).click();await page.waitForFunction(meaning=>document.querySelector('#studyRoot h2')?.textContent===meaning,afterSkip.meaning,{timeout:10000});
  assert.equal(db.prepare('SELECT COUNT(*) n FROM vocabulary_study_events').get().n,3,'skip has no successful event');
  const confirmed=(await request('/api/wordbooks/'+book.bookId+'/state',a.data.token)).data;
  await page.evaluate(async payload=>{try{await ServerStore.submitCommitted('vocabulary.session',payload,{requestId:'wordbook-rejected-session-fixture'});}catch(error){if(error.code!=='RESUME_CONFLICT')throw error;}},{bookId:book.bookId,bookRevision:book.revision,itemId:confirmed.resume.itemId,sessionId:'conflicting-start',action:'start',expectedResumeRev:0});
  await page.reload();await page.getByRole('button',{name:'使用已保存位置',exact:true}).click();await ready(page);
  assert.equal(await page.evaluate(async()=> (await ServerStore.pending()).some(row=>row.requestId==='wordbook-rejected-session-fixture')),false);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM vocabulary_study_events').get().n,3);
  assert.deepEqual(db.prepare('SELECT * FROM vocabulary_attempts').all(),old);
  assert.deepEqual(db.prepare("SELECT v_json FROM user_kv WHERE user_id=? AND k='stats'").get(a.data.user.id),originalStats);
  assert.deepEqual(db.prepare('SELECT data_json FROM user_courses WHERE user_id=?').get(b.data.user.id),originalCourse);
  const backupPath=path.join(temp,'verified-test-backup.db');await db.backup(backupPath);const backup=new Database(backupPath,{readonly:true});
  try{assert.equal(backup.prepare('SELECT COUNT(*) n FROM vocabulary_study_events').get().n,3);assert.deepEqual(backup.prepare('SELECT * FROM vocabulary_attempts').all(),old);}finally{backup.close();}
  const out=path.join(root,'output/playwright/wordbook-study');fs.mkdirSync(out,{recursive:true});
  for(const width of [1440,946,390,360]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+width);await page.screenshot({path:path.join(out,'study-'+width+'.png'),fullPage:true});}
  const stateB=await request('/api/wordbooks/'+book.bookId+'/state',b.data.token);assert.equal(stateB.data.canPersist,false);assert.equal(stateB.data.resume,null);assert.deepEqual(stateB.data.progress,{});
  assert.equal((await request('/api/operations',b.data.token,stale)).status,403);
  const guest=await browser.newContext({serviceWorkers:'block'}),guestPage=await guest.newPage();let guestContentRequests=0;guestPage.on('request',req=>{if(req.url().includes('/api/wordbooks/'))guestContentRequests++;});await guestPage.goto(base+'/wordbook.html?book=pilot-six-v1');await guestPage.getByText('登录后即可开始单词本练习；登录后会返回当前课程。',{exact:true}).waitFor();assert.equal(await guestPage.locator('#studyRoot input, #studyRoot button[type="submit"]').count(),0);assert.equal(guestContentRequests,0);
  assert.equal(errors.length,0,errors.join('\n'));console.log('wordbook E2E: real discovery, save, replay/delta, menu drafts, cross-device resume, stale device, offline retry, skip, visitor login gate and four widths passed; isolated port '+port);
}finally{
  if(browser)await browser.close();if(db)db.close();if(server&&server.exitCode===null)await new Promise(resolve=>{server.once('close',resolve);server.kill();});
  assert.equal(path.dirname(temp),os.tmpdir());assert.ok(path.basename(temp).startsWith('wordbook-study-e2e-'));fs.rmSync(temp,{recursive:true,force:true});
}})().catch(error=>{console.error(error.stack||error);console.error(logs.slice(-2500));process.exitCode=1;});
