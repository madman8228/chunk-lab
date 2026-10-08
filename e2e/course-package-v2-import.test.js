'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');
const { waitForAsync } = require('./lib/wait-for-async');

const ROOT = path.resolve(__dirname, '..');
/* Chrome blocks 10080 as an unsafe port; keep the suite in an equivalent free range. */
const PORT = require('./lib/free-port').freePort(10150, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-course-package-v2-'));
const BASE = 'http://127.0.0.1:' + PORT;
const ZIP = process.env.COURSE_ZIP_V2 || path.resolve(ROOT, '..', 'courser-creator', 'tests', 'fixtures', 'course-v2-complete.zip');
const COURSE_ID = 'course_d50da551';
let server;

function startServer(protocol) {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, [Number(protocol || 2) === 2 ? 'testing/start-historical.js' : 'index.js'], { cwd: path.join(ROOT, 'server'), env: Object.assign({}, process.env, {
      CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test', CHUNKLAB_WRITE_PROTOCOL: String(protocol || 2)
    }), stdio: 'ignore' });
    var tries = 0;
    var timer = setInterval(function () {
      if (server.exitCode !== null) { clearInterval(timer); reject(new Error('server exit ' + server.exitCode)); return; }
      var req = http.get(BASE + '/api/health', function (res) { res.resume(); if (res.statusCode === 200) { clearInterval(timer); resolve(); } });
      req.on('error', function () {}); req.setTimeout(700, function () { req.destroy(); });
      if (++tries > 120) { clearInterval(timer); reject(new Error('server start timeout')); }
    }, 100);
  });
}
function restartServer(protocol) {
  return new Promise(function(resolve, reject){
    if (!server) return reject(new Error('isolated course server is not running'));
    var prior = server;
    prior.once('exit', function(){ server = null; startServer(protocol).then(resolve,reject); });
    prior.kill();
  });
}
function stopServer() { if (server) try { server.kill('SIGKILL'); } catch (e) {} try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {} }

