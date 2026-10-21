'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const ROOT = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-membership-admin-'));
  const appRoot = path.join(temp, 'app'), dataRoot = path.join(temp, 'data');
  const privateRoot = path.join(dataRoot, 'membership-content');
  let child, browser, log = '';
  try {
    fs.mkdirSync(path.join(appRoot, 'js'), { recursive: true });
    fs.mkdirSync(path.join(appRoot, 'content'), { recursive: true });
    fs.mkdirSync(path.join(appRoot, 'assets'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'assets/content-studio.css'), path.join(appRoot, 'assets/content-studio.css'));
    const legacyFixture=require('./lib/legacy-course-fixture')(appRoot);
    fs.mkdirSync(privateRoot, { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'admin-membership.html'), path.join(appRoot, 'admin-membership.html'));
    fs.copyFileSync(path.join(ROOT, 'js/membership.js'), path.join(appRoot, 'js/membership.js'));
    for (const relative of ['content-studio.html', 'content-studio.js', 'js/learning-workspace.js', 'js/library-metadata-editor.js']) fs.copyFileSync(path.join(ROOT, relative), path.join(appRoot, relative));
    fs.writeFileSync(path.join(privateRoot, 'lesson.json'), JSON.stringify({ items: [{ cid: 'test-item', sentence: 'Synthetic lesson.', translation: '合成课程。' }] }));
    fs.writeFileSync(path.join(privateRoot, 'registry.json'), JSON.stringify({ schemaVersion: 1, courses: [
      { courseId: 'test-platform-course', title: '合成平台课程', contentType: 'sentence', defaultAccess: 'free',
        sourcePaths: [], legacyDeckIds: [], units: [{ unitId: 'lesson', file: 'lesson.json',
          contentRef: { type: 'sentence-deck', id: 'synthetic' }, itemIds: ['test-item'], assets: [] }] }
    ] }));
    const probe = net.createServer();
    await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    const base = 'http://127.0.0.1:' + port;
    child = spawn(process.execPath, [path.join(ROOT, 'server/index.js')], {
      cwd: ROOT, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test', REQUIRE_AUTH: 'true', PHONE_AUTH_ENABLED: 'false',
        CHUNKLAB_DATA_DIR: dataRoot, CHUNKLAB_APP_ROOT: appRoot, HOST: '127.0.0.1', PORT: String(port),
        JWT_SECRET: crypto.randomBytes(40).toString('hex'), ADMIN_JWT_SECRET: crypto.randomBytes(40).toString('hex'),
        ADMIN_PASSWORD: 'SyntheticAdmin2026!', MEMBERSHIP_CODE_HMAC_CURRENT: 'fixture-v1',
        MEMBERSHIP_CODE_HMAC_KEYS: JSON.stringify({ 'fixture-v1': crypto.randomBytes(32).toString('base64') }) }
    });
    child.stdout.on('data', bytes => { log += bytes; });
    child.stderr.on('data', bytes => { log += bytes; });
    const deadline = Date.now() + 15000;
    while (!log.includes('listening on http://127.0.0.1:' + port)) {
      if (child.exitCode !== null || Date.now() > deadline) throw new Error('Isolated server failed: ' + log.slice(-1000));
      await delay(50);
    }
    assert.ok(child.pid && child.exitCode === null);
    const login = await fetch(base + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'SyntheticAdmin2026!' }) });
    const token = (await login.json()).token;
    assert.ok(token);
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    await context.addInitScript(value => localStorage.setItem('chunklab_admin_token', value), token);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/admin-membership.html');
    const legacyRow=page.locator('[data-course-id="legacy-course"]');
    await legacyRow.waitFor();
    assert.equal(await legacyRow.locator('option[value="member"]').isDisabled(),true);
    const reviewResponse=page.waitForResponse(response=>response.url().endsWith('/api/admin/membership/course-source-review'));
    await legacyRow.getByRole('button',{name:'检查 合成原课程 的来源',exact:true}).click();
    assert.equal((await reviewResponse).headers()['cache-control'],'private, no-store');
    const review=page.getByRole('region',{name:'课程来源检查报告'});
    await review.getByText('合成原课程 · 来源检查报告',{exact:true}).waitFor();
    assert.match(await review.textContent(),/2 项内容/);
    assert.ok(!(await review.textContent()).includes(legacyFixture.items[0].sentence));
    const reviewShots=path.join(ROOT,'output/playwright/membership');fs.mkdirSync(reviewShots,{recursive:true});
    await page.locator('#courseAccessPanel').screenshot({path:path.join(reviewShots,'source-review-desktop.png')});
    await page.setViewportSize({width:375,height:812});
    await review.getByText('查看来源文件',{exact:false}).click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.locator('#courseAccessPanel').screenshot({path:path.join(reviewShots,'source-review-mobile.png')});
    await page.setViewportSize({width:1280,height:900});
    assert.equal(await legacyRow.locator('option[value="member"]').isDisabled(),true,'read-only review cannot activate membership');
    assert.equal((await fetch(base+'/api/admin/membership/course-source-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({courseIds:['legacy-course']})})).status,401);
    await page.locator('[data-course-id="test-platform-course"]').waitFor({ timeout: 10000 }).catch(async error => {
      throw new Error(error.message + '\nPage: ' + (await page.locator('body').innerText()) + '\nErrors: ' + errors.join(';'));
    });
    const select = page.locator('[data-course-id="test-platform-course"] select');
    const publish = page.locator('[data-policy-publish]');
    assert.equal(await select.inputValue(), 'free');
    assert.equal(await publish.isDisabled(), true);
    await page.locator('#trialDays').fill('5');
    await page.locator('#dailyMinutes').fill('45');
    await page.locator('#saveSettings').click();
    await page.waitForFunction(() => document.querySelector('#settingsStatus').textContent === '已保存');
    await page.locator('#loadGrants').click();
    await page.waitForFunction(() => document.querySelector('#grantStatus').textContent.includes('有效用户编号'));
    await select.selectOption('member');
    await page.route('**/api/admin/membership/course-access/preview', async route => { await delay(350); await route.continue(); });
    await page.locator('[data-policy-preview]').click();
    assert.equal(await select.isDisabled(), true, 'selection locked while preview is pending');
    assert.equal(await page.locator('[data-policy-refresh]').isDisabled(), true);
    await page.waitForFunction(() => !document.querySelector('[data-policy-publish]').disabled);
    await select.selectOption('free');
    assert.equal(await publish.isDisabled(), true, 'editing invalidates checked changes');
    await select.selectOption('member');
    await page.locator('[data-policy-preview]').click();
    await page.waitForFunction(() => !document.querySelector('[data-policy-publish]').disabled);
    await publish.click();
    await page.waitForFunction(() => document.querySelector('[data-policy-status]').textContent === '课程访问级别已更新。');
    assert.equal(await select.inputValue(), 'member');
    assert.equal(await publish.isDisabled(), true);
    const protectedRead = await fetch(base + '/api/course-content/test-platform-course/units/lesson');
    assert.equal(protectedRead.status, 401);
    await page.locator('#quantity').fill('2');
    const downloadReady = page.waitForEvent('download');
    await page.locator('#issue').click();
    const download = await downloadReady;
    const csv = fs.readFileSync(await download.path(), 'utf8');
    assert.ok(csv.replaceAll('"', '').includes('batch_id,code_id,plan_key,term_months,redeem_by,code'));
    assert.equal(csv.trim().split(/\r?\n/).length, 3);
    await page.locator('#batches [data-action="activate"]').waitFor();
    assert.ok((await page.locator('#batches').textContent()).includes('已暂停'));
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#batches [data-action="activate"]').click();
    await page.locator('#batches [data-action="pause"]').waitFor();
    await page.reload();
    await page.locator('[data-course-id="test-platform-course"]').waitFor();
    assert.equal(await select.inputValue(), 'member');
    assert.equal(await page.locator('#trialDays').inputValue(), '5');
    assert.equal(await page.locator('#dailyMinutes').inputValue(), '45');
    await page.setViewportSize({ width: 375, height: 812 });
    const widths = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert.ok(widths.content <= widths.viewport, 'tables scroll inside their panels on mobile');
    await page.goto(base + '/content-studio.html');
    await page.locator('#protectedPublicationOpen').click();
    const publishing = page.locator('#protectedPublicationPanel');
    const { DRAFT_SPEC } = await import('../src/course-authoring/draft-spec.mjs');
    await publishing.getByLabel('课程 JSON', { exact: true }).setInputFiles({ name: 'course.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(DRAFT_SPEC.examples.at(-1))) });
    await publishing.getByRole('button', { name: '校验并预览', exact: true }).click();
    await publishing.getByText('校验通过，请审阅内容与提醒，再确认发布。', { exact: false }).waitFor();
    assert.equal(await publishing.getByLabel('我已审阅校验提醒').isVisible(),false,'no empty warning confirmation');
    assert.equal(await page.locator('#publish').isVisible(),false,'legacy publish action is hidden while publishing a new course');
    const screenshots=path.join(ROOT,'output/playwright/membership');fs.mkdirSync(screenshots,{recursive:true});
    await page.screenshot({path:path.join(screenshots,'publication-mobile.png'),fullPage:true});
    await page.setViewportSize({width:1280,height:900});
    await page.screenshot({path:path.join(screenshots,'publication-desktop.png'),fullPage:true});
    await page.setViewportSize({width:375,height:812});
    const stagedId = await publishing.getByLabel('最近的发布草稿').inputValue();
    await page.reload(); await page.locator('#protectedPublicationOpen').click();
    await publishing.getByLabel('最近的发布草稿').selectOption(stagedId);
    await publishing.getByRole('button', { name: '恢复选中草稿', exact: true }).click();
    await publishing.getByText('校验通过，请审阅内容与提醒，再确认发布。', { exact: false }).waitFor();
    await publishing.getByLabel('访问级别', { exact: true }).selectOption('member');
    await publishing.getByRole('button', { name: '确认发布为新课程', exact: true }).click();
    const publishedLink = publishing.getByRole('link', { name: '打开已发布课程', exact: true });
    await publishedLink.waitFor();
    const publishedId = new URL(await publishedLink.getAttribute('href'), base).searchParams.get('protectedCourse');
    assert.equal((await fetch(base + '/api/course-content/' + publishedId + '/units/lesson-1')).status, 410, 'retired unscoped content URL cannot bypass fragment grants');
    const { IMAGE_TEXT_DRAFT_EXAMPLE } = await import('../src/course-authoring/image-text-draft-spec.mjs');
    const encoded = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
      return Object.fromEntries(['image/png', 'image/jpeg', 'image/webp'].map(type => [type, canvas.toDataURL(type).split(',')[1]])); });
    for (const [mimeType, extension] of [['image/png', 'png'], ['image/jpeg', 'jpg'], ['image/webp', 'webp']]) {
      const imageDraft = JSON.parse(JSON.stringify(IMAGE_TEXT_DRAFT_EXAMPLE)); imageDraft.images[0].fileName = 'cafe-counter.' + extension;
      const response = await fetch(base + '/api/admin/membership/course-publications/prepare', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: imageDraft, images: [{ name: imageDraft.images[0].fileName, mimeType, base64: encoded[mimeType] }], requestId: crypto.randomUUID() }) });
      assert.equal(response.status, 200, mimeType + ' server image inspection');
    }
    await publishing.getByLabel('课程 JSON', { exact: true }).setInputFiles({ name: 'image-course.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(IMAGE_TEXT_DRAFT_EXAMPLE)) });
    await publishing.getByLabel('图文课的原始配图', { exact: false }).setInputFiles({ name: 'cafe-counter.png', mimeType: 'image/png', buffer: Buffer.from(encoded['image/png'], 'base64') });
    await publishing.getByRole('button', { name: '校验并预览', exact: true }).click();
    await publishing.getByText('校验通过，请审阅内容与提醒，再确认发布。', { exact: false }).waitFor();
    await publishing.getByLabel('访问级别', { exact: true }).selectOption('free');
    await publishing.getByRole('button', { name: '确认发布为新课程', exact: true }).click();
    await publishedLink.waitFor();
    const publicImageId = new URL(await publishedLink.getAttribute('href'), base).searchParams.get('protectedCourse');
    assert.equal((await fetch(base + '/api/course-content/' + publicImageId + '/units/lesson-1')).status, 410);
    const publicCatalog=await (await fetch(base+'/api/course-content/catalog')).json();
    assert.equal(publicCatalog.courses.find(course=>course.courseId===publicImageId).accessLevel,'free');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'publishing fits mobile width');
    assert.deepEqual(errors, [], 'no uncaught page errors');
    console.log('isolated admin browser: settings, CSV, activation, preview locks, publishing, reload, mobile passed');
  } finally {
    if (browser) await browser.close();
    if (child && child.exitCode === null) { child.kill(); await new Promise(resolve => child.once('exit', resolve)); }
    assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
