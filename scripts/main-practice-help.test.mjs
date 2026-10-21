import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../main.html', import.meta.url), 'utf8');
const bar = html.match(/<div class="stage-tip-bar" id="stageTipBar">([\s\S]*?)<\/div>/)[1];
for (const action of ['hint', 'reveal', 'full']) {
  assert.match(bar, new RegExp(`<button[^>]*class="kbd kbd-action"[^>]*data-action="${action}"`));
}
assert.doesNotMatch(html, /\.stage-tip-bar\s*\{[^}]*display\s*:\s*none/);
assert.match(html, /@media \(max-width:840px\)\{\s*\.stage-tip-bar \.keyboard-only\{display:none !important\}/);
assert.doesNotMatch(html, /\.stage-tip-bar \.practice-help-action/);
assert.match(html, /if\(act==='hint'\) hintFirst\(\)/);
console.log('practice help: three permanent actions; only keyboard labels hide on narrow screens');
