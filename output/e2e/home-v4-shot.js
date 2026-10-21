/* V4 首页截图（2026-10-10）：light/dark × 1280/390 四张整页截图。
   基于 output/e2e/home-shot.js（同套种子护栏：abort **/api/** 与 **/content/**，
   防止注入的 localStorage 被服务端空状态覆盖），并补充：
   - stats.daysLog + 今日 answer 事件 → 点阵月历/目标环/近7天有真实数据
   - reinforceBook 三条错题 → 错题本 TOP 有内容
   - argv[3] = 'dark' 时 settings.darkMode=true（.dark 挂在 documentElement，见 main.html applyDark）

   用法：
     CHROMIUM_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe' \
       node output/e2e/home-v4-shot.js home-v4 [dark]
   输出：output/<前缀>-{1280,390}.png + output/<前缀>.json */
const fs = require('fs'), path = require('path'), os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = process.cwd();
const PREFIX = process.argv[2] || 'home-v4';
const DARK = String(process.argv[3] || '') === 'dark';
const PORT = 9600 + Math.floor(Math.random() * 60);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-home-v4-'));
const CHROME = process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

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
  /* V4 截图补充：今日 12 次 answer 事件（目标环 12/20=60%）+ 本月若干天 daysLog（点阵月历） */
  function ymd(d) {
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  var events = [], today = new Date();
  for (i = 0; i < 12; i++) events.push({ id: 'seed-ans-' + i, kind: 'answer', at: now - i * 60000 });
  var daysLog = {}, dot;
  [1, 2, 3, 5, 8].forEach(function (back) {
    var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
    if (d.getMonth() !== today.getMonth()) return;
    daysLog[ymd(d)] = { rounds: 2 };
  });
  var reinforceBook = [
    { _key: 'w1', sentence: 'The plan fell through at the last minute.', translation: '计划在最后一刻告吹了。', mistakes: [], history: [{ at: now - 86400000 }, { at: now - 172800000 }, { at: now - 259200000 }] },
    { _key: 'w2', sentence: 'It is bound to happen sooner or later.', translation: '这事迟早会发生。', mistakes: [], history: [{ at: now - 90000000 }, { at: now - 180000000 }] },
    { _key: 'w3', sentence: 'She is under the weather today.', translation: '她今天不太舒服。', mistakes: [], history: [{ at: now - 300000000 }] }
  ];
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2,
    decks: [
      { id: DECK, name: '口语 3000 句 · 日常场景', items: items },
      { id: IMP, name: '雅思口语 Part 2', items: [{ sentence: 'Imported sentence.', chunks: ['Imported', 'sentence.'], hints: ['', ''] }] }
    ],
    best: { 'oral3000': { acc: 92, perfect: 4, combo: 6, lastPlayed: now, lastAcc: 92 } },
    mastered: mastered, deletedItems: {}, reinforceBook: reinforceBook,
    stats: { totalRounds: 6, totalAnswered: 30, bySentence: by, events: events, daysLog: daysLog },
    settings: { mode: 'choose', skipMastered: false, batchSize: 10, sound: false, fxStack: true,
      celebrate: 'confetti', autoSpeak: false, darkMode: DARK, dailyGoal: 20 }
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
    await p.route('**/api/**', r => r.abort('failed'));
    await p.route('**/content/**', r => r.abort('failed'));
    await p.addInitScript(seed, null);
    await p.goto('http://127.0.0.1:' + PORT + '/main.html', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#homeBody .home-rail', { timeout: 20000 });
    await p.waitForTimeout(1800);
    const file = path.join(ROOT, 'output', PREFIX + '-' + vp.tag + '.png');
    await p.screenshot({ path: file, fullPage: true });
    const probe = await p.evaluate(() => {
      const cs = el => el ? getComputedStyle(el) : null;
      const rgb = el => el ? cs(el).backgroundColor : null;
      const card = document.querySelector('#pageHome .home-card');
      const hero = document.querySelector('#pageHome .home-today-card');
      const pill = document.querySelector('#pageHome .home-pill.due');
      const dotcal = document.querySelectorAll('#pageHome .home-dotcal i');
      const dotOn = document.querySelectorAll('#pageHome .home-dotcal i.on');
      const ring = document.querySelector('#pageHome .home-ring .r-text');
      const rail = document.querySelectorAll('#pageHome .home-rail .home-rail-card');
      const body = getComputedStyle(document.body);
      return {
        dark: document.documentElement.classList.contains('dark'),
        bodyBgImage: body.backgroundImage.slice(0, 140),
        cardBorder: card ? (cs(card).borderTopWidth + ' ' + cs(card).borderTopColor) : null,
        cardBg: rgb(card), cardShadow: card ? cs(card).boxShadow : null,
        heroBg: rgb(hero), heroColor: hero ? cs(hero).color : null,
        pillShadow: pill ? cs(pill).boxShadow : null,
        dotcalCells: dotcal.length, dotcalOn: dotOn.length,
        ringText: ring ? ring.textContent : null,
        railCards: rail.length,
        trendInRail: !!document.querySelector('#pageHome .home-rail .home-trend'),
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    });
    out.push({ vp: vp.tag, dark: DARK, file: file.replace(/\\/g, '/'), errs: errs, probe: probe });
    await c.close();
  }
  fs.writeFileSync(path.join(ROOT, 'output', PREFIX + '.json'), JSON.stringify(out, null, 1), 'utf8');
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
  server.kill('SIGKILL');
})().catch(e => { console.error(e); server.kill('SIGKILL'); process.exit(1); });
