/* Immutable copy of the current browser state before server-authoritative
 * startup. This module never clears legacy stores or retires pending writes. */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.window === root) root.LegacyRecovery = api;
})(typeof window !== 'undefined' ? window : globalThis, function (global) {
  'use strict';

  var FORMAT = 'chunklab.recovery-source';
  var SOURCE_MARKER = 'chunklab.recovery.source.v1';
  var DB_NAME = 'chunklab-recovery-v1';
  var LOCAL_KEYS = ['chunklab.v1', 'chunklab.courses.v1', 'chunklab.course-progress.v1',
    'chunklab.logical-courses.v1', 'chunklab_reinforce', 'chunklab_revs_v1', 'chunklab.sync-conflict.v1'];

  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(function (key) {
        return JSON.stringify(key) + ':' + canonical(value[key]);
      }).join(',') + '}';
    }
    return JSON.stringify(value);
  }

  function redactPrivateSettings(value, path, redacted) {
    if (Array.isArray(value)) return value.map(function (item, index) {
      return redactPrivateSettings(item, path + '[' + index + ']', redacted);
    });
    if (!value || typeof value !== 'object') return value;
    var output = {};
    Object.keys(value).forEach(function (key) {
      var child = value[key], childPath = path ? path + '.' + key : key;
      if (key === 'settings' && child && typeof child === 'object' && !Array.isArray(child) &&
          typeof child.apiKey === 'string' && child.apiKey) {
        var safeSettings = Object.assign({}, child, { apiKey: '' });
        redacted.push(childPath + '.apiKey');
        output[key] = redactPrivateSettings(safeSettings, childPath, redacted);
      } else {
        output[key] = redactPrivateSettings(child, childPath, redacted);
      }
    });
    return output;
  }

  function create(options) {
    options = options || {};
    var capture = options.capture;
    var save = options.save;
    var load = options.load;
    var upload = options.upload;
    var refresh = options.refresh;
    var digest = options.digest;
    var compress = options.compress;
    var assertCurrent = options.assertCurrent || function () {};
    var owner = options.owner || function () { return 'local'; };
    var sourceKind = options.sourceKind || 'account-local';

    if ([capture, save, load, upload, digest, compress].some(function (fn) { return typeof fn !== 'function'; }) ||
        (refresh !== undefined && typeof refresh !== 'function')) {
      throw new Error('旧数据接管服务缺少必要的存储或网络适配');
    }

    async function archive(confirmed) {
      assertCurrent();
      var ownerAtStart = owner();
      if (options.isUnassigned && await options.isUnassigned() && confirmed !== true) {
        return { state: 'needs-owner-confirmation' };
      }
      assertCurrent();

      var saved = await load(ownerAtStart);
      assertCurrent();
      if (!saved) {
        var snapshot = await capture(ownerAtStart);
        assertCurrent();
        if (!snapshot || snapshot.empty === true) return { state: 'empty' };
        var source = Object.assign({}, snapshot, {
          format: FORMAT,
          version: 1,
          owner: ownerAtStart,
          sourceKind: sourceKind
        });
        var raw = new TextEncoder().encode(canonical(source));
        var sourceHash = await digest(raw);
        var sourceId = 'legacy-' + sourceHash;
        var compressed = await compress(raw);
        // The exact upload bytes become durable locally before the network is
        // attempted. A crash or server failure therefore retries this source.
        saved = { sourceId: sourceId, sourceHash: sourceHash, owner: ownerAtStart, kind: sourceKind,
          uncompressedBytes: raw.length, gzip: compressed, receipt: null };
        await save(saved);
        assertCurrent();
      }
      if (saved.receipt && saved.receipt.ok === true) {
        if (refresh) {
          var refreshed = await refresh(saved);
          assertCurrent();
          if (!refreshed || refreshed.ok !== true || refreshed.sourceId !== saved.sourceId ||
              refreshed.sourceHash !== saved.sourceHash || !refreshed.manifest ||
              refreshed.manifest.verified !== true || refreshed.manifest.sourceHash !== saved.sourceHash) {
            throw new Error('服务器尚未确认旧数据恢复清单；本地原件保持不变');
          }
          saved.receipt = refreshed;
          await save(saved);
          assertCurrent();
        }
        return { state: 'already-archived', receipt: saved.receipt };
      }
      var result = await upload(saved);
      assertCurrent();
      if (!result || result.ok !== true || result.sourceHash !== saved.sourceHash ||
          !['archived', 'already-present'].includes(result.state) ||
          !result.manifest || result.manifest.verified !== true) {
        throw new Error('服务器尚未确认旧数据原件已安全接管');
      }
      saved.receipt = result;
      await save(saved);
      assertCurrent();
      /* A legacy request may still be settling when its immutable source is
         first ingested. Refresh the receipt manifest before startup previews
         migration so a just-committed request is not needlessly retained as
         unknown until the next page load. Unknown requests remain archived;
         this check never authorizes replay or deletion. */
      if (refresh) {
        var refreshedAfterUpload = await refresh(saved);
        assertCurrent();
        if (!refreshedAfterUpload || refreshedAfterUpload.ok !== true ||
            refreshedAfterUpload.sourceId !== saved.sourceId ||
            refreshedAfterUpload.sourceHash !== saved.sourceHash ||
            !refreshedAfterUpload.manifest || refreshedAfterUpload.manifest.verified !== true ||
            refreshedAfterUpload.manifest.sourceHash !== saved.sourceHash) {
          throw new Error('服务器尚未确认旧数据恢复清单；本地原件保持不变');
        }
        saved.receipt = refreshedAfterUpload;
        await save(saved);
        assertCurrent();
      }
      return { state: 'archived', receipt: saved.receipt };
    }

    return { archive: archive };
  }

  function request(db, storeNames, callback) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(storeNames, 'readonly');
      var result = {};
      tx.oncomplete = function () { resolve(result); };
      tx.onerror = tx.onabort = function () { reject(tx.error || new Error('读取旧学习数据失败')); };
      storeNames.forEach(function (name) {
        var req = tx.objectStore(name).getAll();
        req.onsuccess = function () { result[name] = req.result || []; };
      });
      if (callback) callback(tx);
    });
  }

  function openExisting(name) {
    return new Promise(function (resolve, reject) {
      var missing = false;
      var req = global.indexedDB.open(name);
      req.onupgradeneeded = function () { missing = true; req.transaction.abort(); };
      req.onerror = function () { if (missing) resolve(null); else reject(req.error); };
      req.onblocked = function () { reject(new Error('旧数据存储正被其他页面占用')); };
      req.onsuccess = function () { resolve(req.result); };
    });
  }

  function archiveDb() {
    return new Promise(function (resolve, reject) {
      var req = global.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains('sources')) req.result.createObjectStore('sources', { keyPath: 'sourceId' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('本机旧数据保全失败')); };
      req.onblocked = function () { reject(new Error('旧数据保全存储被其他页面占用')); };
    });
  }

  function markerKey(kind) { return SOURCE_MARKER + '.' + encodeURIComponent(kind || 'account-local'); }

  function localLoad(owner, kind) {
    return archiveDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('sources', 'readonly'), store = tx.objectStore('sources');
        var marker = global.AccountStorage.storage.getItem(markerKey(kind));
        var req = marker ? store.get(marker) : store.getAll();
        req.onsuccess = function () {
          var rows = marker ? (req.result ? [req.result] : []) : (req.result || []);
          resolve(rows.find(function (row) { return row.owner === owner && (row.kind || 'account-local') === (kind || 'account-local'); }) || null);
        };
        tx.onerror = tx.onabort = function () { reject(tx.error || new Error('读取本机旧数据保全记录失败')); };
        tx.oncomplete = function () { db.close(); };
      });
    });
  }

  function localSave(row) {
    return archiveDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('sources', 'readwrite');
        var store = tx.objectStore('sources');
        var get = store.get(row.sourceId);
        get.onsuccess = function () {
          var old = get.result;
          if (old && (old.sourceHash !== row.sourceHash || old.owner !== row.owner)) {
            tx.abort();
            return;
          }
          store.put(row);
        };
        tx.oncomplete = function () {
          try {
            global.AccountStorage.storage.setItem(markerKey(row.kind), row.sourceId);
            db.close();
            resolve(row);
          } catch (error) { db.close(); reject(error); }
        };
        tx.onerror = tx.onabort = function () { db.close(); reject(tx.error || new Error('本机旧数据保全失败')); };
      });
    });
  }

  function bytesToHex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), function (byte) {
      return byte.toString(16).padStart(2, '0');
    }).join('');
  }

  function compressBytes(bytes) {
    if (typeof global.CompressionStream !== 'function') return Promise.reject(new Error('当前浏览器不支持安全压缩旧数据；原数据保持不变'));
    var stream = new Blob([bytes]).stream().pipeThrough(new global.CompressionStream('gzip'));
    return new Response(stream).arrayBuffer().then(function (buffer) { return new Blob([buffer]); });
  }

  async function uploadSource(row, requestApi, digestChunk, chunkSize) {
    chunkSize = chunkSize || 4 * 1024 * 1024;
    var count = Math.ceil(row.gzip.size / chunkSize);
    if (count <= 1) {
      return requestApi('/api/recovery/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/vnd.chunklab.recovery+gzip',
          'X-ChunkLab-Recovery-Source': row.sourceId,
          'X-ChunkLab-Recovery-SHA256': row.sourceHash
        },
        body: row.gzip
      });
    }
    for (var index = 0; index < count; index++) {
      var part = row.gzip.slice(index * chunkSize, Math.min(row.gzip.size, (index + 1) * chunkSize));
      var chunkHash = await digestChunk(await part.arrayBuffer());
      var staged = await requestApi('/api/recovery/ingest/chunk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/vnd.chunklab.recovery+gzip',
          'X-ChunkLab-Recovery-Source': row.sourceId,
          'X-ChunkLab-Recovery-SHA256': row.sourceHash,
          'X-ChunkLab-Recovery-Chunk-Index': String(index),
          'X-ChunkLab-Recovery-Chunk-Count': String(count),
          'X-ChunkLab-Recovery-Chunk-SHA256': chunkHash,
          'X-ChunkLab-Recovery-Uncompressed-Bytes': String(row.uncompressedBytes)
        },
        body: part
      });
      if (staged && staged.state === 'already-present') break;
    }
    return requestApi('/api/recovery/ingest/complete', {
      method: 'POST', body: JSON.stringify({ sourceId: row.sourceId, sourceHash: row.sourceHash,
        chunkCount: count, uncompressedBytes: row.uncompressedBytes })
    });
  }

  function buildImportedBackupSource(data) {
    if (!data || data.__app !== 'chunklab' || !data.mem || typeof data.mem !== 'object' || Array.isArray(data.mem)) {
      throw new Error('备份文件格式无效；原文件未更改');
    }
    var pendingRows = data.saveState && Array.isArray(data.saveState.unconfirmedOperations)
      ? data.saveState.unconfirmedOperations.filter(function (row) { return row && typeof row.requestId === 'string' && row.requestId; }) : [];
    var redacted = [];
    var safeMem = redactPrivateSettings(data.mem, 'backup.mem', redacted);
    var safeBook = redactPrivateSettings(Array.isArray(data.reinforceBook) ? data.reinforceBook : [], 'backup.reinforceBook', redacted);
    var safeCourses = redactPrivateSettings(Array.isArray(data.courses) ? data.courses : [], 'backup.courses', redacted);
    var safeProgress = redactPrivateSettings(data.courseProgress && typeof data.courseProgress === 'object' ? data.courseProgress : {},
      'backup.courseProgress', redacted);
    var safePending = redactPrivateSettings(pendingRows, 'backup.saveState.unconfirmedOperations', redacted);
    return { format: FORMAT, version: 1, capturedAt: new Date().toISOString(), sourceKind: 'user-backup-import',
      redactedPrivateFields: Array.from(new Set(redacted)).sort(),
      localStorage: { 'chunklab.v1': JSON.stringify(safeMem), chunklab_reinforce: JSON.stringify(safeBook),
        'chunklab.courses.v1': JSON.stringify(safeCourses),
        'chunklab.course-progress.v1': JSON.stringify(safeProgress),
        'chunklab.logical-courses.v1': '[]', chunklab_revs_v1: '{}' },
      stores: { courses: [], progress: [], sentenceStats: [], events: [],
        pendingOperations: safePending, syncMeta: [], syncIntents: [] } };
  }

  function createImportRecovery(options) {
    options = options || {};
    if (['owner', 'assertCurrent', 'digest', 'compress', 'upload', 'preview', 'apply'].some(function (key) {
      return typeof options[key] !== 'function';
    })) throw new Error('备份恢复预览服务未就绪');
    return { prepare: async function (data) {
      options.assertCurrent();
      var ownerAtStart = options.owner();
      var source = buildImportedBackupSource(data);
      var raw = new TextEncoder().encode(canonical(source));
      var sourceHash = await options.digest(raw);
      var row = { sourceId: 'backup-import-' + sourceHash, sourceHash: sourceHash,
        uncompressedBytes: raw.length, gzip: await options.compress(raw) };
      options.assertCurrent();
      if (ownerAtStart !== options.owner()) throw new Error('账号已切换；备份文件未应用');
      var archived = await options.upload(row);
      options.assertCurrent();
      if (ownerAtStart !== options.owner() || !archived || archived.ok !== true || archived.sourceHash !== sourceHash ||
          !archived.manifest || archived.manifest.verified !== true) throw new Error('服务器未确认备份原件；未应用备份');
      var preview = await options.preview(row.sourceId, sourceHash);
      options.assertCurrent();
      if (!preview || preview.sourceId !== row.sourceId || preview.sourceHash !== sourceHash ||
          !Number.isSafeInteger(preview.expectedSeq) || typeof preview.previewToken !== 'string') {
        throw new Error('服务器恢复预览无效；备份原件已保留，账号数据未更改');
      }
      return { preview: preview, apply: async function () {
        options.assertCurrent();
        if (ownerAtStart !== options.owner()) throw new Error('账号已切换；请在原账号重新预览');
        return options.apply(row.sourceId, preview);
      } };
    } };
  }

  function prepareImportedBackup(data) {
    var account = global.AccountStorage, api = global.ChunkAPI;
    if (!account || !api || typeof api.request !== 'function' || !global.crypto || !global.crypto.subtle) {
      return Promise.reject(new Error('服务器备份恢复模块尚未就绪；原文件未更改'));
    }
    var requestApi = api.request.bind(api);
    return createImportRecovery({
      owner: function () { return account.owner; }, assertCurrent: function () { account.assertCurrent(); },
      digest: function (bytes) { return global.crypto.subtle.digest('SHA-256', bytes).then(bytesToHex); },
      compress: compressBytes,
      upload: function (row) { return uploadSource(row, requestApi, function (bytes) {
        return global.crypto.subtle.digest('SHA-256', bytes).then(bytesToHex);
      }); },
      preview: function (sourceId, sourceHash) { return requestApi('/api/recovery/' + encodeURIComponent(sourceId) + '/preview', {
        method: 'POST', body: JSON.stringify({ sourceHash: sourceHash }) }); },
      apply: function (sourceId, preview) { return requestApi('/api/recovery/' + encodeURIComponent(sourceId) + '/apply', {
        method: 'POST', body: JSON.stringify(preview) }); }
    }).prepare(data);
  }

  function readResolutionJournal(owner) {
    var parsed;
    try { parsed = JSON.parse(owner); } catch (_) { return Promise.resolve(null); }
    var scope = String(parsed[0] || '').replace(/\/+$/, '') + '|' + (parsed[1] === 'local' ? 'open' : String(parsed[1] || 'open'));
    return openExisting('chunklab-sync-recovery').then(function (db) {
      if (!db || !db.objectStoreNames.contains('pending')) { if (db) db.close(); return null; }
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('pending', 'readonly'), req = tx.objectStore('pending').get(scope), value = null;
        req.onsuccess = function () { value = req.result || null; };
        tx.oncomplete = function () { db.close(); resolve(value); };
        tx.onerror = tx.onabort = function () { db.close(); reject(tx.error || new Error('读取旧同步处理记录失败')); };
      });
    });
  }

  async function captureCurrent(owner) {
    var account = global.AccountStorage;
    account.assertCurrent();
    var before = Object.create(null);
    LOCAL_KEYS.forEach(function (key) { before[key] = account.storage.getItem(key); });
    var db = await global.IDBStore.open();
    var names = global.IDBStore.STORES.filter(function (name) { return db.objectStoreNames.contains(name); });
    // IDBStore.open() returns the application's shared connection. The readonly
    // transaction has completed when request() resolves; do not close `_db`.
    var stores = await request(db, names);
    var journal = await readResolutionJournal(owner);
    account.assertCurrent();
    var after = Object.create(null);
    LOCAL_KEYS.forEach(function (key) { after[key] = account.storage.getItem(key); });
    if (canonical(before) !== canonical(after) || owner !== account.owner) {
      throw new Error('旧数据正在变化，本次未开始接管；请关闭其他页面后重试');
    }
    var hasLocal = Object.keys(before).some(function (key) { return before[key] !== null; });
    var hasRows = Object.keys(stores).some(function (name) {
      return (stores[name] || []).some(function (row) { return !(name === 'syncMeta' && row.key === 'server-cache-v3'); });
    });
    if (!hasLocal && !hasRows && !journal) return { empty: true };
    var redacted = [];
    var safeLocal = Object.assign({}, before);
    if (typeof safeLocal['chunklab.v1'] === 'string') {
      try {
        var oldMem = JSON.parse(safeLocal['chunklab.v1']);
        safeLocal['chunklab.v1'] = JSON.stringify(redactPrivateSettings(oldMem, 'localStorage.chunklab.v1', redacted));
      } catch (_) { /* Preserve malformed source byte-for-byte; it will not be merged automatically. */ }
    }
    stores = redactPrivateSettings(stores, 'indexedDB', redacted);
    var safeJournal = journal ? redactPrivateSettings(journal, 'syncResolution', redacted) : null;
    return { capturedAt: new Date().toISOString(), localStorage: safeLocal, stores: stores,
      syncResolution: safeJournal, redactedPrivateFields: Array.from(new Set(redacted)).sort() };
  }

  function attachConflictPair(source, preview, capturedAt) {
    if (!preview || typeof preview !== 'object' || typeof preview.entity !== 'string' ||
        !preview.local || !preview.remote || typeof preview.local !== 'object' || typeof preview.remote !== 'object') {
      throw new Error('冲突快照不完整；原数据保持不变');
    }
    var redacted = [];
    var safePreview = redactPrivateSettings({
      entity: preview.entity,
      id: preview.id == null ? null : String(preview.id),
      batch: preview.batch === true,
      local: preview.local,
      remote: preview.remote,
      conflict: preview.conflict || null,
      capturedAt: capturedAt || new Date().toISOString()
    }, 'syncConflict', redacted);
    source.syncResolution = {
      kind: 'background-conflict-quarantine',
      version: 1,
      previousJournal: source.syncResolution || null,
      pair: safePreview
    };
    source.redactedPrivateFields = Array.from(new Set((source.redactedPrivateFields || []).concat(redacted))).sort();
    return source;
  }

  async function captureConflictPair(owner, preview) {
    return attachConflictPair(await captureCurrent(owner), preview);
  }

  function archiveConflictPair(preview) {
    var account = global.AccountStorage;
    if (!account || typeof account.assertCurrent !== 'function') {
      return Promise.reject(new Error('账号存储尚未就绪；冲突原件保持在此设备'));
    }
    account.assertCurrent();
    var ownerAtStart = account.owner;
    var service = createBrowserService('sync-conflict-quarantine', function (owner) {
      if (owner !== ownerAtStart) throw new Error('账号已切换；冲突原件保持在原设备');
      return captureConflictPair(owner, preview);
    });
    /* A 409 preview proves these two snapshots belong to the active server
       account scope. This archives evidence only; it does not apply or claim
       the unassigned legacy stores as that account's baseline. */
    return service.archive(true);
  }

  function createBrowserService(kind, capture) {
    var account = global.AccountStorage;
    return create({
      sourceKind: kind,
      owner: function () { return account.owner; },
      assertCurrent: function () { account.assertCurrent(); },
      isUnassigned: async function () {
        if (global.localStorage.getItem('chunklab.storage-owner.v1') !== 'legacy-unassigned') return false;
        if (LOCAL_KEYS.some(function(key){ return global.localStorage.getItem(key) !== null; })) return true;
        // A new browser also receives the legacy-unassigned marker. Prove that
        // no old database exists before allowing its account-scoped startup.
        // Never open, assign, upload or delete an unidentified legacy database.
        if (!global.indexedDB || typeof global.indexedDB.databases !== 'function') return true;
        var databases = await global.indexedDB.databases();
        return databases.some(function(db){ return db.name === 'chunklab-idb' || db.name === 'chunklab-sync-recovery'; });
      },
      capture: capture || captureCurrent,
      load: function (owner) { return localLoad(owner, kind); },
      save: localSave,
      digest: function (bytes) {
        return global.crypto.subtle.digest('SHA-256', bytes).then(bytesToHex);
      },
      compress: compressBytes,
      upload: function (row) {
        return uploadSource(row, global.ChunkAPI.request.bind(global.ChunkAPI), function (bytes) {
          return global.crypto.subtle.digest('SHA-256', bytes).then(bytesToHex);
        });
      },
      refresh: function (row) {
        return global.ChunkAPI.request('/api/recovery/' + encodeURIComponent(row.sourceId) + '/manifest', { method: 'GET' });
      }
    });
  }

  function captureConfirmedUnassigned(owner) {
    if (!global.LegacyBackup || typeof global.LegacyBackup.prepare !== 'function') {
      return Promise.reject(new Error('旧数据读取模块尚未加载；原数据未修改'));
    }
    return global.LegacyBackup.prepare(true).then(function (backup) {
      var redacted = [], localStorage = redactPrivateSettings(backup.legacyArchive.localKeys, 'legacy.localStorage', redacted);
      if (typeof localStorage['chunklab.v1'] === 'string') {
        try {
          localStorage['chunklab.v1'] = JSON.stringify(redactPrivateSettings(JSON.parse(localStorage['chunklab.v1']),
            'legacy.localStorage.chunklab.v1', redacted));
        } catch (_) { /* Keep malformed original for manual inspection; never auto-merge it. */ }
      }
      var stores = redactPrivateSettings(backup.legacyArchive.stores, 'legacy.indexedDB', redacted);
      return { capturedAt: new Date().toISOString(), localStorage: localStorage, stores: stores,
        legacyOwnerConfirmed: true, sourceOwner: 'legacy-unassigned', targetOwner: owner,
        redactedPrivateFields: Array.from(new Set(redacted)).sort() };
    });
  }

  function handoverPendingOperations() {
    var account = global.AccountStorage, api = global.ChunkAPI, store = global.IDBStore;
    if (!account || typeof account.assertCurrent !== 'function' || !api || typeof api.request !== 'function' ||
        !store || typeof store.putPendingOperation !== 'function') {
      var unavailable = new Error('旧待办接管存储或账号校验尚未就绪；服务端写入暂不启用');
      unavailable.code = 'PENDING_HANDOVER_UNAVAILABLE';
      return Promise.reject(unavailable);
    }
    account.assertCurrent();
    var owner = account.owner, ownerParts;
    try { ownerParts = JSON.parse(owner); } catch (_) { return Promise.resolve({ queued: 0, retained: 0 }); }
    var base = new URL(api.getBase() || global.location.origin, global.location.origin).href.replace(/\/+$/, '');
    if (!Array.isArray(ownerParts) || ownerParts.length !== 2 || ownerParts[0] !== base || !ownerParts[1]) {
      return Promise.resolve({ queued: 0, retained: 0, reason: 'scope-mismatch' });
    }
    var scope = JSON.stringify([base, owner, 3]);
    function read(path) { return api.request(path, { method: 'GET' }); }
    async function listAllSources() {
      var sources = [], cursor = null;
      do {
        var path = '/api/recovery/sources?limit=100' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
        var page = await read(path);
        account.assertCurrent();
        if (!page || page.ok !== true || !Array.isArray(page.items)) throw new Error('恢复来源清单无效');
        sources = sources.concat(page.items.filter(function (source) { return source && source.verified === true; }));
        cursor = page.nextCursor || null;
      } while (cursor);
      return sources;
    }
    async function listSourceCandidates(source) {
      var items = [], cursor = null;
      do {
        var path = '/api/recovery/' + encodeURIComponent(source.sourceId) + '/pending-operations?limit=50' +
          (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
        var page = await read(path);
        account.assertCurrent();
        if (!page || page.ok !== true || page.sourceId !== source.sourceId || page.sourceHash !== source.sourceHash ||
            !Array.isArray(page.items)) throw new Error('待接管来源清单无效');
        if (page.owner !== owner) {
          var foreignScope = new Error('待接管来源属于其他账号或服务范围；原件保留且不会混入当前账号');
          foreignScope.code = 'RECOVERY_SCOPE_MISMATCH';
          throw foreignScope;
        }
        page.items.forEach(function (item) {
          if (!item || typeof item.requestId !== 'string' || !item.requestId || !item.operation ||
              item.operation.protocol !== 3 || item.operation.requestId !== item.requestId || item.base !== base ||
              !Number.isFinite(item.createdAt) || !Number.isSafeInteger(item.ordinal) || item.ordinal < 1) return;
          items.push({ sourceId: source.sourceId, sourceHash: source.sourceHash,
            sourceCapturedAt: page.sourceCapturedAt || source.createdAt, owner: page.owner, base: item.base,
            createdAt: item.createdAt, ordinal: item.ordinal, requestId: item.requestId, operation: item.operation });
        });
        cursor = page.nextCursor || null;
      } while (cursor);
      return items;
    }
    return listAllSources().then(async function (sources) {
      var candidates = [], scopeSkipped = 0;
      for (var sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
        /* A verified source is part of the account's durable history. If its
           candidate list cannot be read, proceeding with only the other
           sources could let newer writes overtake an older archived action. */
        try { candidates = candidates.concat(await listSourceCandidates(sources[sourceIndex])); }
        catch (error) {
          if (error && error.code === 'SESSION_CHANGED') throw error;
          if (error && error.code === 'RECOVERY_SCOPE_MISMATCH') { scopeSkipped++; continue; }
          throw error;
        }
      }
      account.assertCurrent();
      candidates.sort(function (a, b) {
        return String(a.sourceCapturedAt).localeCompare(String(b.sourceCapturedAt)) ||
          a.ordinal - b.ordinal || a.requestId.localeCompare(b.requestId);
      });
      var byRequest = new Map();
      var conflicts = new Set();
      candidates.forEach(function (candidate) {
        var old = byRequest.get(candidate.requestId);
        if (old && canonical(old.operation) !== canonical(candidate.operation)) conflicts.add(candidate.requestId);
        else if (!old) byRequest.set(candidate.requestId, candidate);
      });
      var rows = Array.from(byRequest.values()).filter(function (candidate) { return !conflicts.has(candidate.requestId); });
      var conflictedRows = candidates.filter(function (candidate) { return conflicts.has(candidate.requestId); }).length;
      var result = { queued: 0, retained: conflictedRows, conflicts: conflictedRows, queueFailures: 0, scopeSkipped: scopeSkipped };
      for (var i = 0; i < rows.length; i++) {
        account.assertCurrent();
        var candidate = rows[i], bytes = new global.Blob([JSON.stringify(candidate.operation)]).size;
        var row = { requestId: candidate.requestId, operation: candidate.operation, owner: owner,
          sessionEpoch: account.sessionEpoch || '', base: base, scope: scope, createdAt: candidate.createdAt,
          attempts: 0, lastError: null, status: 'pending', bytes: bytes, attemptEvidenceVersion: 1,
          recoverySourceId: candidate.sourceId, recoverySourceHash: candidate.sourceHash };
        var isLargeImport = (candidate.operation.type === 'course.put' || candidate.operation.type === 'deck.put') &&
          bytes > 20 * 1024 * 1024;
        try {
          await store.putPendingOperation(row, { maxCount: 10000,
            maxBytes: isLargeImport ? 100 * 1024 * 1024 : 20 * 1024 * 1024 });
          account.assertCurrent();
          result.queued++;
        } catch (error) {
          result.retained++;
          result.queueFailures++;
          if (global.console && typeof global.console.warn === 'function') {
            global.console.warn('[recovery] archived operation kept for retry:', candidate.requestId,
              error && (error.code || error.message) || 'QUEUE_UNAVAILABLE');
          }
        }
      }
      return result;
    });
  }

  function assertHandoverDurable(result) {
    if (!result || !Number.isSafeInteger(result.queueFailures) || result.queueFailures < 0) {
      var invalid = new Error('旧待办耐久接管结果无效；服务端写入暂不启用');
      invalid.code = 'PENDING_HANDOVER_UNAVAILABLE';
      throw invalid;
    }
    if (result.queueFailures > 0) {
      var incomplete = new Error('部分旧待办无法进入耐久发送队列；服务端写入暂不启用');
      incomplete.code = 'PENDING_HANDOVER_INCOMPLETE';
      incomplete.retained = result.queueFailures;
      throw incomplete;
    }
    return result;
  }

  function archiveConfirmedUnassigned(confirmed) {
    if (confirmed !== true || global.localStorage.getItem('chunklab.storage-owner.v1') !== 'legacy-unassigned') {
      return Promise.reject(new Error('请先确认旧数据归属；原数据未修改'));
    }
    return createBrowserService('confirmed-unassigned', captureConfirmedUnassigned).archive(true);
  }

  var api = { create: create, createImportRecovery: createImportRecovery, buildImportedBackupSource: buildImportedBackupSource,
    canonical: canonical, redactPrivateSettings: redactPrivateSettings, uploadSource: uploadSource, attachConflictPair: attachConflictPair,
    handoverPendingOperations: handoverPendingOperations, assertHandoverDurable: assertHandoverDurable, FORMAT: FORMAT };
  if (global && global.window === global && global.AccountStorage && global.IDBStore && global.ChunkAPI) {
  api.archiveCurrent = createBrowserService('account-local').archive;
  api.archiveConflictPair = archiveConflictPair;
    api.archiveConfirmedUnassigned = archiveConfirmedUnassigned;
    api.prepareImportedBackup = prepareImportedBackup;
  }
  return api;
});
