/* e2e visual regression for freq-idioms.js deck integration (v5 — batch-aware)
 * - main.html boots via CL.ensureCloud().then(...) — wait for CL + BUILTIN ready
 * - Call openDecks() to render deckList
 * - Assert new deck "高频短语 · English Idioms" appears with all DATA_FREQ_IDIOMS items
 *   （期望值从 freq-idioms.js 现读，扩写批次后无需改本脚本）
 * - Screenshot pageDecks + practice page
 * - Tolerate sw.js 404 (e2e blocks service worker) + /api/* (test has no backend)
 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

/* 期望条数 = freq-idioms.js 数据区条目数（sentence: 键出现次数），随批次自动跟随 */
const expectedItems = (fs.readFileSync(path.join(__dirname, '..', 'freq-idioms.js'), 'utf8').match(/^\s{4}sentence: /gm) || []).length;

(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chromium',
    args: ['--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  /* 只收集「产品代码」错误（pageerror + 业务 console.error），忽略 fetch/sw 副作用。 */
  const prodErrs = [];
  page.on('pageerror', (e) => prodErrs.push('PAGEERR: ' + e.message));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    /* fetch 网络噪音：测试环境无后端 + 主动 block sw.js */
    if (/Failed to load resource/.test(text)) return;
    if (/An unknown error occurred when fetching/.test(text)) return;
    const loc = msg.location();
    if (loc && loc.url && /\/api\//.test(loc.url)) return;
    if (loc && loc.url && /\/sw\.js/.test(loc.url)) return;
    prodErrs.push('CONSOLE: ' + text);
  });

  /* 主动 block sw.js（PWA 离线测试环境外不必要） */
  await ctx.route('**/sw.js', (route) => route.abort());

  await page.goto('http://localhost:19878/main.html', { waitUntil: 'load', timeout: 30000 });
  /* 去冗余后运行态 2 deck（daily + freq-idioms）。断言 builtin-freq-idioms 注册即可，别写死 deck 总数。 */
  await page.waitForFunction(() => window.BUILTIN && window.BUILTIN.some((d) => d.id === 'builtin-freq-idioms'), null, { timeout: 20000 });
  await page.waitForFunction(() => window.mem && window.mem.decks !== undefined, null, { timeout: 20000 });

  /* 渲染 deckList */
  await page.evaluate(() => { try { openDecks(); } catch (e) { /* ignore */ } });
  await page.waitForFunction(() => document.querySelectorAll('#deckList .deck-item').length >= 1, null, { timeout: 15000 });

  const rows = await page.$$eval('#deckList > *', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
  console.log('--- deckList rows (', rows.length, ') ---');
  rows.forEach((t, i) => console.log('  [' + i + ']', t.slice(0, 140)));

  const hasNew = rows.some((t) => t.indexOf('高频短语 · English Idioms') >= 0);
  const itemCount = await page.evaluate(() => {
    const a = (window.CL && window.CL.allDecksView(window.mem || {})) || [];
    const d = a.find((x) => x.id === 'builtin-freq-idioms');
    return d ? d.items.length : -1;
  });
  console.log('--- contains new deck? ---', hasNew, '| items:', itemCount);

  const sample3 = await page.evaluate(() => {
    const a = (window.CL && window.CL.allDecksView(window.mem || {})) || [];
    const d = a.find((x) => x.id === 'builtin-freq-idioms');
    if (!d) return [];
    return d.items.slice(0, 3).map((it) => ({ sentence: it.sentence, translation: it.translation, chunks: it.chunks, cid: it.cid }));
  });
  console.log('--- sample[0..2] ---');
  sample3.forEach((s, i) => console.log('  [' + i + ']', s.sentence, '|', s.translation, '| cid=' + s.cid, '| chunks=' + JSON.stringify(s.chunks)));

  const outDir = 'D:/06-project/chunk-practice/output';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, 'freq-idioms-decklist.png'), fullPage: true });

  await page.evaluate(() => {
    const a = (window.CL && window.CL.allDecksView(window.mem || {})) || [];
    const d = a.find((x) => x.id === 'builtin-freq-idioms');
    if (d && typeof startDeck === 'function') startDeck(d);
  });
  await page.waitForTimeout(800);
  const stageHtml = await page.$eval('#stage', (el) => el.innerText.slice(0, 220)).catch(() => '(no #stage)');
  console.log('--- after startDeck stage head ---');
  console.log(stageHtml);
  await page.screenshot({ path: path.join(outDir, 'freq-idioms-practice.png'), fullPage: true });

  console.log('--- production errors (first 10) ---');
  prodErrs.slice(0, 10).forEach((e) => console.log(' ', e));
  console.log('--- total product errors ---', prodErrs.length);

  await browser.close();

  const ok = hasNew && itemCount === expectedItems && prodErrs.length === 0;
  console.log('--- RESULT ---', ok ? '✅ PASS' : '❌ FAIL');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
