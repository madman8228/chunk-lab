/* Small, shared status for server-authoritative durable learning operations. */
(function (global) {
  'use strict';

  var node = null;
  var showTimer = null;
  var hideTimer = null;
  var lastState = null;
  var pendingSince = null;
  var upgradeRequired = false;

  function protocol3() {
    var config = global.CL && global.CL.getCloudConfig ? global.CL.getCloudConfig() : null;
    return !!(config && config.persistenceMode === 'server-authoritative' && Number(config.writeProtocol) === 3);
  }

  function ensureNode() {
    if (node || !global.document || !global.document.body) return node;
    var style = global.document.createElement('style');
    style.textContent = '#chunklabSaveStatus{position:fixed;z-index:1200;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));' +
      'max-width:min(420px,calc(100vw - 24px));padding:9px 13px;border:1px solid #d8e0ee;border-radius:999px;' +
      'background:rgba(255,255,255,.96);color:#34445d;box-shadow:0 5px 18px rgba(27,48,82,.12);' +
      'font:500 13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;opacity:0;transform:translateY(5px);' +
      'pointer-events:none;transition:opacity .16s ease,transform .16s ease}' +
      '#chunklabSaveStatus[data-visible="true"]{opacity:1;transform:translateY(0)}' +
      '#chunklabSaveStatus[data-tone="error"]{border-color:#e8c5bd;background:#fff8f6;color:#8b3428}' +
      '#chunklabSaveStatus[data-upgrade="true"]{display:flex;align-items:center;gap:12px;border-radius:12px;pointer-events:auto}' +
      '#chunklabSaveStatusRefresh{flex:none;border:0;border-radius:999px;padding:6px 11px;background:#2d62d5;color:#fff;' +
      'font:600 12px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer}' +
      '#chunklabSaveStatusRefresh:focus-visible{outline:2px solid #173f99;outline-offset:2px}' +
      '@media(prefers-reduced-motion:reduce){#chunklabSaveStatus{transition:none}}';
    global.document.head.appendChild(style);
    node = global.document.createElement('div');
    node.id = 'chunklabSaveStatus';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    node.setAttribute('aria-atomic', 'true');
    node.setAttribute('data-visible', 'false');
    global.document.body.appendChild(node);
    return node;
  }

  function cancelTimers() {
    if (showTimer != null) global.clearTimeout(showTimer);
    if (hideTimer != null) global.clearTimeout(hideTimer);
    showTimer = hideTimer = null;
  }

  function hide() {
    cancelTimers();
    if (node) node.setAttribute('data-visible', 'false');
  }

  function show(message, tone, duration) {
    if (upgradeRequired) return;
    var target = ensureNode();
    if (!target) return;
    cancelTimers();
    target.textContent = message;
    target.setAttribute('data-tone', tone || 'normal');
    target.setAttribute('data-upgrade', 'false');
    target.setAttribute('data-visible', 'true');
    if (duration > 0) hideTimer = global.setTimeout(hide, duration);
  }

  function showRequiredUpdate() {
    /* main.html already has a larger, practice-aware update control. */
    if (global.document && global.document.getElementById('updateToast')) return;
    var target = ensureNode();
    if (!target) return;
    upgradeRequired = true;
    cancelTimers();
    target.textContent = '';
    var message = global.document.createElement('span');
    message.textContent = '页面需要更新后才能继续保存。';
    var refresh = global.document.createElement('button');
    refresh.id = 'chunklabSaveStatusRefresh';
    refresh.type = 'button';
    refresh.textContent = '刷新页面';
    refresh.addEventListener('click', function () { global.location.reload(); });
    target.appendChild(message);
    target.appendChild(refresh);
    target.setAttribute('data-tone', 'error');
    target.setAttribute('data-upgrade', 'true');
    target.setAttribute('data-visible', 'true');
  }


  function onState(state) {
    lastState = state || {};
    if (upgradeRequired) return;
    if (!protocol3()) return;
    var phase = lastState.phase;
    if (phase === 'pending' || phase === 'sending') {
      if (pendingSince == null) pendingSince = Date.now();
      cancelTimers();
      var remaining = Math.max(0, 5000 - (Date.now() - pendingSince));
      showTimer = global.setTimeout(function () {
        showTimer = null;
        if (!lastState || !['pending', 'sending'].includes(lastState.phase)) return;
        show('已安全保存在此设备，联网后会自动同步。', 'normal');
      }, remaining);
      return;
    }
    pendingSince = null;
    if (phase === 'queueing') {
      if (showTimer == null) showTimer = global.setTimeout(function () {
        showTimer = null;
        if (lastState && lastState.phase === 'queueing') show('正在安全保存到此设备…', 'normal');
      }, 1200);
      return;
    }
    if (phase === 'unavailable' || phase === 'capacity') {
      show('此设备暂时无法安全保存，请检查浏览器空间后重试。', 'error');
      return;
    }
    if (phase === 'blocked') {
      show('有一项内容暂未完成保存；其他学习仍可继续。请刷新后重试。', 'error');
      return;
    }
    if (phase === 'paused' && lastState.error === 'CLIENT_UPDATE_REQUIRED') {
      showRequiredUpdate();
      return;
    }
    if (phase === 'paused' && (lastState.error === 'NOT_AUTH' || lastState.error === 401)) {
      show('登录已过期，请重新登录；未提交记录会保留。', 'error');
      return;
    }
    if (phase === 'saved') {
      show('已保存。', 'normal', 1400);
      return;
    }
    if (phase === 'idle' && !(Number(lastState.pending) > 0) && !(Number(lastState.blocked) > 0)) hide();
  }

  global.addEventListener('server-store-state', function (event) { onState(event && event.detail); });
  global.addEventListener('chunklab-upgrade-required', showRequiredUpdate);
  global.addEventListener('chunklab-local-save-durable', function () {
    if (protocol3()) return;
    show('已保存在此设备。', 'normal', 3500);
  });
  global.addEventListener('cloud-config-changed', function () {
    if (global.ServerStore && typeof global.ServerStore.state === 'function') onState(global.ServerStore.state());
  });
  if (global.ServerStore && typeof global.ServerStore.onState === 'function') {
    global.ServerStore.onState(onState);
  }
})(window);
