const $=id=>document.getElementById(id);
let lessons=[],lesson,index=0,heard=false,firstAnswers=[],utterance;
function feedback(text){$('feedback').textContent=text;}
function show(){
 const step=lesson.steps[index];heard=false;
 $('position').textContent=`${lesson.id} · 第 ${index+1} / ${lesson.steps.length} 步`;
 $('title').textContent=lesson.title;$('goal').textContent=lesson.goal;$('prompt').textContent=step.prompt;
 $('english').textContent=step.kind==='intro'?step.english:'';
 $('explanation').textContent=step.kind==='intro'?step.explanation:'';
 $('play').hidden=!step.english;$('play').disabled=false;$('choices').replaceChildren();
 $('writing').hidden=step.kind!=='output';$('answer').value='';feedback('');
 $('next').disabled=step.kind!=='intro';$('next').hidden=false;
 (step.options||[]).forEach((text,i)=>{const b=document.createElement('button');b.textContent=text;b.type='button';b.onclick=()=>{
  if(step.kind==='listen'&&!heard){feedback('请先完整听一遍声音。');return;}
  if(firstAnswers[index]===undefined)firstAnswers[index]=i===step.answer;
  if(i!==step.answer){feedback('再想一想当前情境需要什么；可以重新听。');return;}
  feedback('对了。');$('next').disabled=false;
 };$('choices').append(b);});
}
$('play').onclick=()=>{
 if(utterance)utterance.pause();utterance=new Audio(`assets/expression-draft-${lesson.id}-${index}.wav`);
 const at=index,active=lesson;$('play').disabled=true;
 utterance.onended=()=>{if(at!==index||active!==lesson)return;heard=true;$('play').disabled=false;feedback('已听完，可以作答。');};
 utterance.onerror=()=>{$('play').disabled=false;feedback('播放失败，本步未记为已听。');};utterance.play().catch(()=>{$('play').disabled=false;feedback('播放未开始，请再次点击。');});
};
const normalize=s=>s.toLowerCase().trim().replace(/[.!?。！？]+$/,'').replace(/\s+/g,' ');
$('check').onclick=()=>{const step=lesson.steps[index];if(!$('answer').value.trim()){feedback('请先尝试输入表达。');return;}const match=step.answers.some(a=>normalize(a)===normalize($('answer').value));feedback((match?'表达匹配。':'暂未匹配参考表达；这不一定表示英语错误。')+' '+step.explanation);$('next').disabled=false;};
$('next').onclick=()=>{speechSynthesis?.cancel();if(index+1<lesson.steps.length){index++;show();return;}$('prompt').textContent='本节体验完成';$('english').textContent='';$('explanation').textContent='这只表示完成本次内容体验，不代表口语达标或长期掌握。可切换上方课程重新体验。';$('play').hidden=true;$('choices').replaceChildren();$('writing').hidden=true;$('next').hidden=true;const rows=firstAnswers.filter(v=>v!==undefined);feedback(rows.length?`客观题首次正确 ${rows.filter(Boolean).length} / ${rows.length}；文本表达和跟说不计入口语评分。`:'');};
try{const response=await fetch('assets/expression-unit01-draft-lessons.json');if(!response.ok)throw Error('课程草稿读取失败');lessons=(await response.json()).lessons;lessons.forEach(row=>{const b=document.createElement('button');b.textContent=row.title;b.onclick=()=>{if(utterance)utterance.pause();lesson=row;index=0;firstAnswers=[];show();};$('lessons').append(b);});lesson=lessons[0];show();}catch(error){feedback(error.message);$('next').disabled=true;}
