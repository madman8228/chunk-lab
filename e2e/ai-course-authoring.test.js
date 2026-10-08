'use strict';
const { waitForAsync } = require('./lib/wait-async');
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(10420, 100);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-ai-authoring-'));
const COURSE = {
  format: 'chunklab-ai-course', formatVersion: '1.1', title: '浏览器验收课程', description: '验证 AI 制作课程流程。', targetCefr: 'B1', contentForm: 'dialogue',
  learning: { template: 'sentence-practice', version: 1, modes: ['typing', 'chunkSelection'], defaultMode: 'chunkSelection' },
  roles: [{ key: 'guest', name: '客人' }, { key: 'staff', name: '前台' }],
  items: [
    { en: "I'd like to check in.", zh: '我想办理入住。', role: 'guest', chunks: ["I'd like", 'to check in.'], hints: ['我想', '办理入住'] },
    { en: 'May I have your name?', zh: '请问您叫什么名字？', role: 'staff', chunks: ['May I have', 'your name?'], hints: ['请问我可以知道', '您的名字吗？'] }
  ]
};
let server;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], { cwd: path.join(ROOT, 'server'), env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test' }), stdio: 'ignore' });
    let tries = 0;
    const timer = setInterval(function () {
      if (server.exitCode !== null) { clearInterval(timer); reject(new Error('server exit ' + server.exitCode)); return; }
      const req = http.get(BASE + '/api/health', function (res) { res.resume(); if (res.statusCode === 200) { clearInterval(timer); resolve(); } });
      req.on('error', function () {}); req.setTimeout(700, function () { req.destroy(); });
      if (++tries > 120) { clearInterval(timer); reject(new Error('server start timeout')); }
    }, 100);
  });
}

function stopServer() {
  if (server) try { server.kill('SIGKILL'); } catch (error) {}
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (error) {}
}

