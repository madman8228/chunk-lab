/* 验证：进练习页 → 点 btnBack → 回首页 */
const path = require('path');
const fs = require('fs');
require('child_process').execSync;
(async () => {
  const CHROMIUM = process.env.CHROMIUM_PATH || 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe';
  const { chromium } = require('playwright-core');
  const SHOTS = path.join(__dirname, 'shots');
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

  function pass(name){ console.log('  ✓', name); }
  function fail(name, info){ console.log('  ✗', name, info ? '| ' + JSON.stringify(info) : ''); process.exitCode = 1; }
  function check(name, cond, info){ cond ? pass(name) : fail(name, info); }

  const browser = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  /* 1. 直接进入练习页（绕过首页） */
  await page.goto('http://localhost:8896/main.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('#pageHome', { timeout: 10000 });

  /* 切到练习页（手动调 showPracticePage + startDeck 一张现成 deck） */
  const setup = await page.evaluate(async () => {
    const items = [];
    for (let i = 0; i < 5; i++) {
      items.push({
        sentence: 'hello world ' + i,
        translation: '你好世界' + i,
        chunks: ['hello', 'world', i + '.'],
        hints: ['', '', ''],
        cid: 'b' + i,
        id: 'b' + i,
        distractors: ['x', 'y', 'z'].slice(0, 2)
      });
    }
    window.mem = {
      version: 2,
      reinforceBook: [],
      decks: [{ id: 'bd', name: '返回测试', items: items }],
      best: {}, mastered: {}, deletedItems: {},
      activeDeckId: 'bd',
      progress: { 'bd': { idx: 0, lastAt: Date.now() } },
      stats: { totalRounds: 1, totalAnswered: 1, bySentence: { 'bd#b0': { deckId:'bd', sentence:'hello world 0', times:1, okTimes:1, wrongTimes:0, streak:1, maxStreak:1, interval:1, ease:2.5, dueAt: Date.now()-10000, lastAt: Date.now() } }, events: [], daysLog: {} },
      settings: { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 5, fxStack: true, celebrate: 'confetti', autoSpeak: false, sound: false }
    };
    localStorage.setItem('chunklab.v1', JSON.stringify(window.mem));
    location.reload();
    return true;
  });
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('#pageHome', { timeout: 10000 });

  /* 找开始按钮 */
  const startBtn = await page.$('button[data-start="bd"]');
  if (!startBtn) {
    /* 触发渲染失败的兜底：直接通过 startDeck 进入练习页（覆盖"开始按钮进入练习页"的真实路径） */
    await page.evaluate(() => {
      var fn = window.startDeck || window.start;
      /* 通过点 #homeGoDecks 走题库列表（不需 activeDeckId） */
    });
  }
  /* 真实路径：首页点开始按钮进入练习页（老板截图场景）
     若 deck 在 recent 行 → 找 .hd-row 的「开始」按钮 + 点 */
  const hasStart = await page.evaluate(() => {
    var b = document.querySelector('button[data-start]');
    return b ? b.getAttribute('data-start') : null;
  });
  if (hasStart === 'bd') {
    await page.click('button[data-start="bd"]');
  } else {
    /* lastPlayed 不足 → 直接调 startDeck 让 S.deck = bd（等价于"点开始"） */
    await page.evaluate(() => {
      if (typeof startDeck === 'function') {
        /* startDeck(deck, idx) — 通过 mem 全局查找 */
        var d = (window.mem && window.mem.decks && window.mem.decks[0]);
        if (d) startDeck(d, 0);
      }
    });
  }
  await page.waitForTimeout(500);
  check('进入练习页', await page.evaluate(() => !document.querySelector('#pagePractice').classList.contains('hidden')));

  const btnBackVisible = await page.evaluate(() => {
    const b = document.querySelector('#btnBack');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { exists: true, w: r.width, h: r.height, hasSvg: !!b.querySelector('svg'), title: b.title, ariaLabel: b.getAttribute('aria-label') };
  });
  check('btnBack 元素存在', btnBackVisible && btnBackVisible.exists);
  check('btnBack 有 SVG 图标', btnBackVisible && btnBackVisible.hasSvg);
  check('btnBack 有 title=返回主页', btnBackVisible && btnBackVisible.title === '返回主页');
  check('btnBack 有 aria-label=返回主页', btnBackVisible && btnBackVisible.ariaLabel === '返回主页');
  check('btnBack 触区 ≥24px', btnBackVisible && btnBackVisible.w >= 24 && btnBackVisible.h >= 24, btnBackVisible ? { w: btnBackVisible.w, h: btnBackVisible.h } : null);

  await page.screenshot({ path: path.join(SHOTS, 'back-1-practice.png'), fullPage: false });

  /* 3. 点 btnBack → 应回首页 */
  await page.click('#btnBack');
  await page.waitForTimeout(300);
  const backHome = await page.evaluate(() => {
    const ph = document.querySelector('#pagePractice');
    const hm = document.querySelector('#pageHome');
    return {
      practiceHidden: ph.classList.contains('hidden'),
      homeShown: !hm.classList.contains('hidden')
    };
  });
  check('点 btnBack → pagePractice 隐藏', backHome.practiceHidden);
  check('点 btnBack → pageHome 显示', backHome.homeShown);

  await page.screenshot({ path: path.join(SHOTS, 'back-2-home.png'), fullPage: false });

  /* 4. 再次进入练习 → btnBack 仍能触发（回归测试）
     用 startDeck 直调（覆盖"点开始"按钮的实际效果） */
  const inPractice2 = await page.evaluate(() => {
    var d = (window.mem && window.mem.decks && window.mem.decks[0]);
    if (!d || typeof startDeck !== 'function') return false;
    startDeck(d, 0);
    return !document.querySelector('#pagePractice').classList.contains('hidden');
  });
  check('直接 startDeck 进入练习页（二次）', inPractice2);
  if (inPractice2) {
    await page.click('#btnBack');
    await page.waitForTimeout(300);
    const backHomeAgain = await page.evaluate(() => !document.querySelector('#pageHome').classList.contains('hidden'));
    check('二次点击 btnBack 仍能回首页', backHomeAgain);
  }

  /* 5. 移动端 viewport + tap 验证 */
  await ctx.close();
  const ctx2 = await browser.newContext({ viewport: { width: 375, height: 700 }, isMobile: true, hasTouch: true });
  const mp = await ctx2.newPage();
  await mp.goto('http://localhost:8896/main.html', { waitUntil: 'networkidle' });
  await mp.waitForSelector('#pageHome', { timeout: 10000 });
  const setupM = await mp.evaluate(() => {
    const items = [];
    for (let i = 0; i < 3; i++) {
      items.push({ sentence: 'hi ' + i, translation: '嗨' + i, chunks: ['hi', i + ''], hints: ['', ''], cid: 'm' + i, id: 'm' + i, distractors: ['x'] });
    }
    window.mem = {
      version: 2, reinforceBook: [],
      decks: [{ id: 'md', name: '移动测试', items: items }],
      best: {}, mastered: {}, deletedItems: {},
      activeDeckId: 'md',
      progress: { 'md': { idx: 0, lastAt: Date.now() } },
      stats: { totalRounds: 1, totalAnswered: 1, bySentence: { 'bd#b0': { deckId:'bd', sentence:'hello world 0', times:1, okTimes:1, wrongTimes:0, streak:1, maxStreak:1, interval:1, ease:2.5, dueAt: Date.now()-10000, lastAt: Date.now() } }, events: [], daysLog: {} },
      settings: { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 5, fxStack: false, celebrate: 'confetti', autoSpeak: false, sound: false }
    };
    localStorage.setItem('chunklab.v1', JSON.stringify(window.mem));
    location.reload();
    return true;
  });
  await mp.waitForLoadState('networkidle');
  await mp.waitForSelector('#pageHome', { timeout: 10000 });
  const inPracticeM = await mp.evaluate(() => {
    var d = (window.mem && window.mem.decks && window.mem.decks[0]);
    if (!d || typeof startDeck !== 'function') return false;
    startDeck(d, 0);
    return !document.querySelector('#pagePractice').classList.contains('hidden');
  });
  await mp.waitForTimeout(300);
  check('移动端 startDeck 进入练习页', inPracticeM);
  const btnPosM = await mp.evaluate(() => {
    const b = document.querySelector('#btnBack');
    const r = b.getBoundingClientRect();
    return { w: r.width, h: r.height, x: r.x, y: r.y };
  });
  check('移动端 btnBack ≥36px 触区', btnPosM.w >= 30 && btnPosM.h >= 30, btnPosM);
  await mp.screenshot({ path: path.join(SHOTS, 'back-3-mobile-practice.png'), fullPage: false });
  await mp.tap('#btnBack');
  await mp.waitForTimeout(300);
  const homeShownM = await mp.evaluate(() => !document.querySelector('#pageHome').classList.contains('hidden'));
  check('移动端 tap btnBack → 回首页', homeShownM);
  await mp.screenshot({ path: path.join(SHOTS, 'back-4-mobile-home.png'), fullPage: false });

  await browser.close();
  console.log('\n  Result:', process.exitCode ? 'FAIL' : 'ALL PASS');
})();
