'use strict';

const { gzipSync, gunzipSync } = require('node:zlib');
// Bound synchronous work inside the existing SQLite transaction. Large course
// import receipts stay plain JSON rather than blocking on a large compression.
const MIN_BYTES = 1024, MAX_BYTES = 512 * 1024;
function corrupt() {
  return Object.assign(new Error('保存回执损坏，已暂停重放；原记录保留'), { code: 'OPERATION_RECEIPT_CORRUPT', status: 500 });
}
function encodeReceipt(result) {
  const plain = JSON.stringify(result);
  const plainBytes = Buffer.byteLength(plain);
  if (!Object.hasOwn(result, 'changes') || plainBytes < MIN_BYTES || plainBytes > MAX_BYTES) return plain;
  const hasStat = result.operation && Object.hasOwn(result.operation, 'stat');
  const bulk = JSON.stringify({ changes: result.changes, ...(hasStat ? { stat: result.operation.stat } : {}) });
  const bytes = Buffer.byteLength(bulk);
  if (bytes < MIN_BYTES || bytes > MAX_BYTES) return plain;
  const operation = hasStat ? { ...result.operation } : result.operation;
  if (hasStat) delete operation.stat;
  const { changes, ...metadata } = result; void changes;
  const stored = JSON.stringify({ ...metadata, operation, _receiptBody: {
    version: 1, codec: 'gzip-base64', bytes, data: gzipSync(Buffer.from(bulk), { level: 1 }).toString('base64')
  } });
  return Buffer.byteLength(stored) < plainBytes ? stored : plain;
}
function decodeReceipt(json) {
  try {
    const stored = JSON.parse(json);
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) throw corrupt();
    if (!Object.hasOwn(stored, '_receiptBody')) return stored;
    const body = stored._receiptBody;
    if (!body || body.version !== 1 || body.codec !== 'gzip-base64' || !Number.isSafeInteger(body.bytes) ||
        body.bytes < MIN_BYTES || body.bytes > MAX_BYTES || typeof body.data !== 'string' || body.data.length > MAX_BYTES * 2) throw corrupt();
    const raw = gunzipSync(Buffer.from(body.data, 'base64'), { maxOutputLength: MAX_BYTES });
    if (raw.length !== body.bytes) throw corrupt();
    const bulk = JSON.parse(raw.toString('utf8'));
    if (!bulk || typeof bulk !== 'object' || !Object.hasOwn(bulk, 'changes')) throw corrupt();
    const { _receiptBody, ...result } = stored; void _receiptBody;
    if (Object.hasOwn(bulk, 'stat')) {
      if (!result.operation || typeof result.operation !== 'object') throw corrupt();
      result.operation = { ...result.operation, stat: bulk.stat };
    }
    result.changes = bulk.changes;
    return result;
  } catch (_) { throw corrupt(); }
}
module.exports = { encodeReceipt, decodeReceipt, corrupt, MIN_BYTES, MAX_BYTES };
