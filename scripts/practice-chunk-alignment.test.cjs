'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright-core');
const html=fs.readFileSync('main.html','utf8'),styles=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(row=>row[1]).join('\n');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage();
 await page.setContent('<html class="practice-reference-layout"><style>'+styles+'</style><body><main class="wrap"><section id="stage"><div class="track-line"><div class="track compact-chunks" id="track"></div></div></section></main></body></html>');
 await page.addStyleTag({path:'assets/practice-reference-layout.css'});await page.addScriptTag({path:'js/main-practice-markup.js'});
 await page.evaluate(()=>{
  const rows=[
   {state:'active',chunk:'Could you give me',hint:'你能给我',role:'情态 + 双宾'},
   {state:'wait',chunk:'a moment,',hint:'一点时间',role:'宾语'},
   {state:'wait',chunk:'please?',hint:'麻烦',role:'礼貌词'},
   {state:'ok',chunk:'a much longer completed answer that should wrap safely',hint:'较长的中文提示需要自然换行，并且不会把相邻成分的标签挤到不同高度',role:'完成项'},
   {state:'bad',chunk:'incorrect answer',hint:'另一项提示',role:'错误项'},
   {state:'revealed',chunk:'revealed answer',hint:'没有成分标签的项目也要保留正确的行位置'}
  ];
  for(const [index,row] of rows.entries()){
   const box=document.createElement('div');box.className='chunk '+row.state;
   box.innerHTML=MainPracticeMarkup.buildChunkMarkup({chunk:row.chunk,index,hint:row.hint,grammar:row.role,mode:'choose'});
   if(['ok','bad','revealed'].includes(row.state))box.querySelector('.chunk-answer').textContent=row.chunk;
   document.getElementById('track').append(box);
  }
 });
 fs.mkdirSync('output/playwright/chunk-alignment',{recursive:true});
 for(const width of [1043,390,320]){
  await page.setViewportSize({width,height:932});
  const metrics=await page.evaluate(()=>Array.from(document.querySelectorAll('.chunk')).map(chunk=>{
   const answer=chunk.querySelector('.chunk-answer'),hint=chunk.querySelector('.chunk-hint'),role=chunk.querySelector('.chunk-role-wrap');
   const rect=answer.getBoundingClientRect(),style=getComputedStyle(answer);
   return {top:chunk.getBoundingClientRect().top,roleTop:role?.getBoundingClientRect().top,hintTop:hint.getBoundingClientRect().top,lineBottom:rect.bottom,width:rect.width,borderStyle:style.borderBottomStyle,borderWidth:style.borderBottomWidth};
  }));
  assert.ok(metrics.every(row=>row.borderStyle==='solid'&&row.borderWidth==='2px'),'every state uses the same line style/weight');
  const groups=new Map();for(const row of metrics){const key=Math.round(row.top);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
  for(const rows of groups.values())for(const key of ['roleTop','hintTop','lineBottom']){const values=rows.map(row=>row[key]).filter(value=>value!==undefined);assert.ok(Math.max(...values)-Math.min(...values)<1,'shared '+key+' at '+width);}
  assert.ok(Math.abs(metrics[0].width-metrics[1].width)<1,'active and waiting blank widths agree');
  await page.screenshot({path:path.resolve('output/playwright/chunk-alignment/'+width+'.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow at '+width+': '+JSON.stringify(await page.evaluate(()=>Array.from(document.querySelectorAll('main,section,.track-line,.track,.chunk,.chunk-answer')).map(node=>({class:node.className,width:node.getBoundingClientRect().width,right:node.getBoundingClientRect().right})))));
 }
 console.log('Chunk alignment: all five answer states use solid 2px lines; shared label/hint/bottom alignment, long/missing labels, multiline answers and 1043/390/320 widths passed. No app data loaded.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
