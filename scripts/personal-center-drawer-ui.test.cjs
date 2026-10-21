'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'main.html'),'utf8');
const styles=Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g),match=>match[1]).join('\n')+'\n'+fs.readFileSync(path.join(root,'assets/personal-center.css'),'utf8');
const markup=html.slice(html.indexOf('<div class="mask pc-drawer" id="settingsMask"'),html.indexOf('<!-- 反馈问题弹窗'));
(async()=>{
 const browser=await chromium.launch({headless:true});
 const output=path.join(root,'output/playwright/personal-center-drawer');fs.mkdirSync(output,{recursive:true});
 try{
  for(const [width,height] of [[1024,932],[390,844],[320,740],[844,390],[320,480]]){
   const context=await browser.newContext({viewport:{width,height},hasTouch:width<900,isMobile:width<540,reducedMotion:'reduce'});
   const page=await context.newPage();await page.route('**/*',route=>route.abort());
   await page.setContent('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles+'</style><button id="fixtureOpen">打开个人中心</button>'+markup+'<div class="mask" id="chunkIntroMask" hidden><div class="modal"></div></div><div class="mask" id="feedbackMask" hidden><div class="modal"><textarea aria-label="演示反馈"></textarea><button>返回</button></div></div>');
   await page.addScriptTag({path:path.join(root,'js/icons.js')});
   await page.addScriptTag({path:path.join(root,'js/personal-center-dialogs.js')});
   await page.evaluate(()=>{
    const get=id=>document.getElementById(id);
    get('accountSection').hidden=false;get('acctNameBtn').hidden=false;get('acctNameText').textContent='182****2567';
    get('acctHint').hidden=true;get('membershipPanel').hidden=false;get('membershipStatus').textContent='';
    get('membershipHistory').innerHTML='<li>暂无兑换记录</li>';get('imageCacheUsage').textContent='0 张 · 0.00 MB';get('btnAccountLogout').hidden=false;
    get('fixtureOpen').onclick=()=>PersonalCenterDialogs.open('settingsMask');
    get('btnFeedback').onclick=()=>PersonalCenterDialogs.open('feedbackMask');
    Icons.install();
   });
   await page.locator('#fixtureOpen').click();
   assert.equal(await page.locator('#personalCenterMenu').isVisible(),true);
   assert.equal(await page.locator('#setSound').isVisible(),false);
   assert.equal(await page.locator('#membershipCode').isVisible(),false);
   assert.equal(await page.locator('#btnSaveSettings').isVisible(),false);
   assert.equal(await page.locator('#btnAccountLogout').isVisible(),true);
   assert.equal(await page.locator('#personalCenterMenu a').count(),0,'course and study navigation remains outside the account menu');
   const frame=await page.locator('#settingsMask .modal').boundingBox();
   assert.ok(Math.abs(frame.x+frame.width-width)<1);assert.ok(frame.y>=0&&frame.height<=height+1);
   assert.equal(frame.width,width<=540?width:304);
   const menuAlignment=await page.locator('#personalCenterMenu>button').evaluateAll(rows=>rows.map(row=>row.getBoundingClientRect().right-row.lastElementChild.getBoundingClientRect().right));
   assert.ok(menuAlignment.every(gap=>gap>=10&&gap<=14),'menu arrows align at the right edge');
   await page.screenshot({path:path.join(output,'menu-'+width+'x'+height+'.png'),animations:'disabled'});
   await page.locator('[data-pc-view="settings"]').click();
   assert.equal(await page.locator('#personalCenterTitle').innerText(),'学习设置');
   assert.equal(await page.locator('#setSound').isVisible(),true);
   assert.equal(await page.locator('#btnSaveSettings').isVisible(),true);
   await page.locator('#setSound').setChecked(false);
   const first=page.locator('#personalCenterBack'),last=page.locator('#settingsMask .modal-foot [data-close]');
   await first.focus();await page.keyboard.press('Shift+Tab');assert.ok(await last.evaluate(node=>node===document.activeElement));
   await page.keyboard.press('Tab');assert.ok(await first.evaluate(node=>node===document.activeElement));
   const foot=await page.locator('#settingsMask .modal-foot').boundingBox();assert.ok(foot.y+foot.height<=height+1);
   await page.screenshot({path:path.join(output,'settings-'+width+'x'+height+'.png'),animations:'disabled'});
   await first.click();await page.locator('[data-pc-view="membership"]').click();
   assert.equal(await page.locator('#membershipCode').isVisible(),true);
   await page.locator('#membershipPanel summary').click();
   assert.equal(await page.getByText('暂无兑换记录',{exact:true}).isVisible(),true);
   await page.screenshot({path:path.join(output,'membership-'+width+'x'+height+'.png'),animations:'disabled'});
   await first.click();await page.locator('[data-pc-view="backup"]').click();
   assert.equal(await page.locator('#btnExportAll').isVisible(),true);
   assert.equal(await page.locator('#btnImportAll').isVisible(),true);
   await first.click();await page.locator('[data-pc-view="cache"]').click();
   assert.equal(await page.locator('#btnClearImageCache').isVisible(),true);
   await first.click();await page.locator('[data-pc-view="settings"]').click();assert.equal(await page.locator('#setSound').isChecked(),false,'menu navigation preserves settings draft');
   await first.click();await page.locator('[data-pc-feedback]').click();
   assert.equal(await page.locator('#settingsMask').isVisible(),false);await page.keyboard.press('Escape');
   assert.ok(await page.locator('[data-pc-feedback]').evaluate(node=>node===document.activeElement));
   const overflow=await page.locator('#settingsMask').evaluate(node=>Array.from(node.querySelectorAll('*')).filter(el=>el.getClientRects().length&&el.getBoundingClientRect().right>innerWidth+1).map(el=>el.id||el.tagName));
   assert.deepEqual(overflow,[]);
   await page.keyboard.press('Escape');assert.ok(await page.locator('#fixtureOpen').evaluate(node=>node===document.activeElement));
   await page.locator('#fixtureOpen').click();assert.equal(await page.locator('#personalCenterMenu').isVisible(),true,'reopening starts with the account menu');
   console.log('PASS drawer '+width+'x'+height+': menu, panes, draft, focus, footer, overflow');
   await context.close();
  }
  const server=http.createServer((req,res)=>{
   const url=new URL(req.url,'http://127.0.0.1');
   if(url.pathname.startsWith('/api/')){
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify(url.pathname==='/api/library'?{resources:[]}:url.pathname==='/api/content/shards'?JSON.parse(fs.readFileSync(path.join(root,'server/content/shards.json'),'utf8')):{requireAuth:false}));return;
   }
   const file=path.resolve(root,'.'+url.pathname);
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
   res.setHeader('Content-Type',/\.m?js$/.test(file)?'application/javascript':/\.css$/.test(file)?'text/css':/\.json$/.test(file)?'application/json':'text/html');res.end(fs.readFileSync(file));
  });
  let liveContext;
  try{
   await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
   liveContext=await browser.newContext({viewport:{width:1024,height:932},serviceWorkers:'block',reducedMotion:'reduce'});
   const page=await liveContext.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/main.html?view=discover');
   await page.locator('#pageDiscover').waitFor({state:'visible'});
   await page.locator('#btnSettingsTop').click();await page.locator('#personalCenterMenu').waitFor({state:'visible'});
   await page.locator('[data-pc-view="settings"]').click();await page.locator('#setSound').waitFor({state:'visible'});
   await page.locator('#btnSaveSettings').click();await page.locator('#settingsMask').waitFor({state:'hidden'});
   assert.equal(await page.locator('#pageDiscover').isVisible(),true,'saving preserves the source page');
   await page.locator('#btnSettingsTop').click();await page.locator('#personalCenterMenu').waitFor({state:'visible'});
   await page.screenshot({path:path.join(output,'page-menu-1024.png'),animations:'disabled'});
   await page.locator('[data-pc-view="backup"]').click();assert.equal(await page.locator('#btnImportAll').isVisible(),true);
   await page.keyboard.press('Escape');assert.ok(await page.locator('#btnSettingsTop').evaluate(node=>node===document.activeElement));
   assert.deepEqual(errors,[]);console.log('PASS complete page: isolated static server, mocked API, deferred drawer loading, save, backup entry and close; no live service or account access');
  }finally{
    if(liveContext)await liveContext.close();
    if(typeof server.closeAllConnections==='function')server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
