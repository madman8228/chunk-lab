/**
 * settings-hint-verify.js · 设置面板「灰色说明小字」搬到标题触发（2026-09-11）
 *
 * 老板截图要求：设置面板里那些灰色解释说明（"答题反馈 / 随机打乱顺序 / …"）
 *   · 移动设备 → 放到「点击标题」中显示
 *   · PC 设备  → 放到 hover 中说明
 * 即：说明文字不再行内常显（截图里窄屏下被撑成两行）。
 *
 * 实现要点（被本套件钉住的设计决策）：
 *   - 说明文本从行内 <span> 迁到**行级 data-hint**，唯一出口是 portal 浮层 #setHintPop
 *   - 触发方式按**输入能力**（matchMedia hover:hover and pointer:fine）分流，不按屏幕宽度：
 *       有 hover → mouseenter 显示 / mouseleave 隐藏，**点击语义不变（仍是切换开关）**
 *       无 hover → 点标题显示；preventDefault 拦掉 label 的 toggle 默认行为
 *   - ⚠️ preventDefault 是必需的：标题在 <label> 内，不拦会「一按既弹说明又切开关」
 *
 * 断言：
 *   A. 结构：9 行都有 data-hint / 行内不再有说明小字 / 源码守卫（防常显说明回流）
 *   B. PC 分支（默认 context，hover:hover）：hover 弹出 + 位置在标题下方且不溢出 +
 *      移开即收 + **点标题仍正常切换开关**（不夺走肌肉记忆）
 *   C. 触屏分支（hasTouch context，hover:none）：点标题弹出 + 文本正确 +
 *      **开关未被切换**（preventDefault）+ 再点标题收起 + 点别处收起 + 浮层不溢出视口
 *   D. 设置弹窗关闭 → 浮层必须收起（它挂在 body，不随弹窗一起隐藏）
 *   E. 全程零 pageerror / console.error
 *
 * 运行：node output/e2e/settings-hint-verify.js
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
const PORT = require('../../e2e/lib/free-port').freePort(8960, 40);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-sethint-'));
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

/* 9 行的说明文本（与 data-hint 一一对应） */
const HINTS = {
  setSound: '答题反馈',
  setShuffle: '随机打乱顺序',
  setMode: '选择 chunk 或手动拼写',
  setSkipMastered: '连对≥3次的句子不再重复出题',
  setBatchSize: '一轮练习句子数（不足时从已掌握补齐）',
  setFxStack: '连对多题时烟花慢速累积绽放',
  setCelebrate: '答对时的屏幕特效',
  setAutoSpeak: '完成后自动朗读',
  setDarkMode: '切换界面主题'
};

/* 每行标题（标题触发器 .set-hit 里应当只剩它） */
const TITLES = {
  setSound: '音效',
  setShuffle: '乱序出题',
  setMode: '答题模式',
  setSkipMastered: '跳过已掌握',
  setBatchSize: '每批数量',
  setFxStack: '烟花叠加',
  setCelebrate: '庆祝效果',
  setAutoSpeak: '自动朗读',
  setDarkMode: '深色模式'
};

function hintState(pg, ctlId) {
  return pg.evaluate(function (id) {
    var p = document.getElementById('setHintPop');
    if (!p) return { exists: false };
    var r = p.getBoundingClientRect();
    /* 触发器位置：用于断言浮层是否落在标题下方 / 右侧对齐 */
    var hit = id ? document.querySelector('label:has(#' + id + ') .set-hit') : null;
    var hr = hit ? hit.getBoundingClientRect() : null;
    return {
      exists: true,
      open: p.classList.contains('open'),
      text: p.textContent,
      opacity: getComputedStyle(p).opacity,
      parent: p.parentElement ? p.parentElement.tagName : null,
      rect: { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) },
      hitRect: hr ? { top: Math.round(hr.top), left: Math.round(hr.left), right: Math.round(hr.right), bottom: Math.round(hr.bottom) } : null,
      vw: window.innerWidth, vh: window.innerHeight
    };
  }, ctlId || null);
}
/* 标题触发器定位器（Playwright :has 精确到行，避免中文属性选择器的转义坑） */
function hitOf(pg, ctlId) { return pg.locator('label:has(#' + ctlId + ') .set-hit'); }

