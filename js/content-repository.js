/* content-repository.js · 内置题库内容仓库（manifest + 分片）
 *
 * 这是旧版 window.BUILTIN 的兼容适配层：
 * - 页面启动只读取小型 manifest，并保留 builtins.js 的基础 88 句；
 * - 统计页只请求轻量 index 分片，真正练习时再按引用取完整详情；
 * - 真正开始某个内置题库时才请求对应分片；
 * - 题库分片加载失败时回退到旧版 oral8000.js / freq-idioms.js；
 * - 用户学习档案仍由 core.js/IndexedDB 管理，不把题库内容放进 /api/data。
 */
(function (global) {
  'use strict';

  var MANIFEST_URL = 'content/manifest.json';
  /* 练习批次的开关阈值：当前 238/389 句题库保持既有“通关整库”语义；
     未来 8000 句只把一批内容交给练习页。管理和统计不受此阈值影响。 */
  var PRACTICE_BATCH_THRESHOLD = 1000;
  var CONTENT_DB_NAME = 'chunklab-content-v1';
  var CONTENT_STORE = 'shards';
  var FALLBACK_MANIFEST = {
    schemaVersion: 1,
    contentVersion: 'legacy-fallback',
    decks: [
      { id: 'builtin-daily', name: '日常对话 · Daily Talk', baseCount: 88, totalCount: 238, shards: [], indexShards: [], legacyFallback: 'oral8000.js' },
      { id: 'builtin-freq-idioms', name: '高频短语 · English Idioms', baseCount: 0, totalCount: 389, shards: [], indexShards: [], legacyFallback: 'freq-idioms.js' }
    ]
  };
  var manifest = null;
  var readyPromise = null;
  var loading = {};
  var loaded = {};
  var memoryShards = {};
  var memoryIndexShards = {};
  var contentDb = null;
  var contentDbOpening = null;

  function byId(id) {
    var decks = (global.BUILTIN || []);
    for (var i = 0; i < decks.length; i++) if (decks[i].id === id) return decks[i];
    return null;
  }

  function entryById(id) {
    var list = (manifest && manifest.decks) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function copyDeck(deck, mem) {
    if (!deck) return null;
    var out = {};
    Object.keys(deck).forEach(function (k) { out[k] = deck[k]; });
    out.items = (deck.items || []).slice();
    /* 保持 core.js 的只读删除语义：加载分片后仍不能复活用户已隐藏的句子。 */
    if (mem && global.CL && global.CL.isItemDeleted) {
      out.items = out.items.filter(function (it) { return !global.CL.isItemDeleted(mem, deck.id, it); });
    }
    return out;
  }

  function installSummaries() {
    var decks = global.BUILTIN || (global.BUILTIN = []);
    ((manifest && manifest.decks) || []).forEach(function (entry) {
      var deck = byId(entry.id);
      if (!deck) {
        deck = {
          id: entry.id,
          builtin: true,
          name: entry.name || entry.id,
          desc: entry.desc || '',
          items: []
        };
        decks.push(deck);
      }
      deck._content = entry;
      deck.itemCount = Number(entry.totalCount) || (deck.items || []).length;
      deck._contentReady = false;
    });
  }

  /* ---------- 内容分片 IndexedDB 缓存 ----------
     单独建库，避免为内容扩容而改动学习数据 IDB 的版本号；缓存失效时仍可直接走网络/SW。 */
  function openContentDb() {
    if (contentDb) return Promise.resolve(contentDb);
    if (contentDbOpening) return contentDbOpening;
    contentDbOpening = new Promise(function (resolve, reject) {
      if (!global.indexedDB) { reject(new Error('IndexedDB 不可用')); return; }
      var req;
      try { req = global.indexedDB.open(CONTENT_DB_NAME, 1); }
      catch (e) { reject(e); return; }
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(CONTENT_STORE)) {
          db.createObjectStore(CONTENT_STORE, { keyPath: 'url' });
        }
      };
      req.onsuccess = function (e) {
        contentDb = e.target.result;
        contentDb.onversionchange = function () { contentDb.close(); contentDb = null; };
        resolve(contentDb);
      };
      req.onerror = function () { reject(req.error || new Error('打开内容缓存失败')); };
      req.onblocked = function () { reject(new Error('内容缓存被旧连接阻塞')); };
    });
    contentDbOpening.then(null, function () { contentDbOpening = null; });
    return contentDbOpening;
  }

  function cacheGet(url) {
    return openContentDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(CONTENT_STORE, 'readonly').objectStore(CONTENT_STORE).get(url);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error || new Error('读取内容缓存失败')); };
      });
    }).catch(function () { return null; });
  }

  function cachePut(record) {
    if (!record || !record.url) return Promise.resolve(false);
    return openContentDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(CONTENT_STORE, 'readwrite');
        tx.objectStore(CONTENT_STORE).put(record);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error || new Error('写入内容缓存失败')); };
        tx.onabort = function () { reject(tx.error || new Error('写入内容缓存中止')); };
      });
    }).catch(function () { return false; });
  }

  function pruneCache(currentManifest) {
    var allowed = {};
    (currentManifest.decks || []).forEach(function (entry) {
      (entry.shards || []).concat(entry.indexShards || []).forEach(function (shard) { allowed[shard.url] = true; });
    });
    return openContentDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(CONTENT_STORE, 'readwrite');
        var store = tx.objectStore(CONTENT_STORE);
        var req = store.getAll();
        req.onsuccess = function () {
          (req.result || []).forEach(function (row) {
            /* URL 带 hash，本身已包含版本；manifest 只保留当前仍可访问的版本。 */
            if (!allowed[row.url] || row.contentVersion !== currentManifest.contentVersion) store.delete(row.url);
          });
        };
        req.onerror = function () { reject(req.error || new Error('清理内容缓存失败')); };
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error || new Error('清理内容缓存失败')); };
        tx.onabort = function () { reject(tx.error || new Error('清理内容缓存中止')); };
      });
    }).catch(function () { return false; });
  }

  function validShardData(data, shard, record) {
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.items)) return false;
    if (Number(shard.count) !== data.items.length) return false;
    if (data.mode && shard.mode && data.mode !== shard.mode) return false;
    if (record && record.sha256 && shard.sha256 && record.sha256 !== shard.sha256) return false;
    return true;
  }

  function validIndexData(data, shard, record) {
    if (!validShardData(data, shard, record) || data.mode !== 'index') return false;
    return data.items.every(function (item) {
      return item && typeof item.cid === 'string' && item.cid &&
        typeof item.sentence === 'string' && typeof item.translation === 'string' &&
        typeof item.sourceUrl === 'string' && item.sourceUrl &&
        Number.isInteger(item.sourceOffset) && item.sourceOffset >= 0;
    });
  }

  function getManifest() { return manifest; }

  function loadManifest() {
    if (readyPromise) return readyPromise;
    readyPromise = fetch(MANIFEST_URL, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('manifest HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || data.schemaVersion !== 1 || !Array.isArray(data.decks)) throw new Error('manifest 格式不受支持');
        manifest = data;
        installSummaries();
        return pruneCache(manifest).then(function () { return manifest; });
      })
      .catch(function (err) {
        /* manifest 缺失时不阻塞旧版本启动；真正练习时仍可加载旧版源文件。 */
        manifest = FALLBACK_MANIFEST;
        installSummaries();
        console.warn('[content] manifest 加载失败，使用兼容回退：', err && err.message);
        return manifest;
      });
    return readyPromise;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('旧版内容源加载失败：' + src)); };
      document.head.appendChild(s);
    });
  }

  function loadShard(shard, options) {
    options = options || {};
    var useMemory = options.memory !== false;
    if (useMemory && memoryShards[shard.url]) return Promise.resolve(memoryShards[shard.url]);
    return cacheGet(shard.url).then(function (record) {
      if (record && validShardData(record.data, shard, record)) {
        if (useMemory) memoryShards[shard.url] = record.data;
        return record.data;
      }
      return fetch(shard.url, { cache: 'force-cache' })
        .then(function (res) {
          if (!res.ok) throw new Error(shard.url + ' HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          if (!validShardData(data, shard)) throw new Error('分片格式/数量不匹配：' + shard.url);
          if (useMemory) memoryShards[shard.url] = data;
          /* 不阻塞题目渲染；缓存失败不影响本次练习。 */
          cachePut({
            url: shard.url,
            contentVersion: manifest && manifest.contentVersion,
            sha256: shard.sha256 || '',
            count: data.items.length,
            mode: data.mode || shard.mode || '',
            data: data
          });
          return data;
        });
    });
  }

  function loadIndexShard(shard) {
    if (memoryIndexShards[shard.url]) return Promise.resolve(memoryIndexShards[shard.url]);
    return cacheGet(shard.url).then(function (record) {
      if (record && validIndexData(record.data, shard, record)) {
        memoryIndexShards[shard.url] = record.data;
        return record.data;
      }
      return fetch(shard.url, { cache: 'force-cache' })
        .then(function (res) {
          if (!res.ok) throw new Error(shard.url + ' HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          if (!validIndexData(data, shard)) throw new Error('index 格式/数量不匹配：' + shard.url);
          memoryIndexShards[shard.url] = data;
          cachePut({
            url: shard.url,
            contentVersion: manifest && manifest.contentVersion,
            sha256: shard.sha256 || '',
            count: data.items.length,
            mode: data.mode || 'index',
            kind: 'index',
            data: data
          });
          return data;
        });
    });
  }

  function loadLegacyContent(entry) {
    return loadScript(entry.legacyFallback).then(function () {
      var deck = byId(entry.id);
      if (!deck) throw new Error('找不到题库：' + entry.id);
      /* oral8000.js 自己负责把 DATA_ORAL8000 并入 builtin-daily，不能在这里再 concat 一次。 */
      deck.itemCount = deck.items.length;
      deck._contentReady = true;
      deck._legacyLoaded = true;
      loaded[entry.id] = true;
      console.warn('[content] 分片回退到旧版源：' + entry.legacyFallback);
      return deck;
    });
  }

  function loadDeckContent(entry) {
    var id = entry.id;
    if (loaded[id]) return loaded[id];
    if (loading[id]) return loading[id];
    var shards = entry.shards || [];
    if (!shards.length) {
      loading[id] = loadLegacyContent(entry);
      return loading[id];
    }
    loading[id] = Promise.all(shards.map(loadShard))
      .then(function (parts) {
        var deck = byId(id);
        if (!deck) throw new Error('找不到题库：' + id);
        var items = [];
        parts.forEach(function (part) { items = items.concat(part.items); });
        if (shards[0].mode === 'append') {
          deck.items = (deck.items || []).concat(items);
        } else if (items.length || !(deck.items || []).length) {
          deck.items = items;
        }
        deck.itemCount = deck.items.length;
        deck._contentReady = true;
        loaded[id] = true;
        return deck;
      })
      .catch(function (err) {
        /* 旧源只在分片取不到时使用一次，避免网络恢复后重复 concat。 */
        if (!entry.legacyFallback) throw err;
        return loadLegacyContent(entry);
      });
    return loading[id];
  }

  function ensureDeck(deckOrId, mem) {
    return loadManifest().then(function () {
      var id = typeof deckOrId === 'string' ? deckOrId : (deckOrId && deckOrId.id);
      var entry = entryById(id);
      var current = byId(id);
      if (!entry || !current) return deckOrId;
      if (current._contentReady) return copyDeck(current, mem);
      return loadDeckContent(entry).then(function (full) { return copyDeck(full, mem); });
    });
  }

  function shouldBatch(deckOrId) {
    var id = typeof deckOrId === 'string' ? deckOrId : (deckOrId && deckOrId.id);
    var entry = entryById(id);
    return !!(entry && (Number(entry.totalCount) || 0) > PRACTICE_BATCH_THRESHOLD && (entry.shards || []).length);
  }

  function findDetailShard(url) {
    var decks = (manifest && manifest.decks) || [];
    for (var i = 0; i < decks.length; i++) {
      var shards = decks[i].shards || [];
      for (var j = 0; j < shards.length; j++) if (shards[j].url === url) return shards[j];
    }
    return null;
  }

  function ensureDeckIndex(deckOrId, mem) {
    return loadManifest().then(function () {
      var id = typeof deckOrId === 'string' ? deckOrId : (deckOrId && deckOrId.id);
      var entry = entryById(id);
      var current = byId(id);
      if (!entry || !current) return copyDeck(deckOrId, mem);
      if (current._contentReady) return copyDeck(current, mem);
      var indexShards = entry.indexShards || [];
      if (!indexShards.length) return ensureDeck(id, mem);
      var append = entry.shards.length && entry.shards[0].mode === 'append';
      var baseItems = append ? (current.items || []).slice() : [];
      return Promise.all(indexShards.map(loadIndexShard)).then(function (parts) {
        var items = baseItems;
        parts.forEach(function (part) {
          (part.items || []).forEach(function (item) {
            var summary = {
              cid: item.cid,
              sentence: item.sentence,
              translation: item.translation,
              _contentRef: { url: item.sourceUrl, offset: item.sourceOffset }
            };
            items.push(summary);
          });
        });
        var out = {};
        Object.keys(current).forEach(function (k) { out[k] = current[k]; });
        out.items = items;
        out.itemCount = Number(entry.totalCount) || items.length;
        out._contentIndexReady = true;
        out._contentReady = false;
        return copyDeck(out, mem);
      }).catch(function (err) {
        /* 旧 manifest 或 index 发布不完整时保持旧版可用。 */
        if (!entry.legacyFallback) throw err;
        return ensureDeck(id, mem);
      });
    });
  }

  function hydrateItems(items, options) {
    items = Array.isArray(items) ? items : [];
    return loadManifest().then(function () {
      var groups = {};
      items.forEach(function (item) {
        var ref = item && item._contentRef;
        if (ref && ref.url) {
          if (!groups[ref.url]) groups[ref.url] = [];
          groups[ref.url].push(ref);
        }
      });
      var urls = Object.keys(groups);
      if (!urls.length) return items.slice();
      var loadedByUrl = {};
      return Promise.all(urls.map(function (url) {
        var shard = findDetailShard(url);
        if (!shard) throw new Error('找不到 index 指向的详情分片：' + url);
        return loadShard(shard, options).then(function (data) { loadedByUrl[url] = data; });
      })).then(function () {
        return items.map(function (item) {
          var ref = item && item._contentRef;
          if (!ref || !ref.url) return item;
          var data = loadedByUrl[ref.url];
          var actual = data && data.items && data.items[ref.offset];
          if (!actual || actual.cid !== item.cid) {
            actual = data && data.items && data.items.find(function (candidate) { return candidate.cid === item.cid; });
          }
          if (!actual) throw new Error('详情分片中找不到句子：' + item.cid);
          var out = {};
          Object.keys(actual).forEach(function (k) { out[k] = actual[k]; });
          Object.keys(item).forEach(function (k) { if (k.indexOf('_') === 0) out[k] = item[k]; });
          return out;
        });
      });
    });
  }

  function hydrateItemBatch(items, start, limit) {
    start = Math.max(0, Math.floor(Number(start) || 0));
    limit = Math.max(1, Math.min(200, Math.floor(Number(limit) || 10)));
    return hydrateItems((items || []).slice(start, start + limit), { memory: false });
  }

  function cloneCursor(c) {
    c = c || {};
    return {
      baseOffset: Math.max(0, Number(c.baseOffset) || 0),
      shardIndex: Math.max(0, Number(c.shardIndex) || 0),
      shardOffset: Math.max(0, Number(c.shardOffset) || 0),
      contentVersion: c.contentVersion || null
    };
  }

  function cursorDone(entry, cursor, baseLength) {
    var append = !!((entry.shards[0] || {}).mode === 'append');
    if (append && cursor.baseOffset < baseLength) return false;
    return cursor.shardIndex >= (entry.shards || []).length;
  }

  function cursorPosition(entry, cursor, baseLength) {
    var append = !!((entry.shards[0] || {}).mode === 'append');
    var pos = append ? Math.min(cursor.baseOffset, baseLength) : 0;
    var shards = entry.shards || [];
    for (var i = 0; i < cursor.shardIndex && i < shards.length; i++) pos += Number(shards[i].count) || 0;
    if (cursor.shardIndex < shards.length) pos += Math.min(cursor.shardOffset, Number(shards[cursor.shardIndex].count) || 0);
    return pos;
  }

  function batchEligible(id, item, mem, options) {
    if (!item) return false;
    if (mem && global.CL && global.CL.isItemDeleted && global.CL.isItemDeleted(mem, id, item)) return false;
    var skipMastered = options.skipMastered !== undefined
      ? options.skipMastered !== false
      : !(mem && mem.settings && mem.settings.skipMastered === false);
    if (!skipMastered || !mem || !global.CL) return true;
    var mastered = global.CL.isMastered && global.CL.isMastered(mem, id, item);
    var fluent = global.CL.isFluencyByDeck && global.CL.isFluencyByDeck(mem, id, item);
    var st = mem.stats && mem.stats.bySentence && global.CL.cidKey
      ? mem.stats.bySentence[global.CL.cidKey(id, item)] : null;
    var due = !!(st && global.CL.srs && global.CL.srs.isDue && global.CL.srs.isDue(st, Date.now()));
    /* 与 main.startDeck 的长期题库过滤保持一致：到期题必须回拉。 */
    return due || (!mastered && !fluent);
  }

  function legacyBatchResult(entry, full, mem, startCursor) {
    var out = copyDeck(full, mem);
    var total = out.items.length;
    return {
      deck: out,
      startCursor: cloneCursor(startCursor),
      nextCursor: { baseOffset: 0, shardIndex: (entry.shards || []).length, shardOffset: 0 },
      loadedCount: total,
      totalCount: total,
      remainingCount: 0,
      done: true,
      legacy: true
    };
  }

  /* 为超大内置题库取一批内容。
     cursor 是内容游标，不是学习统计游标：它只表示“已经扫描到分片哪里”。
     这样掌握/删除过滤不会改变 cid，也不会把题目复制到 localStorage。 */
  function ensureDeckBatch(deckOrId, mem, options) {
    options = options || {};
    return loadManifest().then(function () {
      var id = typeof deckOrId === 'string' ? deckOrId : (deckOrId && deckOrId.id);
      var entry = entryById(id);
      var current = byId(id);
      if (!entry || !current) {
        return { deck: copyDeck(deckOrId, mem), done: true, loadedCount: 0, totalCount: 0, remainingCount: 0 };
      }
      if (current._contentReady && !options.force) return legacyBatchResult(entry, current, mem, null);
      if (!options.force && !shouldBatch(id)) {
        return ensureDeck(id, mem).then(function (full) { return legacyBatchResult(entry, full, mem, null); });
      }

      var limit = Math.max(1, Number(options.limit) || (mem && mem.settings && mem.settings.batchSize) || 10);
      var append = entry.shards.length && entry.shards[0].mode === 'append';
      var baseItems = append ? (current.items || []).slice() : [];
      var progress = mem && mem.progress && mem.progress[id];
      var suppliedCursor = options.cursor || (progress && progress.contentCursor);
      // Offsets belong to a content release. Never carry them across reordered shards.
      if(suppliedCursor && suppliedCursor.contentVersion && suppliedCursor.contentVersion !== manifest.contentVersion) suppliedCursor = null;
      var startCursor = cloneCursor(suppliedCursor);
      startCursor.contentVersion = manifest.contentVersion;
      var cursor = cloneCursor(startCursor);
      var selected = [];

      function finish() {
        var done = cursorDone(entry, cursor, baseItems.length);
        var position = cursorPosition(entry, cursor, baseItems.length);
        var total = Number(entry.totalCount) || (Number(entry.baseCount) || 0);
        var out = {};
        Object.keys(current).forEach(function (k) { out[k] = current[k]; });
        out.items = selected;
        out.itemCount = selected.length;
        out._contentReady = false;
        out._contentBatchReady = true;
        return {
          deck: out,
          startCursor: cloneCursor(startCursor),
          nextCursor: Object.assign(cloneCursor(cursor), { contentVersion: manifest.contentVersion }),
          loadedCount: selected.length,
          totalCount: total,
          remainingCount: Math.max(0, total - position),
          done: done,
          legacy: false
        };
      }

      function scan() {
        if (selected.length >= limit || cursorDone(entry, cursor, baseItems.length)) return Promise.resolve(finish());
        if (append && cursor.baseOffset < baseItems.length) {
          while (cursor.baseOffset < baseItems.length && selected.length < limit) {
            var baseItem = baseItems[cursor.baseOffset++];
            if (batchEligible(id, baseItem, mem, options)) selected.push(baseItem);
          }
          return scan();
        }
        if (cursor.shardIndex >= entry.shards.length) return Promise.resolve(finish());
        var shard = entry.shards[cursor.shardIndex];
        return loadShard(shard, { memory: false }).then(function (data) {
          var items = data.items || [];
          while (cursor.shardOffset < items.length && selected.length < limit) {
            var item = items[cursor.shardOffset++];
            if (batchEligible(id, item, mem, options)) selected.push(item);
          }
          if (cursor.shardOffset >= items.length) {
            cursor.shardIndex++;
            cursor.shardOffset = 0;
          }
          return scan();
        });
      }

      return scan().catch(function (err) {
        /* 极端兼容路径：分片不可达时才退回旧整包源；正常在线/离线命中 IDB 不会走这里。 */
        if (!entry.legacyFallback) throw err;
        return loadLegacyContent(entry).then(function (full) { return legacyBatchResult(entry, full, mem, startCursor); });
      });
    });
  }

  function ensureAll(mem) {
    return loadManifest().then(function () {
      return Promise.all((manifest.decks || []).map(function (entry) { return ensureDeck(entry.id, mem); }));
    });
  }

  function ensureIndexAll(mem) {
    return loadManifest().then(function () {
      return Promise.all((manifest.decks || []).map(function (entry) { return ensureDeckIndex(entry.id, mem); })).then(function (builtins) {
        var builtinIds = {};
        builtins.forEach(function (deck) { if (deck) builtinIds[deck.id] = true; });
        var users = global.CL && global.CL.allDecks ? global.CL.allDecks(mem) : ((mem && mem.decks) || []);
        return builtins.concat(users.filter(function (deck) { return deck && !builtinIds[deck.id]; }).map(function (deck) { return copyDeck(deck, mem); }));
      });
    });
  }

  global.ContentRepo = {
    MANIFEST_URL: MANIFEST_URL,
    PRACTICE_BATCH_THRESHOLD: PRACTICE_BATCH_THRESHOLD,
    ready: loadManifest(),
    getManifest: getManifest,
    ensureDeck: ensureDeck,
    ensureDeckBatch: ensureDeckBatch,
    ensureDeckIndex: ensureDeckIndex,
    ensureIndexAll: ensureIndexAll,
    hydrateItems: hydrateItems,
    hydrateItemBatch: hydrateItemBatch,
    shouldBatch: shouldBatch,
    ensureAll: ensureAll
  };
})(window);
