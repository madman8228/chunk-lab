/**
 * idb.js · IndexedDB 存储层（ADR：大对象迁出 localStorage，解除 5MB 配额）
 *
 * 承接 courses（含 base64 图片，最大）与 courseProgress 的持久化。
 * 设计：
 *   - 内存缓存桥在 core.js（readCoursesRaw/readProgressRaw 内存优先），
 *     本模块只负责 IndexedDB 全量读写，不碰 localStorage。
 *   - courses 按 courseId 逐条存（增量友好）；progress 按 cid 逐条存。
 *   - putCourses / putProgress 为「全量替换」语义（clear + 批量 put，单事务）。
 * 浏览器：<script src="js/idb.js"></script>（core.js 之前加载）
 */
(function (global) {
  'use strict';

  var DB_NAME = 'chunklab-idb';
  var DB_VERSION = 1;
  var _db = null;
  var _opening = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    if (_opening) return _opening;
    _opening = new Promise(function (resolve, reject) {
      if (!global.indexedDB) { reject(new Error('IndexedDB 不可用')); return; }
      var req = global.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('courses')) db.createObjectStore('courses', { keyPath: 'courseId' });
        if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress', { keyPath: 'cid' });
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

  /* 全量载入：{ courses: [...], progress: {cid: data} } */
  function loadAll() {
    return Promise.all([
      tx('courses', 'readonly').then(function (s) {
        return new Promise(function (resolve, reject) {
          var req = s.getAll();
          req.onsuccess = function () { resolve(req.result || []); };
          req.onerror = function () { reject(req.error); };
        });
      }),
      tx('progress', 'readonly').then(function (s) {
        return new Promise(function (resolve, reject) {
          var req = s.getAll();
          req.onsuccess = function () {
            var rows = req.result || [];
            var map = {};
            rows.forEach(function (r) { map[r.cid] = r.data; });
            resolve(map);
          };
          req.onerror = function () { reject(req.error); };
        });
      })
    ]).then(function (parts) {
      return { courses: parts[0], courseProgress: parts[1] };
    });
  }

  /* 全量替换 courses（单事务） */
  function putCourses(list) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction('courses', 'readwrite');
        var s = t.objectStore('courses');
        s.clear();
        (list || []).forEach(function (c) { if (c && c.courseId) s.put(c); });
        t.oncomplete = function () { resolve(); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('abort')); };
      });
    });
  }

  /* 全量替换 progress（单事务） */
  function putProgress(map) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction('progress', 'readwrite');
        var s = t.objectStore('progress');
        s.clear();
        Object.keys(map || {}).forEach(function (cid) { s.put({ cid: cid, data: map[cid] }); });
        t.oncomplete = function () { resolve(); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('abort')); };
      });
    });
  }

  global.IDBStore = { open: open, loadAll: loadAll, putCourses: putCourses, putProgress: putProgress };
})(window);
