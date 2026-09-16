/**
 * oral-batch4-verify.js · 第四批口语入库后的端到端验收
 *
 * 目的：不靠读源码，靠真实浏览器确认「新句子确实进了应用、且能正常出题」。
 *
 * ⚠️ 关键：内置题库的条目**不在** window.BUILTIN 里 —— 页面只加载 builtins.js 的基础 88 句，
 *    其余按需从 content/ 分片取（js/content-repository.js）。所以审计必须走
 *    window.ContentRepo.ensureDeck(id, mem)（= 练习页实际用的入口）。
 *    早期用 CL.builtinDecks() 审计会只看到 88 条，得出"新句没入库"的假红。
 *
 * 检查项：
 *   A. 题库列表页里 builtin-daily 的题数（238 → 346）
 *   B. ensureDeck 全量审计：条目数、抽样新句在库、结构完整性（chunks/hints/grammar/explanations/distractors）
 *   C. 练习区真机截图（?direct=1）
 *
 * 运行：node output/e2e/oral-batch4-verify.js
 * 自带服务器（不依赖外部固定端口），用完即关。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'oral-batch4');
fs.mkdirSync(OUT, { recursive: true });
const PORT = require(path.join(ROOT, 'e2e', 'lib', 'free-port')).freePort(8930, 30);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-oral4-'));
const BASE = 'http://127.0.0.1:' + PORT;
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
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (r) {
        if (r.statusCode === 200) { clearInterval(iv); resolve(); }
      });
      req.on('error', function () { });
      req.setTimeout(600, function () { req.destroy(); });
      if (tries > 120) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 200);
  });
}
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) { } server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) { }
}

/* 本批抽样（每条代表一个子批）：必须在库 */
const SAMPLES = [
  'You want some?',                /* 批1 食物 */
  'How\'d you sleep?',             /* 批1 睡眠 */
  'Let\'s take your temperature.', /* 批2 身体 */
  'You got a minute?',             /* 批3 职场 */
  'I can\'t put up with it.',      /* 批4 情绪 */
  'Hope you\'re feeling better.'   /* 批5 健康 */
];

let failed = 0;
function check(label, ok, detail) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + label + (detail === undefined ? '' : '  ' + detail));
  if (!ok) failed++;
  return ok;
}

