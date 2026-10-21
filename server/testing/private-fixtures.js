'use strict';
const fs = require('node:fs');
const path = require('node:path');

/* Public CI checks out code only; private course assets/drafts are not present.
 * Content-dependent server tests must skip explicitly instead of failing ENOENT. */
function skipUnless(relativePath, label) {
  const target = path.resolve(__dirname, '..', '..', relativePath);
  if (!fs.existsSync(target)) {
    console.log('SKIP: ' + label + ' (' + relativePath + ' is not present in this checkout)');
    process.exit(0);
  }
}

module.exports = { skipUnless };
