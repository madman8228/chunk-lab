'use strict';

const assert = require('assert');
const deps = require('./lib-deps.js');

assert.strictEqual(deps.resolveSpecifier('../shared.mjs', 'src/main/app.mjs'), 'src/shared.mjs');
assert.strictEqual(deps.resolveSpecifier('../../../outside.mjs', 'src/main/app.mjs'), null);
assert.strictEqual(deps.normalizeRef('../manifest.json', 'pages/index.html'), 'manifest.json');
assert.strictEqual(deps.normalizeRef('../../../outside.js', 'pages/index.html'), null);
assert.strictEqual(deps.normalizeRef("' + escX(src) + '", 'main.html'), null,
  'concatenated inline-script attributes are not static deployment references');
assert.strictEqual(deps.normalizeRef('assets/missing-cover.svg', 'main.html'), 'assets/missing-cover.svg',
  'a normal static reference remains eligible for missing-file detection');
assert.strictEqual(deps.normalizeRef('assets/lesson+cover.svg', 'main.html'), 'assets/lesson+cover.svg',
  'valid plus characters in a static path remain supported');

console.log('[lib-deps] parent-path and root-boundary regression passed');