async function enterPreview(page) {
  await page.goto(BASE + '/course-create.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-action=copy-prompt]', { timeout: 15000 });
  if (await page.locator('ol.stepper[aria-label="课程制作步骤"] > li.step').count() !== 3) throw new Error('制作流程应以有序步骤进度条呈现');
  if (await page.locator('ol.stepper > li.step[aria-current="step"] b').innerText() !== '准备制作指令') throw new Error('准备阶段未正确标记当前步骤');
  const desktopStepper = await page.evaluate(function(){
    return Array.from(document.querySelectorAll('.stepper .step')).map(function(item){
      const marker = item.querySelector('span').getBoundingClientRect();
      return { x:marker.left + marker.width / 2, line:getComputedStyle(item,'::after').width };
    });
  });
  if (!(desktopStepper[0].x < desktopStepper[1].x && desktopStepper[1].x < desktopStepper[2].x) || parseFloat(desktopStepper[0].line) < 1) throw new Error('步骤圆点和进度连线布局错误：' + JSON.stringify(desktopStepper));
  await page.setViewportSize({ width:375, height:812 });
  const mobileStepper = await page.evaluate(function(){
    const list = document.querySelector('.stepper'), rect = list.getBoundingClientRect();
    return { clientWidth:list.clientWidth, scrollWidth:list.scrollWidth, left:rect.left, right:rect.right, labels:Array.from(list.querySelectorAll('b')).map(function(label){ return parseFloat(getComputedStyle(label).fontSize); }) };
  });
  if (mobileStepper.scrollWidth > mobileStepper.clientWidth || mobileStepper.left < 0 || mobileStepper.right > 375 || mobileStepper.labels.some(function(size){ return size < 11; })) throw new Error('手机端制作步骤被挤压或溢出：' + JSON.stringify(mobileStepper));
  await page.setViewportSize({ width:1280, height:900 });
  if (await page.locator('.create-setup-card h2').count()) throw new Error('准备页卡片标题应移除');
  if (await page.locator('[name="courseType"]').count() !== 2 || await page.locator('[name="courseType"][value="sentence"]').count() !== 1 || await page.locator('[name="courseType"][value="imageText"]').count() !== 1) throw new Error('课程形式必须只包含句子课程和图文课程');
  const palette = await page.evaluate(function () { return { background: getComputedStyle(document.body).backgroundColor, card: getComputedStyle(document.querySelector('.create-card')).backgroundColor }; });
  if (palette.background !== 'rgb(244, 242, 238)' || palette.card !== 'rgb(255, 253, 250)') throw new Error('课程制作页未使用课程库主题色');
  if (await page.locator('[name="topicId"], [name="itemCount"]').count()) throw new Error('主题和课程长度仍被固定选项限制');
  if (await page.getByRole('checkbox', { name: /跟读|听写/ }).count()) throw new Error('不支持的跟读或听写仍出现在课程制作选项中');
  await page.locator('[name="targetCefrs"][value="B1"]').check();
  await page.locator('[name="targetCefrs"][value="B2"]').check();
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-action=copy-prompt]', { timeout: 15000 });
  if (!(await page.locator('[name="targetCefrs"][value="B1"]').isChecked()) || !(await page.locator('[name="targetCefrs"][value="B2"]').isChecked())) throw new Error('多选难度没有从草稿恢复');
  if ((await page.locator('.persistence-note').innerText()).includes('课程方案已记录')) throw new Error('普通保存状态不应显示冗余提示');
  await page.getByRole('button', { name: /复制.*制作指令/ }).click();
  if (await page.locator('[data-action=manual-copied]').count()) await page.locator('[data-action=manual-copied]').click();
  /* 复制是异步的（先落草稿、再写剪贴板）；click() 在点击处理器完成前就返回，紧接着 readText 会读到
     空/旧值（更慢的 CI 上稳定命中）。轮询等待剪贴板真正写入指令后再断言内容——等待而非跳过：
     指令始终写不进去仍会超时判红。 */
  await waitForAsync(page, async function () {
    try {
      const text = await navigator.clipboard.readText();
      return typeof text === 'string' && text.indexOf('先问用户想制作什么课程') >= 0;
    } catch (error) { return false; }
  }, undefined, { timeout: 15000 });
  const prompt = await page.evaluate(function () { return navigator.clipboard.readText(); });
  if (!/"acceptableCefrLevels":\s*\[\s*"B1",\s*"B2"\s*\]/.test(prompt) || !prompt.includes('先问用户想制作什么课程') || !prompt.includes('课程长度没有预设值')) throw new Error('AI 指令未保留难度多选或没有改为交互确认需求');
  await page.waitForSelector('#rawResult');
  const receiveStep = await page.evaluate(function () {
    return { current:document.querySelector('ol.stepper > li.step[aria-current="step"] b')?.textContent.trim(), subtitle:Array.from(document.querySelectorAll('.create-heading p')).map(function(node){ return node.textContent.trim(); }) };
  });
  if (receiveStep.current !== '与 AI 制作课程' || receiveStep.subtitle.length) throw new Error('接收课程阶段应突出步骤状态并删除冗余副标题：' + JSON.stringify(receiveStep));
  await page.locator('#rawResult').fill('{ not a course }');
  await page.locator('[data-action=validate-result]').click();
  try { await page.waitForSelector('[data-action=repair]', { timeout: 5000 }); }
  catch (error) { throw new Error('格式错误没有显示修复入口：' + (await page.locator('body').innerText()).slice(0, 500)); }
  await page.locator('[data-action=repair]').click();
  if (await page.locator('[data-prompt-text]').count()) {
    if (!(await page.locator('[data-prompt-text]').inputValue()).includes('JSON Schema')) throw new Error('修复指令剪贴板降级没有显示完整内容');
  } else {
    try { await page.waitForFunction(function () { return document.body.innerText.includes('修复指令已复制'); }, undefined, { timeout: 5000 }); }
    catch (error) { throw new Error('修复指令没有反馈复制结果：' + (await page.locator('body').innerText()).slice(0, 500)); }
  }
  await page.locator('#rawResult').fill(JSON.stringify(COURSE));
  await page.locator('[data-action=validate-result]').click();
  try { await page.waitForSelector('.course-summary', { timeout: 8000 }); }
  catch (error) { throw new Error('有效课程未进入预览：' + (await page.locator('body').innerText()).slice(0, 800)); }
}

