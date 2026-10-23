'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const html=fs.readFileSync(path.join(root,'stats.html'),'utf8');
    const style=html.slice(html.indexOf('<style>')+7,html.indexOf('</style>'));
    await page.setContent('<html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+style+'</style><body>'+html.slice(html.indexOf('<div class="wrap">'),html.indexOf('<script src="js/account-storage.js">'))+'</body></html>');
    await page.addStyleTag({path:path.join(root,'assets/learning-archive.css')});
    await page.addStyleTag({path:path.join(root,'assets/stats-navigation.css')});
    await page.evaluate(()=>{
      window.AccountStorage={owner:'test-one'};window.tab='review';window.fail=false;
      window.renderStats=()=>StatsVocabulary&&StatsVocabulary.render(tab);
      window.ChunkAPI={isLoggedIn:()=>true,request:async url=>{
        if(window.fail)throw Error('offline');
        if(url.includes('summary'))return {confirmed:true,domains:[{source:'vocabulary-book',unit:'知识项',learnedItems:1,events:2,dueItems:1},{source:'vocabulary-pilot',unit:'历史词条',learnedItems:1,events:1,dueItems:null}],identityNote:'旧词条不能与词书知识项直接相加。'};
        return {confirmed:true,items:[{id:url.includes('offset')?'second':'first',itemId:'borrow-sense-1',title:'borrow',meaning:'借入',at:1791849600000,outcome:'assisted-completion',course:{bookId:'draft:borrow-adult-v1',title:'成人日常：借东西（编排草稿）',available:true}}],nextOffset:url.includes('offset')?null:20};
      }};
    });
    await page.addScriptTag({path:path.join(root,'js/stats-vocabulary.js')});
    await page.evaluate(()=>renderStats());
    await page.locator('#statsDomains [data-domain="vocabulary"]').click();
    await page.getByText('单词本学习',{exact:true}).waitFor();
    assert.equal(await page.getByText('1 项到期',{exact:true}).count(),1,'confirmed vocabulary summary shows due count');
    await page.evaluate(()=>{tab='sent';renderStats();});
    await page.getByRole('link',{name:/草稿体验 · 成人日常：借东西/}).waitFor();
    await page.locator('#statsDomains [data-domain="vocabulary"]').click();
    assert.equal(await page.locator('#statsCards').isVisible(),false);
    assert.equal(await page.locator('#statsTrend').isVisible(),false,'sentence chart must not appear in vocabulary-only scope');
    assert.equal(await page.locator('#statsBody').isVisible(),false);
    await page.evaluate(()=>{tab='sent';renderStats();});
    await page.getByRole('button',{name:'加载更多记录'}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.archive-word-event').length===2);
    assert.equal(await page.locator('#statsVocabulary').evaluate(el=>el.contains(document.activeElement)),true,'pagination retains focus in its panel after the final button disappears');
    await page.evaluate(()=>{tab='review';renderStats();});
    assert.equal(await page.getByText('1 项到期',{exact:true}).count(),1);
    await page.evaluate(()=>{tab='wrong';renderStats();});
    assert.match(await page.locator('#statsVocabulary').innerText(),/尚未保存完整答错历史/);
    assert.equal(await page.locator('#statsDomains').isVisible(),true,'domain filters remain available outside overview');
    const output=path.join(root,'output/playwright/learning-archive');fs.mkdirSync(output,{recursive:true});
    for(const colorScheme of ['light','dark'])for(const width of [946,390]){
      await page.emulateMedia({colorScheme});await page.setViewportSize({width,height:900});
      await page.evaluate(()=>{tab='sent';renderStats();});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.equal(await page.locator('#statsDomains button').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().height>=38)),true);
      await page.screenshot({path:path.join(output,'records-'+colorScheme+'-'+width+'.png'),fullPage:true});
    }
    await page.evaluate(()=>{fail=true;StatsVocabulary.load();});
    await page.getByRole('button',{name:'重试',exact:true}).waitFor();
    assert.match(await page.locator('#statsVocabulary').innerText(),/更新失败，显示上次记录/);
    await page.evaluate(()=>{AccountStorage.owner='test-two';renderStats();});
    assert.equal(await page.locator('.archive-word-event').count(),0,'old owner records must disappear immediately');
    await page.evaluate(async()=>{fail=false;await StatsVocabulary.load();tab='review';renderStats();});
    assert.equal(await page.getByText('1 项到期',{exact:true}).count(),1,'new owner loads its own confirmed summary');
    for(const width of [946,390]){
      await page.setViewportSize({width,height:900});await page.evaluate(()=>renderStats());
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await page.screenshot({path:path.join(output,'summary-'+width+'.png'),fullPage:true});
    }
    assert.deepEqual(errors,[]);
    console.log('archive UI: vocabulary summary, event pagination, refresh, account switch, light/dark and mobile passed');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
