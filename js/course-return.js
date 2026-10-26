(function(global){
  'use strict';
  var pages=['main.html','decks.html','wordbook-details.html','stats.html','expression-learn.html'];
  function origin(){return global.location&&global.location.origin&&global.location.origin!=='null'?global.location.origin:'http://localhost';}
  function safe(value,depth){
    if(typeof value!=='string'||!value||value.length>4000)return '';
    try{
      var base=origin(),url=new URL(value,base+'/');
      if(url.origin!==base||url.username||url.password||!pages.includes(url.pathname.slice(1)))return '';
      var nested=url.searchParams.get('returnTo');
      url.searchParams.delete('returnTo');
      if(nested&&(depth||0)<2){var checked=safe(nested,(depth||0)+1);if(checked)url.searchParams.set('returnTo',checked);}
      if(url.pathname==='/decks.html'&&!url.searchParams.get('course')&&url.searchParams.get('manage')!=='1')return 'main.html?view='+(url.searchParams.get('courseView')==='joined'?'my-learning':'discover');
      return url.pathname.slice(1)+url.search;
    }catch(_){return '';}
  }
  function source(){return safe(global.location&&global.location.href)||'main.html?view=my-learning';}
  function destination(search,fallback){
    var params=new URLSearchParams(search===undefined?global.location.search:search);
    var explicit=safe(params.get('returnTo'));
    if(explicit)return explicit;
    var legacy=params.get('returnView');
    if(['home','my-learning','discover','stats'].includes(legacy))return 'main.html?view='+legacy;
    return safe(fallback)||'main.html?view=my-learning';
  }
  function forward(href,returnTo){
    var url=new URL(href,origin());
    var target=safe(returnTo||destination());
    if(target)url.searchParams.set('returnTo',target);
    return url.pathname.slice(1)+url.search;
  }
  function bookParent(bookId){return forward('wordbook-details.html?book='+encodeURIComponent(bookId),destination());}
  function label(href){
    var url=new URL(href,'http://localhost/');
    if(url.pathname==='/wordbook-details.html'||url.pathname==='/decks.html'||url.pathname==='/expression-learn.html')return '返回课程目录';
    if(url.pathname==='/stats.html'||url.searchParams.get('view')==='stats')return '返回学习记录';
    return url.searchParams.get('view')==='discover'?'返回发现':url.searchParams.get('view')==='home'?'返回首页':'返回我的内容';
  }
  function bind(element,options){
    options=options||{};var href=options.href||destination();
    element.setAttribute('href',href);element.textContent=options.label||label(href);
    element.onclick=options.beforeLeave?async function(event){
      if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();if(element.getAttribute('aria-busy')==='true')return;
      element.setAttribute('aria-busy','true');
      try{await options.beforeLeave();global.location.href=href;}
      catch(error){if(options.onError)options.onError(error);}
      finally{element.removeAttribute('aria-busy');}
    }:null;
    return element;
  }
  function create(options){
    var header=global.document.createElement('div');header.className='course-learning-header';
    var link=global.document.createElement('a');link.className='course-header-exit';header.append(bind(link,options));return header;
  }
  var api={safe:safe,source:source,destination:destination,forward:forward,bookParent:bookParent,label:label,bind:bind,create:create};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else global.CourseReturn=api;
})(typeof window!=='undefined'?window:globalThis);
