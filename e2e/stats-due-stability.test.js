'use strict';

/* 回归：首次同步期间不应把本地旧待复习数短暂展示给用户。 */
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');
const { randomBytes } = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9630, 100);
const BASE = 'http://127.0.0.1:' + PORT;
const USERNAME = 'stats-due-' + randomBytes(5).toString('hex');
const PASSWORD = 'stats-due-isolated-test-password';
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-stats-due-stability-'));
let server = null;
let browser = null;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test', REQUIRE_AUTH:'true', PHONE_AUTH_ENABLED:'false', JWT_SECRET:randomBytes(32).toString('hex'),CHUNKLAB_WRITE_PROTOCOL:'3' }),
      stdio: 'ignore'
    });
    var tries = 0;
    var iv = setInterval(function () {
      if (server.exitCode !== null) { clearInterval(iv); reject(new Error('server exit ' + server.exitCode)); return; }
      var req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (res) {
        res.resume();
        if (res.statusCode === 200) { clearInterval(iv); resolve(); }
      });
      req.on('error', function () {});
      req.setTimeout(600, function () { req.destroy(); });
      if (++tries > 40) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 400);
  });
}

function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) {} server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}
}

async function putRemote(mem, token) {
  async function operation(requestId,type,payload,expectedRev) {
    const response=await fetch(BASE+'/api/operations',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
      body:JSON.stringify({protocol:3,requestId,type,payload,...(expectedRev!==undefined?{expectedRev}:{})})});
    if(!response.ok)throw Error('isolated seed failed: '+response.status+' '+await response.text());
  }
  await operation('stability-deck-create','deck.put',{deck:mem.decks[0]},null);
  await operation('stability-course-enrollment','course.enrollment',{courseId:'user-deck:stability',joined:true});
  for(const key of Object.keys(mem.stats.bySentence)) {
    await operation('stability-answer-'+key.split('#')[1],'learning.answer',{
      eventId:'stability-event-'+key.split('#')[1],deckId:'stability',key,ok:true,mode:'chunkSelection',
      occurredAt:Date.now()-3*86400000
    });
  }
  const snapshotResponse = await fetch(BASE + '/api/data',{headers:{Authorization:'Bearer '+token}});
  if (!snapshotResponse.ok) throw new Error('remote seed verification failed: ' + snapshotResponse.status);
  const snapshot = await snapshotResponse.json();
  if (!snapshot.mem || !snapshot.mem.stats || snapshot.mem.stats.totalAnswered !== mem.stats.totalAnswered) {
    throw new Error('remote seed verification mismatch: ' + JSON.stringify({ expected:mem.stats.totalAnswered, snapshot:snapshot.mem && snapshot.mem.stats }));
  }
}

function makeMem(count) {
  var items = [], bySentence = {};
  function cidFor(text) {
    var hash = 2166136261;
    for (var index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619) >>> 0;
    return hash.toString(16).padStart(8, '0');
  }
  for (var i = 1; i <= 38; i++) {
    var sentence = 'Stability sentence ' + i + '.';
    var cid = cidFor(sentence);
    items.push({ sentence: sentence, en: sentence, cid: cid, chunks: [sentence], hints: [''] });
    if (i <= count) bySentence['stability#' + cid] = {
      deckId: 'stability', sentence: sentence, times: 1, okTimes: 1, wrongTimes: 0,
      streak: 1, maxStreak: 1, lastAt: Date.now() - 2 * 86400000, interval: 1, ease: 2.5,
      dueAt: Date.now() - 86400000
    };
  }
  return {
    version: 2,
    decks: [{ id: 'stability', name: '稳定性测试', items: items }],
    best: {}, mastered: {}, deletedItems: {}, reinforceBook: [],
    stats: { totalRounds: 0, totalAnswered: count, bySentence: bySentence, events: [] },
    settings: { mode: 'choose', sound: false, batchSize: 10 }
  };
}

