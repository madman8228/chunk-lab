/**
 * autospeak-verify.js · 「自动朗读」接通端到端验证（2026-09-08）
 *
 * 根因：设置面板「自动朗读」开关存在但只有 setter 无 trigger；
 *       修复后：finishSentence 末尾按 mem.settings.autoSpeak 自动 speakSentence()。
 *
 * 验证点：
 *   1. autoSpeak=true → 答完一题 → speechSynthesis.speak 触发 1 次，文本 = 当前句
 *   2. autoSpeak=true → 答完下一题 → speak 累计 2 次（切题时 cancel，新题 speak 重新计 1）
 *   3. autoSpeak=false → 答完一题 → speak 不再增加（手动点击 btnSpeak 仍可触发）
 *   4. speechSynthesis 注入监控不能影响正常播放逻辑（window.speechSynthesis 仍可用）
 *   5. 关闭音效（sound=false）不影响 autoSpeak 决策（autoSpeak 是独立开关）
 *   6. 零 pageerror / 零 console.error
 *
 * 依赖：playwright-core + chromium headless shell + 临时 server（与 icons-smoke 同模式）
 * 运行：node output/e2e/autospeak-verify.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const PORT = 9100 + Math.floor(Math.random() * 80);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-autospeak-'));
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
      if (tries > 40) { clearInterval(iv); reject(new Error('server start timeout')); }
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
  else { failed++; console.log('  ✗ ' + name + (detail ? '  → ' + JSON.stringify(detail) : '')); }
}

/**
 * 注入 speechSynthesis 监控：在 speak/cancel 上挂计数（不破坏真身）
 * 通过 addInitScript 在每个新 context 的每个页加载前生效。
 */
const TTS_MONITOR = `
(function(){
  if (window.__ttsMon) return;
  window.__ttsMon = { speak: [], cancel: 0 };
  var origSpeak = window.SpeechSynthesisUtterance;
  // 不替换原构造器，只在 speak/cancel 上挂计数
  var _origSpeak = window.speechSynthesis && window.speechSynthesis.speak;
  var _origCancel = window.speechSynthesis && window.speechSynthesis.cancel;
  if (_origSpeak) {
    window.speechSynthesis.speak = function(u){
      window.__ttsMon.speak.push({ text: u && u.text, lang: u && u.lang, rate: u && u.rate });
      try { return _origSpeak.call(window.speechSynthesis, u); } catch(e){}
    };
  }
  if (_origCancel) {
    window.speechSynthesis.cancel = function(){
      window.__ttsMon.cancel++;
      try { return _origCancel.call(window.speechSynthesis); } catch(e){}
    };
  }
})();
`;

/** 注入种子 mini deck（autoSpeak=true，4 题 + skipMastered=false） */
const SEED_AUTOSPEAK_ON = `
localStorage.clear();
localStorage.setItem('chunklab.v1', JSON.stringify({
  version: 2, reinforceBook: [],
  decks: [{ id: 'autospeak-mini', name: 'AutoSpeak 迷你题库', items: [
    { sentence: 'I would like to check in please.', translation: '我想办理入住。',
      chunks: ['I would like to', 'check in', 'please.'], hints: ['', '', ''],
      cid: 'as-mini-a', grammar: null },
    { sentence: 'Could you help me carry this.', translation: '能帮我搬一下这个吗。',
      chunks: ['Could you', 'help me', 'carry this.'], hints: ['', '', ''],
      cid: 'as-mini-b', grammar: null },
    { sentence: 'Where is the nearest subway station.', translation: '最近的地铁站在哪。',
      chunks: ['Where is', 'the nearest', 'subway station.'], hints: ['', '', ''],
      cid: 'as-mini-c', grammar: null },
    { sentence: 'Have a nice weekend.', translation: '周末愉快。',
      chunks: ['Have a', 'nice weekend.'], hints: ['', ''],
      cid: 'as-mini-d', grammar: null }
  ] }],
  best: {}, mastered: {}, deletedItems: {},
  stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} },
  settings: { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 10,
             fxStack: true, celebrate: 'off', autoSpeak: true, sound: true }
}));
sessionStorage.setItem('_startDeck', JSON.stringify({ id: 'autospeak-mini', name: 'AutoSpeak 迷你题库', items: [
  { sentence: 'I would like to check in please.', translation: '我想办理入住。', chunks: ['I would like to', 'check in', 'please.'], hints: ['', '', ''] },
  { sentence: 'Could you help me carry this.', translation: '能帮我搬一下这个吗。', chunks: ['Could you', 'help me', 'carry this.'], hints: ['', '', ''] },
  { sentence: 'Where is the nearest subway station.', translation: '最近的地铁站在哪。', chunks: ['Where is', 'the nearest', 'subway station.'], hints: ['', '', ''] },
  { sentence: 'Have a nice weekend.', translation: '周末愉快。', chunks: ['Have a', 'nice weekend.'], hints: ['', ''] }
] }));
`;

