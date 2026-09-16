/**
 * scene-split-verify.js · builtin-daily 拆成 6 个场景 deck 后的端到端验收
 *
 * 目的：不靠读源码，靠真实浏览器确认三件事
 *   1) 题库列表页确实出现 6 个场景 deck，且句数与源数据一致；
 *   2) 每个 deck 都能通过 ContentRepo.ensureDeck 取到完整可练的题目；
 *   3) **老进度能迁移** —— 用户原先挂在 builtin-daily#cid 下的掌握/统计/错题，
 *      打开页面后要自动落到新场景 deck 上（否则等于清空用户进度）。
 *
 * 检查项：
 *   A. decks.html 渲染出 6 个「日常口语 8000 · X」卡片 + 各自题数
 *   B. 逐 deck ensureDeck 全量审计（条数 / 结构 / cid 唯一 / 抽样）
 *   C. 练习区真机截图（?direct=1）
 *   D. 进度迁移（真浏览器注入老 key → 断言落到新 deck）
 *   E. 负向自证：未知 cid 的老 key 必须原样保留（不丢数据）
 *
 * 运行：node output/e2e/scene-split-verify.js
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
const OUT = path.join(__dirname, 'scene-split');
fs.mkdirSync(OUT, { recursive: true });
const PORT = require(path.join(ROOT, 'e2e', 'lib', 'free-port')).freePort(8970, 30);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-scene-'));
const BASE = 'http://127.0.0.1:' + PORT;
let server = null;

/* ---------- Node 侧读真实源数据：期望句数 / cid → {sentence, deckId} ---------- */
function loadSources() {
  const w = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'builtins.js'), 'utf8'))(w);
  new Function('window', fs.readFileSync(path.join(ROOT, 'oral8000.js'), 'utf8'))(w);
  const decks = (w.BUILTIN || []).map(function (d) {
    return { id: d.id, name: d.name, short: d.short || '', count: (d.items || []).length };
  });
  const byCid = new Map();
  (w.BUILTIN || []).forEach(function (d) {
    (d.items || []).forEach(function (it) { byCid.set(it.cid, { sentence: it.sentence, deckId: d.id }); });
  });
  return { decks, byCid, mig: w.BUILTIN_MIGRATION || {} };
}
const SRC = loadSources();
const EXPECT_TOTAL = SRC.decks.reduce(function (a, d) { return a + d.count; }, 0);

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

/* ---------- 迁移探针：取 3 条已知归属的句子 + 1 个未知 cid ---------- */
const homeCids = SRC.mig['daily-home'] || [];
const workCids = SRC.mig['daily-work'] || [];
const P_CID_HOME = homeCids[0];
const P_CID_WORK = workCids[0];
const P_SENT_HOME2 = SRC.byCid.get(homeCids[1]).sentence;      /* 用「原文 key」形式注入 */
const P_CID_HOME2 = homeCids[1];
const P_UNKNOWN = 'deadbeef';

