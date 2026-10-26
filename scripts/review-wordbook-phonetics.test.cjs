'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { classify, review } = require('./review-wordbook-phonetics.cjs');
assert.deepEqual(classify({ status: 'previously-source-verified' }), ['preserve-source-not-reverified']);
assert(classify({ word: 'a few', phonetic: '美 /eɪ fju/', method: 'phrase-citation-transcription' }).includes('article-strong-form-review'));
assert(!classify({ word: 'say', phonetic: '美 /seɪ/', method: 'dictionary-entry' }).includes('article-strong-form-review'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'phonetics-review-'));
const input = path.join(temp, 'input.json'), output = path.join(temp, 'review');
const source = JSON.stringify({ books: [{ bookId: 'fixture', title: 'fixture', total: 2, changes: [
  { itemId: 'one', word: 'whenever', phonetic: '美 /hwɛˈnɛvɝ/', status: 'pending-content-review', method: 'dictionary-entry' },
  { itemId: 'two', word: 'name', phonetic: '/neɪm/', status: 'previously-source-verified' }
] }] });
fs.writeFileSync(input, source);
assert.equal(review(input, output).proposals, 1);
assert.equal(fs.readFileSync(input, 'utf8'), source);
assert.throws(() => review(input, output), /new directory/);
assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'report.json'))).rows[1].proposal, null);
console.log('phonetics review tests passed; isolated fixture: ' + temp);
