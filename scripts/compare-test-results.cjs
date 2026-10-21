'use strict';
/* Compare two test-result JSON files by test id. Used to separate a cleanup
 * regression from a pre-existing browser failure in the same CI environment.
 *
 * Usage:
 *   node scripts/compare-test-results.cjs <baseline.json> <current.json>
 * Accepts either a bare results array or an object with .results. */
const fs = require('node:fs');

function failIds(file) {
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = Array.isArray(payload) ? payload : payload.results || [];
  return new Set(rows.filter((row) => row && row.code !== 0 && row.id).map((row) => row.id));
}

const [baselineFile, currentFile] = process.argv.slice(2);
if (!baselineFile || !currentFile) {
  console.error('usage: node scripts/compare-test-results.cjs <baseline.json> <current.json>');
  process.exit(2);
}
const before = failIds(baselineFile);
const after = failIds(currentFile);
const added = [...after].filter((id) => !before.has(id)).sort();
const fixed = [...before].filter((id) => !after.has(id)).sort();
console.log('baseline failures: ' + before.size);
console.log('current failures:  ' + after.size);
console.log('new failures:      ' + added.length);
added.forEach((id) => console.log('  + ' + id));
console.log('fixed failures:    ' + fixed.length);
fixed.forEach((id) => console.log('  - ' + id));
