'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'main.html'),'utf8');
const styles=Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g),match=>match[1]).join('\n');
const markup=html.slice(html.indexOf('<div class="mask" id="settingsMask"'),html.indexOf('<!-- 反馈问题弹窗'));
const hint=html.slice(html.indexOf('(function(){\n  var mask = $(\'settingsMask\');'),html.indexOf('/* ===== 设置面板 ===== */'));
const membership=html.slice(html.indexOf('function loadMembershipPanel(){'),html.indexOf('var redeemMembershipButton='));
const backup=html.match(/\$\('backupHead'\)\.onclick = function\(\)\{[\s\S]*?\n\};/)[0];
assert.ok(hint.startsWith('(function(){')&&markup.includes('settingsImageCacheSection'),'fixture uses the actual settings surface');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const [width,touch] of [[925,false],[390,true]]){
   const context=await browser.newContext({viewport:{width,height:932},hasTouch:touch,isMobile:touch});
   const page=await context.newPage();
   await page.setContent('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles+'</style>'+markup);
   await page.evaluate(()=>{
    window.$=id=>document.getElementById(id);window.membershipTime=()=> '测试到期时间';
    window.membershipFixture={trial:{status:'not_started'},history:[]};
    window.ChunkAPI={getMembership:async()=>{if(window.membershipFailure)throw Object.assign(Error('synthetic offline'),{status:window.membershipFailure===401?401:503});return window.membershipFixture;}};
    $('settingsMask').hidden=false;
    document.querySelectorAll('.settings-group').forEach(group=>{group.open=group.id==='settingsAccountGroup';});
    $('accountSection').hidden=false;$('settingsAccountGroup').querySelector('.settings-group-body').prepend($('accountSection'));
    $('acctNameText').textContent='测试账号';$('acctNameBtn').hidden=false;$('acctHint').textContent='学习记录自动保存。';
   });
   await page.addScriptTag({content:hint+'\n'+membership+'\n'+backup});
   await page.evaluate(()=>loadMembershipPanel());
   assert.equal(await page.locator('#membershipStatus').isVisible(),false,'default promotional explanation does not occupy space');
   await page.evaluate(()=>{membershipFixture={entitlement:{active:true,endsAt:1},history:[]};loadMembershipPanel();});
   await page.getByText('会员有效期至 测试到期时间。',{exact:true}).waitFor();
   for(const [trial,expected] of [
    [{status:'available',remainingSeconds:120,endsAt:1},'体验中：本 24 小时周期还可学习 2 分钟'],
    [{status:'daily_limit',nextResetAt:1},'本周期体验时长已用完'],
    [{status:'expired'},'免费体验已结束'],
    [{status:'disabled'},'免费体验当前未开放']
   ]){
    await page.evaluate(trial=>{membershipFixture={trial,history:[]};loadMembershipPanel();},trial);
    await page.locator('#membershipStatus').filter({hasText:expected}).waitFor();
   }
   await page.evaluate(()=>{membershipFailure=401;loadMembershipPanel();});
   await page.getByText('登录后查看会员状态',{exact:true}).waitFor();
   await page.evaluate(()=>{membershipFailure=true;loadMembershipPanel();});
   await page.getByText('会员状态暂时无法读取，请稍后重试。',{exact:true}).waitFor();
   await page.evaluate(()=>{membershipFailure=false;membershipFixture={trial:{status:'not_started'},history:[]};loadMembershipPanel();});
   const alignment=await page.locator('#settingsBackupSection').evaluate(section=>{
    const s=section.getBoundingClientRect(),b=section.querySelector('button').getBoundingClientRect();
    return Math.abs((b.y+b.height/2)-(s.y+s.height/2));
   });assert.ok(alignment<1,'collapsed backup header is centered between its own borders');
   await page.locator('#backupHead').click();assert.equal(await page.locator('#backupHead').getAttribute('aria-expanded'),'true');
   assert.equal(await page.locator('#btnExportAll').isVisible(),true);await page.locator('#backupHead').click();
   const trigger=page.getByRole('button',{name:'图片缓存',exact:true}),tooltip=page.locator('#setHintPop');
   if(touch)await trigger.tap();else await trigger.hover();
   await page.waitForFunction(()=>document.getElementById('setHintPop').classList.contains('open'));
   assert.equal(await tooltip.innerText(),'仅清除此账号在本机的图片缓存，不影响课程和记录。');
   const box=await tooltip.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);
   const output=path.join(root,'output/playwright/personal-center-polish');fs.mkdirSync(output,{recursive:true});
   await page.screenshot({path:path.join(output,'settings-'+width+'.png'),animations:'disabled'});
   await page.keyboard.press('Escape');assert.equal(await tooltip.evaluate(el=>el.classList.contains('open')),false);
   await page.locator('#backupHead').focus();await page.keyboard.press('Tab');
   await page.waitForFunction(()=>document.getElementById('setHintPop').classList.contains('open'));
   assert.equal(await trigger.getAttribute('aria-describedby'),'setHintPop');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await context.close();
  }
  console.log('Personal center: compact default membership, retained status/errors, centered backup, pointer/keyboard/touch hints and no overflow passed; DOM-only fixture, no account writes.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
