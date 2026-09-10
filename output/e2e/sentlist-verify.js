/* 验证 renderSentenceList v2：rows 从「bySentence + mastered」改为「allDecks() 全集」
   验证点：
   1. 「全部」tab 显示全集（含未练过）
   2. 「未练过」tab 不再为空
   3. 「已熟」tab = master 分类 + _masteredOnly
   4. 「需巩固」tab = weak 分类
   5. badge 文案与 practiceState 对齐
   6. 排序：master > learn > weak > unseen
   7. deletedItems 过滤生效
   8. 只标熟未练过的在「已熟」tab
   9. 零 pageerror/console.error */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = process.cwd();
const PORT = 9400 + Math.floor(Math.random() * 80);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-sentlist-'));
const SHOTS = path.join(ROOT, 'output/e2e/shots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const server = spawn(process.execPath, ['index.js'], {
  cwd: path.join(ROOT, 'server'),
  env: Object.assign({}, process.env, {
    CHUNKLAB_DATA_DIR: TMP_DB,
    PORT: String(PORT)
  }),
  stdio: 'ignore'
});

let pass = 0, fail = 0;
function check(label, ok, detail) {
  if (ok) { pass++; console.log('  PASS', label); }
  else { fail++; console.log('  FAIL', label, '|', JSON.stringify(detail || {}).slice(0, 240)); }
}