(async function () {
  /* 外部依赖 fixture：course-v2-complete.zip 来自独立的 courser-creator 仓库，CI 检出环境不提供。
     条件化：fixture 存在才跑；不存在则显式 skip 并打印原因（绝不静默吞掉、绝不改成「找不到就跳过」）。 */
  if (!fs.existsSync(ZIP)) {
    console.log('[SKIP] e2e:course-package-v2-import 缺少 2.0 课程包 fixture：' + ZIP +
      '（courser-creator 为独立仓库，CI 检出环境不提供；请在本机放置该 zip 后重跑）');
    process.exit(0);
  }
  let browser;
  try {
    await startServer(2);
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    var page = await browser.newPage();
    var protocolOperations = [];
    var largeContentImports = [];
    var legacyWriteAttempts = new Map();
    var legacyWriteResponses = [];
    var protocol3PageReady = false;
    page.on('request', function(request){
      var requestUrl = new URL(request.url());
      if (request.method() !== 'GET' && ['/api/data', '/api/import'].includes(requestUrl.pathname)) {
        legacyWriteAttempts.set(request, { method: request.method(), path: requestUrl.pathname, afterProtocol3Ready: protocol3PageReady });
      }
      if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/api/content-import')) largeContentImports.push(request);
      if (request.method() !== 'POST' || !new URL(request.url()).pathname.endsWith('/api/operations')) return;
      try { var operation = JSON.parse(request.postData() || '{}'); if (operation.protocol === 3) protocolOperations.push(operation); }
      catch (_) { /* Malformed or unrelated requests are asserted through the server response. */ }
    });
    page.on('response', function(response){
      var request = response.request();
      var attempt = legacyWriteAttempts.get(request);
      if (attempt) legacyWriteResponses.push(Object.assign({}, attempt, { status: response.status() }));
    });
    page.on('console', function(message){ if (message.type() === 'error' || message.type() === 'warning') console.error('[course-package] browser:', message.text()); });
    page.on('pageerror', function(error){ console.error('[course-package] page error:', error.message); });
    if (process.env.COURSE_PACKAGE_PROTOCOL3 === '1') {
      await page.addInitScript(function(){
        if (!localStorage.getItem('chunklab.storage-owner.v1')) {
          localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin,'local']));
        }
      });
    }
    await page.goto(BASE + '/decks.html?e2e=course-package-v2', { waitUntil: 'networkidle' });
    var logicalId = await page.evaluate(function () { return LogicalCourseStore.create({ title: '2.0 回归目录', coverImage: 'data:image/png;base64,e2e-v2-cover' }).id; });
    await page.locator('#courseViewJoined').click();
    await page.locator('#btnImportDecks').click();
    await page.locator('#courseImportTypeMask:not([hidden])').waitFor({ state:'visible' });
    await page.locator('#btnImportStoryCourse').click();
    await page.locator('#ciLogicalCourse').selectOption(logicalId);
    await page.locator('#courseFileInput').setInputFiles(ZIP);
    await page.locator('#btnCourseImport').click();
    await page.waitForFunction(function () { return document.body.innerText.indexOf('导入完成') >= 0 || document.querySelector('#courseImpMsg.err'); }, { timeout: 45000 });
    var error = await page.locator('#courseImpMsg.err').count() ? await page.locator('#courseImpMsg').innerText() : '';
    if (error) throw new Error(error);
    var imported = await page.evaluate(async function () {
      await CL.preload();
      var item = CL.readCourses().find(function (course) { return course.courseId === 'course_d50da551'; });
      return item && item.schemaVersion === '2.0' && item.utterances.length === 2 && item.utterances[0].chunks.items.length === 2;
    });
    if (!imported) throw new Error('2.0 课程未按原始结构保存');
    await page.evaluate(async function (id) {
      var courses = CL.readCourses();
      var item = courses.find(function (course) { return course.courseId === id; });
      item.metadata.title = { en: 'Excuse Me! | A Handbag Conversation', 'zh-CN': '打扰一下！—手提包对话' };
      var utterance = item.utterances[0];
      utterance.chunks.items = [
        { id: 'word-is', text: 'Is' },
        { id: 'word-this', text: 'this' },
        { id: 'word-your', text: 'your' },
        { id: 'word-handbag', text: 'handbag?' }
      ];
      utterance.chunks.correctOrder = ['word-is', 'word-this', 'word-your', 'word-handbag'];
      utterance.chunks.distractors = [];
      var imageData = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#dce8f8"/></svg>');
      (item.assets || []).filter(function (asset) { return asset.type === 'story_image'; }).forEach(function (asset) { asset._dataUri = imageData; });
      await CL.writeCourses(courses);
    }, COURSE_ID);
    if (process.env.COURSE_PACKAGE_PROTOCOL3 === '1') {
      await page.evaluate(async function(id){
        var course = CL.readCourses().find(function(item){ return item.courseId === id; });
        if (!course) throw new Error('local imported course fixture is missing');
        // Explicit isolated legacy fixture setup, not a production client API.
        await ChunkAPI.request('/api/courses', {method:'POST',body:JSON.stringify({course:course})});
      }, COURSE_ID);
      var serverHasCourse = await page.evaluate(async function(id){
        var data = await ChunkAPI.getData();
        return Array.isArray(data.courses) && data.courses.some(function(course){ return course.courseId === id; });
      }, COURSE_ID);
      if (!serverHasCourse) throw new Error('protocol 2 test preparation failed to store the course fixture');
      await page.evaluate(function(){ return CL.waitForSync(); });
      await restartServer(3);
      var legacyFenceResponse=page.waitForResponse(function(response){
        var request=response.request(),url=new URL(response.url());
        return request.method()==='PUT'&&url.pathname==='/api/data';
      },{timeout:15000});
      var legacyFenceResult=await page.evaluate(async function(){
        try{
          // Deliberately probe the retired route after the isolated server upgrade.
          await ChunkAPI.request('/api/data',{method:'PUT',body:JSON.stringify(await ChunkAPI.getData())});
          return {rejected:false};
        }catch(error){return {rejected:true,code:error.code||'',message:error.message||String(error)};}
      });
      var legacyFenceHttpResponse=await legacyFenceResponse;
      if(legacyFenceHttpResponse.status()!==428||!legacyFenceResult.rejected)
        throw new Error('升级前兼容客户端写入必须被 428 fence 拒绝：'+JSON.stringify({status:legacyFenceHttpResponse.status(),result:legacyFenceResult}));
    }
    var course = await page.evaluate(async function () { await CL.preload(); return CL.readCourses().find(function (item) { return item.courseId === 'course_d50da551'; }); });
    await page.goto(BASE + '/courses.html?id=' + encodeURIComponent(COURSE_ID) + '&e2e=course-package-v2', { waitUntil: 'networkidle' });
    var courseScriptUrl = await page.locator('script[src^="course-package.js"]').getAttribute('src');
    var expectedCourseScriptHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'course-package.js'), 'utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 12);
    if (new URL(courseScriptUrl, BASE).searchParams.get('v') !== expectedCourseScriptHash) throw new Error('课程页面脚本缓存版本未随 course-package.js 内容更新');
    await page.waitForSelector('.mode-guide');
    await page.waitForFunction(function(){ return !!CL.getCloudConfig(); }, null, { timeout:15000 });
    var legacyBatchModuleLoaded = await page.evaluate(function(){ return !!window.BatchSync; });
    if (legacyBatchModuleLoaded)
      throw new Error('学习页面不应下载或初始化旧整账号上传模块，包括不支持的服务配置');
    if (process.env.COURSE_PACKAGE_PROTOCOL3 === '1') {
      await page.waitForFunction(function(){ return CL.getCloudConfig() && CL.getCloudConfig().writeProtocol === 3; }, null, { timeout:15000 });
      var startupReady = await page.evaluate(function(){ return {ready:CL.serverPersistenceReady(),config:CL.getCloudConfig()}; });
      if (!startupReady.ready) throw new Error('protocol 3 cloud startup did not become ready: ' + JSON.stringify(startupReady));
      protocol3PageReady = true;
    }
    await page.waitForSelector('[data-action="select-v2-mode"]');
    if ((await page.locator('#playerTitle').innerText()).trim() !== 'Excuse Me! | A Handbag Conversation' || (await page.locator('#playerTitleTranslation').innerText()).trim() !== '打扰一下！—手提包对话') throw new Error('播放器标题应以英文课程名为主，并显示课程包提供的中文释义');
    if ((await page.locator('#modeGuideTitle').innerText()).trim() !== '学习方式') throw new Error('练习方式区标题应简化为“学习方式”');
    var modeTitleColumnWidth = await page.locator('.mode-guide-top').evaluate(function (top) { return parseFloat(getComputedStyle(top).gridTemplateColumns.split(' ')[0]); });
    if (modeTitleColumnWidth > 160) throw new Error('学习方式标题列应收窄，避免占用过多横向空间');
    var desktopModeCardHeight = await page.locator('.mode-option').first().evaluate(function (option) { return option.getBoundingClientRect().height; });
    if (desktopModeCardHeight > 48) throw new Error('桌面答题方式卡片高度应压缩至 48px 以内');
    var initialProgress = await page.evaluate(function (id) { return CL.readProgress()[id] || null; }, COURSE_ID);
    if (initialProgress && (initialProgress.seen || []).length) throw new Error('答题模式引导页不应提前记录已看节点');
    var previewToggle = page.locator('#lessonPreviewToggle');
    if (await previewToggle.getAttribute('aria-expanded') !== 'false' || !(await page.locator('#lessonPreviewContent').evaluate(function (content) { return content.hidden; }))) throw new Error('课程预习内容初始应收起');
    await previewToggle.click();
    if (await previewToggle.getAttribute('aria-expanded') !== 'true' || await page.locator('#lessonPreviewContent').evaluate(function (content) { return content.hidden; })) throw new Error('点击预习标题后应展开内容并同步无障碍状态');
    var previewText = await page.locator('.lesson-preview').innerText();
    if (await page.locator('.lesson-preview-empty').count() !== 1 || await page.locator('.lesson-preview-row').count() !== 0 || previewText.indexOf('Excuse me!') >= 0) throw new Error('课程包没有词汇时，预习区不应拿课文台词替代');
    await previewToggle.click();
    await page.evaluate(async function (id) {
      var courses = CL.readCourses();
      var importedCourse = courses.find(function (item) { return item.courseId === id; });
      importedCourse.learningObjectives = importedCourse.learningObjectives || {};
      importedCourse.learningObjectives.vocabulary = [
        { id: 'preview-formal-handbag', term: 'handbag', preStudy: true, definition: { en: 'handbag', 'zh-CN': '手提包' }, partOfSpeech: 'n.', cefr: 'A1' },
        { id: 'preview-formal-ticket', term: 'ticket', preStudy: true, definition: { en: 'ticket', 'zh-CN': '票' }, partOfSpeech: 'n.', cefr: 'A1' },
        { id: 'preview-poststudy-only', term: 'post-study-only', preStudy: false, definition: { en: 'post-study-only', 'zh-CN': '课后词汇' }, cefr: 'A1' }
      ];
      importedCourse.authorNotes.vocabulary = ['note-only · different'];
      importedCourse.authorNotes.communicationGoals = ['礼貌地确认物品归属'];
      importedCourse.authorNotes.expressions = ['礼貌地引起他人注意'];
      importedCourse.authorNotes.sentencePatterns = ['Is this ...?'];
      importedCourse.authorNotes.grammar = ['代词 it 指代前文物品'];
      if (CL.getCloudConfig().writeProtocol === 3) {
        var confirmed = await ServerCache.read();
        var largeAsset=importedCourse.assets.find(function(asset){return asset.type==='story_image';});
        var largeSvg='<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><metadata>'+
          'x'.repeat(300000)+'</metadata><rect width="640" height="360" fill="#dce8f8"/></svg>';
        largeAsset._dataUri='data:image/svg+xml,'+encodeURIComponent(largeSvg);
        await ChunkCourse.saveCourse(importedCourse);
        if ((await ServerCache.read()).snapshot.courses.find(function(item){return item.courseId===id;}).assets
            .find(function(asset){return asset.type==='story_image';})._dataUri.length < 300000) throw new Error('大课程更新未在服务端确认完整内容');
        await ServerStore.submitCommitted('course.enrollment', {courseId:id,joined:true},
          {requestId:'catalog-enroll-' + Date.now()});
      }
      if (CL.getCloudConfig().writeProtocol === 3) await ChunkCourse.saveCourse(importedCourse);
      else await CL.writeCourses(courses);
    }, COURSE_ID);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.mode-guide');
    if (await page.locator('#lessonPreviewToggle').getAttribute('aria-expanded') !== 'false') throw new Error('课程预习区每次进入时都应默认收起');
    await page.locator('#lessonPreviewToggle').click();
    previewText = await page.locator('.lesson-preview').innerText();
    if (previewText.indexOf('handbag') < 0 || previewText.indexOf('ticket') < 0 || previewText.indexOf('note-only') >= 0 || previewText.indexOf('post-study-only') >= 0 || previewText.indexOf('Excuse me!') >= 0) throw new Error('预习区应只显示 learningObjectives.vocabulary 中标记 preStudy 的正式词汇');
    if (await page.locator('.lesson-preview-row').count() !== 2) throw new Error('预习词汇数量应与课程正式预习词汇一致');
    if ((await page.locator('.lesson-preview-row').first().locator('.lesson-preview-zh').innerText()).trim() !== '手提包' || (await page.locator('.lesson-preview-row').first().locator('.lesson-preview-role').innerText()).trim() !== '词性 n.') throw new Error('预习词条应显示课程包中的中文释义和词性');
    var desktopVocabularyColumns = await page.locator('.lesson-preview-list').evaluate(function (list) { return getComputedStyle(list).gridTemplateColumns.split(' ').length; });
    if (desktopVocabularyColumns < 2) throw new Error('桌面端预习词汇应采用多列紧凑排布');
    var lessonFocusText = await page.locator('.lesson-learning-focus').innerText();
    if (await page.locator('.lesson-focus-item').count() !== 4 || ['学习目标', '重点表达', '核心句型', '语法要点', '礼貌地确认物品归属', '礼貌地引起他人注意', 'Is this ...?', '代词 it 指代前文物品'].some(function (text) { return lessonFocusText.indexOf(text) < 0; })) throw new Error('预习页应完整显示课程包中的本课学习要点');
    var desktopLayout = await page.evaluate(function () {
      var modes = document.querySelector('.mode-guide-list').getBoundingClientRect();
      var preview = document.querySelector('.lesson-preview').getBoundingClientRect();
      var start = document.querySelector('[data-action="start-v2-learning"]').getBoundingClientRect();
      return { width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, modesBottom: modes.bottom, previewTop: preview.top, previewBottom: preview.bottom, startTop: start.top };
    });
    if (desktopLayout.scrollWidth > desktopLayout.width || desktopLayout.modesBottom >= desktopLayout.previewTop || desktopLayout.previewBottom >= desktopLayout.startTop) throw new Error('桌面端答题方式、预习区与开始操作布局顺序或宽度异常');
    await page.setViewportSize({ width: 1111, height: 932 });
    var intermediateLayout = await page.evaluate(function () {
      var list = document.querySelector('.lesson-preview-list');
      return { width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, vocabularyColumns: getComputedStyle(list).gridTemplateColumns.split(' ').length, focusText: document.querySelector('.lesson-learning-focus').innerText };
    });
    if (intermediateLayout.scrollWidth > intermediateLayout.width || intermediateLayout.vocabularyColumns !== 4 || intermediateLayout.focusText.indexOf('核心句型') < 0) throw new Error('中等桌面宽度下预习内容应保持紧凑、完整且无横向溢出');
    await page.setViewportSize({ width: 390, height: 844 });
    var mobileLayout = await page.evaluate(function () {
      var modeList = document.querySelector('.mode-guide-list'), modes = modeList.getBoundingClientRect();
      var preview = document.querySelector('.lesson-preview').getBoundingClientRect();
      var option = document.querySelector('.mode-option').getBoundingClientRect();
      return { width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, listWidth: modeList.clientWidth, listScrollWidth: modeList.scrollWidth, modeColumns: getComputedStyle(modeList).gridTemplateColumns.split(' ').length, modesBottom: modes.bottom, previewTop: preview.top, previewVisible: preview.width > 0 && preview.height > 0, optionHeight: option.height };
    });
    if (mobileLayout.scrollWidth > mobileLayout.width || mobileLayout.listScrollWidth > mobileLayout.listWidth + 1 || mobileLayout.modeColumns !== 3 || mobileLayout.modesBottom >= mobileLayout.previewTop || !mobileLayout.previewVisible) throw new Error('窄屏模式下选项应自动换列且课程预习区域可见，无横向滚动');
    if (mobileLayout.optionHeight > 48) throw new Error('窄屏答题方式卡片高度应压缩至 48px 以内');
    if(process.env.COURSE_PACKAGE_PROTOCOL3==='1'){
      var saveStatusLayouts=[];
      for(var saveStatusViewport of [{width:390,height:844},{width:810,height:844},{width:1280,height:800}]){
        await page.setViewportSize(saveStatusViewport);
        await page.evaluate(function(){window.dispatchEvent(new CustomEvent('server-store-state',{detail:{phase:'capacity',pending:0,blocked:0}}));});
        await page.waitForFunction(function(){var node=document.getElementById('chunklabSaveStatus');return node&&node.dataset.visible==='true';},{timeout:3000});
        var saveStatusLayout=await page.evaluate(function(){
          var status=document.getElementById('chunklabSaveStatus').getBoundingClientRect();
          var start=document.querySelector('[data-action="start-v2-learning"]').getBoundingClientRect();
          return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,status:{left:status.left,right:status.right,top:status.top,bottom:status.bottom},
            start:{left:start.left,right:start.right,top:start.top,bottom:start.bottom},pointerEvents:getComputedStyle(document.getElementById('chunklabSaveStatus')).pointerEvents,
            overlaps:status.left<start.right&&status.right>start.left&&status.top<start.bottom&&status.bottom>start.top};
        });
        if(saveStatusLayout.scrollWidth>saveStatusLayout.viewport||saveStatusLayout.overlaps||saveStatusLayout.pointerEvents!=='none')
          throw new Error('安全保存提示不得遮挡开始学习按钮或拦截触控，且不能制造横向滚动：'+JSON.stringify(saveStatusLayout));
        saveStatusLayouts.push(saveStatusLayout);
      }
      await page.evaluate(function(){window.dispatchEvent(new CustomEvent('server-store-state',{detail:{phase:'idle',pending:0,blocked:0}}));});
      console.log('[course-package] save-status responsive layouts: '+JSON.stringify(saveStatusLayouts));
    }
    if (process.env.MOBILE_GUIDE_390_SCREENSHOT) await page.screenshot({ path: process.env.MOBILE_GUIDE_390_SCREENSHOT, fullPage: true });
    await page.setViewportSize({ width: 480, height: 932 });
    var mobileGuideFit = await page.evaluate(function () {
      var page = document.documentElement, list = document.querySelector('.mode-guide-list');
      var stage = document.querySelector('.course-stage'), footer = document.querySelector('.player-foot');
      var start = document.querySelector('[data-action="start-v2-learning"]');
      var optionRects = Array.from(list.children).map(function (item) { return { width: Math.round(item.getBoundingClientRect().width), clientWidth: item.clientWidth, scrollWidth: item.scrollWidth }; });
      return { pageHeight: page.scrollHeight, viewportHeight: page.clientHeight, listWidth: list.clientWidth, listScrollWidth: list.scrollWidth, optionRects: optionRects, stageHeight: Math.round(stage.getBoundingClientRect().height), stageBottom: Math.round(stage.getBoundingClientRect().bottom), startBottom: Math.round(start.getBoundingClientRect().bottom), footerTop: Math.round(footer.getBoundingClientRect().top) };
    });
    if (mobileGuideFit.pageHeight > mobileGuideFit.viewportHeight + 1 || mobileGuideFit.listScrollWidth > mobileGuideFit.listWidth + 1 || mobileGuideFit.optionRects.some(function (item) { return item.width < 44 || item.scrollWidth > item.clientWidth + 1; }) || mobileGuideFit.stageHeight < 500 || mobileGuideFit.stageBottom > mobileGuideFit.footerTop + 1 || mobileGuideFit.footerTop - mobileGuideFit.stageBottom > 28) throw new Error('480px 手机引导页应无页面/答题方式横向滚动，选项应收缩，课程卡片需填满页头和页脚间的剩余高度：' + JSON.stringify(mobileGuideFit));
    if (mobileGuideFit.stageBottom - mobileGuideFit.startBottom < 12 || mobileGuideFit.stageBottom - mobileGuideFit.startBottom > 36) throw new Error('移动端开始学习按钮应贴近课程卡片底部，方便拇指操作：' + JSON.stringify(mobileGuideFit));
    if (process.env.MOBILE_GUIDE_480_SCREENSHOT) await page.screenshot({ path: process.env.MOBILE_GUIDE_480_SCREENSHOT, fullPage: true });
    var mobilePreviewMeta = await page.locator('.lesson-preview-row').first().evaluate(function (row) {
      var meaning = row.querySelector('.lesson-preview-zh').getBoundingClientRect();
      var partOfSpeech = row.querySelector('.lesson-preview-role');
      var role = partOfSpeech && partOfSpeech.getBoundingClientRect();
      var term = row.querySelector('.lesson-preview-en').getBoundingClientRect();
      var rowRect = row.getBoundingClientRect();
      return { meaningVisible: meaning.width > 0 && meaning.height > 0, roleVisible: !!(role && role.width > 0 && role.height > 0), roleFits: !!(role && role.left >= rowRect.left && role.right <= rowRect.right), roleNextToTerm: !!(role && role.left >= term.right && role.left - term.right <= 6 && Math.abs((role.top + role.bottom) / 2 - (term.top + term.bottom) / 2) <= 2), scrollWidth: row.scrollWidth, clientWidth: row.clientWidth };
    });
    if (!mobilePreviewMeta.meaningVisible || !mobilePreviewMeta.roleVisible || !mobilePreviewMeta.roleFits || !mobilePreviewMeta.roleNextToTerm || mobilePreviewMeta.scrollWidth > mobilePreviewMeta.clientWidth) throw new Error('窄屏预习词条应将词性紧跟单词显示，中文释义另起一行且不横向溢出：' + JSON.stringify(mobilePreviewMeta));
    var mobileVocabularyColumns = await page.locator('.lesson-preview-list').evaluate(function (list) { return getComputedStyle(list).gridTemplateColumns.split(' ').length; });
    var mobileVocabularyPositions = await page.locator('.lesson-preview-row').evaluateAll(function (rows) { return rows.slice(0, 2).map(function (row) { var rect = row.getBoundingClientRect(); return { x: rect.x, y: rect.y }; }); });
    if (mobileVocabularyColumns !== 2 || mobileVocabularyPositions[0].y !== mobileVocabularyPositions[1].y || mobileVocabularyPositions[0].x === mobileVocabularyPositions[1].x) throw new Error('移动端应将词汇并排压缩为两列');
    await page.setViewportSize({ width: 1280, height: 800 });
    if (await page.locator('[data-action="select-v2-mode"]').count() !== 5) throw new Error('2.0 未显示完整的五种练习方式');
    var initialModeOrder = await page.locator('[data-action="select-v2-mode"]').evaluateAll(function (buttons) { return buttons.slice(0, 2).map(function (button) { return button.dataset.mode; }); });
    if (initialModeOrder[0] !== 'chunkSelection' || initialModeOrder[1] !== 'typing') throw new Error('意群选择应排在输入方式左侧');
    if (await page.locator('[data-action="select-v2-mode"][data-mode="chunkSelection"]').getAttribute('aria-pressed') !== 'true' || !await page.locator('[data-action="start-v2-learning"]').isEnabled()) throw new Error('进入练习方式页面后应默认选中意群选择，并允许开始学习');
    if (await page.locator('[data-action="select-v2-mode"]:disabled').count() !== 3) throw new Error('跟读、角色扮演、听写应保持禁用');
    for (var unavailableMode of ['shadowing', 'roleplay', 'dictation']) {
      var unavailableButton = page.locator('[data-action="select-v2-mode"][data-mode="' + unavailableMode + '"]');
      if (await unavailableButton.isEnabled() || await unavailableButton.getAttribute('aria-pressed') !== 'false' || !((await unavailableButton.getAttribute('title') || '').indexOf('暂未开放') >= 0)) throw new Error(unavailableMode + ' 应禁用并说明暂未开放');
      await unavailableButton.evaluate(function (button) { button.click(); });
      if (await page.locator('[data-action="select-v2-mode"][data-mode="chunkSelection"]').getAttribute('aria-pressed') !== 'true' || !await page.locator('[data-action="start-v2-learning"]').isEnabled()) throw new Error('点击未开放方式不应改变默认练习方式');
    }
    for (var availableMode of ['typing', 'chunkSelection']) {
      if (!await page.locator('[data-action="select-v2-mode"][data-mode="' + availableMode + '"]').isEnabled()) throw new Error(availableMode + ' 应保持可选');
    }
    if (await page.locator('.mode-guide-intro').count()) throw new Error('答题方式标题下不应显示说明文字');
    if (await page.locator('.mode-option-copy small').count()) throw new Error('答题方式卡片不应显示小字说明');
    await page.locator('[data-action="select-v2-mode"][data-mode="chunkSelection"]').click();
    var selectedProgress = await page.evaluate(function (id) { return CL.readProgress()[id] || null; }, COURSE_ID);
    if (selectedProgress && (selectedProgress.seen || []).length) throw new Error('选择答题方式不应提前记录已看节点');
    await page.locator('[data-action="start-v2-learning"]').click();
    if (await page.locator('.mode-guide').count()) throw new Error('点击开始后仍停留在答题模式引导页');
    if (await page.locator('[data-action="select-v2-mode"]').count()) throw new Error('进入课程后不应在课程内容内再次显示答题方式');
    await page.setViewportSize({ width: 562, height: 932 });
    var mobileImageFit = await page.locator('.stage-image img').evaluate(function (image) {
      var imageRect = image.getBoundingClientRect(), frameRect = image.parentElement.getBoundingClientRect();
      return {
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        imageHeight: imageRect.height,
        frameHeight: frameRect.height,
        expectedHeight: imageRect.width * image.naturalHeight / image.naturalWidth
      };
    });
    if (!mobileImageFit.naturalWidth || Math.abs(mobileImageFit.imageHeight - mobileImageFit.expectedHeight) > 1 || Math.abs(mobileImageFit.imageHeight - mobileImageFit.frameHeight) > 1) throw new Error('移动端课程图片应按原始比例铺满图片框，不留上下灰边，也不拉伸或裁切：' + JSON.stringify(mobileImageFit));
    var mobileChunkBankLayout = await page.locator('.v2-word-bank').evaluate(function (bank) {
      var content = bank.closest('.stage-content');
      var contentRect = content.getBoundingClientRect();
      var style = getComputedStyle(content);
      var chips = Array.from(bank.querySelectorAll('.choice-chip'));
      var lastChip = chips[chips.length - 1].getBoundingClientRect();
      var bankRect = bank.getBoundingClientRect();
      var rows = {};
      chips.forEach(function (chip) {
        var rect = chip.getBoundingClientRect(), row = String(Math.round(rect.top));
        if (!rows[row]) rows[row] = { left: rect.left, right: rect.right };
        else { rows[row].left = Math.min(rows[row].left, rect.left); rows[row].right = Math.max(rows[row].right, rect.right); }
      });
      return { bankBottom: bankRect.bottom, bankCenter: (bankRect.left + bankRect.right) / 2, rows: Object.keys(rows).map(function (key) { return rows[key]; }), chipBottom: lastChip.bottom, usableBottom: contentRect.bottom - parseFloat(style.paddingBottom), scrollHeight: content.scrollHeight, clientHeight: content.clientHeight };
    });
    if (mobileChunkBankLayout.usableBottom - mobileChunkBankLayout.bankBottom > 5 || mobileChunkBankLayout.chipBottom > mobileChunkBankLayout.usableBottom + 1 || mobileChunkBankLayout.rows.some(function (row) { return Math.abs((row.left + row.right) / 2 - mobileChunkBankLayout.bankCenter) > 2; })) throw new Error('手机端待选词块应在答题栏底部完整可见，并按行水平居中：' + JSON.stringify(mobileChunkBankLayout));
    await page.setViewportSize({ width: 1280, height: 800 });
    if (await page.locator('.v2-current-turn .v2-chat-bubble').count() !== 1 || await page.locator('.v2-current-turn .v2-speaker-label').count() || await page.locator('.v2-chat-history').count()) throw new Error('气泡不应显示说话人序号；首次练习尚无已完成的对话历史');
    var firstUtterance = course.utterances.find(function (item) { return item.id === course.sequence[0]; });
    if (await page.locator('.v2-gap-slot').count() !== 4 || await page.locator('.v2-gap-slot').count() !== firstUtterance.chunks.correctOrder.length) throw new Error('四个目标单词应分别显示为四段气泡填空');
    var initialChunkOrder = await page.locator('[data-action="choose-v2-chunk"]').evaluateAll(function (buttons) { return buttons.map(function (button) { return button.dataset.chunkId; }); });
    if (initialChunkOrder.join('|') === firstUtterance.chunks.correctOrder.join('|')) throw new Error('意群选项至少应打乱一次，不能按正确答案顺序原样展示');
    var audioIcon = page.locator('.v2-audio-icon');
    if (await audioIcon.count() !== 0) throw new Error('意群尚未组装完成时不应显示音频图标');
    var gapStyle = await page.locator('.v2-gap-slot').first().evaluate(function (slot) {
      var style = getComputedStyle(slot);
      return { top: style.borderTopStyle, left: style.borderLeftStyle, bottom: style.borderBottomStyle, background: style.backgroundColor };
    });
    var translationBorderTop = await page.locator('.v2-chat-translation').evaluate(function (translation) { return getComputedStyle(translation).borderTopStyle; });
    if (gapStyle.top !== 'none' || gapStyle.left !== 'none' || gapStyle.bottom !== 'dashed' || gapStyle.background !== 'rgba(0, 0, 0, 0)' || translationBorderTop !== 'none') throw new Error('意群空位应保留分段虚线下划线，翻译区域不应显示灰色分隔线');
    var gapSegments = await page.locator('.v2-gap-slot').evaluateAll(function (slots) {
      return slots.map(function (slot) {
        var rect = slot.getBoundingClientRect();
        return { left: rect.left, right: rect.right, borderBottomStyle: getComputedStyle(slot).borderBottomStyle };
      });
    });
    if (gapSegments.some(function (segment, index) { return segment.borderBottomStyle !== 'dashed' || (index > 0 && segment.left - gapSegments[index - 1].right < 14); })) throw new Error('四段虚线下划线之间的空隙不足，视觉上会连成一条：' + JSON.stringify(gapSegments));
    if ((await page.locator('.v2-chat-line').innerText()).indexOf(firstUtterance.text.en) >= 0) throw new Error('意群练习的气泡不能直接泄露完整目标句');
    if (await page.locator('.v2-chat-translation').count() !== 1 || (await page.locator('.v2-chat-translation').innerText()).startsWith('译') || await page.locator('.v2-word-bank').count() !== 1) throw new Error('意群练习应直接显示翻译内容，并在下方提供词块选项');
    if (await page.locator('.v2-word-bank-head').count() || (await page.locator('.v2-interaction').innerText()).includes('词块区')) throw new Error('词块选项上方不应显示冗余标题');
    var chunkBankLayout = await page.locator('.v2-word-bank').evaluate(function (bank) {
      var content = bank.closest('.stage-content');
      var bankRect = bank.getBoundingClientRect();
      var chips = Array.from(bank.querySelectorAll('.choice-chip'));
      var lastChipRect = chips[chips.length - 1].getBoundingClientRect();
      var contentRect = content.getBoundingClientRect();
      var style = getComputedStyle(content);
      return { bankBottom: bankRect.bottom, lastChipBottom: lastChipRect.bottom, usableBottom: contentRect.bottom - parseFloat(style.paddingBottom), contentBottom: contentRect.bottom };
    });
    if (chunkBankLayout.lastChipBottom > chunkBankLayout.usableBottom + 1 || chunkBankLayout.bankBottom > chunkBankLayout.usableBottom + 1) throw new Error('词块按钮必须完整显示在答题栏底部留白之上：' + JSON.stringify(chunkBankLayout));
    if (await page.locator('[data-action="reset-v2-chunks"]').count() || await page.getByRole('button', { name: '清空', exact: true }).count()) throw new Error('意群练习不应显示冗余的清空按钮');
    if (await page.locator('[data-action="submit-v2"]').count()) throw new Error('意群练习不应显示手动检查按钮');
    if(process.env.COURSE_PACKAGE_PROTOCOL3==='1') await page.evaluate(function(){
      sessionStorage.setItem('__courseProgressLegacyWriteCount','0');
      var write=CL.writeProgress;
      CL.writeProgress=function(value){
        var count=Number(sessionStorage.getItem('__courseProgressLegacyWriteCount')||0)+1;
        sessionStorage.setItem('__courseProgressLegacyWriteCount',String(count));
        var stacks=JSON.parse(sessionStorage.getItem('__courseProgressLegacyWriteStacks')||'[]');
        stacks.push(String(new Error('legacy progress write').stack||''));
        sessionStorage.setItem('__courseProgressLegacyWriteStacks',JSON.stringify(stacks));
        return write.call(CL,value);
      };
    });
    var availableChunk = page.locator('[data-action="choose-v2-chunk"]').first();
    var availableChunkText = (await availableChunk.innerText()).trim();
    await availableChunk.click();
    var remainingChunkOrder = await page.locator('[data-action="choose-v2-chunk"]').evaluateAll(function (buttons) { return buttons.map(function (button) { return button.dataset.chunkId; }); });
    if (remainingChunkOrder.join('|') !== initialChunkOrder.slice(1).join('|')) throw new Error('选择词块触发重绘后，剩余选项顺序不应跳动');
    if ((await page.locator('.v2-gap-slot').first().innerText()).trim() !== availableChunkText) throw new Error('选择词块后没有填入气泡的下一个空位');
    if (await audioIcon.count() !== 0) throw new Error('意群尚未组装完成时不应显示句尾音频图标');
    var filledChunkLayout = await page.locator('.v2-gap-slot.filled').evaluate(function (slot) {
      var bubble = slot.closest('.v2-chat-bubble');
      var chosenStyle = getComputedStyle(slot), answerStyle = getComputedStyle(slot.closest('.v2-chat-line'));
      return { slotWidth: slot.clientWidth, slotScrollWidth: slot.scrollWidth, bubbleWidth: bubble.clientWidth, bubbleScrollWidth: bubble.scrollWidth, chosenFontSize: chosenStyle.fontSize, answerFontSize: answerStyle.fontSize, chosenFontWeight: chosenStyle.fontWeight, answerFontWeight: answerStyle.fontWeight };
    });
    if (process.env.CHUNK_TYPOGRAPHY_SCREENSHOT) await page.screenshot({ path: process.env.CHUNK_TYPOGRAPHY_SCREENSHOT, fullPage: true });
    if (filledChunkLayout.chosenFontSize !== filledChunkLayout.answerFontSize || filledChunkLayout.chosenFontWeight !== filledChunkLayout.answerFontWeight) throw new Error('已选 chunk 应立即采用完整答案的字号和字重，避免全部选完时样式跳变：' + JSON.stringify(filledChunkLayout));
    if (filledChunkLayout.slotScrollWidth > filledChunkLayout.slotWidth + 1 || filledChunkLayout.bubbleScrollWidth > filledChunkLayout.bubbleWidth + 1) throw new Error('已填词块及完整答题气泡不应发生文字横向溢出');
    await page.locator('.v2-gap-slot.filled').click();
    if (await page.locator('.v2-gap-slot.filled').count() !== 0) throw new Error('点击已填空位后应撤回该词块及后续选择');
    var incorrectOrder = firstUtterance.chunks.correctOrder.slice();
    if (incorrectOrder.length < 2) throw new Error('自动检查测试需要至少两个意群');
    var firstExpectedChunk = incorrectOrder[0];
    incorrectOrder[0] = incorrectOrder[1];
    incorrectOrder[1] = firstExpectedChunk;
    for (var chunkIndex = 0; chunkIndex < incorrectOrder.length; chunkIndex++) {
      await page.locator('[data-action="choose-v2-chunk"][data-chunk-id="' + incorrectOrder[chunkIndex] + '"]').click();
    }
    var currentChunkError = page.locator('.v2-current-turn .v2-chat-bubble.v2-chat-error');
    var historyChunkError = page.locator('.v2-chat-history .v2-chat-bubble.v2-chat-error, .v2-chat-history .v2-chat-bubble.v2-chat-shake');
    var chunkErrorStyle = await currentChunkError.evaluate(function (bubble) { var style = getComputedStyle(bubble); return { borderColor: style.borderColor, backgroundColor: style.backgroundColor }; });
    if (await currentChunkError.count() !== 1 || await historyChunkError.count() || chunkErrorStyle.borderColor !== 'rgb(182, 72, 62)' || chunkErrorStyle.backgroundColor !== 'rgb(253, 242, 240)' || await page.locator('.node-feedback').count() || await page.locator('[data-action="submit-v2"]').count()) throw new Error('错序时应只将当前答题气泡标红并摇动，不应影响历史气泡或显示冗余文字提示');
    var availableChunksAfterError = await page.locator('[data-action="choose-v2-chunk"]').count();
    if (availableChunksAfterError !== firstUtterance.chunks.items.length + firstUtterance.chunks.distractors.length || await page.locator('.v2-gap-slot.filled').count() || await audioIcon.count()) throw new Error('意群答案错误后应清空已选词块、恢复全部选项并隐藏音频按钮');
    await page.locator('[data-action="choose-v2-chunk"][data-chunk-id="' + firstUtterance.chunks.correctOrder[0] + '"]').click();
    if (await page.locator('.v2-current-turn .v2-chat-bubble.v2-chat-error').count() || await page.locator('.v2-gap-slot.filled').count() !== 1) throw new Error('重新选择词块后应清除错误样式并开始新的作答');
    await page.locator('.v2-gap-slot.filled').first().click();
    if (await page.locator('.v2-gap-slot.filled').count() !== 0 || await audioIcon.count() !== 0) throw new Error('撤回词块应继续清除已填内容并隐藏句尾音频图标');
    await page.setViewportSize({ width: 562, height: 620 });
    for (var correctChunkIndex = 0; correctChunkIndex < firstUtterance.chunks.correctOrder.length; correctChunkIndex++) {
      await page.locator('[data-action="choose-v2-chunk"][data-chunk-id="' + firstUtterance.chunks.correctOrder[correctChunkIndex] + '"]').click();
    }
    if (await audioIcon.count() !== 1 || (await audioIcon.innerText()).trim() || await audioIcon.locator('svg').count() !== 1) throw new Error('正确组装句子后应显示无文字的 SVG 音频图标');
    if (await page.locator('.node-feedback').count() || await page.locator('[data-action="advance-v2"]').count()) throw new Error('意群答对后不应显示正确提示或手动下一句按钮');
    var inlineAudioLocation = await audioIcon.evaluate(function (button) {
      return { parentClass: button.parentElement.className, isLastInSentence: button.parentElement.lastElementChild === button };
    });
    if (inlineAudioLocation.parentClass !== 'v2-chat-line' || !inlineAudioLocation.isLastInSentence) throw new Error('音频图标应紧跟在已组装完成的英文句子后');
    var nextUtterance = course.utterances.find(function (item) { return item.id === course.sequence[1]; });
    await page.waitForFunction(function (translation) { var current = document.querySelector('.v2-current-turn .v2-chat-translation'); return current && current.textContent.trim() === translation; }, nextUtterance.text['zh-CN'], { timeout: 5000 });
    if (await page.locator('.node-feedback').count() || await page.locator('[data-action="advance-v2"]').count() || (await page.locator('.v2-chat-history .v2-chat-line').last().innerText()).trim() !== firstUtterance.acceptedAnswers.en[0]) throw new Error('组装正确后应自动进入下一题，并将正确句子收入对话历史');
    var mobileLatestTurn = await page.evaluate(function () {
      var content = document.querySelector('.stage-content');
      var history = content.querySelector('.v2-chat-history');
      var current = content.querySelector('.v2-current-turn').getBoundingClientRect();
      var bank = content.querySelector('.v2-chunk-exercise').getBoundingClientRect();
      var contentRect = content.getBoundingClientRect();
      return {
        scrollTop: content.scrollTop,
        maxScrollTop: content.scrollHeight - content.clientHeight,
        contentTop:contentRect.top, contentBottom:contentRect.bottom,
        currentTop:current.top, currentBottom:current.bottom,
        bankTop:bank.top, bankBottom:bank.bottom,
        historyOverflowY: getComputedStyle(history).overflowY,
        historyMaxHeight: parseFloat(getComputedStyle(history).maxHeight),
        currentVisible: current.top >= contentRect.top - 1 && current.bottom <= contentRect.bottom + 1,
        bankVisible: bank.top >= contentRect.top - 1 && bank.bottom <= contentRect.bottom + 1
      };
    });
    if (mobileLatestTurn.historyOverflowY !== 'auto' || !Number.isFinite(mobileLatestTurn.historyMaxHeight) || mobileLatestTurn.historyMaxHeight <= 0 || mobileLatestTurn.maxScrollTop <= 0 || !mobileLatestTurn.currentVisible || !mobileLatestTurn.bankVisible) throw new Error('移动端历史对话应限制在短滚动区，自动将最新答题气泡与词块保持可见：' + JSON.stringify(mobileLatestTurn));
    if (process.env.MOBILE_LATEST_TURN_SCREENSHOT) await page.screenshot({ path: process.env.MOBILE_LATEST_TURN_SCREENSHOT, fullPage: true });
    var completedAudio = page.locator('.v2-chat-history .v2-audio-icon');
    if (await completedAudio.count() !== 1 || !(await completedAudio.getAttribute('data-audio-url'))) throw new Error('已答完的历史气泡应继续保留可播放音频');
    var completedAnswerStyle = await completedAudio.evaluate(function (button) { var style = getComputedStyle(button.parentElement); return { fontSize: style.fontSize, fontWeight: style.fontWeight }; });
    if (completedAnswerStyle.fontSize !== filledChunkLayout.chosenFontSize || completedAnswerStyle.fontWeight !== filledChunkLayout.chosenFontWeight) throw new Error('已选 chunk 与收入历史的完整答案应保持相同字号和字重：' + JSON.stringify({ selected: filledChunkLayout, completed: completedAnswerStyle }));
    var completedLineAlignment = await completedAudio.evaluate(function (button) {
      var line = button.parentElement, range = document.createRange();
      range.selectNodeContents(line.firstChild);
      var textRect = range.getBoundingClientRect(), audioRect = button.getBoundingClientRect(), style = getComputedStyle(line);
      return { display: style.display, alignItems: style.alignItems, centerDelta: Math.abs((textRect.top + textRect.bottom - audioRect.top - audioRect.bottom) / 2) };
    });
    if (completedLineAlignment.display !== 'flex' || completedLineAlignment.alignItems !== 'center' || completedLineAlignment.centerDelta > 1) throw new Error('已完成气泡中的英文句子与喇叭应垂直居中对齐：' + JSON.stringify(completedLineAlignment));
    await page.setViewportSize({ width: 390, height: 844 });
    var mobileLineAlignment = await completedAudio.evaluate(function (button) { var line = button.parentElement, style = getComputedStyle(line), bubble = line.closest('.v2-chat-bubble').getBoundingClientRect(); return { display: style.display, alignItems: style.alignItems, bubbleRight: bubble.right }; });
    if (mobileLineAlignment.display !== 'flex' || mobileLineAlignment.alignItems !== 'center' || mobileLineAlignment.bubbleRight > 390) throw new Error('窄屏历史气泡也应保持垂直居中且不横向溢出：' + JSON.stringify(mobileLineAlignment));
    await page.setViewportSize({ width: 586, height: 932 });
    var mobileVerticalScroll = await page.evaluate(function () {
      var history = document.querySelector('.v2-chat-history'), turn = history.querySelector('.v2-history-turn');
      for (var copy = 0; copy < 9; copy++) history.appendChild(turn.cloneNode(true));
      var content = document.querySelector('.stage-content'), stage = document.querySelector('.course-stage');
      var bank = document.querySelector('.v2-chunk-exercise');
      var result = { viewportHeight: innerHeight, documentHeight: document.documentElement.scrollHeight, documentClientHeight: document.documentElement.clientHeight,
        historyOverflowY:getComputedStyle(history).overflowY, historyHeight:history.clientHeight, historyScrollHeight:history.scrollHeight,
        stageBottom: stage.getBoundingClientRect().bottom };
      history.scrollTop = history.scrollHeight;
      var bankRect = bank.getBoundingClientRect(), contentRect = content.getBoundingClientRect();
      result.bankVisibleAtScrollEnd = bankRect.top >= contentRect.top - 1 && bankRect.bottom <= contentRect.bottom + 1;
      result.historyAtBottom = history.scrollTop + history.clientHeight >= history.scrollHeight - 1;
      history.scrollTop = 0;
      return result;
    });
    if (process.env.MOBILE_SCROLL_SCREENSHOT) await page.screenshot({ path: process.env.MOBILE_SCROLL_SCREENSHOT, fullPage: true });
    await page.evaluate(function () { Array.from(document.querySelectorAll('.v2-chat-history .v2-history-turn')).slice(1).forEach(function (clone) { clone.remove(); }); });
    if (mobileVerticalScroll.documentHeight > mobileVerticalScroll.documentClientHeight + 1 || mobileVerticalScroll.historyOverflowY !== 'auto' || mobileVerticalScroll.historyScrollHeight <= mobileVerticalScroll.historyHeight || !mobileVerticalScroll.historyAtBottom || !mobileVerticalScroll.bankVisibleAtScrollEnd) throw new Error('移动端长对话应在限高的历史区独立滚动，整页不增高且答题区保持可见：' + JSON.stringify(mobileVerticalScroll));
    await page.setViewportSize({ width: 1280, height: 720 });
    var completedAudioLocation = await completedAudio.evaluate(function (button) { return { parentClass: button.parentElement.className, isLastInSentence: button.parentElement.lastElementChild === button }; });
    if (completedAudioLocation.parentClass !== 'v2-chat-line' || !completedAudioLocation.isLastInSentence) throw new Error('已答完气泡的音频按钮应紧跟在英文句子末尾');
    await page.evaluate(async function (id) {
      var progress = CL.readProgress();
      delete progress[id];
      if (typeof CL.adoptServerProgressProjection === 'function') await CL.adoptServerProgressProjection(progress);
      else await CL.writeProgress(progress);
    }, COURSE_ID);
    await page.locator('#btnRestart').click();
    await page.waitForSelector('.mode-guide');
    await page.locator('[data-action="select-v2-mode"][data-mode="typing"]').click();
    await page.locator('[data-action="start-v2-learning"]').click();
    await page.waitForSelector('#v2Answer');
    if (await page.locator('.v2-typing-exercise .exercise-label').count()) throw new Error('输入模式不应重复显示“输入”标签');
    var expectedTypingWords = firstUtterance.acceptedAnswers.en[0].trim().split(/\s+/).length;
    var typingSlots = page.locator('.v2-typing-slots .v2-gap-slot');
    var actualTypingSlots = await typingSlots.count();
    if (actualTypingSlots !== expectedTypingWords) throw new Error('输入模式气泡下划线数量应与英文答案单词数一致：' + actualTypingSlots + '/' + expectedTypingWords + '，当前句=' + await page.locator('.v2-current-turn .v2-chat-line').innerText());
    if (await typingSlots.first().evaluate(function (slot) { return getComputedStyle(slot).borderBottomStyle; }) !== 'dashed') throw new Error('输入模式气泡空位应使用分段虚线下划线');
    var stageColumns = await page.locator('.course-stage').evaluate(function (stage) {
      var rect = stage.getBoundingClientRect();
      var image = stage.querySelector('.stage-image').getBoundingClientRect();
      var content = stage.querySelector('.stage-content').getBoundingClientRect();
      return { width: rect.width, imageWidth: image.width, contentWidth: content.width };
    });
    if (Math.abs(stageColumns.imageWidth - stageColumns.contentWidth) > 1) throw new Error('课程图片区与答题区应各占 50% 宽度');
    var typingDock = await page.locator('.v2-typing-exercise').evaluate(function (exercise) {
      var content = exercise.closest('.stage-content');
      var exerciseRect = exercise.getBoundingClientRect();
      var contentRect = content.getBoundingClientRect();
      return { top: exerciseRect.top, bottomGap: contentRect.bottom - parseFloat(getComputedStyle(content).paddingBottom) - exerciseRect.bottom };
    });
    if (typingDock.bottomGap < -1 || typingDock.bottomGap > 16) throw new Error('输入答题区应锚定在课程内容栏底部：' + JSON.stringify(typingDock));
    await page.setViewportSize({ width: 390, height: 844 });
    var mobileTypingLayout = await page.evaluate(function () {
      var exercise = document.querySelector('.v2-typing-exercise').getBoundingClientRect();
      var input = document.querySelector('#v2Answer').getBoundingClientRect();
      var submit = document.querySelector('[data-action="submit-v2"]').getBoundingClientRect();
      return { width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, exerciseRight: exercise.right, inputRight: input.right, submitRight: submit.right };
    });
    if (mobileTypingLayout.scrollWidth > mobileTypingLayout.width || mobileTypingLayout.exerciseRight > mobileTypingLayout.width || mobileTypingLayout.inputRight > mobileTypingLayout.width || mobileTypingLayout.submitRight > mobileTypingLayout.width) throw new Error('窄屏输入答题区发生横向溢出：' + JSON.stringify(mobileTypingLayout));
    await page.setViewportSize({ width: 1280, height: 800 });
    for (var i = 0; i < course.sequence.length; i++) {
      var utterance = course.utterances.find(function (item) { return item.id === course.sequence[i]; });
      var expectedSide = course.roles.findIndex(function (role) { return role.id === utterance.roleId; }) % 2 ? 'right' : 'left';
      if (!await page.locator('.v2-current-turn').getAttribute('class').then(function (value) { return value.split(/\s+/).indexOf(expectedSide) >= 0; })) throw new Error('对话气泡未按说话人交替左右排列');
      if (i === 0) {
        for (var failedAttempt = 1; failedAttempt <= 3; failedAttempt++) {
          await page.locator('#v2Answer').fill('intentionally incorrect answer');
          await page.locator('[data-action="submit-v2"]').click();
          if (failedAttempt < 3 && await page.locator('.v2-typing-hint').count()) throw new Error('手动输入答错未满 3 次时不应提前显示提示');
          if (failedAttempt < 3 && await page.locator('.v2-typing-exercise .node-feedback.bad').count() !== 1) throw new Error('输入答错未满 3 次时应显示错误反馈');
        }
        var typingHint = page.locator('.v2-typing-hint');
        if (await page.locator('.v2-typing-exercise .node-feedback.bad').count() || await typingHint.count() !== 1 || (await typingHint.innerText()).trim() !== firstUtterance.acceptedAnswers.en[0] || await typingHint.getAttribute('role') !== 'status') throw new Error('连续答错 3 次后应直接显示完整正确句子，不再重复显示错误提示');
        if (await page.locator('#v2Answer').inputValue() !== 'intentionally incorrect answer') throw new Error('显示提示时应保留用户输入，便于继续修改');
      }
      await page.locator('#v2Answer').fill(utterance.acceptedAnswers.en[0]);
      await page.locator('[data-action="submit-v2"]').click();
      if ((await page.locator('.v2-current-turn .v2-chat-line').innerText()).trim() !== utterance.acceptedAnswers.en[0]) throw new Error('答对后应先将用户输入的英文句子显示在对话气泡中');
      if (await page.locator('.node-feedback').count() || await page.locator('[data-action="advance-v2"]').count() || await page.locator('[data-action="confirm-v2"]').count() || await page.locator('.v2-typing-exercise').count()) throw new Error('输入答对后不应显示底部正确提示、输入框或其他手动继续按钮');
      if (i < course.sequence.length - 1) {
        await page.waitForSelector('#v2Answer', { timeout: 5000 });
        var historyCount = await page.locator('.v2-chat-history .v2-history-turn').count();
        if (historyCount !== i + 1 || (await page.locator('.v2-chat-history .v2-chat-line').last().innerText()).trim() !== utterance.acceptedAnswers.en[0]) throw new Error('进入下一句后，刚完成的气泡必须留在对话历史中');
        if (await page.locator('.v2-chat-history .v2-speaker-label').count()) throw new Error('已完成气泡不应重复显示说话人和序号');
        if (await page.locator('.v2-current-turn .v2-speaker-label').count()) throw new Error('当前气泡不应显示说话人和序号');
        var historyToCurrentGap = await page.locator('.v2-chat-history').evaluate(function (history) {
          return document.querySelector('.v2-current-turn').getBoundingClientRect().top - history.getBoundingClientRect().bottom;
        });
        if (historyToCurrentGap < 0 || historyToCurrentGap > 16) throw new Error('当前气泡应紧接历史对话，不应因历史区被拉伸而产生大段空白：' + historyToCurrentGap);
        var compactBubble = await page.locator('.v2-history-turn').first().evaluate(function (turn) {
          var bubble = turn.querySelector('.v2-chat-bubble');
          return { height: bubble.getBoundingClientRect().height, paddingTop: parseFloat(getComputedStyle(bubble).paddingTop), paddingBottom: parseFloat(getComputedStyle(bubble).paddingBottom), gap: parseFloat(getComputedStyle(turn).marginBottom) };
        });
        if (compactBubble.height > 48 || compactBubble.paddingTop > 3 || compactBubble.paddingBottom > 2 || compactBubble.gap > 8) throw new Error('历史对话气泡本体与行间距应保持紧凑：' + JSON.stringify(compactBubble));
        var historyScroll = await page.locator('.v2-chat-history').evaluate(function (history) {
          var turn = history.querySelector('.v2-history-turn');
          for (var copy = 0; copy < 8; copy++) history.appendChild(turn.cloneNode(true));
          history.scrollTop = history.scrollHeight;
          var style = getComputedStyle(history);
          var result = { overflow: style.overflowY, maxHeight: parseFloat(style.maxHeight), clientHeight: history.clientHeight, scrollHeight: history.scrollHeight, atBottom: history.scrollTop + history.clientHeight >= history.scrollHeight - 1 };
          Array.prototype.slice.call(history.querySelectorAll('.v2-history-turn')).slice(1).forEach(function (node) { node.remove(); });
          history.scrollTop = 0;
          return result;
        });
        if (historyScroll.overflow !== 'auto' || !Number.isFinite(historyScroll.maxHeight) || historyScroll.scrollHeight <= historyScroll.clientHeight || !historyScroll.atBottom) throw new Error('对话记录超过可视高度后应在独立滚动区内滚动并能定位到最新气泡：' + JSON.stringify(historyScroll));
      } else await page.waitForSelector('.end-mark', { timeout: 5000 });
    }
    await page.waitForSelector('.end-mark');
    if (await page.locator('.v2-completion .v2-history-turn').count() !== course.sequence.length) throw new Error('课程完成后应保留全部已完成的对话气泡');
    if (await page.locator('.v2-completion .v2-speaker-label').count()) throw new Error('完成页对话历史不应重复显示说话人和序号');
    if (await page.locator('#playerCount').innerText() !== '2') throw new Error('2.0 完成后进度计数不是 2');
    if (await page.locator('.v2-completion-card h2').innerText() !== '学习完成' || await page.locator('.v2-completion-conversation-title').innerText() !== '本课对话') throw new Error('完成页应清晰区分完成结果与对话回顾');
    if (await page.locator('.v2-completion-card .node-copy').count() || await page.locator('.v2-completion-heading .end-mark').count() !== 1) throw new Error('完成页不应重复说明完成状态，勾号应与标题同行');
    if (await page.locator('.v2-completion-card [data-action="restart"]').getAttribute('class') !== 'action-button primary' || await page.locator('.v2-completion-card [data-action="back-library"]').getAttribute('class') !== 'action-button') throw new Error('再学一次应为完成页主操作，返回课程库为次操作');
    await page.setViewportSize({ width: 1111, height: 932 });
    var desktopCompletionLayout = await page.evaluate(function () {
      var history = document.querySelector('.v2-completion-conversation').getBoundingClientRect();
      var card = document.querySelector('.v2-completion-card').getBoundingClientRect();
      return { display: getComputedStyle(document.querySelector('.v2-completion')).display, historyRight: history.right, historyTop: history.top, cardLeft: card.left, cardTop: card.top };
    });
    if (desktopCompletionLayout.display !== 'grid' || desktopCompletionLayout.cardLeft < desktopCompletionLayout.historyRight - 1 || desktopCompletionLayout.historyTop >= desktopCompletionLayout.cardTop) throw new Error('桌面完成页应将置顶对话回顾与完成操作分区呈现：' + JSON.stringify(desktopCompletionLayout));
    if (process.env.COURSE_COMPLETION_SCREENSHOT) await page.screenshot({ path: process.env.COURSE_COMPLETION_SCREENSHOT, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    var mobileCompletionLayout = await page.evaluate(function () {
      var card = document.querySelector('.v2-completion-card').getBoundingClientRect();
      var history = document.querySelector('.v2-completion-conversation').getBoundingClientRect();
      var heading = document.querySelector('.v2-completion-heading').getBoundingClientRect();
      var title = document.querySelector('.v2-completion-heading h2').getBoundingClientRect();
      var mark = document.querySelector('.v2-completion-heading .end-mark').getBoundingClientRect();
      return { display: getComputedStyle(document.querySelector('.v2-completion')).display, cardBottom: card.bottom, historyTop: history.top, cardCenter: card.left + card.width / 2, headingCenter: heading.left + heading.width / 2, cardRight: card.right, titleCenter: title.top + title.height / 2, markCenter: mark.top + mark.height / 2, markLeft: mark.left, titleRight: title.right };
    });
    if (mobileCompletionLayout.display !== 'flex' || mobileCompletionLayout.cardBottom > mobileCompletionLayout.historyTop || mobileCompletionLayout.cardRight > 390 || Math.abs(mobileCompletionLayout.headingCenter - mobileCompletionLayout.cardCenter) > 1 || Math.abs(mobileCompletionLayout.titleCenter - mobileCompletionLayout.markCenter) > 1 || mobileCompletionLayout.markLeft < mobileCompletionLayout.titleRight || mobileCompletionLayout.markLeft - mobileCompletionLayout.titleRight > 12) throw new Error('窄屏完成页应将标题与勾号作为组合整体水平居中，且勾号紧邻标题同行，并先显示操作、再显示可滚动的对话回顾：' + JSON.stringify(mobileCompletionLayout));
    if (process.env.COURSE_COMPLETION_SCREENSHOT) await page.screenshot({ path: process.env.COURSE_COMPLETION_SCREENSHOT.replace(/\.png$/i, '-mobile.png'), fullPage: true });
    if (process.env.COURSE_PACKAGE_PROTOCOL3 === '1') {
      await waitForAsync(page, async function(id){
        var snapshot = await ChunkAPI.getData();
        var progress = snapshot.courseProgress && snapshot.courseProgress[id];
        return progress && progress.completed === true && progress.passed && progress.passed.length === 2;
      }, COURSE_ID, { timeout:15000 });
      var remoteCompleted = await page.evaluate(function(id){
        var snapshot = ChunkAPI.getData();
        return snapshot.then ? snapshot.then(function(data){ return data.courseProgress[id]; }) : snapshot.courseProgress[id];
      }, COURSE_ID);
      if (!remoteCompleted || !remoteCompleted.seen || remoteCompleted.seen.length !== 2) throw new Error('协议 3 下课程完成进度应已进入服务端');
      var secondContext = await browser.newContext();
      try {
        var secondPage = await secondContext.newPage();
        await secondPage.goto(BASE + '/courses.html?id=' + encodeURIComponent(COURSE_ID), {waitUntil:'networkidle'});
        await secondPage.waitForSelector('.v2-completion');
        if ((await secondPage.locator('#playerCount').innerText()).trim() !== '2' ||
            (await secondPage.locator('#playerTitle').innerText()).trim() !== 'Excuse Me! | A Handbag Conversation') {
          throw new Error('无本机课程副本的新浏览器应恢复服务端课程及完成进度');
        }
      } finally { await secondContext.close(); }
      var catalogContext=await browser.newContext();
      try {
        await catalogContext.addInitScript(function(){
          if(!localStorage.getItem('chunklab.storage-owner.v1'))
            localStorage.setItem('chunklab.storage-owner.v1',JSON.stringify([location.origin,'local']));
        });
        var catalogPage=await catalogContext.newPage();
        var largeDeckImports=0;
        var deckDeleteRequests=0;
        var deckPublishRequests=0;
        var visibilityRequests=0;
        var logicalCoursePutRequests=0;
        var logicalCourseDeleteRequests=0;
        var legacyCatalogWrites=0;
        catalogContext.on('request',function(request){
          if(request.method()!=='GET'&&['/api/data','/api/import'].indexOf(new URL(request.url()).pathname)>=0) legacyCatalogWrites++;
          if(request.method()==='POST'&&new URL(request.url()).pathname.endsWith('/api/operations')){
            try {
              var operation=JSON.parse(request.postData()||'{}');
              var operationType=operation.type;
              if(operationType==='deck.delete'&&operation.payload.deckId==='e2e-publish-deck') deckDeleteRequests++;
              if(operationType==='deck.publish'&&operation.payload.deckId==='e2e-publish-deck') deckPublishRequests++;
              if(operationType==='deck.itemsVisibility') visibilityRequests++;
              if(operationType==='logicalCourse.put') logicalCoursePutRequests++;
              if(operationType==='logicalCourse.delete') logicalCourseDeleteRequests++;
            } catch (_) { /* Cache assertions remain authoritative. */ }
          }
          if(request.method()!=='POST'||!new URL(request.url()).pathname.endsWith('/api/content-import')) return;
          try { if(JSON.parse(request.postData()||'{}').type==='deck.put') largeDeckImports++; } catch (_) { /* Assert through server-side cache below. */ }
        });
        await catalogPage.goto(BASE+'/decks.html?courseType=courses&courseView=joined',{waitUntil:'networkidle'});
        await catalogPage.waitForFunction(function(){ return document.querySelector('#deckList').innerText.indexOf('打扰一下！—手提包对话')>=0; },null,{timeout:15000});
        if((await catalogPage.locator('#deckList').innerText()).indexOf('打扰一下！—手提包对话')<0)
          throw new Error('全新浏览器课程库未显示服务器中的已加入课程');
        var p3SnapshotGuard=await catalogPage.evaluate(async function(){
          var before=JSON.stringify(mem),pendingBefore=(await ServerStore.pending()).length;
          var rejected=false,code='';
          try{await saveStore();}catch(error){rejected=true;code=error&&error.code||'';}
          var after=JSON.stringify(mem);
          var explicitLocal=await saveStore('local');
          return {rejected:rejected,code:code,unchanged:before===after,
            pendingStable:(await ServerStore.pending()).length===pendingBefore,explicitLocal:explicitLocal};
        });
        if(!p3SnapshotGuard.rejected||p3SnapshotGuard.code!=='PROTOCOL3_NARROW_WRITE_REQUIRED'||
           !p3SnapshotGuard.unchanged||!p3SnapshotGuard.pendingStable||p3SnapshotGuard.explicitLocal===false)
          throw new Error('协议 3 课程库必须拒绝未标记的整包快照，仅允许明确的本地投影：'+JSON.stringify(p3SnapshotGuard));
        await catalogPage.evaluate(async function(){
          var prior=serverCatalogView;
          serverCatalogView=null;
          try{
            var deckRejected=false,visibilityRejected=false,storyRejected=false,storyMutationApplied=false;
            try{await persistDeckContent({id:'e2e-not-ready',items:[]});}catch(_){deckRejected=true;}
            try{await setBuiltinItemsHidden('e2e-not-ready',['e2e-not-ready#item'],true);}catch(_){visibilityRejected=true;}
            try{await updateStoryPackage('e2e-not-ready',function(){storyMutationApplied=true;});}catch(_){storyRejected=true;}
            if(!deckRejected||!visibilityRejected||!storyRejected||storyMutationApplied||mem.deletedItems&&mem.deletedItems['e2e-not-ready#item'])
              throw new Error('协议 3 目录缓存未就绪时必须拒绝旧快照回退，且不先改本机状态');
            var alertMessage='',oldAlert=window.alert;
            window.alert=function(message){alertMessage=String(message||'');};
            window.addEventListener('unhandledrejection',function(event){event.preventDefault();},{once:true});
            deleteCourse('e2e-not-ready','尚未加载的课程');
            document.querySelector('#courseConfirmOk').click();
            await new Promise(function(resolve){setTimeout(resolve,30);});
            window.alert=oldAlert;
            if(alertMessage.indexOf('未就绪')<0&&alertMessage.indexOf('未删除')<0)
              throw new Error('协议 3 目录缓存未就绪时删除课程必须明确拒绝并告知用户；实际提示：'+alertMessage);
          }finally{serverCatalogView=prior;}
        });
        await catalogPage.evaluate(async function(){
          var getPublicDeck=ChunkAPI.getPublicDeck;
          var submitCommitted=ServerStore.submitCommitted;
          ChunkAPI.getPublicDeck=async function(id){return {deck:{id:id,name:'E2E rejected public deck',items:[{sentence:'temporary'}]}};};
          ServerStore.submitCommitted=function(type){
            if(type==='deck.put') return Promise.reject(new Error('e2e write rejection'));
            return submitCommitted.apply(this,arguments);
          };
          try{
            importPublicDeck({id:'e2e-public-failure',builtin:false});
            var deadline=Date.now()+5000;
            while(Date.now()<deadline&&document.querySelector('#deckNotice').textContent.indexOf('保存失败')<0)
              await new Promise(function(resolve){setTimeout(resolve,25);});
            if(document.querySelector('#deckNotice').textContent.indexOf('保存失败')<0) throw new Error('公开题库拒绝保存时没有反馈');
            if(mem.decks.some(function(deck){return deck.sourceDeckId==='e2e-public-failure';}))
              throw new Error('公开题库保存失败后仍留在本地课程列表，形成未确认的假象');
          }finally{
            ChunkAPI.getPublicDeck=getPublicDeck;
            ServerStore.submitCommitted=submitCommitted;
          }
        });
        await catalogPage.evaluate(async function(id){
          var legacyWriter=CL.writeCourses;
          CL.writeCourses=undefined;
          try{
            await updateStoryPackage(id,function(course){course.logicalCourseId='logical:server-edit';});
          }finally{CL.writeCourses=legacyWriter;}
          var cache=await ServerCache.read();
          var saved=cache.snapshot.courses.find(function(course){return course.courseId===id;});
          if(!saved||saved.logicalCourseId!=='logical:server-edit') throw new Error('课程目录归属修改未提交到服务端');
        },COURSE_ID);
        await catalogPage.evaluate(async function(id){
          var legacyWriter=CL.writeCourses, deleteCourse=ChunkCourse.deleteCourse, calls=0;
          CL.writeCourses=undefined;
          ChunkCourse.deleteCourse=async function(courseId){
            if(courseId!==id) throw new Error('P3 故事课程删除目标错误');
            calls++;
            return true;
          };
          try{
            removeStoryPackage(id,'E2E 故事课程');
            document.querySelector('#courseConfirmOk').click();
            await new Promise(function(resolve){setTimeout(resolve,50);});
            if(calls!==1) throw new Error('协议 3 故事课程删除仍依赖旧 CL.writeCourses');
          }finally{
            CL.writeCourses=legacyWriter;
            ChunkCourse.deleteCourse=deleteCourse;
          }
        },COURSE_ID);
        var catalogCreated=await catalogPage.evaluate(async function(){
          var deck={id:'e2e-publish-deck',name:'E2E publish',items:[{sentence:'A large test sentence.',translation:'x'.repeat(300*1024),chunks:['A large test sentence.']}],builtin:false};
          await persistDeckContent(deck);
          var cache=await ServerCache.read();
          if(cache.snapshot.mem.decks.find(function(item){return item.id===deck.id;}).items[0].translation.length!==300*1024)
            throw new Error('大题库内容导入未完整保存');
          deck.name='E2E publish edited';
          await persistDeckContent(deck);
          cache=await ServerCache.read();
          if(cache.snapshot.mem.decks.find(function(item){return item.id===deck.id;}).name!=='E2E publish edited')
            throw new Error('题库编辑未通过 deck.put 确认保存');
          var conflictBase=await ServerCache.read();
          var conflictRevision=conflictBase.snapshot.revs.decks[deck.id];
          var staleUserDraft=JSON.parse(JSON.stringify(deck));
          staleUserDraft.name='E2E user edit retained after conflict';
          var originalSubmitCommitted=ServerStore.submitCommitted, injectedConflict=false;
          ServerStore.submitCommitted=async function(type,payload,options){
            if(type==='deck.put'&&payload.deck&&payload.deck.id===deck.id&&!injectedConflict){
              injectedConflict=true;
              var remoteWinner=JSON.parse(JSON.stringify(deck)); remoteWinner.name='E2E concurrent server edit';
              await originalSubmitCommitted.call(ServerStore,'deck.put',{deck:remoteWinner},
                {requestId:'e2e-concurrent-deck-edit-'+Date.now().toString(36),expectedRev:conflictRevision});
            }
            return originalSubmitCommitted.call(ServerStore,type,payload,options);
          };
          var conflictCode='';
          try{await commitDeckContent(staleUserDraft);}catch(error){conflictCode=error&&error.code||'';}
          finally{ServerStore.submitCommitted=originalSubmitCommitted;}
          if(conflictCode!=='ENTITY_CHANGED'||!injectedConflict) throw new Error('并发内容编辑应由真实 revision 冲突拒绝');
          var conflictedRows=await ServerStore.pending();
          var blockedDraft=conflictedRows.find(function(row){return row.status==='blocked'&&row.lastError==='ENTITY_CHANGED'&&
            row.operation&&row.operation.type==='deck.put'&&row.operation.payload.deck.id===deck.id;});
          if(!blockedDraft||blockedDraft.operation.payload.deck.name!==staleUserDraft.name)
            throw new Error('revision 冲突后用户修改没有耐久保留为可恢复草稿');
          cache=await ServerCache.read();
          if(cache.snapshot.mem.decks.find(function(item){return item.id===deck.id;}).name!=='E2E concurrent server edit')
            throw new Error('用户冲突草稿覆盖了服务器现行版本');
          await setBuiltinItemsHidden('builtin-visibility-e2e',['builtin-visibility-e2e#item-1'],true);
          cache=await ServerCache.read();
          if(!cache.snapshot.mem.deletedItems['builtin-visibility-e2e#item-1']) throw new Error('内置句删除未由服务端确认');
          await setBuiltinItemsHidden('builtin-visibility-e2e',['builtin-visibility-e2e#item-1'],false);
          cache=await ServerCache.read();
          if(cache.snapshot.mem.deletedItems['builtin-visibility-e2e#item-1']) throw new Error('内置句恢复未由服务端确认');
          var batchDeckId='builtin-visibility-batch-e2e';
          var batchKeys=Array.from({length:2001},function(_,index){return batchDeckId+'#item-'+index;});
          for(var offset=0;offset<batchKeys.length;offset+=2000){
            var seedKeys=batchKeys.slice(offset,offset+2000),seedId='visibility-batch-seed-'+offset;
            await ServerStore.submitCommitted('deck.itemsVisibility',{eventId:seedId,deckId:batchDeckId,
              keys:seedKeys,hidden:true,expectedHidden:false},{requestId:seedId});
          }
          await ServerCache.refresh();
          await loadServerCatalogView();
          await setBuiltinItemsHidden(batchDeckId,batchKeys,false);
          cache=await ServerCache.read();
          if(batchKeys.some(function(key){return !!cache.snapshot.mem.deletedItems[key];})) throw new Error('超过 2000 句的批量恢复未全部得到服务端确认');
          var directory=await persistLogicalCourseCreate({title:'E2E server directory',coverImage:''});
          cache=await ServerCache.read();
          if(!cache.snapshot.mem.logicalCourses[directory.id]||!LogicalCourseStore.read().some(function(item){return item.id===directory.id;})) throw new Error('逻辑课程目录创建未进入服务端确认视图');
          return {logicalCourseId:directory.id,deckId:deck.id};
        });
        await catalogPage.reload({waitUntil:'networkidle'});
        await catalogPage.locator('#contentConflictDrafts').waitFor({state:'visible',timeout:15000});
        if((await catalogPage.locator('#contentConflictDrafts').innerText()).indexOf('E2E user edit retained after conflict')<0)
          throw new Error('刷新后没有显示本机耐久保留的冲突草稿');
        var recoveredWriteRequest=catalogPage.waitForRequest(function(request){
          var path=new URL(request.url()).pathname;
          if(request.method()!=='POST'||!(path.endsWith('/api/operations')||path.endsWith('/api/content-import'))) return false;
          try{
            var operation=JSON.parse(request.postData()||'{}');
            return operation.type==='deck.put'&&operation.payload&&operation.payload.deck&&
              /E2E user edit retained after conflict（修改草稿）/.test(operation.payload.deck.name||'');
          }catch(_){return false;}
        },{timeout:15000});
        await catalogPage.locator('#contentConflictDraftList button').click();
        var recoveredRequest;
        try{recoveredRequest=await recoveredWriteRequest;}
        catch(error){
          var dispatchState=await catalogPage.evaluate(async function(){
            return {ready:CL.serverPersistenceReady(),persistence:CL.getPersistenceState(),store:ServerStore.state(),
              pending:(await ServerStore.pending()).map(function(item){return {status:item.status,error:item.lastError,
                type:item.operation&&item.operation.type,id:item.operation&&item.operation.payload&&item.operation.payload.deck&&item.operation.payload.deck.id};}),
              locks:!!(navigator.locks&&navigator.locks.request)};
          });
          throw new Error('新草稿未启动服务端请求：'+JSON.stringify(dispatchState)+'；'+error.message);
        }
        var recoveredResponse=await recoveredRequest.response();
        if(!recoveredResponse) throw new Error('新草稿写入没有收到服务端响应');
        if(!recoveredResponse.ok()) throw new Error('新草稿写入被服务端拒绝：HTTP '+recoveredResponse.status()+' '+(await recoveredResponse.text()));
        await waitForAsync(catalogPage, async function(){
          var row=await ServerCache.read(),pending=await ServerStore.pending();
          var decks=row&&row.snapshot&&row.snapshot.mem&&row.snapshot.mem.decks||[];
          var recovered=decks.some(function(item){return /E2E user edit retained after conflict（修改草稿）/.test(item.name||'');});
          var awaiting= pending.some(function(item){return item.operation&&item.operation.type==='deck.put'&&
            item.operation.payload&&item.operation.payload.deck&&/E2E user edit retained after conflict（修改草稿）/.test(item.operation.payload.deck.name||'');});
          return recovered&&!awaiting;
        });
        var recoveredContent=await catalogPage.evaluate(async function(originalDeckId){
          var row=await ServerCache.read(),decks=row.snapshot.mem.decks;
          var original=decks.find(function(item){return item.id===originalDeckId;});
          var recovered=decks.find(function(item){return /E2E user edit retained after conflict（修改草稿）/.test(item.name||'');});
          var pending=await ServerStore.pending();
          return {originalName:original&&original.name,recoveredName:recovered&&recovered.name,
            recoveredSentence:recovered&&recovered.items[0].sentence,
            allDeckNames:decks.map(function(item){return item.name;}),
            notice:document.querySelector('#deckNotice').textContent,
            recoveryStatus:document.querySelector('#contentConflictDraftStatus').textContent,
            queuedRows:pending.map(function(item){return {status:item.status,error:item.lastError,type:item.operation&&item.operation.type,
              id:item.operation&&item.operation.payload&&item.operation.payload.deck&&item.operation.payload.deck.id,
              requestId:item.requestId};}),
            conflictRows:pending.filter(function(item){return item.status==='blocked';}).map(function(item){return {error:item.lastError,type:item.operation&&item.operation.type,id:item.operation&&item.operation.payload&&item.operation.payload.deck&&item.operation.payload.deck.id};}),
            oldConflictStillQueued:pending.some(function(item){return item.status==='blocked'&&item.lastError==='ENTITY_CHANGED'&&
              item.operation&&item.operation.type==='deck.put'&&item.operation.payload.deck.id===originalDeckId;})};
        },catalogCreated.deckId);
        if(recoveredContent.originalName!=='E2E concurrent server edit'||
           recoveredContent.recoveredName!=='E2E user edit retained after conflict（修改草稿）'||
           recoveredContent.oldConflictStillQueued)
          throw new Error('另存草稿后应保留服务器现行版、创建新副本并安全退役旧阻塞项：'+JSON.stringify(recoveredContent));
        var logicalCourseId=catalogCreated.logicalCourseId;
        async function runDeckManagementAction(label,publishState){
          var actionPage=await catalogContext.newPage();
          try {
            await actionPage.goto(BASE+'/decks.html?courseType=decks&courseView=joined',{waitUntil:'networkidle'});
            var row=actionPage.locator('#deckList .deck-item').filter({hasText:'E2E concurrent server edit'});
            await row.waitFor({state:'visible',timeout:15000});
            await row.locator('.course-manage-trigger').click();
            await row.getByRole('menuitem',{name:'管理课程'}).click();
            await actionPage.locator('#editManageActions .course-manage-trigger').click();
            await actionPage.locator('#editManageActions').getByRole('menuitem',{name:label}).click();
            await actionPage.locator('#courseConfirmMask:not([hidden])').waitFor({state:'visible'});
            var expectedType=publishState===null?'deck.delete':'deck.publish';
            var expectedPath=actionPage.waitForRequest(function(request){
              if(request.method()!=='POST'||!new URL(request.url()).pathname.endsWith('/api/operations')) return false;
              try {
                var operation=JSON.parse(request.postData()||'{}');
                return operation.type===expectedType&&operation.payload.deckId===catalogCreated.deckId&&
                  (expectedType!=='deck.publish'||operation.payload.publish===publishState);
              } catch (_) { return false; }
            },{timeout:15000});
            await actionPage.locator('#courseConfirmOk').click();
            await expectedPath;
            if(publishState===null){
              await waitForAsync(actionPage, async function(id){
                var snapshot=await ChunkAPI.getData();
                return !snapshot.mem.decks.some(function(item){return item.id===id;})&&
                  !Array.from(document.querySelectorAll('#deckList .deck-item')).some(function(item){return item.innerText.indexOf(id)>=0;});
              },catalogCreated.deckId,{timeout:15000});
            }else{
              await waitForAsync(actionPage, async function(args){
                var id=args.id, expected=args.expected;
                var snapshot=await ChunkAPI.getData();
                var deck=snapshot.mem.decks.find(function(item){return item.id===id;});
                return !!deck&&(deck.isPublic===expected||deck.is_public===expected||deck.is_public===(expected?1:0));
              },{id:catalogCreated.deckId,expected:publishState},{timeout:15000});
            }
          } finally { await actionPage.close(); }
        }
        await runDeckManagementAction('发布到课程市场',true);
        await runDeckManagementAction('从课程市场下架',false);
        await runDeckManagementAction('删除课程',null);
        await catalogPage.evaluate(function(){openDecks();});
        var deletedDeckState=await catalogPage.evaluate(async function(id){
          var snapshot=await ChunkAPI.getData();
          return {server:snapshot.mem.decks.some(function(item){return item.id===id;}),
            visible:Array.from(document.querySelectorAll('#deckList .deck-item')).some(function(item){return item.innerText.indexOf(id)>=0;})};
        },catalogCreated.deckId);
        if(deletedDeckState.server||deletedDeckState.visible) throw new Error('真实课程管理删除后题库仍出现在服务端数据或列表中：'+JSON.stringify(deletedDeckState));
        var logicalContext=await browser.newContext();
        try {
          await logicalContext.addInitScript(function(){
            if(!localStorage.getItem('chunklab.storage-owner.v1'))
              localStorage.setItem('chunklab.storage-owner.v1',JSON.stringify([location.origin,'local']));
          });
          var logicalPage=await logicalContext.newPage();
          logicalPage.on('request',function(request){
            if(request.method()!=='POST'||!new URL(request.url()).pathname.endsWith('/api/operations')) return;
            try { if(JSON.parse(request.postData()||'{}').type==='logicalCourse.delete') logicalCourseDeleteRequests++; } catch (_) { /* The cache assertion is authoritative. */ }
          });
          await logicalPage.goto(BASE+'/decks.html?courseType=courses&courseView=joined',{waitUntil:'networkidle'});
          await logicalPage.waitForFunction(function(id){return LogicalCourseStore.read().some(function(item){return item.id===id;});},logicalCourseId,{timeout:15000});
          await logicalPage.evaluate(async function(id){
            await persistLogicalCourseDelete(id);
            var cache=await ServerCache.read();
            if(cache.snapshot.mem.logicalCourses[id]||LogicalCourseStore.read().some(function(item){return item.id===id;})) throw new Error('逻辑课程目录删除未从确认视图移除');
          },logicalCourseId);
          await catalogPage.evaluate(function(){
            _catalogLastFocusRefreshAt=Date.now()-5001;
            window.dispatchEvent(new Event('focus'));
          });
          await catalogPage.waitForFunction(function(id){return !LogicalCourseStore.read().some(function(item){return item.id===id;});},logicalCourseId,{timeout:15000});
        } finally { await logicalContext.close(); }
        if(largeDeckImports!==5) throw new Error('大于普通操作限制的题库新增/编辑/并发冲突/冲突草稿都必须经专用导入路由耐久提交，实际请求数：'+largeDeckImports);
        if(deckDeleteRequests!==1) throw new Error('题库删除必须通过 deck.delete 窄操作');
        if(deckPublishRequests!==2) throw new Error('题库发布/下架必须各通过一次 deck.publish 窄操作，实际请求数：'+deckPublishRequests);
        if(visibilityRequests!==6) throw new Error('内置句删除/恢复及超过 2000 句分批恢复必须通过有序 deck.itemsVisibility 窄操作，实际请求数：'+visibilityRequests);
        if(logicalCoursePutRequests!==1||logicalCourseDeleteRequests!==1) throw new Error('逻辑课程目录创建/删除必须各通过一次窄操作');
        if(legacyCatalogWrites!==0) throw new Error('协议 3 题库/课程目录操作不得调用旧整包写接口，调用数：'+legacyCatalogWrites);
      } finally { await catalogContext.close(); }
      await waitForAsync(page, async function(){ return (await ServerStore.pending()).length === 0; });
      await page.evaluate(async function(id){
        var local = CL.readProgress();
        delete local[id];
        if (typeof CL.adoptServerProgressProjection === 'function') await CL.adoptServerProgressProjection(local);
        else await CL.writeProgress(local);
      }, COURSE_ID);
      await page.reload({waitUntil:'networkidle'});
      await page.waitForSelector('.v2-completion');
      if ((await page.locator('#playerCount').innerText()).trim() !== '2') {
        throw new Error('课程播放器必须从服务端确认进度恢复，不能依赖本机旧进度');
      }
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    var generationBeforeRestart = process.env.COURSE_PACKAGE_PROTOCOL3 === '1'
      ? await page.evaluate(async function(id){
        var snapshot=await ChunkAPI.getData();
        return Number(snapshot.courseProgress[id].generation)||0;
      },COURSE_ID) : null;
    await page.locator('.v2-completion [data-action="restart"]').click();
    if (process.env.COURSE_PACKAGE_PROTOCOL3 === '1') {
      await page.waitForFunction(function(){ return document.querySelector('#playerCount').textContent === '0' && !document.querySelector('.v2-completion'); }, null, { timeout:15000 });
      await waitForAsync(page, async function(args){
        var snapshot = await ChunkAPI.getData();
        var progress = snapshot.courseProgress && snapshot.courseProgress[args.id];
        return progress && progress.generation === args.before+1 && progress.completed === false && progress.seen.length === 0;
      }, {id:COURSE_ID,before:generationBeforeRestart}, { timeout:15000 });
      var operations = protocolOperations;
      if (!operations.some(function(operation){ return operation.type === 'course.progress'; }) ||
          !operations.some(function(operation){ return operation.type === 'course.restart'; })) throw new Error('协议 3 下课程进度和重学必须使用对应窄操作：' + JSON.stringify(operations.map(function(operation){ return operation.type; })));
      var legacyProgressWriteCount=await page.evaluate(function(){return Number(sessionStorage.getItem('__courseProgressLegacyWriteCount')||0);});
      if(legacyProgressWriteCount)
        throw new Error('协议 3 课程进度/重学确认后不得再次调用全量 CL.writeProgress；调用次数：'+legacyProgressWriteCount+'；调用栈：'+JSON.stringify(await page.evaluate(function(){return JSON.parse(sessionStorage.getItem('__courseProgressLegacyWriteStacks')||'[]');})));
      if (largeContentImports.length !== 1) throw new Error('大于普通操作上限的课程必须走专用 content-import 接口');
    } else await page.waitForTimeout(150);
    if (await page.locator('.v2-completion').count() || await page.locator('.mode-guide').count() !== 1) throw new Error('点击“再学一次”应退出完成页并返回练习方式选择');
    if (await page.locator('#playerCount').innerText() !== '0' ||
        (process.env.COURSE_PACKAGE_PROTOCOL3 !== '1' && await page.evaluate(function (id) { return !!CL.readProgress()[id]; }, COURSE_ID))) throw new Error('重新学习时应清除本课程旧的完成进度');
    if (process.env.COURSE_PACKAGE_PROTOCOL3 === '1') {
      await page.evaluate(async function(id){
        var cache=await ServerCache.read();
        var course=JSON.parse(JSON.stringify((cache.snapshot.courses||[]).find(function(item){return item.courseId===id;})));
        var priorProgress=cache.snapshot.courseProgress&&cache.snapshot.courseProgress[id];
        if(!course) throw new Error('服务器确认课程缺失，无法验证版本替换');
        course.version=String(course.version||'v1')+'-e2e-next';
        await ChunkCourse.saveCourse(course);
        var updated=await ChunkAPI.getData();
        var progress=updated.courseProgress&&updated.courseProgress[id];
        if(!progress||progress.generation!==(Number(priorProgress&&priorProgress.generation)||0)+1||progress.completed||progress.seen.length!==0||progress.courseVersion!==course.version)
          throw new Error('更换课程内容版本必须原子清空活动进度并推进代次：'+JSON.stringify(progress));
      },COURSE_ID);
      var deletionContext=await browser.newContext();
      try {
        await deletionContext.addInitScript(function(){
          if(!localStorage.getItem('chunklab.storage-owner.v1'))
            localStorage.setItem('chunklab.storage-owner.v1',JSON.stringify([location.origin,'local']));
        });
        var deletionPage=await deletionContext.newPage();
        var deletionRequestSeen=false;
        var importedCourseOperationSeen=false;
        var legacyCourseImportWrites=[];
        var deletionDialogs=[];
        deletionPage.on('dialog',function(dialog){ deletionDialogs.push(dialog.message()); dialog.dismiss(); });
        deletionPage.on('request',function(request){
          var requestPath=new URL(request.url()).pathname;
          if(request.method()!=='GET'&&['/api/data','/api/import'].indexOf(requestPath)>=0)
            legacyCourseImportWrites.push({method:request.method(),path:requestPath});
          if(request.method()!=='POST'||!new URL(request.url()).pathname.endsWith('/api/operations')) return;
          try {
            var operation=JSON.parse(request.postData()||'{}');
            deletionRequestSeen=deletionRequestSeen||operation.type==='course.delete'&&operation.payload.courseId===COURSE_ID;
            importedCourseOperationSeen=importedCourseOperationSeen||operation.type==='course.put'&&operation.payload.course&&operation.payload.course.courseId===COURSE_ID;
          } catch (_) { /* The server response remains authoritative. */ }
        });
        await deletionPage.goto(BASE+'/decks.html?courseType=courses&courseView=joined',{waitUntil:'networkidle'});
        await deletionPage.waitForFunction(function(){ return document.querySelector('#deckList').innerText.indexOf('打扰一下！—手提包对话')>=0; },null,{timeout:15000});
        var deletionSourceReady=await deletionPage.evaluate(async function(id){
          var cache=await ServerCache.read();
          return {owner:cache&&cache.owner,hasCourse:!!(cache&&cache.snapshot.courses.some(function(course){return course.courseId===id;})),
            cachedCourseIds:cache&&cache.snapshot.courses.map(function(course){return course.courseId;})};
        },COURSE_ID);
        if(!deletionSourceReady.hasCourse) throw new Error('删除 UI 的服务端确认课程来源未就绪：'+JSON.stringify(deletionSourceReady));
        await deletionPage.locator('#btnImportDecks').click();
        await deletionPage.locator('#courseImportTypeMask:not([hidden])').waitFor({state:'visible'});
        await deletionPage.locator('#btnImportStoryCourse').click();
        await deletionPage.locator('#ciLogicalCourse').selectOption('standalone');
        await deletionPage.locator('#courseFileInput').setInputFiles(ZIP);
        await deletionPage.locator('#btnCourseImport').click();
        await deletionPage.waitForFunction(function(){
          var message=document.querySelector('#courseImpMsg');
          return message&&(message.textContent.indexOf('导入完成')>=0||message.classList.contains('err'));
        },null,{timeout:45000});
        var importMessage=(await deletionPage.locator('#courseImpMsg').innerText()).trim();
        if(importMessage.indexOf('导入完成')<0) throw new Error('protocol 3 图文课程导入 UI 失败：'+importMessage);
        await waitForAsync(deletionPage, async function(id){
          var cache=await ServerCache.read();
          var course=cache&&cache.snapshot.courses.find(function(item){return item.courseId===id;});
          return course&&!course.logicalCourseId;
        },COURSE_ID,{timeout:15000});
        if(!importedCourseOperationSeen) throw new Error('protocol 3 图文课程导入 UI 未发送 course.put 窄操作');
        if(legacyCourseImportWrites.length) throw new Error('protocol 3 图文课程导入 UI 调用了旧整包写接口：'+JSON.stringify(legacyCourseImportWrites));
        await deletionPage.locator('#courseImpMask').waitFor({state:'hidden',timeout:10000});
        await deletionPage.waitForTimeout(500);
        var importedUiState=await deletionPage.evaluate(function(id){
          var course=serverCatalogView&&serverCatalogView.courses.find(function(item){return item.courseId===id;});
          return {courseView:courseView,requestedTab:requestedTab,course:course&&{courseId:course.courseId,title:course.title,origin:course.origin,logicalCourseId:course.logicalCourseId},
            cardTitles:Array.from(document.querySelectorAll('#deckList .course-card')).map(function(item){return item.innerText;}),
            listText:document.querySelector('#deckList').innerText};
        },COURSE_ID);
        var importedCourseTitle=String(importedUiState.cardTitles[0]||'').split('\n')[0];
        if(!importedCourseTitle||!await deletionPage.locator('#deckList .course-card').filter({hasText:importedCourseTitle}).isVisible())
          throw new Error('P3 导入已确认但课程库未即时显示导入项：'+JSON.stringify(importedUiState));
        var deletableCourse=deletionPage.locator('#deckList .course-card').filter({hasText:importedCourseTitle});
        await deletableCourse.locator('.course-manage-trigger').click();
        await deletableCourse.getByRole('menuitem',{name:'删除课程'}).click();
        await deletionPage.locator('#courseConfirmMask:not([hidden])').waitFor({state:'visible'});
        var deletionOperationRequest=deletionPage.waitForRequest(function(request){
          if(request.method()!=='POST'||!new URL(request.url()).pathname.endsWith('/api/operations')) return false;
          try { var operation=JSON.parse(request.postData()||'{}'); return operation.type==='course.delete'&&operation.payload.courseId===COURSE_ID; }
          catch (_) { return false; }
        },{timeout:15000});
        await deletionPage.locator('#courseConfirmOk').click();
        await deletionOperationRequest;
        await waitForAsync(deletionPage, async function(id){
          var cache=await ServerCache.read();
          return cache && !cache.snapshot.courses.some(function(course){return course.courseId===id;}) &&
            !cache.snapshot.courseProgress[id];
        },COURSE_ID,{timeout:15000});
        if(!deletionRequestSeen)
          throw new Error('真实菜单与确认框删除必须通过 course.delete 窄操作提交；dialogs='+JSON.stringify(deletionDialogs));
        await deletionPage.reload({waitUntil:'networkidle'});
        if((await deletionPage.locator('#deckList').innerText()).indexOf(importedCourseTitle)>=0)
          throw new Error('新页面仍显示已删除的课程');
      } finally { await deletionContext.close(); }
    }
    if (process.env.COURSE_PACKAGE_PROTOCOL3 === '1') {
      if (!legacyWriteResponses.some(function (item) { return item.path === '/api/data' && item.status === 428; }))
        throw new Error('升级前遗留的整包写必须收到服务端 428 fence');
      if (legacyWriteResponses.some(function (item) { return item.afterProtocol3Ready; }))
        throw new Error('protocol 3 页面就绪后仍尝试旧版整包写入：' + JSON.stringify(legacyWriteResponses));
      var startupFailurePage=await browser.newPage();
      startupFailurePage.on('pageerror',function(error){console.error('[course-package startup failure] page error:',error.message);});
      await startupFailurePage.addInitScript(function(){
        document.addEventListener('DOMContentLoaded',function(){
          localStorage.setItem('chunklab.storage-owner.v1',JSON.stringify([location.origin,'local']));
          localStorage.setItem('chunklab.courses.v1',JSON.stringify([{courseId:'stale-local-course',schemaVersion:'1.1',metadata:{title:'STALE LOCAL COURSE'},story:{nodes:[]}}]));
          if(window.CL){
            window.CL.ensureCloud=function(){return Promise.resolve(true);};
            window.CL.getCloudConfig=function(){return {persistenceMode:'server-authoritative',writeProtocol:3};};
            window.CL.serverPersistenceReady=function(){return false;};
          }
        },{once:true});
      });
      await startupFailurePage.goto(BASE+'/courses.html?id='+encodeURIComponent(COURSE_ID),{waitUntil:'networkidle'});
      await startupFailurePage.waitForFunction(function(){
        var message=document.querySelector('#importMessage'), player=document.querySelector('#coursePlayer');
        return message&&message.textContent.indexOf('课程数据暂不可用')>=0&&player&&!player.classList.contains('hidden');
      },null,{timeout:15000});
      var unavailableState=await startupFailurePage.evaluate(function(){
        return {courses:ChunkCourse.readCourses().map(function(course){return course.courseId;}),
          message:document.querySelector('#importMessage').textContent,
          backVisible:!!document.querySelector('#playerBack')};
      });
      if(unavailableState.courses.indexOf('stale-local-course')>=0||unavailableState.courses.length||!unavailableState.backVisible)
        throw new Error('P3 启动未确认时不得回显本机旧课程，且必须显示真实提示和返回入口：'+JSON.stringify(unavailableState));
      var backDiagnostics=await startupFailurePage.locator('#playerBack').evaluate(function(button){
        var rect=button.getBoundingClientRect();
        return {handler:typeof button.onclick,hidden:button.closest('#coursePlayer').classList.contains('hidden'),
          disabled:button.disabled,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},href:location.href};
      });
      await startupFailurePage.locator('#playerBack').click();
      await startupFailurePage.waitForTimeout(500);
      if(new URL(startupFailurePage.url()).pathname!=='/decks.html')
        throw new Error('P3 启动失败时返回课程库按钮未能退出播放器：'+JSON.stringify({url:startupFailurePage.url(),button:backDiagnostics}));
      await startupFailurePage.close();
      await page.goto(BASE+'/decks.html?courseView=joined',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(function(){return window.CL&&CL.serverPersistenceReady&&CL.serverPersistenceReady();},null,{timeout:15000});
      await page.evaluate(function(){window.dispatchEvent(new Event('chunklab-upgrade-required'));});
      await page.waitForFunction(function(){var node=document.getElementById('chunklabSaveStatus');return node&&node.dataset.upgrade==='true';},null,{timeout:3000});
      var upgradePrompt=await page.evaluate(function(){
        var node=document.getElementById('chunklabSaveStatus'),button=document.getElementById('chunklabSaveStatusRefresh');
        return {text:node.textContent,pointerEvents:getComputedStyle(node).pointerEvents,button:!!button,buttonText:button&&button.textContent};
      });
      if(!upgradePrompt.text.includes('页面需要更新')||upgradePrompt.pointerEvents!=='auto'||!upgradePrompt.button||upgradePrompt.buttonText!=='刷新页面')
        throw new Error('旧版本页面必须给出可操作的刷新入口：'+JSON.stringify(upgradePrompt));
      var upgradeReload=page.waitForNavigation({waitUntil:'domcontentloaded'});
      await page.locator('#chunklabSaveStatusRefresh').click();
      await upgradeReload;
      await page.waitForFunction(function(){return window.CL&&CL.serverPersistenceReady&&CL.serverPersistenceReady();},null,{timeout:15000});
      console.log('[course-package] protocol-3 legacy write responses: ' + JSON.stringify(legacyWriteResponses));
    }
    console.log('course-package-v2-import.test.js passed');
  } finally {
    if (browser) await browser.close();
    stopServer();
  }
})().catch(function (error) { console.error(error.stack || error); process.exitCode = 1; });
