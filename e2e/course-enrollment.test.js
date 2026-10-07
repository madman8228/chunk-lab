'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9860, 100);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-enrollment-'));
let server;

function startServer(){
  return new Promise(function(resolve, reject){
    server = spawn(process.execPath, ['index.js'], {
      cwd:path.join(ROOT, 'server'),
      env:Object.assign({}, process.env, { CHUNKLAB_DATA_DIR:TMP_DB, PORT:String(PORT), NODE_ENV:'test' }),
      stdio:'ignore'
    });
    var tries = 0;
    var timer = setInterval(function(){
      if(server.exitCode !== null){ clearInterval(timer); reject(new Error('server exit '+server.exitCode)); return; }
      var req = http.get({host:'127.0.0.1', port:PORT, path:'/api/health'}, function(res){
        res.resume(); if(res.statusCode === 200){ clearInterval(timer); resolve(); }
      });
      req.on('error', function(){}); req.setTimeout(600, function(){ req.destroy(); });
      if(++tries > 100){ clearInterval(timer); reject(new Error('server 启动超时')); }
    }, 150);
  });
}
function stopServer(){
  if(server){ try{ server.kill('SIGKILL'); }catch(e){} }
  try{ fs.rmSync(TMP_DB, {recursive:true, force:true}); }catch(e){}
}
async function openCourseAction(card, label){
  await card.locator('.course-manage-trigger').click();
  var item = card.getByRole('menuitem', {name:label});
  await item.waitFor({state:'visible'});
  return item;
}
async function clickCourseAction(card, label){
  await (await openCourseAction(card, label)).click();
}

