/**
 * settings-head-height-verify.js · 设置弹窗标题栏（.modal-head）高度压缩（2026-09-11）
 *
 * 老板截图要求：标题栏那条边太高，移动设备视口本就不高 → 压缩。
 *
 * 高度公式：head = max(h3 行高, 关闭按钮高) + padding×2 + 1px 分隔线
 *   改前：padding 10px + 按钮 28px → 49px（按钮才是实际高度决定者）
 *   改后：PC 7px 左右 → 43px；≤840px 4px + 按钮 28px → 37px
 * 被本套件钉住的设计决策：
 *   - 只削 padding 不够，**必须同时把关闭按钮收成紧凑方形**（原来靠 padding 撑宽度）
 *   - 移动端覆盖规则必须写在 #settingsMask 基础规则**之后**（媒体查询不加特异性，
 *     同特异性后写者胜；写在前面会被基础规则反压 → 改了等于没改）
 *   - 按钮不得小于 26px（触屏仍要点得到）
 *
 * 运行：node output/e2e/settings-head-height-verify.js
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
const PORT = require('../../e2e/lib/free-port').freePort(8980, 40);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-sethead-'));
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

/* PC 红线：改前 49px；≤46 才算压缩过，同时 ≥32 防「压成一条缝」 */
const PC_MAX = 46, PC_MIN = 32;
/* 移动红线：≤840px 再收一档；≤40 且必须比 PC 更矮（证明媒体查询真的生效） */
const MOB_MAX = 40, MOB_MIN = 30;

async function openSettings(pg) {
  await pg.waitForSelector('#btnSettingsTop', { timeout: 10000 });
  await pg.locator('#btnSettingsTop').click();
  await pg.waitForSelector('#setDarkMode', { state: 'visible', timeout: 5000 });
}

/* 量标题栏：head / h3 / 关闭按钮 三个盒子的高度与中线，用于验证「按钮决定高度」与「垂直居中」 */
async function headMetrics(pg) {
  return pg.evaluate(function () {
    var head = document.querySelector('#settingsMask .modal-head');
    var h3 = head && head.querySelector('h3');
    var btn = head && head.querySelector('.btn');
    if (!head || !h3 || !btn) return { missing: { head: !head, h3: !h3, btn: !btn } };
    var hr = head.getBoundingClientRect(), tr = h3.getBoundingClientRect(), br = btn.getBoundingClientRect();
    var cs = getComputedStyle(head);
    var mid = function (r) { return r.top + r.height / 2; };
    return {
      headH: Math.round(hr.height), headTop: Math.round(hr.top), headBottom: Math.round(hr.bottom),
      headPadTop: cs.paddingTop, headPadBottom: cs.paddingBottom,
      h3H: Math.round(tr.height), h3Font: getComputedStyle(h3).fontSize,
      btnW: Math.round(br.width), btnH: Math.round(br.height),
      btnIconBox: (function () { var i = btn.querySelector('svg.icon'); if (!i) return null; var r = i.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })(),
      /* 中线偏差（< 2px 视为居中；做四舍五入所以给 1 的容差） */
      h3MidOff: Math.abs(mid(tr) - mid(hr)), btnMidOff: Math.abs(mid(br) - mid(hr)),
      /* 按钮是否被 head 裁掉（溢出说明压缩压过头） */
      btnInside: br.top >= hr.top - 0.5 && br.bottom <= hr.bottom + 0.5,
      h3Inside: tr.top >= hr.top - 0.5 && tr.bottom <= hr.bottom + 0.5,
      /* 分隔线：1px 底边 */
      borderBottom: cs.borderBottomWidth,
      vh: window.innerHeight, vw: window.innerWidth
    };
  });
}

