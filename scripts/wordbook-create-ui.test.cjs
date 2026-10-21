'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let writes=0;page.on('request',r=>{if(r.method()!=='GET')writes++;});
 const html=fs.readFileSync('wordbook-create.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'');await page.route('**/wordbook-create.html',r=>r.fulfill({body:html,contentType:'text/html'}));await page.goto('http://127.0.0.1:9979/wordbook-create.html');
 for(const file of ['landing/theme.css','assets/learning-workspace.css','assets/learning-sky.css','assets/wordbook-details.css','assets/wordbook-create.css'])await page.addStyleTag({path:file});
 for(const file of ['js/learning-sky.js','landing/sentence-cloze-engine.js','landing/sentence-cloze-view.js','js/vocabulary-course-contract.js','js/wordbook-draft.js','js/wordbook-workbench.js','landing/guided-sentence-view.js','landing/wordbook-create.js'])await page.addScriptTag({path:file});
 assert.equal(await page.locator('.wordbook-admin,#draftTitle,#publishDraft').count(),0,'retired manual editing and admin publishing are not current page controls');
 const draft=await page.evaluate(()=>{
  const exercise=WordbookDraft.exercise('Can I [borrow] your charger?');
  const item={itemId:'fixture:borrow',unitId:'u1',word:'borrow',meaning:'借入',scene:'向朋友借充电器',translation:'我可以借你的充电器吗？',exercise,
   guidedSteps:WordbookDraft.guidedSteps('我可以吗 | Can I | I can\n借入 | borrow | lend\n你的 | your | my\n充电器 | charger? | phone?',exercise),images:{wide:[],mobile:[]}};
  const value={schemaVersion:1,book:{bookId:'isolated-preview',title:'草稿夹具',units:[{unitId:'u1',title:'借用物品'}]},items:[item]};
  WordbookWorkbench.applyDraft(value);WordbookWorkbench.previewItem(item);return value;
 });
 assert.match(await page.evaluate(()=>WordbookDraft.validate(WordbookWorkbench.snapshot()).join(';')),/插画/);
 await page.locator('.guided-form input').fill('can i');assert.equal(await page.locator('.guided-prompt').textContent(),'借入');
 await page.keyboard.press('Shift');await page.keyboard.press('Shift');assert.equal(await page.locator('.guided-form input').isVisible(),true);
 assert.deepEqual(await page.evaluate(()=>WordbookWorkbench.snapshot()),draft,'preview does not mutate the source draft');
 fs.mkdirSync('output/playwright/wordbook-create',{recursive:true});for(const width of [1440,390]){await page.setViewportSize({width,height:932});await page.evaluate(()=>scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'output/playwright/wordbook-create/create-'+width+'.png',fullPage:true});}
 assert.equal(writes,0,'headless draft preparation and preview remain read-only');
 // The retained publication adapter has no current-page entry. Exercise its
 // compatibility contract in an explicitly test-only DOM, never real publishing.
 const adapter=await browser.newPage();adapter.on('pageerror',e=>errors.push(e.message));
 await adapter.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<main><input id="fixtureTitle"><button id="validateServer">服务端校验</button><input id="publishConfirmed" type="checkbox"><button id="publishDraft" disabled>发布</button><p id="draftStatus"></p></main>'}));
 await adapter.goto('http://127.0.0.1:9978/publication-fixture');
 for(const file of ['landing/sentence-cloze-engine.js','js/vocabulary-course-contract.js','js/wordbook-draft.js','js/wordbook-workbench.js'])await adapter.addScriptTag({path:file});
 await adapter.evaluate(value=>{
  value.items[0].images={wide:['assets/test.webp'],mobile:['assets/test.webp']};
  const state=WordbookWorkbenchState.create(value);window.WordbookWorkbench={snapshot:state.snapshot};
  document.getElementById('fixtureTitle').oninput=event=>{const next=state.snapshot();next.book.title=event.target.value;state.applyDraft(next);};
  localStorage.setItem('chunklab_admin_token','isolated-fixture-token');
 },draft);
 const requests=[];await adapter.route('**/api/admin/wordbooks/**',async route=>{const payload=route.request().postDataJSON();requests.push(payload);const book=payload.package.index.books[0];const fingerprint=require('node:crypto').createHash('sha256').update(JSON.stringify(payload.package)).digest('hex');if(payload.confirmed)assert.equal(payload.fingerprint,fingerprint);await route.fulfill({json:{bookId:book.bookId,title:book.title,itemCount:book.itemCount,unitCount:book.units.length,fingerprint,ready:true,published:!!payload.confirmed}});});
 await adapter.addScriptTag({path:'landing/wordbook-publish.js'});
 await adapter.locator('#validateServer').click();await adapter.getByText(/服务端校验通过/).waitFor();
 assert.equal(await adapter.locator('#publishDraft').isDisabled(),true,'validation alone cannot authorize publication');
 await adapter.locator('#publishConfirmed').check();assert.equal(await adapter.locator('#publishDraft').isDisabled(),false);
 await adapter.locator('#fixtureTitle').fill('修改后的草稿');assert.equal(await adapter.locator('#publishDraft').isDisabled(),true);assert.equal(await adapter.locator('#publishConfirmed').isChecked(),false);
 await adapter.locator('#validateServer').click();await adapter.getByText(/服务端校验通过/).waitFor();await adapter.locator('#publishConfirmed').check();
 adapter.once('dialog',dialog=>dialog.accept());await adapter.locator('#publishDraft').click();await adapter.getByRole('link',{name:'查看已发布单词本',exact:true}).waitFor();assert.equal(requests.filter(r=>r.confirmed===true).length,1);
 assert.deepEqual(errors,[]);console.log('Current headless preview: read-only, immutable and responsive; retained publication adapter: isolated mocked validation, confirmation, edit invalidation and single publish passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