async function openSettings(pg) {
  await pg.waitForSelector('#btnSettingsTop', { timeout: 10000 });
  await pg.locator('#btnSettingsTop').click();
  await pg.waitForSelector('#setDarkMode', { state: 'visible', timeout: 5000 });
}

(async function main() {
  const BASE = 'http://127.0.0.1:' + PORT;
  await startServer();
  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM });

  /* ---------- PC：默认 context（hover:hover / pointer:fine） ---------- */
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

  console.log('[1] 结构：说明小字已从行内迁到 data-hint');
  await page.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
  await openSettings(page);
  const struct = await page.evaluate(function (hints) {
    var out = { hint: {}, hitText: {}, hintStaysInline: {} };
    Object.keys(hints).forEach(function (id) {
      var ctl = document.getElementById(id);
      var row = ctl && ctl.closest('label[data-hint]');
      out.hint[id] = row ? row.getAttribute('data-hint') : null;
      var hit = row && row.querySelector('.set-hit');
      out.hitText[id] = hit ? hit.textContent.trim() : null;
      /* 说明文本是否还留在行内（应当只剩标题 + 控件；select 的 option 文本不算） */
      out.hintStaysInline[id] = row ? row.textContent.indexOf(hints[id]) >= 0 : null;
    });
    return out;
  }, HINTS);
  let hintOk = 0, titleOk = 0, leakOk = 0;
  Object.keys(HINTS).forEach(function (id) {
    if (struct.hint[id] === HINTS[id]) hintOk++;
    if (struct.hitText[id] === TITLES[id]) titleOk++;
    if (struct.hintStaysInline[id] === false) leakOk++;
  });
  check('9 行都有 data-hint 且文本与预期一致', hintOk === 9, JSON.stringify({ ok: hintOk, hint: struct.hint }));
  check('9 行标题触发器文本 = 纯标题', titleOk === 9, JSON.stringify(struct.hitText));
  check('9 行行内不再出现说明文本（不撑行）', leakOk === 9, JSON.stringify(struct.hintStaysInline));

  const src = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
  check('源码守卫：行内常显说明样式已移除（font-size:12px;color:var(--faint);margin-left:6px）',
    src.indexOf('font-size:12px;color:var(--faint);margin-left:6px') < 0);
  check('源码守卫：已删死规则 #settingsMask … > label > span > span', src.indexOf('> label > span > span') < 0);
  check('源码守卫：浮层样式 .set-hint-pop 存在', src.indexOf('.set-hint-pop{') >= 0);

  console.log('[2] PC 分支：hover 标题 → 说明浮层');
  const hover0 = await hintState(page);
  check('PC context 被识别为「有 hover」(__setHintHover = true)',
    (await page.evaluate(function () { return window.__setHintHover; })) === true);
  check('浮层初始未展开（opacity 0，无 .open）', hover0.exists && !hover0.open && hover0.opacity === '0', JSON.stringify(hover0));
  check('浮层挂在 body 下（portal，不被弹窗 overflow 裁剪）', hover0.parent === 'BODY', hover0.parent);

  await hitOf(page, 'setSkipMastered').hover();
  await page.waitForTimeout(150);
  const s1 = await hintState(page, 'setSkipMastered');
  check('hover 标题 → 浮层展开', s1.open, JSON.stringify(s1));
  check('浮层文本 = 该行 data-hint', s1.text === HINTS.setSkipMastered, s1.text);
  check('浮层落在标题正下方（top ≥ 标题底边，且水平与标题左对齐）',
    !!s1.hitRect && s1.rect.top >= s1.hitRect.bottom - 2 && Math.abs(s1.rect.left - s1.hitRect.left) <= 2,
    JSON.stringify({ pop: s1.rect, hit: s1.hitRect }));
  check('浮层不溢出视口（left ≥ 8 且 right ≤ 视口宽 - 8）',
    s1.rect.left >= 8 && s1.rect.right <= s1.vw - 8, JSON.stringify(s1.rect));
  await page.screenshot({ path: path.join(SHOTS, 'settings-hint-pc.png') });

  await page.mouse.move(4, 4);
  await page.waitForTimeout(150);
  const s2 = await hintState(page);
  check('鼠标移开 → 浮层收起', !s2.open, JSON.stringify(s2));

  /* PC 上点标题：说明靠 hover 看，点击语义必须仍是「切换开关」 */
  const beforeChk = await page.evaluate(function () { return document.getElementById('setSkipMastered').checked; });
  await hitOf(page, 'setSkipMastered').click();
  await page.waitForTimeout(120);
  const afterChk = await page.evaluate(function () { return document.getElementById('setSkipMastered').checked; });
  check('PC：点标题仍是切换开关（未被说明夺走）', beforeChk !== afterChk, JSON.stringify({ before: beforeChk, after: afterChk }));
  await page.mouse.move(4, 4);
  await page.waitForTimeout(150);
  check('PC：鼠标移开后浮层不残留（点击没有锁住浮层）', !(await hintState(page)).open);

  console.log('[3] 设置弹窗关闭 → 浮层必须收起');
  await hitOf(page, 'setDarkMode').hover();
  await page.waitForTimeout(150);
  check('关闭前浮层是展开的（前置条件）', (await hintState(page)).open);
  await page.evaluate(function () { closeMasks(); });
  await page.waitForTimeout(120);
  check('closeMasks() 后浮层收起（挂 body 上不随弹窗隐藏）', !(await hintState(page)).open);
  await ctx.close();

  /* ---------- 触屏：hasTouch context（hover:none / pointer:coarse） ---------- */
  const ctxT = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
  const pageT = await ctxT.newPage();
  pageT.on('pageerror', function (e) { errs.push('[touch] ' + String(e)); });
  await pageT.route('**/api/**', function (r) { r.abort('failed'); });

  console.log('[4] 触屏分支：点击标题 → 说明浮层（且不误触开关）');
  await pageT.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
  await pageT.waitForSelector('#btnSettingsTop', { timeout: 10000 });
  await pageT.locator('#btnSettingsTop').click();
  await pageT.waitForSelector('#setDarkMode', { state: 'visible', timeout: 5000 });
  check('触屏 context 被识别为「无 hover」(__setHintHover = false)',
    (await pageT.evaluate(function () { return window.__setHintHover; })) === false);

  const beforeT = await pageT.evaluate(function () { return document.getElementById('setSkipMastered').checked; });
  await hitOf(pageT, 'setSkipMastered').tap();
  await pageT.waitForTimeout(200);
  const t1 = await hintState(pageT);
  const afterT = await pageT.evaluate(function () { return document.getElementById('setSkipMastered').checked; });
  check('触屏：点标题 → 浮层展开', t1.open, JSON.stringify(t1));
  check('触屏：浮层文本 = 该行 data-hint', t1.text === HINTS.setSkipMastered, t1.text);
  check('触屏：preventDefault 生效 → 开关未被切换', beforeT === afterT, JSON.stringify({ before: beforeT, after: afterT }));
  check('触屏 390px：浮层不溢出视口（left ≥ 8 且 right ≤ vw - 8）',
    t1.rect.left >= 8 && t1.rect.right <= t1.vw - 8, JSON.stringify({ rect: t1.rect, vw: t1.vw }));
  await pageT.screenshot({ path: path.join(SHOTS, 'settings-hint-mobile.png') });

  await hitOf(pageT, 'setSkipMastered').tap();
  await pageT.waitForTimeout(200);
  check('触屏：再点同标题 → 收起（toggle）', !(await hintState(pageT)).open);

  await hitOf(pageT, 'setAutoSpeak').tap();
  await pageT.waitForTimeout(200);
  check('触屏：点另一行标题 → 换到该行说明', (await hintState(pageT)).text === HINTS.setAutoSpeak);
  await pageT.locator('#settingsMask .modal-head h3').tap();
  await pageT.waitForTimeout(200);
  check('触屏：点别处 → 收起', !(await hintState(pageT)).open);

  console.log('[5] 全程零 pageerror / console.error');
  check('零错误', errs.length === 0, errs.join('\n  '));

  console.log('\n结果：' + passed + ' 通过 / ' + failed + ' 失败');
  await browser.close();
  stopServer();
  process.exit(failed ? 1 : 0);
})().catch(function (e) { console.error(e); stopServer(); process.exit(2); });
