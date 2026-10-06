'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { waitForAsync } = require('./lib/wait-for-async');

(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    await page.goto('about:blank');
    await page.evaluate(() => {window.asyncPollCount = 0;});
    await waitForAsync(page, async () => {
      await Promise.resolve();
      return ++window.asyncPollCount >= 4;
    }, null, {timeout:2000});
    assert.equal(await page.evaluate(() => window.asyncPollCount),4);
    await assert.rejects(waitForAsync(page,async()=>false,null,{timeout:200}),/did not become true/);
    console.log('[wait-for-async] retries resolved false and rejects an unmet condition');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
