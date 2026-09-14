/**
 * daily-goal.test.js · 「每日目标 + 今日进度」的端到端护栏
 *
 * 背景：首页「今日」卡原来只回答「还剩多少要复习」，从不回答「今天该练多少、练到哪了」，
 * 分批练习因此永远收不到「今天做完了」的信号（Step 3 产品评审结论）。
 *
 * 口径（已与老板确认）：
 *   - 目标粒度 = **句子数**，数据源 = CL.dailyActivity 的 answered（当日 kind:'answer' 事件数，
 *     由持久事件派生）→ 不新增 stats 字段，因此不需要动 mergeStats。
 *   - 未设目标（dailyGoal 缺省或 0）→ 首页**完全不渲染**该节点，对老用户零打扰。
 *
 * 运行：node e2e/daily-goal.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(8990, 60);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-daily-goal-'));
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

/* 今日有效练习句数 = 当日 kind:'answer' 事件数（CL.dailyActivity 的口径），
   所以直接注入 events 就能精确控制「今天练了几句」。 */
function makeInit(seed) {
  return function (s) {
    localStorage.clear();
    localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
    var now = Date.now();
    var events = [], i;
    for (i = 0; i < s.answered; i++) events.push({ id: 'e' + i, kind: 'answer', key: 'd1#k' + i, ok: true, at: now - i * 1000 });
    var settings = { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 10,
      sound: false, fxStack: false, celebrate: 'none', autoSpeak: false, darkMode: false };
    if (s.goal) settings.dailyGoal = s.goal;   /* 缺省 = 没设过目标 */
    localStorage.setItem('chunklab.v1', JSON.stringify({
      version: 2,
      decks: [{ id: 'd1', name: '目标探针题库', items: [
        { sentence: 'Goal probe sentence.', translation: '目标探针句。', chunks: ['Goal probe', 'sentence.'], hints: ['', ''], cid: 'g1' }
      ] }],
      best: {}, mastered: {}, deletedItems: {}, reinforceBook: [], progress: {},
      stats: { totalRounds: 1, totalAnswered: s.answered, bySentence: {}, events: events, daysLog: {} },
      settings: settings
    }));
  };
}

function readGoal(page) {
  return page.evaluate(function () {
    var el = document.querySelector('#homeBody .home-goal');
    if (!el) return { exists: false, text: '', done: false, barWidth: '' };
    var bar = el.querySelector('.hg-bar i');
    return {
      exists: true,
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      done: el.classList.contains('done'),
      barWidth: bar ? (bar.style.width || '') : ''
    };
  });
}

/* 结算屏的今日目标节点（与首页 .home-goal 同结构，但挂在 #result 里、用 .finish-goal 类）。 */
function readFinishGoal(page) {
  return page.evaluate(function () {
    var el = document.querySelector('#result .finish-goal');
    if (!el) return { exists: false, text: '', done: false, barWidth: '' };
    var bar = el.querySelector('.hg-bar i');
    return {
      exists: true,
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      done: el.classList.contains('done'),
      barWidth: bar ? (bar.style.width || '') : ''
    };
  });
}

/* 走一遍真实练习直到结算屏：注入的 d1 只有 1 句 2 个 chunk（choose 模式点对两次），
   再触发 nextQuestion() → 队列已空 → finishSession() 渲染结算屏。
   不点 #btnNext 而直接调入口函数，是因为该按钮带自动倒计时，直接调用更确定。 */
async function playToResult(page) {
  await page.evaluate(function () { startDeck(findDeck('d1'), 0); });
  await page.waitForSelector('#stageChoices .choice', { timeout: 12000 });
  var answers = ['Goal probe', 'sentence.'];
  for (var i = 0; i < answers.length; i++) {
    await page.locator('#stageChoices .choice[data-v="' + answers[i] + '"]').click();
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(400);
  await page.evaluate(function () { nextQuestion(); });
  await page.waitForSelector('#result:not(.hidden)', { timeout: 12000 });
  await page.waitForTimeout(250);
}

async function openHome(seed) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', function (e) { errs.push(e.message); });
  await page.route('**/api/**', function (r) { r.abort('failed'); });
  await page.route('**/content/**', function (r) { r.abort('failed'); });
  await page.addInitScript(makeInit(seed), seed);
  await page.goto(BASE + '/main.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#homeBody', { timeout: 12000 });
  await page.waitForTimeout(900);
  return { ctx: ctx, page: page, errs: errs };
}

