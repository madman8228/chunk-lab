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
      window.AccountStorage={owner:'test-one'};window.tab='overview';window.fail=false;window.failCourses=true;window.courseRevision=5;
      window.renderStats=()=>StatsVocabulary&&StatsVocabulary.render(tab);
      window.ChunkAPI={isLoggedIn:()=>true,request:async url=>{
        if(window.fail||window.failCourses&&url.includes('courses'))throw Error('offline');
        if(url.includes('summary'))return {confirmed:true,domains:[{source:'vocabulary-book',unit:'知识项',learnedItems:1,events:2,dueItems:1},{source:'vocabulary-pilot',unit:'历史词条',learnedItems:1,events:1,dueItems:null}],identityNote:'旧词条不能与词书知识项直接相加。'};
        if(url.includes('courses')){const offset=Number(new URL('http://local'+url).searchParams.get('offset')||0),items=offset===0?[{bookId:'draft:borrow-adult-v1',title:'成人日常：借东西（编排草稿）',state:'in-progress',completedItems:courseRevision,totalItems:6},{bookId:'personal-book:borrow-copy',title:'成人日常：借东西（编排草稿）',state:'in-progress',completedItems:3,totalItems:6},...Array.from({length:18},(_,i)=>({bookId:'personal-book:fixture-'+i,title:'课程 '+i,state:'not-started',completedItems:0,totalItems:1}))]:Array.from({length:Math.min(20,101-offset)},(_,i)=>({bookId:'personal-book:fixture-'+(offset+i-2),title:'课程 '+(offset+i-2),state:'not-started',completedItems:0,totalItems:1}));return {confirmed:true,items,totals:{currentCompletedCourses:1,everCompletedCourses:2},nextOffset:offset+items.length<101?offset+items.length:null};}
        return {confirmed:true,items:[{id:url.includes('offset')?'second':'first',itemId:'borrow-sense-1',title:'borrow',meaning:'借入',at:1791849600000,outcome:'assisted-completion',course:{bookId:'draft:borrow-adult-v1',title:'成人日常：借东西（编排草稿）',available:true}}],nextOffset:url.includes('offset')?null:20};
      }};
    });
    await page.addScriptTag({path:path.join(root,'js/stats-vocabulary.js')});
    await page.getByText('单词本学习',{exact:true}).waitFor();
    await page.getByRole('button',{name:'进度暂不可读，重试',exact:true}).waitFor();
    await page.evaluate(()=>{failCourses=false;});
    await page.getByRole('button',{name:'进度暂不可读，重试',exact:true}).click();
    const draftCourse=page.locator('.archive-word-courses a').filter({hasText:'草稿体验'});
    const personalCourse=page.locator('.archive-word-courses a[href*="borrow-copy"]');
    await draftCourse.waitFor();await personalCourse.waitFor();
    assert.match(await draftCourse.innerText(),/5 \/ 6 词/);
    assert.match(await personalCourse.innerText(),/3 \/ 6 词/);
    assert.match(await draftCourse.getAttribute('href'),/book=draft%3Aborrow-adult-v1/);
    assert.match(await personalCourse.getAttribute('href'),/book=personal-book%3Aborrow-copy/);
    assert.match(await page.locator('.archive-word-courses').innerText(),/当前已完成练习 1 门 · 曾完成 2 门/);
    await page.evaluate(()=>{courseRevision=6;dispatchEvent(new Event('server-cache-applied'));});
    await page.locator('.archive-word-courses a').filter({hasText:'6 / 6 词'}).waitFor();
    await page.getByRole('button',{name:'加载更多课程'}).click();await page.locator('.archive-word-courses a[href*="fixture-18"]').waitFor();
    for(let pageIndex=1;pageIndex<5;pageIndex++){const more=page.getByRole('button',{name:'加载更多课程'});if(await more.count())await more.click();}
    await page.locator('.archive-word-courses a[href*="fixture-98"]').waitFor();assert.equal(await page.locator('.archive-word-courses a').count(),101,'course list pagination reaches item 101 without duplicates');
    await page.locator('.word-growth-availability details summary').click();
    await page.evaluate(()=>renderStats());
    assert.deepEqual(await page.locator('.word-growth-availability details').evaluate(el=>({open:el.open,focused:el.querySelector('summary')===document.activeElement})),
      {open:true,focused:true},'statistics refresh preserves the expanded description and keyboard focus');
    await page.locator('.word-growth-availability details summary').click();await page.evaluate(()=>renderStats());
    assert.equal(await page.locator('.word-growth-availability details').evaluate(el=>el.open),false,'a collapsed description stays collapsed');
    await page.locator('.word-growth-availability details summary').click();
    assert.equal(await page.locator('#statsDomains').isVisible(),false,'overview includes both domains without list filters');
    await page.evaluate(()=>{tab='sent';renderStats();});
    await page.getByRole('link',{name:/草稿体验 · 成人日常：借东西/}).waitFor();
    await page.getByRole('button',{name:'单词',exact:true}).click();
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
    const output=path.join(root,'output/playwright/learning-archive');fs.mkdirSync(output,{recursive:true});
    for(const colorScheme of ['light','dark'])for(const width of [946,390]){
      await page.emulateMedia({colorScheme});await page.setViewportSize({width,height:900});
      await page.evaluate(()=>{tab='sent';renderStats();});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.equal(await page.locator('#statsDomains button').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().height>=44)),true);
      await page.screenshot({path:path.join(output,'records-'+colorScheme+'-'+width+'.png'),fullPage:true});
    }
    await page.evaluate(()=>{fail=true;StatsVocabulary.load();});
    await page.getByRole('button',{name:'重试',exact:true}).waitFor();
    assert.match(await page.locator('#statsVocabulary').innerText(),/更新失败，显示上次记录/);
    await page.evaluate(()=>{AccountStorage.owner='test-two';renderStats();});
    assert.equal(await page.locator('.archive-word-event').count(),0,'old owner records must disappear immediately');
    await page.evaluate(async()=>{fail=false;await StatsVocabulary.load();tab='overview';renderStats();});
    assert.equal(await page.locator('.word-growth-availability details').evaluate(el=>el.open),false,'new account does not inherit description state');
    await page.locator('.word-growth-availability details summary').click();
    await page.evaluate(async()=>{await StatsVocabulary.load();});
    assert.equal(await page.locator('.word-growth-availability details').evaluate(el=>el.open),true,'successful data refresh retains the expanded description');
    assert.equal(await page.locator('.word-growth-availability details summary').evaluate(el=>el===document.activeElement),true);
    for(const width of [946,390]){
      await page.setViewportSize({width,height:900});await page.evaluate(()=>renderStats());
      assert.equal(await page.locator('.word-growth-availability details').evaluate(el=>el.open),true);
      await page.screenshot({path:path.join(output,'description-'+width+'.png'),fullPage:true});
    }
    const detailsPage=await browser.newPage(),detailsErrors=[];detailsPage.on('pageerror',error=>detailsErrors.push(error.message));await detailsPage.setContent('<main><div id="detailsRoot"></div><div id="detailsStatus"></div></main>');
    await detailsPage.evaluate(()=>{window.AccountStorage={owner:'history-owner',sessionEpoch:1};window.detailRequests=[];window.ChunkAPI={isLoggedIn:()=>true,getBase:()=>'',request:async url=>{detailRequests.push(url);return url.includes('/details')?{confirmed:true,title:'追加词条课程',revision:'current-revision',itemCount:6,units:[{unitId:'u1',title:'单元一',itemCount:6}],catalog:{},features:{}}:{confirmed:true,course:{state:'updated',completedItems:3,totalItems:6,completedVersions:[{bookRevision:'previous-revision',structureRevision:'previous-structure',totalItems:3,completedAt:1791849600000}]}};}};});
    await detailsPage.addScriptTag({path:path.join(root,'landing/wordbook-details.js')});
    await detailsPage.waitForTimeout(100);
    assert.deepEqual(detailsErrors,[],JSON.stringify({status:await detailsPage.locator('#detailsStatus').innerText(),requests:await detailsPage.evaluate(()=>detailRequests),text:await detailsPage.locator('#detailsRoot').innerText()}));
    assert.deepEqual(await detailsPage.evaluate(()=>detailRequests.map(url=>url.includes('/details')?'details':'progress')),['details','progress']);
    await detailsPage.waitForFunction(()=>document.querySelector('.book-progress')?.innerText.includes('新增内容待学 · 3 / 6 词'));
    await detailsPage.locator('.book-completed-versions summary').getByText('已完成版本 1 个',{exact:true}).waitFor();
    assert.equal(await detailsPage.locator('.book-completed-versions').evaluate(el=>el.open),false,'historical version detail is collapsed by default');
    await detailsPage.locator('.book-completed-versions summary').click();
    assert.match(await detailsPage.locator('.book-completed-versions').innerText(),/3 词/,'old completed version remains available beside newly added work');
    await detailsPage.close();
    assert.deepEqual(errors,[]);
    console.log('archive UI: domains, pagination, refresh, account switch, version history, light/dark and mobile passed');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
