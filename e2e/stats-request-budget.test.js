'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'chunklab-stats-budget-'));
const port=require('./lib/free-port').freePort(11100,100),base='http://127.0.0.1:'+port;
let child,browser;
(async()=>{
  try{
    child=spawn(process.execPath,['server/index.js'],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,
      CHUNKLAB_DATA_DIR:dir,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'test',REQUIRE_AUTH:'true',PHONE_AUTH_ENABLED:'false',CHUNKLAB_WRITE_PROTOCOL:'3',
      JWT_SECRET:crypto.randomBytes(40).toString('hex'),ADMIN_JWT_SECRET:crypto.randomBytes(40).toString('hex'),MEMBERSHIP_CONTENT_GRANT_KEY:crypto.randomBytes(32).toString('base64')}});
    let ready=false;
    for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch(_){}if(ready)break;await new Promise(r=>setTimeout(r,100));}
    assert.ok(ready,'isolated server starts');
    const signup=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'stats-budget',password:'SyntheticBudget2026!'})});
    assert.equal(signup.status,200);const account=await signup.json();
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath()});
    const context=await browser.newContext({serviceWorkers:'block'});
    await context.addInitScript(token=>localStorage.setItem('chunklab_token',token),account.token);
    const page=await context.newPage();let summaries=0,events=0,catalogs=0;
    page.on('request',request=>{if(new URL(request.url()).pathname==='/api/course-content/catalog')catalogs++;});
    await page.route('**/api/learning-archive/vocabulary/**',route=>{
      const summary=route.request().url().includes('/summary');if(summary)summaries++;else events++;
      return route.fulfill({contentType:'application/json',body:JSON.stringify(summary?{confirmed:true,domains:[]}:{confirmed:true,items:[],nextOffset:null})});
    });
    await page.goto(base+'/main.html?view=stats');
    await page.waitForFunction(()=>window.StatsVocabulary&&CL.serverPersistenceReady());
    await page.evaluate(()=>StatsVocabulary.whenReady());
    await page.waitForFunction(()=>!document.querySelector('#statsPageHost').shadowRoot.querySelector('.archive-initial-loading'));
    assert.equal(events,0,'overview never preloads event details');
    await page.evaluate(()=>showPage('pageHome'));
    // Let requests that began while visible finish before measuring hidden work.
    await page.evaluate(()=>StatsVocabulary.whenReady());await page.waitForTimeout(150);
    const initial={summaries,events,catalogs};
    for(let i=0;i<3;i++){
      await page.evaluate(()=>window.dispatchEvent(new CustomEvent('server-cache-applied',{detail:{owner:AccountStorage.owner}})));
      await page.waitForTimeout(80);
    }
    assert.deepEqual({summaries,events,catalogs},initial,'hidden save events do not fetch vocabulary or catalog');
    await page.evaluate(()=>showStatsPage());
    await page.waitForFunction(()=>!StatsVocabulary.initialLoading());
    await page.evaluate(()=>StatsVocabulary.whenReady());await page.waitForTimeout(200);
    assert.equal(summaries,initial.summaries+1,'reopen fetches one latest vocabulary summary');assert.equal(events,0);
    const details=page.locator('#statsPageHost').getByRole('button',{name:'明细',exact:true});
    await details.click();await page.evaluate(()=>StatsVocabulary.whenReady());
    assert.equal(events,1,'opening details fetches their first page once');
    await page.locator('#statsPageHost').getByRole('button',{name:'概览',exact:true}).click();await details.click();
    await page.evaluate(()=>StatsVocabulary.whenReady());assert.equal(events,1,'unchanged details reuse current view data');
    console.log('stats real browser: hidden saves 0 auxiliary reads, reopen 1 summary, details lazy and reused passed');
  }finally{
    if(browser)await browser.close();
    if(child&&child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(dir,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
