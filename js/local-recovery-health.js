(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.window === root) root.LocalRecoveryHealth = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var LEGACY_KEYS = [
    'chunklab.v1',
    'chunklab.courses.v1',
    'chunklab.course-progress.v1',
    'chunklab_reinforce',
    'chunklab.logical-courses.v1'
  ];

  function roleForDatabase(name) {
    if (name === 'chunklab-sync-recovery') return 'legacyJournal';
    if (name === 'chunklab-recovery-v1') return 'localArchives';
    if (name === 'chunklab-idb' || name.indexOf('chunklab-idb-') === 0) return 'operationQueue';
    return null;
  }

  function openExisting(indexedDB, name) {
    return new Promise(function (resolve, reject) {
      var request;
      var createdDuringRead = false;
      try { request = indexedDB.open(name); }
      catch (error) { reject(error); return; }
      request.onupgradeneeded = function () {
        createdDuringRead = true;
        try { request.transaction.abort(); } catch (_) {}
      };
      request.onsuccess = function () {
        if (createdDuringRead) {
          request.result.close();
          resolve(null);
          return;
        }
        resolve(request.result);
      };
      request.onerror = function () {
        if (createdDuringRead) resolve(null);
        else reject(request.error || new Error('IndexedDB read failed'));
      };
      request.onblocked = function () { reject(new Error('IndexedDB read blocked')); };
    });
  }

  function countStores(db, names) {
    var selected = names.filter(function (name) { return db.objectStoreNames.contains(name); });
    if (!selected.length) return Promise.resolve({});
    return new Promise(function (resolve, reject) {
      var counts = {};
      var transaction;
      try { transaction = db.transaction(selected, 'readonly'); }
      catch (error) { reject(error); return; }
      selected.forEach(function (name) {
        var request = transaction.objectStore(name).count();
        request.onsuccess = function () { counts[name] = request.result; };
        request.onerror = function () { reject(request.error || new Error('IndexedDB count failed')); };
      });
      transaction.oncomplete = function () { resolve(counts); };
      transaction.onerror = transaction.onabort = function () {
        reject(transaction.error || new Error('IndexedDB read failed'));
      };
    });
  }

  async function inspectLocalRecovery(environment) {
    environment = environment || {};
    var indexedDB = environment.indexedDB;
    var localStorage = environment.localStorage;
    var result = {
      supported: !!(indexedDB && typeof indexedDB.databases === 'function'),
      legacyJournalRows: null,
      pendingOperations: null,
      localArchiveRows: null,
      legacyLocalKeysPresent: null,
      readError: false
    };
    if (!result.supported) return result;

    result.legacyJournalRows = 0;
    result.pendingOperations = 0;
    result.localArchiveRows = 0;
    try {
      var databases = await indexedDB.databases();
      for (var i = 0; i < databases.length; i++) {
        var info = databases[i];
        if (!info || typeof info.name !== 'string') continue;
        var role = roleForDatabase(info.name);
        if (!role) continue;
        var db = await openExisting(indexedDB, info.name);
        if (!db) continue;
        try {
          var storeNames = role === 'legacyJournal' ? ['pending'] :
            role === 'localArchives' ? ['sources'] : ['pendingOperations'];
          var counts = await countStores(db, storeNames);
          if (role === 'legacyJournal') result.legacyJournalRows += counts.pending || 0;
          else if (role === 'localArchives') result.localArchiveRows += counts.sources || 0;
          else result.pendingOperations += counts.pendingOperations || 0;
        } finally { db.close(); }
      }
    } catch (_) { result.readError = true; }

    try {
      result.legacyLocalKeysPresent = localStorage
        ? LEGACY_KEYS.filter(function (key) { return localStorage.getItem(key) !== null; }).length
        : null;
    } catch (_) { result.readError = true; }
    return result;
  }

  return { inspectLocalRecovery: inspectLocalRecovery, roleForDatabase: roleForDatabase };
});
