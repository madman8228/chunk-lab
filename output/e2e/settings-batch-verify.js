/**
 * settings-batch-verify.js · 设置面板「行尾控件」宽度统一 + 每批数量改选档（2026-09-11）
 *
 * 老板截图要求：
 *   1. 答题模式 / 每批数量 / 庆祝效果 三个控件**宽度一致、右边缘对齐**
 *   2. 每批数量**不让用户手填数字**，只给 10 / 15 / 20 / 30 四档
 *
 * 断言：
 *   A. 布局：三控件同宽（78px）+ 右边缘对齐；#setBatchSize 是 SELECT（无手填入口）
 *   B. 档位：#setBatchSize options 恰为 10/15/20/30，默认选中 10
 *   C. 旧值归一化：12→10、50→30、25→20（平局取小）、15→15 原样保留
 *   D. 关键设计：loadStore **不**归一化（12 仍是 12）——否则会破坏注入 batchSize=5/3 的
 *      分批场景用例，也会在用户没动设置时就改数据
 *   E. 源码守卫：两处归一化入口必须都在（渲染面板 / 保存设置）
 *   F. 全程零 pageerror / console.error
 *
 * 运行：node output/e2e/settings-batch-verify.js
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

/* 端口：避开宿主机已占端口（共享工具，根因见 e2e/lib/free-port.js 头部注释） */
const PORT = require('../../e2e/lib/free-port').freePort(8902, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-setbs-'));
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
  else { failed++; console.log('  ✗ ' + name + (detail !== undefined ? '  → ' + detail : '')); }
}

const CHROMIUM = process.env.CHROMIUM_PATH ||
  'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe';

