'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
(async()=>{
  const originServer=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><html><body></body></html>');});
  await new Promise(resolve=>originServer.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true});
  try{
    let resolveReview,startedReview=null;const startedReviewPromise=new Promise(resolve=>{resolveReview=resolve;});
    let reviewQueries=[],dailySentenceLaunches=[],resolveDailySentence=null,dailyVocabularyStart=null,dailyParentProgress=null;
    const waitForDailySentence=()=>new Promise(resolve=>{resolveDailySentence=resolve;});
    const page=await browser.newPage();await page.exposeFunction('captureStartedReview',operation=>{startedReview=operation;resolveReview(operation);});
    await page.exposeFunction('captureReviewQuery',url=>reviewQueries.push(url));
    await page.exposeFunction('captureDailySentenceLaunch',value=>{dailySentenceLaunches.push(value);if(resolveDailySentence){resolveDailySentence(value);resolveDailySentence=null;}});
    await page.exposeFunction('captureDailyVocabularyStart',operation=>{dailyVocabularyStart=operation;});
    await page.exposeFunction('captureDailyParentProgress',payload=>{dailyParentProgress=payload;});
    await page.route('**/wordbook.html*',route=>route.abort());
    const errors=[];page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
    const html=fs.readFileSync(path.join(root,'stats.html'),'utf8');
    const style=html.slice(html.indexOf('<style>')+7,html.indexOf('</style>'));
    await page.goto('http://127.0.0.1:'+originServer.address().port+'/');
    await page.setContent('<html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+style+'</style><body>'+html.slice(html.indexOf('<div class="wrap">'),html.indexOf('<script src="js/account-storage.js">'))+'</body></html>');
    await page.addStyleTag({path:path.join(root,'assets/learning-archive.css')});
    await page.addStyleTag({path:path.join(root,'assets/stats-navigation.css')});
    await page.evaluate(()=>{
      window.AccountStorage={owner:'test-one'};window.tab='review';window.fail=false;window.__dailyState=null;window.__startedDaily=null;window.__emptyCourses=false;
      window.getDailyReviewSentenceCandidates=()=>[
        {type:'sentence',key:'deck-a#sentence-a',dueAt:100,reference:{deckId:'deck-a',cid:'sentence-a'}},
        {type:'sentence',key:'deck-a#sentence-b',dueAt:150,reference:{deckId:'deck-a',cid:'sentence-b'}}
      ];
      window.launchDailyReviewSentenceGroup=async(items,sessionId,endIndex,childOffset,childTotal)=>{await window.captureDailySentenceLaunch({items,sessionId,endIndex,childOffset,childTotal});};
      window.renderStats=()=>StatsVocabulary&&StatsVocabulary.render(tab);
      window.ChunkAPI={isLoggedIn:()=>true,request:async url=>{
        if(window.fail)throw Error('offline');
        if(url.includes('/daily-review-sessions/'))return window.__dailyState;
        if(url.includes('summary'))return {confirmed:true,domains:[{source:'vocabulary-book',unit:'知识项',learnedItems:1,events:2,dueItems:null},{source:'vocabulary-pilot',unit:'历史词条',learnedItems:1,events:1,dueItems:null}],identityNote:'旧词条不能与词书知识项直接相加。'};
        if(url.includes('/courses?'))return {confirmed:true,items:window.__emptyCourses?[]:[{bookId:'draft:borrow-adult-v1',title:'成人日常：借东西'}]};
        if(url.includes('/review?')){await window.captureReviewQuery(url);return {confirmed:true,bookId:'draft:borrow-adult-v1',bookRevision:'book-rev',total:1,items:[{itemId:'borrow-sense-1',title:'borrow',meaning:'借入',practiceType:'word-choice',canReview:true,state:{status:'due',due:true,dueAt:200}}],nextOffset:null};}
        return {confirmed:true,items:[{id:url.includes('offset')?'second':'first',itemId:'borrow-sense-1',title:'borrow',meaning:'借入',at:1791849600000,outcome:url.includes('offset')?'independent-recall':'assisted-completion',course:{bookId:'draft:borrow-adult-v1',title:'成人日常：借东西（编排草稿）',available:true}}],nextOffset:url.includes('offset')?null:20};
      }};
      window.ChunkAPI.submitOperation=async operation=>{
        if(operation.type==='daily-review.session'){
          if(operation.payload.action==='start'){window.__startedDaily=operation.payload;window.__dailyState={confirmed:true,sessionId:operation.payload.sessionId,items:operation.payload.items,index:0,childSession:null,status:'in-progress',revision:1};}
          if(operation.payload.action==='progress'){window.__dailyState={...window.__dailyState,index:operation.payload.index,childSession:operation.payload.childSession,revision:window.__dailyState.revision+1};await window.captureDailyParentProgress(operation.payload);}
        }
        if(operation.type==='vocabulary.review.session'&&operation.payload.action==='start'){window.__dailyVocabularyStart=operation;await window.captureDailyVocabularyStart(operation);}
        await window.captureStartedReview(operation);return {confirmed:true};
      };
    });
    await page.addScriptTag({path:path.join(root,'js/stats-vocabulary.js')});
    await page.evaluate(()=>renderStats());
    await page.locator('#statsDomains [data-domain="vocabulary"]').click();
    await page.getByText('单词本学习',{exact:true}).waitFor();
    assert.ok(await page.getByText('请选择词书和练习方式查看专项状态',{exact:true}).count()>=1,'unscoped global due count is not presented as vocabulary status');
    await page.getByLabel('选择词书').waitFor();
    await page.waitForFunction(()=>document.querySelector('[aria-label="选择词书"] option[value="draft:borrow-adult-v1"]'));
    await page.getByRole('button',{name:'查看专项复习'}).click();
    await page.getByRole('button',{name:'复习此类内容（最多10项）'}).waitFor();
    await page.evaluate(()=>{tab='sent';renderStats();});
    await page.getByRole('link',{name:/草稿体验 · 成人日常：借东西/}).waitFor();
    assert.match(await page.locator('#statsVocabulary').innerText(),/辅助练习完成/,
      'assisted completion is labelled as an auxiliary activity, not mastery');
    await page.locator('#statsDomains [data-domain="vocabulary"]').click();
    assert.equal(await page.locator('#statsCards').isVisible(),false);
    assert.equal(await page.locator('#statsTrend').isVisible(),false,'sentence chart must not appear in vocabulary-only scope');
    assert.equal(await page.locator('#statsBody').isVisible(),false);
    await page.evaluate(()=>{tab='sent';renderStats();});
    await page.getByRole('button',{name:'加载更多记录'}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.archive-word-event').length===2);
    assert.match(await page.locator('#statsVocabulary').innerText(),/独立回忆 · 非应用测评/,
      'an independent recall event is not presented as an application assessment');
    assert.equal(await page.locator('#statsVocabulary').evaluate(el=>el.contains(document.activeElement)),true,'pagination retains focus in its panel after the final button disappears');
    await page.evaluate(()=>{
      const trend=document.querySelector('#statsTrend');
      trend.innerHTML='<div class="review-domain-grid"><section class="review-sentence-group" aria-label="句子复习"></section></div>';
      tab='overview';renderStats();
    });
    const reviewQueriesBeforeOverview=reviewQueries.length;
    await page.getByRole('region',{name:'单词复习'}).waitFor();
    await page.getByRole('region',{name:'句子复习'}).waitFor();
    await page.getByLabel('选择词书').waitFor();
    await page.waitForFunction(()=>document.querySelector('[aria-label="选择词书"] option[value="draft:borrow-adult-v1"]'));
    await page.getByLabel('筛选复习内容').selectOption('due');
    await page.getByLabel('练习方式').selectOption('word-choice');
    await page.getByRole('button',{name:'查看专项复习'}).click();
    await page.getByRole('button',{name:'复习此类内容（最多10项）'}).waitFor();
    assert.match(await page.locator('.review-word-group').innerText(),/当前筛选共 1 项/,'overview shows confirmed per-scope results, not a cross-book aggregate');
    assert.equal(reviewQueries.length,reviewQueriesBeforeOverview+1,'overview queries the selected review scope once');
    assert.match(reviewQueries.at(-1),/bookId=draft%3Aborrow-adult-v1/);
    assert.match(reviewQueries.at(-1),/kind=due/);
    assert.match(reviewQueries.at(-1),/practiceType=word-choice/);
    await page.getByRole('button',{name:'复习此类内容（最多10项）'}).waitFor();
    await page.evaluate(()=>{tab='review';renderStats();});
    assert.ok(await page.getByText('请选择词书和练习方式查看专项状态',{exact:true}).count()>=1);
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
    assert.ok(await page.getByText('请选择词书和练习方式查看专项状态',{exact:true}).count()>=1,'new owner loads its own confirmed summary');
    for(const width of [946,390]){
      await page.setViewportSize({width,height:900});await page.evaluate(()=>renderStats());
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await page.screenshot({path:path.join(output,'summary-'+width+'.png'),fullPage:true});
    }
    await page.evaluate(()=>{window.__emptyCourses=true;tab='overview';renderStats();});
    await page.waitForFunction(()=>document.querySelector('.review-word-group select[aria-label="选择词书"] option')?.textContent==='当前账号没有可用于复习的词书');
    const emptyReviewGroup=page.locator('.review-word-group').last();
    await page.getByRole('button',{name:'开始今日混合复习'}).click();
    await page.getByRole('button',{name:'开始今日混合复习'}).click();
    assert.equal(await emptyReviewGroup.locator('.archive-word-review-start-status').count(),1,
      'repeated failed starts update one status message instead of adding rows');
    assert.match(await emptyReviewGroup.innerText(),/请先选择一本词书/);
    await page.evaluate(()=>{window.__emptyCourses=false;tab='overview';renderStats();});
    await page.getByRole('button',{name:'开始今日混合复习'}).waitFor();
    let firstSentenceLaunch=waitForDailySentence();
    await page.getByRole('button',{name:'开始今日混合复习'}).click();
    const firstSentenceGroup=await firstSentenceLaunch;
    const dailySnapshot=await page.evaluate(()=>({started:window.__startedDaily,state:window.__dailyState}));
    assert.deepEqual(dailySnapshot.started.items.map(item=>item.key),['deck-a#sentence-a','deck-a#sentence-b','draft:borrow-adult-v1#borrow-sense-1#word-choice']);
    assert.equal(dailySnapshot.state.childSession.type,'sentence','the first ordered group is handed to the sentence player');
    assert.equal(firstSentenceGroup.items.length,2,'adjacent due sentences are handed to one sentence-player group');
    assert.equal(firstSentenceGroup.endIndex,2);
    await page.waitForTimeout(30);
    let resumedSentenceLaunch=waitForDailySentence();
    await page.evaluate(()=>{window.__dailyState.childSession.index=1;window.__dailyState.revision++;renderStats();});
    const resumedSentenceGroup=await resumedSentenceLaunch;
    assert.deepEqual(resumedSentenceGroup.items.map(item=>item.reference.cid),['sentence-b'],'refresh resumes the sentence group after its saved child index');
    assert.equal(resumedSentenceGroup.childOffset,1);
    await page.waitForTimeout(30);
    const wordbookNavigation=page.waitForRequest(request=>new URL(request.url()).pathname.endsWith('/wordbook.html'));
    await page.evaluate(()=>{window.__dailyState.index=2;window.__dailyState.childSession.index=2;window.__dailyState.childSession.status='completed';window.__dailyState.revision++;renderStats();});
    const wordbookRequest=await wordbookNavigation;
    const wordbookUrl=new URL(wordbookRequest.url());
    assert.deepEqual(dailyVocabularyStart.payload.itemIds,['borrow-sense-1'],'the next group starts only the selected due vocabulary item');
    assert.equal(dailyParentProgress.childSession.type,'vocabulary','the parent cursor moves to the next player group');
    assert.equal(wordbookUrl.searchParams.get('reviewSession'),dailyVocabularyStart.payload.sessionId);
    assert.equal(wordbookUrl.searchParams.get('practice'),'word-choice');
    assert.match(wordbookUrl.searchParams.get('returnTo'),/dailyReview=/,'the child player returns to the resumable parent queue');
    assert.deepEqual(errors,[]);
    console.log('archive UI: vocabulary summary, mixed due queue ordering, sentence resume, vocabulary handoff, event pagination, account switch, light/dark and mobile passed');
  }finally{await browser.close();await new Promise(resolve=>originServer.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