async function captureDownload(page) {
  await page.evaluate(function () {
    const createObjectURL = URL.createObjectURL.bind(URL);
    const anchorClick = HTMLAnchorElement.prototype.click;
    window.__capturedDownloadName = null;
    window.__capturedDownloadText = null;
    URL.createObjectURL = function (blob) {
      if (blob.type && blob.type.indexOf('application/json') === 0) window.__capturedDownloadText = blob.text();
      return createObjectURL(blob);
    };
    HTMLAnchorElement.prototype.click = function () {
      if (this.download && window.__capturedDownloadText) { window.__capturedDownloadName = this.download; return; }
      return anchorClick.call(this);
    };
    window.__restoreDownloadCapture = function () {
      URL.createObjectURL = createObjectURL;
      HTMLAnchorElement.prototype.click = anchorClick;
    };
  });
  await page.locator('[data-action=export]').click();
  await page.waitForFunction(function () {
    return !!window.__capturedDownloadName && !!window.__capturedDownloadText;
  }, undefined, { timeout: 15000 });
  const result = await page.evaluate(async function () {
    return { fileName:window.__capturedDownloadName, text:await window.__capturedDownloadText };
  });
  await page.evaluate(function () { window.__restoreDownloadCapture(); });
  return result;
}

(async function () {
  let browser;
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', function (error) { pageErrors.push(error.message); });
    await page.route('**/api/**', function (route) { route.abort('failed'); });

    await page.goto(BASE + '/decks.html?e2e=ai-course-authoring', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: '用 AI 制作课程' }).click();
    await enterPreview(page);
    const preview = await page.evaluate(function () {
      return { courses: CL.loadMem().decks.length, modes: Array.from(document.querySelectorAll('.mode-pill')).map(function (item) { return item.innerText; }) };
    });
    if (preview.courses !== 0) throw new Error('仅预览课程时不应写入课程库');
    if (!preview.modes.some(function (mode) { return mode.indexOf('typing · 可用') === 0; }) || !preview.modes.some(function (mode) { return mode.indexOf('chunkSelection · 可用') === 0; })) throw new Error('预览没有准确显示原生句子练习能力');

    await page.evaluate(function () {
      window.__originalSaveAndNotify = CL.saveAndNotify;
      window.__failCourseSave = true;
      CL.saveAndNotify = function () {
        if (window.__failCourseSave) { window.__failCourseSave = false; return Promise.resolve(false); }
        return window.__originalSaveAndNotify.apply(this, arguments);
      };
    });
    await page.locator('[data-action=save]').click();
    await page.waitForSelector('.global-error');
    if (await page.evaluate(function () { return CL.loadMem().decks.length; }) !== 0) throw new Error('保存失败仍写入了课程');
    await page.evaluate(function () { CL.saveAndNotify = window.__originalSaveAndNotify; });
    await page.locator('[data-action=save]').click();
    try { await page.waitForFunction(function () { return document.body.innerText.includes('课程已保存到当前账号'); }, { timeout: 15000 }); }
    catch (error) { throw new Error('再次保存后未显示成功状态：' + (await page.locator('body').innerText()).slice(-1200)); }
    const saved = await page.evaluate(function () { return { decks: CL.loadMem().decks, sessionId: document.querySelector('#course-create-root').dataset.sessionId }; });
    if (saved.decks.length !== 1 || saved.decks[0].id.indexOf('ai-') !== 0 || saved.decks[0].authoring.template !== 'sentence-practice') throw new Error('制作课程没有保存为原生句子课程');
    if (await page.evaluate(function (id) { return CourseEnrollment.isJoined('user-deck:' + id); }, saved.decks[0].id)) throw new Error('保存课程不应自动加入学习');

    const sentenceExport=await captureDownload(page);
    const sharedDraft=JSON.parse(sentenceExport.text);
    if (!sentenceExport.fileName.endsWith('.chunklab-course.json')) throw new Error('句子课程分享文件名不正确');
    if (sharedDraft.courseId || sharedDraft.sessionId || sharedDraft.identity || sharedDraft.brief) throw new Error('分享文件包含网站身份或私人需求');

    await page.goto(BASE + '/course-create.html?session=' + encodeURIComponent(saved.sessionId), { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-action=join]');

    await page.evaluate(function () {
      window.__originalJoin = CourseEnrollment.join;
      window.__failJoin = true;
      CourseEnrollment.join = function () {
        if (window.__failJoin) { window.__failJoin = false; return Promise.reject(new Error('测试加入失败')); }
        return window.__originalJoin.apply(this, arguments);
      };
    });
    await page.locator('[data-action=join]').click();
    try { await page.waitForSelector('.issue-panel.has-error', { timeout: 5000 }); }
    catch (error) { throw new Error('加入失败后没有显示可恢复状态：' + (await page.locator('body').innerText()).slice(0, 500)); }
    if (await page.evaluate(function () { return CL.loadMem().decks.length; }) !== 1 || !(await page.locator('[data-action=join]').count())) throw new Error('加入失败时课程没有保留供单独重试');
    await page.evaluate(function () { CourseEnrollment.join = window.__originalJoin; });
    await page.locator('[data-action=join]').click();
    await page.waitForURL(new RegExp('/main\\.html\\?course=user-deck%3A' + encodeURIComponent(saved.decks[0].id)), { timeout: 15000 });
    await page.waitForSelector('#stage:not(.hidden)');
    await page.waitForFunction((title) => document.getElementById('deckName')?.textContent.includes(title), COURSE.title, { timeout: 15000 });
    if (!(await page.locator('#deckName').innerText()).includes(COURSE.title)) throw new Error('课程没有进入现有原生学习页：' + page.url() + ' / ' + (await page.locator('body').innerText()).slice(0, 300));
    if (await page.locator('#courseContext').innerText() !== '角色：客人') throw new Error('原生学习页没有呈现当前对话角色');
    const sessionMode = page.locator('#courseModeTrigger');
    if (!(await sessionMode.isVisible())) throw new Error('AI 课程没有显示其当前模板支持的会话内练习切换');
    if (await page.evaluate(function () { return CL.loadMem().settings.mode; }) !== 'choose') throw new Error('AI 课程默认方式污染了全局练习设置');
    await sessionMode.click();
    await page.locator('#courseModeMenu [data-course-mode="chunkSelection"]').click();
    if (!(await page.locator('#track').evaluate(function (node) { return node.classList.contains('compact-chunks'); }))) throw new Error('课程会话内意群选择没有切换到原生答题组件');
    if (await page.evaluate(function () { return CL.loadMem().settings.mode; }) !== 'choose') throw new Error('切换课程练习方式污染了全局设置');
    const modeReceipt = await page.evaluate(async function () {
      if (await CL.lastSave() === false) throw new Error('练习方式本机提交失败');
      const id = S.deck.id, progress = CL.loadMem().progress[id];
      if (!progress || progress.practiceMode !== 'chunkSelection' || !progress.sessionId) throw new Error('刷新前练习方式尚未形成保存记录');
      return { deckId:id, sessionId:progress.sessionId };
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#stage:not(.hidden)', { timeout: 15000 });
    const restoredModeLabel = await page.locator('#courseModeLabel').innerText();
    if (restoredModeLabel !== '意群选择') {
      const restoreState = await page.evaluate(function () {
        const id = S.deck && S.deck.id;
        return { label:document.getElementById('courseModeLabel').textContent,
          booted:window._mainBooted, deckId:id, courseLearning:S.courseLearning,
          progress:id && mem.progress && mem.progress[id],
          storedProgress:id && CL.loadMem().progress && CL.loadMem().progress[id],
          practiceVisible:!document.getElementById('pagePractice').classList.contains('hidden') };
      });
      throw new Error('刷新后没有恢复该课程上次选择的练习方式：' + JSON.stringify({ testedLabel:restoredModeLabel, ...restoreState }));
    }
    const retainedSession = await page.evaluate(function (receipt) {
      const progress = CL.loadMem().progress[receipt.deckId];
      return S.deck.id === receipt.deckId && S.sessionId === receipt.sessionId &&
        progress && progress.sessionId === receipt.sessionId && progress.practiceMode === 'chunkSelection';
    }, modeReceipt);
    if (!retainedSession) throw new Error('刷新恢复了默认模式但未保留原会话进度');
    await page.locator('#courseModeTrigger').click();
    await page.locator('#courseModeMenu [data-course-mode="typing"]').click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#stage:not(.hidden)', { timeout: 15000 });
    if (!(await page.locator('#deckName').innerText()).includes(COURSE.title) || await page.locator('#courseModeLabel').innerText() !== '输入') throw new Error('刷新后没有从课程地址恢复原生课程与默认练习方式');
    const firstChunkInputs = page.locator('#track input.chunk-input[data-ci="0"]');
    await firstChunkInputs.nth(0).fill('wrong');
    await firstChunkInputs.nth(0).press('Enter');
    await page.waitForFunction(function () { return S.wrongAttempts[0] === 1; }, null, { timeout: 7000 }).catch(async function () { throw new Error('输入练习没有记录答错：' + JSON.stringify(await page.evaluate(function () { return { mode: effectivePracticeMode(), values: Array.from(document.querySelectorAll('#track input.chunk-input')).map(function (input) { return { value: input.value, disabled: input.disabled }; }), attempts: S.wrongAttempts, chunkIdx: S.chunkIdx }; }))); });
    async function submitChunk(index, text) {
      const words = text.split(/\s+/);
      const inputs = page.locator('#track input.chunk-input[data-ci="' + index + '"]');
      await inputs.first().waitFor({ state: 'visible' });
      for (let word = 0; word < words.length; word++) await inputs.nth(word).fill(words[word]);
      await inputs.nth(words.length - 1).press('Enter');
    }
    await submitChunk(0, COURSE.items[0].chunks[0]);
    await submitChunk(1, COURSE.items[0].chunks[1]);
    await page.locator('#btnNext').waitFor({ state: 'visible' });
    const explanationPanel = page.locator('.explain-panel.current');
    if (await explanationPanel.count()) {
      const sentenceBreakdown = await explanationPanel.innerText();
      if (sentenceBreakdown.includes('句子拆解') || await explanationPanel.locator('.explain-chunk-list').count()) {
        throw new Error('AI 课程答题后的讲解卡片不应重复显示句子拆解');
      }
    }
    await page.waitForFunction(function () { return /下一题 \(\d+s\)/.test(document.querySelector('#btnNext')?.textContent || ''); }, null, { timeout: 5000 });
    await page.locator('#btnNext').click();
    await page.waitForFunction(function () { return S.idx === 1; }, null, { timeout: 10000 }).catch(async function () { throw new Error('原生答题没有完成第一句：' + JSON.stringify(await page.evaluate(function () { return { mode: effectivePracticeMode(), values: Array.from(document.querySelectorAll('#track input.chunk-input')).map(function (input) { return input.value; }), attempts: S.wrongAttempts, answers: S.answers, status: S.status, chunkIdx: S.chunkIdx, idx: S.idx }; }))); });
    const courseContextText = await page.locator('#courseContext').innerText();
    if (!courseContextText.includes('角色：前台') || !courseContextText.includes('上句：我想办理入住。')) throw new Error('原生学习页没有保留对话角色与前句语境');
    const nativeStats = await page.evaluate(function (id) { return Object.values(CL.loadMem().stats.bySentence || {}).find(function (item) { return item.deckId === id; }); }, saved.decks[0].id);
    if (!nativeStats || nativeStats.times !== 1 || nativeStats.wrongTimes !== 1) throw new Error('原生答题结果未按一次答题与一次错误写入课程统计');
    const joined = await page.evaluate(function (id) { const memberships = CL.readProgress(); return memberships['enrollment:v1:' + encodeURIComponent('user-deck:' + id)]?.joined === true; }, saved.decks[0].id);
    if (!joined) throw new Error('显式加入课程后没有建立原生目录关系');

    const second = await browser.newContext({ acceptDownloads: true });
    const pageB = await second.newPage();
    const secondErrors = [];
    pageB.on('pageerror', function (error) { secondErrors.push(error.message); });
    await pageB.route('**/api/**', function (route) { route.abort('failed'); });
    await pageB.goto(BASE + '/course-create.html', { waitUntil: 'domcontentloaded' });
    if (await pageB.evaluate(function () { return CL.loadMem().decks.length; }) !== 0) throw new Error('新浏览器看到了其他账号的课程');
    await pageB.waitForFunction(function () {
      const root = document.getElementById('course-create-root');
      return !!(root && root.getAttribute('data-session-id'));
    }, null, { timeout:10000 });
    const secondSession = await pageB.locator('#course-create-root').getAttribute('data-session-id');
    const staleTab = await second.newPage();
    await staleTab.route('**/api/**', function (route) { route.abort('failed'); });
    await staleTab.goto(BASE + '/course-create.html?session=' + encodeURIComponent(secondSession), { waitUntil: 'domcontentloaded' });
    await pageB.locator('#brief').fill('第一个标签页的需求');
    await waitForAsync(pageB, async function (sessionId) {
      if (!sessionId) return false;
      if (!indexedDB.databases) return false;
      const databases = await indexedDB.databases();
      const info = databases.find(function (item) { return item.name && item.name.endsWith('-authoring-v1'); });
      if (!info) return false;
      const db = await new Promise(function (resolve, reject) {
        const request = indexedDB.open(info.name);
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { reject(request.error); };
      });
      const snapshot = await new Promise(function (resolve, reject) {
        const request = db.transaction('sessions', 'readonly').objectStore('sessions').get(sessionId);
        request.onsuccess = function () { resolve(request.result || null); };
        request.onerror = function () { reject(request.error); };
      });
      db.close();
      return !!snapshot && snapshot.brief === '第一个标签页的需求';
    }, secondSession, { timeout: 10000 });
    await staleTab.locator('#brief').fill('旧标签页的需求');
    await staleTab.waitForFunction(function () { return document.querySelector('.persistence-note')?.innerText.includes('另一个标签页更新'); }, undefined, { timeout: 5000 });
    await staleTab.reload({ waitUntil: 'domcontentloaded' });
    await staleTab.waitForSelector('#brief');
    if (await staleTab.locator('#brief').inputValue() !== '第一个标签页的需求') throw new Error('旧标签页覆盖了较新的制作需求');
    await staleTab.close();
    await pageB.locator('.quick-import summary').click();
    try { await pageB.waitForSelector('#courseFile', { timeout: 15000 }); }
    catch (error) { throw new Error('新浏览器无法打开导入页：' + (await pageB.locator('body').innerText()).slice(0, 500)); }
    await pageB.locator('#courseFile').setInputFiles({ name: 'shared.chunklab-course.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(sharedDraft)) });
    try { await pageB.waitForSelector('.course-summary', { timeout: 15000 }); }
    catch (error) { throw new Error('句子课程分享文件未进入预览：' + (await pageB.locator('body').innerText()).slice(0, 900)); }
    const importedTitle = await pageB.locator('h1').innerText();
    if (importedTitle !== COURSE.title) throw new Error('分享课程未能在新浏览器账号中导入预览');
    await pageB.locator('[data-action=save]').click();
    await pageB.waitForFunction(function () { return document.body.innerText.includes('课程已保存到当前账号'); }, { timeout: 15000 });
    const importedId = await pageB.evaluate(function () { return CL.loadMem().decks[0] && CL.loadMem().decks[0].id; });
    if (!importedId || importedId === saved.decks[0].id) throw new Error('新账号导入必须分配全新课程 ID');
    if (await pageB.evaluate(function () { return Object.keys(CL.readProgress()).some(function (key) { return key.indexOf('enrollment:v1:') === 0; }); })) throw new Error('新账号导入不应携带分享者的加入/学习状态');

    await pageB.goto(BASE + '/course-create.html', { waitUntil: 'domcontentloaded' });
    await pageB.locator('[name="courseType"][value="imageText"]').check();
    await pageB.locator('.quick-import summary').click();
    await pageB.waitForTimeout(350);
    const IMAGE_COURSE = {
      format: 'chunklab-ai-image-text', formatVersion: '1.0', title: '图文点单练习', description: '测试图文课程导入。', targetCefr: 'A2',
      learning: { template: 'image-text-practice', version: 1, modes: ['typing', 'chunkSelection'], defaultMode: 'chunkSelection' },
      images: [{ key: 'cafe', fileName: 'cafe-counter.png', alt: '咖啡店柜台' }],
      items: [
        { imageKey: 'cafe', en: 'I would like a tea.', zh: '我想要一杯茶。', chunks: ['I would like', 'a tea.'] },
        { imageKey: 'cafe', en: 'Can I get the bill?', zh: '可以给我账单吗？', chunks: ['Can I get', 'the bill?'] }
      ]
    };
    await pageB.locator('#rawResult').fill(JSON.stringify(IMAGE_COURSE));
    await pageB.locator('[data-action=validate-result]').click();
    await pageB.waitForSelector('.issue-panel.has-error');
    if (!(await pageB.locator('.issue-panel').innerText()).includes('cafe-counter.png')) throw new Error('图文课程缺少图片时没有给出文件名校验提示');
    await pageB.locator('#imageFiles').setInputFiles({
      name: 'cafe-image.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGOs2PKBgYGBiQEMABkCAiDaYDR0AAAAAElFTkSuQmCC', 'base64')
    });
    await pageB.locator('[data-image-binding="cafe"]').selectOption('cafe-image.png');
    try { await pageB.waitForSelector('.course-summary', { timeout: 15000 }); }
    catch (error) { throw new Error('图文图片上传后未进入预览：' + (await pageB.locator('body').innerText()).slice(0, 900)); }
    if (!(await pageB.locator('.course-summary').innerText()).includes('图文课程')) throw new Error('图文课程没有进入检查预览');
    if (await pageB.locator('.image-course-preview').count() !== 2 || await pageB.locator('.image-course-preview').first().evaluate(function (image) { return image.naturalWidth; }) !== 2) throw new Error('图文预览未从独立本机素材库载入共用图片');
    await pageB.reload({ waitUntil: 'domcontentloaded' });
    await pageB.waitForSelector('.course-summary', { timeout: 15000 });
    if (await pageB.locator('.image-course-preview').count() !== 2 || await pageB.locator('.image-course-preview').last().evaluate(function (image) { return image.naturalWidth; }) !== 2) throw new Error('刷新页面后本机课程图片没有恢复');
    await pageB.locator('[data-action=save]').click();
    await pageB.waitForFunction(function () { return CL.readCourses().some(function (course) { return course.authorNotes?.chunklabImageText; }); }, undefined, { timeout: 15000 });
    const imageCourseId = await pageB.evaluate(function () { return CL.readCourses().find(function (course) { return course.authorNotes?.chunklabImageText; }).courseId; });
    const imageExport=await captureDownload(pageB);
    const imageBundle=JSON.parse(imageExport.text);
    if (!imageExport.fileName.endsWith('.chunklab-image-course.json')) throw new Error('图文课程分享文件名不正确');
    if (imageBundle.format !== 'chunklab-ai-image-bundle' || !imageBundle.images[0].sha256 || imageBundle.draft.items[0].en !== IMAGE_COURSE.items[0].en || imageBundle.draft.items.length !== 2) throw new Error('图文课程分享包缺少图片或完整性校验');
    const shareContext = await browser.newContext();
    const sharePage = await shareContext.newPage();
    sharePage.on('pageerror', function (error) { secondErrors.push(error.message); });
    await sharePage.route('**/api/**', function (route) { route.abort('failed'); });
    await sharePage.goto(BASE + '/course-create.html', { waitUntil: 'domcontentloaded' });
    await sharePage.locator('.quick-import summary').click();
    await sharePage.locator('#courseFile').setInputFiles({ name: 'share.chunklab-image-course.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imageBundle)) });
    try { await sharePage.waitForSelector('.course-summary', { timeout: 15000 }); }
    catch (error) { throw new Error('图文课程包回导后未进入预览：' + (await sharePage.locator('body').innerText()).slice(0, 900)); }
    if (!(await sharePage.locator('h1').innerText()).includes('图文点单练习') || await sharePage.locator('.image-course-preview').first().evaluate(function (image) { return image.naturalWidth; }) !== 2) throw new Error('新浏览器上下文没有从分享包恢复图文课程和图片');
    await sharePage.locator('[data-action=save]').click();
    await sharePage.waitForFunction(function () { return CL.readCourses().length === 1; }, undefined, { timeout: 15000 });
    await sharePage.locator('[data-action=join]').click();
    await sharePage.waitForURL(/\/courses\.html\?id=ai-/, { timeout: 15000 });
    await sharePage.waitForSelector('.mode-guide');
    if (await sharePage.locator('#playerImage img').count()) throw new Error('答题模式引导页不应提前显示课程内容图片');
    if (await sharePage.locator('[data-action="select-v2-mode"].selected').getAttribute('data-mode') !== 'chunkSelection') throw new Error('图文课程未应用作者声明的默认练习方式');
    await sharePage.locator('[data-action="start-v2-learning"]').click();
    if (await sharePage.locator('[data-action="select-v2-mode"]').count()) throw new Error('答题方式不应嵌在课程内容中');
    await sharePage.waitForSelector('#playerImage img', { timeout: 15000 });
    if (!(await sharePage.locator('#playerImage img').getAttribute('alt'))) throw new Error('保存后的图文课程没有通过现有图文播放器显示图片');
    if (await sharePage.evaluate(function () { return CL.readCourses().length === 1; }) !== true) throw new Error('图文课程没有进入新的浏览器课程库');
    const savedImageCourseUrl = sharePage.url();
    await sharePage.reload({ waitUntil: 'domcontentloaded' });
    await sharePage.waitForSelector('.mode-guide', { timeout: 15000 });
    if (sharePage.url() !== savedImageCourseUrl || await sharePage.locator('#playerImage img').count()) throw new Error('重新载入后应先回到独立答题模式引导页，而非课程内容');
    if (await sharePage.locator('[data-action="select-v2-mode"].selected').getAttribute('data-mode') !== 'chunkSelection') throw new Error('重新载入课程后没有恢复作者声明的默认练习方式');
    await sharePage.locator('[data-action="start-v2-learning"]').click();
    await sharePage.waitForSelector('#playerImage img', { timeout: 15000 });
    if (await sharePage.locator('#playerImage img').evaluate(function (image) { return image.naturalWidth; }) !== 2) throw new Error('开始学习后课程图片没有从课程数据恢复');
    await shareContext.close();

    const dropPage = await second.newPage();
    await dropPage.route('**/api/**', function (route) { route.abort('failed'); });
    await dropPage.goto(BASE + '/course-create.html', { waitUntil: 'domcontentloaded' });
    await dropPage.locator('[data-action=copy-prompt]').click();
    if (await dropPage.locator('[data-action=manual-copied]').count()) await dropPage.locator('[data-action=manual-copied]').click();
    await dropPage.waitForSelector('[data-file-dropzone]');
    await dropPage.locator('[data-file-dropzone]').evaluate(function (zone, contents) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([contents], 'dragged-course.json', { type: 'application/json' }));
      zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
      zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    }, JSON.stringify(COURSE));
    await dropPage.waitForSelector('.course-summary', { timeout: 15000 });
    if (await dropPage.locator('h1').innerText() !== COURSE.title) throw new Error('拖入的课程文件没有进入现有校验预览流程');
    await dropPage.close();

    const manualContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
    await manualContext.addInitScript(function () {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: function () { return Promise.reject(new Error('permission denied')); } } });
    });
    const manualPage = await manualContext.newPage();
    await manualPage.route('**/api/**', function (route) { route.abort('failed'); });
    await manualPage.goto(BASE + '/course-create.html', { waitUntil: 'domcontentloaded' });
    if (await manualPage.evaluate(function () { return document.documentElement.scrollWidth > document.documentElement.clientWidth; })) throw new Error('375px 页面出现横向溢出');
    await manualPage.locator('[data-action=copy-prompt]').click();
    await manualPage.waitForSelector('[data-action=manual-copied]');
    if (!(await manualPage.locator('[data-prompt-text]').inputValue()).includes('JSON Schema')) throw new Error('剪贴板失败时没有提供可手动复制的完整指令');
    await manualPage.locator('[data-action=manual-copied]').click();
    await manualPage.waitForSelector('#rawResult');
    const priorOwner = await manualPage.evaluate(function () { return AccountStorage.owner; });
    await manualPage.locator('[data-action=back-setup]').click();
    await manualPage.locator('#brief').fill('这是旧账号的私有需求');
    await manualPage.waitForTimeout(450);
    await manualPage.evaluate(function () { localStorage.setItem('chunklab_api_base', location.origin + '/other-account-scope'); });
    await manualPage.locator('#brief').fill('这段内容不得写入旧账号');
    await manualPage.waitForFunction(function (owner) { return AccountStorage.owner !== owner; }, priorOwner, { timeout: 10000 });
    await manualPage.waitForFunction(function () { const field = document.querySelector('#brief'); return field && field.value === ''; }, undefined, { timeout: 10000 });
    await manualContext.close();
    const volatileContext = await browser.newContext();
    await volatileContext.addInitScript(function () {
      const factory = indexedDB, open = factory.open.bind(factory);
      factory.open = function (name, version) {
        if (String(name).endsWith('-authoring-v1')) {
          const request = { result: null, error: new Error('simulated IndexedDB failure'), onerror: null };
          setTimeout(function () { if (request.onerror) request.onerror(new Event('error')); }, 0);
          return request;
        }
        return open(name, version);
      };
    });
    const volatilePage = await volatileContext.newPage();
    await volatilePage.route('**/api/**', function (route) { route.abort('failed'); });
    await volatilePage.goto(BASE + '/course-create.html', { waitUntil: 'domcontentloaded' });
    await volatilePage.waitForSelector('[data-action=copy-prompt]', { timeout: 15000 });
    if (!(await volatilePage.locator('.persistence-note').innerText()).includes('关闭页面后会丢失')) throw new Error('本机草稿存储失败时没有明确提示当前页面的临时状态');
    await volatileContext.close();
    if (pageErrors.length || secondErrors.length) throw new Error('浏览器脚本错误：' + pageErrors.concat(secondErrors).join('; '));
    console.log('[ai-course-authoring] 两种课程形式、站点主题、图文素材校验/编译/本地素材事务/保存/分享回导/播放器、句子课程、账号隔离及错误恢复通过');
    await second.close();
    await context.close();
  } catch (error) {
    console.error('[ai-course-authoring] failed:', error.stack || error.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    stopServer();
  }
})();
