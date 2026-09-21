/* Synthetic capacity gate, not a claim of real-device or real-course acceptance. */
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const {spawn} = require('child_process');
const {chromium} = require('playwright-core');
const ROOT = path.resolve(__dirname,'..');
const PORT = require('./lib/free-port').freePort(9600,100);
const BASE = 'http://127.0.0.1:'+PORT;
const temp = fs.mkdtempSync(path.join(os.tmpdir(),'cl-mobile-8000-'));
const deckId = 'builtin-perf-8000', assets = new Map();
const entry = {id:deckId,name:'容量测试',baseCount:0,totalCount:8000,shards:[],indexShards:[]};
function asset(url,data,mode){
  const body = JSON.stringify(data); assets.set('/'+url,body);
  return {id:url,url,count:data.items.length,bytes:Buffer.byteLength(body),sha256:crypto.createHash('sha256').update(body).digest('hex'),mode};
}
for(let shard=0;shard<40;shard++){
  const url = 'content/perf8000/detail-'+shard+'.json';
  const items = Array.from({length:200},(_,i)=>{
    const n = shard*200+i;
    return {cid:'perf-'+n,sentence:'Could you help me with task '+n+'?',translation:'你能帮我完成任务'+n+'吗？',
      chunks:['Could you help me','with task '+n+'?'],hints:['你能帮我','完成任务'+n],roles:['主句','介词短语'],
      alts:[['Can you help me','Would you help me'],['with this task?','with that task?']],
      explanation:'Synthetic capacity fixture. '.repeat(65)};
  });
  entry.shards.push(asset(url,{schemaVersion:1,mode:'replace',items},'replace'));
  entry.indexShards.push(asset('content/perf8000/index-'+shard+'.json',{
    schemaVersion:1,mode:'index',items:items.map((it,i)=>({cid:it.cid,sentence:it.sentence,translation:it.translation,sourceUrl:url,sourceOffset:i}))
  },'index'));
}
const manifest = {schemaVersion:1,contentVersion:'capacity-fixture-v1',decks:[entry]};
let server,browser,passed=0;
function check(name,ok){ if(!ok) throw new Error(name); passed++; console.log('  ✓ '+name); }
async function ready(){
  /* 就绪窗口 300×100ms=30s。原为 50×100ms=5s，小于宿主普通 node 冷启动实测 5.4s ⇒ 必然假红。
     health 一旦 200 立即 return，放大窗口在成功路径上不增加任何耗时。 */
  for(let i=0;i<300;i++){
    const ok = await new Promise(resolve=>{
      const req = http.get(BASE+'/api/health',res=>{res.resume();resolve(res.statusCode===200);});
      req.on('error',()=>resolve(false)); req.setTimeout(500,()=>req.destroy());
    });
    if(ok) return;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('temporary server did not start');
}
(async function(){
  try{
    server = spawn(process.execPath,['index.js'],{cwd:path.join(ROOT,'server'),env:{...process.env,PORT:String(PORT),CHUNKLAB_DATA_DIR:temp,NODE_ENV:'test'},stdio:'ignore'});
    await ready();
    browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || chromium.executablePath()});
    const context = await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block'});
    let details=0,indexes=0,detailBytes=0;
    await context.route('**/content/**',route=>{
      const url = new URL(route.request().url()).pathname;
      if(url==='/content/manifest.json') return route.fulfill({json:manifest});
      const body = assets.get(url);
      if(!body) return route.continue();
      if(url.includes('/detail-')){details++;detailBytes+=Buffer.byteLength(body);} else indexes++;
      return route.fulfill({contentType:'application/json',body});
    });
    const page = await context.newPage(), errors=[], consoleLogs=[];
    page.setDefaultTimeout(30000);
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',msg=>consoleLogs.push(msg.type()+':'+msg.text()));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    await cdp.send('Performance.enable');
    const heapSamples=[];
    async function heap(){const p=await cdp.send('Performance.getMetrics');heapSamples.push(p.metrics.find(m=>m.name==='JSHeapUsedSize').value);}
    const start=Date.now();
    await page.goto(BASE+'/main.html');
    await page.waitForFunction(()=>window.S && ContentRepo.getManifest() && !document.getElementById('pageHome').classList.contains('hidden'));
    const homeMs=Date.now()-start;
    check('8000-句首页不请求详情或索引',details===0 && indexes===0);
    await heap();
    await page.evaluate(id=>{mem.settings.skipMastered=false;mem.settings.batchSize=10;startDeck(findDeck(id),0);},deckId);
    await page.waitForFunction(()=>S.items.length===10 && S.items.some(it=>it.cid==='perf-0'));
    check('普通练习首批只请求一个 200 句分片',details===1);
    const reset = await page.evaluate(id=>ContentRepo.ensureDeckBatch(id,CL.loadMem(),{force:true,limit:2,skipMastered:false,cursor:{shardIndex:39,shardOffset:190,contentVersion:'old-release'}}),deckId);
    check('内容版本改变后重置旧偏移游标',reset.deck.items[0].cid==='perf-0' && reset.nextCursor.contentVersion===manifest.contentVersion);
    await heap();
    const statsStart=Date.now();
    await page.goto(BASE+'/stats.html');
    await page.waitForSelector('#todayAnswered');
    await page.click('[data-tab="sent"]');
    await page.waitForFunction(()=>document.querySelectorAll('.stats-detail-row').length>0);
    const statsMs=Date.now()-statsStart;
    if(!(details===1 && indexes===40)) throw new Error('统计只加载索引，不额外请求详情（details='+details+'，indexes='+indexes+'）');
    passed++; console.log('  ✓ 统计只加载索引，不额外请求详情');
    check('8000-句统计每页最多50条',await page.locator('.stats-detail-row').count()===50);
    await page.locator('[data-list-key="sent-all"][data-list-page="1"]').click();
    check('统计下一页保持50条且编号连续',(await page.locator('.row-num').first().textContent())==='#51' && await page.locator('.stats-detail-row').count()===50);
    const renderMs = await page.evaluate(id=>{
      const deck = findDeck(id); mem.stats.bySentence={};
      deck.items.forEach(it=>{mem.stats.bySentence[id+'#'+it.cid]={deckId:id,sentence:it.sentence,dueAt:Date.now()-1000,times:1,okTimes:1};});
      _statsTab='review';const t=performance.now();renderStats();return performance.now()-t;
    },deckId);
    check('8000条到期记录完整计数、只渲染50条',await page.locator('#statsBody .srow').count()===50 && (await page.locator('#reviewTabCount').textContent())==='(8000)');
    check('待复习页不再显示重复的开始复习按钮',await page.locator('#startDueReview').count()===0);
    check('四倍CPU减速下到期筛选及渲染低于3秒',renderMs<3000);
    await heap();
    const hotSave = await page.evaluate(async function(){
      const m = window.mem || window.CL.loadMem();
      const keys = Object.keys(m.stats.bySentence);
      const key = keys[0];
      const samples = [];
      for(let i=0;i<100;i++){
        const before = performance.now();
        m.stats.bySentence[key].times = (m.stats.bySentence[key].times || 0) + 1;
        m.stats.events.push({id:'capacity-hot-'+i,kind:'answer',key:key,ok:true,at:Date.now()});
        window.CL.saveMem(m);
        samples.push(performance.now()-before);
      }
      await window.CL.lastSave();
      samples.sort((a,b)=>a-b);
      const persisted = await window.IDBStore.loadAll();
      return {
        p50:samples[49], p95:samples[94], max:samples[99],
        sentenceRows:Object.keys(persisted.sentenceStats || {}).length,
        eventRows:(persisted.events || []).length,
        times:m.stats.bySentence[key].times
      };
    });
    check('8000句连续100次保存不抛错且最终提交完成',hotSave.sentenceRows===8000 && hotSave.eventRows===100 && hotSave.times===101,
      JSON.stringify(hotSave));
    check('8000句热路径不因历史体积产生明显同步卡顿',hotSave.p95<100,
      JSON.stringify({p50:Math.round(hotSave.p50),p95:Math.round(hotSave.p95),max:Math.round(hotSave.max)}));
    console.log('[mobile-8000 hot-save] '+JSON.stringify({runs:100,p50Ms:Math.round(hotSave.p50),p95Ms:Math.round(hotSave.p95),maxMs:Math.round(hotSave.max),sentenceRows:hotSave.sentenceRows,eventRows:hotSave.eventRows}));
    const slowQueue = await page.evaluate(async function(){
      const original = IDBStore.writeStatsBatch;
      let calls = 0;
      IDBStore.writeStatsBatch = function(){
        const args = arguments; calls++;
        return new Promise(function(resolve,reject){
          setTimeout(function(){
            original.apply(IDBStore,args).then(resolve,reject);
          },40);
        });
      };
      try{
        const m = window.mem || window.CL.loadMem(), key = Object.keys(m.stats.bySentence || {})[0];
        if(!key) throw new Error('容量夹具未建立句子档案');
        for(let i=0;i<100;i++){
          m.stats.bySentence[key].times++;
          m.stats.events.push({id:'capacity-slow-'+i,kind:'answer',key:key,ok:true,at:Date.now()});
          window.CL.saveMem(m);
        }
        await window.CL.lastSave();
        const persisted = await window.IDBStore.loadAll();
        return {calls,times:m.stats.bySentence[key].times,eventRows:(persisted.events || []).length};
      }finally{
        IDBStore.writeStatsBatch = original;
      }
    });
    check('慢IDB下统计写入最多保留当前提交和一个尾提交',slowQueue.calls<=2 && slowQueue.eventRows===200 && slowQueue.times===201,
      JSON.stringify(slowQueue));
    const reviewStart=Date.now();
    await page.evaluate(()=>{
      const b=document.createElement('button');
      b.id='testStartDue';
      b.onclick=practiceDue;
      document.body.appendChild(b);
    });
    await Promise.all([
      page.waitForURL('**/main.html?autostart=1', {waitUntil:'domcontentloaded'}),
      page.locator('#testStartDue').click()
    ]);
    try{
      await page.waitForFunction(()=>window.S && S.items.length===10 && S.deck.id.startsWith('srs-'), undefined, {timeout:60000});
    }catch(error){
      const state = await page.evaluate(()=>({
        href:location.href,
        pagePractice:!!document.querySelector('#pagePractice:not(.hidden)'),
        bootHidden:document.querySelector('#bootScreen') && document.querySelector('#bootScreen').hidden,
        deck:window.S && window.S.deck && {id:window.S.deck.id,items:(window.S.deck.items||[]).length},
        items:window.S && window.S.items && window.S.items.length,
        zh:document.querySelector('#zh') && document.querySelector('#zh').textContent,
        pending:localStorage.getItem('chunklab_pending_review_deck'),
        logs:consoleLogs.slice(-20)
      }));
      throw new Error(error.message+'; state='+JSON.stringify(state));
    }
    const reviewMs=Date.now()-reviewStart;
    check('开始复习不补齐整个队列详情',details===1 && await page.evaluate(()=>S.tempTotal===8000 && S.items.every(it=>Array.isArray(it.chunks))));
    check('复习来源ID保留',await page.evaluate(id=>S.items.every(it=>it._statsDeckId===id),deckId));
    await page.evaluate(()=>startDeck(S.deck,0,195));
    await page.waitForFunction(()=>S.tempStart===195 && S.items[0].cid==='perf-195');
    check('跨分片下一组只多取一个分片且顺序正确',details===2 && await page.evaluate(()=>S.items[9].cid==='perf-204'));
    check('长期队列仅保留当前批次的完整详情',await page.evaluate(()=>S.deck.items.filter(it=>Array.isArray(it.chunks)).length===10 && S.deck._reviewIndexItems.every(it=>!it.chunks)));
    await context.setOffline(true);
    await page.evaluate(()=>startDeck(S.deck,0,200));
    await page.waitForFunction(()=>S.tempStart===200 && S.items[0].cid==='perf-200');
    check('已缓存分片在断网后仍能续练',details===2);
    check('393像素练习页无横向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await heap();
    check('流程无页面异常',errors.length===0);
    console.log('[mobile-8000] '+JSON.stringify({passed,fixtureSentences:8000,viewport:'393x852',cpuSlowdown:4,homeMs,statsMs,renderDueMs:Math.round(renderMs),reviewMs,detailRequests:details,detailBytes,indexRequests:indexes,maxSampledHeapMB:Math.round(Math.max(...heapSamples)/1048576)}));
  }finally{
    if(browser) await browser.close();
    if(server){const stopped=new Promise(resolve=>server.once('exit',resolve));server.kill();await stopped;}
    // Only the exact mkdtemp directory created by this test is removed.
    fs.rmSync(temp,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
