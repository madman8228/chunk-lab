import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { fingerprint, composePrompt, parseBatch, appendBatch, importDifference } from './model.mjs';
const require = createRequire(import.meta.url), draftModel = require('../../js/wordbook-draft.js'), engine = require('../../landing/sentence-cloze-engine.js');
const deps = { draftModel, engine };
const empty = () => ({ schemaVersion: 1, book: { bookId: 'book-' + randomUUID(), title: '', catalog: { facets: {} }, units: [] }, items: [] });
const context = async draft => ({ requestId: randomUUID(), baseFingerprint: await fingerprint(draft), settings: { level: 'A1', batchCount: 5 }, source: '' });
const batch = ctx => ({ format: 'wordbook-ai-batch', version: 1, requestId: ctx.requestId, baseFingerprint: ctx.baseFingerprint, title: '零基础单词本', unitTitle: '身边物品', items: [{ word: 'book', meaning: '书', scene: '介绍一本书。', translation: '这是一本书。', sentence: 'This is a [book].' }] });

test('same-course import reports added, changed and removed identities without mutating drafts',()=>{
 const old={book:{bookId:'same',units:[{unitId:'u',title:'old'}]},items:[{itemId:'a',word:'bag'},{itemId:'b',word:'book'}]};
 const next={book:{bookId:'same',units:[{unitId:'u',title:'old'},{unitId:'v',title:'new'}]},items:[{itemId:'a',word:'bag changed'},{itemId:'c',word:'pen'}]};
 const before=JSON.stringify([old,next]),summary=importDifference(old,next);
 assert.match(summary,/单元：新增 1，变更 0，移除 0/);
 assert.match(summary,/词条：新增 1，变更 1，移除 1/);
 assert.equal(importDifference(old,{...next,book:{...next.book,bookId:'other'}}),'');
 assert.equal(JSON.stringify([old,next]),before);
});

test('external prompt asks choices only, carries accepted context and does not request technical input', async () => {
  const draft = empty(), ctx = await context(draft), prompt = composePrompt(ctx, draft);
  assert.match(prompt, /每轮只问一道选择题/); assert.match(prompt, /按推荐继续/); assert.match(prompt, /不得要求用户填写/);
  assert.match(prompt, /不得编造图片路径/); assert.ok(prompt.includes(ctx.requestId));
});

test('review and append are immutable; missing illustrations cannot bypass publishing', async () => {
  const draft = empty(), before = JSON.stringify(draft), ctx = await context(draft);
  const review = parseBatch('```json\n' + JSON.stringify(batch(ctx)) + '\n```', ctx, draft, deps);
  assert.equal(review.ok, true);
  const next = appendBatch(draft, review, randomUUID, draftModel);
  assert.equal(JSON.stringify(draft), before); assert.equal(next.items.length, 1);
  assert.deepEqual(draftModel.validate(next, { requireImages: false }), []);
  await assert.rejects(draftModel.compile(next), /插画/);
  const nextCtx = await context(next), duplicate = batch(nextCtx);
  assert.equal(parseBatch(JSON.stringify(duplicate), nextCtx, next, deps).ok, false);
  assert.match(composePrompt(nextCtx, next), /只生成新的单元/);
});

test('old round, extra fields, oversize batches, invalid blanks and wrong target are refused before append', async () => {
  const draft = empty(), ctx = await context(draft);
  assert.equal(parseBatch('', ctx, draft, deps).ok, false);
  for (const change of [
    value => { value.requestId = 'old'; },
    value => { value.baseFingerprint = 'stale'; },
    value => { value.extra = 'untrusted'; },
    value => { value.items = Array(6).fill(value.items[0]); },
    value => { value.items[0].sentence = 'This is a book.'; },
    value => { value.items[0].sentence = '[This] is a book.'; },
    value => { value.items[0].word = '<script>'; }
  ]) { const value = batch(ctx); change(value); assert.equal(parseBatch(JSON.stringify(value), ctx, draft, deps).ok, false); }
  assert.equal(parseBatch(JSON.stringify(batch(ctx)), null, draft, deps).ok, false);
});
