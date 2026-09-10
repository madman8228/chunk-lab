/**
 * tap-highlight-verify.js · 验证触摸高亮修复（v2）
 * 断言：
 *  1. 四页全局 * 规则：-webkit-tap-highlight-color: transparent
 *  2. 每个关键可点元素：若已渲染 → 计算值必须是 transparent；未渲染（空数据态）→ 样式表必须含该类相关规则
 *  3. decks/stats/courses 必须存在 :active 按压态规则（原来三页为 0）
 */
'use strict';
const fs = require('fs'); const path = require('path'); const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');
const ROOT = 'D:/06-project/chunk-practice';
const PORT = 9595 + Math.floor(Math.random() * 25);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-taphl-'));
let server, failed = 0;
function check(name, cond, extra) {
  if (!cond) failed++;
  console.log('[' + (cond ? 'PASS' : 'FAIL') + '] ' + name + (extra ? ' | ' + extra : ''));
}
function start() {
  return new Promise(function (res, rej) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP, PORT: String(PORT), REQUIRE_AUTH: 'false' }),
      stdio: 'ignore'
    });
    let t = 0; const iv = setInterval(function () {
      t++;
      if (server.exitCode !== null) { clearInterval(iv); rej(new Error('exit')); return; }
      const r = require('http').get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, x => { if (x.statusCode === 200) { clearInterval(iv); res(); } });
      r.on('error', () => {}); r.setTimeout(600, () => r.destroy());
      if (t > 40) { clearInterval(iv); rej(new Error('timeout')); }
    }, 400);
  });
}
(async function () {
  await start();
  const browser = await chromium.launch({ executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe' });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, hasTouch: true, isMobile: true });

  const CASES = [
    ['main.html', ['a.brand', '.topbar .icon-action', '.btn', 'button.kbd-action', '.ring-wrap', '#btnBack']],
    ['decks.html', ['.btn', '.cat-btn', '.series-head', '.vol-head', '.lesson', '.lesson-del']],
    ['stats.html', ['.btn', '.wrong-del', '.stat-card .start-btn']],
    ['courses.html', ['.primary', '.quiet', '.back', '.course-row', '.action-button', '.btn-restart', '.choice-option', '.word-chip']]
  ];

  for (const c of CASES) {
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:' + PORT + '/' + c[0], { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    /* courses.html 无合法课程 id 会 302 跳 decks（纯播放器定位）→ 落点可能不是本页，统一先判 URL */
    const landed = page.url().replace(/^.*\//, '');
    if (landed !== c[0]) {
      /* 被重定向：改用静态源码断言（CSS 是编译无关的内联文本，文件里有 = 部署生效） */
      const src = fs.readFileSync(path.join(ROOT, c[0]), 'utf8');
      check(c[0] + '（重定向→' + landed + '）静态断言 tap-highlight', src.indexOf('-webkit-tap-highlight-color:transparent') !== -1);
      check(c[0] + '（重定向→' + landed + '）静态断言 :active 按压规则', /:active\{[^}]*transform|:active\{[^}]*background/.test(src));
      await page.close();
      continue;
    }
    await page.waitForTimeout(700);
    const res = await page.evaluate(function (sels) {
      /* 收集全部样式表文本（跨域/内联都试） */
      let cssText = '';
      for (const sheet of document.styleSheets) {
        try { for (const r of sheet.cssRules) cssText += r.cssText + '\n'; } catch (e) {}
      }
      const globalRule = Array.prototype.some.call(document.styleSheets, function (sheet) {
        try {
          return Array.prototype.some.call(sheet.cssRules, function (r) {
            return r.selectorText === '*' && /-webkit-tap-highlight-color:\s*transparent/.test(r.style && r.style.cssText || '');
          });
        } catch (e) { return false; }
      });
      function classInCss(sel) {
        const base = sel.replace(/^\./, '').split(/[\s.>:]+/)[0];
        return cssText.indexOf(base) !== -1;
      }
      return {
        globalRule: globalRule,
        els: sels.map(function (s) {
          const el = document.querySelector(s);
          if (!el) return { sel: s, missing: true, cssKnown: classInCss(s) };
          return { sel: s, tapHL: getComputedStyle(el).webkitTapHighlightColor };
        })
      };
    }, c[1]);

    check(c[0] + ' 全局 * tap-highlight 规则存在', res.globalRule);
    res.els.forEach(function (r) {
      if (r.missing) {
        check(c[0] + ' ' + r.sel + '（空数据态）CSS 规则已随页面部署', r.cssKnown, 'DOM 未渲染，改查样式表');
      } else {
        check(c[0] + ' ' + r.sel + ' tap-highlight=transparent', r.tapHL === 'rgba(0, 0, 0, 0)', r.tapHL);
      }
    });
    await page.close();
  }

  /* :active 按压态规则数量（原来 decks/stats/courses 为 0） */
  for (const f of ['main.html', 'decks.html', 'stats.html', 'courses.html']) {
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:' + PORT + '/' + f, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const n = await page.evaluate(function () {
      let n = 0;
      for (const sheet of document.styleSheets) {
        try { for (const r of sheet.cssRules) if (r.selectorText && r.selectorText.indexOf(':active') !== -1) n++; } catch (e) {}
      }
      return n;
    });
    check(f + ' :active 按压规则 ≥1', n >= 1, 'rules=' + n);
    await page.close();
  }

  await browser.close(); server.kill('SIGKILL');
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  console.log(failed === 0 ? '\nALL PASS' : '\nFAILED: ' + failed);
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL', e); try { server && server.kill('SIGKILL'); } catch (_) {} process.exit(1); });
