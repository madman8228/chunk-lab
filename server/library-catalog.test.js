'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const Database = require('./node_modules/better-sqlite3');
const { createLibraryCatalog } = require('./services/library-catalog');
const { registerLibraryRoutes } = require('./routes/library');

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chunk-workspace-library-'));
  const db = new Database(path.join(root, 'test.db'));
  let server;
  try {
    fs.mkdirSync(path.join(root, 'content'));
    fs.mkdirSync(path.join(root, 'assets'));
    fs.copyFileSync(path.join(__dirname, '../content/manifest.json'), path.join(root, 'content/manifest.json'));
    fs.writeFileSync(path.join(root, 'assets/original.txt'), 'protected original');
    db.exec("CREATE TABLE library_resource_revisions(resource_id TEXT,revision INTEGER,status TEXT,metadata_json TEXT,created_at TEXT,PRIMARY KEY(resource_id,revision))");
    const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    const manifest = path.join(root, 'content/manifest.json');
    const original = path.join(root, 'assets/original.txt');
    const before = [hash(manifest), hash(original)];
    const library = createLibraryCatalog({ db, appRoot: root });
    const source = library.resources().find(resource => resource.available && resource.sourceRefs.length);
    assert.ok(source, 'fixture must reference actual public content');
    const id = 'test:book';
    const metadata = { resourceId: id, kind: 'wordbook', title: '隔离测试集合', sourceRefs: source.sourceRefs.map(ref => ({ id: ref.id, type: ref.type })), relatedCourseIds: ['course:beginner-speaking-1'], facets: { levels: ['A1'], grades: ['3'] } };
    assert.equal(library.saveDraft(id, 0, metadata).status, 200);
    assert.ok(!library.resources().some(row => row.resourceId === id), 'draft stays private');
    assert.equal(library.saveDraft(id, 0, { ...metadata, title: 'conflicting' }).status, 409);
    assert.equal(library.read(id).resource.title, metadata.title);
    assert.equal(library.publish(id, 1).status, 200);
    assert.equal(library.resources().find(row => row.resourceId === id).available, true);
    assert.deepEqual(library.resources().find(row => row.resourceId === id).relatedCourseIds, ['course:beginner-speaking-1']);
    assert.equal(library.saveDraft('test:bad-relation', 0, { ...metadata, resourceId: 'test:bad-relation', relatedCourseIds: ['beginner-speaking-1'] }).status, 422);
    assert.equal(library.publish(id, 1).status, 409);
    assert.equal(library.saveDraft('test:private', 0, { ...metadata, resourceId: 'test:private', sourceRefs: [{ type: 'story-package', id: 'private-other-account' }] }).status, 422);
    assert.equal(library.saveDraft('test:unsafe', 0, { ...metadata, resourceId: 'test:unsafe', coverUrl: 'assets/../../secret' }).status, 422);
    assert.deepEqual([hash(manifest), hash(original)], before);
    const app = require('./node_modules/express')();
    app.use(require('./node_modules/express').json());
    registerLibraryRoutes({ app, library, adminOnly: (req, res, next) => req.headers.authorization === 'Bearer isolated-admin' ? next() : res.status(403).json({ error: 'admin only' }) });
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    const url = 'http://127.0.0.1:' + server.address().port;
    const response = await fetch(url + '/api/library');
    assert.equal(response.status, 200);
    assert.equal((await fetch(url + '/api/library', { headers: { 'if-none-match': response.headers.get('etag') } })).status, 304);
    assert.equal((await fetch(url + '/api/admin/library/resources/test:book/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"revision":1}' })).status, 403);
    console.log('library catalog: draft, conflict, publication, authorization and asset protection passed; isolated port ' + server.address().port);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    db.close();
    assert.equal(path.dirname(root), os.tmpdir());
    assert.ok(path.basename(root).startsWith('chunk-workspace-library-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
