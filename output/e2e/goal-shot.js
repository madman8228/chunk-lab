/**
 * goal-shot.js · 「每日目标 + 今日进度」肉眼验收截图
 * 产出 output/e2e/goal/：01-progress(12/20)、02-done(20/20)、03-none(未设目标)、04-mobile
 * 运行：node output/e2e/goal-shot.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'goal');
fs.mkdirSync(OUT, { recursive: true });
const PORT = require(path.join(ROOT, 'e2e', 'lib', 'free-port')).freePort(8840, 40);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-goal-'));
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

function init(s) {
  localStorage.clear();
  localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
  var now = Date.now();
  var events = [], i;
  for (i = 0; i < s.answered; i++) events.push({ id: 'e' + i, kind: 'answer', key: 'd1#k' + i, ok: true, at: now - i * 1000 });
  var settings = { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 10,
    sound: false, fxStack: false, celebrate: 'none', autoSpeak: false, darkMode: false };
  if (s.goal) settings.dailyGoal = s.goal;
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2,
    decks: [{ id: 'd1', name: '目标探针题库', items: [
      { sentence: 'Goal probe sentence.', translation: '目标探针句。', chunks: ['Goal probe', 'sentence.'], hints: ['', ''], cid: 'g1' }
    ] }],
    best: {}, mastered: {}, deletedItems: {}, reinforceBook: [], progress: {},
    stats: { totalRounds: 1, totalAnswered: s.answered, bySentence: {}, events: events, daysLog: {} },
    settings: settings
  }));
}

(async function () {
  const BASE = 'http://127.0.0.1:' + PORT;
  const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
  await startServer();
  console.log('server: ' + BASE);

  const shots = [
    ['01-progress.png', { goal: 20, answered: 12 }, { width: 1200, height: 900 }],
    ['02-done.png', { goal: 20, answered: 20 }, { width: 1200, height: 900 }],
    ['03-none.png', { answered: 12 }, { width: 1200, height: 900 }],
    ['04-mobile.png', { goal: 20, answered: 12 }, { width: 390, height: 844 }]
  ];
  for (const [file, seed, viewport] of shots) {
    const ctx = await browser.newContext({ viewport: viewport });
    const p = await ctx.newPage();
    await p.route('**/api/**', function (r) { r.abort('failed'); });
    await p.route('**/content/**', function (r) { r.abort('failed'); });
    await p.addInitScript(init, seed);
    await p.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#homeBody', { timeout: 12000 });
    await p.waitForTimeout(900);
    const txt = await p.evaluate(function () {
      var el = document.querySelector('#homeBody .home-goal');
      return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '(无目标节点)';
    });
    console.log('  ' + file + '  -> ' + txt);
    await p.screenshot({ path: path.join(OUT, file), fullPage: true });
    await ctx.close();
  }

  await browser.close();
  stopServer();
  console.log('完成 -> ' + OUT);
})().catch(function (e) { console.error(e); stopServer(); process.exit(1); });
