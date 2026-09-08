/**
 * visual-round.js · 视觉走查（截图驱动验收，非断言用例）
 *
 * 跑一个「真实学习回合」：注入真实种子库句子（builtin-daily，带宪法级预置干扰）
 * → 出题态截图 → 首槽故意答错干扰项 → 反馈态截图 → 答对推进多句 → 各句出题态截图。
 * 产出到 e2e/shots/visual-round/，供截图驱动验收 D-pipeline 数据成果观感。
 *
 * 运行：node e2e/visual-round.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'shots', 'visual-round');
fs.mkdirSync(OUT, { recursive: true });

const PORT = 8950 + Math.floor(Math.random() * 30);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-visual-'));
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
      req.on('error', function () { /* retry */ });
      req.setTimeout(600, function () { req.destroy(); });
      if (tries > 40) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 400);
  });
}
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) { /* noop */ } server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
}

/* 从 builtins.js 沙箱抽真实带预置干扰的句子（builtin-daily；仅含非并入的静态主体） */
function sampleSentences(n) {
  const code = fs.readFileSync(path.join(ROOT, 'builtins.js'), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  new vm.Script(code).runInContext(sandbox);
  const items = sandbox.window.BUILTIN[0].items;
  const withD = items.filter(function (it) {
    return Array.isArray(it.distractors)
      && it.distractors.length === it.chunks.length
      && it.distractors.every(function (slot) { return Array.isArray(slot) && slot.length > 0; })
      && (it.chunks.length === 2 || it.chunks.length === 3);
  });
  /* 2chunk 与 3chunk 交错取，覆盖多样观感 */
  const two = withD.filter(function (it) { return it.chunks.length === 2; });
  const three = withD.filter(function (it) { return it.chunks.length === 3; });
  const picks = [];
  for (let i = 0; i < n; i++) {
    const from = (i % 2 === 0) ? two : three;
    const it = from[i >> 1];
    if (!it) break;
    picks.push(it);
  }
  return picks.map(function (it) {
    return { sentence: it.sentence, translation: it.translation, chunks: it.chunks,
      hints: it.hints || [], cid: it.cid, distractors: it.distractors };
  });
}

(async function () {
  const BASE = 'http://127.0.0.1:' + PORT;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH ||
      'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
  await startServer();
  console.log('visual server: ' + BASE);

  const picks = sampleSentences(6);
  console.log('走查句子:');
  picks.forEach(function (it, i) {
    console.log('  ' + (i + 1) + '. [' + it.chunks.length + ' chunks] ' + it.sentence.slice(0, 64)
      + '  ← 干扰: ' + it.distractors.map(function (s) { return s.length; }).join('/'));
  });
  if (!picks.length) { console.error('无样本句子'); stopServer(); process.exit(1); }
  const deck = { id: 'visual-probe', name: '视觉走查', items: picks };

  await ctx.addInitScript(function (d) {
    localStorage.clear();
    localStorage.setItem('chunklab.v1', JSON.stringify({
      version: 2, reinforceBook: [],
      decks: [], best: {}, mastered: {}, deletedItems: {},
      stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} },
      settings: { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 10,
        fxStack: true, celebrate: 'confetti', autoSpeak: false, sound: false }
    }));
    sessionStorage.setItem('_startDeck', JSON.stringify(d));
  }, deck);

  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', function (e) { errs.push(e.message); });
  await p.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#stageChoices .choice', { timeout: 12000 });
  await p.waitForTimeout(1600);

  /* shot 0：首句完整出题态 */
  await p.screenshot({ path: path.join(OUT, '01-question-1.png') });
  console.log('  截图 01-question-1.png（首句出题态）');

  let shotNo = 2;
  let round = 0;                       /* 当前已进入的句子 idx */
  const wrongDone = {};                /* 已演练答错的句子 idx */

  for (let guard = 0; guard < 200; guard++) {
    const st = await p.evaluate(function () {
      if (!window.S) return { booting: true };
      if (S.finished) return { finished: true };
      const it = (typeof cur === 'function') ? cur() : null;
      if (!it) return { booting: true };
      const nb = document.getElementById('btnNext');
      return {
        idx: S.idx, chunkIdx: S.chunkIdx,
        target: (S.chunkIdx < it.chunks.length) ? it.chunks[S.chunkIdx] : null,
        nbVisible: !!(nb && !nb.classList.contains('hidden'))
      };
    });
    if (st.booting) { await p.waitForTimeout(200); continue; }
    if (st.finished) { console.log('  结算卡出现，回合结束'); break; }

    /* 跨句：新句子第一槽 → 截出题态 */
    if (st.idx > round && st.chunkIdx === 0) {
      round = st.idx;
      if (round < picks.length) {
        await p.waitForTimeout(800);
        const name = String(shotNo).padStart(2, '0') + '-question-' + (round + 1) + '.png';
        await p.screenshot({ path: path.join(OUT, name) });
        console.log('  截图 ' + name + '（第 ' + (round + 1) + ' 句出题态）');
        shotNo++;
      }
    }

    if (st.nbVisible) {
      await p.evaluate(function () { document.getElementById('btnNext').click(); });
      await p.waitForTimeout(600);
      continue;
    }
    if (!st.target) { await p.waitForTimeout(200); continue; }

    /* 每句首槽演练一次答错：点一个非正确干扰项 */
    if (st.chunkIdx === 0 && !wrongDone[st.idx]) {
      wrongDone[st.idx] = true;
      const wrongHit = await p.evaluate(function (t) {
        const btns = Array.from(document.querySelectorAll('#stageChoices .choice'));
        const wrong = btns.filter(function (x) { return !x.disabled && x.dataset.v !== t; })[0];
        if (wrong) { wrong.click(); return wrong.dataset.v; }
        return null;
      }, st.target);
      if (wrongHit) {
        await p.waitForTimeout(800);
        const name = String(shotNo).padStart(2, '0') + '-wrong-feedback-' + (round + 1) + '.png';
        await p.screenshot({ path: path.join(OUT, name) });
        console.log('  截图 ' + name + '（第 ' + (round + 1) + ' 句答错「' + wrongHit.slice(0, 28) + '」）');
        shotNo++;
      }
      await p.waitForTimeout(300);
      continue; /* 下一拍再点正确项（反馈态多留一拍） */
    }

    /* 答对推进 */
    const hit = await p.evaluate(function (t) {
      const btns = Array.from(document.querySelectorAll('#stageChoices .choice'));
      const b = btns.filter(function (x) { return !x.disabled && x.dataset.v === t; })[0];
      if (b) { b.click(); return true; }
      return false;
    }, st.target);
    if (!hit) await p.waitForTimeout(200);
    await p.waitForTimeout(280);
  }

  console.log('pageerror: ' + (errs.length ? errs.join(' | ') : '无'));
  await browser.close();
  stopServer();
  console.log('走查完成 → ' + OUT);
})().catch(function (e) { console.error(e); stopServer(); process.exit(1); });
