/**
 * chip-name-cleanup.js · 练习页题库胶囊（#deckName）精简回归（2026-09-11）
 *
 * 背景：老板截图要求删掉胶囊里三个冗余元素——
 *   ① 左侧面包屑分隔符 ›    ②『错题』前缀    ③ 队列名里拼的「· N 句」
 * 改完的期望：临时队列胶囊只显示语义本身（`需巩固` / `错题`）。
 *
 * 断言：
 *   1. practice-context 内不存在 .crumb-sep（含 DOM 与 CSS 规则，防死代码回流）
 *   2. 需巩固队列 deckName === '需巩固'（无前缀、无句数、无 ›）
 *   3. 错题队列   deckName === '错题'
 *   4. 胶囊文本不含「句」
 *   5. 源码守卫：main.html / stats.html 里所有临时队列 name 不再拼 `· N 句`
 *   6. 全程零 pageerror / console.error
 *
 * 运行：node output/e2e/chip-name-cleanup.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

/* 端口：向 OS 要空闲端口，避免与宿主机常驻服务撞端口造成假失败（同 ring-popover-verify） */
let PORT = 9060 + Math.floor(Math.random() * 60);
function pickFreePort() {
  return new Promise(function (resolve) {
    const srv = require('net').createServer();
    srv.on('error', function () { resolve(0); });
    srv.listen(0, '127.0.0.1', function () {
      const p = srv.address().port;
      srv.close(function () { resolve(p); });
    });
  });
}
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-chip-'));
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
  else { failed++; console.log('  ✗ ' + name + (detail ? '  → ' + detail : '')); }
}

(async function main() {
  PORT = (await pickFreePort()) || PORT;
  const BASE = 'http://127.0.0.1:' + PORT;
  await startServer();
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', function (e) { errs.push(String(e)); });
  page.on('console', function (m) { if (m.type() === 'error') errs.push(m.text()); });

  console.log('[1] 注入 1 需巩固句 + 1 错题（无到期 → 首页出现两个复习入口）');
  await page.goto(BASE + '/main.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.evaluate(function () {
    const d = allDecks()[0], it = d.items[0];
    const key = CL.cidKey(d.id, it);
    const now = Date.now();
    mem.stats = mem.stats || { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [] };
    /* 3 练 1 对 → acc 0.33 < 0.6 → weak；dueAt 未来 → 不算到期 */
    mem.stats.bySentence[key] = { deckId: d.id, sentence: it.sentence, translation: it.translation || '',
      times: 3, okTimes: 1, wrongTimes: 2, streak: 0, maxStreak: 0, interval: 1, ease: 2.5,
      dueAt: now + 86400000, lastAt: now };
    mem.reinforceBook = [{ _key: d.id + '::' + it.sentence, deckId: d.id, deckName: d.name, addedAt: now,
      sentence: it.sentence, translation: it.translation || '', chunks: it.chunks, hints: it.hints || [], mistakes: [] }];
    saveStore();
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  console.log('[2] 面包屑分隔符 › 已从 DOM + CSS 全部移除');
  check('DOM 无 .crumb-sep', await page.locator('.crumb-sep').count() === 0);
  const mainSrc = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
  check('main.html 无 .crumb-sep 规则残留', mainSrc.indexOf('.crumb-sep') < 0);

  console.log('[3] 需巩固队列胶囊 = 纯「需巩固」');
  check('首页有「复习需巩固」入口', await page.locator('#homeBtnWeak').isVisible().catch(function () { return false; }));
  await page.click('#homeBtnWeak');
  await page.waitForTimeout(900);
  const weakChip = (await page.locator('#deckName').textContent()).trim();
  check('deckName === 需巩固（实 ' + JSON.stringify(weakChip) + '）', weakChip === '需巩固');
  check('胶囊不含「句」', weakChip.indexOf('句') < 0);
  check('胶囊不含「错题」前缀', weakChip.indexOf('错题') < 0);
  check('胶囊不含 ›', weakChip.indexOf('›') < 0 && weakChip.indexOf('>') < 0);
  await page.screenshot({ path: path.join(SHOTS, 'chip-01-weak.png') });

  console.log('[4] 错题队列胶囊 = 纯「错题」');
  await page.goto(BASE + '/main.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  check('首页有「复习错题」入口', await page.locator('#homeBtnBook').isVisible().catch(function () { return false; }));
  await page.click('#homeBtnBook');
  await page.waitForTimeout(900);
  const bookChip = (await page.locator('#deckName').textContent()).trim();
  check('deckName === 错题（实 ' + JSON.stringify(bookChip) + '）', bookChip === '错题');
  check('胶囊不含「句」', bookChip.indexOf('句') < 0);
  check('胶囊不含『错题』前缀重复', bookChip.indexOf('『错题』') < 0);
  await page.screenshot({ path: path.join(SHOTS, 'chip-02-book.png') });

  console.log('[5] 源码守卫：临时队列 name 不再拼「· N 句」');
  const statsSrc = fs.readFileSync(path.join(ROOT, 'stats.html'), 'utf8');
  const badName = /name:\s*'[^']*·\s*'\s*\+\s*items\.length\s*\+\s*'\s*句'/g;
  const mainHits = mainSrc.match(badName) || [];
  const statsHits = statsSrc.match(badName) || [];
  check('main.html 零处残留', mainHits.length === 0, mainHits.join(' | '));
  check('stats.html 零处残留', statsHits.length === 0, statsHits.join(' | '));

  console.log('[6] 全程零 pageerror / console.error');
  check('零错误', errs.length === 0, errs.join('\n  '));

  console.log('\n结果：' + passed + ' 通过 / ' + failed + ' 失败');
  await browser.close();
  stopServer();
  process.exit(failed ? 1 : 0);
})().catch(function (e) { console.error(e); stopServer(); process.exit(2); });
