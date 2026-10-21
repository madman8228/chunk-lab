'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'chunklab-account-entry-'));
const port=require('./lib/free-port').freePort(15100,200),base='http://127.0.0.1:'+port;
const child=spawn(process.execPath,['server/index.js'],{cwd:root,windowsHide:true,env:{...process.env,
  PORT:String(port),CHUNKLAB_DATA_DIR:dir,REQUIRE_AUTH:'true',PHONE_AUTH_ENABLED:'false',NODE_ENV:'test',JWT_SECRET:'isolated-account-entry-test-key-123456789'},stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){let browser;
 try{
  let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/health')).ok;if(ready)break;}catch(_){}await delay(100);}assert.ok(ready);
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});
  const visitor=await browser.newContext({serviceWorkers:'block'}),page=await visitor.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const registrations=[];page.on('request',req=>{if(req.method()==='POST'&&req.url().endsWith('/api/auth/register'))registrations.push(req);});
  await page.goto(base+'/main.html?view=home');
  await page.waitForFunction(()=>window.CL&&CL.getCloudConfig()?.requireAuth);
  assert.equal(await page.locator('#btnSettingsTop').innerText(),'登录');
  assert.equal(await page.locator('#chunkauth-mask').count(),0,'signed-out homepage does not force a dialog');
  assert.equal(await page.evaluate(()=>ChunkAPI.isLoggedIn()),false);
  assert.equal(registrations.length,0,'startup never creates a guest account');
  await page.getByText('登录后查看你的课程、学习进度和复习安排。',{exact:true}).waitFor();
  assert.equal(await page.getByText(/个人记录尚未确认/).count(),0,'signed-out state is not a data-loading error');
  const output=path.join(root,'output/playwright/account-entry');fs.mkdirSync(output,{recursive:true});
  await page.setViewportSize({width:1440,height:950});await page.screenshot({path:path.join(output,'signed-out-desktop.png')});
  await page.locator('#btnSettingsTop').click();await page.locator('#chunkauth-mask').waitFor();
  await page.getByPlaceholder('用户名',{exact:true}).fill('account-entry-user');
  await page.locator('#chunkauth-mask input[type=password]').first().fill('AccountEntryTest123!');
  // Create this test account through the real API, then log in through the UI.
  const registered=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'account-entry-user',password:'AccountEntryTest123!'})});assert.equal(registered.status,200);
  await page.locator('#chunkauth-mask button').filter({hasText:/^登录$/}).click();
  await page.waitForFunction(()=>window.CL&&CL.serverPersistenceReady()&&document.getElementById('btnSettingsTop').textContent==='个人中心');
  await page.locator('.topbar').screenshot({path:path.join(output,'signed-in-header.png')});
  await page.locator('#btnSettingsTop').click();await page.locator('#settingsMask').waitFor({state:'visible'});
  assert.equal(await page.locator('#personalCenterTitle').innerText(),'个人中心');
  assert.equal(await page.locator('#acctNameText').innerText(),'account-entry-user');
  assert.equal(await page.locator('#settingsAccountGroup').evaluate(el=>el.open),true);
  assert.equal(await page.locator('#accountSection').isVisible(),true);
  assert.equal(await page.locator('#settingsMask').innerText().then(text=>text.includes('临时账号')),false);
  await page.screenshot({path:path.join(output,'personal-center-desktop.png')});
  for(const width of [390,360]){
   await page.setViewportSize({width,height:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no overflow at '+width);
   await page.screenshot({path:path.join(output,'personal-center-'+width+'.png')});
  }
  await page.locator('#settingsMask .modal-foot [data-close]').click();
  await page.screenshot({path:path.join(output,'signed-in-mobile.png')});
  await page.locator('#btnSettingsTop').click();await page.locator('#btnAccountLogout').click();
  await page.waitForFunction(()=>window.ChunkAPI&&!ChunkAPI.isLoggedIn()&&document.getElementById('btnSettingsTop').textContent==='登录');
  assert.equal(await page.locator('#chunkauth-mask').count(),0,'logout stays on a signed-out homepage');
  assert.equal(registrations.length,0,'logout does not create a replacement account');
  assert.equal(errors.length,0,errors.join('\n'));
  const phone=await browser.newContext({serviceWorkers:'block'}),phonePage=await phone.newPage();
  await phonePage.route('**/api/config',async route=>{const response=await route.fetch();await route.fulfill({response,json:{...await response.json(),authMode:'phone'}});});
  await phonePage.goto(base+'/main.html?view=home');await phonePage.waitForFunction(()=>window.ChunkAuthUI&&ChunkAuthUI.phoneMode);
  await phonePage.locator('#btnSettingsTop').click();await phonePage.getByPlaceholder('请输入手机号').waitFor();
  await phonePage.getByRole('button',{name:'取消',exact:true}).click();
  assert.equal(await phonePage.locator('#chunkauth-mask').count(),0,'phone login can be cancelled without creating an account');
  const legacyResponse=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'guest_historical_session',password:'HistoricalTest123!'})});
  const legacy=await legacyResponse.json(),legacyContext=await browser.newContext({serviceWorkers:'block'});
  await legacyContext.addInitScript(token=>localStorage.setItem('chunklab_token',token),legacy.token);
  const legacyPage=await legacyContext.newPage();
  await legacyPage.route('**/api/config',async route=>{const response=await route.fetch();await route.fulfill({response,json:{...await response.json(),authMode:'phone'}});});
  await legacyPage.goto(base+'/main.html?view=home');await legacyPage.waitForFunction(()=>window.CL&&CL.serverPersistenceReady());
  assert.equal(await legacyPage.locator('#btnSettingsTop').innerText(),'登录','a historical automatic session without verified phone is not formal login');
  const tokenBefore=await legacyPage.evaluate(()=>ChunkAPI.getToken());
  await legacyPage.locator('#btnSettingsTop').click();await legacyPage.getByRole('heading',{name:'登录 / 注册',exact:true}).waitFor();
  await legacyPage.getByRole('button',{name:'取消',exact:true}).click();
  assert.equal(await legacyPage.evaluate(()=>ChunkAPI.getToken()),tokenBefore,'cancelling verification preserves the historical account and its data access');
  await legacyPage.route('**/api/auth/me',async route=>{const response=await route.fetch(),data=await response.json();await route.fulfill({response,json:{...data,user:{...data.user,phone:'138****1234'}}});});
  await legacyPage.reload();await legacyPage.waitForFunction(()=>document.getElementById('btnSettingsTop').textContent==='个人中心');
  assert.equal(await legacyPage.evaluate(()=>ChunkAPI.getToken()),tokenBefore,'verified account status does not change content ownership');
  console.log('Account entry: signed-out login, no auto-registration, real login/logout, personal center, settings, phone dialog and mobile widths passed');
 }finally{if(browser)await browser.close();child.kill();await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));if(path.dirname(dir)===os.tmpdir()&&path.basename(dir).startsWith('chunklab-account-entry-'))fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
