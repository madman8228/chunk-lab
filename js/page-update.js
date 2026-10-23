/* Shared static-page update checks. Refresh remains an explicit user action. */
(function(global){
  'use strict';
  if(!('serviceWorker' in navigator))return;
  var hadController=!!navigator.serviceWorker.controller, shown=false;
  function announce(){
    if(shown)return;shown=true;
    var banner=document.createElement('div');banner.className='page-update-notice';banner.setAttribute('role','status');
    banner.style.cssText='position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:11000;display:flex;align-items:center;gap:12px;max-width:calc(100vw - 32px);padding:10px 16px;border:1px solid #e1c18d;border-radius:12px;background:#fff8e8;color:#523019;font:14px/1.5 system-ui,sans-serif;box-shadow:0 4px 16px rgba(82,48,25,.12)';
    var text=document.createElement('span');text.textContent='发现新版本';
    var refresh=document.createElement('button');refresh.type='button';refresh.textContent='刷新页面';refresh.style.cssText='border:0;background:transparent;color:#8c4300;font:inherit;font-weight:700;cursor:pointer;min-height:36px';refresh.onclick=function(){global.location.reload();};
    banner.append(text,refresh);document.body.append(banner);
  }
  navigator.serviceWorker.addEventListener('controllerchange',function(){if(hadController)announce();hadController=true;});
  navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(function(reg){
    if(reg.waiting)announce();
    var lastCheck=0;
    function check(){if(navigator.onLine===false||Date.now()-lastCheck<60000)return;lastCheck=Date.now();reg.update().catch(function(){});}
    reg.addEventListener('updatefound',function(){var worker=reg.installing;if(worker)worker.addEventListener('statechange',function(){if(worker.state==='installed'&&hadController)announce();});});
    global.addEventListener('online',check);
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')check();});check();
  }).catch(function(){/* Offline startup must remain usable. */});
})(window);
