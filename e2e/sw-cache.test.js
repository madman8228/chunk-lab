/**
 * sw-cache.test.js · SW 预缓存策略的端到端验证（真浏览器）
 *
 * 为什么必须真浏览器：sw-policy.test.js 只能证明 sw.js 的「文本契约」还在，
 * 证明不了 install 在真实 ServiceWorker 容器里跑得通、cache API 真的写进去了、离线真的还能打开。
 *
 * 背景（2026-09-10 扩容 8000 句时发现的真 P0）：
 *   内置扩展题库改为 manifest + hash 分片，不能再把整包题库放进 install 的预缓存清单。
 *   addAll 全有全无 → 移动网络下极易整体失败 → SW 一个都装不上、离线能力全丢。
 *
 * 覆盖：
 *   1. 首次在线访问：SW 安装成功，小型 manifest 和兼容基础资源进了 cache
 *   2. 在线准备后离线 → 核心模块及已缓存分片可读，不能绕过平台授权。
 *      为什么是这个场景：实测发现 Cache API 的匹配对「请求形状」敏感 ——
 *      install 的 addAll() 存储条目时请求不带 Origin，而 <script type="module"> 带 Origin（CORS 请求）
 *      → .mjs 永远取不到预缓存 → 落到 HTML 兜底 → FormatTools 缺失 → 启动段 TypeError。
 *      只在「在线访问过第二次」之后才会被运行时的 cache.put 修正，所以必须锁住「只访问一次」这个前提。
 *   3. ★ 回归检测：动态内容分片不可达时 SW 仍能安装成功
 *      （内容分片属于按需资源，不得拖垮安装）
 *
 * 自带服务器（spawn index.js），不依赖外部端口。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9500, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-swcache-'));
const BASE = 'http://127.0.0.1:' + PORT;
let server = null;
let browser = null;
const FIXTURE_COURSE = 'fixture-sw', FIXTURE_DECK = 'fixture-sw-deck';

function prepareCourse() {
  const dir = path.join(TMP_DB, 'membership-content');
  fs.mkdirSync(dir, { recursive: true });
  const items = ['Hello there.', 'See you later.', 'Good morning.', 'Thank you.'].map((sentence, index) => ({
    cid: 'sw-item-' + index, sentence, translation: '合成测试句 ' + index, chunks: sentence.split(' ')
  }));
  const learning = { template: 'sentence-practice', version: 1, modes: ['typing'], defaultMode: 'typing' };
  const content = { items, learning, authoring: { template: 'sentence-practice', templateVersion: 1, contentForm: 'article', learning } };
  const identity = { deckId: FIXTURE_DECK, generationScope: 'course:' + FIXTURE_COURSE, resumeIdentity: FIXTURE_DECK };
  const { StaticFragmentBuilder } = require('../server/services/membership/static-fragment-builder');
  const built = new StaticFragmentBuilder().build({ courseId: FIXTURE_COURSE, unitId: 'unit', contentType: 'sentence',
    content, itemIds: items.map(item => item.cid), recordIdentity: identity });
  fs.writeFileSync(path.join(dir, 'fixture.json'), JSON.stringify(content), { flag: 'wx' });
  for (const file of built.files) fs.writeFileSync(path.join(dir, file.name), file.bytes, { flag: 'wx' });
  fs.writeFileSync(path.join(dir, 'registry.json'), JSON.stringify({ schemaVersion: 2, courses: [{
    courseId: FIXTURE_COURSE, title: '隔离缓存验证课程', contentType: 'sentence', defaultAccess: 'free', sourcePaths: [], legacyDeckIds: [],
    units: [{ unitId: 'unit', file: 'fixture.json', contentRef: { type: 'sentence-deck', id: FIXTURE_COURSE },
      itemIds: items.map(item => item.cid), assets: [], fragments: built.fragments, contentVersion: built.contentVersion, recordIdentity: identity }]
  }] }), { flag: 'wx' });
}

function startServer() {
  prepareCourse();
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, CHUNKLAB_APP_ROOT: ROOT, PORT: String(PORT), HOST: '127.0.0.1',
        NODE_ENV: 'test', REQUIRE_AUTH: 'true', PHONE_AUTH_ENABLED: 'false', CHUNKLAB_WRITE_PROTOCOL: '3',
        JWT_SECRET: crypto.randomBytes(40).toString('hex'), ADMIN_JWT_SECRET: crypto.randomBytes(40).toString('hex'),
        MEMBERSHIP_CONTENT_GRANT_KEY: crypto.randomBytes(32).toString('base64') }),
      windowsHide: true,
      stdio: 'ignore'
    });
    let tries = 0;
    const iv = setInterval(function () {
      if (server.exitCode !== null) { clearInterval(iv); reject(new Error('server exit ' + server.exitCode)); return; }
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (r) {
        r.resume();
        if (r.statusCode === 200) { clearInterval(iv); resolve(); }
      });
      req.on('error', function () { /* 重试 */ });
      req.setTimeout(600, function () { req.destroy(); });
      if (++tries > 40) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 400);
  });
}
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) { /* noop */ } server = null; }
  if (!path.resolve(TMP_DB).startsWith(path.resolve(os.tmpdir()) + path.sep)) throw Error('Unsafe temporary test path');
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
}

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}

