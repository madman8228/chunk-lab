'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage();
 await page.setContent('<html lang="zh-CN"><style>body{margin:24px;font-family:system-ui;background:#d6ebef}*{box-sizing:border-box}</style><main id="cards"></main></html>');
 for(const file of ['assets/learning-workspace.css','assets/content-card.css'])await page.addStyleTag({path:file});
 for(const file of ['js/learning-workspace.js','js/content-card.js'])await page.addScriptTag({path:file});
 await page.evaluate(()=>{
  const fixtures=[
   {title:'人教版英语 七年级下册（2024）',facets:{publisherId:'人民教育出版社',textbookVersion:'人教版',edition:'2024',grades:['七年级'],volume:'下册'}},
   {title:'其他版本英语 七年级下册（2024）',facets:{publisherId:'独立测试出版社',textbookVersion:'测试版',edition:'2024',grades:['七年级'],volume:'下册'}},
   {title:'英语 九年级全一册（2013）',facets:{textbookVersion:'人教版',edition:'2013',grades:['九年级'],volume:'全一册'}},
   {title:'英语 必修 第一册',facets:{textbookVersion:'经审核的较长教材版本名称用于检查标签截断',edition:'2024',volume:'必修 第一册'}},
   {title:'人教版英语 未补齐的旧教材',facets:{publisherId:'人民教育出版社',grades:['七年级'],volume:'下册',edition:'2024'}},
   {title:'口语3000句',facets:{}},
   {title:'口语课程·家庭场景跟读训练——常用表达与生活对话完整课程',facets:{}},
   {title:'PEP英语 六年级上册（2024）',facets:{publisherId:'人民教育出版社',textbookVersion:'人教版',seriesId:'PEP',edition:'2024',grades:['六年级'],volume:'上册'}},
   {title:'精通英语 六年级上册（2024）',facets:{publisherId:'人民教育出版社',textbookVersion:'人教版',seriesId:'精通',edition:'2024',grades:['六年级'],volume:'上册'}}
  ];
  for(const variant of ['library','discover']){
   const shelf=document.createElement('section');shelf.id=variant==='discover'?'discoverBody':'';shelf.className='learning-workspace workspace-'+variant;
   const grid=document.createElement('div');grid.className='workspace-grid';shelf.append(grid);document.getElementById('cards').append(shelf);
    const kindExamples=[{key:'word',label:'单词'},{key:'oral',label:'口语'},{key:'sentence-pattern',label:'句型'}];
    fixtures.forEach((spec,index)=>{
    const resource=LearningWorkspace.normalizeResource({...spec,resourceId:'fixture-'+index,kind:'wordbook',sourceRefs:[{type:'vocabulary-book',id:'fixture-'+index}]});
    resource.coverUrl='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#cde6f6"/></svg>');
    const kind=kindExamples[index]||kindExamples[0];
    grid.append(ContentCard.create({resource,variant,href:'#fixture-'+index,kindLabel:kind.label,kindKey:kind.key,items:[]}));
   });
  }
 });
 const output=path.resolve('output/playwright/content-card-metadata');fs.mkdirSync(output,{recursive:true});
 for(const width of [1043,390]){
  await page.setViewportSize({width,height:932});
  const cards=page.locator('.workspace-discover .content-card');
  assert.equal(await cards.nth(0).locator('.content-card-title').innerText(),'七年级下册（2024）');
  assert.equal(await cards.nth(0).locator('.content-card-version').innerText(),'人教版');
  assert.equal(await cards.nth(1).locator('.content-card-version').innerText(),'测试版');
  assert.equal(await cards.nth(2).locator('.content-card-title').innerText(),'九年级全一册（2013）');
  assert.equal(await cards.nth(3).locator('.content-card-title').innerText(),'英语 必修 第一册');
  assert.equal(await cards.nth(4).locator('.content-card-version').count(),0);
  assert.equal(await cards.nth(4).locator('.content-card-title').innerText(),'人教版英语 未补齐的旧教材');
  assert.equal(await cards.nth(5).locator('.content-card-title').innerText(),'口语3000句');
  assert.equal(await cards.nth(7).locator('.content-card-version').innerText(),'人教PEP');
  assert.equal(await cards.nth(8).locator('.content-card-version').innerText(),'人教精通');
  const longTitle=cards.nth(6).locator('.content-card-title');
  assert.equal(await longTitle.getAttribute('title'),'口语课程·家庭场景跟读训练——常用表达与生活对话完整课程','hover title keeps the full course name');
  assert.deepEqual(await longTitle.locator('xpath=..').evaluate(heading=>{const style=getComputedStyle(heading);return {whiteSpace:style.whiteSpace,overflow:style.overflow,textOverflow:style.textOverflow,height:heading.getBoundingClientRect().height}}),
   {whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',height:18},'discovery card titles stay one line and truncate with an ellipsis');
  const tagStyles=await cards.evaluateAll(nodes=>nodes.slice(0,3).map(card=>{const tag=card.querySelector('.content-card-kind'),style=getComputedStyle(tag);return {kind:tag.dataset.kind,background:style.backgroundColor,color:style.color,border:style.borderTopWidth,radius:style.borderTopLeftRadius}}));
  assert.deepEqual(tagStyles,[
   {kind:'word',background:'rgb(224, 242, 254)',color:'rgb(7, 89, 133)',border:'0px',radius:'4px'},
   {kind:'oral',background:'rgb(209, 250, 229)',color:'rgb(4, 120, 87)',border:'0px',radius:'4px'},
   {kind:'sentence-pattern',background:'rgb(254, 243, 199)',color:'rgb(146, 64, 14)',border:'0px',radius:'4px'}
  ],'course kind labels use compact semantic color tags');
  assert.equal(await cards.nth(0).locator('.content-card-title').getAttribute('aria-label'),'人教版英语 七年级下册（2024）');
  assert.ok(await page.evaluate(()=>Array.from(document.querySelectorAll('.content-card-version')).every(tag=>tag.getBoundingClientRect().right<=tag.parentElement.querySelector('.content-card-kind').getBoundingClientRect().left)),'left version never overlaps right content kind');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(await page.locator('.workspace-library .content-card-title').allTextContents(),await page.locator('.workspace-discover .content-card-title').allTextContents());
  await page.screenshot({path:path.join(output,width+'.png'),fullPage:true});
 }
 console.log('Metadata cards: source-driven version tags, two publishers, whole-volume labels, legacy/non-textbook fallback, full accessible title, both shelves and 1043/390 layouts passed.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
