/* Shared static-page update checks. Refresh remains an explicit user action. */
(function(global){
  'use strict';
  if(!('serviceWorker' in navigator))return;
  var hadController=!!navigator.serviceWorker.controller, shown=false, registration=null, reloadRequested=false;
  function announce(){
    if(shown)return;shown=true;
    var banner=document.createElement('div');banner.className='page-update-notice';banner.setAttribute('role','status');
    banner.style.cssText='position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:11000;display:flex;align-items:center;gap:8px;max-width:calc(100vw - 32px);padding:6px 10px;border:1px solid #e1c18d;border-radius:var(--ui-radius-control);background:#fff8e8;color:#523019;font:13px/1.35 system-ui,sans-serif;box-shadow:0 4px 16px rgba(82,48,25,.12)';
    var text=document.createElement('span');text.textContent='发现新版本';
    var refresh=document.createElement('button');refresh.type='button';refresh.textContent='刷新页面';refresh.style.cssText='border:0;background:transparent;color:#8c4300;font:inherit;font-weight:700;cursor:pointer;min-height:28px';refresh.onclick=function(){if(registration&&registration.waiting){reloadRequested=true;refresh.disabled=true;refresh.textContent='正在更新…';registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});}else global.location.reload();};
    var close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','关闭更新提示');close.style.cssText='border:0;background:transparent;color:#785b3e;font:inherit;font-size:18px;cursor:pointer;min-width:28px;min-height:28px';close.onclick=function(){banner.remove();};
    banner.append(text,refresh,close);document.body.append(banner);
  }
  navigator.serviceWorker.addEventListener('controllerchange',function(){if(reloadRequested){reloadRequested=false;global.location.reload();return;}if(hadController)announce();hadController=true;});
  navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(function(reg){
    registration=reg;
    if(reg.waiting)announce();
    var lastCheck=0;
    function check(){if(navigator.onLine===false||Date.now()-lastCheck<60000)return;lastCheck=Date.now();reg.update().catch(function(){});}
    reg.addEventListener('updatefound',function(){var worker=reg.installing;if(worker)worker.addEventListener('statechange',function(){if(worker.state==='installed'&&hadController)announce();});});
    global.addEventListener('online',check);
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')check();});check();
  }).catch(function(){/* Offline startup must remain usable. */});
})(window);
