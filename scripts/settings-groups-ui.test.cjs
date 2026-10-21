'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(url.pathname==='/api/library'?{resources:[]}:url.pathname==='/api/content/shards'?JSON.parse(fs.readFileSync(path.join(root,'server/content/shards.json'))):{requireAuth:false}));return;}
  const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',/\.m?js$/.test(file)?'application/javascript':/\.css$/.test(file)?'text/css':/\.json$/.test(file)?'application/json':'text/html');res.end(fs.readFileSync(file));
 });
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true});const page=await browser.newPage({serviceWorkers:'block'});
  await page.goto('http://127.0.0.1:'+server.address().port+'/main.html?view=my-learning');await page.locator('#pageMyLearning').waitFor({state:'visible'});
  const output=path.join(root,'output/playwright/settings-groups');fs.mkdirSync(output,{recursive:true});
  for(const width of [844,390]){
   await page.setViewportSize({width,height:932});await page.locator('#btnSettingsTop').click();await page.locator('#settingsMask').waitFor({state:'visible'});
   assert.deepEqual(await page.locator('#settingsMask .settings-group').evaluateAll(groups=>groups.map(g=>g.open)),[true,false,false]);
   assert.equal(await page.locator('#setMode').count(),0);assert.equal(await page.locator('#setShuffle').count(),0);
   assert.equal(await page.locator('#setSound').isVisible(),true);assert.equal(await page.locator('#btnFeedback').isVisible(),false);
   const original=await page.locator('#setSound').isChecked();
   await page.locator('#setSound').setChecked(!original);await page.locator('#settingsAppearanceGroup>summary').click();await page.locator('#settingsAppearanceGroup>summary').click();
   assert.equal(await page.locator('#setSound').isChecked(),!original,'folding does not reset edited values');
   assert.equal(await page.locator('#settingsMask .modal').getAttribute('role'),'dialog');
   const first=page.locator('#settingsMask .modal-head [data-close]'),last=page.locator('#settingsMask .modal-foot [data-close]');
   await first.focus();await page.keyboard.press('Shift+Tab');assert.ok(await last.evaluate(el=>el===document.activeElement),'reverse Tab stays inside dialog');
   await page.keyboard.press('Tab');assert.ok(await first.evaluate(el=>el===document.activeElement),'forward Tab wraps inside dialog');
   await page.locator('#settingsHelpGroup>summary').click();
   await page.locator('#btnChunkIntro').click();await page.locator('#chunkIntroMask').waitFor({state:'visible'});
   assert.equal(await page.locator('#settingsMask').isVisible(),false);
   await page.keyboard.press('Escape');await page.locator('#settingsMask').waitFor({state:'visible'});
   assert.ok(await page.locator('#btnChunkIntro').evaluate(el=>el===document.activeElement),'help returns focus to its entry');
   assert.equal(await page.locator('#setSound').isChecked(),!original,'help return retains unsaved settings');
   await page.locator('#btnFeedback').click();
   await page.evaluate(()=>{window.backgroundKeys=0;document.addEventListener('keydown',()=>window.backgroundKeys++);});
   await page.locator('#feedbackText').pressSequentially('123');
   assert.equal(await page.locator('#feedbackText').inputValue(),'123','native text entry remains usable');
   assert.equal(await page.evaluate(()=>window.backgroundKeys),0,'modal keys do not trigger background practice shortcuts');
   await page.locator('#feedbackText').fill('isolated feedback fixture');
   await page.locator('#feedbackMask .modal-foot [data-close]').click();
   assert.equal(await page.locator('#settingsMask').isVisible(),true);
   assert.equal(await page.locator('#setSound').isChecked(),!original,'feedback cancel retains settings draft');
   await page.locator('#btnFeedback').click();await page.locator('#feedbackText').fill('isolated feedback fixture');
   await page.route('**/api/feedback',route=>route.fulfill({status:500,contentType:'application/json',body:'{"error":"synthetic failure"}'}));
   await page.locator('#btnFeedbackSubmit').click();await page.getByText('提交失败，请稍后再试',{exact:true}).first().waitFor();
   assert.equal(await page.locator('#feedbackMask').isVisible(),true,'failed submission keeps feedback open');
   await page.unroute('**/api/feedback');await page.locator('#btnFeedbackSubmit').click();
   await page.locator('#settingsMask').waitFor({state:'visible'});
   assert.equal(await page.locator('#setSound').isChecked(),!original,'successful feedback returns with settings draft');
   await page.locator('#settingsAppearanceGroup>summary').click();
   const account=page.locator('#settingsAccountGroup>summary');await account.focus();await account.press('Enter');assert.equal(await page.locator('#backupHead').isVisible(),true,'data backup is accessible with keyboard');
   assert.equal(await page.locator('#btnFeedback').isVisible(),true);
   assert.equal(await page.locator('#btnSaveSettings').isVisible(),true,'save remains visible with groups expanded');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.equal(await page.locator('#setFxStack').count(),0,'inactive fireworks stacking setting is removed');
   await page.locator('#settingsMask .modal-foot [data-close]').click();
   assert.ok(await page.locator('#btnSettingsTop').evaluate(el=>el===document.activeElement),'close restores entry focus');
   assert.equal(await page.locator('#pageMyLearning').isVisible(),true,'cancel preserves the originating page');
   await page.locator('#btnSettingsTop').click();
   assert.equal(await page.locator('#setSound').isChecked(),original,'cancel and reopen preserves the saved setting');
   await page.screenshot({path:path.join(output,'settings-'+width+'.png'),animations:'disabled'});
   await page.locator('#settingsMask .modal-foot [data-close]').click();
   await page.locator('#btnSettingsTop').click();await page.locator('#setSound').setChecked(!original);await page.locator('#btnSaveSettings').click();
   await page.locator('#settingsMask').waitFor({state:'hidden'});
   assert.equal(await page.locator('#pageMyLearning').isVisible(),true,'save preserves the originating page');
   await page.locator('#btnSettingsTop').click();assert.equal(await page.locator('#setSound').isChecked(),!original,'save persists the edited setting');await page.keyboard.press('Escape');
   assert.equal(await page.locator('#pageMyLearning').isVisible(),true,'Escape preserves the originating page');
  }
  console.log('Settings groups: sensible defaults, keyboard expansion, preserved edits, cancel/reopen, reachable actions and desktop/mobile layout passed.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
