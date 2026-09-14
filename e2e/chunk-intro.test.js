/**
 * chunk-intro.test.js · 「意群是什么？」自解释的端到端护栏
 *
 * 背景（产品评审缺口②）：Chunk Lab 从名字到练习流都建立在「意群」上，但全站**没有任何面向
 * 用户的定义** —— 唯一的解释只存在于 README 和喂大模型的 prompt（js/ai-prompts.mjs 的
 * 「自然停顿」规则）里，用户看不到。新用户第一次进来不知道「意群」指什么，也不知道练习
 * 会怎么考他。
 *
 * 本测试锁住四件事：
 *   1. 新用户首页（空档案）有入口，且文案里第一次出现了「意群」的解释
 *   2. 说明弹窗是真的在讲这件事（定义 + 可看见的切分示例 + 切分规则），且只有一份定义
 *   3. 三条关闭路径都有效，且关闭后**仍停在首页**（不被 closeMasks 的 goPractice 副作用踢走）
 *   4. 有学习记录的老用户首页不再出现该入口（空状态专属），但设置面板里永久可达
 *
 * 运行：node e2e/chunk-intro.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(8990, 60);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-chunk-intro-'));
const BASE = 'http://127.0.0.1:' + PORT;

let server = null;
let browser = null;

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
      if (tries > 120) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 200);
  });
}
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) {} server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}
}

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (detail ? '  → ' + detail : '')); }
}

/* 空档案（hasEver=false）→ 首页走 .home-empty 分支；decks 留空，句子由 builtins 提供。 */
function emptyStore() {
  localStorage.clear();
  localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
  localStorage.setItem('chunklab.v1', JSON.stringify({
    version: 2, decks: [], best: {}, mastered: {}, deletedItems: {}, reinforceBook: [], progress: {},
    stats: { totalRounds: 0, totalAnswered: 0, bySentence: {}, events: [], daysLog: {} },
    settings: { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 10,
      sound: false, fxStack: false, celebrate: 'none', autoSpeak: false, darkMode: false }
  }));
}
/* 有学习记录（hasEver=true）→ 首页走今日卡分支，不该再出现空档案入口。 */
function learnedStore() {
  const s = { answered: 3, goal: 0 };
  (function (seed) {
    localStorage.clear();
    localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
    var now = Date.now(), events = [], i;
    for (i = 0; i < seed.answered; i++) events.push({ id: 'e' + i, kind: 'answer', key: 'd1#k' + i, ok: true, at: now - i * 1000 });
    localStorage.setItem('chunklab.v1', JSON.stringify({
      version: 2,
      decks: [{ id: 'd1', name: '测试题库', items: [
        { sentence: 'Hi there.', translation: '你好。', chunks: ['Hi', 'there.'], hints: ['', ''], cid: 'x1' }
      ] }],
      best: { d1: { lastPlayed: now } }, mastered: {}, deletedItems: {}, reinforceBook: [], progress: {},
      stats: { totalRounds: 1, totalAnswered: seed.answered, bySentence: {}, events: events, daysLog: {} },
      settings: { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 10,
        sound: false, fxStack: false, celebrate: 'none', autoSpeak: false, darkMode: false }
    }));
  })(s);
}

async function open(seedFn) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', function (e) { errs.push(e.message); });
  await page.route('**/api/**', function (r) { r.abort('failed'); });
  await page.route('**/content/**', function (r) { r.abort('failed'); });
  await page.addInitScript(seedFn);
  await page.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#homeBody', { timeout: 12000 });
  await page.waitForTimeout(900);
  return { ctx: ctx, page: page, errs: errs };
}

/* 弹窗可见性 + 内容快照。hidden 属性是唯一判据（CSS 里 .mask[hidden]{display:none}）。 */
function introState(page) {
  return page.evaluate(function () {
    var m = document.getElementById('chunkIntroMask');
    if (!m) return { exists: false, hidden: null, text: '', pills: 0, roles: [], dup: 0 };
    /* 剥注释再取文案：注释里也写了「意群」，不剥会把注释当成用户可见内容（假绿）。 */
    var clone = m.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll('*'), function (n) {
      if (n.nodeType === 8) n.remove();
    });
    return {
      exists: true,
      hidden: m.hidden,
      text: (clone.textContent || '').replace(/\s+/g, ' ').trim(),
      pills: m.querySelectorAll('.ci-pill').length,
      roles: Array.prototype.map.call(m.querySelectorAll('.ci-pill .r'), function (n) { return (n.textContent || '').trim(); }),
      dup: document.querySelectorAll('#chunkIntroMask').length
    };
  });
}
function homeHasIntroBtn(page) {
  return page.evaluate(function () {
    var b = document.querySelector('#homeBody #homeChunkIntro');
    return { exists: !!b, svg: !!(b && b.querySelector('svg')), text: b ? (b.textContent || '').trim() : '' };
  });
}

