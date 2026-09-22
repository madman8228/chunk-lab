'use strict';
/**
 * upgrade-check.js · 升级验收专项（G5：「老版本升级 + IDB 数据保留 + Service Worker 更新」）
 *
 * 为什么需要它（2026-09-16）：
 *   - `e2e/release-check.js` 覆盖「**新**架构自身」的首屏字节 / manifest 齐全 / 按需分片 / 窄屏溢出；
 *   - `e2e/stats-idb.test.js` 覆盖「IDB schema v1→v4 升级 + 不清空既有 courses」；
 *   - `e2e/account-isolation.test.js` 覆盖「旧版无归属数据不自动归给当前账号」。
 *   三者都不覆盖 **【用户数据 × 内容架构换血】这一路** —— 老用户手里的旧档案 key
 *   （`builtin-daily#cid` 初版 / `daily-*#cid` 场景拆分版 / `daily-*#整句原文` 前 cid 代）
 *   在新版里能不能落到**真实存在**的新 `oral-*` deck 上、值有没有丢。
 *   这是本次发布最大风险：旧内容 150 句 → 新 65 个 oral-* deck。
 *
 * 判据基础（core.js 唯一实现，2026-09-16 读代码确认）：
 *   - `migrateCidKeys`：`<deck>#<整句原文>` → `<deck>#<cid>`；
 *   - `migrateToBookDecks`：**只**对 OLD_DECKS = {builtin-daily, daily-home|social|chat|basic|emotion|work}
 *     的 key，用 `window.BUILTIN_MIGRATION`（`{新deckId: [cid, ...]}`）反查 cid 归属，
 *     改写成 `<新deckId>#<cid>`；**查不到归属的原样保留（不删数据）**；另同步错题本 `reinforceBook[].deckId/_key`。
 *   两步都在 `loadMem()` 内执行并**当场 saveMem 回写**（同一事务）→ 二次 loadMem 无变化 = 幂等。
 *
 * ⚠️ 不硬编码任何 8 位 cid / 具体句子 / deck 数 —— 全部从页面的 `BUILTIN_MIGRATION` 与
 *   `ContentRepo` manifest **现取**，避免随内容演进变成假红（skill `e2e-flaky-assertions` ⑧c）。
 *
 * 安全：自动拉起临时 server + 临时 DB（CHUNKLAB_DATA_DIR），不碰 server/data/chunklab.db。
 * 用法：npm run e2e:upgrade   （或 node e2e/upgrade-check.js）
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(8951, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-upgrade-'));
const CHROMIUM = process.env.CHROMIUM_PATH || chromium.executablePath();
const BASE = 'http://127.0.0.1:' + PORT;
/* 老版本从未记录 owner 之外的身份时用的无前缀单用户态（与 e2e/e2e.js 的种子一致） */
const LOCAL_OWNER = [BASE, 'local'];
const PICK_DECK = 'oral-1-1-1';
/* 查不到归属的「孤儿 cid」：必须是迁移表里不存在的值，否则 4.2 会假红（下面会再校验一次） */
const ORPHAN_CID = 'ffffffff';

let server = null;

function startServer() {
  return new Promise(function (resolve, reject) {
    const env = Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT) });
    delete env.NODE_OPTIONS;
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'), env: env, stdio: 'ignore'
    });
    let tries = 0;
    const iv = setInterval(function () {
      tries++;
      if (server.exitCode !== null) { clearInterval(iv); reject(new Error('server exit ' + server.exitCode)); return; }
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (r) {
        r.resume();
        if (r.statusCode === 200) { clearInterval(iv); resolve(); }
      });
      req.on('error', function () { /* 重试 */ });
      req.setTimeout(600, function () { req.destroy(); });
      if (tries > 40) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 400);
  });
}
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) { /* noop */ } server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
}

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  \u2192 ' + detail : '')); }
}

/* 只读取样：迁移表 + manifest deck 清单 + 某个 deck 的真实句子（含 cidOf / fnv8 两个口径） */
const PROBE = function (deckId) {
  if (!window.ContentRepo || !ContentRepo.ready) {
    return { noRepo: true, map: window.BUILTIN_MIGRATION || null, decks: [], items: [] };
  }
  const out = { map: window.BUILTIN_MIGRATION || null, decks: [], items: [] };
  return ContentRepo.ready.then(function () {
    try { out.decks = (ContentRepo.getManifest().decks || []).map(function (d) { return d.id; }); }
    catch (e) { out.deckErr = String(e && e.message); }
    return ContentRepo.ensureDeck(deckId);
  }).then(function (dk) {
    ((dk && dk.items) || []).forEach(function (it) {
      out.items.push({ sentence: it.sentence, cid: CL.cidOf(it), fnv8: CL.fnv8(it.sentence) });
    });
    return out;
  }).catch(function (e) { out.probeErr = String(e && e.message); return out; });
};

