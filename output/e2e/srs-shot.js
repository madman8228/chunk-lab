/**
 * srs-shot.js · SRS 白盒化（练习卡「下次复习」行）的肉眼验收截图
 * 产出：output/e2e/srs/01-after-answer.png
 * 运行：node output/e2e/srs-shot.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'srs');
fs.mkdirSync(OUT, { recursive: true });
const PORT = require(path.join(ROOT, 'e2e', 'lib', 'free-port')).freePort(8900, 40);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-srs-shot-'));
let server = null;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
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
      req.on('error', function () { /* retry */ });
      req.setTimeout(600, function () { req.destroy(); });
      if (tries > 120) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 200);
  });
}
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) {} server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}
}

const SENTENCE = 'The committee finally approved the budget.';
const CHUNKS = ['The committee', 'finally approved', 'the budget.'];

function init(s) {
  function fnv8(str) { var h = 0x811c9dc5; str = String(str == null ? '' : str); for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0; } var hex = (h >>> 0).toString(16); while (hex.length < 8) hex = '0' + hex; return hex; }
  localStorage.clear();
  localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
  var now = Date.now();
  var cid = fnv8(s.sentence);
  var item = { sentence: s.sentence, translation: s.translation, chunks: s.chunks.slice(),
    hints: s.chunks.map(function () { return ''; }), cid: cid };
  var deck = { id: 'srs-probe', name: 'SRS 探针题库', items: [item] };
  var by = {};
  by['srs-probe#' + cid] = { deckId: 'srs-probe', sentence: s.sentence, translation: s.translation,
    times: 3, okTimes: 3, wrongTimes: 0, streak: 2, maxStreak: 2, lastAt: now,
    repetition: 2, interval: 3, ease: 2.5, dueAt: now - 3600000 };
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2, decks: [deck], best: {}, mastered: {}, deletedItems: {}, reinforceBook: [],
    progress: {}, activeDeckId: 'srs-probe',
    stats: { totalRounds: 0, totalAnswered: 0, bySentence: by },
    settings: { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 10,
      sound: false, fxStack: false, celebrate: 'off', autoSpeak: false, darkMode: false }
  }));
  sessionStorage.setItem('_startDeck', JSON.stringify(deck));
}

(async function () {
  const BASE = 'http://127.0.0.1:' + PORT;
  const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
  await startServer();
  console.log('server: ' + BASE);

  for (const [file, viewport] of [['01-after-answer.png', { width: 1200, height: 900 }], ['02-after-answer-mobile.png', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: viewport });
    const p = await ctx.newPage();
    await p.route('**/api/**', function (r) { r.abort('failed'); });
    await p.route('**/content/**', function (r) { r.abort('failed'); });
    await p.addInitScript(init, { sentence: SENTENCE, translation: '委员会最终批准了预算。', chunks: CHUNKS });
    await p.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#stageChoices .choice', { timeout: 15000 });
    await p.waitForTimeout(500);
    for (let guard = 0; guard < 60; guard++) {
      const vis = await p.evaluate(function () { var e = document.getElementById('schedLine'); return !!(e && e.getClientRects().length); });
      if (vis) break;
      const st = await p.evaluate(function () {
        if (!window.S || S.finished) return null;
        if (typeof cur !== 'function') return null;
        var it = cur(); if (!it) return null;
        return (S.chunkIdx < it.chunks.length) ? it.chunks[S.chunkIdx] : null;
      });
      if (st === null) { await p.waitForTimeout(150); continue; }
      const hit = await p.evaluate(function (t) {
        var b = Array.prototype.slice.call(document.querySelectorAll('#stageChoices .choice')).filter(function (x) { return !x.disabled && x.dataset.v === t; })[0];
        if (b) { b.click(); return true; }
        return false;
      }, st);
      await p.waitForTimeout(hit ? 240 : 150);
    }
    const txt = await p.evaluate(function () { var e = document.getElementById('schedLine'); return e ? (e.textContent || '').trim() : '(缺失)'; });
    console.log('  ' + file + '  -> ' + txt);
    await p.screenshot({ path: path.join(OUT, file), fullPage: true });
    await ctx.close();
  }

  await browser.close();
  stopServer();
  console.log('完成 -> ' + OUT);
})().catch(function (e) { console.error(e); stopServer(); process.exit(1); });
