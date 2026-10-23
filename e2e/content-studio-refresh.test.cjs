'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright-core');
(async()=>{
 const instance=await require('../scripts/serve-wordbook-acceptance.cjs').createAcceptance(0);let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});const page=await browser.newPage(),requests=[];
  await page.addInitScript(token=>localStorage.setItem('chunklab_admin_token',token),instance.adminToken);
  page.on('request',request=>{const url=new URL(request.url());if(url.pathname.startsWith('/api/'))requests.push(url.pathname);});
  const started=Date.now();await page.goto(instance.base+'/content-studio.html?view=system-wordbooks');await page.locator('#swTabs [role=tab]').first().waitFor();await page.waitForLoadState('networkidle');
  const initial=requests.splice(0),initialMs=Date.now()-started;
  let release;const gate=new Promise(resolve=>{release=resolve;});await page.route('**/api/admin/system-wordbooks/overview',async route=>{await gate;await route.continue();});
  const refresh=Date.now();await page.locator('#swRefresh').click();assert.equal(await page.locator('#swRefresh').isDisabled(),true);
  await page.locator('#swRefresh').evaluate(button=>{button.dispatchEvent(new Event('click'));button.dispatchEvent(new Event('click'));});release();await page.waitForResponse(response=>response.url().endsWith('/system-wordbooks/overview'));await page.waitForFunction(()=>!document.getElementById('swRefresh').disabled);const refreshMs=Date.now()-refresh;
  console.log(JSON.stringify({initialMs,refreshMs,initialRequests:initial,refreshRequests:requests},null,2));
  assert.ok(initial.every(url=>url==='/api/admin/me'||url==='/api/admin/system-wordbooks/overview'),'opening system-wordbooks must not load hidden editors, unrelated courses or illustration catalogs');
  assert.equal(initial.filter(url=>url==='/api/admin/system-wordbooks/overview').length,1,'one summary request per initial load');
  assert.ok(requests.every(url=>url.startsWith('/api/admin/system-wordbooks')),'refresh must stay within the active view');
  assert.equal(requests.length,1,'rapid refresh calls share a single in-flight summary request');
  requests.length=0;await page.getByRole('button',{name:'编辑正文',exact:true}).click();await page.locator('#courseCount').filter({hasText:/[1-9]/}).waitFor();await page.waitForLoadState('networkidle');
  assert.equal(requests.filter(url=>url==='/api/admin/content/courses').length,1,'the editor still loads its catalog on first entry');
  await page.getByRole('button',{name:'系统单词课程',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('swRefresh').disabled);assert.equal(new URL(page.url()).searchParams.get('view'),'system-wordbooks');
  const fs=require('node:fs'),path=require('node:path'),out=path.resolve(__dirname,'../output/playwright/content-studio-refresh');fs.mkdirSync(out,{recursive:true});
  for(const width of [1100,390]){await page.setViewportSize({width,height:932});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'summary-'+width+'.png'),fullPage:true});}
 }finally{await browser?.close();await instance.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
