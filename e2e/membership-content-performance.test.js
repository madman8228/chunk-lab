'use strict';
// Isolated fixtures only. Run before and after the gateway cutover on the same machine.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
async function main() {
  const sampleCount=Number(process.env.CHUNKLAB_PERF_SAMPLES||10);
  const downloadBps=Number(process.env.CHUNKLAB_PERF_DOWNLOAD_BPS||1600000);
  assert.ok(Number.isInteger(sampleCount)&&sampleCount>=2&&sampleCount<=10);
  assert.ok(Number.isFinite(downloadBps)&&downloadBps>0);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-content-perf-'));
  const data = path.join(temp, 'data'), privateRoot = path.join(data, 'membership-content');
  fs.mkdirSync(privateRoot, { recursive: true });
  const items = Array.from({ length: 30 }, (_, i) => ({ cid: 'perf-' + i, sentence: 'Hello there.', translation: '你好。', chunks: ['Hello', 'there.'], hints: ['greeting'] }));
  fs.writeFileSync(path.join(privateRoot, 'content.json'), JSON.stringify({ items, learning: { template: 'sentence-practice', version: 1, modes: ['typing', 'chunkSelection'], defaultMode: 'typing' } }));
  fs.writeFileSync(path.join(privateRoot, 'registry.json'), JSON.stringify({ schemaVersion: 1, courses: [{ courseId: 'performance', title: 'Isolated performance fixture', contentType: 'sentence', defaultAccess: 'free', sourcePaths: [], legacyDeckIds: [], units: [{ unitId: 'unit', contentRef: { type: 'sentence-deck', id: 'performance' }, file: 'content.json', itemIds: items.map(item => item.cid), assets: [] }] }] }));
  const manifest = JSON.parse(fs.readFileSync(path.join(privateRoot, 'registry.json')));
  const unit = manifest.courses[0].units[0];
  const built = new (require('../server/services/membership/static-fragment-builder').StaticFragmentBuilder)().build({ courseId: 'performance', unitId: 'unit', contentType: 'sentence',
    content: { items, learning: { modes: ['typing', 'chunkSelection'], defaultMode: 'typing' }, authoring: { template: 'sentence-practice', templateVersion: 1, contentForm: 'article', learning: { modes: ['typing', 'chunkSelection'], defaultMode: 'typing' } } },
    itemIds: unit.itemIds, recordIdentity: { deckId: 'performance', generationScope: 'course:performance', resumeIdentity: 'performance' } });
  for (const file of built.files) fs.writeFileSync(path.join(privateRoot, file.name), file.bytes, { flag: 'wx' });
  Object.assign(unit, { fragments: built.fragments, recordIdentity: built.recordIdentity, contentVersion: built.contentVersion }); manifest.schemaVersion = 2;
  fs.writeFileSync(path.join(privateRoot, 'registry.json'), JSON.stringify(manifest));
  const probe = net.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const base = 'http://127.0.0.1:' + port;
  let logs = '', browser;
  const child = spawn(process.execPath, [path.join(root, 'server/index.js')], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CHUNKLAB_DATA_DIR: data, CHUNKLAB_APP_ROOT: root, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'test', TRUST_PROXY: 'true', REQUIRE_AUTH: 'true', PHONE_AUTH_ENABLED: 'false', CHUNKLAB_WRITE_PROTOCOL: '3', JWT_SECRET: crypto.randomBytes(40).toString('hex'), ADMIN_JWT_SECRET: crypto.randomBytes(40).toString('hex'), ADMIN_PASSWORD: 'SyntheticPerf2026!', MEMBERSHIP_CONTENT_GRANT_KEY: crypto.randomBytes(32).toString('base64') } });
  child.stdout.on('data', b => { logs += b; }); child.stderr.on('data', b => { logs += b; });
  try {
    const deadline = Date.now() + 30000;
    while (!logs.includes('listening on http://127.0.0.1:' + port)) {
      if (child.exitCode !== null || Date.now() > deadline) throw Error(logs.slice(-3000));
      await delay(50);
    }
    const response = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'perf-isolated', password: 'SyntheticPerf2026!' }) });
    assert.equal(response.status, 200); const { token } = await response.json();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const results = [];
    for (const constrained of [false, true]) {
      for (const cold of [true, false]) {
        let context;
        const samples = [];
        for (let i = 0; i < sampleCount+(cold?0:1); i++) {
          if (!context || cold) {
            if (context) await context.close();
            context = await browser.newContext({ serviceWorkers: 'block' });
          }
          const page = await context.newPage();
          // Separate synthetic proxy IPs allocate fresh fixture accounts without changing signup policy.
          const accountResponse = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.' + (1 + Number(constrained) * 20 + Number(cold) * 10 + i) },
            body: JSON.stringify({ username: 'perf-' + Number(constrained) + '-' + Number(cold) + '-' + i, password: 'SyntheticPerf2026!' }) });
          assert.equal(accountResponse.status, 200); const account = await accountResponse.json();
          await page.addInitScript(value => localStorage.setItem('chunklab_token', value), account.token);
          const cdp = await context.newCDPSession(page);
          await cdp.send('Network.enable');
          if (constrained) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: downloadBps / 8, uploadThroughput: 750000 / 8 });
          let bytes = 0, requests = 0, contentRequests = 0;
          const transfers=new Map(),groups={};
          cdp.on('Network.requestWillBeSent',event=>{
            if(!event.request.url.startsWith(base+'/'))return;
            const pathname=new URL(event.request.url).pathname;
            const group=/^\/api\/(learning-sessions|course-content|course-fragments|course-assets)/.test(pathname)?'course-api':
              pathname.startsWith('/api/')?'other-api':/\.(m?js)$/.test(pathname)?'scripts':/\.css$/.test(pathname)?'styles':
                /\.(png|webp|svg|ico|jpe?g)$/.test(pathname)?'images':pathname.endsWith('.html')?'html':'other';
            if(!groups[group])groups[group]={requests:0,completed:0,encodedBytes:0,cacheResponses:0};
            groups[group].requests++;transfers.set(event.requestId,{group,cached:false});
          });
          cdp.on('Network.requestServedFromCache',event=>{const row=transfers.get(event.requestId);if(row)row.cached=true;});
          cdp.on('Network.responseReceived',event=>{const row=transfers.get(event.requestId);if(row&&(event.response.fromDiskCache||event.response.fromServiceWorker))row.cached=true;});
          cdp.on('Network.loadingFinished',event=>{
            const row=transfers.get(event.requestId);if(!row)return;
            const group=groups[row.group];group.completed++;group.encodedBytes+=event.encodedDataLength;if(row.cached)group.cacheResponses++;
          });
          cdp.on('Network.loadingFinished', event => { bytes += event.encodedDataLength; });
          page.on('request', request => {
            requests++;
            if (/\/api\/(learning-sessions\/start|course-content\/[^?]+\/units|course-fragments\/)/.test(request.url())) contentRequests++;
          });
          const start = performance.now();
          await page.goto(base + '/main.html?protectedCourse=performance');
          const study = page.locator('.course-access-panel');
          await study.getByRole('button', { name: /^(开始学习|继续学习)$/ }).waitFor({ timeout: 60000 });
          await study.getByRole('button', { name: /^(开始学习|继续学习)$/ }).click();
          await page.locator('#stage:not(.hidden) .chunk-input').first().waitFor({ timeout: 30000 });
          const firstItemMs = performance.now() - start;
          const firstRequests = requests, firstContentRequests = contentRequests, firstBytes = bytes;
          const firstGroups=JSON.parse(JSON.stringify(groups));
          assert.equal(firstContentRequests, 1, 'first inline batch has exactly one content request');
          const chunks = await page.evaluate(() => cur().chunks.slice());
          for (let index = 0; index < chunks.length; index++) { const input = page.locator('#track .chunk-input').nth(index); await input.fill(chunks[index]); await input.press('Enter'); }
          await page.locator('#btnNext:not(.hidden)').waitFor();
          const beforeNext = contentRequests;
          const nextItemMs = await page.evaluate(() => new Promise((resolve, reject) => {
            const start = performance.now(), index = S.idx; nextQuestion();
            const poll = () => { if (S.idx > index) { requestAnimationFrame(() => resolve(performance.now() - start)); return; }
              if (performance.now() - start > 5000) { reject(Error('native next question timed out')); return; } requestAnimationFrame(poll); }; poll();
          }));
          assert.equal(contentRequests - beforeNext, 0, 'within-batch next item never requests content');
          if(cold||i>0)samples.push({ firstItemMs, nextItemMs, requests: firstRequests, contentRequests: firstContentRequests, bytes: firstBytes, groups:firstGroups, nextContentRequests: contentRequests - beforeNext });
          await page.close();
        }
        await context.close();
        results.push({ network: constrained ? '150ms-'+(downloadBps/1000000)+'Mbps' : 'local', cache: cold ? 'cold-context' : 'warm-context-after-one-warmup', count: samples.length,
          medianMs: percentile(samples.map(s => s.firstItemMs), 0.5), p95Ms: percentile(samples.map(s => s.firstItemMs), 0.95), nextItemP95Ms: percentile(samples.map(s => s.nextItemMs), 0.95), samples });
      }
    }
    // Measure the normal installed-worker path separately: page CDP byte counts
    // alone do not prove that a worker avoided a network fetch, so check server logs.
    const workerContext=await browser.newContext(),workerSamples=[];
    try{
      const accountResponse=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'198.51.100.200'},body:JSON.stringify({username:'perf-worker',password:'SyntheticPerf2026!'})});
      assert.equal(accountResponse.status,200);const account=await accountResponse.json();
      await workerContext.addInitScript(token=>localStorage.setItem('chunklab_token',token),account.token);
      async function firstInput(page){
        await page.goto(base+'/main.html?protectedCourse=performance');
        await page.locator('.course-access-panel').getByRole('button',{name:/^(开始学习|继续学习)$/}).click({timeout:60000});
        await page.locator('#stage:not(.hidden) .chunk-input').first().waitFor({timeout:30000});
      }
      const preparation=await workerContext.newPage();await firstInput(preparation);
      await preparation.evaluate(()=>navigator.serviceWorker.ready);
      await preparation.waitForFunction(()=>!!navigator.serviceWorker.controller);
      // The uncontrolled installation visit cannot populate optional runtime assets.
      // One controlled visit warms these before measuring steady-state revisits.
      await firstInput(preparation);
      await preparation.waitForFunction(async()=>{
        const name=(await caches.keys()).find(key=>key.startsWith('chunklab-')),cache=await caches.open(name);
        return (await Promise.all(['/builtins.js','/assets/membership-study.css','/js/membership.js'].map(url=>cache.match(location.origin+url)))).every(Boolean);
      });
      await preparation.close();
      for(let index=0;index<sampleCount;index++){
        const page=await workerContext.newPage(),cdp=await workerContext.newCDPSession(page);
        await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:downloadBps/8,uploadThroughput:750000/8});
        let encodedBytes=0,workerResponses=0;
        cdp.on('Network.loadingFinished',event=>{encodedBytes+=event.encodedDataLength;});
        cdp.on('Network.responseReceived',event=>{if(event.response.fromServiceWorker)workerResponses++;});
        const mark=logs.length,start=performance.now();await firstInput(page);const firstItemMs=performance.now()-start;
        await delay(50);
        const serverRequests=logs.slice(mark).split('\n').filter(line=>line.startsWith('[req] '));
        const staticRequests=serverRequests.filter(line=>/ GET (?!\/api\/|\/sw\.js(?:\s|\?))/.test(line));
        assert.deepEqual(staticRequests,[],'installed-worker revisit must not revalidate the application bundle against the server');
        assert.ok(workerResponses>0,'the page is actually using the installed worker');
        workerSamples.push({firstItemMs,pageEncodedBytes:encodedBytes,workerResponses,serverRequests:serverRequests.length,serverStaticRequests:staticRequests.length});await page.close();
      }
    }finally{await workerContext.close();}
    const out = path.join(root, 'output', 'membership-performance'); fs.mkdirSync(out, { recursive: true });
    const target = path.join(out, 'after-' + Date.now() + '.json');
    fs.writeFileSync(target, JSON.stringify({ measuredAt: new Date().toISOString(), node: process.version, fixture: 'synthetic-free-30-items-v1', implementation: 'unified-native-gateway', scope: 'navigation-to-first-native-input; nextQuestion invocation to next painted item; original engine teaching interaction differs from baseline example screen; no production SLA or claimed percentage improvement', results,serviceWorkerWarm:workerSamples }, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ output: target, results: results.map(({ samples, ...summary }) => summary),serviceWorkerWarm:workerSamples }, null, 2));
  } finally {
    if (browser) await browser.close();
    child.kill(); await new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit', resolve));
    // Keep the isolated fixture for diagnosis; never touch live storage.
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
