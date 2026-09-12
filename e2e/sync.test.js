/**
 * sync.test.js · 双设备云端同步对抗测试（ADR-005 端到端验证）
 *
 * 一键运行（自动拉起临时 server + 双浏览器 context 模拟双设备）：
 *   npm run e2e-sync
 *
 * 覆盖：
 *   1. 不同设备串行新增/修改/删除/重建 → 已确认版本可被另一设备拉取
 *   2. stale write 拒绝：旧 rev PUT 被 server 拒绝
 *   3. 同一基础版本并发写 → 只允许一方成功，失败方保留本地值和固定待发请求
 *
 * 依赖：playwright-core + chromium-headless-shell（同 e2e.js）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9000, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-sync-'));
let server = null;

function startServer() {
  return new Promise(function (resolve, reject) {
    const node = process.execPath;
    server = spawn(node, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test' }),
      stdio: 'ignore'
    });
    let tries = 0;
    const iv = setInterval(function () {
      tries++;
      if (server.exitCode !== null) { clearInterval(iv); reject(new Error('server exit ' + server.exitCode)); return; }
      const http = require('http');
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (r) {
        if (r.statusCode === 200) { clearInterval(iv); resolve(); }
      });
      req.on('error', function () { /* 重试 */ });
      req.setTimeout(600, function () { req.destroy(); });
      if (tries > 40) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 400);
  });
}
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) { /* noop */ } server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
}

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (detail ? '  → ' + detail : '')); }
}

/* 注入页面：设备内操作脚本（cmd = { op: add|rename|delete|readd, id, name }） */
const INJECT_SRC = [
  'window.__syncDo = function (cmd) {',
  '  var mem = window.CL.loadMem();',
  '  function mk(id, name) { return { id: id, name: name, builtin: false, items: [{ sentence: "Test " + name, translation: "", chunks: ["Test", name], hints: [], alts: [] }] }; }',
  '  if (cmd.op === "add" || cmd.op === "readd") { mem.decks = mem.decks.filter(function (d) { return d.id !== cmd.id; }); mem.decks.push(mk(cmd.id, cmd.name)); }',
  '  else if (cmd.op === "rename") { var d = mem.decks.find(function (x) { return x.id === cmd.id; }); if (d) d.name = cmd.name; }',
  '  else if (cmd.op === "delete") { mem.decks = mem.decks.filter(function (d) { return d.id !== cmd.id; }); }',
  '  else if (cmd.op === "event") { mem.stats.events = Array.isArray(mem.stats.events) ? mem.stats.events : []; mem.stats.events.push({ id: cmd.id, kind: "answer", key: "deckA#event", ok: true, at: Date.now() }); }',
  '  return Promise.resolve(window.CL.saveAndNotify(mem)).then(function (saved) {',
  '    if (saved === false) return false;',
  '    return window.CL.cloudSyncNow(window.CL.loadMem());',
  '  });',
  '};',
  'window.__syncPull = function () {',
  '  return window.CL.syncFromCloud().then(function () {',
  '    var m = window.CL.loadMem();',
  '    return { deckIds: (m.decks || []).map(function (d) { return d.id; }), decks: m.decks || [] };',
  '  });',
  '};'
].join('\n');

