(function(){
  'use strict';
  const root=document.getElementById('homeLearning');if(!root)return;
  const artwork=root.querySelector('.home-word-art'),source=artwork.parentElement.querySelector('source');
  source.srcset=source.dataset.avif;artwork.src=artwork.dataset.webp;
  const wordFeedback=root.querySelector('[data-word-feedback]');
  root.querySelectorAll('[data-meaning]').forEach(button=>button.addEventListener('click',()=>{
    root.querySelectorAll('[data-meaning]').forEach(option=>option.setAttribute('aria-pressed',String(option===button)));
    wordFeedback.textContent=button.dataset.meaning==='borrow'?'对，borrow 是向别人借，用完归还。':'lend 是借给别人；图中女孩在向朋友借。';
  }));
  const chunks=[{en:'I decided',zh:'我决定了'},{en:'to go',zh:'去'},{en:'on a picnic.',zh:'野餐'}];
  const bank=root.querySelector('[data-chunk-bank]'),answer=root.querySelector('[data-chunk-answer]'),feedback=root.querySelector('[data-chunk-feedback]');let chosen=[];
  function render(focusTarget){
    answer.replaceChildren();
    chunks.forEach((chunk,index)=>{
      const group=document.createElement('span');group.className='home-chunk-slot';
      const slot=document.createElement('button');slot.type='button';slot.textContent=chosen[index]===undefined?'':chunks[chosen[index]].en;slot.setAttribute('aria-label',(slot.textContent||'空白')+'，'+chunk.zh+'，点击撤回此处及后续意群');
      slot.onclick=()=>{chosen=chosen.slice(0,index);feedback.textContent='';render(index);};
      const gloss=document.createElement('span');gloss.textContent=chunk.zh;group.append(slot,gloss);answer.append(group);
    });
    bank.replaceChildren();[2,0,1].forEach(index=>{
      const button=document.createElement('button');button.type='button';button.className='home-choice';button.textContent=chunks[index].en;button.disabled=chosen.includes(index);
      button.onclick=()=>{if(chosen.length>=chunks.length)return;chosen.push(index);render('bank');if(chosen.length===chunks.length)feedback.textContent=chosen.every((value,i)=>value===i)?'正确：I decided to go on a picnic.':'顺序还不对，点击已填的意群可撤回。';};bank.append(button);
    });
    if(focusTarget!==undefined){const next=focusTarget==='bank'?(bank.querySelector('button:not(:disabled)')||root.querySelector('[data-chunk-reset]')):answer.querySelectorAll('button')[focusTarget];next?.focus({preventScroll:true});}
  }
  root.querySelector('[data-chunk-reset]').onclick=()=>{chosen=[];feedback.textContent='';render();};render();
})();
