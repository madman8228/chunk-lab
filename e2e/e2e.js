/**
 * e2e.js · 浏览器端到端回归（Playwright）
 *
 * 一键运行（自动拉起临时 server，无需手工起服务）：
 *   npm run e2e
 *
 * 覆盖（2026-09-08 对齐现状，移除已停用 AI 兜底描述）：
 *   1. main.html 正常路径：顶栏 SVG / 扁平化 / 朗读按钮 / 候选区 / 零 pageerror
 *   1b-1d. 统计身份合并 / 旧 key 迁移 / 移动端·窄屏响应式布局
 *   2. 全 module 拦截（safeCall 兜底不白屏）
 *   3. decks.html / stats.html → SVG 图标渲染 + 零 pageerror + stats 移动端
 *   4. 错题本收敛闭环（2026-09-08 fix f371d77 防回潮）：
 *      4a 写入收敛（saveReinforceList → mem.reinforceBook + chunklab.v1 落盘，无独立键）
 *      4b 旧独立键 chunklab_reinforce 一次性迁移（loadStore → migrateLegacyReinforce）
 *      4c stats.html 错题本 tab 可见性（读 mem.reinforceBook）
 *   5. 死代码清理回归（2026-09-08 refactor 0418b06 防回潮）：
 *      最小 deck 驱动真实作答到结算卡 → btnOtherDeck 跳 decks.html（原走已删 openDecks）
 *
 * 依赖：playwright-core（根 devDependency）+ 系统已安装的 chromium-headless-shell
 *   （找不到可用浏览器时设 CHROMIUM_PATH=/path/to/chrome-headless-shell.exe）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const PORT = 8902 + Math.floor(Math.random() * 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-e2e-'));
let server = null;

function startServer() {
  return new Promise(function (resolve, reject) {
    const node = process.execPath;
    server = spawn(node, ['index.js'], {
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
      req.on('error', function () { /* 重试 */ });
      req.setTimeout(600, function () { req.destroy(); });
      if (tries > 40) { clearInterval(iv); reject(new Error('server 启动超时')); }
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

