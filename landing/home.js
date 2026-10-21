const heroCards = [...document.querySelectorAll('#hand .card')];
const heroStages = {
  J:{name:'Jack',title:'入门 · 敢开口',description:'从简单句开始',level:'A1–A2',label:'查看入门词卡'},
  Q:{name:'Queen',title:'进阶 · 聊日常',description:'表达生活中的想法',level:'B1',label:'查看进阶词卡'},
  K:{name:'King',title:'流利 · 说观点',description:'连贯表达自己的观点',level:'B2',label:'查看流利词卡'},
  A:{name:'Ace',title:'精通 · 更地道',description:'准确理解，灵活表达',level:'C1–C2',label:'查看精通词卡'}
};
heroCards.forEach(c=>{
  const rank=c.dataset.rank, stage=heroStages[rank], front=c.querySelector('.front'), back=c.querySelector('.back');
  c.setAttribute('role','group'); c.removeAttribute('tabindex'); c.setAttribute('aria-label',rank+' · '+stage.name+' · '+stage.title);
  front.setAttribute('role','button'); front.tabIndex=0; front.setAttribute('aria-label','翻开 '+rank+' 牌，了解'+stage.title);
  back.innerHTML='<span class="stage-name">'+stage.name+' · '+stage.level+'</span><strong class="stage-title">'+stage.title+'</strong><span class="stage-description">'+stage.description+'</span><a class="stage-link" href="vocabulary.html?level='+rank+'">'+stage.label+'</a><button class="stage-close" type="button" aria-label="翻回 '+rank+' 牌">翻回牌面</button>';
  back.inert=true; back.setAttribute('aria-hidden','true');
  function flip(open){
    c.classList.toggle('flipped',open); front.inert=open; back.inert=!open;
    front.setAttribute('aria-hidden',String(open)); back.setAttribute('aria-hidden',String(!open));
    if(open){heroCards.forEach(other=>other.classList.toggle('hot',other===c));back.querySelector('a').focus({preventScroll:true});}
    else front.focus({preventScroll:true});
  }
  front.addEventListener('click',()=>flip(true));
  front.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();flip(true);}});
  back.querySelector('button').addEventListener('click',()=>flip(false));
  c.addEventListener('keydown',e=>{if(e.key==='Escape'&&c.classList.contains('flipped')){e.preventDefault();flip(false);}});

});
