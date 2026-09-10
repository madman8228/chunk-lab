/**
 * tag-audit-verify.js · revealTagWrap 结算 tag 语义审计
 *
 * 背景：2026-09-10 移除「已答完」outcome tag（错 1 自纠分支）。
 *   理由：错 1 自纠态的"沉默"本来就是正确反馈（错处红字 + track 补全 + 下一题按钮），
 *        补绿 tag 属兜底式过度反馈，且与「已掌握」绿 tag 撞色撞语义。
 *
 * 本脚本验证：
 *   A. 错 1 次自己纠正 → revealTagWrap 必须 hidden（无 tag、无「已答完」字样）
 *   B. 错 2 次（需巩固）→ revealTagWrap 必须显示红 tag「需巩固」（防误伤，回归断言）
 *   C. 零 pageerror
 *
 * 跑法：node output/e2e/tag-audit-verify.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(ROOT, 'output', 'e2e', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const PORT = 8990 + Math.floor(Math.random() * 30);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-tag-'));
const CHROMIUM = process.env.CHROMIUM_PATH ||
  'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe';

let server = null, passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (detail !== undefined ? '  → ' + JSON.stringify(detail) : '')); }
}
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
      const req = require('http').get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (r) {
        if (r.statusCode === 200) { clearInterval(iv); resolve(); }
      });
      req.on('error', function () {});
      req.setTimeout(600, function () { req.destroy(); });
      if (tries > 40) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 400);
  });
}

/* 最小 1 句 3-chunk deck（便于精确控制错几次） */
const MINI = {
  id: 'tag-audit', name: 'Tag 审计', items: [{
    sentence: 'I would like to check in please.', translation: '我想办理入住。',
    chunks: ['I would like to', 'check in', 'please.'], hints: ['', '', ''], cid: 'tag-audit-a'
  }]
};

function initScript(mini) {
  localStorage.clear();
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2, reinforceBook: [],
    decks: [mini],
    best: {}, mastered: {}, deletedItems: {},
    stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} },
    settings: { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 10, fxStack: false, celebrate: 'off', autoSpeak: false, sound: false }
  }));
  sessionStorage.setItem('_startDeck', JSON.stringify(mini));
}

/**
 * 驱动作答到整句完成。
 * wrongPlan: 形如 { 0: 1 } → chunk 0 先故意错 1 次；{ 0: 2 } → 错 2 次。
 */
async function answerSentence(page, wrongPlan) {
  const mistakes = Object.assign({}, wrongPlan);
  for (let guard = 0; guard < 120; guard++) {
    const st = await page.evaluate(function () {
      /* 先算 tag 快照——任何分支（含 finished / nextVisible）都要带上 */
      const tagEl = document.getElementById('revealTagWrap');
      const tag = tagEl ? { cls: tagEl.className, text: (tagEl.textContent || '').trim(), hidden: tagEl.classList.contains('hidden') } : null;
      if (!window.S) return { booting: true, tag: tag };
      if (S.finished) return { finished: true, tag: tag };
      const it = typeof cur === 'function' ? cur() : null;
      if (!it) return { booting: true, tag: tag };
      const nb = document.getElementById('btnNext');
      if (nb && !nb.classList.contains('hidden')) return { nextVisible: true, tag: tag };
      return {
        chunkIdx: S.chunkIdx,
        target: it.chunks[S.chunkIdx],
        chunkStatus: S.status[S.chunkIdx] || null,
        wrongSoFar: (S.wrongAttempts[S.chunkIdx] || 0),
        hinted: !!S.hinted,
        tag: tag
      };
    });
    if (st.booting) { await page.waitForTimeout(200); continue; }
    if (st.finished) return { finished: true, tag: st.tag };

    // 答完后先看 tag（btnNext 可见 = 本句结算）
    if (st.nextVisible) return { finished: false, tag: st.tag };

    const need = mistakes[st.chunkIdx] || 0;
    const shouldWrong = st.wrongSoFar < need;
    const hit = await page.evaluate(function (arg) {
      const btns = Array.from(document.querySelectorAll('#stageChoices .choice')).filter(function (b) { return !b.disabled; });
      let b = null;
      if (arg.wrong) b = btns.filter(function (x) { return x.dataset.v !== arg.target; })[0];
      else b = btns.filter(function (x) { return x.dataset.v === arg.target; })[0];
      if (b) { b.click(); return { ok: true, picked: b.dataset.v }; }
      return { ok: false, pool: btns.map(function (x) { return x.dataset.v; }) };
    }, { wrong: shouldWrong, target: st.target });
    if (!hit.ok) { await page.waitForTimeout(200); continue; }
    await page.waitForTimeout(320);
  }
  return { timeout: true };
}

