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
        else if (sigKv(cur) !== prev) revs.kv[k] = (revs.kv[k] || 0) + 1;
      });
    } else {
      (m.decks || []).forEach(function (d) { if (!(d.id in revs.decks)) revs.decks[d.id] = 1; });
      SYNC_KV_KEYS.forEach(function (k) { if ((k in m) && !(k in revs.kv)) revs.kv[k] = 1; });
    }
    _prevSnap = { decks: {}, kv: {} };
    (m.decks || []).forEach(function (d) { _prevSnap.decks[d.id] = sigDeck(d); });
    SYNC_KV_KEYS.forEach(function (k) { if (k in m) _prevSnap.kv[k] = sigKv(m[k]); });
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
      stats: { totalRounds:0, totalAnswered:0, bySentence:{} },
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
      return {
        decks: Array.isArray(o.decks) ? o.decks : d.decks,
        best: o.best || d.best,
        mastered: o.mastered || d.mastered,
        deletedItems: o.deletedItems || {},
        stats: (o.stats && typeof o.stats === 'object')
          ? { totalRounds: o.stats.totalRounds||0, totalAnswered: o.stats.totalAnswered||0, bySentence: o.stats.bySentence||{} }
          : d.stats,
        settings: Object.assign({}, d.settings, o.settings||{}),
        reinforceBook: o.reinforceBook || [],
        progress: o.progress || {},
        version: CURRENT_VERSION
      };
    }catch(e){
      console.error('[core.loadMem]', e);
      return d;
    }
  }
  function saveMem(m){
    try{
      var out = Object.assign({}, m);
      out.version = CURRENT_VERSION; /* 写入时强制版本 */
      global.localStorage.setItem(STORE_KEY, JSON.stringify(out));
      maintainRevs(m);
      return true;
    }
    catch(e){ console.error('[core.saveMem]', e); return false; }
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
      if(data.courses && data.courses.length){
        _coursesCache = data.courses;
      } else {
        var local = readCoursesRaw();
        _coursesCache = local;
        if(local.length) global.IDBStore.putCourses(local).catch(function(){});
      }
      if(data.courseProgress && Object.keys(data.courseProgress).length){
        _progressCache = data.courseProgress;
      } else {
        var pl = readProgressRaw();
        _progressCache = pl;
        if(Object.keys(pl).length) global.IDBStore.putProgress(pl).catch(function(){});
      }
      /* 迁移完成后删除 localStorage 大键（仅当 IDB 可用且迁移成功） */
      try{ global.localStorage.removeItem(COURSES_KEY); global.localStorage.removeItem(PROGRESS_KEY); }catch(e){}
      return true;
    }).catch(function(e){
      console.warn('[idb preload] 失败，回退 localStorage：', e && e.message);
      return false;
    });
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

  var _cloudTimer = null;
  var _cloudOn = false; /* 云端是否启用：服务器可达（开放模式）或已登录（鉴权模式）时为 true */
  function scheduleCloudSync(memObj){
    if(!_cloudOn || !global.ChunkAPI) return;
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
    return global.ChunkAPI.putData(payload).then(function(){ return true; }).catch(function(e){
      console.warn('[cloud sync →] 失败:', e.message);
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
        if(rRev > lRev && remoteMem[k] !== undefined){ m[k] = remoteMem[k]; localRevs.kv[k] = rRev; }
        /* rRev <= lRev：本地更新优先，下次 PUT 覆盖 */
      });
      saveRevs(localRevs);
      _prevSnap = null; /* 让 saveMem 的 maintainRevs 走初始化分支，避免误 bump 合并结果 */
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
      return true;
    }).catch(function(e){
      console.warn('[cloud sync ←] 失败:', e.message);
      return false;
    });
  }
  function ensureCloud(){
    return new Promise(function(resolve){
      if(!global.ChunkAPI){ resolve(); return; }
      preload().then(function(){
        global.ChunkAPI.getConfig().then(function(cfg){
          var needAuth = cfg && cfg.requireAuth;
          if(needAuth && !global.ChunkAPI.isLoggedIn()){
            if(global.ChunkAuthUI && global.ChunkAuthUI.showLogin){
              global.ChunkAuthUI.showLogin(function(){ _cloudOn = true; syncFromCloud().then(resolve, resolve); });
            } else { resolve(); }
          } else {
            _cloudOn = true;
            syncFromCloud().then(resolve, resolve);
          }
        }).catch(function(){
          /* 服务器不可达 → 纯本地模式，不阻塞启动 */
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

  /* ---------- 领域：题库 ---------- */
  function masteredKey(deckId, it){ return deckId + '#' + (it.sentence || it.en || ''); }
  function allDecks(m){ return (m.decks || []).slice(); }
  function findDeck(m, deckId){
    for(var i=0; i<m.decks.length; i++) if(m.decks[i].id === deckId) return m.decks[i];
    return null;
  }
  function isMastered(m, deckId, it){
    return !!(m.mastered && m.mastered[masteredKey(deckId, it)]);
  }
  function isFluencyByDeck(m, deckId, it){
    if(!m.stats || !m.stats.bySentence) return false;
    var st = m.stats.bySentence[deckId + '#' + (it.sentence || '')];
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

  /* ---------- 内置题删除（override 机制） ----------
     内置题库来自静态 builtins.js（window.BUILTIN），不可被改写。
     删除内置单句 = 在 deletedItems 里登记 key，列表/练习时过滤掉。
     key 与 masteredKey 同构：deckId#sentence，确保定位稳定。 */
  function itemKey(deckId, it){ return deckId + '#' + (it.sentence || it.en || ''); }
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
    masteredKey: masteredKey, allDecks: allDecks, findDeck: findDeck,
    isMastered: isMastered, isFluencyByDeck: isFluencyByDeck, isMarkedForDeck: isMarkedForDeck,
    classifyStat: classifyStat,
    itemKey: itemKey, isItemDeleted: isItemDeleted, deleteItem: deleteItem, deckItems: deckItems,
    on: on, emit: emit,
    scheduleCloudSync: scheduleCloudSync, cloudSyncNow: cloudSyncNow,
    syncFromCloud: syncFromCloud, ensureCloud: ensureCloud,
    preload: preload,
    readCourses: readCoursesRaw, readProgress: readProgressRaw,
    writeCourses: writeCourses, writeProgress: writeProgress,
    COURSES_KEY: COURSES_KEY, PROGRESS_KEY: PROGRESS_KEY,
    startReviewDeck: startReviewDeck, goBack: goBack
  };
})(window);
