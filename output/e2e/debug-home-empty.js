/* debug verify-home failure: 空档案场景 */
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('   [pageerror]', String(e)));
  p.on('console', m => { if(m.type()==='error') console.log('   [console.error]', m.text()); });
  await p.goto('http://localhost:8896/main.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  const state = await p.evaluate(() => ({
    pageHomeHidden: document.querySelector('#pageHome').classList.contains('hidden'),
    pagePracticeHidden: document.querySelector('#pagePractice').classList.contains('hidden'),
    pageHomeVisible: document.querySelector('#pageHome').offsetWidth > 0,
    homeEmpty: document.querySelector('.home-empty') ? { exists: true, vis: getComputedStyle(document.querySelector('.home-empty')).display !== 'none' } : null,
    homeGoDecks: document.querySelector('#homeGoDecks') ? { exists: true, vis: getComputedStyle(document.querySelector('#homeGoDecks')).display !== 'none' } : null,
    homeEmptyText: (document.querySelector('.home-empty .t') || {}).textContent || '',
    memHasDecks: window.mem ? window.mem.decks : 'no-mem',
    bodyClass: document.body.className,
    localStorage: localStorage.getItem('chunklab.v1') ? 'has-data' : 'empty'
  }));
  console.log('STATE:', JSON.stringify(state, null, 2));
  await b.close();
})();
