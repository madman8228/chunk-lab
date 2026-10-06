'use strict';

const assert = require('node:assert/strict');
const { inspectLocalRecovery, roleForDatabase } = require('./local-recovery-health');

function fakeDatabase(storeRows) {
  return {
    objectStoreNames: { contains: name => Object.prototype.hasOwnProperty.call(storeRows, name) },
    transaction(names, mode) {
      assert.equal(mode, 'readonly');
      const tx = { error: null };
      tx.objectStore = name => ({
        count() {
          const req = { result: storeRows[name] };
          queueMicrotask(() => req.onsuccess());
          return req;
        }
      });
      queueMicrotask(() => tx.oncomplete());
      return tx;
    },
    close() {}
  };
}

function fakeIndexedDB(definitions) {
  const opened = [];
  return {
    opened,
    async databases() { return Object.keys(definitions).map(name => ({ name })); },
    open(name) {
      opened.push(name);
      const request = {};
      queueMicrotask(() => {
        request.result = fakeDatabase(definitions[name]);
        request.onsuccess();
      });
      return request;
    }
  };
}

assert.equal(roleForDatabase('chunklab-sync-recovery'), 'legacyJournal');
assert.equal(roleForDatabase('chunklab-recovery-v1'), 'localArchives');
assert.equal(roleForDatabase('chunklab-idb-restore-42'), 'operationQueue');
assert.equal(roleForDatabase('unrelated-database'), null);

(async function () {
  const idb = fakeIndexedDB({
    'chunklab-sync-recovery': { pending: 2 },
    'chunklab-idb-restore-42': { pendingOperations: 3 },
    'chunklab-recovery-v1': { sources: 1 },
    'unrelated-database': { privateData: 99 }
  });
  let readValues = 0;
  const result = await inspectLocalRecovery({
    indexedDB: idb,
    localStorage: { getItem: () => { readValues++; return null; } }
  });
  assert.deepEqual({
    supported: result.supported,
    legacyJournalRows: result.legacyJournalRows,
    pendingOperations: result.pendingOperations,
    localArchiveRows: result.localArchiveRows,
    legacyLocalKeysPresent: result.legacyLocalKeysPresent,
    readError: result.readError
  }, {
    supported: true,
    legacyJournalRows: 2,
    pendingOperations: 3,
    localArchiveRows: 1,
    legacyLocalKeysPresent: 0,
    readError: false
  });
  assert.deepEqual(idb.opened, [
    'chunklab-sync-recovery', 'chunklab-idb-restore-42', 'chunklab-recovery-v1'
  ]);
  assert.equal(readValues, 5, 'only the presence of known legacy keys is checked');

  const unsupported = await inspectLocalRecovery({ indexedDB: {}, localStorage: null });
  assert.equal(unsupported.supported, false);
  assert.equal(unsupported.legacyJournalRows, null);
  console.log('[local-recovery-health] read-only counts, allowlisted stores, and unsupported-browser behavior passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
