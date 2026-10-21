import assert from 'node:assert/strict';
import fs from 'node:fs';
import { projectNativeBatch } from './native-course-session.mjs';
const identity = { deckId: 'original', generationScope: 'course:original', resumeIdentity: 'original' };
const source = { recordIdentity: identity, cursor: 10, nextCursor: 20, contentType: 'sentence', items: [{ cid: 'original-item', sentence: 'Hello world.', chunks: ['Hello', 'world.'], hints: ['你好', '世界'], explain: 'Keep explanation', alts: [['Hi'], []] }],
  learning: { modes: ['typing', 'chunkSelection'], defaultMode: 'typing' } };
const original = JSON.stringify(source), deck = projectNativeBatch(source, 'Original', 30);
assert.equal(deck.id, 'original'); assert.equal(deck.statsDeckId, 'original');
assert.deepEqual(deck.items, source.items); assert.deepEqual(deck._sourceIndices, [10]);
assert.equal(deck._contentBatch.remainingCount, 19); assert.equal(deck._contentBatch.startCursor, 10);
assert.equal(deck.authoring.template, 'sentence-practice');
deck.items[0].sentence = 'mutated'; assert.equal(JSON.stringify(source), original);
const image = projectNativeBatch({ ...source, contentType: 'image-text', nextCursor: null, items: [{ id: 'line', text: { en: 'Hello world.', 'zh-CN': '你好世界。' }, imageAssetId: 'pic',
  chunks: { items: [{ id: 'last', text: 'world.' }, { id: 'first', text: 'Hello ' }], correctOrder: ['first', 'last'], distractors: [{ id: 'd', text: 'other' }] } }] }, 'Image', 11);
assert.deepEqual(image.items[0].chunks, ['Hello', 'world.']); assert.equal(image.items[0].translation, '你好世界。'); assert.equal(image.items[0].imageAssetId, 'pic');
assert.equal(image.authoring.contentForm, 'article'); assert.equal(image._contentBatch.done, true);
assert.throws(() => projectNativeBatch({ ...source, recordIdentity: {} }, 'Bad', 1), /CONTENT_IDENTITY_INVALID/);
// Parse inline scripts without executing browser initialization or touching application storage.
const html = fs.readFileSync(new URL('../../main.html', import.meta.url), 'utf8');
for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new Function(match[1]);
assert.doesNotMatch(fs.readFileSync(new URL('../../scripts/membership-browser-entry.mjs', import.meta.url), 'utf8'), /study-view|assessment-view|mountBrowserCourse/);
console.log('native course projection: original identities/fields, image chunk order, bounded batch cursor, one renderer export and main script syntax passed');
