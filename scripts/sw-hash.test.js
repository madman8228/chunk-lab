'use strict';
const assert = require('assert');
const { hashBuffers, normalizeCache } = require('./sw-hash.js');

const swLf = "const CACHE = 'chunklab-old';\nconst PRECACHE = [];\n";
const swCrlf = swLf.replace(/\n/g, '\r\n');
const filesLf = [Buffer.from('alpha\nbeta\n', 'utf8')];
const filesCrlf = [Buffer.from('alpha\r\nbeta\r\n', 'utf8')];

assert.strictEqual(
  hashBuffers(filesLf, swLf),
  hashBuffers(filesCrlf, swCrlf),
  'LF 与 CRLF 工作区必须生成相同的 Service Worker 指纹'
);
assert.strictEqual(
  normalizeCache(swCrlf),
  "const CACHE = '<AUTO>';\r\nconst PRECACHE = [];\r\n",
  '归一化只替换 CACHE 值，不应改变其余内容'
);

console.log('[sw-hash] cross-line-ending hash regression passed');
