/**
 * book-assembly-verify.js · 「日常口语 8000」并入唯一内容源后的端到端验收
 *
 * 背景：2026-09-15 起口语 8000 合并为 oral-book.js 唯一内容源（45 个 oral-* deck），
 *  builtins.js 只留迁移表、oral8000.js 为空壳。本脚本不读源码逻辑，靠真实浏览器确认：
 *   1) 题库列表页（decks.html）确实出现 45 个「日常口语 8000」deck + 高频短语，题数与源一致；
 *   2) 每个 deck 都能经 ContentRepo.ensureDeck 取到完整可练题目，且 cid 全局唯一；
 *   3) 练习区（main.html?direct=1&deck=X）真机能开局；
 *   4) **三代老进度都能迁移** —— builtin-daily#cid（初版）/ daily-*#cid（6 场景版）
 *      在打开页面后自动落到 oral-* deck（否则等于清空用户进度）。
 *
 * 检查项：A 题库列表 / B 逐 deck 全量审计 / C 练习区 / D 进度迁移 / E 负向自证
 *
 * 注：快档骨架句（只有 sentence/translation/chunks/hints）是**预期形态**，
 *   B2 只强制必需字段 + 「有则必须合法」，并在 B3 打印详解/干扰项覆盖率供人工跟踪。
 *
 * 运行：node output/e2e/book-assembly-verify.js
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
const OUT = path.join(__dirname, 'book-assembly');
fs.mkdirSync(OUT, { recursive: true });
const PORT = require(path.join(ROOT, 'e2e', 'lib', 'free-port')).freePort(8990, 40);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-book-'));
const BASE = 'http://127.0.0.1:' + PORT;
let server = null;

/* ---------- Node 侧读真实源数据 ---------- */
function loadSources() {
  const w = { BUILTIN: [] };
  new Function('window', fs.readFileSync(path.join(ROOT, 'oral-book.js'), 'utf8'))(w);
  new Function('window', fs.readFileSync(path.join(ROOT, 'freq-idioms.js'), 'utf8'))(w);
  const book = w.ORAL_BOOK || { decks: [] };
  const decks = (book.decks || []).map(function (d) {
    return { id: d.id, name: d.name, short: d.short || '', count: (d.items || []).length };
  });
  const freq = (w.BUILTIN || []).filter(function (d) { return d.id === 'builtin-freq-idioms'; })[0];
  if (freq) decks.push({ id: freq.id, name: freq.name, short: '高频短语', count: (freq.items || []).length });
  const sentenceByCid = new Map();
  (book.decks || []).forEach(function (d) {
    (d.items || []).forEach(function (it) { sentenceByCid.set(it.cid, it.sentence); });
  });
  const bw = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'builtins.js'), 'utf8'))(bw);
  /* 快档 deck（书内容铺出来的，条目无预置干扰项）= 本轮新增的内容形态。
     它必须**真机可练**（无预置干扰项时靠运行时机制出选项），不能只做结构审计。 */
  const fastDecks = (book.decks || []).filter(function (d) {
    const items = d.items || [];
    return items.length && !items.some(function (it) { return it.distractors; });
  }).map(function (d) { return d.id; });
  /* 含单字句（1 段）的 deck —— 「单字句例外」必须**真机出题**验证，不能只看结构审计：
     buildChoices 在凑不足 2 个干扰项时会 `return [right]`（单按钮退化）。 */
  const oneWordDecks = (book.decks || []).filter(function (d) {
    return (d.items || []).some(function (it) { return (it.chunks || []).length === 1; });
  }).map(function (d) { return d.id; });
  return {
    decks: decks, sentenceByCid: sentenceByCid, mig: bw.BUILTIN_MIGRATION || {},
    fastDecks: fastDecks, oneWordDecks: oneWordDecks
  };
}
const SRC = loadSources();
const ORAL_IDS = SRC.decks.filter(function (d) { return d.id !== 'builtin-freq-idioms'; }).map(function (d) { return d.id; });
const EXPECT_TOTAL = SRC.decks.reduce(function (a, d) { return a + d.count; }, 0);
const DECK_FAST = SRC.fastDecks[0] || '';
if (!DECK_FAST) throw new Error('源里找不到快档 deck（书内容铺的、无预置干扰项）——判据失效，拒绝静默跳过');
const DECK_ONE = SRC.oneWordDecks[0] || '';

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

