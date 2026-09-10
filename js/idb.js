/**
 * idb.js · IndexedDB 存储层（ADR：大对象迁出 localStorage，解除 5MB 配额）
 *
 * 承接 courses（含 base64 图片，最大）、courseProgress，以及句子级学习档案
 * （sentenceStats）与练习事件日志（events）。后两者是 2026-09-10 扩容到 8000 句时
 * 新增的：它们是「随练习量无限增长」的数据，localStorage 无增量写语义 →
 * 每次答题都要全量 JSON.stringify 并整键覆写（8000 句实测 188ms/次，且体积超 5MB
 * 配额后 setItem 直接抛 QuotaExceeded，旧代码只 console.error → 静默丢数据）。
 * 迁到 IDB 后热路径只需写「变更的那几行」。
 *
 * 设计：
 *   - 内存缓存桥在 core.js（loadMem 内存优先），本模块只负责 IndexedDB 读写，不碰 localStorage。
 *   - 全部 store 按实体逐条存（增量友好）：courses→courseId、progress→cid、
 *     sentenceStats→key(deckId#cid)、events→id。
 *   - 全量替换语义（clear + 批量 put，单事务）：putCourses / putProgress /
 *     replaceSentenceStats / replaceEvents；
 *     增量语义（只写传入的行，单事务）：putSentenceStats / deleteSentenceStats / appendEvents。
 *
 * 迁移：DB_VERSION 1 → 2 只新增 objectStore，不动既有数据（onupgradeneeded 内逐个建）。
 * 浏览器：<script src="js/idb.js"></script>（core.js 之前加载）
 */
(function (global) {
  'use strict';

  var DB_NAME = 'chunklab-idb';
  var DB_VERSION = 2;
  var _db = null;
  var _opening = null;

  /* 所有 objectStore 定义集中一处，建库与升级共用 */
  var STORES = ['courses', 'progress', 'sentenceStats', 'events'];

  function open() {
    if (_db) return Promise.resolve(_db);
    if (_opening) return _opening;
    _opening = new Promise(function (resolve, reject) {
      if (!global.indexedDB) { reject(new Error('IndexedDB 不可用')); return; }
      var req = global.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        /* 逐个判断：老库（v1）升级时只补缺的，不清空既有 courses/progress */
        if (!db.objectStoreNames.contains('courses')) db.createObjectStore('courses', { keyPath: 'courseId' });
        if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress', { keyPath: 'cid' });
        if (!db.objectStoreNames.contains('sentenceStats')) db.createObjectStore('sentenceStats', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('events')) db.createObjectStore('events', { keyPath: 'id' });
      };
      req.onsuccess = function (e) { _db = e.target.result; resolve(_db); };
      req.onerror = function () { reject(req.error || new Error('打开 IndexedDB 失败')); };
    });
    _opening.then(null, function () { _opening = null; }); /* 失败后允许重试 */
    return _opening;
  }

  function tx(store, mode) {
    return open().then(function (db) { return db.transaction(store, mode).objectStore(store); });
  }

  /* 通用：单 store 全量读，rows → { keyPath值: 行 } 或数组 */
  function getAllRows(storeName) {
    return tx(storeName, 'readonly').then(function (s) {
      return new Promise(function (resolve, reject) {
        var req = s.getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  /* 通用：单事务里跑一批 put，返回 Promise（rows 为空则跳过，避免无谓事务） */
  function putRows(storeName, rows) {
    if (!rows || !rows.length) return Promise.resolve(0);
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(storeName, 'readwrite');
        var s = t.objectStore(storeName);
        rows.forEach(function (r) { s.put(r); });
        t.oncomplete = function () { resolve(rows.length); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('abort')); };
      });
    });
  }

  /* 通用：单事务里跑一批 delete，返回 Promise */
  function deleteKeys(storeName, keys) {
    if (!keys || !keys.length) return Promise.resolve(0);
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(storeName, 'readwrite');
        var s = t.objectStore(storeName);
        keys.forEach(function (k) { s.delete(k); });
        t.oncomplete = function () { resolve(keys.length); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('abort')); };
      });
    });
  }

  /* 通用：单事务全量替换 */
  function replaceAll(storeName, rows) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(storeName, 'readwrite');
        var s = t.objectStore(storeName);
        s.clear();
        (rows || []).forEach(function (r) { s.put(r); });
        t.oncomplete = function () { resolve(); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('abort')); };
      });
    });
  }

  /* 全量载入：{ courses, courseProgress, sentenceStats, events } */
  function loadAll() {
    return Promise.all([
      getAllRows('courses'),
      getAllRows('progress'),
      getAllRows('sentenceStats'),
      getAllRows('events')
    ]).then(function (parts) {
      var progress = {};
      parts[1].forEach(function (r) { progress[r.cid] = r.data; });
      var sentenceStats = {};
      parts[2].forEach(function (r) { sentenceStats[r.key] = r.data; });
      return {
        courses: parts[0],
        courseProgress: progress,
        sentenceStats: sentenceStats,
        events: parts[3]
      };
    });
  }

  /* 全量替换 courses（单事务） */
  function putCourses(list) {
    return replaceAll('courses', (list || []).filter(function (c) { return c && c.courseId; }));
  }

  /* 全量替换 progress（单事务） */
  function putProgress(map) {
    return replaceAll('progress', Object.keys(map || {}).map(function (cid) { return { cid: cid, data: map[cid] }; }));
  }

  /* ★ 增量写句子档案：只写变更的 key（热路径），单事务 */
  function putSentenceStats(map) {
    var keys = Object.keys(map || {});
    return putRows('sentenceStats', keys.map(function (k) { return { key: k, data: map[k] }; }));
  }

  /* ★ 增量删句子档案：只删确实消失的 key，单事务 */
  function deleteSentenceStats(keys) {
    return deleteKeys('sentenceStats', keys || []);
  }

  /* ★ 全量替换句子档案（仅首次迁移 / 事件合并后重建时使用） */
  function replaceSentenceStats(map) {
    return replaceAll('sentenceStats', Object.keys(map || {}).map(function (k) { return { key: k, data: map[k] }; }));
  }

  /* ★ 增量追加事件（正常路径：只写新增的那几条） */
  function appendEvents(list) {
    return putRows('events', (list || []).filter(function (e) { return e && e.id; }));
  }

  /* ★ 全量替换事件（事件数组被整体重排/替换时使用，如云合并后的并集） */
  function replaceEvents(list) {
    return replaceAll('events', (list || []).filter(function (e) { return e && e.id; }));
  }

  global.IDBStore = {
    open: open,
    loadAll: loadAll,
    putCourses: putCourses,
    putProgress: putProgress,
    putSentenceStats: putSentenceStats,
    deleteSentenceStats: deleteSentenceStats,
    replaceSentenceStats: replaceSentenceStats,
    appendEvents: appendEvents,
    replaceEvents: replaceEvents,
    STORES: STORES
  };
})(window);

