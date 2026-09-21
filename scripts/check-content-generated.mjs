/* Rebuild content into a temporary directory and compare it with the checked-in shards. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-content-check-'));

function files(dir, prefix = '') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.posix.join(prefix, entry.name);
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? files(target, rel) : [rel];
  });
}

try {
  const result = spawnSync(process.execPath, ['scripts/build-content.mjs'], {
    cwd: root,
    env: { ...process.env, CONTENT_OUTPUT_ROOT: temp },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exitCode = result.status || 1;
  } else {
    const expected = files(path.join(root, 'content')).sort();
    const generated = files(path.join(temp, 'content')).sort();
    const missing = expected.filter((file) => !generated.includes(file));
    const extra = generated.filter((file) => !expected.includes(file));
    const changed = expected.filter((file) => generated.includes(file) &&
      !Buffer.from(fs.readFileSync(path.join(root, 'content', file))).equals(
        fs.readFileSync(path.join(temp, 'content', file))));
    if (missing.length || extra.length || changed.length) {
      console.error('[content:check-generated] 生成内容与仓库不一致');
      if (missing.length) console.error('  缺失: ' + missing.slice(0, 8).join(', '));
      if (extra.length) console.error('  多余: ' + extra.slice(0, 8).join(', '));
      if (changed.length) console.error('  变更: ' + changed.slice(0, 8).join(', '));
      process.exitCode = 1;
    } else {
      console.log('[content:check-generated] generated content matches source');
    }
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
