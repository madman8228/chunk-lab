'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* Git may check out text files with LF or CRLF. Hash their canonical LF form,
 * while leaving binary assets byte-for-byte unchanged. */
function canonicalText(value) {
  return String(value).replace(/\r\n?/g, '\n');
}

function canonicalBuffer(buffer) {
  if (buffer.includes(0)) return buffer;
  return Buffer.from(canonicalText(buffer.toString('utf8')), 'utf8');
}

function normalizeCache(source) {
  return String(source).replace(/^const CACHE = '[^']*';.*$/m, "const CACHE = '<AUTO>';" );
}

function hashBuffers(buffers, swSource) {
  const hash = crypto.createHash('sha1');
  buffers.forEach(function (buffer) { hash.update(canonicalBuffer(buffer)); });
  hash.update(canonicalBuffer(Buffer.from(normalizeCache(swSource), 'utf8')));
  return hash.digest('hex');
}

function hashFiles(options) {
  const buffers = options.files.map(function (file) {
    return fs.readFileSync(path.join(options.root, file.replace(/^\//, '')));
  });
  return hashBuffers(buffers, options.swSource);
}

module.exports = { canonicalText, canonicalBuffer, normalizeCache, hashBuffers, hashFiles };