(async function () {
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });

    /* ===== A：设了目标 20，今天练了 12 句 → 进度 12/20 = 60% ===== */
    console.log('【场景 A：目标 20，今日已练 12】');
    {
      const s = await openHome({ goal: 20, answered: 12 });
      const g = await readGoal(s.page);
      check('A1 目标节点存在', g.exists === true, JSON.stringify(g));
      check('A2 文案 = 今日 12 / 20 句', g.text.indexOf('今日 12 / 20 句') >= 0, '实际 "' + g.text + '"');
      check('A3 未达标 → 不显示完成态', g.done === false);
      check('A4 进度条宽度 = 60%', g.barWidth === '60%', '实际 "' + g.barWidth + '"');
      check('A5 无 JS 运行时错误', s.errs.length === 0, s.errs.join(' | '));
      await s.ctx.close();
    }

    /* ===== B：目标 20，今天练满 20 句 → 完成态 ===== */
    console.log('【场景 B：目标 20，今日已练 20（达标）】');
    {
      const s = await openHome({ goal: 20, answered: 20 });
      const g = await readGoal(s.page);
      check('B1 达标 → done 态', g.done === true, JSON.stringify(g));
      check('B2 文案含「目标完成」', g.text.indexOf('目标完成') >= 0, '实际 "' + g.text + '"');
      check('B3 进度条铺满 100%', g.barWidth === '100%', '实际 "' + g.barWidth + '"');
      await s.ctx.close();
    }

    /* ===== C：没设目标 → 节点必须不存在（老用户零打扰） ===== */
    console.log('【场景 C：未设目标】');
    {
      const s = await openHome({ answered: 12 });   /* 有今日活动，但没设 goal */
      const g = await readGoal(s.page);
      check('C1 未设目标 → 目标节点不存在', g.exists === false, JSON.stringify(g));
      check('C2 今日卡其他内容仍正常渲染（不是整卡被砍）', await s.page.evaluate(function () {
        return !!document.querySelector('#homeBody .home-card');
      }) === true);

      /* 负向自证：人为塞一个同结构的 .home-goal 进去，上面那条「不存在」断言必须能识别出来。
         若能做到，说明 C1 有真实判别力，而不是「选择器永远匹配不到」的恒真断言。 */
      await s.page.evaluate(function () {
        var d = document.createElement('div');
        d.className = 'home-goal';
        d.innerHTML = '<div class="hg-row"><span>今日 <b>0</b> / 20 句</span><span>0%</span></div><div class="hg-bar"><i style="width:0%"></i></div>';
        document.getElementById('homeBody').appendChild(d);
      });
      const fake = await readGoal(s.page);
      check('C3 负向自证：塞入同结构节点后 C1 的断言会变红', fake.exists === true && fake.text.indexOf('今日 0 / 20 句') >= 0,
        JSON.stringify(fake));
      await s.ctx.close();
    }

    /* ===== D：结算屏「今日目标」信号（产品评审缺口④「分批折损完成感」） ===== */
    console.log('【场景 D：目标 20，练完一组 → 结算屏显示今日进度】');
    {
      const s = await openHome({ goal: 20, answered: 12 });
      await playToResult(s.page);
      const g = await readFinishGoal(s.page);
      const exp = await s.page.evaluate(function () {
        var a = CL.dailyActivity(mem)[CL.ymd(new Date())] || {};
        return { answered: a.answered || 0, goal: normDailyGoal(mem.settings.dailyGoal) };
      });
      check('D1 结算屏出现今日目标节点', g.exists === true, JSON.stringify(g));
      /* 断言「与 CL.dailyActivity 同口径」而不是写死数字：答题本身也会追加 answer 事件，
         写死数字会假红；同口径断言才真正证明这里没有第二套按日统计。 */
      check('D2 文案与 CL.dailyActivity 同口径',
        g.text.indexOf('今日已练 ' + exp.answered + ' / ' + exp.goal + ' 句') >= 0,
        '实际 "' + g.text + '" / answered=' + exp.answered);
      check('D3 未达标 → 显示「还差 N 句」且非 done',
        g.done === false && g.text.indexOf('还差 ' + Math.max(0, exp.goal - exp.answered) + ' 句') >= 0,
        JSON.stringify(g));
      check('D4 无 JS 运行时错误', s.errs.length === 0, s.errs.join(' | '));
      await s.ctx.close();
    }

    /* ===== E：达标后结算屏必须给出完成信号 ===== */
    console.log('【场景 E：目标 20，今日已练满 → 结算屏完成态】');
    {
      const s = await openHome({ goal: 20, answered: 20 });
      await playToResult(s.page);
      const g = await readFinishGoal(s.page);
      check('E1 达标 → done 态', g.done === true, JSON.stringify(g));
      check('E2 文案含「目标完成」', g.text.indexOf('目标完成') >= 0, '实际 "' + g.text + '"');
      check('E3 进度条铺满 100%', g.barWidth === '100%', '实际 "' + g.barWidth + '"');
      await s.ctx.close();
    }

    /* ===== F：未设目标 → 结算屏不渲染该节点（老用户零打扰）+ 负向自证 ===== */
    console.log('【场景 F：未设目标 → 结算屏不渲染该节点】');
    {
      const s = await openHome({ answered: 12 });
      await playToResult(s.page);
      const g = await readFinishGoal(s.page);
      check('F1 未设目标 → 结算屏无今日目标节点', g.exists === false, JSON.stringify(g));
      check('F2 结算屏其他内容仍正常渲染（不是整屏被砍）', await s.page.evaluate(function () {
        return !!document.querySelector('#result h2');
      }) === true);
      /* 负向自证：塞一个同结构节点进去，F1 的断言必须能识别出来 ——
         否则 F1 只是「选择器永远匹配不到」的恒真断言。 */
      await s.page.evaluate(function () {
        var d = document.createElement('div');
        d.className = 'finish-goal';
        d.innerHTML = '<div class="hg-row"><span>今日已练 <b>0</b> / 20 句</span><span>还差 20 句</span></div><div class="hg-bar"><i style="width:0%"></i></div>';
        document.getElementById('result').appendChild(d);
      });
      const fake = await readFinishGoal(s.page);
      check('F3 负向自证：塞入同结构节点后 F1 会变红',
        fake.exists === true && fake.text.indexOf('今日已练 0 / 20 句') >= 0, JSON.stringify(fake));
      await s.ctx.close();
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
