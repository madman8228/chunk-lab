'use strict';

const assert = require('assert');
const deps = require('./lib-deps.js');

assert.strictEqual(deps.resolveSpecifier('../shared.mjs', 'src/main/app.mjs'), 'src/shared.mjs');
assert.strictEqual(deps.resolveSpecifier('../../../outside.mjs', 'src/main/app.mjs'), null);
assert.strictEqual(deps.normalizeRef('../manifest.json', 'pages/index.html'), 'manifest.json');
assert.strictEqual(deps.normalizeRef('../../../outside.js', 'pages/index.html'), null);

console.log('[lib-deps] parent-path and root-boundary regression passed');