(async function () {
  try {
    await startServer();
    const registration=await fetch(BASE+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:USERNAME,password:PASSWORD})});
    if(!registration.ok)throw Error('isolated account registration failed: '+registration.status+' '+await registration.text());
    const account=await registration.json();
    await putRemote(makeMem(38),account.token);
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    var page = await browser.newPage();
    const browserErrors=[];
    page.on('pageerror',function(error){browserErrors.push(error.message);});
    page.on('console',function(message){if(message.type()==='error')browserErrors.push(message.text());});
    const legacyWrites=[];
    function track(target){target.on('request',request=>{
      if(request.method()!=='GET'&&['/api/data','/api/import','/api/sync/resolve','/api/sync/batch/resolve'].includes(new URL(request.url()).pathname))
        legacyWrites.push(request.method()+' '+new URL(request.url()).pathname);
    });}
    track(page);
    await page.addInitScript(function (fixture) {
      localStorage.setItem('chunklab_token',fixture.token);
      localStorage.setItem('chunklab_manual','1');
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, String(fixture.userId)]));
      localStorage.setItem('chunklab.v1', JSON.stringify(fixture.localMem));
      window.__reviewCountHistory=[];
      function observeStatsRoot(root){
        function record(){
          var element=root.querySelector('#reviewTabCount');
          if(element&&window.__reviewCountHistory.slice(-1)[0]!==element.textContent)
            window.__reviewCountHistory.push(element.textContent);
        }
        new MutationObserver(record).observe(root,{subtree:true,childList:true,characterData:true});
        record();
      }
      var attachShadow=Element.prototype.attachShadow;
      Element.prototype.attachShadow=function(init){
        var root=attachShadow.call(this,init);
        if(this.id==='statsPageHost')observeStatsRoot(root);
        return root;
      };
      function statsRoot(){var host=document.querySelector('#statsPageHost');return host&&host.shadowRoot||document;}
      window.__statsRoot=statsRoot;
    }, { token:account.token,userId:account.user.id,localMem:makeMem(24) });
    await page.route('**/api/config', async function (route) {
      await new Promise(function (resolve) { setTimeout(resolve, 700); });
      await route.continue();
    });
    await page.route('**/api/data', async function (route) {
      await new Promise(function (resolve) { setTimeout(resolve, 700); });
      await route.continue();
    });
    await page.goto(BASE + '/stats.html', { waitUntil: 'domcontentloaded' });
    /* 探针必须等「同步中的 loading 状态」本身，而不是静态的 #statsCards/#reviewTabCount：
       后两者在 DOMContentLoaded 时就已存在，早于 renderStats() 插入 .stats-loading 的时机，
       若在此间隙读取会得到 {count:'', loading:false} 的假失败（全量跑红、单跑绿）。
       同步被刻意延迟 700ms，故 .stats-loading 一旦出现会稳定驻留，等它是确定性的。 */
    await page.waitForFunction(function () {
      var root=window.__statsRoot();
      return root.querySelector('#reviewTabCount') && root.querySelector('.stats-loading');
    },null,{timeout:10000}).catch(async function(error){
      var state=await page.evaluate(function(){var host=document.querySelector('#statsPageHost');var root=window.__statsRoot();return {url:location.href,host:!!host,shadow:!!(host&&host.shadowRoot),rootText:root.body&&root.body.innerText,rootHtml:root.innerHTML&&root.innerHTML.slice(0,1800),statsRoot:!!window.__statsRoot,statsPage:!!window.StatsPage,booted:window._mainBooted,auth:window.AccountStorage&&window.AccountStorage.owner,stats:root.querySelector('#reviewTabCount')&&root.querySelector('#reviewTabCount').textContent};});
      throw new Error(error.message+'; state='+JSON.stringify(state)+'; browserErrors='+JSON.stringify(browserErrors));
    });
    var first = await page.evaluate(function () {
      var root=window.__statsRoot();
      return { count: root.querySelector('#reviewTabCount').textContent, loading: !!root.querySelector('.stats-loading') };
    });
    await page.waitForFunction(function () {
      var count=window.__statsRoot().querySelector('#reviewTabCount');
      return !!count && count.textContent === '(38)';
    }, null, { timeout: 10000 }).catch(async function (error) {
      const state = await page.evaluate(function () {
        var root=window.__statsRoot();
        return { count:root.querySelector('#reviewTabCount') && root.querySelector('#reviewTabCount').textContent,
          status:root.querySelector('.stats-sync-status') && root.querySelector('.stats-sync-status').textContent,
          loading:!!root.querySelector('.stats-loading'), owner:window.AccountStorage && AccountStorage.owner,
          protocol:window.CL && CL.getCloudConfig && CL.getCloudConfig(), cloudOn:CL.isCloudOn && CL.isCloudOn(),
          dirty:CL.isDirty && CL.isDirty(), conflict:CL.getSyncConflict && CL.getSyncConflict(),
          decks:mem.decks && mem.decks.map(function (deck) { return {id:deck.id,count:deck.items && deck.items.length}; }),
          stats:mem.stats && {total:mem.stats.totalAnswered,keys:Object.keys(mem.stats.bySentence || {}).length},
          stat:mem.stats && Object.values(mem.stats.bySentence || {})[0],
          statKey:mem.stats && Object.keys(mem.stats.bySentence || {})[0],
          firstItem:mem.decks && mem.decks[0] && mem.decks[0].items && mem.decks[0].items[0],
          now:Date.now(),
          stability:typeof allDecks === 'function' ? (function(){var deck=allDecks().find(function(item){return item.id==='stability';});return deck&&{count:deck.items.length,cid:deck.items[0]&&deck.items[0].cid,firstSentence:deck.items[0]&&deck.items[0].sentence};})() : null,
          due:typeof dueSentences === 'function' ? dueSentences().length : null };
      });
      throw new Error(error.message + '；同步状态=' + JSON.stringify(state));
    });
    var finalCount = await page.evaluate(function(){return window.__statsRoot().querySelector('#reviewTabCount').textContent;});
    if (first.count !== '' || !first.loading || finalCount !== '(38)') {
      throw new Error('首次同步状态不稳定：' + JSON.stringify({ first: first, final: finalCount }));
    }
    var slow = await browser.newPage();
    track(slow);
    await slow.addInitScript(function (fixture) {
      localStorage.setItem('chunklab_token',fixture.token);
      localStorage.setItem('chunklab_manual','1');
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, String(fixture.userId)]));
      localStorage.setItem('chunklab.v1', JSON.stringify(fixture.localMem));
      window.__reviewCountHistory=[];
      function observeStatsRoot(root){
        function record(){
          var element=root.querySelector('#reviewTabCount');
          if(element&&window.__reviewCountHistory.slice(-1)[0]!==element.textContent)
            window.__reviewCountHistory.push(element.textContent);
        }
        new MutationObserver(record).observe(root,{subtree:true,childList:true,characterData:true});
        record();
      }
      var attachShadow=Element.prototype.attachShadow;
      Element.prototype.attachShadow=function(init){
        var root=attachShadow.call(this,init);
        if(this.id==='statsPageHost')observeStatsRoot(root);
        return root;
      };
      function statsRoot(){var host=document.querySelector('#statsPageHost');return host&&host.shadowRoot||document;}
      window.__statsRoot=statsRoot;
    }, { token:account.token,userId:account.user.id,localMem:makeMem(24) });
    let release;
    const gate=new Promise(resolve=>{release=resolve;});
    await slow.route('**/api/config',async route=>{await gate;await route.continue();});
    await slow.goto(BASE+'/stats.html',{waitUntil:'domcontentloaded'});
    await slow.waitForFunction(()=>window.__statsRoot().querySelector('.stats-loading'));
    const pending=await slow.evaluate(()=>({count:window.__statsRoot().querySelector('#reviewTabCount').textContent,
      loading:!!window.__statsRoot().querySelector('.stats-loading'),raw:localStorage.getItem('chunklab.v1')}));
    if(pending.count==='(24)'||!pending.loading)throw Error('unconfirmed local stats exposed: '+JSON.stringify(pending));
    if(!pending.raw||JSON.parse(pending.raw).stats.totalAnswered!==24)throw Error('legacy sample was modified');
    release();
    await slow.waitForFunction(()=>window.__statsRoot().querySelector('#reviewTabCount').textContent==='(38)',null,{timeout:15000});
    const state=await slow.evaluate(()=>({ready:CL.serverPersistenceReady(),loading:!!document.querySelector('.stats-loading')}));
    if(!state.ready||state.loading)throw Error('confirmed stats not ready: '+JSON.stringify(state));
    for(const target of [page,slow]) {
      const history=await target.evaluate(()=>window.__reviewCountHistory);
      if(history.includes('(24)'))throw Error('old local count flashed during startup: '+JSON.stringify(history));
    }
    if(legacyWrites.length)throw Error('statistics startup used retired writes: '+JSON.stringify(legacyWrites));
    await slow.close();
    console.log('[stats-due-stability e2e] passed');
  } catch (err) {
    console.error('[stats-due-stability e2e] failed:', err && err.message || err);
    process.exitCode = 1;
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} browser = null; }
    stopServer();
  }
})();
