'use strict';
// Actual pilot media/content, synthetic isolated accounts and review receipts only.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawn,spawnSync}=require('node:child_process');
const {chromium}=require('playwright-core'),Database=require('../server/node_modules/better-sqlite3');
const root=path.resolve(__dirname,'..'),source=path.join(root,'drafts/scene-wordbooks/borrow-things-v1/audio-a-v3/integrated-v4');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'borrow-persistence-e2e-')),children=[];
const read=file=>JSON.parse(fs.readFileSync(file,'utf8')),digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const originals=['wordbook.json','library.json','approval.json'].map(name=>({file:path.join(source,name),sha256:digest(path.join(source,name))}));
let browser,db,logs='';
const environment={...process.env,HOST:'127.0.0.1',NODE_ENV:'test',CHUNKLAB_WORD_DICTATION:'true',CHUNKLAB_WRITE_PROTOCOL:'3',REQUIRE_AUTH:'true',PHONE_AUTH_ENABLED:'false',JWT_SECRET:'isolated-borrow-pilot-secret-at-least-32-characters',ADMIN_PASSWORD:'isolated-pilot-pass',ADMIN_JWT_SECRET:'isolated-borrow-admin-secret-at-least-32-characters'};
function appFixture(appRoot){
 require('./lib/prepare-ui-root')(appRoot);fs.mkdirSync(path.join(appRoot,'content/vocabulary'),{recursive:true});
 fs.writeFileSync(path.join(appRoot,'content/vocabulary/index.json'),JSON.stringify({schemaVersion:1,books:[]}));
 fs.copyFileSync(path.join(root,'content/manifest.json'),path.join(appRoot,'content/manifest.json'));
}
async function start(appRoot,dataDir,low){
 const port=require('./lib/free-port').freePort(low,100),base='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,['index.js'],{cwd:path.join(root,'server'),env:{...environment,PORT:String(port),CHUNKLAB_DATA_DIR:dataDir,CHUNKLAB_APP_ROOT:appRoot},stdio:['ignore','pipe','pipe']});children.push(child);child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk);
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(logs.slice(-3000));try{if((await fetch(base+'/api/health')).ok)return base;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Isolated service did not become ready');
}
async function request(base,route,token,body){const response=await fetch(base+route,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};}
(async()=>{try{
 const draft=read(path.join(source,'wordbook.json')),library=read(path.join(source,'library.json')),course=library.courses.find(c=>c.audience==='adult');
 const appRoot=path.join(temp,'app'),dataDir=path.join(temp,'data');appFixture(appRoot);
 const assets=[...new Set(draft.items.flatMap(item=>[...item.images.wide,item.dictation.audio.url,item.sentenceAudio.audio.url]))];
 const assetHashes=assets.map(file=>({file,sha256:digest(path.join(root,file))}));
 for(const file of assets)fs.copyFileSync(path.join(root,file),path.join(appRoot,file),fs.constants.COPYFILE_EXCL);
 const base=await start(appRoot,dataDir,12900),account=await request(base,'/api/auth/register',null,{username:'isolated-pilot-learner',password:'isolated-pass'});assert.equal(account.status,200);const token=account.data.token;
 const other=await request(base,'/api/auth/register',null,{username:'isolated-pilot-other',password:'isolated-pass'});assert.equal(other.status,200);
 const admin=await request(base,'/api/admin/login',null,{password:'isolated-pilot-pass'});assert.equal(admin.status,200);
 const route='/api/admin/vocabulary-material-libraries/pilot-isolated',saved=await request(base,route,admin.data.token,{library,baseRevision:null});assert.equal(saved.status,200);
 const preparation={revision:saved.data.revision,courseId:course.courseId,images:course.units.flatMap(u=>u.activityRefs.map(ref=>({itemId:ref.itemId,url:draft.items.find(i=>i.itemId===ref.itemId).images.wide[0]}))),review:{revision:saved.data.revision,content:'pending',level:'pending',assets:'pending',rights:'pending',reviewer:'Isolated acceptance fixture',note:'Synthetic receipt in a new temporary database only; not approval or publication of the real pilot'}};
 assert.equal((await request(base,route+'/release/validate',admin.data.token,preparation)).status,422,'actual pending receipt remains blocked');
 for(const key of ['content','level','assets','rights'])preparation.review[key]='approved';
 const checked=await request(base,route+'/release/validate',admin.data.token,preparation);assert.equal(checked.status,200,JSON.stringify(checked.data));
 assert.equal((await request(base,route+'/release/publish',admin.data.token,{preparation,fingerprint:checked.data.fingerprint,confirmed:true})).status,200);
 db=new Database(path.join(dataDir,'chunklab.db'));db.exec('CREATE TABLE IF NOT EXISTS user_phone_identities(phone TEXT PRIMARY KEY,user_id INTEGER UNIQUE,verified_at INTEGER)');db.prepare('INSERT INTO user_phone_identities VALUES(?,?,?)').run('isolated-test-only',account.data.user.id,Date.now());
 const stateRoute='/api/wordbooks/'+encodeURIComponent(course.courseId)+'/state',startPath='/wordbook.html?book='+encodeURIComponent(course.courseId);
 const events=()=>db.prepare('SELECT * FROM vocabulary_study_events WHERE user_id=? ORDER BY event_id').all(account.data.user.id);
 browser=await chromium.launch({headless:true});const context=await browser.newContext({serviceWorkers:'block'});await context.addInitScript(token=>{localStorage.setItem('chunklab_token',token);speechSynthesis.speak=()=>{throw Error('Pilot must use authored audio');};},token);
 const page=await context.newPage(),errors=[],media=[],operations=[];page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(url.origin!==base)return route.abort();if(url.pathname.endsWith('.ogg'))media.push(url.pathname);if(url.pathname==='/api/operations'&&request.method()==='POST')operations.push(request.postDataJSON());return route.continue();});
 await page.goto(base+'/wordbook-details.html?book='+encodeURIComponent(course.courseId));await page.getByRole('button',{name:'对话',exact:true}).click();await page.getByRole('heading',{name:'对话',exact:true}).waitFor();assert.equal(await page.locator('.book-material').count(),2);await page.getByRole('button',{name:'短文',exact:true}).click();await page.getByRole('heading',{name:'短文',exact:true}).waitFor();assert.equal(events().length,0);assert.equal(media.length,0);
 await page.getByRole('link',{name:'开始 / 继续练习'}).click();
 for(const [index,item] of draft.items.entries()){
  await page.waitForFunction(label=>document.getElementById('bookPosition')?.textContent===label,(index+1)+' / 6');await page.locator('#studyRoot input').waitFor();
  await page.getByRole('button',{name:'听单词',exact:true}).click();await page.getByText('正在播放课程音频。',{exact:true}).waitFor();assert.ok(media.includes('/'+item.dictation.audio.url));
  if(index%2)await page.keyboard.press('Shift');
  for(const step of item.guidedSteps){if(index%2)await page.locator('.guided-options').getByRole('button',{name:step.answer,exact:true}).click();else{await page.locator('#studyRoot input').fill(step.answer);await page.locator('#studyRoot input').press('Enter');}}
  await page.getByText('辅助练习与下一词位置已保存。',{exact:true}).waitFor();assert.equal(events().length,index+1);
  await page.getByRole('button',{name:'听句子',exact:true}).click();await page.getByText('正在播放课程音频。',{exact:true}).waitFor();assert.ok(media.includes('/'+item.sentenceAudio.audio.url));
  if(index===1){await page.reload();await page.waitForFunction(()=>document.getElementById('bookPosition').textContent==='3 / 6');}else await page.getByRole('button',{name:'下一词',exact:true}).click();
 }
 await page.getByRole('heading',{name:'本轮完成',exact:true}).waitFor();const originalState=(await request(base,stateRoute,token)).data;assert.equal(originalState.resume.status,'completed');const originalResume=JSON.stringify(originalState.resume);
 const completion=operations.find(o=>o.type==='vocabulary.complete');assert.ok(completion);assert.equal((await request(base,'/api/operations',token,completion)).status,200);assert.equal(events().length,6,'replaying the receipt must not add completion');
 await page.goto(base+startPath+'&practice=word-dictation');
 for(const [index,item] of draft.items.entries()){
  await page.waitForFunction(label=>document.getElementById('bookPosition')?.textContent===label,(index+1)+' / 6');await page.getByRole('button',{name:'播放单词音频',exact:true}).waitFor();
  assert.equal(await page.locator('#studyRoot').getByText(item.word,{exact:true}).count(),0,'no spelling shown before dictation');
  await page.getByRole('button',{name:'播放单词音频',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#studyRoot button[type=submit]').disabled);
  await page.getByRole('textbox',{name:'听写答案'}).fill('incorrect');await page.getByRole('textbox').press('Enter');await page.getByText(/拼写尚不正确/).waitFor();assert.equal(events().length,6+index);
  if(index===2)await context.setOffline(true);
  await page.getByRole('textbox').fill(item.word);await page.getByRole('textbox').press('Enter');
  if(index===2){await page.getByText('待保存，连接恢复后会自动重试。',{exact:true}).waitFor();assert.equal(events().length,8);await context.setOffline(false);}
  await page.getByText('辅助练习与下一词位置已保存。',{exact:true}).waitFor({timeout:20000});assert.equal(events().length,7+index);
  await page.getByRole('button',{name:'下一词',exact:true}).click();
 }
 await page.getByRole('heading',{name:'本轮完成',exact:true}).waitFor();assert.equal(JSON.stringify((await request(base,stateRoute,token)).data.resume),originalResume,'dictation does not replace guided resume');
 const otherState=(await request(base,stateRoute,other.data.token)).data;assert.equal(otherState.resume,null,'another account has no inherited progress');
 const rows=events();assert.equal(rows.length,12);const data=rows.map(row=>JSON.parse(row.data_json));assert.equal(data.filter(row=>row.practiceType==='guided-expression').length,6);assert.equal(data.filter(row=>row.practiceType==='word-dictation').length,6);assert.ok(data.every(row=>row.assisted===true));
 assert.equal(data.filter(row=>row.practiceType==='guided-expression'&&row.inputMode==='typing').length,3);assert.equal(data.filter(row=>row.practiceType==='guided-expression'&&row.inputMode==='chunks').length,3);
 const progress=db.prepare('SELECT data_json FROM vocabulary_item_progress WHERE user_id=?').all(account.data.user.id).map(row=>JSON.parse(row.data_json));assert.equal(progress.length,6);assert.ok(progress.every(row=>row.assistedCompletions===2&&row.mastered===false),'assisted practice must not manufacture mastery');
 for(const row of rows){const event=JSON.parse(row.data_json);if(event.practiceType==='word-dictation')assert.equal(event.audioSha256,draft.items.find(i=>i.itemId===row.item_id).dictation.audio.sha256);}
 const backupDir=path.join(temp,'backup'),backup=spawnSync(process.execPath,[path.join(root,'server/backup-db.js'),'backup'],{encoding:'utf8',cwd:root,env:{...environment,CHUNKLAB_DATA_DIR:dataDir,CHUNKLAB_APP_ROOT:appRoot,BACKUP_DIR:backupDir}});assert.equal(backup.status,0,backup.stderr);assert.match(backup.stdout,/backup-db\] OK:/);
 const names=fs.readdirSync(backupDir),materialRoot=path.join(backupDir,names.find(n=>n.startsWith('vocabulary_materials_'))),manifest=read(path.join(materialRoot,'manifest.json'));assert.equal(manifest.files.filter(f=>f.path.endsWith('.ogg')).length,12);assert.equal(manifest.files.filter(f=>f.path.endsWith('.webp')).length,6);
 for(const file of manifest.files){const absolute=path.join(materialRoot,file.path);assert.equal(fs.statSync(absolute).size,file.bytes);assert.equal(digest(absolute),file.sha256);}
 const restoredApp=path.join(temp,'restored-app'),restoredData=path.join(temp,'restored-data');appFixture(restoredApp);fs.mkdirSync(restoredData);
 fs.copyFileSync(path.join(backupDir,names.find(n=>/^chunklab_db_.*\.db$/.test(n))),path.join(restoredData,'chunklab.db'),fs.constants.COPYFILE_EXCL);
 fs.copyFileSync(path.join(materialRoot,'vocabulary-material-library.sqlite'),path.join(restoredData,'vocabulary-material-library.sqlite'),fs.constants.COPYFILE_EXCL);fs.cpSync(path.join(materialRoot,'wordbook-publications'),path.join(restoredData,'wordbook-publications'),{recursive:true,errorOnExist:true,force:false});
 for(const file of manifest.files.filter(f=>f.path.startsWith('assets/')))fs.copyFileSync(path.join(materialRoot,file.path),path.join(restoredApp,file.path),fs.constants.COPYFILE_EXCL);
 const restoredBase=await start(restoredApp,restoredData,13000),restoredContext=await browser.newContext({serviceWorkers:'block'});await restoredContext.addInitScript(token=>localStorage.setItem('chunklab_token',token),token);const restoredPage=await restoredContext.newPage();
 for(const suffix of ['', '&practice=word-dictation']){await restoredPage.goto(restoredBase+startPath+suffix);await restoredPage.getByRole('heading',{name:'本轮完成',exact:true}).waitFor();}
 const restoredDb=new Database(path.join(restoredData,'chunklab.db'),{readonly:true,fileMustExist:true});try{assert.deepEqual(restoredDb.prepare('SELECT * FROM vocabulary_study_events WHERE user_id=? ORDER BY event_id').all(account.data.user.id),rows);}finally{restoredDb.close();}
 assert.deepEqual(events(),rows);assert.deepEqual(errors,[]);await restoredContext.close();await context.close();
 for(const original of originals)assert.equal(digest(original.file),original.sha256);for(const asset of assetHashes)assert.equal(digest(path.join(root,asset.file)),asset.sha256);
 const reportDir=path.join(root,'output/test-results','borrow-pilot-'+Date.now());fs.mkdirSync(reportDir,{recursive:true});fs.writeFileSync(path.join(reportDir,'summary.json'),JSON.stringify({actualPilot:true,guidedCompletions:6,guidedTyping:3,guidedChunks:3,dictationCompletions:6,noArtificialMastery:true,actualOggFiles:12,actualImages:6,refreshResume:true,offlineRetry:true,receiptReplay:true,accountIsolation:true,backupHashVerification:true,freshDirectoryAndPortRecovery:true,sourceFilesUnchanged:true,syntheticReviewReceiptOnly:true,productionPublished:false},null,2));
 console.log('Actual pilot persistence: six guided + six A-audio dictation completions, authored sentence playback, refresh/offline/replay/account isolation, consistent backup of 12 Ogg/6 images and fresh service recovery passed; source content, approvals and live data unchanged. Report: '+path.relative(root,reportDir));
}finally{if(browser)await browser.close();db?.close();for(const child of children)if(child.exitCode===null)await new Promise(resolve=>{child.once('close',resolve);child.kill();});assert.equal(path.dirname(fs.realpathSync(temp)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(temp).startsWith('borrow-persistence-e2e-'));fs.rmSync(temp,{recursive:true,force:true});}})().catch(error=>{console.error(error);console.error(logs.slice(-2200));process.exitCode=1;});
