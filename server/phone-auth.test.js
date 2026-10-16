'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { createPhoneAuth, aliyunProvider } = require('./services/phone-auth');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chunklab-phone-auth-'));
  const db = new Database(path.join(dir, 'test.db'));
  db.pragma('foreign_keys=ON');
  db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL); CREATE TABLE learning(user_id INTEGER, content TEXT);');
  db.prepare('INSERT INTO users VALUES(?,?,?)').run(27, 'old_guest', 'untouched-hash');
  db.prepare('INSERT INTO learning VALUES(?,?)').run(27, 'irreplaceable course and records');
  let clock = 1000000000, sends = 0, verifies = 0;
  let providerFails = false;
  const provider = {
    async send() { sends++; if(providerFails) throw Error('sensitive vendor response'); },
    async verify(phone, code) { verifies++; return code === '123456'; }
  };
  const service = createPhoneAuth({ db, provider, now: () => clock });
  const send = (phone, extra = {}) => service.send({ phone, ip: 'isolated-ip', ...extra });
  const login = (phone, challenge, extra = {}) => service.verify({ phone, code: '123456', challengeId: challenge.challengeId, ...extra });
  try {
    assert.throws(() => aliyunProvider({}), e => e.code === 'SMS_UNAVAILABLE');
    await assert.rejects(send('bad'), e => e.code === 'INVALID_PHONE');
    const first = await send('13800138000');
    await assert.rejects(send('13800138000'), e => e.status === 429);
    assert.equal(sends, 1);
    await assert.rejects(service.verify({ phone: '13800138001', code: '123456', challengeId: first.challengeId }), /失效/);
    assert.equal(verifies, 0);
    const [a,b] = await Promise.allSettled([login('13800138000', first), login('13800138000', first)]);
    assert.equal(a.status, 'fulfilled'); assert.equal(b.status, 'rejected');
    assert.equal(verifies, 1);
    assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 2);
    clock += 61000;
    const again = await send('13800138000');
    assert.equal((await login('13800138000', again)).id, a.value.id);
    assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 2);
    const binding = await send('13900139000', { purpose: 'bind', ownerId: 27 });
    await assert.rejects(login('13900139000', binding), /失效/);
    assert.equal((await login('13900139000', binding, { purpose: 'bind', ownerId: 27 })).id, 27);
    assert.equal(service.ownerPhone(27), '139****9000');
    assert.equal(db.prepare('SELECT password_hash FROM users WHERE id=27').get().password_hash, 'untouched-hash');
    assert.equal(db.prepare('SELECT content FROM learning WHERE user_id=27').get().content, 'irreplaceable course and records');
    clock += 61000;
    const sameAccount = await send('13900139000');
    assert.equal((await login('13900139000', sameAccount)).id, 27);
    clock += 61000;
    const conflict = await send('13800138000', { purpose: 'bind', ownerId: 27 });
    const conflictResult = await login('13800138000', conflict, { purpose: 'bind', ownerId: 27 });
    assert.equal(conflictResult.error.code, 'PHONE_ALREADY_BOUND');
    await assert.rejects(login('13800138000', conflict, { purpose: 'bind', ownerId: 27 }), /失效/);
    const wrong = await send('13700137000');
    for(let i=0;i<5;i++) await assert.rejects(service.verify({ phone: '13700137000', code: '000000', challengeId: wrong.challengeId }), /不正确/);
    await assert.rejects(login('13700137000', wrong), /失效/);
    const expired = await send('13600136000'); clock += 300001;
    await assert.rejects(login('13600136000', expired), /失效/);
    providerFails = true;
    await assert.rejects(send('13500135000'), e => e.status === 503 && !e.message.includes('sensitive'));
    assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 2);
    // Limits survive recreation/restart, not just a process-local map.
    const restarted = createPhoneAuth({ db, provider, now: () => clock });
    await assert.rejects(restarted.send({ phone: '13500135000', ip: 'another' }), e => e.status === 429);
    console.log('phone-auth: PASS (isolated database, no real SMS or user data accessed)');
  } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode=1; });
