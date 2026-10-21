/* Non-blocking, dismissible page notices. Business state and retries belong to callers. */
(function(global){
  'use strict';
  function create(options){
    var doc=global.document;
    if(!doc.getElementById('noticeBannerStyle')){
      var style=doc.createElement('style');style.id='noticeBannerStyle';
      style.textContent='.notice-banner{width:min(560px,100%);height:26.4px;min-height:26.4px;box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) 20px;align-items:center;gap:6px;margin:0 auto;padding:1px 3px;border:1px solid #ddc99f;border-radius:7px;background:rgba(255,250,240,.94);color:#55351f;font:11.5px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;pointer-events:none}' +
        '.notice-banner .notice-banner-message{padding:0;margin:0;font:inherit;overflow-wrap:anywhere;max-height:30vh;overflow:auto}' +
        '.notice-banner button{appearance:none;border:0;border-radius:4px;background:transparent;box-shadow:none;color:inherit;font:inherit;cursor:pointer}.notice-banner button.notice-banner-action{display:inline;min-width:0;min-height:0;padding:2px 3px;margin:0 0 0 5px;vertical-align:baseline;text-decoration:underline;text-underline-offset:3px;white-space:nowrap}.notice-banner button.notice-banner-action:hover:not(:disabled){background:transparent;color:#704626;text-decoration-thickness:2px;box-shadow:none}.notice-banner button:focus-visible{outline:2px solid #704626;outline-offset:2px}' +
        '.notice-banner .notice-banner-close{display:grid;place-items:center;width:20px;height:20px;min-width:20px;min-height:20px;padding:0}.notice-banner button{pointer-events:auto}.notice-banner .notice-banner-close svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}.notice-banner .notice-banner-close:hover{background:#f2dfb6}.notice-banner button:disabled{cursor:wait;opacity:.65}' +
        '@media(max-width:540px){.notice-banner{width:100%;gap:6px;padding-left:8px}}@media(pointer:coarse){.notice-banner{grid-template-columns:minmax(0,1fr) 44px}.notice-banner .notice-banner-close{width:44px;height:44px}}';
      doc.head.append(style);
    }
    var box=doc.createElement('div');box.className='notice-banner';
    var body=doc.createElement('p');body.className='notice-banner-message';
    var message=doc.createElement('span');message.setAttribute('role','status');message.setAttribute('aria-atomic','true');body.append(message);
    if(options.onAction){
      var action=doc.createElement('button');action.type='button';action.className='notice-banner-action';action.textContent=options.actionLabel||'重试';action.onclick=options.onAction;body.append(action);
    }
    var close=doc.createElement('button');close.type='button';close.className='notice-banner-close';close.setAttribute('aria-label','关闭提示');
    close.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>';
    close.onclick=function(){
      var hadFocus=box.contains(doc.activeElement),host=box.parentElement;box.remove();
      if(options.onDismiss)options.onDismiss();
      if(hadFocus&&host&&host.isConnected){var target=host.querySelector('h1,h2')||host;target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}
    };
    box.append(body,close);
    Promise.resolve().then(function(){if(box.isConnected)message.textContent=options.message;});
    return box;
  }
  global.NoticeBanner={create:create};
})(window);
