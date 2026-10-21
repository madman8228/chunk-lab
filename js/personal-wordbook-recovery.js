/* Explicit, account-scoped content restoration. Never clears course data. */
(function(global){
 'use strict';
 const button=document.getElementById('btnRestorePersonalBooks'),input=document.getElementById('filePersonalBooks'),status=document.getElementById('personalBooksRestoreStatus');
 if(!button||!input||!status)return;
 let busy=false;
 const identity=()=>JSON.stringify([AccountStorage.owner,AccountStorage.databaseName,AccountStorage.sessionEpoch,ChunkAPI.getBase(),ChunkAPI.getToken()]);
 function message(text){status.textContent=text;status.hidden=!text;}
 button.addEventListener('click',()=>{if(!busy)input.click();});
 input.addEventListener('change',async()=>{
  const file=input.files?.[0];if(!file||busy)return;
  busy=true;button.disabled=true;
  try{
   AccountStorage.assertCurrent();if(!ChunkAPI.getToken())throw Error('请先登录原账号再恢复');
   const captured=identity(),check=()=>{AccountStorage.assertCurrent();if(identity()!==captured)throw Error('账号或服务已切换，恢复停止');};
   if(file.size>20000000)throw Error('文件需小于 20 MB，请使用个人单词本备份');
   const document=JSON.parse(await file.text()),archive=document.personalWordbooks||document;check();
   if(archive?.format!=='personal-wordbooks-archive')throw Error('这个文件不包含个人单词本备份；制作草稿请到制作页恢复');
   message('正在核对备份和当前账号…');
   const preview=await ChunkAPI.request('/api/personal-wordbooks/restore/preview',{method:'POST',body:JSON.stringify({archive}),timeoutMs:20000});check();
   if(preview?.eligible!==true){message(preview?.reason||'恢复条件未满足，当前内容未改变。');return;}
   if(!/^[a-f0-9]{64}$/.test(preview.fingerprint)||!Number.isSafeInteger(preview.bookCount)||!Number.isSafeInteger(preview.versionCount)||preview.bookCount<1||preview.versionCount<1)throw Error('预览结果无效，未执行恢复');
   if(!confirm('将恢复 '+preview.bookCount+' 本个人单词本、'+preview.versionCount+' 个内容版本。只恢复内容，不恢复学习成绩；原备份文件不会改变。确认继续？')){message('已取消恢复，当前内容未改变。');return;}check();
   message('正在恢复，请勿重复操作…');
   const result=await ChunkAPI.request('/api/personal-wordbooks/restore/apply',{method:'POST',body:JSON.stringify({archive,fingerprint:preview.fingerprint,confirmed:true}),timeoutMs:20000});check();
   if(result?.confirmed!==true)throw Error('恢复结果未确认，请先查看我的内容，不要清除数据或重复操作');
   message('已恢复 '+result.bookCount+' 本个人单词本。可在“我的内容”打开；学习记录未改动。');
   global.dispatchEvent(new Event('personal-wordbooks-restored'));
  }catch(error){message(error.status===404?'当前服务尚未启用个人单词本恢复，原备份和当前内容保留。':'恢复未完成：'+(error.message||'请重试')+'。原备份和当前内容保留。');}
  finally{busy=false;button.disabled=false;input.value='';}
 });
})(window);
