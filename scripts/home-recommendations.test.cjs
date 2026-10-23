'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.setContent('<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="pageHome"><main id="home"></main></div><div id="noticeBannerRail"></div></html>');
    await page.addStyleTag({ path: path.join(root, 'assets/learning-workspace.css') });
    await page.addStyleTag({ path: path.join(root, 'assets/content-card.css') });
    await page.addStyleTag({ path: path.join(root, 'assets/home-dashboard.css') });
    for (const file of ['icons.js', 'learning-workspace.js', 'learning-navigation.js', 'content-card.js', 'notice-banner.js', 'course-return.js', 'learning-workspace-view.js']) {
      await page.addScriptTag({ path: path.join(root, 'js', file) });
    }
    await page.evaluate(() => {
      window.openedRecommendations = [];
      window.spokenDailyQuote = [];
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel() {}, speak(utterance) { window.spokenDailyQuote.push(utterance); utterance.onstart?.(); } } });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: class { constructor(text) { this.text = text; } } });
      LearningWorkspaceView.render(document.getElementById('home'), { view: 'home', preferences: {}, activeResources: [], due: 0, status: '' }, {
        navigate() {}, retry() {}, resume() {}, review() {}, open(resource) { window.openedRecommendations.push(resource); }, select() {}
      });
    });
    assert.deepEqual(await page.locator('.home-recommendation-card').evaluateAll(cards => cards.map(card => card.dataset.courseId)), ['builtin:oral', 'builtin:idioms']);
    assert.equal(await page.getByRole('heading', { name: '热门推荐' }).count(), 1);
    assert.equal(await page.getByRole('link', { name: '去发现页看更多' }).getAttribute('href'), 'main.html?view=discover');
    assert.equal(await page.locator('.home-recommendations .workspace-section-heading>a .home-inline-icon svg').count(), 1);
    assert.equal(await page.locator('.home-recommendation-action').count(), 2);
    assert.equal(await page.locator('.home-daily-quote-english').textContent(), 'Small steps every day add up to big changes.');
    assert.equal(await page.locator('.home-daily-quote-translation').textContent(), '每天一小步，积累成大的改变。');
    await page.getByRole('button', { name: '朗读每日一句' }).click();
    assert.deepEqual(await page.evaluate(() => window.spokenDailyQuote.map(item => [item.text, item.lang, item.rate])), [['Small steps every day add up to big changes.', 'en-US', 0.92]]);
    assert.equal(await page.getByRole('button', { name: '正在朗读每日一句，点击停止' }).getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await page.locator('.home-recommendation-action').allTextContents(), ['加入学习', '加入学习']);
    assert.equal(await page.locator('.home-recommendation-title').evaluateAll(rows => rows.every(row => {
      const kind = row.querySelector('.home-content-kind').getBoundingClientRect();
      const title = row.querySelector('h3').getBoundingClientRect();
      return Math.abs((kind.top + kind.bottom) / 2 - (title.top + title.bottom) / 2) < 1 && kind.right <= title.left;
    })), true, 'built-in label and course title share one row');
    await page.locator('.home-recommendation-action').nth(1).click();
    assert.deepEqual(await page.evaluate(() => window.openedRecommendations), [{ courseId: 'builtin:idioms', sourceRefs: [] }]);
    await page.evaluate(() => {
      const area = document.createElement('div');
      area.className = 'workspace-active';
      area.style.cssText = 'position:fixed;left:8px;top:8px;width:400px;z-index:9999';
      area.innerHTML = '<article class="hd-row"></article>';
      document.getElementById('pageHome').append(area);
    });
    for (const selector of ['.workspace-active .hd-row', '.home-recommendation-card']) {
      const card = page.locator(selector).first();
      await card.hover();
      await page.waitForTimeout(220);
      assert.match(await card.evaluate(node => getComputedStyle(node).transform), /matrix\(1, 0, 0, 1, 0, -4\)/, `${selector} floats on hover`);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('.home-recommendation-card').first().hover();
    assert.equal(await page.locator('.home-recommendation-card').first().evaluate(node => getComputedStyle(node).transform), 'none', 'reduced-motion users do not get card movement');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const width of [1280, 700, 390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no horizontal overflow at ${width}px`);
      assert.equal(await page.locator('.home-recommendation-title').evaluateAll(rows => rows.every(row => {
        const title = row.querySelector('h3').getBoundingClientRect();
        const card = row.closest('.home-recommendation-card').getBoundingClientRect();
        return title.right <= card.right - 12;
      })), true, `recommendation titles fit their cards at ${width}px`);
    }
    console.log('Home recommendations: two built-in courses render and fit desktop/mobile viewports.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
