/**
 * settings-rows-verify.js · 设置面板「动作行」样式对齐验证
 *
 * 背景（2026-09-15 老板要求）：「意群是什么」「反馈问题」原先用居中的整行 .btn.ghost，
 * 与面板其他设置项的「左标签 + 右控件」风格割裂 → 改为同构的 .set-row（左标签 + 右 chevron）。
 *
 * 契约：
 *   C1 仍是 <button> 且 id 不变（e2e/chunk-intro.test.js、e2e/e2e.js 直接 click 二者）
 *   C2 左标签右箭头（display:flex + justify-content:space-between）
 *   C3 行尾是 chevron SVG（不是文本框/开关）
 *   C4 padding / 字号 / 静止态背景 与 label 行一致
 *   C5 宽度与 label 行一致（撑满，窄屏不折行）
 *   C6 负向自证 ×2：注入居中 / 收窄宽度 → 判定必须变红
 *
 * 自带 server，不依赖外部固定端口（项目约定）。
 * 运行：node output/e2e/settings-rows-verify.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'settings-rows');
fs.mkdirSync(OUT, { recursive: true });
const PORT = require(path.join(ROOT, 'e2e', 'lib', 'free-port')).freePort(8960, 40);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-setrows-'));
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
      const http = require('http');
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

function pass(n) { console.log('  ✓', n); }
function fail(n, info) { console.log('  ✗', n, info ? '| ' + JSON.stringify(info) : ''); process.exitCode = 1; }
function check(n, c, info) { c ? pass(n) : fail(n, info); }

/* 页面内探针：一次性取回动作行 + 参照 label 行的所有度量 */
function probe() {
  const mask = document.getElementById('settingsMask');
  const cs = (el, p) => (el ? getComputedStyle(el)[p] : null);
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const rows = Array.prototype.slice.call(mask.querySelectorAll('.set-row'));
  /* 参照行 = 「深色模式」那一行（紧邻动作行上方，正是老板截图里的对照物）。
     ⚠️ 不要用「最后一个 label」——账号区段的 label 宽度为 0，会把参照打成 0。 */
  const darkCb = document.getElementById('setDarkMode');
  const ref = darkCb ? darkCb.closest('label') : null;
  const refStrong = ref ? ref.querySelector('strong') : null;
  /* 找到 .set-row 所在区段的边框容器，确认 border-top 分隔仍在 */
  const sec = rows.length ? rows[0].parentElement : null;
  return {
    count: rows.length,
    rows: rows.map(function (el) {
      const strong = el.querySelector('strong');
      const chev = el.querySelector('.chev .icon');
      return {
        id: el.id,
        tag: el.tagName,
        text: strong ? strong.textContent.trim() : '',
        display: cs(el, 'display'),
        justify: cs(el, 'justifyContent'),
        alignItems: cs(el, 'alignItems'),
        pad: cs(el, 'padding'),
        bg: cs(el, 'backgroundColor'),
        cursor: cs(el, 'cursor'),
        width: box(el).w,
        height: box(el).h,
        textSize: strong ? cs(strong, 'fontSize') : null,
        textLeft: strong ? Math.round(strong.getBoundingClientRect().left) : null,
        textRight: strong ? Math.round(strong.getBoundingClientRect().right) : null,
        chevPresent: !!chev,
        chevW: chev ? cs(chev, 'width') : null,
        chevRight: chev ? Math.round(chev.getBoundingClientRect().right) : null
      };
    }),
    ref: ref ? {
      pad: cs(ref, 'padding'),
      width: box(ref).w,
      height: box(ref).h,
      lineHeight: cs(ref, 'lineHeight'),
      textSize: refStrong ? cs(refStrong, 'fontSize') : null,
      textLeft: refStrong ? Math.round(refStrong.getBoundingClientRect().left) : null,
      text: ref.textContent.trim().slice(0, 12)
    } : null,
    secBorderTop: sec ? cs(sec, 'borderTopWidth') : null
  };
}

