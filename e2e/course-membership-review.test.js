'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-membership-review-'));
const port = require('./lib/free-port').freePort(10780, 100);
const base = 'http://127.0.0.1:' + port;
(async () => {
  let server, browser;
  try {
    server = spawn(process.execPath, ['index.js'], {cwd:path.join(root,'server'),
      env:{...process.env, PORT:String(port),CHUNKLAB_DATA_DIR:dataDir,NODE_ENV:'test',REQUIRE_AUTH:'false',PHONE_AUTH_ENABLED:'false'},stdio:'ignore'});
    for(let attempt=0;attempt<100;attempt++) {
      if(await fetch(base+'/api/health').then(r=>r.ok).catch(()=>false)) break;
      await new Promise(r=>setTimeout(r,100));
    }
    browser = await chromium.launch({headless:true,executablePath:chromium.executablePath()});
    const context = await browser.newContext({serviceWorkers:'block'});
    const page = await context.newPage();
    await page.goto(base+'/main.html');
    await page.waitForFunction(()=>window.CL && CL.serverPersistenceReady() && window.CourseEnrollment);
    const result = await page.evaluate(async () => {
      const deck = {id:'membership-fixture',name:'Membership fixture',items:[
        {sentence:'One test sentence.',chunks:['One test','sentence.'],hints:['','']},
        {sentence:'Another test sentence.',chunks:['Another test','sentence.'],hints:['','']}
      ]};
      await ServerStore.submitCommitted('deck.put',{deck},{requestId:'membership-fixture-put',expectedRev:null});
      await ServerCache.refresh();
      const cid = CL.cidKey(deck.id,deck.items[0]);
      await ServerStore.submitCommitted('learning.answer',{eventId:'membership-answer-001',key:cid,deckId:deck.id,
        ok:false,occurredAt:Date.now()-3*86400000,generation:0,
        mistake:{key:cid,row:{_key:cid,deckId:deck.id,sentence:deck.items[0].sentence,history:[]}}},
        {requestId:'membership-answer-001'});
      await ServerCache.refresh();
      // Reload the confirmed server snapshot, as a real page opening does.
      const snapshot = await ChunkAPI.getData();
      mem = snapshot.mem;
      const original = JSON.stringify({stats:mem.stats,book:mem.reinforceBook});
      const before = computeToday();
      await CourseEnrollment.join('user-deck:'+deck.id);
      mem = (await ChunkAPI.getData()).mem;
      const joined = computeToday();
      await CourseEnrollment.leave('user-deck:'+deck.id);
      mem = (await ChunkAPI.getData()).mem;
      const left = computeToday();
      renderHome();
      return {before,joined,left,unchanged:original===JSON.stringify({stats:mem.stats,book:mem.reinforceBook}),
        label:document.getElementById('homeBody').textContent};
    });
    assert.deepEqual(result.before,{due:0,book:1});
    assert.deepEqual(result.joined,{due:1,book:1});
    assert.deepEqual(result.left,{due:0,book:1});
    assert.equal(result.unchanged,true,'membership changes preserve original learning and mistake records');
    assert.doesNotMatch(result.label,/Membership fixture/,'exited course is not shown as currently learning on the personal home');
    await page.evaluate(()=>workspace().navigate('my-learning'));
    await page.locator('#myLearningBody').getByRole('heading',{name:'Membership fixture',exact:true}).waitFor();
    await page.evaluate(()=>startDeck(mem.decks.find(d=>d.id==='membership-fixture')));
    await page.waitForURL('**/decks.html?courseView=all&course=*');
    await page.goto(base+'/stats.html');
    await page.waitForFunction(()=>window.CL && CL.serverPersistenceReady());
    assert.equal(await page.evaluate(()=>dueSentences().length),0);
    await page.locator('[data-tab="wrong"]').click();
    await page.locator('#statsBody').getByText('Membership fixture · 已退出',{exact:true}).waitFor();
    await page.goto(base+'/main.html');
    await page.locator('#btnHomeTop').click();
    await page.waitForURL(base+'/index.html');
    assert.ok(await page.locator('#jqkaLogin').isVisible());
    assert.ok(await page.locator('.nav-chunk').isVisible());
    assert.equal(await page.locator('.nav-links > .go').count(),0);
    const cachedContext = await browser.newContext({serviceWorkers:'allow'});
    const cachedPage = await cachedContext.newPage();
    await cachedPage.goto(base+'/main.html');
    await cachedPage.waitForFunction(()=>navigator.serviceWorker.controller,{},{timeout:60000});
    await cachedPage.goto(base+'/decks.html');
    await cachedPage.goto(base+'/main.html?return=course');
    await cachedPage.waitForFunction(()=>window.CL && CL.serverPersistenceReady());
    assert.equal(await cachedPage.evaluate(()=>typeof CourseEnrollment.deckMemberships),'function');
    assert.equal(await cachedPage.locator('body').getByText(/启动失败/).count(),0);
    await cachedContext.setOffline(true);
    assert.equal(await cachedPage.evaluate(async()=>{
      const source=await (await fetch('/js/course-enrollment.js?v=membership-view-20261011')).text();
      return source.includes('api.deckMemberships');
    }),true,'versioned module remains available offline in the installed bundle');
    await cachedContext.close();
    console.log('PASS: membership controls due review, history preserved, unjoined practice gated, Home returns same-origin new homepage');
  } finally {
    if(browser) await browser.close();
    if(server) await new Promise(r=>{server.once('close',r);server.kill('SIGTERM');});
    fs.rmSync(dataDir,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
