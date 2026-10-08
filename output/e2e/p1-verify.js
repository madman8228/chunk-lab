/* 一次性验证：P1 改造后课程卡 meta/进度渲染（多课节 vs 单课节两形态） */
const fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = process.cwd();
const PORT = 9620 + Math.floor(Math.random() * 40);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-p1-'));
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
  await p.waitForTimeout(2000);

  const info = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('.course-card').forEach(card => {
      const label = card.querySelector('.deck-cover-label');
      const meta = card.querySelector('.meta');
      const count = card.querySelector('.course-progress-count');
      const fill = card.querySelector('.course-progress-fill');
      const prog = card.querySelector('[data-course-progress]');
      out.push({
        title: label ? label.textContent : null,
        metaHead: meta ? meta.textContent.trim().split('\n')[0].slice(0, 40) : null,
        countText: count ? count.textContent : null,
        fillWidth: fill ? fill.style.width : null,
        tooltip: prog ? prog.getAttribute('aria-label') : null
      });
    });
    return out;
  });
  console.log(JSON.stringify(info, null, 1));

  await p.screenshot({ path: path.join(ROOT, 'output', 'e2e', 'shots', 'p1-meta-after.png') });
  await browser.close();
  server.kill('SIGKILL');
})().catch(e => { console.error(e); server.kill('SIGKILL'); process.exit(1); });