(async function main() {
  await startServer();
  const browser = await chromium.launch();
  try {
    /* ---------- A：题库列表页（真实渲染） ---------- */
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/decks.html', { waitUntil: 'load' });
    await page.waitForSelector('.deck-item', { timeout: 30000 });
    await page.waitForTimeout(1500);

    const decks = await page.evaluate(function () {
      return Array.prototype.map.call(document.querySelectorAll('.deck-item'), function (el) {
        return {
          name: (el.querySelector('.nm') || {}).textContent.trim(),
          meta: (el.querySelector('.meta') || {}).textContent.trim()
        };
      });
    });
    console.log('\n=== A. 题库列表（decks.html 渲染结果）===');
    decks.forEach(function (d) { console.log('  ' + d.name + ' — ' + d.meta); });
    const dailyRow = decks.filter(function (d) { return /Daily|日常/.test(d.name); })[0];
    const dailyCount = dailyRow ? parseInt((dailyRow.meta.match(/(\d+)\s*题/) || [])[1], 10) : NaN;
    check('A1 builtin-daily 题数 238 → 346', dailyCount === 346, '实际 ' + dailyCount);

    /* ---------- B：ensureDeck 全量审计（练习页实际入口） ---------- */
    const audit = await page.evaluate(function (samples) {
      if (!window.CL || !window.ContentRepo) return { err: 'CL / ContentRepo 不可用' };
      var m = CL.loadMem();
      return ContentRepo.ensureDeck('builtin-daily', m).then(function (deck) {
        var items = deck.items || [];
        var bySentence = {};
        items.forEach(function (it) { bySentence[it.sentence] = it; });

        var missing = samples.filter(function (s) { return !bySentence[s]; });
        /* 形状判据挂到 window，供负向自证复用**同一份**实现 ——
           负向测试里另抄一份的话，测的是副本而不是真判据，等于白测。 */
        window.__oralShapeOk = function (it) {
          var n = (it.chunks || []).length;
          /* ⚠️ explanations 的长度**不是**与 chunks 对齐的（它是"讲解条目"列表，长度自由）。
             实测：builtins.js 88 句里 10 条、oral8000 既有 150 句里 68 条都固定 2 条。
             早期这里写成 `explanations.length === n` → 79 条假红。契约只要求"有讲解"。 */
          return !!it.cid && !!it.translation && n >= 2 && n <= 5 &&
            Array.isArray(it.hints) && it.hints.length === n &&
            Array.isArray(it.grammar) && it.grammar.length === n &&
            Array.isArray(it.explanations) && it.explanations.length >= 1 &&
            Array.isArray(it.distractors) && it.distractors.length === n &&
            it.distractors.every(function (s) { return Array.isArray(s) && s.length >= 2; });
        };
        var badShape = [];
        var withDist = 0;
        var cidSet = {};
        var dupCid = [];
        items.forEach(function (it) {
          if (it.distractors && it.distractors.length) withDist++;
          if (!window.__oralShapeOk(it)) badShape.push(it.sentence);
          if (it.cid) { if (cidSet[it.cid]) dupCid.push(it.cid); cidSet[it.cid] = 1; }
        });
        return {
          total: items.length,
          withDist: withDist,
          missing: missing,
          badShape: badShape.slice(0, 6),
          badShapeCount: badShape.length,
          dupCidCount: dupCid.length,
          batchMode: ContentRepo.shouldBatch('builtin-daily'),
          itemCount: deck.itemCount,
          sampleInfo: samples.map(function (s) {
            var it = bySentence[s];
            if (!it) return { s: s, missing: true };
            return { s: s, chunks: it.chunks, choices: it.distractors.map(function (x) { return x.length; }) };
          })
        };
      });
    }, SAMPLES);

    console.log('\n=== B. ContentRepo.ensureDeck 全量审计 ===');
    console.log('  （范围：builtin-daily。「每槽 ≥2」是该库的不变量 —— builtins.js 里 You said it. 曾只有 1 条，');
    console.log('    本次已补齐；freq-idioms.js 仍有 4 处单条槽，属另一题库、非本批范围，项目闸只拦空槽。）');
    if (audit.err) { check('B0 审计入口可用', false, audit.err); }
    else {
      check('B1 ensureDeck 返回条目数 = 346', audit.total === 346, '实际 ' + audit.total);
      check('B2 全部条目结构完整', audit.badShapeCount === 0,
        audit.badShapeCount ? audit.badShapeCount + ' 条异常 ' + JSON.stringify(audit.badShape) : '');
      check('B3 抽样新句全部在库', audit.missing.length === 0, audit.missing.join(' | '));
      check('B4 全部条目带预置干扰项（每槽 ≥2）', audit.withDist === audit.total,
        audit.withDist + '/' + audit.total);
      check('B5 cid 无重复', audit.dupCidCount === 0, '重复 ' + audit.dupCidCount);
      console.log('    练习页取全量（shouldBatch=' + audit.batchMode + '，阈值 1000）· itemCount=' + audit.itemCount);
      audit.sampleInfo.forEach(function (x) {
        console.log('    · ' + x.s + (x.missing ? '  ✗ 缺失' :
          '\n        chunks=' + JSON.stringify(x.chunks) + '\n        每槽干扰项条数=' + JSON.stringify(x.choices)));
      });
    }
    /* ---------- B6：负向自证（判据必须能变红） ---------- */
    const neg = await page.evaluate(function () {
      function shape() {
        return { cid: 'x', translation: 't', chunks: ['a', 'b'], hints: ['', ''],
          grammar: [{}, {}], explanations: ['e'], distractors: [['x', 'y'], ['x', 'y']] };
      }
      var shortSlot = shape(); shortSlot.distractors = [['only-one'], ['x', 'y']];
      var wrongOuter = shape(); wrongOuter.distractors = [['x', 'y']];
      var tooFewChunks = shape(); tooFewChunks.chunks = ['a']; tooFewChunks.hints = []; tooFewChunks.grammar = [];
      var shortHints = shape(); shortHints.hints = ['only'];
      var emptyExpl = shape(); emptyExpl.explanations = [];
      var noCid = shape(); delete noCid.cid;
      return {
        good: window.__oralShapeOk(shape()),
        shortSlot: window.__oralShapeOk(shortSlot),
        wrongOuter: window.__oralShapeOk(wrongOuter),
        tooFewChunks: window.__oralShapeOk(tooFewChunks),
        shortHints: window.__oralShapeOk(shortHints),
        emptyExpl: window.__oralShapeOk(emptyExpl),
        noCid: window.__oralShapeOk(noCid)
      };
    });
    console.log('\n=== B6 负向自证（同一份判据，注入坏样本必须判红）===');
    check('B6 合规样本 → 通过', neg.good === true);
    check('B6 槽内仅 1 条干扰 → 判红', neg.shortSlot === false);
    check('B6 干扰项外层与 chunks 不等长 → 判红', neg.wrongOuter === false);
    check('B6 chunks 数 < 2 → 判红', neg.tooFewChunks === false);
    check('B6 hints 与 chunks 不等长 → 判红', neg.shortHints === false);
    check('B6 explanations 为空 → 判红', neg.emptyExpl === false);
    check('B6 缺 cid → 判红', neg.noCid === false);

    await page.screenshot({ path: path.join(OUT, 'decks-1200.png') });
    await ctx.close();

    /* ---------- C：练习区真机 ---------- */
    const ctx2 = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const p2 = await ctx2.newPage();
    await p2.goto(BASE + '/main.html?direct=1', { waitUntil: 'load' });
    await p2.waitForTimeout(2500);
    const practice = await p2.evaluate(function () {
      var card = document.querySelector('.chunk-card, .card, #card, .practice-card');
      var btns = document.querySelectorAll('.chunk-btn, .opt, .choice, button[data-chunk]');
      return {
        text: card ? card.textContent.replace(/\s+/g, ' ').trim().slice(0, 140) : '',
        choiceCount: btns.length,
        bodyLen: document.body.textContent.trim().length
      };
    });
    console.log('\n=== C. 练习区（main.html?direct=1）===');
    console.log('  卡片文字: ' + (practice.text || '(空)'));
    console.log('  可选按钮数: ' + practice.choiceCount);
    check('C1 练习区已渲染内容', practice.bodyLen > 200);
    check('C2 出题时有可选按钮', practice.choiceCount > 0, practice.choiceCount + ' 个');
    await p2.screenshot({ path: path.join(OUT, 'practice-1200.png') });
    await ctx2.close();

    console.log('\n结果：' + (failed ? failed + ' 项未通过 ❌' : '全部通过 ✅'));
  } finally {
    await browser.close();
    stopServer();
  }
  process.exit(failed ? 1 : 0);
})().catch(function (e) {
  console.error('ERR ' + e.message + '\n' + e.stack);
  stopServer();
  process.exit(1);
});