(async function () {
  const BASE = 'http://127.0.0.1:' + PORT;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH ||
      'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
  });
  await startServer();
  console.log('E2E server: ' + BASE);

  /* ===== 1. main.html 正常路径 ===== */
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', function (e) { errs.push(e.message); });
  await p.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#stageChoices, #track', { timeout: 12000 }).catch(function () {});
  await p.waitForTimeout(1000);
  const ok = await p.evaluate(function () {
    return {
      zh: (document.getElementById('zh') || {}).textContent || '',
      topbarIcons: ['btnSound', 'btnStats', 'btnSettingsTop'].filter(function (id) {
        var el = document.getElementById(id);
        return el && el.querySelector('svg');
      }).length,
      topbarToolButtons: ['btnSound', 'btnStats', 'btnSettingsTop'].map(function (id) {
        var el = document.getElementById(id);
        return el && el.classList.contains('icon-action') && getComputedStyle(el).borderTopStyle === 'none';
      }).filter(Boolean).length,
      metricFlat: Array.from(document.querySelectorAll('.metrics .metric')).filter(function (el) {
        var cs = getComputedStyle(el);
        return cs.borderTopStyle === 'none' && cs.backgroundColor === 'rgba(0, 0, 0, 0)';
      }).length,
      decksFlat: (function () {
        var el = document.getElementById('btnDecks');
        var cs = el && getComputedStyle(el);
        return !!(el && el.classList.contains('flat-action') && cs.borderTopStyle === 'none' && cs.backgroundColor === 'rgba(0, 0, 0, 0)');
      }()),
      distractors: Array.from(document.querySelectorAll('#stageChoices .chunk-chip, #stageChoices button')).length,
      shortcutDisplay: getComputedStyle(document.getElementById('stageTipBar')).display,
      preselectedCorrectChoices: document.querySelectorAll('#stageChoices .choice.correct').length,
      deckName: (document.getElementById('deckName') || {}).textContent || '',
      speakText: (document.getElementById('btnSpeak') || {}).textContent || '',
      speakClass: (document.getElementById('btnSpeak') || {}).classList && document.getElementById('btnSpeak').classList.contains('icon-action'),
      speakBorder: getComputedStyle(document.getElementById('btnSpeak')).borderTopStyle,
      speakAfterEnglish: !!(document.getElementById('btnSpeak') && document.getElementById('btnSpeak').closest('.track-line')),
      answerRoleGap: (function(){
        var gaps = Array.from(document.querySelectorAll('#track > .chunk')).map(function(chunk){
          var answer = chunk.querySelector('.chunk-answer');
          var role = chunk.querySelector('.chunk-role');
          if(!answer || !role || answer.getBoundingClientRect().height <= 0 || role.getBoundingClientRect().height <= 0) return null;
          return Math.round(role.getBoundingClientRect().top - answer.getBoundingClientRect().bottom);
        }).filter(function(g){ return g !== null; });
        return gaps.length ? Math.max.apply(Math, gaps) : 0;
      }())
    };
  });
  const topbarHover = [];
  for (const id of ['btnSound', 'btnStats', 'btnSettingsTop']) {
    await p.locator('#' + id).hover();
    await p.waitForTimeout(200);
    topbarHover.push(await p.evaluate(function (buttonId) {
      return getComputedStyle(document.getElementById(buttonId)).backgroundColor;
    }, id));
  }
  await p.evaluate(function () { document.getElementById('btnSpeak').classList.remove('hidden'); });
  await p.locator('#btnSpeak').hover();
  await p.waitForTimeout(200);
  const speakHover = await p.evaluate(function () {
    return getComputedStyle(document.getElementById('btnSpeak')).backgroundColor;
  });
  const speakCentering = await p.evaluate(function () {
    var button = document.getElementById('btnSpeak');
    var track = document.getElementById('track');
    var br = button.getBoundingClientRect();
    var tr = track.getBoundingClientRect();
    return Math.abs((br.top + br.height / 2) - (tr.top + tr.height / 2)) <= 1.5;
  });
  check('main: 顶栏 3 按钮全 SVG', ok.topbarIcons === 3, 'got ' + ok.topbarIcons);
  check('main: 顶栏工具按钮去除方形容器', ok.topbarToolButtons === 3, JSON.stringify(ok));
  check('main: 进度与连击改为扁平显示', ok.metricFlat === 2, JSON.stringify(ok));
  check('main: 题库入口改为扁平显示', ok.decksFlat, JSON.stringify(ok));
  check('main: 顶栏工具按钮 Hover 无圆形背景', topbarHover.every(function (bg) { return bg === 'rgba(0, 0, 0, 0)'; }), JSON.stringify(topbarHover));
  check('main: 朗读按钮放在英文句子末尾', ok.speakAfterEnglish, JSON.stringify(ok));
  check('main: 朗读按钮与英文句子垂直居中', speakCentering, 'button/track 未居中');
  check('main: 朗读按钮 Hover 无容器背景', speakHover === 'rgba(0, 0, 0, 0)', 'background=' + speakHover);
  check('main: chunk 标签靠近下划线', ok.answerRoleGap <= 3, 'gap=' + ok.answerRoleGap);
  await p.locator('#btnSound').click();
  await p.waitForTimeout(80);
  const soundSyncBadge = await p.evaluate(function () {
    var b = document.getElementById('syncBadge');
    return b ? getComputedStyle(b).display : 'missing';
  });
  check('main: 切换音效不显示未同步提示', soundSyncBadge === 'none', 'display=' + soundSyncBadge);
  check('main: #zh 渲染真实句子（非占位）', ok.zh.length > 0 && ok.zh.indexOf('加载中') < 0, JSON.stringify(ok.zh));
  check('main: 顶栏题库名仅显示中文', ok.deckName.indexOf('日常对话') >= 0 && ok.deckName.indexOf('Daily Talk') < 0, JSON.stringify(ok.deckName));
  check('main: 候选区渲染', ok.distractors > 0, 'n=' + ok.distractors);
  check('main: 候选项不预先泄露答案', ok.preselectedCorrectChoices === 0, 'correct=' + ok.preselectedCorrectChoices);
  check('main: 桌面保留键盘快捷键提示', ok.shortcutDisplay !== 'none', 'display=' + ok.shortcutDisplay);
  check('main: 朗读使用无容器喇叭图标', ok.speakText.trim() === '' && ok.speakClass && ok.speakBorder === 'none', JSON.stringify(ok));
  check('main: 零 pageerror', errs.length === 0, errs.join('|'));

  /* ===== 1b. 统计身份回归：临时复习队列不能拆分原句历史 =====
   * 最小场景：同一句先从稳定题库练习，再从带时间戳的复习题库练习。
   * 现状会按两个 deck id 写成两条 bySentence 记录，导致累计次数看起来丢失。 */
  const pStatsRoot = await ctx.newPage();
  await pStatsRoot.route('**/api/**', function (r) { r.abort('failed'); });
  await pStatsRoot.addInitScript(function () {
    localStorage.clear();
    localStorage.setItem('chunklab.v1', JSON.stringify({
      version: 2, decks: [], best: {}, mastered: {}, deletedItems: {},
      stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} },
      settings: { mode: 'choose', skipMastered: false, batchSize: 10 }
    }));
  });
  await pStatsRoot.goto(BASE + '/main.html?preview=stats-root-cause', { waitUntil: 'domcontentloaded' });
  await pStatsRoot.waitForTimeout(1200);
  const statIdentity = await pStatsRoot.evaluate(function () {
    var item = { sentence: 'I would like to check in, please.', chunks: ['I would like to', 'check in,', 'please.'], hints: ['', '', ''] };
    S.deck = { id: 'daily-talk', name: '日常对话' };
    recordSentenceResult(item, true);
    saveStore();
    S.deck = { id: 'srs-m123', name: '到期复习 · 1 句' };
    var reviewItem = Object.assign({}, item, { _statsDeckId: 'daily-talk' });
    recordSentenceResult(reviewItem, true);
    saveStore();
    var saved = JSON.parse(localStorage.getItem('chunklab.v1'));
    var keys = Object.keys(saved.stats.bySentence);
    return { keys: keys, total: saved.stats.totalAnswered, times: keys.map(function (k) { return saved.stats.bySentence[k].times; }) };
  });
  check('stats: 同一句跨普通/临时复习队列合并为一条历史',
    statIdentity.keys.length === 1 && statIdentity.total === 2 && statIdentity.times[0] === 2,
    JSON.stringify(statIdentity));

  /* ===== 1c. 历史迁移：旧临时 ID 能唯一匹配时并回原题库 ===== */
  const pStatsMigration = await ctx.newPage();
  await pStatsMigration.route('**/api/**', function (r) { r.abort('failed'); });
  await pStatsMigration.addInitScript(function () {
    localStorage.clear();
    localStorage.setItem('chunklab.v1', JSON.stringify({
      version: 2,
      decks: [{ id: 'user-deck', name: '我的题库', items: [{ sentence: 'Legacy sentence.', chunks: ['Legacy sentence.'] }] }],
      best: {}, mastered: {}, deletedItems: {},
      stats: { totalRounds: 1, totalAnswered: 1, bySentence: {
        'book-old#Legacy sentence.': { deckId: 'book-old', deckName: '错题本 · 练习', sentence: 'Legacy sentence.', times: 1, okTimes: 0, wrongTimes: 1, lastAt: 100 }
      } },
      settings: { mode: 'choose', skipMastered: false, batchSize: 10 }
    }));
  });
  await pStatsMigration.goto(BASE + '/main.html?preview=stats-migration', { waitUntil: 'domcontentloaded' });
  await pStatsMigration.waitForTimeout(1200);
  const migrated = await pStatsMigration.evaluate(function () {
    var saved = JSON.parse(localStorage.getItem('chunklab.v1'));
    /* 句子档案 key 已与原文解耦为 deckId#cid（cid 由 core.js fnv8 派生） */
    var newKey = 'user-deck#' + window.CL.fnv8('Legacy sentence.');
    return { keys: Object.keys(saved.stats.bySentence), rec: saved.stats.bySentence[newKey] || null, newKey: newKey };
  });
  check('stats: 旧临时 ID 可唯一匹配时迁移到原题库',
    migrated.keys.length === 1 && !!migrated.rec && migrated.rec.deckId === 'user-deck' && migrated.keys[0] === migrated.newKey,
    JSON.stringify(migrated));

  /* ===== 1d. 移动端响应式：快捷键隐藏，底部操作按钮统一触控尺寸 ===== */
  const mobileCtx = await browser.newContext({ viewport: { width: 296, height: 674 }, isMobile: true, hasTouch: true });
  const pm = await mobileCtx.newPage();
  await pm.route('**/api/**', function (r) { r.abort('failed'); });
  await pm.goto(BASE + '/main.html?preview=mobile-responsive', { waitUntil: 'domcontentloaded' });
  await pm.waitForTimeout(1200);
  const mobileLayout = await pm.evaluate(function () {
    /* 让分析区进入真实 DOM，覆盖用户完成句子后的首屏状态。 */
    if (typeof renderAnalysis === 'function' && typeof cur === 'function' && cur()) renderAnalysis(cur());
    var master = document.getElementById('btnMaster');
    var explain = document.getElementById('btnExplain');
    var shortcut = document.getElementById('stageTipBar');
    var stage = document.getElementById('stage');
    var analysis = document.getElementById('analysisPanel');
    var mr = master ? master.getBoundingClientRect() : null;
    var er = explain ? explain.getBoundingClientRect() : null;
    var sr = stage ? stage.getBoundingClientRect() : null;
    var ar = analysis ? analysis.getBoundingClientRect() : null;
    var rows = {};
    Array.from(document.querySelectorAll('#stageChoices .choice')).forEach(function (el) {
      var top = Math.round(el.getBoundingClientRect().top / 4) * 4;
      rows[top] = (rows[top] || 0) + 1;
    });
    var rowCounts = Object.keys(rows).map(function (key) { return rows[key]; });
    var trackRows = {};
    Array.from(document.querySelectorAll('#track > .chunk')).forEach(function (el) {
      var top = Math.round(el.getBoundingClientRect().top / 4) * 4;
      trackRows[top] = (trackRows[top] || 0) + 1;
    });
    var trackRowCounts = Object.keys(trackRows).map(function (key) { return trackRows[key]; });
    var answerWidths = Array.from(document.querySelectorAll('#track > .chunk .chunk-answer')).map(function (el) {
      return Math.round(el.getBoundingClientRect().width);
    });
    return {
      shortcutDisplay: shortcut ? getComputedStyle(shortcut).display : 'missing',
      masterHeight: mr ? Math.round(mr.height) : 0,
      explainHeight: er ? Math.round(er.height) : 0,
      masterWidth: mr ? Math.round(mr.width) : 0,
      explainWidth: er ? Math.round(er.width) : 0,
      masterText: master ? master.textContent.trim() : '',
      explainText: explain ? explain.textContent.trim() : '',
      explainIconCount: explain ? explain.querySelectorAll('svg').length : 0,
      choiceCount: rowCounts.reduce(function (sum, count) { return sum + count; }, 0),
      maxChoicesPerRow: rowCounts.length ? Math.max.apply(Math, rowCounts) : 0,
      trackCount: trackRowCounts.reduce(function (sum, count) { return sum + count; }, 0),
      maxChunksPerRow: trackRowCounts.length ? Math.max.apply(Math, trackRowCounts) : 0,
      minAnswerWidth: answerWidths.length ? Math.min.apply(Math, answerWidths) : 0,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      overflowY: document.documentElement.scrollHeight > document.documentElement.clientHeight,
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: document.documentElement.clientHeight,
      stageBottom: sr ? Math.round(sr.bottom) : 0,
      analysisBottom: ar ? Math.round(ar.bottom) : 0
    };
  });
  check('mobile: 隐藏键盘快捷键提示', mobileLayout.shortcutDisplay === 'none', JSON.stringify(mobileLayout));
  check('mobile: 标熟/详解统一触控高度',
    mobileLayout.masterHeight === mobileLayout.explainHeight && mobileLayout.masterHeight >= 32,
    JSON.stringify(mobileLayout));
  check('mobile: 标熟按钮显示为“熟”', mobileLayout.masterText === '熟', JSON.stringify(mobileLayout));
  check('mobile: 详解按钮不显示 Icon', mobileLayout.explainText === '详解' && mobileLayout.explainIconCount === 0, JSON.stringify(mobileLayout));
  check('mobile: 候选 chunk 至少可并排两个',
    mobileLayout.choiceCount < 2 || mobileLayout.maxChoicesPerRow >= 2,
    JSON.stringify(mobileLayout));
  check('mobile: 主卡片 chunk 至少可并排两个',
    mobileLayout.trackCount < 2 || mobileLayout.maxChunksPerRow >= 2,
    JSON.stringify(mobileLayout));
  check('mobile: 空答案块保持列宽',
    mobileLayout.trackCount < 2 || mobileLayout.minAnswerWidth >= 40,
    JSON.stringify(mobileLayout));
  check('mobile: 练习与分析首屏无纵向溢出', !mobileLayout.overflowY, JSON.stringify(mobileLayout));
  check('mobile: 页面无横向溢出', !mobileLayout.overflowX, JSON.stringify(mobileLayout));
  await mobileCtx.close();

  const narrowCtx = await browser.newContext({ viewport: { width: 831, height: 960 } });
  const pn = await narrowCtx.newPage();
  await pn.route('**/api/**', function (r) { r.abort('failed'); });
  await pn.goto(BASE + '/main.html?preview=narrow-touch-panel', { waitUntil: 'domcontentloaded' });
  await pn.waitForTimeout(1200);
  const narrowLayout = await pn.evaluate(function () {
    var master = document.getElementById('btnMaster');
    var explain = document.getElementById('btnExplain');
    var shortcut = document.getElementById('stageTipBar');
    var mr = master ? master.getBoundingClientRect() : null;
    var er = explain ? explain.getBoundingClientRect() : null;
    return {
      shortcutDisplay: shortcut ? getComputedStyle(shortcut).display : 'missing',
      masterHeight: mr ? Math.round(mr.height) : 0,
      explainHeight: er ? Math.round(er.height) : 0,
      masterWidth: mr ? Math.round(mr.width) : 0,
      explainWidth: er ? Math.round(er.width) : 0
    };
  });
  check('narrow mobile panel: 隐藏 PC 快捷键提示', narrowLayout.shortcutDisplay === 'none', JSON.stringify(narrowLayout));
  check('narrow mobile panel: 熟按钮宽度更紧凑且高度统一',
    narrowLayout.masterHeight === narrowLayout.explainHeight && narrowLayout.masterWidth < narrowLayout.explainWidth,
    JSON.stringify(narrowLayout));
  await narrowCtx.close();

  /* ===== 2. 全 module 拦截（safeCall 兜底） ===== */
  const p2 = await ctx.newPage();
  const errs2 = [];
  p2.on('pageerror', function (e) { errs2.push(e.message); });
  ['bridge.mjs', 'chunk-engine.mjs', 'format.mjs', 'ai-prompts.mjs', 'backup.mjs'].forEach(function (m) {
    p2.route('**/js/' + m, function (r) { r.abort('failed'); });
  });
  await p2.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(1500);
  const fb = await p2.evaluate(function () {
    var zh = document.getElementById('zh');
    return { zh: zh ? zh.textContent : '', err: zh ? zh.textContent.indexOf('启动失败') >= 0 : true };
  });
  check('降级: 全 module 拦截下 #zh 仍渲染', fb.zh.length > 0 && !fb.err, JSON.stringify(fb));
  check('降级: 零 pageerror', errs2.length === 0, errs2.join('|'));

  /* ===== 3. decks.html / stats.html ===== */
  const pd = await ctx.newPage();
  const errsd = [];
  pd.on('pageerror', function (e) { errsd.push(e.message); });
  await pd.goto(BASE + '/decks.html', { waitUntil: 'domcontentloaded' });
  await pd.waitForTimeout(1200);
  const decksLayout = await pd.evaluate(function () {
    return {
      svg: document.querySelectorAll('svg.icon').length,
      back: (document.getElementById('decksBack') || {}).textContent || '',
      importText: (document.getElementById('btnImportDecks') || {}).textContent || '',
      builtinImportCount: Array.from(document.querySelectorAll('#deckList .deck-item')).filter(function(el){
        return el.querySelector('.pill:not(.mine)') && Array.from(el.querySelectorAll('.deck-actions button')).some(function(btn){ return btn.textContent.trim() === '导入'; });
      }).length,
      maxRowHeight: Math.max.apply(Math, Array.from(document.querySelectorAll('#deckList .deck-item')).map(function (el) {
        return Math.round(el.getBoundingClientRect().height);
      }))
    };
  });
  const dsvg = decksLayout.svg;
  check('decks: SVG 图标渲染', dsvg >= 10, 'svg=' + dsvg);
  check('decks: 返回按钮文案简洁', decksLayout.back.trim() === '返回', JSON.stringify(decksLayout));
  check('decks: 导入题库入口保留', decksLayout.importText.indexOf('导入题库') >= 0 && decksLayout.builtinImportCount >= 1, JSON.stringify(decksLayout));
  check('decks: 题库卡片高度紧凑', decksLayout.maxRowHeight <= 60, JSON.stringify(decksLayout));
  check('decks: 零 pageerror', errsd.length === 0, errsd.join('|'));

  const ps = await ctx.newPage();
  const errss = [];
  ps.on('pageerror', function (e) { errss.push(e.message); });
  await ps.goto(BASE + '/stats.html', { waitUntil: 'domcontentloaded' });
  await ps.waitForTimeout(1200);
  const ssvg = await ps.evaluate(function () {
    return {
      count: document.querySelectorAll('svg.icon').length,
      tabIcons: document.querySelectorAll('#statsTabs .tab svg').length
    };
  });
  check('stats: SVG 图标渲染', ssvg.count >= 2, 'svg=' + ssvg.count);
  check('stats: 三个页签统一纯文字', ssvg.tabIcons === 0, 'tabIcons=' + ssvg.tabIcons);
  check('stats: 零 pageerror', errss.length === 0, errss.join('|'));

  /* ===== 3b. stats.html 移动端信息密度 ===== */
  const statsMobileCtx = await browser.newContext({ viewport: { width: 333, height: 800 }, isMobile: true, hasTouch: true });
  const psm = await statsMobileCtx.newPage();
  await psm.route('**/api/**', function (r) { r.abort('failed'); });
  await psm.addInitScript(function () {
    localStorage.clear();
    localStorage.setItem('chunklab.v1', JSON.stringify({
      version: 2, decks: [], best: {}, mastered: {}, deletedItems: {},
      stats: { totalRounds: 1, totalAnswered: 4, bySentence: {
        'daily-talk#Demo sentence.': {
          deckId: 'daily-talk', deckName: '日常对话', sentence: 'Demo sentence.',
          translation: '示例句子。', times: 4, okTimes: 3, wrongTimes: 1,
          streak: 2, maxStreak: 2, lastAt: Date.now(), interval: 3, ease: 2.5, dueAt: 0
        }
      } },
      settings: { mode: 'choose', skipMastered: false, batchSize: 10 }
    }));
  });
  await psm.goto(BASE + '/stats.html?preview=mobile-density', { waitUntil: 'domcontentloaded' });
  await psm.waitForTimeout(1200);
  const statsMobileLayout = await psm.evaluate(function () {
    function tops(selector) {
      return Array.from(document.querySelectorAll(selector)).filter(function (el) {
        return el.getBoundingClientRect().height > 0;
      }).map(function (el) { return Math.round(el.getBoundingClientRect().top); });
    }
    var head = tops('.page-head > *');
    var kpi = tops('.kpi-row > .stat-card');
    var pair = tops('.pair-row > .stat-card');
    var rounds = document.querySelector('.kpi-rounds');
    var firstRow = document.querySelector('.stats-detail-row');
    var firstNum = firstRow && firstRow.querySelector('.row-num');
    var firstEn = firstRow && firstRow.querySelector('.en');
    var numTop = firstNum ? Math.round(firstNum.getBoundingClientRect().top) : 0;
    var enTop = firstEn ? Math.round(firstEn.getBoundingClientRect().top) : 0;
    return {
      headRows: head.length ? (Math.max.apply(Math, head) - Math.min.apply(Math, head) <= 2 ? 1 : new Set(head).size) : 0,
      kpiFirstTwoSameRow: kpi.length < 2 || kpi[0] === kpi[1],
      visibleKpiCount: kpi.length,
      roundsDisplay: rounds ? getComputedStyle(rounds).display : '',
      pairSameRow: pair.length < 2 || pair[0] === pair[1],
      rowNumberAligned: !firstRow || Math.abs(numTop - enTop) <= 3,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  });
  check('stats mobile: 顶部操作保持一行', statsMobileLayout.headRows === 1, JSON.stringify(statsMobileLayout));
  check('stats mobile: KPI 两列排列', statsMobileLayout.kpiFirstTwoSameRow, JSON.stringify(statsMobileLayout));
  check('stats mobile: KPI 压缩为 4 项', statsMobileLayout.visibleKpiCount === 4 && statsMobileLayout.roundsDisplay === 'none', JSON.stringify(statsMobileLayout));
  check('stats mobile: 超窄屏图表卡片上下排列', !statsMobileLayout.pairSameRow, JSON.stringify(statsMobileLayout));
  check('stats mobile: 记录序号与首行内容对齐', statsMobileLayout.rowNumberAligned, JSON.stringify(statsMobileLayout));
  check('stats mobile: 无横向溢出', !statsMobileLayout.overflowX, JSON.stringify(statsMobileLayout));
  const statsDetail = await psm.evaluate(function () {
    var row = document.querySelector('.stats-detail-row');
    if(!row) return { exists: false };
    var meta = row.querySelector('.meta');
    var en = row.querySelector('.en');
    var toggle = row.querySelector('.row-detail-toggle');
    var before = {
      metaDisplay: meta ? getComputedStyle(meta).display : '',
      expanded: row.classList.contains('is-expanded'),
      aria: toggle ? toggle.getAttribute('aria-expanded') : ''
    };
    row.click();
    var enRect = en ? en.getBoundingClientRect() : null;
    var metaRect = meta ? meta.getBoundingClientRect() : null;
    var after = {
      metaDisplay: meta ? getComputedStyle(meta).display : '',
      expanded: row.classList.contains('is-expanded'),
      aria: toggle ? toggle.getAttribute('aria-expanded') : '',
      sentenceWidth: enRect ? Math.round(enRect.width) : 0,
      sentenceTop: enRect ? Math.round(enRect.top) : 0,
      metaTop: metaRect ? Math.round(metaRect.top) : 0,
      contentSeparated: !!(enRect && metaRect && enRect.width > 80 && metaRect.top > enRect.bottom - 1)
    };
    row.click();
    var collapsed = {
      metaDisplay: meta ? getComputedStyle(meta).display : '',
      expanded: row.classList.contains('is-expanded'),
      aria: toggle ? toggle.getAttribute('aria-expanded') : ''
    };
    return { exists: true, before: before, after: after, collapsed: collapsed };
  });
  check('stats mobile: 记录默认收起详情', statsDetail.exists && statsDetail.before.metaDisplay === 'none' && !statsDetail.before.expanded,
    JSON.stringify(statsDetail));
  check('stats mobile: 点击记录展开详情', statsDetail.exists && statsDetail.after.metaDisplay === 'block' && statsDetail.after.expanded && statsDetail.after.aria === 'true',
    JSON.stringify(statsDetail));
  check('stats mobile: 展开后句子与详情分行', statsDetail.exists && statsDetail.after.contentSeparated,
    JSON.stringify(statsDetail));
  check('stats mobile: 再次点击收起详情', statsDetail.exists && statsDetail.collapsed.metaDisplay === 'none' && !statsDetail.collapsed.expanded && statsDetail.collapsed.aria === 'false',
    JSON.stringify(statsDetail));
  await statsMobileCtx.close();

  /* ===== 4. 错题本收敛闭环（2026-09-08 fix f371d77 防回潮） =====
   * 根因曾为双轨：main.html 写独立键 chunklab_reinforce（永不上云），stats.html 读 mem.reinforceBook。
   * 现应：写入收敛 mem.reinforceBook + 落 chunklab.v1、无独立键、旧键一次性迁移、stats 可见。 */
  async function localCtx(initScript) {
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await c.addInitScript(initScript);
    await c.route('**/api/**', function (r) { r.abort('failed'); }); /* 本地模式：不拉云不覆盖注入数据 */
    return c;
  }

  /* 4a. 写入收敛：saveReinforceList → mem.reinforceBook + chunklab.v1，且不残留独立键 */
  {
    const c4 = await localCtx(function () {
      localStorage.clear();
      localStorage.setItem('chunklab.v1', JSON.stringify({
        version: 2, decks: [], best: {}, mastered: {}, deletedItems: {}, reinforceBook: [],
        stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} },
        settings: { mode: 'choose', skipMastered: false, batchSize: 10 }
      }));
    });
    const p4 = await c4.newPage();
    const errs4 = [];
    p4.on('pageerror', function (e) { errs4.push(e.message); });
    await p4.goto(BASE + '/main.html?preview=reinforce-write', { waitUntil: 'domcontentloaded' });
    await p4.waitForFunction(function () { return window.CL && window.mem && Array.isArray(window.mem.reinforceBook); }, null, { timeout: 15000 }).catch(function () {});
    await p4.waitForTimeout(600);
    const w4 = await p4.evaluate(function () {
      var wrong = [{
        it: { sentence: 'Reinforce write test.', translation: '写入测试。', chunks: ['Reinforce', 'write', 'test.'], hints: ['', '', ''] },
        idx: [1], answers: ['write']
      }];
      saveReinforceList({ id: 'daily-talk', name: '日常对话' }, wrong);
      var stored = JSON.parse(localStorage.getItem('chunklab.v1') || '{}');
      return {
        memLen: (mem.reinforceBook || []).length,
        storedLen: (stored.reinforceBook || []).length,
        memKey: mem.reinforceBook && mem.reinforceBook[0] && mem.reinforceBook[0]._key,
        legacyKey: localStorage.getItem('chunklab_reinforce')
      };
    });
    check('reinforce 4a: 写入收敛到 mem.reinforceBook', w4.memLen === 1, JSON.stringify(w4));
    check('reinforce 4a: 落盘 chunklab.v1.reinforceBook', w4.storedLen === 1, JSON.stringify(w4));
    check('reinforce 4a: 无独立键残留', w4.legacyKey === null, 'legacyKey=' + w4.legacyKey);
    check('reinforce 4a: 零 pageerror', errs4.length === 0, errs4.join('|'));
    await p4.close(); await c4.close();
  }

  /* 4b. 旧独立键一次性迁移：chunklab_reinforce 存量并入 mem.reinforceBook 且删键 */
  {
    const c4b = await localCtx(function () {
      localStorage.clear();
      localStorage.setItem('chunklab.v1', JSON.stringify({
        version: 2, decks: [], best: {}, mastered: {}, deletedItems: {},
        stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} },
        settings: { mode: 'choose', skipMastered: false, batchSize: 10 }
      }));
      localStorage.setItem('chunklab_reinforce', JSON.stringify([{
        _key: 'old-deck::Legacy sentence.', deckId: 'old-deck', deckName: '旧题库',
        addedAt: '2026-09-01 10:00:00', sentence: 'Legacy sentence.', translation: '旧句子',
        chunks: ['Legacy', 'sentence.'], hints: [], mistakes: [{ chunkIdx: 0, chunk: 'Legacy', userAnswer: 'x', hint: '' }]
      }]));
    });
    const p4b = await c4b.newPage();
    await p4b.goto(BASE + '/main.html?preview=reinforce-migrate', { waitUntil: 'domcontentloaded' });
    await p4b.waitForFunction(function () { return window.CL && window.mem && Array.isArray(window.mem.reinforceBook); }, null, { timeout: 15000 }).catch(function () {});
    await p4b.waitForTimeout(800);
    const w4b = await p4b.evaluate(function () {
      var stored = JSON.parse(localStorage.getItem('chunklab.v1') || '{}');
      return {
        legacyKey: localStorage.getItem('chunklab_reinforce'),
        migrated: (stored.reinforceBook || []).some(function (x) { return x._key === 'old-deck::Legacy sentence.'; }),
        memLen: (mem.reinforceBook || []).length,
        storedLen: (stored.reinforceBook || []).length
      };
    });
    check('reinforce 4b: 旧独立键已删除', w4b.legacyKey === null, 'legacyKey=' + w4b.legacyKey);
    check('reinforce 4b: 旧存量并入 reinforceBook', w4b.migrated && w4b.memLen === 1 && w4b.storedLen === 1, JSON.stringify(w4b));
    await p4b.close(); await c4b.close();
  }

  /* 4c. stats.html 读侧闭环：mem.reinforceBook 中的错题在「错题本」tab 可见 */
  {
    const c4c = await localCtx(function () {
      localStorage.clear();
      localStorage.setItem('chunklab.v1', JSON.stringify({
        version: 2, decks: [], best: {}, mastered: {}, deletedItems: {},
        reinforceBook: [{ _key: 'daily-talk::Visible wrong sentence.', deckId: 'daily-talk', deckName: '日常对话',
          addedAt: '2026-09-08 10:00:00', sentence: 'Visible wrong sentence.', translation: '可见错句。',
          chunks: ['Visible', 'wrong', 'sentence.'], hints: [], mistakes: [] }],
        stats: { totalRounds: 1, totalAnswered: 1, bySentence: {} },
        settings: { mode: 'choose', skipMastered: false, batchSize: 10 }
      }));
    });
    const p4c = await c4c.newPage();
    const errs4c = [];
    p4c.on('pageerror', function (e) { errs4c.push(e.message); });
    await p4c.goto(BASE + '/stats.html?preview=reinforce-stats', { waitUntil: 'domcontentloaded' });
    await p4c.waitForSelector('#statsTabs', { timeout: 12000 });
    await p4c.waitForTimeout(800);
    await p4c.evaluate(function () {
      var t = Array.prototype.find.call(document.querySelectorAll('#statsTabs .tab'), function (b) { return b.dataset.tab === 'wrong'; });
      if (t) t.click();
    });
    await p4c.waitForTimeout(400);
    const w4c = await p4c.evaluate(function () {
      return {
        rows: document.querySelectorAll('#statsBody .wrong-row').length,
        text: (document.getElementById('statsBody') || {}).textContent || ''
      };
    });
    check('reinforce 4c: stats 错题本 tab 渲染错题', w4c.rows === 1 && w4c.text.indexOf('Visible wrong sentence.') >= 0, JSON.stringify(w4c));
    check('reinforce 4c: 零 pageerror', errs4c.length === 0, errs4c.join('|'));
    await p4c.close(); await c4c.close();
  }

  /* ===== 5. 死代码清理回归（2026-09-08 refactor 0418b06 防回潮） =====
   * 最小 deck 真实作答（答对每 chunk → 跨句 → 结算卡）→ btnOtherDeck 应跳 decks.html
   * （原指向已删的 openDecks 内嵌旧列表）。 */
  {
    const c5 = await localCtx(function () {
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
        settings: { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 10, fxStack: true, celebrate: 'confetti', autoSpeak: false, sound: true }
      }));
      sessionStorage.setItem('_startDeck', JSON.stringify({ id: 'e2e-mini', name: 'E2E 迷你题库', items: [
        { sentence: 'I would like to check in please.', translation: '我想办理入住。', chunks: ['I would like to', 'check in', 'please.'], hints: ['', '', ''] },
        { sentence: 'Could you help me carry this.', translation: '能帮我搬一下这个吗。', chunks: ['Could you', 'help me', 'carry this.'], hints: ['', '', ''] }
      ] }));
    });
    const p5 = await c5.newPage();
    const errs5 = [];
    p5.on('pageerror', function (e) { errs5.push(e.message); });
    await p5.goto(BASE + '/main.html?preview=settle-nav', { waitUntil: 'domcontentloaded' });
    await p5.waitForSelector('#stageChoices .choice, #result', { timeout: 12000 });
    /* 真实作答驱动：读当前目标 chunk 文本 → 点候选按钮。答对自动推进；整句完成出现「下一题」再点。 */
    let settled = false;
    for (let guard = 0; guard < 80; guard++) {
      const st = await p5.evaluate(function () {
        if (!window.S) return { booting: true };
        if (S.finished) return { finished: true };
        var it = typeof cur === 'function' ? cur() : null;
        if (!it) return { booting: true };
        var nb = document.getElementById('btnNext');
        var nbVisible = nb && !nb.classList.contains('hidden');
        var target = (S.chunkIdx < it.chunks.length) ? it.chunks[S.chunkIdx] : null;
        return { finished: false, target: target, nbVisible: !!nbVisible, idx: S.idx, total: S.items.length };
      });
      if (st.booting || st.finished) { if (st.finished) { settled = true; break; } await p5.waitForTimeout(200); continue; }
      if (st.nbVisible) {
        await p5.evaluate(function () { document.getElementById('btnNext').click(); });
        await p5.waitForTimeout(250);
        continue;
      }
      if (!st.target) { await p5.waitForTimeout(200); continue; }
      const hit = await p5.evaluate(function (v) {
        var btns = Array.from(document.querySelectorAll('#stageChoices .choice'));
        var b = btns.filter(function (x) { return !x.disabled && x.dataset.v === v; })[0];
        if (b) { b.click(); return true; }
        return false;
      }, st.target);
      if (!hit) await p5.waitForTimeout(200); /* 池尚未渲染/已换题，等一拍 */
    }
    const settleState = await p5.evaluate(function () {
      var r = document.getElementById('result');
      var b = document.getElementById('btnOtherDeck');
      return {
        resultShown: !!(r && !r.classList.contains('hidden') && r.textContent.trim().length > 0),
        btnOtherDeck: !!b,
        stageHidden: !!document.getElementById('stage').classList.contains('hidden')
      };
    });
    check('settle 5: 结算卡出现（最小 deck 真实答完）', settled && settleState.resultShown && settleState.btnOtherDeck, JSON.stringify({ settled: settled, st: settleState }));
    /* 点「换个题库」应整页跳 decks.html（原 openDecks 内嵌列表已删）。
       ⚠ 竞速陷阱：不能先注册 waitForURL 再 click —— click 默认 30s actionability，
       结算后庆祝层短暂遮挡按钮会拖过 waitForURL 的 8s 超时。先点击（短超时，失败降级 DOM click），再等导航。 */
    const clicked = await p5.click('#btnOtherDeck', { timeout: 4000 }).catch(function (err) {
      return p5.evaluate(function () { var b = document.getElementById('btnOtherDeck'); if (b) b.click(); return !!b; }).catch(function () { return false; });
    });
    let navOk = false;
    if (clicked !== false) {
      try { await p5.waitForURL('**/decks.html', { timeout: 8000 }); navOk = true; }
      catch (e) { navOk = false; }
    }
    check('settle 5: 换个题库跳 decks.html', !!navOk, 'nav=' + (navOk ? 'OK' : 'TIMEOUT/CLICK-FAIL'));
    check('settle 5: 零 pageerror', errs5.length === 0, errs5.join('|'));
    await p5.close(); await c5.close();
  }

  /* ===== 6. D-pipeline 预置干扰上屏（防 a677228 boot 竞态回潮） =====
   * 迷你 deck 带预置 distractors（真实 freq #197 的干扰项，含运行时题库池
   * 生成不出的形近改造项 "grab the change!"）。abort /api → ensureCloud 快
   * 返回 → 复现 a677228 竞态窗口：若引擎就绪守卫缺失，startDeck 后懒建池时
   * safeCall 兜底 [] → 空干扰池永不重建 → 预置项不上屏；守卫在 → ChunkEngine
   * 就绪后 buildDistractors pass0 展平预置 → 按钮含改造项。
   * 断言「按钮文本 ⊇ 预置改造项」= 预置上屏铁证（运行时生成不出，非兜底假阳）。 */
  {
    const c6 = await localCtx(function () {
      localStorage.clear();
      localStorage.setItem('chunklab.v1', JSON.stringify({
        version: 2, reinforceBook: [],
        decks: [], /* 走 _startDeck 注入，无需预置 decks */
        best: {}, mastered: {}, deletedItems: {},
        stats: { totalRounds: 0, totalAnswered: 0, bySentence: {} },
        settings: { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 10 }
      }));
      sessionStorage.setItem('_startDeck', JSON.stringify({
        id: 'preset-probe', name: '预置探测',
        items: [{
          sentence: "It's now or never — grab the chance!", translation: '机不可失时不再来，抓住机会！',
          chunks: ["It's now or never —", 'grab the chance!'], hints: ['', ''],
          cid: 'preset-probe-a',
          distractors: [["It's now or later —", "It's tonight or never —"], ['miss the chance!', 'grab the change!']]
        }]
      }));
    });
    const p6 = await c6.newPage();
    const errs6 = [];
    p6.on('pageerror', function (e) { errs6.push(e.message); });
    await p6.goto(BASE + '/main.html?preview=preset-on-screen', { waitUntil: 'domcontentloaded' });
    /* 等候选区出现（引擎守卫等 ChunkEngine 就绪后才会建池渲染） */
    await p6.waitForSelector('#stageChoices .choice, #stageChoices .chunk-chip', { timeout: 12000 }).catch(function () {});
    await p6.waitForTimeout(1200);
    const presetShown = await p6.evaluate(function () {
      var btns = Array.from(document.querySelectorAll('#stageChoices .choice, #stageChoices .chunk-chip'));
      var texts = btns.map(function (b) { return (b.dataset.v || b.textContent).trim(); });
      var preset = ["It's now or later —", "It's tonight or never —", 'miss the chance!', 'grab the change!'];
      var found = preset.filter(function (v) { return texts.indexOf(v) >= 0; });
      return {
        n: btns.length,
        found: found,
        allPreset: found.length === preset.length,
        hasIronclad: texts.indexOf('grab the change!') >= 0,
        texts: texts.slice(0, 10)
      };
    });
    check('preset 6: 候选区已渲染（含干扰按钮）', presetShown.n >= 3, JSON.stringify(presetShown));
    check('preset 6: 预置干扰项真实上屏（含全部 4 条）', presetShown.allPreset, JSON.stringify(presetShown));
    check('preset 6: 形近改造项 grab the change! 上屏（铁证，非运行时兜底假阳）', presetShown.hasIronclad, JSON.stringify(presetShown));
    check('preset 6: 零 pageerror', errs6.length === 0, errs6.join('|'));
    await p6.screenshot({ path: path.join(SHOTS, 'e2e-preset-on-screen.png') });
    await p6.close(); await c6.close();
  }

  /* ===== 截图 ===== */
  await p.screenshot({ path: path.join(SHOTS, 'e2e-main.png') });
  await pd.screenshot({ path: path.join(SHOTS, 'e2e-decks.png') });

  await ctx.close();
  await browser.close();
  stopServer();
  console.log('\n[e2e] passed=' + passed + ' failed=' + failed);
  process.exit(failed === 0 ? 0 : 1);
})().catch(function (e) {
  console.error('[e2e] FAIL: ' + (e && e.stack || e));
  stopServer();
  process.exit(1);
});
