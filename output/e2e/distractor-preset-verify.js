/**
 * distractor-preset-verify.js · D-schema 预置干扰真实上屏端到端验证（2026-09-08）
 *
 * 背景：三库 251 句预置干扰已入库（b6109c9），单测覆盖了 chunk-engine 消费逻辑
 *       但没有任何证据证明「数据真的进了用户视野」——本脚本补上这一环。
 *
 * 铁证判据（唯一来源）：
 *   主角句 "I'm going to meet a friend for lunch."（3 chunks × 3 条 = 9 条预置），
 *   经全库扫描 9 条预置的 norm 全部不在题库其它句子 chunk 池里 → 规则桶
 *   （buildDistractors pass 1/2）在物理上产不出这些文本。
 *   而 buildDistractors 的 distractorCount = max(4, chunks*2) = 6，pass 0 预置
 *   收满 6 即停（规则桶零机会）。所以上屏 6 个干扰项必须 == 前 6 条预置：
 *     ["I going to","I'm go to","I'm going for","meet the friend","meet friend","meets a friend"]
 *   任一上屏项不在此集 = 预置未被消费（掉规则生成）→ 测试红。
 *
 * 依赖：playwright-core + 临时 server（与 autospeak-verify 同模式）
 * 运行：node output/e2e/distractor-preset-verify.js
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

const PORT = 9300 + Math.floor(Math.random() * 90);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-preset-'));
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

/* 主角句：真实来自 builtin-daily（oral8000 并入批），预置 3×3 = 9 条，
   经 node 侧全库扫描确认 9 条 norm 全部不在题库 pool（唯一来源） */
const HERO = {
  sentence: "I'm going to meet a friend for lunch.",
  translation: '我打算去见一个朋友吃午饭。',
  chunks: ["I'm going to", 'meet a friend', 'for lunch.'],
  hints: ['', '', ''],
  cid: '3f2a11c8',
  grammar: null,
  distractors: [
    ['I going to', "I'm go to", "I'm going for"],
    ['meet the friend', 'meet friend', 'meets a friend'],
    ['for the lunch.', 'to lunch.', 'at lunch.']
  ]
};
/* 池上限 = max(4, 3*2) = 6 → 期望上屏前 6 条（前两槽） */
const EXPECTED_PRESET = HERO.distractors[0].concat(HERO.distractors[1]);
const EXPECTED_SET = {};
EXPECTED_PRESET.forEach(function (d) { EXPECTED_SET[d] = 1; });

const SEED = `
localStorage.clear();
localStorage.setItem('chunklab.v1', JSON.stringify({
  version: 2, reinforceBook: [],
  decks: [{ id: 'preset-demo', name: '预置干扰演示', items: [${JSON.stringify(HERO)}] }],
  best: {}, mastered: {}, deletedItems: {},
  stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} },
  settings: { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 10,
              fxStack: true, celebrate: 'off', autoSpeak: false, sound: false }
}));
sessionStorage.setItem('_startDeck', JSON.stringify({ id: 'preset-demo', name: '预置干扰演示', items: [${JSON.stringify(HERO)}] }));
`;