(async function () {
  console.log('server: http://127.0.0.1:' + PORT);
  await startServer();
  const BASE = 'http://127.0.0.1:' + PORT;
  const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });

  const views = [['760', { width: 760, height: 780 }], ['390', { width: 390, height: 780 }]];

  for (const item of views) {
    const tag = item[0], viewport = item[1];
    console.log('\n=== ' + tag + 'px ===');
    const ctx = await browser.newContext({ viewport: viewport, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#pageHome', { timeout: 15000 });
    await p.evaluate(function () { document.getElementById('settingsMask').hidden = false; });
    await p.waitForTimeout(400);
    /* 把动作行滚进视野（设置面板自身是滚动容器） */
    await p.evaluate(function () { document.getElementById('btnFeedback').scrollIntoView({ block: 'end' }); });
    await p.waitForTimeout(250);

    const d = await p.evaluate(probe);
    console.log('  动作行: ' + d.rows.map(function (r) {
      return '[' + r.text + '] display=' + r.display + ' justify=' + r.justify + ' pad=' + r.pad
        + ' bg=' + r.bg + ' w=' + r.width + ' h=' + r.height + ' 字号=' + r.textSize
        + ' chevron=' + r.chevPresent + '(' + r.chevW + ')';
    }).join('\n          '));
    console.log('  参照行[' + (d.ref ? d.ref.text : '?') + ']: pad=' + (d.ref && d.ref.pad) + ' w=' + (d.ref && d.ref.width)
      + ' h=' + (d.ref && d.ref.height) + ' line-height=' + (d.ref && d.ref.lineHeight)
      + ' 字号=' + (d.ref && d.ref.textSize) + ' 文字左缘=' + (d.ref && d.ref.textLeft));

    /* ===== C1 仍是 button 且 id 不变（e2e 直接 click 这两个 id） ===== */
    const ids = d.rows.map(function (r) { return r.id; }).sort().join(',');
    check('C1 动作行为 2 个 <button> 且 id 不变',
      d.count === 2 && d.rows.every(function (r) { return r.tag === 'BUTTON'; }) && ids === 'btnChunkIntro,btnFeedback',
      { count: d.count, ids: ids, tags: d.rows.map(function (r) { return r.tag; }) });

    /* ===== C2 左标签右箭头 ===== */
    check('C2 display=flex + justify-content=space-between（左标签右箭头）',
      d.rows.every(function (r) { return r.display === 'flex' && r.justify === 'space-between'; }),
      d.rows.map(function (r) { return r.display + '/' + r.justify; }));

    /* ===== C3 行尾是 chevron SVG ===== */
    check('C3 行尾有 chevron SVG（13px）',
      d.rows.every(function (r) { return r.chevPresent && r.chevW === '13px'; }),
      d.rows.map(function (r) { return r.chevPresent + '/' + r.chevW; }));

    /* ===== C4 padding / 字号 / 静止态背景 与 label 行一致 ===== */
    const samePad = d.ref && d.rows.every(function (r) { return r.pad === d.ref.pad; });
    const sameSize = d.ref && d.rows.every(function (r) { return r.textSize === d.ref.textSize; });
    const sameBg = d.rows.every(function (r) { return r.bg === 'rgba(0, 0, 0, 0)'; });
    check('C4 padding 与设置项一致（' + (d.ref && d.ref.pad) + '）', samePad, d.rows.map(function (r) { return r.pad; }));
    check('C4 字号与设置项一致（' + (d.ref && d.ref.textSize) + '）', sameSize, d.rows.map(function (r) { return r.textSize; }));
    check('C4 静止态背景透明（与设置项一致，不再是独立按钮块）', sameBg, d.rows.map(function (r) { return r.bg; }));
    const sameH = d.ref && d.rows.every(function (r) { return Math.abs(r.height - d.ref.height) <= 2; });
    check('C4 行高与设置项一致（同一行距）', sameH, { rows: d.rows.map(function (r) { return r.height; }), ref: d.ref && d.ref.height });

    /* ===== C5 宽度与 label 行一致 + 文字左缘对齐 + 不折行 ===== */
    const sameW = d.ref && d.rows.every(function (r) { return Math.abs(r.width - d.ref.width) <= 2; });
    const sameLeft = d.ref && d.rows.every(function (r) { return Math.abs(r.textLeft - d.ref.textLeft) <= 2; });
    const oneLine = d.rows.every(function (r) { return r.height <= 44; });
    check('C5 宽度与 label 行一致（撑满）', sameW, { rows: d.rows.map(function (r) { return r.width; }), ref: d.ref && d.ref.width });
    check('C5 标签文字左缘与设置项对齐', sameLeft, { rows: d.rows.map(function (r) { return r.textLeft; }), ref: d.ref && d.ref.textLeft });
    check('C5 保持单行（未折行）', oneLine, d.rows.map(function (r) { return r.height; }));

    /* ===== C5b 区段分隔线仍在 ===== */
    check('C5b 动作行区段保留 border-top 分隔', d.secBorderTop && d.secBorderTop !== '0px', d.secBorderTop);

    /* ===== C6 负向自证 1：注入居中 → C2 判定必须变红 ===== */
    const negCenter = await p.evaluate(function () {
      const el = document.querySelector('.set-row');
      const before = getComputedStyle(el).justifyContent;
      el.style.justifyContent = 'center';
      const after = getComputedStyle(el).justifyContent;
      const red = !(after === 'space-between');
      el.style.justifyContent = '';
      return { before: before, after: after, red: red };
    });
    check('C6- 负向自证：注入居中后「左标签右箭头」判定必须变红', negCenter.red, negCenter);

    /* ===== C6 负向自证 2：收窄宽度 → C5 判定必须变红 ===== */
    const negWidth = await p.evaluate(function () {
      const el = document.querySelector('.set-row');
      const ref = document.getElementById('setDarkMode').closest('label');
      const wRef = ref.getBoundingClientRect().width;
      el.style.width = '120px';
      const w = el.getBoundingClientRect().width;
      const red = Math.abs(w - wRef) > 2;
      el.style.width = '';
      return { wRef: Math.round(wRef), w: Math.round(w), red: red };
    });
    check('C6- 负向自证：收窄到 120px 后「与设置项同宽」判定必须变红', negWidth.red, negWidth);

    /* ===== 截图：静止态 + hover 态 ===== */
    await p.screenshot({ path: path.join(OUT, tag + '-rows.png') });
    await p.hover('#btnChunkIntro');
    await p.waitForTimeout(260);
    await p.screenshot({ path: path.join(OUT, tag + '-rows-hover.png') });

    await ctx.close();
  }

  await browser.close();
  stopServer();
  console.log('\n截图 -> ' + OUT);
  console.log('=== Done. exit=', process.exitCode || 0, '===');
})().catch(function (e) { console.error(e); stopServer(); process.exit(2); });
