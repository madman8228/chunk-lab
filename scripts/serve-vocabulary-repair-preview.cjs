const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const root = path.resolve(__dirname, '..');
const repairDir = path.join(root, 'output/vocabulary-illustrations/repairs-20261019');
const snapshotPath = path.join(root, 'output/vocabulary-illustrations/reviews/review-1792424680626-b4498764.json');
const catalogPath = path.join(root, 'output/vocabulary-illustrations/catalog-20261019-v3.json');
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const issues = snapshot.entries.filter((entry) => entry.status === 'issue');
const reports = Array.from({ length: 8 }, (_, index) => JSON.parse(fs.readFileSync(path.join(repairDir, `batch-${String(index + 1).padStart(2, '0')}-manifest.report.json`), 'utf8')));
const replacements = new Map();
for (const report of reports) {
  for (const cell of report.cells) {
    const file = cell.files.find((item) => item.path.endsWith('-wide-v2.webp'));
    replacements.set(cell.itemId, { image: file.path, bytes: file.bytes, kind: '新绘' });
  }
}
const reusePaths = new Map([
  ['pep-g3-2024-upper-u1:01', 'assets/vocab-u1-name-wide-v2.webp'],
  ['pep-g3-2024-upper-u1:03', 'assets/vocab-u4-ear-wide-v1.webp'],
  ['pep-g3-2024-lower-u3:10', 'assets/vocab-u3-see-wide-v2.webp'],
]);
for (const [itemId, image] of reusePaths) {
  const asset = catalog.assets.find((candidate) => candidate.path === image);
  if (asset) replacements.set(itemId, { image, bytes: asset.bytes, kind: '復用候选' });
}
const data = issues.map((entry) => ({ ...entry, replacement: replacements.get(entry.itemId) || null }));
const allowedAssets = new Set(data.flatMap((entry) => [entry.replacement?.image, entry.image?.replace(/^\//, '')]).filter(Boolean));
const mime = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/api/data') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(data));
    return;
  }
  if (url.pathname === '/' || url.pathname === '/repair-preview.html') {
    const file = path.join(repairDir, 'repair-preview.html');
    res.writeHead(200, { 'content-type': mime['.html'], 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
    return;
  }
  if (url.pathname.startsWith('/asset/')) {
    const relative = decodeURIComponent(url.pathname.slice('/asset/'.length));
    if (!allowedAssets.has(relative)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const file = path.resolve(root, relative);
    if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable' });
    fs.createReadStream(file).pipe(res);
    return;
  }
  res.writeHead(404); res.end('Not found');
});

const port = Number(process.env.REPAIR_PREVIEW_PORT || 4190);
server.listen(port, '127.0.0.1', () => console.log(`Vocabulary repair preview: http://127.0.0.1:${port}/`));
