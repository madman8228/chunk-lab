/**
 * sync.test.js · 双设备云端同步对抗测试（ADR-005 端到端验证）
 *
 * 一键运行（自动拉起临时 server + 双浏览器 context 模拟双设备）：
 *   npm run e2e-sync
 *
 * 覆盖（此前只有单测，无端到端）：
 *   1. 双设备新增不同 deck → 双向拉取无丢失（per-entity 隔离）
 *   2. 串行修改同一 deck → rev 高者胜（LWW）
 *   3. 软删除传播：A 删 deck → B 拉取后消失
 *   4. 删除后重建：B 新建同 id deck → 上云 → A 拉取后恢复
 *   5. stale write 拒绝：旧 rev PUT 被 server 拒绝（upsert WHERE excluded.rev > cur）
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
const PORT = 9000 + Math.floor(Math.random() * 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-sync-'));
let server = null;

function startServer() {
  return new Promise(function (resolve, reject) {
    const node = process.execPath;
    server = spawn(node, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT) }),
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
  '  window.CL.saveAndNotify(mem);',
  '  return window.CL.cloudSyncNow(mem);',
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

  /* ===== 1. 双设备新增不同 deck → 双向拉取无丢失 ===== */
  console.log('\n--- 场景 1：双设备新增不同 deck（per-entity 隔离） ---');
  await boot(pA);
  await boot(pB);
  await pageEval(pA, 'window.__syncDo', { op: 'add', id: 'deckA', name: 'A 的题库' });
  await pageEval(pB, 'window.__syncDo', { op: 'add', id: 'deckB', name: 'B 的题库' });
  const aAfter = await doPull(pA);
  const bAfter = await doPull(pB);
  check('S1: 设备 A 拉取后拥有双方 deck（deckA+deckB）',
    aAfter.deckIds.indexOf('deckA') >= 0 && aAfter.deckIds.indexOf('deckB') >= 0,
    'A decks=' + JSON.stringify(aAfter.deckIds));
  check('S1: 设备 B 拉取后拥有双方 deck（deckA+deckB）',
    bAfter.deckIds.indexOf('deckA') >= 0 && bAfter.deckIds.indexOf('deckB') >= 0,
    'B decks=' + JSON.stringify(bAfter.deckIds));

  /* ===== 2. 串行修改同一 deck → rev 高者胜（LWW） ===== */
  console.log('\n--- 场景 2：串行修改 deckA（LWW，rev 高者胜） ---');
  await pageEval(pA, 'window.__syncDo', { op: 'rename', id: 'deckA', name: 'A 改 v2' });
  await doPull(pB); /* B 拉取 A 的 v2（rev 2） */
  await pageEval(pB, 'window.__syncDo', { op: 'rename', id: 'deckA', name: 'B 改 v3' });
  const aLww = await doPull(pA);
  const aName = (aLww.decks.find(function (d) { return d.id === 'deckA'; }) || {}).name;
  check('S2: 设备 A 拉取后 deckA = "B 改 v3"（B 基于 v2 改 → rev3 > rev2 胜出）',
    aName === 'B 改 v3',
    'name=' + aName);
  const bLww = await doPull(pB);
  check('S2: 设备 B 自见 deckA = "B 改 v3"', 
    (bLww.decks.find(function (d) { return d.id === 'deckA'; }) || {}).name === 'B 改 v3');

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
      return window.ChunkAPI.putData(payload).then(function (r) {
        return window.ChunkAPI.getData().then(function (d2) {
          const remote = (d2.mem.decks || []).find(function (x) { return x.id === 'deckA'; });
          return { putStatus: r ? 'ok' : 'fail', remoteName: remote ? remote.name : null };
        });
      });
    });
  });
  check('S5: 旧 rev(1) PUT 未覆盖远程 deckA（stale write 被 server 拒绝）',
    staleResult.remoteName !== 'STALE 覆盖尝试',
    'remoteName=' + staleResult.remoteName);

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
