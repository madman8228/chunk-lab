'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright-core');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage();
    page.setDefaultTimeout(3000);
    await page.setContent('<html><body><div id="app"></div></body></html>');
    await page.addStyleTag({path:path.resolve('assets/learning-workspace.css')});await page.addStyleTag({path:path.resolve('assets/content-card.css')});
    await page.addScriptTag({path:path.resolve('js/learning-workspace.js')});
    await page.addScriptTag({path:path.resolve('js/learning-navigation.js')});await page.addScriptTag({path:path.resolve('js/content-card.js')});await page.addScriptTag({path:path.resolve('js/course-return.js')});await page.addScriptTag({path:path.resolve('js/learning-workspace-view.js')});
    await page.evaluate(()=>{
      window.calls=[];window.filterCalls=[];
      const parseSelection=LearningWorkspace.selectionFromUrl;window.LearningWorkspace={...LearningWorkspace,selectionFromUrl:()=>parseSelection(window.testSearch||'')};
      window.renderDiscovery=()=>{
        const resource=LearningWorkspace.normalizeResource({resourceId:'course:oral',courseId:'oral',title:'口语3000句',facets:window.showDiscoverFacet?{schoolStages:['初中']}:undefined,sourceRefs:[{type:'sentence-deck',id:'oral-one'}]});
        LearningWorkspaceView.render(document.getElementById('app'),{view:'discover',resources:[resource],publicResources:[resource],preferences:{}},
          {filter:patch=>filterCalls.push(patch),select:()=>calls.push('save'),open:()=>calls.push('join'),navigate:()=>{}});
      };
      renderDiscovery();
    });
    for(const width of [799,390]){
      await page.setViewportSize({width,height:700});await page.evaluate(()=>renderDiscovery());
      const layout=await page.evaluate(()=>{
        const toolbar=document.querySelector('.discover-toolbar'),tabs=toolbar.querySelector('.workspace-tabs'),search=toolbar.querySelector('input');
        const filters=document.querySelector('.discover-filter');
        return {toolbarContainsTabs:toolbar.contains(tabs),toolbarContainsSearch:toolbar.contains(search),toolbarInsideFilters:!!filters&&filters.contains(toolbar),
          searchWidth:search.getBoundingClientRect().width,searchButtons:[...toolbar.querySelectorAll('.discover-searchbar button')].map(button=>button.textContent.trim()),
          filterTrigger:!!document.querySelector('.workspace-filter-trigger'),
          overflow:document.documentElement.scrollWidth>innerWidth};
      });
      assert.equal(layout.toolbarContainsTabs,true,'discovery toolbar contains the content-type tabs at '+width);
      assert.equal(layout.toolbarContainsSearch,true,'discovery toolbar contains the search field at '+width);
      assert.equal(layout.toolbarInsideFilters,false,'search toolbar is visually separate from optional facets at '+width);
      assert.deepEqual(layout.searchButtons,[],'search toolbar has no redundant filter buttons at '+width);
      assert.equal(layout.filterTrigger,false,'empty facets do not expose a nonfunctional filter control at '+width);
      assert.equal(layout.overflow,false,'discovery heading does not overflow at '+width);
      if(width>700){
        assert.ok(layout.searchWidth<=150,'desktop search input is reduced by about 70%: '+JSON.stringify(layout));}
    }
    const filterInput=page.getByRole('searchbox',{name:'搜索内容'});await filterInput.fill('旅游');
    assert.equal(await page.evaluate(()=>filterCalls.at(-1).q),'旅游','typing in the search box applies the query immediately');
    await page.evaluate(()=>{window.showDiscoverFacet=true;renderDiscovery();});
    await page.getByRole('button',{name:'中小学同步',exact:true}).click();
    assert.equal(await page.evaluate(()=>filterCalls.at(-1).category),'school');
    await page.evaluate(()=>{window.testSearch='?category=school';renderDiscovery();});
    await page.setViewportSize({width:799,height:700});
    await page.mouse.move(389,699);await page.waitForTimeout(180);
    const selectedTabStyle=await page.locator('.workspace-tabs button[aria-pressed="true"]').evaluate(button=>({background:getComputedStyle(button).backgroundColor,color:getComputedStyle(button).color,radius:getComputedStyle(button).borderRadius}));
    assert.deepEqual(selectedTabStyle,{background:'rgb(245, 158, 11)',color:'rgb(255, 255, 255)',radius:'999px'},'selected category uses the amber pill treatment');
    const desktopSelectedHeight=await page.locator('.workspace-tabs button[aria-pressed="true"]').evaluate(button=>button.getBoundingClientRect().height);
    assert.equal(desktopSelectedHeight,30,'desktop selected pill is about 20% shorter');
    const selectedStageStyle=await page.locator('.discover-text-tabs button[aria-pressed="true"]').first().evaluate(button=>({background:getComputedStyle(button).backgroundColor,color:getComputedStyle(button).color,radius:getComputedStyle(button).borderRadius,textDecoration:getComputedStyle(button).textDecorationLine}));
    assert.deepEqual(selectedStageStyle,{background:'rgb(245, 158, 11)',color:'rgb(255, 255, 255)',radius:'999px',textDecoration:'none'},'selected school stage uses the same amber pill treatment');
    const unselectedTabStyles=await page.locator('.workspace-tabs button[aria-pressed="false"],.discover-text-tabs button[aria-pressed="false"]').evaluateAll(buttons=>buttons.map(button=>{const style=getComputedStyle(button);return {background:style.backgroundColor,border:style.borderTopColor}}));
    assert.ok(unselectedTabStyles.length>0&&unselectedTabStyles.every(style=>style.background==='rgba(0, 0, 0, 0)'&&style.border==='rgba(0, 0, 0, 0)'), 'unselected category and stage tabs have no pill background or border');
    await page.setViewportSize({width:390,height:700});
    const mobileSelectedHeight=await page.locator('.workspace-tabs button[aria-pressed="true"]').evaluate(button=>button.getBoundingClientRect().height);
    assert.equal(mobileSelectedHeight,44,'mobile selected tab retains a comfortable touch target');
    assert.equal(await page.locator('.discover-more,input[type=checkbox],input[type=radio],.workspace-filter-trigger').count(),0);
    await page.getByRole('button',{name:'初中',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>filterCalls.at(-1)),{schoolStages:['初中'],grades:[]});
    await page.evaluate(()=>{window.testSearch='?category=school&schoolStages=初中';renderDiscovery();});
    assert.equal(await page.getByRole('button',{name:'九年级',exact:true}).count(),1);
    assert.equal(await page.getByRole('button',{name:'一年级',exact:true}).count(),0);
    await page.getByRole('button',{name:'九年级',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>filterCalls.at(-1).grades),['九年级']);
    await page.getByRole('button',{name:'新概念',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>filterCalls.at(-1).grades),[]);
    await page.evaluate(()=>{window.testSearch='?category=new-concept';renderDiscovery();});
    assert.equal(await page.locator('.discover-text-tabs').count(),0,'New Concept has no child menus');
    await page.evaluate(()=>{window.testSearch='';renderDiscovery();});
    const preview=page.locator('.discover-card h3 a');
    assert.equal(await preview.count(),1,'discovered course must have a native preview link');
    assert.match(await preview.getAttribute('href'),/decks\.html\?courseView=discover&course=oral&returnView=discover/);
    await page.locator('summary[aria-label="口语3000句 的更多操作"]').click();
    await page.getByRole('button',{name:'收藏',exact:true}).click();
    await page.locator('summary[aria-label="口语3000句 的更多操作"]').click();
    await page.getByRole('button',{name:'加入学习',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>calls),['save','join'],'preview must not consume independent actions');
    console.log('discovery preview: accessible course link and independent save/join passed');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
