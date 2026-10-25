import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateExpressionPackage } from './validate.mjs';
import { normalizeAnswer, evaluateActivity } from './evaluate.mjs';
import { createExpressionState, transitionExpression, publicExpressionState } from './runtime.mjs';
import { renderActivity } from './ui/renderers.mjs';
import { nextReview } from './schedule.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/L001-like.reference.json'), 'utf8'));
const pkg = { format: 'chunklab-expression-course', formatVersion: '1.0', courseId: 'expression-like', title: '表达喜欢', description: '表达自己喜欢的事物', audience: 'adult_beginner',
  lessons: [sample], assets: [{ assetId: 'l001_coffee', mimeType: 'audio/mpeg', sha256: 'a'.repeat(64), size: 4, localFile: 'coffee.mp3' }, { assetId: 'l001_tea', mimeType: 'audio/mpeg', sha256: 'b'.repeat(64), size: 4, localFile: 'tea.mp3' }],
  reviewActivities: [{ lessonId: 'L001', skillId: 'express_like', activityId: 'L001_A08' }, { lessonId: 'L001', skillId: 'express_like', activityId: 'L001_A09' }] };

test('accepts the reference lesson and blocks missing playable audio on publish', () => {
  assert.equal(validateExpressionPackage(pkg).valid, true);
  assert.equal(validateExpressionPackage(pkg, { forPublish: true }).valid, false);
  const ready = structuredClone(pkg); ready.lessons[0].audioAssets.forEach(item => { item.status = 'ready'; });
  assert.equal(validateExpressionPackage(ready, { forPublish: true, availableAssets: ['l001_coffee', 'l001_tea'] }).valid, true);
});

test('supports all seven activity types with safe server-side evaluation', () => {
  assert.equal(evaluateActivity({ type: 'sentence_build', payload: { correctTokens: ['I', 'like', 'tea'] } }, { tokens: ['I', 'like', 'tea'] }).correct, true);
  assert.equal(evaluateActivity({ type: 'substitution', evaluation: { acceptedAnswers: ['I like tea.'] } }, { text: 'I LIKE TEA' }).correct, true);
  assert.equal(evaluateActivity({ type: 'listening_choice', evaluation: { correctOptionId: 'tea' } }, { optionId: 'tea' }).correct, true);
  assert.equal(evaluateActivity({ type: 'transfer_test', evaluation: { acceptedAnswers: ['I like milk.'] } }, { text: 'I like milk.' }).correct, true);
});

test('rejects remote asset paths and malformed activity arrays without throwing', () => {
  const remote = structuredClone(pkg); remote.assets[0].localFile = 'https://example.com/a.mp3';
  assert.equal(validateExpressionPackage(remote).valid, false);
  const malformed = structuredClone(pkg); malformed.lessons[0].activities = 'not-an-array';
  assert.equal(validateExpressionPackage(malformed).valid, false);
});

test('AI can describe audio placeholders without inventing file hashes', () => {
  const generated = structuredClone(pkg);
  generated.assets.forEach(asset => { delete asset.sha256; delete asset.size; });
  assert.equal(validateExpressionPackage(generated).valid, true);
  assert.equal(validateExpressionPackage(generated, { forPublish: true }).valid, false);
});

test('answer normalization handles typographic apostrophes and punctuation', () => {
  assert.equal(normalizeAnswer('  I DON’T like tea! '), "i don't like tea");
  assert.equal(evaluateActivity({ type: 'independent_output', evaluation: { acceptedAnswers: ["I don't like tea."] } }, { text: 'I do not like tea.' }).correct, false);
});

test('continues informational activities without scoring them', () => {
  const state = createExpressionState(sample);
  const moved = transitionExpression(state, { type: 'continue' });
  assert.equal(moved.result.correct, null);
  assert.equal(moved.state.index, 1);
});