/** 注入种子 mini deck（autoSpeak=false） */
const SEED_AUTOSPEAK_OFF = SEED_AUTOSPEAK_ON.replace('autoSpeak: true', 'autoSpeak: false');

/** 真实答完一题（choose 模式点对所有 chunk）
 * 正确答案按钮 class="choice"（不带 distractor）；distractor class="choice distractor" */
async function answerOneQ(page) {
  await page.evaluate(function () {
    var it = cur();
    if (!it) return;
    var chunks = it.chunks.slice();
    chunks.forEach(function (target) {
      var btns = document.querySelectorAll('#stageChoices .choice:not(.distractor)');
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.trim() === target) {
          btns[i].click();
          return;
        }
      }
    });
  });
  await page.waitForTimeout(300);
}

/** 模拟错 1 自纠：先点错（distractor），再点对所有 chunk —— 触发非 perfect 分支 */
async function answerOneQWorseThenFix(page) {
  await page.evaluate(function () {
    var it = cur();
    if (!it) return;
    var d0 = document.querySelector('#stageChoices .choice.distractor');
    if (d0) d0.click();
    // 把剩余未 ok 的 chunks 全部点对
    it.chunks.forEach(function (target) {
      var btns = document.querySelectorAll('#stageChoices .choice:not(.distractor)');
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.trim() === target) {
          btns[i].click();
          return;
        }
      }
    });
  });
  await page.waitForTimeout(300);
}

/** 答完一题后跳下一题（若已是末题则跳过）
 * 完美路径 btnNext 要等 renderAnalysis(900ms 后) 才显示，需轮询 */
async function nextQ(page) {
  const visible = await page.evaluate(function () {
    return new Promise(function (resolve) {
      var dl = Date.now();
      var iv = setInterval(function () {
        var nb = document.getElementById('btnNext');
        if (nb && !nb.classList.contains('hidden')) { clearInterval(iv); resolve(true); }
        else if (document.getElementById('result') && !document.getElementById('result').classList.contains('hidden')) { clearInterval(iv); resolve('finished'); }
        else if (Date.now() - dl > 1500) { clearInterval(iv); resolve(false); }
      }, 50);
    });
  });
  if (visible !== true) return visible === 'finished' ? 'finished' : false;
  // 停掉自动倒计时，避免下一句自动跳过；再显式 click
  await page.evaluate(function () {
    if (typeof stopAutoNext === 'function') stopAutoNext();
    var nb = document.getElementById('btnNext');
    if (nb && !nb.classList.contains('hidden')) nb.click();
  });
  await page.waitForTimeout(300);
  return true;
}

