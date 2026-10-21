'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'chunk-home-paint-'));
const port=require('./lib/free-port').freePort(15400,150),base='http://127.0.0.1:'+port;
const child=spawn(process.execPath,['server/index.js'],{cwd:root,windowsHide:true,env:{...process.env,
 PORT:String(port),CHUNKLAB_DATA_DIR:dir,REQUIRE_AUTH:'true',PHONE_AUTH_ENABLED:'false',NODE_ENV:'test',JWT_SECRET:'isolated-first-paint-test-key-123456789'},stdio:'ignore'});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){let browser;
 try{
  let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/health')).ok;if(ready)break;}catch(_){}await delay(100);}assert.ok(ready);
  const response=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'paint-fixture',password:'PaintFixture123!'})});
  assert.equal(response.status,200);const session=await response.json();
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
  await context.addInitScript(token=>localStorage.setItem('chunklab_token',token),session.token);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/main.html?view=home');await page.waitForFunction(()=>document.querySelector('#homeBody .learning-workspace:not([aria-busy])'));
  await page.evaluate(()=>CourseEnrollment.join('builtin:oral'));
  const output=path.join(root,'output/playwright/home-first-paint');fs.mkdirSync(output,{recursive:true});
  await context.addInitScript(()=>{
   window.paintFrames=[];
   function sample(){const body=document.getElementById('homeBody'),workspace=body?.querySelector('.learning-workspace');
    if(workspace){const text=workspace.textContent,loading=workspace.getAttribute('aria-busy')==='true';
     const state={loading,empty:!!workspace.querySelector('.workspace-start'),rows:workspace.querySelectorAll('.hd-row').length,notice:!!workspace.querySelector('.workspace-notice'),text};
     if(JSON.stringify(state)!==JSON.stringify(window.paintFrames.at(-1)))window.paintFrames.push(state);}
    requestAnimationFrame(sample);
   }requestAnimationFrame(sample);
  });
  for(const width of [1041,390]){
   await page.setViewportSize({width,height:932});
   let release;const gate=new Promise(resolve=>{release=resolve;});
   await page.route('**/api/data*',async route=>{await gate;await route.continue();});
   await page.reload({waitUntil:'domcontentloaded'});
   await page.locator('#homeBody .workspace-loading').waitFor();
   await page.screenshot({path:path.join(output,'loading-'+width+'.png')});
   assert.equal(await page.locator('#homeBody .workspace-start,#homeBody .hd-row,#homeBody .workspace-notice').count(),0,'no intermediate empty, partial rows, or moving notice');
   release();await page.waitForFunction(()=>document.querySelector('#homeBody .hd-row')&&!document.querySelector('#homeBody [aria-busy]'));
   await page.screenshot({path:path.join(output,'ready-'+width+'.png')});
   const frames=await page.evaluate(()=>paintFrames);
   assert.ok(frames.some(frame=>frame.loading),'loading state was actually painted');
   assert.ok(frames.filter(frame=>!frame.loading).every(frame=>frame.rows===1&&!frame.empty&&!frame.notice),JSON.stringify(frames));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   console.log('first-paint '+width+': '+frames.map(frame=>frame.loading?'loading':'complete ('+frame.rows+' course)').join(' → '));
   await page.unroute('**/api/data*');
  }
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();child.kill();await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));if(path.dirname(dir)===os.tmpdir()&&path.basename(dir).startsWith('chunk-home-paint-'))fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
