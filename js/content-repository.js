/* content-repository.js · 内置题库内容仓库（manifest + 分片）
 *
 * 页面不直接持有句子：deck 清单来自 manifest，内容按需取分片。
 * - 页面启动只读取小型 manifest（SW 已预缓存），builtins.js 只提供迁移表；
 * - 统计页只请求轻量 index 分片，真正练习时再按引用取完整详情；
 * - 真正开始某个内置题库时才请求对应分片；
 * - 内容源见 oral-book.js（构建期）与 scripts/build-content.mjs；
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
    /* ⚠️ manifest 拉取失败时的兜底 deck 清单，必须与构建产物一致（scripts/build-content.mjs 输出）。
       兜底只提供「课程清单 + 题数」，不含分片 → 点进练习会明确报错，不会静默给出空题库。
       2026-09-15：口语 8000 合并为 oral-book.js 唯一源，deck = 原书节（大节按 ● 子场景拆分）。 */
    decks: [
      { id: "oral-1-1-1", name: "日常口语 8000 · 在家中 · 从起床到出门", short: "从起床到出门", chapter: 1, section: "1.1", sectionTitle: "在家中", topic: "从起床到出门", baseCount: 0, totalCount: 53, shards: [], indexShards: [] },
      { id: "oral-1-1-2", name: "日常口语 8000 · 在家中 · 从回家到就寝", short: "从回家到就寝", chapter: 1, section: "1.1", sectionTitle: "在家中", topic: "从回家到就寝", baseCount: 0, totalCount: 68, shards: [], indexShards: [] },
      { id: "oral-1-1-3", name: "日常口语 8000 · 在家中 · 休息日～理财", short: "休息日～理财", chapter: 1, section: "1.1", sectionTitle: "在家中", topic: "休息日～理财", baseCount: 0, totalCount: 31, shards: [], indexShards: [] },
      { id: "oral-1-2-1", name: "日常口语 8000 · 享受余暇时间 · 邀请友人～去听音乐会", short: "邀请友人～去听音乐会", chapter: 1, section: "1.2", sectionTitle: "享受余暇时间", topic: "邀请友人～去听音乐会", baseCount: 0, totalCount: 22, shards: [], indexShards: [] },
      { id: "oral-1-2-2", name: "日常口语 8000 · 享受余暇时间 · 打高尔夫球～唱卡拉OK", short: "打高尔夫球～唱卡拉OK", chapter: 1, section: "1.2", sectionTitle: "享受余暇时间", topic: "打高尔夫球～唱卡拉OK", baseCount: 0, totalCount: 5, shards: [], indexShards: [] },
      { id: "oral-1-3-1", name: "日常口语 8000 · 生病、受伤时 · 请医生看病", short: "请医生看病", chapter: 1, section: "1.3", sectionTitle: "生病、受伤时", topic: "请医生看病", baseCount: 0, totalCount: 13, shards: [], indexShards: [] },
      { id: "oral-1-3-2", name: "日常口语 8000 · 生病、受伤时 · 陈述症状", short: "陈述症状", chapter: 1, section: "1.3", sectionTitle: "生病、受伤时", topic: "陈述症状", baseCount: 0, totalCount: 11, shards: [], indexShards: [] },
      { id: "oral-1-5-1", name: "日常口语 8000 · 在工作单位 · 在办公室", short: "在办公室", chapter: 1, section: "1.5", sectionTitle: "在工作单位", topic: "在办公室", baseCount: 0, totalCount: 20, shards: [], indexShards: [] },
      { id: "oral-1-6-1", name: "日常口语 8000 · 电话 · 打电话～留言、接受留言", short: "打电话～留言、接受留言", chapter: 1, section: "1.6", sectionTitle: "电话", topic: "打电话～留言、接受留言", baseCount: 0, totalCount: 6, shards: [], indexShards: [] },
      { id: "oral-1-6-2", name: "日常口语 8000 · 电话 · 挂断电话～打电话遇到困难时", short: "挂断电话～打电话遇到困难时", chapter: 1, section: "1.6", sectionTitle: "电话", topic: "挂断电话～打电话遇到困难时", baseCount: 0, totalCount: 3, shards: [], indexShards: [] },
      { id: "oral-1-7", name: "日常口语 8000 · 日期和时间", short: "日期和时间", chapter: 1, section: "1.7", sectionTitle: "日期和时间", topic: "", baseCount: 0, totalCount: 28, shards: [], indexShards: [] },
      { id: "oral-2-8-1", name: "日常口语 8000 · 见面、分手时 · 碰到友人～好久不见", short: "碰到友人～好久不见", chapter: 2, section: "2.8", sectionTitle: "见面、分手时", topic: "碰到友人～好久不见", baseCount: 0, totalCount: 13, shards: [], indexShards: [] },
      { id: "oral-2-8-2", name: "日常口语 8000 · 见面、分手时 · 分手时～拜访", short: "分手时～拜访", chapter: 2, section: "2.8", sectionTitle: "见面、分手时", topic: "分手时～拜访", baseCount: 0, totalCount: 13, shards: [], indexShards: [] },
      { id: "oral-2-8-3", name: "日常口语 8000 · 见面、分手时 · 介绍某人～有关工作", short: "介绍某人～有关工作", chapter: 2, section: "2.8", sectionTitle: "见面、分手时", topic: "介绍某人～有关工作", baseCount: 0, totalCount: 3, shards: [], indexShards: [] },
      { id: "oral-2-8-4", name: "日常口语 8000 · 见面、分手时 · 有关学校～有关年龄、身高和体重", short: "有关学校～有关年龄、身高和体重", chapter: 2, section: "2.8", sectionTitle: "见面、分手时", topic: "有关学校～有关年龄、身高和体重", baseCount: 0, totalCount: 15, shards: [], indexShards: [] },
      { id: "oral-2-8-5", name: "日常口语 8000 · 见面、分手时 · 有关天气", short: "有关天气", chapter: 2, section: "2.8", sectionTitle: "见面、分手时", topic: "有关天气", baseCount: 0, totalCount: 8, shards: [], indexShards: [] },
      { id: "oral-2-9-1", name: "日常口语 8000 · 随意的谈话 · 征求意见～不明白、不知道", short: "征求意见～不明白、不知道", chapter: 2, section: "2.9", sectionTitle: "随意的谈话", topic: "征求意见～不明白、不知道", baseCount: 0, totalCount: 4, shards: [], indexShards: [] },
      { id: "oral-2-9-2", name: "日常口语 8000 · 随意的谈话 · 反问～随声附和", short: "反问～随声附和", chapter: 2, section: "2.9", sectionTitle: "随意的谈话", topic: "反问～随声附和", baseCount: 0, totalCount: 4, shards: [], indexShards: [] },
      { id: "oral-2-9-3", name: "日常口语 8000 · 随意的谈话 · 一时语塞～下决心", short: "一时语塞～下决心", chapter: 2, section: "2.9", sectionTitle: "随意的谈话", topic: "一时语塞～下决心", baseCount: 0, totalCount: 11, shards: [], indexShards: [] },
      { id: "oral-2-10-1", name: "日常口语 8000 · 提醒、忠告 · 教诲、告诫", short: "教诲、告诫", chapter: 2, section: "2.10", sectionTitle: "提醒、忠告", topic: "教诲、告诫", baseCount: 0, totalCount: 5, shards: [], indexShards: [] },
      { id: "oral-2-10-2", name: "日常口语 8000 · 提醒、忠告 · 提醒～责备", short: "提醒～责备", chapter: 2, section: "2.10", sectionTitle: "提醒、忠告", topic: "提醒～责备", baseCount: 0, totalCount: 3, shards: [], indexShards: [] },
      { id: "oral-2-10-3", name: "日常口语 8000 · 提醒、忠告 · 制止～警告", short: "制止～警告", chapter: 2, section: "2.10", sectionTitle: "提醒、忠告", topic: "制止～警告", baseCount: 0, totalCount: 7, shards: [], indexShards: [] },
      { id: "oral-2-11-1", name: "日常口语 8000 · 内心表白 · 道谢～关心对方", short: "道谢～关心对方", chapter: 2, section: "2.11", sectionTitle: "内心表白", topic: "道谢～关心对方", baseCount: 0, totalCount: 18, shards: [], indexShards: [] },
      { id: "oral-2-11-2", name: "日常口语 8000 · 内心表白 · 表扬", short: "表扬", chapter: 2, section: "2.11", sectionTitle: "内心表白", topic: "表扬", baseCount: 0, totalCount: 6, shards: [], indexShards: [] },
      { id: "oral-3-12-1", name: "日常口语 8000 · 商谈 · 赞成～否定", short: "赞成～否定", chapter: 3, section: "3.12", sectionTitle: "商谈", topic: "赞成～否定", baseCount: 0, totalCount: 8, shards: [], indexShards: [] },
      { id: "oral-3-12-2", name: "日常口语 8000 · 商谈 · 含糊其辞的回答～提出、询问意见", short: "含糊其辞的回答～提出、询问意见", chapter: 3, section: "3.12", sectionTitle: "商谈", topic: "含糊其辞的回答～提出、询问意见", baseCount: 0, totalCount: 6, shards: [], indexShards: [] },
      { id: "oral-3-13-1", name: "日常口语 8000 · 提出要求 · 请求帮助～提议", short: "请求帮助～提议", chapter: 3, section: "3.13", sectionTitle: "提出要求", topic: "请求帮助～提议", baseCount: 0, totalCount: 6, shards: [], indexShards: [] },
      { id: "oral-3-13-2", name: "日常口语 8000 · 提出要求 · 接受请求和建议～拒绝请求和建议", short: "接受请求和建议～拒绝请求和建议", chapter: 3, section: "3.13", sectionTitle: "提出要求", topic: "接受请求和建议～拒绝请求和建议", baseCount: 0, totalCount: 2, shards: [], indexShards: [] },
      { id: "oral-4-17-1", name: "日常口语 8000 · 生气时 · 不满和牢骚时～发怒", short: "不满和牢骚时～发怒", chapter: 4, section: "4.17", sectionTitle: "生气时", topic: "不满和牢骚时～发怒", baseCount: 0, totalCount: 7, shards: [], indexShards: [] },
      { id: "oral-4-18", name: "日常口语 8000 · 悲伤时", short: "悲伤时", chapter: 4, section: "4.18", sectionTitle: "悲伤时", topic: "", baseCount: 0, totalCount: 3, shards: [], indexShards: [] },
      { id: "oral-4-19", name: "日常口语 8000 · 喜欢、讨厌时", short: "喜欢、讨厌时", chapter: 4, section: "4.19", sectionTitle: "喜欢、讨厌时", topic: "", baseCount: 0, totalCount: 1, shards: [], indexShards: [] },
      { id: "oral-4-20", name: "日常口语 8000 · 安慰时", short: "安慰时", chapter: 4, section: "4.20", sectionTitle: "安慰时", topic: "", baseCount: 0, totalCount: 18, shards: [], indexShards: [] },
      { id: "oral-4-21", name: "日常口语 8000 · 怀疑时", short: "怀疑时", chapter: 4, section: "4.21", sectionTitle: "怀疑时", topic: "", baseCount: 0, totalCount: 1, shards: [], indexShards: [] },
      { id: "oral-4-22", name: "日常口语 8000 · 为难时", short: "为难时", chapter: 4, section: "4.22", sectionTitle: "为难时", topic: "", baseCount: 0, totalCount: 2, shards: [], indexShards: [] },
      { id: "oral-4-23", name: "日常口语 8000 · 不感兴趣时", short: "不感兴趣时", chapter: 4, section: "4.23", sectionTitle: "不感兴趣时", topic: "", baseCount: 0, totalCount: 2, shards: [], indexShards: [] },
      { id: "oral-4-25", name: "日常口语 8000 · 吃惊时", short: "吃惊时", chapter: 4, section: "4.25", sectionTitle: "吃惊时", topic: "", baseCount: 0, totalCount: 1, shards: [], indexShards: [] },
      { id: "oral-6-29-1", name: "日常口语 8000 · 在飞机上、饭店里 · 在飞机上～在饭店遇到困难时", short: "在飞机上～在饭店遇到困难时", chapter: 6, section: "6.29", sectionTitle: "在飞机上、饭店里", topic: "在飞机上～在饭店遇到困难时", baseCount: 0, totalCount: 8, shards: [], indexShards: [] },
      { id: "oral-6-30-1", name: "日常口语 8000 · 走在街上的时候 · 问路", short: "问路", chapter: 6, section: "6.30", sectionTitle: "走在街上的时候", topic: "问路", baseCount: 0, totalCount: 7, shards: [], indexShards: [] },
      { id: "oral-6-30-2", name: "日常口语 8000 · 走在街上的时候 · 乘坐交通工具～交通标志", short: "乘坐交通工具～交通标志", chapter: 6, section: "6.30", sectionTitle: "走在街上的时候", topic: "乘坐交通工具～交通标志", baseCount: 0, totalCount: 10, shards: [], indexShards: [] },
      { id: "oral-6-31", name: "日常口语 8000 · 购物时", short: "购物时", chapter: 6, section: "6.31", sectionTitle: "购物时", topic: "", baseCount: 0, totalCount: 96, shards: [], indexShards: [] },
      { id: "oral-6-32-1", name: "日常口语 8000 · 在外用餐时 · 在快餐厅里～点菜", short: "在快餐厅里～点菜", chapter: 6, section: "6.32", sectionTitle: "在外用餐时", topic: "在快餐厅里～点菜", baseCount: 0, totalCount: 7, shards: [], indexShards: [] },
      { id: "oral-6-32-2", name: "日常口语 8000 · 在外用餐时 · 饭桌上～付款", short: "饭桌上～付款", chapter: 6, section: "6.32", sectionTitle: "在外用餐时", topic: "饭桌上～付款", baseCount: 0, totalCount: 3, shards: [], indexShards: [] },
      { id: "oral-6-33", name: "日常口语 8000 · 外出旅行时", short: "外出旅行时", chapter: 6, section: "6.33", sectionTitle: "外出旅行时", topic: "", baseCount: 0, totalCount: 2, shards: [], indexShards: [] },
      { id: "oral-8-39", name: "日常口语 8000 · 谚语、惯用语", short: "谚语、惯用语", chapter: 8, section: "8.39", sectionTitle: "谚语、惯用语", topic: "", baseCount: 0, totalCount: 2, shards: [], indexShards: [] },
      { id: "oral-basic", name: "日常口语 8000 · 万能表达", short: "万能表达", chapter: 0, section: "0", sectionTitle: "万能表达", topic: "", baseCount: 0, totalCount: 10, shards: [], indexShards: [] },
      { id: "builtin-freq-idioms", name: "高频短语 · English Idioms", short: "高频短语", chapter: null, section: "", sectionTitle: "", topic: "", baseCount: 0, totalCount: 418, shards: [], indexShards: [] }
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
      /* 内容现在全部来自分片；没有 shards 说明构建产物与代码不匹配 → 明确失败，不静默给空库。 */
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
