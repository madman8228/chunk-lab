'use strict';
const assert = require('node:assert/strict');
const { audit, digest } = require('./audit-browser-course-backup.cjs');

const owner = JSON.stringify(['http://127.0.0.1:8787', '37']);
const crypto = require('node:crypto');
const assetBytes = Buffer.from('isolated-image-bytes');
const assetHash = crypto.createHash('sha256').update(assetBytes).digest('hex');
function fixture() {
  const partition = { database: 'isolated-idb', stores: {
    courses: [{ courseId: 'old-course' }], progress: [{ cid: 'old-course' }],
    syncMeta: [{ key: 'server-cache-v3', owner, appliedSeq: 9, snapshot: { mem: {
      decks: [{ id: 'old-deck' }], courses: [{ courseId: 'server-course' }],
      logicalCourses: { oldLogical: { courseId: 'old-logical' } },
      courseProgress: { 'old-progress': { courseId: 'old-progress' } },
      learningWorkspace: { oldWorkspace: { resourceId: 'old-workspace' } },
      assets: [{ id: 'picture-1', mimeType: 'image/webp', _dataUri: 'data:image/webp;base64,' + assetBytes.toString('base64') }],
      items: [{ imageAssetId: 'picture-1' }]
    } } }], pendingOperations: []
  }, local: {} };
  return { format: 'chunklab-browser-partition-backup', version: 1, uid: '37', owner, partition, fingerprint: digest(partition) };
}
const manifest = { schemaVersion: 1, learningReferences: {}, entries: [
  ...['old-course', 'old-deck', 'server-course', 'old-logical', 'old-progress', 'old-workspace'].map((legacyId, i) => ({
    userId: 37, kind: i === 1 ? 'deck' : 'course', legacyId, courseId: `new-${i}`,
    inventory: i === 0 ? { assets: [{ assetId: 'picture-1', mimeType: 'image/webp', bytes: assetBytes.length, sha256: assetHash }] } : { assets: [] }
  })), { userId: 1, kind: 'course', legacyId: 'old-course', courseId: 'other-account-course' }
] };
manifest.sourceDigest = crypto.createHash('sha256').update(JSON.stringify({ entries: manifest.entries, learningReferences: manifest.learningReferences })).digest('hex');

const good = audit(fixture(), manifest);
assert.equal(good.valid, true);
assert.equal(good.references.unmatched.length, 0);
assert.equal(good.references.matched.length, 7);
assert.equal(good.assets.conflicts.length, 0);
assert.deepEqual(good.confirmedCache, { key: 'server-cache-v3', appliedSeq: 9 });
assert.equal(good.blockers.length, 0);

const changed = fixture(); changed.partition.local.changed = 'tampered';
assert.equal(audit(changed, manifest).fingerprintValid, false);
assert.equal(audit(fixture(), { ...manifest, sourceDigest: '0'.repeat(64) }).manifestDigestValid, false);

const wrongOwner = fixture(); wrongOwner.partition.stores.syncMeta[0].owner = JSON.stringify(['http://localhost', '1']);
wrongOwner.fingerprint = digest(wrongOwner.partition);
assert.equal(audit(wrongOwner, manifest).ownershipConflicts.length, 1);
const unownedCache = fixture(); delete unownedCache.partition.stores.syncMeta[0].owner;
unownedCache.fingerprint = digest(unownedCache.partition);
assert.equal(audit(unownedCache, manifest).ownershipConflicts.length, 1);

const unresolved = fixture(); unresolved.partition.stores.courses.push({ courseId: 'browser-only-course' });
unresolved.fingerprint = digest(unresolved.partition);
assert.equal(audit(unresolved, manifest).references.unmatched.length, 1);

const missingAsset = fixture(); missingAsset.partition.stores.syncMeta[0].snapshot.mem.items[0].imageAssetId = 'cache-only-picture';
missingAsset.fingerprint = digest(missingAsset.partition);
assert.deepEqual(audit(missingAsset, manifest).assets.unlisted, ['cache-only-picture']);

const mismatchedAsset = fixture(); mismatchedAsset.partition.stores.syncMeta[0].snapshot.mem.assets[0]._dataUri = 'data:image/webp;base64,' + Buffer.from('different-bytes').toString('base64');
mismatchedAsset.fingerprint = digest(mismatchedAsset.partition);
assert.equal(audit(mismatchedAsset, manifest).assets.conflicts.length, 1);

const localContent = fixture();
localContent.partition.local['chunklab.account.owner.chunklab.v1'] = JSON.stringify({ decks: [{ id: 'local-only-course' }], assets: [{ id: 'local-only-picture', mimeType: 'image/webp', _dataUri: 'data:image/webp;base64,' + assetBytes.toString('base64') }], items: [{ imageAssetId: 'local-only-picture' }] });
localContent.fingerprint = digest(localContent.partition);
const localReport = audit(localContent, manifest);
assert.equal(localReport.references.unmatched.some(ref => ref.id === 'local-only-course'), true);
assert.deepEqual(localReport.assets.unlisted, ['local-only-picture']);

const opaqueLocal = fixture(); opaqueLocal.partition.local['chunklab.v1'] = 'not-json';
opaqueLocal.fingerprint = digest(opaqueLocal.partition);
assert.deepEqual(audit(opaqueLocal, manifest).assets.opaqueLocalContentKeys, ['chunklab.v1']);

const queued = fixture(); queued.partition.stores.pendingOperations.push({ requestId: 'keep-me', operation: { type: 'course.put' } });
queued.fingerprint = digest(queued.partition);
const queuedReport = audit(queued, manifest);
assert.equal(queuedReport.pendingOperations.count, 1);
assert(queuedReport.blockers.some(reason => reason.includes('不会重放或清除')));
console.log('browser backup audit tests passed');
