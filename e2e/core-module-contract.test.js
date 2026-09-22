/**
 * core-module-contract.test.js · 「必需核心模块缺失 = 用户可见失败」的行为级护栏
 *
 * 背景（重复实现清理 D-1/D-2 的前置护栏）：
 *   `js/core-stats-signature.js`（statSig / eventSnapshot）与 `js/core-storage-state.js`
 *   （buildStatsPersistencePlan / buildStatsBusinessMeta）是 core.js 的**必需**依赖：
 *   四个页面（main / decks / stats / courses）都在 core.js 之前用 <script> 加载它们，
 *   且与 core.js 走同一个静态服务、同一份 SW 预缓存 —— 正常部署下必然同时到达。
 *
 *   危险在于 core.js 曾经为它们保留了**手写内联副本**（`if(!plan)` / `if(CoreStatsSignature)`
 *   形态）。副本与源模块是两份会各自漂移的实现：模块一旦缺失（部署漏文件 / 缓存半更新 /
 *   请求被拦），页面会**静默**切到副本分支 —— 界面一切正常，写入的数据却是另一套判据算出来的。
 *   这正是「同一事实只能有一份实现」被破坏后最坏的失败模式：**没有报错**。
 *
 * 本测试锁死两件事（并明确区分它们 —— 两者的条件在 core.js 加载期就分流，共用判据会误杀）：
 *   A. 必需模块缺失 → 必须进入**用户可见**的失败态。
 *      断言的是**真实运行行为**（DOM 上真的有一个可见元素），不是「文件在不在」；
 *      也明确不接受「只有 console.error」——用户看不到的失败 = 静默失败。
 *   B. IDB 不可用 → 是**受支持降级**（隐私模式 / 浏览器禁用 IndexedDB），
 *      `CL.statsStoreMode()` 走 'local' 分支，页面**必须仍然正常工作、记录不丢**。
 *      这一条用来防 A 的断言把受支持降级一起测红。
 *
 * 另附负向自证：不阻断任何模块时，A 的两个信号都必须**不**出现（证明 A 不是恒红）。
 *
 * 运行：node e2e/core-module-contract.test.js
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9810, 60);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-core-module-'));
const BASE = 'http://127.0.0.1:' + PORT;

/* 契约常量：与 core.js 的 _CORE_REQUIRED / 可见失败节点保持一致（单一事实来源是 core.js，
   这里只是断言用的期望值）。 */
const STATS_SIGNATURE = 'js/core-stats-signature.js';
const STORAGE_STATE = 'js/core-storage-state.js';
const FATAL_ID = 'coreFatal';
const FATAL_FLAG = '__coreModuleFatal';

let server = null, browser = null, passed = 0, failed = 0;

function check(name, ok, detail) {
  if (ok) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (detail ? '\n      → ' + detail : '')); }
}

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test' }),
      stdio: 'ignore'
    });
    let tries = 0;
    const iv = setInterval(function () {
      if (server.exitCode !== null) { clearInterval(iv); reject(new Error('server exit ' + server.exitCode)); return; }
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (r) {
        r.resume();
        if (r.statusCode === 200) { clearInterval(iv); resolve(); }
      });
      req.on('error', function () {});
      req.setTimeout(600, function () { req.destroy(); });
      /* 就绪窗口 300×100ms=30s：宿主普通 node 冷启动实测可达 5s+，窗口过小必然假红。 */
      if (++tries > 300) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 100);
  });
}

function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) {} server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}
}

/* 空档案：首页走空状态分支，不依赖 /content（本用例把 content 也断了）。 */
function seedLocal() {
  localStorage.clear();
  localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2, decks: [], best: {}, mastered: {}, deletedItems: {}, reinforceBook: [], progress: {},
    stats: { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [], daysLog: {} },
    settings: { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 10,
      sound: false, fxStack: false, celebrate: 'none', autoSpeak: false, darkMode: false }
  }));
}

async function newPage() {
  /* serviceWorkers:'block' 是必须的：SW 缓存的响应不走 network 层，
     page.route 拦不到，脚本会照常从缓存返回 → 阻断失效（假绿）。 */
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', function (e) { errs.push(e.message); });
  await page.route('**/api/**', function (r) { return r.abort('failed'); });
  await page.route('**/content/**', function (r) { return r.abort('failed'); });
  await page.addInitScript(seedLocal);
  return { ctx: ctx, page: page, errs: errs };
}

/* 读取「用户可见失败态」的两个信号：
   1) DOM 上真的存在一个**可见**节点（有盒、没被 display/visibility/hidden 藏掉）；
   2) core.js 暴露的结构化标记（用于断言缺的是哪个模块）。
   两者都要 —— 只看标记等于静态断言，只看文字无法定位缺哪个模块。 */
function fatalState(page) {
  return page.evaluate(function (ids) {
    const el = document.getElementById(ids.fatalId);
    let visible = false, text = '';
    if (el) {
      const rect = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      visible = !el.hidden && rect.height > 0 && rect.width > 0 &&
        cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) !== 0;
      text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    }
    return {
      exists: !!el,
      visible: visible,
      text: text,
      flag: window[ids.fatalFlag] || null,
      bootVisible: !!(function () { const b = document.getElementById('bootScreen'); return b && !b.hidden; })()
    };
  }, { fatalId: FATAL_ID, fatalFlag: FATAL_FLAG });
}

/* 用例 A：阻断某个必需模块 → 期望「用户可见失败」。
   返回 {state, hits}，由调用方断言（阻断前必须先跑负向自证，见 A0）。
   ⚠️ hits 是**正向对照**：只断言「没有横幅」时，「阻断没生效」与「阻断生效但静默降级」
      两种原因不可区分 —— 那样 A 就是一条永远不会变的护栏（本仓库踩过的假绿形态）。
      所以必须先证明请求真的被拦下了。 */
