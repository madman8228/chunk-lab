'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function csv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (ch === '\n' && !quoted) { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  if (quoted) throw Error('Unclosed CSV quote');
  return rows;
}
async function collect(input, output, pinnedCommit) {
  if (fs.existsSync(output)) throw Error('Output must be new');
  const reportBytes = fs.readFileSync(input), report = JSON.parse(reportBytes);
  const needed = new Set();
  for (const book of report.books) for (const item of book.pending) {
    needed.add(item.word.toLowerCase().replace(/[!?.,]+$/g, '').trim());
    for (const token of item.word.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || []) needed.add(token);
  }
  let sha = pinnedCommit;
  if (!sha) {
    const response = await fetch('https://api.github.com/repos/skywind3000/ECDICT/commits/master', { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'ChunkPracticePhonetics' } });
    if (!response.ok) throw Error('Commit request failed: ' + response.status);
    sha = (await response.json()).sha;
  }
  if (!/^[0-9a-f]{40}$/.test(sha)) throw Error('Invalid commit');
  const get = async file => { const url = 'https://raw.githubusercontent.com/skywind3000/ECDICT/' + sha + '/' + file; const r = await fetch(url, { signal: AbortSignal.timeout(180000) }); if (!r.ok) throw Error('Download failed ' + r.status); return { url, bytes: Buffer.from(await r.arrayBuffer()) }; };
  const [data, license, readme] = await Promise.all([get('ecdict.csv'), get('LICENSE'), get('README.md')]);
  const rows = csv(data.bytes.toString('utf8'));
  const entries = rows.slice(1).filter(row => needed.has(row[0]?.toLowerCase())).map(row => ({ word: row[0], phonetic: row[1], translation: row[3], pos: row[4], exchange: row[10] }));
  const source = { name: 'ECDICT', commit: sha, url: data.url, sha256: hash(data.bytes), license: 'MIT', note: 'Upstream says mainly British phonetics, not exclusively British. Supplement candidates require dialect and sense review.', input: path.resolve(input), inputSha256: hash(reportBytes), entries };
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'ecdict.csv'), data.bytes, { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'LICENSE'), license.bytes, { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'README-source.md'), readme.bytes, { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'source.json'), JSON.stringify(source, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ entries: entries.length, withPhonetic: entries.filter(row => row.phonetic).length, commit: sha }));
}
if (require.main === module) collect(...process.argv.slice(2)).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { csv };
