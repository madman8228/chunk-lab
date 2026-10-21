'use strict';

// Stateless SMS adapter: no accounts, persistence, or automatic retries.
function unavailable() {
  return Object.assign(new Error('验证码服务暂时不可用，请稍后再试'), { code: 'SMS_UNAVAILABLE', status: 503 });
}

function aliyunProvider(env = process.env) {
  const key = env.ALIBABA_CLOUD_ACCESS_KEY_ID || env.ALIYUN_ACCESS_KEY_ID;
  const secret = env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || env.ALIYUN_ACCESS_KEY_SECRET;
  if (!key || !secret || !env.SMS_SIGN_NAME || !env.SMS_TEMPLATE_CODE) throw unavailable();
  const SDK = require('@alicloud/dypnsapi20170525');
  const { Config } = require('@alicloud/openapi-client');
  const { RuntimeOptions } = require('@alicloud/tea-util');
  const client = new SDK.default(new Config({
    accessKeyId: key, accessKeySecret: secret,
    regionId: env.SMS_ALIYUN_PNVS_REGION_ID || 'cn-hangzhou',
    endpoint: 'dypnsapi.aliyuncs.com'
  }));
  const runtime = new RuntimeOptions({ connectTimeout: 5000, readTimeout: 10000, autoretry: false });
  const common = { countryCode: '86', schemeName: env.SMS_PNVS_SCHEME_NAME || undefined };
  function body(response) {
    const value = response && response.body;
    if (!value || value.success !== true || value.code !== 'OK') throw unavailable();
    return value;
  }
  return {
    async send(phone, id) {
      body(await client.sendSmsVerifyCodeWithOptions(new SDK.SendSmsVerifyCodeRequest({
        ...common, phoneNumber: phone, outId: id,
        signName: env.SMS_SIGN_NAME, templateCode: env.SMS_TEMPLATE_CODE,
        templateParam: JSON.stringify({ code: '##code##', min: '5' }),
        codeLength: 6, validTime: 300, interval: 60,
        duplicatePolicy: 1, autoRetry: 0, returnVerifyCode: false
      }), runtime));
    },
    async verify(phone, code, id) {
      const result = body(await client.checkSmsVerifyCodeWithOptions(new SDK.CheckSmsVerifyCodeRequest({
        ...common, phoneNumber: phone, verifyCode: code, outId: id
      }), runtime));
      return result.model && result.model.verifyResult === 'PASS';
    }
  };
}

module.exports = { aliyunProvider };
