import {createExpressionState,publicExpressionState,transitionExpression} from '../src/expression-course/runtime.mjs';
import {renderActivity} from '../src/expression-course/ui/renderers.mjs';
const $=id=>document.getElementById(id);
const response=await fetch('assets/expression-unit01-formal-review.json');
if(!response.ok)throw Error('审核课程读取失败');
const pkg=await response.json();let lesson,state,audio;
const key=()=>`expression-unit01-review-v1:${lesson.lessonId}`;
function act(action){const update=transitionExpression(state,action);state=update.state;try{localStorage.setItem(key(),JSON.stringify(state));}catch(_){$('status').textContent='预览进度未保存';}render(update.result.feedback||update.result.answer||update.result.hint||'');}
function play(assetId,button){const asset=pkg.assets.find(a=>a.assetId===assetId);if(!asset)return;$('status').textContent='正在播放…';audio?.pause();audio=new Audio('assets/'+asset.localFile);button.disabled=true;audio.onended=()=>{button.disabled=false;$('status').textContent='播放完成';};audio.onerror=()=>{button.disabled=false;$('status').textContent='音频播放失败';};audio.play().catch(()=>{button.disabled=false;$('status').textContent='未能开始播放，请重试';});}
function render(message=''){
 const view=publicExpressionState(state);$('lessonTitle').textContent=lesson.title;$('position').textContent=`${Math.min(view.index+1,lesson.activities.length)} / ${lesson.activities.length}`;$('activityActions').replaceChildren();$('status').textContent=message;
 if(view.completed){$('activityBody').textContent='本节已完成。这里的完成不代表口语达标；正式服务端进度及复习需发布后单独验收。';return;}
 const ui=renderActivity($('activityBody'),view.activity,{onAction:act,playAudio:play});
 if(ui.informational&&view.activity.payload.audioAssetId){const listen=document.createElement('button');listen.textContent='播放示范';listen.onclick=()=>play(view.activity.payload.audioAssetId,listen);$('activityActions').append(listen);}
 const next=document.createElement('button');next.className='button button-primary';next.textContent=ui.informational?'继续':'检查答案';next.onclick=()=>act(ui.informational?{type:'continue'}:{type:'submit',response:ui.response()});$('activityActions').append(next);
}
function select(row){audio?.pause();lesson=row;let saved;try{saved=JSON.parse(localStorage.getItem(key())||'null');}catch(_){}state=createExpressionState(lesson,saved);render();}
pkg.lessons.forEach(row=>{const button=document.createElement('button');button.textContent=row.title;button.onclick=()=>select(row);$('lessonList').append(button);});select(pkg.lessons[0]);
