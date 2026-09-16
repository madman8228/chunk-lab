/**
 * idiom-batch16-verify.js · 习语库第 16 批（29 条）入库后的端到端验收
 *
 * 检查项：
 *   A. 题库列表页里 builtin-freq-idioms 的题数（389 → 418）
 *   B. ensureDeck 全量审计：条目数、抽样新句在库、结构完整性、cid 无重复
 *   C. 练习区真机截图（?direct=1，startDeck 指定习语库）
 *   B6. 负向自证：同一份判据注入坏样本必须判红
 *
 * ⚠️ 习语库与口语库的**形状契约不同**：idiom 条目**没有 distractors**，
 *    但 grammar 每块必须带 phonetic[]（口语库不强制）。
 *
 * 运行：node output/e2e/idiom-batch16-verify.js
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
const OUT = path.join(__dirname, 'idiom-batch16');
fs.mkdirSync(OUT, { recursive: true });
const PORT = require(path.join(ROOT, 'e2e', 'lib', 'free-port')).freePort(8940, 30);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-idiom16-'));
const BASE = 'http://127.0.0.1:' + PORT;
const EXPECT_TOTAL = 418;   /* 389 + batch16 29 */
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

/* 本批抽样：B 组 / 情感 / 通用 三组各取，必须在库 */
const SAMPLES = [
  'Your guess was spot on — it turned out exactly right.',   /* B 组 */
  'We can meet at eight — that is fine by me.',
  'Count me in — I am on board with the plan.',
  'Scoot over — I need a seat too.',
  'Keep me updated on any changes.',                          /* B 组 末条 */
  'Do not mind me — I am not myself today.',                  /* 情感 */
  'What is tomorrow — anything special?',                     /* 情感 */
  'Running into you here — what are the chances?'              /* 通用 */
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
    const idiomRow = decks.filter(function (d) { return /Idioms|习语|高频短语/.test(d.name); })[0];
    const idiomCount = idiomRow ? parseInt((idiomRow.meta.match(/(\d+)\s*题/) || [])[1], 10) : NaN;
    check('A1 builtin-freq-idioms 题数 389 → ' + EXPECT_TOTAL, idiomCount === EXPECT_TOTAL, '实际 ' + idiomCount);

    /* ---------- B：ensureDeck 全量审计 ---------- */
    const audit = await page.evaluate(function (samples) {
      if (!window.CL || !window.ContentRepo) return { err: 'CL / ContentRepo 不可用' };
      var m = CL.loadMem();
      return ContentRepo.ensureDeck('builtin-freq-idioms', m).then(function (deck) {
        var items = deck.items || [];
        var bySentence = {};
        items.forEach(function (it) { bySentence[it.sentence] = it; });

        var missing = samples.filter(function (s) { return !bySentence[s]; });
        /* 形状判据挂 window，供负向自证复用同一份实现 */
        window.__idiomShapeOk = function (it) {
          var n = (it.chunks || []).length;
          var gOk = Array.isArray(it.grammar) && it.grammar.length === n &&
            it.grammar.every(function (g) { return g && g.role && g.color && g.pos && g.meaning &&
              Array.isArray(g.phonetic) && g.phonetic.length > 0; });
          return !!it.cid && !!it.translation && n >= 2 && n <= 5 &&
            Array.isArray(it.hints) && it.hints.length === n && gOk &&
            Array.isArray(it.explanations) && it.explanations.length >= 2;
        };
        var badShape = [];
        var cidSet = {}; var dupCid = []; var withPhon = 0;
        items.forEach(function (it) {
          if (!window.__idiomShapeOk(it)) badShape.push(it.sentence);
          if (it.cid) { if (cidSet[it.cid]) dupCid.push(it.cid); cidSet[it.cid] = 1; }
          if ((it.grammar || []).every(function (g) { return g.phonetic && g.phonetic.length; })) withPhon++;
        });
        var totalChunks = items.reduce(function (a, it) { return a + (it.chunks || []).length; }, 0);
        return {
          total: items.length,
          withPhon: withPhon,
          totalChunks: totalChunks,
          missing: missing,
          badShape: badShape.slice(0, 6),
          badShapeCount: badShape.length,
          dupCidCount: dupCid.length,
          itemCount: deck.itemCount,
          sampleInfo: samples.map(function (s) {
            var it = bySentence[s];
            if (!it) return { s: s, missing: true };
            return { s: s, chunks: it.chunks, trans: it.translation, expl: it.explanations.length };
          })
        };
      });
    }, SAMPLES);

    console.log('\n=== B. ContentRepo.ensureDeck 全量审计 ===');
    if (audit.err) { check('B0 审计入口可用', false, audit.err); }
    else {
      check('B1 ensureDeck 返回条目数 = ' + EXPECT_TOTAL, audit.total === EXPECT_TOTAL, '实际 ' + audit.total);
      check('B2 全部条目结构完整（含 grammar.phonetic）', audit.badShapeCount === 0,
        audit.badShapeCount ? audit.badShapeCount + ' 条异常 ' + JSON.stringify(audit.badShape) : '');
      check('B3 抽样新句全部在库（8/8）', audit.missing.length === 0, audit.missing.join(' | '));
      check('B4 全部条目带 phonetic', audit.withPhon === audit.total, audit.withPhon + '/' + audit.total);
      check('B5 cid 无重复', audit.dupCidCount === 0, '重复 ' + audit.dupCidCount);
      console.log('    总 chunk 数=' + audit.totalChunks + ' · itemCount=' + audit.itemCount);
      audit.sampleInfo.forEach(function (x) {
        console.log('    · ' + x.s + (x.missing ? '  ✗ 缺失' :
          '\n        译=' + x.trans + ' · chunks=' + JSON.stringify(x.chunks) + ' · 讲解 ' + x.expl + ' 条'));
      });
    }
    /* ---------- B6：负向自证 ---------- */
    const neg = await page.evaluate(function () {
      function shape() {
        return { cid: 'x', translation: 't', chunks: ['a', 'b'], hints: ['x', 'y'],
          grammar: [{ role: 'r', color: 'c', pos: 'p', meaning: 'm', phonetic: ['/a/'] },
                    { role: 'r', color: 'c', pos: 'p', meaning: 'm', phonetic: ['/b/'] }],
          explanations: ['e1', 'e2'] };
      }
      var tooFewChunks = shape(); tooFewChunks.chunks = ['a']; tooFewChunks.hints = ['x']; tooFewChunks.grammar = tooFewChunks.grammar.slice(0, 1);
      var shortHints = shape(); shortHints.hints = ['only'];
      var noPhon = shape(); noPhon.grammar = [{ role: 'r', color: 'c', pos: 'p', meaning: 'm' }, noPhon.grammar[1]];
      var emptyPhon = shape(); emptyPhon.grammar = [{ role: 'r', color: 'c', pos: 'p', meaning: 'm', phonetic: [] }, emptyPhon.grammar[1]];
      var oneExpl = shape(); oneExpl.explanations = ['only one'];
      var noCid = shape(); delete noCid.cid;
      var noTrans = shape(); noTrans.translation = '';
      return {
        good: window.__idiomShapeOk(shape()),
        tooFewChunks: window.__idiomShapeOk(tooFewChunks),
        shortHints: window.__idiomShapeOk(shortHints),
        noPhon: window.__idiomShapeOk(noPhon),
        emptyPhon: window.__idiomShapeOk(emptyPhon),
        oneExpl: window.__idiomShapeOk(oneExpl),
        noCid: window.__idiomShapeOk(noCid),
        noTrans: window.__idiomShapeOk(noTrans)
      };
    });
    console.log('\n=== B6 负向自证（同一份判据，注入坏样本必须判红）===');
    check('B6 合规样本 → 通过', neg.good === true);
    check('B6 chunks 数 < 2 → 判红', neg.tooFewChunks === false);
    check('B6 hints 与 chunks 不等长 → 判红', neg.shortHints === false);
    check('B6 grammar 缺 phonetic → 判红', neg.noPhon === false);
    check('B6 grammar phonetic 为空数组 → 判红', neg.emptyPhon === false);
    check('B6 explanations < 2 → 判红', neg.oneExpl === false);
    check('B6 缺 cid → 判红', neg.noCid === false);
    check('B6 缺 translation → 判红', neg.noTrans === false);

    await page.screenshot({ path: path.join(OUT, 'decks-1200.png') });
    await ctx.close();

    /* ---------- C：练习区真机（指定习语库） ---------- */
    const ctx2 = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const p2 = await ctx2.newPage();
    await p2.goto(BASE + '/main.html?direct=1', { waitUntil: 'load' });
    await p2.waitForFunction(function () { return window.CL && window.mem && window.mem.decks !== undefined; }, null, { timeout: 30000 });
    const started = await p2.evaluate(function () {
      var a = (window.CL && window.CL.allDecksView(window.mem || {})) || [];
      var d = a.filter(function (x) { return x.id === 'builtin-freq-idioms'; })[0];
      if (d && typeof startDeck === 'function') { startDeck(d); return true; }
      return false;
    });
    await p2.waitForTimeout(2500);
    const practice = await p2.evaluate(function () {
      var body = document.body.textContent.replace(/\s+/g, ' ').trim();
      var btns = document.querySelectorAll('.chunk-btn, .opt, .choice, button[data-chunk]');
      return { bodyLen: body.length, choiceCount: btns.length, head: body.slice(0, 200) };
    });
    console.log('\n=== C. 练习区（main.html?direct=1 → startDeck 习语库）===');
    check('C1 startDeck 成功切到习语库', started === true);
    console.log('  页面文字: ' + (practice.head || '(空)'));
    console.log('  可选按钮数: ' + practice.choiceCount);
    check('C2 练习区已渲染内容', practice.bodyLen > 200);
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
