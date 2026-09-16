/**
 * contrast-shots.js · 对比度修复的肉眼验收截图（一次性走查，非测试用例）
 * 产出到 output/e2e/contrast/：首页(浅色/深色)、题库列表、学习档案。
 * 运行：node output/e2e/contrast-shots.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'contrast');
fs.mkdirSync(OUT, { recursive: true });

const PORT = require(path.join(ROOT, 'e2e', 'lib', 'free-port')).freePort(8860, 40);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-contrast-'));
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
      if (tries > 100) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 200);
  });
}
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) { /* noop */ } server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
}

/* 造一点数据，让 --faint/--ok/--warn 都有实际渲染（不然全是空状态，看不出色差） */
const SEED = {
  version: 2,
  reinforceBook: [{ sentence: 'I would rather stay home than go out tonight.', cid: 'seed-1' }],
  decks: [{
    id: 'seed-deck', name: '日常对话 · 视觉验收', createdAt: Date.now(),
    items: [
      { sentence: 'Could you walk me through the whole process again?', translation: '你能把整个流程再给我讲一遍吗？', chunks: ['Could you', 'walk me through', 'the whole process again?'], cid: 'seed-1', hints: [] },
      { sentence: 'I would rather stay home than go out tonight.', translation: '今晚我宁愿待在家也不出去。', chunks: ['I would rather stay home', 'than go out tonight.'], cid: 'seed-2', hints: [] },
      { sentence: 'It turns out the meeting had been cancelled.', translation: '结果那场会议早就取消了。', chunks: ['It turns out', 'the meeting had been cancelled.'], cid: 'seed-3', hints: [] }
    ]
  }],
  best: {}, mastered: { 'seed-1': 1 }, deletedItems: {},
  progress: {}, activeDeckId: 'seed-deck',
  stats: {
    totalRounds: 42, totalAnswered: 168, streak: 7, bestStreak: 12,
    bySentence: {
      'seed-1': { times: 6, okTimes: 6, lastAt: Date.now(), interval: 7, repetition: 2, dueAt: Date.now() - 86400000 },
      'seed-2': { times: 4, okTimes: 2, lastAt: Date.now(), interval: 1, repetition: 0, dueAt: Date.now() - 3600000 },
      'seed-3': { times: 3, okTimes: 3, lastAt: Date.now(), interval: 3, repetition: 1, dueAt: Date.now() + 86400000 }
    },
    events: []
  },
  settings: { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 10, darkMode: false,
    fxStack: true, celebrate: 'confetti', autoSpeak: false, sound: false }
};

(async function () {
  const BASE = 'http://127.0.0.1:' + PORT;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || chromium.executablePath()
  });
  await startServer();
  console.log('server: ' + BASE);

  const shot = async function (ctx, file, url) {
    const p = await ctx.newPage();
    await p.goto(BASE + url, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(OUT, file), fullPage: true });
    await p.close();
    console.log('  -> ' + file);
  };

  const desktop = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  await desktop.addInitScript(function (seed) {
    localStorage.clear();
    localStorage.setItem('chunklab', '1');
    localStorage.setItem('chunklab.v1', JSON.stringify(seed));
  }, SEED);

  await shot(desktop, '01-home-light.png', '/main.html');
  await shot(desktop, '02-decks-light.png', '/decks.html');
  await shot(desktop, '03-stats-light.png', '/stats.html');

  /* 深色主题：main.html 读 settings.darkMode */
  const dark = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  await dark.addInitScript(function (seed) {
    localStorage.clear();
    localStorage.setItem('chunklab', '1');
    seed.settings.darkMode = true;
    localStorage.setItem('chunklab.v1', JSON.stringify(seed));
  }, JSON.parse(JSON.stringify(SEED)));
  await shot(dark, '04-home-dark.png', '/main.html');

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await mobile.addInitScript(function (seed) {
    localStorage.clear();
    localStorage.setItem('chunklab', '1');
    localStorage.setItem('chunklab.v1', JSON.stringify(seed));
  }, SEED);
  await shot(mobile, '05-home-mobile.png', '/main.html');

  /* BEFORE 对照：用 !important 把旧色板盖回去，直观对比修复前后 */
  const before = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  await before.addInitScript(function (seed) {
    localStorage.clear();
    localStorage.setItem('chunklab', '1');
    localStorage.setItem('chunklab.v1', JSON.stringify(seed));
    var css = ':root{--muted:#74716a !important;--faint:#9a958c !important;--ok:#23855a !important;--warn:#a16207 !important}';
    var add = function () { var s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s); };
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
  }, SEED);
  await shot(before, 'BEFORE-stats.png', '/stats.html');
  await shot(before, 'BEFORE-decks.png', '/decks.html');

  await browser.close();
  stopServer();
  console.log('完成 -> ' + OUT);
})().catch(function (e) { console.error(e); stopServer(); process.exit(1); });
