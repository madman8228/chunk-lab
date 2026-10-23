'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require('playwright-core');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.setContent('<html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#e5eee6"><div id="app"></div></body></html>');
    await page.addStyleTag({path:path.resolve('assets/learning-workspace.css')});await page.addStyleTag({path:path.resolve('assets/content-card.css')});await page.addStyleTag({path:path.resolve('assets/learning-navigation.css')});
    await page.addScriptTag({path:path.resolve('js/learning-workspace.js')});
    await page.addScriptTag({path:path.resolve('js/content-card.js')});await page.addScriptTag({path:path.resolve('js/course-return.js')});await page.addScriptTag({path:path.resolve('js/learning-navigation.js')});await page.addScriptTag({path:path.resolve('js/learning-workspace-view.js')});
    await page.evaluate(()=>{
      window.calls=[];window.filters=[];window.draw=(title,preferences={})=>LearningWorkspaceView.render(document.getElementById('app'),{
        view:'my-learning',resources:[LearningWorkspace.normalizeResource({resourceId:'course:test',courseId:'test',title:title||'零基础开口 · 1 第一次见面',visibility:'private',sourceRefs:[{type:'sentence-deck',id:'lesson'}]})],
        preferences,memberships:{test:{joined:true}}
      },{navigate:view=>calls.push(view),select:()=>{},open:()=>{},leave:()=>Promise.resolve(),filter:(...args)=>filters.push(args),retry:()=>{}});draw();
    });
    const output=path.resolve('output/playwright/library-compact');fs.mkdirSync(output,{recursive:true});
    for(const width of [946,390]){
      await page.setViewportSize({width,height:500});
      await page.evaluate(()=>draw());
      const spacing=await page.evaluate(()=>{
        const heading=document.querySelector('.workspace-heading').getBoundingClientRect();
        const categories=document.querySelector('.library-categories').getBoundingClientRect();
        return {categories:categories.top-heading.bottom};
      });
      assert.ok(spacing.categories<=4,'category margins should be compact: '+JSON.stringify(spacing));
      assert.equal(await page.locator('.library-type-filter').count(),0,'library search stays focused on title and category');
      const searchStyle=await page.locator('.library-search-input').evaluate(el=>{const s=getComputedStyle(el);return {height:el.getBoundingClientRect().height,border:s.borderTopWidth,radius:s.borderRadius};});
      assert.equal(searchStyle.height,width<=540?44:32,'compact search retains mobile touch height');
      assert.equal(searchStyle.border,'0px','search is not surrounded by a button-like border');
      assert.equal(searchStyle.radius,'0px');
      const row=page.locator('.workspace-card');
      const height=await row.evaluate(el=>el.getBoundingClientRect().height);
      assert.ok(height<=90,'short content row should be compact at '+width+': '+height);
      const padding=await row.evaluate(el=>{const s=getComputedStyle(el);return [s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft]});
      assert.deepEqual(padding,['0px','0px','0px','0px'],'content card uses the unframed shelf layout');
      assert.equal(await page.getByRole('button',{name:'查找',exact:true}).count(),0,'personal content search applies without a separate submit button');
      const search=page.getByRole('searchbox',{name:'搜索我的内容'});
      const searchWidth=await search.evaluate(el=>({width:el.getBoundingClientRect().width,maxWidth:getComputedStyle(el).maxWidth}));
      if(width>540)assert.ok(searchWidth.width<=65&&searchWidth.maxWidth==='64px','desktop search uses compact width: '+JSON.stringify(searchWidth));
      assert.ok(await search.evaluate(el=>!!el.closest('.workspace-heading')),'search stays inside heading controls');
      await search.fill('开口'+width);
      assert.deepEqual(await page.evaluate(()=>filters.pop()),[{contentQuery:'开口'+width},false,'my-learning',true],'typing applies the search immediately without adding history entries');
      const create=page.getByRole('link',{name:'创建/导入',exact:true});
      assert.equal(await create.getAttribute('href'),'course-create.html');
      assert.equal(await page.getByRole('button',{name:'浏览内容库',exact:true}).count(),0,'personal library does not duplicate the top-level discover navigation');
      const primary=page.locator('.library-primary');
      const menu=page.locator('.content-card-menu');await menu.locator('summary').click();
      assert.equal(await primary.evaluate(el=>getComputedStyle(el).borderTopWidth),'0px','primary course action is no longer a bulky bordered button');
      assert.equal(await primary.evaluate(el=>getComputedStyle(el).borderRadius),'4px');
      assert.ok(await primary.evaluate(el=>el.getBoundingClientRect().height)>=32,'primary menu action remains an operable row');
      const titleLink=row.locator('.library-copy h3 a.library-title-link');
      assert.equal(await titleLink.getAttribute('href'),await primary.getAttribute('href'),'title provides a keyboard-accessible route into the content');
      await titleLink.evaluate(link=>{window.openedLibraryHref=null;link.addEventListener('click',event=>{event.preventDefault();window.openedLibraryHref=link.getAttribute('href')},{once:true});});
      await row.evaluate(el=>el.dispatchEvent(new MouseEvent('click',{bubbles:true}))); 
      assert.equal(await page.evaluate(()=>window.openedLibraryHref),await primary.getAttribute('href'),'clicking the card whitespace opens the same destination');
      assert.match(await row.innerText(),/退出在学/,'joined course retains the explicit leave action');
      await menu.locator('summary').click();
      await titleLink.evaluate(link=>{window.openedLibraryHref=null;link.addEventListener('click',event=>{event.preventDefault();window.openedLibraryHref=link.getAttribute('href')},{once:true});});
      await menu.locator('summary').click();
      assert.equal(await page.evaluate(()=>window.openedLibraryHref),null,'opening the more menu does not trigger the card destination');
      const menuPanel=page.locator('.library-more-actions');
      assert.equal(await menuPanel.evaluate(el=>getComputedStyle(el).borderTopWidth),'1px','menu keeps one outer border');
      assert.equal(await menuPanel.locator('button').first().evaluate(el=>getComputedStyle(el).borderTopWidth),'0px','menu actions are not nested bordered cards');
      assert.equal(await menuPanel.locator('button').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','menu action rows remain visually unframed');
      assert.equal(await page.getByRole('button',{name:'收藏',exact:true}).count(),0,'personal rows do not offer a redundant add-to-favorites action');
      assert.equal(await page.getByRole('button',{name:'直接进入学习',exact:true}).isVisible(),true);
      await page.keyboard.press('Escape');
      await page.screenshot({path:path.join(output,'library-'+width+'.png')});
      await page.getByRole('link',{name:'发现',exact:true}).click();assert.equal(await page.evaluate(()=>calls.pop()),'discover');
      await page.evaluate(()=>draw('这是一个很长的课程名称'.repeat(10)));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    }
    await page.evaluate(()=>{const Native=URLSearchParams;window.URLSearchParams=function(){return new Native('contentStatus=all&contentQuery=口语3句')};LearningWorkspaceView.render(document.getElementById('app'),{view:'my-learning',resources:[
      LearningWorkspace.normalizeResource({resourceId:'course:fuzzy-match',courseId:'fuzzy-match',title:'口语3000句',visibility:'private'}),
      LearningWorkspace.normalizeResource({resourceId:'course:no-match',courseId:'no-match',title:'基础口语练习',visibility:'private'})
    ],memberships:{},preferences:{}},{navigate:()=>{},filter:()=>{},select:()=>{},open:()=>{},resume:()=>{},review:()=>{},leave:()=>{},retry:()=>{}});window.URLSearchParams=Native;});
    assert.equal(await page.locator('.workspace-card').count(),1,'fuzzy search matches ordered characters inside a title');
    assert.equal(await page.locator('.workspace-card h3').innerText(),'口语3000句');
    await page.evaluate(()=>{const Native=URLSearchParams;window.URLSearchParams=function(){return new Native('contentStatus=saved')};draw();window.URLSearchParams=Native;});
    assert.equal(await page.getByText('还没有收藏的内容。',{exact:true}).count(),1,'empty saved category gets specific guidance');
    assert.equal(await page.getByRole('button',{name:'清除筛选',exact:true}).count(),0,'empty saved category does not duplicate the category navigation');
    await page.evaluate(()=>{const Native=URLSearchParams;window.URLSearchParams=function(){return new Native('contentStatus=saved&contentQuery=missing')};draw();window.URLSearchParams=Native;});
    assert.equal(await page.getByText('没有符合条件的内容。',{exact:true}).count(),1);
    assert.equal(await page.getByRole('button',{name:'清除筛选',exact:true}).count(),0,'empty filtered library does not add a redundant clear action');
    await page.evaluate(()=>draw(undefined,{saved:{itemType:'resource',targetId:'course:test',selected:true}}));
    await page.locator('.content-card-menu summary').click();
    assert.equal(await page.getByRole('button',{name:'取消收藏',exact:true}).count(),1,'saved content remains removable from the personal collection');
    assert.equal(await page.getByRole('button',{name:'收藏',exact:true}).count(),0);
    assert.deepEqual(errors,[]);console.log('compact library: row density, long title, unframed action and more menu passed');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