(async function main() {
  const BASE = 'http://127.0.0.1:' + PORT;
  await startServer();
  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', function (e) { errs.push(String(e)); });
  page.on('console', function (m) {
    /* 本套件**故意** abort 了 **\/api/**（隔离云同步噪声）→ 浏览器必然打 net::ERR_FAILED，
       那是我们自己造成的，不算应用错误；pageerror 仍然严格收集。 */
    if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) errs.push(m.text());
  });
  await page.route('**/api/**', function (r) { r.abort('failed'); }); /* 纯本地，隔离云同步噪声 */

  const readCtls = function () {
    return page.evaluate(function () {
      var out = {};
      ['setMode', 'setBatchSize', 'setCelebrate'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) { out[id] = null; return; }
        var r = el.getBoundingClientRect();
        out[id] = {
          tag: el.tagName,
          w: Math.round(r.width),
          right: Math.round(r.right),
          value: el.value,
          opts: el.tagName === 'SELECT' ? Array.prototype.map.call(el.options, function (o) { return o.value; }) : null,
          readOnly: el.tagName !== 'SELECT'
        };
      });
      return out;
    });
  };
  async function openSettings() {
    await page.locator('#btnSettingsTop').click();
    await page.waitForSelector('#setBatchSize', { state: 'visible', timeout: 5000 });
  }
  async function closeSettings() {
    await page.evaluate(function () { closeMasks(); });
  }
  /* 写一个旧值进 mem（模拟历史数据 / 外部注入），只落本地不触发云同步 */
  async function seed(v) {
    await page.evaluate(function (val) { mem.settings.batchSize = val; saveStore('local'); }, v);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#btnSettingsTop', { timeout: 10000 });
  }
  async function savedValue() {
    return page.evaluate(function () { return mem.settings.batchSize; });
  }

  console.log('[1] 首次打开设置：三控件同宽 + #setBatchSize 是下拉档位');
  await page.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#btnSettingsTop', { timeout: 10000 });
  await openSettings();
  const c = await readCtls();
  await page.screenshot({ path: path.join(SHOTS, 'settings-row-widths.png') });
  check('#setBatchSize 是 SELECT（不提供手填数字入口）', !!(c.setBatchSize && c.setBatchSize.tag === 'SELECT'),
    c.setBatchSize && c.setBatchSize.tag);
  check('#setBatchSize options 恰为 10/15/20/30',
    !!(c.setBatchSize && c.setBatchSize.opts && c.setBatchSize.opts.join(',') === '10,15,20,30'),
    c.setBatchSize && JSON.stringify(c.setBatchSize.opts));
  check('#setBatchSize 默认选中 10（与 mem 默认一致）',
    !!(c.setBatchSize && c.setBatchSize.value === '10'), c.setBatchSize && c.setBatchSize.value);
  check('三控件同宽（答题模式 / 每批数量 / 庆祝效果）',
    !!(c.setMode && c.setBatchSize && c.setCelebrate &&
       c.setMode.w === c.setBatchSize.w && c.setBatchSize.w === c.setCelebrate.w),
    JSON.stringify({ mode: c.setMode && c.setMode.w, batch: c.setBatchSize && c.setBatchSize.w, celebrate: c.setCelebrate && c.setCelebrate.w }));
  check('三控件右边缘对齐（差 ≤1px）',
    !!(c.setMode && c.setBatchSize && c.setCelebrate &&
       Math.abs(c.setMode.right - c.setBatchSize.right) <= 1 &&
       Math.abs(c.setBatchSize.right - c.setCelebrate.right) <= 1),
    JSON.stringify({ mode: c.setMode && c.setMode.right, batch: c.setBatchSize && c.setBatchSize.right, celebrate: c.setCelebrate && c.setCelebrate.right }));
  check('控件宽度落在 e2e 红线内（≥40 且 ≤80）',
    !!(c.setBatchSize && c.setBatchSize.w >= 40 && c.setBatchSize.w <= 80), c.setBatchSize && c.setBatchSize.w);
  await closeSettings();

  console.log('[2] 旧值归一化：下拉能且只能表达 10/15/20/30');
  const cases = [
    { seed: 12, expect: '10', why: '12 最近 10' },
    { seed: 50, expect: '30', why: '50 超上界 → 30' },
    { seed: 25, expect: '20', why: '25 平局取小' },
    { seed: 15, expect: '15', why: '合法档位原样保留' },
    { seed: 3,  expect: '10', why: '3 最近 10' }
  ];
  for (const cs of cases) {
    await seed(cs.seed);
    const raw = await page.evaluate(function () { return mem.settings.batchSize; });
    check('loadStore 不归一化（注入 ' + cs.seed + ' 后 mem 仍是 ' + cs.seed + '）', raw === cs.seed, raw);
    await openSettings();
    const shown = await page.evaluate(function () { return document.getElementById('setBatchSize').value; });
    check('设置面板显示 ' + cs.expect + '（' + cs.why + '）', shown === cs.expect, shown);
    await page.locator('#btnSaveSettings').click();
    await page.waitForTimeout(300);
    const after = await savedValue();
    check('保存后 mem.settings.batchSize = ' + Number(cs.expect), after === Number(cs.expect), after);
  }

  console.log('[3] 源码守卫：两处归一化入口必须都在');
  const src = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
  check('渲染设置面板时归一化（防 select.value 空串 → 显示空白）',
    src.indexOf("$('setBatchSize').value = String(normBatchSize(mem.settings.batchSize))") >= 0);
  check('保存设置时归一化（唯一写入口）',
    src.indexOf("mem.settings.batchSize = normBatchSize($('setBatchSize').value)") >= 0);
  check('不再有 parseInt($(\'setBatchSize\').value) 手填解析残留',
    src.indexOf("parseInt($('setBatchSize').value") < 0);

  console.log('[4] 全程零 pageerror / console.error');
  check('零错误', errs.length === 0, errs.join('\n  '));

  console.log('\n结果：' + passed + ' 通过 / ' + failed + ' 失败');
  await browser.close();
  stopServer();
  process.exit(failed ? 1 : 0);
})().catch(function (e) { console.error(e); stopServer(); process.exit(2); });
