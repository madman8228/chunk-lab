'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'chunklab-image-cache-'));
const port=require('./lib/free-port').freePort(11300,100),base='http://127.0.0.1:'+port;
let child,browser;
(async()=>{
  try{
    child=spawn(process.execPath,['server/index.js'],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,
      CHUNKLAB_DATA_DIR:dir,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'test',REQUIRE_AUTH:'true',PHONE_AUTH_ENABLED:'false',CHUNKLAB_WRITE_PROTOCOL:'3',
      JWT_SECRET:crypto.randomBytes(40).toString('hex'),ADMIN_JWT_SECRET:crypto.randomBytes(40).toString('hex'),MEMBERSHIP_CONTENT_GRANT_KEY:crypto.randomBytes(32).toString('base64')}});
    let ready=false;
    for(let i=0;i<300;i++){if(child.exitCode!==null)throw new Error('isolated image-cache server exited before becoming ready');try{ready=(await fetch(base+'/api/health')).ok;}catch(_){}if(ready)break;await new Promise(r=>setTimeout(r,100));}
    assert.ok(ready);
    const signup=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'image-cache-test',password:'SyntheticImage2026!'})});
    assert.equal(signup.status,200);const account=await signup.json();
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});
    const anonymous=await browser.newContext({serviceWorkers:'block'});
    const visitor=await anonymous.newPage();await visitor.goto(base+'/main.html?view=home');
    await visitor.locator('#btnSettingsTop').filter({hasText:/^登录$/}).waitFor();
    await visitor.locator('#btnSettingsTop').click();await visitor.locator('#chunkauth-mask').waitFor();
    assert.equal(await visitor.locator('#settingsMask').isVisible(),false,'anonymous visitors enter login, not account data');
    await anonymous.close();
    const context=await browser.newContext({serviceWorkers:'block'});
    await context.addInitScript(token=>localStorage.setItem('chunklab_token',token),account.token);
    const page=await context.newPage();let downloads=0;
    await page.route('**/api/course-assets/synthetic-cache-test',route=>{
      downloads++;return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=','base64')});
    });
    async function loadImage(){
      return page.evaluate(async()=>{
        const {PlatformCourseSource}=await import('/src/learning/platform-course-source.mjs');
        const cache=new ChunkMembership.CourseImageCache(window);
        const source=new PlatformCourseSource({imageCache:cache,captureImageScope:()=>ChunkMembership.imageCacheScope(window),
          client:{},newRequestId:()=>crypto.randomUUID(),controller:{canAdvance:()=>true,start:async()=>({
            grant:'synthetic',headerName:'X-Course-Grant',serverNow:0,expiresAt:30000,contentVersion:'v1',unit:{cursor:0},
            fragments:[{cursor:0,assetIds:['synthetic-cache-test']}]})},
          fetchResource:async url=>(await fetch(url)).blob()});
        await source.open({courseId:'synthetic',unitId:'unit'});
        const blobs=await Promise.all([source.loadAssets('synthetic-cache-test',0),source.loadAssets('synthetic-cache-test',0)]);
        return blobs.map(blob=>blob.size);
      });
    }
    await page.goto(base+'/main.html?view=home');
    await page.waitForFunction(()=>window.ChunkMembership&&CL.serverPersistenceReady());
    assert.ok((await loadImage()).every(size=>size>0));assert.equal(downloads,1);
    await page.evaluate(()=>localStorage.setItem('synthetic-course-preservation','keep'));
    await page.reload();await page.waitForFunction(()=>window.ChunkMembership&&CL.serverPersistenceReady());
    await loadImage();assert.equal(downloads,1,'reload reuses persistent bytes');
    for(const width of [1231,390]){
      await page.setViewportSize({width,height:932});await page.evaluate(()=>openPersonalCenter());
      await page.locator('#acctNameText').filter({hasText:'image-cache-test'}).waitFor();
      const label=page.locator('#imageCacheUsage');await label.filter({hasText:/1 张/}).waitFor();
      const button=page.locator('#btnClearImageCache');assert.equal(await button.isEnabled(),true);
      const box=await button.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=width,'cache action fits desktop/mobile');
      await button.scrollIntoViewIfNeeded();
      const shots=path.join(root,'output/playwright');fs.mkdirSync(shots,{recursive:true});
      await page.screenshot({path:path.join(shots,'course-image-cache-'+width+'.png')});
    }
    page.once('dialog',dialog=>dialog.dismiss());await page.locator('#btnClearImageCache').click();
    assert.equal((await page.evaluate(()=>currentImageCache().cache.usage(currentImageCache().scope))).count,1,'cancel preserves cache');
    page.once('dialog',dialog=>dialog.accept());await page.locator('#btnClearImageCache').click();
    await page.locator('#imageCacheUsage').filter({hasText:/0 张/}).waitFor();
    assert.equal(await page.evaluate(()=>localStorage.getItem('synthetic-course-preservation')),'keep');
    await loadImage();assert.equal(downloads,2,'manual clear downloads again only when used');
    await page.locator('#settingsAppearanceGroup>summary').click();
    const originalSound=await page.locator('#setSound').isChecked();await page.locator('#setSound').setChecked(!originalSound);
    await page.locator('#btnSaveSettings').click();await page.locator('#settingsMask').waitFor({state:'hidden'});
    await page.reload();await page.waitForFunction(()=>window.ChunkMembership&&CL.serverPersistenceReady());
    await page.evaluate(()=>openPersonalCenter());await page.locator('#settingsAppearanceGroup>summary').click();
    assert.equal(await page.locator('#setSound').isChecked(),!originalSound,'confirmed settings survive page reload');
    console.log('real browser image cache: concurrent 1 download, reload 0 downloads, desktop/mobile settings, cancel, scoped manual clear and redownload passed');
  }finally{
    if(browser)await browser.close();
    if(child&&child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(dir,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
