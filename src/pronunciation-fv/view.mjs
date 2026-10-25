import {words,makeTrials,recordFirst} from './model.mjs';
const $=id=>document.getElementById(id);
const state={screen:'intro',pair:0,index:0,results:{},trials:[makeTrials(['fan','van'],'jenny'),makeTrials(['fine','vine'],'guy')],heard:false,answered:false};
let audio=null,version=0;
function el(tag,text,cls){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;}
function btn(label,action,cls){const b=el('button',label,cls);b.type='button';b.onclick=action;return b;}
function status(text){$('status').textContent=text;}
function stop(){version++;if(audio){audio.pause();audio=null;}}
async function play(id,onComplete){
 stop();const current=version;const source=window.FvLessonMedia[id];
 if(!source){status('这条录音没有载入，请刷新后重试。');return;}
 const active=new Audio(source);audio=active;
 active.onended=()=>{if(version===current){status('播放完毕。');onComplete?.();}};
 active.onerror=()=>{if(version===current)status('播放失败，请重播；本题不会自动跳过或记错。');};
 status('正在播放…');
 try{await active.play();}catch{if(version===current)status('播放未成功，请再次点击播放。');}
}
function sample(word,speaker='jenny'){
 const b=btn('',()=>play(`${word}-${speaker}`),'sample');b.append(el('strong',word),el('span',words[word].meaning),el('span',`听范音 · /${words[word].sound}/ 开头`));return b;
}
function render(){
 stop();$('task').replaceChildren();$('actions').replaceChildren();status('');
 const pair=state.pair===0?['fan','van']:['fine','vine'];
 if(state.screen==='intro'){
  $('stage').textContent='先听差别';$('taskTitle').textContent='上齿轻触下唇，让气流通过';
  $('task').append(el('p','先轻发 /f/，再试 /v/。手指轻放喉部：/v/ 要带声，通常能感觉到振动；不要咬住嘴唇。','mouth'),el('p','听下面两个词，注意开头，而不是字母的名称。'));
  const row=el('div',null,'pair');pair.forEach(w=>row.append(sample(w)));$('task').append(row,el('p','不要在词尾额外加“呃”；不用模仿中文“夫”“乌”。','note'));
  const next=btn('开始听辨',()=>{state.screen='quiz';state.index=0;render();},'primary');$('actions').append(next);
 }else if(state.screen==='second'){
  $('stage').textContent='换两个例词，再换一种声音';$('taskTitle').textContent='词变了，开头的区别不变';
  const row=el('div',null,'pair');pair.forEach(w=>row.append(sample(w)));$('task').append(el('p','fine：好的；vine：藤蔓。先听熟这两个词，下一组会换一位合成说话者。'),row);
  $('actions').append(btn('开始第二组',()=>{state.screen='quiz';state.index=0;render();},'primary'));
 }else if(state.screen==='quiz'){
  const trial=state.trials[state.pair][state.index],key=`${state.pair}:${state.index}`;
  state.heard=false;state.answered=false;
  $('stage').textContent=`第 ${state.pair+1} 组 · ${state.index+1} / 4 题`;$('taskTitle').textContent='你听到的是哪个词？';
  const playButton=btn('播放录音',()=>play(`${trial.word}-${trial.speaker}`,()=>{state.heard=true;choices.querySelectorAll('button').forEach(b=>b.disabled=state.answered);status('现在选择听到的词。');}),'primary play');
  const choices=el('div',null,'pair');
  trial.options.forEach(word=>{const b=btn('',()=>{
   if(!state.heard||state.answered)return;
   state.answered=true;recordFirst(state.results,key,trial.word,word);const r={correct:word===trial.word};
   choices.querySelectorAll('button').forEach(b=>b.disabled=true);
   status(r.correct?`这次听对了：${trial.word}。`:`这次录音是 ${trial.word}。对比听两个词的开头，再继续。`);
   const comparisons=el('div',null,'replay');pair.forEach(w=>comparisons.append(btn(`对比听 ${w}`,()=>play(`${w}-${trial.speaker}`))));$('task').append(comparisons);next.disabled=false;
  },'choice');b.append(el('strong',word),el('span',words[word].meaning));b.disabled=true;choices.append(b);});
  const next=btn(state.index===3?'本组完成':'下一题',()=>{if(!state.answered)return;if(state.index<3)state.index++;else if(state.pair===0){state.pair=1;state.screen='second';}else state.screen='speak';render();},'primary');next.disabled=true;
  $('task').append(playButton,choices);status('先完整听一遍，再选择。');$('actions').append(btn('回看发音提示',()=>{state.screen=state.pair===0?'intro':'second';render();}),next);
 }else if(state.screen==='speak'){
  $('stage').textContent='试着开口';$('taskTitle').textContent='先说，再听范音比较';
  $('task').append(el('p','对着这两个词各说一次。留意下唇与上齿、气流，以及 /v/ 的带声。'),el('p','fan — van','word'));
  const model=el('div',null,'pair');model.append(sample('fan'),sample('van'));model.hidden=true;
  $('task').append(btn('我试过了，听范音',()=>{model.hidden=false;state.spoke=true;status('可以对比重听。这里不录音、不判断发音是否正确。');}),model);
  $('actions').append(btn('暂时跳过',()=>{state.screen='summary';render();}),btn('查看本次结果',()=>{state.screen='summary';render();},'primary'));
 }else{
  $('stage').textContent='本次练习';$('taskTitle').textContent='听辨结果与开口尝试分开记录';
  const list=el('ul',null,'results');for(let p=0;p<2;p++){const rows=Object.entries(state.results).filter(([k])=>k.startsWith(p+':')).map(([,v])=>v);list.append(el('li',`${p===0?'fan / van':'fine / vine'}：首次听辨 ${rows.filter(r=>r.correct).length} / ${rows.length}。`));}
  list.append(el('li',state.spoke?'开口：已自报尝试，未验证发音。':'开口：未自报尝试。'));
  $('task').append(list,el('p','这只是本次词音材料的听辨结果，不是发音水平或掌握证明。','note'));
  $('actions').append(btn('重新练习',()=>location.reload(),'primary'));
 }
}
window.addEventListener('pagehide',stop);render();