(async function main() {
  const BASE = 'http://127.0.0.1:' + PORT;
  await startServer();
  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM });

  /* ---------- [1] 源码守卫（CSS 顺序坑） ---------- */
  console.log('[1] 源码守卫：压缩规则在位 + 媒体查询写在基础规则之后');
  const src = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
  const baseIdx = src.indexOf('#settingsMask .modal-head{padding:7px 16px');
  const mobIdx = src.indexOf('#settingsMask .modal-head{padding:4px 14px}');
  const footIdx = src.indexOf('#settingsMask .modal-foot{padding:8px 16px}');
  check('基础规则在位：#settingsMask .modal-head{padding:7px 16px;gap:8px}', baseIdx >= 0, 'idx=' + baseIdx);
  check('关闭按钮已收成紧凑方形（width:28px;height:28px）',
    src.indexOf('#settingsMask .modal-head .btn.sm{padding:0;width:28px;height:28px') >= 0);
  check('移动端覆盖规则在位：#settingsMask .modal-head{padding:4px 14px}', mobIdx >= 0, 'idx=' + mobIdx);
  check('⚠️ 顺序：移动端覆盖写在基础设置规则之后（否则被同特异性反压 → 改了等于没改）',
    mobIdx > baseIdx && mobIdx > footIdx, JSON.stringify({ base: baseIdx, foot: footIdx, mob: mobIdx }));
  check('防回流：旧的 padding:10px 16px 已不存在', src.indexOf('#settingsMask .modal-head{padding:10px 16px') < 0);

  /* ---------- [2] PC（1280×820，默认无触屏） ---------- */
  console.log('[2] PC：标题栏高度 + 垂直居中 + 关闭按钮触区');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', function (e) { errs.push(String(e)); });
  page.on('console', function (m) {
    /* 本套件**故意** abort 了 /api/**（隔离云同步噪声）→ 浏览器必然打 net::ERR_FAILED，
       那是我们自己造成的，不算应用错误；pageerror 仍严格收集。 */
    if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) errs.push(m.text());
  });
  await page.route('**/api/**', function (r) { r.abort('failed'); });
  await page.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
  await openSettings(page);
  const pc = await headMetrics(page);
  await page.mouse.move(4, 700); /* 移开指针，避免 hover 态污染截图（关闭按钮会显灰底） */
  await page.locator('#settingsMask .modal-head').screenshot({ path: path.join(SHOTS, 'settings-head-pc.png') });
  await page.locator('#settingsMask .modal').screenshot({ path: path.join(SHOTS, 'settings-modal-pc.png') });
  check('PC 标题栏高度 ≤ ' + PC_MAX + 'px（改前 49px）', pc.headH <= PC_MAX, JSON.stringify(pc));
  check('PC 标题栏高度 ≥ ' + PC_MIN + 'px（没压成一条缝）', pc.headH >= PC_MIN, 'h=' + pc.headH);
  check('PC 关闭按钮是方形（|w-h| ≤ 1）且 ≥ 26px 可点', Math.abs(pc.btnW - pc.btnH) <= 1 && pc.btnW >= 26,
    JSON.stringify({ w: pc.btnW, h: pc.btnH }));
  check('PC 关闭按钮图标 15×15（放宽后未被裁）', !!pc.btnIconBox && pc.btnIconBox.w === 15 && pc.btnIconBox.h === 15, JSON.stringify(pc.btnIconBox));
  check('PC 标题 h3 垂直居中（中线偏差 < 2px）', pc.h3MidOff < 2, 'off=' + pc.h3MidOff);
  check('PC 关闭按钮垂直居中（中线偏差 < 2px）', pc.btnMidOff < 2, 'off=' + pc.btnMidOff);
  check('PC h3 / 按钮均未溢出标题栏', pc.h3Inside && pc.btnInside, JSON.stringify({ h3: pc.h3Inside, btn: pc.btnInside }));

  /* ---------- [3] 移动端（390×844 + 触屏） ---------- */
  console.log('[3] 移动端（390×844 / hasTouch）：再收一档且不溢出视口');
  const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const pageM = await ctxM.newPage();
  const errsM = [];
  pageM.on('pageerror', function (e) { errsM.push(String(e)); });
  pageM.on('console', function (m) {
    /* 同上：故意 abort /api/** → ERR_FAILED 是我们自己造的，不计入 */
    if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) errsM.push(m.text());
  });
  await pageM.route('**/api/**', function (r) { r.abort('failed'); });
  await pageM.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
  await openSettings(pageM);
  const mob = await headMetrics(pageM);
  await pageM.mouse.move(4, 700); /* 同上：移开指针再去截图 */
  await pageM.locator('#settingsMask .modal-head').screenshot({ path: path.join(SHOTS, 'settings-head-mobile.png') });
  await pageM.locator('#settingsMask .modal').screenshot({ path: path.join(SHOTS, 'settings-modal-mobile.png') });
  check('移动端标题栏高度 ≤ ' + MOB_MAX + 'px', mob.headH <= MOB_MAX, JSON.stringify(mob));
  check('移动端标题栏高度 ≥ ' + MOB_MIN + 'px', mob.headH >= MOB_MIN, 'h=' + mob.headH);
  check('移动端比 PC 更矮（媒体查询真的生效，不是写了没上）', mob.headH < pc.headH,
    JSON.stringify({ mobile: mob.headH, pc: pc.headH }));
  check('移动端 padding 用的 4px 档（computed）', mob.headPadTop === '4px', mob.headPadTop);
  check('移动端关闭按钮仍 ≥ 26px 可点', mob.btnH >= 26 && mob.btnW >= 26, JSON.stringify({ w: mob.btnW, h: mob.btnH }));
  check('移动端 h3 / 按钮均未溢出标题栏', mob.h3Inside && mob.btnInside, JSON.stringify({ h3: mob.h3Inside, btn: mob.btnInside }));

  /* 标题栏省下的高度真的给了内容区：head + body ≤ 视口 */
  const fit = await pageM.evaluate(function () {
    var m = document.querySelector('#settingsMask .modal');
    var b = document.querySelector('#settingsMask .modal-body');
    var mr = m.getBoundingClientRect();
    return { modalH: Math.round(mr.height), bodyH: Math.round(b.getBoundingClientRect().height), vh: window.innerHeight, modalInside: mr.bottom <= window.innerHeight + 0.5 };
  });
  check('移动端弹窗整高不超视口（head+body+foot ≤ vh）', fit.modalInside, JSON.stringify(fit));
  check('移动端内容区高度占比 ≥ 75%（标题栏压缩的收益落到这里）', fit.bodyH / fit.modalH >= 0.75,
    JSON.stringify(fit));

  check('PC 零 pageerror / console.error', errs.length === 0, errs.slice(0, 3).join(' | '));
  check('移动端零 pageerror / console.error', errsM.length === 0, errsM.slice(0, 3).join(' | '));

  await ctx.close();
  await ctxM.close();
  await browser.close();
  stopServer();

  console.log('\n' + (failed === 0 ? '全部通过' : '有失败') + '：通过 ' + passed + ' / ' + failed + ' 失败');
  console.log('截图：output/e2e/shots/settings-head-pc.png (' + pc.headH + 'px) / settings-head-mobile.png (' + mob.headH + 'px)');
  process.exit(failed === 0 ? 0 : 1);
})().catch(function (e) {
  console.error(e);
  stopServer();
  process.exit(1);
});