let failed = 0;
function check(label, ok, detail) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + label + (detail === undefined ? '' : '  ' + detail));
  if (!ok) failed++;
  return ok;
}

/* ---------- 迁移探针：三代 key 各取一条已知归属的句子 + 1 个未知 cid ---------- */
const MIG_DECKS = Object.keys(SRC.mig).filter(function (id) { return (SRC.mig[id] || []).length >= 2; });
const DECK_A = MIG_DECKS[0];
const DECK_B = MIG_DECKS.filter(function (id) { return id !== DECK_A; })[0];
if (!DECK_A || !DECK_B) { console.error('迁移表不足两个 deck，无法做迁移验收'); process.exit(1); }
const CID_A = SRC.mig[DECK_A][0];
const CID_A2 = SRC.mig[DECK_A][1];
const CID_B = SRC.mig[DECK_B][0];
const SENT_A2 = SRC.sentenceByCid.get(CID_A2);
const UNKNOWN_CID = 'deadbeef';
const FREQ_ID = 'builtin-freq-idioms';

/* 条目形状判据：**唯一实现**。断言段与负向自证段共用这一份源码 ——
   原先判据只在 B 段的 page 里定义，E 段换了 context 就 `__bookShapeOk is not a function`
   （测试自身崩掉、后面 C 段直接不跑）。现在统一从这里注入每个 context。

   「最少切几段」**不在这里重复实现** —— 注入 js/chunk-shape.js 的**同一份源码**
   （与 5 个校验器共用一份判据），单字句（Help! / Thanks.）允许 1 段。 */
function shapeOk(it) {
  var CS = window.ChunkShape;
  var n = (it.chunks || []).length;
  if (!it.cid || !it.translation || !CS) return false;
  if (n < CS.minChunks(it.sentence) || n > CS.MAX_CHUNKS) return false;
  if (!Array.isArray(it.hints) || it.hints.length !== n) return false;
  if (it.grammar && (!Array.isArray(it.grammar) || it.grammar.length !== n)) return false;
  if (it.explanations && (!Array.isArray(it.explanations) || it.explanations.length < 1)) return false;
  if (it.distractors) {
    if (!Array.isArray(it.distractors) || it.distractors.length !== n) return false;
    if (!it.distractors.every(function (s) { return Array.isArray(s) && s.length >= 1 && s.length <= 3; })) return false;
  }
  return true;
}
const SHAPE_INIT = 'window.__bookShapeOk = (' + shapeOk.toString() + ');';
/* UMD：浏览器分支会挂 window.ChunkShape */
const CS_SRC = fs.readFileSync(path.join(ROOT, 'js', 'chunk-shape.js'), 'utf8');

/* 所有页面 context 都先注入判据（addInitScript 对每个新 document 生效）
   顺序要紧：ChunkShape 必须先于用它的 shapeOk 注册。 */
async function newCtx(browser, viewport) {
  const ctx = await browser.newContext(viewport ? { viewport: viewport } : undefined);
  await ctx.addInitScript({ content: CS_SRC });
  await ctx.addInitScript(SHAPE_INIT);
  return ctx;
}