async function blockedModuleState(modulePath) {
  const ctx = await newPage();
  let hits = 0;
  await ctx.page.route('**/' + modulePath, function (r) { hits++; return r.abort('failed'); });
  await ctx.page.goto(BASE + '/main.html', { waitUntil: 'load' });
  /* 未修复时这里取不到 #coreFatal；waitForSelector 会等到超时（3s），随后断言报红。 */
  await ctx.page.waitForSelector('#' + FATAL_ID, { timeout: 3000 }).catch(function () {});
  const state = await fatalState(ctx.page);
  await ctx.ctx.close();
  return { state: state, hits: hits };
}

function assertFatal(label, modulePath, result) {
  check(label + '：阻断真的生效（正向对照，否则红=假红）', result.hits >= 1,
    'route hits=' + result.hits + '（0 = 请求没被拦到，本用例无判据能力）');
  const state = result.state;
  const missing = (state.flag && Array.isArray(state.flag.missing)) ? state.flag.missing : [];
  check(label + '：记录「缺的是哪个模块」', missing.indexOf(modulePath) >= 0,
    'missing=' + JSON.stringify(missing) + ' flag=' + JSON.stringify(state.flag));
  check(label + '：用户可见失败横幅出现（不是只有 console）',
    state.exists && state.visible && /启动失败/.test(state.text),
    'exists=' + state.exists + ' visible=' + state.visible + ' text=' + JSON.stringify(state.text));
}

(async function () {
  try {
    await startServer();
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_PATH || chromium.executablePath()
    });

    console.log('【负向自证】不阻断任何模块：两个失败信号都必须不出现');
    const okCtx = await newPage();
    await okCtx.page.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
    await okCtx.page.waitForSelector('#homeBody', { timeout: 12000 });
    await okCtx.page.waitForTimeout(600);
    const okState = await fatalState(okCtx.page);
    check('A0 未阻断模块 → 无核心模块失败标记', !okState.flag, JSON.stringify(okState.flag));
    check('A0 未阻断模块 → 无可见失败横幅（证明 A 不是恒红）', !okState.exists, JSON.stringify(okState));
    check('A0 未阻断模块 → 页面正常进入首页', !okState.bootVisible, JSON.stringify(okState));
    await okCtx.ctx.close();

    console.log('【用例 A】必需核心模块缺失 → 必须用户可见地失败');
    assertFatal('A1 ' + STATS_SIGNATURE, STATS_SIGNATURE, await blockedModuleState(STATS_SIGNATURE));
    assertFatal('A2 ' + STORAGE_STATE, STORAGE_STATE, await blockedModuleState(STORAGE_STATE));

    console.log('【用例 B】IDB 不可用 → 受支持降级，必须仍然正常工作（防误杀）');
    const bCtx = await newPage();
    await bCtx.page.addInitScript(function () {
      /* 隐私模式 / 禁用 IndexedDB 的真实形态：indexedDB 不存在。
         idb.js 仍会挂 global.IDBStore，但其 open() 会在 core.js 里被 catch 成
         _statsStore='local'（core.js 的受支持降级分支）。 */
      try { Object.defineProperty(window, 'indexedDB', { configurable: true, get: function () { return undefined; } }); }
      catch (e) { try { window.indexedDB = undefined; } catch (e2) {} }
    });
    await bCtx.page.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
    await bCtx.page.waitForSelector('#pageHome:not(.hidden)', { timeout: 15000 });
    await bCtx.page.waitForTimeout(600);
    const bState = await bCtx.page.evaluate(async function (fatalFlag) {
      const now = Date.now();
      mem.stats.totalAnswered = 7;
      mem.stats.bySentence = Object.assign({}, mem.stats.bySentence, {
        'd1#x1': { deckId: 'd1', cid: 'x1', sentence: 'Hi there.', times: 1, okTimes: 1,
          wrongTimes: 0, streak: 1, dueAt: now + 86400000, lastAt: now }
      });
      const accepted = CL.saveMem(mem, true, null);
      await CL.lastSave();
      let raw = null;
      try { raw = JSON.parse(localStorage.getItem(CL.STORE_KEY) || '{}'); } catch (e) {}
      const stats = (raw && raw.stats) || null;
      const el = document.getElementById('coreFatal');
      return {
        accepted: accepted,
        mode: CL.statsStoreMode(),
        fatal: window[fatalFlag] || null,
        banner: !!(el && !el.hidden),
        persistedTotal: stats ? stats.totalAnswered : null,
        persistedRows: (stats && stats.bySentence) ? Object.keys(stats.bySentence).length : -1
      };
    }, FATAL_FLAG);
    check('B1 IDB 不可用 → 走受支持降级（statsStoreMode=local）', bState.mode === 'local', JSON.stringify(bState));
    check('B2 不进入致命失败态（防 A 的判据误杀受支持降级）',
      !bState.fatal && !bState.banner, JSON.stringify(bState));
    check('B3 答题记录仍然落盘、不丢数据',
      bState.accepted === true && bState.persistedTotal === 7 && bState.persistedRows >= 1,
      JSON.stringify(bState));
    await bCtx.ctx.close();

    console.log('\n[core-module-contract] ' + passed + ' 通过 / ' + failed + ' 失败');
    if (failed) process.exitCode = 1;
  } catch (error) {
    console.error('[core-module-contract] failed:', (error && error.message) || error);
    process.exitCode = 1;
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
    stopServer();
  }
})();
