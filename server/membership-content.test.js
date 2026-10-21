'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { spawn } = require('node:child_process');
const Database = require('better-sqlite3');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function availablePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}
async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-protected-courses-'));
  const appRoot = path.join(root, 'app'), dataRoot = path.join(root, 'data'), privateRoot = path.join(dataRoot, 'membership-content');
  let child, db, log = '';
  try {
    fs.mkdirSync(path.join(appRoot, 'content'), { recursive: true });
    fs.mkdirSync(privateRoot, { recursive: true });
    fs.writeFileSync(path.join(appRoot, 'content/manifest.json'), JSON.stringify({ schemaVersion: 1, contentVersion: crypto.randomUUID(), decks: [] }));
    const secretItems = Array.from({ length: 12 }, (_, i) => ({ cid: 'secret-' + i, sentence: 'PRIVATE SENTENCE ' + i, translation: '合成测试句子', chunks: ['PRIVATE', 'SENTENCE', String(i)], hints: ['测试', '测试', '测试'] }));
    const freeItems = [{ cid: 'free-0', sentence: 'FREE SENTENCE', translation: '免费测试句子' }];
    fs.writeFileSync(path.join(privateRoot, 'mixed.json'), JSON.stringify({ items: freeItems.concat(secretItems) }));
    fs.writeFileSync(path.join(privateRoot, 'image.json'), JSON.stringify({ schemaVersion: '2.0', utterances: [
      { id: 'line-1', text: { en: 'PRIVATE IMAGE FIRST', 'zh-CN': '第一句' }, imageAssetId: 'image-1', audioAssetId: 'audio-1' },
      { id: 'line-2', text: { en: 'PRIVATE IMAGE SECOND', 'zh-CN': '第二句' }, imageAssetId: 'image-2' }
    ] }));
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR5kAAAAASUVORK5CYII=', 'base64');
    fs.writeFileSync(path.join(privateRoot, 'first.png'), png);
    fs.writeFileSync(path.join(privateRoot, 'second.png'), png);
    fs.writeFileSync(path.join(privateRoot, 'voice.mp3'), Buffer.from('ID3 synthetic protected audio'));
    const unit = ids => ({ unitId: 'unit-1', contentRef: { type: 'sentence-deck', id: 'shared-deck' }, file: 'mixed.json', itemIds: ids, assets: [] });
    const course = (courseId, ids) => ({ courseId, title: courseId, contentType: 'sentence', defaultAccess: 'free', units: [unit(ids)], sourcePaths: [], legacyDeckIds: [] });
    const sentence = { ...course('secure-sentence', secretItems.map(item => item.cid)),
      sourcePaths: ['/source-course.js', '/content/mixed.json', '/content/index.json', '/packages/full.json'], legacyDeckIds: ['secret-public'] };
    const image = { courseId: 'secure-image', title: '合成图文课', contentType: 'image-text', defaultAccess: 'free',
      sourcePaths: ['/images/secret.png', '/audio/secret.mp3'], legacyDeckIds: [],
      units: [{ unitId: 'unit-1', contentRef: { type: 'story-package', id: 'image-course' }, file: 'image.json',
        itemIds: ['line-1', 'line-2'], assets: [{ assetId: 'image-1', file: 'first.png', mimeType: 'image/png' },
          { assetId: 'image-2', file: 'second.png', mimeType: 'image/png' }, { assetId: 'audio-1', file: 'voice.mp3', mimeType: 'audio/mpeg' }] }] };
    const physicalOverlap = course('physical-overlap', ['secret-1']);
    physicalOverlap.units[0].contentRef.id = 'different-logical-alias';
    const fragmentItems = secretItems.map((item, index) => ({ ...item, cid: 'fragment-' + index }));
    const fragments = new (require('./services/membership/static-fragment-builder').StaticFragmentBuilder)().build({ courseId: 'fragmented', unitId: 'unit-1', contentType: 'sentence',
      content: { items: fragmentItems }, itemIds: fragmentItems.map(item => item.cid), recordIdentity: { deckId: 'original-fragment-deck', generationScope: 'course:original-fragment-deck', resumeIdentity: 'original-fragment-deck' } });
    for (const file of fragments.files) fs.writeFileSync(path.join(privateRoot, file.name), file.bytes, { flag: 'wx' });
    const fragmented = { ...course('fragmented', fragmentItems.map(item => item.cid)), units: [{ unitId: 'unit-1', contentRef: { type: 'sentence-deck', id: 'fragment-source' }, itemIds: fragmentItems.map(item => item.cid),
      fragments: fragments.fragments, contentVersion: fragments.contentVersion, recordIdentity: fragments.recordIdentity, assets: [] }] };
    const manifest = { schemaVersion: 1, courses: [sentence, image, fragmented, course('free-sentence', ['free-0']), course('overlap', ['secret-0']), physicalOverlap] };
    fs.writeFileSync(path.join(privateRoot, 'registry.json'), JSON.stringify(manifest));
    for (const alias of sentence.sourcePaths.concat(image.sourcePaths)) {
      const target = path.join(appRoot, alias);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, 'PRIVATE ALIAS MUST NEVER BE SERVED');
      fs.writeFileSync(target + '.br', zlib.brotliCompressSync(Buffer.from('PRIVATE COMPRESSED ALIAS')));
      fs.writeFileSync(target + '.gz', zlib.gzipSync(Buffer.from('PRIVATE COMPRESSED ALIAS')));
    }
    const port = await availablePort();
    const key = crypto.randomBytes(32).toString('base64');
    child = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
      cwd: path.resolve(__dirname, '..'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test', REQUIRE_AUTH: 'true', PHONE_AUTH_ENABLED: 'false',
        CHUNKLAB_DATA_DIR: dataRoot, CHUNKLAB_APP_ROOT: appRoot, PORT: String(port), HOST: '127.0.0.1',
        JWT_SECRET: crypto.randomBytes(40).toString('hex'), ADMIN_JWT_SECRET: crypto.randomBytes(40).toString('hex'),
        ADMIN_PASSWORD: 'SyntheticAdmin2026!', MEMBERSHIP_CODE_HMAC_CURRENT: 'fixture-v1', MEMBERSHIP_CONTENT_GRANT_KEY: crypto.randomBytes(32).toString('base64'),
        MEMBERSHIP_CODE_HMAC_KEYS: JSON.stringify({ 'fixture-v1': key }) }
    });
    child.stdout.on('data', bytes => { log += bytes; });
    child.stderr.on('data', bytes => { log += bytes; });
    const deadline = Date.now() + 15000;
    while (!log.includes('listening on http://127.0.0.1:' + port)) {
      if (child.exitCode !== null || Date.now() > deadline) throw new Error('Isolated child failed to start: ' + log.slice(-1500));
      await delay(50);
    }
    assert.ok(child.pid && child.exitCode === null, 'the listening instance is this test child');
    const base = 'http://127.0.0.1:' + port;
    const request = (url, token, body, method) => fetch(base + url, { method: method || (body ? 'POST' : 'GET'),
      headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    const json = async (url, token, body, method) => {
      const response = await request(url, token, body, method);
      return { status: response.status, data: await response.json(), headers: response.headers };
    };
    const admin = (await json('/api/admin/login', null, { password: 'SyntheticAdmin2026!' })).data.token;
    assert.ok(admin);
    const learner = (await json('/api/auth/register', null, { username: 'synthetic-learner', password: 'SyntheticLearner2026!' })).data;
    const other = (await json('/api/auth/register', null, { username: 'synthetic-other', password: 'SyntheticLearner2026!' })).data;
    db = new Database(path.join(dataRoot, 'chunklab.db'));
    const settings = (await json('/api/admin/membership/settings', admin)).data.settings;
    assert.equal((await json('/api/admin/membership/settings', admin, { baseRevision: settings.revision, enabled: true, trialDays: 3, dailyLimitSeconds: 2, salesUrl: '' }, 'PUT')).status, 200);
    const policies = (await json('/api/admin/membership/course-access', admin)).data;
    const changes = [{ courseId: 'secure-sentence', baseRevision: 0, accessLevel: 'member' }];
    const conflict = await json('/api/admin/membership/course-access/preview', admin, { changes, registryVersion: policies.version });
    assert.equal(conflict.status, 200);
    assert.equal(conflict.data.allowed, false);
    assert.equal(conflict.data.conflicts[0].conflictingCourseId, 'overlap');
    assert.ok(conflict.data.conflicts.some(item => item.conflictingCourseId === 'physical-overlap'), 'different aliases of the same private file cannot bypass shared-free checks');
    changes.push({ courseId: 'fragmented', baseRevision: 0, accessLevel: 'member' }, { courseId: 'overlap', baseRevision: 0, accessLevel: 'member' }, { courseId: 'secure-image', baseRevision: 0, accessLevel: 'member' },
      { courseId: 'physical-overlap', baseRevision: 0, accessLevel: 'member' });
    const publish = await json('/api/admin/membership/course-access', admin, { changes, registryVersion: policies.version, requestId: 'fixture_publish_000001', reason: 'synthetic fixture' }, 'PUT');
    assert.equal(publish.status, 200);
    const fragmentUser = (await json('/api/auth/register', null, { username: 'synthetic-fragments', password: 'SyntheticLearner2026!' })).data;
    const fragmentStartInput = { courseId: 'fragmented', unitId: 'unit-1', cursor: 0, purpose: 'practice', requestId: crypto.randomUUID() };
    const rejectedGrant = await json('/api/learning-sessions/start', fragmentUser.token, { ...fragmentStartInput, purpose: 'invalid' });
    assert.equal(rejectedGrant.status, 400);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_trial_state WHERE user_id=?').get(fragmentUser.user.id).count, 0, 'grant failure rolls back trial');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM course_learning_start_receipts WHERE user_id=?').get(fragmentUser.user.id).count, 0, 'grant failure rolls back receipt');
    const fragmentedStart = await json('/api/learning-sessions/start', fragmentUser.token, fragmentStartInput);
    assert.equal(fragmentedStart.status, 200, JSON.stringify(fragmentedStart.data));
    assert.equal(fragmentedStart.data.unit.items.length, 10);
    assert.equal(fragmentedStart.data.headerName, 'X-Course-Grant');
    assert.ok(fragmentedStart.data.expiresAt <= fragmentedStart.data.leaseEndsAt);
    assert.deepEqual(fragmentedStart.data.unit.recordIdentity, fragments.recordIdentity);
    assert.equal((await json('/api/learning-sessions/start', fragmentUser.token, fragmentStartInput)).data.replay, true, 'lost-response retry preserves start receipt');
    const fragmentHeaders = { Authorization: 'Bearer ' + fragmentUser.token, 'X-Course-Grant': fragmentedStart.data.grant, 'X-Course-Id': 'fragmented', 'X-Course-Unit': 'unit-1' };
    const firstFragment = await fetch(base + '/api/course-fragments/' + fragments.fragments[0].fragmentId, { headers: fragmentHeaders });
    assert.equal(firstFragment.status, 200);
    assert.deepEqual(Buffer.from(await firstFragment.arrayBuffer()), fragments.files[0].bytes);
    assert.equal((await fetch(base + '/api/course-fragments/' + fragments.fragments[1].fragmentId, { headers: fragmentHeaders })).status, 403);
    const nextGrant = await json('/api/learning-sessions/content-grant', fragmentUser.token, { ...fragmentStartInput, cursor: 10, sessionId: fragmentedStart.data.sessionId, requestId: crypto.randomUUID() });
    assert.equal(nextGrant.status, 200);
    assert.equal(nextGrant.data.fragments[0].fragmentId, fragments.fragments[1].fragmentId);
    assert.equal(nextGrant.data.unit, undefined, 'later grants exchange only metadata');
    assert.equal((await fetch(base + '/api/course-fragments/' + fragments.fragments[0].fragmentId, { headers: { ...fragmentHeaders, Authorization: 'Bearer ' + other.token } })).status, 403);
    assert.equal((await json('/api/learning-sessions/' + fragmentedStart.data.sessionId + '/pause', fragmentUser.token, { sequence: 1 })).status, 200);
    assert.equal((await fetch(base + '/api/course-fragments/' + fragments.fragments[0].fragmentId, { headers: fragmentHeaders })).status, 403, 'paused real trial invalidates hot fragment cache');
    const catalog = (await json('/api/course-content/catalog')).data;
    assert.equal(catalog.courses.find(row => row.courseId === 'secure-image').accessLevel, 'member');
    assert.doesNotMatch(JSON.stringify(catalog), /PRIVATE|first\.png|mixed\.json|sessionId/);
    for (const url of ['/source-course.js', '/%73ource-course.js', '/%2573ource-course.js', '/%2Fsource-course.js', '//source-course.js', '/source-course.js.br',
      '/source-course.js.gz', '/content/mixed.json', '/content/index.json', '/packages/full.json', '/images/secret.png', '/audio/secret.mp3']) {
      const response = await request(url);
      assert.equal(response.status, 403, url);
      assert.doesNotMatch(await response.text(), /PRIVATE/);
    }
    assert.equal((await fetch(base + '/source-course.js', { method: 'HEAD' })).status, 403);
    assert.equal((await fetch(base + '/source-course.js', { headers: { Range: 'bytes=0-10' } })).status, 403);
    assert.equal((await request('/api/deck/public/secret-public')).status, 403);
    assert.equal((await request('/api/course-content/secure-sentence/units/unit-1')).status, 401);
    fs.writeFileSync(path.join(privateRoot, 'mixed.json'), JSON.stringify({ items: freeItems.concat(secretItems.map((item, i) => i ? item : { ...item, sentence: '' })) }));
    const invalidContent = await json('/api/learning-sessions/start', learner.token, { courseId: 'secure-sentence', unitId: 'unit-1', cursor: 0, requestId: 'fixture_invalid_content_01' });
    assert.equal(invalidContent.status, 503, 'unlearnable content cannot start the trial');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_trial_state WHERE user_id=?').get(learner.user.id).count, 0);
    fs.writeFileSync(path.join(privateRoot, 'mixed.json'), JSON.stringify({ items: freeItems.concat(secretItems) }));
    const { MembershipClient } = await import('../src/membership/client.mjs');
    const { LearningSessionController } = await import('../src/membership/learning-session-controller.mjs');
    const clientUser = (await json('/api/auth/register', null, { username: 'synthetic-client', password: 'SyntheticLearner2026!' })).data;
    const client = new MembershipClient({ request: async (url, options = {}) => {
      const response = await fetch(base + url, { ...options, headers: { Authorization: 'Bearer ' + clientUser.token,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error(data.reasonCode || data.code), { status: response.status, code: data.reasonCode || data.code });
      return data;
    } });
    const controller = new LearningSessionController({ client, newRequestId: () => crypto.randomUUID() });
    try {
      await controller.start({ courseId: 'secure-image', unitId: 'unit-1', cursor: 0 });
      assert.equal(controller.canAdvance(), true);
      await controller.heartbeat();
      assert.equal(controller.current.sequence, 1);
      const clientRead = await controller.read('secure-image', 'unit-1', 1);
      assert.equal(clientRead.unit.items[0].id, 'line-2');
      await controller.pause();
      assert.equal(controller.canAdvance(), false);
      assert.equal(db.prepare("SELECT COUNT(*) AS count FROM user_trial_sessions WHERE user_id=? AND status='active'").get(clientUser.user.id).count, 0);
      await controller.start({ courseId: 'secure-image', unitId: 'unit-1', cursor: 1 });
      assert.equal(controller.canAdvance(), true);
      await controller.pause();
    } finally { controller.reset(); }
    const invalid = await json('/api/learning-sessions/start', learner.token, { courseId: 'secure-sentence', unitId: 'unit-1', cursor: 100, requestId: 'fixture_invalid_000001' });
    assert.equal(invalid.status, 400);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_trial_state WHERE user_id=?').get(learner.user.id).count, 0);
    const startInput = { courseId: 'secure-sentence', unitId: 'unit-1', cursor: 0, requestId: 'fixture_start_000001' };
    const started = await json('/api/learning-sessions/start', learner.token, startInput);
    assert.equal(started.status, 200);
    assert.equal(started.data.unit.items.length, 10);
    assert.equal((await json('/api/learning-sessions/start', learner.token, startInput)).data.sessionId, started.data.sessionId);
    assert.equal((await json('/api/learning-sessions/start', learner.token, { ...startInput, cursor: 10 })).status, 409);
    const imageInput = { courseId: 'secure-image', unitId: 'unit-1', requestId: 'fixture_image_start_001' };
    assert.equal((await json('/api/learning-sessions/start', learner.token, imageInput)).data.reasonCode, 'SESSION_IN_USE');
    const imageStart = await json('/api/learning-sessions/start', learner.token, { ...imageInput, takeover: true });
    assert.equal(imageStart.status, 200);
    assert.equal(imageStart.data.unit.items.length, 1);
    const authorized = url => fetch(base + url, { headers: { Authorization: 'Bearer ' + learner.token, 'X-Learning-Session': imageStart.data.sessionId } });
    const asset = await authorized('/api/course-content/secure-image/units/unit-1/assets/image-1');
    assert.equal(asset.status, 200);
    assert.equal(asset.headers.get('cache-control'), 'private, no-store');
    assert.equal(asset.headers.get('x-content-type-options'), 'nosniff');
    assert.equal((await authorized('/api/course-content/secure-image/units/unit-1/assets/image-2')).status, 403);
    assert.equal((await fetch(base + '/api/course-content/secure-image/units/unit-1', { headers: { Authorization: 'Bearer ' + other.token, 'X-Learning-Session': imageStart.data.sessionId } })).status, 403);
    assert.equal((await request('/api/course-content/free-sentence/units/unit-1')).status, 200);
    const free = (await json('/api/course-content/free-sentence/units/unit-1')).data;
    assert.equal(free.unit.items[0].sentence, 'FREE SENTENCE');
    assert.doesNotMatch(JSON.stringify(free), /PRIVATE/);
    assert.equal((await request('/api/course-content/free-sentence/units/unit-1/assets/image-1')).status, 404);
    await delay(2100);
    assert.equal((await authorized('/api/course-content/secure-image/units/unit-1')).status, 403);
    const lateAnswer = { protocol: 3, requestId: 'fixture_late_answer_001', type: 'learning.answer',
      payload: { eventId: 'fixture_answer_event_001', key: 'shared-deck#secret-0', deckId: 'shared-deck', courseId: 'secure-sentence', ok: true, sessionId: started.data.sessionId, occurredAt: Date.now() - 2000 } };
    assert.equal((await json('/api/operations', learner.token, lateAnswer)).status, 200, 'completed answer still saves after quota expires');
    const blockedAssessment=await json('/api/operations',learner.token,{protocol:3,requestId:crypto.randomUUID(),type:'assessment.start',
      payload:{eventId:crypto.randomUUID(),sessionId:crypto.randomUUID(),keys:['shared-deck#secret-0']}});
    assert.equal(blockedAssessment.status,403,'internal assessment resolver cannot bypass protected source routes');
    assert.equal(blockedAssessment.data.code,'PROTECTED_COURSE_ENTRY_REQUIRED');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_learning_events WHERE user_id=?').get(learner.user.id).count, 1);
    const trialSnapshot = db.prepare('SELECT * FROM user_trial_state WHERE user_id=?').get(learner.user.id);
    const currentSettings = (await json('/api/admin/membership/settings', admin)).data.settings;
    await json('/api/admin/membership/settings', admin, { baseRevision: currentSettings.revision, enabled: true, trialDays: 5, dailyLimitSeconds: 300, salesUrl: '' }, 'PUT');
    assert.equal(db.prepare('SELECT daily_limit_seconds FROM user_trial_state WHERE user_id=?').get(learner.user.id).daily_limit_seconds, 2);
    const shiftedStart = Date.now() - 86400000 - 1000;
    db.prepare('UPDATE user_trial_state SET started_at=?,ends_at=? WHERE user_id=?').run(shiftedStart, shiftedStart + trialSnapshot.trial_days * 86400000, learner.user.id);
    assert.equal((await json('/api/learning-sessions/start', learner.token, { ...startInput, requestId: 'fixture_next_day_000001' })).status, 200, 'next 24h window restores only the original quota');
    db.prepare('UPDATE user_trial_state SET ends_at=? WHERE user_id=?').run(Date.now() - 1, learner.user.id);
    // Expiring a trial also expires its synthetic active lease.
    db.prepare("UPDATE user_trial_sessions SET lease_ends_at=? WHERE user_id=? AND status='active'").run(Date.now() - 1, learner.user.id);
    assert.equal((await json('/api/course-content/secure-sentence/units/unit-1', learner.token)).data.reasonCode, 'TRIAL_EXPIRED');
    async function buy(planKey, suffix) {
      const issued = await request('/api/admin/membership/code-batches/issue-export', admin, { planKey, quantity: 1, requestId: 'fixture_issue_' + suffix });
      assert.equal(issued.status, 200);
      const csv = await issued.text(), code = csv.match(/"(CL1(?:-[A-Z2-7]{4}){8})"/)[1];
      const batchId = issued.headers.get('x-membership-batch-id');
      assert.equal((await json('/api/admin/membership/code-batches/' + batchId + '/action', admin, { action: 'activate', baseRevision: 1, requestId: 'fixture_activate_' + suffix })).status, 200);
      assert.equal((await json('/api/membership/redeem', learner.token, { code, requestId: 'fixture_redeem_' + suffix })).status, 200);
    }
    await buy('monthly', 'monthly_000001');
    assert.equal((await request('/api/course-content/secure-sentence/units/unit-1?cursor=10', learner.token)).status, 200);
    db.prepare('UPDATE user_entitlement_grants SET redeemed_at=? WHERE user_id=?').run(Date.now() - 200 * 86400000, learner.user.id);
    assert.equal((await request('/api/course-content/secure-image/units/unit-1', learner.token)).status, 403, 'expired membership stops the next content request');
    await buy('yearly', 'yearly_000001');
    const resumed = (await json('/api/course-content/secure-sentence/units/unit-1?cursor=10', learner.token)).data;
    assert.equal(resumed.unit.items[0].cid, 'secret-10', 'renewal can resume at the caller existing cursor');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_learning_events WHERE user_id=?').get(learner.user.id).count, 1, 'renewal preserves the learned event');
    assert.equal((await request('/api/course-content/free-sentence/units/unit-1')).status, 200);
    const { DRAFT_SPEC } = await import('../src/course-authoring/draft-spec.mjs');
    const { IMAGE_TEXT_DRAFT_EXAMPLE } = await import('../src/course-authoring/image-text-draft-spec.mjs');
    const registryOriginal = fs.readFileSync(path.join(privateRoot, 'registry.json'), 'utf8');
    const draftInput = { draft: DRAFT_SPEC.examples.at(-1), images: [], requestId: crypto.randomUUID() };
    assert.equal((await json('/api/admin/membership/course-publications/prepare', null, draftInput)).status, 401);
    const prepared = await json('/api/admin/membership/course-publications/prepare', admin, draftInput);
    assert.equal(prepared.status, 200, JSON.stringify(prepared.data));
    assert.equal((await json('/api/admin/membership/course-publications/prepare', admin, draftInput)).data.publicationId, prepared.data.publicationId);
    assert.equal((await json('/api/admin/membership/course-publications/prepare', admin, { ...draftInput, images: [{ name: 'changed' }] })).status, 409);
    assert.ok(!(await json('/api/course-content/catalog')).data.courses.some(course => course.courseId === prepared.data.publicationId));
    const publicationInput = { publicationId: prepared.data.publicationId, contentHash: prepared.data.contentHash, registryVersion: prepared.data.registryVersion,
      accessLevel: 'member', acceptWarnings: true, requestId: crypto.randomUUID() };
    db.exec("CREATE TRIGGER fixture_publish_failure BEFORE INSERT ON course_access_revisions WHEN NEW.course_id='" + prepared.data.publicationId + "' BEGIN SELECT RAISE(FAIL,'fixture failed commit'); END");
    assert.equal((await json('/api/admin/membership/course-publications/publish', admin, publicationInput)).status, 503);
    assert.equal(db.prepare('SELECT status FROM membership_course_publications WHERE publication_id=?').get(prepared.data.publicationId).status, 'draft');
    db.exec('DROP TRIGGER fixture_publish_failure');
    assert.equal((await json('/api/admin/membership/course-publications/publish', admin, publicationInput)).status, 200);
    assert.equal((await json('/api/admin/membership/course-publications/publish', admin, publicationInput)).data.replay, true);
    assert.equal((await request('/api/course-content/' + prepared.data.publicationId + '/units/lesson-1')).status, 410);
    assert.equal((await request('/api/course-content/' + prepared.data.publicationId + '/units/lesson-1', learner.token)).status, 410);
    const imageDraftInput = { draft: IMAGE_TEXT_DRAFT_EXAMPLE, images: [{ name: 'cafe-counter.png', mimeType: 'image/png', base64: png.toString('base64') }], requestId: crypto.randomUUID() };
    const imagePrepared = await json('/api/admin/membership/course-publications/prepare', admin, imageDraftInput);
    assert.equal(imagePrepared.status, 200, JSON.stringify(imagePrepared.data));
    assert.equal((await json('/api/admin/membership/course-publications/prepare', admin, { ...imageDraftInput, requestId: crypto.randomUUID(), images: [{ ...imageDraftInput.images[0], base64: Buffer.from('not an image').toString('base64') }] })).status, 422);
    assert.equal((await json('/api/admin/membership/course-publications/publish', admin, { publicationId: imagePrepared.data.publicationId, contentHash: imagePrepared.data.contentHash,
      registryVersion: imagePrepared.data.registryVersion, accessLevel: 'free', acceptWarnings: true, requestId: crypto.randomUUID() })).status, 200);
    const publishedImageStart=await json('/api/learning-sessions/start',learner.token,{courseId:imagePrepared.data.publicationId,unitId:'lesson-1',requestId:crypto.randomUUID()});
    assert.equal(publishedImageStart.status,200,JSON.stringify(publishedImageStart.data));
    const publishedImage = publishedImageStart.data.unit;
    assert.equal(publishedImage.items.length, 1);
    assert.equal((await request('/api/course-content/' + imagePrepared.data.publicationId + '/units/lesson-1/assets/' + publishedImage.assetIds[0])).status, 410);
    assert.equal((await fetch(base+'/api/course-assets/'+encodeURIComponent(publishedImage.assetIds[0]),{headers:{Authorization:'Bearer '+learner.token,'X-Course-Grant':publishedImageStart.data.grant,
      'X-Course-Id':imagePrepared.data.publicationId,'X-Course-Unit':'lesson-1'}})).status,200);
    assert.equal(fs.readFileSync(path.join(privateRoot, 'registry.json'), 'utf8'), registryOriginal, 'publishing never rewrites the original registry or courses');
    const {deckIdentity}=require('./services/membership/assessment-content');
    const assessmentDeck=deckIdentity('secure-sentence','unit-1'),assessmentKey=assessmentDeck+'#secret-0';
    const assessmentInput={courseId:'secure-sentence',unitId:'unit-1',itemId:'secret-0',assessmentId:crypto.randomUUID(),requestId:crypto.randomUUID()};
    const ineligible=await json('/api/protected-assessments/start',other.token,assessmentInput);
    assert.equal(ineligible.status,409,JSON.stringify(ineligible.data));
    assert.equal(ineligible.data.code,'ASSESSMENT_NOT_ELIGIBLE');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_trial_state WHERE user_id=?').get(other.user.id).count,0,'ineligible assessment does not start trial');
    db.prepare('INSERT INTO user_sentence_stats(user_id,sentence_key,deck_id,data_json) VALUES(?,?,?,?)').run(other.user.id,assessmentKey,assessmentDeck,
      JSON.stringify({deckId:assessmentDeck,times:1,lastAt:Date.now()-2*86400000}));
    db.prepare('INSERT INTO user_learning_generations(user_id,scope_key,generation) VALUES(?,?,2)').run(other.user.id,'course:secure-sentence');
    db.exec("CREATE TRIGGER synthetic_assessment_failure BEFORE INSERT ON user_assessment_sessions BEGIN SELECT RAISE(FAIL,'synthetic assessment commit failure'); END");
    assert.equal((await json('/api/protected-assessments/start',other.token,assessmentInput)).status,503);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_trial_state WHERE user_id=?').get(other.user.id).count,0,'failed assessment creation rolls back trial activation');
    db.exec('DROP TRIGGER synthetic_assessment_failure');
    const assessmentStart=await json('/api/protected-assessments/start',other.token,assessmentInput);
    assert.equal(assessmentStart.status,200,JSON.stringify(assessmentStart.data));
    assert.equal(assessmentStart.data.mode,'trial');assert.equal(assessmentStart.data.unit,undefined);
    assert.equal(assessmentStart.data.session.items.length,1);
    assert.equal(db.prepare('SELECT generation FROM user_assessment_sessions WHERE user_id=? AND session_id=?').get(other.user.id,assessmentInput.assessmentId).generation,2);
    assert.equal((await json('/api/protected-assessments/start',other.token,assessmentInput)).status,200);
    assert.equal((await json('/api/protected-assessments/start',other.token,{...assessmentInput,itemId:'secret-1'})).status,409);
    assert.equal((await request('/api/assessment-sessions/'+assessmentInput.assessmentId,learner.token)).status,404);
    db.prepare('UPDATE user_trial_state SET ends_at=? WHERE user_id=?').run(Date.now()-1,other.user.id);
    db.prepare('UPDATE user_trial_sessions SET lease_ends_at=? WHERE user_id=?').run(Date.now()-1,other.user.id);
    const expiredAssessment=await json('/api/protected-assessments/start',other.token,{...assessmentInput,requestId:crypto.randomUUID()});
    assert.equal(expiredAssessment.status,403);
    const assessmentAnswer={protocol:3,requestId:crypto.randomUUID(),type:'assessment.answer',payload:{eventId:crypto.randomUUID(),sessionId:assessmentInput.assessmentId,itemIndex:0,answers:secretItems[0].chunks}};
    assert.equal((await json('/api/operations',other.token,assessmentAnswer)).status,200,'completed assessment answer saves after expiry');
    const assessmentFinal={protocol:3,requestId:crypto.randomUUID(),type:'assessment.finalize',payload:{eventId:crypto.randomUUID(),sessionId:assessmentInput.assessmentId}};
    const finalized=await json('/api/operations',other.token,assessmentFinal);
    assert.equal(finalized.status,200,JSON.stringify(finalized.data));assert.equal(finalized.data.operation.result.passed,true);
    assert.equal((await json('/api/operations',other.token,assessmentFinal)).status,200);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_learning_events WHERE user_id=?').get(other.user.id).count,1,'idempotent finalization records assessment once');
    assert.equal((await request('/api/assessment-sessions/'+assessmentInput.assessmentId,other.token)).status,200,'owned historical result remains readable after expiry');
    fs.writeFileSync(path.join(privateRoot, 'registry.json'), '{invalid registry');
    assert.equal((await request('/source-course.js')).status, 503, 'broken registry cannot reopen static member aliases');
    assert.equal((await request('/api/course-content/secure-image/units/unit-1', learner.token)).status, 503);
    assert.equal((await request('/api/data', learner.token)).status, 200, 'history stays readable during content service failure');
    fs.writeFileSync(path.join(privateRoot, 'registry.json'), JSON.stringify(manifest));
    console.log('isolated real server: protected sentence/image lessons, aliases, conflicts, quota, late saves, expiry, and renewal passed');
  } finally {
    if (db) db.close();
    if (child && child.exitCode === null) { child.kill(); await new Promise(resolve => child.once('exit', resolve)); }
    fs.rmSync(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
