(function(global){
  'use strict';
  function series(records,events,now,resolve){
    var first=new Map();
    function observe(key,at){at=Number(at);if(Number.isFinite(at)&&at>0&&at<=now)first.set(key,Math.min(first.get(key)||Infinity,at));}
    events.forEach(function(event){if(event&&event.kind==='answer')observe(event.key,event.at);});
    records.forEach(function(row){
      observe(row.key,row.stat.firstAt);
      ((row.stat.learningV1||{}).evidence||[]).forEach(function(event){observe(row.key,event.at);});
    });
    var rows=[],hasAssessment=false;
    for(var offset=29;offset>=0;offset--){
      var date=new Date(now);date.setHours(0,0,0,0);date.setDate(date.getDate()-offset);
      var end=new Date(date);end.setDate(end.getDate()+1);var cutoff=Math.min(now,end.getTime()-1),learned=0,mastered=0;
      records.forEach(function(row){
        if(first.has(row.key)&&first.get(row.key)<=cutoff)learned++;
        var evidence=((row.stat.learningV1||{}).evidence||[]).filter(function(event){return event.id&&Number.isFinite(event.at)&&event.at<=cutoff&&event.contentFingerprint===row.fingerprint;});
        if(evidence.some(function(event){return event.type==='assessment'&&['delayed','maintenance'].includes(event.stage);}))hasAssessment=true;
        if(resolve&&resolve({stat:{learningV1:{evidence:evidence}},contentFingerprint:row.fingerprint,now:cutoff}).verifiedMastered)mastered++;
      });
      rows.push({at:date.getTime(),learned:learned,mastered:mastered});
    }
    return {rows:rows,missing:records.filter(function(row){return row.stat.times>0&&!first.has(row.key);}).length,hasAssessment:hasAssessment};
  }
  function render(target,result){
    target.replaceChildren();
    var heading=document.createElement('h3');heading.textContent='学习进展 · 句子';target.append(heading);
    var legend=document.createElement('div');legend.className='growth-legend';
    var last=result.rows[result.rows.length-1];
    legend.innerHTML='<span class="growth-learned">已学 <strong>'+last.learned+'</strong></span><span class="growth-mastered">经复测掌握 <strong>'+(result.hasAssessment?last.mastered:'未测评')+'</strong></span>';
    target.append(legend);
    var ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 800 130');svg.setAttribute('role','img');svg.setAttribute('aria-label','最近30天句子学习积累，已学 '+last.learned+'，经复测掌握 '+(result.hasAssessment?last.mastered:'未测评'));
    var peak=Math.max(1,...result.rows.map(function(row){return Math.max(row.learned,row.mastered);}));
    function shape(tag,attrs){var node=document.createElementNS(ns,tag);Object.keys(attrs).forEach(function(key){node.setAttribute(key,attrs[key]);});svg.append(node);return node;}
    for(var tick=0;tick<=2;tick++){
      var y=102-tick*42;shape('line',{x1:42,y1:y,x2:782,y2:y,'class':'growth-grid'});
      shape('text',{x:34,y:y+4,'text-anchor':'end'}).textContent=Math.round(peak*tick/2);
    }
    ['learned','mastered'].forEach(function(key){
      if(key==='mastered'&&!result.hasAssessment)return;
      var points=result.rows.map(function(row,index){return (42+index*740/29)+','+(102-row[key]/peak*84);}).join(' ');
      shape('polyline',{points:points,fill:'none','class':'growth-line growth-'+key});
      result.rows.forEach(function(row,index){
        var dot=shape('circle',{cx:42+index*740/29,cy:102-row[key]/peak*84,r:2.5,'class':'growth-dot growth-'+key});
        var title=document.createElementNS(ns,'title');title.textContent=new Date(row.at).toLocaleDateString('zh-CN')+' · '+(key==='learned'?'已学 ':'经复测掌握 ')+row[key];dot.append(title);
      });
    });
    [0,14,29].forEach(function(index){var date=new Date(result.rows[index].at);shape('text',{x:42+index*740/29,y:124,'text-anchor':index===0?'start':index===29?'end':'middle'}).textContent=(date.getMonth()+1)+'/'+date.getDate();});
    target.append(svg);
  }
  var api={series:series,render:render};
  if(typeof module==='object'&&module.exports)module.exports=api;else global.StatsGrowth=api;
})(typeof window==='object'?window:globalThis);
