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
  var _authExpired = false;
  global.addEventListener('chunklab-auth-expired', function () {
    _authExpired = true;
    var message = global.document.querySelector('#chunkauth-mask [data-auth-message]');
    if (message) message.textContent = '登录已过期，请重新登录；未提交记录会保留。';
  });
  function finishLogin(r) {
    _loginShown = false;
    _authExpired = false;
    /* 根因修复（2026-09-09，A2 浏览器实测发现）：此前只通知 waiters 不移除遮罩，
       登录/注册成功后页面被 #chunkauth-mask 永久挡住，多用户模式无法使用。 */
    var mask = global.document.getElementById('chunkauth-mask');
    if (mask && mask.parentNode) mask.parentNode.removeChild(mask);
    var ws = _loginWaiters;
    _loginWaiters = [];
    ws.forEach(function (cb) { try { cb(r); } catch (e) {} });
  }

  function showLogin(onSuccess, options) {
    if (onSuccess) _loginWaiters.push(onSuccess);
    if (_loginShown) return;
    _loginShown = true;
    var legacyTransition = !!(options && options.legacy && global.ChunkAuthUI.legacyPasswordLoginAllowed);
    if (global.ChunkAuthUI.phoneMode && !legacyTransition) { showPhoneForm(false, null, options); return; }
    var mask = el('div');
    mask.id = 'chunkauth-mask';
    mask.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(16,24,40,.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",sans-serif';

    var card = el('div');
    card.style.cssText = 'width:100%;max-width:360px;background:#fffdfa;border:1px solid #dedbd4;border-radius:16px;padding:26px 24px;box-shadow:0 24px 64px -20px rgba(16,24,40,.4)';

    var mode = 'login';
    var title = el('h2', null, '登录 Chunk Lab');
    title.style.cssText = 'margin:0 0 4px;font-size:19px;letter-spacing:-.01em;color:#202326';
    var sub = el('p', null, _authExpired ? '登录已过期，请重新登录；未提交记录会保留。' : '数据已存到你的云服务器，登录后同步');
    sub.setAttribute('data-auth-message', '');
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
    if(legacyTransition){err.setAttribute('role','status');err.setAttribute('aria-live','polite');}
    err.style.cssText = 'color:#b6483e;font-size:12.5px;min-height:18px;margin-bottom:8px';

    var submitBtn = el('button', null, '登录');
    submitBtn.style.cssText = 'width:100%;padding:10px;border:0;background:#2c62c9;color:#fff;border-radius:10px;font-size:15px;cursor:pointer;margin-top:4px';
    submitBtn.onmouseenter = function () { this.style.background = '#2457b5'; };
    submitBtn.onmouseleave = function () { this.style.background = '#2c62c9'; };

    var toggle = el('div');
    toggle.style.cssText = 'text-align:center;margin-top:14px;font-size:13px;color:#74716a';
    var toggleLink = el(legacyTransition ? 'button' : 'a', null, '没有账号？注册');
    toggleLink.style.cssText = 'color:#2c62c9;cursor:pointer;text-decoration:none';
    toggle.appendChild(toggleLink);
    if (legacyTransition) {
      card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');
      title.id='chunkauth-legacy-title';card.setAttribute('aria-labelledby',title.id);
      userInput.setAttribute('aria-label','用户名');userInput.autocomplete='username';
      passInput.setAttribute('aria-label','密码');passInput.autocomplete='current-password';
      toggleLink.type='button';toggleLink.style.background='transparent';toggleLink.style.border='0';
      toggleLink.style.minHeight='44px';
      title.textContent = '旧账号登录';
      sub.textContent = '使用原用户名和密码登录；登录后绑定手机号，课程和学习记录仍属于原账号。';
      toggleLink.textContent = '返回手机号登录';
    }

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
    toggleLink.onclick = function () {
      if (legacyTransition) {
        if (submitBtn.disabled) return;
        mask.remove(); _loginShown = false;
        showLogin(null, options && Object.assign({}, options, {legacy:false}));
        return;
      }
      setMode(mode === 'login' ? 'register' : 'login');
    };

    var submitting = false;
    function doSubmit() {
      if(submitting || !mask.isConnected) return;
      var apiBase = apiInput.value.trim().replace(/\/+$/, '');
      var u = userInput.value.trim(), p = passInput.value;
      if (u.length < 2) { err.textContent = '用户名至少 2 个字符'; return; }
      if (p.length < 6) { err.textContent = '密码至少 6 位'; return; }
      submitting=true;
      userInput.disabled=true;passInput.disabled=true;apiInput.disabled=true;
      if(legacyTransition)toggleLink.disabled=true;
      submitBtn.disabled = true; submitBtn.textContent = '处理中…';
      var call = (mode === 'login') ? global.ChunkAPI.login(u, p, apiBase) : global.ChunkAPI.register(u, p, apiBase);
      call.then(function (r) {
        global.ChunkAPI.setSession(apiBase, r.token);
        /* 标记手动会话：token 过期后 ensureCloud 弹登录框而不是静默建新游客（防用户以为数据丢了） */
        try { localStorage.setItem('chunklab_manual', '1'); localStorage.removeItem('chunklab_guest'); } catch (e) {}
        finishLogin(r);
      }).catch(function (e) {
        if(!mask.isConnected)return;
        submitting=false;
        userInput.disabled=false;passInput.disabled=false;apiInput.disabled=false;
        if(legacyTransition)toggleLink.disabled=false;
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
    if(legacyTransition){
      function cancelLegacy(){
        if(submitting)return;
        mask.remove();_loginShown=false;_loginWaiters=[];
      }
      if(options && options.dismissible){
        var cancelLegacyButton=el('button',null,'取消');cancelLegacyButton.type='button';
        cancelLegacyButton.style.cssText=toggleLink.style.cssText;
        cancelLegacyButton.onclick=cancelLegacy;card.appendChild(cancelLegacyButton);
      }
      card.onkeydown=function(event){
        if(event.key==='Escape' && options && options.dismissible){cancelLegacy();return;}
        if(event.key!=='Tab')return;
        var fields=Array.prototype.filter.call(card.querySelectorAll('input,button'),function(node){
          return !node.disabled && node.getClientRects().length;
        });
        if(!fields.length)return;
        if(event.shiftKey && document.activeElement===fields[0]){event.preventDefault();fields[fields.length-1].focus();}
        else if(!event.shiftKey && document.activeElement===fields[fields.length-1]){event.preventDefault();fields[0].focus();}
      };
    }
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
  function showSetAccount(currentName, onSuccess, options) {
    if (global.ChunkAuthUI.phoneMode) { showPhoneForm(true, onSuccess, options); return; }
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
      ? '完善账号名和密码后，可在其他设备登录同一账号，继续学习。'
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

  function showPhoneForm(binding, onSuccess, options) {
    if (!document.getElementById('jqka-phone-style')) {
      var styles = el('style'); styles.id = 'jqka-phone-style';
      styles.textContent = '.jqka-phone-dialog input:focus{outline:none;border-color:#70451e!important;box-shadow:none!important;background:#fff5db!important}.jqka-phone-dialog button:focus-visible{outline:3px solid #9b621c;outline-offset:3px}.jqka-phone-dialog input::placeholder{color:#785b3f;opacity:1}.jqka-phone-dialog button:disabled{opacity:.65;cursor:wait}.jqka-phone-dialog button:hover:not(:disabled){filter:brightness(1.04)}.jqka-phone-dialog input{caret-color:#714922}.jqka-phone-dialog ::selection{background:#ffcf4e;color:#3c2818}@media(max-width:420px){.jqka-phone-dialog{padding:22px 18px!important}.jqka-phone-dialog .phone-send{padding:10px 8px!important;font-size:12px!important}}';
      document.head.appendChild(styles);
    }
    var id = binding ? 'chunkacct-mask' : 'chunkauth-mask';
    if (document.getElementById(id)) return;
    var previousFocus = document.activeElement;
    var mask = el('div'); mask.id = id;
    mask.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(49,35,19,.58);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;font-family:system-ui,sans-serif;overflow:auto';
    var card = el('form');
    card.className = 'jqka-phone-dialog';
    card.noValidate = true; card.tabIndex = -1;
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-labelledby', id + '-title');
    card.style.cssText = 'width:100%;max-width:420px;max-height:calc(100dvh - 32px);overflow:auto;background:#fff9e9;border:3px solid #70451e;border-radius:20px;padding:26px 28px;box-sizing:border-box;box-shadow:inset 0 0 0 5px #f0d49a,0 5px 0 #aa722e,0 18px 42px #24180d55;color:#523019';
    var title = el('h2'); title.id = id + '-title'; title.textContent = binding && !(options && options.loginEntry) ? '绑定手机号' : '登录 / 注册';
    title.style.cssText = 'position:relative;display:table;margin:0 auto 18px;padding:8px 24px;border:3px solid #70451e;border-radius:10px;background:linear-gradient(#ffe18b,#f4be4d);box-shadow:inset 0 2px 0 #fff2c6,0 3px 0 #aa722e;font-size:24px;color:#523019;font-weight:900';
    function input(labelText, type, autocomplete) {
      var label = el('label'); label.style.cssText = 'display:block;margin-bottom:16px;color:#523019;font-size:14px';
      var caption = el('span'); caption.textContent = labelText; label.appendChild(caption);
      var field = el('input'); field.type = type; field.autocomplete = autocomplete; field.required = true;
      field.setAttribute('aria-label', labelText);
      field.inputMode = type === 'password' ? 'text' : 'numeric';
      field.style.cssText = 'display:block;width:100%;min-width:0;box-sizing:border-box;margin-top:7px;padding:12px;border:2px solid #aa8450;border-radius:10px;font:inherit;color:#523019;background:#fffdf4;box-shadow:inset 0 2px 3px #8d683114';
      label.appendChild(field); card.appendChild(label); return field;
    }
    card.appendChild(title);
    var phone = input('手机号', 'tel', 'tel-national'); phone.maxLength = 11; phone.pattern = '1[3-9][0-9]{9}';
    phone.placeholder = '请输入手机号';
    var phoneRow = el('div'); phoneRow.style.cssText = 'display:flex;align-items:stretch;gap:8px;margin-top:7px';
    phone.parentNode.appendChild(phoneRow); phoneRow.appendChild(phone); phone.style.flex = '1'; phone.style.marginTop = '0'; phone.style.height = '50px';
    var code = input('短信验证码（六位）', 'text', 'one-time-code'); code.maxLength = 6; code.pattern = '[0-9]{6}';
    code.placeholder = '请输入验证码';
    var password = input('密码', 'password', 'new-password'); password.required = false; password.maxLength = 72; password.placeholder = '设置密码（选填）';
    var passwordHint = el('small'); passwordHint.id = id + '-password-hint'; passwordHint.textContent = '密码至少6位；设置后可用手机号＋密码登录。';
    passwordHint.style.cssText = 'display:block;margin-top:7px;font-size:12px;line-height:1.5;color:#745333';
    password.setAttribute('aria-describedby',passwordHint.id); password.parentNode.appendChild(passwordHint);
    var send = el('button'); send.type = 'button'; send.textContent = '获取验证码';
    send.className = 'phone-send';
    send.style.cssText = 'flex:none;box-sizing:border-box;height:50px;min-height:50px;margin:0;padding:10px 12px;background:linear-gradient(#ffe290,#f5bb43);border:2px solid #805329;color:#523019;border-radius:10px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;box-shadow:inset 0 1px 0 #fff2c0';
    phoneRow.appendChild(send);
    var status = el('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    status.style.cssText = 'min-height:20px;margin:12px 0;font-size:13px;line-height:1.5;color:#745333';
    var submit = el('button'); submit.type = 'submit'; submit.textContent = binding ? '确认绑定' : '登录';
    submit.style.cssText = 'width:100%;min-height:48px;padding:12px;border:2px solid #70451e;background:linear-gradient(#ffdc77,#f4be4d);color:#523019;border-radius:12px;font:inherit;font-weight:800;cursor:pointer;box-shadow:inset 0 2px 0 #fff2c6,0 3px 0 #aa722e';
    card.appendChild(status); card.appendChild(submit);
    var challenge = null, sentPhone = '', busy = false, timer = null, retryAt = 0, passwordMode = false;
    if (!binding) {
      var switchMode = el('button'); switchMode.type = 'button'; switchMode.textContent = '使用密码登录';
      switchMode.style.cssText = 'display:block;margin:18px auto 0;padding:6px;border:0;background:none;color:#67431f;font:inherit;font-size:13px;text-decoration:underline;text-underline-offset:4px;cursor:pointer';
      switchMode.onclick = function() {
        if(busy) return;
        passwordMode = !passwordMode;
        code.parentNode.style.display = passwordMode ? 'none' : 'block'; send.hidden = passwordMode;
        password.required = passwordMode; password.autocomplete = passwordMode ? 'current-password' : 'new-password';
        password.placeholder = passwordMode ? '请输入密码' : '设置密码（选填）';
        passwordHint.textContent = passwordMode ? '密码至少6位；忘记密码可切换验证码登录并重设。' : '密码至少6位；设置后可用手机号＋密码登录。';
        title.textContent = passwordMode ? '密码登录' : '登录 / 注册';
        switchMode.textContent = passwordMode ? '使用验证码登录 / 注册' : '使用密码登录';
        status.textContent = ''; password.focus();
      };
      card.appendChild(switchMode);
      if(global.ChunkAuthUI.legacyPasswordLoginAllowed === true){
        var legacyEntry=el('button');legacyEntry.type='button';legacyEntry.textContent='使用旧账号登录';
        legacyEntry.style.cssText=switchMode.style.cssText;
        legacyEntry.onclick=function(){
          if(busy)return;
          close();_loginShown=false;
          showLogin(null,Object.assign({},options||{},{legacy:true}));
        };
        card.appendChild(legacyEntry);
      }
    }
    var purpose = binding ? 'bind' : 'login';
    function close() {
      if(timer) clearInterval(timer);
      if(mask.parentNode) mask.parentNode.removeChild(mask);
      if(previousFocus && previousFocus.focus) previousFocus.focus();
    }
    function countdown() {
      var remaining = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
      send.disabled = remaining > 0;
      send.textContent = remaining ? remaining + '秒后重发' : '获取验证码';
      if(!remaining && timer) { clearInterval(timer); timer = null; }
    }
    phone.oninput = function () { challenge = null; };
    send.onclick = function () {
      if(send.disabled || busy) return;
      var value = phone.value.trim();
      if(!/^1[3-9]\d{9}$/.test(value)) { status.textContent = '请输入正确的中国大陆手机号'; phone.focus(); return; }
      send.disabled = true; send.textContent = '发送中…'; challenge = null;
      global.ChunkAPI.phoneCode(value, purpose).then(function(r) {
        if(!mask.isConnected) return;
        challenge = r.challengeId; sentPhone = value;
        retryAt = Date.now() + r.retryAfter * 1000;
        status.textContent = '验证码已发送，5 分钟内有效。';
        countdown(); timer = setInterval(countdown, 1000); code.focus();
      }).catch(function(e) {
        if(!mask.isConnected) return;
        status.textContent = e.message || '暂时无法发送，请稍后再试';
        retryAt = Date.now() + (e.retryAfterMs || 0); countdown();
        if(retryAt > Date.now()) timer = setInterval(countdown, 1000);
      });
    };
    card.onsubmit = function(e) {
      e.preventDefault(); if(busy) return;
      if(!/^1[3-9]\d{9}$/.test(phone.value.trim())) { status.textContent = '请输入正确的中国大陆手机号'; phone.focus(); return; }
      if((passwordMode || password.value) && password.value.length < 6) { status.textContent = '密码至少6位'; password.focus(); return; }
      if(new TextEncoder().encode(password.value).length > 72) { status.textContent = '密码最长72字节，请缩短后重试'; password.focus(); return; }
      if(!passwordMode && (!challenge || sentPhone !== phone.value.trim())) { status.textContent = '请先获取此手机号的验证码'; return; }
      if(!passwordMode && !/^\d{6}$/.test(code.value)) { status.textContent = '请输入六位短信验证码'; code.focus(); return; }
      card.focus();
      busy = true; submit.disabled = true; send.disabled = true; phone.disabled = true; code.disabled = true; password.disabled = true;
      if(switchMode) switchMode.disabled = true;
      submit.textContent = binding ? '绑定中…' : '登录中…';
      var request = passwordMode ? global.ChunkAPI.phonePasswordLogin(phone.value.trim(), password.value) : global.ChunkAPI.phoneLogin(sentPhone, code.value, challenge, purpose, password.value);
      request.then(function(r) {
        if(!mask.isConnected) return;
        // Same-user binding must not change the cache epoch or abandon pending writes.
        if(!binding) global.ChunkAPI.setSession(global.ChunkAPI.getBase(), r.token);
        try { localStorage.setItem('chunklab_manual', '1'); } catch (_) {}
        close();
        if(binding) { if(onSuccess) onSuccess(r.user.phone || r.user.username); }
        else finishLogin(r);
      }).catch(function(error) {
        if(!mask.isConnected) return;
        status.textContent = error.message || '暂时无法登录，请稍后再试';
        busy = false; submit.disabled = false; phone.disabled = false; code.disabled = false; password.disabled = false;
        if(switchMode) switchMode.disabled = false;
        submit.textContent = binding ? '确认绑定' : '登录'; countdown();
      });
    };
    var dismissible = binding || (options && options.dismissible);
    function cancelForm() {
      if(busy) return;
      if(!binding) { _loginShown = false; _loginWaiters = []; }
      close();
    }
    if(dismissible) {
      card.style.position = 'relative';
      var closeButton = el('button'); closeButton.type = 'button';
      closeButton.setAttribute('aria-label', '关闭登录窗口');
      closeButton.style.cssText = 'position:absolute;top:8px;right:8px;width:44px;height:44px;padding:12px;display:flex;align-items:center;justify-content:center;border:0;border-radius:10px;background:transparent;color:#745333;cursor:pointer';
      closeButton.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      closeButton.onclick = cancelForm; card.appendChild(closeButton);
    }
    card.onkeydown = function(e) {
      if(e.key === 'Escape' && dismissible && !busy) cancelForm();
      if(e.key !== 'Tab') return;
      var fields = Array.prototype.filter.call(card.querySelectorAll('input,button'), function(n) { return !n.disabled && n.getClientRects().length; });
      if(!fields.length) { e.preventDefault(); card.focus(); return; }
      if(document.activeElement === card) { e.preventDefault(); fields[e.shiftKey ? fields.length - 1 : 0].focus(); return; }
      if(e.shiftKey && document.activeElement === fields[0]) { e.preventDefault(); fields[fields.length - 1].focus(); }
      else if(!e.shiftKey && document.activeElement === fields[fields.length - 1]) { e.preventDefault(); fields[0].focus(); }
    };
    mask.appendChild(card); document.body.appendChild(mask); phone.focus();
  }

  global.ChunkAuthUI = { showLogin: showLogin, showSetAccount: showSetAccount, logout: logout, phoneMode: false, legacyPasswordLoginAllowed:false };
})(window);