(async function main() {
  console.log('源数据：口语 8000 ' + ORAL_IDS.length + ' 个 deck + 高频短语；内置合计 ' + EXPECT_TOTAL + ' 句');
  console.log('迁移探针：' + DECK_A + ' ← ' + CID_A + ' / ' + DECK_B + ' ← ' + CID_B + '（三代 key 分别注入）');

  await startServer();
  const browser = await chromium.launch();
  try {
    /* ---------- A：题库列表页 ---------- */
    const ctx = await newCtx(browser, { width: 1200, height: 1000 });
    const page = await ctx.newPage();
    await page.goto(BASE + '/decks.html', { waitUntil: 'load' });
    await page.waitForSelector('.deck-item', { timeout: 30000 });
    await page.waitForTimeout(1500);

    const rows = await page.evaluate(function () {
      return Array.prototype.map.call(document.querySelectorAll('.deck-item'), function (el) {
        return {
          name: ((el.querySelector('.nm') || {}).textContent || '').trim(),
          meta: ((el.querySelector('.meta') || {}).textContent || '').trim()
        };
      });
    });
    console.log('\n=== A. 题库列表（decks.html 渲染结果，共 ' + rows.length + ' 张卡）===');
    rows.slice(0, 5).forEach(function (r) { console.log('  ' + r.name + ' — ' + r.meta); });
    if (rows.length > 5) console.log('  …（其余 ' + (rows.length - 5) + ' 张）');

    const oralRows = rows.filter(function (r) { return r.name.indexOf('日常口语 8000') === 0; });
    check('A1 渲染出 ' + ORAL_IDS.length + ' 张「日常口语 8000」卡片', oralRows.length === ORAL_IDS.length, '实际 ' + oralRows.length);

    /* A2 只拿「日常口语 8000」卡比题数：高频短语是另一个系列、卡名不含该前缀，
       混进 oralRows 查会取不到行 → NaN（判据张冠李戴，不是数据错）。 */
    let countBad = [];
    const oralSrc = SRC.decks.filter(function (d) { return d.id !== FREQ_ID; });
    oralSrc.forEach(function (d) {
      const row = oralRows.filter(function (r) { return r.name.indexOf(d.name) === 0; })[0];
      const n = row ? parseInt((row.meta.match(/(\d+)\s*题/) || [])[1], 10) : NaN;
      if (n !== d.count) countBad.push(d.id + ' 实际 ' + n + ' ≠ 源 ' + d.count);
    });
    check('A2 「日常口语 8000」每张卡题数与源一致（' + oralSrc.length + ' 个）', countBad.length === 0, countBad.slice(0, 4).join(' | '));

    const freqSrc = SRC.decks.filter(function (d) { return d.id === FREQ_ID; })[0];
    const freqRow = rows.filter(function (r) { return r.name.indexOf('高频短语') === 0; })[0];
    const freqN = freqRow ? parseInt((freqRow.meta.match(/(\d+)\s*题/) || [])[1], 10) : NaN;
    check('A2b 高频短语卡题数与源一致', !!freqSrc && freqN === freqSrc.count,
      '实际 ' + freqN + ' ≠ 源 ' + (freqSrc ? freqSrc.count : '?'));

    const legacy = rows.filter(function (r) { return /builtin-daily|daily-(home|social|chat|basic|emotion|work)/.test(r.name); });
    check('A3 旧 deck（builtin-daily / daily-*）不再出现在列表', legacy.length === 0, legacy.map(function (r) { return r.name; }).join(','));

    await page.screenshot({ path: path.join(OUT, 'decks-1200.png') });
    await ctx.close();

    /* ---------- B：逐 deck 全量审计 ---------- */
    const ctxB = await newCtx(browser, { width: 1200, height: 900 });
    const pb = await ctxB.newPage();
    await pb.goto(BASE + '/main.html', { waitUntil: 'load' });
    await pb.waitForFunction(function () { return window.CL && window.ContentRepo && window.ContentRepo.ready; }, { timeout: 30000 });

    const audit = await pb.evaluate(function (arg) {
      if (!window.CL || !window.ContentRepo) return { err: 'CL / ContentRepo 不可用' };
      var m = CL.loadMem();
      var seenOral = {};
      var seenFreq = {};
      var dupOral = 0;
      var cross = [];
      return Promise.all(arg.ids.map(function (id) {
        return ContentRepo.ensureDeck(id, m).then(function (deck) {
          var items = deck.items || [];
          var bad = 0, withGram = 0, withExp = 0, withDist = 0, emptySlot = 0, thinSlot = 0;
          var thinDetail = [];
          var seen = {}, dupIn = 0;
          items.forEach(function (it) {
            if (!window.__bookShapeOk(it)) bad++;
            if (Array.isArray(it.grammar) && it.grammar.length) withGram++;
            if (Array.isArray(it.explanations) && it.explanations.length) withExp++;
            if (Array.isArray(it.distractors) && it.distractors.length) {
              withDist++;
              it.distractors.forEach(function (s, i) {
                /* 槽内 0 条 = 该槽只剩正确项 → 「单按钮」退化（宪法级反例，必须红）；
                   槽内 1 条 = 2 选 1，合法但说明作者给的干扰项被淘汰殆尽 → 只提示。 */
                if (!Array.isArray(s) || s.length === 0) emptySlot++;
                else if (s.length < 2) { thinSlot++; thinDetail.push(it.cid + ':' + i); }
              });
            }
            if (it.cid) {
              if (seen[it.cid]) dupIn++;
              seen[it.cid] = 1;
              /* 系列内唯一 vs 跨库重句分开算：跨库（口语↔习语）重句是历史遗留的
                 内容归属问题，不是本次装配的契约 —— 不能混进 hard 断言里装绿/装红。 */
              if (id === arg.freqId) { seenFreq[it.cid] = 1; }
              else if (seenOral[it.cid]) dupOral++;
              else seenOral[it.cid] = 1;
            }
          });
          return { id: id, total: items.length, bad: bad, withGram: withGram, withExp: withExp,
            withDist: withDist, emptySlot: emptySlot, thinSlot: thinSlot, thinDetail: thinDetail,
            dupIn: dupIn };
        });
      })).then(function (list) {
        Object.keys(seenOral).forEach(function (cid) {
          if (seenFreq[cid]) cross.push(cid);
        });
        return { list: list, dupOral: dupOral, cross: cross };
      });
    }, { ids: SRC.decks.map(function (d) { return d.id; }), freqId: FREQ_ID });

    console.log('\n=== B. ContentRepo.ensureDeck 逐 deck 全量审计 ===');
    if (audit.err) { check('B0 审计入口可用', false, audit.err); }
    else {
      let thinTotal = 0, emptyTotal = 0, distTotal = 0, expTotal = 0;
      const thinAll = [];
      audit.list.forEach(function (r) {
        const exp = (SRC.decks.filter(function (d) { return d.id === r.id; })[0] || {}).count;
        check('B1 ' + r.id + ' 条目数 = ' + exp, r.total === exp, '实际 ' + r.total);
        check('B2 ' + r.id + ' 必需字段 / 可选字段合法', r.bad === 0, r.bad + ' 条异常');
        check('B4 ' + r.id + ' cid 无库内重复', r.dupIn === 0, '重复 ' + r.dupIn);
        emptyTotal += r.emptySlot; thinTotal += r.thinSlot;
        (r.thinDetail || []).forEach(function (d) { thinAll.push(r.id + '/' + d); });
        distTotal += r.withDist; expTotal += r.withExp;
      });
      check('B5 「日常口语 8000」系列内 cid 全局唯一（无跨 deck 重复）', audit.dupOral === 0, '重复 ' + audit.dupOral);
      check('B6 无「槽内 0 条」的空干扰槽（否则该槽退化成单按钮）', emptyTotal === 0, '空槽 ' + emptyTotal);
      const cross = audit.cross || [];
      console.log('  · 提示：槽内仅 1 条干扰项的槽 ' + thinTotal + ' 个' +
        (thinAll.length ? '（' + thinAll.slice(0, 6).join(', ') + '）' : '') + ' —— 合法（2 选 1），非断言项');
      console.log('  · 提示：与习语库重句 ' + cross.length + ' 条' +
        (cross.length ? '（cid ' + cross.join(', ') + '）' : '') + ' —— 历史遗留的内容归属问题，待人工处置');
      console.log('  （覆盖率参考：带详解 ' + expTotal + ' / ' + EXPECT_TOTAL +
        '，带预置干扰项 ' + distTotal + ' / ' + EXPECT_TOTAL + '；缺口为待精修的骨架句）');
    }
    await ctxB.close();

    /* ---------- E：负向自证（同一份判据，注入坏样本必须判红） ---------- */
    const ctxE = await newCtx(browser, { width: 1200, height: 900 });
    const pe = await ctxE.newPage();
    await pe.goto(BASE + '/main.html', { waitUntil: 'load' });
    await pe.waitForFunction(function () { return window.CL && window.ContentRepo && window.ContentRepo.ready; }, { timeout: 30000 });
    const neg = await pe.evaluate(function () {
      function shape() {
        return { cid: 'x', translation: 't', sentence: 'a b', chunks: ['a', 'b'], hints: ['', ''],
          grammar: [{}, {}], explanations: ['e'], distractors: [['x', 'y'], ['x', 'y']] };
      }
      var noCid = shape(); delete noCid.cid;
      var shortHints = shape(); shortHints.hints = ['only'];
      var badGrammar = shape(); badGrammar.grammar = [{}];
      var manySlot = shape(); manySlot.distractors = [['a', 'b', 'c', 'd'], ['x', 'y']];
      var emptySlot = shape(); emptySlot.distractors = [[], ['x', 'y']];
      /* 单字句例外：1 词句允许 1 段；2 词句切成 1 段必须判红（例外不可滥用）。
         两个样本除句子的词数外完全同构 → 差异只来自「段数下限」这一条判据。 */
      var oneWordOneChunk = shape();
      oneWordOneChunk.sentence = 'Help!'; oneWordOneChunk.chunks = ['Help!'];
      oneWordOneChunk.hints = ['']; oneWordOneChunk.grammar = [{}];
      oneWordOneChunk.distractors = [['x']];
      var twoWordOneChunk = shape();
      twoWordOneChunk.sentence = 'Hi there!'; twoWordOneChunk.chunks = ['Hi there!'];
      twoWordOneChunk.hints = ['']; twoWordOneChunk.grammar = [{}];
      twoWordOneChunk.distractors = [['x']];
      return {
        good: window.__bookShapeOk(shape()),
        noCid: window.__bookShapeOk(noCid),
        shortHints: window.__bookShapeOk(shortHints),
        badGrammar: window.__bookShapeOk(badGrammar),
        manySlot: window.__bookShapeOk(manySlot),
        emptySlot: window.__bookShapeOk(emptySlot),
        oneWordOneChunk: window.__bookShapeOk(oneWordOneChunk),
        twoWordOneChunk: window.__bookShapeOk(twoWordOneChunk)
      };
    });
    console.log('\n=== E. 负向自证（判据必须能变红）===');
    check('E 合规样本 → 通过', neg.good === true);
    check('E 缺 cid → 判红', neg.noCid === false);
    check('E hints 与 chunks 不等长 → 判红', neg.shortHints === false);
    check('E grammar 与 chunks 不等长 → 判红', neg.badGrammar === false);
    check('E 干扰项槽位超 3 条 → 判红', neg.manySlot === false);
    check('E 干扰项空槽（单按钮退化）→ 判红', neg.emptySlot === false);
    check('E 单字句「Help!」切 1 段 → 通过（单字句例外生效）', neg.oneWordOneChunk === true);
    check('E 双词句「Hi there!」切 1 段 → 判红（例外不可滥用）', neg.twoWordOneChunk === false);

    /* ---------- C：练习区真机（?direct=1&deck=X） ---------- */
    console.log('\n=== C. 练习区（main.html?direct=1&deck=' + DECK_A + '）===');
    await pe.goto(BASE + '/main.html?direct=1&deck=' + encodeURIComponent(DECK_A), { waitUntil: 'load' });
    await pe.waitForFunction(function () { return !!window.CL; }, { timeout: 20000 });
    await pe.waitForTimeout(1200);
    const practice = await pe.evaluate(function () {
      var zh = document.getElementById('zh');
      var chunks = document.querySelectorAll('#track > .chunk');
      var choices = document.querySelectorAll('#stageChoices .choice');
      return {
        zh: zh ? (zh.textContent || '').trim() : '',
        chunks: chunks.length,
        choices: choices.length
      };
    });
    check('C1 练习区已渲染出句子（#zh 非空）', practice.zh.length > 0, JSON.stringify(practice.zh.slice(0, 40)));
    check('C2 句子槽位已展开（#track > .chunk ≥ 2）', practice.chunks >= 2, '槽位 ' + practice.chunks);
    check('C3 候选按钮已生成（可作答）', practice.choices >= 1, '候选 ' + practice.choices);
    await pe.screenshot({ path: path.join(OUT, 'practice.png') });

    /* C4：新铺的快档 deck（无预置干扰项）必须同样能真机开局 ——
       「结构审计通过」不等于「练习页跑得起来」，这条是给新内容形态的真机证据。 */
    console.log('\n=== C4. 快档 deck 真机（' + DECK_FAST + '，无预置干扰项）===');
    await pe.goto(BASE + '/main.html?direct=1&deck=' + encodeURIComponent(DECK_FAST), { waitUntil: 'load' });
    await pe.waitForFunction(function () { return !!window.CL; }, { timeout: 20000 });
    await pe.waitForTimeout(1200);
    const fast = await pe.evaluate(function () {
      var zh = document.getElementById('zh');
      var chunks = document.querySelectorAll('#track > .chunk');
      var choices = document.querySelectorAll('#stageChoices .choice');
      var labels = Array.prototype.map.call(choices, function (c) { return (c.textContent || '').trim(); });
      return {
        zh: zh ? (zh.textContent || '').trim() : '',
        chunks: chunks.length,
        choices: choices.length,
        labels: labels
      };
    });
    check('C4 快档 deck 渲染出句子（#zh 非空）', fast.zh.length > 0, JSON.stringify(fast.zh.slice(0, 40)));
    check('C5 快档 deck 槽位已展开（≥ 2）', fast.chunks >= 2, '槽位 ' + fast.chunks);
    /* 无预置干扰项 → 仍必须凑够 ≥2 个候选，否则退化成「只有一个按钮」 */
    check('C6 快档 deck 无预置干扰项也能生成 ≥2 个候选', fast.choices >= 2,
      '候选 ' + fast.choices + ' ' + JSON.stringify(fast.labels.slice(0, 5)));
    await pe.screenshot({ path: path.join(OUT, 'practice-fast.png') });

    /* C7：单字句（1 段）真机出题 —— 「单字句例外」的**行为层**证据。
       结构放行不等于出得了题：buildChoices 凑不足 2 个干扰项时会 `return [right]`
       （只剩正确项 = 单按钮退化）。这里直接拿真单字句调运行时出题函数。 */
    console.log('\n=== C7. 单字句真机出题（' + (DECK_ONE || '—') + '）===');
    let oneRes = { err: '源里没有含 1 段条目的 deck' };
    if (DECK_ONE) {
      oneRes = await pe.evaluate(async function (deckId) {
        if (!window.CL || !window.ContentRepo || !window.ChunkEngine) return { err: 'CL / ContentRepo / ChunkEngine 不可用' };
        const m = CL.loadMem();
        const deck = await ContentRepo.ensureDeck(deckId, m);
        const items = deck.items || [];
        const ones = items.filter(function (it) { return (it.chunks || []).length === 1; });
        if (!ones.length) return { err: '该 deck 无 1 段条目', total: items.length };
        const it = ones[0];
        const choices = window.ChunkEngine.buildChoices(it, 0, items, items);
        return {
          total: items.length, oneCount: ones.length,
          sentence: it.sentence, chunks: (it.chunks || []).length,
          choices: (choices || []).length, labels: (choices || []).slice(0, 6)
        };
      }, DECK_ONE);
    }
    check('C7 源里存在含 1 段条目的 deck（单字句例外可被验证）', SRC.oneWordDecks.length >= 1,
      '含单字句的 deck：' + SRC.oneWordDecks.length + ' 个 ' + JSON.stringify(SRC.oneWordDecks.slice(0, 5)));
    check('C7 单字句 deck 取到 1 段条目 ' + (oneRes.oneCount || 0) + ' 条' + (oneRes.err ? '（' + oneRes.err + '）' : ''),
      (oneRes.oneCount || 0) >= 1, JSON.stringify(oneRes.sentence || ''));
    check('C7 单字句「' + (oneRes.sentence || '?') + '」真机出题 → ≥2 个候选（不退化）',
      (oneRes.choices || 0) >= 2,
      '段数 ' + (oneRes.chunks || 0) + ' / 候选 ' + (oneRes.choices || 0) + ' ' + JSON.stringify(oneRes.labels || []));
    await pe.screenshot({ path: path.join(OUT, 'practice-oneword.png') });
    await ctxE.close();

    /* ---------- D：进度迁移（真浏览器，三代 key 同时注入） ---------- */
    console.log('\n=== D. 三代老 key 迁移 → oral-* ===');
    const ctxD = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    await ctxD.addInitScript(function (seed) {
      localStorage.clear();
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
      var mastered = {}, bySentence = {}, events = [];
      /* 三代 id 前缀 × 迁移表 cid：前两条同 cid 不同前缀，应落到同一个 oral-* deck */
      mastered['builtin-daily#' + seed.cidA] = { t: 1 };
      mastered['daily-home#' + seed.cidA] = { t: 1 };
      mastered['daily-work#' + seed.cidB] = { t: 2 };
      mastered['builtin-daily#' + seed.unknown] = { t: 4 };   /* 未知 cid：必须原样保留 */
      bySentence['builtin-daily#' + seed.cidA] = { times: 3, okTimes: 2, wrongTimes: 1 };
      events.push({ id: 'ev-old', kind: 'answer', key: 'daily-home#' + seed.cidA, ok: true, at: 1000 });
      localStorage.setItem('chunklab.v1', JSON.stringify({
        version: 2, decks: [], best: {}, mastered: mastered, deletedItems: {},
        reinforceBook: [{ _key: 'daily-work::' + seed.sentA2, deckId: 'daily-work',
          deckName: '旧场景', sentence: seed.sentA2 }],
        stats: { totalRounds: 1, totalAnswered: 2, bySentence: bySentence, events: events, daysLog: {} },
        settings: { mode: 'choose', skipMastered: false, batchSize: 10 }
      }));
    }, { cidA: CID_A, cidB: CID_B, sentA2: SENT_A2, unknown: UNKNOWN_CID });
    const pd = await ctxD.newPage();
    await pd.route('**/api/**', function (r) { r.abort('failed'); });
    await pd.goto(BASE + '/main.html?direct=1', { waitUntil: 'load' });
    await pd.waitForFunction(function () { return !!window.CL; }, { timeout: 20000 });
    await pd.waitForTimeout(800);

    const mig = await pd.evaluate(function (seed) {
      var m = CL.loadMem();
      var mk = Object.keys(m.mastered || {});
      /* 「老前缀全消失」必须**排除刻意注入的未知 cid** —— 那条是 D5 要求保留的，
         不过滤掉会让 D4 与 D5 互相打架（判据自相矛盾 → 永远有一红）。 */
      var stale = mk.filter(function (k) {
        return /^(builtin-daily|daily-home|daily-work|daily-social|daily-chat|daily-basic|daily-emotion)#/.test(k)
          && k.indexOf('#' + seed.unknown) < 0;
      });
      var bk = m.reinforceBook && m.reinforceBook[0] ? m.reinforceBook[0] : null;
      return {
        masteredKeys: mk,
        aPresent: !!m.mastered[seed.deckA + '#' + seed.cidA],
        bPresent: !!m.mastered[seed.deckB + '#' + seed.cidB],
        staleKeys: stale,
        unknownKept: !!m.mastered['builtin-daily#' + seed.unknown],
        bySentencePresent: !!m.stats.bySentence[seed.deckA + '#' + seed.cidA],
        eventKey: m.stats.events[0] ? m.stats.events[0].key : '',
        bookDeck: bk ? bk.deckId : '',
        bookKey: bk ? bk._key : ''
      };
    }, { deckA: DECK_A, deckB: DECK_B, cidA: CID_A, cidB: CID_B, unknown: UNKNOWN_CID });

    console.log('  迁移后 mastered 键: ' + JSON.stringify(mig.masteredKeys));
    check('D1 builtin-daily#cid（初版）→ ' + DECK_A + '#cid', mig.aPresent);
    check('D2 daily-home#cid（6 场景版）→ ' + DECK_A + '#cid', mig.aPresent);
    check('D3 跨 deck 分流正确 → ' + DECK_B + '#cid', mig.bPresent);
    check('D4 老前缀 key 全部消失（无半迁移残留）', mig.staleKeys.length === 0, mig.staleKeys.join(','));
    check('D5 未知 cid 的老 key 原样保留（不丢数据）', mig.unknownKept === true);
    check('D6 stats.bySentence 已改写', mig.bySentencePresent === true);
    check('D7 stats.events[].key 已改写', mig.eventKey === DECK_A + '#' + CID_A, mig.eventKey);
    check('D8 错题本 deckId 已改写', mig.bookDeck === DECK_A, mig.bookDeck);
    check('D9 错题本 _key 已改写', mig.bookKey === DECK_A + '::' + SENT_A2, mig.bookKey);
    await ctxD.close();

    await browser.close();
    stopServer();
    console.log('\n结果：' + (failed ? failed + ' 项失败  ❌' : '全部通过  ✅'));
    process.exitCode = failed ? 1 : 0;
  } catch (err) {
    try { await browser.close(); } catch (e) { }
    stopServer();
    console.error('[book-assembly e2e] failed:', (err && err.stack) || err);
    process.exitCode = 1;
  }
})();
