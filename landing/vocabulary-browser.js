/* DECK / RANKS / 存储层 / ITEM_INDEX 均由 landing/store.js 提供 */

function pool(rank){
  const all = DECK[rank].words;
  const query = document.getElementById('vocabularySearch').value.trim().toLowerCase();
  return all.filter(d => (typeFilter === 'all' || d.t === typeFilter) && (!query || [d.w,d.cn,d.col].some(value=>String(value||'').toLowerCase().includes(query))));
}
const requestedLevel = new URLSearchParams(location.search).get('level');
let cur = RANKS.includes(requestedLevel) ? requestedLevel : 'J', shown = {};

function masteredCount(){ return pool(cur).filter(d => stateOf(d.t, d.w) >= 1).length; }
function updateNote(){
  // 张数按实际渲染数算：某段某类型可能不足 6 条，写死会撒谎
  const n = Math.min(6, pool(cur).length);
  noteEl.textContent = DECK[cur].name + ' 段 · ' + DECK[cur].cefr + ' · 当前 ' + n + ' 张 · 已熟 ' + masteredCount();
}

const tabsEl = document.getElementById('vocabularyLevel');
const ftabsEl = document.getElementById('ftabs');
const cardsEl = document.getElementById('cards');
const noteEl = document.getElementById('deckNote');

const SPK = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 010 7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>';
const FLIPIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 4v16h16"/></svg>';

function pick(rank, seed){
  const list = pool(rank).slice();
  if(seed){ for(let i=list.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [list[i],list[j]]=[list[j],list[i]]; } }
  return list.slice(0,6);
}

function renderTabs(){
  tabsEl.replaceChildren(...RANKS.map(rank=>{const option=document.createElement('option');option.value=rank;option.textContent=DECK[rank].cefr;return option;}));
  tabsEl.value=cur;
}

/* 类型筛选条：只有数据里真实存在的类型才生成按钮。
   只有一种内容时整行不渲染 —— 一排「全部 / 单词」没有意义，也是空占位。 */
function renderTypeTabs(){
  const types = availableTypes();
  if(types.length < 2){ ftabsEl.innerHTML = ''; return; }
  const opts = [['all','全部']].concat(types.map(t => [t, TYPE_NAME[t]]));
  ftabsEl.innerHTML = opts.map(o =>
    '<button class="ftab" data-t="'+o[0]+'" aria-pressed="'+(typeFilter===o[0])+'">'+o[1]+'</button>'
  ).join('');
}

function renderCards(){
  const words = pick(cur, shown[cur]||0);
  if(!words.length){
    cardsEl.innerHTML = '<p class="empty-hint">这一段暂无该类内容</p>';
    updateNote();
    return;
  }
  cardsEl.innerHTML = words.map(d=>
    '<article class="fc" tabindex="0" role="button" aria-label="词条 '+d.w+'，点击翻面">'
    + '<div class="fc-in">'
    +   '<div class="fc-f fc-front">'
    +     '<div class="tags">'
    +       '<span class="lv" style="background:'+DECK[cur].color+'">'+d.lv+'</span>'
    +       '<button class="master'+(stateOf(d.t,d.w)>=1?' on':'')+'" data-t="'+d.t+'" data-w="'+d.w+'" aria-label="标熟 '+d.w+'">'+(stateOf(d.t,d.w)>=1?'已熟':'标熟')+'</button>'
    +     '</div>'
    +     '<div><div class="w'+(d.t==='phrase'?' is-phrase':'')+'">'+d.w+'</div>'+(d.ph?'<div class="ph">'+d.ph+'</div>':'')+'</div>'
    +     '<div class="hint">'+FLIPIC+' 点击翻面看释义</div>'
    +   '</div>'
    +   '<div class="fc-f fc-back">'
    +     '<div class="meta">'+(d.pos || TYPE_NAME[d.t] || '')+'</div>'
    +     '<div class="cn">'+d.cn+'</div>'
    +     (d.col ? '<div class="col">'+d.col+'</div>' : '')
    +     '<div class="eg">'+d.eg+'</div>'
    +     '<div class="eg-zh">'+d.zh+'</div>'
    +     (d.tip ? '<div class="tip">'+d.tip+'</div>' : '')
    +     '<button class="spk" data-w="'+d.w+'">'+SPK+' 朗读</button>'
    +   '</div>'
    + '</div></article>').join('');
  updateNote();
}

cardsEl.addEventListener('click', e=>{
  const spk = e.target.closest('.spk');
  if(spk){ e.stopPropagation(); speak(spk.dataset.w); return; }
  const mb = e.target.closest('.master');
  if(mb){
    e.stopPropagation();
    const w = mb.dataset.w, t = mb.dataset.t;
    const next = stateOf(t, w) >= 1 ? 0 : 1;   // 目前 UI 是熟悉/未熟悉二态；存储已支持 s=2 掌握态
    setState(t, w, next);
    const on = stateOf(t, w) >= 1;
    mb.classList.toggle('on', on);
    mb.textContent = on ? '已熟' : '标熟';
    updateNote();
    return;
  }
  const fc = e.target.closest('.fc');
  if(fc) fc.classList.toggle('flip');
});
cardsEl.addEventListener('keydown', e=>{
  if(e.key!=='Enter' && e.key!==' ') return;
  const fc = e.target.closest('.fc');
  if(fc && e.target === fc){ e.preventDefault(); fc.classList.toggle('flip'); }
});
tabsEl.addEventListener('change', ()=>{
  cur=tabsEl.value;renderCards();
  const url=new URL(location.href);url.searchParams.set('level',cur);history.replaceState(null,'',url);
});
document.getElementById('vocabularySearch').addEventListener('input',()=>renderCards());
ftabsEl.addEventListener('click', e=>{
  const b = e.target.closest('.ftab');
  if(!b) return;
  typeFilter = b.dataset.t; renderTypeTabs(); renderCards();
});

function speak(text){
  if(!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang='en-US'; u.rate=.85;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}

document.getElementById('btnShuffle').addEventListener('click', ()=>{
  shown[cur] = (shown[cur]||0) + 13; renderCards();
});
document.getElementById('btnFlipAll').addEventListener('click', ()=>{
  const list = [...cardsEl.querySelectorAll('.fc')];
  const anyClosed = list.some(c=>!c.classList.contains('flip'));
  list.forEach(c=>c.classList.toggle('flip', anyClosed));
});


renderTabs(); renderTypeTabs(); renderCards();