/* 角色标签的实测对比度（WCAG 2.x 相对亮度口径）。
   为什么要在 e2e 里算而不是肉眼过：9.5px 属小字，AA 阈值 4.5:1，而这些标签是
   「文字色 + 同色半透明底」，两层都参与计算 —— 肉眼完全看不出 3.67 和 4.91 的区别。
   底色合成用 .modal 的 background（= --surface #fffdfa），因为 .modal-body 自身透明。 */
function readBadges(page) {
  return page.evaluate(function () {
    function parseRgb(s) {
      var m = String(s).match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      return m[1].split(',').map(function (x) { return parseFloat(x); });
    }
    function lum(c) {
      function f(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    }
    function ratio(a, b) {
      var la = lum(a), lb = lum(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }
    var modal = document.querySelector('#chunkIntroMask .modal');
    var surface = parseRgb(getComputedStyle(modal).backgroundColor) || [255, 253, 250];
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll('#chunkIntroMask .ci-pill .r'), function (el) {
      var cs = getComputedStyle(el);
      var fg = parseRgb(cs.color);
      var bg = parseRgb(cs.backgroundColor);
      var alpha = (bg && bg.length === 4) ? bg[3] : 1;
      var k = parseFloat(cs.opacity);
      if (!isFinite(k)) k = 1;
      /* 必须把元素自身的 opacity 也合成进去：getComputedStyle 只给「指定色」，
         不带 opacity。先前漏了这一步，注入 opacity:.85 时算出的比值纹丝不动
         （B8 负向自证当场变红才暴露出来）—— 只加 opacity 就是这个弹窗最可能的
         低对比回归方式，漏算等于护栏是空的。 */
      var tint = [0, 1, 2].map(function (i) { return alpha * bg[i] + (1 - alpha) * surface[i]; });
      var effBg = [0, 1, 2].map(function (i) { return k * tint[i] + (1 - k) * surface[i]; });
      var effFg = [0, 1, 2].map(function (i) { return k * fg[i] + (1 - k) * surface[i]; });
      out.push({ text: (el.textContent || '').trim(), opacity: cs.opacity, ratio: Math.round(ratio(effFg, effBg) * 100) / 100 });
    });
    return out;
  });
}

(async function () {
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });

    /* ===== A：新用户首页（空档案）===== */
    console.log('【场景 A：新用户空档案首页】');
    let sA = await open(emptyStore);
    {
      const empty = await sA.page.evaluate(function () {
        var e = document.querySelector('#homeBody .home-empty');
        return { exists: !!e, text: e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '' };
      });
      check('A1 空档案渲染 .home-empty', empty.exists === true, JSON.stringify(empty));
      check('A2 空档案文案里第一次出现「意群」（此前一个字都没有）',
        empty.text.indexOf('意群') >= 0, '实际 "' + empty.text + '"');
      const btn = await homeHasIntroBtn(sA.page);
      check('A3 空档案提供「意群是什么？」入口', btn.exists === true, JSON.stringify(btn));
      check('A4 入口是 SVG 图标而非字符 icon（宪法：UI 禁字符 icon）', btn.svg === true, JSON.stringify(btn));
      check('A5 无 JS 运行时错误', sA.errs.length === 0, sA.errs.join(' | '));

      /* ===== B：打开说明弹窗 ===== */
      console.log('【场景 B：打开说明弹窗】');
      await sA.page.locator('#homeBody #homeChunkIntro').click();
      await sA.page.waitForTimeout(200);
      const b = await introState(sA.page);
      check('B1 点击入口 → 弹窗可见', b.exists === true && b.hidden === false, JSON.stringify({ exists: b.exists, hidden: b.hidden }));
      check('B2 全页只有一份 #chunkIntroMask（单一定义来源，不是多处复制文案）', b.dup === 1, 'dup=' + b.dup);
      check('B3 文案给出定义（含「意群」与「自然停顿」）',
        b.text.indexOf('意群') >= 0 && b.text.indexOf('自然停顿') >= 0, '实际 "' + b.text + '"');
      check('B4 示例切成 2 块，并标出角色「主句 / 原因状语从句」',
        b.pills === 2 && b.roles.join('|') === '主句|原因状语从句', 'pills=' + b.pills + ' roles=' + b.roles.join('|'));
      check('B5 文案解释切分规则（不会在词组中间切断）',
        b.text.indexOf('不会在词组中间切断') >= 0, '实际 "' + b.text + '"');
      check('B6 文案说明练习怎么考（按顺序还原）', b.text.indexOf('按顺序') >= 0, '实际 "' + b.text + '"');

      /* 角色标签是「彩色文字 + 同色半透明底」，两层叠加，肉眼分不出合格与不合格 —— 必须实测。 */
      const badges = await readBadges(sA.page);
      check('B7 角色标签对比度 ≥ 4.5:1（9.5px 属小字；且不得用 opacity 换低对比）',
        badges.length === 2 && badges.every(function (x) { return x.ratio >= 4.5 && x.opacity === '1'; }),
        JSON.stringify(badges));
      /* 负向自证：给文字加 opacity 会被底色往上拉，对比度必须真的跌破 4.5 —— 否则 B7 是空的。 */
      const negStyle = await sA.page.addStyleTag({ content: '#chunkIntroMask .ci-pill .r{opacity:.85 !important}' });
      const negBadges = await readBadges(sA.page);
      check('B8 负向自证：注入 opacity:.85 后 B7 会变红',
        negBadges.some(function (x) { return x.ratio < 4.5; }), JSON.stringify(negBadges));
      await negStyle.evaluate(function (el) { el.remove(); });

      /* ===== C：三条关闭路径 ===== */
      console.log('【场景 C：关闭路径】');
      await sA.page.locator('#chunkIntroMask .modal-foot [data-close]').click();
      await sA.page.waitForTimeout(200);
      const c1 = await introState(sA.page);
      check('C1 点「知道了」→ 关闭', c1.hidden === true, JSON.stringify({ hidden: c1.hidden }));
      check('C2 关闭后仍停在首页（不被 closeMasks 的 goPractice 副作用踢到练习页）',
        await sA.page.evaluate(function () {
          var h = document.getElementById('pageHome'), p = document.getElementById('pagePractice');
          return !h.classList.contains('hidden') && p.classList.contains('hidden');
        }) === true);

      /* 负向自证：C1 的判据必须能变红 —— 手工掀开 hidden 后同一判据应报 false，
         否则它只是「元素永远不存在」的恒真断言。 */
      await sA.page.evaluate(function () { document.getElementById('chunkIntroMask').hidden = false; });
      const cNeg = await introState(sA.page);
      check('C3 负向自证：掀开 hidden 后 C1 的判据会变红', cNeg.hidden === false, JSON.stringify({ hidden: cNeg.hidden }));
      await sA.page.evaluate(function () { document.getElementById('chunkIntroMask').hidden = true; });

      await sA.page.locator('#homeBody #homeChunkIntro').click();
      await sA.page.waitForTimeout(150);
      await sA.page.keyboard.press('Escape');
      await sA.page.waitForTimeout(200);
      check('C4 Esc → 关闭', (await introState(sA.page)).hidden === true);

      await sA.page.locator('#homeBody #homeChunkIntro').click();
      await sA.page.waitForTimeout(150);
      await sA.page.mouse.click(10, 10);   /* mask 有 38px 上内边距，点左上角命中 mask 自身 */
      await sA.page.waitForTimeout(200);
      check('C5 点弹窗外的遮罩 → 关闭', (await introState(sA.page)).hidden === true);

      /* ===== D：设置面板入口（永久可达）===== */
      console.log('【场景 D：设置面板入口】');
      await sA.page.locator('#btnSettingsTop').click();
      await sA.page.waitForTimeout(250);
      check('D1 点顶栏设置 → 设置面板可见',
        await sA.page.evaluate(function () { return document.getElementById('settingsMask').hidden === false; }) === true);
      await sA.page.locator('#btnChunkIntro').click();
      await sA.page.waitForTimeout(250);
      const d = await sA.page.evaluate(function () {
        return {
          settingsHidden: document.getElementById('settingsMask').hidden,
          introHidden: document.getElementById('chunkIntroMask').hidden
        };
      });
      check('D2 设置入口打开意群说明，且设置面板已收起（不两层叠加）',
        d.introHidden === false && d.settingsHidden === true, JSON.stringify(d));
      check('D3 无 JS 运行时错误', sA.errs.length === 0, sA.errs.join(' | '));
    }
    await sA.ctx.close();

    /* ===== E：有学习记录的老用户 ===== */
    console.log('【场景 E：已有学习记录】');
    {
      const sE = await open(learnedStore);
      check('E1 有学习记录 → 首页不再出现空档案入口（不给老用户添乱）',
        (await homeHasIntroBtn(sE.page)).exists === false);
      await sE.page.locator('#btnSettingsTop').click();
      await sE.page.waitForTimeout(250);
      check('E2 但设置面板入口仍在（永久可达）',
        await sE.page.evaluate(function () { return !!document.getElementById('btnChunkIntro'); }) === true);
      check('E3 无 JS 运行时错误', sE.errs.length === 0, sE.errs.join(' | '));
      await sE.ctx.close();
    }

    await browser.close();
    stopServer();
    console.log('\n结果：' + passed + ' 通过 / ' + failed + ' 失败');
    process.exit(failed ? 1 : 0);
  } catch (e) {
    console.error(e);
    if (browser) { try { await browser.close(); } catch (x) {} }
    stopServer();
    process.exit(1);
  }
})();
