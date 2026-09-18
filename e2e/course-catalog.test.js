/* course-catalog.test.js · 课程卡片、目录路由与课节启动回归 */
'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(9850, 100);
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-course-catalog-'));
const BASE = 'http://127.0.0.1:' + PORT;
let server;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test' }),
      stdio: 'ignore'
    });
    let tries = 0;
    const iv = setInterval(function () {
      if (server.exitCode !== null) { clearInterval(iv); reject(new Error('server exit ' + server.exitCode)); return; }
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health' }, function (res) {
        res.resume();
        if (res.statusCode === 200) { clearInterval(iv); resolve(); }
      });
      req.on('error', function () {});
      req.setTimeout(600, function () { req.destroy(); });
      /* server 启动时会预热压缩缓存；在 Windows 慢机器上给它留出合理时间。 */
      if (++tries > 120) { clearInterval(iv); reject(new Error('server 启动超时')); }
    }, 100);
  });
}

function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (e) {} }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (e) {}
}

(async function () {
  let browser;
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
    const page = await browser.newPage();
    await page.goto(BASE + '/decks.html?e2e=course-catalog', { waitUntil: 'networkidle' });
    await page.waitForSelector('#pageDecks:not(.hidden) .course-card');
    const cards = await page.locator('#pageDecks:not(.hidden) .course-card').count();
    if (cards !== 2) throw new Error('内置课程卡片数错误：' + cards);
    if (await page.locator('.course-card .deck-cover-image[src$="oral-3000.png"]').count() !== 1) throw new Error('口语3000句封面未加载');
    if (await page.locator('.course-card .deck-cover-image[src$="idioms.png"]').count() !== 1) throw new Error('高频短语封面未加载');
    if (await page.locator('.course-card .deck-cover.has-image .deck-cover-caption').count() !== 0) throw new Error('图片已包含课程标题，不应重复叠加标题');
    if (await page.locator('.course-card .deck-card-body .deck-title').count() !== 0) throw new Error('课程卡片正文仍重复显示课程标题');
    const oralCard = page.locator('.course-card[aria-label="打开课程 口语3000句"]');
    if (await oralCard.locator('.deck-actions').count() !== 0) throw new Error('课程总览仍保留重复操作按钮');
    if ((await oralCard.locator('.deck-card-body .meta').innerText()).indexOf('65 个课节 · 3259 句') >= 0) throw new Error('课程卡片正文重复显示总句数');
    const overviewBody = await oralCard.locator('.deck-card-body').boundingBox();
    if (!overviewBody || overviewBody.height > 60) throw new Error('课程总览卡片底部空间过大：' + JSON.stringify(overviewBody));
    if ((await oralCard.locator('[data-course-progress]').innerText()).trim() !== '0 / 3259' || await oralCard.locator('[data-course-progress]').getAttribute('aria-label') !== '尚未开始学习') throw new Error('课程卡片未显示初始进度条');

    /* 系统不预置逻辑课程：没有用户创建的课程时，不应凭教材元数据生成 NCE 卡片。 */
    await page.locator('#tabCourses').click();
    if (await page.locator('.course-card').filter({ hasText: '新概念英语第一册' }).count() !== 0) throw new Error('系统不应预置新概念逻辑课程');

    /* 页签切回句子课程时，列表必须同步切回句子课程内容，而不是只切换按钮样式。 */
    await page.locator('#tabDecks').click();
    await page.waitForFunction(() => document.querySelector('#tabDecks').classList.contains('on'));
    if (await page.locator('#deckList .deck-section-title').first().innerText() !== '内置课程（2 门）') throw new Error('切回句子课程后列表未刷新');
    if (await page.locator('#deckList .course-card').count() !== 2) throw new Error('切回句子课程后课程卡片数量错误');

    /* 空目录回归：创建目录只创建目录，不凭空生成课节或内部分类。 */
    await page.evaluate(function(){
      LogicalCourseStore.create({ title:'空目录回归测试', coverImage:'data:image/png;base64,e2e-empty-cover' });
    });
    await page.locator('#tabCourses').click();
    const emptyCard = page.locator('.course-card').filter({ hasText: '空目录回归测试' });
    if (await emptyCard.count() !== 1 || (await emptyCard.locator('.meta').innerText()).indexOf('尚未导入课节') === -1) throw new Error('空目录不应生成课程内容');
    await emptyCard.click();
    await page.waitForURL(/decks\.html\?.*course=logical-course%3A/);
    if (await page.locator('.catalog-lesson').count() !== 0 || await page.locator('.catalog-group').count() !== 0 || (await page.locator('.empty-tip').innerText()).indexOf('还没有导入课节') === -1) throw new Error('空目录内部不应出现课节或分类');
    await page.locator('#decksBack').click();
    await page.waitForFunction(() => new URL(location.href).searchParams.get('course') === null);

    /* 图文课程真实回归：从统一课程卡进入播放器，再由播放器返回统一目录。 */
    const storyFixture = {
      schemaVersion: '1.0',
      courseId: 'story-catalog-e2e',
      metadata: { title: { 'zh-CN': '图文回归课程', en: 'Story catalog regression' }, description: { 'zh-CN': '统一课程目录回归测试' }, learningLocale: 'en', supportLocales: [] },
      learningObjectives: [], assets: [], scenes: [], npcs: [], practiceRoles: [],
      courseSemantics: {
        schemaVersion: '0.1', courseType: 'image_dialogue', learningFlow: 'story_graph',
        primaryLocale: 'en', supportLocales: [], learnerRoleIds: [], roleSources: [], exerciseModels: ['none'],
        modules: { core: true, preStudy: false, postAssessment: true },
        fields: { sceneDialogue: 'story.nodes[].npcMessage', learnerTarget: 'story.nodes[].sourceText', translation: 'localizedText[locale]', exerciseInstruction: 'story.nodes[].input.prompt', exerciseTemplate: 'story.nodes[].clozeTemplate', answerGaps: 'story.nodes[].gaps', answerChoices: 'story.nodes[].gaps[].choices', correctAnswer: 'story.nodes[].gaps[].correctChoiceId', speaker: 'story.nodes[].speakerId' },
        roles: { learnerRoles: 'practiceRoles[].learnerPlayable', speakers: 'npcs[] + practiceRoles[]', speakerReference: 'story.nodes[].speakerId' },
        flow: { entryPoint: 'story.startNodeId', nextNode: 'story.nodes[].transitions[].toNodeId', completion: 'completion.endings' },
        assets: { catalog: 'assets[]', reference: '*AssetId', filePath: 'assets[].path' }
      },
      courseGuide: { schemaVersion: '0.1', summary: { 'zh-CN': '完成这节图文课程。' }, steps: [{ order: 1, title: { 'zh-CN': '开始' }, description: { 'zh-CN': '完成课程节点。' } }], contentLegend: [{ kind: 'image', label: { 'zh-CN': '图片' } }] },
      story: {
        startNodeId: 'n_0',
        nodes: [
          { id: 'n_0', type: 'interaction', speakerId: 'npc', npcMessage: { en: 'Is this your handbag?', 'zh-CN': '这是您的手提包吗？' }, input: { modes: ['choice'] }, clozeTemplate: { en: '{{gap}} {{gap}} {{gap}} {{gap}}?' }, gaps: [
            { id: 'g0', correctChoiceId: 'c0', choices: [{ id: 'c0', text: { en: 'is' } }, { id: 'd0', text: { en: 'excuse' } }] },
            { id: 'g1', correctChoiceId: 'c1', choices: [{ id: 'c1', text: { en: 'this' } }, { id: 'd1', text: { en: 'excuse' } }] },
            { id: 'g2', correctChoiceId: 'c2', choices: [{ id: 'c2', text: { en: 'your' } }, { id: 'd2', text: { en: 'me' } }] },
            { id: 'g3', correctChoiceId: 'c3', choices: [{ id: 'c3', text: { en: 'handbag' } }, { id: 'd3', text: { en: 'yes' } }] }
          ], transitions: [{ toNodeId: 'end', fallback: true }] },
          { id: 'end', type: 'end', endingId: 'done' }
        ]
      },
      completion: { endings: [{ id: 'done', label: { 'zh-CN': '完成' }, description: { 'zh-CN': '图文课程已完成。' } }] },
      learningModules: { postAssessment: { schemaVersion: '0.1', title: { 'zh-CN': '课后测试' }, items: [{ id: 'check', type: 'choice', prompt: { 'zh-CN': '测试' }, targetIds: ['end'], choices: [{ id: 'yes', text: { 'zh-CN': '是', en: 'Yes' } }, { id: 'no', text: { 'zh-CN': '否', en: 'No' } }], correctChoiceId: 'yes' }] } }
    };
    const logicalId = await page.evaluate(function(){
      return LogicalCourseStore.create({ title:'我的新概念英语第一册', coverImage:'data:image/png;base64,e2e-cover' }).id;
    });
    storyFixture.logicalCourseId = logicalId;
    await page.evaluate(async function(course){ await CL.preload(); await CL.writeCourses([course]); }, storyFixture);
    await page.goto(BASE + '/decks.html?e2e=course-catalog', { waitUntil: 'networkidle' });
    await page.waitForSelector('#pageDecks:not(.hidden) .course-card');
    if (await page.locator('.course-card').filter({ hasText: '图文回归课程' }).count() !== 0) {
      throw new Error('图文课程不应重复出现在句子课程标签');
    }

    /* 冷启动时直接切换标签也必须先看到目录卡，不能把已归属课节短暂渲染成顶层课程。 */
    await page.goto(BASE + '/decks.html?e2e=course-catalog&cold=1', { waitUntil: 'domcontentloaded' });
    await page.locator('#tabCourses').click();
    await page.waitForSelector('#pageDecks:not(.hidden) .deck-section-title');
    if (await page.locator('.course-card').filter({ hasText: '我的新概念英语第一册' }).count() !== 1 || await page.locator('.course-card').filter({ hasText: '图文回归课程' }).count() !== 0) {
      throw new Error('冷启动切换图文课程时未优先显示用户目录');
    }
    await page.locator('.course-card').filter({ hasText: '我的新概念英语第一册' }).click();
    await page.waitForURL(/decks\.html\?.*course=logical-course%3A/);
    await page.locator('#decksBack').click();
    await page.waitForFunction(() => new URL(location.href).searchParams.get('course') === null);

    await page.locator('#tabCourses').click();
    await page.waitForSelector('#pageDecks:not(.hidden) .deck-section-title');
    const storyCard = page.locator('.course-card').filter({ hasText: '我的新概念英语第一册' });
    if (await storyCard.count() !== 1) throw new Error('图文课程未进入图文课程标签');
    if (await storyCard.locator('[data-course-progress]').count() !== 0) throw new Error('图文课程错误显示句子进度');
    if (await storyCard.locator('.deck-cover-image').count() !== 1) throw new Error('逻辑课程未显示用户封面');
    await storyCard.click();
    await page.waitForURL(/decks\.html\?.*course=logical-course%3A/);
    await page.waitForSelector('.catalog-lesson');
    if (await page.locator('.catalog-lesson').count() !== 1) throw new Error('用户逻辑课程未显示已导入课节');
    if (await page.locator('.catalog-group-title').count() !== 0) throw new Error('目录不应生成与目录同名的内部分类');
    const lessonImage = page.locator('.catalog-lesson-media img').first();
    if (await lessonImage.getAttribute('src') !== 'assets/catalog/lesson-placeholder.svg') throw new Error('课节无独立图片时不应复用目录封面');
    if (await page.locator('.catalog-lesson .lesson-meta').first().innerText() !== '图文课节') throw new Error('图文课节不应显示 0 句');
    const singleLessonWidth = await page.locator('.catalog-lesson').first().evaluate(function(el){ return el.getBoundingClientRect().width; });
    if (singleLessonWidth > 360) throw new Error('单个图文课节卡片不应拉伸到整行：' + singleLessonWidth);
    await page.locator('.catalog-lesson').first().click();
    await page.waitForURL(/courses\.html\?.*id=story-catalog-e2e.*catalogCourse=logical-course%3A/);
    await page.waitForSelector('#coursePlayer:not(.hidden)');
    if (await page.locator('#playerTitle').innerText() !== '图文回归课程') throw new Error('图文课程播放器未加载');
    const wordBankTexts = await page.locator('.word-chip').allTextContents();
    if (wordBankTexts.length !== 4 || wordBankTexts.sort().join('|') !== 'handbag|is|this|your') throw new Error('填空题词块池不应混入各空位的局部干扰项：' + JSON.stringify(wordBankTexts));
    const restartIconSize = await page.locator('#btnRestart .icon').evaluate(function(el){ const r = el.getBoundingClientRect(); return { width:r.width, height:r.height }; });
    if (restartIconSize.width > 20 || restartIconSize.height > 20) throw new Error('重新开始图标尺寸异常：' + JSON.stringify(restartIconSize));
    const playerImage = page.locator('#playerImage img');
    if (await playerImage.count() && await playerImage.evaluate(function(el){ return getComputedStyle(el).objectFit; }) !== 'contain') throw new Error('课程图片不应被裁剪');
    const desktopStageLayout = await page.locator('.course-stage').evaluate(function(el){ const style = getComputedStyle(el); return { display: style.display, columns: style.gridTemplateColumns }; });
    if (desktopStageLayout.display !== 'grid' || desktopStageLayout.columns === 'none') throw new Error('PC 课程播放器应使用左右双栏');
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileStageLayout = await page.locator('.course-stage').evaluate(function(el){ const style = getComputedStyle(el); return { display: style.display, direction: style.flexDirection }; });
    if (mobileStageLayout.display !== 'flex' || mobileStageLayout.direction !== 'column') throw new Error('移动端课程播放器应切换为上下结构');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('#playerBack').click();
    await page.waitForURL(/decks\.html\?.*course=logical-course%3A/);
    await page.waitForSelector('.catalog-lesson');
    if (await page.locator('.catalog-lesson').count() !== 1) throw new Error('图文课程返回后未进入统一课节目录');
    await page.locator('#decksBack').click();
    await page.waitForFunction(() => new URL(location.href).searchParams.get('course') === null);
    await page.waitForSelector('#pageDecks:not(.hidden) .course-card');
    if (await page.locator('.course-card').filter({ hasText: '我的新概念英语第一册' }).count() !== 0) throw new Error('返回后图文课程仍混入句子课程标签');
    await page.evaluate(async function(){
      var m = CL.loadMem();
      m.stats = m.stats || { bySentence: {} };
      m.stats.bySentence = m.stats.bySentence || {};
      m.stats.bySentence['oral-1-1-1#575b1d3a'] = { deckId:'oral-1-1-1', cid:'575b1d3a', times:1, okTimes:1, wrongTimes:0, streak:1, dueAt:Date.now()+86400000 };
      await CL.saveAndNotify(m, 'local');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#pageDecks:not(.hidden) .course-card');
    await page.waitForFunction(() => Array.from(document.querySelectorAll('[data-course-progress]')).some(function(el){ return (el.getAttribute('aria-label') || '').indexOf('已覆盖 1 / 3259 句') >= 0; }));
    const progressCard = page.locator('.course-card[aria-label="打开课程 口语3000句"]').locator('[data-course-progress]');
    if (await progressCard.getAttribute('aria-label') !== '已覆盖 1 / 3259 句 · 0%' || await progressCard.innerText() !== '1 / 3259' || await progressCard.locator('.course-progress-fill').evaluate(el => parseFloat(el.style.width) <= 0)) throw new Error('课程卡片进度条口径错误');
    await oralCard.click();
    await page.waitForFunction(() => new URL(location.href).searchParams.get('course') === 'builtin:oral');
    await page.goto(BASE + '/decks.html?e2e=course-catalog', { waitUntil: 'networkidle' });
    await page.waitForSelector('#pageDecks:not(.hidden) .course-card');
    await page.locator('.course-card[aria-label="打开课程 口语3000句"]').click();
    await page.waitForURL(/decks\.html\?.*course=builtin%3Aoral/);
    const lessons = await page.locator('.catalog-lesson').count();
    if (lessons !== 65) throw new Error('口语目录课节数错误：' + lessons);
    if (await page.locator('#deckPageTitle').innerText() !== '口语3000句 · 65 个课节') throw new Error('课程标题未移到页面顶部');
    if (await page.locator('#catalogViewSwitch').evaluate(el => el.classList.contains('hidden')) || await page.locator('#catalogViewSwitch').count() !== 1) throw new Error('课程目录缺少视图切换');
    if (await page.locator('#deckList.catalog-flat-view').count() !== 0 || await page.locator('#catalogViewSwitch svg').count() !== 1 || await page.locator('#catalogViewSwitch svg').evaluate(el => el.getBoundingClientRect().width <= 0)) throw new Error('课程目录默认应为分组卡片视图');
    const groupedDots = await page.locator('#catalogViewSwitch svg circle').evaluateAll(function (els) {
      return { x: new Set(els.map(el => el.getAttribute('cx'))).size, y: new Set(els.map(el => el.getAttribute('cy'))).size, radius: els[0] && els[0].getAttribute('r') };
    });
    if (groupedDots.x !== 2 || groupedDots.y !== 3 || groupedDots.radius !== '2') throw new Error('分类图标应为每行2点、共3行且点径适中');
    if (await page.locator('.course-card').count() !== 0) throw new Error('进入课程后仍显示课程封面卡片');
    const directoryLayout = await page.locator('.catalog-lesson').first().evaluate(function (el) {
      const style = getComputedStyle(el);
      return { display: style.display, border: style.border, borderRadius: style.borderRadius, width: el.getBoundingClientRect().width };
    });
    if (directoryLayout.display !== 'flex' || directoryLayout.borderRadius === '0px' || directoryLayout.width < 180) {
      throw new Error('课程目录没有保持卡片布局：' + JSON.stringify(directoryLayout));
    }
    await page.locator('#catalogViewSwitch').click();
    await page.waitForSelector('#deckList.catalog-flat-view');
    if (await page.locator('.catalog-group').count() !== 0 || await page.locator('.catalog-lesson').count() !== 65) {
      throw new Error('不分类视图未保持紧凑卡片目录');
    }
    const flatDots = await page.locator('#catalogViewSwitch svg circle').evaluateAll(function (els) {
      return { x: new Set(els.map(el => el.getAttribute('cx'))).size, y: new Set(els.map(el => el.getAttribute('cy'))).size, radius: els[0] && els[0].getAttribute('r') };
    });
    if (flatDots.x !== 3 || flatDots.y !== 2 || flatDots.radius !== '2') throw new Error('不分类图标应为每行3点、共2行且点径适中');
    await page.locator('#catalogViewSwitch').click();
    await page.waitForSelector('#deckList:not(.catalog-flat-view) .catalog-group');
    const cardBalance = await page.locator('.catalog-lesson').first().evaluate(function (el) {
      const media = el.querySelector('.catalog-lesson-media');
      return { card: el.getBoundingClientRect().height, media: media.getBoundingClientRect().height };
    });
    if (cardBalance.card - cardBalance.media >= 80) throw new Error('课节卡片底部空间过大：' + JSON.stringify(cardBalance));
    const firstGroup = page.locator('.catalog-group').first();
    if (await page.locator('.catalog-group-caret svg').count() !== await page.locator('.catalog-group').count()) throw new Error('主题分组未使用标准箭头图标');
    const groupDivider = await firstGroup.evaluate(function (el) {
      return getComputedStyle(el).borderBottomStyle + ' ' + getComputedStyle(el).borderBottomColor;
    });
    if (groupDivider.indexOf('none') === -1) throw new Error('主题分组不应显示底部实线分隔');
    if (await page.locator('.catalog-lesson-media img').count() !== 65) throw new Error('课节卡片图片位未完整渲染');
    const firstToggle = firstGroup.locator('.catalog-group-toggle');
    await firstToggle.click();
    if (await firstGroup.locator('.catalog-lessons').getAttribute('hidden') === null || await firstGroup.locator('.catalog-lessons').isVisible() || await firstToggle.getAttribute('aria-expanded') !== 'false') {
      throw new Error('主题分组收起失败');
    }
    await firstToggle.click();
    if (await firstGroup.locator('.catalog-lessons').getAttribute('hidden') !== null || !await firstGroup.locator('.catalog-lessons').isVisible() || await firstToggle.getAttribute('aria-expanded') !== 'true') {
      throw new Error('主题分组展开失败');
    }
    if (await page.locator('.catalog-lesson button').count() !== 0) throw new Error('课节卡片仍显示开始按钮');
    await page.locator('.catalog-lesson').first().click();
    await page.waitForURL(/main\.html\?.*course=builtin%3Aoral.*lesson=/);
    await page.waitForSelector('#pagePractice:not(.hidden)');
    await page.waitForFunction(() => !!(document.getElementById('deckName') && document.getElementById('deckName').textContent.trim()));
    const deckName = await page.locator('#deckName').innerText();
    if (!deckName) throw new Error('课节启动后未加载原句子单元');
    await page.goBack();
    await page.waitForURL(/decks\.html\?.*course=builtin%3Aoral/);
    await page.waitForSelector('.catalog-lesson');
    if (await page.locator('.catalog-lesson').count() !== 65) throw new Error('返回后目录未恢复');
    await page.locator('#decksBack').click();
    await page.waitForFunction(() => new URL(location.href).searchParams.get('course') === null);
    await page.waitForSelector('#pageDecks:not(.hidden) .course-card');
    if (await page.locator('.catalog-lesson').count() !== 0) throw new Error('返回课程后仍停留在目录');
    const extraStoryFixture = JSON.parse(JSON.stringify(storyFixture));
    extraStoryFixture.courseId = 'story-catalog-delete-e2e';
    extraStoryFixture.metadata.title['zh-CN'] = '待删除课节';
    extraStoryFixture.logicalCourseId = logicalId;
    await page.evaluate(async function(courses){ await CL.preload(); await CL.writeCourses(courses); }, [storyFixture, extraStoryFixture]);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#pageDecks:not(.hidden) .course-card');
    await page.locator('#tabCourses').click();
    await page.waitForSelector('#pageDecks:not(.hidden) .course-card');
    const managedCategory = page.locator('.course-card').filter({ hasText: '我的新概念英语第一册' });
    if (await managedCategory.locator('.course-manage-trigger').count() !== 1) throw new Error('用户课程目录缺少管理菜单');
    const categoryManageIcon = managedCategory.locator('.course-manage-trigger');
    if (await categoryManageIcon.locator('svg').count() !== 1 || (await categoryManageIcon.innerText()).trim() !== '' || await categoryManageIcon.locator('circle').count() !== 3) throw new Error('课程管理入口必须显示三点 SVG 图标，不能显示“管理”文字');
    const manageLayout = await managedCategory.locator('.course-manage-wrap').evaluate(function(el){
      const meta = el.closest('.meta');
      const box = el.getBoundingClientRect();
      const metaBox = meta && meta.getBoundingClientRect();
      return { position: getComputedStyle(el).position, sameLine: !!meta && box.top < metaBox.bottom && box.bottom > metaBox.top, rightAligned: !!meta && Math.abs(metaBox.right - box.right) < 1 };
    });
    if (manageLayout.position !== 'static' || !manageLayout.sameLine || !manageLayout.rightAligned) throw new Error('课程管理菜单未与描述内容同一行并右对齐：' + JSON.stringify(manageLayout));
    await managedCategory.locator('.course-manage-trigger').click();
    if ((await managedCategory.locator('.course-manage-item').allTextContents()).join('|') !== '删除分类') throw new Error('分类管理菜单内容错误');
    await managedCategory.click();
    await page.waitForURL(/decks\.html\?.*course=logical-course%3A/);
    if (await page.locator('.catalog-lesson .course-manage-trigger').count() !== 2) throw new Error('分类内课程缺少管理菜单');
    const lessonManageIcons = page.locator('.catalog-lesson .course-manage-trigger');
    if (await lessonManageIcons.evaluateAll(function (els) { return els.every(function (el) { return !!el.querySelector('svg') && !(el.textContent || '').trim() && el.querySelectorAll('circle').length === 3; }); }) === false) throw new Error('课节管理入口必须显示三点 SVG 图标，不能显示“管理”文字');
    const removableLesson = page.locator('.catalog-lesson').filter({ hasText: '待删除课节' });
    await removableLesson.locator('.course-manage-trigger').click();
    if ((await removableLesson.locator('.course-manage-item').allTextContents()).join('|') !== '移出分类|删除课程') throw new Error('分类内课程管理菜单内容错误');
    await removableLesson.locator('.course-manage-item').filter({ hasText: '删除课程' }).click();
    await page.waitForSelector('#courseConfirmMask:not([hidden])');
    if (await page.locator('#courseConfirmTitle').innerText() !== '删除课程') throw new Error('删除课程未使用页面内确认框');
    await page.locator('#courseConfirmOk').click();
    await page.waitForFunction(() => !Array.from(document.querySelectorAll('.catalog-lesson')).some(function(el){ return el.textContent.indexOf('待删除课节') >= 0; }));
    if (await page.locator('.catalog-lesson').count() !== 1) throw new Error('分类内删除课程后目录数量错误');
    await page.locator('#decksBack').click();
    await page.waitForFunction(() => new URL(location.href).searchParams.get('course') === null);
    await page.locator('#tabCourses').click();
    await page.waitForSelector('#pageDecks:not(.hidden) .course-card');
    const categoryCard = page.locator('.course-card').filter({ hasText: '我的新概念英语第一册' });
    await categoryCard.locator('.course-manage-trigger').click();
    await categoryCard.locator('.course-manage-item').filter({ hasText: '删除分类' }).click();
    await page.waitForSelector('#courseConfirmMask:not([hidden])');
    if (await page.locator('#courseConfirmTitle').innerText() !== '删除分类') throw new Error('删除分类未使用页面内确认框');
    await page.locator('#courseConfirmOk').click();
    await page.waitForFunction(() => !Array.from(document.querySelectorAll('.course-card')).some(function(el){ return el.textContent.indexOf('我的新概念英语第一册') >= 0; }));
    const unclassifiedCourse = page.locator('.course-card').filter({ hasText: '图文回归课程' });
    if (await unclassifiedCourse.count() !== 1) throw new Error('删除分类后课程未移入未分类');
    await unclassifiedCourse.locator('.course-manage-trigger').click();
    await unclassifiedCourse.locator('.course-manage-item').filter({ hasText: '删除课程' }).click();
    await page.waitForSelector('#courseConfirmMask:not([hidden])');
    await page.locator('#courseConfirmOk').click();
    await page.waitForFunction(() => !Array.from(document.querySelectorAll('.course-card')).some(function(el){ return el.textContent.indexOf('图文回归课程') >= 0; }));
    console.log('[course-catalog] 课程卡片、65 课节目录、URL 启动与返回通过');
  } catch (error) {
    console.error('[course-catalog] failed:', error && error.message || error);
    process.exitCode = 1;
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
    stopServer();
  }
})();
