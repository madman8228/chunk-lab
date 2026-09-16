/* stats-index.test.js · 学习档案只加载轻量 index，开始复习时再取详情 */
'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9610, 100);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-stats-index-'));
let server = null;
let browser = null;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test' }),
      stdio: 'ignore'
    });
    var tries = 0;
    var iv = setInterval(function () {
      if (server.exitCode !== null) { clearInterval(iv); reject(new Error('server exit ' + server.exitCode)); return; }
      var req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (res) {
        res.resume();
        if (res.statusCode === 200) { clearInterval(iv); resolve(); }
      });
      req.on('error', function () {});
      req.setTimeout(600, function () { req.destroy(); });
      if (++tries > 40) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 400);
  });
}

function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) {} server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}
}

function check(name, ok, detail) {
  if (!ok) throw new Error(name + (detail ? ' → ' + detail : ''));
  console.log('  ✓ ' + name);
}

(async function () {
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
    const page = await browser.newPage();
    const contentRequests = [];
    const errors = [];
    page.on('request', function (req) {
      var url = req.url();
      var name = url.split('/').pop();
      if (url.indexOf('/content/') >= 0 && name !== 'manifest.json') contentRequests.push(name);
    });
    page.on('pageerror', function (e) { errors.push(e.message); });
    await page.goto(BASE + '/stats.html', { waitUntil: 'load' });
    await page.waitForSelector('#todayAnswered');
    check('默认打开概览', await page.locator('[data-tab="overview"]').getAttribute('aria-pressed') === 'true');
    await page.click('[data-tab="sent"]');
    await page.waitForFunction(function () {
      return document.querySelectorAll('.stats-detail-row').length === 50;
    });
    var tabLayout = await page.evaluate(function () {
      return Array.prototype.map.call(document.querySelectorAll('#statsTabs .tab'), function (tab) {
        return { key: tab.dataset.tab, text: tab.textContent.trim() };
      });
    });
    check('学习档案按行动顺序排列并明确命名学习记录',
      tabLayout.map(function (tab) { return tab.key; }).join('|') === 'overview|review|wrong|sent' &&
      tabLayout[3].text === '学习记录', JSON.stringify(tabLayout));
    await page.fill('#statsSentenceSearch', 'looks like');
    await page.waitForFunction(function () {
      return document.querySelectorAll('.stats-detail-row').length === 1;
    });
    check('学习记录支持按句子即时搜索',
      await page.locator('.stats-detail-row .en').first().innerText() === "It looks like it's going to rain.",
      await page.locator('.stats-detail-row .en').first().innerText());
    await page.fill('#statsSentenceSearch', '');
    await page.waitForFunction(function () {
      return document.querySelectorAll('.stats-detail-row').length === 50;
    });

    var first = await page.evaluate(function () {
      var d = window.ContentRepo.getManifest().decks;
      return {
        rows: document.querySelectorAll('.stats-detail-row').length,
        total: allDecks().reduce(function(n,deck){return n+deck.items.length;},0),
        indexShards: d.reduce(function (n, entry) { return n + (entry.indexShards || []).length; }, 0)
      };
    });
    var indexRequests = contentRequests.filter(function (name) { return name.indexOf('index-') >= 0; });
    var detailRequests = contentRequests.filter(function (name) { return name.indexOf('index-') < 0; });
    check('统计页使用轻量 index 保留完整列表并分页显示', first.rows === 50 && first.total >= 600 && first.indexShards >= 3, JSON.stringify(first));
    check('统计页未请求完整详情分片', detailRequests.length === 0, JSON.stringify(contentRequests));
    check('统计页已请求 index 分片', indexRequests.length >= 3, JSON.stringify(contentRequests));

    var monthSummary = await page.evaluate(function () {
      var now = new Date(), current = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).getTime();
      var prior = new Date(now.getFullYear(), now.getMonth() - 1, 15, 12, 0, 0).getTime();
      var by = {}, events = [], i;
      for (i = 0; i < 102; i++) {
        by['month-fixture#' + i] = { times: 1, okTimes: 1, wrongTimes: 0 };
        events.push({ id: 'month-fixture-' + i, kind: 'answer', key: 'month-fixture#' + i, ok: true, at: i < 100 ? prior + i : current + i });
      }
      return monthActivitySummary({ stats: { totalAnswered: 102, bySentence: by, events: events } });
    });
    check('本月答题只统计本月日期，累计答题保持全历史',
      monthSummary.answered === 2 && monthSummary.totalAnswered === 102 && monthSummary.days === 1,
      JSON.stringify(monthSummary));

    var hydrated = await page.evaluate(async function () {
      var mem = window.CL.loadMem();
      var deck = await window.ContentRepo.ensureDeckIndex('oral-6-31', mem);
      var summary = deck.items.find(function (item) { return item._contentRef; });
      var full = await window.ContentRepo.hydrateItems([summary]);
      var it = full[0] || {};
      /* 索引摘要只有 cid/sentence/translation + 引用；chunks/hints 只存在于详情分片。
         把详情分片读回来与结果逐字段对位 —— 不依赖「某句恰好有 explanations」这类数据巧合
         （快档骨架句确实没有 explanations，但那不是水合该背的锅）。 */
      var src = null;
      if (it._contentRef && it._contentRef.url) {
        var resp = await fetch(it._contentRef.url);
        var data = await resp.json();
        src = (data.items || [])[it._contentRef.offset] || null;
      }
      var hydKeys = Object.keys(it).filter(function (k) { return k.charAt(0) !== '_'; }).sort().join(',');
      var srcKeys = src ? Object.keys(src).sort().join(',') : '';
      return {
        cid: summary.cid,
        fullCid: it.cid,
        chunks: it.chunks && it.chunks.length,
        hints: it.hints && it.hints.length,
        fieldMatch: !!srcKeys && hydKeys === srcKeys,
        detail: { hydKeys: hydKeys, srcKeys: srcKeys }
      };
    });
    check('开始复习时按索引引用精确加载详情', hydrated.cid === hydrated.fullCid && hydrated.chunks > 0, JSON.stringify(hydrated));
    check('详情按需加载（返回详情分片记录，而非索引摘要）',
      hydrated.fieldMatch && hydrated.hints > 0, JSON.stringify(hydrated.detail));
    check('索引流程无页面错误', errors.length === 0, errors.slice(0, 3).join(' | '));

    // Real answer -> save -> reload -> overview and calendar agree without a round.
    const ctx = await browser.newContext({timezoneId:'Asia/Shanghai'});
    const p = await ctx.newPage();
    await p.route('**/api/**', r => r.abort());
    await p.goto(BASE+'/main.html?direct=1');
    await p.waitForFunction(() => window.S && S.items && S.items.length > 1 && typeof showFullSentence === 'function');
    await p.evaluate(async () => { showFullSentence(); await saveStore(); });
    await p.goto(BASE+'/stats.html');
    /* ⚠️ 只等「元素出现」不够：stats.html 是两段式渲染 ——
       ① paintLocalStats（180ms 定时器）先用 localStorage 同步副本画一版，
          此时 IDB 的 events 还没水合，今日答题 = 0；
       ② CL.preload() 完成水合后 renderStats() 重画为 1（见 stats.html:967-1000）。
       在 ① 之后立即读 innerText ⇒ 机器负载高时会读到中间态 0
       （2026-09-15 全量 npm test 偶发红，单跑必绿）。
       改为轮询「值变成 1」：真回归成 0 会超时判红，判据未被削弱。 */
    await p.waitForSelector('#todayAnswered');
    const todayOk = await p.waitForFunction(function () {
      var el = document.getElementById('todayAnswered');
      return !!el && el.textContent.trim() === '1';
    }, null, { timeout: 8000 }).then(function () { return true; }, function () { return false; });
    check('答完一句未结算也计入今日', todayOk,
      '实际 ' + await p.locator('#todayAnswered').innerText().catch(function () { return '(n/a)'; }));
    check('未结算不会虚增轮次', await p.evaluate(() => mem.stats.totalRounds) === 0);
    for(const width of [360,390,1171]){
      await p.setViewportSize({width,height:960});
      check('概览无横向溢出 '+width,await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await p.screenshot({path:path.join(ROOT,'output','stats-overview-'+width+'.png')});
    }
    await p.goto(BASE+'/main.html');
    await p.waitForSelector('.cal-cell.today');
    /* 同理：data-answered 也要等内存桥水合后回填 —— 等「值」而不是等「元素」 */
    const calOk = await p.waitForFunction(function () {
      var el = document.querySelector('.cal-cell.today');
      return !!el && el.getAttribute('data-answered') === '1';
    }, null, { timeout: 8000 }).then(function () { return true; }, function () { return false; });
    check('首页日历显示同一次答题', calOk,
      '实际 ' + await p.locator('.cal-cell.today').getAttribute('data-answered').catch(function () { return '(n/a)'; }));
    check('未完成整轮也点亮学习日', !(await p.locator('.cal-cell.today').getAttribute('class')).split(' ').includes('l0'));
    await ctx.close();

    await browser.close();
    browser = null;
    stopServer();
    console.log('[stats-index e2e] passed');
  } catch (err) {
    if (browser) { try { await browser.close(); } catch (e) {} browser = null; }
    stopServer();
    console.error('[stats-index e2e] failed:', err && err.stack || err);
    process.exitCode = 1;
  }
})();
