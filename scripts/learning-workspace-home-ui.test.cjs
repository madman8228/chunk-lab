'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
async function main(){
  const browser=await chromium.launch({headless:true});
  try{
    const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.setContent('<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#f7f1e4;font-family:Arial,sans-serif}*{box-sizing:border-box}#noticeBannerRail{display:flex;min-height:36px;align-items:flex-start;justify-content:center;padding:2px 0 4px}</style><div id="pageHome"></div><div id="noticeBannerRail"></div><main id="home"></main></html>');
    await page.addStyleTag({path:path.join(root,'assets/learning-workspace.css')});await page.addStyleTag({path:path.join(root,'assets/content-card.css')});
    await page.addStyleTag({path:path.join(root,'assets/home-dashboard.css')});
    await page.addScriptTag({path:path.join(root,'js/learning-workspace.js')});
    await page.addScriptTag({path:path.join(root,'js/learning-navigation.js')});
    await page.addScriptTag({path:path.join(root,'js/content-card.js')});await page.addScriptTag({path:path.join(root,'js/notice-banner.js')});await page.addScriptTag({path:path.join(root,'js/course-return.js')});await page.addScriptTag({path:path.join(root,'js/learning-workspace-view.js')});
    await page.evaluate(()=>{
      window.calls=[];window.draw=(patch={})=>LearningWorkspaceView.render(document.getElementById('home'),{
        view:'home',preferences:{},activeResources:[],due:0,status:'',...patch
      },{navigate:value=>calls.push(['navigate',value]),retry:()=>calls.push(['retry']),resume:value=>calls.push(['resume',value]),review:()=>calls.push(['review']),open:value=>calls.push(['open',value]),select:(...args)=>calls.push(['select',...args])});draw();
    });
    assert.equal(await page.getByRole('heading',{name:'今日学习'}).count(),0,'empty home hides its heading');
    const startPalette=()=>page.locator('.workspace-start-link').evaluate(node=>({surface:getComputedStyle(node).backgroundColor,border:getComputedStyle(node).borderTopColor,ink:getComputedStyle(node).color}));
    assert.deepEqual(await startPalette(),{surface:'rgb(222, 237, 241)',border:'rgb(102, 127, 134)',ink:'rgb(85, 53, 31)'},'empty-home action uses the sky-tinted light palette');
    await page.evaluate(()=>{document.documentElement.classList.add('dark');draw();});
    assert.deepEqual(await startPalette(),{surface:'rgb(38, 54, 58)',border:'rgb(113, 136, 139)',ink:'rgb(232, 226, 212)'},'empty-home action remains matched in dark mode');
    await page.evaluate(()=>{document.documentElement.classList.remove('dark');draw();});
    assert.equal(await page.getByRole('link',{name:/背单词|练句子/}).count(),0);
    assert.equal(await page.getByRole('heading',{name:'当前在学'}).count(),0);
    await page.evaluate(()=>draw({preferences:{one:{itemType:'tool',targetId:'vocabulary',selected:true}}}));
    assert.equal(await page.locator('.workspace-shortcuts,.workspace-tool-editor').count(),0,'old pinned preferences do not restore removed UI');
    await page.evaluate(()=>draw({status:'待保存，连接恢复后会自动重试。'}));
    assert.equal(await page.getByRole('button',{name:'重试'}).count(),0);
    assert.equal(await page.locator('#noticeBannerRail .notice-banner-message [role="status"]').count(),1);
    assert.equal(await page.locator('.workspace-notice').evaluate(node=>node.getBoundingClientRect().height<80),true);
    await page.evaluate(()=>draw({status:'个人记录尚未确认，请稍后重试；当前不代表空账户。'}));
    await page.locator('.workspace-notice .notice-banner-action').click();assert.deepEqual(await page.evaluate(()=>calls.pop()),['retry']);
    assert.equal(await page.getByRole('heading',{name:'选一份内容，开始学习'}).count(),0);
    await page.evaluate(()=>draw({status:'保存未确认：连接失败'}));
    assert.equal(await page.getByRole('button',{name:'重试'}).count(),0);
    await page.evaluate(()=>draw({status:'已保存'}));assert.equal(await page.getByRole('status').count(),0);
    const output=path.join(root,'output/playwright/home-refinement');fs.mkdirSync(output,{recursive:true});
    for(const width of [1440,946,390,360]){
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>draw({resume:{toolId:'vocabulary',title:'六词练习',bookId:'pilot-six-v1'},due:12,activeResources:[{title:'日常英语表达',available:true,resourceId:'course:demo'}]}));
      assert.equal(await page.getByRole('heading',{name:'今日学习'}).count(),0,'home omits the redundant heading when learning content exists');
      assert.equal(await page.getByRole('button',{name:'选择学习内容'}).count(),0);
      assert.equal(await page.getByRole('button',{name:/取消收藏|退出在学/}).count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow at '+width);
      assert.equal(await page.locator('.workspace-resume').count(),0);
      assert.equal(await page.locator('.workspace-tool-links').count(),0);
      await page.screenshot({path:path.join(output,'home-'+width+'.png'),fullPage:true});
    }
    await page.evaluate(()=>draw({resume:{toolId:'chunks',deck:{id:'lesson-1'},idx:4},courseRows:[{course:{id:'demo',title:'日常英语表达'},lessons:[{contentRef:{type:'sentence-deck',id:'lesson-1'}}],resource:{available:true},progress:'已学 3 / 418 句',homeProgressMarkup:'<span class="home-progress-metric"><span class="home-progress-label"><b>1%</b></span><span class="home-progress-track"><span></span></span></span>'}]}));
    assert.equal(await page.locator('.home-content-kind').first().textContent(),'句子','sentence course uses the concise shared label');
    assert.equal(await page.locator('.home-course-progress-line .home-deck-progress').textContent(),'已学 3 / 418 句');
    assert.equal(await page.locator('.home-course-progress-line .home-course-metrics .home-progress-track').count(),1,'learned count and progress track share the dedicated progress row');
    await page.locator('#pageHome').evaluate(node=>{node.innerHTML='<section class="workspace-active"><div class="hd-row"><button class="hd-main-action"><span class="workspace-course-cover"><span class="hc-course-cover"></span></span><span class="grow"><span class="home-course-title-line"><span class="nm">口语3000句</span></span><span class="home-course-progress-line"><span class="sub home-deck-progress">已学 1 / 65 课节</span><span class="home-course-metrics"><span class="home-progress-metric"><span class="home-progress-label"><b>2%</b></span><span class="home-progress-track"><span></span></span></span></span></span></span></button><button class="hd-select-lessons">选课节</button><a class="hd-action">继续学习</a></div></section>';});
    assert.equal(await page.locator('#pageHome .hd-row').evaluate(node=>node.getBoundingClientRect().height<=165),true,'course card with lesson selector has no oversized blank height');
    assert.equal(await page.locator('#pageHome .hd-action').evaluate(node=>getComputedStyle(node).position),'static','resume action stays in normal flow below the course');
    assert.equal(await page.locator('#pageHome .home-progress-track').evaluate(node=>{const r=node.getBoundingClientRect(),label=node.parentElement.querySelector('.home-progress-label').getBoundingClientRect(),copy=node.closest('.grow').getBoundingClientRect();return r.top>=label.bottom&&r.width>copy.width*.8}),true,'progress bar occupies a separate bottom row across the copy width');
    assert.equal(await page.locator('#pageHome .grow').evaluate(node=>{const r=node.getBoundingClientRect(),cover=node.closest('.hd-main-action').querySelector('.hc-course-cover').getBoundingClientRect(),title=node.querySelector('.home-course-title-line').getBoundingClientRect(),progress=node.querySelector('.home-course-progress-line').getBoundingClientRect();return Math.abs(r.top-cover.top)<2&&Math.abs(r.bottom-cover.bottom)<2&&Math.abs(title.top-r.top)<2&&Math.abs(progress.bottom-r.bottom)<2}),true,'copy fills cover height with title and progress at opposite ends');
    await page.locator('#home .hd-main-action').click();await page.waitForFunction(()=>calls.length>0);assert.equal((await page.evaluate(()=>calls.pop()))[1].idx,4);
    await page.evaluate(()=>draw({due:12,activeResources:[{title:'日常英语表达',available:true,resourceId:'course:demo'}]}));
    await page.evaluate(()=>{window.openStatsPage=tab=>calls.push(['stats',tab]);});
    await page.getByRole('link',{name:'去复习（12）',exact:true}).click();assert.deepEqual(await page.evaluate(()=>calls.pop()),['stats','review']);
    assert.equal(await page.getByRole('link',{name:'查看所有课程与词库',exact:true}).getAttribute('href'),'main.html?view=my-learning');
    await page.evaluate(()=>draw({courseRows:[{course:{id:'completed-demo',title:'已完成课程'},lessons:[],resource:{available:true},progress:'已完成',completionState:'completed'}]}));
    assert.equal(await page.locator('.home-completed-courses').count(),0,'completed course records are not rendered on home');
    await page.evaluate(()=>draw({resume:{toolId:'chunks',title:'一个非常长的课程标题'.repeat(20)},due:1}));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    for(const width of [946,390]){await page.setViewportSize({width,height:900});await page.evaluate(()=>draw());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(output,'empty-'+width+'.png'),fullPage:true});}
    await page.getByRole('button',{name:'选择课程或词库，开始学习'}).focus();await page.keyboard.press('Enter');assert.deepEqual(await page.evaluate(()=>calls.pop()),['navigate','discover']);
    await page.evaluate(()=>draw({status:'内容目录连接失败，保留最近可读内容。'}));
    assert.equal(await page.locator('.workspace-notice').count(),0,'directory transport error never occupies home');
    await page.evaluate(()=>draw({status:'保存未确认：服务暂不可用'}));
    assert.equal(await page.locator('.workspace-notice').count(),1,'real save failures stay visible');
    for(const width of [856,390]){
      await page.setViewportSize({width,height:932});
      await page.evaluate(()=>{
        window.noticeFixture={activeResources:[{courseId:'demo',title:'日常英语表达',available:true,resourceId:'course:demo'}]};
        draw(noticeFixture);
      });
      const before=await page.locator('.home-courses').boundingBox();
      await page.evaluate(()=>draw({...noticeFixture,status:'个人单词本尚未读取成功，已有内容保留。'}));
      const after=await page.locator('.home-courses').boundingBox();
      assert.equal(after.y,before.y,'notification does not move course content');
      assert.equal(await page.locator('.workspace-notice').evaluate(node=>getComputedStyle(node).position),'static');
      await page.locator('.workspace-notice .notice-banner-action').click();assert.deepEqual(await page.evaluate(()=>calls.pop()),['retry']);
      await page.locator('.workspace-notice .notice-banner-action').hover();
      assert.equal(await page.locator('.workspace-notice .notice-banner-action').evaluate(node=>getComputedStyle(node).backgroundColor),'rgba(0, 0, 0, 0)','retry remains a text-only action when hovered');
      assert.ok((await page.locator('.workspace-notice .notice-banner-action').boundingBox()).width<80,'retry has no large button padding');
      await page.screenshot({path:path.join(output,'banner-'+width+'.png'),fullPage:true});
      await page.getByRole('button',{name:'关闭提示'}).focus();await page.keyboard.press('Enter');
      assert.equal(await page.locator('.workspace-notice').count(),0);
      assert.equal((await page.locator('.home-courses').boundingBox()).y,before.y);
      assert.equal(await page.locator('#noticeBannerRail').evaluate(node=>document.activeElement===node),true,'closing restores focus to the notice rail when no heading is inside it');
      await page.evaluate(()=>draw({...noticeFixture,status:'个人单词本尚未读取成功，已有内容保留。'}));
      assert.equal(await page.locator('.workspace-notice').count(),0,'same dismissed condition is not reinserted on redraw');
      await page.evaluate(()=>draw({...noticeFixture,status:'保存未确认：服务暂不可用'}));
      assert.equal(await page.locator('.workspace-notice').count(),1,'a different condition remains visible');
      await page.evaluate(()=>draw(noticeFixture));
      await page.evaluate(()=>draw({...noticeFixture,status:'个人单词本尚未读取成功，已有内容保留。'}));
      assert.equal(await page.locator('.workspace-notice').count(),1,'a recovered condition can notify if it occurs again');
      await page.evaluate(()=>draw({...noticeFixture,status:'连接暂不可用，已有内容保留。'.repeat(20)}));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'long banner does not overflow');
    }
    await page.evaluate(()=>{
      draw();var box=NoticeBanner.create({message:'<img src=x onerror=alert(1)>',actionLabel:'重新连接',onAction:()=>calls.push(['shared-retry'])});
      document.getElementById('home').append(box);
    });
    assert.equal(await page.locator('#noticeBannerStyle').count(),1,'all notice instances share one style definition');
    assert.equal(await page.locator('.notice-banner img').count(),0,'untrusted error text is not HTML');
    await page.getByRole('button',{name:'重新连接'}).click();assert.deepEqual(await page.evaluate(()=>calls.pop()),['shared-retry']);
    await page.getByRole('button',{name:'关闭提示'}).click();
    assert.deepEqual(errors,[]);console.log('Home UI: shortcuts, editing, sync states, resume, review, empty state, long titles and 4 viewport widths passed');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
