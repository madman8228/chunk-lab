/* 临时诊断：打开 main.html 捕获启动期 pageerror / console.error，定位 pageHome 为何保持 hidden */
'use strict';
const { chromium } = require('playwright-core');

(async function () {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', function (e) { errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')); });
  page.on('console', function (m) { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

  await page.goto('http://127.0.0.1:8790/main.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const st = await page.evaluate(function () {
    var h = document.getElementById('pageHome');
    var zh = document.getElementById('zh');
    return {
      homeClass: h ? h.className : 'NO #pageHome',
      homeHTMLlen: h ? h.innerHTML.length : -1,
      zhText: zh ? zh.textContent.slice(0, 120) : 'NO #zh',
      memType: typeof window.mem,
      iconsType: typeof window.Icons,
      bootErr: window.__bootErr || null,
    };
  });

  console.log('=== 状态 ===');
  console.log(JSON.stringify(st, null, 1));
  console.log('=== 错误 (' + errs.length + ') ===');
  errs.slice(0, 8).forEach(function (e) { console.log(e); });

  await browser.close();
})();
