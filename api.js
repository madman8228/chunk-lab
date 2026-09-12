/**
 * api.js · 前端云端 API 封装（前后端分离）
 *
 * - 自动携带 JWT（localStorage 'chunklab_token'）
 * - 401 自动清 token 并抛 NOT_AUTH
 * - API 基地址可配置（localStorage 'chunklab_api_base'，开发期默认同源 ''，部署时填服务器地址）
 * 全局暴露 window.ChunkAPI
 */
(function (global) {
  'use strict';

  var TOKEN_KEY = 'chunklab_token';
  var BASE_KEY = 'chunklab_api_base';
  var SESSION_KEY = 'chunklab.session.v1';
  var sessionGeneration = 0;

  function readSession() {
    try {
      var raw=localStorage.getItem(SESSION_KEY), value=raw ? JSON.parse(raw) : null;
      if(!value || value.version!==1 || typeof value.epoch!=='string' || !value.epoch) return null;
      /* 兼容旧页面仍直接写镜像键：一旦镜像与记录不一致，暂不信任旧记录，
         让本页的会话检查先看到变化并失效旧请求。 */
      if((localStorage.getItem(BASE_KEY)||'')!==(value.base||'') ||
         (localStorage.getItem(TOKEN_KEY)||null)!==(value.token||null)) return null;
      return value;
    } catch (e) { return null; }
  }
  function newEpoch() {
    try { if(global.crypto && typeof global.crypto.randomUUID==='function') return global.crypto.randomUUID(); } catch (e) {}
    try {
      if(global.crypto && typeof global.crypto.getRandomValues==='function') {
        var bytes=new Uint8Array(16); global.crypto.getRandomValues(bytes);
        return Array.prototype.map.call(bytes,function(b){return ('0'+b.toString(16)).slice(-2);}).join('');
      }
    } catch (e2) {}
    return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
  }
  function getBase() { try { var s=readSession(); return s ? (s.base || '') : (localStorage.getItem(BASE_KEY) || ''); } catch (e) { return ''; } }
  function getToken() { try { var s=readSession(); return s ? (s.token || null) : localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
  function commitSession(base, token) {
    var record={version:1,base:base || '',token:token || null,epoch:newEpoch()};
    /* 新端以完整记录为准；旧端仍可读取下面两个兼容镜像。 */
    localStorage.setItem(SESSION_KEY,JSON.stringify(record));
    localStorage.setItem(BASE_KEY,record.base);
    if(record.token) localStorage.setItem(TOKEN_KEY,record.token); else localStorage.removeItem(TOKEN_KEY);
    sessionGeneration++;
    if(global.AccountStorage) global.AccountStorage.credentialsChanged();
  }
  function setBase(u) { var next=u || ''; commitSession(next,getBase()===next ? getToken() : null); }
  function setSession(base, token) { commitSession(base,token); }
  function setToken(t) { commitSession(getBase(),t); }
  function clearToken() { commitSession(getBase(),null); }
  function isLoggedIn() { return !!getToken(); }

  function recoveryPathAllowed(path) {
    return path === '/api/sync/batch' ||
      path === '/api/sync/batch/resolve' ||
      path.indexOf('/api/sync/batch/resolutions/') === 0 ||
      path.indexOf('/api/sync/entity?') === 0 ||
      path === '/api/sync/resolve' ||
      path.indexOf('/api/sync/resolutions/') === 0;
  }

  function request(path, opts) {
    if(global.AccountStorage && path.indexOf('/api/auth/')!==0 && path!=='/api/config'){
      try{global.AccountStorage.assertCurrent();}catch(error){return Promise.reject(error);}
      if(global.AccountStorage.storage.getItem('chunklab.restore-cloud-hold') && !recoveryPathAllowed(path) &&
         (path==='/api/data' || path.indexOf('/api/sync/')===0 || path==='/api/import' || path.indexOf('/api/courses')===0 || path==='/api/deck/publish')){
        var held=new Error('恢复后的数据仅在本机保存，云端同步暂未启用');held.code='RESTORE_LOCAL_ONLY';return Promise.reject(held);
      }
    }
    opts = opts || {};
    var headers = Object.assign({}, opts.headers || {});
    var token = getToken();
    var base = getBase(), generation = sessionGeneration;
    function checkSession(){
      if(global.AccountStorage && path.indexOf('/api/auth/')!==0 && path!=='/api/config') global.AccountStorage.assertCurrent();
      if(generation !== sessionGeneration || token !== getToken() || base !== getBase()){
        var changed = new Error('登录状态或服务地址已切换，已忽略原会话响应');
        changed.code = 'SESSION_CHANGED'; throw changed;
      }
    }
    var authenticating = path === '/api/auth/login' || path === '/api/auth/register';
    if (token && !authenticating) headers['Authorization'] = 'Bearer ' + token;
    if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    return fetch((authenticating && opts.base !== undefined ? opts.base : base) + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body
    }).then(function (res) {
      checkSession();
      if (res.status === 401 && !authenticating) { clearToken(); var e = new Error('NOT_AUTH'); e.code = 'NOT_AUTH'; throw e; }
      return res.text().then(function (text) {
        checkSession();
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e2) { data = null; }
        if (!res.ok) {
          var error = new Error((data && data.error) || ('HTTP ' + res.status));
          error.status = res.status;
          error.code = data && data.code;
          error.conflicts = data && data.conflicts;
          if (res.status === 428 || error.code === 'CLIENT_UPGRADE_REQUIRED') {
            /* Keep the signal even when the request happens during boot, before
               the page has attached its visible update handler. */
            global.__chunklabUpgradeRequired = true;
            if (typeof global.dispatchEvent === 'function' && typeof global.Event === 'function') {
              global.dispatchEvent(new global.Event('chunklab-upgrade-required'));
            }
          }
          throw error;
        }
        return data;
      });
    });
  }

  var api = {
    TOKEN_KEY: TOKEN_KEY, BASE_KEY: BASE_KEY, SESSION_KEY: SESSION_KEY,
    getBase: getBase, setBase: setBase,
    setSession: setSession,
    getToken: getToken, setToken: setToken, clearToken: clearToken, isLoggedIn: isLoggedIn,
    request: request,
    register: function (u, p, base) { return request('/api/auth/register', { base: base, method: 'POST', body: JSON.stringify({ username: u, password: p }) }); },
    login: function (u, p, base) { return request('/api/auth/login', { base: base, method: 'POST', body: JSON.stringify({ username: u, password: p }) }); },
    me: function () { return request('/api/auth/me'); },
    getConfig: function () { return request('/api/config'); },
    getData: function () { return request('/api/data'); },
    putData: function (payload) { return request('/api/data', { method: 'PUT', body: JSON.stringify(payload) }); },
    getSyncBatch: function () { return request('/api/sync/batch'); },
    resolveSyncBatch: function (payload) { return request('/api/sync/batch/resolve', { method: 'POST', body: JSON.stringify(payload) }); },
    getSyncBatchResolution: function (id) { return request('/api/sync/batch/resolutions/' + encodeURIComponent(id)); },
    getSyncEntity: function(entity, id) { return request('/api/sync/entity?entity=' + encodeURIComponent(entity) + '&id=' + encodeURIComponent(id)); },
    resolveSync: function(payload) { return request('/api/sync/resolve', { method: 'POST', body: JSON.stringify(payload) }); },
    getSyncResolution: function(id) { return request('/api/sync/resolutions/' + encodeURIComponent(id)); },
    exportData: function () { return request('/api/export'); },
    importData: function (payload) { return request('/api/import', { method: 'POST', body: JSON.stringify(payload) }); },
    postCourse: function (course) { return request('/api/courses', { method: 'POST', body: JSON.stringify({ course: course }) }); },
    deleteCourse: function (id) { return request('/api/courses/' + encodeURIComponent(id), { method: 'DELETE' }); },
    /* 公共题库市场（Phase D） */
    getPublicDecks: function () { return request('/api/deck/public'); },
    getPublicDeck: function (id) { return request('/api/deck/public/' + encodeURIComponent(id)); },
    publishDeck: function (deckId, publish) {
      /* Publication is a versioned mutation too. Keep it in the same durable
         conditional queue as learning data so a lost response is retryable. */
      if (global.BatchSync && typeof global.BatchSync.state === 'function') {
        return global.BatchSync.state().then(function (state) {
          if (!Number.isSafeInteger(state.baseline) || state.baseline < 0) {
            var baseError = new Error('尚未确认云端版本，暂不能发布题库');
            baseError.code = 'SYNC_BASELINE_REQUIRED';
            throw baseError;
          }
          return global.BatchSync.stage({ mem: {}, publications: [{ deckId: deckId, publish: !!publish }] },
            state.baseline, state.localGeneration, []).then(function () {
            return global.BatchSync.retry();
          }).then(function (outcome) {
            if (!outcome || !outcome.receipt || outcome.receipt.ok !== true) {
              throw new Error('服务器未确认题库发布');
            }
            return outcome.receipt;
          });
        });
      }
      var upgrade = new Error('当前页面版本过旧，请刷新后再发布题库');
      upgrade.code = 'CLIENT_UPGRADE_REQUIRED';
      global.__chunklabUpgradeRequired = true;
      return Promise.reject(upgrade);
    }
  };

  global.ChunkAPI = api;
})(window);
