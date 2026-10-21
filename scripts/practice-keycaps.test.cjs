'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const html = fs.readFileSync('main.html', 'utf8');
    const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
    const bar = html.slice(html.indexOf('<div class="stage-tip-bar"'), html.indexOf('<div class="card stage"'));
    for (const dark of [false, true]) {
      await page.setViewportSize({ width: 874, height: 932 });
      await page.setContent('<html class="' + (dark ? 'dark' : '') + '"><style>' + styles + '</style><body>' + bar + '</body></html>');
      const values = await page.locator('.kbd').evaluateAll(es => es.filter(e => e.getBoundingClientRect().height > 0).map(e => {
        const r = e.getBoundingClientRect(), s = getComputedStyle(e);
        return { height: r.height, center: r.y + r.height / 2, font: s.font, padding: s.padding, radius: s.borderRadius, background: s.backgroundColor };
      }));
      assert.ok(values.length >= 4);
      for (const value of values) assert.deepEqual(value, values[0]);
      assert.equal(values[0].height, 18);
    }
    console.log('Practice keycaps: Enter/action styles and vertical alignment match in light/dark themes.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
