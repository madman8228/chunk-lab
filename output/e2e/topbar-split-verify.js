/* topbar 拆分验证 v2：核心测「视觉」而非 DOM 存在性。
 *
 * 设计原则（宪法）：唯一事实来源 = DOM 位置。
 * .practice-context 物理嵌入 #pagePractice 内 → pagePractice hidden 时它跟着视觉不可见。
 * .topbar 只剩通用导航（brand / 同步 / icon 按钮）。
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');

/* 端口：自带服务器 + 向 OS 要空闲端口（2026-09-11，同 e2e/lib/free-port.js 的根因修复）。
   原写法依赖外部在 localhost:8896 起服务 → 该端口被别的进程（并发会话 / 上次崩掉留下的
   孤儿 server）占着时，我们 spawn 的 server 绑不上端口直接退出，而健康检查却从「占着端口的
   那个人」拿到 200 → 误报「✓ 就绪」，随后对方退出 → page.goto 报 ERR_CONNECTION_REFUSED。
   实测本轮 e2e:all 就这么假失败了一次（同 8933 / 9128 撞端口家族）。 */
const PORT = require('../../e2e/lib/free-port').freePort(8896, 60);
const BASE = 'http://127.0.0.1:' + PORT;   /* 不用 localhost：避免 ::1/IPv4 解析歧义 */
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-topbarsplit-'));
let server = null;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(__dirname, '..', '..', 'server'),
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
/* 必须兜住脚本异常退出：否则 spawn 出来的 server 会变成孤儿进程长期占住该端口
   （宿主机上 8933/9042/9128 那批僵尸监听就是这么攒出来的）。 */
function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) { /* noop */ } server = null; }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
}

