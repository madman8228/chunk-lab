'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-loadenv-test-'));
try {
  fs.copyFileSync(path.join(__dirname, 'loadenv.js'), path.join(temp, 'loadenv.js'));
  fs.writeFileSync(path.join(temp, '.env'), 'CHUNKLAB_LOADENV_PROBE=from-dotenv\n');
  function probe(env) {
    const result = spawnSync(process.execPath, ['-e', "require('./loadenv'); process.stdout.write(process.env.CHUNKLAB_LOADENV_PROBE || '')"], {
      cwd: temp, env, encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  }
  assert.equal(probe({ NODE_ENV: 'development' }), 'from-dotenv');
  assert.equal(probe({ NODE_ENV: 'test' }), '');
  assert.equal(probe({ NODE_ENV: 'production' }), '');
  assert.equal(probe({ NODE_ENV: 'production', CHUNKLAB_LOADENV_PROBE: 'injected' }), 'injected');
  console.log('loadenv: dev dotenv and test/production isolation passed');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