async function main() {
  await startServer();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const errs = [];
  ctx.on('weberror', function (e) { errs.push('weberror: ' + e.error().message); });

  const page = await ctx.newPage();
  page.on('pageerror', function (e) { errs.push('pageerror: ' + e.message); });
  page.on('console', function (m) { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });

  /* 离线：abort /api → ensureCloud 走「服务器不可达」catch，不覆盖种子 */
  await page.route('**/api/config', function (r) { return r.abort(); });
  await page.route('**/api/data', function (r) { return r.abort(); });

  /* Phase 1：先到 main.html 让三库（builtins/oral8000/freq-idioms）加载完 */
  await page.goto('http://127.0.0.1:' + PORT + '/main.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  /* Phase 2：注入种子 + reload（page.evaluate 注入，避免 addInitScript 每次 nav 重跑清空） */
  await page.evaluate(SEED);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#stageChoices .choice', { timeout: 12000 });
  await page.waitForTimeout(600);

  /* ===== 断言 ===== */
  const info = await page.evaluate(function () {
    var dist = Array.prototype.map.call(
      document.querySelectorAll('#stageChoices .choice.distractor'),
      function (b) { return b.textContent.trim(); }
    );
    var corr = Array.prototype.map.call(
      document.querySelectorAll('#stageChoices .choice:not(.distractor)'),
      function (b) { return b.textContent.trim(); }
    );
    return {
      distCount: dist.length,
      dist: dist,
      correctCount: corr.length,
      correct: corr,
      curSentence: (typeof cur === 'function' && cur()) ? cur().sentence : null
    };
  });

  check('渲染当前句 = 主角句', info.curSentence === HERO.sentence, info.curSentence);
  check('正确项渲染 3 个（未填前全量）', info.correctCount === 3 && info.correct[0] === "I'm going to", info.correct);

  /* 核心：上屏干扰数 = 池上限 6（预置收满，规则桶零机会） */
  check('上屏干扰数 = 6（distractorCount=max(4,3*2)）', info.distCount === 6, { n: info.distCount, dist: info.dist });

  /* 核心：上屏 6 个干扰全部来自预置集（9 条预置 norm 全唯一 → 规则桶产不出） */
  const allPreset = info.dist.every(function (d) { return EXPECTED_SET[d]; });
  check('上屏干扰 ⊆ 预置集（铁证：非题库规则生成）', allPreset, { dist: info.dist });

  /* 集合精确相等：不多不少 */
  const exact = info.dist.length === 6 &&
    EXPECTED_PRESET.every(function (d) { return info.dist.indexOf(d) !== -1; });
  check('上屏集合 == 前 6 条预置（精确）', exact, { dist: info.dist, expected: EXPECTED_PRESET });

  /* 反向：规则桶产物（题库 chunk）不得上屏 */
  const chunkSet = {};
  HERO.chunks.forEach(function (c) { chunkSet[c] = 1; });
  const noRule = info.dist.every(function (d) { return !chunkSet[d]; });
  check('无题库 chunk 混入干扰', noRule, info.dist);

  /* 答题可达性：点第一个正确 chunk → 整池重渲染，该 chunk 消失（已 ok 不再显示），
     剩余 correct 2 个仍在（对应后续 chunk） */
  const clicked = await page.evaluate(function () {
    var target = document.querySelector('#stageChoices .choice:not(.distractor)');
    if (!target) return false;
    target.click();
    return true;
  });
  await page.waitForTimeout(300);
  const afterOk = await page.evaluate(function () {
    var corr = Array.prototype.map.call(
      document.querySelectorAll('#stageChoices .choice:not(.distractor)'),
      function (b) { return b.textContent.trim(); }
    );
    return { corr: corr, removedFirst: corr.indexOf("I'm going to") === -1 };
  });
  check('点击后正确项已答消失（chunkIdx 推进）', clicked && afterOk.removedFirst, afterOk);
  check('剩余 correct = 2（后续 chunk 待填）', afterOk.corr.length === 2, afterOk);

  /* abort /api 的 ERR_FAILED 是预期噪音（ensureCloud 走离线分支），过滤后应为零真错 */
  const realErrs = errs.filter(function (s) { return s.indexOf('Failed to load resource') === -1; });
  check('零 pageerror / console.error（API 离线噪音已滤）', realErrs.length === 0, realErrs.join(' | '));

  await page.screenshot({ path: path.join(SHOTS, 'preset-on-stage.png') });

  await ctx.close();
  await browser.close();
  stopServer();
  console.log('\n结果: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

main().catch(function (e) {
  console.error('❌ 未捕获: ' + (e && e.stack || e));
  stopServer();
  process.exit(1);
});
