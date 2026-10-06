'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { freePort } = require('../e2e/lib/free-port');

const PORT = freePort(9520, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-content-studio-'));
const TMP_APP = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-content-publish-'));
const TMP_OUTPUT = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-content-build-'));
const BASE = 'http://127.0.0.1:' + PORT;
let child;

function makeIsolatedContentRoot() {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'manifest.json'), 'utf8'));
  const entry = manifest.decks.find((course) => course.id === 'oral-basic');
  manifest.decks = [entry];
  fs.mkdirSync(path.join(TMP_APP, 'content'), { recursive: true });
  fs.mkdirSync(path.join(TMP_APP, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(TMP_APP, 'content', 'oral-basic'), { recursive: true });
  fs.writeFileSync(path.join(TMP_APP, 'content', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  for (const file of entry.shards.concat(entry.indexShards)) {
    fs.copyFileSync(path.resolve(__dirname, '..', file.url), path.join(TMP_APP, file.url));
  }
  // Rebuild from dedicated temporary source files, not a generated oral-book.js
  // in the user's checkout. Published overrides must apply to these originals.
  const sourceItems = entry.shards.flatMap(file => JSON.parse(fs.readFileSync(path.join(TMP_APP, file.url), 'utf8')).items);
  const sourceBook = { series: 'Isolated fixture', chapters: [], decks: [{ id: entry.id, name: entry.name, items: sourceItems }] };
  fs.writeFileSync(path.join(TMP_APP, 'oral-book.js'), 'window.ORAL_BOOK = ' + JSON.stringify(sourceBook) + ';\n');
  fs.mkdirSync(path.join(TMP_APP, 'extra'), { recursive: true });
  fs.copyFileSync(path.resolve(__dirname, '..', 'extra/course-catalog.json'), path.join(TMP_APP, 'extra/course-catalog.json'));
  fs.copyFileSync(path.resolve(__dirname, '..', 'freq-idioms.js'), path.join(TMP_APP, 'freq-idioms.js'));
  fs.copyFileSync(path.join(__dirname, '..', 'scripts', 'sw-hash.js'), path.join(TMP_APP, 'scripts', 'sw-hash.js'));
  fs.writeFileSync(path.join(TMP_APP, 'sw.js'), "const CACHE = 'chunklab-test';\nconst PRECACHE = [\n  '/content/manifest.json',\n];\nconst PRECACHE_SOFT = [\n];\n");
}

function request(method, url, token, body) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : JSON.stringify(body);
    const req = http.request(BASE + url, {
      method,
      headers: Object.assign({}, payload ? { 'Content-Type': 'application/json' } : {}, token ? { Authorization: 'Bearer ' + token } : {}),
    }, (res) => {
      let raw = '';
      res.on('data', (part) => { raw += part; });
      res.on('end', () => {
        let json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch (error) { /* retain raw */ }
        resolve({ status: res.statusCode, json, raw });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function waitHealthy() {
  const until = Date.now() + 15000;
  return new Promise((resolve, reject) => {
    (function poll() {
      request('GET', '/api/health').then((res) => {
        if (res.status === 200) return resolve();
        if (Date.now() > until) return reject(new Error('content studio test server did not become healthy'));
        setTimeout(poll, 200);
      }).catch((error) => {
        if (Date.now() > until) return reject(error);
        setTimeout(poll, 200);
      });
    })();
  });
}

async function stop() {
  if (child) {
    const processToStop = child;
    child = null;
    await new Promise((resolve) => {
      processToStop.once('exit', resolve);
      processToStop.kill('SIGKILL');
    });
  }
  fs.rmSync(TMP_DB, { recursive: true, force: true });
  fs.rmSync(TMP_APP, { recursive: true, force: true });
  fs.rmSync(TMP_OUTPUT, { recursive: true, force: true });
}

async function main() {
  makeIsolatedContentRoot();
  child = spawn(process.execPath, ['index.js'], {
    cwd: __dirname,
    env: Object.assign({}, process.env, {
      NODE_ENV: 'test',
      REQUIRE_AUTH: 'true',
      JWT_SECRET: 'content-studio-test-secret-not-for-production',
      ADMIN_PASSWORD: 'studio-test-password',
      ADMIN_JWT_SECRET: 'content-studio-admin-secret-not-for-production-012345',
      CHUNKLAB_WRITE_PROTOCOL: '3',
      PORT: String(PORT),
      CHUNKLAB_DATA_DIR: TMP_DB,
      CHUNKLAB_APP_ROOT: TMP_APP,
    }),
    stdio: 'ignore',
  });

  try {
    await waitHealthy();
    const protocol = await request('GET', '/api/config');
    assert.equal(protocol.json.writeProtocol, 3, 'the test exercises content authoring while account writes use protocol 3');
    const denied = await request('GET', '/api/admin/content/courses');
    assert.equal(denied.status, 401, 'course catalog is admin-only');
    const quarantinesDenied = await request('GET', '/api/admin/sync-quarantines');
    assert.equal(quarantinesDenied.status, 401, 'sync quarantine status is not exposed to ordinary users');

    const login = await request('POST', '/api/admin/login', null, { password: 'studio-test-password' });
    assert.equal(login.status, 200, login.raw);
    const token = login.json.token;

    const quarantineIndex = await request('GET', '/api/admin/sync-quarantines?limit=12', token);
    assert.equal(quarantineIndex.status, 200, quarantineIndex.raw);
    assert.deepEqual(quarantineIndex.json, { quarantines:[] }, 'admin-only operational index returns safe summaries without source payloads');

    const catalog = await request('GET', '/api/admin/content/courses', token);
    assert.equal(catalog.status, 200, catalog.raw);
    assert.ok(catalog.json.courses.some((course) => course.id === 'oral-basic'));

    const source = await request('GET', '/api/admin/content/courses/oral-basic', token);
    assert.equal(source.status, 200, source.raw);
    const course = source.json.course;
    const target = course.items.find((item) => item.cid === 'e70c8cf4');
    assert.ok(target, 'selected source sentence is available to edit');
    target.explanations[0] = '工作台保存的草稿讲解';
    const ambiguous = JSON.parse(JSON.stringify(course));
    ambiguous.items.find((item) => item.cid === 'e70c8cf4').explanations[0] = '常见错误：I got this 也可以。';
    const lint = await request('POST', '/api/admin/content/courses/oral-basic/validate', token, { course: ambiguous });
    assert.equal(lint.json.valid, true, 'content lint is a warning, not a structural error');
    assert.equal(lint.json.warnings.length, 0, 'valid alternative examples are not mislabeled as contradictions');

    const saved = await request('PUT', '/api/admin/content/courses/oral-basic/draft', token, {
      baseRevision: 0,
      course,
    });
    assert.equal(saved.status, 200, 'revision-guarded admin drafts are separate from legacy account snapshot writes: ' + saved.raw);
    assert.equal(saved.json.revision, 1);

    const restored = await request('GET', '/api/admin/content/courses/oral-basic/draft', token);
    assert.equal(restored.status, 200, restored.raw);
    assert.equal(restored.json.draft.course.items.find((item) => item.cid === 'e70c8cf4').explanations[0], '工作台保存的草稿讲解');

    const staleWrite = await request('PUT', '/api/admin/content/courses/oral-basic/draft', token, {
      baseRevision: 0,
      course,
    });
    assert.equal(staleWrite.status, 409, 'stale editing session must not overwrite a newer draft');

    const invalid = await request('POST', '/api/admin/content/courses/oral-basic/validate', token, { course: Object.assign({}, course, { items: [] }) });
    assert.equal(invalid.status, 200);
    assert.equal(invalid.json.valid, false);

    const published = await request('POST', '/api/admin/content/courses/oral-basic/publish', token, { revision: 1 });
    assert.equal(published.status, 200, published.raw);
    assert.equal(published.json.revision, 2);
    assert.ok(published.json.contentVersion.startsWith('v1-'));
    assert.ok(published.json.cacheVersion.startsWith('chunklab-'));
    const manifest = JSON.parse(fs.readFileSync(path.join(TMP_APP, 'content', 'manifest.json'), 'utf8'));
    const publishedEntry = manifest.decks[0];
    assert.equal(manifest.contentVersion, published.json.contentVersion);
    assert.ok(fs.existsSync(path.join(TMP_APP, publishedEntry.shards[0].url)));
    assert.ok(fs.existsSync(path.join(TMP_APP, publishedEntry.indexShards[0].url)));
    assert.ok(fs.existsSync(path.join(TMP_APP, 'extra', 'content-overrides', 'oral-basic.json')));
    assert.match(fs.readFileSync(path.join(TMP_APP, 'sw.js'), 'utf8'), new RegExp("const CACHE = '" + published.json.cacheVersion + "';"));
    const { execFileSync } = require('node:child_process');
    const retainedShard = path.join(TMP_OUTPUT, 'content', 'oral-basic', 'oral-000-retained-fixture.json');
    fs.mkdirSync(path.dirname(retainedShard), { recursive: true });
    const retainedBytes = '{"originalAsset":true}\n';
    fs.writeFileSync(retainedShard, retainedBytes);
    execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'build-content.mjs')], {
      cwd: path.join(__dirname, '..'),
      env: Object.assign({}, process.env, { CONTENT_SOURCE_ROOT: TMP_APP, CONTENT_OUTPUT_ROOT: TMP_OUTPUT, CONTENT_OVERRIDE_ROOT: path.join(TMP_APP, 'extra', 'content-overrides') }),
      stdio: 'pipe',
    });
    const rebuiltManifest = JSON.parse(fs.readFileSync(path.join(TMP_OUTPUT, 'content', 'manifest.json'), 'utf8'));
    assert.equal(fs.readFileSync(retainedShard, 'utf8'), retainedBytes, 'rebuilding never deletes an earlier immutable course asset');
    const rebuiltCourse = rebuiltManifest.decks.find((item) => item.id === 'oral-basic');
    const rebuiltShard = JSON.parse(fs.readFileSync(path.join(TMP_OUTPUT, rebuiltCourse.shards[0].url), 'utf8'));
    assert.equal(rebuiltShard.items.find((item) => item.cid === 'e70c8cf4').explanations[0], '工作台保存的草稿讲解');
    const afterPublish = await request('GET', '/api/admin/content/courses/oral-basic', token);
    assert.equal(afterPublish.json.publishedRevision, 2);

    const followup = await request('PUT', '/api/admin/content/courses/oral-basic/draft', token, { baseRevision: 2, course });
    assert.equal(followup.status, 200);
    const manifestBeforeFailedPublish = fs.readFileSync(path.join(TMP_APP, 'content', 'manifest.json'), 'utf8');
    const overrideBeforeFailedPublish = fs.readFileSync(path.join(TMP_APP, 'extra', 'content-overrides', 'oral-basic.json'), 'utf8');
    fs.writeFileSync(path.join(TMP_APP, 'sw.js'), "const CACHE = 'chunklab-test';\nconst PRECACHE = [\n  '/content/manifest.json',\n  '/missing-cache-file.js',\n];\nconst PRECACHE_SOFT = [\n];\n");
    const failedPublish = await request('POST', '/api/admin/content/courses/oral-basic/publish', token, { revision: 3 });
    assert.equal(failedPublish.status, 500, 'missing cache inputs stop release publication');
    assert.equal(fs.readFileSync(path.join(TMP_APP, 'content', 'manifest.json'), 'utf8'), manifestBeforeFailedPublish, 'manifest rolls back if cache refresh fails');
    assert.equal(fs.readFileSync(path.join(TMP_APP, 'extra', 'content-overrides', 'oral-basic.json'), 'utf8'), overrideBeforeFailedPublish, 'canonical override rolls back if cache refresh fails');

    console.log('content-studio.test.js passed');
  } finally {
    await stop();
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
