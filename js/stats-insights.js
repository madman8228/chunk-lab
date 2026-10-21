(function(global){
  'use strict';
  function model(records,events,total,now,resolve,book){
    var learned=0,mastered=0,first=new Map(),seen=new Set();
    var valid=new Set(records.map(function(r){return r.key;}));
    var answers=events.filter(function(e){if(!e||e.kind!=='answer'||!valid.has(e.key)||!Number.isFinite(e.at)||e.at>now||e.at<=0||e.id&&seen.has(e.id))return false;if(e.id)seen.add(e.id);return true;});
    records.forEach(function(r){
      if(r.stat.times>0)learned++;
      if(resolve({stat:r.stat,contentFingerprint:r.fingerprint,now:now}).verifiedMastered)mastered++;
      if(Number.isFinite(r.stat.firstAt)&&r.stat.firstAt>0&&r.stat.firstAt<=now)first.set(r.key,r.stat.firstAt);
    });
    answers.forEach(function(e){first.set(e.key,Math.min(first.get(e.key)||Infinity,e.at));});
    var week=[];
    for(var i=6;i>=0;i--){var d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-i);var end=new Date(d);end.setDate(end.getDate()+1);var fresh=new Set(),review=new Set();answers.forEach(function(e){if(e.at>=d.getTime()&&e.at<end.getTime())(first.get(e.key)>=d.getTime()?fresh:review).add(e.key);});week.push({date:(d.getMonth()+1)+'/'+d.getDate(),fresh:fresh.size,review:review.size});}
    var modes={typing:0,chunkSelection:0,other:0},rank=[];
    book.forEach(function(b){var count=0;(b.history||[]).forEach(function(e){(e.mistakes||[]).forEach(function(m){var n=Number(m.wrongAttemptCount);if(!Number.isFinite(n)||n<=0)n=(m.wrongAnswers||[]).length||1;count+=n;modes[e.mode==='typing'?'typing':e.mode==='chunkSelection'?'chunkSelection':'other']+=n;});});if(count)rank.push({text:b.en||b.sentence||b.text||'查看错题原文',count:count});});
    rank.sort(function(a,b){return b.count-a.count;});
    return {total:total,learned:learned,mastered:mastered,week:week,modes:modes,rank:rank.slice(0,5)};
  }
  function render(target,data){
    if(!data.rank.length)return;
    function el(tag,text,cls){var n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
    var ranking=el('section',null,'insight-section');ranking.append(el('h3','常错句子'));target.append(ranking);
    data.rank.forEach(function(r){var row=el('div',null,'insight-rank');row.append(el('span',r.text),el('strong',r.count+' 次'));ranking.append(row);});
  }
  var api={model:model,render:render};if(typeof module==='object'&&module.exports)module.exports=api;else global.StatsInsights=api;
})(typeof window==='object'?window:globalThis);
