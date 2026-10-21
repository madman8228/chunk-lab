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
      /* 完整记录与兼容镜像必须一致，不能选择另一账号的镜像凭据。 */
      if((localStorage.getItem(BASE_KEY)||'')!==(value.base||'') ||
         (localStorage.getItem(TOKEN_KEY)||null)!==(value.token||null)) {
        var conflict=new Error('登录记录不一致，请重新登录；本地数据未修改');
        conflict.code='SESSION_INCONSISTENT'; throw conflict;
      }
      return value;
    } catch (e) { if(e.code==='SESSION_INCONSISTENT') throw e; return null; }
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
  function getBase() { try { var s=readSession(); return s ? (s.base || '') : (localStorage.getItem(BASE_KEY) || ''); } catch (e) { if(e.code==='SESSION_INCONSISTENT') throw e; return ''; } }
  function getToken() { try { var s=readSession(); return s ? (s.token || null) : localStorage.getItem(TOKEN_KEY); } catch (e) { if(e.code==='SESSION_INCONSISTENT') throw e; return null; } }
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

  function tokenAccountId(token) {
    if (!token) return 'local';
    try {
      var part=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      var claims=JSON.parse(global.atob(part));
      if (!Number.isSafeInteger(claims.uid) || claims.uid <= 0) throw new Error('uid');
      return String(claims.uid);
    } catch (_) {
      var invalid=new Error('登录凭据无法识别，已暂停同步'); invalid.code='SERVER_IDENTITY_REQUIRED'; throw invalid;
    }
  }

  function recoveryPathAllowed(path) {
    return path.indexOf('/api/sync/batch/resolutions/') === 0 ||
      path.indexOf('/api/sync/resolutions/') === 0;
  }

  function request(path, opts) {
    if(global.AccountStorage && path.indexOf('/api/auth/')!==0 && path!=='/api/config'){
      try{global.AccountStorage.assertCurrent();}catch(error){return Promise.reject(error);}
      if(global.AccountStorage.storage.getItem('chunklab.restore-cloud-hold') && !recoveryPathAllowed(path) &&
         (path==='/api/data' || path.indexOf('/api/sync/')===0 || path==='/api/import' || path==='/api/content-import' || path.indexOf('/api/courses')===0 || path==='/api/deck/publish')){
        var held=new Error('恢复后的数据仅在本机保存，云端同步暂未启用');held.code='RESTORE_LOCAL_ONLY';return Promise.reject(held);
      }
    }
    opts = opts || {};
    var headers = Object.assign({}, opts.headers || {});
    var token, base, generation = sessionGeneration;
    try { token=getToken(); base=getBase(); } catch(error) { return Promise.reject(error); }
    function checkSession(){
      if(global.AccountStorage && path.indexOf('/api/auth/')!==0 && path!=='/api/config') global.AccountStorage.assertCurrent();
      var currentToken,currentBase;
      try { currentToken=getToken(); currentBase=getBase(); }
      catch(error) { if(error.code!=='SESSION_INCONSISTENT') throw error; currentToken=undefined; currentBase=undefined; }
      if(generation !== sessionGeneration || token !== currentToken || base !== currentBase){
        var changed = new Error('登录状态或服务地址已切换，已忽略原会话响应');
        changed.code = 'SESSION_CHANGED'; throw changed;
      }
    }
    var authenticating = path === '/api/auth/login' || path === '/api/auth/register' ||
      (path.indexOf('/api/auth/phone/') === 0 && opts.authEntry === true);
    if (token && !authenticating) headers['Authorization'] = 'Bearer ' + token;
    if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    var controller = opts.timeoutMs && typeof global.AbortController === 'function' ? new global.AbortController() : null;
    var timeout = controller ? global.setTimeout(function() { controller.abort(); }, opts.timeoutMs) : null;
    return fetch((authenticating && opts.base !== undefined ? opts.base : base) + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body,
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      checkSession();
      if (res.status === 401 && !authenticating) {
        // A signed-out request needs login, not a new session epoch. Rotating
        // an already-empty session makes AccountStorage reload on every boot.
        if (token) {
          try { global.dispatchEvent(new CustomEvent('chunklab-auth-expired')); } catch (_) {}
          clearToken();
        }
        var e = new Error('NOT_AUTH'); e.code = 'NOT_AUTH'; e.status = 401; throw e;
      }
      return res.text().then(function (text) {
        checkSession();
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e2) { data = null; }
        if (!res.ok) {
          var error = new Error((data && data.error) || ('HTTP ' + res.status));
          error.status = res.status;
          error.code = data && (data.code || data.reasonCode);
          error.reasonCode = data && data.reasonCode;
          error.nextResetAt = data && data.nextResetAt;
          error.leaseEndsAt = data && data.leaseEndsAt;
          error.traceId = data && data.traceId;
          error.conflicts = data && data.conflicts;
          var retryAfter = res.headers && typeof res.headers.get === 'function'
            ? res.headers.get('Retry-After') : null;
          if (retryAfter != null && String(retryAfter).trim()) {
            var retryValue = String(retryAfter).trim();
            var retryMs = /^\d+$/.test(retryValue)
              ? Number(retryValue) * 1000
              : Date.parse(retryValue) - Date.now();
            if (Number.isFinite(retryMs) && retryMs >= 0) {
              /* Keep setTimeout within its signed 32-bit range; long server
                 delays are still honored up to the browser's maximum timer. */
              error.retryAfterMs = Math.min(retryMs, 2147483647);
            }
          }
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
        if (opts.requireResponseIdentity) {
          var responseHeaders=res.headers, actual=responseHeaders && typeof responseHeaders.get==='function' ? responseHeaders.get('X-ChunkLab-Account-Id') : null;
          var expected=tokenAccountId(token);
          if (!actual) { var missing=new Error('服务端未提供账号确认，已暂停同步；本地记录保留'); missing.code='SERVER_IDENTITY_REQUIRED'; throw missing; }
          if (String(actual)!==expected) { var mismatch=new Error('服务端响应账号不一致，已暂停同步；本地记录保留'); mismatch.code='SERVER_IDENTITY_MISMATCH'; throw mismatch; }
        }
        return data;
      });
    }).catch(function(error) {
      if(error.name === 'AbortError') {
        var authTimeout = path.indexOf('/api/auth/') === 0;
        var delayed = new Error(authTimeout ? '请求超时，请稍后重新获取验证码' : '请求超时，请重试');
        delayed.code = authTimeout ? 'AUTH_TIMEOUT' : 'REQUEST_TIMEOUT'; throw delayed;
      }
      throw error;
    }).finally(function() { if(timeout) global.clearTimeout(timeout); });
  }

  // Only these explicit read wrappers share in-flight work. Nothing is retained
  // after settlement, and generic requests/writes keep their original behavior.
  var pendingReads = Object.create(null);
  function readScope() {
    var session = readSession(), account = global.AccountStorage;
    return JSON.stringify([sessionGeneration, getBase(), getToken(), session && session.epoch,
      account && account.owner, account && account.sessionEpoch]);
  }
  function sharedRead(path, options) {
    var scope;
    try { scope = readScope(); } catch (error) { return Promise.reject(error); }
    var pending = pendingReads[path];
    if (!pending || pending.scope !== scope) {
      pending = { scope: scope };
      pendingReads[path] = pending;
      function clear() { if (pendingReads[path] === pending) delete pendingReads[path]; }
      pending.promise = request(path, options).then(function (data) { clear(); return data; }, function (error) { clear(); throw error; });
    }
    return pending.promise.then(function (data) {
      if (readScope() !== scope) {
        var changed = new Error('登录状态或服务地址已切换，已忽略原会话响应');
        changed.code = 'SESSION_CHANGED'; throw changed;
      }
      // Previously each HTTP response was parsed separately. Preserve that
      // independence so a consumer cannot mutate another consumer's account data.
      return data == null ? data : JSON.parse(JSON.stringify(data));
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
    phoneCode: function (phone, purpose) { return request('/api/auth/phone/code', { timeoutMs: 20000, authEntry: purpose !== 'bind', method: 'POST', body: JSON.stringify({ phone: phone, purpose: purpose || 'login' }) }); },
    phoneLogin: function (phone, code, challengeId, purpose, password) { return request('/api/auth/phone/login', { timeoutMs: 20000, authEntry: purpose !== 'bind', method: 'POST', body: JSON.stringify({ phone: phone, code: code, challengeId: challengeId, purpose: purpose || 'login', password: password || undefined }) }); },
    phonePasswordLogin: function (phone, password) { return request('/api/auth/phone/password', { timeoutMs: 20000, authEntry: true, method: 'POST', body: JSON.stringify({phone:phone,password:password}) }); },
    me: function () { return sharedRead('/api/auth/me'); },
    getMembership: function () { return request('/api/membership'); },
    redeemMembership: function (code, requestId) { return request('/api/membership/redeem', { method: 'POST', body: JSON.stringify({ code: code, requestId: requestId }) }); },
    heartbeat: function () { return request('/api/usage/heartbeat', { method: 'POST', timeoutMs: 8000, body: '{}' }); },
    /* 设置自己账号的用户名 / 密码（可只传其一）。路径以 /api/auth/ 开头但**不是**登录或注册，
       故 request() 会照常带上既有 token —— 服务端据 token 判定改的是哪个账号。 */
    setCredentials: function (payload) { return request('/api/auth/credentials', { method: 'POST', body: JSON.stringify(payload) }); },
    getConfig: function () { return sharedRead('/api/config'); },
    getCourseCatalog: function () { return sharedRead('/api/course-content/catalog', { timeoutMs: 8000 }); },
    getData: function (since) {
      var path = '/api/data';
      if (since != null) path += '?since=' + encodeURIComponent(String(since));
      return request(path, { requireResponseIdentity: true });
    },
    submitOperation: function (operation, confirmedSeq) { return request('/api/operations', { method: 'POST',
      requireResponseIdentity: true,
      headers: { Accept: Number.isSafeInteger(confirmedSeq) && confirmedSeq >= 0
        ? 'application/vnd.chunklab.evidence-delta+json; base-seq=' + confirmedSeq
        : 'application/vnd.chunklab.delta-receipt+json' }, body: JSON.stringify(operation) }); },
    reportSaveHealth: function (summary) { return request('/api/client-save-health', { method: 'POST', body: JSON.stringify(summary) }); },
    getOperationReceipt: function (id) { return request('/api/operations/' + encodeURIComponent(id), { requireResponseIdentity: true }); },
    importCourseContent: function (operation) { return request('/api/content-import', { method: 'POST', requireResponseIdentity: true, body: JSON.stringify(operation) }); },
    getAssessmentSession: function (id) { return request('/api/assessment-sessions/' + encodeURIComponent(id)); },
    /* Historical receipts are read-only and remain available for explicit backups. */
    getSyncBatchResolution: function (id) { return request('/api/sync/batch/resolutions/' + encodeURIComponent(id)); },
    getSyncResolution: function(id) { return request('/api/sync/resolutions/' + encodeURIComponent(id)); },
    exportData: function () { return request('/api/export'); },
    /* 公共题库市场（Phase D） */
    getPublicDecks: function () { return request('/api/deck/public'); },
    getPublicDeck: function (id) { return request('/api/deck/public/' + encodeURIComponent(id)); }
  };

  global.ChunkAPI = api;
})(window);
