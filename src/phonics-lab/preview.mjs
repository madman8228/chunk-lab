import {letters,phases,teachingWord,transferWord,matches,makeSession} from './model.mjs';
const $=id=>document.getElementById(id),state=makeSession();
let player=null;
function node(tag,text,className){const e=document.createElement(tag);if(text)e.textContent=text;if(className)e.className=className;return e;}
function button(text,handler,className){const e=node('button',text,className);e.type='button';e.onclick=handler;return e;}
function feedback(text){$('feedback').textContent=text;}
function stop(){if(player){player.pause();player=null;}}
function render(){
 stop();$('steps').replaceChildren();phases.forEach((label,index)=>{const b=button(label,()=>go(index));if(index===state.phase)b.setAttribute('aria-current','step');$('steps').append(b);});
 $('position').textContent=`第 ${state.phase+1} / ${phases.length} 环节`;
 $('activity').replaceChildren();feedback('');$('back').disabled=state.phase===0;$('next').textContent=state.phase===5?'查看本次结果':'下一步';
 const titles=['先听清声音，再看字母','同一个字母：名称不等于声音','把三个声音连起来','按刚才的顺序，自己拼一次','一个词里有几个声音？','不看示范，试一个新词'];
 const instructions=['这一环节需要四条独立音示范。素材就绪后，再进行听辨。','点一个字母，看看怎样发它的目标声音。','先看分步顺序，再听完整单词 mat（垫子）。','本步暂时只练字母顺序：拼出 mat。','听完整单词 mat，再把你认为的声音顺序放进三个格子。','新词只用刚才的四个音形对应。先自己试读，再核对。'];
 $('stepTitle').textContent=titles[state.phase];$('instruction').textContent=instructions[state.phase];
 if(state.phase===0){
  const note=node('p','独立音示范尚未就绪，本环节暂不能试听或检查。可继续预览后面的操作形式。','sound-note');$('activity').append(note);
  const row=node('div',null,'letters');letters.forEach(l=>{const b=button(l,()=>{},'letter');b.disabled=true;b.setAttribute('aria-label',`${l} 的声音示范待制作`);row.append(b);});$('activity').append(row);
 }else if(state.phase===1){
  const notes={m:'双唇轻合，让声音从鼻腔出来。不要额外加“么”。',s:'上下齿靠近，气流从中间通过，不要额外加元音。',a:'本课只学习短元音 /æ/，不是字母名称 A；声音和口型示范待补。',t:'舌尖在上齿后方接触后放开，不要额外加“特”的元音。'};
  const row=node('div',null,'letters');letters.forEach(l=>row.append(button(l,()=>feedback(notes[l]+' 单音录音待补。'),'letter')));$('activity').append(row,node('p','字母名称用于拼写；这里要学习的是字母在词里的声音。文字提示不能替代试听。','sound-note'));
 }else if(state.phase===2){
  const row=node('div',null,'letters');[...teachingWord].forEach((l,i)=>{const b=button(l,()=>{state.blendIndex=i;render();},'letter'+(state.blendIndex===i?' is-active':''));b.setAttribute('aria-label',`第${i+1}个音对应字母 ${l}`);row.append(b);});
  $('activity').append(row,node('p',state.blendIndex<0?'m → a → t':`当前观察第 ${state.blendIndex+1} 个字母：${teachingWord[state.blendIndex]}`,'word'));
  const actions=node('div',null,'actions');actions.append(button('看下一个字母',()=>{state.blendIndex=(state.blendIndex+1)%3;render();}),button('听完整词 mat',()=>playMat()));$('activity').append(actions,node('p','这是视觉分步演示，不是逐音录音。连续声音拼合示范待补。','sound-note'));
 }else if(state.phase===3||state.phase===4){
  const slots=node('div',null,'slots');for(let i=0;i<3;i++){const slot=node('div',null,'slot');if(state.selected[i])slot.append(button(state.selected[i],()=>{state.selected.splice(i,1);render();}));else slot.textContent='·';slots.append(slot);}$('activity').append(slots);
  const pool=node('div',null,'letters');[...letters].reverse().forEach(l=>{const b=button(l,()=>{if(state.selected.length<3){state.selected.push(l);render();}},'letter');b.disabled=state.selected.length>=3;pool.append(b);});$('activity').append(pool);
  const actions=node('div',null,'actions');if(state.phase===4)actions.append(button('听完整单词',()=>playMat()));actions.append(button('重新排',()=>{state.selected=[];render();}),button('检查顺序',()=>{
   if(state.selected.length!==3){feedback('先把三个位置填满。');return;}
   const correct=matches(state.selected,teachingWord);state.results[state.phase]={correct,ability:'letter-order-only'};
   feedback(correct?'字母顺序正确。这个结果不表示已会发音。':state.phase===4?'再听一遍：先留意开头，再想中间和末尾。':'再想想示范中的顺序，点击格子可以撤回。');
  },'primary'));$('activity').append(actions);
 }else{
  $('activity').append(node('p',transferWord,'word'),node('p','先尝试开口。这里不录音、不打发音分，也不显示音标答案。','sound-note'));
  const actions=node('div',null,'actions');actions.append(button('我已试读',()=>{state.attempted=true;state.results.transfer={selfReported:true,verified:false,modelExposed:state.transferRevealed};render();feedback('已记录本页尝试。现在可以听整词核对，但不能自动验证读音。');}),button('暂时不会',()=>{state.attempted=true;state.results.transfer={selfReported:false,verified:false,modelExposed:state.transferRevealed};render();feedback('可以先听范音，再回到“看拼合”练习；不算答错。');}));$('activity').append(actions);
  const listen=button('听整词核对（试听候选）',()=>{state.transferRevealed=true;state.results.transfer.modelExposed=true;playWord('sat');});listen.disabled=!state.attempted;$('activity').append(listen);
  $('activity').append(node('p',state.attempted?'录音仅供自行比较，未经过本轮试听确认。':'先选择“我已试读”或“暂时不会”，再听核对音。','sound-note'));
 }
}
async function playMat(){
 return playWord('mat');
}
async function playWord(word){
 stop();const activePlayer=new Audio(window.PhonicsPreviewMedia[word]);player=activePlayer;
 try{await activePlayer.play();if(player===activePlayer)feedback('正在播放完整单词，不是单独音素。');}catch{if(player===activePlayer)feedback('音频未能播放，请再次点击。');}
}
function go(index){state.phase=index;state.selected=[];state.blendIndex=-1;render();}
$('back').onclick=()=>go(state.phase-1);
$('next').onclick=()=>{if(state.phase<5)go(state.phase+1);else{
 const order=state.results[3]?.correct?'已完成':'未完成';const splitting=state.results[4]?.correct?'已完成':'未完成';
 feedback(`本次：字母顺序练习${order}；听词排列${splitting}；${state.results.transfer?.selfReported?'已尝试试读':'未自报试读'}。以上不代表读音已验证；单音和连续拼合仍待示范。`);
}};
window.addEventListener('pagehide',stop);render();
