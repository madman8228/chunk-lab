/* Shared, non-blocking feedback for an operation that is starting. */
(function(global){
  'use strict';
  var timer=null, toast=null;
  function dismiss(){if(timer)global.clearTimeout(timer);timer=null;if(toast)toast.remove();toast=null;}
  function show(message,options){
    options=options||{};dismiss();
    var doc=global.document;
    if(!doc.getElementById('operationToastStyle')){
      var style=doc.createElement('style');style.id='operationToastStyle';
      style.textContent='.operation-toast{position:fixed;z-index:10000;right:max(24px,env(safe-area-inset-right));bottom:max(24px,env(safe-area-inset-bottom));display:flex;align-items:center;gap:10px;box-sizing:border-box;max-width:calc(100vw - 32px);padding:14px 18px;border-radius:var(--ui-radius-card);background:#0f172a;color:#fff;font:600 13px/1.5 system-ui,sans-serif;box-shadow:0 10px 28px rgba(15,23,42,.18);pointer-events:none}.operation-toast svg{flex:none;width:18px;height:18px;color:#ffbe25}.operation-toast span{overflow-wrap:anywhere}@media(max-width:600px){.operation-toast{right:16px;bottom:max(16px,env(safe-area-inset-bottom));padding:12px 14px}}';
      doc.head.append(style);
    }
    toast=doc.createElement('div');toast.className='operation-toast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.setAttribute('aria-atomic','true');
    var icon=doc.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');
    icon.innerHTML='<circle cx="12" cy="12" r="10" fill="currentColor"/><path d="m8 12 2.5 2.5L16 9" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    var text=doc.createElement('span');text.textContent=String(message);toast.append(icon,text);doc.body.append(toast);
    timer=global.setTimeout(dismiss,options.duration||4000);
  }
  global.OperationToast={show:show,dismiss:dismiss};
})(window);
