/**
 * stale-fix-verify.js · 验证"v7 加载中"修复：#zh 应渲染真实中文（非占位）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:8898';
const OUT = path.join(__dirname, 'shots');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe'
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
  /* 必须带 ?direct=1：#zh 属于练习页；默认入口是今日首页，不带则练习区不渲染、#zh 永远停在占位 */
  await page.goto(BASE + '/main.html?direct=1', { waitUntil: 'domcontentloaded' });
  // 等 init 段完成（zh 不再是占位）
  try {
    await page.waitForFunction(function () {
      var z = document.getElementById('zh');
      return z && z.textContent && z.textContent.indexOf('加载中') < 0 && z.textContent.indexOf('v7') < 0;
    }, { timeout: 8000 });
  } catch (e) { logs.push('[warn] 8s 内 #zh 未替换为真实句子'); }
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, 'stale-fix.png') });
  const zh = await page.evaluate(function () {
    var z = document.getElementById('zh');
    return z ? z.textContent : null;
  });
  console.log('#zh text =', JSON.stringify(zh));
  const ok = zh && zh.indexOf('加载中') < 0 && zh.indexOf('v7') < 0;
  console.log(ok ? 'OK 占位已替换为真实句子' : 'FAIL 仍显示占位');
  logs.forEach(l => console.log(l));
  await browser.close();
  process.exit(ok && !logs.some(l => l.startsWith('[pageerror]')) ? 0 : 1);
})().catch(e => { console.error('FAIL: ' + e.stack); process.exit(1); });