(function(){
 'use strict';const check=document.getElementById('validateServer'),publish=document.getElementById('publishDraft'),ack=document.getElementById('publishConfirmed'),status=document.getElementById('draftStatus');let review=null,generation=0,busy=false;
 const token=()=>localStorage.getItem('chunklab_admin_token')||'';
 function invalidate(){generation++;review=null;ack.checked=false;publish.disabled=true;}
 function message(text){status.textContent=text;}
 async function request(route,body,captured){
  if(!captured)throw Error('请先在管理后台完成管理员登录；草稿仍在当前页面。');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);let response;
  try{response=await fetch('/api/admin/wordbooks/'+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+captured},body:JSON.stringify(body),signal:controller.signal});}finally{clearTimeout(timer);}
  if(token()!==captured)throw Error('管理员登录状态已变化，请重新校验。');if(response.status===404)throw Error('当前服务尚未加载发布接口，需要更新后端；草稿保留。');const result=await response.json();if(!response.ok)throw Error(result.error||'服务端校验失败');return result;
 }
 document.querySelector('main').addEventListener('input',event=>{if(event.target!==ack)invalidate();});
 document.querySelector('main').addEventListener('click',event=>{const button=event.target.closest('button');if(button&&button!==check&&button!==publish)invalidate();});
 window.addEventListener('storage',event=>{if(event.key===null||event.key==='chunklab_admin_token')invalidate();});
 ack.onchange=()=>{publish.disabled=busy||!review||!ack.checked;};
 check.onclick=async()=>{if(busy)return;invalidate();const ticket=generation;busy=true;check.disabled=true;message('正在检查素材与课程编号…');
  try{const candidate=await WordbookDraft.compile(WordbookWorkbench.snapshot()),captured=token(),result=await request('validate',{package:candidate},captured);if(ticket!==generation)return;
   review={candidate,result,captured};message('服务端校验通过：'+result.title+'，'+result.unitCount+' 个单元，'+result.itemCount+' 个项目。已核对试学内容后请勾选确认；继续编辑或试学需重新校验。');
  }catch(e){if(ticket===generation)message(e.name==='AbortError'?'校验超时，未发布；草稿保留。':e.message);}finally{busy=false;check.disabled=false;publish.disabled=!review||!ack.checked;}
 };
 publish.onclick=async()=>{if(busy||!review||!ack.checked)return;const selected=review,ticket=generation;
  if(!confirm('确认追加发布“'+selected.result.title+'”？共 '+selected.result.itemCount+' 个项目。不会覆盖旧课程。'))return;
  busy=true;publish.disabled=true;check.disabled=true;message('正在追加发布，请勿重复点击…');
  try{const candidate=await WordbookDraft.compile(WordbookWorkbench.snapshot());if(ticket!==generation)throw Error('草稿已修改，请重新校验');
   const result=await request('publish',{package:candidate,fingerprint:selected.result.fingerprint,confirmed:true},selected.captured);
   invalidate();message('已发布：'+result.title+'。原课程与学习记录保留。');const link=document.createElement('a');link.textContent='查看已发布单词本';link.href='wordbook-details.html?book='+encodeURIComponent(result.bookId);status.append(document.createElement('br'),link);
  }catch(e){invalidate();message('发布结果未确认：'+(e.name==='AbortError'?'请求超时':e.message)+'。请先在发现页核查，不要更改编号后重复发布；草稿保留。');}finally{busy=false;check.disabled=false;publish.disabled=true;}
 };
})();
