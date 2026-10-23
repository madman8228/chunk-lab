(function(){
  'use strict';
  if(window.PersonalCenterDialogs)return;
  var active=null,parent=null,opener=null,childOpener=null;
  var titles={settingsMask:'个人中心',chunkIntroMask:'意群是什么',feedbackMask:'反馈问题'};
  var drawer=document.getElementById('settingsMask');
  var viewTitles={home:'个人中心',settings:'学习设置',membership:'会员与体验',backup:'备份与恢复',cache:'图片缓存'};
  var menu=document.getElementById('personalCenterMenu');
  var profile=document.getElementById('personalCenterProfile');
  var back=document.getElementById('personalCenterBack');
  profile.querySelector('.pc-profile-account').appendChild(document.getElementById('accountSection'));
  document.getElementById('personalCenterMembership').appendChild(document.getElementById('membershipPanel'));
  document.getElementById('personalCenterBackup').appendChild(document.getElementById('settingsBackupSection'));
  document.getElementById('personalCenterCache').appendChild(document.getElementById('settingsImageCacheSection'));
  document.getElementById('personalCenterSignOut').appendChild(document.getElementById('btnAccountLogout'));
  function showView(view,moveFocus){
    if(!Object.prototype.hasOwnProperty.call(viewTitles,view))return;
    var previousView=drawer.dataset.pcView;
    drawer.dataset.pcView=view;
    document.getElementById('personalCenterTitle').textContent=viewTitles[view];
    profile.hidden=menu.hidden=document.getElementById('personalCenterSignOut').hidden=view!=='home';
    back.hidden=view==='home';
    var settings=document.getElementById('settingsAppearanceGroup');
    settings.hidden=view!=='settings';settings.open=true;
    drawer.querySelector('.modal-foot').hidden=view!=='settings';
    drawer.querySelectorAll('[data-pc-pane]').forEach(function(pane){pane.hidden=pane.dataset.pcPane!==view;});
    if(view==='backup'){
      document.getElementById('backupBody').classList.remove('hidden');
      document.getElementById('backupHead').setAttribute('aria-expanded','true');
    }
    drawer.querySelector('.modal-body').scrollTop=0;
    if(moveFocus!==false)focus(view==='home'?(menu.querySelector('[data-pc-view="'+previousView+'"]')||menu.querySelector('button')):back);
  }
  back.onclick=function(){showView('home');};
  profile.querySelector('[data-pc-upgrade]').onclick=function(){showView('membership');};
  menu.addEventListener('click',function(event){
    var entry=event.target.closest('[data-pc-view],[data-pc-feedback]');
    if(!entry)return;
    if(entry.hasAttribute('data-pc-feedback'))document.getElementById('btnFeedback').click();
    else showView(entry.dataset.pcView);
  });
  showView('home',false);
  function controls(mask){
    return Array.from(mask.querySelectorAll('button,input,select,textarea,a[href],summary,[tabindex]')).filter(function(node){
      return !node.disabled && node.tabIndex>=0 && node.getClientRects().length;
    });
  }
  function focus(node){if(node && node.isConnected && node.getClientRects().length)node.focus();}
  function initial(mask){focus(mask.id==='feedbackMask'?mask.querySelector('textarea'):controls(mask)[0]);}
  function current(){return active && !active.hidden ? active : null;}
  function open(id){
    var mask=document.getElementById(id);
    if(active===mask && !mask.hidden)return;
    if(id==='settingsMask')showView('home',false);
    var previous=current();
    if(previous && previous.id==='settingsMask' && id!=='settingsMask'){
      parent=previous;childOpener=document.activeElement;previous.hidden=true;
    }else{
      parent=null;opener=document.activeElement;
      if(previous)previous.hidden=true;
    }
    active=mask;mask.hidden=false;initial(mask);
  }
  function close(){
    var mask=current();if(!mask)return false;
    mask.hidden=true;
    if(window.hideSetHint)window.hideSetHint();
    if(parent){active=parent;parent=null;active.hidden=false;focus(childOpener);childOpener=null;}
    else{active=null;focus(opener);opener=null;}
    return true;
  }
  Object.keys(titles).forEach(function(id){
    var modal=document.querySelector('#'+id+' .modal');
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label',titles[id]);
  });
  document.addEventListener('keydown',function(event){
    var mask=current();if(!mask)return;
    event.stopImmediatePropagation();
    if(event.key!=='Tab' && event.key!=='Escape')return;
    if(event.key==='Escape'){event.preventDefault();close();return;}
    var nodes=controls(mask),index=nodes.indexOf(document.activeElement);
    if(!nodes.length){event.preventDefault();return;}
    if(index<0 || (event.shiftKey?index===0:index===nodes.length-1)){
      event.preventDefault();focus(nodes[event.shiftKey?nodes.length-1:0]);
    }
  },true);
  window.PersonalCenterDialogs={open:open,close:close,showView:showView};
})();
