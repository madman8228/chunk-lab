'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ||
      'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
  });

  /* 构造场景：23 句到期、batchSize=5 */
  const seed = `
localStorage.clear();
(function(){
  var items = [];
  for(var i=0;i<25;i++){
    var c1 = 'word'+(i*3+1), c2 = 'word'+(i*3+2), c3 = 'word'+(i*3+3);
    items.push({ sentence: c1+' '+c2+' '+c3+'.', translation: '句'+(i+1), chunks: [c1,c2,c3+'.'], hints: ['','',''] });
  }
  /* cidKey = deckId + '#' + fnv8(sentence) —— 必须在页面环境算，注入到 initScript 前不可用 CL */
  function fnv8(str){
    var h = 0x811c9dc5;
    for(var i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = (h + ((h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24))) >>> 0; }
    return h.toString(16);
  }
  var now = Date.now();
  var by = {};
  for(var i=0;i<23;i++){
    var key = 'd1#' + fnv8(items[i].sentence);
    by[key] = { deckId:'d1', sentence: items[i].sentence, translation:items[i].translation, times:1, okTimes:1, wrongTimes:0, streak:1, maxStreak:1, interval:1, ease:2.5, dueAt: now-10000, lastAt: now-100000 };
  }
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2, reinforceBook: [],
    decks: [{ id:'d1', name:'批量到期测试', items: items }],
    best: {}, mastered: {}, deletedItems: {},
    stats: { totalRounds:0, totalAnswered:23, bySentence: by, events:[], daysLog: {} },
    settings: { mode:'choose', shuffle:false, skipMastered:true, batchSize:5, fxStack:true, celebrate:'confetti', autoSpeak:false, sound:false }
  }));
})();`;

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript({ content: seed });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && m.text().indexOf('Failed to load resource') < 0) errs.push('console.error: ' + m.text()); });
  await page.goto('http://localhost:8896/main.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  /* debug: 看页面状态 */
  const dbg = await page.evaluate(function () {
    return {
      url: location.href,
      hasHomePage: !!document.getElementById('pageHome'),
      homeBodyHTML: (document.getElementById('homeBody') || {}).innerHTML ? document.getElementById('homeBody').innerHTML.slice(0, 400) : '(empty)',
      memStatsByKeys: window.mem && window.mem.stats ? Object.keys(window.mem.stats.bySentence || {}).length : 'no mem',
      t_due: window.t ? window.t.due : 'no t'
    };
  });
  console.log('DEBUG:', JSON.stringify(dbg, null, 0));

  await page.waitForSelector('#homeBtnDue', { timeout: 5000 }).catch(function(){});
  await page.waitForTimeout(500);

  /* 校验按钮文案 */
  const btnText = await page.evaluate(function () {
    var b = document.getElementById('homeBtnDue');
    return b ? b.textContent.trim() : null;
  });
  console.log('按钮文案:', JSON.stringify(btnText));

  /* 校验标题 */
  const titleText = await page.evaluate(function () {
    var t = document.querySelector('.home-today-t');
    return t ? t.textContent.trim() : null;
  });
  console.log('标题文案:', JSON.stringify(titleText));

  /* 校验到期计数 */
  const dueCount = await page.evaluate(function () {
    var e = document.querySelector('.htc.due .n');
    return e ? e.textContent.trim() : null;
  });
  console.log('到期计数:', JSON.stringify(dueCount));

  await page.screenshot({ path: path.join(SHOTS, 'due-button-fix.png'), fullPage: false });

  if (btnText && /先练\s*5\s*\/\s*共\s*23/.test(btnText)) console.log('✓ 按钮文案含「先练 5 / 共 23」');
  else console.log('✗ 按钮文案异常', btnText);
  if (titleText && /23/.test(titleText)) console.log('✓ 标题含 23 句');
  if (dueCount === '23') console.log('✓ 到期计数 23');
  if (errs.length === 0) console.log('✓ 零 pageerror/console.error');
  else console.log('✗ 错误:', errs);

  await ctx.close();
  await browser.close();
})();