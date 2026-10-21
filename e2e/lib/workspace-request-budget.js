'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');

module.exports=async function verifyWorkspaceRequestBudget({browser,base,api,root}){
  const account=await api('/api/auth/register',null,{username:'workspace-budget',password:'SyntheticBudget2026!'});
  const context=await browser.newContext({serviceWorkers:'block'}),requests=[],phases={},errors=[];
  await context.addInitScript(token=>localStorage.setItem('chunklab_token',token),account.token);
  const page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{const url=new URL(request.url());if(url.origin===base&&url.pathname.startsWith('/api/'))requests.push({method:request.method(),path:url.pathname});});
  const counts=rows=>rows.reduce((result,row)=>{const key=row.method+' '+row.path;result[key]=(result[key]||0)+1;return result;},{});
  async function phase(name,action){const mark=requests.length;await action();await page.waitForTimeout(250);const rows=requests.slice(mark);phases[name]=counts(rows);return rows;}
  async function readyHome(){await page.locator('#pageHome').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#pageHome .learning-workspace')&&!document.querySelector('#pageHome .workspace-loading'));}
  function noDirectories(rows,label){assert.deepEqual(rows.filter(row=>['/api/library','/api/personal-wordbooks'].includes(row.path)),[],label);}
  try{
    await phase('home-start',async()=>{await page.goto(base+'/main.html?view=home');await readyHome();});
    assert.equal(phases['home-start']['POST /api/usage/heartbeat'],1,'cloud initialization and visit tracking share one startup heartbeat');
    assert.ok(phases['home-start']['GET /api/config']<=2,'startup state notifications do not repeatedly refetch configuration');
    assert.equal(phases['home-start']['GET /api/auth/me'],1,'startup state notifications do not repeatedly confirm the same account entry');
    const confirmed=await phase('home-five-confirmations',async()=>{
      for(let i=0;i<5;i++){await page.evaluate(()=>dispatchEvent(new CustomEvent('server-cache-applied')));await page.waitForTimeout(100);}
    });
    noDirectories(confirmed,'home confirmation events must not refetch remote directories');
    assert.equal(confirmed.filter(row=>row.path==='/api/data').length,0,'local confirmation must not trigger a server refresh loop');
    const idle=await phase('home-idle-12s',()=>page.waitForTimeout(12000));
    noDirectories(idle,'idle home must not poll remote directories');
    assert.deepEqual(idle.filter(row=>['/api/data','/api/operations','/api/usage/study'].includes(row.path)),[],'idle home has no study writes or data polling');
    assert.ok(idle.filter(row=>row.path==='/api/usage/heartbeat').length<=1,'visit tracking remains bounded');
    await phase('discover',async()=>{await page.getByRole('link',{name:'发现',exact:true}).click();await page.locator('#pageDiscover .workspace-loading').waitFor({state:'hidden'});});
    noDirectories(await phase('discover-confirmation',()=>page.evaluate(()=>dispatchEvent(new CustomEvent('server-cache-applied')))),'discovery confirmation must not refetch remote directories');
    await phase('return-home',async()=>{await page.getByRole('link',{name:'首页',exact:true}).click();await readyHome();});
    const focus=await phase('home-focus',()=>page.evaluate(()=>dispatchEvent(new Event('focus'))));
    assert.ok(focus.filter(row=>row.path==='/api/personal-wordbooks').length<=1,'focus refresh does not duplicate personal directory requests');
    const opened=await phase('personal-center-open',async()=>{
      await page.locator('#btnSettingsTop').click();await page.locator('#settingsMask').waitFor({state:'visible'});
      await page.locator('#acctNameText').filter({hasText:'workspace-budget'}).waitFor();
    });
    assert.ok(opened.some(row=>row.path==='/api/config'),'explicit account opening still reads current configuration');
    assert.ok(opened.some(row=>row.path==='/api/auth/me'),'explicit account opening still verifies the account with the server');
    await page.keyboard.press('Escape');await page.locator('#settingsMask').waitFor({state:'hidden'});
    await phase('practice-start',async()=>{
      await page.goto(base+'/main.html?protectedCourse=fixture-free&unit=unit');
      await page.locator('.course-access-panel').getByRole('button',{name:/^(开始学习|继续学习)$/}).click();
      await page.locator('#stage:not(.hidden) .chunk-input').first().waitFor();
    });
    assert.equal(phases['practice-start']['POST /api/usage/heartbeat'],1,'direct practice entry shares the startup heartbeat too');
    const answered=await phase('practice-answer',async()=>{
      const chunks=await page.evaluate(()=>cur().chunks.slice());
      for(let i=0;i<chunks.length;i++){const input=page.locator('#track .chunk-input').nth(i);await input.fill(chunks[i]);await input.press('Enter');}
      await page.locator('#btnNext:not(.hidden)').waitFor();
      await page.waitForFunction(async()=>{const rows=await ServerStore.pending();return rows.length===0;});
    });
    noDirectories(answered,'answer confirmation must not fetch workspace directories while practicing');
    assert.ok(answered.some(row=>row.path==='/api/operations'),'real answer is submitted, not a simulated confirmation only');
    const returned=await phase('practice-exit',async()=>{await page.locator('#btnExitPractice').click();await readyHome();});
    assert.ok(returned.filter(row=>row.path==='/api/personal-wordbooks').length<=1,'returning from practice refreshes personal directory at most once');
    noDirectories(await phase('post-practice-confirmation',()=>page.evaluate(()=>dispatchEvent(new CustomEvent('server-cache-applied')))),'returning home does not restore the redundant confirmation path');
    assert.deepEqual(errors,[],'browser flow has no uncaught errors');
    const output=path.join(root,'output/playwright/request-budget');fs.mkdirSync(output,{recursive:true});
    fs.writeFileSync(path.join(output,'workspace-flow.json'),JSON.stringify({fixture:'isolated-membership-free-course',idleSeconds:12,phases},null,2));
    console.log('Workspace browser request budget passed: '+JSON.stringify(phases));
  }finally{await context.close();}
};
