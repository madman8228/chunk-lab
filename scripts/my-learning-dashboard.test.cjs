'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.setContent('<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><div class="wrap"><header class="topbar" style="display:none"><div class="topbar-row"><div id="workspaceNavHost"></div></div></header><div id="noticeBannerRail"></div><main id="pageMyLearning"><div id="myLearningBody"></div></main></div></html>');
    for (const file of ['learning-workspace.css', 'content-card.css', 'home-dashboard.css']) await page.addStyleTag({ path: path.join(root, 'assets', file) });
    for (const file of ['icons.js', 'learning-workspace.js', 'learning-navigation.js', 'content-card.js', 'notice-banner.js', 'course-return.js', 'learning-workspace-view.js']) await page.addScriptTag({ path: path.join(root, 'js', file) });
    await page.evaluate(() => {
      const resource = { resourceId: 'course:oral', courseId: 'builtin:oral', title: '口语3000句', description: '从生活场景继续练习。', available: true, visibility: 'public', activities: ['chunks'], sourceRefs: [{ type: 'sentence-deck', id: 'deck1' }] };
      const course = { id: 'builtin:oral', title: resource.title };
      window.dashboardActions = { opened: [], resumed: 0, filters: [], navigate() {}, filter(patch) { this.filters.push(patch); }, select() {}, open(item) { this.opened.push(item); }, resume() { this.resumed += 1; }, review() {}, leave() {}, retry() {} };
      LearningWorkspaceView.render(document.getElementById('myLearningBody'), {
        view: 'my-learning', resources: [resource], preferences: {}, aliases: {}, memberships: { 'builtin:oral': { joined: true } },
        courseRows: [{ course, resource, lessons: [{ contentRef: { type: 'sentence-deck', id: 'deck1' } }], completionState: 'in-progress', title: resource.title, progress: '已学 1 / 5 课节', coverMarkup: '<span class="hc-course-cover"><img src="assets/covers/oral-3000.webp" alt=""></span>' }],
        resume: { toolId: 'chunks', title: '从起床到出门', deck: { id: 'deck1' }, idx: 0 }, due: 5, wrong: 0,
        homeActivity: { streak: 4 }, status: '', courseCompletion: {}, completionReadFailed: false, catalog: { courses: [] }
      }, window.dashboardActions);
    });

    assert.equal(await page.getByRole('heading', { name: '早上好，继续前进' }).count(), 1);
    assert.equal(await page.locator('.my-learning-course').count(), 1);
    assert.equal(await page.getByRole('heading', { name: '我的词单' }).count(), 1);
    assert.equal(await page.getByRole('heading', { name: '句子跟读' }).count(), 1);
    assert.equal(await page.getByRole('heading', { name: '我的收藏' }).count(), 1);
    assert.equal(await page.getByRole('link', { name: '去发现词单' }).getAttribute('href'), 'main.html?view=discover&kind=wordbook');
    assert.equal(await page.locator('.my-learning-course-cover img').evaluate(image => getComputedStyle(image).position), 'absolute');
    await page.getByRole('button', { name: '继续学习', exact: true }).first().click();
    assert.equal(await page.evaluate(() => dashboardActions.resumed), 1);
    await page.locator('.my-learning-management > summary').click();
    assert.equal(await page.locator('.my-learning-management[open] .library-panel').count(), 1);

    const desktop = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, columns: getComputedStyle(document.querySelector('.my-learning-course-grid')).gridTemplateColumns, offenders: [...document.querySelectorAll('body *')].filter(node => node.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(node => [node.tagName, node.className, node.textContent.slice(0,24), Math.round(node.getBoundingClientRect().left), Math.round(node.getBoundingClientRect().right)]) }));
    assert.ok(desktop.width <= desktop.viewport, `desktop overflows: ${JSON.stringify(desktop)}`);
    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, columns: getComputedStyle(document.querySelector('.my-learning-course-grid')).gridTemplateColumns }));
    assert.ok(mobile.width <= mobile.viewport, `mobile overflows: ${JSON.stringify(mobile)}`);
    assert.equal(mobile.columns.split(' ').length, 1, 'mobile course list uses one readable column');
    console.log('My-learning dashboard: content, resume action, management and responsive layouts pass.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
