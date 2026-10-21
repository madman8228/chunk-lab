'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),express=require('../server/node_modules/express'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),app=express();app.get('/api/config',(_,res)=>res.json({requireAuth:true,authMode:'phone'}));app.use(express.static(root));
(async()=>{const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));let browser;
try{
  browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[],posts=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.method()==='POST')posts.push(request.url());});
  await page.route('**/assets/vocabulary-*',route=>route.fulfill({path:path.join(root,'test/fixtures/synthetic-vocabulary-16x9.webp'),contentType:'image/webp'}));
  const out=path.join(root,'output/playwright/action-game');fs.mkdirSync(out,{recursive:true});await page.goto('http://127.0.0.1:'+server.address().port+'/vocabulary.html');await page.locator('.quest-scene img').evaluate(img=>img.decode());
  assert.ok(await page.locator('.initials-word').evaluateAll(inputs=>inputs.every(input=>!input.placeholder&&getComputedStyle(input).borderBottomStyle==='solid'&&parseFloat(getComputedStyle(input).borderBottomWidth)>0)),'Every chunk uses one solid underline, not letter-count placeholders');
  assert.deepEqual(await page.locator('.cloze-gloss').allTextContents(),['我能','借入','你的充电器']);
  assert.equal(await page.locator('.initials-translation').textContent(),'我能借用你的充电器吗？');
  assert.equal(await page.locator('.quest-phone, .phone-connection, meter').count(),0,'No phone battery/status UI');
  assert.ok(await page.locator('.initials-form').evaluate(form=>form.querySelector('.initials-translation').compareDocumentPosition(form.querySelector('.cloze-sentence'))&Node.DOCUMENT_POSITION_FOLLOWING),'Full translation must precede blanks');
  assert.deepEqual(await page.locator('.initials-option').allTextContents(),['borrow','Can','charger','I','lend','your']);
  assert.equal(await page.locator('.initials-word').first().evaluate(el=>document.activeElement===el),true,'Desktop must accept typing without an initial click');
  const beforeFocus=await page.locator('.initials-word').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().width));
  await page.locator('.initials-word').nth(2).focus();
  assert.deepEqual(await page.locator('.initials-word').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().width)),beforeFocus,'Focus must not resize empty slots');
  await page.locator('.initials-word').first().focus();
  await page.locator('.initials-candidates').getByRole('button',{name:'charger',exact:true}).click();
  const chosen=await page.locator('.initials-word').first().evaluate(el=>({value:el.value,width:el.clientWidth,scroll:el.scrollWidth}));assert.equal(chosen.value,'charger');assert.ok(chosen.scroll<=chosen.width,'Long selected chunk must fit even in the one-letter I/short-answer slot');
  await page.locator('.initials-word').first().click();await page.locator('.initials-word[data-active="true"]').press('Backspace');
  await page.locator('.initials-candidates').getByRole('button',{name:'Can',exact:true}).click();
  assert.equal(await page.locator('.initials-word').first().inputValue(),'Can');assert.equal(await page.locator('.initials-word[data-active="true"]').getAttribute('name'),'slot-1');
  await page.locator('.initials-word').nth(0).click();await page.locator('.initials-word[data-active="true"]').press('Backspace');
  for(const width of [1440,390]){await page.setViewportSize({width,height:932});await page.evaluate(()=>window.scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const artwork=await page.locator('.quest-scene img').evaluate(img=>({src:img.currentSrc,width:img.getBoundingClientRect().width,height:img.getBoundingClientRect().height,available:img.parentElement.getBoundingClientRect().width,container:img.parentElement.tagName}));
    const confirmSize=await page.getByRole('button',{name:'确认',exact:true}).evaluate(button=>({width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height}));assert.ok(confirmSize.width<90&&confirmSize.height>=44,'Confirmation should fit its label while retaining a touch-sized height');
    assert.match(artwork.src,/vocabulary-borrow-wide-v3/);assert.equal(artwork.container,'PICTURE');assert.ok(Math.abs(artwork.width/artwork.height-16/9)<.01);assert.ok(Math.abs(artwork.width-artwork.available)<1);
    await page.screenshot({path:path.join(out,'initials-'+width+'.png'),fullPage:true});}
  async function keys(text){for(const key of text)await page.locator('.initials-word[data-active="true"]').press(key);}
  await keys('c');assert.equal(await page.locator('.initials-word').first().inputValue(),'Can');await keys('c');assert.equal(await page.locator('.initials-word').first().inputValue(),'charger');await keys('c');assert.equal(await page.locator('.initials-word').first().inputValue(),'Can');await keys('i');
  await page.getByRole('button',{name:'暂停 / 退出',exact:true}).click();await page.getByRole('button',{name:'继续任务',exact:true}).click();assert.equal(await page.locator('.initials-word').nth(1).inputValue(),'I');
  await page.locator('#toggleLibrary').click();await page.locator('#toggleLibrary').click();assert.equal(await page.locator('.initials-word').nth(1).inputValue(),'I');
  await keys('lycc');await page.getByRole('button',{name:'确认',exact:true}).click();assert.match(await page.locator('.practice-feedback').textContent(),/借给我/);assert.equal(await page.locator('.quest-dialogue').count(),0,'Error feedback must not recreate the removed character panel');await keys('b');await page.getByRole('button',{name:'确认',exact:true}).click();assert.equal(await page.locator('.quest-word').textContent(),'enough');
  // Native input event path used by soft keyboards, without relying on desktop keydown.
  for(const letter of 'ihebtc')await page.locator('.initials-word[data-active="true"]').evaluate((el,data)=>el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data})),letter);
  assert.deepEqual(await page.locator('.initials-word').evaluateAll(inputs=>inputs.map(input=>input.value)),['I','have','enough','battery','to','call']);
  await page.locator('.initials-word[data-active="true"]').press('Space');assert.equal(await page.locator('.quest-word').textContent(),'lend');assert.equal(await page.locator('.quest-actions').count(),0);
  await page.locator('.initials-candidates').getByRole('button',{name:'can',exact:true}).click();
  for(const width of [946,390]){await page.setViewportSize({width,height:932});const fits=await page.locator('.initials-word').first().evaluate(el=>({value:el.value,width:el.clientWidth,scroll:el.scrollWidth}));assert.equal(fits.value,'can');assert.ok(fits.scroll<=fits.width,'can must fit the original one-letter I slot at either viewport');}
  await page.locator('.initials-word').first().click();await page.locator('.initials-word[data-active="true"]').press('Backspace');
  await keys('iclytcc');await page.locator('.initials-word[data-active="true"]').press('Enter');assert.equal(await page.locator('.quest-earned li').count(),3);assert.deepEqual(errors,[]);assert.deepEqual(posts,[]);
  assert.equal(await page.locator('.quest-dialogue').count(),0,'Completion must not show the removed character dialogue');
  assert.equal(await page.locator('.quest-scene').isVisible(),false,'Completion should not retain the tall exercise artwork');
  assert.equal(await page.getByRole('button',{name:'重新开始',exact:true}).isVisible(),false,'Only one replay action on completion');
  for(const width of [1440,390]){await page.setViewportSize({width,height:932});await page.screenshot({path:path.join(out,'completion-'+width+'.png'),fullPage:true});}
  console.log('PASS: initials desktop/mobile flow, collision cycling, soft-keyboard input, saved drafts and no record writes');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}})().catch(error=>{console.error(error);process.exitCode=1;});
