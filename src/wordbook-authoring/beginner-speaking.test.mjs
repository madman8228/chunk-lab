import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createBeginnerSpeakingDraft, beginnerSourceMapping, courseSources } from './beginner-speaking.mjs';
import draftModel from '../../js/wordbook-draft.js';
import engine from '../../landing/sentence-cloze-engine.js';

if (!fs.existsSync(new URL('../../output/course-drafts/beginner-speaking-pilot/lesson-1.json', import.meta.url))) {
  console.log('SKIP: beginner-speaking draft fixture is not present in this checkout (local output/ artifact)');
  process.exit(0);
}

const draft = createBeginnerSpeakingDraft(), mapping = beginnerSourceMapping();
assert.deepEqual(draftModel.validate(draft, { requireImages: false }), []);
assert.ok(draftModel.validate(draft).some(message => message.includes('插画')), 'text-only review draft cannot pass illustrated publishing checks');
assert.equal(draft.items.length, 22);
assert.equal(new Set(draft.items.map(item => item.word)).size, 22);
assert.ok(!draft.items.some(item => item.word === 'hello'), 'an explanation alternative is not presented as a main course vocabulary word');
assert.deepEqual(draft.book.relatedCourseIds, courseSources.map(source => source.resourceId));
for (const [index, item] of draft.items.entries()) {
  const source = mapping[index], course = JSON.parse(fs.readFileSync(new URL('../../' + source.sourceFile, import.meta.url), 'utf8'));
  assert.equal(engine.sentence(item.exercise), course.items[source.sourceLine - 1].en, item.word);
  assert.equal(item.translation, course.items[source.sourceLine - 1].zh, item.word);
  assert.deepEqual(item.images, { wide: [], mobile: [] });
  assert.ok(source.sourceContentId.endsWith(':line:' + String(source.sourceLine).padStart(3, '0')));
}
for (const [word, answer] of [['key', 'keys'], ['shoe', 'shoes']]) {
  const item = draft.items.find(item => item.word === word);
  assert.equal(engine.evaluate(item.exercise, { blank1: answer }).correct, true);
  assert.equal(engine.evaluate(item.exercise, { blank1: word }).correct, false);
  assert.match(engine.evaluate(item.exercise, { blank1: word }).fields[0].message, /复数/);
}
const thanks = draft.items.find(item => item.word === 'thanks');
for (const answer of ['thanks', 'thank you']) assert.equal(engine.evaluate(thanks.exercise, { blank1: answer }).correct, true);
const hi = draft.items.find(item => item.word === 'hi');
for (const answer of ['Hi', 'Hello']) assert.equal(engine.evaluate(hi.exercise, { blank1: answer }).correct, true);
const compiled = await draftModel.compile(draft, { requireImages: false });
assert.equal(compiled.published, false);
assert.deepEqual(compiled.index.books[0].relatedCourseIds, draft.book.relatedCourseIds);
const modified = createBeginnerSpeakingDraft(); modified.items[0].word = 'changed';
assert.equal(createBeginnerSpeakingDraft().items[0].word, 'hi', 'each generated draft is independent');
console.log('Beginner wordbook: 22 unique words, exact course-source mapping, translations, plural blanks, legitimate alternatives, text-only validation and independent draft creation passed.');
