(function(global){
  'use strict';
  var status=document.getElementById('workspaceEntryStatus'),retry=document.getElementById('workspaceEntryRetry'),generation=0;
  if(!status||!global.ChunkAPI)return;
  async function enter(){var ticket=++generation,base=ChunkAPI.getBase(),token=ChunkAPI.getToken();retry.hidden=true;
    if(!token){status.textContent='选择内容和练习方式，建立自己的学习进度。';return;}
    status.textContent='正在确认账号…';
    try{var data=await ChunkAPI.request('/api/auth/me',{timeoutMs:10000});if(ticket!==generation||base!==ChunkAPI.getBase()||token!==ChunkAPI.getToken())return;
      if(data.user)location.replace('main.html?view=home');else status.textContent='请重新登录，或开始学习。';
    }catch(error){if(ticket!==generation||base!==ChunkAPI.getBase()||token!==ChunkAPI.getToken())return;
      if(error.code==='NOT_AUTH'||error.status===401)status.textContent='登录已失效，请重新登录；原有学习记录保留。';
      else{status.textContent='暂时无法连接，请重试。原有学习记录保留。';retry.hidden=false;}}
  }
  retry.onclick=enter;global.WorkspaceEntry={enter:enter};
  global.addEventListener('storage',enter);enter();
})(window);
