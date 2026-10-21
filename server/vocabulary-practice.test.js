'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jqka-practice-'));
process.env.CHUNKLAB_DATA_DIR=dir;process.env.REQUIRE_AUTH='true';process.env.JWT_SECRET=require('node:crypto').randomBytes(32).toString('hex');
const db=require('./db'),auth=require('./auth'),express=require('express');
const {registerVocabularyPracticeRoutes}=require('./routes/vocabulary-practice');
const content=require('../landing/practice-content'),engine=require('../landing/sentence-cloze-engine');
const app=express();app.use(express.json());let time=Date.now();
registerVocabularyPracticeRoutes({app,auth,db,now:()=>time});
app.get('/api/auth/me',auth.authenticate,(req,res)=>res.json({user:{...auth.readUser(req.userId),phone:'138****8000'}}));
app.get('/api/config',(req,res)=>res.json({requireAuth:true,authMode:'phone'}));
app.use(express.static(path.resolve(__dirname,'..')));
(async()=>{
  let browser;const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
  const user=auth.register('isolated-practice','test-pass'),other=auth.register('isolated-other','test-pass');const token=auth.signToken(user.id,user.username);
  async function request(url,body,t=token){const r=await fetch(base+url,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
  try{
    for(const lesson of content.lessons) for(const format of ['avif','webp']) {
      assert.ok(fs.statSync(path.resolve(__dirname,'../assets/vocabulary-'+lesson.w+'-10k-v1.'+format)).size<20000,'Every actual scene file must be strictly smaller than 20,000 bytes');
      for(const profile of ['mobile','wide']){
        const file='/assets/vocabulary-'+lesson.w+'-'+profile+'-v2.'+format;
        const size=fs.statSync(path.resolve(__dirname,'..'+file)).size;
        assert.ok(size<20000,'Every study illustration and fallback stays strictly below 20,000 bytes');
        const response=await fetch(base+file);assert.equal(response.status,200);assert.equal((await response.arrayBuffer()).byteLength,size);
      }
    }
    for(const format of ['avif','webp']){
      const file='/assets/vocabulary-decide-20k-v1.'+format,size=fs.statSync(path.resolve(__dirname,'..'+file)).size;
      assert.ok(size<20000,'Approved large introduction file stays below 20,000 bytes, including fallback');
      const response=await fetch(base+file);assert.equal(response.status,200);
      assert.equal((await response.arrayBuffer()).byteLength,size,'HTTP delivers the budgeted encoding, not a larger original');
    }
    const swSource=fs.readFileSync(path.resolve(__dirname,'../sw.js'),'utf8');
    assert.ok(!/['"]\/assets\/vocabulary-[^'"\n]+/.test(swSource),'No vocabulary image library in service worker precache');
    assert.ok(fs.statSync(path.resolve(__dirname,'../assets/jqka-learning-garden-body-v1.webp')).size<200*1024,'Learning background stays under 200 KiB');
    assert.equal((await fetch(base+'/api/vocabulary-practice')).status,401);
    const event={eventId:'event-0001',word:'borrow',independent:true};
    let r=await request('/api/vocabulary-practice',event);assert.equal(r.data.progress.borrow.mastered,false);
    await request('/api/vocabulary-practice',event);assert.equal(db.prepare('SELECT count(*) n FROM vocabulary_attempts').get().n,1);
    assert.equal((await request('/api/vocabulary-practice',{...event,word:'avoid'})).status,409);
    assert.equal((await request('/api/vocabulary-practice',{...event,eventId:'bad-word-001',word:'unknown'})).status,400);
    time+=86400000;r=await request('/api/vocabulary-practice',{...event,eventId:'event-0002'});assert.equal(r.data.progress.borrow.mastered,false);
    time+=2*86400000;r=await request('/api/vocabulary-practice',{...event,eventId:'event-0003'});assert.equal(r.data.progress.borrow.mastered,true);
    r=await request('/api/vocabulary-practice',{...event,eventId:'event-0004',independent:false});assert.equal(r.data.progress.borrow.mastered,false);assert.equal(r.data.progress.borrow.dueAt,time+600000);
    assert.deepEqual((await request('/api/vocabulary-practice',null,auth.signToken(other.id,other.username))).data.progress,{});
    assert.equal(content.select({},time).length,6);
    for(const lesson of content.lessons){
      engine.validate(lesson.exercise);
      assert.equal(engine.sentence(lesson.exercise),lesson.example);
      const values=Object.fromEntries(engine.blanks(lesson.exercise).map(blank=>[blank.id,blank.answers[0]]));
      assert.ok(engine.evaluate(lesson.exercise,values).correct);
    }
    if(process.env.PRACTICE_UI_TEST==='true'){
      const {chromium}=require('playwright-core');browser=await chromium.launch({headless:true});
      const page=await browser.newPage();await page.goto(base);await page.evaluate(t=>ChunkAPI.setSession('',t),auth.signToken(other.id,other.username));
      assert.equal(await page.locator('#vocabularyPractice').count(),0,'Homepage must not embed the learning panel');
      assert.equal(await page.locator('#cards, #tabs, #vocabularySearch, #btnShuffle, #btnFlipAll').count(),0,'Homepage is a portal, not the vocabulary workbench');
      assert.equal(await page.locator('.home-entry, .home-entry-inner, .home-entry-links').count(),0,'Do not duplicate global navigation in a second function selector');
      assert.equal(await page.getByRole('link',{name:'学单词',exact:true}).count(),1,'One vocabulary navigation entry, not duplicate headers');
      const catalogCaptures=path.resolve(__dirname,'../output/playwright/vocabulary');fs.mkdirSync(catalogCaptures,{recursive:true});
      for(const width of [1440,390]){
        await page.setViewportSize({width,height:932});
        const background=await page.evaluate(()=>({hero:getComputedStyle(document.querySelector('.hero')).backgroundImage,body:getComputedStyle(document.querySelector('.garden-body'),'::before').backgroundImage,filter:getComputedStyle(document.querySelector('.hero')).filter,cardOpacity:getComputedStyle(document.querySelector('#hand .card')).opacity}));
        assert.ok(background.hero.includes('linear-gradient')&&background.body.includes('linear-gradient'),'Decorative backgrounds are softened separately from content');
        assert.equal(background.filter,'none','Do not turn the page or artwork grayscale');assert.equal(background.cardOpacity,'1','Cards remain fully opaque');
        await page.screenshot({path:path.join(catalogCaptures,'home-'+width+'.png'),fullPage:true});
        assert.ok(await page.locator('a.nav-vocabulary').isVisible(),'Vocabulary navigation stays available on mobile');
      }
      await page.locator('a.nav-vocabulary').click();await page.waitForURL('**/vocabulary.html');
      await page.locator('#toggleLibrary').click();
      assert.equal(await page.locator('#cards .fc').count(),6);
      assert.equal(await page.locator('#tabs').count(),0,'Difficulty is a compact selector');
      await page.locator('#vocabularyLevel').selectOption('K');
      assert.equal(new URL(page.url()).searchParams.get('level'),'K');
      assert.equal(await page.locator('#cards .w').first().textContent(),'approach');
      assert.equal(await page.locator('#btnPracticeSix').textContent(),'入门场景练习','Pilot practice is not falsely presented as matching the selected rank');
      await page.locator('#vocabularySearch').fill('significant');
      assert.equal(await page.locator('#cards .fc').count(),1);
      await page.locator('#cards .fc').press('Enter');assert.ok(await page.locator('#cards .fc').evaluate(el=>el.classList.contains('flip')));
      await page.locator('#vocabularySearch').fill('no-such-vocabulary');assert.equal(await page.locator('#cards .fc').count(),0);
      await page.locator('#vocabularySearch').fill('');await page.locator('#vocabularyLevel').selectOption('J');
      await page.locator('#cards .master').first().click();
      const catalogRecord=await page.evaluate(()=>localStorage.getItem('jqka.learning.v1'));
      await page.reload();assert.equal(await page.evaluate(()=>localStorage.getItem('jqka.learning.v1')),catalogRecord,'Moving pages never clears existing familiarity records');
      assert.equal(await page.locator('#cards .master').first().textContent(),'已熟');
      for(const width of [1440,390]){
        await page.setViewportSize({width,height:932});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Catalog never overflows the viewport');
        for(const name of ['Chunk Lab','学单词','段位路径','学科'])assert.ok(await page.locator('nav .nav-links').getByRole('link',{name,exact:true}).isVisible());
        await page.screenshot({path:path.join(catalogCaptures,'catalog-'+width+'.png'),fullPage:true});
      }
      await page.goto(base+'/vocabulary.html?level=Q');assert.equal(await page.locator('#vocabularyLevel').inputValue(),'Q');
      await page.goto(base+'/vocabulary.html?level=invalid');assert.equal(await page.locator('#vocabularyLevel').inputValue(),'J');
      const sceneRequests=[];page.on('request',req=>{if(new URL(req.url()).pathname.startsWith('/assets/vocabulary-'))sceneRequests.push(req.url());});
      await page.locator('#btnPracticeSix').click();await page.waitForURL('**/vocabulary-practice.html');
      const captures=path.resolve(__dirname,'../output/playwright/practice');fs.mkdirSync(captures,{recursive:true});
      // A cold narrow device must not download the large introduction variant.
      for(const width of [320,350,351]){
        const narrow=await browser.newPage({viewport:{width,height:1000}}),narrowRequests=[],profile=width<=350?'10k':'20k';
        narrow.on('request',r=>{if(r.url().includes('/assets/vocabulary-'))narrowRequests.push(r.url());});
        await narrow.goto(base+'/vocabulary-practice.html');
        await narrow.waitForFunction(p=>performance.getEntriesByType('resource').some(r=>r.name.includes('vocabulary-decide-'+p+'-v1')),profile);
        assert.ok(narrowRequests.every(url=>url.includes('vocabulary-decide-'+profile+'-v1')),'Introduction selects one size at boundary '+width);
        assert.equal(new Set(narrowRequests.map(url=>new URL(url).pathname)).size,1,'Introduction selects one format at boundary '+width);
        await narrow.locator('#btnPracticeSix').click();await narrow.locator('.cloze-blank').first().waitFor();
        await narrow.waitForFunction(()=>performance.getEntriesByType('resource').some(r=>r.name.includes('vocabulary-decide-mobile-v2')));
        const lessonRequests=narrowRequests.filter(url=>url.includes('-v2.'));
        assert.equal(lessonRequests.length,1,'Cold phone downloads only one scene file');
        assert.ok(lessonRequests[0].includes('-mobile-v2.'),'No desktop image downloaded on phone');
        await narrow.close();
      }
      for(const width of [1440,1264,1205,390]){
        await page.setViewportSize({width,height:1200});
        const introAlignment=await page.evaluate(()=>{const n=document.querySelector('.learning-nav').getBoundingClientRect(),p=document.querySelector('.learning-intro').getBoundingClientRect();return {left:Math.abs(n.left-p.left),right:Math.abs(n.right-p.right)};});
        assert.ok(introAlignment.left<1&&introAlignment.right<1,'Introduction edges align with navigation at '+width+': '+JSON.stringify(introAlignment));
        assert.ok(await page.locator('.intro-art').evaluate(el=>getComputedStyle(el).backgroundImage.includes('vocabulary-decide-20k-v1')),'Enlarged introduction selects the 20 KB profile');
        await page.waitForFunction(()=>performance.getEntriesByType('resource').some(r=>r.name.includes('vocabulary-decide-20k-v1')));
        await page.screenshot({path:path.join(captures,'intro-'+width+'.png')});
        await page.locator('#btnPracticeSix').click();
        await page.locator('.cloze-blank').first().waitFor();
        assert.equal(await page.locator('#cards').count(),0,'Learning page does not carry the homepage card grid');
        assert.ok(await page.locator('.practice-illustration').isVisible());
        const layers=await page.evaluate(()=>{const bg=getComputedStyle(document.body,'::before'),art=getComputedStyle(document.querySelector('.practice-illustration'));return {opacity:bg.opacity,filter:bg.filter,pointer:bg.pointerEvents,artOpacity:art.opacity,artFilter:art.filter};});
        assert.equal(Number(layers.opacity),.42,'Garden keeps visible color at restrained strength');
        assert.equal(layers.filter,'none','Garden is not desaturated into gray');
        assert.equal(layers.pointer,'none');assert.equal(layers.artOpacity,'1');assert.equal(layers.artFilter,'none','Scene is not washed out with background');
        const sceneProfile=width<=680?'mobile':'wide';
        const sceneSuffix=sceneProfile+'-v2';
        assert.ok(await page.locator('.practice-illustration').evaluate((el,p)=>getComputedStyle(el).backgroundImage.includes('vocabulary-decide-'+p),sceneSuffix));
        await page.waitForFunction(p=>performance.getEntriesByType('resource').some(r=>r.name.includes('vocabulary-decide-'+p)),sceneSuffix);
        await page.evaluate(async()=>{const background=getComputedStyle(document.querySelector('.practice-illustration')).backgroundImage;const url=background.match(/url\("([^"]+)"\)/)[1];const image=new Image();image.src=url;await image.decode();if(!image.naturalWidth)throw new Error('Scene did not decode');});
        assert.ok(sceneRequests.every(url=>/vocabulary-decide-((10k|20k)-v1|(wide|mobile)-v2)\./.test(url)),'Only introduction/current scene variants load, not the atlas or other words');
        for(const profile of ['10k-v1','20k-v1','wide-v2','mobile-v2']){
          const requests=sceneRequests.filter(url=>url.includes('-'+profile));
          assert.equal(new Set(requests.map(url=>new URL(url).pathname)).size,requests.length?1:0,'Browser selects one format per requested size profile, not both');
        }
        for (const [label,href] of [['Chunk Lab','/main.html'],['学单词','/vocabulary.html'],['段位路径','/index.html#path'],['学科','/index.html#subjects']]) {
          const link=page.locator('.learning-nav').getByRole('link',{name:label,exact:true});
          assert.equal(await link.getAttribute('href'),href);assert.ok(await link.isVisible());
        }
        assert.ok(await page.locator('#jqkaLogin').isVisible());
        await page.locator('#jqkaLogin').click();await page.locator('#jqkaAccountPanel').waitFor();
        assert.equal(await page.locator('#jqkaAccountPhone').textContent(),'138****8000');
        await page.locator('#jqkaAccountClose').click();
        await page.screenshot({path:path.join(captures,'page-'+width+'.png')});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        const alignment=await page.evaluate(()=>{const n=document.querySelector('.learning-nav').getBoundingClientRect(),p=document.querySelector('#vocabularyPractice').getBoundingClientRect();return {left:Math.abs(n.left-p.left),right:Math.abs(n.right-p.right)};});
        assert.ok(alignment.left<1&&alignment.right<1,'Study paper edges align with global navigation at '+width);
        assert.equal(await page.locator('.practice-word-inline strong').textContent(),'decide');
        assert.equal(await page.getByText('先看懂，再试着不看答案想起来。',{exact:true}).count(),0);
        await page.locator('#vocabularyPractice').screenshot({path:path.join(captures,'study-'+width+'.png')});
        assert.equal(await page.locator('.practice-steps, [role=tab], [role=tablist]').count(),0,'Continuous practice has no stage tabs');
        assert.equal(await page.getByRole('button',{name:'开始拼句',exact:true}).count(),0,'No intermediate start click');
        assert.equal(await page.getByRole('button',{name:'显示这一步',exact:true}).count(),0,'No reveal-step control');
        const stacked=await page.evaluate(()=>{const art=document.querySelector('.practice-illustration'),teaching=document.querySelector('.practice-teaching');return {bottom:art.getBoundingClientRect().bottom,top:teaching.getBoundingClientRect().top,size:getComputedStyle(art).backgroundSize};});
        assert.ok(stacked.top>stacked.bottom,'Picture precedes exercise vertically at '+width);
        assert.equal(stacked.size,'contain','Whole illustration stays visible');
        const frame=await page.locator('.practice-illustration').evaluate(el=>{const r=el.getBoundingClientRect(),parent=el.parentElement.getBoundingClientRect();return {ratio:r.width/r.height,width:r.width,parentWidth:parent.width};});
        assert.ok(Math.abs(frame.ratio-(width<=680?4/3:16/9))<.01,'Landscape ratio matches device');
        assert.ok(Math.abs(frame.width-frame.parentWidth)<1,'Landscape fills its scene column');
        assert.equal(await page.locator('.practice-example').count(),0,'Composer hides the model English sentence');
        const fields=page.locator('.cloze-blank'),first=fields.nth(0),second=fields.nth(1);
        assert.equal(await fields.count(),2);
        assert.equal(await first.getAttribute('enterkeyhint'),'next');
        assert.equal(await second.getAttribute('enterkeyhint'),'done');
        assert.equal(await page.locator('.cloze-translation').textContent(),'我决定去野餐。（已经发生的决定）');
        assert.equal(await page.locator('.cloze-text').allTextContents().then(parts=>parts.join('')),'I   have a picnic.');
        assert.equal(await page.locator('.composer-progress, .practice-visual figcaption, .practice-teaching label, .sentence-draft').count(),0);
        await first.press('Tab');assert.equal(await first.inputValue(),'','Tab never fills a blank');
        await first.fill('decide');await first.press('Enter');
        assert.ok(await second.evaluate(el=>document.activeElement===el),'Enter goes to next blank without an intermediate check');
        await second.fill('to');await second.press('Enter');
        assert.match(await page.locator('.cloze-form .practice-feedback').textContent(),/过去式 decided/);
        assert.equal(await first.inputValue(),'decide');assert.equal(await second.inputValue(),'to','Wrong answer preserves the other blank');
        assert.equal(await first.getAttribute('aria-invalid'),'true');
        await first.evaluate(el=>el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true})));
        assert.ok(await first.evaluate(el=>document.activeElement===el),'IME Enter does not move focus');
        await page.screenshot({path:path.join(captures,'compose-'+width+'.png')});
        await page.setViewportSize({width,height:740});
        const controlsVisible=await page.locator('.practice-controls').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;});
        assert.ok(controlsVisible,'Exit/skip/restart stay in short viewport at '+width);
        await page.setViewportSize({width,height:1200});
        await first.fill('unfinished');
        await page.getByRole('button',{name:'退出练习',exact:true}).click();
        assert.ok(await page.locator('.learning-intro').isVisible());
        await page.getByRole('button',{name:'继续本轮练习',exact:true}).click();
        assert.equal(await fields.nth(0).inputValue(),'unfinished');
        assert.equal(await fields.nth(1).inputValue(),'to','Resume keeps every blank');
        await page.getByRole('button',{name:'重新开始本轮',exact:true}).click();
        assert.deepEqual(await fields.evaluateAll(list=>list.map(el=>el.value)),['','']);
        await page.getByRole('button',{name:'退出练习',exact:true}).click();
      }
      await page.locator('#btnPracticeSix').click();
      for(let n=0;n<6;n++)await page.getByRole('button',{name:'跳过这个词',exact:true}).click();
      assert.ok(await page.getByText('本轮已结束',{exact:true}).isVisible());
      assert.equal(await page.locator('.practice-results').getByText('已跳过',{exact:true}).count(),6);
      assert.deepEqual((await request('/api/vocabulary-practice',null,auth.signToken(other.id,other.username))).data.progress,{},'Skipped and abandoned words never create attempts');
      await page.getByRole('button',{name:'重新开始本轮',exact:true}).click();
      async function finishSentence(lesson){
        const panel=page.locator('#vocabularyPractice'),blanks=engine.blanks(lesson.exercise);
        for(const [n,blank] of blanks.entries()){
          const field=panel.locator('.cloze-blank').nth(n);
          await field.fill(blank.answers[0]);await field.press('Enter');
        }
        assert.equal(await panel.locator('.built-sentence').textContent(),lesson.example);
        assert.equal(await panel.locator('.sentence-translation').textContent(),lesson.translation);
        await panel.getByRole('button',{name:'下一个词',exact:true}).click();
      }
      for(const l of content.lessons){
        assert.equal(await page.locator('.practice-word-inline strong').textContent(),l.w,'Word teaching is integrated with input for '+l.w);
        await finishSentence(l);
      }
      await page.locator('#vocabularyPractice').getByText('这一轮完成了',{exact:true}).waitFor();
      await page.waitForFunction(()=>{const keys=Object.keys(localStorage).filter(k=>k.startsWith('jqka.practice.pending'));return keys.length&&keys.every(k=>JSON.parse(localStorage[k]).length===0);});
      const saved=(await request('/api/vocabulary-practice',null,auth.signToken(other.id,other.username))).data.progress;
      assert.equal(Object.keys(saved).length,6);assert.ok(Object.values(saved).every(x=>!x.mastered&&x.successes===0),'Guided practice never claims independent mastery');
      await page.getByRole('button',{name:'重新开始本轮',exact:true}).click();
      assert.deepEqual((await request('/api/vocabulary-practice',null,auth.signToken(other.id,other.username))).data.progress,saved,'Restart preserves all saved learning records');
      for(let n=0;n<6;n++)await page.getByRole('button',{name:'跳过这个词',exact:true}).click();
      const out=path.resolve(__dirname,'../output/playwright/practice');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'completion-390.png')});
      await page.locator('#vocabularyPractice').getByRole('button',{name:'结束本轮',exact:true}).click();
      await page.route('**/api/vocabulary-practice',route=>route.abort());
      await page.locator('#btnPracticeSix').click();await page.locator('#vocabularyPractice').getByRole('button',{name:'再练一轮',exact:true}).click();
      const panel=page.locator('#vocabularyPractice');
      assert.equal(await panel.locator('.practice-word-inline').count(),0,'Review does not show the word answer cue');
      await panel.locator('.cloze-blank').nth(0).fill('decide');
      await panel.locator('.cloze-blank').nth(1).fill('to');
      await panel.getByRole('button',{name:'检查',exact:true}).click();
      assert.equal(await panel.locator('.cloze-blank').count(),2,'Wrong tense does not advance');
      assert.equal(await panel.getByRole('button',{name:'显示这一步',exact:true}).count(),0);
      assert.match(await panel.locator('.cloze-form .practice-feedback').textContent(),/过去式 decided/);
      await finishSentence(content.lessons[0]);
      assert.equal(await page.evaluate(()=>{const k=Object.keys(localStorage).find(k=>k.startsWith('jqka.practice.pending'));return JSON.parse(localStorage[k]).length;}),1);
      await page.unroute('**/api/vocabulary-practice');await page.evaluate(()=>dispatchEvent(new Event('online')));
      await page.waitForFunction(()=>Object.keys(localStorage).filter(k=>k.startsWith('jqka.practice.pending')).every(k=>JSON.parse(localStorage[k]).length===0));
      assert.equal((await request('/api/vocabulary-practice',null,auth.signToken(other.id,other.username))).data.progress.decide.successes,0);
    }
    console.log('PASS: vocabulary practice, delayed mastery, idempotency, account isolation'+(browser?', full browser round':''));
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));db.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
