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
      var u = userInput.value.trim(), p = passInput.value;
      if (u.length < 2) { err.textContent = '用户名至少 2 个字符'; return; }
      if (p.length < 6) { err.textContent = '密码至少 6 位'; return; }
      submitBtn.disabled = true; submitBtn.textContent = '处理中…';
      var call = (mode === 'login') ? global.ChunkAPI.login(u, p, apiBase) : global.ChunkAPI.register(u, p, apiBase);
      call.then(function (r) {
        global.ChunkAPI.setSession(apiBase, r.token);
        /* 标记手动会话：token 过期后 ensureCloud 弹登录框而不是静默建新游客（防用户以为数据丢了） */
        try { localStorage.setItem('chunklab_manual', '1'); localStorage.removeItem('chunklab_guest'); } catch (e) {}
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

  /**
   * 设置账号：把当前的静默游客账号**就地**升级为「用户名 + 自己记得住的密码」。
   *
   * 为什么不换账号：改名不改 user_id ⇒ 云端与本机数据零迁移，用户不会看到「数据没了」。
   * 为什么不做 reload：token 仍然有效（uid 未变），页面状态无需重建。
   * 成功后必须清 chunklab_guest —— 否则下次启动会拿旧凭据去静默重登（现已必然失败），
   * 转而自动新建一个空游客账号，用户会以为数据丢了（同 showLogin 的处理）。
   */
  function showSetAccount(currentName, onSuccess) {
    if (global.document.getElementById('chunkacct-mask')) return;
    var isGuest = !currentName || /^guest_/.test(currentName);

    var mask = el('div');
    mask.id = 'chunkacct-mask';
    mask.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(16,24,40,.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",sans-serif';

    var card = el('div');
    card.style.cssText = 'width:100%;max-width:360px;background:#fffdfa;border:1px solid #dedbd4;border-radius:16px;padding:26px 24px;box-shadow:0 24px 64px -20px rgba(16,24,40,.4)';

    var title = el('h2', null, '设置账号');
    title.style.cssText = 'margin:0 0 4px;font-size:19px;letter-spacing:-.01em;color:#202326';
    var sub = el('p', null, isGuest
      ? '当前是自动生成的临时账号，只存在于这台设备。设置一个自己记得住的账号后，就能在别的设备登回同一份数据。'
      : '修改账号名或密码。学习数据跟随账号，不受影响。');
    sub.style.cssText = 'margin:0 0 16px;font-size:13px;color:#74716a;line-height:1.5';

    var userInput = el('input');
    userInput.type = 'text';
    userInput.value = isGuest ? '' : (currentName || '');
    userInput.placeholder = '用户名（自己起一个）';
    userInput.style.cssText = 'width:100%;padding:9px 11px;margin-bottom:10px;border:1px solid #dedbd4;border-radius:9px;font-size:14px;box-sizing:border-box';

    var passInput = el('input');
    passInput.type = 'password'; passInput.placeholder = '密码（至少 6 位）';
    passInput.style.cssText = 'width:100%;padding:9px 11px;margin-bottom:10px;border:1px solid #dedbd4;border-radius:9px;font-size:14px;box-sizing:border-box';

    var passConfirm = el('input');
    passConfirm.type = 'password'; passConfirm.placeholder = '再输一次密码';
    passConfirm.style.cssText = 'width:100%;padding:9px 11px;margin-bottom:10px;border:1px solid #dedbd4;border-radius:9px;font-size:14px;box-sizing:border-box';

    var err = el('div');
    err.style.cssText = 'color:#b6483e;font-size:12.5px;min-height:18px;margin-bottom:8px';

    var submitBtn = el('button', null, '保存');
    submitBtn.style.cssText = 'width:100%;padding:10px;border:0;background:#2c62c9;color:#fff;border-radius:10px;font-size:15px;cursor:pointer;margin-top:4px';
    submitBtn.onmouseenter = function () { this.style.background = '#2457b5'; };
    submitBtn.onmouseleave = function () { this.style.background = '#2c62c9'; };

    var cancel = el('button', null, '取消');
    cancel.type = 'button';
    cancel.style.cssText = 'width:100%;padding:9px;margin-top:8px;border:0;background:transparent;color:#74716a;border-radius:10px;font-size:13px;cursor:pointer';

    function close() {
      if (mask.parentNode) mask.parentNode.removeChild(mask);
    }

    function doSubmit() {
      var name = userInput.value.trim();
      var p1 = passInput.value, p2 = passConfirm.value;
      /* 游客账号必须起名：只改密码的话用户名仍是 guest_<随机>，用户记不住，等于没解决跨设备。 */
      if (isGuest && !name) { err.textContent = '请先设置一个用户名'; userInput.focus(); return; }
      if (name && name.length < 2) { err.textContent = '用户名至少 2 个字符'; return; }
      if (name && name.length > 32) { err.textContent = '用户名最长 32 个字符'; return; }
      var wantsPass = !!(p1 || p2);
      if (wantsPass) {
        if (p1.length < 6) { err.textContent = '密码至少 6 位'; return; }
        if (p1 !== p2) { err.textContent = '两次输入的密码不一致'; return; }
      }
      var payload = {};
      if (name && name !== currentName) payload.username = name;
      if (p1) payload.password = p1;
      if (!payload.username && !payload.password) { err.textContent = '没有需要修改的内容'; return; }

      submitBtn.disabled = true; submitBtn.textContent = '处理中…';
      global.ChunkAPI.setCredentials(payload).then(function (r) {
        try { localStorage.removeItem('chunklab_guest'); localStorage.setItem('chunklab_manual', '1'); } catch (e) {}
        var finalName = (r && r.user && r.user.username) || payload.username || currentName;
        close();
        if (onSuccess) { try { onSuccess(finalName); } catch (e) {} }
      }).catch(function (e) {
        err.textContent = (e && e.message) || '设置失败，请稍后再试';
        submitBtn.disabled = false;
        submitBtn.textContent = '保存';
      });
    }
    submitBtn.onclick = doSubmit;
    passConfirm.onkeydown = function (e) { if (e.key === 'Enter') doSubmit(); };
    passInput.onkeydown = function (e) { if (e.key === 'Enter') passConfirm.focus(); };
    userInput.onkeydown = function (e) { if (e.key === 'Enter') passInput.focus(); };
    cancel.onclick = close;

    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(userInput);
    card.appendChild(passInput);
    card.appendChild(passConfirm);
    card.appendChild(err);
    card.appendChild(submitBtn);
    card.appendChild(cancel);
    mask.appendChild(card);
    document.body.appendChild(mask);
    userInput.focus();
  }

  function logout() {
    if (global.ChunkAPI) global.ChunkAPI.clearToken();
    /* 同步清掉游客凭据与手动会话标记，否则下次启动 ensureCloud 又会自动登回游客，"退出"形同虚设 */
    // An explicit logout must show login, not silently create another guest.
    try { localStorage.removeItem('chunklab_guest'); localStorage.setItem('chunklab_manual', '1'); } catch (e) {}
  }

  global.ChunkAuthUI = { showLogin: showLogin, showSetAccount: showSetAccount, logout: logout };
})(window);
