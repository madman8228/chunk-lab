/* 一次性 UI 探针：提取 decks.html 课程卡片的真实 DOM 文本/结构，核实截图疑点 */
const fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = process.cwd();
const PORT = 9520 + Math.floor(Math.random() * 40);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-ui-'));
const CHROME = 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1169/chrome-win/headless_shell.exe';

const server = spawn(process.execPath, ['index.js'], {
  cwd: path.join(ROOT, 'server'),
  env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT) }),
  stdio: 'ignore'
});

(async () => {
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 300));
    try {
      const http = require('http');
      const ok = await new Promise(res => {
        const q = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, r2 => { res(r2.statusCode === 200); q.destroy(); });
        q.on('error', () => res(false)); q.setTimeout(400, () => { q.destroy(); res(false); });
      });
      if (ok) break;
    } catch (e) {}
  }
  const browser = await chromium.launch({ executablePath: CHROME });
  const c = await browser.newContext({ viewport: { width: 1104, height: 586 } });
  const p = await c.newPage();
  p.on('pageerror', e => console.log('PAGEERR:', e.message));
  await p.goto('http://127.0.0.1:' + PORT + '/decks.html', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.course-card', { timeout: 15000 });
  await p.waitForTimeout(1500);

  const info = await p.evaluate(() => {
    const out = { cards: [], sectionTitles: [], tabs: null, header: null };
    // 顶部 tab
    const t1 = document.getElementById('tabDecks'), t2 = document.getElementById('tabCourses');
    out.tabs = { decks: t1 && t1.textContent.trim(), courses: t2 && t2.textContent.trim() };
    // 分节标题
    document.querySelectorAll('h2, h3, .section-title, [class*="section"]').forEach(el => {
      const t = el.textContent.trim();
      if (t && t.length < 40 && /门|课程/.test(t)) out.sectionTitles.push({ cls: el.className, text: t });
    });
    // 课程卡
    document.querySelectorAll('.course-card').forEach(card => {
      const meta = card.querySelector('.meta');
      const label = card.querySelector('.deck-cover-label');
      const mark = card.querySelector('.deck-cover-mark');
      const coverImg = card.querySelector('.deck-cover-image');
      out.cards.push({
        title: label ? label.textContent : null,
        markHtml: mark ? mark.innerHTML.slice(0, 120) : null,
        markBox: mark ? mark.getBoundingClientRect().width + 'x' + mark.getBoundingClientRect().height : null,
        svgInMark: mark ? !!mark.querySelector('svg') : null,
        metaText: meta ? meta.textContent.trim() : null,
        metaHTML: meta ? meta.innerHTML.slice(0, 300) : null,
        hasCoverImg: !!coverImg,
        coverSrc: coverImg ? coverImg.getAttribute('src') : null,
        coverImgLoaded: coverImg ? coverImg.complete && coverImg.naturalWidth > 0 : null
      });
    });
    return out;
  });
  console.log(JSON.stringify(info, null, 1));

  await p.screenshot({ path: path.join(ROOT, 'output', 'e2e', 'shots', 'ui-review-decks-full.png'), fullPage: true });
  await browser.close();
  server.kill('SIGKILL');
})().catch(e => { console.error(e); server.kill('SIGKILL'); process.exit(1); });
