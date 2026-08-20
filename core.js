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
  var LISTENERS = {};

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

  function readCoursesRaw(){ try{ return JSON.parse(global.localStorage.getItem(COURSES_KEY) || '[]'); }catch(e){ return []; } }
  function readProgressRaw(){ try{ return JSON.parse(global.localStorage.getItem(PROGRESS_KEY) || '{}'); }catch(e){ return {}; } }

  var _cloudTimer = null;
  var _cloudOn = false; /* 云端是否启用：服务器可达（开放模式）或已登录（鉴权模式）时为 true */
  function scheduleCloudSync(memObj){
    if(!_cloudOn || !global.ChunkAPI) return;
    if(_cloudTimer) clearTimeout(_cloudTimer);
    _cloudTimer = setTimeout(function(){ cloudSyncNow(memObj); }, 400);
  }
  function cloudSyncNow(memObj){
    if(!_cloudOn || !global.ChunkAPI) return Promise.resolve(false);
    var payload = {
      mem: memObj,
      courses: readCoursesRaw(),
      courseProgress: readProgressRaw()
    };
    return global.ChunkAPI.putData(payload).then(function(){ return true; }).catch(function(e){
      console.warn('[cloud sync →] 失败:', e.message);
      return false;
    });
  }
  function syncFromCloud(){
    if(!_cloudOn || !global.ChunkAPI) return Promise.resolve(false);
    return global.ChunkAPI.getData().then(function(data){
      if(data && data.mem) saveMem(data.mem);
      if(data && Array.isArray(data.courses)) global.localStorage.setItem(COURSES_KEY, JSON.stringify(data.courses));
      if(data && data.courseProgress && typeof data.courseProgress === 'object') global.localStorage.setItem(PROGRESS_KEY, JSON.stringify(data.courseProgress));
      return true;
    }).catch(function(e){
      console.warn('[cloud sync ←] 失败:', e.message);
      return false;
    });
  }
  function ensureCloud(){
    return new Promise(function(resolve){
      if(!global.ChunkAPI){ resolve(); return; }
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
    COURSES_KEY: COURSES_KEY, PROGRESS_KEY: PROGRESS_KEY,
    startReviewDeck: startReviewDeck, goBack: goBack
  };
})(window);
