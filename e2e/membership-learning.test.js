'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
const Database = require('node:module').createRequire(path.join(root, 'server/package.json'))('better-sqlite3');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-membership-learning-'));
  const dataRoot = path.join(temp, 'data'), privateRoot = path.join(dataRoot, 'membership-content');
  let child, browser, db, logs = '';
  try {
    fs.mkdirSync(privateRoot, { recursive: true });
    const items = ['Hello there.', 'How are you?', 'See you later.'].map((sentence, i) => ({ cid: 'item-' + i, sentence, translation: '合成学习提示 ' + i, chunks: sentence.split(' ') }));
    const learning = { template: 'sentence-practice', version: 1, modes: ['typing', 'chunkSelection'], defaultMode: 'typing' };
    fs.writeFileSync(path.join(privateRoot, 'sentences.json'), JSON.stringify({ items, learning }));
    fs.writeFileSync(path.join(privateRoot, 'free.json'), JSON.stringify({ items: items.map(item => ({ ...item, cid: 'free-' + item.cid })), learning }));
    fs.writeFileSync(path.join(privateRoot, 'story.json'), JSON.stringify({ utterances: [
      { id: 'line-1', text: { en: 'A lovely picture.', 'zh-CN': '一张可爱的图片。' }, chunks:['A lovely','picture.'], imageAssetId: 'picture' },
      { id: 'line-2', text: { en: 'Look over there.', 'zh-CN': '看那边。' }, imageAssetId: 'picture' }
    ] }));
    fs.writeFileSync(path.join(privateRoot, 'picture.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR5kAAAAASUVORK5CYII=', 'base64'));
    const course = (id, type, file, itemIds, assets = []) => ({ courseId: id, title: id === 'fixture-story' ? '隔离图文会员课' : '隔离句子课程 ' + id,
      contentType: type, defaultAccess: 'free', sourcePaths: [], legacyDeckIds: [],
      units: [{ unitId: 'unit', contentRef: { type: type === 'sentence' ? 'sentence-deck' : 'story-package', id }, file, itemIds, assets }] });
    const manifest = { schemaVersion: 1, courses: [course('fixture-sentence', 'sentence', 'sentences.json', items.map(item => item.cid)),
      course('fixture-free', 'sentence', 'free.json', items.map(item => 'free-' + item.cid)),
      course('fixture-story', 'image-text', 'story.json', ['line-1', 'line-2'], [{ assetId: 'picture', file: 'picture.png', mimeType: 'image/png' }])] };
    const originalItems=items.map(item=>({...item,cid:'original-'+item.cid,sentence:'Original '+item.sentence,chunks:['Original',...item.chunks]}));
    fs.writeFileSync(path.join(privateRoot,'original.json'),JSON.stringify({items:originalItems,learning}));
    const legacyCourse=course('fixture-original','sentence','original.json',originalItems.map(item=>item.cid));
    legacyCourse.units[0].recordIdentity={deckId:'original-deck',generationScope:'course:original-deck',resumeIdentity:'original-deck'};
    legacyCourse.legacyDeckIds=['original-deck'];manifest.courses.push(legacyCourse);
    // Separate refs make the free fixture independent from the protected member source.
    manifest.courses[1].units[0].contentRef.id = 'fixture-free-source';
    const { StaticFragmentBuilder } = require('../server/services/membership/static-fragment-builder');
    const { deckIdentity } = require('../server/services/membership/assessment-content');
    for (const course of manifest.courses) for (const unit of course.units) {
      const content = JSON.parse(fs.readFileSync(path.join(privateRoot, unit.file)));
      if (content.items) content.authoring = { template: 'sentence-practice', templateVersion: 1, contentForm: 'article', learning };
      const id = deckIdentity(course.courseId, unit.unitId);
      unit.recordIdentity = unit.recordIdentity || { deckId: id, generationScope: 'course:' + course.courseId, resumeIdentity: id };
      unit.assets = unit.assets.map(asset => { const bytes = fs.readFileSync(path.join(privateRoot, asset.file)); return { ...asset, size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }; });
      const built = new StaticFragmentBuilder().build({ courseId: course.courseId, unitId: unit.unitId, contentType: course.contentType, content, itemIds: unit.itemIds, assets: unit.assets, recordIdentity: unit.recordIdentity });
      for (const file of built.files) fs.writeFileSync(path.join(privateRoot, file.name), file.bytes, { flag: 'wx' });
      unit.fragments = built.fragments; unit.contentVersion = built.contentVersion;
    }
    manifest.schemaVersion = 2;
    fs.writeFileSync(path.join(privateRoot, 'registry.json'), JSON.stringify(manifest));
    const probe = net.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
    const base = 'http://127.0.0.1:' + port;
    child = spawn(process.execPath, [path.join(root, 'server/index.js')], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CHUNKLAB_DATA_DIR: dataRoot, CHUNKLAB_APP_ROOT: root, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'test',
        REQUIRE_AUTH: 'true', PHONE_AUTH_ENABLED: 'false', CHUNKLAB_WRITE_PROTOCOL: '3',
        JWT_SECRET: crypto.randomBytes(40).toString('hex'), ADMIN_JWT_SECRET: crypto.randomBytes(40).toString('hex'), ADMIN_PASSWORD: 'SyntheticMembership2026!',
        MEMBERSHIP_CONTENT_GRANT_KEY: crypto.randomBytes(32).toString('base64'), MEMBERSHIP_CODE_HMAC_CURRENT: 'fixture-v1', MEMBERSHIP_CODE_HMAC_KEYS: JSON.stringify({ 'fixture-v1': crypto.randomBytes(32).toString('base64') }) } });
    child.stdout.on('data', bytes => { logs += bytes; }); child.stderr.on('data', bytes => { logs += bytes; });
    const deadline = Date.now() + 20000;
    while (!logs.includes('listening on http://127.0.0.1:' + port)) { if (child.exitCode !== null || Date.now() > deadline) throw Error(logs.slice(-2000)); await delay(50); }
    assert.ok(child.pid && child.exitCode === null);
    const api = async (url, token, body, method) => {
      const response = await fetch(base + url, { method: method || (body ? 'POST' : 'GET'),
        headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      assert.equal(response.status, 200, url + ' ' + response.status); return response.json();
    };
    const admin = (await api('/api/admin/login', null, { password: 'SyntheticMembership2026!' })).token;
    const user = await api('/api/auth/register', null, { username: 'membership-browser', password: 'SyntheticLearner2026!' });
    const settings = (await api('/api/admin/membership/settings', admin)).settings;
    await api('/api/admin/membership/settings', admin, { baseRevision: settings.revision, enabled: true, trialDays: 3, dailyLimitSeconds: 4, salesUrl: '' }, 'PUT');
    const policies = await api('/api/admin/membership/course-access', admin);
    await api('/api/admin/membership/course-access', admin, { changes: ['fixture-sentence', 'fixture-story'].map(courseId => ({ courseId, accessLevel: 'member', baseRevision: 0 })), registryVersion: policies.version, requestId: crypto.randomUUID(), reason: 'Isolated browser fixtures' }, 'PUT');
    db = new Database(path.join(dataRoot, 'chunklab.db'));
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    await require('./lib/workspace-request-budget')({browser,base,api,root});
    await require('./lib/native-membership-browser')({browser,base,api,admin,db,user,root});
    console.log('native membership browser: original engine, grants, identity, records, trial, renewal, images and history passed');
  } finally {
    if (browser) await browser.close(); if (db) db.close();
    if (child && child.exitCode === null) { child.kill(); await new Promise(resolve => child.once('exit', resolve)); }
    assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep)); fs.rmSync(temp, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
