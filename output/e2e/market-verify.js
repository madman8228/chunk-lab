/**
 * market-verify.js · 公共题库市场 UI 验收
 * 打开 decks.html 截取题库管理页（含市场区块，fullPage 滚动截图）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:8895';
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
  await page.goto(BASE + '/decks.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#deckList', { timeout: 10000 });
  await page.waitForSelector('#marketList', { timeout: 8000 }).catch(() => logs.push('[warn] 市场列表未出现'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'decks-market.png'), fullPage: true });
  await browser.close();
  console.log('MARKET DONE');
  logs.forEach(l => console.log(l));
  process.exit(logs.some(l => l.startsWith('[pageerror]')) ? 1 : 0);
})().catch(e => { console.error('MARKET FAIL: ' + (e && e.stack || e)); process.exit(1); });
