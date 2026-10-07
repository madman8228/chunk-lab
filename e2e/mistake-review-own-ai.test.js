'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = require('./lib/free-port').freePort(10540, 80);
const BASE = `http://127.0.0.1:${PORT}`;
const TMP_DB = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-mistake-review-'));
const sourceDeck = {
  id: 'review-source-deck', name: '错题来源测试', builtin: false,
  items: [
    { cid: 'source-c1', sentence: 'Where is the station?', translation: '车站在哪里？', chunks: ['Where is', 'the station?'], hints: ['哪里', '车站'], grammar: [{ role: '疑问结构' }, { role: '地点' }] },
    { cid: 'source-c2', sentence: 'Could you show me the map?', translation: '你能给我看地图吗？', chunks: ['Could you', 'show me', 'the map?'], hints: ['可以吗', '给我看', '地图'], grammar: [] },
  ]
};
let server = null;
let browser = null;

function startServer() {
  return new Promise((resolve, reject) => {
    server = spawn(process.execPath, ['index.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, CHUNKLAB_DATA_DIR: TMP_DB, PORT: String(PORT), NODE_ENV: 'test' }, stdio: 'ignore' });
    let attempts = 0;
    const timer = setInterval(() => {
      if (server.exitCode !== null) { clearInterval(timer); reject(new Error(`server exit ${server.exitCode}`)); return; }
      const request = http.get(`${BASE}/api/health`, (response) => { response.resume(); if (response.statusCode === 200) { clearInterval(timer); resolve(); } });
      request.on('error', () => {}); request.setTimeout(700, () => request.destroy());
      if (++attempts > 150) { clearInterval(timer); reject(new Error('server start timeout')); }
    }, 150);
  });
}

function stopServer() {
  if (server) { try { server.kill('SIGKILL'); } catch (_) {} }
  try { fs.rmSync(TMP_DB, { recursive: true, force: true }); } catch (_) {}
}

(async () => {
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true, viewport: { width: 818, height: 932 } });
    await context.route('**/api/**', (route) => route.abort('failed'));
    await context.addInitScript((deck) => {
      if (localStorage.getItem('e2e.mistake-review.seeded') === '1') return;
      localStorage.clear();
      localStorage.setItem('chunklab.storage-owner.v1', JSON.stringify([location.origin, 'local']));
      localStorage.setItem('e2e.mistake-review.seeded', '1');
      localStorage.setItem('chunklab.v1', JSON.stringify({
        version: 2, decks: [deck], best: {}, mastered: {}, deletedItems: {}, settings: {},
        stats: { totalRounds: 0, totalAnswered: 5, bySentence: {
          'review-source-deck#source-c1': { deckId: 'review-source-deck', cid: 'source-c1', sentence: deck.items[0].sentence, times: 3, okTimes: 2, wrongTimes: 1, lastAt: Date.now() },
          'review-source-deck#source-c2': { deckId: 'review-source-deck', cid: 'source-c2', sentence: deck.items[1].sentence, times: 2, okTimes: 1, wrongTimes: 1, lastAt: Date.now() },
        }, events: [] },
        reinforceBook: deck.items.map((item, index) => ({
          _key: `review-source-deck::${item.sentence}`, deckId: 'review-source-deck', deckName: deck.name, cid: item.cid,
          addedAt: new Date(Date.now() - 60000).toISOString(), sentence: item.sentence, translation: item.translation, chunks: item.chunks, hints: item.hints, grammar: item.grammar,
          needsReview: true, evidenceVersion: 1, history: [{ eventId: `seed-${index}`, at: Date.now() - 60000, mode: index ? 'typing' : 'chunkSelection', hinted: false, revealed: false, needsReview: true,
            mistakes: [{ chunkIdx: 0, chunk: item.chunks[0], wrongAnswers: [index ? 'Can you' : 'When is'], wrongAttemptCount: 1, hintUsed: false }] }],
        })),
      }));
    }, sourceDeck);
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(`${BASE}/main.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.CL && CL.loadMem && Array.isArray(CL.loadMem().decks), undefined, { timeout: 15000 });
    const originalSource = await page.evaluate(() => JSON.stringify(CL.loadMem().decks.find(deck => deck.id === 'review-source-deck')));
    const capCheck = await page.evaluate(() => typeof trimReinforceBook);
    if (capCheck !== 'undefined') throw new Error('错题本仍存在静默 200 条裁剪函数');
    await page.evaluate(() => startDeck(CL.loadMem().decks.find((deck) => deck.id === 'review-source-deck')));
    await page.waitForFunction(() => window.S && S.deck && S.deck.id === 'review-source-deck' && !document.getElementById('stage').classList.contains('hidden'), undefined, { timeout: 15000 });

    const answers = await page.evaluate(() => {
      const right = S.items[S.idx].chunks[S.chunkIdx];
      const wrong = Array.from(document.querySelectorAll('#stageChoices .choice')).find((button) => button.dataset.v !== right);
      if (!wrong) throw new Error('test sentence has no distractor');
      wrong.click();
      return { wrong: wrong.dataset.v, right };
    });
    await page.waitForFunction(() => S.wrongAttempts[0] === 1);
    await page.waitForFunction((answer) => Array.from(document.querySelectorAll('#stageChoices .choice')).some((button) => button.dataset.v === answer), answers.right, { timeout: 5000 });
    await page.evaluate((answer) => Array.from(document.querySelectorAll('#stageChoices .choice')).find((button) => button.dataset.v === answer).click(), answers.right);
    await page.waitForFunction(() => S.chunkIdx > 0 || S.idx > 0 || S.finished);
    for (let guard = 0; guard < 10; guard += 1) {
      const state = await page.evaluate(() => ({ idx: S.idx, chunkIdx: S.chunkIdx, chunkCount: S.items[S.idx]?.chunks?.length, finished: S.finished }));
      if (state.idx > 0 || state.finished || state.chunkIdx >= state.chunkCount) break;
      const answer = await page.evaluate(() => S.items[S.idx].chunks[S.chunkIdx]);
      await page.evaluate((value) => Array.from(document.querySelectorAll('#stageChoices .choice')).find((button) => button.dataset.v === value).click(), answer);
      await page.waitForFunction((previous) => S.idx > previous.idx || S.finished || S.chunkIdx > previous.chunkIdx, state, { timeout: 5000 });
    }
    await page.waitForTimeout(1000);
    const practiceState = await page.evaluate(() => ({ idx:S.idx, chunkIdx:S.chunkIdx, finished:S.finished, wrong:S.wrong.map((entry)=>({eventId:entry.eventId,idx:entry.idx})), status:S.status, attempts:S.wrongAttempts, answers:S.wrongAnswers, error:document.getElementById('zh')?.textContent }));
    if (!(practiceState.idx >= 1 || practiceState.finished || practiceState.wrong.length)) throw new Error(`句子没有结算：${JSON.stringify(practiceState)}`);
    await page.waitForTimeout(1000);
    const savedEvidence = await page.evaluate(() => CL.loadMem().reinforceBook.map((row) => ({ key: row._key, events: row.history?.map((event) => ({ id: event.eventId, mistakes: event.mistakes })) })));
    if (!savedEvidence.some((row) => row.events?.some((event) => !event.id.startsWith('seed-') && event.mistakes.some((mistake) => mistake.wrongAnswers.includes(answers.wrong))))) throw new Error(`新作答证据未写入错题本：${JSON.stringify({ answers, savedEvidence, practiceState })}`);

    const persistence = await page.evaluate(async () => {
      const legacyKey = REINFORCE_KEY, originalSave = saveStore;
      businessStorage.setItem(legacyKey, JSON.stringify([{ _key: 'legacy-retry-row', sentence: 'Legacy row?', history: [] }]));
      saveStore = () => Promise.resolve(false);
      migrateLegacyReinforce();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const failureRetainedKey = businessStorage.getItem(legacyKey) !== null;
      saveStore = originalSave;
      migrateLegacyReinforce();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const migrationRetry = { failureRetainedKey, legacyKeyRemoved: businessStorage.getItem(legacyKey) === null, legacyRowPresent: CL.loadMem().reinforceBook.some((row) => row._key === 'legacy-retry-row') };

      const deck = { id: 'beyond-200-test', name: 'Persistence test' };
      const items = Array.from({ length: 401 }, (_, index) => ({ cid: `p-${index}`, sentence: `Persisted question ${index}?`, translation: '测试', chunks: [`correct ${index}`] }));
      const wrongItems = items.map((item, index) => ({ it: item, idx: [0], wrongAnswers: [[`wrong ${index}`]], wrongAttempts: [1], needsReview: true, eventId: `persist-event-${index}`, at: index + 1 }));
      const saved = await saveReinforceList(deck, wrongItems);
      const keys = new Set(CL.loadMem().reinforceBook.map((row) => row._key));
      const beforeRepeat = new Map(CL.loadMem().reinforceBook.filter((row) => row._key.startsWith(`${deck.id}::`)).map((row) => [row._key, row.history.length]));
      await saveReinforceList(deck, wrongItems);
      const book = CL.loadMem().reinforceBook;
      const persistedRows = book.filter((row) => row._key.startsWith(`${deck.id}::`));
      return { migrationRetry, saved, count: persistedRows.length, duplicateStable: persistedRows.every((row) => row.history.length === beforeRepeat.get(row._key)), hasFirst: keys.has(`${deck.id}::Persisted question 0?`), hasLast: keys.has(`${deck.id}::Persisted question 400?`) };
    });
    if (!persistence.migrationRetry.failureRetainedKey || !persistence.migrationRetry.legacyKeyRemoved || !persistence.migrationRetry.legacyRowPresent || persistence.saved !== true || persistence.count !== 401 || !persistence.duplicateStable || !persistence.hasFirst || !persistence.hasLast) throw new Error(`超过 200 条保存/迁移失败重试异常：${JSON.stringify(persistence)}`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => CL.loadMem().reinforceBook.filter((row) => row._key.startsWith('beyond-200-test::')).length === 401, undefined, { timeout: 15000 });

    await page.evaluate(async () => {
      const data = CL.loadMem();
      data.reinforceBook = Array.from({ length: 450 }, (_, index) => ({
        _key: `batch-row-${index}`, deckId: 'batch-source', sentence: `Unique sentence number ${index}?`, translation: `测试翻译 ${index}`,
        chunks: [`saved phrase ${index}`, 'continue'], needsReview: true,
        history: [{ eventId: `batch-event-${index}`, at: Date.now() - index * 1000, mode: 'typing', hinted: null, revealed: false, needsReview: true,
          mistakes: [{ chunkIdx: 0, chunk: `correct ${index}`, wrongAnswers: [`wrong ${index}`], wrongAttemptCount: index % 4 === 0 ? null : 1 }] }],
      }));
      if (await CL.saveAndNotify(data, 'local') !== true) throw new Error('450 条错题种入持久化失败');
    });
    await page.goto(`${BASE}/stats.html?regression=mistake-review`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-tab="wrong"]').click();
    await page.waitForSelector('.wrong-row');
    await page.locator('[data-list-key="wrong"][data-list-page="1"]').click();
    if (await page.locator('[data-wrong-ai-one], .wrong-select, [data-wrong-ai-task]').count()) throw new Error('错题列表仍显示逐题 AI/勾选入口');
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.__copiedText = text; } } }));
    await page.locator('[data-mistake-export-open]').click();
    await page.waitForFunction(() => document.querySelector('.export-message')?.textContent.includes('已复制第 1 / 3 批'));
    const firstPrompt = await page.evaluate(() => window.__copiedText);
    const firstJson = JSON.parse(firstPrompt.split('<evidence-json>\n')[1].split('\n</evidence-json>')[0]);
    if (firstJson.records.length !== 200 || firstJson.records[0].ref !== 'R000001' || firstJson.records[199].ref !== 'R000200') throw new Error('第一包边界错误');
    const redundantFields = firstPrompt.match(/"(?:at|mode|hinted|revealed|needsReview|hints|limitations)"\s*:/g) || [];
    if (firstJson.format || firstJson.generatedAt || firstJson.records[0].history || firstJson.records[0].chunks || redundantFields.length) throw new Error(`紧凑错题材料仍包含非分析必需的字段：${JSON.stringify({ redundantFields, envelope: Object.keys(firstJson), record: Object.keys(firstJson.records[0]) })}`);
    if (firstPrompt.includes('batch-row-') || firstPrompt.includes('batch-source')) throw new Error('导出指令暴露内部键/课程 ID');
    if (!firstPrompt.includes('Unique sentence number') || await page.locator('[data-export-generate], [data-export-preview], [data-export-download], [data-export-jump], [data-export-merge]').count()) throw new Error('点击一次应自动复制第一批，且不再显示多余操作');
    await page.setViewportSize({ width: 390, height: 844 });
    const mobilePanel = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, rect: document.querySelector('.mistake-export-panel').getBoundingClientRect().toJSON() }));
    if (mobilePanel.document > mobilePanel.viewport || mobilePanel.rect.left < 0 || mobilePanel.rect.right > mobilePanel.viewport) throw new Error(`手机错题导出面板溢出：${JSON.stringify(mobilePanel)}`);
    await page.setViewportSize({ width: 818, height: 932 });
    await page.locator('[data-export-next]').click();
    await page.waitForFunction(() => document.querySelector('.export-message')?.textContent.includes('已复制第 2 / 3 批'));
    const secondPrompt = await page.evaluate(() => window.__copiedText);
    const secondData = JSON.parse(secondPrompt.split('<evidence-json>\n')[1].split('\n</evidence-json>')[0]);
    const secondRefs = secondData.records.map((record) => record.ref);
    if (secondRefs.length !== 200 || secondRefs[0] !== 'R000201' || secondRefs[199] !== 'R000400' || secondData.records[0].errors[0].wrongAnswers[0].text !== 'wrong 249') throw new Error('第二批复制内容或错答不完整');
    await page.locator('[data-export-next]').click();
    await page.waitForFunction(() => document.querySelector('.export-message')?.textContent.includes('已复制全部 450 道错题'));
    const lastPrompt = await page.evaluate(() => window.__copiedText);
    const lastData = JSON.parse(lastPrompt.split('<evidence-json>\n')[1].split('\n</evidence-json>')[0]);
    if (lastData.records.length !== 50 || lastData.records[0].ref !== 'R000401' || lastData.records[49].ref !== 'R000450') throw new Error('末包余数/边界错误');
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } }));
    await page.locator('[data-mistake-export-open]').click();
    await page.waitForFunction(() => document.querySelector('.export-message')?.textContent.includes('复制失败'));
    if (!(await page.locator('[data-export-text]').inputValue()).includes('R000001')) throw new Error('剪贴板拒绝时没有提供当前批次的手动复制回退');
    const accountGuard = await page.evaluate(() => {
      const original = AccountStorage.owner;
      AccountStorage.owner = `${original}-different-scope`;
      renderStats();
      const cleared = !document.querySelector('[data-export-next]') && !document.querySelector('[data-export-text]');
      AccountStorage.owner = original;
      return cleared;
    });
    if (!accountGuard) throw new Error('账号作用域变化后没有清除旧快照和预览文本');
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.__copiedText = text; } } }));
    await page.evaluate(() => { mem.reinforceBook = mem.reinforceBook.slice(0, 30); renderStats(); });
    await page.locator('[data-mistake-export-open]').click();
    await page.waitForTimeout(1000);
    const shortState = await page.evaluate(() => ({ status: document.querySelector('.export-message')?.textContent, count: mem.reinforceBook.length, total: _mistakeExport.snapshot?.totalQuestions, copied: _mistakeExport.lastCopiedIndex, errors: document.querySelector('.mistake-export-panel')?.innerText }));
    if (!shortState.status?.includes('已复制全部 30 道错题')) throw new Error(`少于 200 道自动复制状态错误：${JSON.stringify(shortState)}`);
    const shortPrompt = await page.evaluate(() => window.__copiedText);
    const shortData = JSON.parse(shortPrompt.split('<evidence-json>\n')[1].split('\n</evidence-json>')[0]);
    if (shortData.records.length !== 30 || await page.locator('[data-export-next]').count()) throw new Error('少于 200 道时应一次复制全部，不应出现分批按钮');
    if (pageErrors.length) throw new Error(`浏览器脚本错误：${pageErrors.join('; ')}`);
    const finalSource = await page.evaluate(() => JSON.stringify(CL.loadMem().decks.find(deck => deck.id === 'review-source-deck')));
    if (finalSource !== originalSource) throw new Error('错题练习或导出改写了原课程');
    console.log('[mistake-review-own-ai] 错题保存、30/450 条自动复制、分批边界、账号隔离与移动端布局通过');
    await context.close();
  } catch (error) {
    console.error('[mistake-review-own-ai] failed:', error.stack || error.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    stopServer();
  }
})();