(async function () {
  const BASE = 'http://127.0.0.1:' + PORT;
  await startServer();
  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM });

  /* ===== A. 错 1 自纠 → 必须无 tag ===== */
  console.log('\n=== A. 错 1 次自己纠正 ===');
  const cA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await cA.addInitScript(initScript, JSON.parse(JSON.stringify(MINI)));
  await cA.route('**/api/**', function (r) { r.abort('failed'); });
  const pA = await cA.newPage();
  const errsA = [];
  pA.on('pageerror', function (e) { errsA.push(e.message); });
  await pA.goto(BASE + '/main.html?direct=1&preview=tag-audit-selfcorrect', { waitUntil: 'domcontentloaded' });
  await pA.waitForSelector('#stageChoices .choice, #result', { timeout: 12000 });
  const rA = await answerSentence(pA, { 0: 1 });
  console.log('  结果：' + JSON.stringify(rA));
  check('A: 到达结算态（tag 元素已探测）', !!(rA.tag), rA);
  check('A: revealTagWrap 已隐藏（无「已答完」tag）', !!(rA.tag && rA.tag.hidden), rA.tag);
  check('A: tag 文字不含「已答完」', !!(rA.tag && rA.tag.text.indexOf('已答完') === -1), rA.tag && rA.tag.text);
  await pA.screenshot({ path: path.join(SHOTS, 'tag-audit-A-selfcorrect.png') });
  check('A: 零 pageerror', errsA.length === 0, errsA);

  /* ===== B. 错 2 次 → 必须显示「需巩固」红 tag（防误伤） ===== */
  console.log('\n=== B. 错 2 次（需巩固） ===');
  const cB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await cB.addInitScript(initScript, JSON.parse(JSON.stringify(MINI)));
  await cB.route('**/api/**', function (r) { r.abort('failed'); });
  const pB = await cB.newPage();
  const errsB = [];
  pB.on('pageerror', function (e) { errsB.push(e.message); });
  await pB.goto(BASE + '/main.html?direct=1&preview=tag-audit-needsreview', { waitUntil: 'domcontentloaded' });
  await pB.waitForSelector('#stageChoices .choice, #result', { timeout: 12000 });
  const rB = await answerSentence(pB, { 0: 2 });
  console.log('  结果：' + JSON.stringify(rB));
  check('B: 显示 tag', !!(rB.tag && !rB.tag.hidden), rB.tag);
  check('B: tag 文字为「需巩固」', !!(rB.tag && rB.tag.text.indexOf('需巩固') !== -1), rB.tag && rB.tag.text);
  check('B: tag class 含 miss（红）', !!(rB.tag && /\bmiss\b/.test(rB.tag.cls)), rB.tag && rB.tag.cls);
  await pB.screenshot({ path: path.join(SHOTS, 'tag-audit-B-needsreview.png') });
  check('B: 零 pageerror', errsB.length === 0, errsB);

  await browser.close();
  try { server.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}

  console.log('\n[tag-audit] passed=' + passed + ' failed=' + failed);
  process.exit(failed ? 1 : 0);
})().catch(function (e) { console.error(e); try { server && server.kill('SIGKILL'); } catch (_) {} process.exit(1); });
