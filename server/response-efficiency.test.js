'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const http = require('node:http');
const express = require('express');
const compress = require('./compress');
const apiCompress = require('./api-compress');

async function conditionalWithoutEncoding() {
  const moduleObject = { exports: {} }; let encodes = 0, reads = 0;
  const stat = { size: 4096, mtimeMs: 1700000000000, isFile: () => true };
  vm.runInNewContext(fs.readFileSync(require.resolve('./compress'), 'utf8'), {
    module: moduleObject, Buffer, console,
    require: name => name === 'fs' ? { statSync: () => stat, readFileSync: () => { reads++; return Buffer.alloc(4096); } }
      : name === 'zlib' ? { constants: {}, brotliCompress: (_b, _o, cb) => { encodes++; cb(null, Buffer.alloc(12)); } } : require(name)
  });
  const headers = {}; let status, resolve;
  const ended = new Promise(done => { resolve = done; });
  const res = { setHeader: (key, value) => { headers[key] = value; }, removeHeader: key => { delete headers[key]; },
    status: code => { status = code; return res; }, end: () => { resolve(); return res; } };
  moduleObject.exports('/synthetic')({ method: 'GET', path: '/test.js', headers: {
    'accept-encoding': 'br', 'if-none-match': compress._internal.etagFor(stat, 'br')
  } }, res, () => { throw Error('unexpected passthrough'); });
  await ended;
  assert.equal(status, 304); assert.equal(headers.Vary, 'Accept-Encoding');
  assert.equal(reads, 0, 'a matching ETag must not read a cold file');
  assert.equal(encodes, 0, 'a matching ETag must not compress a cold file');
  assert.equal(headers['Content-Length'], undefined);
}

async function singleJsonSerialization() {
  const app = express(); let serializations = 0;
  app.use('/optimized', apiCompress());
  function payload() { return { toJSON() { serializations++; return { ok: true, text: '<>&中文' }; } }; }
  app.get('/optimized', (_req, res) => res.status(201).json(payload()));
  app.get('/reference', (_req, res) => res.status(201).json(payload()));
  app.get('/optimized/undefined', (_req, res) => res.json(undefined));
  app.get('/reference/undefined', (_req, res) => res.json(undefined));
  app.get('/optimized/large', (_req, res) => res.json({ text: '<>&'.repeat(1000), secret: 'redact' }));
  app.get('/reference/large', (_req, res) => res.json({ text: '<>&'.repeat(1000), secret: 'redact' }));
  for (const prefix of ['/optimized', '/reference']) {
    app.get(prefix + '/null', (_req, res) => res.json(null));
    app.get(prefix + '/empty', (_req, res) => res.status(204).json({ ok: true }));
    app.get(prefix + '/custom', (_req, res) => res.set('Content-Type', 'application/problem+json').json({ error: 'synthetic' }));
    app.get(prefix + '/error', (_req, res) => res.json({ toJSON() { throw Error('synthetic serialization failure'); } }));
  }
  app.use((error, _req, res, _next) => res.status(500).send(error.message));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  async function get(path, headers = {}) {
    return new Promise((resolve, reject) => {
      const req = http.get({ hostname: '127.0.0.1', port: server.address().port, path, headers }, res => {
        const chunks = []; res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      }); req.on('error', reject);
    });
  }
  try {
    const optimized = await get('/optimized', { 'Accept-Encoding': 'gzip' });
    assert.equal(serializations, 1, 'small JSON must invoke toJSON exactly once');
    const reference = await get('/reference');
    assert.equal(optimized.status, reference.status); assert.deepEqual(optimized.body, reference.body);
    for (const name of ['content-type', 'content-length', 'etag']) assert.equal(optimized.headers[name], reference.headers[name]);
    const unchanged = await get('/optimized', { 'Accept-Encoding': 'gzip', 'If-None-Match': optimized.headers.etag });
    assert.equal(unchanged.status, 304); assert.equal(unchanged.body.length, 0);
    app.set('json spaces', 2); app.set('json escape', true);
    app.set('json replacer', (key, value) => key === 'secret' ? undefined : value);
    for (const suffix of ['', '/undefined', '/large', '/null', '/empty', '/custom', '/error']) {
      const actual = await get('/optimized' + suffix, { 'Accept-Encoding': 'gzip' });
      const expected = await get('/reference' + suffix);
      const decoded = actual.headers['content-encoding'] === 'gzip' ? require('node:zlib').gunzipSync(actual.body) : actual.body;
      assert.deepEqual(decoded, expected.body, 'Express JSON settings match for ' + suffix);
      assert.equal(actual.status, expected.status); assert.equal(actual.headers['content-type'], expected.headers['content-type']);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
}

(async () => {
  let failures = 0;
  for (const test of [conditionalWithoutEncoding, singleJsonSerialization]) {
    try { await test(); console.log('PASS ' + test.name); }
    catch (error) { failures++; console.error('FAIL ' + test.name + ': ' + error.message); }
  }
  if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
