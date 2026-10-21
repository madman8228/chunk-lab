'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require('playwright-core');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage();
    await page.route('http://menu-fixture.invalid/**',route=>route.fulfill({contentType:'text/html',body:'<main id="app"></main><button id="outside">Outside</button>'}));
    await page.goto('http://menu-fixture.invalid/');
    for(const file of ['assets/learning-workspace.css','assets/content-card.css'])await page.addStyleTag({path:path.resolve(file)});
    for(const file of ['js/learning-workspace.js','js/content-card.js','js/learning-workspace-view.js'])await page.addScriptTag({path:path.resolve(file)});
    await page.evaluate(()=>{
      window.LearningNavigation={create:()=>document.createElement('nav')};
      window.rows=[LearningWorkspace.normalizeResource({resourceId:'course:test',courseId:'test',title:'Test course',visibility:'private',sourceRefs:[{type:'sentence-deck',id:'test'}]})];
      window.original=rows[0];
      window.draw=()=>LearningWorkspaceView.render(document.getElementById('app'),{view:'my-learning',resources:rows,publicResources:[],preferences:{},memberships:{test:{joined:true}}},
        {navigate(){},filter(){},select(){},open(){},leave(){return Promise.resolve();}});
      draw();
    });
    const menu=page.locator('#app .content-card-menu'),trigger=menu.locator('summary');
    await trigger.click();await trigger.focus();await page.evaluate(()=>draw());
    assert.equal(await menu.evaluate(node=>node.open),true,'same-resource refresh retains the open menu');
    assert.equal(await trigger.getAttribute('aria-expanded'),'true');
    assert.equal(await trigger.evaluate(node=>node===document.activeElement),true);
    await page.keyboard.press('Escape');assert.equal(await menu.evaluate(node=>node.open),false);
    assert.equal(await trigger.getAttribute('aria-expanded'),'false');
    await trigger.press('ArrowDown');
    const focusKey=await page.evaluate(()=>document.activeElement.getAttribute('data-focus-key'));
    assert.ok(focusKey);await page.evaluate(()=>draw());
    assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('data-focus-key')),focusKey,'focused menu action survives refresh');
    await page.locator('#outside').click();assert.equal(await menu.evaluate(node=>node.open),false);
    await trigger.click();await page.evaluate(()=>{rows=[];draw();});
    assert.equal(await page.locator('.content-card-menu[open]').count(),0,'removed resources never resurrect a menu');
    await page.evaluate(()=>{rows=[original];draw();});await trigger.click();
    await page.evaluate(()=>{history.pushState({},'','?view=other');draw();});
    assert.equal(await menu.evaluate(node=>node.open),false,'navigation does not carry open menus');
    await trigger.click();await page.keyboard.press('Escape');
    assert.equal(await menu.evaluate(node=>node.open),false,'menu registration remains valid after navigation');
    const output=path.resolve('output/playwright/content-card-rerender');fs.mkdirSync(output,{recursive:true});
    for(const width of [946,390]){
      await page.setViewportSize({width,height:932});await page.evaluate(()=>draw());await trigger.click();await page.evaluate(()=>draw());
      assert.equal(await menu.evaluate(node=>node.open),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:path.join(output,'menu-'+width+'.png'),fullPage:true});
      await page.keyboard.press('Escape');
    }
    await page.evaluate(()=>{
      const action=document.createElement('button');action.textContent='Other action';
      const host=document.createElement('aside');host.id='second';
      host.append(ContentCard.create({resource:{resourceId:'other',title:'Other'},variant:'library',kindLabel:'句子',items:[action]}));
      document.body.append(host);
    });
    await trigger.click();await page.locator('#second summary').click();
    assert.equal(await menu.evaluate(node=>node.open),false,'another menu closes the refreshed menu');
    await page.evaluate(()=>draw());
    assert.equal(await page.locator('#second details').evaluate(node=>node.open),true,'refreshing an inactive container does not steal another menu');
    assert.equal(await page.locator('.content-card-menu[open]').count(),1);
    console.log('Content card rerender: open state, focus, Escape, outside click, removed resources, navigation and two widths passed');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
