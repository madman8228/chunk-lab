'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(10620, 100);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-import-metadata-'));
let server;

function startServer() {
  return new Promise(function (resolve, reject) {
    server = spawn(process.execPath, ['index.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, { CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test' }),
      stdio: 'ignore'
    });
    let tries = 0;
    const timer = setInterval(function () {
      if (server.exitCode !== null) { clearInterval(timer); reject(new Error('server exit ' + server.exitCode)); return; }
      const req = http.get(BASE + '/api/health', function (res) { res.resume(); if (res.statusCode === 200) { clearInterval(timer); resolve(); } });
      req.on('error', function () {}); req.setTimeout(500, function () { req.destroy(); });
      if (++tries > 100) { clearInterval(timer); reject(new Error('server start timeout')); }
    }, 100);
  });
}

function stopServer() {
  if (server) try { server.kill('SIGKILL'); } catch (error) {}
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (error) {}
}

(async function () {
  let browser;
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const page = await browser.newPage();
    await page.goto(BASE + '/decks.html?courseView=discover', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(function () { return typeof document.querySelector('#btnImportDecks').onclick === 'function'; });
    await page.locator('#courseViewJoined').click();
    await page.locator('#btnImportDecks').click();
    await page.locator('#courseImportTypeMask:not([hidden])').waitFor({ state:'visible' });
    await page.locator('#btnChooseSentenceImport').click();
    await page.locator('#impMask:not([hidden])').waitFor({ state: 'visible' });
    const generatedPrompt = await page.locator('#promptBox').inputValue();
    if (!generatedPrompt.includes('"grammar"')) throw new Error('课程生成提示词未要求按意群提供句子成分标注');
    await page.locator('#deckName').fill('完整导入提示课程');
    await page.locator('#jsonBox').fill(JSON.stringify([{
      sentence: 'It is cold today.', translation: '今天天气很冷。',
      chunks: ['It is', 'cold today.'], hints: ['今天的天气', '很冷'],
      grammar: [{ role: '主语' }, { role: '谓语' }]
    }]));
    await page.locator('#btnValidate').click();
    await page.waitForFunction(function () { return serverCatalogView && serverCatalogView.decks.some(function (deck) { return deck.name === '完整导入提示课程'; }); });
    const completeDeckId = await page.evaluate(function () { return serverCatalogView.decks.find(function (deck) { return deck.name === '完整导入提示课程'; }).id; });
    await page.evaluate(async function (id) {
      const deck = JSON.parse(JSON.stringify(serverCatalogView.decks.find(function (entry) { return entry.id === id; })));
      deck.authoring = { template:'sentence-practice', templateVersion:1, contentForm:'sentences', learning:{ template:'sentence-practice', version:1, modes:['typing','chunkSelection'], defaultMode:'chunkSelection' } };
      const cache = await ServerCache.read();
      await ServerStore.submitCommitted('deck.put', { deck }, { requestId: 'metadata-authoring-update-001', expectedRev: cache.snapshot.revs.decks[id] });
    }, completeDeckId);
    await page.goto(BASE + '/main.html?course=' + encodeURIComponent('user-deck:' + completeDeckId) + '&lesson=' + encodeURIComponent('lesson:user-deck:' + completeDeckId), { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#stage:not(.hidden)');
    await page.waitForFunction(function () { return document.querySelector('#zh')?.textContent.trim() === '今天天气很冷。'; }, null, { timeout: 15000 });
    const displayed = await page.evaluate(function () {
      return {
        translation: document.querySelector('#zh').textContent,
        roles: Array.from(document.querySelectorAll('#track .chunk-role')).map(function (node) { return node.textContent.trim(); }),
        hints: Array.from(document.querySelectorAll('#track .chunk-hint')).map(function (node) { return node.textContent.trim(); })
      };
    });
    if (displayed.translation !== '今天天气很冷。' || displayed.roles.join('|') !== '主语|谓语' || displayed.hints.join('|') !== '今天的天气|很冷') {
      throw new Error('完整导入数据未显示中文提示和句子成分：' + JSON.stringify(displayed));
    }
    const roleBadge = await page.locator('#track .chunk-role').first().evaluate(function (node) {
      const style = getComputedStyle(node);
      return { background:style.backgroundColor, radius:style.borderRadius, padding:style.padding };
    });
    if (roleBadge.background === 'rgba(0, 0, 0, 0)' || roleBadge.radius === '0px' || roleBadge.padding === '0px') {
      throw new Error('AI 课程无自定义颜色时，句子成分未呈现内置课程徽标样式：' + JSON.stringify(roleBadge));
    }
    const courseMode = page.locator('#courseMode');
    const courseModePicker = page.locator('#courseModePicker');
    if (!(await courseModePicker.isVisible()) || await courseMode.inputValue() !== 'chunkSelection' ||
        await page.locator('#courseModeLabel').innerText() !== '意群选择') {
      throw new Error('课程练习方式入口没有显示课程默认练习方式: ' + JSON.stringify(await page.evaluate(() => ({
        value: document.getElementById('courseMode').value, label: document.getElementById('courseModeLabel').textContent,
        learning: S.courseLearning, authoring: S.deck && S.deck.authoring
      }))));
    }
    for (const viewport of [{ width:818, height:932 }, { width:375, height:812 }]) {
      await page.setViewportSize(viewport);
      const selectorStyle = await courseMode.evaluate(function (node) {
        const row = node.closest('.pc-row');
        const picker = document.querySelector('#courseModePicker');
        const trigger = document.querySelector('#courseModeTrigger');
        return { hidden:picker.hidden, height:trigger.getBoundingClientRect().height, rowWidth:row.clientWidth, rowScrollWidth:row.scrollWidth };
      });
      if (selectorStyle.hidden || selectorStyle.height !== 28 || selectorStyle.rowScrollWidth > selectorStyle.rowWidth) {
        throw new Error('课程练习方式控件样式或顶栏自适应异常：' + JSON.stringify({ viewport, selectorStyle }));
      }
    }
    await page.setViewportSize({ width:1280, height:900 });
    const chunks = await page.evaluate(function () { return S.items[0].chunks.slice(); });
    for (const chunk of chunks) {
      await page.evaluate(function (answer) {
        const option = Array.from(document.querySelectorAll('#stageChoices .choice')).find(function (button) { return button.dataset.v === answer; });
        if (!option) throw new Error('未找到正确意群选项：' + answer);
        option.click();
      }, chunk);
    }
    await page.waitForFunction(function () { return S.finished === true; }, null, { timeout:7000 });
    const explanation = await page.locator('.explain-panel.current').count()
      ? await page.locator('.explain-panel.current').innerText() : '';
    if (explanation.includes('句子拆解') || await page.locator('.explain-panel.current .explain-chunk-list').count()) {
      throw new Error('答题后的讲解卡片不应重复显示句子拆解：' + explanation);
    }
    if ((await page.locator('#track .chunk-role').count()) !== 2 || (await page.locator('#track .chunk-hint').count()) !== 2) {
      throw new Error('隐藏讲解卡片中的句子拆解后，练习区的句子成分和提示仍应保留');
    }
    await page.goto(BASE + '/decks.html?courseView=joined&courseType=decks', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#tabDecks');
    /* serverCatalogView 由 CL.ensureCloud().then(loadServerCatalogView) 异步填充；而 #tabDecks 是静态元素，
       冷启动尚未水合时立刻读它会得到 null（更慢的 CI 上稳定命中 null.decks）。等课程目录真正就绪再读取。 */
    await page.waitForFunction(function () {
      return typeof serverCatalogView !== 'undefined' && !!serverCatalogView && Array.isArray(serverCatalogView.decks);
    }, null, { timeout: 20000 });
    await page.evaluate(async function (id) {
      const deck = JSON.parse(JSON.stringify(serverCatalogView.decks.find(function (entry) { return entry.id === id; })));
      deck.items = Array.from({ length: 20 }, function (_, index) {
        return { sentence: 'Management scroll fixture sentence ' + (index + 1) + '.', translation: '管理页滚动测试句子 ' + (index + 1), chunks: ['Management scroll', 'fixture sentence ' + (index + 1) + '.'], hints: ['管理页滚动测试', '句子'], grammar: [{ role: '修饰语' }, { role: '中心语' }] };
      });
      const cache = await ServerCache.read();
      await ServerStore.submitCommitted('deck.put', { deck }, { requestId: 'metadata-scroll-update-001', expectedRev: cache.snapshot.revs.decks[id] });
    }, completeDeckId);
    const managementCard = page.locator('#deckList .deck-item').filter({ hasText:'完整导入提示课程' });
    await managementCard.waitFor({ state:'visible' });
    await managementCard.locator('.course-manage-trigger').click();
    await managementCard.getByRole('menuitem', { name:'管理课程' }).click();
    await page.locator('#pageEdit:not(.hidden)').waitFor({ state:'visible' });
    await page.locator('#editList .edit-row').nth(19).waitFor();
    const editListMetrics = await page.locator('#editList').evaluate(function (node) {
      const rect = node.getBoundingClientRect();
      const page = document.getElementById('pageEdit');
      return { overflowY: getComputedStyle(node).overflowY, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight,
        listHidden:node.hidden, listRect:{width:rect.width,height:rect.height}, pageClass:page.className,
        pageRect:{width:page.getBoundingClientRect().width,height:page.getBoundingClientRect().height}, rows:node.querySelectorAll('.edit-row').length };
    });
    if (!['auto', 'scroll'].includes(editListMetrics.overflowY) || editListMetrics.scrollHeight <= editListMetrics.clientHeight) {
      throw new Error('AI 创作课程管理页的 20 条句子不可滚动浏览：' + JSON.stringify(editListMetrics));
    }
    for (const viewport of [{ width: 818, height: 932 }, { width: 375, height: 812 }]) {
      await page.setViewportSize(viewport);
      await page.locator('#editList').evaluate(function (node) { node.scrollTop = node.scrollHeight; });
      const finalRowVisible = await page.evaluate(function () {
        const list = document.getElementById('editList').getBoundingClientRect();
        const last = document.querySelector('#editList .edit-row:last-child').getBoundingClientRect();
        return last.top >= list.top && last.bottom <= list.bottom;
      });
      if (!finalRowVisible) throw new Error('管理页在 ' + viewport.width + 'px 宽度下滚动后仍看不到最后一句');
    }

    await page.goto(BASE + '/decks.html?courseView=discover', { waitUntil: 'domcontentloaded' });
    await page.locator('#courseViewJoined').click();
    await page.locator('#btnImportDecks').click();
    await page.locator('#courseImportTypeMask:not([hidden])').waitFor({ state:'visible' });
    await page.locator('#btnChooseSentenceImport').click();
    await page.locator('#deckName').fill('缺少学习提示的导入课程');
    await page.locator('#jsonBox').fill(JSON.stringify([{ sentence: 'It is cold today.', chunks: ['It is', 'cold today.'] }]));
    await page.locator('#btnValidate').click();
    await page.waitForFunction(function () {
      return CL.loadMem().decks.some(function (deck) { return deck.name === '缺少学习提示的导入课程'; }) ||
        (!document.querySelector('#impMask').hidden && document.querySelector('#impMsg').classList.contains('show'));
    });
    const result = await page.evaluate(function () {
      return {
        message: document.querySelector('#impMsg').innerText,
        saved: CL.loadMem().decks.some(function (deck) { return deck.name === '缺少学习提示的导入课程'; })
      };
    });
    if (!/中文翻译|中文提示|句子成分/.test(result.message) || result.saved) {
      throw new Error('缺少中文提示/句子成分的课程仍被导入：' + JSON.stringify(result));
    }

    const legacyId = 'legacy-metadata-repair';
    await page.evaluate(async function (id) {
      const deck = { id, name: '旧版待补全课程', items: [{
        cid: 'preserve-this-cid', sentence: 'It is cold today.', chunks: ['It is', 'cold today.']
      }] };
      await ServerStore.submitCommitted('deck.put', { deck }, { requestId: 'metadata-original-seed-001', expectedRev: null });
    }, legacyId);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(id => serverCatalogView && serverCatalogView.decks.some(deck => deck.id === id), legacyId);
    await page.evaluate(function (id) {
      _appendDeck = serverCatalogView.decks.find(function (deck) { return deck.id === id; });
      openAppend(_appendDeck);
    }, legacyId);
    await page.locator('#appendModeMine').click();
    await page.locator('#appendMineBoxIn').fill('It is cold today.');
    await page.locator('#btnGenSplitPrompt').click();
    if (await page.locator('#appendDrop input[type="file"]').count()) throw new Error('粘贴 JSON 区不应再提供点击打开文件选择器');
    await page.locator('#appendJsonBox').click();
    if (await page.evaluate(function () { return document.activeElement.id; }) !== 'appendJsonBox') throw new Error('点击 JSON 输入区未聚焦到文本框');
    const repairPrompt = await page.locator('#appendPromptBox').inputValue();
    if (!repairPrompt.includes('grammar') || !repairPrompt.includes('中文提示')) throw new Error('旧句补全 Prompt 未要求中文提示和句子成分');
    await page.locator('#appendJsonBox').fill(JSON.stringify([{
      sentence: 'It is cold today.', translation: '今天天气很冷。',
      chunks: ['It is', 'cold today.'], hints: ['今天的天气', '很冷'],
      grammar: [{ role: '主语' }, { role: '谓语' }]
    }]));
    await page.locator('#btnAppendValidate').click();
    await page.waitForFunction(function () { return document.querySelector('#appendMsg').innerText.includes('补全旧句元数据 1 句'); });
    const successActions = await page.evaluate(function () {
      return ['appendGoPractice', 'appendContinue'].every(function (id) {
        const button = document.getElementById(id);
        return button && !button.hidden && button.parentElement.classList.contains('append-modal-foot') &&
          button.compareDocumentPosition(document.getElementById('btnAppendValidate')) & Node.DOCUMENT_POSITION_PRECEDING;
      });
    });
    if (!successActions) throw new Error('追加成功后的两个操作应显示在“校验并追加”右侧');
    const repaired = await page.evaluate(async function (id) {
      const cache = await ServerCache.read();
      const deck = cache.snapshot.mem.decks.find(deck => deck.id === id);
      return { count: deck.items.length, item: deck.items[0], appendItem: _appendDeck.items[0], message: document.querySelector('#appendMsg').innerText };
    }, legacyId);
    if (repaired.count !== 1 || repaired.item.cid !== 'preserve-this-cid' || repaired.item.translation !== '今天天气很冷。' || repaired.item.grammar.length !== 2) {
      throw new Error('旧课程补全未保留原句/标识或未补齐元数据：' + JSON.stringify(repaired));
    }
    console.log('[imported-course-learning-metadata] 不完整课程拦截，旧课程元数据补全且保留原句标识');
  } finally {
    if (browser) await browser.close();
    stopServer();
  }
})().catch(function (error) { console.error(error.stack || error); process.exitCode = 1; });
