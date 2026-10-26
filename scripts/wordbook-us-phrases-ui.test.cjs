'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { createPreviewServer, targetIds } = require('./preview-wordbook-us-phrases.cjs');

(async () => {
  const { server, items } = createPreviewServer();
  const browser = await chromium.launch({ headless: true });
  const screenshotDir = path.resolve(process.argv[2] || 'output/playwright/wordbook-us-phrases-20261026-v3');
  try {
    assert.equal(fs.existsSync(screenshotDir), false, 'review screenshot directory is new');
    fs.mkdirSync(screenshotDir, { recursive: false });
    server.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
    const page = await context.newPage(), errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    await page.goto(`${origin}/wordbook.html?book=${encodeURIComponent('textbook-wordbook:primary-jingtong-grade3-upper-20261014')}`);
    await page.getByRole('button', { name: /^发音口音/ }).waitFor();
    await page.waitForFunction(() => document.querySelector('#bookPosition')?.textContent === '1 / 5');
    assert.equal(requests.some(url => /\.ogg$/.test(url)), false, 'preview does not autoplay audio');
    assert.equal(await page.locator('.listen-word-picture img').count(), 0, 'illustration is not loaded before the learner opens it');
    const target = items[0].exercise.parts.find(part => part.id);
    await page.getByRole('button', { name: target.answers[0] + '，查看图片和释义', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.listen-word-picture img')?.naturalWidth > 0);
    assert.equal(requests.includes('/' + items[0].images.wide[0]), true, 'the current illustration loads on demand');

    const allExpected = [
      ['/ˌɡʊd ˈmɔːrnɪŋ/', '/ˌɡʊd ˈmɔːnɪŋ/'],
      ['/ˌɡʊd ˌæftɚˈnuːn/', '/ˌɡʊd ˌɑːftəˈnuːn/'],
      ['/ˌɡʊd ˈiːvnɪŋ/', '/ˌɡʊd ˈiːvnɪŋ/'],
      ['/ˌɡʊd ˈnaɪt/', '/ˌɡʊd ˈnaɪt/'],
      ['/ˈθæŋk ˌjuː/', '/θæŋk juː/']
    ];
    for (let index = 0; index < targetIds.length; index++) {
      const ipa = page.locator('.listen-word-pronunciation'), accent = page.getByRole('button', { name: /^发音口音/ });
      assert.equal(await ipa.textContent(), allExpected[index][0], `${items[index].word} shows the planned US transcription`);
      await page.screenshot({ path: path.join(screenshotDir, `desktop-${index + 1}.png`) });
      await accent.click();
      assert.equal(await ipa.textContent(), allExpected[index][1], `${items[index].word} preserves the British source transcription`);
      await accent.click();
      const usClip = items[index].learning.sentenceAudio.audio;
      const usRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/' + usClip.url);
      await page.getByRole('button', { name: '重播整句', exact: true }).click();
      await usRequest;
      await accent.click();
      const gbClip = items[index].learning.sentenceAudio.audioByAccent['en-GB'];
      const gbRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/' + gbClip.url);
      await page.getByRole('button', { name: '重播整句', exact: true }).click();
      await gbRequest;
      await accent.click();
      if (index < targetIds.length - 1) await page.getByRole('button', { name: '下一词', exact: true }).click();
      else assert.equal(await page.locator('#bookPosition').textContent(), '5 / 5');
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: '← 上一词', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#bookPosition')?.textContent === '4 / 5');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile preview has no horizontal overflow');
    await page.screenshot({ path: path.join(screenshotDir, 'mobile.png') });

    const missing = structuredClone(items[0]);
    delete missing.phonetics['en-US'];
    delete missing.learning.sentenceAudio.audio;
    const view = await page.evaluate(item => {
      const created = VocabularyListenWordView.create(item, { autoplay: false });
      document.body.append(created.element);
      return true;
    }, missing);
    assert.equal(view, true);
    const previews = page.locator('.listen-word-view').last();
    assert.equal(await previews.locator('.listen-word-pronunciation').textContent(), '美式音标待补充');
    await previews.getByRole('button', { name: '重播整句', exact: true }).click();
    assert.match(await previews.locator('.listen-word-audio-status').textContent(), /暂无美式音频/);
    await previews.getByRole('button', { name: /^发音口音/ }).click();
    assert.equal(await previews.locator('.listen-word-pronunciation').textContent(), items[0].phonetics['en-GB']);
    assert.equal(await page.evaluate(() => window.__phrasePreviewWrites), 0, 'preview adapter accepted zero persistence writes');
    assert.equal(requests.some(url => url.startsWith('/api/')), false, 'browser made no account or persistence API requests');
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`US phrase preview: ${targetIds.length} entries, accent-specific display/playback, missing-US behavior, isolated runtime and 390/1024px layouts passed. Screenshots: ${screenshotDir}`);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
