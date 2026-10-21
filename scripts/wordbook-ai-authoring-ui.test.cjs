'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
(async () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'wordbook-ai-ui-'));
  const server = http.createServer((req, res) => {
    const target = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', /\.m?js$/.test(target) ? 'text/javascript' : /\.css$/.test(target) ? 'text/css' : 'text/html');
    res.end(fs.readFileSync(target));
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 799, height: 932 } }), page = await context.newPage(), errors = [];
    let writes=0;context.on('request',request=>{if(request.method()!=='GET')writes++;});
    page.on('pageerror', error => errors.push(error.message));
    await context.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw Error('denied fixture'); } } }); });
    const open = async (target = '/wordbook-create.html') => { await page.goto(base + target); await page.locator('#copyBookPrompt').waitFor({ state: 'attached' }); await page.waitForFunction(() => document.querySelector('#bookAIWorkbench').getAttribute('aria-busy') === 'false'); };
    await open();
    assert.equal(await page.locator('#bookAIPersistence').isVisible(), false, 'normal autosave does not show a persistent success notice');
    assert.equal(await page.locator('.wordbook-admin,#draftTitle,#bookAILevel,#bookAIBatchSize').count(),0,'retired manual setup is not recreated by the test');
    for (const width of [799, 390]) {
      await page.setViewportSize({ width, height: 932 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.locator('#copyBookPrompt').isVisible(),true,'current external-AI entry stays available');
      assert.equal(await page.locator('#bookAIResult').isVisible(),true,'current result input stays available');
      await page.screenshot({ path: path.join(output, 'start-' + width + '.png'), fullPage: true });
    }
    await page.setViewportSize({ width: 799, height: 932 });
    await page.locator('#copyBookPrompt').click();
    await page.locator('#bookAIPromptFallback').waitFor({ state: 'visible' });
    const makeBatch = async (word = 'book') => {
      await page.waitForFunction(() => document.querySelector('#bookAIWorkbench').getAttribute('aria-busy') === 'false');
      const prompt = await page.locator('#bookAIPromptText').inputValue();
      return { format: 'wordbook-ai-batch', version: 1, requestId: /"requestId": "([^"]+)"/.exec(prompt)[1], baseFingerprint: /"baseFingerprint": "([^"]+)"/.exec(prompt)[1], title: '零基础单词本', unitTitle: word === 'book' ? '身边物品' : '书写工具', items: [{ word, meaning: word === 'book' ? '书' : '笔', scene: '介绍物品。', translation: word === 'book' ? '这是一本书。' : '这是一支笔。', sentence: 'This is a [' + word + '].' }] };
    };
    const first = await makeBatch();
    await page.locator('#bookAIResult').fill(JSON.stringify(first)); await page.locator('#checkBookAIResult').click();
    await page.locator('#bookAIReview').waitFor({ state: 'visible' });
    const beforeConfirm = await page.evaluate(() => WordbookWorkbench.snapshot().items.length); assert.equal(beforeConfirm, 0);
    await page.locator('#acceptBookAIBatch').click();
    await page.waitForFunction(() => WordbookWorkbench.snapshot().items.length === 1);
    const before = await page.evaluate(() => WordbookWorkbench.snapshot().items[0]);
    await open(new URL(page.url()).pathname + new URL(page.url()).search);
    assert.equal(await page.evaluate(() => WordbookWorkbench.snapshot().items.length), 1, 'reload restores account-scoped draft');
    const staleTab = await context.newPage(); await staleTab.goto(page.url());
    await staleTab.waitForFunction(() => document.querySelector('#bookAIWorkbench').getAttribute('aria-busy') === 'false');
    await page.locator('#copyBookContinue').click(); const duplicate = await makeBatch();
    await staleTab.locator('#copyBookContinue').click();
    await staleTab.waitForFunction(() => document.querySelector('#bookAIStatus').textContent.includes('另一个标签页'));
    assert.equal(await staleTab.evaluate(() => WordbookWorkbench.snapshot().items.length), 1, 'stale session cannot overwrite latest draft');
    await staleTab.close();
    await page.locator('#bookAIResult').fill(JSON.stringify(duplicate)); await page.locator('#checkBookAIResult').click();
    await page.locator('#copyBookRepair').waitFor({ state: 'visible' }); assert.match(await page.locator('#bookAIStatus').innerText(), /已存在/);
    await page.locator('#copyBookRepair').click();
    const second = await makeBatch('pen');
    await page.locator('#bookAIResult').fill(JSON.stringify(second)); await page.locator('#checkBookAIResult').click(); await page.locator('#bookAIReview').waitFor({ state: 'visible' });
    for (const width of [799, 390]) {
      await page.setViewportSize({ width, height: 932 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(output, 'review-' + width + '.png'), fullPage: true });
    }
    await page.locator('#acceptBookAIBatch').click(); await page.waitForFunction(() => WordbookWorkbench.snapshot().items.length === 2);
    assert.deepEqual(await page.evaluate(() => WordbookWorkbench.snapshot().items[0]), before, 'append preserves original teaching item');
    await page.locator('#bookAIResult').fill(JSON.stringify(second)); await page.locator('#checkBookAIResult').click();
    await page.locator('#copyBookRepair').waitFor({ state: 'visible' }); assert.equal(await page.evaluate(() => WordbookWorkbench.snapshot().items.length), 2, 'consumed result cannot append twice');
    const other = await browser.newContext({ serviceWorkers: 'block' }), otherPage = await other.newPage(); await otherPage.goto(base + '/wordbook-create.html');
    await otherPage.waitForFunction(() => document.querySelector('#bookAIWorkbench').getAttribute('aria-busy') === 'false');
    assert.equal(await otherPage.evaluate(() => WordbookWorkbench.snapshot().items.length), 0, 'new browser does not inherit local draft');
    await other.close();
    await page.evaluate(() => localStorage.setItem('chunklab_token', 'fixture.' + btoa(JSON.stringify({ uid: 'isolated-wordbook-account-B' })) + '.fixture'));
    await open(); assert.equal(await page.evaluate(() => WordbookWorkbench.snapshot().items.length), 0, 'account B has a separate draft');
    await page.evaluate(() => localStorage.removeItem('chunklab_token')); await open();
    assert.equal(await page.evaluate(() => WordbookWorkbench.snapshot().items.length), 2, 'returning to account A retains accepted items');
    const restored = await page.evaluate(() => WordbookWorkbench.snapshot());
    const originalSessionURL=page.url();
    const drop = async files => page.locator('#bookAIReceive').evaluate((element, entries) => {
      const dataTransfer = new DataTransfer();
      entries.forEach(entry => dataTransfer.items.add(new File([entry.text], entry.name, { type: 'application/json' })));
      element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    }, files);
    await drop([{ name: 'bad.json', text: '{invalid' }]);
    await page.waitForFunction(() => document.querySelector('#bookAIStatus').textContent.includes('JSON'));
    assert.equal(await page.locator('#bookAIStatus').isVisible(), true, 'drop errors are visible in the current status region');
    assert.deepEqual(await page.evaluate(() => WordbookWorkbench.snapshot()), restored, 'bad drop preserves the full draft');
    await drop([{ name: 'one.json', text: '{}' }, { name: 'two.json', text: '{}' }]);
    assert.match(await page.locator('#bookAIStatus').textContent(), /一次导入一个/);
    const imported = structuredClone(restored); imported.book.title = '拖拽恢复测试';
    page.once('dialog', dialog => dialog.dismiss());
    await drop([{ name: 'restore.json', text: JSON.stringify(imported) }]);
    await page.waitForTimeout(100);
    assert.deepEqual(await page.evaluate(() => WordbookWorkbench.snapshot()), restored, 'cancel protects a nonempty saved draft');
    page.once('dialog', dialog => dialog.accept());
    await drop([{ name: 'restore.json', text: JSON.stringify(imported) }]);
    await page.waitForFunction(() => WordbookWorkbench.snapshot().book.title === '拖拽恢复测试');
    await page.waitForFunction(() => document.querySelector('#bookAIStatus').textContent.includes('已打开单词本'));
    await open(new URL(page.url()).pathname + new URL(page.url()).search);
    assert.deepEqual(await page.evaluate(() => WordbookWorkbench.snapshot()), imported, 'confirmed drop persists all draft content across reload');
    assert.notEqual(page.url(),originalSessionURL,'opening a full book allocates a separate local editing session');
    const originalPage=await context.newPage();await originalPage.goto(originalSessionURL);
    await originalPage.waitForFunction(()=>document.querySelector('#bookAIWorkbench').getAttribute('aria-busy')==='false');
    assert.deepEqual(await originalPage.evaluate(()=>WordbookWorkbench.snapshot()),restored,'full-book import preserves the original editing session');
    await originalPage.close();
    assert.equal(await page.locator('#bookAIPersistence').isVisible(), false);
    const {createBeginnerSpeakingDraft}=await import('../src/wordbook-authoring/beginner-speaking.mjs');
    const beginner=createBeginnerSpeakingDraft();
    page.once('dialog',dialog=>dialog.accept());
    await drop([{name:'wordbook-draft.json',text:JSON.stringify(beginner)}]);
    await page.waitForFunction(()=>WordbookWorkbench.snapshot().items.length===22);
    await page.waitForFunction(()=>document.querySelector('#bookAIStatus').textContent.includes('已打开单词本'));
    assert.ok(!(await page.locator('#bookAIStatus').innerText()).includes('需要修正'),'text-only draft is not treated as 44 missing-picture errors');
    assert.deepEqual(await page.evaluate(()=>WordbookWorkbench.snapshot()),beginner);
    await open(new URL(page.url()).pathname+new URL(page.url()).search);
    assert.deepEqual(await page.evaluate(()=>WordbookWorkbench.snapshot()),beginner,'22 words and course associations survive draft recovery');
    await page.locator('#bookAIAccepted>details>summary').click();
    for(const width of [799,390]){
      await page.setViewportSize({width,height:932});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:path.join(output,'beginner-'+width+'.png'),fullPage:true,animations:'disabled'});
    }
    assert.deepEqual(errors, []);
    assert.equal(writes,0,'local authoring fixture never sends business writes to a server');
    console.log('Wordbook AI authoring: current entry, clipboard fallback, review, immutable append, duplicate rejection, reload, stale-tab/account protection, separate import sessions and two widths passed.');
  } finally {
    if (browser) await browser.close(); await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(output), os.tmpdir()); assert.ok(path.basename(output).startsWith('wordbook-ai-ui-'));
    if (process.env.WORDBOOK_AI_KEEP_SHOTS === '1') console.log('Screenshots: ' + output);
    else fs.rmSync(output, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