(async function () {
  const BASE = 'http://127.0.0.1:' + PORT;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH ||
      'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
  });
  await startServer();
  console.log('sync-test server: ' + BASE);

  /* 双设备：各自独立 context（独立 localStorage） */
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pA = await ctxA.newPage();
  const pB = await ctxB.newPage();
  pA.on('pageerror', function (e) { console.log('  [A pageerror]', e.message); });
  pB.on('pageerror', function (e) { console.log('  [B pageerror]', e.message); });

  async function boot(page) {
    await page.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(function () { return window.CL && typeof window.CL.cloudSyncNow === 'function'; }, { timeout: 20000 });
    await page.addInitScript(INJECT_SRC);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () { return window.__syncDo && window.CL; }, { timeout: 20000 });
    /* 等 ensureCloud 首拉完成 */
    await page.waitForTimeout(2000);
  }
  const doSync = function (cmd) { return pageEval(pA, 'window.__syncDo', cmd); };
  const doPull = function (page) { return pageEval(page, 'window.__syncPull', null); };
  async function pageEval(page, fn, arg) {
    if (arg) {
      return page.evaluate(function (o) { return eval(o.fn + '(' + JSON.stringify(o.arg) + ')'); }, { fn: fn, arg: arg });
    }
    return page.evaluate(function (src) { return eval(src + '()'); }, fn);
  }

  /* ===== 1. 不同设备串行新增 → 双向拉取 ===== */
  console.log('\n--- 场景 1：不同设备串行新增（账号级条件批次） ---');
  await boot(pA);
  await boot(pB);
  await pageEval(pA, 'window.__syncDo', { op: 'add', id: 'deckA', name: 'A 的题库' });
  const bAfterA = await doPull(pB);
  check('S1: 设备 B 拉取后拥有设备 A 已确认的 deckA',
    bAfterA.deckIds.indexOf('deckA') >= 0,
    'B decks=' + JSON.stringify(bAfterA.deckIds));
  await pageEval(pB, 'window.__syncDo', { op: 'add', id: 'deckB', name: 'B 的题库' });
  const aAfterB = await doPull(pA);
  check('S1: 设备 A 拉取后保留 deckA 并获得设备 B 已确认的 deckB',
    aAfterB.deckIds.indexOf('deckA') >= 0 && aAfterB.deckIds.indexOf('deckB') >= 0,
    'A decks=' + JSON.stringify(aAfterB.deckIds));

  /* ===== 2. 串行修改同一 deck → 已确认值传播 ===== */
  console.log('\n--- 场景 2：串行修改 deckA（先拉取再编辑） ---');
  await pageEval(pA, 'window.__syncDo', { op: 'rename', id: 'deckA', name: 'A 改 v2' });
  await doPull(pB); /* B 拉取 A 的 v2 后再编辑 */
  await pageEval(pB, 'window.__syncDo', { op: 'rename', id: 'deckA', name: 'B 改 v3' });
  const aLww = await doPull(pA);
  const aName = (aLww.decks.find(function (d) { return d.id === 'deckA'; }) || {}).name;
  check('S2: 设备 A 拉取后获得设备 B 已确认的 deckA',
    aName === 'B 改 v3',
    'name=' + aName);
  const bLww = await doPull(pB);
  check('S2: 设备 B 自见 deckA = "B 改 v3"', 
    (bLww.decks.find(function (d) { return d.id === 'deckA'; }) || {}).name === 'B 改 v3');

  /* ===== 2b. 整账号本机选择必须删除远端独有事件 ===== */
  console.log('\n--- 场景 2b：整账号选择的事件删除语义 ---');
  await pageEval(pA, 'window.__syncDo', { op: 'add', id: 'event-conflict-deck', name: '事件冲突基线' });
  await doPull(pB);
  await pageEval(pB, 'window.__syncDo', { op: 'event', id: 'remote-only-event' });
  const eventBeforeResolution = await pB.evaluate(async function () {
    return (await ChunkAPI.getData()).mem.stats.events.some(function (ev) { return ev.id === 'remote-only-event'; });
  });
  check('S2b: 远端已确认设备 B 的事件', eventBeforeResolution);
  /* A 不拉取 B 的事件，随后编辑同一账号内的另一题库，触发批次冲突。 */
  await pageEval(pA, 'window.__syncDo', { op: 'rename', id: 'event-conflict-deck', name: '本机选择版本' });
  const eventView = await pA.evaluate(async function () { return await SyncResolution.preview(); });
  const eventReceipt = await pA.evaluate(async function (view) { return await SyncResolution.resolve(view, 'local'); }, eventView);
  const eventRemote = await pA.evaluate(async function () {
    const data = await ChunkAPI.getData();
    return { events: data.mem.stats.events.map(function (ev) { return ev.id; }), name: data.mem.decks.find(function (d) { return d.id === 'event-conflict-deck'; }).name };
  });
  check('S2b: 使用本机后远端独有事件被删除', eventReceipt.choice === 'local' && eventRemote.events.indexOf('remote-only-event') < 0);
  const bAfterEventResolution = await doPull(pB);
  check('S2b: 另一设备拉取后同步移除事件墓碑', bAfterEventResolution.deckIds.indexOf('event-conflict-deck') >= 0 && await pB.evaluate(function () {
    return !window.CL.loadMem().stats.events.some(function (ev) { return ev.id === 'remote-only-event'; });
  }));

  /* ===== 3. 软删除传播：A 删 deckB → B 拉取后消失 ===== */
  console.log('\n--- 场景 3：软删除传播 ---');
  await pageEval(pA, 'window.__syncDo', { op: 'delete', id: 'deckB' });
  const bDel = await doPull(pB);
  check('S3: 设备 B 拉取后 deckB 消失（软删传播）',
    bDel.deckIds.indexOf('deckB') < 0,
    'B decks=' + JSON.stringify(bDel.deckIds));

  /* ===== 4. 删除后重建：B 新建同 id deck → A 拉取后恢复 ===== */
  console.log('\n--- 场景 4：删除后重建 ---');
  await pageEval(pB, 'window.__syncDo', { op: 'readd', id: 'deckB', name: 'B 重建的 deckB' });
  const aRe = await doPull(pA);
  const reDeck = aRe.decks.find(function (d) { return d.id === 'deckB'; });
  check('S4: 设备 A 拉取后 deckB 恢复（新名字，rev 单调递增语义）',
    !!reDeck && reDeck.name === 'B 重建的 deckB',
    'deckB=' + JSON.stringify(reDeck));

  /* ===== 5. stale write 拒绝：旧 rev PUT 被 server 拒绝 ===== */
  console.log('\n--- 场景 5：stale write 拒绝 ---');
  const staleResult = await pA.evaluate(function () {
    return window.ChunkAPI.getData().then(function (data) {
      const target = (data.mem.decks || []).find(function (d) { return d.id === 'deckA'; });
      if (!target) return { putStatus: 'no-target', remoteName: null };
      /* 用低 rev(1) 尝试覆盖当前 rev 的 deckA */
      const payload = {
        mem: { decks: [{ id: 'deckA', name: 'STALE 覆盖尝试', builtin: false, items: target.items }] },
        revs: { decks: { deckA: 1 }, kv: {} },
        deleted: { decks: [], kv: [] }
      };
      return window.ChunkAPI.putData(payload).then(function () { return 'unexpected-success'; }, function(e){ return e.code; }).then(function (code) {
        return window.ChunkAPI.getData().then(function (d2) {
          const remote = (d2.mem.decks || []).find(function (x) { return x.id === 'deckA'; });
          return { putStatus: code, remoteName: remote ? remote.name : null };
        });
      });
    });
  });
  check('S5: 旧 rev(1) PUT 未覆盖远程 deckA（stale write 被 server 拒绝）',
    staleResult.putStatus === 'SYNC_CONFLICT' && staleResult.remoteName !== 'STALE 覆盖尝试',
    'remoteName=' + staleResult.remoteName);

  /* ===== 6. 同一基础版本双设备修改：保留失败方本地值和待发状态 ===== */
  await doPull(pA); await doPull(pB);
  await pageEval(pA, 'window.__syncDo', { op: 'rename', id: 'deckA', name: 'A concurrent' });
  const conflictOk = await pageEval(pB, 'window.__syncDo', { op: 'rename', id: 'deckA', name: 'B concurrent' });
  const conflictState = await pB.evaluate(async function(){
    var remote = await ChunkAPI.getData();
    var batch = await BatchSync.state();
    return {
      dirty: CL.isDirty(), conflict: CL.getSyncConflict(),
      local: CL.loadMem().decks.find(function(d){ return d.id === 'deckA'; }).name,
      remote: remote.mem.decks.find(function(d){ return d.id === 'deckA'; }).name,
      pending: batch.pending && batch.pending.requestId,
      pendingBase: batch.pending && batch.pending.baseSeq
    };
  });
  check('S6: same-baseline conflict is not success', conflictOk === false && conflictState.dirty && !!conflictState.conflict);
  check('S6: local and remote versions both preserved', conflictState.local === 'B concurrent' && conflictState.remote === 'A concurrent');
  check('S6: 失败方保留固定待发请求', typeof conflictState.pending === 'string' && conflictState.pendingBase !== null);
  check('S6: 冲突由账号级批次报告', conflictState.conflict[0].entity === 'batch');
  const batchView = await pB.evaluate(async function(){ return await SyncResolution.preview(); });
  check('S6: 真实页面可读取整账号双方快照', batchView.batch === true && batchView.local.value.mem.decks.some(function(d){ return d.id === 'deckA'; }) && batchView.remote.value.mem.decks.some(function(d){ return d.id === 'deckA'; }));
  check('S6: 整账号比较带服务端绑定 token', typeof batchView.remoteToken === 'string' && /^[a-f0-9]{64}$/.test(batchView.remoteToken));
  await pageEval(pA, 'window.__syncDo', { op: 'rename', id: 'deckA', name: 'A newer during preview' });
  const staleBatch = await pB.evaluate(async function(view){
    try { await SyncResolution.resolve(view, 'local'); return 'unexpected'; }
    catch(e){ return e.code || e.message; }
  }, batchView);
  check('S7: batch比较后云端再变化会拒绝旧选择', staleBatch === 'RESOLUTION_STALE');
  const freshBatch = await pB.evaluate(async function(){ return await SyncResolution.preview(); });
  const localReceipt = await pB.evaluate(async function(view){ return await SyncResolution.resolve(view, 'local'); }, freshBatch);
  check('S7: 使用本机后服务端完成整账号替换', localReceipt.kind === 'batch' && localReceipt.choice === 'local');
  const resolvedBatch = await pB.evaluate(async function(requestId){
    const data=await ChunkAPI.getData(), state=await BatchSync.state(), archive=await ChunkAPI.getSyncBatchResolution(requestId);
    return {name:data.mem.decks.find(function(d){return d.id==='deckA';}).name,pending:state.pending,archive:archive.backup};
  }, localReceipt.requestId);
  check('S7: 使用本机后本地值、待发状态和双方归档均保留', resolvedBatch.name === 'B concurrent' && !resolvedBatch.pending && resolvedBatch.archive.local.mem.decks.some(function(d){return d.id==='deckA';}) && resolvedBatch.archive.remote.mem.decks.some(function(d){return d.id==='deckA';}));
  check('S7: 另一设备随后拉取到已选择的本机版本', (await doPull(pA)).decks.find(function(d){return d.id==='deckA';}).name === 'B concurrent');

  /* ===== 8. 使用云端：本机切换到已确认的远端快照 ===== */
  await doPull(pA); await doPull(pB);
  await pageEval(pA, 'window.__syncDo', { op: 'rename', id: 'deckA', name: 'A remote choice' });
  await pageEval(pB, 'window.__syncDo', { op: 'rename', id: 'deckA', name: 'B discarded locally' });
  const remoteView = await pB.evaluate(async function(){ return await SyncResolution.preview(); });
  const remoteReceipt = await pB.evaluate(async function(view){ return await SyncResolution.resolve(view, 'remote'); }, remoteView);
  const remoteChoice = await pB.evaluate(async function(requestId){
    const data=await ChunkAPI.getData(), state=await BatchSync.state(), archive=await ChunkAPI.getSyncBatchResolution(requestId);
    return {name:data.mem.decks.find(function(d){return d.id==='deckA';}).name,pending:state.pending,archive:archive.backup};
  }, remoteReceipt.requestId);
  check('S8: 使用云端后本机切换到云端值且清理待发请求', remoteReceipt.choice === 'remote' && remoteChoice.name === 'A remote choice' && !remoteChoice.pending);
  check('S8: 使用云端同样保留双方整账号归档', remoteChoice.archive.local.mem.decks.some(function(d){return d.name==='B discarded locally';}) && remoteChoice.archive.remote.mem.decks.some(function(d){return d.name==='A remote choice';}));

  /* ===== 9. 整账号处理回执丢失：同一请求可继续 ===== */
  await doPull(pA); await doPull(pB);
  await pageEval(pA, 'window.__syncDo', { op: 'rename', id: 'deckA', name: 'A before lost receipt' });
  await pageEval(pB, 'window.__syncDo', { op: 'rename', id: 'deckA', name: 'B before lost receipt' });
  const lostView = await pB.evaluate(async function(){ return await SyncResolution.preview(); });
  let lostBatchReceipt;
  await pB.route('**/api/sync/batch/resolve', async function(route){
    const response = await route.fetch(); lostBatchReceipt = await response.json(); await route.abort('failed');
  });
  let lostError;
  try { await pB.evaluate(async function(view){ return await SyncResolution.resolve(view, 'local'); }, lostView); }
  catch(e){ lostError = e.message; }
  await pB.unroute('**/api/sync/batch/resolve');
  const lostState = await pB.evaluate(async function(){ return {pending:(await BatchSync.state()).pending,paused:await SyncResolution.restorePause()}; });
  check('S9: 整账号回执丢失后原请求和处理记录仍保留', !!lostError && !!lostBatchReceipt && !!lostState.pending && !!lostState.paused);
  const retriedBatch = await pB.evaluate(async function(){ return await SyncResolution.retry(); });
  const retriedState = await pB.evaluate(async function(){ return {pending:(await BatchSync.state()).pending,paused:await SyncResolution.restorePause()}; });
  check('S9: 刷新前继续会复用同一整账号请求并完成确认', retriedBatch.requestId === lostBatchReceipt.requestId && !retriedState.pending && !retriedState.paused);

  /* ===== 收尾 ===== */
  await pA.close(); await pB.close();
  await ctxA.close(); await ctxB.close();
  await browser.close();
  stopServer();

  console.log('\n[sync-test] passed=' + passed + ' failed=' + failed);
  process.exit(failed > 0 ? 1 : 0);
})().catch(function (e) {
  console.error('[sync-test] fatal:', e);
  stopServer();
  process.exit(1);
});
