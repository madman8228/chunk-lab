import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../main.html', import.meta.url), 'utf8');
assert.match(html, /\.home-body\{display:grid;grid-template-columns:minmax\(0,1fr\);/);
assert.doesNotMatch(html, /\.home-body\{grid-template-columns:minmax\(0,1fr\) 320px/);
assert.doesNotMatch(html, /\.home-rail\{grid-column:2/);
assert.match(html, /right:max\(150px,calc\(\(100vw - 1240px\)\/2 \+ 200px\)\)/);
// At desktop widths, the sun stays at least 200px from the content's right
// edge, rather than drifting into the right-aligned navigation on wide screens.
for (const width of [768, 963, 1080, 1240, 1845, 2560, 3840]) {
  const right = Math.max(150, (width - 1240) / 2 + 200);
  const contentRight = Math.max(0, (width - 1240) / 2);
  assert.ok(right - contentRight >= 150, `navigation clearance at ${width}px`);
}
console.log('Home CSS regression: single column and content-relative sun positioning passed.');
