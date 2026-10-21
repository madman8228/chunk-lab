'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Exercise the real provider with an injected SDK at the module boundary. No
// environment file, network, phone account, or application database is used.
const file = path.join(__dirname, 'services/sms-verification.js');
const realRequire = createRequire(file);
const calls = [];
let config, next = { body: { success: true, code: 'OK' } }, thrown;
class Request { constructor(value) { Object.assign(this, value); } }
class Client {
  constructor(value) { config = value; }
  async sendSmsVerifyCodeWithOptions(request, runtime) {
    calls.push({ action: 'send', request, runtime });
    if (thrown) throw thrown;
    return next;
  }
  async checkSmsVerifyCodeWithOptions(request, runtime) {
    calls.push({ action: 'verify', request, runtime });
    if (thrown) throw thrown;
    return next;
  }
}
const sdkRequire = name => {
  if (name === '@alicloud/dypnsapi20170525') return { default: Client, SendSmsVerifyCodeRequest: Request, CheckSmsVerifyCodeRequest: Request };
  if (name === '@alicloud/openapi-client') return { Config: Request };
  if (name === '@alicloud/tea-util') return { RuntimeOptions: Request };
  return realRequire(name);
};
const component = { exports: {} };
vm.runInNewContext(fs.readFileSync(file, 'utf8'), { require: sdkRequire, module: component, Buffer }, { filename: file });

(async () => {
  const { aliyunProvider } = component.exports;
  assert.equal(require('./services/phone-auth').aliyunProvider, require('./services/sms-verification').aliyunProvider,
    'existing callers keep the same exported provider');
  assert.throws(() => aliyunProvider({}), error => error.code === 'SMS_UNAVAILABLE' && error.status === 503);
  const provider = aliyunProvider({ ALIBABA_CLOUD_ACCESS_KEY_ID: 'synthetic-key', ALIBABA_CLOUD_ACCESS_KEY_SECRET: 'synthetic-secret',
    SMS_SIGN_NAME: 'Synthetic sign', SMS_TEMPLATE_CODE: 'synthetic-template' });
  assert.equal(config.endpoint, 'dypnsapi.aliyuncs.com');
  assert.equal(config.regionId, 'cn-hangzhou');
  assert.equal(config.accessKeyId, 'synthetic-key');
  await provider.send('13800138000', 'synthetic-challenge');
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].request)), {
    countryCode: '86', phoneNumber: '13800138000', outId: 'synthetic-challenge',
    signName: 'Synthetic sign', templateCode: 'synthetic-template', templateParam: '{"code":"##code##","min":"5"}',
    codeLength: 6, validTime: 300, interval: 60, duplicatePolicy: 1, autoRetry: 0, returnVerifyCode: false
  });
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].runtime)), { connectTimeout: 5000, readTimeout: 10000, autoretry: false });
  for (const result of ['PASS', 'FAIL']) {
    next = { body: { success: true, code: 'OK', model: { verifyResult: result } } };
    assert.equal(await provider.verify('13800138000', '123456', 'synthetic-challenge'), result === 'PASS');
  }
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1].request)), {
    countryCode: '86', phoneNumber: '13800138000', verifyCode: '123456', outId: 'synthetic-challenge'
  });
  next = { body: { success: false, code: 'SYNTHETIC_FAILURE', message: 'private vendor details' } };
  await assert.rejects(provider.send('13800138000', 'synthetic-challenge'), error =>
    error.code === 'SMS_UNAVAILABLE' && error.status === 503 && !error.message.includes('private'));
  thrown = Object.assign(new Error('synthetic SDK error'), { code: 'SYNTHETIC_TIMEOUT' });
  const before = calls.length;
  await assert.rejects(provider.send('13800138000', 'synthetic-challenge'), error => error === thrown);
  assert.equal(calls.length, before + 1, 'failed sends are never automatically retried');
  const alternate = aliyunProvider({ ALIYUN_ACCESS_KEY_ID: 'alternate-key', ALIYUN_ACCESS_KEY_SECRET: 'alternate-secret',
    SMS_SIGN_NAME: 'Another sign', SMS_TEMPLATE_CODE: 'another-template', SMS_PNVS_SCHEME_NAME: 'synthetic-scheme',
    SMS_ALIYUN_PNVS_REGION_ID: 'synthetic-region' });
  assert.equal(config.accessKeyId, 'alternate-key');
  assert.equal(config.regionId, 'synthetic-region');
  thrown = null; next = { body: { success: true, code: 'OK' } };
  await alternate.send('13800138000', 'another-challenge');
  assert.equal(calls.at(-1).request.schemeName, 'synthetic-scheme');
  console.log('sms-verification: provider contract passed; injected SDK only, no real SMS');
})().catch(error => { console.error(error); process.exitCode = 1; });
