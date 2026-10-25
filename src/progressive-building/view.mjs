import {evaluate} from './evaluate.mjs?v=pb-20261024-4';
const data=window.ProgressiveBuildingPreview,$=id=>document.getElementById(id);
const state={step:0,results:[],exposed:false,text:'',submitted:false,locked:false};
let player=null,generation=0,advanceTimer=0;
function node(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,fn,cls){const b=node('button',text,cls);b.type='button';b.onclick=fn;return b;}
function feedback(text){$('feedback').textContent=text;}
function stop(){generation++;if(player){player.pause();player=null;}}
function play(id){stop();const turn=generation,audio=new Audio(data.audio[id]);player=audio;return audio.play().then(()=>new Promise(resolve=>{if(turn===generation)feedback('播放中');audio.onended=()=>{if(turn===generation)feedback('');resolve();};})).catch(error=>{if(turn===generation)feedback('音频无法播放，请再试一次');throw error;});}
function sentence(text,focus){const p=node('p',null,'sentence');if(!focus){p.textContent=text;return p;}const index=text.indexOf(focus);if(index<0)p.textContent=text;else p.append(document.createTextNode(text.slice(0,index)),node('mark',focus),document.createTextNode(text.slice(index+focus.length)));return p;}
function focusFirst(){requestAnimationFrame(()=>{const target=$('#task textarea')||$('#task .option')||$('#task button');target?.focus();});}
function next(){clearTimeout(advanceTimer);stop();state.step++;state.text='';state.submitted=false;state.exposed=false;state.locked=false;render();focusFirst();}
function progress(){const guided=Math.min(state.step+1,5);$('stage').textContent=state.step<5?`${guided} / 5`:'';}
function choose(correct,index){
 if(state.locked)return;
 if(!correct){feedback(index===0?'some 放在 water 前面。':index===1?'please 放在句尾。':'只替换 water。');return;}
 state.locked=true;const s=data.design.chain[index+1];render();
 feedback('');play(s.id).then(next).catch(()=>{advanceTimer=setTimeout(next,900);});
}
function growthList(count){
 const list=node('ol',null,'sentence-growth');
 data.design.chain.slice(0,count).forEach(item=>{const entry=node('li');entry.append(sentence(item.text,''),node('p',item.zh,'meaning'));list.append(entry);});
 return list;
}
function render(){
 clearTimeout(advanceTimer);$('task').replaceChildren();$('controls').replaceChildren();feedback('');progress();$('title').tabIndex=-1;
 if(state.step<3){
  const index=state.step,s=data.design.chain[index+1],prior=data.design.chain[index];
  const prompts=['从“我需要水”开始','让表达更礼貌','换一个需要的东西'];
  const scenarios=['在饮水处，有人问你需要什么。','对方正在帮你取水，你想礼貌地表达。','现在你需要的是食物。'];
  const promptsForStep=['现在你需要一些水。下面哪句话表达正确？','想礼貌地表达这句话，下面哪种说法自然？','请用刚才学会的表达，说出你现在的需要。'];
  $('title').textContent=prompts[index];
  $('task').append(growthList(state.locked?index+2:index+1));
  if(!state.locked){
   $('task').prepend(node('p',scenarios[index],'scenario'));
   if(index===0)$('task').append(button('听原句',()=>play(prior.id),'listen'));
   $('task').append(node('p',promptsForStep[index],'question'));
   const options=node('div',null,'options');
   const choices=index===0?[['I need some water.',true],['I need water some.',false]]:index===1?[['I need some water, please.',true],['I need please some water.',false]]:[['I need some food, please.',true],['I need some water, please.',false]];
   choices.forEach(([label,correct,i=index])=>options.append(button(label,()=>choose(correct,i),'option')));
   $('task').append(options);$('controls').append(node('span','按 1 或 2 选择 · 鼠标也可点','tip'));
  }
 }else if(state.step===3||state.step===4){
  const index=state.step-3,t=data.design.transferTasks[index];
  $('title').textContent=index===0?'换个情境，自己说':'再试一次';
  $('task').append(node('p',t.scenario,'scenario'));
  if(index===0)$('task').append(node('div','tea · 茶','word'),button('听 tea',()=>play('word-tea'),'listen'));
  const label=node('label','写下你会说的话');const input=node('textarea');input.rows=2;input.maxLength=500;input.autocomplete='off';input.spellcheck=false;input.setAttribute('aria-label','输入英文表达');input.value=state.text;input.disabled=state.submitted;input.oninput=()=>{state.text=input.value;};input.onkeydown=e=>{if(e.ctrlKey&&e.key==='Enter')submit();};label.append(input);$('task').append(label);
  function submit(){if(state.submitted)return;const result=evaluate(state.text,t.targetObject);if(result.kind==='empty'){feedback(result.message);input.focus();return;}save(result);}
  function save(result){state.results.push({taskId:t.id,text:state.text,...result,exposed:state.exposed,independent:result.kind==='taught'&&!state.exposed});state.submitted=true;render();feedback(result.message);}
  if(!state.submitted){$('controls').append(button('提交 · Ctrl+Enter',submit,'primary'),button('给我提示',()=>{state.exposed=true;feedback('沿用 I need…，替换成你需要的东西。');}));}
  else{
   const ref=node('div',null,'reference');ref.append(node('span','参考'),sentence(t.candidateAnswers[0],''),button('听参考',()=>play(index===0?'transfer-tea':'transfer-food'),'listen'));$('task').append(ref);
   $('controls').append(button(index===0?'下一个情境':'看结果',next,'primary'));
  }
 }else{
  $('title').textContent='本次练习';
  const list=node('ul',null,'results');state.results.forEach((r,i)=>{const labels={taught:r.independent?'独立表达':'有提示','alternative':'其他合理说法','review':'待核对','self-report':'口头练习未验证','skipped':'参考后练习'};list.append(node('li',`${i+1} · ${labels[r.kind]}`));});
  $('task').append(list,node('p','练习完成；是否掌握需要过段时间换情境再试。','hint'));
  $('controls').append(button('重新练习',()=>location.reload(),'primary'));
 }
}
window.addEventListener('keydown',e=>{
 if(state.step<3&&!state.locked&&['1','2'].includes(e.key)&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();document.querySelectorAll('#task .option')[Number(e.key)-1]?.click();}
});
window.addEventListener('pagehide',()=>{clearTimeout(advanceTimer);stop();});render();