/** 等待 stageChoices 出现（除非已 finishSession） */
async function waitStage(page, timeout) {
  return await page.evaluate(function (t) {
    return new Promise(function (resolve) {
      var dl = Date.now();
      var iv = setInterval(function () {
        if (document.querySelector('#stageChoices .choice')) { clearInterval(iv); resolve(true); }
        else if (document.getElementById('result') && !document.getElementById('result').classList.contains('hidden')) { clearInterval(iv); resolve(false); }
        else if (Date.now() - dl > t) { clearInterval(iv); resolve(false); }
      }, 50);
    });
  }, timeout);
}

/** 读取当前 TTS 监控状态 */
async function getTts(page) {
  return await page.evaluate(function () { return window.__ttsMon || null; });
}

/** 把监控清零（避免累积误判） */
async function resetTts(page) {
  await page.evaluate(function () {
    if (window.__ttsMon) { window.__ttsMon.speak = []; window.__ttsMon.cancel = 0; }
  });
}

(async function () {
  await startServer();
  const base = 'http://127.0.0.1:' + PORT + '/';
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ||
      'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
  });

  try {
    /* =================== Case 1: autoSpeak=true → 答完自动 speak =================== */
    console.log('== Case 1: autoSpeak=true 答完自动朗读 ==');
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
      await ctx.addInitScript({ content: TTS_MONITOR + SEED_AUTOSPEAK_ON });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push('pageerror: ' + e.message));
      page.on('console', m => { if (m.type() === 'error' && m.text().indexOf('Failed to load resource') < 0) errs.push('console.error: ' + m.text()); });
      await page.goto(base + 'main.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#stageChoices .choice', { timeout: 12000 });
      await page.waitForTimeout(600);

      // 题 1：错 1 自纠走非 perfect 分支（用此分支确认 autoSpeak 也生效，覆盖两个路径）
      await resetTts(page);
      let curSentence = await page.evaluate(function () { var it = (typeof cur === 'function') ? cur() : null; return it && it.sentence; });
      await answerOneQWorseThenFix(page);
      let mon = await getTts(page);
      check('Q1 答完→speak 触发 1 次', mon && mon.speak.length === 1, mon && { n: mon.speak.length });
      check('Q1 speak 文本非空且 = 当前句',
        mon && mon.speak.length === 1 && mon.speak[0].text && mon.speak[0].text === curSentence,
        { sp: mon && mon.speak[0] && mon.speak[0].text, cur: curSentence });
      check('Q1 speak.lang = en-US', mon && mon.speak[0] && mon.speak[0].lang === 'en-US', mon && mon.speak[0]);
      check('Q1 speak.rate = 0.92', mon && mon.speak[0] && Math.abs(mon.speak[0].rate - 0.92) < 0.001, mon && mon.speak[0]);

      // 题 2：完美答完（perfect 路径）
      await nextQ(page);
      var has2 = await waitStage(page, 8000);
      check('Q1→Q2 渲染 stageChoices', has2);
      await resetTts(page);
      curSentence = await page.evaluate(function () { var it = (typeof cur === 'function') ? cur() : null; return it && it.sentence; });
      await answerOneQ(page);
      mon = await getTts(page);
      check('Q2 完美答完→speak 触发 1 次', mon && mon.speak.length === 1, mon && { n: mon.speak.length });
      check('Q2 speak 文本 = 当前句',
        mon && mon.speak[0].text && mon.speak[0].text === curSentence,
        { sp: mon && mon.speak[0] && mon.speak[0].text, cur: curSentence });

      // 切下一题：cancel 应被触发（renderQ 里的清理）
      await resetTts(page);
      var nextResult = await nextQ(page);
      if (nextResult === true) {
        var has3 = await waitStage(page, 8000);
        check('Q2→Q3 渲染 stageChoices', has3);
        mon = await getTts(page);
        check('renderQ 切题触发 speechSynthesis.cancel', mon && mon.cancel >= 1, mon && { c: mon.cancel });

        // Q3 答完：再触发一次 speak（确认多题累积稳定）
        await resetTts(page);
        curSentence = await page.evaluate(function () { var it = (typeof cur === 'function') ? cur() : null; return it && it.sentence; });
        await answerOneQ(page);
        mon = await getTts(page);
        check('Q3 答完→speak 触发 1 次', mon && mon.speak.length === 1, mon && { n: mon.speak.length });
      } else if (nextResult === 'finished') {
        console.log('  · Q2 已是末题（skipMastered 过滤后 < 3 题），跳过 Q3 / cancel 验证');
      } else {
        check('Q2 后 btnNext 未在 1.5s 内显示', false, 'btnNext 一直 hidden');
      }

      check('零 pageerror/console.error', errs.length === 0, errs.join(' | '));

      await page.screenshot({ path: path.join(SHOTS, 'autospeak-on-q3.png') });
      await ctx.close();
    }

    /* =================== Case 2: autoSpeak=false → 不自动 speak（手动点仍可） =================== */
    console.log('== Case 2: autoSpeak=false 答完不自动朗读 ==');
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
      await ctx.addInitScript({ content: TTS_MONITOR + SEED_AUTOSPEAK_OFF });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push('pageerror: ' + e.message));
      page.on('console', m => { if (m.type() === 'error' && m.text().indexOf('Failed to load resource') < 0) errs.push('console.error: ' + m.text()); });
      await page.goto(base + 'main.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#stageChoices .choice', { timeout: 12000 });
      await page.waitForTimeout(600);

      await resetTts(page);
      let curSentence = await page.evaluate(function () { var it = (typeof cur === 'function') ? cur() : null; return it && it.sentence; });
      await answerOneQ(page);
      let mon = await getTts(page);
      check('autoSpeak=false→答完 speak 不触发', mon && mon.speak.length === 0, mon && { n: mon.speak.length });

      // 手动点击 btnSpeak 仍能触发（验证 speakSentence 复用正常）
      await page.evaluate(function () {
        var b = document.getElementById('btnSpeak');
        if (b) b.click();
      });
      await page.waitForTimeout(150);
      mon = await getTts(page);
      check('autoSpeak=false→手动 btnSpeak 仍触发 speak',
        mon && mon.speak.length === 1 && mon.speak[0].text && mon.speak[0].text === curSentence,
        { sp: mon && mon.speak[0] && mon.speak[0].text, cur: curSentence });

      check('零 pageerror/console.error', errs.length === 0, errs.join(' | '));
      await ctx.close();
    }

    /* =================== Case 3: autoSpeak 与 sound 解耦 =================== */
    console.log('== Case 3: autoSpeak=true + sound=false 不互相干扰 ==');
    {
      const SEED_BOTH = SEED_AUTOSPEAK_ON.replace('sound: true', 'sound: false');
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
      await ctx.addInitScript({ content: TTS_MONITOR + SEED_BOTH });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push('pageerror: ' + e.message));
      page.on('console', m => { if (m.type() === 'error' && m.text().indexOf('Failed to load resource') < 0) errs.push('console.error: ' + m.text()); });
      await page.goto(base + 'main.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#stageChoices .choice', { timeout: 12000 });
      await page.waitForTimeout(600);

      await resetTts(page);
      let curSentence = await page.evaluate(function () { var it = (typeof cur === 'function') ? cur() : null; return it && it.sentence; });
      await answerOneQ(page);
      let mon = await getTts(page);
      check('sound=false 不影响 autoSpeak→speak 仍触发',
        mon && mon.speak.length === 1 && mon.speak[0].text && mon.speak[0].text === curSentence,
        { sp: mon && mon.speak[0] && mon.speak[0].text, cur: curSentence });

      check('零 pageerror/console.error', errs.length === 0, errs.join(' | '));
      await ctx.close();
    }

  } finally {
    await browser.close();
    stopServer();
  }

  console.log('\n结果：' + passed + ' 通过 / ' + failed + ' 失败');
  process.exit(failed === 0 ? 0 : 1);
})();