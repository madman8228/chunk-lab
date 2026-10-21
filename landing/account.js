/* jqka homepage account menu. Personal data stays in memory and comes from /auth/me. */
(function (global) {
  'use strict';
  var api = global.ChunkAPI, auth = global.ChunkAuthUI;
  var byId = function (id) { return document.getElementById(id); };
  var root = byId('jqkaAccount'), trigger = byId('jqkaLogin'), label = byId('jqkaAccountLabel');
  var panel = byId('jqkaAccountPanel'), message = byId('jqkaAccountMessage'), bind = byId('jqkaAccountBind');
  var logout = byId('jqkaAccountLogout');
  if (!root || !api || !auth) return;
  var user = null, config = null, generation = 0, refreshing = null;
  function formalUser(value){return !!(value && (config && config.authMode === 'phone' ? value.phone : value.username && !/^guest_/.test(value.username)));}

  function closePanel(focus) {
    panel.hidden = true; trigger.setAttribute('aria-expanded', 'false');
    if (focus) trigger.focus();
  }
  function openPanel() {
    if (!user) return;
    message.textContent = '';
    panel.hidden = false; trigger.setAttribute('aria-expanded', 'true'); panel.focus();
  }
  function clearProfile() {
    user = null; label.textContent = '登录'; closePanel(false); bind.hidden = true; logout.hidden = true;
    ['jqkaAccountName', 'jqkaAccountNote', 'jqkaAccountId', 'jqkaAccountPhone'].forEach(function (id) { byId(id).textContent = ''; });
  }
  function renderProfile(next) {
    user = next;
    // The API returns a masked phone. Also mask here if an older API ever returns the full number.
    var phone = typeof user.phone === 'string' ? user.phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : '';
    var generated = /^(guest_|phone_)/.test(user.username || '');
    var name = phone || (generated ? '我的账号' : user.username) || '我的账号';
    label.textContent = formalUser(user) ? '个人中心' : '登录';
    byId('jqkaAccountTitle').textContent = '个人中心';
    byId('jqkaAccountName').textContent = name;
    byId('jqkaAccountName').hidden = false;
    byId('jqkaAccountId').textContent = String(user.id);
    byId('jqkaAccountPhone').textContent = phone || '尚未绑定';
    byId('jqkaAccountNote').textContent = phone ? '已登录。' : '绑定手机号后，可在其他设备登录原账号，保留课程和学习记录。';
    bind.hidden = !!phone || !config || config.authMode !== 'phone';
    logout.hidden = false;
  }
  function requestConfig() {
    return api.request('/api/config', { timeoutMs: 10000 }).then(function (value) {
      config = value; auth.phoneMode = value.authMode === 'phone';
      auth.legacyPasswordLoginAllowed = value.legacyPasswordLoginAllowed === true;
      return value;
    });
  }
  function refresh() {
    var revision = ++generation;
    var token;
    try { token = api.getToken(); } catch (_) { clearProfile(); return Promise.resolve(); }
    if (!token) { clearProfile(); return Promise.resolve(); }
    if (!user) label.textContent = '个人中心';
    return api.request('/api/auth/me', { timeoutMs: 10000 }).then(function (value) {
      if (revision !== generation) return;
      if (value && value.user) renderProfile(value.user); else clearProfile();
    }).catch(function (error) {
      if (revision !== generation) return;
      if (error.code === 'NOT_AUTH' || error.code === 'SESSION_CHANGED') clearProfile();
      // A temporary connection failure doesn't sign the user out or erase the account.
    });
  }
  function refreshFromOtherPage() {
    clearProfile();
    refreshing = refresh();
  }
  trigger.onclick = async function () {
    message.textContent = '';
    if(user && !formalUser(user)){
      auth.showSetAccount(user.username,function(){refresh().then(openPanel);},{loginEntry:true});
      return;
    }
    if (user) { if (panel.hidden) openPanel(); else closePanel(false); return; }
    trigger.disabled = true;
    try {
      if (refreshing) await refreshing;
      if (user) { openPanel(); return; }
      await requestConfig();
      if (api.isLoggedIn()) {
        await refresh();
        if (user) { openPanel(); return; }
        if (api.isLoggedIn()) { message.textContent = '暂时无法加载个人信息，请稍后重试。'; return; }
      }
      if (!auth.phoneMode) { message.textContent = '登录暂时不可用，请稍后再试。'; return; }
      auth.showLogin(function (result) {
        generation++;
        renderProfile(result.user); openPanel();
        if(global.WorkspaceEntry)global.WorkspaceEntry.enter();
      }, { dismissible: true });
    } catch (_) { message.textContent = '暂时无法连接，请稍后重试。'; }
    finally { trigger.disabled = false; }
  };
  byId('jqkaAccountClose').onclick = function () { closePanel(true); };
  bind.onclick = function () {
    if (!user) return;
    closePanel(false);
    auth.showSetAccount(user.username, function () { refresh().then(openPanel); });
  };
  logout.onclick = function () {
    if (!user || logout.hidden) return;
    generation++;
    auth.logout(); clearProfile(); message.textContent = ''; trigger.focus();
  };
  document.addEventListener('click', function (event) { if (!root.contains(event.target)) closePanel(false); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !panel.hidden) closePanel(true); });
  root.addEventListener('focusout', function (event) { if (event.relatedTarget && !root.contains(event.relatedTarget)) closePanel(false); });
  global.addEventListener('storage', function (event) {
    if ([api.SESSION_KEY, api.TOKEN_KEY, api.BASE_KEY].indexOf(event.key) !== -1 || event.key === null) refreshFromOtherPage();
  });
  global.addEventListener('pageshow', function (event) { if (event.persisted) refreshFromOtherPage(); });
  global.addEventListener('focus', function () { refreshing = refresh(); });
  requestConfig().then(function () { refreshing = refresh(); }).catch(function () { refreshing = refresh(); });
})(window);
