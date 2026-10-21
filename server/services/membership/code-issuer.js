'use strict';

const crypto = require('node:crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const CODE_BYTES = 20;

function encodeBase32(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function normalizeCode(value) {
  if (typeof value !== 'string' || value.length > 128 || !/^[A-Za-z0-9 -]+$/.test(value)) throw new TypeError('兑换码格式不正确');
  const normalized = value.toUpperCase().replace(/[ -]/g, '');
  if (!/^CL1[A-Z2-7]{32}$/.test(normalized)) throw new TypeError('兑换码格式不正确');
  return normalized;
}

function formatCode(canonical) {
  const value = normalizeCode(canonical);
  return 'CL1-' + value.slice(3).match(/.{1,4}/g).join('-');
}

function createMembershipCodeIssuer(options) {
  const repository = options.repository;
  const db = repository.db;
  const randomBytes = options.randomBytes || crypto.randomBytes;
  const uuid = options.uuid || crypto.randomUUID;
  const keyProvider = options.keyProvider;
  if (!keyProvider || typeof keyProvider.current !== 'function' || typeof keyProvider.get !== 'function') {
    throw new TypeError('Membership code key provider is required');
  }
  const insertBatch = db.prepare(`INSERT INTO redemption_batches
    (batch_id,plan_snapshot_json,quantity,redeem_by,channel_ref,status,revision,created_by,created_at)
    VALUES(?,?,?,?,?,'paused',1,?,?)`);
  const insertCode = db.prepare(`INSERT INTO redemption_codes
    (code_id,batch_id,code_digest,key_version,status,created_at) VALUES(?,?,?,?, 'unused',?)`);
  const insertReceipt = db.prepare(`INSERT INTO admin_issue_receipts(admin_id,request_id,payload_hash,batch_id,created_at)
    VALUES(?,?,?,?,?)`);
  const insertAudit = db.prepare(`INSERT INTO membership_admin_audit(admin_id,action,target_id,details_json,created_at)
    VALUES(?,?,?,?,?)`);
  const priorReceipt = db.prepare('SELECT payload_hash,batch_id FROM admin_issue_receipts WHERE admin_id=? AND request_id=?');

  function digest(code, key) {
    return crypto.createHmac('sha256', key.secret).update(code, 'utf8').digest('hex');
  }

  function issue(input, adminId) {
    const body = input || {};
    const requestId = String(body.requestId || '');
    if (!/^[A-Za-z0-9_-]{12,100}$/.test(requestId)) throw Object.assign(new Error('requestId 无效'), { status: 400 });
    if (!Number.isSafeInteger(adminId) || adminId < 1) throw Object.assign(new Error('管理员身份无效'), { status: 401 });
    const plan = repository.listPlans().find(item => item.key === body.planKey && item.enabled);
    if (!plan) throw Object.assign(new Error('套餐不可用'), { status: 400 });
    if (!Number.isSafeInteger(body.quantity) || body.quantity < 1 || body.quantity > 10000) {
      throw Object.assign(new Error('数量需为 1 到 10000 之间的整数'), { status: 400 });
    }
    const redeemBy = body.redeemBy == null || body.redeemBy === '' ? null : Number(body.redeemBy);
    if (redeemBy !== null && (!Number.isSafeInteger(redeemBy) || redeemBy <= repository.now())) {
      throw Object.assign(new Error('兑换截止时间无效'), { status: 400 });
    }
    const channelRef = String(body.channelRef || '').trim();
    if (channelRef.length > 100) throw Object.assign(new Error('渠道备注最多 100 个字符'), { status: 400 });
    const payload = { planKey: plan.key, quantity: body.quantity, redeemBy, channelRef };
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const prior = priorReceipt.get(adminId, requestId);
    if (prior) {
      if (prior.payload_hash !== payloadHash) throw Object.assign(new Error('requestId 已用于其他发码参数'), { status: 409, code: 'IDEMPOTENCY_CONFLICT' });
      throw Object.assign(new Error('该批次已生成；为避免重复发码，系统不重新显示原兑换码'), {
        status: 409, code: 'EXPORT_UNAVAILABLE', batchId: prior.batch_id
      });
    }
    const key = keyProvider.current();
    if (!key || typeof key.version !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(key.version) ||
        !Buffer.isBuffer(key.secret) || key.secret.length < 32) {
      throw Object.assign(new Error('兑换码密钥未正确配置'), { status: 503, code: 'CODE_KEYS_UNAVAILABLE' });
    }

    const batchId = uuid();
    const createdAt = repository.now();
    const codes = Array.from({ length: body.quantity }, () => {
      const bytes = randomBytes(CODE_BYTES);
      if (!Buffer.isBuffer(bytes) || bytes.length !== CODE_BYTES) throw new Error('随机源不可用');
      const canonical = 'CL1' + encodeBase32(bytes);
      return { codeId: uuid(), code: formatCode(canonical), digest: digest(canonical, key) };
    });
    const transaction = db.transaction(() => {
      const committed = priorReceipt.get(adminId, requestId);
      if (committed) throw Object.assign(new Error('该批次已生成，不能再次下载原码'), {
        status: 409, code: committed.payload_hash === payloadHash ? 'EXPORT_UNAVAILABLE' : 'IDEMPOTENCY_CONFLICT',
        batchId: committed.batch_id
      });
      insertBatch.run(batchId, JSON.stringify({ key: plan.key, displayName: plan.displayName,
        termMonths: plan.termMonths, entitlementKey: 'member_access' }), body.quantity, redeemBy, channelRef, adminId, createdAt);
      for (const item of codes) insertCode.run(item.codeId, batchId, item.digest, key.version, createdAt);
      insertReceipt.run(adminId, requestId, payloadHash, batchId, createdAt);
      insertAudit.run(adminId, 'issue_export', batchId, JSON.stringify({ planKey: plan.key, quantity: body.quantity }), createdAt);
    });
    transaction.immediate();
    return Object.freeze({ batchId, status: 'paused', redeemBy, quantity: codes.length, codes: Object.freeze(codes), plan });
  }

  return Object.freeze({ issue, digest, keyProvider });
}

module.exports = { createMembershipCodeIssuer, encodeBase32, normalizeCode, formatCode };