(async function(){
  let browser;
  try{
    await startServer();
    browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || chromium.executablePath()});
    var context = await browser.newContext();
    var page = await context.newPage();
    await page.route('**/api/**', function(route){ route.abort('failed'); });
    await page.goto(BASE+'/decks.html?e2e=enrollment', {waitUntil:'domcontentloaded'});
    await page.waitForSelector('#tabDecks[aria-current="page"]', {timeout:15000});
    await page.waitForFunction(function(){ return window.decksReady === true || document.querySelector('#deckList .course-card'); }, {timeout:15000});

    await page.evaluate(async function(){
      await CL.preload();
      await CL.writeProgress({ 'enrollment-story-fixture':{ completed:true, seen:['n1'] }, 'package:coexist':{ completed:true, seen:['n1'] } });
      await CL.writeCourses([{ schemaVersion:'1.1', courseId:'enrollment-story-fixture', version:'1', metadata:{ title:{'zh-CN':'加入测试图文课'} }, story:{ startNodeId:'n1', nodes:[{ id:'n1', npcMessage:'Hello', sourceText:'Hello' }] } }]);
      var mem = CL.loadMem();
      mem.decks.push({ id:'enrollment-imported-fixture', name:'未加入导入测试课', items:[{ sentence:'An imported test sentence.', chunks:['An imported','test sentence.'], hints:['',''] }] });
      mem.decks.push({ id:'enrollment-ai-fixture', name:'AI 生成测试课程', authoring:{ catalogCourseId:'package:enrollment-ai-fixture' }, items:[{ sentence:'An AI-authored test sentence.', chunks:['An AI-authored','test sentence.'], hints:['',''] }] });
      mem.decks.push({ id:'enrollment-ai-owned-fixture', name:'我创作的 AI 测试课程', authoring:{ schemaVersion:1, template:'sentence-practice', catalogCourseId:'user-deck:enrollment-ai-owned-fixture' }, items:[{ sentence:'An owned AI test sentence.', chunks:['An owned AI','test sentence.'], hints:['',''] }] });
      await CL.saveAndNotify(mem);
      await CourseEnrollment.join('package:enrollment-ai-fixture');
      var legacyMemberships = CL.readProgress();
      legacyMemberships[CourseEnrollment.keyFor('user-deck:enrollment-ai-fixture')] = {
        kind:'course-enrollment', schemaVersion:1, courseId:'user-deck:enrollment-ai-fixture', joined:true, joinedAt:1, changedAt:1
      };
      await CL.writeProgress(legacyMemberships);
    });
    const sourceAssets = await page.evaluate(function(){
      return JSON.stringify({ courses: CL.readCourses(), decks: CL.loadMem().decks });
    });
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForSelector('#tabCourses', {state:'attached'});
    var ownedAI = page.locator('.deck-item').filter({hasText:'我创作的 AI 测试课程'});
    if(await ownedAI.count()) throw new Error('未加入学习的 AI 创作课程错误出现在“发现课程”');
    if(await page.evaluate(function(){ return CourseEnrollment.isJoined('user-deck:enrollment-ai-owned-fixture'); })) throw new Error('AI 创作课程测试夹具不应自动加入学习');
    await page.locator('#courseViewJoined').click();
    await ownedAI.waitFor();
    if(!(await ownedAI.innerText()).includes('AI 创作')) throw new Error('“我的课程”未标识 AI 创作课程的内容归属');
    await page.evaluate(async function(){ await CourseEnrollment.join('builtin:oral'); });
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForSelector('#tabCourses', {state:'attached'});
    await ownedAI.waitFor();
    var oralGeometryCard = page.locator('#deckList .course-card').filter({hasText:'口语3000句'});
    await oralGeometryCard.waitFor();
    var desktopCardGeometry = await Promise.all([ownedAI, oralGeometryCard].map(function(card){
      return card.evaluate(function(node){
        var card=node.getBoundingClientRect(), cover=node.querySelector('.deck-cover').getBoundingClientRect(), footer=node.querySelector('.deck-card-body').getBoundingClientRect();
        return {width:card.width,height:card.height,coverHeight:cover.height,footerHeight:footer.height};
      });
    }));
    if(['width','height','coverHeight','footerHeight'].some(function(key){ return Math.abs(desktopCardGeometry[0][key]-desktopCardGeometry[1][key]) > 1; })) throw new Error('桌面端 AI 与内置课程卡片尺寸不一致：'+JSON.stringify(desktopCardGeometry));
    await page.setViewportSize({width:375,height:812});
    var mobileCardGeometry = await Promise.all([ownedAI, oralGeometryCard].map(function(card){
      return card.evaluate(function(node){
        var card=node.getBoundingClientRect(), cover=node.querySelector('.deck-cover').getBoundingClientRect(), footer=node.querySelector('.deck-card-body').getBoundingClientRect();
        return {width:card.width,height:card.height,coverHeight:cover.height,footerHeight:footer.height};
      });
    }));
    if(['width','height','coverHeight','footerHeight'].some(function(key){ return Math.abs(mobileCardGeometry[0][key]-mobileCardGeometry[1][key]) > 1; })) throw new Error('手机端 AI 与内置课程卡片尺寸不一致：'+JSON.stringify(mobileCardGeometry));
    await page.setViewportSize({width:1280,height:900});
    await page.evaluate(async function(){ await CourseEnrollment.leave('builtin:oral'); });
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForSelector('#tabCourses', {state:'attached'});
    await ownedAI.waitFor();
    var joinOwnedAction = await openCourseAction(ownedAI, '加入学习');
    if(await ownedAI.locator('.deck-actions > .btn').count() !== 0) throw new Error('课程卡片不应显示多余的“开始”按钮');
    if(await ownedAI.getAttribute('role') !== 'button' || !(await ownedAI.getAttribute('tabindex'))) throw new Error('整张课程卡片应支持键盘聚焦和开始操作');
    var ownedMenuLabels = await ownedAI.locator('.course-manage-item').allTextContents();
    ['加入学习','更换封面图片','管理课程'].forEach(function(label){ if(ownedMenuLabels.indexOf(label) < 0) throw new Error('课程卡片菜单缺少“'+label+'”'); });
    ['AI 追加句子','导出课程','删除课程','发布到课程市场'].forEach(function(label){ if(ownedMenuLabels.indexOf(label) >= 0) throw new Error('课程卡片菜单不应重复显示“'+label+'”'); });
    var actionMenuBounds = await ownedAI.locator('.course-manage-menu').evaluate(function(menu){ var r=menu.getBoundingClientRect(); return {top:r.top,bottom:r.bottom,visible:getComputedStyle(menu).display!=='none'}; });
    if(!actionMenuBounds.visible || actionMenuBounds.bottom <= actionMenuBounds.top) throw new Error('课程操作菜单未正常展开');
    if(!(await joinOwnedAction.isVisible())) throw new Error('课程菜单中的加入学习操作不可见');
    await page.keyboard.press('Escape');
    await clickCourseAction(ownedAI, '管理课程');
    await page.locator('#pageEdit:not(.hidden)').waitFor();
    if(!(await page.locator('#editImportBtn').innerText()).includes('追加句子') || !(await page.locator('#editExportBtn').innerText()).includes('导出备份')) throw new Error('追加和备份操作应统一保留在课程管理页');
    if((await page.locator('#editManageActions .course-manage-trigger').innerText()).trim() !== '课程操作') throw new Error('课程管理页的操作菜单标题应清晰且不重复');
    await page.locator('#editManageActions .course-manage-trigger').click();
    var manageItems = page.locator('#editManageActions .course-manage-item');
    if((await manageItems.allTextContents()).join('|') !== '发布到课程市场|删除课程') throw new Error('课程管理页应集中发布和删除操作');
    await manageItems.filter({hasText:'发布到课程市场'}).click();
    await page.locator('#courseConfirmMask:not([hidden])').waitFor();
    if(!(await page.locator('#courseConfirmMessage').innerText()).includes('完整内容')) throw new Error('发布确认应明确提示课程内容将公开');
    await page.locator('#courseConfirmCancel').click();
    await page.locator('#editManageActions .course-manage-trigger').click();
    await page.locator('#editManageActions .course-manage-item').filter({hasText:'删除课程'}).click();
    await page.locator('#courseConfirmMask:not([hidden])').waitFor();
    await page.locator('#courseConfirmCancel').click();
    await page.setViewportSize({width:375,height:812});
    var mobileEditHead = await page.locator('#editHead').evaluate(function(head){
      var actions=head.querySelector('#editManageActions').getBoundingClientRect();
      return {width:head.clientWidth,scrollWidth:head.scrollWidth,actionsLeft:actions.left,actionsRight:actions.right};
    });
    if(mobileEditHead.scrollWidth > mobileEditHead.width+1 || mobileEditHead.actionsLeft < 0 || mobileEditHead.actionsRight > 375) throw new Error('手机端课程管理操作栏溢出：'+JSON.stringify(mobileEditHead));
    await page.locator('#editManageActions .course-manage-trigger').click();
    var mobileManageMenu = await page.locator('#editManageActions .course-manage-menu').evaluate(function(menu){ var r=menu.getBoundingClientRect(); return {left:r.left,right:r.right,width:innerWidth}; });
    if(mobileManageMenu.left < 0 || mobileManageMenu.right > mobileManageMenu.width) throw new Error('手机端课程操作菜单超出屏幕：'+JSON.stringify(mobileManageMenu));
    await page.keyboard.press('Escape');
    await page.setViewportSize({width:1280,height:900});
    await page.locator('#editBack').click();
    await ownedAI.waitFor();
    await page.setViewportSize({width:375,height:812});
    var mobileMenuBounds = await ownedAI.locator('.course-manage-menu').evaluate(function(menu){ var r=menu.getBoundingClientRect(); return {left:r.left,right:r.right,width:innerWidth}; });
    if(mobileMenuBounds.left < 0 || mobileMenuBounds.right > mobileMenuBounds.width) throw new Error('手机宽度下课程操作菜单超出屏幕：'+JSON.stringify(mobileMenuBounds));
    await page.keyboard.press('Escape');
    await page.setViewportSize({width:1280,height:900});
    if(await page.evaluate(function(){ return CourseEnrollment.isJoined('user-deck:enrollment-ai-owned-fixture'); })) throw new Error('仅展示 AI 创作课程就错误改变了学习加入状态');
    await clickCourseAction(ownedAI, '加入学习');
    await page.waitForFunction(function(){ return CourseEnrollment.isJoined('user-deck:enrollment-ai-owned-fixture'); });
    await clickCourseAction(ownedAI, '移出学习');
    await page.waitForFunction(function(){ return !CourseEnrollment.isJoined('user-deck:enrollment-ai-owned-fixture'); });
    var cardSize = await ownedAI.evaluate(function(card){ return {width:card.offsetWidth,height:card.offsetHeight}; });
    await ownedAI.click({position:{x:Math.min(30,cardSize.width-10),y:cardSize.height-8}});
    await page.waitForURL(/main\.html/);
    await page.goto(BASE+'/decks.html?e2e=enrollment&courseView=joined&courseType=decks', {waitUntil:'domcontentloaded'});
    await page.waitForSelector('#deckList .deck-item[role="button"]');
    var ownedDeck = page.locator('#deckList .deck-item').filter({hasText:'我创作的 AI 测试课程'});
    await ownedDeck.waitFor();
    await page.evaluate(function(){
      window.__startDeckCalls = 0;
      window.notifyMain = function(type){ if(type === 'startDeck') window.__startDeckCalls++; };
    });
    await openCourseAction(ownedDeck, '更换封面图片').then(function(item){ return item.click(); });
    if(await page.evaluate(function(){ return window.__startDeckCalls; })) throw new Error('更换封面图片意外触发了开始学习');
    if(!page.url().includes('/decks.html')) throw new Error('更换封面图片意外触发了开始学习：'+page.url());
    await page.keyboard.press('Escape');
    await page.locator('#courseViewDiscover').click();
    if(await page.locator('#tabCourses').isVisible()) throw new Error('个人图文课程不应在发现页提供可浏览入口');
    if(await page.locator('#deckList .course-card').filter({hasText:'加入测试图文课'}).count()) throw new Error('个人导入图文课程错误出现在发现课程');
    if(await page.locator('#btnImportDecks').isVisible()) throw new Error('发现课程的全部视图不应显示导入按钮');
    await page.locator('#courseViewJoined').click();
    await page.locator('#btnImportDecks').click();
    if(await page.locator('#courseImportTypeMask').isHidden()) throw new Error('我的课程的加号未先打开课程类型选择');
    if(await page.locator('#btnChooseSentenceImport').isVisible() !== true || await page.locator('#btnImportStoryCourse').isVisible() !== true) throw new Error('课程类型选择中缺少句子/图文选项');
    await page.locator('#btnChooseSentenceImport').click();
    if(await page.locator('#impMask').isHidden()) throw new Error('句子课程选项未打开句子课程导入流程');
    await page.locator('#impMask [data-close]').first().click();
    await page.locator('#btnImportDecks').click();
    await page.locator('#btnImportStoryCourse').click();
    if(await page.locator('#courseImpMask').isHidden()) throw new Error('图文课程导入选项未打开图文课程导入流程');
    await page.locator('#courseImpMask [data-close]').first().click();
    await page.locator('#courseViewDiscover').click();
    if(await page.locator('#deckList .course-card').filter({hasText:'加入测试图文课'}).count()) throw new Error('个人导入图文课错误出现在发现课程');
    await page.locator('#courseViewJoined').click();
    await page.setViewportSize({width:375, height:812});
    var mobileNav = await page.evaluate(function(){
      var ids=['decksBack','courseMembershipNav','courseTypeNav','btnImportStoryCourse','btnImportDecks'];
      var boxes=ids.map(function(id){ var r=document.getElementById(id).getBoundingClientRect(); return {id:id,left:r.left,right:r.right,top:r.top,bottom:r.bottom}; });
      var actions=document.querySelector('.course-header-actions').getBoundingClientRect();
      boxes.push({id:'course-header-actions',left:actions.left,right:actions.right,top:actions.top,bottom:actions.bottom});
      return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,boxes:boxes};
    });
    if(mobileNav.scrollWidth > mobileNav.width || mobileNav.boxes.some(function(box){ return box.left < 0 || box.right > mobileNav.width; })) throw new Error('课程筛选导航在手机宽度下溢出：'+JSON.stringify(mobileNav));
    await page.setViewportSize({width:1280, height:900});
    await page.locator('#tabCourses').click();
    var story = page.locator('.course-card').filter({hasText:'加入测试图文课'});
    await story.waitFor();
    await clickCourseAction(story, '加入学习');
    await page.waitForFunction(function(){ return CourseEnrollment.isJoined('package:enrollment-story-fixture'); });
    await page.locator('#courseViewJoined').click();
    story = page.locator('.course-card').filter({hasText:'加入测试图文课'});
    var firstLeaveStory = await openCourseAction(story, '移出学习');
    var secondTab = await context.newPage();
    await secondTab.route('**/api/**', function(route){ route.abort('failed'); });
    await secondTab.goto(BASE+'/decks.html?e2e=enrollment-second-tab&courseView=joined', {waitUntil:'domcontentloaded'});
    await secondTab.waitForSelector('#tabCourses', {state:'attached'});
    await secondTab.locator('#tabCourses').click();
    await secondTab.locator('#courseViewJoined').click();
    var secondStory = secondTab.locator('.course-card').filter({hasText:'加入测试图文课'});
    await openCourseAction(secondStory, '移出学习');
    await firstLeaveStory.click();
    await page.waitForFunction(function(){ return !CourseEnrollment.isJoined('package:enrollment-story-fixture'); });
    await secondTab.reload({waitUntil:'domcontentloaded'});
    await secondTab.waitForFunction(function(){ return window.decksReady === true; });
    await secondTab.locator('#tabCourses').click();
    secondStory = secondTab.locator('.course-card').filter({hasText:'加入测试图文课'});
    await clickCourseAction(secondStory, '加入学习');
    await secondTab.waitForFunction(function(){ return CourseEnrollment.isJoined('package:enrollment-story-fixture'); });
    await page.waitForFunction(function(){ return CourseEnrollment.isJoined('package:enrollment-story-fixture'); });
    story = page.locator('.course-card').filter({hasText:'加入测试图文课'});
    await openCourseAction(story, '移出学习');
    await secondTab.close();
    var coexists = await page.evaluate(function(){
      var p=CL.readProgress();
      return p['enrollment-story-fixture'] && p['enrollment-story-fixture'].completed && CourseEnrollment.isJoined('package:enrollment-story-fixture');
    });
    if(!coexists) throw new Error('图文课加入状态覆盖了原有课程包进度');

    await page.goto(BASE+'/main.html?e2e=enrollment', {waitUntil:'domcontentloaded'});
    await page.waitForSelector('#homeBody > *', {timeout:15000});
    await page.waitForFunction(function(){ return document.querySelector('#homeBody').innerText.indexOf('加入测试图文课') >= 0; });
    if((await page.locator('#homeBody .home-courses').innerText()).indexOf('口语3000句') >= 0) throw new Error('未加入的内置课程错误显示在“我的课程”');
    if((await page.locator('#homeBody .home-courses').innerText()).indexOf('未加入导入测试课') >= 0) throw new Error('仅导入未加入的课程错误显示在“我的课程”');
    if(!(await page.locator('.hc-manage').getAttribute('href')).includes('courseView=joined')) throw new Error('首页“管理”未指向已加入课程视图');
    await page.evaluate(async function(){ await CourseEnrollment.leave('package:enrollment-story-fixture'); });
    await page.locator('#homeAddCourse').click();
    await page.waitForURL(/courseView=discover/);
    await page.waitForSelector('#courseViewDiscover[aria-current="page"]');

    await page.goto(BASE+'/decks.html?e2e=enrollment', {waitUntil:'domcontentloaded'});
    await page.waitForSelector('#tabCourses', {state:'attached'});
    await page.locator('#tabDecks').click();
    var oral = page.locator('#deckList .course-card').filter({hasText:'口语3000句'});
    await oral.waitFor();
    await clickCourseAction(oral, '加入学习');
    await page.waitForFunction(function(){ return CourseEnrollment.isJoined('builtin:oral'); });
    await page.locator('#courseViewJoined').click();
    oral = page.locator('#deckList .course-card').filter({hasText:'口语3000句'});
    const builtinJoinedAction = await openCourseAction(oral, '移出学习');
    if (await builtinJoinedAction.count() !== 1) throw new Error('内置课程的移出学习操作未收进菜单');
    if (await oral.getByRole('menuitem', {name:'用 AI 改编课程'}).count()) throw new Error('内置课程不应显示 AI 改编入口');
    if(await oral.getByRole('button', {name:'加入并开始'}).count()) throw new Error('课程卡片仍显示“加入并开始”');
    await oral.locator('.deck-cover').click();
    await page.waitForURL(/decks\.html\?.*course=builtin%3Aoral/);
    var imported = page.locator('#deckList .deck-item').filter({hasText:'未加入导入测试课'});
    await page.goto(BASE+'/decks.html?e2e=enrollment&courseView=joined&courseType=decks', {waitUntil:'domcontentloaded'});
    await page.waitForSelector('#tabDecks');
    await page.waitForFunction(function(){ return window.decksReady === true; });
    await clickCourseAction(imported, '加入学习');
    await page.waitForFunction(function(){ return CourseEnrollment.isJoined('user-deck:enrollment-imported-fixture'); });
    await page.goto(BASE+'/main.html?e2e=enrollment', {waitUntil:'domcontentloaded'});
    await page.waitForFunction(function(){ var t=document.querySelector('#homeBody').innerText; return t.indexOf('口语3000句')>=0 && t.indexOf('未加入导入测试课')>=0; });

    await page.goto(BASE+'/decks.html?e2e=enrollment&courseView=joined', {waitUntil:'domcontentloaded'});
    await page.waitForSelector('#tabDecks');
    var aiDeck = page.locator('#deckList .deck-item').filter({hasText:'AI 生成测试课程'});
    await aiDeck.waitFor();
    await clickCourseAction(aiDeck, '移出学习');
    await page.waitForFunction(function(){ return !CourseEnrollment.isJoined('package:enrollment-ai-fixture'); });
    await page.locator('#courseViewJoined').click();
    aiDeck = page.locator('#deckList .deck-item').filter({hasText:'AI 生成测试课程'});
    await clickCourseAction(aiDeck, '加入学习');
    await page.waitForFunction(function(){ return CourseEnrollment.isJoined('package:enrollment-ai-fixture'); });
    await page.goto(BASE+'/main.html?e2e=enrollment-ai', {waitUntil:'domcontentloaded'});
    await page.waitForFunction(function(){ return document.querySelector('#homeBody').innerText.indexOf('AI 生成测试课程') >= 0; });

    await page.evaluate(async function(){ await CourseEnrollment.leave('package:enrollment-ai-fixture'); });
    await page.goto(BASE+'/decks.html?e2e=enrollment&courseView=joined', {waitUntil:'domcontentloaded'});
    await page.waitForSelector('#tabCourses', {state:'attached'});
    await page.locator('#tabCourses').click();
    await page.locator('#courseViewJoined').click();
    story = page.locator('.course-card').filter({hasText:'加入测试图文课'});
    await clickCourseAction(story, '加入学习');
    await page.waitForFunction(function(){ return CourseEnrollment.isJoined('package:enrollment-story-fixture'); });
    story = page.locator('.course-card').filter({hasText:'加入测试图文课'});
    await clickCourseAction(story, '移出学习');
    await page.waitForFunction(function(){ return !CourseEnrollment.isJoined('package:enrollment-story-fixture'); });
    await page.waitForFunction(function(){ var p=CL.readProgress(); return p['enrollment-story-fixture'] && p['enrollment-story-fixture'].completed; });
    await page.locator('#courseViewJoined').click();
    story = page.locator('.course-card').filter({hasText:'加入测试图文课'});
    await clickCourseAction(story, '加入学习');
    await page.waitForFunction(function(){ return CourseEnrollment.isJoined('package:enrollment-story-fixture'); });
    await page.locator('#courseViewJoined').click();
    story = page.locator('.course-card').filter({hasText:'加入测试图文课'});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForSelector('#tabCourses');
    await page.locator('#tabCourses').click();
    story = page.locator('.course-card').filter({hasText:'加入测试图文课'});
    await openCourseAction(story, '移出学习');
    await story.locator('.deck-cover').click();
    await page.waitForURL(/courses\.html\?id=enrollment-story-fixture/);

    const finalAssets = await page.evaluate(function(){
      return JSON.stringify({ courses: CL.readCourses(), decks: CL.loadMem().decks });
    });
    if(finalAssets !== sourceAssets) throw new Error('选课流程改变了来源课程正文或元数据');
    console.log('[course-enrollment] sentence/story/imported course UI, explicit membership, leave/rejoin, progress coexistence and original asset preservation passed');
  }catch(error){
    console.error('[course-enrollment] failed:', error && error.stack || error.message || error);
    process.exitCode = 1;
  }finally{
    if(browser) await browser.close();
    stopServer();
  }
})();
