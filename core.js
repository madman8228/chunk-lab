/* ============================================================
   core.js · Chunk Lab 共享核心（ADR-002：全局仅暴露 CL 单例）
   ------------------------------------------------------------
   承载三个页面共享的基础设施：
   - 存储：浏览器本地存储（同源，统一键 'chunklab.v1'，带版本迁移）
   - 工具：$ / esc / norm / normSent / timeAgo / copyText
   - 领域：masteredKey / findDeck / allDecks / 标熟·掌握判定
   - 通信：事件总线 + postMessage（iframe 与主页跨页通知）
   ============================================================ */
(function(global){
  'use strict';

  /* ★ 统一键：与主页面 main.html 一致
     （此前 stats/decks 用 chunklab_mem_v1 → 数据不同步，已修根因） */
  var STORE_KEY = 'chunklab.v1';
  var REVS_KEY = 'chunklab_revs_v1'; /* ADR-005：per-entity 版本号，独立于 mem 存储 */
  var LISTENERS = {};

  /* ADR-005 rev 基础设施：本地为每个可同步实体维护 rev（版本号），离线改动时升 rev；
     同步时随 payload 上送，服务端按 rev 冲突检测取新版本。多设备互不覆盖无关改动；
     删除走软删除标记跨设备传播。调用方（页面/业务模块）零改动。 */
  var SYNC_KV_KEYS = ['best', 'mastered', 'stats', 'settings', 'reinforceBook', 'deletedItems'];
  var _prevSnap = null; /* 上次保存的内存快照，用于 diff 检测变更/删除 */
  var _lastSyncMeta = { revs: { decks: {}, kv: {} }, deleted: { decks: [], kv: [] } };

  function loadRevs() {
    try { return JSON.parse(global.localStorage.getItem(REVS_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveRevs(r) {
    try { global.localStorage.setItem(REVS_KEY, JSON.stringify(r)); } catch (e) {}
  }
  function sigDeck(d) { return JSON.stringify([d.name || '', d.items || [], d.builtin ? 1 : 0]); }
  function sigKv(v) { return JSON.stringify(v); }
  /* kv 变更签名的分发点：只有 stats 需要走廉价路径（见 sigStats），其余照旧 JSON.stringify。 */
  function kvSig(k, v) { return k === 'stats' ? sigStats(v) : sigKv(v); }
  /* ★ stats 的变更签名必须廉价（2026-09-10 扩容 8000 句）。
     maintainRevs 在每次 saveMem 里都要比对 kv 签名，原先直接用 JSON.stringify(stats) ——
     8000 句时那是 7.5MB 的序列化，每次答题多花 ~130ms（实测：改造后答题写入 123ms 里几乎全是它）。
     这里换成「条数 + 各条数字签名的异或累积 + 事件尾 id」：
       - 任一句的任何计数字段变化 → statSig 变 → 异或结果变；
       - 档案增删 → n 变；
       - 每次答题都会 push 事件 → 事件尾 id 变；
       - 键名改写（cid 迁移）不依赖本签名：migrateCidKeys 分支显式 bump rev。
     成本 O(条数) 纯算术，8000 条约 0.5ms。 */
  function sigStats(st){
    if(!st || typeof st !== 'object') return '';
    var by = st.bySentence || {};
    var n = 0, x = 0;
    for(var k in by){ if(by.hasOwnProperty(k)){ n++; x = (x ^ statSig(by[k])) >>> 0; } }
    var ev = Array.isArray(st.events) ? st.events : [];
    var last = ev.length ? (ev[ev.length-1] && ev[ev.length-1].id) : '';
    return (st.totalRounds||0) + ':' + (st.totalAnswered||0) + ':' + n + ':' + x + ':' + ev.length + ':' + last +
      ':' + (st.daysLog ? Object.keys(st.daysLog).length : 0);
  }

  /* 在 saveMem 中调用：与上次快照 diff，自动升 rev 并登记软删除。 */
  function maintainRevs(m) {
    var revs = loadRevs();
    if (!revs.decks) revs.decks = {};
    if (!revs.kv) revs.kv = {};
    var deletes = { decks: [], kv: [] };
    var curDecks = {};
    (m.decks || []).forEach(function (d) { curDecks[d.id] = true; });
    if (_prevSnap) {
      (m.decks || []).forEach(function (d) {
        var prev = _prevSnap.decks[d.id];
        if (prev === undefined || sigDeck(d) !== prev) revs.decks[d.id] = (revs.decks[d.id] || 0) + 1;
      });
      Object.keys(_prevSnap.decks).forEach(function (id) {
        if (!curDecks[id]) { revs.decks[id] = (revs.decks[id] || 0) + 1; deletes.decks.push({ id: id, rev: revs.decks[id] }); }
      });
      SYNC_KV_KEYS.forEach(function (k) {
        var cur = (k in m) ? m[k] : undefined;
        var prev = _prevSnap.kv[k];
        if (prev === undefined) { if (cur !== undefined) revs.kv[k] = (revs.kv[k] || 0) + 1; }
        else if (cur === undefined) { /* 字段消失，罕见，忽略 */ }
        else if (kvSig(k, cur) !== prev) revs.kv[k] = (revs.kv[k] || 0) + 1;
      });
    } else {
      (m.decks || []).forEach(function (d) { if (!(d.id in revs.decks)) revs.decks[d.id] = 1; });
      SYNC_KV_KEYS.forEach(function (k) { if ((k in m) && !(k in revs.kv)) revs.kv[k] = 1; });
    }
    _prevSnap = { decks: {}, kv: {} };
    (m.decks || []).forEach(function (d) { _prevSnap.decks[d.id] = sigDeck(d); });
    SYNC_KV_KEYS.forEach(function (k) { if (k in m) _prevSnap.kv[k] = kvSig(k, m[k]); });
    saveRevs(revs);
    _lastSyncMeta = { revs: revs, deleted: deletes };
  }

  /* ADR-005 step 2：courses / courseProgress 的 rev 维护。
     它们不经 saveMem（由 library.js / course-package.js 直接写 localStorage），
     故在 cloudSyncNow 上行前做「惰性 diff」：与上次上行快照比较，变更升 rev、消失登记软删。
     首次上行（无快照）→ 新实体初始化 rev=1。 */
  var _coursesSnap = null;   /* {courseId: sig} */
  var _progressSnap = null;  /* {courseId: sig} */
  function sigCourse(c) { return JSON.stringify(c); }

  function maintainCoursesRevs() {
    var revs = loadRevs();
    if (!revs.courses) revs.courses = {};
    if (!revs.courseProgress) revs.courseProgress = {};
    var deleted = { courses: [], courseProgress: [] };

    var cur = readCoursesRaw();
    var curIds = {};
    cur.forEach(function (c) { curIds[c.courseId] = true; });
    if (_coursesSnap) {
      cur.forEach(function (c) {
        var prev = _coursesSnap[c.courseId];
        if (prev === undefined || sigCourse(c) !== prev) revs.courses[c.courseId] = (revs.courses[c.courseId] || 0) + 1;
      });
      Object.keys(_coursesSnap).forEach(function (cid) {
        if (!curIds[cid]) { revs.courses[cid] = (revs.courses[cid] || 0) + 1; deleted.courses.push({ id: cid, rev: revs.courses[cid] }); }
      });
    } else {
      cur.forEach(function (c) { if (!(c.courseId in revs.courses)) revs.courses[c.courseId] = 1; });
    }
    _coursesSnap = {};
    cur.forEach(function (c) { _coursesSnap[c.courseId] = sigCourse(c); });

    var pcur = readProgressRaw();
    if (_progressSnap) {
      Object.keys(pcur).forEach(function (cid) {
        var prev = _progressSnap[cid];
        if (prev === undefined || sigKv(pcur[cid]) !== prev) revs.courseProgress[cid] = (revs.courseProgress[cid] || 0) + 1;
      });
      Object.keys(_progressSnap).forEach(function (cid) {
        if (!(cid in pcur)) { revs.courseProgress[cid] = (revs.courseProgress[cid] || 0) + 1; deleted.courseProgress.push({ id: cid, rev: revs.courseProgress[cid] }); }
      });
    } else {
      Object.keys(pcur).forEach(function (cid) { if (!(cid in revs.courseProgress)) revs.courseProgress[cid] = 1; });
    }
    _progressSnap = {};
    Object.keys(pcur).forEach(function (cid) { _progressSnap[cid] = sigKv(pcur[cid]); });

    saveRevs(revs);
    return { revs: revs, deleted: deleted };
  }

  /* ---------- 存储版本化（版本迁移链） ----------
     version 语义：缺省 = 1（legacy）。写入时强制打当前版本。
     MIGRATIONS[n] = v(n) → v(n+1) 的迁移函数。 */
  var CURRENT_VERSION = 2;
  var MIGRATIONS = {
    1: function(raw){ /* v1→v2：无结构变化，仅建立版本化基础 */ return raw; }
  };

  function migrate(raw){
    if(!raw || typeof raw !== 'object') raw = {};
    var v = (typeof raw.version === 'number' && raw.version >= 1) ? raw.version : 1;
    if(v >= CURRENT_VERSION) return raw;
    for(var cur = v; cur < CURRENT_VERSION; cur++){
      var fn = MIGRATIONS[cur];
      if(fn){ try{ raw = fn(raw) || raw; }catch(e){ console.error('[core.migrate] v'+cur+'→v'+(cur+1), e); } }
      raw.version = cur + 1;
    }
    return raw;
  }

  /* 默认结构（缺省合并用） */
  function defaultMem(){
    return {
      decks: [], best: {}, mastered: {}, deletedItems: {},
      stats: { totalRounds:0, totalAnswered:0, bySentence:{}, events:[] },
      settings: {
        sound:true, shuffle:false, fxStack:true, celebrate:'confetti', mode:'choose',
        skipMastered:true, batchSize:10, autoSpeak:false, darkMode:false,
        provider:'deepseek', model:'deepseek-v4-flash', apiKey:''
      }
    };
  }

  /* ---------- 存储 ---------- */
  function loadMem(){
    var d = defaultMem();
    try{
      var o = migrate(JSON.parse(global.localStorage.getItem(STORE_KEY) || '{}'));
      var os = (o.stats && typeof o.stats === 'object') ? o.stats : {};
      var out = {
        decks: Array.isArray(o.decks) ? o.decks : d.decks,
        best: o.best || d.best,
        mastered: o.mastered || d.mastered,
        deletedItems: o.deletedItems || {},
        stats: {
          totalRounds: os.totalRounds || 0,
          totalAnswered: os.totalAnswered || 0,
          /* 大对象优先取内存桥（preload 从 IDB 载入）；未预载时读 localStorage 旧值 */
          bySentence: _bySentenceCache || ((os.bySentence && typeof os.bySentence === 'object') ? os.bySentence : {}),
          events: _eventsCache || (Array.isArray(os.events) ? os.events : []),
          daysLog: (os.daysLog && typeof os.daysLog === 'object') ? os.daysLog : {}
        },
        settings: Object.assign({}, d.settings, o.settings || {}),
        reinforceBook: o.reinforceBook || [],
        progress: o.progress || {},
        version: CURRENT_VERSION
      };
      /* ADR：句子档案 key 原文→cid 迁移（幂等）。变更即回写 + 对应 kv rev+1，确保上云。
         对「组装后的完整 stats」执行，同时覆盖 IDB 内存桥与 localStorage 旧值两条来源。 */
      try{
        if(migrateCidKeys(out)){
          /* 仅当大对象已托管给 IDB 时才回填内存桥；否则保持 null，让后续 loadMem 始终
             读 localStorage 真值（IDB 不可用时缓存会变「粘住」的陈旧副本 → 数据看起来丢失） */
          if(_statsStore === 'idb'){
            _bySentenceCache = out.stats.bySentence;
            _eventsCache = out.stats.events;
            _statsFullRewrite = true; /* 键被改写 → IDB 必须整块覆盖，不能按签名增量 */
          }
          saveMem(out);
          var _r = loadRevs();
          if(!_r.kv) _r.kv = {};
          ['stats', 'mastered', 'deletedItems'].forEach(function(k){ if(k in out) _r.kv[k] = (_r.kv[k] || 0) + 1; });
          saveRevs(_r);
          _prevSnap = null; /* 让下一次 saveMem 的 maintainRevs 走初始化分支，避免误 bump 合并结果 */
        }
      }catch(e){ console.error('[core.migrateCidKeys]', e); }
      return out;
    }catch(e){
      console.error('[core.loadMem]', e);
      return d;
    }
  }
  function saveMem(m){
    try{
      writeLocalMem(m);
      maintainRevs(m);
      /* 大对象增量落盘（异步，不阻塞答题）。
         若落盘失败，persistStats 会把托管模式降级为 'local' ——
         此时必须立刻用「未剥离」的完整 stats 重写 localStorage，否则本次 save 已经写下的
         是剥离版副本，大对象就真的没有落点了（实测过的丢数据路径）。 */
      if(_statsStore === 'idb' && m.stats){
        persistStats(m.stats).then(function(ok){
          if(ok === false && _statsStore === 'local'){
            try{ writeLocalMem(m); }
            catch(e2){ console.error('[core.saveMem] 降级回写 localStorage 也失败（配额不足）', e2); emit('persistError', { error: e2 }); }
          }
        });
      }
      return true;
    }
    catch(e){
      /* ★ 不再静默：配额/序列化失败必须让调用方与用户可感知（此前只 console.error + return false，
         8000 句超配额时表现为「练习记录凭空消失」）。 */
      console.error('[core.saveMem] 落盘失败（可能超出 localStorage 配额）', e);
      emit('persistError', { error: e });
      return false;
    }
  }
  /* 单一落点：把 mem 写进 localStorage。大对象已托管给 IDB 时只写小字段
     （这是解除 5MB 配额与 188ms/次写入延迟的关键，见 _statsStore 注释）。 */
  function writeLocalMem(m){
    var out = Object.assign({}, m);
    out.version = CURRENT_VERSION; /* 写入时强制版本 */
    if(_statsStore === 'idb' && m.stats && typeof m.stats === 'object'){
      var light = {}, s = m.stats;
      for(var k in s){ if(s.hasOwnProperty(k) && k !== 'bySentence' && k !== 'events') light[k] = s[k]; }
      out.stats = light;
    }
    global.localStorage.setItem(STORE_KEY, JSON.stringify(out));
  }
  /* 数据变更统一入口：保存 + 本地事件 + 通知父窗口 + 后台同步云端 */
  function saveAndNotify(memObj){
    var ok = saveMem(memObj);
    emit('memUpdated', memObj);
    if(global.parent && global.parent !== global){
      try{ global.parent.postMessage({ type:'memUpdated' }, '*'); }catch(e){}
    }
    scheduleCloudSync(memObj);
    return ok;
  }

  /* ---------- 云端同步层（前后端分离） ----------
     设计：localStorage 仍是同步写入（保证 UI 即时、离线可用），
     云端在后台异步同步。已登录时：
       - 保存 → debounce 后 PUT 全量（mem + courses + courseProgress）
       - 启动 → ensureCloud() 拉取云端覆盖本地
     courses / courseProgress 的 localStorage 键与 library.js / course-package.js 完全一致，
     故此处直接读写这两个键，避免与业务模块耦合。 */
  var COURSES_KEY = 'chunklab.courses.v1';
  var PROGRESS_KEY = 'chunklab.course-progress.v1';

  /* 大对象（courses / courseProgress）内存桥 + IndexedDB 主存储（解除 localStorage 5MB 配额）：
     启动时 CL.preload() 从 IDB 载入内存（首次从 localStorage 迁移后删除大键）；
     读走内存（同步 API 形态，调用方零改动），写走内存 + 异步 IDB，不再写 localStorage。 */
  var _coursesCache = null;   /* null = 未预载（兜底读 localStorage 旧值） */
  var _progressCache = null;
  /* stats 大对象（bySentence / events）的内存桥与增量落盘状态 —— 详见「持久化分层」注释块 */
  var _statsStore = 'local';     /* 'idb' = 大对象已托管给 IDB；'local' = 保留旧行为（全部进 localStorage） */
  var _bySentenceCache = null;   /* null = 未预载 → 兜底读 localStorage 旧值 */
  var _eventsCache = null;
  var _bsSig = {};               /* key → 上次落盘时的数字签名（判定该行是否需要重写） */
  var _evSnap = null;            /* { count, lastId }：上次落盘后事件数组的尾部标记（判定能增量追加还是需整体替换） */
  var _statsFullRewrite = false; /* 置位后下次落盘强制全量覆盖 IDB（cid 迁移 / 云合并后） */

  function readCoursesRaw(){
    if(_coursesCache !== null) return _coursesCache;
    try{ return JSON.parse(global.localStorage.getItem(COURSES_KEY) || '[]'); }catch(e){ return []; }
  }
  function readProgressRaw(){
    if(_progressCache !== null) return _progressCache;
    try{ return JSON.parse(global.localStorage.getItem(PROGRESS_KEY) || '{}'); }catch(e){ return {}; }
  }

  /* 启动预载：IDB → 内存；IDB 空则从 localStorage 迁移，随后删除大键释放配额。
     幂等：多个页面（main + iframe 子页）同时调用安全（同源共享 IDB，迁移结果一致）。 */
  function preload(){
    if(!global.IDBStore) return Promise.resolve(false);
    return global.IDBStore.loadAll().then(function(data){
      /*
       * 迁移期间可能同时存在两份数据：
       * - IDB 是之前已经迁移成功的课程子集；
       * - localStorage 里还保留着迁移前的完整列表，或包含刚导入的一课。
       *
       * 旧逻辑只要发现 IDB 有任意课程就直接覆盖 localStorage，
       * 结果会把另一课从课程树中“吃掉”。启动时按 courseId 做并集，
       * 同 ID 以 IDB 版本为准，新增课程则完整保留，并回写统一结果。
       */
      var localCourses = readCoursesRaw();
      var idbCourses = Array.isArray(data.courses) ? data.courses : [];
      var courseMap = {};
      localCourses.concat(idbCourses).forEach(function(c){
        if(!c || !c.courseId) return;
        courseMap[c.courseId] = c;
      });
      _coursesCache = Object.keys(courseMap).map(function(id){ return courseMap[id]; });
      if(_coursesCache.length) global.IDBStore.putCourses(_coursesCache).catch(function(){});

      var localProgress = readProgressRaw();
      var idbProgress = (data.courseProgress && typeof data.courseProgress === 'object') ? data.courseProgress : {};
      /* 同一课程以 IDB 版本为准，localStorage 仅补齐尚未迁移的课程进度。 */
      _progressCache = Object.assign({}, localProgress, idbProgress);
      if(Object.keys(_progressCache).length) global.IDBStore.putProgress(_progressCache).catch(function(){});
      /* 迁移完成后删除 localStorage 大键（仅当 IDB 可用且迁移成功） */
      try{ global.localStorage.removeItem(COURSES_KEY); global.localStorage.removeItem(PROGRESS_KEY); }catch(e){}

      /* --- ★ stats 大对象：IDB 与 localStorage 旧值按 key 并集（同 IDB 优先），
             整体写回 IDB 成功后才剥离 localStorage 副本（避免「先删后写失败」造成丢数据）。 --- */
      var legacy = readLegacyStatsRaw();
      var idbBS = (data.sentenceStats && typeof data.sentenceStats === 'object') ? data.sentenceStats : {};
      var bsMap = {};
      Object.keys(legacy.bySentence).forEach(function(k){ bsMap[k] = legacy.bySentence[k]; });
      Object.keys(idbBS).forEach(function(k){ bsMap[k] = idbBS[k]; });   /* IDB 优先 */
      _bySentenceCache = bsMap;
      var evMap = {};
      (Array.isArray(data.events) ? data.events : []).forEach(function(e){ if(e && e.id) evMap[e.id] = e; });
      legacy.events.forEach(function(e){ if(e && e.id && !evMap[e.id]) evMap[e.id] = e; });
      _eventsCache = Object.keys(evMap).map(function(id){ return evMap[id]; });

      var hasBig = Object.keys(_bySentenceCache).length || _eventsCache.length;
      var needPersist = hasBig && (_statsStore !== 'idb' ||
        Object.keys(_bySentenceCache).length !== Object.keys(idbBS).length ||
        _eventsCache.length !== (Array.isArray(data.events) ? data.events.length : 0));
      if(!hasBig){
        /* 无任何存量（全新用户）：直接托管，后续走增量写 */
        _statsStore = 'idb';
        return { migrated: false };
      }
      if(!needPersist){
        _statsStore = 'idb';
        return { migrated: true };
      }
      return global.IDBStore.replaceSentenceStats(_bySentenceCache).then(function(){
        return global.IDBStore.replaceEvents(_eventsCache);
      }).then(function(){
        _statsStore = 'idb';
        _statsFullRewrite = false;
        /* 建立签名基线，避免下一次 saveMem 把全部行判为「脏」再白写一遍 */
        _bsSig = {};
        Object.keys(_bySentenceCache).forEach(function(k){ _bsSig[k] = statSig(_bySentenceCache[k]); });
        _evSnap = evSnapOf(_eventsCache);
        return { migrated: true };
      });
    }).then(function(res){
      /* 落盘确认后，才把大对象从 localStorage 副本里剥离（解除 5MB 配额） */
      if(res && res.migrated && _statsStore === 'idb') stripBigStatsFromLocal();
      return true;
    }).catch(function(e){
      console.warn('[idb preload] 失败，大对象继续由 localStorage 托管：', e && e.message);
      _statsStore = 'local';
      /* 失败前若已污染内存桥，清空以便 loadMem 回退读 localStorage 真值 */
      if(_bySentenceCache && !Object.keys(_bySentenceCache).length) _bySentenceCache = null;
      return false;
    });
  }

  /* 把 bySentence / events 从 localStorage 的 mem 副本里删掉（IDB 已是权威副本）。
     只改这两个字段，其余原样保留；同时归档旧值为迁移保险（键名带 _migrated 后缀）。 */
  function stripBigStatsFromLocal(){
    try{
      var raw = global.localStorage.getItem(STORE_KEY);
      if(!raw) return;
      var o = JSON.parse(raw);
      if(!o || !o.stats || typeof o.stats !== 'object') return;
      if(!('bySentence' in o.stats) && !('events' in o.stats)) return;
      delete o.stats.bySentence;
      delete o.stats.events;
      global.localStorage.setItem(STORE_KEY, JSON.stringify(o));
    }catch(e){ console.warn('[idb] 剥离 localStorage 大对象失败：', e && e.message); }
  }

  /* 写 courses：更新内存 + 异步 IDB + 触发云同步（不再写 localStorage） */
  function writeCourses(list){
    _coursesCache = Array.isArray(list) ? list : [];
    if(global.IDBStore) global.IDBStore.putCourses(_coursesCache).catch(function(){});
    scheduleCloudSync(loadMem());
  }
  function writeProgress(obj){
    _progressCache = (obj && typeof obj === 'object') ? obj : {};
    if(global.IDBStore) global.IDBStore.putProgress(_progressCache).catch(function(){});
    scheduleCloudSync(loadMem());
  }

  /* ---------- 句子档案 / 事件日志的持久化分层（2026-09-10 扩容 8000 句） ----------
     根因：stats.bySentence 与 stats.events 是「随练习量无限增长」的数据，而 localStorage
     没有增量写语义 —— 每答一题都要把整份 mem 重新 JSON.stringify 并整键覆写。
     8000 句实测：saveMem 188ms/次（每题肉眼可感卡顿），落盘 7.39MB 已超常见 5MB 配额
     → setItem 抛 QuotaExceeded，而旧 saveMem 只 console.error 后 return false，用户数据静默丢失。

     方案：沿用 courses 已验证的「内存桥 + IndexedDB 主存储」模式。
       - 内存里 mem 结构完全不变（所有调用方零改动，mergeStats 语义不变）；
       - 持久化分层：小字段（decks/best/mastered/settings/daysLog/totalRounded…）进 localStorage，
         bySentence / events 按「变更行」增量写 IDB。
       - 变更检测用廉价数字签名（statSig）：8000 条 ~2ms，远低于全量 stringify 的 ~180ms。
         之所以不靠调用方「手动标脏」，是因为 bySentence 在多处被直接改写，漏一处就是静默丢数据；
         签名比对是自愈的，没有「忘记标记」这个失败模式。
     _statsStore 语义：'idb' = 大对象已托管（localStorage 不再留副本）；'local' = 保留旧行为。 */
  /* 句子档案的廉价签名：建档后只有计数字段会变（sentence/translation/deckName 是常量），
     故只需混算数字字段即可判定「这一行是否需要重写」。
     浮点（ease）放大 1000 倍后取整；时间戳（lastAt/dueAt）经 int32 回绕 ——
     需恰好相差 2^32 才碰撞，实用上不可能。 */
  function _mix(h, n){ return Math.imul(h ^ (n | 0), 0x01000193) >>> 0; }
  function statSig(v){
    if(!v) return 0;
    var h = 0x811c9dc5;
    h = _mix(h, v.times || 0);
    h = _mix(h, v.okTimes || 0);
    h = _mix(h, v.wrongTimes || 0);
    h = _mix(h, v.streak || 0);
    h = _mix(h, v.maxStreak || 0);
    h = _mix(h, v.interval || 0);
    h = _mix(h, v.repetition || 0);
    h = _mix(h, (v.ease || 0) * 1000);
    h = _mix(h, v.dueAt || 0);
    h = _mix(h, v.lastAt || 0);
    return h >>> 0;
  }

  /* 事件数组的落盘标记：首/尾 id + 长度三锚点。
     之所以要三个锚点：只比长度和尾 id 时，「整体替换成另一个首尾恰好相同的数组」会误判为
     可增量追加 → IDB 内容静默错位。三锚点让纯追加（首不变、尾=上一个尾、长度增长）
     与任何替换都能区分开；而唯一会整体替换 events 的地方（syncFromCloud 的合并）已显式
     置 _evSnap = null 强制全量覆盖，不依赖锚点猜测。 */
  function evSnapOf(ev){
    ev = Array.isArray(ev) ? ev : [];
    return {
      count: ev.length,
      firstId: ev.length ? (ev[0] && ev[0].id) : null,
      lastId: ev.length ? (ev[ev.length-1] && ev[ev.length-1].id) : null
    };
  }

  /* 把 stats 大对象异步落到 IDB：只写变更行。返回 Promise（无 IDB 时 resolve(false)） */
  function persistStats(stats){
    if(_statsStore !== 'idb' || !global.IDBStore) return Promise.resolve(false);
    stats = stats || {};
    var by = stats.bySentence || {};
    var ev = Array.isArray(stats.events) ? stats.events : [];
    var dirty = [], gone = [], k;
    if(_statsFullRewrite){
      for(k in by) _bsSig[k] = statSig(by[k]);
      return global.IDBStore.replaceSentenceStats(by).then(function(){
        return global.IDBStore.replaceEvents(ev);
      }).then(function(){
        _statsFullRewrite = false;
        _evSnap = evSnapOf(ev);
        return true;
      }).catch(function(e){
        console.warn('[stats→idb] 全量落盘失败，退回 localStorage 托管：', e && e.message);
        _statsStore = 'local'; _statsFullRewrite = false;
        return false;
      });
    }
    for(k in by){
      var s = statSig(by[k]);
      if(_bsSig[k] !== s){ _bsSig[k] = s; dirty.push(k); }
    }
    for(k in _bsSig){ if(!(k in by)) gone.push(k); }
    gone.forEach(function(g){ delete _bsSig[g]; });
    /* 事件：三锚点全对得上 → 只追加新增的；否则（被合并/重排/截断）整体替换 */
    var canAppend = false, evRows = [];
    if(_evSnap && ev.length >= _evSnap.count){
      if(_evSnap.count === 0) canAppend = true;
      else canAppend = (ev[0] && ev[0].id) === _evSnap.firstId &&
                       (ev[_evSnap.count-1] && ev[_evSnap.count-1].id) === _evSnap.lastId;
    }
    if(canAppend) evRows = ev.slice(_evSnap.count);
    var evFull = !canAppend;
    var tasks = [];
    if(dirty.length){
      var patch = {};
      dirty.forEach(function(d){ patch[d] = by[d]; });
      tasks.push(global.IDBStore.putSentenceStats(patch));
    }
    if(gone.length) tasks.push(global.IDBStore.deleteSentenceStats(gone));
    if(evFull) tasks.push(global.IDBStore.replaceEvents(ev));
    else if(evRows.length) tasks.push(global.IDBStore.appendEvents(evRows));
    return Promise.all(tasks).then(function(){
      _evSnap = evSnapOf(ev);
      return true;
    }).catch(function(e){
      /* 落盘失败 → 降级回 localStorage 托管（宁可占配额也不静默丢数据），并显式告警 */
      console.warn('[stats→idb] 增量落盘失败，退回 localStorage 托管：', e && e.message);
      _statsStore = 'local';
      _bsSig = {};
      return false;
    });
  }

  /* 从 localStorage 的 mem 里读出大对象（迁移用；_statsStore='idb' 后这里恒为空） */
  function readLegacyStatsRaw(){
    try{
      var o = JSON.parse(global.localStorage.getItem(STORE_KEY) || '{}');
      var s = (o && o.stats && typeof o.stats === 'object') ? o.stats : {};
      return {
        bySentence: (s.bySentence && typeof s.bySentence === 'object') ? s.bySentence : {},
        events: Array.isArray(s.events) ? s.events : []
      };
    }catch(e){ return { bySentence: {}, events: [] }; }
  }

  var _cloudTimer = null;
  var _cloudOn = false; /* 云端是否启用：服务器可达（开放模式）或已登录（鉴权模式）时为 true */
  var _cloudConfig = null; /* 最近一次 /api/config 结果（含 aiEnabled），供页面做 AI 数据面收敛 */
  var _dirty = false;   /* 待同步标志（离线 change-log 轻量版）：有本地变更未上云时为 true */

  /* 有变更待同步时通知 UI（main.html 顶栏"未同步"徽标） */
  function notifySync(){ emit('syncStatus', { dirty: _dirty }); }

  function scheduleCloudSync(memObj){
    if(!_cloudOn || !global.ChunkAPI) return;
    _dirty = true;
    notifySync();
    if(_cloudTimer) clearTimeout(_cloudTimer);
    _cloudTimer = setTimeout(function(){ cloudSyncNow(memObj); }, 400);
  }
  function cloudSyncNow(memObj){
    if(!_cloudOn || !global.ChunkAPI) return Promise.resolve(false);
    var meta = _lastSyncMeta || { revs: { decks: {}, kv: {} }, deleted: { decks: [], kv: [] } };
    var cmeta = maintainCoursesRevs();
    var payload = {
      mem: memObj,
      courses: readCoursesRaw(),
      courseProgress: readProgressRaw(),
      revs: {
        decks: meta.revs.decks, kv: meta.revs.kv,
        courses: cmeta.revs.courses, courseProgress: cmeta.revs.courseProgress
      },
      deleted: {
        decks: meta.deleted.decks, kv: meta.deleted.kv,
        courses: cmeta.deleted.courses, courseProgress: cmeta.deleted.courseProgress
      }
    };
    return global.ChunkAPI.putData(payload).then(function(){
      _dirty = false;
      notifySync();
      return true;
    }).catch(function(e){
      console.warn('[cloud sync →] 失败:', e.message);
      notifySync();
      return false;
    });
  }
  function syncFromCloud(){
    if(!_cloudOn || !global.ChunkAPI) return Promise.resolve(false);
    return global.ChunkAPI.getData().then(function(data){
      if(!data) return false;
      var remoteMem = data.mem || {};
      var remoteRevs = data.revs || { decks: {}, kv: {} };
      var localRevs = loadRevs();
      if(!localRevs.decks) localRevs.decks = {};
      if(!localRevs.kv) localRevs.kv = {};
      if(!localRevs.courses) localRevs.courses = {};
      if(!localRevs.courseProgress) localRevs.courseProgress = {};
      var m = loadMem();
      // decks：per-entity LWW 合并（取 rev 大者）；采纳远程时同步写回 localRevs，
      //   否则新设备首拉后本地 rev=0/1，下一次本地修改会被服务端按旧 rev 拒绝
      var merged = {};
      (m.decks || []).forEach(function(d){ merged[d.id] = { data: d, rev: localRevs.decks[d.id] || 0 }; });
      (remoteMem.decks || []).forEach(function(d){
        var rr = remoteRevs.decks[d.id] || 0;
        var cur = merged[d.id];
        if(!cur || rr > cur.rev){ merged[d.id] = { data: d, rev: rr }; if(rr > (localRevs.decks[d.id] || 0)) localRevs.decks[d.id] = rr; }
      });
      // 软删除传播：远程 revs 有但 remoteMem.decks 无 → 已删，本地移除并采纳其 rev
      Object.keys(remoteRevs.decks || {}).forEach(function(id){
        if(!(remoteMem.decks || []).some(function(d){ return d.id === id; })){
          var ri = remoteRevs.decks[id];
          if(ri > (localRevs.decks[id] || 0)){ delete merged[id]; localRevs.decks[id] = ri; }
        }
      });
      m.decks = Object.keys(merged).map(function(id){ return merged[id].data; });
      // kv：per-key LWW 合并
      SYNC_KV_KEYS.forEach(function(k){
        var rRev = (remoteRevs.kv && remoteRevs.kv[k]) || 0;
        var lRev = localRevs.kv[k] || 0;
        if(k === 'stats' && remoteMem[k] !== undefined){
          var beforeStats = JSON.stringify(m.stats || {});
          var mergedStats = mergeStats(m.stats, remoteMem[k]);
          if(JSON.stringify(mergedStats) !== beforeStats){
            m.stats = mergedStats;
            /* 合并后的新结果需要一个更高 rev，确保能回写云端。 */
            localRevs.kv[k] = Math.max(lRev, rRev) + 1;
          } else if(rRev > lRev){
            localRevs.kv[k] = rRev;
          }
        } else if(rRev > lRev && remoteMem[k] !== undefined){ m[k] = remoteMem[k]; localRevs.kv[k] = rRev; }
        /* rRev <= lRev：本地更新优先，下次 PUT 覆盖 */
      });
      saveRevs(localRevs);
      _prevSnap = null; /* 让 saveMem 的 maintainRevs 走初始化分支，避免误 bump 合并结果 */
      /* ★ 合并结果必须同步回内存桥：否则下一次 loadMem() 仍会取到合并前的旧 bySentence/events，
         合并成果在内存里被丢弃（大对象已迁 IDB 后才有这个陷阱）。
         _evSnap 置 null：并集事件是整体替换（顺序/内容都变了），强制事件全量覆盖，
         不依赖三锚点去猜「能否增量追加」——只有本轮练习真正 append 时才走增量路径。 */
      if(_statsStore === 'idb'){
        _bySentenceCache = m.stats.bySentence;
        _eventsCache = m.stats.events;
        _evSnap = null;
      }
      saveMem(m);
      // courses：per-entity LWW 合并 + 软删传播（ADR-005 step 2）
      var mergedCourses = {};
      readCoursesRaw().forEach(function(c){ mergedCourses[c.courseId] = { data: c, rev: localRevs.courses[c.courseId] || 0 }; });
      (data.courses || []).forEach(function(c){
        var rr = (remoteRevs.courses && remoteRevs.courses[c.courseId]) || 0;
        var cur = mergedCourses[c.courseId];
        if(!cur || rr > cur.rev){ mergedCourses[c.courseId] = { data: c, rev: rr }; if(rr > (localRevs.courses[c.courseId] || 0)) localRevs.courses[c.courseId] = rr; }
      });
      Object.keys(remoteRevs.courses || {}).forEach(function(cid){
        if(!(data.courses || []).some(function(c){ return c.courseId === cid; })){
          var ri = remoteRevs.courses[cid];
          if(ri > (localRevs.courses[cid] || 0)){ delete mergedCourses[cid]; localRevs.courses[cid] = ri; }
        }
      });
      _coursesCache = Object.keys(mergedCourses).map(function(cid){ return mergedCourses[cid].data; });
      if(global.IDBStore) global.IDBStore.putCourses(_coursesCache).catch(function(){});
      // courseProgress：per-key LWW 合并 + 软删传播
      var mergedProg = {};
      var pcur = readProgressRaw();
      Object.keys(pcur).forEach(function(cid){ mergedProg[cid] = { data: pcur[cid], rev: localRevs.courseProgress[cid] || 0 }; });
      Object.keys(data.courseProgress || {}).forEach(function(cid){
        var rr = (remoteRevs.courseProgress && remoteRevs.courseProgress[cid]) || 0;
        var cur = mergedProg[cid];
        if(!cur || rr > cur.rev){ mergedProg[cid] = { data: data.courseProgress[cid], rev: rr }; if(rr > (localRevs.courseProgress[cid] || 0)) localRevs.courseProgress[cid] = rr; }
      });
      Object.keys(remoteRevs.courseProgress || {}).forEach(function(cid){
        if(!data.courseProgress || !(cid in data.courseProgress)){
          var ri = remoteRevs.courseProgress[cid];
          if(ri > (localRevs.courseProgress[cid] || 0)){ delete mergedProg[cid]; localRevs.courseProgress[cid] = ri; }
        }
      });
      var newProg = {};
      Object.keys(mergedProg).forEach(function(cid){ newProg[cid] = mergedProg[cid].data; });
      _progressCache = newProg;
      if(global.IDBStore) global.IDBStore.putProgress(_progressCache).catch(function(){});
      saveRevs(localRevs);
      /* 重置 courses/progress 快照：合并结果已采纳（localRevs 已对齐），下次上行走初始化分支不误 bump */
      _coursesSnap = null;
      _progressSnap = null;
      /* 离线 change-log（轻量版）：拉取合并成功后，若本地仍有未同步变更（离线期间产生），立即补传 push */
      if(_dirty){
        _dirty = false;
        notifySync();
        cloudSyncNow(loadMem());
      }
      return true;
    }).catch(function(e){
      console.warn('[cloud sync ←] 失败:', e.message);
      return false;
    });
  }
  /* ---------- 静默游客账号 ----------
     鉴权模式下让用户免登录直接用：首次访问自动注册 guest_xxx（凭据存本地供静默续期），
     token 过期后凭据可透明重登。手动登录的账号不存此凭据 → 到期仍走登录框，防止自动换成新游客导致数据错挂。 */
  var GUEST_KEY = 'chunklab_guest';
  function _randId(n){
    var chars = 'abcdefghjkmnpqrstuvwxyz23456789', s = '';
    for (var i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  function _loadGuest(){
    try { return JSON.parse(localStorage.getItem(GUEST_KEY) || 'null'); } catch (e) { return null; }
  }
  function _createGuest(tries){
    var api = global.ChunkAPI;
    tries = tries || 0;
    var u = 'guest_' + _randId(10), p = _randId(24);
    return api.register(u, p).then(function(r){
      if (r && r.token) {
        api.setToken(r.token);
        try { localStorage.setItem(GUEST_KEY, JSON.stringify({ u: u, p: p })); } catch (e) {}
        return true;
      }
      return false;
    }).catch(function(){
      /* 用户名撞车（极小概率）→ 重试；网络/服务异常 → 放弃静默，走登录框 */
      if (tries < 2) return _createGuest(tries + 1);
      return false;
    });
  }
  function guestBootstrap(){
    var api = global.ChunkAPI;
    var saved = _loadGuest();
    if (saved && saved.u && saved.p) {
      /* 有游客凭据：静默重登（顺带解决 JWT 过期），账号被删则重建游客 */
      return api.login(saved.u, saved.p).then(function(r){
        if (r && r.token) { api.setToken(r.token); return true; }
        return _createGuest();
      }).catch(function(){ return _createGuest(); });
    }
    if (api.isLoggedIn()) return Promise.resolve(true); /* 手动登录会话：不自动换账号 */
    /* 无凭据无 token：真新访客 → 建游客；但带手动会话标记（登录过自己账号、token 已过期）→ 弹登录框，
       绝不静默换成新游客（用户会以为数据丢了） */
    try {
      if (localStorage.getItem('chunklab_manual')) return Promise.resolve(false);
    } catch (e) {}
    return _createGuest();
  }
  function ensureCloud(){
    return new Promise(function(resolve){
      if(!global.ChunkAPI){ resolve(); return; }
      preload().then(function(){
        global.ChunkAPI.getConfig().then(function(cfg){
          _cloudConfig = cfg || null;
          var needAuth = cfg && cfg.requireAuth;
          if(needAuth && (!global.ChunkAPI.isLoggedIn() || _loadGuest())){
            /* 鉴权模式：无 token 或有游客凭据（过期续期）→ 先试静默游客引导，失败再弹登录框 */
            guestBootstrap().then(function(ok){
              if(ok){ _cloudOn = true; syncFromCloud().then(resolve, resolve); }
              else if(global.ChunkAuthUI && global.ChunkAuthUI.showLogin){
                global.ChunkAuthUI.showLogin(function(){ _cloudOn = true; syncFromCloud().then(resolve, resolve); });
              } else { resolve(); }
            });
          } else {
            /* 开放模式，或鉴权模式下的手动登录会话：直接同步 */
            _cloudOn = true;
            syncFromCloud().then(resolve, resolve);
          }
        }).catch(function(){
          /* 服务器不可达 → 纯本地模式，不阻塞启动 */
          _cloudConfig = null;
          console.warn('[cloud] 服务器不可达，使用纯本地存储');
          resolve();
        });
      });
    });
  }

  /* ---------- 工具 ---------- */
  function $(id){ return global.document.getElementById(id); }
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  function norm(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, ''); }
  function normSent(s){ return norm(s); }
  function timeAgo(t){
    if(!t) return '—';
    var d = Date.now() - t;
    if(d < 60000) return '刚刚';
    if(d < 3600000) return Math.floor(d/60000)+' 分钟前';
    if(d < 86400000) return Math.floor(d/3600000)+' 小时前';
    return Math.floor(d/86400000)+' 天前';
  }

  /* 统计同步：stats 是一个逻辑对象，但练习记录本身是可合并事件。
     旧数据没有 events 时仍按旧聚合值兼容；新数据按事件 ID 去重，
     避免两个设备离线各练一次后，后写入的整块 stats 覆盖先写入的数据。

     ★ 性能（2026-09-10 扩容 8000 句）：原实现用 eventCount(list,...) 在每个
     bySentence key 上反复 filter 全量 events，复杂度 O(keys × events)；8000 句实测
     12.2s（每句答 3 次），足以卡死启动同步。现改为「单遍建索引 + 主循环查表」：
       pass1  遍历 a.events / b.events，同时累计计数并建 byKeyA / byKeyB
       pass2  遍历去重并集，建 byKeyU + union 计数
       主循环 每个 key 只做 O(1) 查表
     总复杂度 O(events + keys)。语义与原实现逐条对齐（见下方注释中的兼容点）。 */
  function mergeStats(a, b){
    a = (a && typeof a === 'object') ? a : {};
    b = (b && typeof b === 'object') ? b : {};
    var ae = Array.isArray(a.events) ? a.events : [];
    var be = Array.isArray(b.events) ? b.events : [];

    /* pass 1：并集去重表（只收带 id 的事件，与原实现一致）+ a/b 两侧计数索引。
       兼容点：answerA/roundA 等「侧计数」统计的是 list 中所有同类事件（含无 id 的），
       与并集 events 数组的「只收带 id」口径不同，这里必须分开累计。 */
    var eventMap = {};
    var answerA = 0, roundA = 0, answerB = 0, roundB = 0;
    var byKeyA = {}, byKeyB = {};
    var i, e;
    for(i = 0; i < ae.length; i++){
      e = ae[i];
      if(!e) continue;
      if(e.id) eventMap[e.id] = e;
      if(e.kind === 'answer'){ answerA++; if(e.key){ var ta = byKeyA[e.key]; if(!ta) ta = byKeyA[e.key] = { ok:0, wrong:0 }; if(e.ok) ta.ok++; else ta.wrong++; } }
      else if(e.kind === 'round'){ roundA++; }
    }
    for(i = 0; i < be.length; i++){
      e = be[i];
      if(!e) continue;
      if(e.id) eventMap[e.id] = e;
      if(e.kind === 'answer'){ answerB++; if(e.key){ var tb = byKeyB[e.key]; if(!tb) tb = byKeyB[e.key] = { ok:0, wrong:0 }; if(e.ok) tb.ok++; else tb.wrong++; } }
      else if(e.kind === 'round'){ roundB++; }
    }

    /* 并集事件：按 id 全序排序（用 < 比较而非 localeCompare —— 后者在数万条时开销显著，
       且 UTF-16 码元序同样是稳定全序，保证 mergeStats 幂等）。 */
    var ids = Object.keys(eventMap);
    var events = new Array(ids.length);
    for(i = 0; i < ids.length; i++) events[i] = eventMap[ids[i]];
    var keyOf = new Array(events.length);
    for(i = 0; i < events.length; i++) keyOf[i] = String(events[i].id);
    var order = new Array(events.length);
    for(i = 0; i < events.length; i++) order[i] = i;
    order.sort(function(x, y){ var p = keyOf[x], q = keyOf[y]; return p < q ? -1 : (p > q ? 1 : 0); });
    var sorted = new Array(events.length);
    for(i = 0; i < events.length; i++) sorted[i] = events[order[i]];
    events = sorted;

    /* pass 2：并集侧计数索引（setOnlyKeys 供 bySentence key 全集用） */
    var answerU = 0, roundU = 0;
    var byKeyU = {};
    var setOnlyKeys = {};
    for(i = 0; i < events.length; i++){
      e = events[i];
      if(e.kind === 'answer'){
        answerU++;
        if(e.key){
          var tu = byKeyU[e.key]; if(!tu) tu = byKeyU[e.key] = { ok:0, wrong:0, lastAt:0 };
          if(e.ok) tu.ok++; else tu.wrong++;
          if((e.at||0) > tu.lastAt) tu.lastAt = e.at || 0;
          setOnlyKeys[e.key] = true;
        }
      } else if(e.kind === 'round'){ roundU++; }
    }

    var baseAnswered = events.length
      ? Math.max(Math.max(0, (Number(a.totalAnswered)||0) - answerA), Math.max(0, (Number(b.totalAnswered)||0) - answerB))
      : Math.max(Number(a.totalAnswered)||0, Number(b.totalAnswered)||0);
    var baseRounds = events.length
      ? Math.max(Math.max(0, (Number(a.totalRounds)||0) - roundA), Math.max(0, (Number(b.totalRounds)||0) - roundB))
      : Math.max(Number(a.totalRounds)||0, Number(b.totalRounds)||0);
    var out = { totalRounds: baseRounds + roundU, totalAnswered: baseAnswered + answerU, bySentence:{}, events:events };
    /* ★ 修复（2026-09-09）：mergeStats 此前重建 out 时丢掉 daysLog —— 每次启动云同步合并
       后 saveMem 回写，连续打卡数据被清零。补：按天合并，rounds 取两侧较大值（daysLog 是
       events 的按日汇总，取 max 对齐 bySentence 的基线取大策略，单调不回退）。 */
    out.daysLog = {};
    [a.daysLog || {}, b.daysLog || {}].forEach(function(dl){
      Object.keys(dl).forEach(function(k){
        var r = (dl[k] && dl[k].rounds) || 0;
        if(r <= 0) return; /* 0 次的日期等价于不存在，不入表 */
        if(!out.daysLog[k]) out.daysLog[k] = { rounds: 0 };
        out.daysLog[k].rounds = Math.max(out.daysLog[k].rounds, r);
      });
    });
    var aBy = a.bySentence || {}, bBy = b.bySentence || {};
    var keys = {};
    Object.keys(aBy).forEach(function(k){ keys[k] = true; });
    Object.keys(bBy).forEach(function(k){ keys[k] = true; });
    Object.keys(setOnlyKeys).forEach(function(k){ keys[k] = true; });
    var EMPTY_C = { ok:0, wrong:0, lastAt:0 };
    Object.keys(keys).sort().forEach(function(key){
      var ra = aBy[key] || null;
      var rb = bBy[key] || null;
      if(!ra && !rb) return;
      var ca = byKeyA[key] || EMPTY_C, cb = byKeyB[key] || EMPTY_C, cu = byKeyU[key] || EMPTY_C;
      var ea = ca.ok + ca.wrong, eb = cb.ok + cb.wrong, eu = cu.ok + cu.wrong;
      var baseTimes = Math.max(ra ? Math.max(0, (ra.times||0) - ea) : 0, rb ? Math.max(0, (rb.times||0) - eb) : 0);
      /* ★ 修复（2026-09-10）：baseOk 必须减去「本侧 ok 事件数」而非「本侧全部 answer 事件数」。
         原实现用 ea（含 wrong 事件），导致每次合并 okTimes 都被多减 ca.wrong：
           merged.okTimes = okTimes - ea + ok_union = okTimes - ca.wrong
         而 syncFromCloud 每次启动都跑 mergeStats(x, x)，于是 okTimes 逐次下沉，
         直到塌回事件里 ok 事件的条数 —— 准确率虚低、isFluencyByDeck 的 okTimes>=3 判定失真。
         旧测试每侧只放 1 条事件（ca.wrong 恒为 0）恰好掩盖了它。修正后 mergeStats 幂等。 */
      var baseOk = Math.max(ra ? Math.max(0, (ra.okTimes||0) - ca.ok) : 0, rb ? Math.max(0, (rb.okTimes||0) - cb.ok) : 0);
      var baseWrong = Math.max(ra ? Math.max(0, (ra.wrongTimes||0) - ca.wrong) : 0, rb ? Math.max(0, (rb.wrongTimes||0) - cb.wrong) : 0);
      if(!events.length){
        var legacy = (ra && rb) ? ((ra.times||0) >= (rb.times||0) ? ra : rb) : (ra || rb);
        out.bySentence[key] = Object.assign({}, legacy);
        return;
      }
      var latest = (ra && rb) ? ((ra.lastAt||0) >= (rb.lastAt||0) ? ra : rb) : (ra || rb);
      var merged = Object.assign({}, latest);
      merged.times = baseTimes + eu;
      /* answer 事件带 ok 字段；正确/错误增量直接取并集索引计数。 */
      merged.okTimes = baseOk + cu.ok;
      merged.wrongTimes = baseWrong + cu.wrong;
      merged.lastAt = Math.max((ra&&ra.lastAt)||0, (rb&&rb.lastAt)||0, cu.lastAt);
      merged.maxStreak = Math.max((ra&&ra.maxStreak)||0, (rb&&rb.maxStreak)||0);
      out.bySentence[key] = merged;
    });
    return out;
  }
  function copyText(t, done){
    var ok = false;
    if(global.navigator.clipboard && global.navigator.clipboard.writeText){
      global.navigator.clipboard.writeText(t).then(function(){ done && done(true); }, function(){ done && done(fallback()); });
    } else { done && done(fallback()); }
    function fallback(){
      var ta = global.document.createElement('textarea');
      ta.value = t; global.document.body.appendChild(ta);
      ta.select();
      var r = false;
      try{ r = global.document.execCommand('copy'); }catch(e){}
      global.document.body.removeChild(ta);
      return r;
    }
  }

  /* ---------- 句子稳定身份（cid） ----------
     学习档案 key 与原文解耦：key = deckId#cid。
     - cid 优先取句子数据的显式 cid 字段（内容修订时保留 cid → 用户进度不丢，根因修复）；
     - 无 cid 字段（老数据/导入句）时退化为原文的稳定 FNV-1a 哈希（幂等，同文本同 cid）。
     老档案 key（deckId#原文）在 loadMem 时一次性迁移为 deckId#cid（见 migrateCidKeys）。 */
  function fnv8(str){
    var h = 0x811c9dc5;
    str = String(str == null ? '' : str);
    for(var i = 0; i < str.length; i++){
      /* 必须用 Math.imul：普通乘法 (h*0x01000193) 是双精度，乘积超 2^53 丢精度，
         与精确 32 位实现（python/标准 FNV-1a）结果不一致 → 会导致 key/迁移对不上数据 cid */
      h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
    }
    var hex = (h >>> 0).toString(16);
    while(hex.length < 8) hex = '0' + hex;
    return hex;
  }
  function cidOf(it){
    if(!it) return '';
    if(it.cid) return String(it.cid);
    return fnv8(it.sentence || it.en || '');
  }
  /* 全部句子级档案 key 的统一构造点（mastered / deletedItems / stats.bySentence / events） */
  function cidKey(deckId, it){ return deckId + '#' + cidOf(it); }
  /* 旧档案 key（deckId#原文）→ 新 key（deckId#cid(原文)）的单键迁移 */
  function moveKeyToCid(k){
    var m = /^([^#]+)#(.+)$/.exec(String(k == null ? '' : k));
    if(!m || /^[0-9a-f]{8}$/.test(m[2])) return k; /* 无 # 或已是 cid 格式：不动 */
    return m[1] + '#' + fnv8(m[2]);
  }
  /* 全量迁移 bySentence / mastered / deletedItems / events 里的句子 key。
     幂等：二次执行无变化。返回是否有变更。 */
  function migrateCidKeys(o){
    var changed = false;
    function moveMap(map){
      if(!map || typeof map !== 'object') return;
      Object.keys(map).forEach(function(k){
        var nk = moveKeyToCid(k);
        if(nk === k) return;
        if(!(nk in map)) map[nk] = map[k];
        delete map[k];
        changed = true;
      });
    }
    moveMap(o.mastered);
    moveMap(o.deletedItems);
    if(o.stats && typeof o.stats === 'object'){
      moveMap(o.stats.bySentence);
      if(Array.isArray(o.stats.events)){
        o.stats.events.forEach(function(e){ if(e && e.key){ e.key = moveKeyToCid(e.key); } });
      }
    }
    return changed;
  }

  /* ---------- 领域：题库 ---------- */
  function masteredKey(deckId, it){ return cidKey(deckId, it); }
  function allDecks(m){ return (m.decks || []).slice(); }
  /* 内置题库只读视图：按 deletedItems 过滤，返回副本（不改写静态 BUILTIN） */
  function builtinDecks(m){
    return (global.BUILTIN || []).map(function(bd){
      var copy = {};
      for(var k in bd){ if(bd.hasOwnProperty(k)) copy[k] = bd[k]; }
      copy.items = (bd.items || []).filter(function(it){ return !isItemDeleted(m, bd.id, it); });
      return copy;
    });
  }
  /* 页面统一取数：内置（过滤后）+ 用户导入。原分散于 main/stats/decks 三处，收敛于此。 */
  function allDecksView(m){ return builtinDecks(m).concat(allDecks(m)); }
  function findDeck(m, deckId){
    for(var i=0; i<m.decks.length; i++) if(m.decks[i].id === deckId) return m.decks[i];
    return null;
  }
  function isMastered(m, deckId, it){
    return !!(m.mastered && m.mastered[masteredKey(deckId, it)]);
  }
  function isFluencyByDeck(m, deckId, it){
    if(!m.stats || !m.stats.bySentence) return false;
    var st = m.stats.bySentence[cidKey(deckId, it)];
    return !!(st && st.okTimes >= 3 && st.streak >= 3);
  }
  function isMarkedForDeck(m, deckId, it){
    return isMastered(m, deckId, it) || isFluencyByDeck(m, deckId, it);
  }
  function classifyStat(s){
    if(!s || !s.times) return 'unseen';
    var acc = s.times ? s.okTimes / s.times : 0;
    if(s.times >= 3 && acc >= 0.8) return 'master';
    if(acc < 0.6) return 'weak';
    return 'learn';
  }

  /* ---------- 打卡 streak（首页今日卡上方紧凑 chip 的数据源） ----------
     daysLog 格式：{ 'YYYY-MM-DD': { rounds: <Number> } }
     数据来源：finishSession 时维护，每完成一整轮练习 +1（用户感知粒度，
     不按提交答案算，避免自纠让"今日次数"看起来虚高）。
     云同步走 stats 整体 LWW（ADR-005），不需要额外 kv。
     demoStatsSample 不写 daysLog（走 stats 内存直接覆盖路径，不经 finishSession），
     故 demo 装入不会污染 streak chip。
     老用户上线首日：daysLog 为空，streak=0 / today=0 → chip 不渲染（不打击）。 */
  function ymd(d){
    var _d = (d instanceof Date) ? d : new Date();
    var pad = function(n){ return n < 10 ? '0'+n : ''+n; };
    return _d.getFullYear() + '-' + pad(_d.getMonth()+1) + '-' + pad(_d.getDate());
  }
  function streakDays(mem, now){
    /* 连续天数：今日 rounds>0 才算今天一天；否则从昨天往回数连续天数（不强制 streak 需含今天）。 */
    var log = (mem && mem.stats && mem.stats.daysLog) || {};
    var d = (now instanceof Date) ? new Date(now.getTime()) : new Date();
    var n = 0;
    var todayKey = ymd(d);
    var todayR = (log[todayKey] && log[todayKey].rounds) || 0;
    if(todayR > 0) n++;
    d.setDate(d.getDate() - 1);
    /* 防御：最多回看 3650 天（≈10 年），超出认作断 */
    for(var i = 0; i < 3650; i++){
      var key = ymd(d);
      var r = (log[key] && log[key].rounds) || 0;
      if(r > 0) n++;
      else break;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }
  function todayRounds(mem, now){
    var log = (mem && mem.stats && mem.stats.daysLog) || {};
    var d = (now instanceof Date) ? now : new Date();
    return (log[ymd(d)] && log[ymd(d)].rounds) || 0;
  }
  /* 写入帮手（main.html 的 finishSession 调一次；不放在 core.js 内部是因为 scheduleCloudSync
     触发需与现有主流程一致——放 main 里能直接复用 saveStore）。 */
  function bumpDaysLog(mem, now){
    if(!mem.stats) mem.stats = { totalRounds:0, totalAnswered:0, bySentence:{}, events:[], daysLog:{} };
    if(!mem.stats.daysLog) mem.stats.daysLog = {};
    var d = (now instanceof Date) ? now : new Date();
    var key = ymd(d);
    var slot = mem.stats.daysLog[key] || { rounds: 0 };
    slot.rounds = (Number(slot.rounds) || 0) + 1;
    mem.stats.daysLog[key] = slot;
    return slot.rounds;
  }
  /* 一次性历史回填：daysLog 为空 + events 非空 → 按 events.at 分组回填 daysLog
     根因（2026-09-09）：用户 12:20 已练题但 daysLog 还是空 —— 那时 streak 功能还没上线，
     finishSession 没经过 bumpDaysLog；events 数组却忠实地记录了所有 round 时刻。回填是
     一次性数据收敛，不重复（daysLog 已有任何 key 即跳过）。 */
  function backfillDaysLog(mem){
    if(!mem || !mem.stats) return 0;
    var evs = Array.isArray(mem.stats.events) ? mem.stats.events : [];
    if(!evs.length) return 0;
    if(!mem.stats.daysLog || typeof mem.stats.daysLog !== 'object') mem.stats.daysLog = {};
    if(Object.keys(mem.stats.daysLog).length > 0) return 0;
    var counts = {};
    for(var i=0;i<evs.length;i++){
      var ev = evs[i];
      if(!ev || ev.kind !== 'round' || !ev.at) continue;
      var d = new Date(ev.at);
      if(isNaN(d.getTime())) continue;
      var key = ymd(d);
      counts[key] = (counts[key] || 0) + 1;
    }
    var n = 0;
    Object.keys(counts).forEach(function(k){
      mem.stats.daysLog[k] = { rounds: counts[k] };
      n++;
    });
    return n;
  }

  /* ---------- 示例统计（demo stats，2026-09-09 老板批准：stats 空态主动装入） ----------
     只生成 stats 纯计数（bySentence / totalAnswered / totalRounds），
     绝不写 mastered / reinforceBook —— 练习队列与错题复习流零影响。
     示例句全部取自真实题库（cid 对齐：句子恒为真，仅计数为演示值），
     删除/清空句子后对应统计自动随 deletedItems 过滤消失。
     本函数是纯函数（不读写存储），由调用方在「全空态」才暴露入口。 */
  var DEMO_STAT_TEMPLATES = [
    /* master 形态 ×3（times>=3 且 acc>=0.8） */
    { times:6, ok:5, w:1, streak:4, ms:6, day:0 },
    { times:5, ok:5, w:0, streak:5, ms:5, day:1 },
    { times:8, ok:7, w:1, streak:6, ms:8, day:2 },
    /* learn 形态 ×7 */
    { times:3, ok:2, w:1, streak:2, ms:3, day:0 },
    { times:4, ok:3, w:1, streak:2, ms:3, day:1 },
    { times:2, ok:2, w:0, streak:2, ms:2, day:1 },
    { times:5, ok:3, w:2, streak:2, ms:4, day:2 },
    { times:7, ok:5, w:2, streak:3, ms:5, day:3 },
    { times:2, ok:2, w:0, streak:1, ms:2, day:4 },
    { times:4, ok:3, w:1, streak:3, ms:4, day:5 },
    /* weak 形态 ×2（acc<0.6） */
    { times:6, ok:2, w:4, streak:1, ms:2, day:2 },
    { times:4, ok:1, w:3, streak:1, ms:1, day:6 }
  ];
  function demoStatsSample(decksList){
    var decks = Array.isArray(decksList) ? decksList : [];
    var flat = [];
    decks.forEach(function(d){
      if(!d || !d.id || !Array.isArray(d.items) || !d.items.length) return;
      var name = d.name || '';
      d.items.forEach(function(it){
        if(!it || !it.sentence) return;
        flat.push({ dId: d.id, name: name, it: it });
      });
    });
    var total = DEMO_STAT_TEMPLATES.length;
    var n = Math.min(flat.length, total);
    if(n < 3) return null; /* 题库可练句太少：示例意义不大，直接练真句 */
    var by = {}, answered = 0;
    /* 线性插值采样：从题库首尾均匀取 n 句（覆盖更广，演示形态更真实） */
    var span = Math.max(1, flat.length - 1);
    for(var i = 0; i < n; i++){
      var tpl = DEMO_STAT_TEMPLATES[i];
      var src = flat[Math.round(i * span / (n - 1))];
      var key = cidKey(src.dId, src.it);
      if(by[key]) continue; /* 防御：采样撞同一句时跳过 */
      var lastAt = Date.now() - tpl.day * 86400000 - (2 + ((i * 37) % 540)) * 60000;
      by[key] = {
        deckId: src.dId, deckName: src.name,
        sentence: src.it.sentence || '', translation: src.it.translation || '',
        times: tpl.times, okTimes: tpl.ok, wrongTimes: tpl.w,
        streak: tpl.streak, maxStreak: tpl.ms,
        lastAt: lastAt, interval: Math.max(1, tpl.day + 1), ease: 2.5,
        dueAt: lastAt + (tpl.day + 1) * 86400000
      };
      answered += tpl.times;
    }
    if(!Object.keys(by).length) return null;
    return { rounds: 3, answered: answered, bySentence: by };
  }

  /* ---------- 内置题删除（override 机制） ----------
     内置题库来自静态 builtins.js + oral8000.js（window.BUILTIN），不可被改写。
     删除内置单句 = 在 deletedItems 里登记 key，列表/练习时过滤掉。
     key 与 masteredKey / stats.bySentence 同构：deckId#cid（与原文解耦）。 */
  function itemKey(deckId, it){ return cidKey(deckId, it); }
  function isItemDeleted(m, deckId, it){
    return !!(m && m.deletedItems && m.deletedItems[itemKey(deckId, it)]);
  }
  function deleteItem(m, deckId, it){
    m.deletedItems = m.deletedItems || {};
    m.deletedItems[itemKey(deckId, it)] = true;
  }
  /* 返回题库的「有效句子」：内置题库按 deletedItems 过滤；导入题库原样 */
  function deckItems(deck, m){
    if(!deck || !deck.builtin) return (deck && deck.items) || [];
    return (deck.items || []).filter(function(it){ return !isItemDeleted(m, deck.id, it); });
  }
  /* ★ 统计某 deck 在 deletedItems 里的隐藏条数（用于 decks.html 给用户可观察性）
     - 内置 deck：实际从 BUILTIN 取原句集，过滤后对比差值
     - 导入 deck：deletedItems 现存 key 数（仍以 cid 为键，与原句对照） */
  function hiddenCount(deck, m){
    if(!deck || !m || !m.deletedItems) return 0;
    var deckId = deck.id;
    var prefix = deckId + '#';
    var keys = Object.keys(m.deletedItems).filter(function(k){ return k.indexOf(prefix) === 0; });
    return keys.length;
  }
  /* ★ 恢复某 deck 全部已删除内置句（清空 m.deletedItems 里 deckId# 的所有 key）
     返回实际清除的条数。导入 deck 由于原句变更风险，默认 NOOP 并返回 0。 */
  function restoreAllDeleted(m, deck){
    if(!m || !m.deletedItems) return 0;
    if(!deck || !deck.builtin) return 0; /* 导入 deck 不支持全量恢复（cid 不在静态集中） */
    var deckId = deck.id;
    var prefix = deckId + '#';
    var n = 0;
    Object.keys(m.deletedItems).forEach(function(k){
      if(k.indexOf(prefix) === 0){ delete m.deletedItems[k]; n++; }
    });
    return n;
  }

  /* ---------- 事件总线 + 跨页通信 ---------- */
  function on(type, fn){
    (LISTENERS[type] = LISTENERS[type] || []).push(fn);
    return function off(){ LISTENERS[type] = LISTENERS[type].filter(function(f){ return f !== fn; }); };
  }
  function emit(type, payload){
    (LISTENERS[type] || []).slice().forEach(function(fn){ try{ fn(payload); }catch(e){} });
  }
  /* 通知父窗口启动练习 / 返回 */
  function startReviewDeck(deck){
    if(global.parent && global.parent !== global){
      try{ global.parent.postMessage({ type:'startDeck', deck:deck }, '*'); }catch(e){}
    }
  }
  function goBack(){
    if(global.parent && global.parent !== global){
      try{ global.parent.postMessage({ type:'goBack' }, '*'); }catch(e){}
    }
  }

  /* ---------- 导出 ---------- */
  global.CL = {
    STORE_KEY: STORE_KEY,
    store: { CURRENT_VERSION: CURRENT_VERSION, MIGRATIONS: MIGRATIONS, migrate: migrate, defaultMem: defaultMem },
    loadMem: loadMem,
    saveMem: saveMem,
    saveAndNotify: saveAndNotify,
    $: $, esc: esc, norm: norm, normSent: normSent, timeAgo: timeAgo, copyText: copyText,
    masteredKey: masteredKey, allDecks: allDecks, allDecksView: allDecksView, builtinDecks: builtinDecks, findDeck: findDeck,
    deckItems: deckItems, hiddenCount: hiddenCount, restoreAllDeleted: restoreAllDeleted,
    isMastered: isMastered, isFluencyByDeck: isFluencyByDeck, isMarkedForDeck: isMarkedForDeck,
    classifyStat: classifyStat,
    demoStatsSample: demoStatsSample,
    mergeStats: mergeStats,
    ymd: ymd, streakDays: streakDays, todayRounds: todayRounds, bumpDaysLog: bumpDaysLog,
    backfillDaysLog: backfillDaysLog,
    itemKey: itemKey, isItemDeleted: isItemDeleted, deleteItem: deleteItem, deckItems: deckItems,
    fnv8: fnv8, cidOf: cidOf, cidKey: cidKey, migrateCidKeys: migrateCidKeys, moveKeyToCid: moveKeyToCid,
    on: on, emit: emit,
    scheduleCloudSync: scheduleCloudSync, cloudSyncNow: cloudSyncNow,
    syncFromCloud: syncFromCloud, ensureCloud: ensureCloud,
    isDirty: function(){ return _dirty; },
    /* stats 大对象的持久化托管模式：'idb' = 已分层（localStorage 只留小字段）；'local' = 旧行为 */
    statsStoreMode: function(){ return _statsStore; },
    getCloudConfig: function(){ return _cloudConfig; },
    preload: preload,
    readCourses: readCoursesRaw, readProgress: readProgressRaw,
    writeCourses: writeCourses, writeProgress: writeProgress,
    COURSES_KEY: COURSES_KEY, PROGRESS_KEY: PROGRESS_KEY,
    startReviewDeck: startReviewDeck, goBack: goBack
  };
})(window);
