'use strict';
const crypto=require('node:crypto');
const WEEK=7*24*60*60*1000;
const fail=code=>Object.assign(new Error(code),{code,status:403});

// Keys are supplied by the host; never derive them from or expose the online HMAC key.
function createOfflineLicense({privateKey,publicKey,now=Date.now}) {
  function issue({accountId,service,courseId,unitId,contentVersion,sha256},decision) {
    if(!decision?.allowed||!['free','member'].includes(decision.mode))throw fail('OFFLINE_ACCESS_DENIED');
    if(![accountId,service,courseId,unitId,contentVersion].every(v=>typeof v==='string'&&v.length>0)||!/^[a-f0-9]{64}$/.test(sha256))throw fail('INVALID_OFFLINE_SCOPE');
    const issuedAt=now();
    const expiresAt=decision.mode==='member'?Math.min(issuedAt+WEEK,Number(decision.endsAt)):null;
    if(!Number.isSafeInteger(issuedAt)||expiresAt!==null&&(!Number.isSafeInteger(expiresAt)||expiresAt<=issuedAt))throw fail('OFFLINE_ACCESS_EXPIRED');
    const claims={version:1,accountId,service,courseId,unitId,contentVersion,sha256,mode:decision.mode,issuedAt,expiresAt};
    const payload=Buffer.from(JSON.stringify(claims)).toString('base64url');
    return {payload,signature:crypto.sign('sha256',Buffer.from(payload),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};
  }
  function publicJwk(){return crypto.createPublicKey(publicKey).export({format:'jwk'});}
  return {issue,publicJwk};
}
module.exports={createOfflineLicense,WEEK};