test('sound demonstrations continue without creating correctness or mastery evidence', () => {
  const lesson = { schemaVersion: '1.1', lessonId: 'L101', activities: [{ id: 'sound1', type: 'sound_demo', stage: 'guided',
    prompt: '听示范', skillIds: ['sound'], payload: { segments: [] }, evaluation: { countsTowardMastery: false } }] };
  const next = transitionExpression(createExpressionState(lesson), { type: 'continue' });
  assert.equal(next.result.kind, 'continued');
  assert.equal(next.result.correct, null);
  assert.deepEqual(next.state.evidence, {});
});

test('skipping written output advances without recording independent evidence', () => {
  const state = createExpressionState(sample);
  state.index = sample.activities.findIndex(activity => activity.type === 'independent_output');
  const skipped = transitionExpression(state, { type: 'skip_output' });
  assert.equal(skipped.result.evidenceRecorded, false);
  assert.equal(skipped.state.index, state.index + 1);
  assert.deepEqual(skipped.state.evidence, {});
  assert.throws(() => transitionExpression(createExpressionState(sample), { type: 'skip_output' }), /不能跳过文字输出/);
});

test('answer exposure prevents independent mastery after a correct retry', () => {
  let state = createExpressionState(sample);
  state.index = 7;
  state = transitionExpression(state, { type: 'reveal' }).state;
  const first = transitionExpression(state, { type: 'submit', response: { text: 'I like tea.' } });
  assert.equal(first.result.correct, true);
  assert.equal(first.result.independent, false);
  assert.equal(first.result.masteredSkills.length, 0);
});

test('public state does not expose answer keys', () => {
  const state = createExpressionState(sample);
  const activity = publicExpressionState(state).activity;
  assert.equal(activity.evaluation, undefined);
  assert.equal(activity.payload.correctTokens, undefined);
  state.index = 1;
  const buildActivity = publicExpressionState(state).activity;
  assert.equal(buildActivity.payload.expectedTokenCount, 3);
  assert.equal(buildActivity.payload.correctTokens, undefined);
  state.index = 3;
  const substitution = publicExpressionState(state).activity;
  assert.equal(substitution.payload.expectedWordCount, 3);
  assert.equal(substitution.evaluation, undefined);
  state.index = sample.activities.findIndex(item => item.type === 'independent_output');
  assert.equal(publicExpressionState(state).activity.payload.expectedWordCount, 3);
  state.index = sample.activities.findIndex(item => item.type === 'transfer_test');
  assert.equal(publicExpressionState(state).activity.payload.expectedWordCount, 3);
});

