/**
 * auth-ui.js · 登录 / 注册 遮罩（全局注入，自带样式）
 *
 * 用法：ChunkAuthUI.showLogin(onSuccess)
 *   - 未登录时由 CL.ensureCloud() 自动调用
 *   - 成功后写入 token 并调用 onSuccess 回调
 * 支持：登录 / 注册切换、服务器地址配置（首次或点「设置」时填）
 */
(function (global) {
  'use strict';

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* 登录回调队列：多个页面（main/decks/stats/courses）可能同时触发登录，
     用队列合并，登录成功后依次通知所有等待方，避免回调丢失 */
  var _loginWaiters = [];
  var _loginShown = false;
  function finishLogin(r) {
    _loginShown = false;
    /* 根因修复（2026-09-09，A2 浏览器实测发现）：此前只通知 waiters 不移除遮罩，
       登录/注册成功后页面被 #chunkauth-mask 永久挡住，多用户模式无法使用。 */
    var mask = global.document.getElementById('chunkauth-mask');
    if (mask && mask.parentNode) mask.parentNode.removeChild(mask);
    var ws = _loginWaiters;
    _loginWaiters = [];
    ws.forEach(function (cb) { try { cb(r); } catch (e) {} });
  }

  function showLogin(onSuccess) {
    if (onSuccess) _loginWaiters.push(onSuccess);
    if (_loginShown) return;
    _loginShown = true;
    var mask = el('div');
    mask.id = 'chunkauth-mask';
    mask.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(16,24,40,.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",sans-serif';

    var card = el('div');
    card.style.cssText = 'width:100%;max-width:360px;background:#fffdfa;border:1px solid #dedbd4;border-radius:16px;padding:26px 24px;box-shadow:0 24px 64px -20px rgba(16,24,40,.4)';

    var mode = 'login';
    var title = el('h2', null, '登录 Chunk Lab');
    title.style.cssText = 'margin:0 0 4px;font-size:19px;letter-spacing:-.01em;color:#202326';
    var sub = el('p', null, '数据已存到你的云服务器，登录后同步');
    sub.style.cssText = 'margin:0 0 18px;font-size:13px;color:#74716a';

    var apiInput = el('input');
    apiInput.type = 'text';
    apiInput.placeholder = '服务器地址（如 https://lab.example.com）';
    apiInput.value = (global.ChunkAPI && global.ChunkAPI.getBase()) || '';
    apiInput.style.cssText = 'width:100%;padding:9px 11px;margin-bottom:12px;border:1px solid #dedbd4;border-radius:9px;font-size:14px;box-sizing:border-box';
    /* 同源部署（前后端同一域名，base 为空）时前端与 API 天然同源，此字段无用且困惑 —— 仅分离部署（存了自定义 base）才显示 */
    if (!apiInput.value) apiInput.style.display = 'none';

    var userInput = el('input');
    userInput.type = 'text'; userInput.placeholder = '用户名';
    userInput.style.cssText = 'width:100%;padding:9px 11px;margin-bottom:10px;border:1px solid #dedbd4;border-radius:9px;font-size:14px;box-sizing:border-box';

    var passInput = el('input');
    passInput.type = 'password'; passInput.placeholder = '密码';
    passInput.style.cssText = 'width:100%;padding:9px 11px;margin-bottom:6px;border:1px solid #dedbd4;border-radius:9px;font-size:14px;box-sizing:border-box';

    var err = el('div');
    err.style.cssText = 'color:#b6483e;font-size:12.5px;min-height:18px;margin-bottom:8px';

    var submitBtn = el('button', null, '登录');
    submitBtn.style.cssText = 'width:100%;padding:10px;border:0;background:#2c62c9;color:#fff;border-radius:10px;font-size:15px;cursor:pointer;margin-top:4px';
    submitBtn.onmouseenter = function () { this.style.background = '#2457b5'; };
    submitBtn.onmouseleave = function () { this.style.background = '#2c62c9'; };

    var toggle = el('div');
    toggle.style.cssText = 'text-align:center;margin-top:14px;font-size:13px;color:#74716a';
    var toggleLink = el('a', null, '没有账号？注册');
    toggleLink.style.cssText = 'color:#2c62c9;cursor:pointer;text-decoration:none';
    toggle.appendChild(toggleLink);

    function setMode(m) {
      mode = m;
      if (m === 'login') {
        title.textContent = '登录 Chunk Lab';
        submitBtn.textContent = '登录';
        toggleLink.textContent = '没有账号？注册';
      } else {
        title.textContent = '注册 Chunk Lab';
        submitBtn.textContent = '注册并登录';
        toggleLink.textContent = '已有账号？登录';
      }
      err.textContent = '';
    }
    toggleLink.onclick = function () { setMode(mode === 'login' ? 'register' : 'login'); };

    function doSubmit() {
      var apiBase = apiInput.value.trim().replace(/\/+$/, '');
      if (apiBase) global.ChunkAPI.setBase(apiBase);
      else global.ChunkAPI.setBase('');
      var u = userInput.value.trim(), p = passInput.value;
      if (u.length < 2) { err.textContent = '用户名至少 2 个字符'; return; }
      if (p.length < 6) { err.textContent = '密码至少 6 位'; return; }
      submitBtn.disabled = true; submitBtn.textContent = '处理中…';
      var call = (mode === 'login') ? global.ChunkAPI.login(u, p) : global.ChunkAPI.register(u, p);
      call.then(function (r) {
        global.ChunkAPI.setToken(r.token);
        /* 标记手动会话：token 过期后 ensureCloud 弹登录框而不是静默建新游客（防用户以为数据丢了） */
        try { localStorage.setItem('chunklab_manual', '1'); } catch (e) {}
        finishLogin(r);
      }).catch(function (e) {
        err.textContent = (e && e.message) || '请求失败，请检查服务器地址';
        submitBtn.disabled = false;
        submitBtn.textContent = (mode === 'login') ? '登录' : '注册并登录';
      });
    }
    submitBtn.onclick = doSubmit;
    passInput.onkeydown = function (e) { if (e.key === 'Enter') doSubmit(); };
    userInput.onkeydown = function (e) { if (e.key === 'Enter') passInput.focus(); };

    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(apiInput);
    card.appendChild(userInput);
    card.appendChild(passInput);
    card.appendChild(err);
    card.appendChild(submitBtn);
    card.appendChild(toggle);
    mask.appendChild(card);
    document.body.appendChild(mask);
    userInput.focus();
  }

  function logout() {
    if (global.ChunkAPI) global.ChunkAPI.clearToken();
    /* 同步清掉游客凭据与手动会话标记，否则下次启动 ensureCloud 又会自动登回游客，"退出"形同虚设 */
    try { localStorage.removeItem('chunklab_guest'); localStorage.removeItem('chunklab_manual'); } catch (e) {}
  }

  global.ChunkAuthUI = { showLogin: showLogin, logout: logout };
})(window);
