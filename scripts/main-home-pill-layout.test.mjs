import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../main.html', import.meta.url), 'utf8');
const narrow = html.slice(html.indexOf('@media (max-width:640px){\n  .home-today-counts'), html.indexOf('@media (max-width:420px){\n  .home-today-counts'));
assert.match(narrow, /\.home-pill \.pill-n\{position:static;transform:none;line-height:1\.2\}/);
assert.match(narrow, /\.home-pill\{justify-content:center;gap:4px;min-height:60px\}/);
console.log('home pill narrow layout: labels and numbers use separate flow rows through 640px');
