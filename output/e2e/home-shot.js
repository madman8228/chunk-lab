/* 首页基准截图（可复用）：按真实数据渲染首页，输出桌面 + 窄屏整页截图。
   用途：首页改版前后做视觉对照，避免只靠 DOM 断言判断「好不好看」。

   用法：
     CHROMIUM_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe' \
       node output/e2e/home-shot.js <输出前缀>
   例：node output/e2e/home-shot.js home-before   → home-before-1280.png / home-before-390.png

   注意（踩过的坑）：
   - 本机 Playwright 内置 chromium 缺失，必须给 CHROMIUM_PATH
   - 种子数据用 addInitScript 时，**闭包变量进不了浏览器**，必须走第二参数传参 */
const fs = require('fs'), path = require('path'), os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = process.cwd();
const PREFIX = process.argv[2] || 'home-shot';
const PORT = 9500 + Math.floor(Math.random() * 60);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-home-shot-'));
const CHROME = process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

/* 种子：一门在学课程（有进度）+ 一门导入未开始 + 到期/错题/已熟练三种计数。
   刻意让 due/book/mastered 三个数不相等，避免「数字写死也看不出来」。 */
function seed(spec) {
  function fnv8(str) {
    var h = 0x811c9dc5; str = String(str == null ? '' : str);
    for (var i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
    var hex = (h >>> 0).toString(16); while (hex.length < 8) hex = '0' + hex; return hex;
  }
  localStorage.clear();
  try { localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local'])); } catch (e) {}
  var now = Date.now();
  var DECK = 'oral3000', IMP = 'imported-1';
  var items = [], by = {}, mastered = {};
  var i;
  /* 已练 12 句：6 句 master（times>=3 且正确率 >=0.8）、3 句到期、3 句普通 */
  for (i = 0; i < 12; i++) {
    var s = 'Practiced sentence number ' + (i + 1) + '.';
    var c = fnv8(s);
    items.push({ sentence: s, chunks: s.split(' '), hints: s.split(' ').map(function () { return ''; }), cid: c });
    var isMaster = i < 6;
    by[DECK + '#' + c] = {
      deckId: DECK, times: isMaster ? 4 : 2, okTimes: isMaster ? 4 : 1, wrongTimes: isMaster ? 0 : 1,
      streak: 0, maxStreak: 0, lastAt: now, interval: 1, ease: 2.5,
      dueAt: i >= 6 && i < 9 ? now - 60000 : now + 86400000
    };
  }
  mastered[DECK + '#' + fnv8('Manual marked sentence.')] = { deckId: DECK, markedAt: now };
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2,
    decks: [
      { id: DECK, name: '口语 3000 句 · 日常场景', items: items },
      { id: IMP, name: '雅思口语 Part 2', items: [{ sentence: 'Imported sentence.', chunks: ['Imported', 'sentence.'], hints: ['', ''] }] }
    ],
    best: { 'oral3000': { acc: 92, perfect: 4, combo: 6, lastPlayed: now, lastAcc: 92 } },
    mastered: mastered, deletedItems: {}, reinforceBook: [],
    stats: { totalRounds: 6, totalAnswered: 30, bySentence: by },
    settings: { mode: 'choose', skipMastered: false, batchSize: 10, sound: false, fxStack: true,
      celebrate: 'confetti', autoSpeak: false, darkMode: false, dailyGoal: 20 }
  }));
}

const server = spawn(process.execPath, ['index.js'], {
  cwd: path.join(ROOT, 'server'),
  env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT) }),
  stdio: 'ignore'
});

(async () => {
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 300));
    const ok = await new Promise(res => {
      const q = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, r2 => { res(r2.statusCode === 200); q.destroy(); });
      q.on('error', () => res(false)); q.setTimeout(400, () => { q.destroy(); res(false); });
    });
    if (ok) break;
  }
  const browser = await chromium.launch({ executablePath: CHROME });
  const out = [];
  for (const vp of [{ w: 1280, h: 900, tag: '1280' }, { w: 390, h: 844, tag: '390' }]) {
    const c = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const p = await c.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(seed, null);
    await p.goto('http://127.0.0.1:' + PORT + '/main.html', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#homeBody .home-today-counts', { timeout: 20000 });
    await p.waitForTimeout(1800);
    const file = path.join(ROOT, 'output', PREFIX + '-' + vp.tag + '.png');
    await p.screenshot({ path: file, fullPage: true });
    /* 顺带量一下关键盒模型，纯文本落盘便于对比 */
    const geo = await p.evaluate(() => {
      const g = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
      const row = document.querySelector('.home-today-counts');
      const kids = row ? Array.prototype.map.call(row.children, el => ({ cls: el.className, tag: el.tagName, w: Math.round(el.getBoundingClientRect().width) })) : [];
      return { bodyW: document.getElementById('homeBody').getBoundingClientRect().width,
        counts: g('.home-today-counts'), kids: kids, scrollW: document.documentElement.scrollWidth };
    });
    out.push({ vp: vp.tag, file: file.replace(/\\/g, '/'), errs: errs, geo: geo });
    await c.close();
  }
  fs.writeFileSync(path.join(ROOT, 'output', PREFIX + '.json'), JSON.stringify(out, null, 1), 'utf8');
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
  server.kill('SIGKILL');
})().catch(e => { console.error(e); server.kill('SIGKILL'); process.exit(1); });
