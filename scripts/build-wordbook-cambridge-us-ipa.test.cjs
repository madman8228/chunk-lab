'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCambridgeUs, normalizeDisplay } = require('./build-wordbook-cambridge-us-ipa.cjs');

const pronunciation = (region, ipa, primary = true) =>
  `${primary ? '<span class="primary-pron">' : ''}<span data-pron-region="${region}" class="pron-info"><span class="pron">/<span class="ipa">${ipa}</span>/</span></span>${primary ? '</span>' : ''}`;

test('excludes phoneme lessons while preserving distinct whole-word readings', () => {
  const html = pronunciation('UK', 'haʊs') + pronunciation('US', 'haʊs') + pronunciation('US', 'haʊz') + pronunciation('US', 'haʊs') + pronunciation('US', 'h', false) + pronunciation('US', 'aʊ', false);
  assert.deepEqual(parseCambridgeUs(html), ['haʊs', 'haʊz']);
});

test('keeps Cambridge symbols and removes only syllable dots for display', () => {
  assert.deepEqual(parseCambridgeUs(pronunciation('US', 'ˈwɑː.t̬ɚ') + pronunciation('US', 't', false)), ['ˈwɑː.t̬ɚ']);
  assert.equal(normalizeDisplay('ˈwɑː.t̬ɚ'), '/ˈwɑːt̬ɚ/');
});
