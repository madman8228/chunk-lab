'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage();
    await page.setContent('<header><a id="bookBack" href="main.html?view=my-learning">返回</a><span id="bookTitle"></span></header><p id="bookStatus"></p><main id="studyRoot"></main>');
    await page.evaluate(()=>{
      window.serverState={confirmed:true,sessionId:'targeted-review-ui-01',bookId:'draft:test-book',bookRevision:'book-rev',practiceType:'sentence-cloze',queue:[{itemId:'word-1',contentRevision:'item-rev',practiceRevision:'item-rev'}],index:0,stepIndex:0,status:'in-progress',revision:1};
      window.calls=[];window.normalProgressCalls=0;
      window.ChunkAPI={isLoggedIn:()=>true,request:async url=>{
        if(url.includes('/review-sessions/')){window.calls.push('session');return structuredClone(window.serverState);}
        if(url.includes('/api/wordbooks/'))return {revision:'book-rev',items:[]};
        if(url.includes('/api/vocabulary-items/'))return {itemId:'word-1',contentRevision:'item-rev',word:'borrow',meaning:'借入',exercise:{}};
        window.normalProgressCalls++;throw Error('unexpected ordinary learning API: '+url);
      },submitOperation:async operation=>{
        window.calls.push(operation.type);
        if(operation.type==='vocabulary.review.attempt'){window.serverState={...window.serverState,index:1,status:'completed',revision:2};}
        return {confirmed:true};
      }};
      window.JQKAClozeView={create:(item,options)=>{window.reviewViewOptions=options;return {element:document.createElement('form'),values:()=>({blank:'borrow'})};}};
    });
    await page.addScriptTag({path:path.join(root,'js/vocabulary-targeted-review.js')});
    await page.evaluate(()=>VocabularyTargetedReview.start({bookId:'draft:test-book',practiceType:'sentence-cloze',sessionId:'targeted-review-ui-01'}));
    await page.getByText('borrow · 借入',{exact:true}).waitFor();
    await page.evaluate(()=>VocabularyTargetedReview.start({bookId:'draft:test-book',practiceType:'sentence-cloze',sessionId:'targeted-review-ui-01'}));
    await page.getByText('borrow · 借入',{exact:true}).waitFor();
    await page.evaluate(()=>{reviewViewOptions.onAttempt({values:{blank:'borrow'},inputMode:'typing'});reviewViewOptions.onComplete({values:{blank:'borrow'}});});
    await page.getByText('本轮专项复习完成',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>normalProgressCalls),0,'targeted restoration never invokes ordinary course state or completion APIs');
    assert.ok(await page.evaluate(()=>calls.filter(name=>name==='session').length)>=3,'a page refresh re-reads the server-owned session position');
    assert.equal(await page.locator('#bookBack').getAttribute('href'),'main.html?view=stats&tab=wrong','the dedicated page back link returns to the review archive');
    assert.deepEqual(await page.evaluate(()=>calls.filter(name=>name==='vocabulary.review.attempt').length),1);
    await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,value:false});VocabularyTargetedReview.start({bookId:'draft:test-book',practiceType:'sentence-cloze',sessionId:'targeted-review-ui-01'});});
    await page.getByText('专项复习需要登录并保持联网',{exact:false}).waitFor();
    assert.equal(await page.evaluate(()=>calls.filter(name=>name==='vocabulary.review.attempt').length),1,'offline entry does not enqueue work into the ordinary learning store');
    console.log('Targeted review UI: refresh restores independent server session, completion stays separate, archive return preserved.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