test('sentence building auto-submits exactly once when the required chunk count is reached', () => {
  const previousDocument = globalThis.document;
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.listeners = {}; this.disabled = false; this.dataset = {}; }
    setAttribute(name, value) { this[name === 'class' ? 'className' : name] = value; }
    removeAttribute(name) { delete this[name]; }
    addEventListener(name, listener) { this.listeners[name] = listener; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    focus() {}
    querySelectorAll(selector) {
      const matches = [];
      const visit = node => { for (const child of node.children) { if (selector === 'button' && child.tagName === 'button') matches.push(child); visit(child); } };
      visit(this);
      return matches;
    }
    click() { if (!this.disabled) this.listeners.click?.(); }
  }
  globalThis.document = { createElement: tag => new Element(tag) };
  try {
    const root = new Element('main'), actions = [];
    const rendered = renderActivity(root, { type: 'sentence_build', prompt: '排列词块', payload: {
      availableTokens: ['tea', 'I', 'like', 'today'], expectedTokenCount: 3
    } }, { onAction: action => { actions.push(action); return 'success'; } });
    const selection = root.children.find(node => node.className.includes('expression-chunk-selection'));
    const selectedRow = selection.children.find(node => node.className.includes('token-row-selected'));
    assert.equal(selectedRow.children.length, 0, 'an empty selected row has no redundant visible instruction');
    const tokenIds = { I: 'activity:1', like: 'activity:2', tea: 'activity:0' };
    assert.equal(rendered.autoSubmit, true);
    const choose = text => selection.getButton(tokenIds[text]).click();
    const duplicateRoot = new Element('main');
    renderActivity(duplicateRoot, { type: 'sentence_build', id: 'duplicate', payload: {
      availableTokens: ['I', 'I', 'like'], expectedTokenCount: 2
    } }, { onAction: () => 'success' });
    const duplicateSelection = duplicateRoot.children.find(node => node.className.includes('expression-chunk-selection'));
    assert.notEqual(duplicateSelection.getButton('duplicate:0')['aria-label'], duplicateSelection.getButton('duplicate:1')['aria-label'],
      'repeated text has distinct accessible names');
    choose('I');
    choose('like');
    assert.equal(actions.length, 0, 'partial answers are not submitted');
    choose('tea');
    assert.equal(actions.length, 1, 'the final required chunk triggers one submission');
    assert.deepEqual(actions[0], { type: 'submit', response: { tokens: ['I', 'like', 'tea'] } });
    assert.equal(Object.values(tokenIds).every(id => selection.getButton(id).disabled), true, 'extra choices cannot trigger duplicate submissions');
    const outputRoot = new Element('main'), outputActions = [];
    const substitutionRoot = new Element('main');
    const substitution = renderActivity(substitutionRoot, { type: 'substitution', prompt: '换成茶', payload: { expectedWordCount: 3 } });
    const wordSlots = substitutionRoot.children.find(node => node.className === 'word-slots');
    assert.equal(wordSlots.children.length, 3, 'fixed substitution word count renders the configured number of underlined inputs');
    wordSlots.children[0].value = 'I'; wordSlots.children[1].value = 'like'; wordSlots.children[2].value = 'tea';
    assert.equal(substitution.response().text, 'I like tea', 'word slots submit through the existing text-answer contract');
    const independentOutput = renderActivity(outputRoot, { type: 'independent_output', prompt: '用英文回应', payload: { scenario: '打招呼', expectedWordCount: 3 } },
      { onAction: action => outputActions.push(action) });
    const outputSlots = outputRoot.children.find(node => node.className === 'word-slots');
    assert.equal(outputSlots.children.length, 3, 'independent output uses fixed underlined word slots too');
    outputSlots.children[0].value = 'I'; outputSlots.children[1].value = 'like'; outputSlots.children[2].value = 'tea';
    assert.equal(independentOutput.response().text, 'I like tea');
    const transferRoot = new Element('main');
    renderActivity(transferRoot, { type: 'transfer_test', prompt: '迁移表达', payload: { expectedWordCount: 3 } });
    assert.equal(transferRoot.children.find(node => node.className === 'word-slots').children.length, 3,
      'transfer output also uses fixed underlined word slots');
    const controls = outputRoot.children.find(node => node.className === 'activity-tools');
    const skip = controls.children.find(node => node.textContent === '暂时跳过');
    assert.ok(skip, 'written output has an explicit skip path');
    skip.click();
    assert.deepEqual(outputActions, [{ type: 'skip_output' }]);
    const legacy = renderActivity(new Element('main'), { type: 'sentence_build', payload: { availableTokens: ['I', 'like', 'tea'] } }, { onAction() {} });
    assert.equal(legacy.autoSubmit, false, 'older servers retain a usable manual-submit fallback until they restart');
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('revealed answers are visible and recoverable only after reveal, then clear on advance', () => {
  const state = createExpressionState(sample);
  state.index = 3;
  assert.equal(publicExpressionState(state).revealedAnswer, null);
  const revealed = transitionExpression(state, { type: 'reveal' }).state;
  assert.equal(publicExpressionState(revealed).revealedAnswer, 'I like tea.');
  const resumed = createExpressionState(sample, revealed);
  assert.equal(publicExpressionState(resumed).revealedAnswer, 'I like tea.');
  const advanced = transitionExpression(resumed, { type: 'submit', response: { text: 'I like tea.' } }).state;
  assert.equal(publicExpressionState(advanced).revealedAnswer, null);
});

test('review intervals use injected time and reset after failure', () => {
  const now = 1000;
  assert.deepEqual(nextReview({ success: true, step: 0, now }), { step: 1, dueAt: now + 3 * 86400000, intervalDays: 3 });
  assert.deepEqual(nextReview({ success: false, step: 4, now }), { step: 0, dueAt: now + 86400000, intervalDays: 1 });
});

test('v1.1 self-practice reveals the model only on request and never creates mastery evidence', () => {
  const lesson = { schemaVersion: '1.1', lessonId: 'L101', activities: [{ id: 'speak1', type: 'speaking_practice',
    stage: 'guided', prompt: '跟读', skillIds: ['say-hi'], payload: { scenario: '初次见面', referenceText: 'Hello.', audioAssetId: 'hello',
      questionKind: 'sound' }, evaluation: { countsTowardMastery: false } }] };
  let state = createExpressionState(lesson);
  assert.equal(publicExpressionState(state).activity.payload.referenceText, undefined);
  state = transitionExpression(state, { type: 'reveal' }).state;
  assert.equal(publicExpressionState(state).activity.payload.referenceText, 'Hello.');
  const practiced = transitionExpression(state, { type: 'self_practiced' });
  assert.deepEqual(practiced.result, { kind: 'practice', correct: null, evidenceRecorded: false, selfReported: true, completed: true });
  assert.deepEqual(practiced.state.evidence, {});
  assert.equal(practiced.state.activityEvidence.speak1.selfReported, true);
  assert.deepEqual(practiced.result.masteredSkills, undefined);
});

test('speaking practice hides and does not play its model until reveal is requested', () => {
  const previousDocument = globalThis.document;
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.listeners = {}; }
    setAttribute(name, value) { this[name] = value; }
    addEventListener(name, listener) { this.listeners[name] = listener; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    click() { this.listeners.click?.(); }
  }
  globalThis.document = { createElement: tag => new Element(tag) };
  try {
    const actions = [], playCalls = [], root = new Element('main');
    const first = renderActivity(root, { type: 'speaking_practice', prompt: '练习', payload: { scenario: '见面', audioAssetId: 'hello' } },
      { onAction: action => actions.push(action), playAudio: id => playCalls.push(id) });
    assert.equal(root.children.some(item => item.textContent === '显示示范'), true);
    assert.equal(root.children.some(item => item.textContent === '播放示范'), false);
    root.children.find(item => item.textContent === '显示示范').click();
    assert.deepEqual(actions, [{ type: 'reveal' }]);
    const revealedRoot = new Element('main');
    renderActivity(revealedRoot, { type: 'speaking_practice', prompt: '练习', payload: { scenario: '见面', audioAssetId: 'hello', referenceText: 'Hello.' } },
      { onAction: action => actions.push(action), playAudio: id => playCalls.push(id) });
    revealedRoot.children.find(item => item.textContent === '播放示范').click();
    assert.deepEqual(playCalls, ['hello']);
    assert.equal(first.speakingPractice, true);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('micro explanations render the rule and English-Chinese contrasts', () => {
  const previousDocument = globalThis.document;
  class Element { constructor(tag) { this.tagName = tag; this.children = []; this.textContent = ''; } setAttribute() {} append(...nodes) { this.children.push(...nodes); } replaceChildren(...nodes) { this.children = nodes; } }
  globalThis.document = { createElement: tag => new Element(tag) };
  try {
    const root = new Element('main');
    renderActivity(root, { type: 'micro_explanation', prompt: '规则', payload: { ruleText: 'My name is 后面接名字。', contrasts: [
      { en: 'I am Chen.', zh: '我是小陈。' }, { en: 'My name is Chen.', zh: '我的名字是小陈。' }
    ] } }, { preview: true });
    const text = root.children.map(item => item.textContent).join('\n');
    assert.match(text, /My name is 后面接名字/);
    assert.match(text, /I am Chen\. · 我是小陈/);
    assert.match(text, /My name is Chen\. · 我的名字是小陈/);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
