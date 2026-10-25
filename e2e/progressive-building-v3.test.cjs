const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'output', 'progressive-building');
const MIME = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

async function startStaticServer() {
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const candidate = path.resolve(root, `.${pathname}`);
      if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end(); return; }
      const body = await fs.readFile(candidate);
      response.writeHead(200, { 'content-type': MIME[path.extname(candidate)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      response.end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

async function withBrowser(viewport, run) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pb-v3-browser-'));
  const context = await chromium.launchPersistentContext(tempDir, { headless: true, viewport });
  try { await run(context); }
  finally {
    await context.close();
    if (!path.resolve(tempDir).startsWith(path.resolve(os.tmpdir()) + path.sep)) throw new Error('Refusing to remove a non-temporary browser directory');
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function smoke(origin) {
  const viewports = [{ width: 360, height: 800 }, { width: 776, height: 932 }, { width: 1280, height: 900 }];
  for (const viewport of viewports) await withBrowser(viewport, async context => {
    const page = context.pages()[0];
    page.setDefaultTimeout(8000);
    const externalRequests = [];
    page.on('request', request => { if (!request.url().startsWith(origin)) externalRequests.push(request.url()); });
    await page.clock.install({ time: new Date('2026-01-01T00:00:00.000Z') });
    await page.addInitScript(() => {
      localStorage.setItem('sentinel-course-record', 'untouched');
      localStorage.setItem('legacy-course-state', 'untouched-too');
    });
    await page.goto(`${origin}/progressive-building-preview-v3.html?node=PB01&lesson=pb01-subject-predicate-v1`);
    await page.getByRole('heading', { name: '我' }).waitFor();
    assert.equal(await page.locator('#lesson-select > option').count(), 9);
    assert.equal(await page.locator('#lesson-select optgroup option').count(), 126);
    assert.equal(await page.locator('#lesson-select option[value="foundation-sv-preview"]').textContent(), 'PB01 · 主谓（已打磨）');
    assert.equal(await page.locator('#lesson-select option[value="node:PB01"]').evaluate(option => option.hidden), true);
    assert.equal(await page.locator('#lesson-select').inputValue(), 'node:PB01');
    assert.equal(await page.locator('#trail li').count(), 0);

    await page.keyboard.press('i');
    assert.equal(await page.locator('#progress').textContent(), '2 / 9');
    assert.equal(await page.locator('#trail li').count(), 1);
    assert.equal(await page.locator('#trail .schema-syntax-label').first().textContent(), '主语');
    await page.keyboard.press('w');
    assert.equal(await page.locator('#progress').textContent(), '3 / 9');
    await page.keyboard.press('i'); await page.keyboard.press('w');
    assert.equal(await page.locator('#progress').textContent(), '4 / 9');
    assert.equal(await page.locator('#trail li').count(), 3);
    await page.reload();
    await page.getByRole('heading', { name: '我工作' }).waitFor();
    assert.equal(await page.locator('#progress').textContent(), '4 / 9');
    assert.equal(await page.locator('#trail li').count(), 3);
    await page.getByText(/在 I work 里/).waitFor();
    await page.locator('#next').click();
    await page.getByRole('heading', { name: '主语', exact: true }).waitFor();
    await fs.mkdir(outputDir, { recursive: true });
    await page.screenshot({ path: path.join(outputDir, `pb01-range-${viewport.width}.png`), fullPage: true });
    await page.getByRole('button', { name: '按 W 选择 work' }).click();
    assert.equal(await page.locator('#progress').textContent(), '5 / 9');
    assert.match(await page.locator('#feedback').textContent(), /范围还没选完整/);
    await page.keyboard.press('i');
    assert.equal(await page.locator('#progress').textContent(), '6 / 9');
    assert.equal(await page.locator('#trail li').count(), 3);
    await page.getByRole('heading', { name: '谓语', exact: true }).waitFor();
    await page.keyboard.press('w');
    await page.getByRole('heading', { name: '只换成“你工作”里的“谁”' }).waitFor();
    await page.keyboard.press('i'); await page.keyboard.press('y');
    await page.getByRole('heading', { name: '只换成“你休息”里的“做什么”' }).waitFor();
    await page.getByRole('button', { name: 'work', exact: true }).click();
    await page.getByRole('button', { name: 'rest', exact: true }).click();
    await page.getByRole('heading', { name: '她休息' }).waitFor();
    assert.equal(await page.locator('#trail').isHidden(), true);
    await page.getByLabel('输入英文句子').fill('She rests.');
    await page.getByRole('button', { name: '检查' }).click();
    assert.equal(await page.locator('#next').isHidden(), false);
    assert.equal(await page.locator('#review-entry').isHidden(), true);
    await page.getByText('She rests.', { exact: true }).waitFor();
    await page.clock.fastForward(86_400_001);
    await page.locator('#review-entry').waitFor({ state: 'visible' });
    await page.locator('#review-entry').click();
    await page.getByLabel('输入英文句子').fill('She rests.');
    await page.getByRole('button', { name: '检查' }).click();
    await page.getByText('复习完成', { exact: true }).waitFor();
    assert.equal(await page.locator('#review-entry').isHidden(), true);
    await page.locator('#lesson-select').selectOption({ index: 0 });
    await page.keyboard.press('i'); await page.keyboard.press('w');
    assert.equal(await page.locator('#progress').textContent(), '1 / 9');
    assert.equal(await page.locator('#next').isHidden(), false);
    await page.locator('#next').click();
    assert.equal(await page.locator('#progress').textContent(), '2 / 9');
    assert.equal(await page.evaluate(() => localStorage.getItem('sentinel-course-record')), 'untouched');
    assert.equal(await page.evaluate(() => localStorage.getItem('legacy-course-state')), 'untouched-too');
    assert.deepEqual((await page.evaluate(() => Object.keys(localStorage))).sort(), ['chunk-practice:progressive-preview:v1', 'legacy-course-state', 'sentinel-course-record']);

    const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scrollWidth <= dimensions.width, `horizontal overflow at ${viewport.width}: ${JSON.stringify(dimensions)}`);
    await fs.mkdir(outputDir, { recursive: true });
    await page.screenshot({ path: path.join(outputDir, `pb01-${viewport.width}.png`), fullPage: true });
    assert.deepEqual(externalRequests, []);
  });
}

async function deepLinkChecks(origin) {
  await withBrowser({ width: 776, height: 932 }, async context => {
    const page = context.pages()[0];
    page.setDefaultTimeout(8000);
    await page.goto(`${origin}/progressive-building-preview-v3.html?node=PB99&lesson=arbitrary.mjs`);
    await page.getByText('没有找到对应的预览课程。').waitFor();
    assert.equal(await page.locator('#trail li').count(), 0);
    await page.goto(`${origin}/progressive-building-preview-v3.html?node=PB01&lesson=unknown-course`);
    await page.getByText('没有找到对应的预览课程。').waitFor();
  });
}

async function pb02Smoke(origin) {
  await withBrowser({ width: 776, height: 932 }, async context => {
    const page = context.pages()[0];
    page.setDefaultTimeout(8000);
    await page.goto(`${origin}/progressive-building-preview-v3.html?node=PB02&lesson=pb02-subject-verb-object-v1`);
    await page.getByRole('heading', { name: '茶' }).waitFor();
    await page.keyboard.press('t');
    await page.getByRole('heading', { name: '我喜欢茶' }).waitFor();
    await page.keyboard.press('i'); await page.keyboard.press('l'); await page.keyboard.press('t');
    await page.getByText(/在 I like tea 里/).waitFor();
    await page.locator('#next').click();
    await page.getByRole('heading', { name: '宾语', exact: true }).waitFor();
    await page.keyboard.press('t');
    await page.getByRole('heading', { name: '我喜欢咖啡' }).waitFor();
    await page.getByText('把 tea 换成 coffee。', { exact: true }).waitFor();
    assert.equal(await page.locator('#trail li').count(), 2);
    await page.getByRole('button', { name: 'tea', exact: true }).click();
    await page.getByRole('button', { name: 'coffee', exact: true }).click();
    await page.getByRole('heading', { name: '我的书' }).waitFor();
    await page.keyboard.press('m'); await page.keyboard.press('b');
    await page.getByRole('heading', { name: '我喜欢我的书' }).waitFor();
    await page.keyboard.press('i'); await page.keyboard.press('l'); await page.keyboard.press('m'); await page.keyboard.press('b');
    await page.getByText(/动作涉及的不是单独一个词/).waitFor();
    await page.locator('#next').click();
    await page.getByRole('heading', { name: '完整宾语', exact: true }).waitFor();
    await fs.mkdir(outputDir, { recursive: true });
    await page.screenshot({ path: path.join(outputDir, 'pb02-whole-object-range-776.png'), fullPage: true });
    await page.keyboard.press('m'); await page.keyboard.press('b');
    await page.getByRole('heading', { name: '他们喜欢我的书' }).waitFor();
    assert.equal(await page.locator('#trail').isHidden(), true);
    await page.getByLabel('输入英文句子').fill('They like my books.');
    await page.getByRole('button', { name: '检查' }).click();
    await page.getByText('They like my books.', { exact: true }).waitFor();
  });
}

async function pb03ContrastSmoke(origin) {
  await withBrowser({ width: 776, height: 932 }, async context => {
    const page = context.pages()[0];
    page.setDefaultTimeout(8000);
    await page.goto(`${origin}/progressive-building-preview-v3.html?node=PB03&lesson=pb03-predicative-object-contrast-v1`);
    await page.getByText(/She is happy 中/).waitFor();
    await fs.mkdir(outputDir, { recursive: true });
    await page.screenshot({ path: path.join(outputDir, 'pb03-predicative-object-contrast-776.png'), fullPage: true });
    await page.locator('#next').click();
    await page.getByRole('heading', { name: '宾语', exact: true }).waitFor();
    await page.keyboard.press('h');
    assert.equal(await page.locator('.is-floated').innerText(), 'happy');
    await page.keyboard.press('h');
    assert.equal(await page.locator('.is-floated').innerText(), 'her');
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: '我喜欢音乐' }).waitFor();
    assert.equal(await page.locator('#trail').isHidden(), true);
    await page.getByLabel('输入英文句子').fill('I like music.');
    await page.getByRole('button', { name: '检查' }).click();
    await page.getByText('I like music.', { exact: true }).waitFor();
  });
}

async function pb03OtherCoursesSmoke(origin) {
  const cases = [
    { lesson: 'pb03-noun-predicative-v1', first: '一名医生', sentence: '她是医生', build: ['s', 'i', 'a', 'd'], range: ['a', 'd'], explain: /回答“她是谁”/, identifyCue: '选出说明她身份的词块', answerCue: '他是医生', answer: 'He is a doctor.' },
    { lesson: 'pb03-adjective-predicative-v1', first: '开心', sentence: '她很开心', build: ['s', 'i', 'h'], range: ['h'], explain: /happy 说明 She 的状态/, identifyCue: '选出说明 She 状态的词', answerCue: '他很开心', answer: 'He is happy.' },
    { lesson: 'pb03-pp-predicative-v1', first: '在家', sentence: '她在家', build: ['s', 'i', 'a', 'h'], range: ['a', 'h'], explain: /at home 整组说明主语在哪里/, identifyCue: '选出说明 She 位置的词块', answerCue: '他在家', answer: 'He is at home.' },
  ];
  for (const item of cases) await withBrowser({ width: 776, height: 932 }, async context => {
    const page = context.pages()[0]; page.setDefaultTimeout(8000);
    await page.goto(`${origin}/progressive-building-preview-v3.html?node=PB03&lesson=${item.lesson}`);
    await page.getByRole('heading', { name: item.first, exact: true }).waitFor();
    if (item.first === '开心') await page.keyboard.press('h');
    else {
      await page.keyboard.press('a');
      await page.keyboard.press(item.first === '在家' ? 'h' : 'd');
    }
    await page.getByRole('heading', { name: item.sentence }).waitFor();
    for (const key of item.build) await page.keyboard.press(key);
    await page.getByText(item.explain).waitFor();
    await page.locator('#next').click();
    await page.getByRole('heading', { name: item.identifyCue, exact: true }).waitFor();
    assert.equal(await page.locator('#trail .schema-syntax-label').count(), 0, 'identification must not reveal the role labels before the answer');
    await page.getByText('表语', { exact: true }).waitFor();
    for (const key of item.range) await page.keyboard.press(key);
    await page.getByRole('heading', { name: item.answerCue, exact: true }).waitFor();
    await page.getByLabel('输入英文句子').fill(item.answer);
    await page.getByRole('button', { name: '检查' }).click();
    await page.getByText(item.answer, { exact: true }).waitFor();
  });
}

async function pb04ModifierSmoke(origin) {
  await withBrowser({ width: 776, height: 932 }, async context => {
    const page = context.pages()[0];
    page.setDefaultTimeout(8000);
    await page.goto(`${origin}/progressive-building-preview-v3.html?node=PB04&lesson=pb04-adjective-modifier-v1`);
    await page.getByText(/red 说明 bag/).waitFor();
    await page.locator('#next').click();
    await page.getByRole('heading', { name: '定语', exact: true }).waitFor();
    await page.keyboard.press('r');
    await page.keyboard.press('r'); await page.keyboard.press('b');
    await page.keyboard.press('i'); await page.keyboard.press('n'); await page.keyboard.press('a'); await page.keyboard.press('r'); await page.keyboard.press('b');
    await page.keyboard.press('a'); await page.keyboard.press('r'); await page.keyboard.press('b');
    await page.keyboard.press('r'); await page.keyboard.press('c');
    await page.keyboard.press('r'); await page.keyboard.press('c'); await page.keyboard.press('w');
    await page.getByText(/整个名词短语在这句话中作主语/).waitFor();
    await page.locator('#next').click();
    await page.getByRole('heading', { name: '完整主语', exact: true }).waitFor();
    await page.keyboard.press('r'); await page.keyboard.press('c');
    await page.getByRole('heading', { name: '红色汽车移动' }).waitFor();
    await page.getByLabel('输入英文句子').fill('Red cars move.');
    await page.getByRole('button', { name: '检查' }).click();
    await page.getByText('Red cars move.', { exact: true }).waitFor();
  });
}

async function pb05ArticleSmoke(origin) {
  await withBrowser({ width: 776, height: 932 }, async context => {
    const page = context.pages()[0];
    page.setDefaultTimeout(8000);
    await page.goto(`${origin}/progressive-building-preview-v3.html?node=PB05&lesson=pb05-article-sound-v1`);
    await page.getByText(/useful 的 u 发/).waitFor();
    await page.locator('#next').click();
    await page.getByRole('heading', { name: '一所大学' }).waitFor();
    await page.getByRole('button', { name: 'an', exact: true }).click();
    await page.getByRole('button', { name: 'a', exact: true }).click();
    await page.getByText(/hour 的 h 不发音/).waitFor();
    await page.locator('#next').click();
    await page.getByRole('button', { name: 'a', exact: true }).click();
    await page.getByRole('button', { name: 'an', exact: true }).click();
    await page.getByRole('heading', { name: '我需要一个苹果' }).waitFor();
    await page.getByLabel('输入英文句子').fill('I need an apple.');
    await page.getByRole('button', { name: '检查' }).click();
    await page.getByText('I need an apple.', { exact: true }).waitFor();
  });
}

async function pb05RemainingSmoke(origin) {
  const cases = [
    {
      lesson: 'pb05-known-reference-v1', run: async page => {
        await page.getByText(/先说 a dog/).waitFor(); await page.locator('#next').click();
        await page.keyboard.press('a'); await page.keyboard.press('t');
        await page.getByLabel('输入英文句子').fill('I see a cat. The cat is asleep.');
      }, answer: 'I see a cat. The cat is asleep.', cue: '我看见一只狗；那只狗在跑',
    },
    {
      lesson: 'pb05-plural-forms-v1', run: async page => {
        await page.locator('#next').click(); await page.keyboard.press('b'); await page.keyboard.press('b');
        await page.keyboard.press('c'); await page.keyboard.press('c');
        await page.getByLabel('输入英文句子').fill('Two feet.');
      }, answer: 'Two feet.', cue: '一个和多个',
    },
    {
      lesson: 'pb05-countability-v1', run: async page => {
        await page.locator('#next').click(); await page.keyboard.press('t'); await page.keyboard.press('s');
        await page.keyboard.press('s'); await page.keyboard.press('w');
        await page.getByLabel('输入英文句子').fill('I need some milk.');
      }, answer: 'I need some milk.', cue: '我需要一本书；我需要一些水',
    },
    {
      lesson: 'pb05-quantity-determiners-v1', run: async page => {
        await page.locator('#next').click(); await page.keyboard.press('m'); await page.keyboard.press('b');
        await page.keyboard.press('i'); await page.keyboard.press('h'); await page.keyboard.press('m'); await page.keyboard.press('b');
        await page.keyboard.press('m'); await page.keyboard.press('m');
        await page.getByLabel('输入英文句子').fill('I have many friends.');
      }, answer: 'I have many friends.', cue: '很多书；一些水',
    },
  ];
  for (const item of cases) await withBrowser({ width: 776, height: 932 }, async context => {
    const page = context.pages()[0]; page.setDefaultTimeout(8000);
    await page.goto(`${origin}/progressive-building-preview-v3.html?node=PB05&lesson=${item.lesson}`);
    await page.getByRole('heading').filter({ hasText: item.cue }).waitFor();
    await item.run(page);
    await page.getByRole('button', { name: '检查' }).click();
    await page.getByText(item.answer, { exact: true }).waitFor();
  });
}

async function pb06To15Smoke(origin) {
  const lessons = [
    { node: 'PB06', id: 'pb06-location-phrase-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['on', 'the', 'desk'] }, { type: 'range', words: ['on', 'the', 'desk'] }, { type: 'output', meaning: '包在椅子上', answer: 'The bag is on the chair.' }] },
    { node: 'PB06', id: 'pb06-position-meaning-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['under', 'the', 'table'] }, { type: 'output', meaning: '包在盒子下面', answer: 'The bag is under the box.' }] },
    { node: 'PB07', id: 'pb07-postpositive-modifier-v1', steps: [{ type: 'compose', words: ['The', 'book'] }, { type: 'compose', words: ['on', 'the', 'desk'] }, { type: 'teach' }, { type: 'compose', words: ['The', 'book', 'on', 'the', 'desk'] }, { type: 'compose', words: ['The', 'book', 'on', 'the', 'desk', 'is', 'mine'] }, { type: 'range', words: ['The', 'book', 'on', 'the', 'desk'] }, { type: 'output', meaning: '盒子里的杯子是我的', answer: 'The cup in the box is mine.' }] },
    { node: 'PB08', id: 'pb08-time-frequency-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['every', 'day'] }, { type: 'compose', words: ['She', 'reads', 'every', 'day'] }, { type: 'range', words: ['every', 'day'] }, { type: 'output', meaning: '我们每周学习', answer: 'We study every week.' }] },
    { node: 'PB08', id: 'pb08-place-adverbial-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['at', 'home'] }, { type: 'compose', words: ['She', 'reads', 'at', 'home'] }, { type: 'range', words: ['at', 'home'] }, { type: 'output', meaning: '他在学校工作', answer: 'He works at school.' }] },
    { node: 'PB08', id: 'pb08-manner-adverbial-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['slowly'] }, { type: 'compose', words: ['She', 'reads', 'slowly'] }, { type: 'range', words: ['slowly'] }, { type: 'output', meaning: '他走得很快', answer: 'He walks quickly.' }] },
    { node: 'PB08', id: 'pb08-company-adverbial-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['with', 'me'] }, { type: 'compose', words: ['She', 'reads', 'with', 'me'] }, { type: 'range', words: ['with', 'me'] }, { type: 'output', meaning: '他们和我们一起玩', answer: 'They play with us.' }] },
    { node: 'PB08', id: 'pb08-multiple-adverbials-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['at', 'home'] }, { type: 'compose', words: ['She', 'reads', 'at', 'home', 'every', 'day'] }, { type: 'range', words: ['at', 'home', 'every', 'day'] }, { type: 'output', meaning: '他每周在学校学习', answer: 'He studies at school every week.' }] },
    { node: 'PB09', id: 'pb09-required-destination-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['on', 'the', 'desk'] }, { type: 'compose', words: ['under', 'the', 'chair'] }, { type: 'compose', words: ['Put', 'the', 'book', 'on', 'the', 'desk'] }, { type: 'range', wrongWords: ['Put', 'the', 'book'], words: ['on', { text: 'the', occurrence: 2 }, 'desk'] }, { type: 'output', meaning: '把包放到椅子下面', answer: 'Put the bag under the chair.' }] },
    { node: 'PB09', id: 'pb09-optional-location-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['in', 'the', 'room'] }, { type: 'compose', words: ['She', 'reads', 'in', 'the', 'room'] }, { type: 'range', words: ['in', 'the', 'room'] }, { type: 'output', meaning: '她睡觉', answer: 'She sleeps.' }] },
    { node: 'PB10', id: 'pb10-comparative-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['bigger', 'than', 'mine'] }, { type: 'compose', words: ['This', 'bag', 'is', 'bigger', 'than', 'mine'] }, { type: 'range', words: ['bigger', 'than', 'mine'] }, { type: 'output', meaning: '这个盒子比你的大', answer: 'This box is bigger than yours.' }] },
    { node: 'PB10', id: 'pb10-superlative-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['the', 'highest', 'in', 'the', 'park'] }, { type: 'compose', words: ['This', 'hill', 'is', 'the', 'highest', 'in', 'the', 'park'] }, { type: 'range', words: ['the', 'highest', 'in', 'the', 'park'] }, { type: 'output', meaning: '这座山丘是城市里最高的', answer: 'This hill is the highest in the city.' }] },
    { node: 'PB10', id: 'pb10-degree-modifier-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['much', 'bigger'] }, { type: 'compose', words: ['This', 'bag', 'is', 'much', 'bigger', 'than', 'mine'] }, { type: 'range', words: ['much'] }, { type: 'output', meaning: '这个包比你的小得多', answer: 'This bag is much smaller than yours.' }] },
    { node: 'PB11', id: 'pb11-double-object-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['me'] }, { type: 'compose', words: ['a', 'book'] }, { type: 'compose', words: ['She', 'gives', 'me', 'a', 'book'] }, { type: 'compose', words: ['He', 'gives', 'her', 'a', 'pen'] }, { type: 'range', words: ['me'] }, { type: 'range', words: ['a', 'book'] }, { type: 'output', meaning: '他们给他一本书', answer: 'They give him a book.' }] },
    { node: 'PB12', id: 'pb12-give-to-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['to', 'her'] }, { type: 'compose', words: ['I', 'give', 'a', 'book', 'to', 'her'] }, { type: 'range', words: ['to', 'her'] }, { type: 'output', meaning: '他们给他一支笔', answer: 'They give a pen to him.' }] },
    { node: 'PB12', id: 'pb12-buy-for-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['for', 'her'] }, { type: 'compose', words: ['I', 'buy', 'a', 'coffee', 'for', 'her'] }, { type: 'output', meaning: '我们为他买一张票', answer: 'We buy a ticket for him.' }] },
    { node: 'PB12', id: 'pb12-verb-constraints-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['to', 'me'] }, { type: 'compose', words: ['She', 'explains', 'the', 'rule', 'to', 'me'] }, { type: 'output', meaning: '她向我们解释答案', answer: 'She explained the answer to us.' }] },
    { node: 'PB13', id: 'pb13-adjective-complement-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['me', 'happy'] }, { type: 'compose', words: ['The', 'news', 'made', 'me', 'happy'] }, { type: 'range', words: ['happy'] }, { type: 'output', meaning: '这个故事使她难过', answer: 'The story made her sad.' }] },
    { node: 'PB13', id: 'pb13-noun-complement-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['him', 'Tom'] }, { type: 'compose', words: ['They', 'call', 'him', 'Tom'] }, { type: 'range', words: ['Tom'] }, { type: 'output', meaning: '我们叫她安娜', answer: 'We call her Anna.' }] },
    { node: 'PB13', id: 'pb13-complement-vs-double-object-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['me', 'a', 'book'] }, { type: 'compose', words: ['They', 'gave', 'me', 'a', 'book'] }, { type: 'range', words: ['a', 'book'] }, { type: 'output', meaning: '消息使我开心', answer: 'The news made me happy.' }] },
    { node: 'PB14', id: 'pb14-want-to-do-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['to', 'learn', 'English'] }, { type: 'compose', words: ['I', 'want', 'to', 'learn', 'English'] }, { type: 'range', words: ['to', 'learn', 'English'] }, { type: 'range', words: ['English'] }, { type: 'output', meaning: '我想读一本书', answer: 'I want to read a book.' }] },
    { node: 'PB15', id: 'pb15-help-bare-infinitive-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['carry', 'this', 'box'] }, { type: 'compose', words: ['Can', 'you', 'help', 'me', 'carry', 'this', 'box'] }, { type: 'compose', words: ['I', 'help', 'her', 'open', 'the', 'door'] }, { type: 'range', words: ['carry', 'this', 'box'] }, { type: 'output', meaning: '他帮我关上窗户', answer: 'He helps me close the window.' }] },
    { node: 'PB15', id: 'pb15-help-to-infinitive-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['to', 'carry', 'this', 'box'] }, { type: 'compose', words: ['you', 'help', 'me', 'to', 'carry', 'this', 'box'] }, { type: 'output', meaning: '我帮她打开这扇门', answer: 'I help her to open the door.' }] },
  ];
  const chooseWords = async (page, words) => {
    for (const item of words) {
      const word = typeof item === 'string' ? item : item.text;
      const occurrence = typeof item === 'string' ? 1 : item.occurrence ?? 1;
      const choices = page.locator('.schema-choice');
      const labels = await choices.allTextContents();
      const matches = labels.map((label, index) => label.trim() === word ? index : -1).filter(index => index >= 0);
      const index = matches[occurrence - 1] ?? -1;
      assert.notEqual(index, -1, `missing word choice in ${await page.locator('#progress').textContent()}: ${word}; activity=${await page.locator('#activity').innerText()}`);
      await choices.nth(index).click();
    }
  };
  for (const lesson of lessons) {
    const viewports = lesson.node === 'PB07' ? [{ width: 360, height: 800 }, { width: 776, height: 932 }, { width: 1280, height: 900 }] : [{ width: 776, height: 932 }];
    for (const viewport of viewports) await withBrowser(viewport, async context => {
      const page = context.pages()[0]; page.setDefaultTimeout(8000);
      await page.goto(`${origin}/progressive-building-preview-v3.html?node=${lesson.node}&lesson=${lesson.id}`);
      await page.getByRole('heading').first().waitFor();
      for (const step of lesson.steps) {
        if (step.type === 'teach') await page.locator('#next').click();
        else if (step.type === 'compose' || step.type === 'range') {
          if (step.type === 'range') await page.getByText('选出', { exact: false }).first().waitFor();
          if (step.instruction) await page.getByText(step.instruction, { exact: true }).waitFor();
          if (step.wrongWords) {
            await chooseWords(page, step.wrongWords);
            if (step.wrongFeedback) await page.getByText(step.wrongFeedback, { exact: true }).waitFor();
            else await page.getByText(/范围还没选完整/).waitFor();
          }
          await chooseWords(page, step.words);
        } else {
          await page.getByRole('heading', { name: step.meaning }).waitFor().catch(async () => { throw new Error(`${lesson.id} expected output ${step.meaning}; activity=${await page.locator('#activity').innerText()}`); });
          assert.equal(await page.locator('#trail').isHidden(), true);
          await page.getByLabel('输入英文句子').fill(step.answer);
          await page.getByRole('button', { name: '检查' }).click();
          await page.getByText(step.answer, { exact: true }).waitFor();
        }
        if (lesson.node === 'PB07' && step.type === 'compose' && step.words.length > 6) {
          const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
          const offenders = await page.evaluate(() => [...document.querySelectorAll('#trail, #trail li, #trail .schema-syntax')].map(element => ({ tag: element.tagName, className: element.className?.baseVal ?? element.className, right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width, minWidth: getComputedStyle(element).minWidth, grid: getComputedStyle(element).gridTemplateColumns })));
          assert.ok(dimensions.scrollWidth <= dimensions.width, `PB07 horizontal overflow: ${JSON.stringify({ ...dimensions, offenders })}`);
          await fs.mkdir(outputDir, { recursive: true });
          await page.screenshot({ path: path.join(outputDir, `pb07-range-${viewport.width}.png`), fullPage: true });
        }
      }
    });
  }
}

async function pb16To50Smoke(origin) {
  const chooseWords = async (page, words) => {
    for (const item of words) {
      const word = typeof item === 'string' ? item : item.text;
      const occurrence = typeof item === 'string' ? 1 : item.occurrence ?? 1;
      const choices = page.locator('.schema-choice');
      const labels = await choices.allTextContents();
      const matches = labels.map((label, index) => label.trim() === word ? index : -1).filter(index => index >= 0);
      const index = matches[occurrence - 1] ?? -1;
      assert.notEqual(index, -1, `missing transform/compose choice ${word}: ${await page.locator('#activity').innerText()}`);
      await choices.nth(index).click();
    }
  };
  const lessons = [
    { node: 'PB16', id: 'pb16-be-negative-question-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['You', 'are', 'ready'] }, { type: 'transform', activate: 'are', choices: ['not'] }, { type: 'transform', activate: 'are' }, { type: 'transform', activate: '.', choices: ['?'] }, { type: 'compose', words: ['Yes', 'I', 'am'] }, { type: 'output', meaning: '他们还没准备好', answer: 'They are not ready.' }] },
    { node: 'PB17', id: 'pb17-do-negation-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['You', 'like', 'tea'] }, { type: 'transform', activate: 'like', choices: ['do', 'not'] }, { type: 'transform', activate: 'likes', choices: ['does', 'not', 'like'] }, { type: 'output', meaning: '他不喜欢牛奶', answer: 'He does not like milk.' }] },
    { node: 'PB17', id: 'pb17-general-question-v1', steps: [{ type: 'teach' }, { type: 'transform', activate: 'You', choices: ['you'] }, { type: 'transform', activate: 'you', choices: ['Do'] }, { type: 'transform', activate: '.', choices: ['?'] }, { type: 'transform', activate: 'She', choices: ['Does', 'she', 'like'] }, { type: 'transform', activate: '.', choices: ['?'] }, { type: 'compose', words: ['Yes', 'she', 'does'] }, { type: 'output', meaning: '他喜欢牛奶吗', answer: 'Does he like milk?' }] },
    { node: 'PB18', id: 'pb18-ability-permission-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['can'] }, { type: 'compose', words: ['I', 'can', 'swim'] }, { type: 'compose', words: ['Can', 'I', 'use', 'your', 'phone'] }, { type: 'output', meaning: '我可以借一支笔吗', answer: 'Can I borrow a pen?' }] },
    { node: 'PB18', id: 'pb18-request-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['Can'] }, { type: 'compose', words: ['Can', 'you', 'help', 'me'] }, { type: 'output', meaning: '你可以等一下吗', answer: 'Can you wait?' }] },
    { node: 'PB18', id: 'pb18-obligation-advice-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['must'] }, { type: 'compose', words: ['You', 'must', 'wear', 'a', 'seat', 'belt'] }, { type: 'output', meaning: '你应该休息', answer: 'You should rest.' }] },
    { node: 'PB18', id: 'pb18-deduction-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['must'] }, { type: 'compose', words: ['She', 'must', 'be', 'at', 'home'] }, { type: 'output', meaning: '他一定累了', answer: 'He must be tired.' }] },
    { node: 'PB19', id: 'pb19-what-question-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['What'] }, { type: 'compose', words: ['What', 'do', 'you', 'need'] }, { type: 'output', meaning: '你想要什么', answer: 'What do you want?' }] },
    { node: 'PB19', id: 'pb19-where-when-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['Where'] }, { type: 'compose', words: ['Where', 'do', 'you', 'work'] }, { type: 'output', meaning: '我们什么时候到', answer: 'When do we arrive?' }] },
    { node: 'PB19', id: 'pb19-subject-object-who-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['Who'] }, { type: 'compose', words: ['Who', 'can', 'help', 'you'] }, { type: 'output', meaning: '你能帮助谁', answer: 'Who can you help?' }] },
    { node: 'PB20', id: 'pb20-imperative-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['Open', 'the', 'door', 'now'] }, { type: 'transform', activate: 'now' }, { type: 'transform', activate: 'Open', choices: ['Do', 'not', 'open'] }, { type: 'output', meaning: '不要关上窗户', answer: "Don't close the window." }] },
    { node: 'PB20', id: 'pb20-existential-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['There', 'is', 'a', 'book'] }, { type: 'compose', words: ['There', 'is', 'a', 'book', 'on', 'the', 'desk'] }, { type: 'compose', words: ['The', 'book', 'is', 'on', 'the', 'desk'] }, { type: 'compose', words: ['There', 'are', 'three', 'books', 'on', 'the', 'desk'] }, { type: 'output', meaning: '房间里有两把椅子', answer: 'There are two chairs in the room.' }] },
    { node: 'PB21', id: 'pb21-present-agreement-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['every', 'day'] }, { type: 'compose', words: ['She', 'works', 'every', 'day'] }, { type: 'transform', activate: 'I', choices: ['She', 'works'] }, { type: 'transform', activate: 'She', choices: ['Does', 'she', 'work'] }, { type: 'transform', activate: '.', choices: ['?'] }, { type: 'output', meaning: '他每周读书吗', answer: 'Does he read every week?' }] },
    { node: 'PB22', id: 'pb22-present-progressive-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['is', 'reading'] }, { type: 'compose', words: ['She', 'is', 'reading', 'now'] }, { type: 'compose', words: ['She', 'reads', 'every', 'day'] }, { type: 'transform', activate: 'reads', choices: ['is', 'reading'] }, { type: 'output', meaning: '他们此刻正在外面玩', answer: 'They are playing outside now.' }] },
    { node: 'PB23', id: 'pb23-past-be-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['at', 'home'] }, { type: 'compose', words: ['She', 'was', 'at', 'home', 'yesterday'] }, { type: 'transform', activate: 'was', choices: ['not'] }, { type: 'transform', activate: 'She', choices: ['Was', 'she'] }, { type: 'transform', activate: '.', choices: ['?'] }, { type: 'output', meaning: '他们昨天不在家', answer: 'They were not at home yesterday.' }] },
    { node: 'PB24', id: 'pb24-past-did-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['went', 'home', 'yesterday'] }, { type: 'compose', words: ['She', 'went', 'home', 'yesterday'] }, { type: 'transform', activate: 'went', choices: ['did', 'not', 'go'] }, { type: 'transform', activate: 'She', choices: ['Did', 'she', 'go'] }, { type: 'transform', activate: '.', choices: ['?'] }, { type: 'compose', words: ['Who', 'saw', 'the', 'bus'] }, { type: 'output', meaning: '他们昨天没有看见公交车', answer: "They didn't see the bus." }] },
    { node: 'PB25', id: 'pb25-going-to-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['going', 'to', 'visit'] }, { type: 'compose', words: ['I', 'am', 'going', 'to', 'visit', 'her'] }, { type: 'output', meaning: '她下周打算旅行', answer: 'She is going to travel next week.' }] },
    { node: 'PB25', id: 'pb25-will-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['will', 'help'] }, { type: 'compose', words: ['I', 'will', 'help', 'you'] }, { type: 'output', meaning: '看来要下雨了', answer: 'It will rain.' }] },
    { node: 'PB25', id: 'pb25-arrangement-v1', steps: [{ type: 'teach' }, { type: 'compose', words: ['are', 'meeting'] }, { type: 'compose', words: ['We', 'are', 'meeting', 'at', 'six', 'tomorrow'] }, { type: 'output', meaning: '他们今晚要出发', answer: 'They are leaving tonight.' }] },
    { node: 'PB26', id: 'pb26-past-progressive-background-v1', steps: [{ type: 'compose', words: ['was', 'reading'] }, { type: 'compose', words: ['She', 'called'] }, { type: 'compose', words: ['I', 'was', 'reading', 'when', 'she', 'called'] }, { type: 'teach' }, { type: 'output', meaning: '他到达时，我正在做饭', answer: 'I was cooking when he arrived.' }] },
    { node: 'PB27', id: 'pb27-present-perfect-v1', steps: [{ type: 'compose', words: ['have', 'lost'] }, { type: 'compose', words: ['I', 'have', 'lost', 'my', 'keys'] }, { type: 'teach' }, { type: 'compose', words: ['We', 'have', 'seen', 'that', 'movie'] }, { type: 'compose', words: ['She', 'has', 'lived', 'here', 'for', 'five', 'years'] }, { type: 'compose', words: ['She', 'has', 'lived', 'here', 'since', 'Monday'] }, { type: 'compose', words: ['I', 'lost', 'my', 'keys', 'yesterday'] }, { type: 'output', meaning: '她在这里住了三年（现在仍住）', answer: 'She has lived here for three years.' }] },
    { node: 'PB28', id: 'pb28-past-perfect-order-v1', steps: [{ type: 'compose', words: ['She', 'had', 'left'] }, { type: 'compose', words: ['I', 'arrived'] }, { type: 'compose', words: ['She', 'had', 'left', 'before', 'I', 'arrived'] }, { type: 'teach' }, { type: 'output', meaning: '我们到达之前，他已经吃完晚饭', answer: 'He had finished dinner before we arrived.' }] },
    { node: 'PB29', id: 'pb29-perfect-progressive-v1', steps: [{ type: 'compose', words: ['have', 'been', 'waiting'] }, { type: 'compose', words: ['I', 'have', 'been', 'waiting', 'for', 'an', 'hour'] }, { type: 'teach' }, { type: 'output', meaning: '她从早上开始一直在工作', answer: 'She has been working since morning.' }] },
    { node: 'PB29', id: 'pb29-future-progressive-v1', steps: [{ type: 'compose', words: ['will', 'be', 'flying'] }, { type: 'compose', words: ['This', 'time', 'tomorrow', 'I', 'will', 'be', 'flying', 'to', 'London'] }, { type: 'teach' }, { type: 'output', meaning: '他们中午会正在旅行', answer: 'They will be travelling at noon.' }] },
    { node: 'PB29', id: 'pb29-future-perfect-v1', steps: [{ type: 'compose', words: ['will', 'have', 'finished'] }, { type: 'compose', words: ['By', 'Friday', 'she', 'will', 'have', 'finished', 'the', 'book'] }, { type: 'teach' }, { type: 'output', meaning: '到周五时他们会已经完成工作', answer: 'They will have completed the work by Friday.' }] },
    { node: 'PB30', id: 'pb30-basic-passive-v1', steps: [{ type: 'compose', words: ['Workers', 'repaired', 'the', 'bike'] }, { type: 'transform', activate: 'Workers', wrongChoices: ['The', 'was', 'bike', 'repaired', 'by', 'workers'], choices: ['The', 'bike', 'was', 'repaired', 'by', 'workers'] }, { type: 'teach' }, { type: 'compose', words: ['The', 'room', 'is', 'cleaned', 'every', 'day'] }, { type: 'output', meaning: '窗户昨天被打破了', answer: 'The window was broken yesterday.' }] },
    { node: 'PB30', id: 'pb30-modal-perfect-passive-v1', steps: [{ type: 'compose', words: ['The', 'report', 'has', 'been', 'finished'] }, { type: 'teach' }, { type: 'compose', words: ['The', 'door', 'must', 'be', 'closed'] }, { type: 'output', meaning: '这些信明天会被寄出', answer: 'The letters will be sent tomorrow.' }] },
    { node: 'PB30', id: 'pb30-passive-complement-v1', steps: [{ type: 'compose', words: ['They', 'made', 'him', 'happy'] }, { type: 'compose', words: ['He', 'was', 'made', 'happy'] }, { type: 'teach' }, { type: 'output', meaning: '他被认为已经准备好了', answer: 'He was considered ready.' }] },
    { node: 'PB31', id: 'pb31-gerund-subject-v1', steps: [{ type: 'compose', wrongWords: ['swim'], wrongFeedback: 'swim 表示“去游泳”这个动作；这里说的是“游泳这件事”本身，所以用 swimming。', words: ['Swimming'], instruction: '想说“游泳这项活动本身”，下面两种形式都能组成英语。选你认为合适的一种。' }, { type: 'compose', words: ['Swimming', 'is', 'fun'] }, { type: 'teach' }, { type: 'output', meaning: '在户外散步感觉很舒服', answer: 'Walking outside feels good.' }] },
    { node: 'PB31', id: 'pb31-gerund-object-v1', steps: [{ type: 'compose', words: ['reading'] }, { type: 'compose', words: ['I', 'enjoy', 'reading'] }, { type: 'teach' }, { type: 'output', meaning: '他们喜欢做饭', answer: 'They enjoy cooking.' }] },
    { node: 'PB31', id: 'pb31-gerund-phrase-v1', steps: [{ type: 'compose', words: ['Reading', 'books'] }, { type: 'compose', words: ['Reading', 'books', 'helps', 'me', 'relax'] }, { type: 'teach' }, { type: 'output', meaning: '学英语能让我放松', answer: 'Learning English helps me relax.' }] },
    { node: 'PB32', id: 'pb32-purpose-infinitive-v1', steps: [{ type: 'compose', words: ['to', 'find', 'the', 'station'] }, { type: 'compose', words: ['I', 'use', 'a', 'map', 'to', 'find', 'the', 'station'] }, { type: 'teach' }, { type: 'compose', words: ['They', 'use', 'a', 'map', 'to', 'find', 'the', 'hotel'] }, { type: 'output', meaning: '我们用地图是为了找到车站', answer: 'We use a map to find the station.' }] },
    { node: 'PB32', id: 'pb32-infinitive-subject-v1', steps: [{ type: 'compose', words: ['To', 'rest'] }, { type: 'compose', words: ['To', 'rest', 'is', 'important'] }, { type: 'teach' }, { type: 'compose', words: ['It', 'is', 'important', 'to', 'rest'] }, { type: 'output', meaning: '每天读书很重要', answer: 'It is important to read every day.' }] },
    { node: 'PB32', id: 'pb32-infinitive-modifier-contrast-v1', steps: [{ type: 'compose', words: ['a', 'book', 'to', 'read'] }, { type: 'compose', words: ['I', 'need', 'a', 'book', 'to', 'read'] }, { type: 'teach' }, { type: 'compose', words: ['I', 'want', 'to', 'read', 'a', 'book'] }, { type: 'output', meaning: '她有事情要做', answer: 'She has work to do.' }] },
    { node: 'PB33', id: 'pb33-present-participle-modifier-v1', steps: [{ type: 'compose', words: ['standing', 'by', 'the', 'door'] }, { type: 'compose', words: ['The', 'boy', 'standing', 'by', 'the', 'door', 'smiled'] }, { type: 'teach' }, { type: 'compose', words: ['The', 'girl', 'waiting', 'outside', 'waved'] }, { type: 'output', meaning: '坐在那里的女人笑了', answer: 'The woman sitting there smiled.' }] },
    { node: 'PB33', id: 'pb33-past-participle-modifier-v1', steps: [{ type: 'compose', words: ['The', 'bike', 'repaired', 'yesterday'] }, { type: 'compose', words: ['The', 'bike', 'repaired', 'yesterday', 'is', 'mine'] }, { type: 'teach' }, { type: 'compose', words: ['The', 'letter', 'written', 'yesterday', 'arrived'] }, { type: 'output', meaning: '昨天修理过的自行车看起来是新的', answer: 'The bike repaired yesterday looks new.' }] },
    { node: 'PB33', id: 'pb33-participle-attachment-v1', steps: [{ type: 'compose', words: ['reading', 'a', 'book'] }, { type: 'compose', words: ['The', 'girl', 'reading', 'a', 'book', 'smiled'] }, { type: 'teach' }, { type: 'output', meaning: '拿着一个包的男人挥手了', answer: 'The man carrying a bag waved.' }] },
    { node: 'PB34', id: 'pb34-to-infinitive-complement-v1', steps: [{ type: 'compose', words: ['to', 'wait'], wrongWords: ['wait', 'to'] }, { type: 'compose', words: ['I', 'asked', 'him', 'to', 'wait'] }, { type: 'teach' }, { type: 'compose', words: ['She', 'told', 'me', 'to', 'sit'] }, { type: 'output', meaning: '她告诉他要等', answer: 'She told him to wait.' }] },
    { node: 'PB34', id: 'pb34-bare-infinitive-complement-v1', steps: [{ type: 'compose', words: ['cross', 'the', 'road'] }, { type: 'compose', words: ['I', 'saw', 'him', 'cross', 'the', 'road'] }, { type: 'teach' }, { type: 'compose', words: ['We', 'heard', 'them', 'sing'] }, { type: 'output', meaning: '我看见她打开门', answer: 'I saw her open the door.' }] },
    { node: 'PB34', id: 'pb34-ing-ed-complement-v1', steps: [{ type: 'compose', words: ['running'] }, { type: 'compose', words: ['I', 'saw', 'him', 'running'] }, { type: 'teach' }, { type: 'compose', words: ['They', 'found', 'the', 'door', 'locked'] }, { type: 'output', meaning: '我发现窗户坏了', answer: 'I found the window broken.' }] },
    { node: 'PB35', id: 'pb35-particle-verb-position-v1', steps: [{ type: 'compose', words: ['Turn', 'on', 'the', 'light'] }, { type: 'teach' }, { type: 'transform', activate: 'on' }, { type: 'transform', activate: 'the', choices: ['it'] }, { type: 'output', meaning: '把它关掉', answer: 'Turn it off.' }] },
    { node: 'PB35', id: 'pb35-preposition-object-position-v1', steps: [{ type: 'compose', words: ['listen', 'to', 'the', 'music'] }, { type: 'compose', words: ['We', 'listen', 'to', 'the', 'music'] }, { type: 'teach' }, { type: 'compose', words: ['We', 'listen', 'to', 'it'] }, { type: 'output', meaning: '他们看那幅图片', answer: 'They look at the picture.' }] },
    { node: 'PB35', id: 'pb35-verb-complement-patterns-v1', steps: [{ type: 'compose', words: ['want', 'to', 'swim'] }, { type: 'compose', words: ['I', 'want', 'to', 'swim'] }, { type: 'teach' }, { type: 'compose', words: ['I', 'enjoy', 'swimming'] }, { type: 'output', meaning: '她计划去旅行', answer: 'She plans to travel.' }] },
    { node: 'PB36', id: 'pb36-that-object-clause-v1', steps: [{ type: 'compose', words: ['that', 'she', 'is', 'ready'], wrongWords: ['she', 'that', 'is', 'ready'] }, { type: 'compose', words: ['I', 'know', 'that', 'she', 'is', 'ready'] }, { type: 'teach' }, { type: 'output', meaning: '我们知道他累了', answer: 'We know that he is tired.' }] },
    { node: 'PB36', id: 'pb36-wh-indirect-question-v1', steps: [{ type: 'compose', words: ['I', 'know', 'where', 'she', 'lives'] }, { type: 'teach' }, { type: 'compose', words: ['Do', 'you', 'know', 'if', 'he', 'is', 'ready'] }, { type: 'output', meaning: '我想知道她是否在家', answer: 'I wonder whether she is at home.' }] },
    { node: 'PB36', id: 'pb36-embedded-statement-order-v1', steps: [{ type: 'compose', words: ['what', 'she', 'said'] }, { type: 'compose', words: ['I', 'remember', 'what', 'she', 'said'] }, { type: 'teach' }, { type: 'output', meaning: '他们知道我们住在哪里', answer: 'They know where we live.' }] },
    { node: 'PB37', id: 'pb37-relative-subject-v1', steps: [{ type: 'compose', words: ['The', 'woman', 'who', 'called', 'me'] }, { type: 'compose', words: ['The', 'woman', 'who', 'called', 'me', 'is', 'my', 'teacher'] }, { type: 'teach' }, { type: 'output', meaning: '追我们的狗跑开了', answer: 'The dog that chased us ran away.' }] },
    { node: 'PB37', id: 'pb37-relative-object-omission-v1', steps: [{ type: 'compose', words: ['The', 'book', 'that', 'you', 'bought', 'is', 'interesting'] }, { type: 'teach' }, { type: 'transform', activate: 'that' }, { type: 'compose', words: ['The', 'cake', 'she', 'made', 'tastes', 'great'] }, { type: 'output', meaning: '他画的图片看起来很漂亮', answer: 'The picture he painted looks beautiful.' }] },
    { node: 'PB37', id: 'pb37-relative-whole-subject-v1', steps: [{ type: 'compose', words: ['The', 'student', 'who', 'won', 'the', 'prize'] }, { type: 'compose', words: ['The', 'student', 'who', 'won', 'the', 'prize', 'is', 'my', 'friend'] }, { type: 'teach' }, { type: 'output', meaning: '踢进球的球员是我的表亲', answer: 'The player who scored the goal is my cousin.' }] },
    { node: 'PB38', id: 'pb38-subject-clause-v1', steps: [{ type: 'compose', words: ['What', 'she', 'said'] }, { type: 'compose', words: ['What', 'she', 'said', 'surprised', 'me'] }, { type: 'teach' }, { type: 'output', meaning: '我们住的地方很重要', answer: 'Where we live matters.' }] },
    { node: 'PB38', id: 'pb38-formal-subject-it-v1', steps: [{ type: 'compose', words: ['That', 'she', 'won', 'is', 'surprising'] }, { type: 'teach' }, { type: 'compose', words: ['It', 'is', 'clear', 'that', 'he', 'left'] }, { type: 'output', meaning: '我们需要帮助这件事很清楚', answer: 'It is clear that we need help.' }] },
    { node: 'PB38', id: 'pb38-postposed-clause-predicate-v1', steps: [{ type: 'compose', words: ['It', 'is', 'clear', 'that', 'we', 'need', 'help'] }, { type: 'teach' }, { type: 'compose', words: ['That', 'we', 'need', 'help', 'is', 'clear'] }, { type: 'output', meaning: '他准备好了这件事很清楚', answer: 'It is clear that he is ready.' }] },
    { node: 'PB39', id: 'pb39-that-predicative-clause-v1', steps: [{ type: 'compose', words: ['that', 'we', 'have', 'no', 'time'] }, { type: 'compose', words: ['The', 'problem', 'is', 'that', 'we', 'have', 'no', 'time'] }, { type: 'teach' }, { type: 'output', meaning: '事实是他很善良', answer: 'The truth is that he is kind.' }] },
    { node: 'PB39', id: 'pb39-wh-predicative-clause-v1', steps: [{ type: 'compose', words: ['what', 'we', 'should', 'do'] }, { type: 'compose', words: ['The', 'question', 'is', 'what', 'we', 'should', 'do'] }, { type: 'teach' }, { type: 'output', meaning: '答案是她住在哪里', answer: 'The answer is where she lives.' }] },
    { node: 'PB39', id: 'pb39-object-predicative-contrast-v1', steps: [{ type: 'compose', words: ['I', 'know', 'what', 'she', 'wants'] }, { type: 'teach' }, { type: 'compose', words: ['The', 'question', 'is', 'what', 'we', 'need'] }, { type: 'output', meaning: '我知道他们住在哪里', answer: 'I know where they live.' }] },
    { node: 'PB40', id: 'pb40-noun-apposition-v1', steps: [{ type: 'compose', words: ['My', 'brother'] }, { type: 'compose', words: ['My', 'brother', 'a', 'doctor', 'lives', 'here'] }, { type: 'teach' }, { type: 'output', meaning: '我们的老师是一位作家，住在附近', answer: 'Our teacher, a writer, lives nearby.' }] },
    { node: 'PB40', id: 'pb40-content-clause-after-noun-v1', steps: [{ type: 'compose', words: ['that', 'she', 'won'] }, { type: 'compose', words: ['The', 'fact', 'that', 'she', 'won', 'surprised', 'us'] }, { type: 'teach' }, { type: 'output', meaning: '我们能够帮忙这个想法很重要', answer: 'The idea that we can help is important.' }] },
    { node: 'PB40', id: 'pb40-content-vs-relative-clause-v1', steps: [
      { type: 'compose', words: ['he', 'won'] },
      { type: 'compose', words: ['that', 'he', 'won'], instruction: 'that 放在完整小句前，把“他赢了”作为一整件事说出来。' },
      { type: 'compose', words: ['The', 'news', 'that', 'he', 'won'], instruction: '先说中心词 news，再接表示“消息内容”的 that 小句。' },
      { type: 'compose', words: ['The', 'news', 'that', 'he', 'won', 'surprised', 'me'], instruction: '主语块已经搭好；现在接上“使我惊讶”，完成整句。' },
      { type: 'teach' },
      { type: 'compose', words: ['he', 'told', 'me'] },
      { type: 'compose', words: ['The', 'news', 'that', 'he', 'told', 'me'], instruction: '这次 that 代替 news，在从句中作 told 的宾语；整段从句用来限定“哪条消息”。' },
      { type: 'compose', words: ['The', 'news', 'that', 'he', 'told', 'me', 'surprised', 'us'], instruction: '把刚拼好的主语接回句子，再补上“使我们惊讶”。' },
      { type: 'output', meaning: '她写的那个故事很受欢迎', answer: 'The story that she wrote was popular.' },
    ] },
    { node: 'PB41', id: 'pb41-time-clause-v1', steps: [{ type: 'compose', words: ['She', 'called', 'me'] }, { type: 'compose', words: ['after', 'I', 'got', 'home'] }, { type: 'compose', words: ['She', 'called', 'me', 'after', 'I', 'got', 'home'] }, { type: 'teach' }, { type: 'output', meaning: '他们到达时，我们吃了饭', answer: 'We ate when they arrived.' }] },
    { node: 'PB41', id: 'pb41-cause-clause-v1', steps: [{ type: 'compose', words: ['I', 'stayed', 'home'] }, { type: 'compose', words: ['because', 'it', 'rained'] }, { type: 'compose', words: ['I', 'stayed', 'home', 'because', 'it', 'rained'] }, { type: 'teach' }, { type: 'output', meaning: '会议结束了，他们早早离开', answer: 'They left early because the meeting ended.' }] },
    { node: 'PB41', id: 'pb41-real-condition-v1', steps: [{ type: 'compose', words: ['If', 'it', 'rains'] }, { type: 'compose', words: ['we', 'stay', 'home'] }, { type: 'compose', words: ['If', 'it', 'rains', 'we', 'stay', 'home'] }, { type: 'teach' }, { type: 'output', meaning: '如果你需要帮助，就给我打电话', answer: 'If you need help, call me.' }] },
    { node: 'PB41', id: 'pb41-time-sequence-review-v1', steps: [{ type: 'compose', words: ['I', 'was', 'reading'] }, { type: 'compose', words: ['she', 'called'] }, { type: 'compose', words: ['I', 'was', 'reading', 'when', 'she', 'called'] }, { type: 'teach' }, { type: 'compose', words: ['She', 'had', 'left', 'before', 'I', 'arrived'] }, { type: 'output', meaning: '我到家时，他正在做饭', answer: 'He was cooking when I got home.' }] },
    { node: 'PB42', id: 'pb42-purpose-clause-v1', steps: [{ type: 'compose', words: ['She', 'went', 'to', 'the', 'shop'] }, { type: 'compose', words: ['to', 'buy', 'bread'] }, { type: 'compose', words: ['She', 'went', 'to', 'the', 'shop', 'to', 'buy', 'bread'] }, { type: 'teach' }, { type: 'output', meaning: '我们用地图是为了找到酒店', answer: 'We use a map to find the hotel.' }] },
    { node: 'PB42', id: 'pb42-result-clause-v1', steps: [{ type: 'compose', words: ['It', 'was', 'cold'] }, { type: 'compose', words: ['we', 'stayed', 'home'] }, { type: 'compose', words: ['It', 'was', 'so', 'cold', 'that', 'we', 'stayed', 'home'] }, { type: 'teach' }, { type: 'output', meaning: '音乐太响了，以至于他们早早离开', answer: 'The music was so loud that they left early.' }] },
    { node: 'PB42', id: 'pb42-concession-clause-v1', steps: [{ type: 'compose', words: ['Although', 'it', 'was', 'raining'] }, { type: 'compose', words: ['we', 'went', 'out'] }, { type: 'compose', words: ['Although', 'it', 'was', 'raining', 'we', 'went', 'out'] }, { type: 'teach' }, { type: 'output', meaning: '尽管他很累，还是完成了工作', answer: 'Although he was tired, he finished the work.' }] },
    { node: 'PB42', id: 'pb42-comparison-manner-clause-v1', steps: [{ type: 'compose', words: ['as', 'I', 'showed', 'you'] }, { type: 'compose', words: ['Do', 'it', 'as', 'I', 'showed', 'you'] }, { type: 'teach' }, { type: 'compose', words: ['She', 'sings', 'as', 'beautifully', 'as', 'her', 'sister', 'does'] }, { type: 'output', meaning: '他跑得和他哥哥一样快', answer: 'He runs as fast as his brother.' }] },
    { node: 'PB42', id: 'pb42-enough-too-v1', steps: [{ type: 'compose', words: ['He', 'is', 'old', 'enough', 'to', 'drive'] }, { type: 'teach' }, { type: 'output', meaning: '这个孩子太年幼，不能开车', answer: 'The child is too young to drive.' }] },
    { node: 'PB43', id: 'pb43-coordination-v1', steps: [{ type: 'compose', words: ['I', 'called', 'her'] }, { type: 'compose', words: ['She', 'answered'] }, { type: 'compose', words: ['I', 'called', 'her', 'and', 'she', 'answered'] }, { type: 'teach' }, { type: 'output', meaning: '他打开窗户，他们看向外面', answer: 'He opened the window and they looked outside.' }] },
    { node: 'PB43', id: 'pb43-contrast-coordination-v1', steps: [{ type: 'compose', words: ['It', 'was', 'late'] }, { type: 'compose', words: ['we', 'kept', 'working'] }, { type: 'compose', words: ['It', 'was', 'late', 'but', 'we', 'kept', 'working'] }, { type: 'teach' }, { type: 'output', meaning: '道路很拥挤，但他们步行回家', answer: 'The road was busy, but they walked home.' }] },
    { node: 'PB43', id: 'pb43-licensed-omission-v1', steps: [{ type: 'compose', words: ['She', 'opened', 'the', 'door', 'and', 'she', 'walked', 'in'] }, { type: 'teach' }, { type: 'transform', activate: 'she' }, { type: 'output', meaning: '我们做了晚饭，然后吃了', answer: 'We cooked dinner and ate.' }] },
    { node: 'PB43', id: 'pb43-user-long-chain-v1', steps: [{ type: 'compose', words: ['He', 'is', 'old', 'enough', 'to', 'go', 'to', 'school'] }, { type: 'compose', words: ['he', 'is', 'not', 'old', 'enough', 'to', 'drive'] }, { type: 'compose', words: ['He', 'is', 'old', 'enough', 'to', 'go', 'to', 'school', 'but', 'he', 'is', 'not', 'old', 'enough', 'to', 'drive'] }, { type: 'teach' }, { type: 'transform', activate: 'he' }, { type: 'output', meaning: '房间足够明亮，可以阅读，但不够明亮，不能工作', answer: 'The room is bright enough to read in, but not bright enough to work in.' }] },
    { node: 'PB44', id: 'pb44-real-vs-unreal-condition-v1', steps: [{ type: 'compose', words: ['If', 'it', 'rains'] }, { type: 'compose', words: ['we', 'will', 'stay', 'home'] }, { type: 'compose', words: ['If', 'it', 'rains', 'we', 'will', 'stay', 'home'] }, { type: 'teach' }, { type: 'compose', words: ['If', 'it', 'were', 'sunny'] }, { type: 'output', meaning: '如果下雪，我们就会坐公交车', answer: 'If it snows, we will take the bus.' }] },
    { node: 'PB44', id: 'pb44-present-unreal-condition-v1', steps: [{ type: 'compose', words: ['If', 'I', 'had', 'time'] }, { type: 'compose', words: ['I', 'would', 'help', 'you'] }, { type: 'compose', words: ['If', 'I', 'had', 'time', 'I', 'would', 'help', 'you'] }, { type: 'teach' }, { type: 'output', meaning: '如果她住在附近，她就会拜访我们', answer: 'If she lived nearby, she would visit us.' }] },
    { node: 'PB44', id: 'pb44-past-unreal-condition-v1', steps: [{ type: 'compose', words: ['If', 'I', 'had', 'known'] }, { type: 'compose', words: ['I', 'would', 'have', 'called', 'you'] }, { type: 'compose', words: ['If', 'I', 'had', 'known', 'I', 'would', 'have', 'called', 'you'] }, { type: 'teach' }, { type: 'output', meaning: '如果他们早点离开，就会赶上那班公交车', answer: 'If they had left earlier, they would have caught the bus.' }] },
    { node: 'PB45', id: 'pb45-direct-to-reported-v1', steps: [{ type: 'compose', words: ['I', 'am', 'tired'] }, { type: 'compose', words: ['She', 'says', 'that', 'she', 'is', 'tired'] }, { type: 'teach' }, { type: 'output', meaning: '他说自己已经准备好了', answer: 'He said that he was ready.' }] },
    { node: 'PB45', id: 'pb45-person-time-viewpoint-v1', steps: [{ type: 'compose', words: ['Amy', 'said', 'I', 'will', 'call', 'you', 'tomorrow'] }, { type: 'compose', words: ['Amy', 'told', 'Ben', 'that', 'she', 'would', 'call', 'him', 'the', 'next', 'day'] }, { type: 'teach' }, { type: 'output', meaning: 'Leo 告诉 Mia，他第二天会到达', answer: 'Leo told Mia that he would arrive the next day.' }] },
    { node: 'PB45', id: 'pb45-future-in-past-v1', steps: [{ type: 'compose', words: ['She', 'will', 'call'] }, { type: 'compose', words: ['She', 'said', 'that', 'she', 'would', 'call'] }, { type: 'teach' }, { type: 'output', meaning: '他说他稍后会到达', answer: 'He said that he would arrive later.' }] },
    { node: 'PB45', id: 'pb45-backshift-not-required-v1', steps: [{ type: 'compose', words: ['The', 'teacher', 'said', 'that', 'the', 'Earth', 'moves', 'around', 'the', 'sun'] }, { type: 'teach' }, { type: 'output', meaning: '我们的老师说植物需要水', answer: 'Our teacher said that plants need water.' }] },
    { node: 'PB46', id: 'pb46-supplement-vs-restrictive-v1', steps: [{ type: 'compose', words: ['My', 'brother', 'is', 'a', 'teacher'] }, { type: 'compose', words: ['My', 'brother', 'who', 'lives', 'in', 'Beijing', 'is', 'a', 'teacher'] }, { type: 'teach' }, { type: 'transform', activate: ',' }, { type: 'output', meaning: '我们的邻居（他在附近工作）是一位医生', answer: 'Our neighbor, who works nearby, is a doctor.' }] },
    { node: 'PB46', id: 'pb46-relative-forms-v1', steps: [{ type: 'compose', words: ['My', 'sister', 'who', 'works', 'here', 'lives', 'nearby'] }, { type: 'teach' }, { type: 'compose', words: ['The', 'museum', 'which', 'opened', 'recently', 'is', 'popular'] }, { type: 'output', meaning: '我们的导游（他会说法语）很友善', answer: 'Our guide, who speaks French, is kind.' }] },
    { node: 'PB46', id: 'pb46-comma-scope-v1', steps: [{ type: 'compose', words: ['The', 'library', 'which', 'opened', 'recently', 'is', 'still', 'popular'] }, { type: 'teach' }, { type: 'output', meaning: '咖啡馆（它最近开放）很安静', answer: 'The cafe, which opened recently, is quiet.' }] },
    { node: 'PB47', id: 'pb47-object-focus-v1', steps: [{ type: 'compose', words: ['Maya', 'called', 'Tom'] }, { type: 'compose', words: ['It', 'was', 'Tom', 'that', 'Maya', 'called'] }, { type: 'teach' }, { type: 'output', meaning: '强调我们找到的是钥匙', answer: 'It was the key that we found.' }] },
    { node: 'PB47', id: 'pb47-focus-contrast-v1', steps: [{ type: 'compose', words: ['Maya', 'called', 'Tom', 'yesterday'] }, { type: 'compose', words: ['It', 'was', 'yesterday', 'that', 'Maya', 'called', 'Tom'] }, { type: 'teach' }, { type: 'output', meaning: '强调会议是在星期五举行', answer: 'It was Friday that the meeting took place.' }] },
    { node: 'PB47', id: 'pb47-cleft-vs-ordinary-it-v1', steps: [{ type: 'compose', words: ['It', 'is', 'my', 'bag'] }, { type: 'compose', words: ['It', 'was', 'my', 'bag', 'that', 'we', 'found'] }, { type: 'teach' }, { type: 'output', meaning: '强调我们昨天找到的是那本书', answer: 'It was the book that we found yesterday.' }] },
    { node: 'PB48', id: 'pb48-so-neither-v1', steps: [{ type: 'compose', words: ['I', 'like', 'tea'] }, { type: 'compose', words: ['So', 'do', 'I'] }, { type: 'teach' }, { type: 'compose', words: [{ text: 'I', occurrence: 1 }, "don't", 'drink', 'coffee', 'Neither', 'does', 'Maya'] }, { type: 'output', meaning: '我也会游泳（简短回应）', answer: 'So can I.' }] },
    { node: 'PB48', id: 'pb48-tag-questions-v1', steps: [{ type: 'compose', words: ['You', 'are', 'ready'] }, { type: 'compose', words: ['You', 'are', 'ready', "aren't", 'you'] }, { type: 'teach' }, { type: 'compose', words: ['She', "doesn't", 'like', 'tea', 'does', 'she'] }, { type: 'output', meaning: '他们昨天去了公园，对吧？', answer: "They went to the park, didn't they?" }] },
    { node: 'PB48', id: 'pb48-negative-inversion-v1', steps: [{ type: 'compose', words: ['I', 'have', 'never', 'seen', 'snow'] }, { type: 'compose', words: ['Never', 'have', 'I', 'seen', 'such', 'beauty'] }, { type: 'teach' }, { type: 'compose', words: ['Rarely', 'do', 'we', 'see', 'such', 'beauty'] }, { type: 'output', meaning: '她从未见过如此安静的地方（强调）', answer: 'Never has she seen such a quiet place.' }] },
    { node: 'PB49', id: 'pb49-double-object-paths-v1', steps: [{ type: 'compose', words: ['Maya', 'gave', 'Leo', 'a', 'book'] }, { type: 'compose', words: ['Maya', 'gave', 'a', 'book', 'to', 'Leo'] }, { type: 'teach' }, { type: 'output', meaning: '我们的导游把一张地图给了我们', answer: 'Our guide gave us a map.' }] },
    { node: 'PB49', id: 'pb49-clause-paths-v1', steps: [{ type: 'compose', words: ['It', 'was', 'raining'] }, { type: 'compose', words: ['we', 'stayed', 'inside'] }, { type: 'compose', words: ['We', 'stayed', 'inside', 'because', 'it', 'was', 'raining'] }, { type: 'teach' }, { type: 'output', meaning: '因为很晚了，我们就回家了', answer: 'We went home because it was late.' }] },
    { node: 'PB49', id: 'pb49-self-correct-v1', steps: [{ type: 'compose', words: ['She', 'enjoys', 'reading', 'books'] }, { type: 'teach' }, { type: 'transform', activate: 'enjoy', choices: ['enjoys'] }, { type: 'output', meaning: '我的朋友们喜欢做饭', answer: 'My friends like cooking.' }] },
    { node: 'PB50', id: 'pb50-independent-delayed-retrieval-v1', steps: [{ type: 'compose', words: ['there', 'since', 'last', 'summer'] }, { type: 'compose', words: ['She', 'has', 'lived', 'there', 'since', 'last', 'summer'] }, { type: 'teach' }, { type: 'output', meaning: '我在这里工作三年了（现在仍在这里工作）', answer: 'I have worked here for three years.' }] },
  ];
  for (const lesson of lessons) await withBrowser({ width: 776, height: 932 }, async context => {
    const page = context.pages()[0]; page.setDefaultTimeout(8000);
    await page.goto(`${origin}/progressive-building-preview-v3.html?node=${lesson.node}&lesson=${lesson.id}`);
    await page.getByRole('heading').first().waitFor();
    for (const step of lesson.steps) {
      if (step.type === 'teach') await page.locator('#next').click();
      else if (step.type === 'compose') {
        if (step.wrongWords) {
          await chooseWords(page, step.wrongWords);
          if (step.wrongFeedback) await page.getByText(step.wrongFeedback, { exact: true }).waitFor();
          else await page.getByText('顺序还不对。按 Backspace 撤回后重拼。').waitFor();
          for (let index = 0; index < step.wrongWords.length; index++) await page.keyboard.press('Backspace');
        }
        await chooseWords(page, step.words);
      }
      else if (step.type === 'transform') {
        await page.getByRole('button', { name: step.activate, exact: true }).first().click();
        if (step.choices) {
          if (step.wrongChoices) {
            await chooseWords(page, step.wrongChoices);
            await page.getByText('这组词还没拼完整，重新选择。').waitFor();
          }
          await chooseWords(page, step.choices);
        }
      } else {
        await page.getByRole('heading', { name: step.meaning, exact: true }).waitFor();
        assert.equal(await page.locator('#trail').isHidden(), true);
        await page.getByLabel('输入英文句子').fill(step.answer);
        await page.getByRole('button', { name: '检查' }).click();
        await page.getByText(step.answer, { exact: true }).waitFor();
      }
    }
  });
}

async function pb50SupportAndDelayedReview(origin) {
  await withBrowser({ width: 360, height: 800 }, async context => {
    const page = context.pages()[0]; page.setDefaultTimeout(8000);
    await page.clock.install({ time: new Date('2026-01-01T00:00:00.000Z') });
    const chooseWords = async words => {
      for (const word of words) {
        const choices = page.locator('.schema-choice');
        const labels = await choices.allTextContents();
        const index = labels.findIndex(label => label.trim() === word);
        assert.notEqual(index, -1, `missing PB50 practice choice ${word}: ${await page.locator('#activity').innerText()}`);
        await choices.nth(index).click();
      }
    };
    const course = 'pb50-independent-delayed-retrieval-v1';
    await page.goto(`${origin}/progressive-building-preview-v3.html?node=PB50&lesson=${course}`);
    await chooseWords(['there', 'since', 'last', 'summer']);
    await chooseWords(['She', 'has', 'lived', 'there', 'since', 'last', 'summer']);
    await page.locator('#next').click();
    await page.getByRole('button', { name: '暂时不会' }).click();
    assert.match(await page.locator('#feedback').textContent(), /不是答错/);
    assert.equal(await page.locator('#next').isHidden(), true);
    const afterUnknown = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), 'chunk-practice:progressive-preview:v1');
    assert.equal(afterUnknown.sessions[course].run.attempts.at(-1).outcome, 'unknown');
    assert.equal(afterUnknown.sessions[course].run.attempts.at(-1).independent, false);
    assert.equal(await page.getByText('I have worked here for three years.', { exact: true }).count(), 0);
    await page.getByRole('button', { name: '提示' }).click();
    await page.getByText(/先判断这段经历是否延续到现在/).waitFor();
    await page.getByLabel('输入英文句子').fill('I have worked here for three years.');
    await page.getByLabel('输入英文句子').dispatchEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true });
    assert.equal(await page.locator('#next').isHidden(), true);
    await page.getByRole('button', { name: '检查' }).click();
    await page.getByText('有提示或反馈支持后完成', { exact: true }).waitFor();
    const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), 'chunk-practice:progressive-preview:v1');
    assert.equal(stored.sessions[course].run.attempts.at(-1).independent, false);
    const scheduled = stored.reviews[`${course}:pb50a-independent-now`];
    assert.equal(scheduled.assisted, true);
    assert.equal(scheduled.successfulIndependentReviews, 0);
    const browserNow = await page.evaluate(() => Date.now());
    assert.ok(Math.abs(scheduled.dueAt - browserNow - 86_400_000) < 1_000);
    await page.reload();
    await page.getByText('有提示或反馈支持后完成', { exact: true }).waitFor();
    await page.clock.fastForward(86_400_001);
    await page.locator('#review-entry').waitFor({ state: 'visible' });
    await page.locator('#review-entry').click();
    await page.getByLabel('输入英文句子').fill('I have worked here for three years.');
    await page.getByRole('button', { name: '检查' }).click();
    await page.getByText('复习完成', { exact: true }).waitFor();
    const afterReview = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), 'chunk-practice:progressive-preview:v1');
    const nextReview = afterReview.reviews[`${course}:pb50a-independent-now`];
    assert.equal(nextReview.assisted, false);
    assert.equal(nextReview.successfulIndependentReviews, 1);
    const reviewNow = await page.evaluate(() => Date.now());
    assert.ok(Math.abs(nextReview.dueAt - reviewNow - 86_400_000) < 1_000);
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scrollWidth <= dimensions.width, `PB50 mobile horizontal overflow: ${JSON.stringify(dimensions)}`);
  });
}

async function main() {
  const mode = process.argv[2] ?? '--smoke';
  if (!['--smoke', '--all', '--p50'].includes(mode)) throw new Error('Use --smoke, --all, or --p50');
  const { server, origin } = await startStaticServer();
  try {
    if (mode === '--p50') {
      await pb50SupportAndDelayedReview(origin);
      console.log('PB50 isolated support/review, mobile layout and IME composition checks passed.');
      return;
    }
    await smoke(origin);
    await deepLinkChecks(origin);
    await pb02Smoke(origin);
    await pb03ContrastSmoke(origin);
    await pb03OtherCoursesSmoke(origin);
    await pb04ModifierSmoke(origin);
    await pb05ArticleSmoke(origin);
    await pb05RemainingSmoke(origin);
    await pb06To15Smoke(origin);
    await pb16To50Smoke(origin);
    if (mode === '--all') await pb50SupportAndDelayedReview(origin);
    console.log(`PB01–PB50 ${mode === '--all' ? 'full isolated browser traversal and support/review boundaries' : 'isolated browser smoke'} passed; includes semantic chunk assembly, sentence roles, tense/aspect/voice, alternative structures, independent transfer and legacy regression.`);
  } finally { await new Promise(resolve => server.close(resolve)); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
