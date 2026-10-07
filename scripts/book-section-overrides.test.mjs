import assert from 'node:assert/strict';
import fs from 'node:fs';
import { translationOverrideEntries } from './book-section.mjs';
assert.deepEqual([...translationOverrideEntries({ 'Hello!': ' 你好 ', 'hello.': '你好' })], [['hello', '你好']]);
for (const value of [null, [], { '': '中文' }, { Hello: '' }, { Hello: 1 }, { 'Hello!': '你好', 'hello.': '您好' }]) {
  assert.throws(() => translationOverrideEntries(value));
}
const actual = JSON.parse(fs.readFileSync(new URL('../extra/oral-book/translation-overrides.json', import.meta.url), 'utf8'));
assert.ok(translationOverrideEntries(actual).size > 0);
console.log('book translations: explicit revisions valid; empty values and normalized conflicts rejected');
