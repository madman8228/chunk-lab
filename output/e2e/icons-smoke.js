/**
 * icons-smoke.js · 字符 icon → SVG 替换后跨页面渲染冒烟（2026-09-08）
 *
 * 验证点（每个页面）：
 *   1. 零 pageerror / 零 console.error（替换没引入 JS 语法/运行时错误）
 *   2. 页面至少渲染 1 个内联 svg.icon
 *   3. 初始 DOM 的 [data-icon] 全部被 Icons.install() 消费（残留 = defs 缺该名，静默跳过）
 *   4. 替换后的旧字符 icon 不出现在可见按钮文本里（抽查常用交互 glyph）
 *
 * 依赖同 e2e.js：playwright-core + chromium headless shell + 临时 server。
 * 运行：node output/e2e/icons-smoke.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const PORT = 9020 + Math.floor(Math.random() * 80);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-icons-'));
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

/* 曾作为交互 icon 出现、现在应只剩 svg 的字符（仅查按钮/链接等可点元素文本，正文文案里的 → 等不在此列） */
const GLYPH_BANNED = ['\u21BA', '\u21BB', '\u21BA', '\u25C0', '\u25B6', '\u25B8', '\u21A9', '\u23CE', '←', '↻', '↺', '↩'];

(async function () {
  await startServer();
  const base = 'http://127.0.0.1:' + PORT + '/';
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ||
      'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
  });
  try {
    const pages = ['main.html', 'decks.html', 'stats.html', 'courses.html'];
    for (const p of pages) {
      console.log('== ' + p + ' ==');
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push('pageerror: ' + e.message));
      page.on('console', m => { if (m.type() === 'error' && m.text().indexOf('Failed to load resource') < 0) errs.push('console.error: ' + m.text()); });
      await page.goto(base + p, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);

      check('零 pageerror/console.error', errs.length === 0, errs.join(' | '));
      const svgN = await page.locator('svg.icon').count();
      check('渲染内联 svg.icon ≥ 1 (实际 ' + svgN + ')', svgN >= 1);
      const leftDataIcon = await page.locator('[data-icon]').count();
      check('data-icon 全部被 install 消费 (残留 ' + leftDataIcon + ')', leftDataIcon === 0);

      // 可点元素文本不含旧 glyph
      const leaked = await page.evaluate(function (banned) {
        const out = [];
        const els = document.querySelectorAll('button, a, [role="button"], summary');
        els.forEach(function (el) {
          const t = el.textContent || '';
          banned.forEach(function (g) { if (t.indexOf(g) >= 0) out.push(el.tagName + '#' + (el.id || el.className) + ' 含 ' + JSON.stringify(g)); });
        });
        return out;
      }, GLYPH_BANNED);
      check('可点元素无旧字符 icon 泄漏', leaked.length === 0, leaked.slice(0, 6).join(' | '));

      await page.screenshot({ path: path.join(SHOTS, 'icons-' + p.replace('.html', '') + '.png') });
      await ctx.close();
    }

    /* main.html 深链：种子 mini deck 真实作答 →
       ① 白盒：错 1 次自纠走 finishSentence → revealTagWrap 必须保持 hidden
          （2026-09-10 老板打回「✓ 已答完」绿 tag：沉默即反馈，不叠 outcome tag；
            此断言即该决策的回归护栏，防止有人再加回来）
       ② 两题真实答完结算卡可见（零 pageerror） */
    console.log('== main.html 真实作答 icon 深链 ==');
    {
      const c5 = await browser.newContext({
        viewport: { width: 1280, height: 860 }
      });
      await c5.addInitScript(function () {
        localStorage.clear();
        localStorage.setItem('chunklab.v1', JSON.stringify({
          version: 2, reinforceBook: [],
          decks: [{ id: 'e2e-mini', name: 'E2E 迷你题库', items: [
            { sentence: 'I would like to check in please.', translation: '我想办理入住。',
              chunks: ['I would like to', 'check in', 'please.'], hints: ['', '', ''],
              cid: 'e2e-mini-a', grammar: null },
            { sentence: 'Could you help me carry this.', translation: '能帮我搬一下这个吗。',
              chunks: ['Could you', 'help me', 'carry this.'], hints: ['', '', ''],
              cid: 'e2e-mini-b', grammar: null }
          ] }],
          best: {}, mastered: {}, deletedItems: {},
          stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} },
          settings: { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 10, fxStack: true, celebrate: 'off', autoSpeak: false, sound: true }
        }));
        sessionStorage.setItem('_startDeck', JSON.stringify({ id: 'e2e-mini', name: 'E2E 迷你题库', items: [
          { sentence: 'I would like to check in please.', translation: '我想办理入住。', chunks: ['I would like to', 'check in', 'please.'], hints: ['', '', ''] },
          { sentence: 'Could you help me carry this.', translation: '能帮我搬一下这个吗。', chunks: ['Could you', 'help me', 'carry this.'], hints: ['', '', ''] }
        ] }));
      });
      const page = await c5.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push('pageerror: ' + e.message));
      page.on('console', m => { if (m.type() === 'error' && m.text().indexOf('Failed to load resource') < 0) errs.push('console.error: ' + m.text()); });
      await page.goto(base + 'main.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#stageChoices .choice, #result', { timeout: 12000 }).catch(function () {});
      await page.waitForTimeout(1200);

      /* 白盒：错 1 次自纠路径 → 触发 finishSentence → revealTagWrap 必须保持 hidden
         （「已答完」绿 tag 已按老板要求移除：错 1 次自纠是中性结果，沉默即反馈。
          这里反过来断言它不出现，作为防回滚护栏。） */
      const doneProbe = await page.evaluate(function () {
        // 先点一个错误干扰项
        var d0 = document.querySelector('#stageChoices .choice.distractor');
        if (d0) d0.click();
        // 立即把剩余 chunks 标记 ok（模拟自纠完成）
        var it = cur();
        S.status = it.chunks.map(function () { return 'ok'; });
        /* 真实错 1 自纠：仅 1 个 chunk 错 1 次 → totalWrong=1 < 2 且未提示 → 中性分支 */
        S.wrongAttempts = it.chunks.map(function (_, k) { return k === 0 ? 1 : 0; });
        S.perfectThis = false;
        S.hinted = false;
        // 直接调 finishSentence 走「错 1 自纠」分支
        finishSentence();
        stopAutoNext();
        var tag = document.getElementById('revealTagWrap');
        return {
          hidden: !!(tag && tag.classList.contains('hidden')),
          good: !!(tag && tag.classList.contains('good')),
          miss: !!(tag && tag.classList.contains('miss')),
          text: tag ? tag.textContent.trim() : '',
          visibleText: tag && !tag.classList.contains('hidden') ? tag.textContent.trim() : ''
        };
      });
      check('深链: 错 1 自纠→revealTagWrap 保持 hidden（「已答完」tag 已移除，沉默即反馈）',
        doneProbe && doneProbe.hidden === true,
        JSON.stringify(doneProbe));
      check('深链: 错 1 自纠→无「已答完/已掌握/需巩固」outcome tag 残留',
        doneProbe && doneProbe.visibleText === '' && !doneProbe.good && !doneProbe.miss,
        JSON.stringify(doneProbe));
      await page.screenshot({ path: path.join(SHOTS, 'icons-main-silent-tag.png') });
      /* 重置为真实作答（清掉白盒状态），驱动到结算卡 */
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#stageChoices .choice, #result', { timeout: 12000 }).catch(function () {});
      await page.waitForTimeout(1200);
      let settled = false;
      for (let guard = 0; guard < 80; guard++) {
        const st = await page.evaluate(function () {
          if (!window.S) return { booting: true };
          if (S.finished) return { finished: true };
          var it = typeof cur === 'function' ? cur() : null;
          if (!it) return { booting: true };
          var nb = document.getElementById('btnNext');
          var nbVisible = nb && !nb.classList.contains('hidden');
          var target = (S.chunkIdx < it.chunks.length) ? it.chunks[S.chunkIdx] : null;
          return { finished: false, target: target, nbVisible: !!nbVisible, idx: S.idx, total: S.items.length };
        });
        if (st.booting || st.finished) { if (st.finished) { settled = true; break; } await page.waitForTimeout(200); continue; }
        if (st.nbVisible) {
          await page.evaluate(function () { document.getElementById('btnNext').click(); });
          await page.waitForTimeout(250);
          continue;
        }
        if (!st.target) { await page.waitForTimeout(200); continue; }
        const hit = await page.evaluate(function (v) {
          var btns = Array.from(document.querySelectorAll('#stageChoices .choice'));
          var b = btns.filter(function (x) { return !x.disabled && x.dataset.v === v; })[0];
          if (b) { b.click(); return true; }
          return false;
        }, st.target);
        if (!hit) await page.waitForTimeout(200);
      }
      const finish = await page.evaluate(function () {
        var r = document.getElementById('result');
        return {
          resultShown: !!(r && !r.classList.contains('hidden') && r.textContent.trim().length > 0)
        };
      });
      check('深链: 结算卡出现（真实答完两题）', settled && finish.resultShown, JSON.stringify({ settled: settled, fin: finish }));
      check('深链: 零 pageerror', errs.length === 0, errs.join(' | '));
      await page.screenshot({ path: path.join(SHOTS, 'icons-main-finish.png') });
      await c5.close();
    }
  } finally {
    await browser.close();
    stopServer();
  }
  console.log(failed === 0 ? '\n[icons-smoke] 全部通过 (' + passed + ')' : '\n[icons-smoke] 失败 ' + failed + ' / 通过 ' + passed);
  process.exit(failed === 0 ? 0 : 1);
})().catch(function (e) { console.error(e); stopServer(); process.exit(1); });