setTimeout(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
  });

  /* ===== Case 1：内置大题库（~339 句）+ 部分练习过 + 部分标熟 ===== */
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const errs = [];
  ctx.on('weberror', e => errs.push('weberror: ' + e.error().message));

  /* addInitScript 在每次 navigation 都跑，reload 会再次清 localStorage —— 改用 page.evaluate 手动清 */
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  /* errs 只收「应用自身」的错误：本脚本主动 route.abort() 掉的 /api/* 会触发
     console.error "Failed to load resource: net::ERR_FAILED"，那是测试自身制造的噪音，不是回归 */
  page.on('console', m => { if (m.type() === 'error' && m.text().indexOf('Failed to load resource') < 0) errs.push('console.error: ' + m.text()); });

  /* 关键：abort /api/config → ensureCloud 走"服务器不可达" catch 分支，跳过 syncFromCloud，
     否则 syncFromCloud 会用云端空 stats 覆盖本地种子 */
  await page.route('**/api/config', route => route.abort());
  await page.route('**/api/data', route => route.abort());
  await page.route('**/api/ai/**', route => route.abort());

  /* Phase 1: navigate 到 stats.html，让 builtins/oral8000/freq-idioms 加载完 */
  await page.goto('http://127.0.0.1:' + PORT + '/stats.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.evaluate(() => localStorage.clear());

  /* Phase 2: page.evaluate 注入种子到 localStorage */
  await page.evaluate(() => {
    var decks = (window.BUILTIN || []);
    var allItems = [];
    decks.forEach(function(d){
      (d.items || []).forEach(function(it){
        if(it && it.sentence && it.chunks) allItems.push({deckId: d.id, sentence: it.sentence, translation: it.translation || '', cid: it.cid || ''});
      });
    });
    var by = {}, mastered = {}, deletedItems = {};
    /* 删 1 句内置 */
    if(allItems[5]){
      deletedItems[allItems[5].deckId + '#' + allItems[5].cid] = true;
    }
    /* 练过 60 句：8 master + 42 learn + 10 weak
       注意：classifyStat master 条件 = times>=3 AND acc>=0.8。
       learn 必须用 acc 在 [0.6, 0.8) 才能进入 learn 分支（例 times=4 okTimes=3 → acc=0.75）。 */
    allItems.slice(0, 60).forEach(function(it, idx){
      var key = it.deckId + '#' + it.cid;
      var klass = idx < 8 ? 'master' : (idx < 50 ? 'learn' : 'weak');
      var times, okTimes, wrongTimes;
      if(klass === 'master'){ times = 4; okTimes = 4; wrongTimes = 0; }
      else if(klass === 'learn'){ times = 4; okTimes = 3; wrongTimes = 1; }  /* acc = 0.75 → learn */
      else { times = 4; okTimes = 1; wrongTimes = 3; }                       /* acc = 0.25 → weak */
      by[key] = {
        deckId: it.deckId, sentence: it.sentence, deckName: '',
        times: times, okTimes: okTimes, wrongTimes: wrongTimes,
        streak: klass === 'master' ? 4 : (klass === 'weak' ? 0 : 1),
        maxStreak: klass === 'master' ? 4 : (klass === 'weak' ? 1 : 1),
        lastAt: Date.now() - idx * 60000, interval: 1, ease: 2.5, dueAt: 0
      };
      if(klass === 'master') mastered[key] = { markedAt: Date.now() - idx * 60000 };
    });
    /* 额外标熟 1 句：纯标熟，从未练过（item 来自 idx 100） */
    if(allItems[100]){
      mastered[allItems[100].deckId + '#' + allItems[100].cid] = { markedAt: Date.now() - 999999 };
    }
    var mem = { version: 2, settings: {}, decks: [], deletedItems: deletedItems,
      best: {}, mastered: mastered,
      stats: { totalRounds: 1, totalAnswered: 60, bySentence: by, events: [] } };
    window.__TEST_TOTAL__ = allItems.length;
    localStorage.setItem('chunklab.v1', JSON.stringify(mem));
  });

  /* Phase 3: reload 让 stats.html 读最新 localStorage */
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#statsBody .stats-list', { timeout: 10000 });
  await page.waitForTimeout(400);

  /* 取实际 BUILTIN 总句数（reload 后 window 状态已重置，从 BUILTIN 重算） */
  const totalInBuiltin = await page.evaluate(function(){
    var decks = window.BUILTIN || [];
    var n = 0;
    decks.forEach(function(d){ (d.items || []).forEach(function(it){ if(it && it.sentence && it.chunks) n++; }); });
    return n;
  });

  /* deleted 命中 idx=5（master），它从练过 60 句里掉 1（剩 59），从 master 8 掉 1（剩 7） */
  const expectedTotal = totalInBuiltin - 1;                              /* 1 deleted */
  const expectedPracticed = 60 - 1;                                     /* idx=5 deleted 后剩 59 */
  const expectedMaster = 8 - 1;                                         /* idx=5 是 master，删了剩 7 */
  const expectedUnseen = totalInBuiltin - 1 - expectedPracticed - 1;   /* 1 deleted - 59 practiced - 1 pureMastered */
  const expectedMastered = expectedMaster + 1;                          /* 7 master + 1 pureMastered */
  const expectedWeak = 10;

  /* ===== 1. 「全部」tab（默认 on）===== */
  let info = await page.evaluate(function(){
    var rows = document.querySelectorAll('#statsBody .stats-list .srow');
    var badges = Array.from(rows).map(function(r){ return r.querySelector('.badge').textContent; });
    return { count: rows.length, badges: badges };
  });
  console.log('CASE 1.1 全部:', info.count, '行');
  check('全部 tab 行数 = 全集 - deleted', info.count === expectedTotal, { got: info.count, expected: expectedTotal });
  check('全部 tab 含未练过 badge', info.badges.indexOf('未练过') >= 0, { badges: info.badges.length });
  check('全部 tab 含已标记 badge（只标熟未练过）',
    info.badges.indexOf('已标记') >= 0, { badges: info.badges.length });
  check('全部 tab 含熟练/学习中/需巩固 badge',
    info.badges.indexOf('熟练') >= 0 && info.badges.indexOf('学习中') >= 0 && info.badges.indexOf('需巩固') >= 0,
    { badges: info.badges.length });

  /* ===== 2. 排序：前 N 行应该是「已标记」或「熟练」（master 优先）=====
     expectedMaster 是真正分类为 master 的行数（7），不包括 _masteredOnly 那条纯标熟未练过 */
  let topN = info.badges.slice(0, expectedMaster);
  console.log('CASE 1.2 排序前', expectedMaster, ':', topN);
  check('排序：前 ' + expectedMaster + ' 行都是熟练',
    topN.every(function(b){ return b === '熟练'; }),
    { topN: topN });
  check('排序：第 ' + (expectedMaster + 1) + ' 行不是 master（learn 开始）',
    info.badges[expectedMaster] !== '熟练' && info.badges[expectedMaster] !== '已标记',
    { badge: info.badges[expectedMaster] });

  /* ===== 3. 切换「未练过」tab ===== */
  await page.click('.stats-filter .f[data-f="unseen"]');
  await page.waitForTimeout(300);
  info = await page.evaluate(function(){
    var rows = document.querySelectorAll('#statsBody .stats-list .srow');
    var badges = Array.from(rows).map(function(r){ return r.querySelector('.badge').textContent; });
    var sentences = Array.from(rows).map(function(r){ return r.querySelector('.en').textContent; });
    return { count: rows.length, badges: badges, sentences: sentences };
  });
  console.log('CASE 1.3 未练过:', info.count, '行');
  check('未练过 tab 行数 > 0（不再是空）', info.count > 0, { got: info.count });
  check('未练过 tab 全是「未练过」badge',
    info.badges.every(function(b){ return b === '未练过'; }),
    { badCount: info.badges.filter(function(b){ return b !== '未练过'; }).length });
  check('未练过 tab 行数 = ' + expectedUnseen + '（全集 - 1 deleted - 60 practiced - 1 pureMastered）',
    info.count === expectedUnseen, { got: info.count, expected: expectedUnseen });

  /* ===== 4. 「已熟」tab ===== */
  await page.click('.stats-filter .f[data-f="mastered"]');
  await page.waitForTimeout(300);
  info = await page.evaluate(function(){
    var rows = document.querySelectorAll('#statsBody .stats-list .srow');
    var badges = Array.from(rows).map(function(r){ return r.querySelector('.badge').textContent; });
    return { count: rows.length, badges: badges };
  });
  console.log('CASE 1.4 已熟:', info.count, '行');
  check('已熟 tab 行数 = ' + expectedMastered + '（8 练过 master + 1 只标熟未练过）',
    info.count === expectedMastered, { got: info.count, expected: expectedMastered });
  check('已熟 tab 全是熟练/已标记 badge',
    info.badges.every(function(b){ return b === '熟练' || b === '已标记'; }),
    { badCount: info.badges.filter(function(b){ return b !== '熟练' && b !== '已标记'; }).length });

  /* ===== 5. 「需巩固」tab ===== */
  await page.click('.stats-filter .f[data-f="weak"]');
  await page.waitForTimeout(300);
  info = await page.evaluate(function(){
    var rows = document.querySelectorAll('#statsBody .stats-list .srow');
    var badges = Array.from(rows).map(function(r){ return r.querySelector('.badge').textContent; });
    return { count: rows.length, badges: badges };
  });
  console.log('CASE 1.5 需巩固:', info.count, '行');
  check('需巩固 tab 行数 = ' + expectedWeak,
    info.count === expectedWeak, { got: info.count, expected: expectedWeak });
  check('需巩固 tab 全是需巩固 badge',
    info.badges.every(function(b){ return b === '需巩固'; }),
    { badCount: info.badges.filter(function(b){ return b !== '需巩固'; }).length });

  /* ===== 6. KPI 与 list 一致 ===== */
  await page.click('.stats-filter .f[data-f="all"]');
  await page.waitForTimeout(300);
  const summary = await page.evaluate(function(){
    var cards = document.querySelectorAll('#statsCards .stat-card');
    var kpis = {};
    cards.forEach(function(c){
      var k = c.querySelector('.k'); var v = c.querySelector('.v');
      if (k && v) kpis[k.textContent] = v.textContent;
    });
    return { kpis: kpis };
  });
  console.log('CASE 1.6 KPI:', summary.kpis);
  check('熟练句子 KPI = ' + expectedMaster, summary.kpis['熟练句子'] === String(expectedMaster), summary.kpis);
  check('需巩固 KPI = 10', summary.kpis['需巩固'] === '10', summary.kpis);

  /* ===== 7. 截图存档 ===== */
  await page.click('.stats-filter .f[data-f="unseen"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, 'sentlist-unseen-fixed.png'), fullPage: false });

  /* ===== Case 2：完全空题库（删光所有内置题 + decks=[]）边界 =====
     实现技巧：不能用 Object.defineProperty(window, 'BUILTIN') 覆盖，
     因为 builtins.js 加载时会重新赋值。最稳的做法是 deletedItems 把全部内置题标删 + decks=[] */
  await ctx.close();
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const errs2 = [];
  ctx2.on('weberror', e => errs2.push('weberror: ' + e.error().message));
  /* 不设 addInitScript（避免 reload 时再次清空），改为手动 clear */
  const page2 = await ctx2.newPage();
  page2.on('pageerror', e => errs2.push('pageerror: ' + e.message));
  await page2.route('**/api/config', route => route.abort());
  await page2.route('**/api/data', route => route.abort());
  await page2.goto('http://127.0.0.1:' + PORT + '/stats.html', { waitUntil: 'networkidle' });
  await page2.waitForTimeout(500);
  await page2.evaluate(() => localStorage.clear());
  await page2.waitForTimeout(500);
  await page2.waitForTimeout(500);
  await page2.evaluate(() => {
    /* fnv8 哈希（与 core.js fnv8 完全一致），用于兜底无 cid 的 item */
    function fnv8(str){
      var h = 0x811c9dc5;
      str = String(str == null ? '' : str);
      for(var i = 0; i < str.length; i++){
        h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
      }
      var hex = (h >>> 0).toString(16);
      while(hex.length < 8) hex = '0' + hex;
      return hex;
    }
    var decks = (window.BUILTIN || []);
    var deletedItems = {};
    decks.forEach(function(d){
      (d.items || []).forEach(function(it){
        if(it && it.sentence && it.chunks){
          var cid = it.cid || fnv8(it.sentence);
          deletedItems[d.id + '#' + cid] = true;
        }
      });
    });
    var mem = { version: 2, settings: {}, decks: [], deletedItems: deletedItems,
      best: {}, mastered: {},
      stats: { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] } };
    localStorage.setItem('chunklab.v1', JSON.stringify(mem));
  });
  await page2.reload({ waitUntil: 'networkidle' });
  await page2.waitForTimeout(800);
  const empty = await page2.evaluate(function(){
    var tip = document.querySelector('#statsBody .empty-tip');
    return tip ? tip.textContent : '(no empty-tip)';
  });
  console.log('CASE 2 空题库文案:', empty);
  check('空题库 → 显示引导文案', empty.indexOf('题库里还没有任何句子') >= 0, { got: empty });
  await ctx2.close();

  console.log('---');
  console.log('结果:', pass + '/' + (pass + fail));
  console.log('errs:', errs.length, errs2.length, errs.concat(errs2).slice(0, 3));

  await browser.close();
  server.kill();
  process.exit(fail > 0 || errs.length > 0 || errs2.length > 0 ? 1 : 0);
}, 1500);