/* 组装「老用户档案」：值刻意用可辨识的量，证明迁移是搬值而不是造空壳 */
function buildOldMem(cidA, cidB, sample) {
  const mem = {
    version: 2,
    decks: [],
    /* 老 deck 级记录：migrateToBookDecks 不处理（一个老 deck → 多个新 deck，无法一对一），
       只要求「不被删除」。见 4.3。 */
    best: { 'builtin-daily': { lastPlayed: 1712000000000, lastAcc: 0.7 } },
    progress: { 'builtin-daily': { idx: 3 } },
    mastered: {},
    deletedItems: {},
    reinforceBook: [],
    stats: { totalRounds: 4, totalAnswered: 40, bySentence: {}, events: [] },
    settings: { mode: 'choose', shuffle: true, batchSize: 10, sound: true }
  };
  /* 初版 key：<老deck>#<cid> */
  mem.mastered['builtin-daily#' + cidA] = 1712345678901;
  /* 场景拆分版 key：<老deck>#<cid> */
  mem.stats.bySentence['daily-home#' + cidB] = { times: 7, okTimes: 5, streak: 2 };
  if (sample) {
    /* 前 cid 代：后缀是整句原文，须先被 migrateCidKeys 转成 cid */
    mem.deletedItems['daily-chat#' + sample.sentence] = 1;
    mem.reinforceBook.push({
      deckId: 'builtin-daily', sentence: sample.sentence,
      _key: 'builtin-daily::' + sample.sentence, times: 2
    });
  }
  /* 不误伤的两种：非白名单 deck / cid 查不到归属 */
  mem.mastered['oral-9-9-9#' + cidA] = 1;
  mem.mastered['builtin-daily#' + ORPHAN_CID] = 1;
  return mem;
}

