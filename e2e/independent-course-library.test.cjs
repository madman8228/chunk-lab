'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'chunk-independent-course-e2e-'));
const port = require('./lib/free-port').freePort(11800, 100), base = 'http://127.0.0.1:' + port;
let server, browser, logs = '';

async function waitServer() {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error(logs);
    try { if ((await fetch(base + '/api/health')).ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('server timeout ' + logs);
}

async function main() {
  try {
    fs.mkdirSync(path.join(temp, 'app/content'), { recursive: true });
    const protectedContentRoot = path.join(temp, 'data/membership-content');
    fs.mkdirSync(protectedContentRoot, { recursive: true });
    const sharedCourseId = 'fixture:shared-public-course';
    const sharedUnitId = 'fixture:shared-unit';
    const sharedSource = { items: [{ cid: 'shared-lesson', sentence: 'A public fixture sentence.', chunks: ['A public', 'fixture sentence.'], hints: ['公共测试', '句子'] }] };
    const sharedFragments = new (require(path.join(root, 'server/services/membership/static-fragment-builder')).StaticFragmentBuilder)().build({
      courseId: sharedCourseId, unitId: sharedUnitId, contentType: 'sentence', content: sharedSource,
      itemIds: ['shared-lesson'], recordIdentity: { deckId: 'shared-platform-deck', generationScope: 'course:shared-platform-deck', resumeIdentity: 'shared-platform-deck' }
    });
    for (const file of sharedFragments.files) fs.writeFileSync(path.join(protectedContentRoot, file.name), file.bytes, { flag: 'wx' });
    fs.writeFileSync(path.join(protectedContentRoot, 'registry.json'), JSON.stringify({ schemaVersion: 2, courses: [{
      courseId: sharedCourseId, title: 'Shared public fixture', contentType: 'sentence', defaultAccess: 'free',
      sourcePaths: ['/fixture/shared-source.js'], legacyDeckIds: [], units: [{ unitId: sharedUnitId,
        contentRef: { type: 'sentence-deck', id: 'shared-source' }, itemIds: ['shared-lesson'], assets: [],
        fragments: sharedFragments.fragments, contentVersion: sharedFragments.contentVersion, recordIdentity: sharedFragments.recordIdentity }]
    }] }));
    fs.copyFileSync(path.join(root, 'content/manifest.json'), path.join(temp, 'app/content/manifest.json'));
    require('./lib/prepare-ui-root')(path.join(temp, 'app'));
    server = spawn(process.execPath, ['index.js'], { cwd: path.join(root, 'server'), env: {
      ...process.env, PORT: String(port), CHUNKLAB_DATA_DIR: path.join(temp, 'data'), CHUNKLAB_APP_ROOT: path.join(temp, 'app'),
      NODE_ENV: 'test', CHUNKLAB_WRITE_PROTOCOL: '3', REQUIRE_AUTH: 'true',
      JWT_SECRET: 'independent-course-e2e-user-secret-at-least-32-characters', PHONE_AUTH_ENABLED: 'false',
      MEMBERSHIP_CONTENT_GRANT_KEY: Buffer.alloc(32, 7).toString('base64')
    }, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', chunk => { logs += chunk; }); server.stderr.on('data', chunk => { logs += chunk; });
    await waitServer();

    async function register(username) {
      const response = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password: 'independent-course-test-pass' }) });
      const body = await response.json();
      assert.equal(response.status, 200, JSON.stringify(body));
      return body.token;
    }
    const ownerToken = await register('independent-course-owner');
    const secondToken = await register('independent-course-reader');
    const ownerHeaders = { 'content-type': 'application/json', authorization: 'Bearer ' + ownerToken };
    const secondHeaders = { 'content-type': 'application/json', authorization: 'Bearer ' + secondToken };
    const ownerId = Number(JSON.parse(Buffer.from(ownerToken.split('.')[1], 'base64url').toString()).uid);
    const secondId = Number(JSON.parse(Buffer.from(secondToken.split('.')[1], 'base64url').toString()).uid);
    const Database = require(require.resolve('better-sqlite3', { paths: [path.join(root, 'server')] }));
    const formatDb = new Database(path.join(temp, 'data', 'chunklab.db'));
    formatDb.exec('CREATE TABLE IF NOT EXISTS user_phone_identities(phone TEXT PRIMARY KEY,user_id INTEGER UNIQUE,verified_at INTEGER)');
    formatDb.prepare('INSERT INTO user_phone_identities(phone,user_id,verified_at) VALUES(?,?,?)').run('isolated-wordbook-owner', ownerId, Date.now());
    const activateLearningFormat = formatDb.prepare("INSERT INTO user_learning_data_formats(user_id,format,migration_id) VALUES(?,'references-v1','independent-course-e2e-fixture')");
    activateLearningFormat.run(ownerId);
    activateLearningFormat.run(secondId);
    formatDb.close();

    const sharedCatalogResponse = await fetch(base + '/api/course-content/catalog');
    assert.equal(sharedCatalogResponse.status, 200);
    const sharedCatalog = await sharedCatalogResponse.json();
    assert.equal(sharedCatalog.courses.some(course => course.courseId === sharedCourseId), true,
      'both accounts resolve the same platform-owned public course catalog');
    async function submitAccountOperation(headers, requestId, type, payload) {
      const response = await fetch(base + '/api/operations', { method: 'POST', headers,
        body: JSON.stringify({ protocol: 3, requestId, type, payload }) });
      const body = await response.json();
      assert.equal(response.status, 200, JSON.stringify(body));
      return body;
    }
    for (const [headers, suffix] of [[ownerHeaders, 'owner'], [secondHeaders, 'reader']]) {
      await submitAccountOperation(headers, 'shared-course-join-' + suffix + '-01', 'course.enrollment',
        { courseId: sharedCourseId, joined: true });
    }
    const sharedProgressSnapshots = {};
    for (const [account, headers, expectedPassed] of [['owner', ownerHeaders, false], ['reader', secondHeaders, false]]) {
      const refreshed = await fetch(base + '/api/learning-data', { headers }).then(response => response.json());
      const refreshedAgain = await fetch(base + '/api/learning-data', { headers }).then(response => response.json());
      assert.equal(refreshed.courseProgress[sharedCourseId]?.passed?.includes('shared-lesson') === true, expectedPassed,
        'each account sees its own course progress after re-reading learning data');
      assert.equal(refreshedAgain.courseProgress[sharedCourseId]?.passed?.includes('shared-lesson') === true, expectedPassed,
        'the account progress survives a subsequent refresh');
      sharedProgressSnapshots[account] = refreshed.courseProgress[sharedCourseId] || null;
      assert.equal(JSON.stringify(refreshed).includes('A public fixture sentence.'), false,
        'references-only learning state does not duplicate platform course content');
    }
    assert.deepEqual(sharedProgressSnapshots.owner, sharedProgressSnapshots.reader,
      'the same platform course starts with equivalent but separately stored account state');
    const sharedBoundaryDb = new Database(path.join(temp, 'data', 'chunklab.db'), { readonly: true, fileMustExist: true });
    try {
      assert.equal(sharedBoundaryDb.prepare('SELECT COUNT(*) AS count FROM user_courses WHERE course_id=?').get(sharedCourseId).count, 0,
        'joining a platform course never copies its body into account-owned course storage');
      assert.equal(sharedBoundaryDb.prepare('SELECT COUNT(*) AS count FROM user_course_progress WHERE course_id=?').get(sharedCourseId).count, 0,
        'joining a shared course does not itself create completion progress');
    } finally { sharedBoundaryDb.close(); }
    for (const [headers, suffix] of [[ownerHeaders, 'owner'], [secondHeaders, 'reader']]) {
      await submitAccountOperation(headers, 'shared-course-leave-' + suffix + '-01', 'course.enrollment',
        { courseId: sharedCourseId, joined: false });
    }
    const personalWordbookDraft = {
      schemaVersion: 1,
      book: { bookId: 'e2e-personal-wordbook', title: '隔离个人词书', units: [{ unitId: 'unit-1', title: '借用物品' }] },
      items: [{ itemId: 'borrow-item', unitId: 'unit-1', word: 'borrow', meaning: '借入', scene: '向朋友借充电器',
        translation: '我可以借你的充电器吗？', exercise: { version: 1, parts: [
          { text: 'Can I ' }, { id: 'blank1', label: 'borrow', answers: ['borrow'] }, { text: ' your charger?' }
        ] }, images: { wide: [], mobile: [] } }]
    };
    const personalWordbookResponse = await fetch(base + '/api/personal-wordbooks', { method: 'POST', headers: ownerHeaders,
      body: JSON.stringify({ draft: personalWordbookDraft }) });
    const personalWordbook = await personalWordbookResponse.json();
    assert.equal(personalWordbookResponse.status, 200, JSON.stringify(personalWordbook));
    assert.equal(personalWordbook.confirmed, true);
    assert.equal(personalWordbook.title, '隔离个人词书');
    const wordbookDetailsResponse = await fetch(base + '/api/wordbooks/' + encodeURIComponent(personalWordbook.bookId) + '/details', { headers: ownerHeaders });
    assert.equal(wordbookDetailsResponse.status, 200, 'the existing wordbook reader resolves content from the independent library');
    const wordbookDetails = await wordbookDetailsResponse.json();
    assert.equal(wordbookDetails.title, '隔离个人词书');
    const wordbookItemsResponse = await fetch(base + '/api/wordbooks/' + encodeURIComponent(personalWordbook.bookId) + '/items?offset=0&limit=10', { headers: ownerHeaders });
    assert.equal(wordbookItemsResponse.status, 200);
    const wordbookItemRef = (await wordbookItemsResponse.json()).items[0];
    const wordbookItemResponse = await fetch(base + '/api/vocabulary-items/' + encodeURIComponent(wordbookItemRef.itemId) + '?revision=' + encodeURIComponent(wordbookItemRef.contentRevision), { headers: ownerHeaders });
    assert.equal(wordbookItemResponse.status, 200);
    assert.equal((await wordbookItemResponse.json()).word, 'borrow');
    const wordbookLearning = await fetch(base + '/api/learning-data', { headers: ownerHeaders });
    const wordbookLearningBody = await wordbookLearning.json();
    assert.equal(wordbookLearning.status, 200);
    assert.equal(JSON.stringify(wordbookLearningBody).includes('借入'), false, 'learning state does not duplicate personal wordbook content');
    assert.equal(JSON.stringify(wordbookLearningBody).includes('Can I borrow your charger?'), false);
    const wordbookArchiveResponse = await fetch(base + '/api/export', { headers: ownerHeaders });
    const wordbookArchive = await wordbookArchiveResponse.json();
    assert.equal(wordbookArchiveResponse.status, 200);
    assert.equal(wordbookArchive.personalWordbooks.rows.length, 1, 'account backup retains a separate, explicit wordbook archive');
    assert.equal(JSON.parse(wordbookArchive.personalWordbooks.rows[0].package_json).items[0].word, 'borrow');
    const restoreDataDir = path.join(temp, 'wordbook-restore-data');
    fs.mkdirSync(restoreDataDir, { recursive: true });
    const restorePort = require('./lib/free-port').freePort(port + 1, 100), restoreBase = 'http://127.0.0.1:' + restorePort;
    let restoreServer, restoreLogs = '';
    try {
      restoreServer = spawn(process.execPath, ['index.js'], { cwd: path.join(root, 'server'), env: {
        ...process.env, PORT: String(restorePort), CHUNKLAB_DATA_DIR: restoreDataDir, CHUNKLAB_APP_ROOT: path.join(temp, 'app'),
        NODE_ENV: 'test', CHUNKLAB_WRITE_PROTOCOL: '3', REQUIRE_AUTH: 'true', PHONE_AUTH_ENABLED: 'false',
        JWT_SECRET: 'independent-course-e2e-user-secret-at-least-32-characters'
      }, stdio: ['ignore', 'pipe', 'pipe'] });
      restoreServer.stdout.on('data', chunk => { restoreLogs += chunk; });
      restoreServer.stderr.on('data', chunk => { restoreLogs += chunk; });
      let restoreReady = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (restoreServer.exitCode !== null) throw Error(restoreLogs);
        try { if ((await fetch(restoreBase + '/api/health')).ok) { restoreReady = true; break; } } catch (_) {}
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.equal(restoreReady, true, 'isolated restore service starts on its own port');
      const restoreRegisterResponse = await fetch(restoreBase + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'independent-course-owner', password: 'independent-course-test-pass' }) });
      const restoreRegister = await restoreRegisterResponse.json();
      assert.equal(restoreRegisterResponse.status, 200, JSON.stringify(restoreRegister));
      assert.equal(restoreRegister.user.id, ownerId, 'fresh restore fixture recreates the same synthetic account identity');
      const restoreHeaders = { 'content-type': 'application/json', authorization: 'Bearer ' + restoreRegister.token };
      const archiveForRestore = wordbookArchive.personalWordbooks;
      const restorePreviewResponse = await fetch(restoreBase + '/api/personal-wordbooks/restore/preview', { method: 'POST', headers: restoreHeaders,
        body: JSON.stringify({ archive: archiveForRestore }) });
      const restorePreview = await restorePreviewResponse.json();
      assert.equal(restorePreviewResponse.status, 200, JSON.stringify(restorePreview));
      assert.equal(restorePreview.eligible, true);
      const restoreApplyResponse = await fetch(restoreBase + '/api/personal-wordbooks/restore/apply', { method: 'POST', headers: restoreHeaders,
        body: JSON.stringify({ archive: archiveForRestore, fingerprint: restorePreview.fingerprint, confirmed: true }) });
      assert.equal(restoreApplyResponse.status, 200, await restoreApplyResponse.text());
      const restoredDetailsResponse = await fetch(restoreBase + '/api/wordbooks/' + encodeURIComponent(personalWordbook.bookId) + '/details', { headers: restoreHeaders });
      assert.equal(restoredDetailsResponse.status, 200, 'restored vocabulary content is readable through its normal authorized route');
      const restoredExport = await fetch(restoreBase + '/api/export', { headers: restoreHeaders }).then(response => response.json());
      assert.deepEqual(restoredExport.personalWordbooks, archiveForRestore, 'independent releases round-trip through an account archive with historical timestamps intact');
      const duplicateRestoreResponse = await fetch(restoreBase + '/api/personal-wordbooks/restore/apply', { method: 'POST', headers: restoreHeaders,
        body: JSON.stringify({ archive: archiveForRestore, fingerprint: restorePreview.fingerprint, confirmed: true }) });
      assert.equal(duplicateRestoreResponse.status, 409, 'restore cannot overwrite a now-nonempty account');
    } finally {
      if (restoreServer && restoreServer.exitCode === null) await new Promise(resolve => { restoreServer.once('close', resolve); restoreServer.kill(); });
    }
    const deniedWordbook = await fetch(base + '/api/wordbooks/' + encodeURIComponent(personalWordbook.bookId) + '/details', {
      headers: { authorization: 'Bearer ' + secondToken }
    });
    assert.equal(deniedWordbook.status, 404, 'private vocabulary content cannot be read by another account');
    const wordbookAuditDb = new Database(path.join(temp, 'data', 'chunklab.db'));
    try {
      const personalWordbookMapping = wordbookAuditDb.prepare("SELECT course_id FROM course_content_legacy_mappings WHERE source_user_id=? AND source_kind='course' AND source_id=?")
        .get(ownerId, 'wordbook:' + personalWordbook.bookId);
      assert.ok(personalWordbookMapping, 'new personal vocabulary content has an independent namespaced source mapping');
      assert.equal(wordbookAuditDb.prepare('SELECT COUNT(*) AS count FROM personal_wordbook_versions WHERE user_id=?').get(ownerId).count, 0,
        'new personal wordbook content does not enter the legacy account-owned content table');
    } finally { wordbookAuditDb.close(); }
    const importedResponse = await fetch(base + '/api/course-library/import', { method: 'POST', headers: ownerHeaders, body: JSON.stringify({
      requestId: 'independent-course-import-001', kind: 'course', content: { courseId: 'untrusted-client-id', title: '独立课程练习', items: [
        { id: 'item-1', cid: 'line-1', sentence: 'I study with a group.', chunks: ['I study', 'with a group.'] },
        { id: 'item-2', cid: 'line-2', sentence: 'We learn together.', chunks: ['We learn', 'together.'] }
      ] }
    }) });
    const imported = await importedResponse.json();
    assert.equal(importedResponse.status, 201, JSON.stringify(imported));
    assert.notEqual(imported.courseId, 'untrusted-client-id', 'server assigns the independent course ID');
    const migrationDb = new Database(path.join(temp, 'data', 'chunklab.db'));
    let readerId, migratedDeckId;
    try {
      readerId = Number(JSON.parse(Buffer.from(secondToken.split('.')[1], 'base64url').toString()).uid);
      const insertLegacyDeck = migrationDb.prepare(`INSERT INTO user_decks(user_id,id,name,items_json,builtin,is_public)
        VALUES(?,?,?,'[{"id":"line-1","sentence":"Legacy lesson."}]',0,0)`);
      insertLegacyDeck.run(ownerId, 'same-legacy-id', '已迁移课程',);
      insertLegacyDeck.run(readerId, 'same-legacy-id', '另一账号同 ID 课程');
      const legacyPreference = { schemaVersion: 1, itemType: 'resource', targetId: 'course:user-deck:same-legacy-id', selected: true, position: 0, updatedAt: 1 };
      migrationDb.prepare(`INSERT INTO user_entity_rows(user_id,kind,item_key,data_json,seq)
        VALUES(?,'learningWorkspace','resource:course:user-deck:same-legacy-id',?,0)`).run(ownerId, JSON.stringify(legacyPreference));
      const legacyProgress = { kind: 'course-enrollment', schemaVersion: 1, courseId: 'user-deck:same-legacy-id', joined: true };
      migrationDb.prepare('INSERT INTO user_course_progress(user_id,course_id,data_json) VALUES(?,?,?)')
        .run(ownerId, 'enrollment:v1:user-deck%3Asame-legacy-id', JSON.stringify(legacyProgress));
      const { buildManifest, applyManifest } = require(path.join(root, 'server/services/course-library-migration'));
      const manifest = buildManifest(migrationDb, { createdAt: '2026-10-21T00:00:00.000Z' });
      assert.equal(manifest.idCollisions.length, 1, 'same legacy course ID from two accounts is identified as a conflict');
      const ownerEntry = manifest.entries.find(row => row.userId === ownerId && row.legacyId === 'same-legacy-id');
      const readerEntry = manifest.entries.find(row => row.userId === readerId && row.legacyId === 'same-legacy-id');
      assert.notEqual(ownerEntry.courseId, readerEntry.courseId, 'content identities remain distinct across account ID collisions');
      migratedDeckId = ownerEntry.courseId;
      assert.equal(manifest.learningReferences.courseProgress[0].targetId, migratedDeckId, 'old enrollment has a deterministic account-scoped alias');
      assert.equal(applyManifest(migrationDb, manifest).added, 2);
      assert.equal(migrationDb.prepare('SELECT data_json FROM user_course_progress WHERE user_id=? AND course_id=?')
        .get(ownerId, 'enrollment:v1:user-deck%3Asame-legacy-id').data_json, JSON.stringify(legacyProgress), 'migration preserves the original learning row verbatim');
    } finally { migrationDb.close(); }

    const imageBytes = fs.readFileSync(path.join(root, 'assets/vocab-g7-lower-u1-blind-wide-v1.webp'));
    const imageHash = crypto.createHash('sha256').update(imageBytes).digest('hex');
    const sourceCourseId = 'ai-independent-image-1234567890', sourceAssetId = sourceCourseId + ':image:one', sourceLineId = sourceCourseId + ':line:001';
    const mediaImport = await fetch(base + '/api/course-library/import', { method: 'POST', headers: ownerHeaders, body: JSON.stringify({
      requestId: 'independent-image-import-001', kind: 'course', content: { courseId: sourceCourseId, metadata: { title: { en: 'Image', 'zh-CN': '图片课程' } },
        assets: [{ id: sourceAssetId, path: 'images/one.webp', mimeType: 'image/webp' }],
        utterances: [{ id: sourceLineId, text: { en: 'Read the picture.', 'zh-CN': '看图阅读。' }, chunks: ['Read the', 'picture.'], imageAssetId: sourceAssetId }], sequence: [sourceLineId] },
      assets: [{ assetId: sourceAssetId, mimeType: 'image/webp', bytes: imageBytes.length, sha256: imageHash, base64: imageBytes.toString('base64') }]
    }) });
    const mediaCourse = await mediaImport.json();assert.equal(mediaImport.status, 201, JSON.stringify(mediaCourse));
    const mediaBatch = await fetch(base + '/api/course-library/' + encodeURIComponent(mediaCourse.courseId) + '/batch?cursor=0', { headers: ownerHeaders });
    const batch = await mediaBatch.json();assert.equal(batch.batch.contentType, 'image-text');
    const mediaStatKey = batch.batch.recordIdentity.deckId + '#' + batch.batch.items[0].id;
    const mappedAssetId = mediaCourse.courseId + ':image:one';assert.deepEqual(batch.batch.assetIds, [mappedAssetId]);
    const mediaResponse = await fetch(base + '/api/course-library/' + encodeURIComponent(mediaCourse.courseId) + '/assets/' + encodeURIComponent(mappedAssetId) + '?releaseId=' + mediaCourse.releaseId, { headers: ownerHeaders });
    assert.equal(mediaResponse.status, 200);assert.equal(mediaResponse.headers.get('Content-Type'), 'image/webp');
    assert.equal(mediaResponse.headers.get('X-ChunkLab-Account-Id'), String(JSON.parse(Buffer.from(ownerToken.split('.')[1], 'base64url').toString()).uid));
    assert.deepEqual(Buffer.from(await mediaResponse.arrayBuffer()), imageBytes);
    const privateAsset = await fetch(base + '/api/course-library/' + encodeURIComponent(mediaCourse.courseId) + '/assets/' + encodeURIComponent(mappedAssetId), { headers: { authorization: 'Bearer ' + secondToken } });
    assert.equal(privateAsset.status, 404, 'private course assets use the same course ACL as metadata');
    const denied = await fetch(base + '/api/course-library/' + encodeURIComponent(imported.courseId) + '/batch?cursor=0', {
      headers: { authorization: 'Bearer ' + secondToken }
    });
    assert.equal(denied.status, 404, 'private course is not visible to another account');
    const aclDb = new Database(path.join(temp, 'data', 'chunklab.db'));
    try { aclDb.prepare("INSERT INTO course_content_access(course_id,subject_user_id,role) VALUES(?,?,'reader')").run(mediaCourse.courseId, secondId); }
    finally { aclDb.close(); }
    const sharedMediaBatch = await fetch(base + '/api/course-library/' + encodeURIComponent(mediaCourse.courseId) + '/batch?cursor=0', { headers: secondHeaders });
    assert.equal(sharedMediaBatch.status, 200, 'an explicitly authorized second account reads the same immutable image course');
    const sharedMediaContent = await sharedMediaBatch.json();
    assert.equal(sharedMediaContent.batch.contentVersion, batch.batch.contentVersion, 'both authorized accounts resolve the identical image release');
    const readerMediaAsset = await fetch(base + '/api/course-library/' + encodeURIComponent(mediaCourse.courseId) + '/assets/' + encodeURIComponent(mappedAssetId) + '?releaseId=' + mediaCourse.releaseId, { headers: secondHeaders });
    assert.equal(readerMediaAsset.status, 200, 'explicit image-course access grants the same release-scoped media');
    assert.deepEqual(Buffer.from(await readerMediaAsset.arrayBuffer()), imageBytes);

    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
    await context.addInitScript(token => localStorage.setItem('chunklab_token', token), ownerToken);
    const page = await context.newPage(), errors = [];
    const readerContext = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
    await readerContext.addInitScript(token => localStorage.setItem('chunklab_token', token), secondToken);
    const readerPage = await readerContext.newPage(), readerErrors = [];
    let browserAssetRequests = 0, readerAssetRequests = 0;
    page.on('pageerror', error => errors.push(error.message));
    readerPage.on('pageerror', error => readerErrors.push(error.message));
    page.on('request', request => { if (request.url().includes('/assets/' + encodeURIComponent(mappedAssetId))) browserAssetRequests++; });
    readerPage.on('request', request => { if (request.url().includes('/assets/' + encodeURIComponent(mappedAssetId))) readerAssetRequests++; });
    async function enterSharedCourse(userPage, accountName, expectedPassed) {
      await userPage.goto(base + '/main.html?view=discover');
      const card = userPage.locator('#pageDiscover .workspace-card[data-resource="course:' + sharedCourseId + '"]');
      await card.waitFor({ timeout: 20000 });
      const buttonLabels = await card.locator('button').allTextContents();
      if (!buttonLabels.includes('加入学习')) throw new Error(accountName + ' shared discover card actions=' + JSON.stringify({
        labels: buttonLabels, text: await card.innerText(), refs: await card.getAttribute('data-resource')
      }));
      await card.locator('.content-card-menu summary').click();
      await card.locator('.content-card-actions').getByRole('button', { name: '加入学习', exact: true }).click();
      await userPage.waitForFunction(id => new URL(location.href).searchParams.get('protectedCourse') === id, sharedCourseId, { timeout: 20000 }).catch(async error => {
        throw new Error(error.message + ' after join action: ' + JSON.stringify({ url: userPage.url(), body: (await userPage.locator('body').innerText()).slice(-1000) }));
      });
      await userPage.waitForFunction(() => !!window.__nativeCourseSession && !!document.querySelector('#pagePractice .course-access-panel'), null, { timeout: 20000 });
      const snapshot = await userPage.evaluate(async () => ChunkAPI.request('/api/learning-data'));
      const membership = Object.values(snapshot.courseProgress || {}).find(row => row.kind === 'course-enrollment' && row.courseId === 'fixture:shared-public-course');
      assert.equal(membership?.joined, true, accountName + ' confirms the join reference before entering practice');
      const progress = snapshot.courseProgress[sharedCourseId];
      assert.equal(progress?.passed?.includes('shared-lesson') === true, expectedPassed,
        accountName + ' starts with its own uncompleted progress when entering from discover');
      const start = userPage.locator('#pagePractice .course-access-panel button').filter({ hasText: /开始学习|继续学习/ });
      await start.waitFor({ timeout: 15000 });
      await start.click();
      await userPage.waitForFunction(() => window.__nativeCourseSession?.gateway?.cache?.get(0)?.items?.length === 1, null, { timeout: 20000 }).catch(async error => {
        throw new Error(error.message + ' while starting shared practice: ' + JSON.stringify({
          body: (await userPage.locator('body').innerText()).slice(-1200), session: await userPage.evaluate(() => ({
            phase: window.__nativeCourseSession?.phase, lastError: window.__nativeCourseSession?.lastError?.message,
            code: window.__nativeCourseSession?.lastError?.code
          }))
        }));
      });
      return userPage.evaluate(() => window.__nativeCourseSession.gateway.cache.get(0).items[0]);
    }
    const ownerSharedItem = await enterSharedCourse(page, 'owner account', false);
    const readerSharedItem = await enterSharedCourse(readerPage, 'reader account', false);
    assert.deepEqual(ownerSharedItem, readerSharedItem,
      'both account practice sessions render the same platform-owned course item');
    async function answerSharedCourse(userPage) {
      const chunks = await userPage.evaluate(() => S.items[0].chunks.slice());
      assert.equal(chunks.length, 2, 'the public sentence fixture exposes two answerable chunks');
      for (let index = 0; index < chunks.length; index++) {
        await userPage.locator('#stageChoices .choice').evaluateAll((nodes, answer) => {
          const choice = nodes.find(node => node.dataset.v === answer);
          if (!choice) throw new Error('shared course practice is missing expected choice: ' + answer);
          choice.click();
        }, chunks[index]);
        await userPage.waitForFunction(i => S.status[i] === 'ok', index, { timeout: 10000 });
      }
      await userPage.waitForFunction(() => !$('btnNext').classList.contains('hidden'), null, { timeout: 10000 });
      await userPage.waitForFunction(async courseId => {
        const snapshot = await ChunkAPI.request('/api/learning-data');
        const row = snapshot.mem?.stats?.bySentence?.['shared-platform-deck#shared-lesson'];
        return Number(row?.times) > 0;
      }, sharedCourseId, { timeout: 15000 });
    }
    await answerSharedCourse(page);
    const ownerAfterAnswer = await page.evaluate(async () => ChunkAPI.request('/api/learning-data'));
    const readerAfterOwnerAnswer = await readerPage.evaluate(async () => ChunkAPI.request('/api/learning-data'));
    assert.equal(ownerAfterAnswer.mem?.stats?.bySentence?.['shared-platform-deck#shared-lesson']?.times, 1,
      'answering in the browser writes completion only to the active learner');
    assert.equal(readerAfterOwnerAnswer.mem?.stats?.bySentence?.['shared-platform-deck#shared-lesson'], undefined,
      'another learner reading the same public course does not inherit the answer');
    const catalogAfterAnswer = await fetch(base + '/api/course-content/catalog').then(response => response.json());
    const versionAfterAnswer = catalogAfterAnswer.courses.find(course => course.courseId === sharedCourseId).units[0].contentVersion;
    assert.equal(versionAfterAnswer, sharedFragments.contentVersion,
      'learner answers do not mutate the immutable shared content version');
    const answeredProgressDb = new Database(path.join(temp, 'data', 'chunklab.db'), { readonly: true, fileMustExist: true });
    try {
      assert.equal(answeredProgressDb.prepare('SELECT COUNT(*) AS count FROM user_course_progress WHERE course_id=?').get(sharedCourseId).count, 0,
        'native sentence-study statistics remain separate from the course enrollment table');
    } finally { answeredProgressDb.close(); }
    await Promise.all([page.reload(), readerPage.reload()]);
    await Promise.all([page, readerPage].map(async userPage => {
      const start = userPage.locator('#pagePractice .course-access-panel button').filter({ hasText: /开始学习|继续学习/ });
      await start.waitFor({ timeout: 15000 });
      await start.click();
      await userPage.waitForFunction(() => window.__nativeCourseSession?.gateway?.cache?.get(0)?.items?.length === 1, null, { timeout: 20000 });
    }));
    for (const [userPage, expectedPassed] of [[page, true], [readerPage, false]]) {
      const snapshot = await userPage.evaluate(async () => ChunkAPI.request('/api/learning-data'));
      assert.equal(Object.values(snapshot.courseProgress || {}).some(row => row.kind === 'course-enrollment' && row.courseId === sharedCourseId && row.joined), true,
        'the account join reference survives browser reload');
      const sentenceStat = snapshot.mem?.stats?.bySentence?.['shared-platform-deck#shared-lesson'];
      assert.equal(Number(sentenceStat?.times) > 0, expectedPassed,
        'the account learning progress survives browser reload without cross-account mixing');
    }
    assert.deepEqual(errors, [], errors.join('\n'));
    assert.deepEqual(readerErrors, [], readerErrors.join('\n'));
    await readerPage.goto(base + '/main.html?personalCourse=' + encodeURIComponent(mediaCourse.courseId));
    const readerMediaStart = readerPage.locator('#pagePractice .course-access-panel button').filter({ hasText: '开始学习' });
    await readerMediaStart.waitFor({ timeout: 15000 });
    await readerMediaStart.click();
    await readerPage.waitForFunction(() => {
      const image = document.querySelector('#courseLearningImage');
      return image && !image.hidden && image.src.startsWith('blob:') && image.complete && image.naturalWidth > 0;
    }, null, { timeout: 15000 });
    assert.equal(readerAssetRequests, 1, 'the authorized second account loads the same image release on demand');
    await answerImageCourse(readerPage);
    const readerMediaLearning = await readerPage.evaluate(async () => ChunkAPI.request('/api/learning-data'));
    assert.equal(readerMediaLearning.mem.stats.bySentence[mediaStatKey]?.times, 1,
      'the authorized reader writes its own image-course answer record; expected=' + mediaStatKey +
      ' actual=' + JSON.stringify(readerMediaLearning.mem.stats.bySentence));
    assert.deepEqual(Object.keys(readerMediaLearning.mem.stats.bySentence), [mediaStatKey],
      'the reader learning snapshot contains its own answer, not the owner answer');
    assert.equal(readerMediaLearning.courseProgress['personal-course:' + mediaCourse.courseId], undefined,
      'answering an explicitly readable course does not create a join reference implicitly');
    assert.equal(JSON.stringify(readerMediaLearning).includes('Read the picture.'), false,
      'the second account learning snapshot does not duplicate the shared image course body');
    await readerPage.reload();
    const readerMediaAfterReload = await readerPage.evaluate(async () => ChunkAPI.request('/api/learning-data'));
    assert.equal(readerMediaAfterReload.mem.stats.bySentence[mediaStatKey].times, 1,
      'the reader image-course answer remains after a browser reload');
    await readerContext.close();
    await page.goto(base + '/wordbook.html?book=' + encodeURIComponent(personalWordbook.bookId) + '&unit=unit-1&structureRevision=' + encodeURIComponent(wordbookDetails.structureRevision));
    await page.locator('#studyRoot h2').waitFor({ timeout: 15000 });
    const personalWordbookStateUrl = '/api/wordbooks/' + encodeURIComponent(personalWordbook.bookId) + '/state?unitId=unit-1&structureRevision=' + encodeURIComponent(wordbookDetails.structureRevision);
    const initialWordbookState = await fetch(base + personalWordbookStateUrl, { headers: ownerHeaders });
    assert.equal(initialWordbookState.status, 200);
    const initialWordbookStateBody = await initialWordbookState.json();
    const wordbookStartOperation = { protocol: 3, requestId: 'independent-wordbook-session-start-001', type: 'vocabulary.session', payload: {
      bookId: personalWordbook.bookId, bookRevision: wordbookDetails.revision, itemId: wordbookItemRef.itemId,
      sessionId: 'independent-wordbook-session-001', action: 'start', expectedResumeRev: initialWordbookStateBody.resumeRev,
      practiceType: 'sentence-cloze', unitId: 'unit-1', structureRevision: wordbookDetails.structureRevision
    } };
    const startWordbookSession = await fetch(base + '/api/operations', { method: 'POST', headers: ownerHeaders, body: JSON.stringify(wordbookStartOperation) });
    assert.equal(startWordbookSession.status, 200, await startWordbookSession.text());
    const personalWordbookStudy = await fetch(base + personalWordbookStateUrl, { headers: ownerHeaders });
    assert.equal(personalWordbookStudy.status, 200);
    assert.ok((await personalWordbookStudy.json()).resume, 'practice progress for the independent wordbook persists separately');
    const personalWordbookLearningAfterPractice = await fetch(base + '/api/learning-data', { headers: ownerHeaders });
    const personalWordbookLearningAfterPracticeBody = await personalWordbookLearningAfterPractice.json();
    assert.equal(JSON.stringify(personalWordbookLearningAfterPracticeBody).includes(personalWordbook.bookId), true,
      'the references-only learning snapshot retains the vocabulary resume reference');
    assert.equal(JSON.stringify(personalWordbookLearningAfterPracticeBody).includes('Can I borrow your charger?'), false,
      'saving practice progress still does not place vocabulary course content in the learning snapshot');
    await page.reload();
    await page.locator('#studyRoot h2').waitFor({ timeout: 15000 });
    assert.equal(await page.locator('#bookPosition').innerText(), '1 / 1', 'the wordbook resumes after a page reload');
    await page.locator('.cloze-blank').fill('borrow');
    await page.locator('.cloze-blank').press('Enter');
    await page.getByText('辅助练习与下一词位置已保存。', { exact: true }).waitFor({ timeout: 15000 });
    const completedWordbookState = await fetch(base + personalWordbookStateUrl, { headers: ownerHeaders }).then(response => response.json());
    assert.equal(completedWordbookState.resume.status, 'completed', 'a real browser answer completes the independent personal wordbook session');
    const completedWordbookLearning = await fetch(base + '/api/learning-data', { headers: ownerHeaders }).then(response => response.json());
    assert.equal(JSON.stringify(completedWordbookLearning).includes(personalWordbook.bookId), true,
      'completed practice retains only its personal learning reference');
    assert.equal(JSON.stringify(completedWordbookLearning).includes('Can I borrow your charger?'), false,
      'a real answer does not copy personal wordbook content into the learning snapshot');
    await page.reload();
    await page.getByRole('heading', { name: '本单元完成', exact: true }).waitFor({ timeout: 15000 });
    await page.goto(base + '/main.html?view=my-learning');
    await page.getByText('独立课程练习', { exact: true }).waitFor({ timeout: 20000 });
    const card = page.locator('#myLearningBody .workspace-card').filter({ hasText: '独立课程练习' });
    assert.equal(await card.count(), 1, 'owner sees the course in their learning library without account-owned body sync');
    const migratedCard = page.locator('#myLearningBody .workspace-card[data-resource="course:'+migratedDeckId+'"]');
    await migratedCard.getByRole('button', { name: '取消收藏', exact: true, includeHidden: true }).waitFor({ state: 'attached' });
    await page.reload();
    const reopenedCard = page.locator('#myLearningBody .workspace-card[data-resource="course:'+migratedDeckId+'"]');
    await reopenedCard.getByRole('button', { name: '取消收藏', exact: true, includeHidden: true }).waitFor({ state: 'attached' });
    await page.route('**/api/course-library', route => route.abort());
    await page.reload();
    const offlineCard = page.locator('#myLearningBody .workspace-card[data-resource="course:'+migratedDeckId+'"]');
    await offlineCard.getByRole('button', { name: '取消收藏', exact: true, includeHidden: true }).waitFor({ state: 'attached' });
    await page.unroute('**/api/course-library');
    await card.getByRole('link', { name: '打开内容：独立课程练习', exact: true }).click();
    await page.waitForURL(/personalCourse=/);
    const start = page.locator('#pagePractice .course-access-panel button').filter({ hasText: '开始学习' });
    await start.waitFor({ timeout: 15000 });
    await start.click();
    await page.waitForFunction(() => window.__nativeCourseSession?.gateway?.cache?.get(0)?.items?.[0]?.sentence === 'I study with a group.', null, { timeout: 15000 });
    assert.doesNotMatch(await page.locator('#pagePractice').innerText(), /启动失败：/);
    await page.goto(base + '/main.html?personalCourse=' + encodeURIComponent(mediaCourse.courseId));
    const mediaStart = page.locator('#pagePractice .course-access-panel button').filter({ hasText: '开始学习' });
    await mediaStart.waitFor({ timeout: 15000 });await mediaStart.click();
    await page.waitForFunction(() => {
      const image = document.querySelector('#courseLearningImage');
      return image && !image.hidden && image.src.startsWith('blob:') && image.complete && image.naturalWidth > 0;
    }, null, { timeout: 15000 });
    assert.equal(browserAssetRequests, 1, 'the current image is fetched on demand once');
    await page.goto(base + '/main.html?personalCourse=' + encodeURIComponent(mediaCourse.courseId));
    const cachedMediaStart = page.locator('#pagePractice .course-access-panel button').filter({ hasText: '开始学习' });
    await cachedMediaStart.waitFor({ timeout: 15000 });await cachedMediaStart.click();
    await page.waitForFunction(() => {
      const image = document.querySelector('#courseLearningImage');
      return image && !image.hidden && image.src.startsWith('blob:') && image.complete && image.naturalWidth > 0;
    }, null, { timeout: 15000 });
    assert.equal(browserAssetRequests, 1, 'the authorized release image is reused from its local cache');
    assert.match(await page.locator('#pagePractice').innerText(), /看图阅读。/);
    async function answerImageCourse(userPage) {
      const chunks = await userPage.evaluate(() => S.items[0].chunks.slice());
      assert.deepEqual(chunks, ['Read the', 'picture.']);
      for (let index = 0; index < chunks.length; index++) {
        await userPage.locator('#stageChoices .choice').evaluateAll((nodes, answer) => {
          const choice = nodes.find(node => node.dataset.v === answer);
          if (!choice) throw new Error('图文课程练习缺少预期意群：' + answer);
          choice.click();
        }, chunks[index]);
        await userPage.waitForFunction(i => S.status[i] === 'ok', index, { timeout: 10000 });
      }
      await userPage.waitForFunction(() => !$('btnNext').classList.contains('hidden'), null, { timeout: 10000 });
      await userPage.waitForFunction(async key => {
        const snapshot = await ChunkAPI.request('/api/learning-data');
        return Number(snapshot.mem?.stats?.bySentence?.[key]?.times) > 0;
      }, mediaStatKey, { timeout: 15000 });
    }
    await answerImageCourse(page);
    const ownerMediaLearning = await page.evaluate(async () => ChunkAPI.request('/api/learning-data'));
    assert.equal(ownerMediaLearning.mem.stats.bySentence[mediaStatKey].times, 1,
      'image-course answering writes the owner account learning record');
    assert.equal(readerMediaLearning.mem.stats.bySentence[mediaStatKey].times, 1,
      'both accounts independently record practice for the same image-course item');
    assert.equal(Object.keys(readerMediaLearning.mem.stats.bySentence).length, 1,
      'the reader account snapshot has no sentence statistics copied from the owner account');
    assert.equal(JSON.stringify(ownerMediaLearning).includes('Read the picture.'), false,
      'the owner learning snapshot contains no shared image-course body');
    const previewWrites = [];
    page.on('request', request => { if (request.url().includes('/api/operations') && request.method() === 'POST') previewWrites.push(request.url()); });
    await page.route('**/api/learning-data*', route => route.abort());
    await page.goto(base + '/main.html?personalCourse=' + encodeURIComponent(mediaCourse.courseId));
    const previewStart = page.locator('#pagePractice .course-access-panel button').filter({ hasText: '开始学习' });
    await previewStart.waitFor({ timeout: 15000 }); await previewStart.click();
    await page.waitForFunction(() => window.__nativeCourseSession?.readOnlyPreview === true && document.querySelector('#stage')?.inert === true,
      null, { timeout: 20000 });
    assert.match(await page.locator('#pagePractice').innerText(), /只读预览/);
    assert.match(await page.locator('#pagePractice').innerText(), /看图阅读。/);
    await page.locator('#btnNext').evaluate(button => button.click());
    await page.waitForTimeout(100);
    assert.deepEqual(previewWrites, [], 'read-only course preview sends no learning operations');
    const mediaLearningAfterPreview = await fetch(base + '/api/learning-data', { headers: ownerHeaders }).then(response => response.json());
    assert.equal(mediaLearningAfterPreview.courseProgress[mediaCourse.courseId], undefined,
      'an unconfirmed learning snapshot cannot create a course progress or enrollment reference');
    await page.unroute('**/api/learning-data*');

    const authoredImage = {
      format: 'chunklab-ai-image-text', formatVersion: '1.0', title: '制作器图文独立保存', description: '验证图文制作器保存到独立课程库。', targetCefr: 'A2',
      learning: { template: 'image-text-practice', version: 1, modes: ['typing', 'chunkSelection'], defaultMode: 'chunkSelection' },
      images: [{ key: 'cafe', fileName: 'authoring-cafe.png', alt: '咖啡店柜台' }],
      items: [
        { imageKey: 'cafe', en: 'I would like a tea.', zh: '我想要一杯茶。', chunks: ['I would like', 'a tea.'] },
        { imageKey: 'cafe', en: 'I would like some coffee.', zh: '我想要一些咖啡。', chunks: ['I would like', 'some coffee.'] }
      ]
    };
    await page.goto(base + '/course-create.html');
    await page.locator('[name="courseType"][value="imageText"]').check();
    await page.locator('.quick-import summary').click();
    await page.locator('#rawResult').fill(JSON.stringify(authoredImage));
    await page.locator('[data-action="validate-result"]').click();
    await page.locator('.issue-panel.has-error').waitFor({ timeout: 10000 });
    await page.locator('#imageFiles').setInputFiles({ name: 'authoring-cafe.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGOs2PKBgYGBiQEMABkCAiDaYDR0AAAAAElFTkSuQmCC', 'base64') });
    await page.locator('.course-summary').waitFor({ timeout: 15000 });
    await page.waitForFunction(() => document.querySelector('.image-course-preview')?.naturalWidth === 2);
    await page.locator('[data-action="save-and-join"]').click();
    await page.waitForURL(/main\.html\?personalCourse=/, { timeout: 20000 });
    const authoredId = new URL(page.url()).searchParams.get('personalCourse');
    assert.ok(authoredId, 'the authoring workflow launches the server-assigned independent course ID');
    const learningData = await page.evaluate(async () => ChunkAPI.request('/api/learning-data'));
    assert.equal(JSON.stringify(learningData).includes(authoredId), true, 'personal learning state may contain the joined course reference');
    assert.equal(JSON.stringify(learningData).includes('I would like a tea.'), false, 'personal learning state never includes authored course text');
    const authoredCourse = await page.evaluate(async id => ChunkAPI.request('/api/course-library/' + encodeURIComponent(id)), authoredId);
    assert.equal(authoredCourse.content.utterances[0].text.en, 'I would like a tea.');
    assert.equal(authoredCourse.content.utterances.length, 2, 'the independent release retains both authored image-text items');
    assert.equal(authoredCourse.content.assets.length, 1);
    assert.equal(JSON.stringify(authoredCourse).includes('base64'), false, 'course metadata stores references, not inline media bytes');
    const authoredAssetId = authoredCourse.content.assets[0].id;
    let authoredAssetRequests = 0;
    page.on('request', request => { if (request.url().includes('/assets/' + encodeURIComponent(authoredAssetId))) authoredAssetRequests++; });
    const authoredStart = page.locator('#pagePractice .course-access-panel button').filter({ hasText: '开始学习' });
    await authoredStart.waitFor({ timeout: 15000 });
    await authoredStart.click();
    await page.waitForFunction(() => {
      const image = document.querySelector('#courseLearningImage');
      return image && !image.hidden && image.src.startsWith('blob:') && image.complete && image.naturalWidth === 2;
    }, null, { timeout: 15000 });
    assert.equal(authoredAssetRequests, 1, 'the authored course image is fetched once for the first item');
    const joinedRef = Object.values(learningData.courseProgress || {}).some(row =>
      row.kind === 'course-enrollment' && row.courseId === 'personal-course:' + authoredId && row.joined === true);
    assert.equal(joinedRef, true, 'save-and-join writes the account course reference separately from independent content');
    const prefetchedNext = await page.waitForFunction(() => S.deck?._platformSession?.gateway.cache.has(1), null, { timeout: 15000 }).then(() => true).catch(() => false);
    if (!prefetchedNext) throw new Error('下一图文批次未预取：' + JSON.stringify(await page.evaluate(() => {
      const session = S.deck?._platformSession;
      return { started: session?.started, phase: session?.phase, cursor: session?.cursor,
        cache: [...(session?.gateway.cache || [])].map(([cursor, batch]) => [cursor, batch.nextCursor]),
        currentCursor: session?.gateway.currentCursor, sourceActive: session?.gateway.source?.active,
        canAdvance: session?.gateway.checkAdvance(), canPrefetch: session?.gateway.source?.canPrefetch?.(),
        error: session?.lastError?.code, itemCount: session?.unit?.itemCount };
    })));
    await page.route('**/api/course-library/**', route => route.abort());
    const firstChunks = await page.evaluate(() => cur().chunks.slice());
    for (const answer of firstChunks) {
      await page.locator('#stageChoices .choice').evaluateAll((nodes, correct) => {
        const choice = nodes.find(node => node.dataset.v === correct);
        if (!choice) throw new Error('离线续学题缺少正确意群：' + correct);
        choice.click();
      }, answer);
    }
    await page.locator('#btnNextBatch').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#btnNextBatch').click();
    await page.waitForFunction(() => {
      const image = document.querySelector('#courseLearningImage');
      return image && !image.hidden && image.src.startsWith('blob:') && image.complete && image.naturalWidth === 2;
    }, null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => cur().sentence), 'I would like some coffee.',
      'the already-prefetched next image-text item remains available after the course API is disconnected');
    assert.equal(authoredAssetRequests, 1, 'the second item reuses the previously cached release image without a network asset fetch');

    await page.unroute('**/api/course-library/**');
    await submitAccountOperation(ownerHeaders, 'independent-image-course-leave-001', 'course.enrollment',
      { courseId: 'personal-course:' + authoredId, joined: false });
    const authoredSentence = {
      format: 'chunklab-ai-course', formatVersion: '1.1', title: '句子制作独立保存', description: '验证句子课程只进入独立课程库。', targetCefr: 'A2', contentForm: 'dialogue',
      learning: { template: 'sentence-practice', version: 1, modes: ['typing', 'chunkSelection'], defaultMode: 'chunkSelection' },
      roles: [{ key: 'learner', name: '学习者' }, { key: 'teacher', name: '老师' }],
      items: [
        { en: 'I can learn anywhere.', zh: '我可以随时随地学习。', role: 'learner', chunks: ['I can learn', 'anywhere.'], hints: ['我可以学习', '在任何地方'] },
        { en: 'Practice makes progress.', zh: '练习带来进步。', role: 'teacher', chunks: ['Practice makes', 'progress.'], hints: ['练习带来', '进步'] }
      ]
    };
    await page.goto(base + '/course-create.html');
    await page.locator('.quick-import summary').click();
    await page.locator('#rawResult').fill(JSON.stringify(authoredSentence));
    await page.locator('[data-action="validate-result"]').click();
    await page.locator('.course-summary').waitFor({ timeout: 15000 });
    await page.locator('[data-action="save"]').click();
    await page.getByText('课程已保存到当前账号的课程库。', { exact: true }).waitFor({ timeout: 15000 }).catch(async error => {
      throw new Error(error.message + ' sentence-authoring-state=' + JSON.stringify({ body: (await page.locator('body').innerText()).slice(-1200), actions: await page.locator('#course-create-root [data-action]').evaluateAll(nodes => nodes.map(node => node.dataset.action)) }));
    });
    const sessionId = await page.locator('#course-create-root').getAttribute('data-session-id');
    const savedSession = await page.evaluate(async id => {
      const dbInfo = (await indexedDB.databases()).find(row => row.name && row.name.endsWith('-authoring-v1'));
      if (!dbInfo) throw new Error('authoring draft database missing');
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open(dbInfo.name); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const snapshot = await new Promise((resolve, reject) => { const request = db.transaction('sessions', 'readonly').objectStore('sessions').get(id); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      db.close();
      return snapshot;
    }, sessionId);
    assert.equal(savedSession.saveReceipt.storageKind, 'personal-course', 'sentence authoring saves to the independent course library');
    const authoredSentenceId = savedSession.saveReceipt.contentId;
    assert.ok(authoredSentenceId && authoredSentenceId !== authoredSentence.items[0].en);
    let sentenceLearningData = await page.evaluate(async () => ChunkAPI.request('/api/learning-data'));
    assert.equal(JSON.stringify(sentenceLearningData).includes(authoredSentence.items[0].en), false, 'the learning snapshot excludes saved sentence course content');
    assert.equal(JSON.stringify(sentenceLearningData).includes(authoredSentenceId), false, 'saving content alone does not create a personal learning reference');
    const independentSentence = await page.evaluate(async id => ChunkAPI.request('/api/course-library/' + encodeURIComponent(id)), authoredSentenceId);
    assert.equal(independentSentence.content.items.length, 2);
    assert.equal(independentSentence.content.items[0].sentence, authoredSentence.items[0].en);

    await page.evaluate(() => {
      window.__courseJoin = CourseEnrollment.join;
      window.__failCourseJoin = true;
      CourseEnrollment.join = function () {
        if (window.__failCourseJoin) { window.__failCourseJoin = false; return Promise.reject(new Error('simulated reference-write failure')); }
        return window.__courseJoin.apply(this, arguments);
      };
    });
    await page.locator('[data-action="join"]').click();
    await page.locator('.issue-panel.has-error').waitFor({ timeout: 10000 });
    sentenceLearningData = await page.evaluate(async () => ChunkAPI.request('/api/learning-data'));
    assert.equal(JSON.stringify(sentenceLearningData).includes(authoredSentenceId), false, 'failed join creates no false learning reference');
    assert.equal((await page.evaluate(async id => ChunkAPI.request('/api/course-library/' + encodeURIComponent(id)), authoredSentenceId)).content.items.length, 2,
      'failed join leaves the independent content intact for retry');
    await page.evaluate(() => { CourseEnrollment.join = window.__courseJoin; });
    await page.locator('[data-action="join"]').click();
    await page.waitForURL(/main\.html\?personalCourse=/, { timeout: 20000 }).catch(async error => {
      throw new Error(error.message + ' after sentence join retry: ' + JSON.stringify({ url: page.url(), body: (await page.locator('body').innerText()).slice(-1400) }));
    });
    assert.equal(new URL(page.url()).searchParams.get('personalCourse'), authoredSentenceId);
    sentenceLearningData = await page.evaluate(async () => ChunkAPI.request('/api/learning-data'));
    assert.equal(JSON.stringify(sentenceLearningData).includes(authoredSentence.items[0].en), false, 'joining still does not copy sentence content into learning data');
    assert.equal(Object.values(sentenceLearningData.courseProgress || {}).some(row => row.kind === 'course-enrollment' && row.courseId === 'personal-course:' + authoredSentenceId && row.joined === true), true,
      'joining writes only the independent course reference');
    const otherAccountRead = await fetch(base + '/api/course-library/' + encodeURIComponent(authoredSentenceId), { headers: { authorization: 'Bearer ' + secondToken } });
    assert.equal(otherAccountRead.status, 404, 'a second account cannot read the private sentence course without permission');
    const sentenceStart = page.locator('#pagePractice .course-access-panel button').filter({ hasText: '开始学习' });
    await sentenceStart.waitFor({ timeout: 15000 });
    await sentenceStart.click();
    await page.waitForFunction(() => S.deck?.name === '句子制作独立保存' && S.items?.length === 2, null, { timeout: 15000 });
    assert.equal(await page.locator('#courseContext').innerText(), '角色：学习者');
    assert.equal(await page.evaluate(() => CL.loadMem().decks.some(deck => deck.name === '句子制作独立保存')), false,
      'the native player does not add the course body to the personal deck snapshot');
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('independent course E2E: personal vocabulary creation/export, references-only resume, sentence and image authoring, private ACL and practice passed on port ' + port);
  } finally {
    if (browser) await browser.close();
    if (server && server.exitCode === null) await new Promise(resolve => { server.once('close', resolve); server.kill(); });
    assert.equal(path.dirname(temp), os.tmpdir());
    assert.ok(path.basename(temp).startsWith('chunk-independent-course-e2e-'));
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error.stack || error); console.error(logs.slice(-3000)); process.exitCode = 1; });
