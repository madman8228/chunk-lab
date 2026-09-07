const fs = require('fs');
const path = require('path');
const all = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'extra', 'idioms-394.json'), 'utf8'));
const win = {};
new Function('window', fs.readFileSync(path.join(__dirname, '..', 'freq-idioms.js'), 'utf8'))(win);
const data = win.DATA_FREQ_IDIOMS || [];
const used = new Set();
data.forEach(it => {
  const s = it.sentence.replace(/[.,!?;:"\u201c\u201d\u2018\u2019]/g, ' ').toLowerCase();
  const sorted = [...all].sort((a, b) => b.length - a.length);
  for (const ph of sorted) {
    const esc = ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    if (new RegExp('\\b' + esc + '\\b').test(s)) {
      used.add(ph.toLowerCase());
      break;
    }
  }
});

const remaining = all.filter(x => !used.has(x.toLowerCase()));
console.log('remaining:', remaining.length);

const NOISE = new Set(['\u9f13\u52b1', 'wait', 'second', 'apologies', 'flattered', 'use to', 'stop him', 'what out', 'who wants']);

function shortScore(s) {
  if (NOISE.has(s.toLowerCase())) return 9999 + s.length;
  return s.length;
}
const sorted = [...remaining].sort((a, b) => shortScore(a) - shortScore(b) || a.localeCompare(b));
console.log('--- TOP 100 (chars shortest first) ---');
sorted.slice(0, 100).forEach((s, i) => console.log(String(i + 1).padStart(3, ' ') + '. ' + s));