(async function main() {
  console.log('源数据：' + SRC.decks.length + ' 个场景 deck，合计 ' + EXPECT_TOTAL + ' 句');
  SRC.decks.forEach(function (d) { console.log('  ' + d.id.padEnd(15) + d.count + ' 句  ' + d.name); });

  await startServer();
  const browser = await chromium.launch();
  try {
    /* ---------- A：题库列表页 ---------- */
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
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
    console.log('\n=== A. 题库列表（decks.html 渲染结果）===');
    rows.forEach(function (r) { console.log('  ' + r.name + ' — ' + r.meta); });

    const sceneRows = rows.filter(function (r) { return /日常口语\s*8000/.test(r.name); });
    check('A1 渲染出 6 个「日常口语 8000 · X」场景卡片', sceneRows.length === 6, '实际 ' + sceneRows.length);
    SRC.decks.forEach(function (d) {
      /* .nm 里除名称外还挂了「内置」等徽章文本 → 用前缀匹配，不要求全等 */
      const row = sceneRows.filter(function (r) { return r.name.indexOf(d.name) === 0; })[0];
      const n = row ? parseInt((row.meta.match(/(\d+)\s*题/) || [])[1], 10) : NaN;
      check('A2 「' + d.name + '」题数 = ' + d.count, n === d.count, '实际 ' + n);
    });

    /* A3 8000 系列单独成节：节标题存在，且**该节内**恰好 6 张场景卡（数的是节内，不是全页） */
    const section = await page.evaluate(function () {
      var list = document.getElementById('deckList');
      if (!list) return { err: 'no #deckList', inSection: -1 };
      var kids = Array.prototype.slice.call(list.children);
      var ti = -1;
      for (var i = 0; i < kids.length; i++) {
        if (kids[i].classList.contains('deck-section-title') && /日常口语\s*8000/.test(kids[i].textContent)) { ti = i; break; }
      }
      if (ti < 0) {
        return {
          err: '未找到「日常口语 8000」分节标题', inSection: -1,
          titles: kids.filter(function (el) { return el.classList.contains('deck-section-title'); })
            .map(function (el) { return el.textContent.trim(); })
        };
      }
      var n = 0;
      for (var j = ti + 1; j < kids.length; j++) {
        if (kids[j].classList.contains('deck-section-title')) break;   /* 到下一节为止 */
        if (kids[j].classList.contains('deck-item')) n++;
      }
      return { title: kids[ti].textContent.trim(), inSection: n };
    });
    console.log('  分节：' + (section.title || section.err) + ' → 节内卡片 ' + section.inSection);
    check('A3 8000 系列单独成节且节内恰好 6 张卡', section.inSection === 6, JSON.stringify(section));

    /* ---------- B：逐 deck 全量审计 ---------- */
    const audit = await page.evaluate(function (ids) {
      if (!window.CL || !window.ContentRepo) return { err: 'CL / ContentRepo 不可用' };
      /* 形状判据挂到 window，供负向自证复用**同一份**实现 */
      window.__sceneShapeOk = function (it) {
        var n = (it.chunks || []).length;
        return !!it.cid && !!it.translation && n >= 2 && n <= 5 &&
          Array.isArray(it.hints) && it.hints.length === n &&
          Array.isArray(it.grammar) && it.grammar.length === n &&
          Array.isArray(it.explanations) && it.explanations.length >= 1 &&
          Array.isArray(it.distractors) && it.distractors.length === n &&
          it.distractors.every(function (s) { return Array.isArray(s) && s.length >= 2; });
      };
      var m = CL.loadMem();
      var seenGlobal = {};
      var globalDup = 0;
      return Promise.all(ids.map(function (id) {
        return ContentRepo.ensureDeck(id, m).then(function (deck) {
          var items = deck.items || [];
          var bad = 0, withDist = 0, dupIn = 0;
          var seen = {};
          items.forEach(function (it) {
            if (it.distractors && it.distractors.length) withDist++;
            if (!window.__sceneShapeOk(it)) bad++;
            if (it.cid) {
              if (seen[it.cid]) dupIn++;
              seen[it.cid] = 1;
              if (seenGlobal[it.cid]) globalDup++;
              seenGlobal[it.cid] = 1;
            }
          });
          return { id: id, total: items.length, bad: bad, withDist: withDist, dupIn: dupIn };
        });
      })).then(function (list) { return { list: list, globalDup: globalDup }; });
    }, SRC.decks.map(function (d) { return d.id; }));

    console.log('\n=== B. ContentRepo.ensureDeck 逐 deck 全量审计 ===');
    if (audit.err) { check('B0 审计入口可用', false, audit.err); }
    else {
      audit.list.forEach(function (r) {
        const exp = (SRC.decks.filter(function (d) { return d.id === r.id; })[0] || {}).count;
        check('B1 ' + r.id + ' 条目数 = ' + exp, r.total === exp, '实际 ' + r.total);
        check('B2 ' + r.id + ' 结构完整', r.bad === 0, r.bad + ' 条异常');
        check('B3 ' + r.id + ' 每槽 ≥2 干扰项', r.withDist === r.total, r.withDist + '/' + r.total);
        check('B4 ' + r.id + ' cid 无库内重复', r.dupIn === 0, '重复 ' + r.dupIn);
      });
      check('B5 跨 deck 无 cid 重复（cid 全局唯一）', audit.globalDup === 0, '重复 ' + audit.globalDup);
    }

    /* ---------- E：负向自证（判据必须能变红） ---------- */
    const neg = await page.evaluate(function () {
      function shape() {
        return { cid: 'x', translation: 't', chunks: ['a', 'b'], hints: ['', ''],
          grammar: [{}, {}], explanations: ['e'], distractors: [['x', 'y'], ['x', 'y']] };
      }
      var shortSlot = shape(); shortSlot.distractors = [['only-one'], ['x', 'y']];
      var noCid = shape(); delete noCid.cid;
      var shortHints = shape(); shortHints.hints = ['only'];
      return {
        good: window.__sceneShapeOk(shape()),
        shortSlot: window.__sceneShapeOk(shortSlot),
        noCid: window.__sceneShapeOk(noCid),
        shortHints: window.__sceneShapeOk(shortHints)
      };
    });
    console.log('\n=== E. 负向自证（同一份判据，注入坏样本必须判红）===');
    check('E 合规样本 → 通过', neg.good === true);
    check('E 槽内仅 1 条干扰 → 判红', neg.shortSlot === false);
    check('E 缺 cid → 判红', neg.noCid === false);
    check('E hints 与 chunks 不等长 → 判红', neg.shortHints === false);

    await page.screenshot({ path: path.join(OUT, 'decks-1200.png') });
    await ctx.close();

    /* ---------- D：进度迁移（真浏览器） ---------- */
    console.log('\n=== D. 老 builtin-daily 进度迁移 ===');
    const ctxD = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    await ctxD.addInitScript(function (seed) {
      localStorage.clear();
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
      var mastered = {}, bySentence = {}, events = [];
      mastered['builtin-daily#' + seed.cidHome] = { t: 1 };          /* 已 cid 化形式 */
      mastered['builtin-daily#' + seed.sentHome2] = { t: 2 };        /* 原文 key 形式（测两步迁移串联） */
      mastered['builtin-daily#' + seed.cidWork] = { t: 3 };          /* 跨 deck 分流 */
      mastered['builtin-daily#' + seed.unknown] = { t: 4 };          /* 未知 cid：必须保留 */
      bySentence['builtin-daily#' + seed.cidHome] = { times: 3, okTimes: 2, wrongTimes: 1 };
      events.push({ id: 'ev-old', kind: 'answer', key: 'builtin-daily#' + seed.cidHome, ok: true, at: 1000 });
      localStorage.setItem('chunklab.v1', JSON.stringify({
        version: 2, decks: [], best: {}, mastered: mastered, deletedItems: {},
        reinforceBook: [{ _key: 'builtin-daily::' + seed.sentHome2, deckId: 'builtin-daily',
          deckName: '日常对话', sentence: seed.sentHome2 }],
        stats: { totalRounds: 1, totalAnswered: 2, bySentence: bySentence, events: events, daysLog: {} },
        settings: { mode: 'choose', skipMastered: false, batchSize: 10 }
      }));
    }, {
      cidHome: P_CID_HOME, sentHome2: P_SENT_HOME2, cidWork: P_CID_WORK, unknown: P_UNKNOWN
    });
    const pd = await ctxD.newPage();
    await pd.route('**/api/**', function (r) { r.abort('failed'); });
    await pd.goto(BASE + '/main.html?direct=1', { waitUntil: 'load' });
    await pd.waitForFunction(function () { return !!window.CL; }, { timeout: 20000 });
    await pd.waitForTimeout(600);

    const mig = await pd.evaluate(function (seed) {
      var m = CL.loadMem();
      var mk = Object.keys(m.mastered || {});
      var bk = m.reinforceBook && m.reinforceBook[0] ? m.reinforceBook[0] : null;
      return {
        masteredKeys: mk,
        homeKeyPresent: !!m.mastered['daily-home#' + seed.cidHome],
        homeOldGone: !m.mastered['builtin-daily#' + seed.cidHome],
        home2Present: !!m.mastered['daily-home#' + seed.cidHome2],
        workPresent: !!m.mastered['daily-work#' + seed.cidWork],
        unknownKept: !!m.mastered['builtin-daily#' + seed.unknown],
        bySentencePresent: !!m.stats.bySentence['daily-home#' + seed.cidHome],
        eventKey: m.stats.events[0] ? m.stats.events[0].key : '',
        bookDeck: bk ? bk.deckId : '',
        bookKey: bk ? bk._key : '',
        bookKeyExpected: 'daily-home::' + seed.sentHome2
      };
    }, { cidHome: P_CID_HOME, cidHome2: P_CID_HOME2, cidWork: P_CID_WORK, unknown: P_UNKNOWN, sentHome2: P_SENT_HOME2 });

    console.log('  mastered 键: ' + JSON.stringify(mig.masteredKeys));
    check('D1 已 cid 化的老 key → daily-home#cid', mig.homeKeyPresent && mig.homeOldGone);
    check('D2 原文形式老 key（两步迁移串联）→ daily-home#cid', mig.home2Present);
    check('D3 跨 deck 分流正确 → daily-work#cid', mig.workPresent);
    check('D4 stats.bySentence 同步迁移', mig.bySentencePresent);
    check('D5 stats.events[].key 已改写', mig.eventKey === 'daily-home#' + P_CID_HOME, mig.eventKey);
    check('D6 错题本 deckId 已改写', mig.bookDeck === 'daily-home', mig.bookDeck);
    check('D7 错题本 _key 已改写', mig.bookKey === mig.bookKeyExpected, mig.bookKey);
    check('E 未知 cid 的老 key 原样保留（不丢数据）', mig.unknownKept);
    await pd.screenshot({ path: path.join(OUT, 'migrated-1200.png') });

    /* 迁移后的统计页应能看到这次答题（证明没把进度弄丢） */
    await pd.goto(BASE + '/stats.html', { waitUntil: 'load' });
    await pd.waitForTimeout(1800);
    const statsShot = await pd.evaluate(function () {
      /* 「累计答题」这个 statCell 没有 id（statCell(label,value) 未传 opt.id）→ 按 label 文本定位，
         不要再猜 id（#totalAnswered 不存在；#monthAnswered 是「本月答题」，口径不同） */
      var cells = document.querySelectorAll('.ov-stat');
      for (var i = 0; i < cells.length; i++) {
        var l = cells[i].querySelector('.l');
        if (l && l.textContent.trim() === '累计答题') {
          var n = cells[i].querySelector('.n');
          return n ? n.textContent.trim() : '(n/a)';
        }
      }
      return '(n/a)';
    });
    console.log('  统计页「累计答题」= ' + statsShot);
    check('D8 迁移后统计页仍读到累计答题', statsShot !== '0' && statsShot !== '(n/a)', statsShot);
    await pd.screenshot({ path: path.join(OUT, 'stats-after-migration-1200.png') });
    await ctxD.close();

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
        bodyLen: document.body.textContent.trim().length,
        deckLabel: ((document.getElementById('deckName') || {}).textContent || '').trim()
      };
    });
    console.log('\n=== C. 练习区（main.html?direct=1）===');
    console.log('  卡片文字: ' + (practice.text || '(空)'));
    console.log('  可选按钮数: ' + practice.choiceCount);
    console.log('  顶栏 deck 名: ' + practice.deckLabel);
    check('C1 练习区已渲染内容', practice.bodyLen > 200);
    /* C3 顶栏必须用 short（「居家生活」），而不是 name 全名（「日常口语 8000 · 居家生活」）。
       判据写「∈ 候选 short 集合 且 不含 8000」—— 不写死某一个 short，抗 deck 改名。 */
    const SHORTS = SRC.decks.map(function (d) { return d.short; }).filter(Boolean);
    check('C3 顶栏用场景短名（非「日常口语 8000 · X」全名）',
      SHORTS.indexOf(practice.deckLabel) >= 0 && practice.deckLabel.indexOf('8000') < 0,
      JSON.stringify(practice.deckLabel) + ' 候选=' + JSON.stringify(SHORTS));
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
