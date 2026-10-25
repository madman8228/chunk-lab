'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');

function wave() {
  const rate = 8000, samples = rate / 5, bytes = Buffer.alloc(44 + samples * 2);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVE', 8); bytes.write('fmt ', 12);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22); bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(samples * 2, 40);
  return bytes;
}

async function waitFor(base, child, logs) {
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error('isolated server exited: ' + logs());
    try { if ((await fetch(base + '/api/health')).ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('isolated server timed out: ' + logs());
}

test('zero-English tracks publish into isolated catalog and launch through discover', { timeout: 120000 }, async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'beginner-multitrack-'));
  assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep));
  const screenshotDir = fs.mkdtempSync(path.join(root, 'output/zero-english-multitrack-20261024-'));
  const port = require('./lib/free-port').freePort(19300, 100), base = `http://127.0.0.1:${port}`;
  const appRoot = path.join(temp, 'app'); fs.mkdirSync(path.join(appRoot, 'content'), { recursive: true });
  fs.copyFileSync(path.join(root, 'content/manifest.json'), path.join(appRoot, 'content/manifest.json'));
  require('./lib/prepare-ui-root')(appRoot);
  const env = { ...process.env, NODE_ENV: 'test', HOST: '127.0.0.1', PORT: String(port), CHUNKLAB_DATA_DIR: path.join(temp, 'data'),
    CHUNKLAB_APP_ROOT: appRoot, EXPRESSION_COURSES_ENABLED: 'true', REQUIRE_AUTH: 'true', PHONE_AUTH_ENABLED: 'false',
    JWT_SECRET: crypto.randomBytes(40).toString('hex'), ADMIN_PASSWORD: 'isolated-beginner-admin-pass',
    ADMIN_JWT_SECRET: crypto.randomBytes(40).toString('hex'), MEMBERSHIP_CONTENT_GRANT_KEY: crypto.randomBytes(32).toString('base64') };
  let server, browser, logs = '';
  const append = chunk => { logs += chunk.toString(); };
  try {
    server = spawn(process.execPath, ['index.js'], { cwd: path.join(root, 'server'), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', append); server.stderr.on('data', append);
    await waitFor(base, server, () => logs);
    const login = await fetch(base + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: env.ADMIN_PASSWORD }) });
    assert.equal(login.status, 200); const admin = await login.json(), tone = wave();
    const draftFiles = ['sentence-building', 'pronunciation', 'phonics'].map(track => path.join(root, 'drafts/zero-english/multi-track-v1', track, 'course-package.json'));
    const publishedIds = [];
    for (const [index, file] of draftFiles.entries()) {
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const asset of pkg.assets) {
        const uploaded = await fetch(base + '/api/admin/expression-assets', { method: 'POST', headers: { authorization: 'Bearer ' + admin.token, 'content-type': 'application/json' },
          body: JSON.stringify({ assetId: asset.assetId, mimeType: 'audio/wav', base64: tone.toString('base64') }) });
        assert.equal(uploaded.status, 201); const receipt = await uploaded.json(); asset.mimeType = 'audio/wav'; asset.sha256 = receipt.sha256; asset.size = receipt.size;
        for (const lesson of pkg.lessons) for (const audio of lesson.audioAssets) if (audio.assetId === asset.assetId) { audio.status = 'ready'; audio.path = asset.localFile; }
      }
      const created = await fetch(base + '/api/admin/expression-drafts', { method: 'POST', headers: { authorization: 'Bearer ' + admin.token, 'content-type': 'application/json' },
        body: JSON.stringify({ requestId: `beginner-draft-${index}-01`, package: pkg }) });
      assert.equal(created.status, 201); const draft = await created.json();
      const checked = await fetch(`${base}/api/admin/expression-drafts/${draft.draftId}/validate`, { method: 'POST', headers: { authorization: 'Bearer ' + admin.token } });
      assert.equal(checked.status, 200); const validation = await checked.json(); assert.equal(validation.valid, true, validation.errors?.join('\n'));
      const reviewed = await fetch(`${base}/api/admin/expression-drafts/${draft.draftId}/review`, { method: 'POST', headers: { authorization: 'Bearer ' + admin.token, 'content-type': 'application/json' }, body: JSON.stringify({ contentHash: validation.contentHash }) });
      assert.equal(reviewed.status, 200);
      const released = await fetch(`${base}/api/admin/expression-drafts/${draft.draftId}/publish`, { method: 'POST', headers: { authorization: 'Bearer ' + admin.token, 'content-type': 'application/json' },
        body: JSON.stringify({ expectedRevision: 1, contentHash: validation.contentHash, requestId: `beginner-release-${index}-01` }) });
      assert.equal(released.status, 200); publishedIds.push(pkg.courseId);
    }
    const registered = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'beginner-e2e-learner', password: 'beginner-test-password' }) });
    assert.equal(registered.status, 200); const learner = await registered.json();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 360, height: 844 } });
    await context.addInitScript(token => { if (!localStorage.getItem('chunklab.session.v1')) localStorage.setItem('chunklab_token', token); }, learner.token);
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    for (const [track, courseId] of [['sentence-building', publishedIds[0]], ['pronunciation', publishedIds[1]], ['phonics', publishedIds[2]]]) {
      await page.goto(`${base}/main.html?view=discover&category=beginner&track=${track}&stage=S0`);
      const card = page.locator(`#discoverBody .workspace-card[data-resource="course:${courseId}"]`);
      await card.waitFor({ state: 'attached', timeout: 20000 });
      assert.equal(await page.locator('#discoverBody .workspace-card[data-resource^="course:"]').count(), 1, 'the route filter shows only its matching published course');
      await card.locator('.content-card-title').click(); await page.waitForURL(/expression-learn\.html\?course=/);
      await page.getByRole('button', { name: /开始学习|继续学习/ }).click();
      await page.locator('#progressLabel').waitFor();
      assert.equal(await page.locator('#progressLabel').textContent(), '第 1 步');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, '360px layout has no horizontal overflow');
      if (track === 'pronunciation') assert.match(await page.locator('#activityBody').innerText(), /字母 M 的名称/);
      if (track === 'phonics') {
        await page.getByRole('button', { name: '继续', exact: true }).click();
        await page.waitForFunction(() => document.getElementById('progressLabel')?.textContent === '第 2 步');
        assert.match(await page.locator('#activityBody').innerText(), /听完整词，再注意最开头的声音/);
        await page.getByRole('button', { name: '继续', exact: true }).click();
        await page.waitForFunction(() => document.getElementById('progressLabel')?.textContent === '第 3 步');
        await page.getByRole('button', { name: '选择词块：m', exact: true }).click();
        await page.waitForFunction(() => document.getElementById('progressLabel')?.textContent === '第 4 步');
      }
      await page.goto(`${base}/main.html?view=discover&category=beginner&track=invalid&stage=S9`);
      await page.waitForFunction(() => document.querySelectorAll('#discoverBody .workspace-card[data-resource^="course:"]').length === 3);
      assert.equal(await page.locator('#discoverBody .workspace-card[data-resource^="course:"]').count(), 3, 'invalid filters are ignored rather than hiding valid courses');
    }
    await page.screenshot({ path: path.join(screenshotDir, 'discover-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: path.join(screenshotDir, 'discover-desktop.png'), fullPage: true });
    console.log(`[beginner-e2e] screenshots: ${screenshotDir}`);
  } finally {
    if (browser) await browser.close();
    if (server && server.exitCode === null) { server.kill(); await new Promise(resolve => server.once('exit', resolve)); }
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