(async function () {
  try {
    await startServer();
    const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM });
    console.log('验收 server: ' + BASE + '\n');

    /* ================= 0. 取样：迁移表 + manifest + 真实句子 ================= */
    console.log('== 0 取样：老档案迁移表 / manifest / 真实句子 ==');
    const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pA = await ctxA.newPage();
    await pA.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
    await pA.waitForSelector('#stageChoices, #track', { timeout: 15000 }).catch(function () { });
    await pA.waitForTimeout(800);
    const meta = await pA.evaluate(PROBE, PICK_DECK);
    await ctxA.close();

    const MAP = (meta && meta.map) || {};
    const DECK_IDS = (meta && meta.decks) || [];
    const mapDecks = Object.keys(MAP);
    const cidToDeck = {};
    mapDecks.forEach(function (d) { (MAP[d] || []).forEach(function (c) { cidToDeck[c] = d; }); });

    check('0.1 迁移表 BUILTIN_MIGRATION 已加载（老档案归属的唯一来源）',
      mapDecks.length > 0, 'decks=' + mapDecks.length + (meta && meta.noRepo ? ' (ContentRepo 未就绪)' : ''));
    check('0.2 manifest deck 清单可用', DECK_IDS.length >= 60, 'decks=' + DECK_IDS.length);

    const pool = (MAP[PICK_DECK] || []).slice();
    check('0.3 取样 deck 在迁移表里有条目', pool.length >= 3, PICK_DECK + ' 条数=' + pool.length);
    const CID_A = pool[0] || '';
    const CID_B = pool[1] || '';
    /* 前 cid 代 / 错题本要用的真实句子：只取「cidOf === fnv8」的条目，
       排除「item 自带 cid 与原文哈希不一致」带来的歧义。 */
    const sample = ((meta && meta.items) || []).filter(function (s) {
      return s.sentence && s.cid && s.fnv8 === s.cid && cidToDeck[s.cid];
    })[0] || null;
    check('0.4 取到「原文与 cid 一致」的真实句子（2.2 / 2.3 的输入）',
      !!sample, sample ? sample.sentence : JSON.stringify(((meta && meta.items) || []).slice(0, 3)));
    check('0.5 孤儿 cid 确实不在迁移表里（4.2 的前提）',
      !cidToDeck[ORPHAN_CID], 'ORPHAN_CID=' + ORPHAN_CID);
    console.log('');

    const oldMem = buildOldMem(CID_A, CID_B, sample);
    const seedOwner = [BASE, 'local'];
    const seedMemJson = JSON.stringify(oldMem);

    /* ================= 1~4. 老用户升级：档案 key 迁移 ================= */
    console.log('== 1 初版 key（builtin-daily#cid）迁移 ==');
    const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    /* This section validates the local upgrade contract. Keep cloud sync out of
       the fixture so a previously migrated server snapshot cannot replace the
       seeded legacy keys while the page is booting. Sync behavior is covered by
       the dedicated sync suites. */
    await ctxB.route('**/api/**', function (route) { route.abort('failed'); });
    await ctxB.addInitScript(function (payload) {
      /* addInitScript 在页面任何脚本之前执行 —— 这是「模拟升级前的老用户」唯一不产生
         写盘竞态的方式（事后 evaluate 写入会与首屏 ensureCloud/saveMem 抢同一个键）。 */
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify(payload.owner));
      localStorage.setItem('chunklab.v1', payload.mem);
    }, { owner: seedOwner, mem: seedMemJson });
    const pB = await ctxB.newPage();
    const errsB = [];
    pB.on('pageerror', function (e) { errsB.push(e.message); });
    await pB.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
    await pB.waitForSelector('#stageChoices, #track', { timeout: 15000 }).catch(function () { });
    await pB.waitForTimeout(900);

    const after = await pB.evaluate(function (arg) {
      const mem = CL.loadMem();
      const raw = JSON.parse(localStorage.getItem('chunklab.v1') || '{}');
      const keys = function (o) { return Object.keys(o || {}).sort(); };
      const rb = (mem.reinforceBook || []).map(function (it) { return { deckId: it.deckId, _key: it._key }; });
      return {
        memMastered: mem.mastered || {},
        memDeleted: mem.deletedItems || {},
        memBySentence: (mem.stats && mem.stats.bySentence) || {},
        memReinforce: rb,
        rawMasteredKeys: keys((raw.mastered)),
        rawBySentenceKeys: keys(raw.stats && raw.stats.bySentence),
        rawReinforce: (raw.reinforceBook || []).map(function (it) { return { deckId: it.deckId, _key: it._key }; }),
        bestKeys: keys(mem.best),
        progressKeys: keys(mem.progress),
        items: (window.S && S.items) ? S.items.length : 0
      };
    }, { a: CID_A, b: CID_B, orphan: ORPHAN_CID });

    const deckA = cidToDeck[CID_A] || '(无归属)';
    check('1.1 初版 key 迁移到新 deck 名下', !!after.memMastered[deckA + '#' + CID_A],
      '期望 ' + deckA + '#' + CID_A + '｜实有 ' + JSON.stringify(after.rawMasteredKeys));
    check('1.2 迁移后值原样保留（不是空壳占位）',
      after.memMastered[deckA + '#' + CID_A] === 1712345678901,
      String(after.memMastered[deckA + '#' + CID_A]));
    check('1.3 旧 key 已消失（同一事实不留两份）',
      !Object.prototype.hasOwnProperty.call(after.memMastered, 'builtin-daily#' + CID_A),
      JSON.stringify(after.rawMasteredKeys));
    check('1.4 落点 deck 在 manifest 里真实存在（否则进度指向空气）',
      DECK_IDS.indexOf(deckA) >= 0, deckA);
    console.log('');

    console.log('== 2 场景拆分版 + 前 cid 代 key 迁移 ==');
    const deckB = cidToDeck[CID_B] || '(无归属)';
    check('2.1 场景拆分版 key 迁移到新 deck 且值完整',
      JSON.stringify(after.memBySentence[deckB + '#' + CID_B]) === JSON.stringify({ times: 7, okTimes: 5, streak: 2 }),
      '期望 ' + deckB + '#' + CID_B + '｜实有 ' + JSON.stringify(after.rawBySentenceKeys) + '｜值 ' + JSON.stringify(after.memBySentence[deckB + '#' + CID_B]));
    check('2.2 前 cid 代 key（daily-*#整句原文）两步迁移后落到新 deck',
      !!sample && !!after.memDeleted[cidToDeck[sample.cid] + '#' + sample.cid],
      sample ? ('期望 ' + cidToDeck[sample.cid] + '#' + sample.cid + '｜实测值被归一化为 true') : '样本缺失');
    check('2.3 错题本 deckId / _key 同步指向新 deck（否则指向不存在的库）',
      !!sample && after.memReinforce.length === 1 &&
      after.memReinforce[0].deckId === cidToDeck[sample.cid] &&
      after.memReinforce[0]._key === cidToDeck[sample.cid] + '::' + sample.sentence,
      JSON.stringify(after.memReinforce));
    console.log('');

    console.log('== 3 幂等：二次 loadMem 不再变化 ==');
    const idem = await pB.evaluate(function () {
      const snap = function () {
        const m = CL.loadMem();
        return JSON.stringify({
          mastered: Object.keys(m.mastered || {}).sort(),
          deleted: Object.keys(m.deletedItems || {}).sort(),
          bySentence: Object.keys((m.stats && m.stats.bySentence) || {}).sort(),
          reinforce: (m.reinforceBook || []).map(function (it) { return it.deckId + '::' + it._key; }).sort()
        });
      };
      const a = snap(), b = snap();
      return { same: a === b, a: a };
    });
    check('3.1 二次 loadMem 幂等（句子级 key 集合不再变化）', idem.same, idem.a);
    console.log('');

    console.log('== 4 不误伤 / 不丢数据 ==');
    check('4.1 非白名单 deck 的 key 原样保留',
      after.memMastered['oral-9-9-9#' + CID_A] === 1, JSON.stringify(after.rawMasteredKeys));
    check('4.2 查不到归属的老 key 原样保留（宁可留着也不删）',
      after.memMastered['builtin-daily#' + ORPHAN_CID] === 1, JSON.stringify(after.rawMasteredKeys));
    /* 4.3 数据守恒：种下的 5 个「句子级」key 必须全部以「迁移后」或「原样」形态存活，一个都不能少。
       这是本次升级最核心的用户可见契约（进度不能丢），且完全由本地存储建模、不受云同步语义干扰。 */
    const survived = [
      ['mastered·初版 key', after.memMastered[deckA + '#' + CID_A] !== undefined],
      ['bySentence·场景拆分版 key', after.memBySentence[deckB + '#' + CID_B] !== undefined],
      ['deletedItems·前 cid 代 key', !!sample && after.memDeleted[cidToDeck[sample.cid] + '#' + sample.cid] !== undefined],
      ['mastered·非白名单 deck', after.memMastered['oral-9-9-9#' + CID_A] !== undefined],
      ['mastered·孤儿 cid', after.memMastered['builtin-daily#' + ORPHAN_CID] !== undefined]
    ];
    const lost = survived.filter(function (x) { return !x[1]; }).map(function (x) { return x[0]; });
    check('4.3 句子级 key 数据守恒（5 个种子 key 全部存活，无一被删）',
      lost.length === 0, '丢失 ' + lost.join('、'));
    /* 4.4 deck 级 best / progress 不属于「句子级进度」。migrateToBookDecks 不处理它们
       （一个老 deck → 多个新 deck，无法一对一），契约只有一条：**不被本地迁移删除**。
       本段已 `route.abort('**\/api/**')` 掐断云同步 ⇒ 这里只能验**本地这一路**，确定性成立。
       ⚠️ 「best 在同步中被整块替换丢弃」是**另一条路**（`best ∈ SYNC_KV_KEYS` 的 LWW 语义），
          根因已于 2026-09-22 定位并修复，但它的回归**故意不放这里**：
          本 fixture 未建模同步 revs，在此断言会**修前修后都绿**（= 假绿，本项目最恨的一类）。
          该修复的权威回归 = `scripts/core-sync-kv.test.mjs`（附负向自证：关掉修复即变红）。
          ⇒ 同步路径的**浏览器端**端到端复现仍未做（登记在案，见 RELEASE_CHECKLIST）。 */
    check('4.4 老 deck 级记录 best / progress 不被本地迁移删除（同步已掐断，仅验本地一路）',
      after.bestKeys.indexOf('builtin-daily') >= 0 && after.progressKeys.indexOf('builtin-daily') >= 0,
      'best=' + JSON.stringify(after.bestKeys) + ' / progress=' + JSON.stringify(after.progressKeys));
    console.log('');

    /* ================= 5. 迁移表 ↔ 内容一致（自维护不变量） ================= */
    console.log('== 5 迁移表与内容一致 ==');
    const missing = mapDecks.filter(function (d) { return DECK_IDS.indexOf(d) < 0; });
    check('5.1 迁移表里每个目标 deck 都在 manifest 里（缺一个 = 那批老用户进度无处可落）',
      missing.length === 0, '缺失 ' + missing.join(', '));
    console.log('');

    /* ================= 6. Service Worker 更新 ================= */
    console.log('== 6 SW 更新：旧版本缓存必须被清 ==');
    const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const mCache = /const CACHE = '([^']+)'/.exec(swSrc);
    const CUR_CACHE = mCache ? mCache[1] : null;
    check('6.1 取到 sw.js 当前 CACHE 名', !!CUR_CACHE, String(CUR_CACHE));

    const ctxC = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pC = await ctxC.newPage();
    /* /api/health 不是预缓存页，此刻尚未注册 SW → 可安全预置一个「升级前的老缓存」 */
    await pC.goto(BASE + '/api/health');
    const seeded = await pC.evaluate(function () {
      return caches.open('chunklab-deadbeef')
        .then(function (c) { return c.put('/', new Response('old-version')); })
        .then(function () { return true; })
        .catch(function (e) { return 'err:' + (e && e.message); });
    });
    check('6.2 已预置旧版本缓存（模拟升级前的老 cache）', seeded === true, String(seeded));
    await pC.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
    let cacheKeys = [];
    for (let i = 0; i < 40; i++) {
      await pC.waitForTimeout(250);
      cacheKeys = await pC.evaluate(function () { return caches.keys(); });
      if (CUR_CACHE && cacheKeys.indexOf(CUR_CACHE) >= 0 && cacheKeys.indexOf('chunklab-deadbeef') < 0) break;
    }
    check('6.3 SW activate 后旧版本缓存被清除', cacheKeys.indexOf('chunklab-deadbeef') < 0, JSON.stringify(cacheKeys));
    check('6.4 当前版本缓存已建立且是预期名字', !!CUR_CACHE && cacheKeys.indexOf(CUR_CACHE) >= 0, JSON.stringify(cacheKeys));
    await ctxC.close();
    console.log('');

    /* ================= 7. 升级后立即可用 ================= */
    console.log('== 7 升级后立即可用 ==');
    check('7.1 升级后能进入练习并出题', after.items > 0, 'items=' + after.items);
    check('7.2 升级全过程零 pageerror', errsB.length === 0, errsB.slice(0, 2).join(' | '));
    console.log('');

    /* ================= E. 负向自证 ================= */
    console.log('== E 负向自证：迁移表不可用时，1.1 判据必须能报红 ==');
    /* 吞掉 builtins.js 对 window.BUILTIN_MIGRATION 的赋值 → core.js 拿不到映射表 →
       migrateToBookDecks 直接 return false → 老 key 不被改写。若 1.1 此刻仍绿，说明判据恒真。 */
    const ctxE = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    /* Negative migration proof must isolate local loading from the cloud state
       created by the positive migration scenario above; otherwise the server's
       already-migrated snapshot can make the target key appear even when the
       migration table is intentionally unavailable. */
    await ctxE.route('**/api/**', function (route) { route.abort('failed'); });
    await ctxE.addInitScript(function (payload) {
      try {
        Object.defineProperty(window, 'BUILTIN_MIGRATION', {
          configurable: true,
          get: function () { return null; },
          set: function () { /* 吞掉赋值 */ }
        });
      } catch (e) { /* 若定义失败，下面 mapLoaded 会暴露 */ }
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify(payload.owner));
      localStorage.setItem('chunklab.v1', payload.mem);
    }, { owner: seedOwner, mem: seedMemJson });
    const pE = await ctxE.newPage();
    await pE.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
    await pE.waitForTimeout(1200);
    const neg = await pE.evaluate(function (arg) {
      const m = CL.loadMem();
      return {
        mapLoaded: !!window.BUILTIN_MIGRATION,
        migratedHit: !!(m.mastered && m.mastered[arg.target + '#' + arg.cid]),
        rawKept: !!(m.mastered && m.mastered['builtin-daily#' + arg.cid])
      };
    }, { target: deckA, cid: CID_A });
    check('E1 迁移表不可用时老 key 保持原样（1.1 判据确实会报红，非恒真）',
      neg.mapLoaded === false && neg.migratedHit === false && neg.rawKept === true,
      JSON.stringify(neg));
    await ctxE.close();
    await ctxB.close();

    console.log('\n[upgrade-check] passed=' + passed + ' failed=' + failed);
    await browser.close();
    stopServer();
    process.exit(failed ? 1 : 0);
  } catch (e) {
    console.error('验收脚本异常：' + (e && e.stack || e));
    stopServer();
    process.exit(2);
  }
})();
