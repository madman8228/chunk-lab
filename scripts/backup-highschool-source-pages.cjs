const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const projectRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(projectRoot, 'output/textbook-extractions');
const backupParent = 'E:/chunk-practice-backups';
const finalRoot = path.join(backupParent, 'highschool-source-pages-20261021');
const stageRoot = `${finalRoot}.staging`;
const books = [
  'highschool-pep-required1-2019-20261016',
  'highschool-pep-required2-2019-20261016',
  'highschool-pep-required3-2019-20261016'
];

if (!fs.existsSync(backupParent)) throw new Error(`Backup disk path not found: ${backupParent}`);
if (fs.existsSync(finalRoot) || fs.existsSync(stageRoot)) throw new Error('Backup destination exists; refusing to overwrite or merge.');

const sources = books.flatMap(book => {
  const directory = path.join(sourceRoot, book, 'source-images');
  if (!fs.statSync(directory).isDirectory()) throw new Error(`Source directory missing: ${directory}`);
  return fs.readdirSync(directory).filter(name => name.toLowerCase().endsWith('.png')).sort().map(name => ({
    book,
    name,
    path: path.join(directory, name)
  }));
});
if (sources.length !== 51) throw new Error(`Expected 51 original scan images; found ${sources.length}`);

fs.mkdirSync(stageRoot, { recursive: false });
const files = [];
for (const source of sources) {
  const relativePath = path.join(source.book, 'source-images', source.name);
  const destination = path.join(stageRoot, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const before = fs.readFileSync(source.path);
  const sha256 = crypto.createHash('sha256').update(before).digest('hex');
  fs.copyFileSync(source.path, destination, fs.constants.COPYFILE_EXCL);
  const copied = fs.readFileSync(destination);
  const copiedSha256 = crypto.createHash('sha256').update(copied).digest('hex');
  if (copiedSha256 !== sha256 || copied.length !== before.length) throw new Error(`Backup verification failed: ${relativePath}`);
  files.push({ book: source.book, relativePath, bytes: copied.length, sha256 });
}

const manifest = {
  createdAt: new Date().toISOString(),
  source: 'D:/06-project/chunk-practice/output/textbook-extractions/<book>/source-images/',
  destination: 'E:/chunk-practice-backups/highschool-source-pages-20261021/',
  operation: 'copy-only; source originals retained; no Git upload',
  books,
  fileCount: files.length,
  totalBytes: files.reduce((total, file) => total + file.bytes, 0),
  verified: files.every(file => file.sha256),
  files
};
fs.writeFileSync(path.join(stageRoot, 'BACKUP-MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
fs.renameSync(stageRoot, finalRoot);
console.log(JSON.stringify({ destination: finalRoot, fileCount: manifest.fileCount, totalBytes: manifest.totalBytes, verified: manifest.verified }, null, 2));