/** 等 SW 从 install 走到 activate（超时说明安装失败 —— 旧 addAll 设计下的典型表现） */
async function waitSwActive(page, timeout) {
  return page.evaluate(function (ms) {
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () { if (!done) resolve(null); }, ms);
      navigator.serviceWorker.ready.then(function (reg) {
        done = true; clearTimeout(timer);
        resolve(reg && reg.active ? 'active' : null);
      }).catch(function () { done = true; clearTimeout(timer); resolve(null); });
    });
  }, timeout);
}

/** 读当前 chunklab-* cache 里已缓存的 URL 列表 */
function cacheUrls(page) {
  return page.evaluate(function () {
    return caches.keys().then(function (names) {
      var mine = names.filter(function (n) { return n.indexOf('chunklab-') === 0; });
      if (!mine.length) return { caches: names, urls: [] };
      return caches.open(mine[0]).then(function (c) {
        return c.keys().then(function (reqs) {
          return {
            caches: mine,
            urls: reqs.map(function (r) { return new URL(r.url).pathname; })
          };
        });
      });
    });
  });
}

(async function () {
  await startServer();
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });

  /* ---------- 1. 首次在线访问 ---------- */
  console.log('【1. 首次在线访问：SW 安装 + manifest 入缓存】');
  const ctx = await browser.newContext();
  const registration = await fetch(BASE + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'sw-synthetic', password: 'SyntheticSw2026!' }) });
  if (!registration.ok) throw Error('Synthetic signup failed: ' + registration.status);
  const account = await registration.json();
  await ctx.addInitScript(token => localStorage.setItem('chunklab_token', token), account.token);
  const page = await ctx.newPage();
  const errs = [];
  const requests = [];
  const requestRows = new WeakMap(), responseReads = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      const row={ method:request.method(), path:url.pathname, search:url.search, bodyBytes:Buffer.byteLength(request.postData()||'') };
      if (url.pathname === '/api/operations') row.operationType=JSON.parse(request.postData()||'{}').type;
      requests.push(row);requestRows.set(request,row);
    }
  });
  page.on('response', response => {
    const row=requestRows.get(response.request());if(!row)return;
    responseReads.push(response.body().then(body=>{
      row.responseBytes=body.length;
      if(row.path==='/api/operations'){
        const receipt=JSON.parse(body.toString('utf8'));
        row.deltaBytes=receipt.changes?Buffer.byteLength(JSON.stringify(receipt.changes)):0;
        row.operationStatBytes=receipt.operation?.stat?Buffer.byteLength(JSON.stringify(receipt.operation.stat)):0;
      }
    }).catch(()=>{}));
  });
  page.on('pageerror', function (e) { errs.push(e.message); });
  page.on('console', function (message) { if (message.type() === 'error') console.log('  [console.error] ' + message.text()); });
  // Seed only synthetic cache data in this fresh browser context before SW activation.
  await page.goto(BASE + '/api/health');
  await page.evaluate(async function () {
    const images = await caches.open('course-images-v1-' + 'a'.repeat(64));
    await images.put('/synthetic-preserved-image', new Response('synthetic', { headers: { 'Content-Type': 'image/webp' } }));
    const old = await caches.open('chunklab-synthetic-old');
    await old.put('/assets/catalog/synthetic-upgrade.webp', new Response('synthetic cover', { headers: { 'Content-Type': 'image/webp' } }));
  });
  await page.goto(BASE + '/main.html', { waitUntil: 'load' });
  const state = await waitSwActive(page, 30000);
  let registrationState = null;
  if (state !== 'active') registrationState = await page.evaluate(async function () {
    let registerAttempt = null;
    if ('serviceWorker' in navigator) registerAttempt = await navigator.serviceWorker.register('/sw.js').then(function (r) {
      return { ok:true, scope:r.scope, active:r.active && r.active.state, installing:r.installing && r.installing.state, waiting:r.waiting && r.waiting.state };
    }).catch(function (e) { return { ok:false, error:e.name + ': ' + e.message }; });
    const registrations = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistrations() : [];
    return { supported:'serviceWorker' in navigator, controller:!!navigator.serviceWorker?.controller,
      registrations:registrations.map(function (r) { return { scope:r.scope, active:r.active && r.active.state, installing:r.installing && r.installing.state, waiting:r.waiting && r.waiting.state }; }),
      caches:await caches.keys(), swFetch:(await fetch('/sw.js')).status, registerAttempt };
  }).catch(function (error) { return { diagnosticError:error.message }; });
  check('SW 安装并激活成功', state === 'active', JSON.stringify({ state, registrationState }));
  check('SW 激活保留独立图片缓存', await page.evaluate(async function () {
    const images = await caches.open('course-images-v1-' + 'a'.repeat(64));
    return (await images.match('/synthetic-preserved-image'))?.text().then(text => text === 'synthetic') || false;
  }));

  /* install 的 waitUntil 只覆盖原子学习资源；active 时应已写完。 */
  let urls = [];
  for (let i = 0; i < 20; i++) {
    const r = await cacheUrls(page);
    urls = r.urls;
    if (urls.indexOf('/content/manifest.json') >= 0 && urls.indexOf('/main.html') >= 0) break;
    await page.waitForTimeout(400);
  }
  check('硬清单已缓存（/main.html、/core.js、manifest）',
    urls.indexOf('/main.html') >= 0 && urls.indexOf('/core.js') >= 0 && urls.indexOf('/content/manifest.json') >= 0,
    urls.join(','));
  check('整包题库未进入安装预缓存',
    urls.indexOf('/oral-book.js') < 0 && urls.indexOf('/freq-idioms.js') < 0,
    urls.filter(function (u) { return /oral-book|freq-idioms/.test(u); }).join(','));
  check('后台和大 PNG 不再无条件进入安装缓存',
    ['/admin.html', '/content-studio.html', '/assets/jqka-learning-garden-v1.png',
      '/assets/jqka-learning-garden-body-v1.png'].every(function (url) { return !urls.includes(url); }));
  check('页面无 JS 错误', errs.length === 0, errs.slice(0, 3).join(' | '));
  const optionalAssets = ['/landing/action-game-view.js', '/landing/wordbook-study.js', '/assets/brand/icon-512-v1.png'];
  check('独立练习资源未随首页安装下载', optionalAssets.every(url => !urls.includes(url)));
  const optionalSizes = await page.evaluate(async paths => Promise.all(paths.map(async path => {
    const response = await fetch(path); if (!response.ok) throw new Error('optional asset unavailable: ' + path);
    return (await response.arrayBuffer()).byteLength;
  })), optionalAssets);
  await page.waitForFunction(async paths => {
    const names = (await caches.keys()).filter(name => name.startsWith('chunklab-'));
    return names.length > 0 && (await Promise.all(paths.map(async path => {
      const cache = await caches.open(names[0]); return !!await cache.match(location.origin + path);
    }))).every(Boolean);
  }, optionalAssets);
  check('按需访问后写入当前版本缓存', optionalSizes.every(size => size > 0));
  const coverAssets = ['/assets/covers/oral-3000.webp', '/assets/catalog/default-cloud-v1.svg'];
  const coverSizes = await page.evaluate(async paths => Promise.all(paths.map(async path => {
    const response = await fetch(path); if (!response.ok) throw Error('cover unavailable');
    return (await response.arrayBuffer()).byteLength;
  })), coverAssets);

  /* Legacy shard caching and authorized native platform learning are separate
     contracts. Use a prepared synthetic private course for the real UI flow. */
  const ONLINE_DECK = 'oral-6-31';
  // Separately exercise the legacy shard cache; it is not a platform authorization.
  await page.evaluate(async deckId => { await ContentRepo.ready; await ContentRepo.ensureDeck(deckId); }, ONLINE_DECK);
  await page.goto(BASE + '/main.html?protectedCourse=' + FIXTURE_COURSE + '&unit=unit', { waitUntil: 'load' });
  await page.locator('.course-access-panel').getByRole('button', { name: /^(开始学习|继续学习)$/ }).click({ timeout: 10000 }).catch(async error => {
    const cause = await page.evaluate(() => {
      const error = window.__nativeCourseSession && window.__nativeCourseSession.lastError;
      return error && { code: error.code, message: error.message };
    });
    throw new Error(error.message + '\nCourse entry: ' + await page.locator('#pagePractice').innerText() + '\nCause: ' + JSON.stringify(cause));
  });
  /* startDeck may wait for the lazily loaded practice modules or a content
     batch; sample its state only after the real entry has rendered a deck. */
  await page.waitForFunction(function (deckId) {
    return window.S && S.deck && S.deck.id === deckId && S.items && S.items.length > 0;
  }, FIXTURE_DECK, { timeout: 30000 });
  const online = await page.evaluate(function () {
    return {
      deckId: window.S && S.deck ? S.deck.id : null,
      items: window.S && S.items ? S.items.length : 0
    };
  });
  let contentUrls = [];
  for (let i = 0; i < 30; i++) {
    contentUrls = (await cacheUrls(page)).urls;
    if (contentUrls.some(function (u) { return u.indexOf('/content/oral-6-31/') === 0; })) break;
    await page.waitForTimeout(400);
  }
  check('显式请求后才缓存日常题库分片',
    contentUrls.some(function (u) { return u.indexOf('/content/oral-6-31/') === 0; }),
    contentUrls.filter(function (u) { return u.indexOf('/content/') === 0; }).join(','));
  check('在线授权后进入合成课程练习',
    online.deckId === FIXTURE_DECK && online.items > 0, JSON.stringify(online));
  const catalogStart = requests.length;
  await page.evaluate(() => Promise.all([
    ContentRepo.loadProtectedCatalog(), ContentRepo.loadProtectedCatalog(),
    window.__nativeCourseSession.client.catalog(), ChunkAPI.getCourseCatalog()
  ]));
  check('课程仓库与学习入口四次并发读取只请求一次目录',
    requests.slice(catalogStart).filter(row => row.path === '/api/course-content/catalog').length === 1);
  const answersStart = requests.length;
  for (let question = 0; question < 3; question++) {
    const chunks = await page.evaluate(() => cur().chunks.slice());
    for (let i = 0; i < chunks.length; i++) {
      const input = page.locator('#track .chunk-input').nth(i); await input.fill(chunks[i]); await input.press('Enter');
      await page.waitForFunction(index => S.status[index] === 'ok', i);
    }
    await page.waitForFunction(async key => (await ServerCache.read())?.snapshot.mem.stats.bySentence[key]?.times === 1,
      FIXTURE_DECK + '#sw-item-' + question);
    if (question < 2) {
      await page.locator('#btnNext').click();
      await page.waitForFunction(index => S.idx === index, question + 1);
    }
  }
  check('连续三题均由服务端确认保存', true);
  // Include the debounced resume tail, not a partially completed response window.
  await page.waitForTimeout(350);
  await page.waitForFunction(async () => (await ServerStore.pending()).length === 0);
  const answerRequests = requests.slice(answersStart);
  await Promise.all(responseReads);
  const snapshots = answerRequests.filter(row => row.method === 'GET' && row.path === '/api/data');
  check('连续答题直接应用回执增量，不再追加确认读取', snapshots.length === 0);
  check('连续答题不附带重拉课程目录或隐藏统计', !answerRequests.some(row => row.path === '/api/course-content/catalog' || row.path.startsWith('/api/learning-archive/')));
  console.log('  [request budget] three answers: ' + JSON.stringify({ snapshotReads:snapshots.length,
    operationPosts:answerRequests.filter(row => row.method === 'POST' && row.path === '/api/operations').length,
    operationTypes:answerRequests.filter(row=>row.path==='/api/operations').map(row=>row.operationType),
    catalogReads:answerRequests.filter(row => row.path === '/api/course-content/catalog').length,
    operationUploadBytes:answerRequests.filter(row=>row.path==='/api/operations').reduce((n,row)=>n+row.bodyBytes,0),
    operationDecodedResponseBytes:answerRequests.filter(row=>row.path==='/api/operations').reduce((n,row)=>n+(row.responseBytes||0),0),
    avoidedDuplicateDeltaBytes:answerRequests.filter(row=>row.path==='/api/operations').reduce((n,row)=>n+(row.deltaBytes||0),0),
    remainingOperationStatBytes:answerRequests.reduce((n,row)=>n+(row.operationStatBytes||0),0) }));
  const returnStart = requests.length;
  await page.locator('#btnExitPractice').click();
  await page.locator('#pageHome:not(.hidden)').waitFor();
  await page.waitForFunction(() => !window.__chunklabServerHomeProjectionPending);
  const returnRequests = requests.slice(returnStart);
  check('返回首页复用确认记录，不重拉全量快照或目录', !returnRequests.some(row =>
    row.path === '/api/course-content/catalog' || row.path === '/api/data' && !new URLSearchParams(row.search).has('since')));

  /* ---------- 2. Offline content is not offline platform authorization. ---------- */
  console.log('');
  console.log('【2. 离线读取缓存与平台授权隔离，恢复联网保留记录】');
  await ctx.setOffline(true);
  const offlineOptionalSizes = await page.evaluate(async paths => Promise.all(paths.map(async path => {
    const response = await fetch(path); return (await response.arrayBuffer()).byteLength;
  })), optionalAssets);
  check('按需资源断网后复用缓存且字节不变', JSON.stringify(offlineOptionalSizes) === JSON.stringify(optionalSizes));
  const offlineCoverSizes = await page.evaluate(async paths => Promise.all(paths.map(async path => {
    const response = await fetch(path); if (!response.ok) throw Error('offline cover unavailable');
    return (await response.arrayBuffer()).byteLength;
  })), coverAssets);
  check('封面与默认封面断网后仍可读取', JSON.stringify(coverSizes) === JSON.stringify(offlineCoverSizes));
  check('升级前缓存的封面已保留且离线可读', await page.evaluate(async () =>
    (await fetch('/assets/catalog/synthetic-upgrade.webp')).text().then(text => text === 'synthetic cover')));
  const page2 = await ctx.newPage();
  const errs2 = [];
  page2.on('pageerror', function (e) { errs2.push(e.message); });
  await page2.goto(BASE + '/main.html?protectedCourse=' + FIXTURE_COURSE + '&unit=unit', { waitUntil: 'load' });
  await page2.waitForFunction(() => window.ContentRepo && window.ensurePracticeReady);
  const off = await page2.evaluate(async deckId => {
    await ContentRepo.ready;
    await ensurePracticeReady();
    const cached = await ContentRepo.ensureDeck(deckId);
    return { coreReady: !!(window.CL && typeof CL.ensureCloud === 'function'),
      engine: typeof window.ChunkEngine, format: typeof window.FormatTools,
      cachedDeckId: cached.id, cachedItems: cached.items.length,
      authorized: !!window.__nativeCourseSession?.controller?.current?.sessionId };
  }, ONLINE_DECK);
  check('首次安装后离线仍能加载核心脚本', off.coreReady === true, JSON.stringify(off));
  check('离线启动后引擎模块已就绪（ChunkEngine / FormatTools）',
    off.engine === 'object' && off.format === 'object',
    'ChunkEngine=' + off.engine + ' FormatTools=' + off.format);
  check('离线可读取已缓存内容分片', off.cachedDeckId === ONLINE_DECK && off.cachedItems > 0, JSON.stringify(off));
  check('缓存内容不能自行授权新的平台学习会话', !off.authorized);
  check('离线无 JS 错误（尤其不得出现 MIME/esc 类级联报错）', errs2.length === 0, errs2.slice(0, 3).join(' | '));
  await ctx.setOffline(false);
  await page2.goto(BASE + '/main.html?protectedCourse=' + FIXTURE_COURSE + '&unit=unit');
  await page2.locator('.course-access-panel').getByRole('button', { name: /^(开始学习|继续学习)$/ }).click();
  await page2.locator('#stage:not(.hidden) .chunk-input').first().waitFor();
  check('恢复联网后可重新授权，原答题记录保留', await page2.evaluate(async key =>
    (await ServerCache.read())?.snapshot.mem.stats.bySentence[key]?.times === 1, FIXTURE_DECK + '#sw-item-0'));
  for (const status of [401, 403]) {
    const deniedPage = await ctx.newPage();
    await deniedPage.route('**/api/content/shards', route => route.fulfill({
      status, contentType:'application/json', body:JSON.stringify({error:'isolated denied fixture'})
    }));
    await deniedPage.goto(BASE+'/main.html', {waitUntil:'load'});
    await deniedPage.waitForFunction(()=>window.ContentRepo);
    const denied = await deniedPage.evaluate(async function(deckId){
      await ContentRepo.ready;
      try { await ContentRepo.ensureDeck(deckId); return 'unexpected success'; }
      catch(error){ return error.message; }
    }, ONLINE_DECK);
    check('HTTP '+status+' 不借用既有离线元数据绕过拒绝', denied.includes('HTTP '+status), denied);
    await deniedPage.close();
  }
  // Exercise the actual repository against the same IndexedDB cache, without
  // application boot or a real account. Only synthetic scope/version differ.
  for (const scenario of ['other-owner', 'other-version', 'corrupt-cache']) {
    const scopedPage = await ctx.newPage();
    await scopedPage.route('**/api/content/shards', route=>route.abort('failed'));
    await scopedPage.goto(BASE+'/local-recovery-health.html', {waitUntil:'load'});
    const originalOwner = await page.evaluate(()=>AccountStorage.owner);
    await scopedPage.evaluate(({scenario,originalOwner})=>{
      window.AccountStorage={owner:scenario==='other-owner'?'synthetic-other-owner':originalOwner,assertCurrent(){}};
      window.ChunkAPI={getBase:()=>'',getToken:()=>null};
      if(scenario==='other-version'){
        const originalFetch=window.fetch;
        window.fetch=async function(input,options){
          const response=await originalFetch(input,options);
          if(new URL(String(input),location.href).pathname==='/content/manifest.json'){
            const data=await response.json();data.contentVersion='synthetic-unseen-version';
            return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
          }
          return response;
        };
      }
    },{scenario,originalOwner});
    if (scenario === 'corrupt-cache') {
      // This context and its IndexedDB were allocated by this isolated test.
      // Corrupt only its authenticated metadata, not any course shard.
      const changed = await scopedPage.evaluate(owner => new Promise((resolve,reject)=>{
        const request=indexedDB.open('chunklab-content-v1',1);
        request.onerror=()=>reject(request.error);
        request.onsuccess=()=>{
          const db=request.result;
          const tx=db.transaction('shards','readwrite');
          let count=0;
          const cursor=tx.objectStore('shards').openCursor();
          cursor.onsuccess=()=>{
            const row=cursor.result;if(!row)return;
            const value=row.value;
            if(value.kind==='authenticated-shard-map' && value.owner===owner){
              value.data={decks:null};row.update(value);count++;
            }
            row.continue();
          };
          tx.oncomplete=()=>{db.close();resolve(count);};
          tx.onabort=()=>{db.close();reject(tx.error);};
        };
      }),originalOwner);
      check('损坏缓存夹具确实命中已授权元数据',changed>0,String(changed));
    }
    await scopedPage.addScriptTag({url:BASE+'/js/content-repository.js'});
    const blocked=await scopedPage.evaluate(async deckId=>{
      await ContentRepo.ready;
      try{await ContentRepo.ensureDeck(deckId);return false;}catch(_){return true;}
    },ONLINE_DECK);
    check('离线元数据隔离：'+scenario,blocked);
    await scopedPage.close();
  }
  await ctx.close();

  /* ---------- 3. 动态内容分片不可达时 SW 仍应装上（核心回归检测） ---------- */
  console.log('');
  console.log('【3. 回归检测：动态内容分片不可达 → SW 仍必须安装成功】');
  const ctx2 = await browser.newContext();
  await ctx2.route('**/content/builtin-freq-idioms/**', function (r) { r.abort('failed'); });
  await ctx2.route('**/landing/action-game-view.js', r => r.abort('failed'));
  await ctx2.route('**/landing/wordbook-study.js', r => r.abort('failed'));
  await ctx2.route('**/assets/brand/icon-512-v1.png', r => r.abort('failed'));
  const page3 = await ctx2.newPage();
  await page3.goto(BASE + '/main.html', { waitUntil: 'load' }).catch(function () { /* 缺题库不影响本项断言 */ });
  const state2 = await waitSwActive(page3, 30000);
  check('动态内容分片失败时 SW 仍激活', state2 === 'active', String(state2));
  const urls2 = (await cacheUrls(page3)).urls;
  check('硬清单照常缓存（安装没被拖垮）', urls2.indexOf('/main.html') >= 0 && urls2.indexOf('/core.js') >= 0, urls2.join(','));
  check('独立练习资源不可达也不拖垮安装', optionalAssets.every(url => !urls2.includes(url)));
  check('失败的动态分片确实没被缓存（如实反映失败，不做假成功）',
    !urls2.some(function (u) { return u.indexOf('/content/builtin-freq-idioms/') === 0; }), urls2.join(','));
  await ctx2.close();

  await browser.close();
  stopServer();
  console.log('');
  console.log(failed === 0 ? '通过 ' + passed + ' / 0 失败' : '通过 ' + passed + ' / ' + failed + ' 失败');
  process.exit(failed === 0 ? 0 : 1);
})().catch(async function (e) {
  console.error(e);
  if (browser) await browser.close().catch(() => {});
  stopServer();
  process.exit(1);
});
