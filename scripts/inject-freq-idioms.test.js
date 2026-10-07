'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const target = path.resolve(__dirname, '../freq-idioms.js');
const original = fs.readFileSync(target);
const { validateItems, fnv8 } = require('./inject-freq-idioms');
function item(chunks) {
  const sentence = chunks.join(' ');
  return { sentence, cid: fnv8(sentence), translation: '你好。我们走吧。', chunks,
    hints: chunks.map(() => '提示'),
    grammar: chunks.map(() => ({ role: '句子', color: 'blue', pos: '句子', meaning: '意思', phonetic: ['test'] })),
    explanations: ['说明一', '说明二'] };
}
assert.deepEqual(validateItems([item(['Hello.', 'Let us go.'])]), []);
assert.deepEqual(validateItems([item(['Hello!', '"Let us go."'])]), []);
assert.ok(validateItems([item(['Hello.', 'let us go.'])]).some(x => x.includes('非末句末标点')));
assert.ok(validateItems([item(['Hello', '. Let us go.'])]).some(x => x.includes('前导标点')));
const wrongCid = item(['Hello.', 'Let us go.']);
wrongCid.cid = 'bad-cid';
assert.ok(validateItems([wrongCid]).some(x => x.includes('cid ≠')));
assert.equal(wrongCid.cid, 'bad-cid', 'validation cannot rewrite source identifiers');
assert.deepEqual(fs.readFileSync(target), original, 'import and validation cannot change course assets');
console.log('frequency injection validation: sentence boundaries, invalid input and original preservation passed');