(async () => {
  await startServer();
  try {
  const CHROMIUM = process.env.CHROMIUM_PATH || 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe';
  const { chromium } = require('playwright-core');
  const SHOTS = path.join(__dirname, 'shots');
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

  function pass(n){ console.log('  ✓', n); }
  function fail(n, info){ console.log('  ✗', n, info ? '| ' + JSON.stringify(info) : ''); process.exitCode = 1; }
  function check(n, c, info){ c ? pass(n) : fail(n, info); }

  const browser = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });

  /* 共享：测视觉可见性 */
  async function snap(page){
    return await page.evaluate(() => {
      function inside(el, sel){
        var p = el;
        while(p){ if(p.matches && p.matches(sel)) return true; p = p.parentElement; }
        return false;
      }
      function visibleBox(el){
        if(!el) return null;
        var cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return null;
        var r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return null;
        var p = el.parentElement;
        while(p){
          if(getComputedStyle(p).display === 'none') return null;
          p = p.parentElement;
        }
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      }
      function parentDisplayNone(el){
        var p = el && el.parentElement;
        while(p){
          if(getComputedStyle(p).display === 'none') return true;
          p = p.parentElement;
        }
        return false;
      }
      return {
        topbar: visibleBox(document.querySelector('.topbar')),
        practiceContext: visibleBox(document.querySelector('.practice-context')),
        topbarChildren: Array.from(document.querySelector('.topbar').children).map(function(el){
          return el.tagName + (el.className ? '.' + el.className.split(/\s+/).join('.') : el.id ? '#'+el.id : '');
        }),
        deckName: {
          el: !!document.querySelector('#deckName'),
          inTopbar: inside(document.querySelector('#deckName'), '.topbar'),
          inPC: !!(document.querySelector('.practice-context') && document.querySelector('.practice-context').contains(document.querySelector('#deckName'))),
          parentHidden: parentDisplayNone(document.querySelector('#deckName')),
          text: (document.querySelector('#deckName') || {}).textContent || ''
        },
        mProgress: {
          el: !!document.querySelector('#mProgress'),
          inTopbar: inside(document.querySelector('#mProgress'), '.topbar'),
          inPC: !!(document.querySelector('.practice-context') && document.querySelector('.practice-context').contains(document.querySelector('#mProgress'))),
          parentHidden: parentDisplayNone(document.querySelector('#mProgress')),
          text: (document.querySelector('#mProgress') || {}).textContent || ''
        },
        progFill: {
          el: !!document.querySelector('#progFill'),
          inTopbar: inside(document.querySelector('#progFill'), '.topbar'),
          inPC: !!(document.querySelector('.practice-context') && document.querySelector('.practice-context').contains(document.querySelector('#progFill'))),
          parentHidden: parentDisplayNone(document.querySelector('#progFill'))
        },
        pageHomeShown: !document.querySelector('#pageHome').classList.contains('hidden'),
        pagePracticeShown: !document.querySelector('#pagePractice').classList.contains('hidden')
      };
    });
  }

  /* ========== 1. 首页 ========== */
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pa = await ctxA.newPage();
  await pa.goto(BASE + '/main.html', { waitUntil: 'networkidle' });
  await pa.waitForSelector('#pageHome', { timeout: 10000 });
  await pa.waitForTimeout(400);

  const home = await snap(pa);
  check('首页：pageHome 显示', home.pageHomeShown);
  check('首页：pagePractice 隐藏', !home.pagePracticeShown);
  check('首页：topbar 可见', !!home.topbar);
  check('★ 首页：practice-context 视觉不可见', !home.practiceContext);
  check('首页：deckName 不在 topbar 内', !home.deckName.inTopbar);
  check('首页：mProgress 不在 topbar 内', !home.mProgress.inTopbar);
  check('首页：progFill 不在 topbar 内', !home.progFill.inTopbar);
  check('★ 首页：deckName 父链有 display:none（pagePractice 已隐藏）', home.deckName.parentHidden);
  check('★ 首页：progFill 父链有 display:none', home.progFill.parentHidden);
  check('首页：topbar 子节点只剩 row + reveal（无 metrics/progress）',
    home.topbarChildren.length <= 3 && home.topbarChildren.every(function(s){ return /topbar-row|topbar-reveal|updateToast/.test(s); }),
    home.topbarChildren);
  check('★ 首页：topbar 视觉高 < 80px（旧版 ≈120px 折叠后未影响 layout）', home.topbar && home.topbar.h < 80, home.topbar);

  await pa.screenshot({ path: path.join(SHOTS, 'split2-1-home-clean.png'), fullPage: false });

  /* ========== 2. 进入练习页 ========== */
  await pa.evaluate(() => {
    var items = [];
    for (var i=0;i<5;i++){
      items.push({ sentence: 'hello ' + i, translation: '你好' + i, chunks: ['hello', i+''], hints: ['',''], cid:'a'+i, id:'a'+i, distractors:['x'] });
    }
    window.mem = {
      version: 2, reinforceBook: [],
      decks: [{ id: 'd1', name: '日常对话', items: items }],
      best: {}, mastered: {}, deletedItems: {},
      activeDeckId: 'd1',
      progress: { 'd1': { idx: 0, lastAt: Date.now() } },
      stats: { totalRounds: 1, totalAnswered: 1, bySentence: { 'd1#a0': { deckId:'d1', sentence:'hello 0', times:1, okTimes:1, wrongTimes:0, streak:1, maxStreak:1, interval:1, ease:2.5, dueAt: Date.now()-10000, lastAt: Date.now() } }, events: [], daysLog: {} },
      settings: { mode: 'choose', shuffle: false, skipMastered: false, batchSize: 5, fxStack: true, celebrate: 'confetti', autoSpeak: false, sound: false }
    };
    localStorage.setItem('chunklab.v1', JSON.stringify(window.mem));
    location.reload();
  });
  await pa.waitForLoadState('networkidle');
  await pa.waitForSelector('#pageHome', { timeout: 10000 });
  await pa.waitForTimeout(400);
  await pa.evaluate(() => startDeck(window.mem.decks[0], 0));
  await pa.waitForTimeout(500);

  const pr = await snap(pa);
  check('练习页：pagePractice 显示', pr.pagePracticeShown);
  check('练习页：pageHome 隐藏', !pr.pageHomeShown);
  check('★ 练习页：practice-context 视觉可见', !!pr.practiceContext);
  check('练习页：deckName 在 practice-context 内', pr.deckName.inPC);
  check('练习页：mProgress 在 practice-context 内', pr.mProgress.inPC);
  check('练习页：progFill 在 practice-context 内', pr.progFill.inPC);
  check('练习页：deckName 不在 topbar 内', !pr.deckName.inTopbar);
  check('练习页：progFill 不在 topbar 内', !pr.progFill.inTopbar);
  check('练习页：deckName 父链无 hidden（pagePractice 已显示）', !pr.deckName.parentHidden);
  check('★ 练习页：deckName 文本 = "日常对话"（由 S.deck 写入）', pr.deckName.text === '日常对话', pr.deckName.text);
  check('★ 练习页：mProgress 文本 "1/5"（首次进入）', pr.mProgress.text === '1/5', pr.mProgress.text);

  await pa.screenshot({ path: path.join(SHOTS, 'split2-2-practice-context.png'), fullPage: false });

  /* ========== 3. 返回首页 → 视觉再次干净 ========== */
  await pa.evaluate(() => showHomePage());
  await pa.waitForTimeout(400);
  const back = await snap(pa);
  check('回首页：pageHome 再次显示', back.pageHomeShown);
  check('回首页：practice-context 视觉不可见', !back.practiceContext);
  check('回首页：deckName 父链 hidden（视觉隐藏）', back.deckName.parentHidden);
  check('回首页：topbar 视觉 < 80px（与首次首页一致）', back.topbar && back.topbar.h < 80, back.topbar);
  await pa.screenshot({ path: path.join(SHOTS, 'split2-3-back-home.png'), fullPage: false });

  /* ========== 4. 移动端 ========== */
  await ctxA.close();
  const ctxM = await browser.newContext({ viewport: { width: 375, height: 700 }, isMobile: true, hasTouch: true });
  const mp = await ctxM.newPage();
  await mp.goto(BASE + '/main.html', { waitUntil: 'networkidle' });
  await mp.waitForSelector('#pageHome', { timeout: 10000 });
  await mp.waitForTimeout(400);
  const m = await snap(mp);
  check('移动端 首页：practice-context 视觉不可见', !m.practiceContext);
  check('移动端 首页：topbar 视觉 < 100px（窄屏幕 flex-wrap）', m.topbar && m.topbar.h < 100, m.topbar);
  await mp.screenshot({ path: path.join(SHOTS, 'split2-4-mobile.png'), fullPage: false });

  await browser.close();
  console.log('\n  Result:', process.exitCode ? 'FAIL' : 'ALL PASS');
  } finally {
    stopServer();
  }
})().catch(function (e) {
  console.error(e);
  stopServer();
  process.exit(1);
});
