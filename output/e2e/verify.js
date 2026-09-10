/**
 * e2e-verify.js · 浏览器端到端验收（Playwright-core）
 * 截取：桌面练习页 / AI 解读弹窗 / 题库管理 / 移动端练习页 / 移动端 AI 弹窗
 * 运行：NODE_PATH=<workspace>/node_modules node output/e2e/verify.js
 *
 * 注：入口必须带 ?direct=1 —— main.html 默认落「今日首页」，不带则练习区不渲染，
 *     截出来的图是首页而不是练习页（本脚本是截图冒烟，没有硬断言，容易被这种静默漂移骗过）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:8890';
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
  });
  const logs = [];

  /* ---- 桌面 1280x800 ---- */
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') logs.push('[console.error] ' + m.text()); });
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message));

  await page.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#track, #stageChoices', { timeout: 12000 }).catch(() => logs.push('[warn] 练习区未在 12s 内出现'));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, 'desktop-practice.png') });

  // AI 解读弹窗（无 API Key → 本地兜底解读路径）
  await page.click('#btnAIExplain').catch(e => logs.push('[warn] 点击 AI 解读失败: ' + e.message));
  await page.waitForSelector('#aiMask:not([hidden])', { timeout: 4000 }).catch(() => logs.push('[warn] AI 弹窗未出现'));
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, 'desktop-ai-explain.png') });
  await page.keyboard.press('Escape').catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});

  // 题库管理（iframe 子页）
  await page.click('#btnDecks').catch(e => logs.push('[warn] 点击题库失败: ' + e.message));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'desktop-decks.png') });
  await ctx.close();

  /* ---- 移动端 390x844 ---- */
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mp = await mctx.newPage();
  mp.on('pageerror', e => logs.push('[m-pageerror] ' + e.message));
  await mp.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
  await mp.waitForSelector('#track, #stageChoices', { timeout: 12000 }).catch(() => logs.push('[warn] 移动端练习区未出现'));
  await mp.waitForTimeout(1000);
  await mp.screenshot({ path: path.join(OUT, 'mobile-practice.png') });

  await mp.click('#btnAIExplain').catch(e => logs.push('[warn] 移动端 AI 点击失败: ' + e.message));
  await mp.waitForSelector('#aiMask:not([hidden])', { timeout: 4000 }).catch(() => logs.push('[warn] 移动端 AI 弹窗未出现'));
  await mp.waitForTimeout(700);
  await mp.screenshot({ path: path.join(OUT, 'mobile-ai-explain.png') });
  await mctx.close();

  await browser.close();
  console.log('E2E DONE');
  logs.forEach(l => console.log(l));
  process.exit(logs.some(l => l.startsWith('[pageerror]')) ? 1 : 0);
})().catch(e => { console.error('E2E FAIL: ' + (e && e.stack || e)); process.exit(1); });
