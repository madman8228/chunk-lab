'use strict';
const fs = require('node:fs');
const path = require('node:path');

/* Public CI checks out code only; private course assets/drafts are not present.
 * A missing private fixture is NOT a pass. Report NOT-RUN separately; a private
 * content job can set TEST_REQUIRE_PRIVATE=1 to turn it into a hard failure. */
function skipUnless(relativePath, label) {
  const target = path.resolve(__dirname, '..', '..', relativePath);
  if (!fs.existsSync(target)) {
    console.log('[NOT-RUN] ' + label + ' (' + relativePath + ' is not present in this checkout)');
    process.exit(process.env.TEST_REQUIRE_PRIVATE === '1' ? 2 : 0);
  }
}

module.exports = { skipUnless };
